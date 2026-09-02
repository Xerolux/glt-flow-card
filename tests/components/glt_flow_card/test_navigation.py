"""A deep link resolves only what the caller may open (T4-03, T4-05, NAV-01).

A URL is shareable: it gets pasted into a chat and opened by someone else, so
nothing about a link may be trusted for having once been valid for somebody.
Every resolve re-authorizes from scratch, and an address the caller may not
follow is indistinguishable from one that does not exist.

The address is also caller-supplied input into a tree walk, so it is bounded
before it is parsed.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .panel_factory import RESTRICTED_EQUIPMENT, RESTRICTED_PROJECT_ID
from .panel_seed import PROJECT_ID, declared_route, seed_operations_project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase4-navigation]: "
    "authorized non-enumerating address resolution is unavailable"
)
EFFECT_PREFIX = "PHASE4_NAVIGATION_EFFECTS "

#: Re-asserted here from the Phase-3 vocabulary bounds. An address deeper than
#: the hierarchy can be is rejected before any walk begins.
MAX_DEPTH = 32

#: Every level a user must be able to address, from NAV-01.
ADDRESSABLE_LEVELS = (
    "site", "building", "floor", "system", "subsystem", "equipment", "datapoint",
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


async def test_expected_red_phase4_navigation(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Every level resolves, every denial is opaque, every address is bounded."""
    emit_effects(levels=len(ADDRESSABLE_LEVELS), cases=6)
    gaps: list[str] = []
    await seed_operations_project(hass, config_entry, phase2_users)

    policy = declared_route("glt_flow_card/navigation/resolve")
    if policy is None:
        gaps.append("glt_flow_card/navigation/resolve is not declared in the policy contract")
    elif policy.scope != "project" or policy.enumeration != "opaque":
        gaps.append("navigation/resolve is not a project-scoped opaque route")

    engineer = await phase2_users.async_connect("engineer")
    resolved = await resolve(engineer, "site-north/bldg-north-1/floor-north-1")
    if resolved.get("success") is not True:
        gaps.append("an authorized engineer could not resolve an address it may open")
    else:
        result = resolved["result"]
        if not result.get("ancestry"):
            gaps.append("no ancestry was returned, so breadcrumbs would need a cached tree")
        if "children" not in result:
            gaps.append("no authorized children were returned")
        levels = {entry.get("level") for entry in result.get("ancestry", [])}
        if not levels <= set(ADDRESSABLE_LEVELS):
            gaps.append(f"the ancestry carries an unknown level: {levels}")

    # Every level from site to datapoint must be addressable.
    for address, label in (
        ("site-north", "site"),
        ("site-north/bldg-north-1", "building"),
        ("site-north/bldg-north-1/floor-north-1/sys-heat", "system"),
        ("site-north/bldg-north-1/floor-north-1/sys-heat/sub-primary", "subsystem"),
        ("site-north/bldg-north-1/floor-north-1/sys-heat/sub-primary/eq-hp-primary",
         "equipment"),
        ("site-north/bldg-north-1/floor-north-1/sys-heat/sub-primary/eq-hp-primary/"
         "dp-hp1-flow", "datapoint"),
    ):
        response = await resolve(engineer, address)
        if response.get("success") is not True:
            gaps.append(f"the {label} level is not addressable")

    # Unauthorized, non-existent and deferred-remote must be one answer.
    # The boundary is the project: Phase 2 assigns one role per (project, user)
    # and has no object granularity, so an operator is excluded from the
    # restricted project as a whole rather than from an object inside one.
    operator = await phase2_users.async_connect("operator")
    unauthorized = await resolve(
        operator, "site-south", project_id=RESTRICTED_PROJECT_ID,
    )
    nonexistent = await resolve(operator, "site-south", project_id="does-not-exist")
    remote = await resolve(operator, "remote:other-site/site-north")
    if unauthorized.get("success") is True:
        gaps.append("an operator resolved an address in a project it is not a member of")
    if unauthorized.get("error") != nonexistent.get("error"):
        gaps.append("an unauthorized project and a missing one answer differently")
    if remote.get("error") != nonexistent.get("error"):
        gaps.append("a deferred remote address is distinguishable from a missing one")
    if nonexistent.get("error", {}).get("code") != "not_found_or_denied":
        gaps.append(f"the denial code is not the opaque one: {nonexistent.get('error')}")

    # An address that does not exist inside a project the caller may open must
    # answer the same way, or resolution enumerates the hierarchy node by node.
    unknown = await resolve(operator, "site-north/does-not-exist")
    if unknown.get("success") is True:
        gaps.append("a non-existent address inside an open project resolved")
    elif unknown.get("error", {}).get("code") != "not_found_or_denied":
        gaps.append("an unknown address leaked a distinguishable error")

    # Nothing from the restricted project may appear in an authorized answer.
    open_answer = await resolve(operator, "site-north")
    if open_answer.get("success") is True:
        body = json.dumps(open_answer["result"])
        for hidden in (*RESTRICTED_EQUIPMENT, RESTRICTED_PROJECT_ID, "site-south"):
            if hidden in body:
                gaps.append(f"an authorized resolve mentioned {hidden}")

    # Bounds are enforced before the walk, not discovered during it.
    over_deep = await resolve(engineer, "/".join(f"n{index}" for index in range(MAX_DEPTH + 8)))
    if over_deep.get("success") is True:
        gaps.append("an address deeper than the hierarchy bound was resolved")
    over_long = await resolve(engineer, "x" * 100_000)
    if over_long.get("success") is True:
        gaps.append("an unbounded address length was accepted")

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  navigation gap: {gap}")
    assert not gaps, "authorized non-enumerating address resolution is unavailable"
    await phase2_users.async_close()
