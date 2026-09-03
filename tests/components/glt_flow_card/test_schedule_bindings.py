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


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------


def test_the_feature_flags_match_home_assistants_own() -> None:
    """Mirrored rather than imported, so this is the check that says when they
    diverge. An import would make a silent renumbering invisible."""
    from homeassistant.components.calendar.const import CalendarEntityFeature

    from custom_components.glt_flow_card import schedule_bindings as sb

    assert sb.CALENDAR_CREATE_EVENT == CalendarEntityFeature.CREATE_EVENT
    assert sb.CALENDAR_DELETE_EVENT == CalendarEntityFeature.DELETE_EVENT
    assert sb.CALENDAR_UPDATE_EVENT == CalendarEntityFeature.UPDATE_EVENT


def test_every_corpus_binding_reaches_its_declared_answer() -> None:
    from custom_components.glt_flow_card import schedule_bindings as sb

    for case in binding_cases():
        result = sb.describe(case)
        assert result["writable"] is case["expected_writable"], case["id"]
        if case.get("expected_refusal"):
            assert result["reason"] == case["expected_refusal"], case["id"]


def test_a_calendar_without_create_event_is_read_only_with_that_reason() -> None:
    from custom_components.glt_flow_card import schedule_bindings as sb

    result = sb.describe({
        "kind": "holiday", "entity_id": "calendar.feiertage", "supported_features": 0,
    })
    assert result["writable"] is False
    assert result["reason"] == "calendar_cannot_create_events"
    assert result["can_create"] is False


def test_a_writable_calendar_reports_each_capability_separately() -> None:
    """`create` is what makes it writable; `update` and `delete` are their own
    questions, and a calendar can declare any subset."""
    from custom_components.glt_flow_card import schedule_bindings as sb

    create_only = sb.describe({
        "kind": "special_day", "entity_id": "calendar.betrieb",
        "supported_features": sb.CALENDAR_CREATE_EVENT,
    })
    assert create_only["writable"] is True
    assert create_only["can_create"] is True
    assert create_only["can_update"] is False
    assert create_only["can_delete"] is False

    everything = sb.describe({
        "kind": "special_day", "entity_id": "calendar.betrieb", "supported_features": 7,
    })
    assert (everything["can_create"], everything["can_update"], everything["can_delete"]) == (
        True, True, True
    )


def test_workday_is_read_only_and_says_so() -> None:
    """It answers whether today is a working day, in a country and province
    Home Assistant already knows. This card ships no holiday table."""
    from custom_components.glt_flow_card import schedule_bindings as sb

    result = sb.describe({"kind": "holiday", "entity_id": "binary_sensor.workday"})
    assert result["writable"] is False
    assert result["reason"] == "binding_is_read_only"


def test_the_admin_refusal_is_distinct_from_the_capability_refusal() -> None:
    """"This calendar cannot be written to" and "you may not write to it" need
    different answers from the person reading them."""
    from custom_components.glt_flow_card import schedule_bindings as sb

    schedule = sb.describe({"kind": "operating_period", "entity_id": "schedule.buero"})
    assert schedule["writable"] is True
    assert sb.refuse_for_non_admin(schedule) == "requires_home_assistant_admin"

    calendar = sb.describe({
        "kind": "special_day", "entity_id": "calendar.x", "supported_features": 0,
    })
    assert calendar["reason"] == "calendar_cannot_create_events"
    assert sb.refuse_for_non_admin(calendar) is None
    assert calendar["reason"] != "requires_home_assistant_admin"


def test_the_interval_and_instant_models_are_declared_and_never_blurred() -> None:
    from custom_components.glt_flow_card import schedule_bindings as sb

    assert sb.model_of("operating_period") == "interval"
    for kind in ("holiday", "exception", "vacation", "special_day"):
        assert sb.model_of(kind) == "instant", kind
    # Every declared kind has a model; a kind without one is a kind nothing can
    # bind.
    assert set(sb.BINDING_MODELS) == set(SCHEDULE_BINDING_KINDS)


def test_an_unknown_kind_or_wrong_domain_is_refused_with_its_own_reason() -> None:
    from custom_components.glt_flow_card import schedule_bindings as sb

    assert sb.describe({"kind": "vibes"})["reason"] == "unknown_binding_kind"
    with pytest.raises(ValueError, match="unknown binding kind"):
        sb.model_of("vibes")
    # An operating period cannot bind to a calendar: that would be converting
    # an instant model into an interval one.
    wrong = sb.describe({"kind": "operating_period", "entity_id": "calendar.x"})
    assert wrong["reason"] == "binding_entity_missing"


def test_every_refusal_is_a_declared_member() -> None:
    from custom_components.glt_flow_card import schedule_bindings as sb

    reasons = {
        sb.describe(case).get("reason") for case in binding_cases()
    } | {sb.describe({"kind": "vibes"})["reason"], sb.refuse_for_non_admin(
        sb.describe({"kind": "operating_period", "entity_id": "schedule.b"})
    )}
    for reason in reasons:
        if reason is not None:
            assert reason in sb.BINDING_REFUSALS, reason


async def test_bindable_entities_are_read_from_the_live_state_machine(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """So the affordance offered matches what the installation actually has,
    rather than what a project document remembers."""
    from custom_components.glt_flow_card import schedule_bindings as sb

    hass.states.async_set("calendar.betrieb", "off", {"supported_features": 7})
    hass.states.async_set("calendar.extern", "off", {"supported_features": 0})
    hass.states.async_set("schedule.buero", "on", {})
    hass.states.async_set("binary_sensor.workday", "on", {})
    hass.states.async_set("light.irrelevant", "on", {})
    await hass.async_block_till_done()

    special = {row["entity_id"]: row for row in sb.bindable_entities(hass, "special_day")}
    assert set(special) == {"calendar.betrieb", "calendar.extern"}
    assert special["calendar.betrieb"]["writable"] is True
    assert special["calendar.extern"]["writable"] is False

    periods = [row["entity_id"] for row in sb.bindable_entities(hass, "operating_period")]
    assert periods == ["schedule.buero"]

    holidays = [row["entity_id"] for row in sb.bindable_entities(hass, "holiday")]
    assert "binary_sensor.workday" in holidays
    assert "light.irrelevant" not in holidays


def test_this_repository_ships_no_holiday_table() -> None:
    """German public holidays are per-Bundesland; `binary_sensor.workday`
    already carries country, province, add_holidays and remove_holidays. A
    table we shipped would be wrong for half the country."""
    from pathlib import Path

    import custom_components.glt_flow_card as integration

    component = Path(integration.__file__).resolve().parent
    for source in component.rglob("*.py"):
        text = source.read_text(encoding="utf-8")
        for marker in ("Karfreitag", "Fronleichnam", "Christi Himmelfahrt"):
            assert marker not in text, f"{source.name} carries a holiday table"
