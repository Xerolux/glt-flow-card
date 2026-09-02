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

from datetime import datetime, timedelta, timezone
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


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------


def test_the_predicates_agree_with_home_assistants_own() -> None:
    """HA's `_datetime_exists`/`_datetime_ambiguous` are the right semantics.

    They are underscore-prefixed and free to vanish in a minor release, so they
    are implemented rather than imported -- and this is the check that says when
    they change.
    """
    from homeassistant.util import dt as ha_dt

    from custom_components.glt_flow_card import schedule_time as st

    zone = ZoneInfo(SITE_TIMEZONE)
    hour, minute = (int(part) for part in TRANSITION_TIME.split(":"))
    for date in (SPRING_FORWARD, FALL_BACK, "2027-06-15"):
        year, month, day = (int(part) for part in date.split("-"))
        moment = datetime(year, month, day, hour, minute, tzinfo=zone)
        assert st.local_time_exists(date, TRANSITION_TIME, SITE_TIMEZONE) == (
            ha_dt._datetime_exists(moment)
        ), date
        assert st.local_time_ambiguous(date, TRANSITION_TIME, SITE_TIMEZONE) == (
            ha_dt._datetime_ambiguous(moment)
        ), date


def test_every_corpus_entry_reaches_its_declared_status() -> None:
    from custom_components.glt_flow_card import schedule_time as st

    for entry in dst_schedules():
        if entry.get("kind") == "interval":
            continue
        resolution = st.resolve_entry(entry, entry["on_date"], SITE_TIMEZONE)
        assert resolution["status"] == entry["expected_status"], entry["id"]


def test_a_nonexistent_time_returns_a_status_not_silence() -> None:
    """An empty list with status `normal` reads as "nothing scheduled".

    That is exactly how the defect hid: the minute never arrived, the equality
    never held, and nothing recorded that anything had been missed.
    """
    from custom_components.glt_flow_card import schedule_time as st

    resolution = st.resolve_entry(
        {"time": TRANSITION_TIME}, SPRING_FORWARD, SITE_TIMEZONE,
    )
    assert resolution["status"] == "nonexistent"
    assert resolution["instants"] == []
    assert resolution["policy"] == "skip"


def test_the_nonexistent_policy_walks_the_wall_clock() -> None:
    """`after` must land on 03:00, not an hour past it.

    Shifting the UTC instant instead lands at 04:31 local, because that instant
    is already on the far side of the gap.
    """
    from custom_components.glt_flow_card import schedule_time as st

    zone = ZoneInfo(SITE_TIMEZONE)
    after = st.resolve_entry(
        {"time": TRANSITION_TIME}, SPRING_FORWARD, SITE_TIMEZONE, nonexistent="after",
    )
    before = st.resolve_entry(
        {"time": TRANSITION_TIME}, SPRING_FORWARD, SITE_TIMEZONE, nonexistent="before",
    )
    local = lambda text: datetime.fromisoformat(  # noqa: E731
        text.replace("Z", "+00:00")
    ).astimezone(zone).strftime("%H:%M")
    assert local(after["instants"][0]) == "03:00"
    assert local(before["instants"][0]) == "01:59"


def test_an_ambiguous_time_returns_both_candidates_and_the_configured_choice() -> None:
    from custom_components.glt_flow_card import schedule_time as st

    resolution = st.resolve_entry({"time": TRANSITION_TIME}, FALL_BACK, SITE_TIMEZONE)
    assert resolution["status"] == "ambiguous"
    assert len(resolution["candidates"]) == 2
    assert len(resolution["instants"]) == 1
    assert resolution["instants"][0] == resolution["candidates"][0]

    both = st.resolve_entry(
        {"time": TRANSITION_TIME}, FALL_BACK, SITE_TIMEZONE, ambiguous="both",
    )
    assert both["instants"] == both["candidates"]


def test_the_two_fall_back_occurrences_have_different_run_keys() -> None:
    """This is what moves correctness out of the dedupe cache.

    The previous key collapsed them, and that collapse was the only thing
    preventing a double fire -- so D8's prune fix would have reintroduced one.
    """
    from custom_components.glt_flow_card import schedule_time as st

    resolution = st.resolve_entry(
        {"time": TRANSITION_TIME}, FALL_BACK, SITE_TIMEZONE, ambiguous="both",
    )
    keys = {st.run_key("p", "s", instant) for instant in resolution["instants"]}
    assert len(keys) == 2

    # And the key the defect used, reproduced, collapsing them.
    legacy = {
        datetime.fromisoformat(i.replace("Z", "+00:00"))
        .astimezone(ZoneInfo(SITE_TIMEZONE)).strftime("p:s:%Y-%m-%dT%H:%M")
        for i in resolution["instants"]
    }
    assert len(legacy) == 1, "the reproduced legacy key no longer collapses them"


def test_a_fall_back_entry_runs_once_with_the_dedupe_cache_disabled() -> None:
    """The claim that matters, tested without the cache that was hiding it."""
    from custom_components.glt_flow_card import schedule_time as st

    zone = ZoneInfo(SITE_TIMEZONE)
    entry = {"id": "s", "time": TRANSITION_TIME, "days": [0, 1, 2, 3, 4, 5, 6]}
    year, month, day = (int(part) for part in FALL_BACK.split("-"))

    # Walk every minute of the transition in real time, with no run cache at
    # all, and count how often the entry comes due.
    start = datetime(year, month, day, 0, 0, tzinfo=timezone.utc)
    due: list[str] = []
    for step in range(4 * 60):
        moment = start + timedelta(minutes=step)
        due.extend(st.due_instants(entry, now=moment, zone=SITE_TIMEZONE))
    assert len(due) == 1, f"ran {len(due)} times across the ambiguous hour: {due}"
    assert datetime.fromisoformat(due[0].replace("Z", "+00:00")).astimezone(
        zone
    ).strftime("%H:%M") == TRANSITION_TIME


def test_a_spring_forward_entry_runs_zero_times_and_says_so() -> None:
    from custom_components.glt_flow_card import schedule_time as st

    entry = {"id": "s", "time": TRANSITION_TIME, "days": [0, 1, 2, 3, 4, 5, 6]}
    year, month, day = (int(part) for part in SPRING_FORWARD.split("-"))
    start = datetime(year, month, day, 0, 0, tzinfo=timezone.utc)
    due: list[str] = []
    for step in range(4 * 60):
        due.extend(st.due_instants(entry, now=start + timedelta(minutes=step),
                                   zone=SITE_TIMEZONE))
    assert due == []
    # And the resolution says why, which the old runner never did.
    assert st.resolve_entry(entry, SPRING_FORWARD, SITE_TIMEZONE)["status"] == "nonexistent"


def test_an_ordinary_day_runs_exactly_once() -> None:
    """A resolver answering `nonexistent` to everything would pass the two
    transition tests alone."""
    from custom_components.glt_flow_card import schedule_time as st

    entry = {"id": "s", "time": TRANSITION_TIME, "days": [0, 1, 2, 3, 4, 5, 6]}
    start = datetime(2027, 6, 15, 0, 0, tzinfo=timezone.utc)
    due: list[str] = []
    for step in range(4 * 60):
        due.extend(st.due_instants(entry, now=start + timedelta(minutes=step),
                                   zone=SITE_TIMEZONE))
    assert len(due) == 1


def test_a_disabled_entry_and_a_wrong_weekday_never_come_due() -> None:
    from custom_components.glt_flow_card import schedule_time as st

    moment = datetime(2027, 6, 15, 0, 30, tzinfo=timezone.utc)  # 02:30 Berlin, a Tuesday
    assert st.due_instants({"id": "s", "time": TRANSITION_TIME}, now=moment,
                           zone=SITE_TIMEZONE)
    assert st.due_instants({"id": "s", "time": TRANSITION_TIME, "enabled": False},
                           now=moment, zone=SITE_TIMEZONE) == []
    assert st.due_instants({"id": "s", "time": TRANSITION_TIME, "days": [6]},
                           now=moment, zone=SITE_TIMEZONE) == []


def test_a_malformed_time_is_refused_not_coerced() -> None:
    from custom_components.glt_flow_card import schedule_time as st

    for time in ("tea", "25:00", "2:30", "02:60"):
        with pytest.raises(ValueError, match="not a wall-clock time"):
            st.candidate_instants("2027-06-15", time, SITE_TIMEZONE)


def test_an_undeclared_policy_raises_rather_than_choosing_one() -> None:
    from custom_components.glt_flow_card import schedule_time as st

    with pytest.raises(ValueError, match="unknown nonexistent policy"):
        st.resolve_entry({"time": TRANSITION_TIME}, SPRING_FORWARD, SITE_TIMEZONE,
                         nonexistent="guess")
    with pytest.raises(ValueError, match="unknown ambiguous policy"):
        st.resolve_entry({"time": TRANSITION_TIME}, FALL_BACK, SITE_TIMEZONE,
                         ambiguous="either")
