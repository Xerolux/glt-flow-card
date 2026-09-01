"""Versioned project repositories with verified copy-on-write legacy import."""
from __future__ import annotations

from collections.abc import Callable, Mapping
from copy import deepcopy
from typing import Any

from homeassistant.helpers.storage import Store

from .const import (
    MAX_AUDIT,
    PROJECT_AUDIT_STORE_KEY,
    PROJECT_AUDIT_STORE_VERSION,
    PROJECT_HEADS_STORE_KEY,
    PROJECT_HEADS_STORE_VERSION,
    PROJECT_JOURNAL_STORE_KEY,
    PROJECT_JOURNAL_STORE_VERSION,
    PROJECT_LEGACY_BACKUP_STORE_KEY,
    PROJECT_LEGACY_BACKUP_STORE_VERSION,
    PROJECT_SNAPSHOTS_STORE_KEY,
    PROJECT_SNAPSHOTS_STORE_VERSION,
    STORE_KEY,
    STORE_VERSION,
)
from .project_contract import digest_canonical_json, evaluate_project_contract
from .project_migrations import migrate_project_document


StoreFactory = Callable[[Any, int, str], Any]
FailureHook = Callable[[str], None]


def _default_store_factory(hass: Any, version: int, key: str) -> Store[dict[str, Any]]:
    return Store(hass, version, key)


def _empty_heads() -> dict[str, Any]:
    return {"projects": {}, "legacy_import": {"status": "pending"}}


def _empty_snapshots() -> dict[str, Any]:
    return {"snapshots": {}}


def _empty_journals() -> dict[str, Any]:
    return {"journals": {}}


def _empty_audit() -> dict[str, Any]:
    return {"events": []}


def _empty_backup() -> dict[str, Any]:
    return {"backup": None}


class ProjectRepository:
    """Own split project persistence and expose only defensive copies."""

    def __init__(
        self,
        hass: Any,
        *,
        store_factory: StoreFactory | None = None,
        failure_hook: FailureHook | None = None,
    ) -> None:
        factory = store_factory or _default_store_factory
        self._failure_hook = failure_hook
        self.store_specs = {
            "heads": (PROJECT_HEADS_STORE_VERSION, PROJECT_HEADS_STORE_KEY),
            "snapshots": (PROJECT_SNAPSHOTS_STORE_VERSION, PROJECT_SNAPSHOTS_STORE_KEY),
            "journals": (PROJECT_JOURNAL_STORE_VERSION, PROJECT_JOURNAL_STORE_KEY),
            "audit": (PROJECT_AUDIT_STORE_VERSION, PROJECT_AUDIT_STORE_KEY),
            "legacy_backup": (
                PROJECT_LEGACY_BACKUP_STORE_VERSION,
                PROJECT_LEGACY_BACKUP_STORE_KEY,
            ),
        }
        self._heads_store = factory(hass, *self.store_specs["heads"])
        self._snapshots_store = factory(hass, *self.store_specs["snapshots"])
        self._journals_store = factory(hass, *self.store_specs["journals"])
        self._audit_store = factory(hass, *self.store_specs["audit"])
        self._backup_store = factory(hass, *self.store_specs["legacy_backup"])
        self._legacy_store = factory(hass, STORE_VERSION, STORE_KEY)
        self._heads = _empty_heads()
        self._snapshots = _empty_snapshots()
        self._journals = _empty_journals()
        self._audit = _empty_audit()
        self._backup = _empty_backup()

    def _fail(self, stage: str) -> None:
        if self._failure_hook is not None:
            self._failure_hook(stage)

    async def async_initialize(self) -> dict[str, Any]:
        """Load split stores, verify committed data, and import legacy once."""

        self._heads = self._mapping_or(await self._heads_store.async_load(), _empty_heads())
        self._snapshots = self._mapping_or(
            await self._snapshots_store.async_load(), _empty_snapshots()
        )
        self._journals = self._mapping_or(
            await self._journals_store.async_load(), _empty_journals()
        )
        self._audit = self._mapping_or(await self._audit_store.async_load(), _empty_audit())
        self._backup = self._mapping_or(await self._backup_store.async_load(), _empty_backup())
        self._normalize_loaded()

        if self._heads["legacy_import"].get("status") == "complete":
            self._verify_heads(self._heads["projects"])
            self._verify_backup_if_present()
            return self.import_status()

        await self._import_legacy()
        return self.import_status()

    @staticmethod
    def _mapping_or(value: Any, default: dict[str, Any]) -> dict[str, Any]:
        return deepcopy(value) if isinstance(value, Mapping) else default

    def _normalize_loaded(self) -> None:
        self._heads.setdefault("projects", {})
        self._heads.setdefault("legacy_import", {"status": "pending"})
        self._snapshots.setdefault("snapshots", {})
        self._journals.setdefault("journals", {})
        self._audit.setdefault("events", [])
        self._backup.setdefault("backup", None)
        if not isinstance(self._heads["projects"], dict):
            raise ValueError("project heads store is invalid")
        if not isinstance(self._snapshots["snapshots"], dict):
            raise ValueError("project snapshots store is invalid")
        if not isinstance(self._journals["journals"], dict):
            raise ValueError("project journals store is invalid")
        if not isinstance(self._audit["events"], list):
            raise ValueError("project audit store is invalid")

    async def _import_legacy(self) -> None:
        backup = self._backup.get("backup")
        if backup is None:
            legacy = await self._legacy_store.async_load()
            if not isinstance(legacy, Mapping) or not legacy.get("projects"):
                self._heads = {
                    "projects": {},
                    "legacy_import": {
                        "status": "complete",
                        "source": "none",
                        "project_count": 0,
                    },
                }
                await self._heads_store.async_save(deepcopy(self._heads))
                reloaded = await self._heads_store.async_load()
                if reloaded != self._heads:
                    raise RuntimeError("empty project head read-back mismatch")
                return
            payload = deepcopy(dict(legacy))
            backup = {
                "payload": payload,
                "digest": digest_canonical_json(payload)["digest"],
            }
            self._backup = {"backup": backup}
            await self._backup_store.async_save(deepcopy(self._backup))
            self._fail("after_backup_write")
            reloaded_backup = self._mapping_or(
                await self._backup_store.async_load(), _empty_backup()
            )
            if reloaded_backup.get("backup") != backup:
                raise RuntimeError("legacy backup read-back mismatch")
            self._backup = reloaded_backup
        self._verify_backup_if_present()

        payload = self._backup["backup"]["payload"]
        imported, snapshots = self._convert_legacy_projects(payload.get("projects", {}))
        await self._merge_import_snapshots(snapshots)
        source_digest = self._backup["backup"]["digest"]
        staged = {
            "projects": {},
            "staged_projects": imported,
            "legacy_import": {
                "status": "prepared",
                "source": "legacy",
                "source_digest": source_digest,
                "project_count": len(imported),
            },
        }
        self._heads = staged
        await self._heads_store.async_save(deepcopy(staged))
        self._fail("after_stage_write")
        reloaded_stage = self._mapping_or(await self._heads_store.async_load(), _empty_heads())
        if reloaded_stage != staged:
            raise RuntimeError("staged project import read-back mismatch")
        self._verify_heads(reloaded_stage["staged_projects"])
        self._fail("after_stage_verify")

        promoted = {
            "projects": imported,
            "legacy_import": {
                "status": "complete",
                "source": "legacy",
                "source_digest": source_digest,
                "project_count": len(imported),
            },
        }
        self._heads = promoted
        await self._heads_store.async_save(deepcopy(promoted))
        self._fail("after_head_write")
        reloaded_heads = self._mapping_or(await self._heads_store.async_load(), _empty_heads())
        if reloaded_heads != promoted:
            raise RuntimeError("promoted project heads read-back mismatch")
        self._verify_heads(reloaded_heads["projects"])
        self._fail("after_head_verify")
        self._heads = reloaded_heads

    def _verify_backup_if_present(self) -> None:
        backup = self._backup.get("backup")
        if backup is None:
            return
        if not isinstance(backup, Mapping) or "payload" not in backup:
            raise ValueError("legacy backup is invalid")
        if digest_canonical_json(backup["payload"])["digest"] != backup.get("digest"):
            raise ValueError("legacy backup digest mismatch")

    def _convert_legacy_projects(
        self, projects: Any
    ) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
        if not isinstance(projects, Mapping):
            raise ValueError("legacy projects are invalid")
        imported: dict[str, dict[str, Any]] = {}
        snapshots: dict[str, dict[str, Any]] = {}
        for stored_id, raw_entry in projects.items():
            if not isinstance(raw_entry, Mapping):
                raise ValueError(f"legacy project {stored_id} is invalid")
            raw_config = raw_entry.get("config", raw_entry)
            migrated = migrate_project_document(raw_config, dry_run=False)
            candidate = migrated["candidate"]
            project_id = str(
                raw_entry.get("id")
                or candidate.get("project", {}).get("id")
                or stored_id
            ).strip()
            if not project_id:
                raise ValueError("legacy project id is required")
            revision = int(
                raw_entry.get("revision", candidate.get("project", {}).get("revision", 0))
            )
            candidate["project"]["id"] = project_id
            candidate["project"]["revision"] = revision
            evidence = evaluate_project_contract(candidate)
            if not evidence["valid"]:
                raise ValueError(f"migrated legacy project {project_id} is invalid")
            imported[project_id] = {
                "id": project_id,
                "revision": revision,
                "digest": evidence["digest"],
                "config": candidate,
                "updated": raw_entry.get("updated"),
                "updated_by": raw_entry.get("updated_by"),
            }
            for version in raw_entry.get("versions", []):
                if not isinstance(version, Mapping) or not isinstance(version.get("config"), Mapping):
                    continue
                migrated_version = migrate_project_document(version["config"], dry_run=False)[
                    "candidate"
                ]
                version_revision = int(version.get("revision", 0))
                migrated_version["project"]["id"] = project_id
                migrated_version["project"]["revision"] = version_revision
                version_digest = digest_canonical_json(migrated_version)["digest"]
                snapshot_id = self.snapshot_id(project_id, version_digest)
                snapshots[snapshot_id] = {
                    "id": snapshot_id,
                    "project_id": project_id,
                    "revision": version_revision,
                    "digest": version_digest,
                    "config": migrated_version,
                    "created": version.get("created"),
                    "created_by": version.get("user_id"),
                    "source": "legacy",
                }
        return imported, snapshots

    async def _merge_import_snapshots(self, snapshots: Mapping[str, dict[str, Any]]) -> None:
        changed = False
        for snapshot_id, snapshot in snapshots.items():
            existing = self._snapshots["snapshots"].get(snapshot_id)
            if existing is not None and existing != snapshot:
                raise RuntimeError(f"immutable snapshot conflict:{snapshot_id}")
            if existing is None:
                self._snapshots["snapshots"][snapshot_id] = deepcopy(snapshot)
                changed = True
        if changed:
            await self._snapshots_store.async_save(deepcopy(self._snapshots))
            if await self._snapshots_store.async_load() != self._snapshots:
                raise RuntimeError("legacy snapshot read-back mismatch")

    @staticmethod
    def snapshot_id(project_id: str, digest: str) -> str:
        identity = digest_canonical_json({"project_id": project_id, "digest": digest})[
            "digest"
        ]
        return f"sha256:{identity}"

    @staticmethod
    def _verify_heads(projects: Mapping[str, Any]) -> None:
        for project_id, head in projects.items():
            if not isinstance(head, Mapping) or head.get("id") != project_id:
                raise ValueError(f"project head identity mismatch:{project_id}")
            evidence = evaluate_project_contract(head.get("config"))
            if not evidence["valid"] or evidence["digest"] != head.get("digest"):
                raise ValueError(f"project head digest mismatch:{project_id}")
            if head["config"].get("project", {}).get("revision") != head.get("revision"):
                raise ValueError(f"project head revision mismatch:{project_id}")

    def import_status(self) -> dict[str, Any]:
        return {"legacy_import": deepcopy(self._heads["legacy_import"])}

    def get_legacy_backup(self) -> dict[str, Any] | None:
        return deepcopy(self._backup.get("backup"))

    def list_heads(self) -> list[dict[str, Any]]:
        values = list(self._heads["projects"].values())
        values.sort(key=lambda value: str(value.get("updated") or ""), reverse=True)
        return deepcopy(values)

    def get_head(self, project_id: str) -> dict[str, Any] | None:
        value = self._heads["projects"].get(project_id)
        return deepcopy(value) if value is not None else None

    async def write_head(self, project_id: str, head: Mapping[str, Any]) -> None:
        self._heads["projects"][project_id] = deepcopy(dict(head))
        await self._heads_store.async_save(deepcopy(self._heads))

    async def read_head(self, project_id: str) -> dict[str, Any] | None:
        """Re-read one active head from persistence for transaction verification."""

        loaded = self._mapping_or(await self._heads_store.async_load(), _empty_heads())
        projects = loaded.get("projects")
        if not isinstance(projects, Mapping):
            raise RuntimeError("project heads read-back is invalid")
        value = projects.get(project_id)
        if value is not None:
            self._verify_heads({project_id: value})
        self._heads = loaded
        return deepcopy(value) if value is not None else None

    async def delete_head(self, project_id: str) -> bool:
        existed = self._heads["projects"].pop(project_id, None) is not None
        if existed:
            await self._heads_store.async_save(deepcopy(self._heads))
        return existed

    def list_snapshots(self, project_id: str | None = None) -> list[dict[str, Any]]:
        values = self._snapshots["snapshots"].values()
        if project_id is not None:
            values = [value for value in values if value.get("project_id") == project_id]
        return deepcopy(list(values))

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        value = self._snapshots["snapshots"].get(snapshot_id)
        return deepcopy(value) if value is not None else None

    async def put_snapshot(self, snapshot: Mapping[str, Any]) -> None:
        value = deepcopy(dict(snapshot))
        snapshot_id = str(value.get("id") or "")
        if not snapshot_id:
            raise ValueError("snapshot id is required")
        existing = self._snapshots["snapshots"].get(snapshot_id)
        if existing is not None and existing != value:
            raise RuntimeError(f"immutable snapshot conflict:{snapshot_id}")
        if existing is None:
            self._snapshots["snapshots"][snapshot_id] = value
            await self._snapshots_store.async_save(deepcopy(self._snapshots))

    async def read_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        """Re-read one immutable snapshot from persistence."""

        loaded = self._mapping_or(
            await self._snapshots_store.async_load(), _empty_snapshots()
        )
        snapshots = loaded.get("snapshots")
        if not isinstance(snapshots, Mapping):
            raise RuntimeError("project snapshots read-back is invalid")
        self._snapshots = loaded
        value = snapshots.get(snapshot_id)
        return deepcopy(value) if value is not None else None

    def get_journal(self, transaction_id: str) -> dict[str, Any] | None:
        value = self._journals["journals"].get(transaction_id)
        return deepcopy(value) if value is not None else None

    def list_journals(self, state: str | None = None) -> list[dict[str, Any]]:
        values = self._journals["journals"].values()
        if state is not None:
            values = [value for value in values if value.get("state") == state]
        return deepcopy(list(values))

    async def put_journal(self, journal: Mapping[str, Any]) -> None:
        value = deepcopy(dict(journal))
        transaction_id = str(value.get("id") or "")
        if not transaction_id:
            raise ValueError("journal id is required")
        self._journals["journals"][transaction_id] = value
        await self._journals_store.async_save(deepcopy(self._journals))

    async def read_journal(self, transaction_id: str) -> dict[str, Any] | None:
        """Re-read one transaction journal from persistence."""

        loaded = self._mapping_or(
            await self._journals_store.async_load(), _empty_journals()
        )
        journals = loaded.get("journals")
        if not isinstance(journals, Mapping):
            raise RuntimeError("project journals read-back is invalid")
        self._journals = loaded
        value = journals.get(transaction_id)
        return deepcopy(value) if value is not None else None

    async def append_audit(self, event: Mapping[str, Any]) -> None:
        self._audit["events"].insert(0, deepcopy(dict(event)))
        self._audit["events"] = self._audit["events"][:MAX_AUDIT]
        await self._audit_store.async_save(deepcopy(self._audit))

    def list_audit(self, limit: int | None = None) -> list[dict[str, Any]]:
        values = self._audit["events"] if limit is None else self._audit["events"][:limit]
        return deepcopy(values)
