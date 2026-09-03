"""Retained state is bounded and reconciled (T6-16).

Three defects, all of the same shape -- something grows or lingers because the
code that was meant to bound it does not:

**D8 -- `schedule_runs` is never pruned.** The cutoff compares
`k.split(":")[-1][:10]` against a date, but `run_key` is
`f"{project_id}:{sched_id}:{key_minute}"` and `key_minute` itself contains a
colon. Executed: the last segment is `"30"`, and `"30" >= "2026-08-19"` is
lexicographically true forever.

**D9 -- `ack_alarm` does not trim history.** `alarm_transition` caps at
`MAX_AUDIT`; `ack_alarm` inserts with no cap, so acknowledgement is the
unbounded path.

**D14 -- alarm state is never reconciled.** `alarm_state` is keyed
`f"{project_id}:{alarm_id}"` and nothing reconciles it, so a deleted or remapped
alarm leaves an entry no project can clear and no UI can show.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase6-retention]: "
    "bounded retention and alarm state reconciliation are unavailable"
)
EFFECT_PREFIX = "PHASE6_RETENTION_EFFECTS "


def legacy_prune_drops_nothing() -> bool:
    """Execute the current prune and report whether it drops anything.

    Reproduced rather than described, so the claim is measured. A key from
    fifteen months ago must survive a fourteen-day window for this to be true.
    """
    old = datetime(2025, 6, 1, 14, 30, tzinfo=timezone.utc)
    run_key = f"plant-a:sched-1:{old.strftime('%Y-%m-%dT%H:%M')}"
    runs = {run_key: old.isoformat()}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
    kept = {k: v for k, v in runs.items() if k.split(":")[-1][:10] >= cutoff}
    return kept == runs


def retention_gaps() -> list[str]:
    """Return every retention behaviour the Companion does not yet have."""
    gaps: list[str] = []

    if not legacy_prune_drops_nothing():
        gaps.append(
            "the reproduced legacy prune dropped an entry, so this test is no "
            "longer measuring the defect it was written for"
        )

    try:
        from custom_components.glt_flow_card import alarm_engine
    except ImportError:
        return gaps + ["there is no alarm_engine module, so nothing bounds retention from one place"]

    prune = getattr(alarm_engine, "prune_schedule_runs", None)
    if prune is None:
        gaps.append(
            "alarm_engine has no prune_schedule_runs(); the current prune never "
            "drops an entry because it parses a date out of a composite key"
        )
    else:
        old = datetime(2025, 6, 1, 14, 30, tzinfo=timezone.utc)
        runs = {"plant-a:sched-1:old": old.isoformat()}
        if prune(dict(runs), retention_days=14, now=datetime.now(timezone.utc)):
            gaps.append("the prune kept an entry fifteen months past a fourteen-day window")

    append = getattr(alarm_engine, "append_history", None)
    if append is None:
        gaps.append(
            "alarm_engine has no append_history(); every insertion must go through "
            "one bounded function or the next writer forgets the cap, which is D9"
        )
    else:
        history: list[dict[str, Any]] = []
        for index in range(50):
            history = append(history, {"n": index}, bound=10)
        if len(history) != 10:
            gaps.append(f"history must stay bounded at 10, grew to {len(history)}")
        elif history[0].get("n") != 49:
            gaps.append("the oldest entry must be the one dropped")

    reconcile = getattr(alarm_engine, "reconcile_alarm_state", None)
    if reconcile is None:
        gaps.append(
            "alarm_engine has no reconcile_alarm_state(); a deleted or remapped "
            "alarm leaves a permanent entry no project can clear"
        )
    else:
        state = {"plant-a:gone": {"active": True}, "plant-a:kept": {"active": True}}
        projects = {"plant-a": {"id": "plant-a", "config": {"alarms": [{"id": "kept"}]}}}
        result = reconcile(dict(state), projects)
        kept = result.get("state") if isinstance(result, dict) and "state" in result else result
        if set(kept or {}) != {"plant-a:kept"}:
            gaps.append(f"reconciliation left {sorted(kept or {})}, expected only plant-a:kept")
        if isinstance(result, dict) and "dropped" not in result:
            gaps.append("reconciliation must record what it dropped rather than dropping silently")

    return gaps


async def test_expected_red_phase6_retention(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """History, schedule runs and alarm state are bounded and reconciled."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects,
                 legacy_prune_drops_nothing=legacy_prune_drops_nothing())

    report(RED_MARKER, retention_gaps(),
           "bounded retention and alarm state reconciliation are unavailable")


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------

NOW = datetime(2026, 9, 2, 12, 0, tzinfo=timezone.utc)


def test_the_prune_actually_drops_entries() -> None:
    """D8, closed, and measured against the defect it replaces.

    `legacy_prune_drops_nothing()` above still returns True, so this is not
    comparing the fix against a straw man.
    """
    from custom_components.glt_flow_card import alarm_engine

    old = NOW - timedelta(days=40)
    recent = NOW - timedelta(days=1)
    runs = {
        "plant-a:sched-1:old": old.isoformat(),
        "plant-a:sched-1:recent": recent.isoformat(),
    }
    assert legacy_prune_drops_nothing(), "the reproduced defect no longer holds"
    kept = alarm_engine.prune_schedule_runs(runs, retention_days=14, now=NOW)
    assert set(kept) == {"plant-a:sched-1:recent"}


def test_no_date_is_derived_by_splitting_a_composite_key() -> None:
    """The key that had to be parsed to be understood was parsed wrongly.

    A run key whose id segments contain colons -- which is what broke the
    original -- must not confuse the prune at all, because the prune never looks
    at the key.
    """
    from custom_components.glt_flow_card import alarm_engine

    awkward = "plant:a:sched:1:2025-06-01T14:30"
    runs = {awkward: (NOW - timedelta(days=40)).isoformat()}
    assert alarm_engine.prune_schedule_runs(runs, retention_days=14, now=NOW) == {}


def test_an_unreadable_receipt_is_dropped_rather_than_kept_forever() -> None:
    from custom_components.glt_flow_card import alarm_engine

    runs = {"plant-a:s:x": "irgendwann", "plant-a:s:y": NOW.isoformat()}
    assert set(alarm_engine.prune_schedule_runs(runs, retention_days=14, now=NOW)) == {
        "plant-a:s:y"
    }


def test_the_retention_window_is_configuration() -> None:
    from custom_components.glt_flow_card import alarm_engine

    assert alarm_engine.DEFAULT_SCHEDULE_RUN_RETENTION_DAYS == 14
    runs = {"k": (NOW - timedelta(days=40)).isoformat()}
    assert alarm_engine.prune_schedule_runs(runs, retention_days=14, now=NOW) == {}
    assert alarm_engine.prune_schedule_runs(runs, retention_days=90, now=NOW) == runs


def test_history_stays_bounded_and_drops_the_oldest() -> None:
    from custom_components.glt_flow_card import alarm_engine

    history: list[dict[str, Any]] = []
    for index in range(50):
        history = alarm_engine.append_history(history, {"n": index}, bound=10)
    assert len(history) == 10
    assert history[0]["n"] == 49, "the newest row must be first"
    assert history[-1]["n"] == 40, "the oldest rows must be the ones dropped"


async def test_every_history_writer_goes_through_the_bounded_path(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """D9, closed. Acknowledgement was the unbounded writer.

    Asserted by *exercising* all three paths past the bound, not by reading the
    source: a fourth writer added later fails this the same way.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    # A small configured bound, not the 5000-row default. The claim is that
    # every writer respects *the* bound; proving it at 5000 rows across three
    # writers means fifteen thousand store writes to learn the same thing.
    manager.effective_options = {**manager.effective_options, "alarm_history_bound": 5}
    bound = manager.alarm_settings()["history_bound"]
    assert bound == 5

    for index in range(bound + 3):
        await manager.ack_alarm("p", f"alm-{index}", "u", "anna", "seen")
    assert len(manager.data["alarm_history"]) == bound, "ack is the unbounded writer"

    for index in range(bound + 3):
        await manager.shelve_alarm("p", f"alm-{index}", 60, "anna")
    assert len(manager.data["alarm_history"]) == bound, "shelve is unbounded"

    alarm = {"id": "alm", "entity": "binary_sensor.x", "active_states": ["on"]}
    for index in range(bound + 3):
        await manager.alarm_transition("p", alarm, index % 2 == 0, "on")
    assert len(manager.data["alarm_history"]) == bound, "transition is unbounded"


def test_reconciliation_drops_an_orphan_and_records_it() -> None:
    """D14, closed. A remapped or deleted alarm left a permanent entry."""
    from custom_components.glt_flow_card import alarm_engine

    state = {"plant-a:gone": {"active": True}, "plant-a:kept": {"active": True}}
    projects = {"plant-a": {"id": "plant-a", "config": {"alarms": [{"id": "kept"}]}}}
    result = alarm_engine.reconcile_alarm_state(state, projects)
    assert set(result["state"]) == {"plant-a:kept"}
    assert result["dropped"] == ["plant-a:gone"]


def test_a_deleted_project_takes_its_alarm_state_with_it() -> None:
    from custom_components.glt_flow_card import alarm_engine

    state = {"plant-a:alm": {"active": True}}
    assert alarm_engine.reconcile_alarm_state(state, {})["dropped"] == ["plant-a:alm"]


async def test_reconciliation_runs_from_the_same_place_as_the_index(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """Both answer 'which alarms exist', and two places asking it disagree."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    manager.data["projects"]["p"] = {
        "id": "p",
        "config": {"alarms": [{"id": "kept", "entity": "binary_sensor.x",
                               "active_states": ["on"]}], "schedules": []},
    }
    manager.data["alarm_state"]["p:gone"] = {"project_id": "p", "alarm_id": "gone",
                                             "active": True}
    manager.data["alarm_state"]["p:kept"] = {"project_id": "p", "alarm_id": "kept",
                                             "active": True}

    manager.async_refresh_alarm_subscription()

    assert set(manager.data["alarm_state"]) == {"p:kept"}
    transitions = [row.get("transition") for row in manager.data["alarm_history"]]
    assert "reconciled" in transitions, "the orphan was dropped without a record"
