"""The closed alarm vocabularies, mirrored from ``src/v100/alarm-vocabulary.mjs``.

Phase 6's source audit found four independent severity vocabularies in the
product, none of them declared:

- the shipped editor writes ``critical | warning | info``
  (``glt-flow-card.base.js``, labelled Störung / Warnung / Hinweis);
- ``navigation.py`` counts ``("fault", "warning")``;
- ``project-operations.js`` branches on ``"fault"``;
- ``alarm_transition`` defaults to ``"warning"``.

So an alarm an engineer marked ``critical`` is counted in no roll-up anywhere.
That is a bug, not a preference, and one closed vocabulary is the whole fix.

**Why this one set is not configurable.** The rest of the Phase-6 alarm
philosophy is site configuration with conservative defaults, decided with the
user on 2026-09-02. Sites legitimately differ on which classes they use and what
they escalate, and both remain configuration. They do not legitimately differ on
whether the editor's word and the roll-up's word are the same word, and a
configurable vocabulary would make the four disagreeing sets five.

**Why three members and not four.** ``critical`` and ``fault`` are the same tier
under two names in the data that exists. Declaring them distinct would invent a
distinction the data does not have and silently re-tier every stored project.

The parity test compares this module's members and migration table against the
JavaScript one byte for byte, so a change to either that is not made to both
fails.
"""
from __future__ import annotations

from typing import Any

#: Alarm priorities, ordered from most to least severe. Order is a fact here.
ALARM_PRIORITIES: tuple[str, ...] = ("critical", "warning", "info")

#: Lifecycle states an alarm can be in.
#:
#: ``indeterminate`` is the one this phase adds, and it is the fix for the
#: restart defect: an entity that went ``unavailable`` has not returned to
#: normal. Nobody knows what it is doing, and "cleared" is the one answer that
#: is certainly wrong.
ALARM_STATES: tuple[str, ...] = ("active", "returned", "acknowledged", "indeterminate")

#: Why an alarm did not annunciate.
SUPPRESSION_REASONS: tuple[str, ...] = ("shelved", "maintenance", "acknowledged")

#: What happened to one notification attempt.
NOTIFICATION_OUTCOMES: tuple[str, ...] = (
    "delivered",
    "failed",
    "timeout",
    "refused",
    "no_target_configured",
)

#: The kinds of escalation stage a policy may declare.
ESCALATION_STAGE_KINDS: tuple[str, ...] = ("immediate", "delayed", "repeat")

#: How a schedule entry binds to Home Assistant.
SCHEDULE_BINDING_KINDS: tuple[str, ...] = (
    "operating_period",
    "holiday",
    "exception",
    "vacation",
    "special_day",
)

#: Every stored severity string the four sources produce, mapped to one member.
SEVERITY_MIGRATION: dict[str, str] = {
    "critical": "critical",
    "fault": "critical",
    "error": "critical",
    "alarm": "critical",
    "warning": "warning",
    "warn": "warning",
    "info": "info",
    "information": "info",
    "hint": "info",
    "notice": "info",
}

#: The answer for a stored string nobody declared.
UNKNOWN_SEVERITY_FALLBACK = ALARM_PRIORITIES[0]


def is_priority(value: Any) -> bool:
    """Return whether ``value`` is a declared alarm priority."""
    return value in ALARM_PRIORITIES


def is_alarm_state(value: Any) -> bool:
    """Return whether ``value`` is a declared alarm state."""
    return value in ALARM_STATES


def is_suppression_reason(value: Any) -> bool:
    """Return whether ``value`` is a declared suppression reason."""
    return value in SUPPRESSION_REASONS


def is_notification_outcome(value: Any) -> bool:
    """Return whether ``value`` is a declared notification outcome."""
    return value in NOTIFICATION_OUTCOMES


def is_escalation_stage_kind(value: Any) -> bool:
    """Return whether ``value`` is a declared escalation stage kind."""
    return value in ESCALATION_STAGE_KINDS


def is_schedule_binding_kind(value: Any) -> bool:
    """Return whether ``value`` is a declared schedule binding kind."""
    return value in SCHEDULE_BINDING_KINDS


def priority_rank(priority: Any) -> int:
    """Return how severe a priority is, lower being more severe.

    Raises for an unknown member rather than returning a sentinel: comparing
    against a sentinel silently orders an unknown priority somewhere.
    """
    try:
        return ALARM_PRIORITIES.index(priority)
    except ValueError:
        raise ValueError(f"unknown alarm priority: {priority!r}") from None


def at_least_as_severe(first: Any, second: Any) -> bool:
    """Return whether ``first`` is at least as severe as ``second``."""
    return priority_rank(first) <= priority_rank(second)


def migrate_severity(stored: Any) -> dict[str, Any]:
    """Map one stored severity string to a declared priority.

    An unrecognised string maps to the *most severe* interpretation and is
    reported. A site whose alarm was already miscounted must not have it
    miscounted quieter: the failure mode of guessing low is an unnoticed
    shutdown, and of guessing high is an annoyed operator.
    """
    raw = str(stored if stored is not None else "").strip().lower()
    if raw == "":
        return {"priority": UNKNOWN_SEVERITY_FALLBACK, "recognised": False, "stored": stored}
    mapped = SEVERITY_MIGRATION.get(raw)
    if mapped is None:
        return {"priority": UNKNOWN_SEVERITY_FALLBACK, "recognised": False, "stored": stored}
    return {"priority": mapped, "recognised": True, "stored": stored}


def count_by_priority(alarms: Any) -> dict[str, Any]:
    """Count alarms by declared priority.

    This is what the navigation roll-up and the panel badges call, so an alarm
    authored as ``critical`` is counted by whatever counts criticals -- which is
    the defect this module closes.
    """
    counts = {priority: 0 for priority in ALARM_PRIORITIES}
    unrecognised: list[Any] = []
    for alarm in alarms or []:
        source = alarm.get("priority", alarm.get("severity")) if isinstance(alarm, dict) else None
        result = migrate_severity(source)
        counts[result["priority"]] += 1
        if not result["recognised"]:
            unrecognised.append(result["stored"])
    return {"counts": counts, "unrecognised": unrecognised}
