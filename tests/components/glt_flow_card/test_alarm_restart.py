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


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------

PROJECT_ID = "restart-plant"
ENTITY = "binary_sensor.pumpe_stoerung"


def _alarm() -> dict[str, Any]:
    return {
        "id": "alm",
        "name": "Pumpe Störung",
        "entity": ENTITY,
        "active_states": ["on"],
        "priority": "critical",
    }


async def _load(hass: HomeAssistant, config_entry: MockConfigEntry) -> Any:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    manager.data["projects"][PROJECT_ID] = {
        "id": PROJECT_ID, "config": {"alarms": [_alarm()], "schedules": []},
    }
    return manager


def test_a_startup_grace_is_closed_before_the_started_event_arrives() -> None:
    """An absent start time must not open the guard.

    The obvious implementation -- `if started_at and now < started_at + grace` --
    reads a missing start as "grace over", which is the exact moment the guard
    was needed.
    """
    from datetime import datetime, timedelta, timezone

    from custom_components.glt_flow_card import alarm_engine

    now = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)
    assert alarm_engine.startup_grace_active(started_at=None, now=now) is True
    assert alarm_engine.startup_grace_active(started_at=now, now=now) is True
    assert alarm_engine.startup_grace_active(
        started_at=now - timedelta(seconds=1), now=now,
    ) is True
    assert alarm_engine.startup_grace_active(
        started_at=now - timedelta(seconds=3600), now=now,
    ) is False


def test_the_grace_is_configuration_with_a_conservative_default() -> None:
    from datetime import datetime, timedelta, timezone

    from custom_components.glt_flow_card import alarm_engine

    assert alarm_engine.DEFAULT_STARTUP_GRACE_SECONDS == 60
    now = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)
    started = now - timedelta(seconds=120)
    assert alarm_engine.startup_grace_active(started_at=started, now=now) is False
    assert alarm_engine.startup_grace_active(
        started_at=started, now=now, settings={"startup_grace_seconds": 600},
    ) is True


def test_a_pending_delay_is_rearmed_against_its_anchor_not_from_zero() -> None:
    """A restart must not silently extend every delay in the installation."""
    from custom_components.glt_flow_card import alarm_engine

    rearmed = alarm_engine.rearm_pending_delays(
        [{"alarm_id": "a", "anchor_age_seconds": 240, "delay_seconds": 300}]
    )
    assert rearmed[0]["fires_in_seconds"] == 60


def test_a_delay_that_elapsed_while_the_process_was_down_fires_at_once() -> None:
    """Not skipped. The condition was true for longer than the delay asked for."""
    from custom_components.glt_flow_card import alarm_engine

    rearmed = alarm_engine.rearm_pending_delays(
        [{"alarm_id": "a", "anchor_age_seconds": 9000, "delay_seconds": 300}]
    )
    assert rearmed[0]["fires_in_seconds"] == 0


def test_pending_delays_are_read_from_persisted_state() -> None:
    """The in-memory task registry is exactly what did not survive."""
    from datetime import datetime, timedelta, timezone

    from custom_components.glt_flow_card import alarm_engine

    now = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)
    state = {
        f"{PROJECT_ID}:alm": {
            "project_id": PROJECT_ID, "alarm_id": "alm", "active": False,
            "delay_anchor": (now - timedelta(seconds=100)).isoformat(),
            "delay_seconds": 300,
        },
        f"{PROJECT_ID}:already-active": {
            "project_id": PROJECT_ID, "alarm_id": "already-active", "active": True,
            "delay_anchor": (now - timedelta(seconds=100)).isoformat(),
            "delay_seconds": 300,
        },
        f"{PROJECT_ID}:no-delay": {
            "project_id": PROJECT_ID, "alarm_id": "no-delay", "active": False,
        },
    }
    pending = alarm_engine.pending_from_state(state, now=now)
    assert [entry["alarm_id"] for entry in pending] == ["alm"]
    assert pending[0]["fires_in_seconds"] == 200


async def test_a_real_restart_does_not_re_notify_un_acknowledge_or_un_shelve(
    hass: HomeAssistant, config_entry: MockConfigEntry, lifecycle_effects: LifecycleEffects,
) -> None:
    """D5, closed, by restarting -- not by asserting that a guard exists.

    The sequence the audit traced: persisted `active=True`, entity to
    `unavailable`, the clear path writes `cleared` and pops `shelved_until`, the
    entity returns with the same value, and the alarm notifies again.
    """
    from datetime import datetime, timedelta, timezone

    manager = await _load(hass, config_entry)
    shelf = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    manager.data["alarm_state"][f"{PROJECT_ID}:alm"] = {
        "project_id": PROJECT_ID, "alarm_id": "alm", "active": True,
        "acknowledged": True, "ack_user_name": "anna",
        "shelved_until": shelf, "shelved_by": "anna",
    }
    # Past the grace, so the run is not passing merely because everything is
    # suppressed.
    manager._started_at = datetime.now(timezone.utc) - timedelta(hours=1)

    hass.states.async_set(ENTITY, "unavailable")
    await hass.async_block_till_done()

    state = manager.data["alarm_state"][f"{PROJECT_ID}:alm"]
    assert state["active"] is True, "an unavailable entity cleared the alarm"
    assert state["acknowledged"] is True, "a restart un-acknowledged the alarm"
    assert state["shelved_until"] == shelf, "a restart un-shelved the alarm"

    hass.states.async_set(ENTITY, "on")
    await hass.async_block_till_done()
    assert lifecycle_effects.snapshot()["service_attempts"] == 0, "the restart re-notified"


async def test_the_grace_withholds_the_transition_but_not_the_value(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """Nothing is lost during the grace; only the transition is withheld."""
    manager = await _load(hass, config_entry)
    manager._started_at = None

    hass.states.async_set(ENTITY, "on")
    await hass.async_block_till_done()

    state = manager.data["alarm_state"].get(f"{PROJECT_ID}:alm") or {}
    assert state.get("active") is not True, "a transition escaped the startup grace"
    assert state.get("last_value") == "on", "the value was discarded, not just withheld"


async def test_a_reload_inside_a_running_home_assistant_lifts_the_grace(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """Otherwise the guard is a permanent mute.

    `homeassistant_started` fires once per process. An entry reloaded inside an
    already-running instance never sees it again, so a guard that waits for the
    event would leave that installation with no alarms at all.
    """
    manager = await _load(hass, config_entry)
    assert manager._started_at is not None, (
        "the entry loaded into a running Home Assistant and never left the grace"
    )
