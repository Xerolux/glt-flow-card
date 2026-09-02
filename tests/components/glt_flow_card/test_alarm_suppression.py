"""Suppression is consulted where the decision is made (T6-01).

D1: shelving is inert. `shelved_until` appears in exactly three places in the
whole repository, all writes -- set in `shelve_alarm`, cleared in
`alarm_transition`, and `shelved_by` beside it. It is read **nowhere**. A
shelved alarm still processes and still notifies, so the product reports success
and does nothing, which is worse than a feature that is missing: the operator
believes the alarm is quiet.

Every test here therefore asserts what shelving *did*, never that the field is
set. Asserting the field would pass today.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.alarm_vocabulary import SUPPRESSION_REASONS

from .alarm_factory import SITE_TIMEZONE, suppression_cases
from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase6-suppression]: "
    "suppression consulted at the point of decision is unavailable"
)
EFFECT_PREFIX = "PHASE6_SUPPRESSION_EFFECTS "

#: The conservative default, decided with the user on 2026-09-02. Long enough
#: for a planned outage, short enough that a forgotten shelf expires.
DEFAULT_SHELVING_MAXIMUM_DAYS = 7


def suppression_gaps() -> list[str]:
    """Return every suppression behaviour the Companion does not yet have."""
    gaps: list[str] = []
    now = datetime(2026, 9, 2, 12, 0, tzinfo=ZoneInfo(SITE_TIMEZONE))

    try:
        from custom_components.glt_flow_card import alarm_engine
    except ImportError:
        return ["there is no alarm_engine module, so suppression has no single decision point"]

    suppression_for = getattr(alarm_engine, "suppression_for", None)
    if suppression_for is None:
        gaps.append(
            "alarm_engine has no suppression_for(); shelving, maintenance and "
            "acknowledgement must be decided in one function or processing and "
            "notification can disagree about whether an alarm is suppressed"
        )
        return gaps

    settings = {"shelving_maximum_days": DEFAULT_SHELVING_MAXIMUM_DAYS}
    for case in suppression_cases(now):
        expected = case.get("expected_suppression")
        if case.get("expected_refusal"):
            continue
        try:
            result = suppression_for(case, state="on", now=now, settings=settings)
        except TypeError as error:
            gaps.append(f"suppression_for has the wrong signature: {error}")
            break
        reason = (result or {}).get("reason") if isinstance(result, dict) else result
        if expected is None:
            if reason is not None:
                gaps.append(f"{case['id']}: expected no suppression, got {reason!r}")
            continue
        if reason != expected:
            gaps.append(f"{case['id']}: expected {expected!r} suppression, got {reason!r}")
        elif reason not in SUPPRESSION_REASONS:
            gaps.append(f"{case['id']}: reason {reason!r} is outside the declared set")
        elif not isinstance(result, dict) or "until" not in result or "by" not in result:
            gaps.append(
                f"{case['id']}: a suppressed decision must say until when and by whom; "
                '"quiet" without a reason is exactly the defect shelving shipped'
            )

    # The bound, enforced server-side. The browser will offer only durations
    # within it, but that check is UX.
    refuse = getattr(alarm_engine, "refuse_shelve", None)
    if refuse is None:
        gaps.append("alarm_engine has no refuse_shelve(); the shelving maximum is unenforced")
    else:
        over_long = next(c for c in suppression_cases(now) if c.get("expected_refusal"))
        code = refuse(over_long["shelved_until"], now=now, settings=settings)
        if code != over_long["expected_refusal"]:
            gaps.append(
                f"a shelf beyond {DEFAULT_SHELVING_MAXIMUM_DAYS} days must be refused with "
                f"{over_long['expected_refusal']!r}, got {code!r}"
            )
        if refuse(None, now=now, settings=settings) is not None:
            gaps.append("an absent expiry must not be refused as over-long")

    return gaps


async def test_expected_red_phase6_suppression(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Shelving, maintenance and acknowledgement suppress, and say which applied."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, cases=len(suppression_cases(
        datetime(2026, 9, 2, 12, 0, tzinfo=ZoneInfo(SITE_TIMEZONE))
    )))

    report(RED_MARKER, suppression_gaps(),
           "suppression consulted at the point of decision is unavailable")


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------

NOW = datetime(2026, 9, 2, 12, 0, tzinfo=ZoneInfo(SITE_TIMEZONE))
SETTINGS = {"shelving_maximum_days": DEFAULT_SHELVING_MAXIMUM_DAYS}


def _suppression(case: dict[str, Any]) -> Any:
    from custom_components.glt_flow_card import alarm_engine

    return alarm_engine.suppression_for(case, state="on", now=NOW, settings=SETTINGS)


def test_a_shelved_alarm_is_suppressed_and_says_by_whom_and_until_when() -> None:
    """D1, closed. Asserted on the *effect*, never on the field being set."""
    case = next(c for c in suppression_cases(NOW) if c["id"] == "alarm-shelved")
    result = _suppression(case)
    assert result is not None
    assert result["reason"] == "shelved"
    assert result["by"] == "anna"
    assert result["until"], "a shelf with no expiry is a shelf nobody can plan around"


def test_an_expired_shelf_stops_suppressing_without_operator_action() -> None:
    """The case that separates 'implemented' from 'stored': a field nobody
    re-reads never expires."""
    case = next(c for c in suppression_cases(NOW) if c["id"] == "alarm-shelf-expired")
    assert _suppression(case) is None


def test_maintenance_and_acknowledgement_each_suppress_with_their_own_reason() -> None:
    for identifier, expected in (
        ("alarm-maintenance", "maintenance"),
        ("alarm-acknowledged", "acknowledged"),
    ):
        case = next(c for c in suppression_cases(NOW) if c["id"] == identifier)
        result = _suppression(case)
        assert result is not None and result["reason"] == expected, identifier


def test_every_reason_is_a_declared_member() -> None:
    for case in suppression_cases(NOW):
        result = _suppression(case)
        if result is not None:
            assert result["reason"] in SUPPRESSION_REASONS, case["id"]


def test_maintenance_outranks_a_shelf_and_a_shelf_outranks_an_acknowledgement() -> None:
    """Precedence is deliberate and asserted, not incidental to dict order.

    Maintenance is the plant's state and outranks an individual's shelf; a shelf
    outranks an acknowledgement because a shelf was chosen with an expiry and an
    acknowledgement only says "seen".
    """
    from datetime import timedelta

    both = {
        "id": "a",
        "maintenance": True,
        "shelved_until": (NOW + timedelta(days=1)).isoformat(),
        "acknowledged": True,
    }
    assert _suppression(both)["reason"] == "maintenance"
    assert _suppression({**both, "maintenance": False})["reason"] == "shelved"
    assert _suppression({"id": "a", "acknowledged": True})["reason"] == "acknowledged"


def test_a_malformed_expiry_does_not_suppress_forever() -> None:
    """The failure mode that keeps an alarm quiet indefinitely."""
    assert _suppression({"id": "a", "shelved_until": "irgendwann"}) is None


def test_a_shelf_beyond_the_site_maximum_is_refused_with_a_reason() -> None:
    from datetime import timedelta

    from custom_components.glt_flow_card import alarm_engine

    over = NOW + timedelta(days=DEFAULT_SHELVING_MAXIMUM_DAYS + 1)
    assert alarm_engine.refuse_shelve(over, now=NOW, settings=SETTINGS) == "shelve_exceeds_maximum"
    within = NOW + timedelta(days=DEFAULT_SHELVING_MAXIMUM_DAYS - 1)
    assert alarm_engine.refuse_shelve(within, now=NOW, settings=SETTINGS) is None
    assert alarm_engine.refuse_shelve(None, now=NOW, settings=SETTINGS) is None
    assert alarm_engine.refuse_shelve("tee", now=NOW, settings=SETTINGS) == "shelve_malformed"


def test_the_maximum_is_configuration_and_the_default_is_the_documented_one() -> None:
    """The philosophy is the site's. Only the default is ours."""
    from datetime import timedelta

    from custom_components.glt_flow_card import alarm_engine

    assert alarm_engine.DEFAULT_SHELVING_MAXIMUM_DAYS == 7
    thirty = NOW + timedelta(days=30)
    assert alarm_engine.refuse_shelve(thirty, now=NOW, settings=SETTINGS) is not None
    assert alarm_engine.refuse_shelve(
        thirty, now=NOW, settings={"shelving_maximum_days": 90},
    ) is None


async def test_the_route_refuses_rather_than_clamping(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """A clamp is a worse answer than a refusal.

    The previous implementation was `min(int(minutes), 10080)`, so a request for
    ninety days became seven and the operator was never told -- they walk away
    believing the alarm is quiet for three months.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, alarm_engine

    manager = _manager(hass)
    with pytest.raises(ValueError) as raised:
        await manager.shelve_alarm("p", "a", 90 * 24 * 60, "anna")
    assert str(raised.value) in alarm_engine.SHELVE_REFUSALS
    assert manager.data["alarm_state"].get("p:a") is None, "a refused shelve wrote state"


async def test_a_permitted_shelve_writes_an_audit_row(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """D13, closed. Acknowledgement audited and shelving did not, which made the
    less reversible of the two the less auditable."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    await manager.shelve_alarm("p", "a", 60, "anna")
    transitions = [row.get("transition") for row in manager.data["alarm_history"]]
    assert "shelve" in transitions


async def test_a_suppressed_alarm_neither_processes_nor_notifies(
    hass: HomeAssistant, config_entry: MockConfigEntry, lifecycle_effects: LifecycleEffects,
) -> None:
    """The end-to-end claim: shelving makes the alarm quiet, not just marked."""
    from datetime import timedelta as _timedelta

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    alarm = {"id": "alm", "entity": "binary_sensor.pumpe_stoerung", "active_states": ["on"],
             "priority": "critical",
             "notification": {"service": "glt_fake_notify.send"}}
    manager.data["projects"]["p"] = {"id": "p", "config": {"alarms": [alarm], "schedules": []}}
    manager.data["alarm_state"]["p:alm"] = {
        "project_id": "p", "alarm_id": "alm", "active": False,
        "shelved_until": (datetime.now(tz=NOW.tzinfo) + _timedelta(days=1)).isoformat(),
        "shelved_by": "anna",
    }

    hass.states.async_set("binary_sensor.pumpe_stoerung", "on")
    await hass.async_block_till_done()

    # `lifecycle_effects` blocks every live service call, so a notification here
    # would already have failed loudly. The claim under test is stronger: the
    # alarm did not transition either.
    state = manager.data["alarm_state"]["p:alm"]
    assert state.get("active") is not True, "a shelved alarm still went active"
    assert state.get("suppressed_by") == "shelved"
    assert lifecycle_effects.snapshot()["service_attempts"] == 0
