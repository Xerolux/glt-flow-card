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
    pytest.mark.expected_red,
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

    try:
        from custom_components.glt_flow_card import schedule_audit  # noqa: F401
    except ImportError:
        gaps.append(
            "there is no schedule_audit module; run_schedules calls with "
            "blocking=False and `except Exception: continue`, so a schedule that "
            "failed is indistinguishable from one that ran and neither is audited"
        )

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
