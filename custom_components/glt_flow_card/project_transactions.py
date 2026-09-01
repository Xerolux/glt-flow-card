"""Authoritative preview, apply, rollback, and crash recovery coordinator."""
from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from copy import deepcopy
from datetime import datetime, timezone
import secrets
from typing import Any

from .project_contract import digest_canonical_json, evaluate_project_contract
from .project_diff import DIFF_POLICY, compute_project_diff, expand_diff_selection
from .project_migrations import migrate_project_document
from .project_repository import ProjectRepository


class TransactionConflict(RuntimeError):
    """The active project no longer matches the expected revision or digest."""


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decode_pointer_part(value: str) -> str:
    return value.replace("~1", "/").replace("~0", "~")


def _clone(value: Any) -> Any:
    return deepcopy(value)


class ProjectTransactionCoordinator:
    """Bind browser intent to server-recomputed, journaled project mutations."""

    def __init__(
        self,
        repository: ProjectRepository,
        *,
        failure_hook: Callable[[str], None] | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self.repository = repository
        self._failure_hook = failure_hook
        self._id_factory = id_factory or (lambda: secrets.token_urlsafe(24))
        self._previews: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    def _fail(self, stage: str) -> None:
        if self._failure_hook is not None:
            self._failure_hook(stage)

    @staticmethod
    def _require_user(user_id: str | None) -> str:
        if not user_id:
            raise PermissionError("authenticated Home Assistant user required")
        return user_id

    @staticmethod
    def _empty_project(project_id: str, name: str) -> dict[str, Any]:
        return {
            "type": "custom:glt-flow-card",
            "schema_version": 2,
            "project": {"id": project_id, "name": name, "revision": 0},
        }

    def _active_or_empty(
        self, project_id: str, candidate: Mapping[str, Any]
    ) -> tuple[dict[str, Any], int, str]:
        head = self.repository.get_head(project_id)
        if head is not None:
            return head["config"], int(head["revision"]), str(head["digest"])
        name = str(candidate.get("project", {}).get("name") or project_id)
        empty = self._empty_project(project_id, name)
        return empty, 0, digest_canonical_json(empty)["digest"]

    @staticmethod
    def _prepare_candidate(
        project_id: str, expected_revision: int, raw_candidate: Any
    ) -> dict[str, Any]:
        migrated = migrate_project_document(raw_candidate, dry_run=True)
        candidate = migrated["candidate"]
        identity = candidate.get("project", {})
        if identity.get("id") != project_id:
            raise ValueError("candidate project identity mismatch")
        if int(identity.get("revision", -1)) != int(expected_revision):
            raise TransactionConflict(
                f"candidate_revision_conflict:{identity.get('revision')}"
            )
        return migrated

    async def preview(
        self,
        *,
        user_id: str | None,
        project_id: str,
        expected_revision: int,
        candidate: Any,
    ) -> dict[str, Any]:
        """Return server-computed migration and semantic diff evidence."""

        bound_user = self._require_user(user_id)
        migrated = self._prepare_candidate(project_id, expected_revision, candidate)
        prepared_candidate = migrated["candidate"]
        base, base_revision, base_digest = self._active_or_empty(
            project_id, prepared_candidate
        )
        if int(expected_revision) != base_revision:
            raise TransactionConflict(f"revision_conflict:{base_revision}")
        diff = compute_project_diff(base, prepared_candidate)
        if diff["source_digest"] != base_digest:
            raise RuntimeError("base digest recomputation mismatch")
        preview_id = self._id_factory()
        attempts = 0
        while preview_id in self._previews and attempts < 8:
            preview_id = self._id_factory()
            attempts += 1
        if preview_id in self._previews:
            raise RuntimeError("unable to allocate unique preview id")
        closures = {
            operation["id"]: expand_diff_selection(diff, [operation["id"]])
            for operation in diff["operations"]
        }
        self._previews[preview_id] = {
            "user_id": bound_user,
            "project_id": project_id,
            "expected_revision": base_revision,
            "base_digest": base_digest,
            "candidate_digest": diff["candidate_digest"],
            "candidate_source": _clone(candidate),
        }
        return {
            "preview_id": preview_id,
            "project_id": project_id,
            "base_revision": base_revision,
            "base_digest": base_digest,
            "candidate_digest": diff["candidate_digest"],
            "migration_receipt": migrated["receipt"],
            "policy_version": diff["policy_version"],
            "operations": diff["operations"],
            "ordering_noise": diff["ordering_noise"],
            "closures": closures,
        }

    async def apply(
        self,
        *,
        user_id: str | None,
        project_id: str,
        preview_id: str,
        expected_revision: int,
        selected_ids: list[str],
    ) -> dict[str, Any]:
        """Recompute a preview and commit only selected server operations."""

        bound_user = self._require_user(user_id)
        preview = self._previews.get(preview_id)
        if preview is None:
            raise ValueError("unknown preview id")
        if preview["user_id"] != bound_user or preview["project_id"] != project_id:
            raise PermissionError("preview identity mismatch")
        if int(expected_revision) != int(preview["expected_revision"]):
            raise TransactionConflict(
                f"revision_conflict:{preview['expected_revision']}"
            )

        async with self._lock:
            current = await self.repository.read_head(project_id)
            current_revision = int(current["revision"]) if current is not None else 0
            if current_revision != int(expected_revision):
                raise TransactionConflict(f"revision_conflict:{current_revision}")
            migrated = self._prepare_candidate(
                project_id, expected_revision, preview["candidate_source"]
            )
            candidate = migrated["candidate"]
            base, base_revision, base_digest = self._active_or_empty(project_id, candidate)
            if base_revision != int(expected_revision) or base_digest != preview["base_digest"]:
                raise TransactionConflict(f"revision_conflict:{base_revision}")
            diff = compute_project_diff(base, candidate)
            if (
                diff["source_digest"] != preview["base_digest"]
                or diff["candidate_digest"] != preview["candidate_digest"]
            ):
                raise TransactionConflict("preview digest mismatch")
            closure = expand_diff_selection(diff, selected_ids)
            selected_candidate = self._materialize_selection(
                base, candidate, diff, closure["selected"]
            )
            result = await self._commit(
                user_id=bound_user,
                project_id=project_id,
                expected_revision=base_revision,
                old_digest=base_digest,
                candidate=selected_candidate,
                selected_ids=closure["selected"],
                action="apply",
            )
            self._previews.pop(preview_id, None)
            return result

    @staticmethod
    def _materialize_selection(
        base: Mapping[str, Any],
        candidate: Mapping[str, Any],
        diff: Mapping[str, Any],
        selected_ids: list[str],
    ) -> dict[str, Any]:
        operations = {operation["id"]: operation for operation in diff["operations"]}
        result = _clone(base)
        selected_operations = [operations[operation_id] for operation_id in selected_ids]
        array_removals: list[tuple[str, int, Mapping[str, Any]]] = []
        remaining: list[Mapping[str, Any]] = []
        for operation in selected_operations:
            pointer = (
                operation.get("field")
                if operation.get("collection") and operation.get("object_id")
                else operation.get("path")
            )
            parts = str(pointer or "").rstrip("/").split("/")
            try:
                index = int(parts[-1])
            except (ValueError, IndexError):
                remaining.append(operation)
                continue
            if operation.get("after_hash") is None and index >= 0:
                array_removals.append(("/".join(parts[:-1]), index, operation))
            else:
                remaining.append(operation)
        ordered_operations = [
            operation
            for _parent, _index, operation in sorted(
                array_removals,
                key=lambda entry: (entry[0], -entry[1]),
            )
        ] + remaining
        for operation in ordered_operations:
            ProjectTransactionCoordinator._apply_server_operation(
                result, candidate, operation
            )
        evidence = evaluate_project_contract(result)
        if not evidence["valid"]:
            details = ", ".join(
                f'{error["code"]}@{error["path"]}' for error in evidence["errors"]
            )
            raise ValueError(f"selected candidate contract is invalid: {details}")
        return result

    @staticmethod
    def _apply_server_operation(
        result: dict[str, Any], candidate: Mapping[str, Any], operation: Mapping[str, Any]
    ) -> None:
        collection = operation.get("collection")
        object_id = operation.get("object_id")
        field = str(operation.get("field") or "")
        if collection and object_id:
            identity_field = DIFF_POLICY["identity_fields"][collection]
            target_collection = result.setdefault(collection, [])
            candidate_collection = candidate.get(collection, [])
            target_index = next(
                (
                    index
                    for index, entry in enumerate(target_collection)
                    if entry.get(identity_field) == object_id
                ),
                None,
            )
            candidate_entry = next(
                (
                    entry
                    for entry in candidate_collection
                    if entry.get(identity_field) == object_id
                ),
                None,
            )
            if not field:
                if candidate_entry is None:
                    if target_index is None:
                        raise RuntimeError("server removal target is missing")
                    target_collection.pop(target_index)
                elif target_index is None:
                    target_collection.append(_clone(candidate_entry))
                else:
                    target_collection[target_index] = _clone(candidate_entry)
                return
            if target_index is None or candidate_entry is None:
                raise RuntimeError("server field target is missing")
            parts = [
                _decode_pointer_part(part) for part in field.lstrip("/").split("/")
            ]
            ProjectTransactionCoordinator._copy_path(
                target_collection[target_index], candidate_entry, parts
            )
            return

        parts = [
            _decode_pointer_part(part)
            for part in str(operation["path"]).lstrip("/").split("/")
        ]
        ProjectTransactionCoordinator._copy_path(result, candidate, parts)

    @staticmethod
    def _copy_path(target: Any, source: Any, parts: list[str]) -> None:
        target_parent = target
        source_parent = source
        for part in parts[:-1]:
            if isinstance(source_parent, list):
                source_parent = source_parent[int(part)]
                target_parent = target_parent[int(part)]
            else:
                source_parent = source_parent[part]
                if part not in target_parent:
                    target_parent[part] = [] if isinstance(source_parent, list) else {}
                target_parent = target_parent[part]
        leaf = parts[-1]
        if isinstance(source_parent, list):
            source_index = int(leaf)
            target_index = int(leaf)
            if source_index < len(source_parent):
                value = _clone(source_parent[source_index])
                if target_index < len(target_parent):
                    target_parent[target_index] = value
                else:
                    target_parent.append(value)
            elif target_index < len(target_parent):
                target_parent.pop(target_index)
            return
        if leaf in source_parent:
            target_parent[leaf] = _clone(source_parent[leaf])
        else:
            target_parent.pop(leaf, None)

    async def compatibility_save(
        self,
        *,
        user_id: str | None,
        project: Mapping[str, Any],
        expected_revision: int | None,
        autosave: bool,
    ) -> dict[str, Any]:
        """Route the legacy save shape through preview and authoritative apply."""

        del autosave
        project_id = str(
            project.get("id")
            or project.get("config", {}).get("project", {}).get("id")
            or ""
        ).strip()
        if not project_id:
            raise ValueError("project.id is required")
        active = self.repository.get_head(project_id)
        active_revision = int(active["revision"]) if active is not None else 0
        revision = active_revision if expected_revision is None else int(expected_revision)
        preview = await self.preview(
            user_id=user_id,
            project_id=project_id,
            expected_revision=revision,
            candidate=project.get("config", project),
        )
        return await self.apply(
            user_id=user_id,
            project_id=project_id,
            preview_id=preview["preview_id"],
            expected_revision=revision,
            selected_ids=[operation["id"] for operation in preview["operations"]],
        )

    async def rollback(
        self,
        *,
        user_id: str | None,
        project_id: str,
        snapshot_id: str,
        expected_revision: int,
        confirmation: str,
    ) -> dict[str, Any]:
        """Create a new forward revision from a verified server snapshot."""

        bound_user = self._require_user(user_id)
        if confirmation != f"ROLLBACK {project_id}":
            raise ValueError("rollback confirmation mismatch")
        async with self._lock:
            current = await self.repository.read_head(project_id)
            current_revision = int(current["revision"]) if current is not None else 0
            if current_revision != int(expected_revision):
                raise TransactionConflict(f"revision_conflict:{current_revision}")
            snapshot = await self.repository.read_snapshot(snapshot_id)
            if snapshot is None or snapshot.get("project_id") != project_id:
                raise ValueError("unknown server snapshot")
            self._verify_snapshot(snapshot)
            return await self._commit(
                user_id=bound_user,
                project_id=project_id,
                expected_revision=current_revision,
                old_digest=current["digest"],
                candidate=snapshot["config"],
                selected_ids=[f"rollback:{snapshot_id}"],
                action="rollback",
                source_snapshot_id=snapshot_id,
            )

    async def _commit(
        self,
        *,
        user_id: str,
        project_id: str,
        expected_revision: int,
        old_digest: str,
        candidate: Mapping[str, Any],
        selected_ids: list[str],
        action: str,
        source_snapshot_id: str | None = None,
    ) -> dict[str, Any]:
        new_revision = expected_revision + 1
        next_config = _clone(candidate)
        next_config["project"]["id"] = project_id
        next_config["project"]["revision"] = new_revision
        evidence = evaluate_project_contract(next_config)
        if not evidence["valid"]:
            raise ValueError("transaction candidate contract is invalid")
        new_digest = evidence["digest"]
        snapshot_id = self.repository.snapshot_id(project_id, new_digest)
        transaction_id = f"tx:{self._id_factory()}"
        now = _utc()
        journal = {
            "id": transaction_id,
            "state": "PREPARED",
            "action": action,
            "project_id": project_id,
            "user_id": user_id,
            "expected_revision": expected_revision,
            "new_revision": new_revision,
            "old_digest": old_digest,
            "new_digest": new_digest,
            "snapshot_id": snapshot_id,
            "source_snapshot_id": source_snapshot_id,
            "selected_ids": sorted(selected_ids),
            "prepared_at": now,
        }
        await self.repository.put_journal(journal)
        if await self.repository.read_journal(transaction_id) != journal:
            raise RuntimeError("PREPARED journal read-back mismatch")
        self._fail("after_prepared")

        snapshot = {
            "id": snapshot_id,
            "project_id": project_id,
            "revision": new_revision,
            "digest": new_digest,
            "config": next_config,
            "created": now,
            "created_by": user_id,
            "transaction_id": transaction_id,
        }
        await self.repository.put_snapshot(snapshot)
        self._fail("after_snapshot_write")
        persisted_snapshot = await self.repository.read_snapshot(snapshot_id)
        if persisted_snapshot != snapshot:
            raise RuntimeError("immutable snapshot read-back mismatch")
        self._verify_snapshot(persisted_snapshot)
        self._fail("after_snapshot_verify")

        head = self._head_from_snapshot(persisted_snapshot)
        await self.repository.write_head(project_id, head)
        self._fail("after_head_write")
        persisted_head = await self.repository.read_head(project_id)
        if persisted_head != head:
            raise RuntimeError("active project head read-back mismatch")
        self._fail("after_head_verify")

        journal["state"] = "COMMITTED"
        journal["committed_at"] = _utc()
        await self.repository.put_journal(journal)
        if await self.repository.read_journal(transaction_id) != journal:
            raise RuntimeError("COMMITTED journal read-back mismatch")
        await self._audit(journal, "committed")
        return head

    @staticmethod
    def _head_from_snapshot(snapshot: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "id": snapshot["project_id"],
            "revision": snapshot["revision"],
            "digest": snapshot["digest"],
            "config": _clone(snapshot["config"]),
            "updated": snapshot["created"],
            "updated_by": snapshot["created_by"],
            "snapshot_id": snapshot["id"],
            "transaction_id": snapshot["transaction_id"],
        }

    def _verify_snapshot(self, snapshot: Mapping[str, Any]) -> None:
        evidence = evaluate_project_contract(snapshot.get("config"))
        if not evidence["valid"] or evidence["digest"] != snapshot.get("digest"):
            raise RuntimeError("server snapshot digest mismatch")
        if snapshot.get("id") != self.repository.snapshot_id(
            str(snapshot.get("project_id")), str(snapshot.get("digest"))
        ):
            raise RuntimeError("server snapshot identity mismatch")
        if snapshot["config"].get("project", {}).get("revision") != snapshot.get(
            "revision"
        ):
            raise RuntimeError("server snapshot revision mismatch")

    async def async_recover(self) -> list[dict[str, Any]]:
        """Resolve every PREPARED journal to a verified old or new head."""

        recovered: list[dict[str, Any]] = []
        async with self._lock:
            for journal in self.repository.list_journals("PREPARED"):
                project_id = journal["project_id"]
                current = await self.repository.read_head(project_id)
                snapshot = await self.repository.read_snapshot(journal["snapshot_id"])
                if snapshot is None:
                    if not self._matches_old_head(current, journal):
                        raise RuntimeError(
                            f"unrecoverable project transaction:{journal['id']}"
                        )
                    journal["state"] = "ABORTED"
                    journal["recovered_at"] = _utc()
                    journal["recovery_result"] = "verified_old_head"
                    await self.repository.put_journal(journal)
                    await self._audit(journal, "aborted")
                    recovered.append(deepcopy(journal))
                    continue
                self._verify_snapshot(snapshot)
                if (
                    snapshot["project_id"] != project_id
                    or snapshot["revision"] != journal["new_revision"]
                    or snapshot["digest"] != journal["new_digest"]
                ):
                    raise RuntimeError(
                        f"unrecoverable project snapshot:{journal['id']}"
                    )
                new_head = self._head_from_snapshot(snapshot)
                if not self._matches_new_head(current, journal):
                    if not self._matches_old_head(current, journal):
                        raise RuntimeError(
                            f"unrecoverable project transaction:{journal['id']}"
                        )
                    await self.repository.write_head(project_id, new_head)
                    current = await self.repository.read_head(project_id)
                if current != new_head:
                    raise RuntimeError(f"project recovery read-back mismatch:{journal['id']}")
                journal["state"] = "COMMITTED"
                journal["recovered_at"] = _utc()
                journal["recovery_result"] = "verified_new_head"
                await self.repository.put_journal(journal)
                await self._audit(journal, "recovered")
                recovered.append(deepcopy(journal))
        return recovered

    @staticmethod
    def _matches_old_head(
        head: Mapping[str, Any] | None, journal: Mapping[str, Any]
    ) -> bool:
        if int(journal["expected_revision"]) == 0 and head is None:
            return True
        return bool(
            head
            and head.get("revision") == journal["expected_revision"]
            and head.get("digest") == journal["old_digest"]
        )

    @staticmethod
    def _matches_new_head(
        head: Mapping[str, Any] | None, journal: Mapping[str, Any]
    ) -> bool:
        return bool(
            head
            and head.get("revision") == journal["new_revision"]
            and head.get("digest") == journal["new_digest"]
            and head.get("snapshot_id") == journal["snapshot_id"]
        )

    async def _audit(self, journal: Mapping[str, Any], result: str) -> None:
        await self.repository.append_audit({
            "id": f"audit:{journal['id']}:{result}",
            "at": _utc(),
            "action": journal["action"],
            "user_id": journal["user_id"],
            "project_id": journal["project_id"],
            "expected_revision": journal["expected_revision"],
            "new_revision": journal["new_revision"],
            "old_digest": journal["old_digest"],
            "new_digest": journal["new_digest"],
            "snapshot_id": journal["snapshot_id"],
            "source_snapshot_id": journal.get("source_snapshot_id"),
            "selected_ids": deepcopy(journal["selected_ids"]),
            "transaction_id": journal["id"],
            "result": result,
        })
