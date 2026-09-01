"""Split project repository and safe legacy import behavior."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest

from custom_components.glt_flow_card.const import (
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
from custom_components.glt_flow_card.project_contract import digest_canonical_json
from custom_components.glt_flow_card.project_repository import ProjectRepository

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


class MemoryStore:
    """Home Assistant Store-compatible isolated persistence double."""

    def __init__(self, backend: dict[tuple[int, str], Any], version: int, key: str) -> None:
        self.backend = backend
        self.identity = (version, key)

    async def async_load(self) -> Any:
        return deepcopy(self.backend.get(self.identity))

    async def async_save(self, value: Any) -> None:
        self.backend[self.identity] = deepcopy(value)


def store_factory(backend: dict[tuple[int, str], Any]):
    def make(_hass: object, version: int, key: str) -> MemoryStore:
        return MemoryStore(backend, version, key)

    return make


def legacy_project(project_id: str = "legacy-plant") -> dict[str, Any]:
    return {
        "id": project_id,
        "revision": 4,
        "updated": "2026-08-31T12:00:00+00:00",
        "updated_by": "legacy-user",
        "versions": [{
            "id": "legacy-inline-version",
            "revision": 3,
            "config": {
                "type": "custom:glt-flow-card",
                "title": "Legacy Plant Before",
                "equipment": [],
            },
        }],
        "config": {
            "type": "custom:glt-flow-card",
            "title": "Legacy Plant",
            "equipment": [{"id": "pump-1", "type": "pump"}],
            "extensions": {"vendor": {"retained": True}},
        },
    }


def legacy_payload() -> dict[str, Any]:
    return {
        "projects": {"legacy-plant": legacy_project()},
        "templates": {"legacy-template": {"id": "legacy-template"}},
        "audit": [{"id": "legacy-audit", "secret": "must remain only in backup"}],
        "alarm_state": {"legacy-plant:alarm-1": {"active": True}},
    }


async def test_split_store_identities_and_deep_copy_reads() -> None:
    backend: dict[tuple[int, str], Any] = {}
    repository = ProjectRepository(object(), store_factory=store_factory(backend))

    assert repository.store_specs == {
        "heads": (PROJECT_HEADS_STORE_VERSION, PROJECT_HEADS_STORE_KEY),
        "snapshots": (PROJECT_SNAPSHOTS_STORE_VERSION, PROJECT_SNAPSHOTS_STORE_KEY),
        "journals": (PROJECT_JOURNAL_STORE_VERSION, PROJECT_JOURNAL_STORE_KEY),
        "audit": (PROJECT_AUDIT_STORE_VERSION, PROJECT_AUDIT_STORE_KEY),
        "legacy_backup": (PROJECT_LEGACY_BACKUP_STORE_VERSION, PROJECT_LEGACY_BACKUP_STORE_KEY),
    }
    assert len(set(repository.store_specs.values())) == 5

    await repository.async_initialize()
    await repository.write_head("plant-a", {
        "id": "plant-a",
        "revision": 1,
        "digest": "a" * 64,
        "config": {"schema_version": 2, "project": {"id": "plant-a"}},
    })
    returned = repository.get_head("plant-a")
    assert returned is not None
    returned["config"]["project"]["id"] = "mutated"
    assert repository.get_head("plant-a")["config"]["project"]["id"] == "plant-a"


async def test_legacy_import_is_verified_once_and_retains_untouched_backup() -> None:
    source = legacy_payload()
    backend: dict[tuple[int, str], Any] = {(STORE_VERSION, STORE_KEY): deepcopy(source)}
    repository = ProjectRepository(object(), store_factory=store_factory(backend))

    result = await repository.async_initialize()

    assert result["legacy_import"]["status"] == "complete"
    assert result["legacy_import"]["project_count"] == 1
    imported = repository.get_head("legacy-plant")
    assert imported is not None
    assert imported["revision"] == 4
    assert imported["config"]["schema_version"] == 2
    assert imported["config"]["project"]["id"] == "legacy-plant"
    assert imported["digest"] == digest_canonical_json(imported["config"])["digest"]
    assert "versions" not in imported

    backup = repository.get_legacy_backup()
    assert backup["payload"] == source
    assert backup["digest"] == digest_canonical_json(source)["digest"]
    assert backend[(STORE_VERSION, STORE_KEY)] == source

    backend[(STORE_VERSION, STORE_KEY)]["projects"]["late-project"] = legacy_project("late-project")
    restarted = ProjectRepository(object(), store_factory=store_factory(backend))
    second = await restarted.async_initialize()
    assert second["legacy_import"]["status"] == "complete"
    assert restarted.get_head("late-project") is None
    assert restarted.get_legacy_backup()["payload"] == source


@pytest.mark.parametrize(
    "failure_stage",
    [
        "after_backup_write",
        "after_stage_write",
        "after_stage_verify",
        "after_head_write",
        "after_head_verify",
    ],
)
async def test_interrupted_legacy_import_retries_without_partial_visibility(failure_stage: str) -> None:
    source = legacy_payload()
    backend: dict[tuple[int, str], Any] = {(STORE_VERSION, STORE_KEY): deepcopy(source)}
    fired = False

    def interrupt(stage: str) -> None:
        nonlocal fired
        if stage == failure_stage and not fired:
            fired = True
            raise RuntimeError(f"injected:{stage}")

    repository = ProjectRepository(
        object(), store_factory=store_factory(backend), failure_hook=interrupt
    )
    with pytest.raises(RuntimeError, match=f"injected:{failure_stage}"):
        await repository.async_initialize()

    # Only a fully promoted and digest-verified head may be observable.
    visible = repository.get_head("legacy-plant")
    if visible is not None:
        assert visible["digest"] == digest_canonical_json(visible["config"])["digest"]

    restarted = ProjectRepository(object(), store_factory=store_factory(backend))
    result = await restarted.async_initialize()
    imported = restarted.get_head("legacy-plant")
    assert result["legacy_import"]["status"] == "complete"
    assert imported is not None
    assert imported["digest"] == digest_canonical_json(imported["config"])["digest"]
    assert restarted.get_legacy_backup()["payload"] == source
    assert backend[(STORE_VERSION, STORE_KEY)] == source


async def test_snapshots_are_immutable_and_metadata_stores_are_bounded_copies() -> None:
    backend: dict[tuple[int, str], Any] = {}
    repository = ProjectRepository(object(), store_factory=store_factory(backend))
    await repository.async_initialize()

    snapshot = {
        "id": "sha256:" + "b" * 64,
        "project_id": "plant-a",
        "revision": 1,
        "digest": "b" * 64,
        "config": {"schema_version": 2, "project": {"id": "plant-a"}},
    }
    await repository.put_snapshot(snapshot)
    await repository.put_snapshot(deepcopy(snapshot))
    with pytest.raises(RuntimeError, match="immutable snapshot conflict"):
        await repository.put_snapshot({**snapshot, "revision": 2})

    journal = {"id": "tx-1", "state": "PREPARED", "project_id": "plant-a"}
    await repository.put_journal(journal)
    await repository.append_audit({"id": "audit-1", "result": "prepared"})
    journal["state"] = "tampered"
    assert repository.get_journal("tx-1")["state"] == "PREPARED"
    assert repository.list_audit() == [{"id": "audit-1", "result": "prepared"}]
