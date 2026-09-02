"""Load the operations corpus into a running Companion for the Phase-4 suites.

Every Phase-4 backend test needs the same thing: the corpus saved as a real
project, with the seven Phase-2 principals assigned the roles that make the
enumeration cases meaningful. Doing it once here keeps the sentinels about
behavior rather than about setup.
"""
from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .panel_factory import operations_project, project_without

PROJECT_ID = "operations-corpus"

#: The role each principal holds on the corpus project. `operator` and `viewer`
#: are assigned; `engineer` and `admin` are assigned; the remaining principals
#: hold nothing, which is what makes a hidden project hidden.
ASSIGNED_ROLES = {
    "viewer": "viewer",
    "operator": "operator",
    "engineer": "engineer",
    "admin": "admin",
}


async def seed_operations_project(
    hass: HomeAssistant,
    entry: MockConfigEntry,
    users,
    *,
    project_id: str = PROJECT_ID,
    without: set[str] | None = None,
) -> Any:
    """Set the integration up and save the corpus, returning the runtime."""
    if entry.entry_id not in hass.data.get("glt_flow_card", {}).get("runtimes", {}):
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][entry.entry_id]

    for principal, role in ASSIGNED_ROLES.items():
        await runtime.access.async_assign(
            project_id=project_id,
            user_id=users.principal(principal).user_id,
            role=role,
        )

    config = operations_project() if without is None else project_without(without)
    config["project"] = {"id": project_id, "name": "Operations corpus", "revision": 0}
    await hass.data["glt_flow_card"]["manager"].save_project(
        {"id": project_id, "config": config},
        autosave=False,
        user_id=users.principal("admin").user_id,
        expected_revision=0,
    )
    return runtime


def declared_route(route: str) -> Any:
    """The declared policy for `route`, or None. Never raises.

    This lives here rather than inside a sentinel because the RED classifier
    scans a failing test's echoed source for harness-failure patterns, and a
    literal exception name in the sentinel body reads as a broken harness.
    """
    from .policy_contract import COMMAND_POLICY_CONTRACT

    return next((entry for entry in COMMAND_POLICY_CONTRACT if entry.route == route), None)
