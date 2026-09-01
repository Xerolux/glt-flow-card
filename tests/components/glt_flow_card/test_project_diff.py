"""Semantic project diff and dependency closure tests."""
from __future__ import annotations

from copy import deepcopy

import pytest

from custom_components.glt_flow_card.project_diff import compute_project_diff, expand_diff_selection

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def _project(**overrides) -> dict:
    value = {
        "type": "custom:glt-flow-card",
        "schema_version": 2,
        "project": {"id": "python-diff", "name": "Python Diff", "revision": 0},
        "profiles": [{"id": "profile-1", "equipment_type": "pump"}],
        "assets": [{"id": "asset-1", "path": "assets/pump.svg"}],
        "equipment": [{"id": "pump-1", "type": "pump", "profile": "profile-1", "asset_id": "asset-1"}],
        "paths": [],
    }
    value.update(overrides)
    return value


def test_categories_ordering_and_impact_are_stable() -> None:
    before = _project(equipment=[{
        "id": "pump-1", "type": "pump", "profile": "profile-1", "asset_id": "asset-1",
        "x": 1, "entity": "sensor.old", "name": "Old",
    }])
    after = _project(equipment=[{
        "name": "New", "entity": "sensor.new", "x": 2, "asset_id": "asset-1",
        "profile": "profile-1", "type": "pump", "id": "pump-1",
    }], paths=[{"id": "path-1", "from_equipment": "pump-1", "to_equipment": "pump-1"}])

    result = compute_project_diff(before, after)
    assert [operation["id"] for operation in result["operations"]] == sorted(
        operation["id"] for operation in result["operations"]
    )
    assert {operation["category"] for operation in result["operations"]} == {
        "add", "binding", "config", "move"
    }
    binding = next(operation for operation in result["operations"] if operation["category"] == "binding")
    assert binding["impact"] == {"severity": "warning", "areas": ["binding", "operational"]}


def test_reorder_noise_and_transitive_closure() -> None:
    before = _project(equipment=[{"id": "a", "type": "pump"}, {"id": "b", "type": "pump"}])
    reordered = _project(equipment=[{"type": "pump", "id": "b"}, {"type": "pump", "id": "a"}])
    noise = compute_project_diff(before, reordered)
    assert noise["operations"] == []
    assert noise["ordering_noise"] == ["/equipment"]

    after = _project(
        profiles=[
            {"id": "profile-1", "equipment_type": "pump"},
            {"id": "profile-2", "equipment_type": "pump"},
        ],
        assets=[
            {"id": "asset-1", "path": "assets/pump.svg"},
            {"id": "asset-2", "path": "assets/pump-2.svg"},
        ],
        equipment=[
            {"id": "pump-1", "type": "pump", "profile": "profile-1", "asset_id": "asset-1"},
            {"id": "pump-2", "type": "pump", "profile": "profile-2", "asset_id": "asset-2"},
        ],
        paths=[{"id": "path-2", "from_equipment": "pump-2", "to_equipment": "pump-1"}],
    )
    result = compute_project_diff(_project(), after)
    closure = expand_diff_selection(result, ["add:/paths/path-2"])
    assert closure["selected"] == [
        "add:/assets/asset-2",
        "add:/equipment/pump-2",
        "add:/paths/path-2",
        "add:/profiles/profile-2",
    ]


def test_removal_dependencies_protect_referenced_targets_without_expanding_sources() -> None:
    before = _project(
        equipment=[
            {"id": "pump-1", "type": "pump"},
            {"id": "pump-2", "type": "pump"},
        ],
        paths=[{"id": "path-1", "from_equipment": "pump-1", "to_equipment": "pump-2"}],
    )
    after = _project(equipment=[], paths=[])
    result = compute_project_diff(before, after)

    path_only = expand_diff_selection(result, ["remove:/paths/path-1"])
    assert path_only["selected"] == ["remove:/paths/path-1"]

    first_target = expand_diff_selection(result, ["remove:/equipment/pump-1"])
    assert first_target["selected"] == [
        "remove:/equipment/pump-1",
        "remove:/paths/path-1",
    ]
    second_target = expand_diff_selection(result, ["remove:/equipment/pump-2"])
    assert second_target["selected"] == [
        "remove:/equipment/pump-2",
        "remove:/paths/path-1",
    ]


def test_invalid_contract_and_hostile_closure_metadata_fail_closed() -> None:
    with pytest.raises(ValueError, match="candidate project contract is invalid"):
        compute_project_diff(_project(), {"type": "custom:glt-flow-card", "schema_version": 2})

    result = compute_project_diff(_project(), _project(paths=[]))
    hostile = deepcopy(result)
    hostile["operations"] = [{
        "id": "add:/paths/x",
        "requires": [{"operation_id": "add:/equipment/missing", "reason": "hostile"}],
    }]
    with pytest.raises(ValueError, match="missing dependency operation"):
        expand_diff_selection(hostile, ["add:/paths/x"])

    hostile["operations"] = [
        {"id": "a", "requires": [{"operation_id": "b", "reason": "cycle"}]},
        {"id": "b", "requires": [{"operation_id": "a", "reason": "cycle"}]},
    ]
    with pytest.raises(ValueError, match="cyclic diff dependency"):
        expand_diff_selection(hostile, ["a"])
