"""Schedules have an authorization boundary of their own (T6-13, T6-14).

The audit found none. There is no `glt_flow_card/schedules/*` route in
`__init__.py` and none declared in `policy.py`: schedules are edited only as
project config through the ordinary save path. So there is no authorization
boundary of their own, no audit of an edit, and no route for a preview -- for
the thing that runs the plant.

The enumeration test reapplies the lesson from commit `9f53bcb`, including its
subtlest part: a `limit` must be applied *after* filtering, or the count of
hidden rows leaks through how many visible rows come back.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase6-schedule-routes]: "
    "authorized, audited schedule routes are unavailable"
)
EFFECT_PREFIX = "PHASE6_SCHEDULE_EFFECTS "

#: The routes this phase adds, with the capability each requires.
EXPECTED_ROUTES = {
    "glt_flow_card/schedules/list": "schedule.read",
    "glt_flow_card/schedules/save": "schedule.write",
    "glt_flow_card/schedules/delete": "schedule.write",
    "glt_flow_card/schedules/preview": "schedule.read",
}


def route_gaps() -> list[str]:
    """Return every route behaviour the Companion does not yet have."""
    gaps: list[str] = []

    from custom_components.glt_flow_card.policy import COMMAND_POLICIES

    from .policy_contract import COMMAND_POLICY_CONTRACT

    contract_routes = {policy.route for policy in COMMAND_POLICY_CONTRACT}

    for route, capability in EXPECTED_ROUTES.items():
        declared = COMMAND_POLICIES.get(route)
        if declared is None:
            gaps.append(f"{route} is not declared in policy.py")
        elif declared.capability != capability:
            gaps.append(f"{route} requires {declared.capability!r}, expected {capability!r}")
        if route not in contract_routes:
            # Phase 5 learned this the hard way: a route declared in only one
            # table passes the prober and fails the contract.
            gaps.append(f"{route} is not declared in policy_contract.py")

    listing = COMMAND_POLICIES.get("glt_flow_card/schedules/list")
    if listing is not None and listing.enumeration != "filter":
        gaps.append(
            "schedules/list must be enumeration='filter': refusing an unauthorized "
            "caller would itself tell them that rows exist"
        )

    # The audit is asserted as *behaviour*, not as a module name. An earlier
    # draft of this sentinel required a `schedule_audit` module; a separate
    # module for three call sites is ceremony, and a contract that names an
    # implementation shape rather than an outcome fails work that is correct.
    import ast
    from pathlib import Path

    import custom_components.glt_flow_card as integration

    tree = ast.parse(Path(integration.__file__).read_text(encoding="utf-8"))
    execute = next(
        (
            node for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name == "_execute_schedule"
        ),
        None,
    )
    if execute is None:
        gaps.append(
            "there is no single schedule execution path; `run_schedules` called "
            "with blocking=False inside `except Exception: continue`, so a "
            "schedule that failed was indistinguishable from one that ran"
        )
        return gaps

    if any(
        keyword.arg == "blocking" and getattr(keyword.value, "value", None) is False
        for node in ast.walk(execute) if isinstance(node, ast.Call)
        for keyword in node.keywords
    ):
        gaps.append("the schedule execution path still calls with blocking=False")
    if any(
        isinstance(node, ast.ExceptHandler)
        and any(isinstance(statement, ast.Continue) for statement in node.body)
        for node in ast.walk(execute)
    ):
        gaps.append("an except handler on the schedule path still continues silently")

    for name in ("save_schedule", "delete_schedule"):
        if not any(
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name
            for node in ast.walk(tree)
        ):
            gaps.append(f"the manager has no {name}(), so an edit cannot be audited")

    return gaps


async def test_expected_red_phase6_schedule_routes(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Routes exist in both tables, filter enumeration, and audit every edit."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, routes=len(EXPECTED_ROUTES))

    report(RED_MARKER, route_gaps(), "authorized, audited schedule routes are unavailable")


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------

OPEN_PROJECT = "schedule-open"
HIDDEN_PROJECT = "schedule-hidden"


async def _seed(hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users) -> Any:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    manager = _manager(hass)
    for project_id, label in ((OPEN_PROJECT, "Nachtabsenkung"),
                              (HIDDEN_PROJECT, "Schedule you cannot see")):
        manager.data["projects"][project_id] = {
            "id": project_id,
            "config": {
                "timezone": "Europe/Berlin",
                "alarms": [],
                "schedules": [{
                    "id": "sched-1", "name": label, "kind": "instant",
                    "time": "02:30", "days": [0, 1, 2, 3, 4, 5, 6],
                    "service": "climate.set_temperature",
                }],
            },
        }
        for index in range(20):
            manager.data.setdefault("schedule_history", []).append({
                "project_id": project_id, "schedule_id": "sched-1",
                "outcome": "delivered", "at": f"2026-09-0{index % 9 + 1}T02:30:00Z",
            })

    runtime = _runtime_for(hass)
    for role in ("viewer", "engineer"):
        await runtime.access.async_assign(
            project_id=OPEN_PROJECT,
            user_id=phase2_users.principal(role).user_id,
            role=role,
        )
    return manager


async def test_an_unassigned_caller_reads_no_schedule_at_all(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """The shape of the `alarms/list` leak, refused before it can happen again."""
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("unassigned")
    response = await connection.command({
        "type": "glt_flow_card/schedules/list", "project_id": HIDDEN_PROJECT, "limit": 50,
    })
    assert response["success"] is True, "a filtered route must not deny"
    assert response["result"]["schedules"] == []
    assert response["result"]["history"] == []


async def test_a_member_of_one_project_cannot_read_another(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("viewer")
    mine = await connection.command({
        "type": "glt_flow_card/schedules/list", "project_id": OPEN_PROJECT, "limit": 50,
    })
    assert [row["name"] for row in mine["result"]["schedules"]] == ["Nachtabsenkung"]

    theirs = await connection.command({
        "type": "glt_flow_card/schedules/list", "project_id": HIDDEN_PROJECT, "limit": 50,
    })
    assert theirs["result"]["schedules"] == []
    assert theirs["result"]["history"] == []


async def test_the_limit_is_not_a_count_oracle(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Filtering happens before the limit.

    Slicing first would let the hidden project's twenty rows consume the
    caller's page, so a small limit would return nothing and the caller would
    learn that rows they cannot see exist.
    """
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/schedules/list", "project_id": OPEN_PROJECT, "limit": 5,
    })
    history = response["result"]["history"]
    assert len(history) == 5
    assert all(row["project_id"] == OPEN_PROJECT for row in history)


async def test_a_viewer_may_read_but_not_write(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """`schedule.write` sits with the engineer, matching what `project.write`
    already required. Adding a boundary must not change who may cross it."""
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("viewer")
    denied = await connection.command({
        "type": "glt_flow_card/schedules/save",
        "project_id": OPEN_PROJECT,
        "schedule": {"id": "sched-2", "kind": "instant", "time": "06:00"},
    })
    assert denied["success"] is False


async def test_an_engineer_saves_and_the_edit_is_audited(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    manager = await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("engineer")
    saved = await connection.command({
        "type": "glt_flow_card/schedules/save",
        "project_id": OPEN_PROJECT,
        "schedule": {"id": "sched-2", "kind": "instant", "time": "06:00",
                     "service": "climate.set_temperature"},
    })
    assert saved["success"] is True
    ids = [row["id"] for row in
           manager.data["projects"][OPEN_PROJECT]["config"]["schedules"]]
    assert "sched-2" in ids

    actions = [row.get("action") for row in manager.data["audit"]]
    assert "schedule.save" in actions, "a schedule edit wrote no audit row"


async def test_a_malformed_time_is_refused_at_the_boundary(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Not discovered at the moment it was supposed to run."""
    manager = await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("engineer")
    response = await connection.command({
        "type": "glt_flow_card/schedules/save",
        "project_id": OPEN_PROJECT,
        "schedule": {"id": "sched-tea", "kind": "instant", "time": "tea"},
    })
    assert response["success"] is False
    ids = [row["id"] for row in
           manager.data["projects"][OPEN_PROJECT]["config"]["schedules"]]
    assert "sched-tea" not in ids, "a malformed entry was stored anyway"


async def test_deleting_a_schedule_is_audited(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    manager = await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("engineer")
    response = await connection.command({
        "type": "glt_flow_card/schedules/delete",
        "project_id": OPEN_PROJECT, "schedule_id": "sched-1",
    })
    assert response["result"]["removed"] is True
    assert manager.data["projects"][OPEN_PROJECT]["config"]["schedules"] == []
    assert "schedule.delete" in [row.get("action") for row in manager.data["audit"]]


async def test_the_preview_resolves_on_the_site_timezone(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Server-side, so the preview an engineer verifies is what the runner uses.

    Resolving in the browser would answer for the browser's zone, and a browser
    in a different zone from the plant is ordinary.
    """
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/schedules/preview",
        "project_id": OPEN_PROJECT,
        "schedule": {"id": "sched-1", "kind": "instant", "time": "02:30"},
        "dates": ["2027-03-28", "2027-10-31", "2027-06-15"],
    })
    assert response["success"] is True
    assert response["result"]["timezone"] == "Europe/Berlin"
    by_date = {row["date"]: row for row in response["result"]["dates"]}
    assert by_date["2027-03-28"]["status"] == "nonexistent"
    assert by_date["2027-10-31"]["status"] == "ambiguous"
    assert by_date["2027-06-15"]["status"] == "normal"


async def test_a_failed_execution_is_recorded_with_its_error(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """D6's schedule half. A schedule that failed was indistinguishable from
    one that ran, and neither wrote anything down."""
    manager = await _seed(hass, config_entry, phase2_users)
    sched = {"id": "sched-1", "service": "climate.set_temperature",
             "entity_id": "climate.heizkreis_1"}
    record = await manager._execute_schedule(
        OPEN_PROJECT, sched, {"climate"}, instant="2027-06-15T00:30:00Z",
    )
    # The controlled fixture blocks every live call, so this is the failure
    # path -- and the point is that the failure is *recorded*.
    assert record["outcome"] in {"failed", "timeout"}
    assert record["error"]
    history = manager.data["schedule_history"]
    assert history and history[0]["schedule_id"] == "sched-1"


async def test_an_unlisted_service_domain_is_refused_and_recorded(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    manager = await _seed(hass, config_entry, phase2_users)
    record = await manager._execute_schedule(
        OPEN_PROJECT, {"id": "s", "service": "shell_command.rm"}, {"climate"},
        instant="2027-06-15T00:30:00Z",
    )
    assert record["outcome"] == "refused"
    assert "not an allowed service domain" in record["error"]
