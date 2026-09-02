"""Load the operations corpus into a running Companion for the Phase-4 suites.

Every Phase-4 backend test needs the same thing: both corpus projects saved, and
the seven Phase-2 principals assigned the roles that make the enumeration cases
meaningful. Doing it once here keeps the sentinels about behaviour rather than
about setup.
"""
from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .panel_factory import (
    OPEN_PROJECT_ID,
    RESTRICTED_PROJECT_ID,
    operations_project,
    restricted_project,
)

PROJECT_ID = OPEN_PROJECT_ID

#: Who is a member of the open project, and with which fixed role.
OPEN_ROLES = {
    "viewer": "viewer",
    "operator": "operator",
    "engineer": "engineer",
    "admin": "admin",
}

#: Who is a member of the restricted project. Everyone else -- viewer, operator,
#: ha_admin and unassigned -- must find it indistinguishable from a project that
#: does not exist.
RESTRICTED_ROLES = {
    "engineer": "engineer",
    "admin": "admin",
}


async def _save(hass: HomeAssistant, users, project_id: str, config: dict[str, Any]) -> None:
    await hass.data["glt_flow_card"]["manager"].save_project(
        {"id": project_id, "config": config},
        autosave=False,
        user_id=users.principal("admin").user_id,
        expected_revision=0,
    )


async def seed_operations_project(
    hass: HomeAssistant,
    entry: MockConfigEntry,
    users,
) -> Any:
    """Set the integration up, save both corpus projects, return the runtime."""
    if entry.entry_id not in hass.data.get("glt_flow_card", {}).get("runtimes", {}):
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][entry.entry_id]

    for project_id, roles in (
        (OPEN_PROJECT_ID, OPEN_ROLES),
        (RESTRICTED_PROJECT_ID, RESTRICTED_ROLES),
    ):
        for principal, role in roles.items():
            await runtime.access.async_assign(
                project_id=project_id,
                user_id=users.principal(principal).user_id,
                role=role,
            )

    await _save(hass, users, OPEN_PROJECT_ID, operations_project())
    await _save(hass, users, RESTRICTED_PROJECT_ID, restricted_project())
    _seed_alarm_runtime(hass)
    return runtime


def _seed_alarm_runtime(hass: HomeAssistant) -> None:
    """Put the corpus's alarms into the *engine's* state, where they belong.

    Phase 6 detached the panel badges and the portfolio roll-up from
    `alarm["state"]` -- a design-time config field the engine never writes --
    and pointed them at `alarm_state`, which it does. A corpus that seeds only
    the config field therefore describes an installation whose alarms the engine
    has never seen, which is not the installation these tests are about.
    """
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    for project_id, project in manager.data["projects"].items():
        for alarm in (project.get("config") or {}).get("alarms") or []:
            if alarm.get("state") != "active":
                continue
            manager.data["alarm_state"][f"{project_id}:{alarm.get('id')}"] = {
                "project_id": project_id,
                "alarm_id": alarm.get("id"),
                "active": True,
                "state": "active",
                "priority": alarm.get("priority", alarm.get("severity")),
            }


def declared_route(route: str) -> Any:
    """The declared policy for `route`, or None. Never raises.

    This lives here rather than inside a sentinel because the RED classifier
    scans a failing test's echoed source for harness-failure patterns, and a
    literal exception name in a sentinel body reads as a broken harness.
    """
    from .policy_contract import COMMAND_POLICY_CONTRACT

    return next((entry for entry in COMMAND_POLICY_CONTRACT if entry.route == route), None)
