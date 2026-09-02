"""Bindings read the capability before offering the affordance (T6-15).

Established against the vendored Home Assistant 2026.2.3:

- `calendar.create_event` is registered with
  `required_features=[CalendarEntityFeature.CREATE_EVENT]`, and the websocket
  create/update/delete paths gate on the matching flags. A calendar that cannot
  be written to rejects the *call*, not the request.
- `schedule/create`, `schedule/update` and `schedule/delete` are each wrapped in
  `websocket_api.require_admin`. A card "engineer" is not necessarily a Home
  Assistant admin.
- `binary_sensor.workday` already carries country, `province`, `add_holidays`
  and `remove_holidays`. German public holidays are per-Bundesland, and a table
  we shipped would be wrong for half the country.

This is the same defect shape Phase 4 closed for controls: an affordance whose
feasibility was never checked.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.alarm_vocabulary import SCHEDULE_BINDING_KINDS

from .alarm_factory import binding_cases
from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
    pytest.mark.expected_red,
]

RED_MARKER = (
    "EXPECTED_RED[phase6-schedule-bindings]: "
    "Home Assistant schedule and calendar bindings are unavailable"
)
EFFECT_PREFIX = "PHASE6_SCHEDULE_EFFECTS "


def binding_gaps() -> list[str]:
    """Return every binding behaviour the Companion does not yet have."""
    gaps: list[str] = []

    try:
        from custom_components.glt_flow_card import schedule_bindings
    except ImportError:
        return [
            "there is no schedule_bindings module; grep for `calendar` over the "
            "integration, the v100 sources and the schema returns zero hits, so "
            "there is no holiday, exception, vacation or special-day concept at all"
        ]

    describe = getattr(schedule_bindings, "describe", None)
    if describe is None:
        gaps.append("schedule_bindings has no describe(); nothing reads supported_features")
        return gaps

    for case in binding_cases():
        result = describe(case) or {}
        if result.get("writable") is not case["expected_writable"]:
            gaps.append(
                f"{case['id']}: writable {result.get('writable')!r}, "
                f"expected {case['expected_writable']!r}"
            )
        expected_refusal = case.get("expected_refusal")
        if expected_refusal and result.get("reason") != expected_refusal:
            gaps.append(
                f"{case['id']}: expected refusal {expected_refusal!r}, got {result.get('reason')!r}"
            )
        if case["kind"] not in SCHEDULE_BINDING_KINDS:
            gaps.append(f"{case['id']}: kind {case['kind']!r} is outside the declared set")

    # The admin gate is a *distinct* refusal from the capability gate, and it
    # must be reported before the websocket call rather than after.
    for_non_admin = getattr(schedule_bindings, "refuse_for_non_admin", None)
    if for_non_admin is None:
        gaps.append(
            "schedule_bindings has no refuse_for_non_admin(); schedule/create is "
            "wrapped in require_admin and an authoring path must degrade honestly "
            "rather than fail opaquely"
        )
    else:
        admin_case = next(c for c in binding_cases() if c.get("requires_admin"))
        code = for_non_admin(admin_case)
        if code != admin_case["expected_refusal_for_non_admin"]:
            gaps.append(
                f"a non-admin authoring attempt must be refused with "
                f"{admin_case['expected_refusal_for_non_admin']!r}, got {code!r}"
            )
        if for_non_admin({**admin_case, "requires_admin": False}) is not None:
            gaps.append("a binding that needs no admin must not be refused for one")

    # The interval/instant distinction is load-bearing and must never be
    # converted away: an HA schedule says the plant is in day mode between these
    # hours; our runner says call this service at this minute.
    model_of = getattr(schedule_bindings, "model_of", None)
    if model_of is None:
        gaps.append("schedule_bindings has no model_of(); the interval/instant split is unstated")
    else:
        if model_of("operating_period") != "interval":
            gaps.append("an operating period binds to a schedule entity and is an interval")
        for kind in ("holiday", "exception", "vacation", "special_day"):
            if model_of(kind) == "interval":
                gaps.append(f"{kind} is dated, not an interval")

    return gaps


async def test_expected_red_phase6_schedule_bindings(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """A binding says what it cannot do, before it is attempted."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, bindings=len(binding_cases()))

    report(RED_MARKER, binding_gaps(),
           "Home Assistant schedule and calendar bindings are unavailable")
