"""A report schedule is validated when authored, and executed by one runner.

D20: the designer collects ``schedule`` from a free-text ``prompt()`` --
"Automatik (z.B. 1 07:00) oder leer" -- and stores it on the definition. No
parser, no validator and no runner reads it. The designer's table renders the
string back to the operator under the heading "Automatik", which is the entire
extent of the feature.

So the product **displays an automation that does not exist**. That is Phase 6's
shelving defect in a new place: a feature that reports success and does nothing
is worse than one that is missing, because the operator stops checking.

Two rules, both carried from Phase 6.

**Validated at authoring time.** An invalid schedule is refused when it is saved,
with the reason, rather than discovered at the moment it should have run. A
schedule that fails silently at 07:00 on the first of the month is a report
nobody notices is missing until someone asks for it.

**One runner.** Report schedules resolve through the same ``schedule_time``
resolution the plant schedules use. The product already had four things
disagreeing about alarm severity; a second scheduler is the same mistake in a new
place, and it would drift the first time one of them learned about DST.
"""
from __future__ import annotations

from typing import Any

from . import schedule_time
from .alarm_vocabulary import SCHEDULE_BINDING_KINDS

#: Outcomes a run may record. Closed, and `skipped` is distinct from `failed`:
#: a schedule that did not fire because its date does not exist is not a
#: schedule that tried and could not.
RUN_OUTCOMES: tuple[str, ...] = ("delivered", "failed", "refused", "skipped")

#: Why a schedule was refused at authoring time. Closed, each distinct.
SCHEDULE_REFUSALS: tuple[str, ...] = (
    "schedule_is_free_text",
    "schedule_time_invalid",
    "schedule_days_invalid",
    "schedule_kind_unknown",
)

#: Bounded, as Phase 6 bounded schedule-run history.
DEFAULT_RUNS_RETAINED = 500


def validate(definition: Any) -> dict[str, Any]:
    """Return whether a report's schedule is usable, and why not.

    A free-text string is refused with its own reason rather than folded into
    "invalid". The operator typed something the old designer asked them for, and
    telling them *that shape is not a schedule* is a different message from
    telling them their time is wrong.
    """
    definition = definition or {}
    if "schedule" not in definition or definition.get("schedule") is None:
        # *Absence* is how a report says it runs on demand, and that is a valid
        # state. An empty string is not absence: the shipped designer stores one
        # when the operator leaves the prompt blank, and the 5->6 migration
        # quarantines it, so a schema-6 project has no key rather than an empty
        # one. By the time an empty string reaches here something has gone
        # wrong, and accepting it would let a bug that blanks the field look
        # exactly like a deliberate choice.
        return {"ok": True, "reason": None, "scheduled": False}
    schedule = definition.get("schedule")

    if not isinstance(schedule, dict):
        return _refuse(
            "schedule_is_free_text",
            f"{schedule!r} is text, not a schedule; nothing has ever parsed it",
        )

    kind = schedule.get("kind", "instant")
    if kind not in SCHEDULE_BINDING_KINDS and kind != "instant":
        return _refuse("schedule_kind_unknown", f"kind {kind!r} is not a schedule kind")

    time_text = schedule.get("time")
    if not isinstance(time_text, str) or not schedule_time.is_wall_time(time_text):
        return _refuse("schedule_time_invalid", f"time {time_text!r} is not HH:MM")

    days = schedule.get("days")
    if days is not None:
        if not isinstance(days, list) or not days:
            return _refuse("schedule_days_invalid", f"days {days!r} is not a non-empty list")
        for day in days:
            if isinstance(day, bool) or not isinstance(day, int) or not 0 <= day <= 6:
                return _refuse("schedule_days_invalid", f"day {day!r} is not 0-6")

    return {"ok": True, "reason": None, "scheduled": True}


def _refuse(reason: str, detail: str) -> dict[str, Any]:
    if reason not in SCHEDULE_REFUSALS:
        raise ValueError(f"unknown schedule refusal: {reason!r}")
    return {"detail": detail, "ok": False, "reason": reason, "scheduled": False}


def due_instants(definition: Any, dates: Any, timezone: str) -> list[dict[str, Any]]:
    """Resolve a report schedule to instants, through the Phase-6 resolution.

    The same function the plant schedules use, so a report scheduled for 02:30
    on a transition date gets the same answer the plant does -- including the
    nonexistent and ambiguous cases, which a second implementation would
    certainly get wrong and would certainly get wrong differently.
    """
    checked = validate(definition)
    if not checked["ok"] or not checked["scheduled"]:
        return []
    schedule = (definition or {}).get("schedule") or {}
    resolved = []
    for date in list(dates or [])[:31]:
        try:
            resolved.append({"date": date, **schedule_time.resolve_entry(schedule, date, timezone)})
        except ValueError as error:
            resolved.append({"date": date, "error": str(error), "status": "invalid"})
    return resolved


def record_run(definition: Any, *, outcome: str, error: str | None = None, at: str | None = None) -> dict[str, Any]:
    """Record one report run, successful or not.

    Every run, and that is the point. The shipped path records nothing at all,
    so a report that never ran and one that ran and failed are the same absence
    of evidence.
    """
    if outcome not in RUN_OUTCOMES:
        raise ValueError(f"unknown run outcome: {outcome!r}")
    return {
        "at": at,
        "error": error,
        "outcome": outcome,
        "report_id": (definition or {}).get("id"),
    }


def prune_runs(runs: Any, *, retained: int = DEFAULT_RUNS_RETAINED) -> list[Any]:
    """Keep the most recent runs, dropping the oldest."""
    rows = list(runs or [])
    if not isinstance(retained, int) or isinstance(retained, bool) or retained < 1:
        retained = DEFAULT_RUNS_RETAINED
    return rows[-retained:]
