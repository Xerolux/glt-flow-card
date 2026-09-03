"""A roll-up count never reveals a project the caller cannot open (T4-04).

A count feels like a number rather than a disclosure, which is exactly why it
ships by accident. The portfolio spans projects, and Phase 2 assigns membership
per project, so the dangerous shape is a total computed across every project and
*then* filtered for display: "3 faults across your sites" announces a fault in a
project the caller is not a member of, even though the row itself is hidden.

The corpus is built for this: the restricted project holds the only fault in the
whole corpus, so any total that includes it is visibly wrong for a non-member.

The subtler half: a rendered zero is itself an oracle. "You may see this and it
is empty" must not be distinguishable from "you may not see this", so an
authorized count of zero is reported as no count at all.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.alarm_vocabulary import migrate_severity

from .panel_factory import OPEN_PROJECT_ID, RESTRICTED_PROJECT_ID
from .panel_seed import seed_operations_project

#: The tier the corpus' stored `fault` lands in, derived rather than written.
#: A literal here would silently stop testing the corpus if the vocabulary
#: moved again -- the roll-up would report a key nobody asserts.
COUNTED_KEY = migrate_severity("fault")["priority"]

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase4-navigation-counts]: "
    "authorized-scope aggregate counts are unavailable"
)
EFFECT_PREFIX = "PHASE4_COUNT_EFFECTS "


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps({"service_attempts": 0, "network": 0, **extra}, sort_keys=True))


async def portfolio(connection) -> dict[str, Any]:
    """The portfolio roll-up: every project this caller may open, with counts."""
    try:
        return await connection.command({"type": "glt_flow_card/navigation/portfolio"})
    except Exception as error:  # noqa: BLE001 - a missing route must read as a gap
        return {"success": False, "error": {"code": "no_route", "message": str(error)}}


def totals(result: dict[str, Any]) -> dict[str, Any]:
    return result.get("totals") or {}


def rows_by_project(result: dict[str, Any]) -> dict[str, Any]:
    return {row.get("project_id"): row for row in result.get("projects", [])}


async def test_expected_red_phase4_navigation_counts(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Counts are computed after the project filter, and zero is reported as absent."""
    emit_effects(cases=5)
    gaps: list[str] = []
    await seed_operations_project(hass, config_entry, phase2_users)

    # The engineer is a member of both projects and must see both, faults
    # included: it is the control that proves the corpus really carries one.
    engineer = await phase2_users.async_connect("engineer")
    full = await portfolio(engineer)
    if full.get("success") is not True:
        gaps.append("an authorized engineer could not read the portfolio roll-up")
    else:
        rows = rows_by_project(full["result"])
        if RESTRICTED_PROJECT_ID not in rows or OPEN_PROJECT_ID not in rows:
            gaps.append("a member of both projects was not shown both")
        # Phase 6 closed the severity vocabulary: the corpus stores `fault`,
        # which now migrates to the declared `critical` tier. The claim under
        # test is unchanged -- the count is computed after the project filter --
        # only the key the roll-up reports it under.
        if totals(full["result"]).get(COUNTED_KEY, 0) < 1:
            gaps.append("the corpus fault is not counted for a principal who may see it")

    # The operator is a member of the open project only. Neither the row nor
    # the *total* may carry anything from the restricted project.
    operator = await phase2_users.async_connect("operator")
    partial = await portfolio(operator)
    if partial.get("success") is not True:
        gaps.append("an authorized operator could not read the portfolio roll-up")
    else:
        result = partial["result"]
        rows = rows_by_project(result)
        if RESTRICTED_PROJECT_ID in rows:
            gaps.append("a project the operator is not a member of appeared as a row")
        if totals(result).get(COUNTED_KEY):
            gaps.append(
                "the portfolio total counted the restricted project's fault, so the "
                "total was computed before the project filter",
            )
        if RESTRICTED_PROJECT_ID in json.dumps(result):
            gaps.append("the restricted project id appeared in the operator's roll-up")

        # A rendered zero distinguishes an empty authorized scope from an
        # unauthorized one, so an authorized zero is reported as absent.
        for name, value in totals(result).items():
            if value == 0:
                gaps.append(f"a zero was reported for {name}, which is itself an oracle")
        for project_id, row in rows.items():
            for name, value in (row.get("counts") or {}).items():
                if value == 0:
                    gaps.append(f"{project_id} reported a zero {name} count")

    # An unassigned principal gets an empty roll-up, not a denial and not a
    # count: a denial would confirm that projects exist.
    outsider = await phase2_users.async_connect("unassigned")
    empty = await portfolio(outsider)
    if empty.get("success") is not True:
        gaps.append("an unassigned principal was denied rather than shown nothing")
    elif rows_by_project(empty["result"]):
        gaps.append("an unassigned principal was shown a project row")
    elif totals(empty["result"]):
        gaps.append("an unassigned principal was shown a total")

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  count gap: {gap}")
    assert not gaps, "authorized-scope aggregate counts are unavailable"
    await phase2_users.async_close()
