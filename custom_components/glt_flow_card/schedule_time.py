"""Resolve a schedule entry to instants, in the site's timezone.

The Python mirror of ``src/v100/schedule-time.mjs``. The browser previews and
this runs the plant; if they disagree about 02:30 on a transition date, the
engineer verified something else. ``test/schedule-dst-parity.test.mjs`` compares
canonical bytes from both over a committed corpus, on the Phase-3 instrument.

Measured against Home Assistant 2026.2.3 for ``Europe/Berlin`` and recorded in
``06-RESEARCH.md`` section 4:

- **2027-03-28.** Consecutive minute ticks run ``01:59+01:00`` then
  ``03:00+02:00``. The wall-clock minutes 02:00-02:59 are never delivered, so a
  02:30 night setback is silently skipped with no run recorded.
- **2027-10-31.** Every ambiguous minute is delivered *twice*, with different
  offsets, and both produced the identical ``run_key`` because
  ``%Y-%m-%dT%H:%M`` discards the offset. The second execution was suppressed by
  the deduplication cache, not by the schedule logic -- luck, and D8's prune fix
  would have removed it.

Home Assistant's ``_datetime_exists`` and ``_datetime_ambiguous`` are the right
semantics but underscore-prefixed, so they are implemented here and
``test_schedule_dst`` asserts agreement with Home Assistant's own for every
corpus date. When those private helpers change or vanish, the test says so.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

#: Statuses a resolution can report. Closed, like every Phase-6 set.
RESOLUTION_STATUSES: tuple[str, ...] = ("normal", "nonexistent", "ambiguous")

#: What to do when a configured local time does not exist on a date.
#:
#: ``skip`` is the conservative default and a *site* decision: a night setback
#: that silently does not run is bad, and one that runs an hour early without
#: anybody asking is worse. Whichever a site picks, the preview says so in words.
NONEXISTENT_POLICIES: tuple[str, ...] = ("skip", "after", "before")

#: Which occurrence of an ambiguous local time to run.
AMBIGUOUS_POLICIES: tuple[str, ...] = ("first", "second", "both")

DEFAULT_NONEXISTENT_POLICY = "skip"
DEFAULT_AMBIGUOUS_POLICY = "first"

_TIME_PATTERN = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")


def _parts(date: str, time: str) -> tuple[int, int, int, int, int]:
    year, month, day = (int(part) for part in str(date).split("-"))
    hour, minute = (int(part) for part in str(time).split(":"))
    return year, month, day, hour, minute


def candidate_instants(date: str, time: str, zone: str) -> list[datetime]:
    """Return every distinct UTC instant whose local time in ``zone`` is `time`.

    Zero for a time in the lost hour, two for an ambiguous one, one otherwise.
    Both folds are tried, and an instant that does not read back as the
    requested wall-clock time is not a real occurrence -- which is what makes
    this the existence test rather than an approximation of one.
    """
    if not _TIME_PATTERN.match(str(time)):
        raise ValueError(f"not a wall-clock time: {time!r}")
    year, month, day, hour, minute = _parts(date, time)
    tz = ZoneInfo(zone)
    found: list[datetime] = []
    for fold in (0, 1):
        local = datetime(year, month, day, hour, minute, tzinfo=tz, fold=fold)
        # The round trip is the test: a time in the gap maps to an instant whose
        # local reading is a different wall-clock time.
        if local.astimezone(ZoneInfo("UTC")).astimezone(tz).replace(fold=fold) != local:
            continue
        instant = local.astimezone(ZoneInfo("UTC"))
        if all(instant != seen for seen in found):
            found.append(instant)
    return sorted(found)


def local_time_exists(date: str, time: str, zone: str) -> bool:
    """Return whether this local time exists on this date in this zone."""
    return len(candidate_instants(date, time, zone)) > 0


def local_time_ambiguous(date: str, time: str, zone: str) -> bool:
    """Return whether this local time occurs twice on this date in this zone."""
    return len(candidate_instants(date, time, zone)) > 1


def resolve_entry(
    entry: dict[str, Any],
    date: str,
    zone: str,
    *,
    nonexistent: str = DEFAULT_NONEXISTENT_POLICY,
    ambiguous: str = DEFAULT_AMBIGUOUS_POLICY,
) -> dict[str, Any]:
    """Resolve one entry on one date to the instants it should run at.

    Returns a declared ``status`` in every case. A nonexistent time returns a
    status and an empty instant list -- never a silent empty result that reads
    as "nothing scheduled", which is exactly how the defect hid for as long as
    it did.
    """
    if nonexistent not in NONEXISTENT_POLICIES:
        raise ValueError(f"unknown nonexistent policy: {nonexistent!r}")
    if ambiguous not in AMBIGUOUS_POLICIES:
        raise ValueError(f"unknown ambiguous policy: {ambiguous!r}")

    time = (entry or {}).get("time") or (entry or {}).get("from")
    if not time or not _TIME_PATTERN.match(str(time)):
        return {"status": "normal", "instants": [], "candidates": [], "reason": "no_time"}

    found = candidate_instants(date, str(time), zone)
    candidates = [instant.isoformat().replace("+00:00", "Z") for instant in found]

    if not candidates:
        # The lost hour. `after` and `before` walk the **wall clock** minute by
        # minute to the nearest time that does exist. Shifting the UTC instant
        # instead lands an hour past the answer, because that instant is already
        # on the far side of the gap; and walking rather than shifting by a
        # hard-coded hour matters because Lord Howe's transition is thirty
        # minutes.
        instants: list[str] = []
        if nonexistent != "skip":
            _, _, _, hour, minute = _parts(date, str(time))
            configured = hour * 60 + minute
            for step in range(1, 241):
                walked = configured + (step if nonexistent == "after" else -step)
                if walked < 0 or walked > 24 * 60 - 1:
                    break
                probe = f"{walked // 60:02d}:{walked % 60:02d}"
                resolved = candidate_instants(date, probe, zone)
                if resolved:
                    chosen = resolved[-1] if nonexistent == "before" else resolved[0]
                    instants = [chosen.isoformat().replace("+00:00", "Z")]
                    break
        return {
            "status": "nonexistent", "instants": instants,
            "candidates": [], "policy": nonexistent,
        }

    if len(candidates) > 1:
        if ambiguous == "both":
            chosen_list = list(candidates)
        else:
            chosen_list = [candidates[-1] if ambiguous == "second" else candidates[0]]
        return {
            "status": "ambiguous", "instants": chosen_list,
            "candidates": candidates, "policy": ambiguous,
        }

    return {"status": "normal", "instants": candidates, "candidates": candidates}


def run_key(project_id: str, schedule_id: str, instant: Any) -> str:
    """Return the deduplication key for one resolved run.

    Keyed on the **resolved instant**, not on local wall-clock text. The previous
    key was ``{project}:{schedule}:{local %Y-%m-%dT%H:%M}``, which collapsed the
    two fall-back occurrences into one entry -- and that collapse was the only
    thing preventing a double fire. Moving the offset into the key is what lets
    the prune be fixed without reintroducing one.

    The separator is a space rather than a colon because the previous key's
    segments were split on a colon that also appears inside a timestamp, which
    is how D8's prune came to read the *minute* as a date.
    """
    if isinstance(instant, datetime):
        text = instant.astimezone(ZoneInfo("UTC")).isoformat()
    else:
        text = str(instant)
    normalized = datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(
        ZoneInfo("UTC")
    ).isoformat().replace("+00:00", "Z")
    return f"{project_id} {schedule_id} {normalized}"


def due_instants(
    entry: dict[str, Any],
    *,
    now: datetime,
    zone: str,
    window_seconds: int = 60,
    nonexistent: str = DEFAULT_NONEXISTENT_POLICY,
    ambiguous: str = DEFAULT_AMBIGUOUS_POLICY,
) -> list[str]:
    """Return the resolved instants of `entry` that fall due in this tick.

    The runner compares instants against a window rather than comparing
    ``now.strftime("%H:%M")`` against a stored string. That string comparison is
    what skipped the lost hour outright: the wall-clock minute simply never
    arrived, so the equality never held and nothing recorded that anything was
    missed.
    """
    if entry.get("enabled") is False:
        return []
    local_now = now.astimezone(ZoneInfo(zone))
    days = entry.get("days")
    if days is not None and local_now.weekday() not in days:
        return []
    resolution = resolve_entry(
        entry, local_now.date().isoformat(), zone,
        nonexistent=nonexistent, ambiguous=ambiguous,
    )
    due: list[str] = []
    for text in resolution["instants"]:
        instant = datetime.fromisoformat(text.replace("Z", "+00:00"))
        delta = (now - instant).total_seconds()
        if 0 <= delta < window_seconds:
            due.append(text)
    return due
