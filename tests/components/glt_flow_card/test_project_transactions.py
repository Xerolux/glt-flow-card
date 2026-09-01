"""Authoritative project preview, apply, rollback, and recovery behavior."""
from __future__ import annotations

from copy import deepcopy
from itertools import count
from typing import Any

import pytest

from custom_components.glt_flow_card.project_contract import digest_canonical_json
from custom_components.glt_flow_card.project_repository import ProjectRepository
from custom_components.glt_flow_card.project_transactions import (
    ProjectTransactionCoordinator,
    TransactionConflict,
)

from .test_project_repository import store_factory

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def project(project_id: str = "plant-a", **overrides: Any) -> dict[str, Any]:
    value = {
        "type": "custom:glt-flow-card",
        "schema_version": 2,
        "project": {"id": project_id, "name": "Plant A", "revision": 0},
        "profiles": [{"id": "profile-1", "equipment_type": "pump"}],
        "assets": [{"id": "asset-1", "path": "assets/pump.svg"}],
        "equipment": [{
            "id": "pump-1",
            "type": "pump",
            "profile": "profile-1",
            "asset_id": "asset-1",
            "x": 1,
        }],
        "paths": [],
    }
    value.update(overrides)
    return value


async def coordinator_for(
    backend: dict[tuple[int, str], Any] | None = None,
    *,
    failure_hook=None,
) -> tuple[ProjectTransactionCoordinator, ProjectRepository, dict[tuple[int, str], Any]]:
    persistence = backend if backend is not None else {}
    repository = ProjectRepository(object(), store_factory=store_factory(persistence))
    await repository.async_initialize()
    identifiers = count(1)
    coordinator = ProjectTransactionCoordinator(
        repository,
        failure_hook=failure_hook,
        id_factory=lambda: f"opaque-{next(identifiers)}",
    )
    await coordinator.async_recover()
    return coordinator, repository, persistence


async def save_initial(
    coordinator: ProjectTransactionCoordinator, candidate: dict[str, Any] | None = None
) -> dict[str, Any]:
    return await coordinator.compatibility_save(
        user_id="designer-a",
        project={"id": "plant-a", "config": candidate or project()},
        expected_revision=0,
        autosave=False,
    )


async def test_preview_and_selection_are_user_revision_and_server_bound() -> None:
    coordinator, repository, _backend = await coordinator_for()
    initial = await save_initial(coordinator)
    assert initial["revision"] == 1

    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        profiles=[
            {"id": "profile-1", "equipment_type": "pump"},
            {"id": "profile-2", "equipment_type": "pump"},
        ],
        assets=[
            {"id": "asset-1", "path": "assets/pump.svg"},
            {"id": "asset-2", "path": "assets/pump-2.svg"},
        ],
        equipment=[
            {"id": "pump-1", "type": "pump", "profile": "profile-1", "asset_id": "asset-1", "x": 8},
            {"id": "pump-2", "type": "pump", "profile": "profile-2", "asset_id": "asset-2"},
        ],
        paths=[{"id": "path-2", "from_equipment": "pump-2", "to_equipment": "pump-1"}],
    )
    original = deepcopy(candidate)
    preview = await coordinator.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=1,
        candidate=candidate,
    )
    assert preview["preview_id"].startswith("opaque-")
    assert preview["base_revision"] == 1
    assert preview["base_digest"] == initial["digest"]
    assert preview["candidate_digest"] == digest_canonical_json(original)["digest"]
    assert preview["migration_receipt"]["candidate_schema_version"] == 2
    assert {operation["category"] for operation in preview["operations"]} >= {"add", "move"}
    path_closure = preview["closures"]["add:/paths/path-2"]
    assert path_closure["selected"] == [
        "add:/assets/asset-2",
        "add:/equipment/pump-2",
        "add:/paths/path-2",
        "add:/profiles/profile-2",
    ]

    candidate["equipment"][0]["x"] = 999
    with pytest.raises(PermissionError, match="preview identity mismatch"):
        await coordinator.apply(
            user_id="designer-b",
            project_id="plant-a",
            preview_id=preview["preview_id"],
            expected_revision=1,
            selected_ids=["move:/equipment/pump-1/x"],
        )
    with pytest.raises(ValueError, match="unknown selected operation"):
        await coordinator.apply(
            user_id="designer-a",
            project_id="plant-a",
            preview_id=preview["preview_id"],
            expected_revision=1,
            selected_ids=["forged:/config"],
        )

    applied = await coordinator.apply(
        user_id="designer-a",
        project_id="plant-a",
        preview_id=preview["preview_id"],
        expected_revision=1,
        selected_ids=["move:/equipment/pump-1/x"],
    )
    assert applied["revision"] == 2
    assert applied["config"]["equipment"][0]["x"] == 8
    assert applied["config"]["paths"] == []
    assert repository.get_head("plant-a") == applied


async def test_stale_preview_and_incomplete_dependency_input_fail_closed() -> None:
    coordinator, _repository, _backend = await coordinator_for()
    await save_initial(coordinator)
    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        profiles=[
            {"id": "profile-1", "equipment_type": "pump"},
            {"id": "profile-2", "equipment_type": "pump"},
        ],
        assets=[
            {"id": "asset-1", "path": "assets/pump.svg"},
            {"id": "asset-2", "path": "assets/pump-2.svg"},
        ],
        equipment=[
            {"id": "pump-1", "type": "pump", "profile": "profile-1", "asset_id": "asset-1", "x": 1},
            {"id": "pump-2", "type": "pump", "profile": "profile-2", "asset_id": "asset-2"},
        ],
        paths=[{"id": "path-2", "from_equipment": "pump-2", "to_equipment": "pump-1"}],
    )
    preview = await coordinator.preview(
        user_id="designer-a", project_id="plant-a", expected_revision=1, candidate=candidate
    )
    # The client may request the root operation only; the server owns closure.
    applied = await coordinator.apply(
        user_id="designer-a",
        project_id="plant-a",
        preview_id=preview["preview_id"],
        expected_revision=1,
        selected_ids=["add:/paths/path-2"],
    )
    assert applied["revision"] == 2
    assert {entry["id"] for entry in applied["config"]["equipment"]} == {"pump-1", "pump-2"}

    stale = await coordinator.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=2,
        candidate={**applied["config"], "project": {**applied["config"]["project"], "revision": 2}},
    )
    await coordinator.compatibility_save(
        user_id="designer-a",
        project={
            "id": "plant-a",
            "config": {
                **applied["config"],
                "project": {**applied["config"]["project"], "revision": 2},
                "title": "Concurrent",
            },
        },
        expected_revision=2,
        autosave=False,
    )
    with pytest.raises(TransactionConflict, match="revision_conflict:3"):
        await coordinator.apply(
            user_id="designer-a",
            project_id="plant-a",
            preview_id=stale["preview_id"],
            expected_revision=2,
            selected_ids=[],
        )


async def test_rollback_requires_server_snapshot_and_creates_forward_revision() -> None:
    coordinator, repository, _backend = await coordinator_for()
    revision_one = await save_initial(coordinator)
    revision_one_snapshot = revision_one["snapshot_id"]
    revision_two = await coordinator.compatibility_save(
        user_id="designer-a",
        project={
            "id": "plant-a",
            "config": project(
                project={"id": "plant-a", "name": "Plant A", "revision": 1},
                equipment=[{
                    "id": "pump-1", "type": "pump", "profile": "profile-1",
                    "asset_id": "asset-1", "x": 42,
                }],
            ),
        },
        expected_revision=1,
        autosave=False,
    )

    with pytest.raises(ValueError, match="rollback confirmation mismatch"):
        await coordinator.rollback(
            user_id="designer-a",
            project_id="plant-a",
            snapshot_id=revision_one_snapshot,
            expected_revision=2,
            confirmation="yes",
        )
    with pytest.raises(ValueError, match="unknown server snapshot"):
        await coordinator.rollback(
            user_id="designer-a",
            project_id="plant-a",
            snapshot_id="sha256:" + "0" * 64,
            expected_revision=2,
            confirmation="ROLLBACK plant-a",
        )

    rolled_back = await coordinator.rollback(
        user_id="designer-a",
        project_id="plant-a",
        snapshot_id=revision_one_snapshot,
        expected_revision=2,
        confirmation="ROLLBACK plant-a",
    )
    assert rolled_back["revision"] == 3
    assert rolled_back["config"]["equipment"][0]["x"] == 1
    assert rolled_back["config"]["project"]["revision"] == 3
    assert repository.get_snapshot(revision_one_snapshot)["revision"] == 1
    assert repository.get_snapshot(revision_two["snapshot_id"])["revision"] == 2


@pytest.mark.parametrize(
    ("failure_stage", "expected_revision", "expected_state"),
    [
        ("after_prepared", 1, "ABORTED"),
        ("after_snapshot_write", 2, "COMMITTED"),
        ("after_snapshot_verify", 2, "COMMITTED"),
        ("after_head_write", 2, "COMMITTED"),
        ("after_head_verify", 2, "COMMITTED"),
    ],
)
async def test_interruption_recovery_selects_verified_old_or_new_head(
    failure_stage: str, expected_revision: int, expected_state: str
) -> None:
    base, _repository, backend = await coordinator_for()
    await save_initial(base)
    fired = False

    def interrupt(stage: str) -> None:
        nonlocal fired
        if stage == failure_stage and not fired:
            fired = True
            raise RuntimeError(f"injected:{stage}")

    interrupted, _repo, _ = await coordinator_for(backend, failure_hook=interrupt)
    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        equipment=[{
            "id": "pump-1", "type": "pump", "profile": "profile-1", "asset_id": "asset-1", "x": 9,
        }],
    )
    preview = await interrupted.preview(
        user_id="designer-a", project_id="plant-a", expected_revision=1, candidate=candidate
    )
    with pytest.raises(RuntimeError, match=f"injected:{failure_stage}"):
        await interrupted.apply(
            user_id="designer-a",
            project_id="plant-a",
            preview_id=preview["preview_id"],
            expected_revision=1,
            selected_ids=["move:/equipment/pump-1/x"],
        )

    recovered_repository = ProjectRepository(object(), store_factory=store_factory(backend))
    await recovered_repository.async_initialize()
    recovered = ProjectTransactionCoordinator(recovered_repository)
    evidence = await recovered.async_recover()
    head = recovered_repository.get_head("plant-a")
    assert head["revision"] == expected_revision
    assert head["digest"] == digest_canonical_json(head["config"])["digest"]
    assert evidence[0]["state"] == expected_state
    assert recovered_repository.list_journals()[-1]["state"] == expected_state


async def test_transaction_audit_contains_metadata_only() -> None:
    coordinator, repository, _backend = await coordinator_for()
    result = await save_initial(coordinator)
    events = repository.list_audit()
    assert events
    encoded = repr(events)
    assert result["digest"] in encoded
    keys: set[str] = set()

    def collect_keys(value: Any) -> None:
        if isinstance(value, dict):
            keys.update(map(str, value))
            for nested in value.values():
                collect_keys(nested)
        elif isinstance(value, list):
            for nested in value:
                collect_keys(nested)

    collect_keys(events)
    assert keys.isdisjoint({"config", "candidate", "equipment", "service_data", "secret"})
    assert "pump-1" not in encoded
