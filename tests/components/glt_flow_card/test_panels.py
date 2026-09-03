"""The server composes the profile-driven object panel (T4-01, OPS-02).

A panel that assembles its own control list in the browser is the
browser-derived authority Phase 2 exists to forbid. The capability snapshot it
would use can be five minutes stale, a profile's declared control may no longer
resolve against the current head, and neither the lease state nor the rate class
appears in a profile. So the server composes the panel and the browser renders
what it is given.

One sentinel, every unmet guarantee reported as a gap, so a controlled RED
fails exactly once. The behavioural tests arrive with plan 04-05.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .panel_seed import PROJECT_ID, declared_route, seed_operations_project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase4-panels]: "
    "the server-composed profile-driven object panel is unavailable"
)
EFFECT_PREFIX = "PHASE4_PANEL_EFFECTS "

#: The ordered region kinds every panel must carry, from 04-UI-SPEC.
REQUIRED_REGIONS = ("identity", "state", "values", "quality", "alarms", "controls", "trend")

#: A panel response may never carry any of these: Phase 2 resolves the dispatch
#: target from the verified head, and a panel that echoed one would hand the
#: browser something to call directly.
FORBIDDEN_KEYS = ("domain", "service", "target", "entity_id", "service_data")


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps({"service_attempts": 0, "network": 0, **extra}, sort_keys=True))


async def panel(connection, object_id: str, *, project_id: str = PROJECT_ID) -> dict[str, Any]:
    """Ask for one panel. An unregistered route is an answer, not an exception."""
    try:
        return await connection.command({
            "type": "glt_flow_card/panels/get",
            "project_id": project_id,
            "object_id": object_id,
        })
    except Exception as error:  # noqa: BLE001 - a missing route must read as a gap
        return {"success": False, "error": {"code": "no_route", "message": str(error)}}


async def test_expected_red_phase4_panels(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """The server composes a permitted-only, target-free, ordered panel."""
    emit_effects(objects=2, principals=2)
    gaps: list[str] = []
    await seed_operations_project(hass, config_entry, phase2_users)

    policy = declared_route("glt_flow_card/panels/get")
    if policy is None:
        gaps.append("glt_flow_card/panels/get is not declared in the policy contract")
    else:
        if policy.scope != "project":
            gaps.append("panels/get is not project-scoped")
        if policy.capability != "project.read":
            gaps.append("panels/get does not carry project.read")
        if policy.enumeration != "opaque":
            gaps.append("panels/get does not answer opaquely")

    engineer = await phase2_users.async_connect("engineer")
    composed = await panel(engineer, "eq-hp-primary")
    if composed.get("success") is not True:
        gaps.append("an authorized engineer could not open a profiled object panel")
    else:
        result = composed["result"]
        regions = {region.get("kind"): region for region in result.get("regions", [])}
        ordered = [region.get("kind") for region in result.get("regions", [])]
        present = [kind for kind in ordered if kind in REQUIRED_REGIONS]
        if present != list(REQUIRED_REGIONS):
            gaps.append(f"the panel regions are not the declared ordered set: {ordered}")
        if regions.get("trend", {}).get("state") != "history_unavailable":
            gaps.append("the trend region does not declare its Phase-7 unavailability")
        runtime_region = json.dumps(regions.get("runtime", {})).lower()
        if "hours" not in runtime_region or "starts" not in runtime_region:
            gaps.append("profile-declared operating hours and starts are not shown")
        body = json.dumps(result)
        for key in FORBIDDEN_KEYS:
            if f'"{key}"' in body:
                gaps.append(f"the panel model leaked a dispatch target field: {key}")

        # A second profiled object must open the same way; one panel proving
        # the shape would not prove the phase's "without a hand-designed popup".
        second = await panel(engineer, "eq-hp-secondary")
        if second.get("success") is not True:
            gaps.append("a second profiled object did not open the same panel")
        elif [r.get("kind") for r in second["result"].get("regions", [])] != ordered:
            gaps.append("two objects of the same profile produced different regions")

    viewer = await phase2_users.async_connect("viewer")
    restricted = await panel(viewer, "eq-hp-primary")
    if restricted.get("success") is True:
        controls = next(
            (region for region in restricted["result"].get("regions", [])
             if region.get("kind") == "controls"),
            {},
        )
        if controls.get("controls"):
            gaps.append("a viewer was offered a control it may not execute")
        if "disabled" in json.dumps(controls).lower():
            gaps.append("a control was disabled rather than absent, which still enumerates it")

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  panel gap: {gap}")
    assert not gaps, "the server-composed profile-driven object panel is unavailable"
    await phase2_users.async_close()
