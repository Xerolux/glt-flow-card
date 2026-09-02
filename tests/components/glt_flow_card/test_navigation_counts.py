"""A roll-up count never reveals an unauthorized subtree (T4-04, NAV-01).

A count feels like a number rather than a disclosure, which is exactly why it
ships by accident. "Backup: 1 fault" tells a caller that a fault-bearing object
exists under a subsystem every one of whose children they may not open.

The subtler half: a rendered zero is itself an oracle. "You may see this subtree
and it is empty" must not be distinguishable from "you may not see this
subtree", so an authorized count of zero is reported as no count at all.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .panel_factory import COUNT_ORACLE_SUBSYSTEM
from .panel_seed import PROJECT_ID, seed_operations_project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase4-navigation-counts]: "
    "authorized-scope aggregate counts are unavailable"
)
EFFECT_PREFIX = "PHASE4_COUNT_EFFECTS "

#: Roll-ups are asserted at every level, not only at the leaf.
ROLLUP_ADDRESSES = (
    "site-north",
    "site-north/bldg-north-1",
    "site-north/bldg-north-1/floor-north-1",
    "site-north/bldg-north-1/floor-north-1/sys-heat",
)


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps({"service_attempts": 0, "network": 0, **extra}, sort_keys=True))


async def resolve(connection, address: str, *, project_id: str = PROJECT_ID) -> dict[str, Any]:
    try:
        return await connection.command({
            "type": "glt_flow_card/navigation/resolve",
            "project_id": project_id,
            "address": address,
        })
    except Exception as error:  # noqa: BLE001 - a missing route must read as a gap
        return {"success": False, "error": {"code": "no_route", "message": str(error)}}


def child_counts(result: dict[str, Any]) -> dict[str, Any]:
    """Map child id -> its reported counts, if any were reported at all."""
    return {
        child.get("id"): child.get("counts")
        for child in result.get("children", [])
    }


async def test_expected_red_phase4_navigation_counts(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Counts cover the authorized scope only, and zero is reported as absent."""
    emit_effects(levels=len(ROLLUP_ADDRESSES), cases=4)
    gaps: list[str] = []
    await seed_operations_project(hass, config_entry, phase2_users)

    operator = await phase2_users.async_connect("operator")

    # The oracle: the only alarm-bearing child of this subsystem is an object
    # the operator may not open, so no alarm count may be reported for it.
    heating = await resolve(operator, "site-north/bldg-north-1/floor-north-1/sys-heat")
    if heating.get("success") is not True:
        gaps.append("an operator could not resolve a subsystem it may open")
    else:
        counts = child_counts(heating["result"])
        if COUNT_ORACLE_SUBSYSTEM not in counts:
            gaps.append(f"{COUNT_ORACLE_SUBSYSTEM} is not listed as a child at all")
        else:
            reported = counts[COUNT_ORACLE_SUBSYSTEM]
            if reported:
                gaps.append(
                    f"a count was reported for {COUNT_ORACLE_SUBSYSTEM} whose only "
                    f"alarm-bearing child is restricted: {reported}",
                )

    # An authorized-but-empty subtree must be indistinguishable from an
    # unauthorized one: both report no count, never a zero.
    if heating.get("success") is True:
        for child_id, reported in child_counts(heating["result"]).items():
            if isinstance(reported, dict) and 0 in reported.values():
                gaps.append(f"{child_id} reported a zero count, which is itself an oracle")

    # Roll-ups at every level must agree with what the caller may actually open.
    engineer = await phase2_users.async_connect("engineer")
    for address in ROLLUP_ADDRESSES:
        as_operator = await resolve(operator, address)
        as_engineer = await resolve(engineer, address)
        if as_operator.get("success") is not True or as_engineer.get("success") is not True:
            gaps.append(f"{address} did not resolve for both principals")
            continue
        operator_body = json.dumps(child_counts(as_operator["result"]), sort_keys=True)
        engineer_body = json.dumps(child_counts(as_engineer["result"]), sort_keys=True)
        if operator_body == engineer_body:
            gaps.append(
                f"{address} reported identical counts to two principals with "
                "different authorized scopes",
            )

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  count gap: {gap}")
    assert not gaps, "authorized-scope aggregate counts are unavailable"
    await phase2_users.async_close()
