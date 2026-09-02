"""A panel read never enumerates what the caller may not see (T4-02).

The panel is the widest read in the phase: it touches the project, the profile,
the registries and the ACL in one call. Phase 2 settled that a filtered
collection filters before serialization and that a hidden object answers exactly
as a missing one; this asserts the panel route obeys both.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .panel_factory import RESTRICTED
from .panel_seed import PROJECT_ID, seed_operations_project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase4-panel-enumeration]: "
    "non-enumerating panel reads are unavailable"
)
EFFECT_PREFIX = "PHASE4_PANEL_ENUM_EFFECTS "


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps({"service_attempts": 0, "network": 0, **extra}, sort_keys=True))


async def panel(connection, object_id: str, *, project_id: str = PROJECT_ID) -> dict[str, Any]:
    try:
        return await connection.command({
            "type": "glt_flow_card/panels/get",
            "project_id": project_id,
            "object_id": object_id,
        })
    except Exception as error:  # noqa: BLE001 - a missing route must read as a gap
        return {"success": False, "error": {"code": "no_route", "message": str(error)}}


async def test_expected_red_phase4_panel_enumeration(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Hidden, missing and unauthorized all answer with one opaque shape."""
    emit_effects(cases=4)
    gaps: list[str] = []
    await seed_operations_project(hass, config_entry, phase2_users)

    # A principal with no assignment anywhere. A hidden project and a project
    # that was never created must be indistinguishable.
    outsider = await phase2_users.async_connect("unassigned")
    hidden = await panel(outsider, "eq-hp-primary")
    missing = await panel(outsider, "eq-hp-primary", project_id="does-not-exist")
    if hidden.get("success") is not False or missing.get("success") is not False:
        gaps.append("an unassigned principal was served a panel")
    elif hidden.get("error") != missing.get("error"):
        gaps.append("a hidden project and a missing project answer differently")
    elif hidden.get("error", {}).get("code") != "not_found_or_denied":
        gaps.append(f"the denial code is not the opaque one: {hidden.get('error')}")

    # An object inside a project the caller may open, but which the caller's
    # role may not: still the same opaque answer as an object that is not there.
    operator = await phase2_users.async_connect("operator")
    restricted_id = next(iter(RESTRICTED))
    restricted = await panel(operator, restricted_id)
    absent = await panel(operator, "eq-does-not-exist")
    if restricted.get("success") is True:
        gaps.append(f"an operator opened the restricted object {restricted_id}")
    elif restricted.get("error") != absent.get("error"):
        gaps.append("a restricted object and an absent object answer differently")

    # Nothing about the restricted object may appear anywhere in the response
    # a permitted caller receives for a different object.
    permitted = await panel(operator, "eq-hp-primary")
    if permitted.get("success") is True:
        body = json.dumps(permitted["result"])
        for hidden_id in RESTRICTED:
            if hidden_id in body:
                gaps.append(f"a permitted panel mentioned the restricted object {hidden_id}")

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  panel enumeration gap: {gap}")
    assert not gaps, "non-enumerating panel reads are unavailable"
    await phase2_users.async_close()
