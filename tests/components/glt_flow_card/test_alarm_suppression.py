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
    # Deselected from the default suite for the length of the RED wave. The
    # Phase-6 RED gate selects them explicitly and requires each to fail for
    # exactly its own named reason. Removed when the sentinel goes GREEN.
    pytest.mark.expected_red,
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
