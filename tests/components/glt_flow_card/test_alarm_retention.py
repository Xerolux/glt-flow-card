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
    # Deselected from the default suite for the length of the RED wave. The
    # Phase-6 RED gate selects them explicitly and requires each to fail for
    # exactly its own named reason. Removed when the sentinel goes GREEN.
    pytest.mark.expected_red,
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
