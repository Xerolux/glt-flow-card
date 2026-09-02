"""Authoritative project preview, apply, rollback, and recovery behavior."""
from __future__ import annotations

from copy import deepcopy
from itertools import count
from typing import Any

import pytest

from custom_components.glt_flow_card.project_contract import digest_canonical_json
from custom_components.glt_flow_card.project_migrations import (
    CURRENT_PROJECT_SCHEMA_VERSION,
)
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
        # The *current* version, so the coordinator runs no migration and the
        # digest assertions keep testing what they were written to test: that a
        # preview's candidate digest is the digest of what the caller submitted.
        # Pinning a superseded version here would turn those into assertions
        # about the migration instead.
        "schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
        "contributions": [],
        "semantic_model": {"nodes": []},
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
    repository_failure_hook=None,
    **coordinator_options,
) -> tuple[ProjectTransactionCoordinator, ProjectRepository, dict[tuple[int, str], Any]]:
    persistence = backend if backend is not None else {}
    repository = ProjectRepository(
        object(),
        store_factory=store_factory(persistence),
        failure_hook=repository_failure_hook,
    )
    await repository.async_initialize()
    identifiers = count(1)
    coordinator = ProjectTransactionCoordinator(
        repository,
        failure_hook=failure_hook,
        id_factory=lambda: f"opaque-{next(identifiers)}",
        **coordinator_options,
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
    assert preview["migration_receipt"]["candidate_schema_version"] == CURRENT_PROJECT_SCHEMA_VERSION
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

    preview = await coordinator.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=1,
        candidate=original,
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


async def test_preview_cache_expires_and_rejects_consumed_authority() -> None:
    clock = [10.0]
    coordinator, _repository, _backend = await coordinator_for(
        time_factory=lambda: clock[0],
        preview_ttl_seconds=30,
    )
    preview = await coordinator.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=0,
        candidate=project(),
    )
    assert preview["preview_id"] in coordinator._previews

    clock[0] = 40.0
    with pytest.raises(ValueError, match="unknown preview id"):
        await coordinator.apply(
            user_id="designer-a",
            project_id="plant-a",
            preview_id=preview["preview_id"],
            expected_revision=0,
            selected_ids=[],
        )
    assert coordinator._previews == {}


async def test_preview_cache_replaces_per_user_project_and_evicts_by_bytes() -> None:
    candidate_a = project("plant-a", extensions={"payload": "a" * 600})
    retained_size = len(digest_canonical_json(candidate_a)["canonical"].encode("utf-8"))
    clock = [1.0]
    coordinator, _repository, _backend = await coordinator_for(
        time_factory=lambda: clock[0],
        preview_max_entries=10,
        preview_max_retained_bytes=(retained_size * 2) - 1,
    )

    first = await coordinator.preview(
        user_id="designer-a", project_id="plant-a", expected_revision=0, candidate=candidate_a
    )
    clock[0] += 1
    second = await coordinator.preview(
        user_id="designer-a", project_id="plant-a", expected_revision=0, candidate=candidate_a
    )
    assert first["preview_id"] not in coordinator._previews
    assert second["preview_id"] in coordinator._previews

    clock[0] += 1
    other_user = await coordinator.preview(
        user_id="designer-b", project_id="plant-a", expected_revision=0, candidate=candidate_a
    )
    assert other_user["preview_id"] in coordinator._previews
    assert second["preview_id"] not in coordinator._previews
    assert sum(
        preview["retained_bytes"] for preview in coordinator._previews.values()
    ) <= coordinator._preview_max_retained_bytes


@pytest.mark.parametrize("limit_kind", ["entries", "bytes"])
async def test_preview_cache_equal_clock_evicts_oldest_insertion(
    limit_kind: str,
) -> None:
    clock = [1.0]
    candidate_a = project("plant-a", extensions={"payload": "a" * 600})
    retained_size = len(
        digest_canonical_json(candidate_a)["canonical"].encode("utf-8")
    )
    options = {
        "time_factory": lambda: clock[0],
        "preview_max_entries": 1 if limit_kind == "entries" else 10,
        "preview_max_retained_bytes": (
            20 * 1024 * 1024
            if limit_kind == "entries"
            else (retained_size * 2) - 1
        ),
    }
    coordinator, _repository, _backend = await coordinator_for(**options)
    preview_ids = iter(["z-oldest", "a-newest"])
    coordinator._id_factory = preview_ids.__next__

    oldest = await coordinator.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=0,
        candidate=candidate_a,
    )
    newest = await coordinator.preview(
        user_id="designer-b",
        project_id="plant-b",
        expected_revision=0,
        candidate=project("plant-b", extensions={"payload": "b" * 600}),
    )

    assert oldest["preview_id"] == "z-oldest"
    assert newest["preview_id"] == "a-newest"
    assert oldest["preview_id"] not in coordinator._previews
    assert newest["preview_id"] in coordinator._previews


async def test_terminal_apply_failure_discards_preview() -> None:
    coordinator, _repository, _backend = await coordinator_for()
    preview = await coordinator.preview(
        user_id="designer-a", project_id="plant-a", expected_revision=0, candidate=project()
    )
    with pytest.raises(ValueError, match="unknown selected operation"):
        await coordinator.apply(
            user_id="designer-a",
            project_id="plant-a",
            preview_id=preview["preview_id"],
            expected_revision=0,
            selected_ids=["forged:/operation"],
        )
    assert preview["preview_id"] not in coordinator._previews


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
        user_id="designer-b",
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


async def test_remove_and_retarget_to_new_materializes_a_valid_closed_candidate() -> None:
    coordinator, repository, _backend = await coordinator_for()
    initial = project(
        equipment=[{
            "id": "pump-1",
            "type": "pump",
            "profile": "profile-1",
            "asset_id": "asset-1",
        }],
        paths=[{
            "id": "path-1",
            "from_equipment": "pump-1",
            "to_equipment": "pump-1",
        }],
    )
    await save_initial(coordinator, initial)
    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        equipment=[{
            "id": "pump-2",
            "type": "pump",
            "profile": "profile-1",
            "asset_id": "asset-1",
        }],
        paths=[{
            "id": "path-1",
            "from_equipment": "pump-2",
            "to_equipment": "pump-2",
        }],
    )
    preview = await coordinator.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=1,
        candidate=candidate,
    )
    assert preview["closures"]["remove:/equipment/pump-1"]["selected"] == [
        "add:/equipment/pump-2",
        "config:/paths/path-1/from_equipment",
        "config:/paths/path-1/to_equipment",
        "remove:/equipment/pump-1",
    ]

    applied = await coordinator.apply(
        user_id="designer-a",
        project_id="plant-a",
        preview_id=preview["preview_id"],
        expected_revision=1,
        selected_ids=["remove:/equipment/pump-1"],
    )

    expected = deepcopy(candidate)
    expected["project"]["revision"] = 2
    assert applied["config"] == expected
    assert repository.get_head("plant-a") == applied


@pytest.mark.parametrize(
    ("base_tags", "candidate_tags", "base_nested", "candidate_nested"),
    [
        (["a", "b", "c"], [], [["a", "b", "c"]], [[]]),
        (["a", "b", "c"], ["updated", "b"], [["a", "b"], ["c"]], [["x"], ["c", "d"]]),
        (["a", "b", "c", "d"], ["a"], [["a"], ["b"], ["c"]], [["z"]]),
        (
            [],
            [str(index) for index in range(12)],
            [[], []],
            [
                [str(index) for index in range(12)],
                [str(index) for index in range(12, 24)],
            ],
        ),
    ],
)
async def test_compatibility_save_materializes_array_changes_exactly(
    base_tags: list[str],
    candidate_tags: list[str],
    base_nested: list[list[str]],
    candidate_nested: list[list[str]],
) -> None:
    coordinator, repository, _backend = await coordinator_for()
    initial = project(
        equipment=[{
            "id": "pump-1",
            "type": "pump",
            "profile": "profile-1",
            "asset_id": "asset-1",
            "x": 1,
            "tags": base_tags,
        }],
        extensions={"nested": base_nested},
    )
    await save_initial(coordinator, initial)
    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        equipment=[{
            "id": "pump-1",
            "type": "pump",
            "profile": "profile-1",
            "asset_id": "asset-1",
            "x": 1,
            "tags": candidate_tags,
        }],
        extensions={"nested": candidate_nested},
    )

    result = await coordinator.compatibility_save(
        user_id="designer-a",
        project={"id": "plant-a", "config": candidate},
        expected_revision=1,
        autosave=False,
    )

    expected = deepcopy(candidate)
    expected["project"]["revision"] = 2
    assert result["config"] == expected
    assert repository.get_head("plant-a")["config"] == expected


async def test_partial_array_selection_updates_exact_double_digit_index() -> None:
    coordinator, repository, _backend = await coordinator_for()
    base_tags = [str(index) for index in range(12)]
    await save_initial(coordinator, project(
        equipment=[{
            "id": "pump-1",
            "type": "pump",
            "profile": "profile-1",
            "asset_id": "asset-1",
            "tags": base_tags,
        }],
    ))
    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        equipment=[{
            "id": "pump-1",
            "type": "pump",
            "profile": "profile-1",
            "asset_id": "asset-1",
            "tags": [
                *base_tags[:9],
                "changed-nine",
                "changed-ten",
                base_tags[11],
            ],
        }],
    )
    preview = await coordinator.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=1,
        candidate=candidate,
    )

    applied = await coordinator.apply(
        user_id="designer-a",
        project_id="plant-a",
        preview_id=preview["preview_id"],
        expected_revision=1,
        selected_ids=["config:/equipment/pump-1/tags/10"],
    )

    expected_tags = [*base_tags]
    expected_tags[10] = "changed-ten"
    assert applied["config"]["equipment"][0]["tags"] == expected_tags
    assert repository.get_head("plant-a")["config"] == applied["config"]


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
    assert revision_two["rollback_snapshot_id"] == revision_one_snapshot
    backup = repository.get_snapshot(revision_two["rollback_snapshot_id"])
    assert backup["config"]["equipment"][0]["x"] == 1

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
        snapshot_id=revision_two["rollback_snapshot_id"],
        expected_revision=2,
        confirmation="ROLLBACK plant-a",
    )
    assert rolled_back["revision"] == 3
    assert rolled_back["config"]["equipment"][0]["x"] == 1
    assert rolled_back["config"]["project"]["revision"] == 3
    assert repository.get_snapshot(revision_one_snapshot)["revision"] == 1
    assert repository.get_snapshot(revision_two["snapshot_id"])["revision"] == 2


async def test_first_apply_synthesizes_verified_empty_rollback_snapshot() -> None:
    coordinator, repository, _backend = await coordinator_for()

    applied = await save_initial(coordinator)
    rollback_snapshot = repository.get_snapshot(applied["rollback_snapshot_id"])

    assert rollback_snapshot is not None
    assert rollback_snapshot["revision"] == 0
    assert rollback_snapshot["config"] == {
        "type": "custom:glt-flow-card",
        "schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
        "contributions": [],
        "semantic_model": {"nodes": []},
        "project": {"id": "plant-a", "name": "Plant A", "revision": 0},
    }
    rolled_back = await coordinator.rollback(
        user_id="designer-a",
        project_id="plant-a",
        snapshot_id=applied["rollback_snapshot_id"],
        expected_revision=1,
        confirmation="ROLLBACK plant-a",
    )
    assert rolled_back["config"] == {
        "type": "custom:glt-flow-card",
        "schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
        "contributions": [],
        "semantic_model": {"nodes": []},
        "project": {"id": "plant-a", "name": "Plant A", "revision": 2},
    }


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


@pytest.mark.parametrize(
    ("failure_stage", "durable_before_restart"),
    [
        ("before_audit_write", False),
        ("after_audit_write", True),
    ],
)
async def test_audit_persistence_failure_returns_verified_success_and_repairs_once(
    failure_stage: str, durable_before_restart: bool
) -> None:
    base, _repository, backend = await coordinator_for()
    initial = await save_initial(base)
    fired = False

    def interrupt(stage: str) -> None:
        nonlocal fired
        if stage == failure_stage and not fired:
            fired = True
            raise OSError(f"injected:{stage}")

    interrupted, repository, _ = await coordinator_for(
        backend, repository_failure_hook=interrupt
    )
    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        equipment=[{
            "id": "pump-1", "type": "pump", "profile": "profile-1",
            "asset_id": "asset-1", "x": 17,
        }],
    )
    preview = await interrupted.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=1,
        candidate=candidate,
    )

    result = await interrupted.apply(
        user_id="designer-a",
        project_id="plant-a",
        preview_id=preview["preview_id"],
        expected_revision=1,
        selected_ids=["move:/equipment/pump-1/x"],
    )

    assert result["revision"] == 2
    assert result["audit_pending"] is True
    assert result["digest"] != initial["digest"]
    assert result["digest"] == digest_canonical_json(result["config"])["digest"]
    assert repository.get_head("plant-a")["digest"] == result["digest"]
    pending = repository.list_journals("AUDIT_PENDING")
    assert len(pending) == 1
    transaction_id = pending[0]["id"]
    durable_audit = backend.get(repository.store_specs["audit"], {"events": []})
    projected = [
        event
        for event in durable_audit["events"]
        if event.get("transaction_id") == transaction_id
    ]
    assert bool(projected) is durable_before_restart

    recovered_repository = ProjectRepository(
        object(), store_factory=store_factory(backend)
    )
    await recovered_repository.async_initialize()
    recovered = ProjectTransactionCoordinator(recovered_repository)
    evidence = await recovered.async_recover()

    final_head = recovered_repository.get_head("plant-a")
    assert final_head["revision"] == 2
    assert final_head["digest"] == result["digest"]
    assert final_head["digest"] == digest_canonical_json(final_head["config"])["digest"]
    assert evidence[0]["state"] == "COMMITTED"
    assert recovered_repository.get_journal(transaction_id)["state"] == "COMMITTED"
    final_events = [
        event
        for event in recovered_repository.list_audit()
        if event.get("transaction_id") == transaction_id
    ]
    assert len(final_events) == 1
    assert final_events[0]["id"] == f"audit:{transaction_id}"
    assert final_events[0]["result"] == "committed"

    assert await recovered.async_recover() == []
    assert len([
        event
        for event in recovered_repository.list_audit()
        if event.get("transaction_id") == transaction_id
    ]) == 1


async def test_retried_aborted_transaction_allocates_a_fresh_audit_identity() -> None:
    base, _repository, backend = await coordinator_for()
    await save_initial(base)
    fired = False

    def interrupt(stage: str) -> None:
        nonlocal fired
        if stage == "after_prepared" and not fired:
            fired = True
            raise RuntimeError("injected:after_prepared")

    interrupted, _repository, _ = await coordinator_for(
        backend, failure_hook=interrupt
    )
    candidate = project(
        project={"id": "plant-a", "name": "Plant A", "revision": 1},
        equipment=[{
            "id": "pump-1", "type": "pump", "profile": "profile-1",
            "asset_id": "asset-1", "x": 23,
        }],
    )
    preview = await interrupted.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=1,
        candidate=candidate,
    )
    with pytest.raises(RuntimeError, match="injected:after_prepared"):
        await interrupted.apply(
            user_id="designer-a",
            project_id="plant-a",
            preview_id=preview["preview_id"],
            expected_revision=1,
            selected_ids=["move:/equipment/pump-1/x"],
        )

    restarted, repository, _ = await coordinator_for(backend)
    retried_preview = await restarted.preview(
        user_id="designer-a",
        project_id="plant-a",
        expected_revision=1,
        candidate=candidate,
    )
    result = await restarted.apply(
        user_id="designer-a",
        project_id="plant-a",
        preview_id=retried_preview["preview_id"],
        expected_revision=1,
        selected_ids=["move:/equipment/pump-1/x"],
    )

    assert result["revision"] == 2
    retried_events = [
        event
        for event in repository.list_audit()
        if event.get("expected_revision") == 1
    ]
    assert {event["result"] for event in retried_events} == {"aborted", "committed"}
    assert len({event["transaction_id"] for event in retried_events}) == 2
    assert len({event["id"] for event in retried_events}) == 2


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
