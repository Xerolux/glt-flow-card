"""A restart is invisible to acknowledged and shelved alarms (T6-04).

D5: one restart re-notifies, un-acknowledges and un-shelves every active alarm.
The sequence the audit traced: `alarm_state` is persisted, but on restart
entities pass through `unavailable`, which `_state_active` classifies as
inactive; the clear path then writes `cleared`, sets `acknowledged=False` and
**pops** `shelved_until`; the entity returns with the same real value; and the
alarm annunciates and notifies again.

The test that matters here **restarts**. A test that asserts a guard exists
proves the guard exists, which is not the claim.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.alarm_vocabulary import ALARM_STATES

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
    "EXPECTED_RED[phase6-restart]: restart-safe alarm state is unavailable"
)
EFFECT_PREFIX = "PHASE6_RESTART_EFFECTS "


def restart_gaps() -> list[str]:
    """Return every restart behaviour the Companion does not yet have."""
    gaps: list[str] = []

    try:
        from custom_components.glt_flow_card import alarm_engine
    except ImportError:
        return ["there is no alarm_engine module, so unavailability cannot be told from a clear"]

    # `indeterminate` is the whole fix. An entity that vanished has not returned
    # to normal -- nobody knows what it is doing, and "cleared" is the one
    # answer that is certainly wrong.
    if "indeterminate" not in ALARM_STATES:
        gaps.append("the declared states carry no `indeterminate`")

    classify = getattr(alarm_engine, "classify_state", None)
    if classify is None:
        gaps.append(
            "alarm_engine has no classify_state(); `unavailable` and `unknown` "
            "must produce a third answer rather than a clear"
        )
    else:
        alarm = {"id": "a", "active_states": ["on"]}
        for raw in ("unavailable", "unknown", None, ""):
            if classify(raw, alarm) != "indeterminate":
                gaps.append(f"state {raw!r} must classify as indeterminate, not as inactive")
        if classify("on", alarm) != "active":
            gaps.append("a genuinely active state must still classify as active")
        if classify("off", alarm) != "inactive":
            gaps.append("a genuinely inactive state must still classify as inactive")

    for name, why in (
        ("startup_grace_active", "state settling during boot must emit no transition"),
        ("rearm_pending_delays", "a delay pending at shutdown is lost today and never fires"),
    ):
        if not hasattr(alarm_engine, name):
            gaps.append(f"alarm_engine has no {name}(): {why}")

    rearm = getattr(alarm_engine, "rearm_pending_delays", None)
    if rearm is not None:
        # A four-minute-old five-minute delay must fire in one minute, not five.
        pending = [{"alarm_id": "a", "anchor_age_seconds": 240, "delay_seconds": 300}]
        rearmed = rearm(pending)
        remaining = (rearmed or [{}])[0].get("fires_in_seconds")
        if remaining != 60:
            gaps.append(
                f"a pending delay must be re-armed against its persisted anchor "
                f"(expected 60s remaining, got {remaining!r}), not restarted from zero"
            )

    return gaps


async def test_expected_red_phase6_restart(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """A restart re-notifies nothing, un-acknowledges nothing, un-shelves nothing."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, states=len(ALARM_STATES))

    report(RED_MARKER, restart_gaps(), "restart-safe alarm state is unavailable")
