"""Schedules resolve to instants, not wall-clock strings (T6-11).

Measured against the vendored Home Assistant 2026.2.3 for `Europe/Berlin`, and
recorded in `06-RESEARCH.md` §4:

**Spring forward, 2027-03-28.** Consecutive ticks run
`01:59+01:00 -> 03:00+02:00`. The wall-clock minutes 02:00-02:59 are never
delivered, so a 02:30 night setback -- an ordinary time on a German heating
plant -- is silently skipped, with no run recorded and nothing surfaced.

**Fall back, 2027-10-31.** Every ambiguous minute is delivered **twice**, with
different offsets, and both produce the identical `run_key` because
`%Y-%m-%dT%H:%M` discards the offset. The second execution is therefore
suppressed by the deduplication cache, not by the schedule logic. That is luck,
and D8 destroys it: `schedule_runs` is never pruned today only because its
cutoff comparison is broken.

The fall-back test therefore runs **with the dedupe cache disabled**. A test
that leaves it on proves nothing.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .alarm_factory import FALL_BACK, SITE_TIMEZONE, SPRING_FORWARD, TRANSITION_TIME, dst_schedules
from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
    pytest.mark.expected_red,
]

RED_MARKER = (
    "EXPECTED_RED[phase6-schedule-dst]: "
    "schedules resolved to instants across DST are unavailable"
)
EFFECT_PREFIX = "PHASE6_SCHEDULE_EFFECTS "


def dst_gaps() -> list[str]:
    """Return every resolution behaviour the Companion does not yet have."""
    gaps: list[str] = []

    try:
        from custom_components.glt_flow_card import schedule_time
    except ImportError:
        return [
            "there is no schedule_time module; the runner compares "
            "now.strftime('%H:%M') against a stored string, which skips the lost "
            "hour outright and is saved from double-firing only by a fold-blind key"
        ]

    exists = getattr(schedule_time, "local_time_exists", None)
    ambiguous = getattr(schedule_time, "local_time_ambiguous", None)
    if exists is None or ambiguous is None:
        gaps.append(
            "schedule_time has no local_time_exists()/local_time_ambiguous(); "
            "these are the two predicates an engineer cannot derive from an HH:MM field"
        )
    else:
        if exists(SPRING_FORWARD, TRANSITION_TIME, SITE_TIMEZONE):
            gaps.append(f"{TRANSITION_TIME} must not exist on {SPRING_FORWARD}")
        if not ambiguous(FALL_BACK, TRANSITION_TIME, SITE_TIMEZONE):
            gaps.append(f"{TRANSITION_TIME} must be ambiguous on {FALL_BACK}")
        if not exists("2027-06-15", TRANSITION_TIME, SITE_TIMEZONE):
            gaps.append("an ordinary day must exist; a resolver that answers no to "
                        "everything would otherwise pass")
        if ambiguous("2027-06-15", TRANSITION_TIME, SITE_TIMEZONE):
            gaps.append("an ordinary day must not be ambiguous")

        # Agreement with the vendored Home Assistant's own private predicates,
        # which are the right semantics but underscore-prefixed and free to
        # vanish in a minor release -- hence our own implementation.
        from homeassistant.util import dt as ha_dt

        zone = ZoneInfo(SITE_TIMEZONE)
        for date in (SPRING_FORWARD, FALL_BACK, "2027-06-15"):
            year, month, day = (int(part) for part in date.split("-"))
            hour, minute = (int(part) for part in TRANSITION_TIME.split(":"))
            moment = datetime(year, month, day, hour, minute, tzinfo=zone)
            if exists(date, TRANSITION_TIME, SITE_TIMEZONE) != ha_dt._datetime_exists(moment):
                gaps.append(f"local_time_exists disagrees with Home Assistant on {date}")
            if ambiguous(date, TRANSITION_TIME, SITE_TIMEZONE) != ha_dt._datetime_ambiguous(moment):
                gaps.append(f"local_time_ambiguous disagrees with Home Assistant on {date}")

    resolve = getattr(schedule_time, "resolve_entry", None)
    if resolve is None:
        gaps.append("schedule_time has no resolve_entry(); nothing turns an entry into instants")
        return gaps

    for entry in dst_schedules():
        result = resolve(entry, entry["on_date"], SITE_TIMEZONE)
        status = (result or {}).get("status")
        if status != entry["expected_status"]:
            gaps.append(
                f"{entry['id']} on {entry['on_date']}: expected status "
                f"{entry['expected_status']!r}, got {status!r}"
            )
            continue
        instants = (result or {}).get("instants")
        if instants is None:
            gaps.append(f"{entry['id']}: a resolution must carry instants, even an empty list")
        elif status == "nonexistent" and instants:
            gaps.append(
                f"{entry['id']}: a nonexistent time must return a status, never a silent "
                "empty result that reads as 'nothing scheduled'"
            )
        elif status == "ambiguous" and len(result.get("candidates") or []) != 2:
            gaps.append(f"{entry['id']}: an ambiguous time must return both candidate instants")
        if status == "ambiguous" and len(instants or []) != entry["expected_runs"]:
            gaps.append(
                f"{entry['id']}: must run exactly {entry['expected_runs']} time(s), "
                f"got {len(instants or [])} -- and by the resolution, not by the dedupe cache"
            )

    key = getattr(schedule_time, "run_key", None)
    if key is None:
        gaps.append("schedule_time has no run_key(); the dedupe key must carry the resolved instant")
    else:
        # The two fall-back deliveries differ only in offset. A fold-blind key
        # collapses them, which is what makes today's single execution luck.
        first = key("p", "s", "2027-10-31T02:30:00+02:00")
        second = key("p", "s", "2027-10-31T02:30:00+01:00")
        if first == second:
            gaps.append(
                "the run key collapses the two fall-back instants, so correctness "
                "rests on the cache rather than on the resolution"
            )

    return gaps


async def test_expected_red_phase6_schedule_dst(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Both transitions resolve to a declared answer, not to silence."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, schedules=len(dst_schedules()))

    report(RED_MARKER, dst_gaps(), "schedules resolved to instants across DST are unavailable")
