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

**The invariant, and what it is not.** The defect was four components
disagreeing about what a word means. The fix is that there is exactly *one*
declared vocabulary and both runtimes read it. That invariant says nothing about
how many members it has, and Phase 6 conflated the two: it argued the set must
not be configurable because "a configurable vocabulary would make the four
disagreeing sets five". That is only true of a vocabulary each component decides
for itself. A scale declared **once, in the project, and resolved from that one
place by both runtimes** is still one vocabulary -- it is simply one the site
chose.

**So a site declares its own scale** (2026-09-03). Plants genuinely differ:
three tiers is right for a small heating plant and wrong for one with a separate
safety-shutdown class above its faults, and a site that needs four was
previously told to record two different things under one word.

What stays fixed is everything that made three work:

- The scale is **ordered**, most severe first, and rank is position. Order is a
  fact, not a preference.
- It is declared in **one** place, mirrored byte-for-byte by
  ``src/v100/alarm-vocabulary.mjs``, and the parity corpus covers custom scales
  as well as the default.
- Every stored severity string still maps to a **declared** member, and a
  project naming a priority its site does not declare is **refused** -- not
  silently re-tiered, which is the failure Phase 6 was right to fear.
- The default is unchanged, so a site that declares nothing behaves exactly as
  before.

**``critical`` and ``fault`` remain one tier in the default scale.** They were
the same tier under two names in the data that existed, and inventing a
distinction there would still re-tier stored projects. A site that genuinely
runs both declares both, and then says which stored strings mean which.

The parity test compares this module's members and migration table against the
JavaScript one byte for byte, so a change to either that is not made to both
fails.
"""
from __future__ import annotations

import re
from typing import Any

#: A tier name a person types and a machine stores.
_IDENTIFIER = re.compile(r"[a-z][a-z0-9_]{0,31}")

#: The default scale, ordered from most to least severe. Order is a fact here.
#:
#: A site that declares nothing gets exactly this, so every project written
#: before scales existed behaves as it always did.
ALARM_PRIORITIES: tuple[str, ...] = ("critical", "warning", "info")

#: How many tiers a site may declare.
#:
#: Two is the floor because a one-member scale cannot express severity at all,
#: and the roll-ups, badges and escalation comparisons would all be answering a
#: question with one possible answer. Six is the ceiling because a scale an
#: operator cannot hold in their head at three in the morning is not a scale;
#: ISA-18.2 puts the practical number at three or four and this leaves room
#: either side rather than legislating.
MIN_PRIORITY_TIERS = 2
MAX_PRIORITY_TIERS = 6

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


class AlarmScaleRejected(Exception):
    """A declared priority scale was refused, before anything used it."""

    def __init__(self, code: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = dict(detail or {})


def resolve_priority_scale(settings: Any) -> dict[str, Any]:
    """Return the priority scale a site runs on, and how to read its data.

    Resolved from **site options**, not from a project document, for the reason
    ``notify_allowlist`` is: a project document is operator input, and one
    project must not be able to change how another project's alarms are tiered.
    ``alarm_settings()`` already described priorities as a site decision; this
    is that description becoming true.

    A site that declares nothing resolves to the default, so this is
    backwards-compatible by construction rather than by a migration.
    """
    options = settings if isinstance(settings, dict) else {}
    declared = options.get("alarm_priorities")

    if declared is None:
        return {
            "priorities": tuple(ALARM_PRIORITIES),
            "migration": dict(SEVERITY_MIGRATION),
            "fallback": UNKNOWN_SEVERITY_FALLBACK,
            "declared": False,
        }

    if not isinstance(declared, (list, tuple)) or not declared:
        raise AlarmScaleRejected("priorities_not_a_list")
    if not (MIN_PRIORITY_TIERS <= len(declared) <= MAX_PRIORITY_TIERS):
        raise AlarmScaleRejected(
            "priority_count_out_of_range",
            {"declared": len(declared), "min": MIN_PRIORITY_TIERS, "max": MAX_PRIORITY_TIERS},
        )

    priorities: list[str] = []
    for entry in declared:
        if not isinstance(entry, str) or not _IDENTIFIER.fullmatch(entry):
            raise AlarmScaleRejected("priority_not_an_identifier", {"entry": entry})
        if entry in priorities:
            raise AlarmScaleRejected("priority_declared_twice", {"entry": entry})
        priorities.append(entry)

    # Where stored strings land. A site that renames its tiers must say what its
    # existing data means, or the rename silently re-tiers every stored alarm --
    # the failure the closed vocabulary was built to prevent, and it does not
    # stop being that failure because the site asked for it.
    mapping_declared = options.get("alarm_severity_mapping")
    mapping: dict[str, str] = {}
    if mapping_declared is not None:
        if not isinstance(mapping_declared, dict):
            raise AlarmScaleRejected("severity_mapping_not_an_object")
        for stored, target in mapping_declared.items():
            if not isinstance(stored, str) or not stored.strip():
                raise AlarmScaleRejected("severity_mapping_key_empty", {"stored": stored})
            if target not in priorities:
                raise AlarmScaleRejected(
                    "severity_mapping_target_undeclared",
                    {"stored": stored, "target": target, "declared": list(priorities)},
                )
            mapping[stored.strip().lower()] = target

    # The default mapping is carried forward for every tier the site kept, so a
    # site adding one class above `critical` does not have to restate that
    # `fault` still means `critical`.
    for stored, target in SEVERITY_MIGRATION.items():
        if stored not in mapping and target in priorities:
            mapping[stored] = target
    # A declared tier always maps to itself.
    for priority in priorities:
        mapping.setdefault(priority, priority)

    fallback_declared = options.get("alarm_unknown_severity")
    if fallback_declared is None:
        fallback = priorities[0]
    elif fallback_declared in priorities:
        fallback = fallback_declared
    else:
        raise AlarmScaleRejected(
            "unknown_severity_undeclared",
            {"declared": list(priorities), "fallback": fallback_declared},
        )

    return {
        "priorities": tuple(priorities),
        "migration": mapping,
        "fallback": fallback,
        "declared": True,
    }


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


def priority_rank(priority: Any, scale: Any = None) -> int:
    """Return how severe a priority is on ``scale``, lower being more severe.

    Raises for an unknown member rather than returning a sentinel: comparing
    against a sentinel silently orders an unknown priority somewhere -- and on a
    site-declared scale that matters more, not less, because "unknown" now also
    covers a tier another site declared and this one did not.

    ``scale`` defaults to the default scale so every existing call site keeps
    working unchanged; pass a resolved scale to rank against a site's own.
    """
    priorities = _priorities_of(scale)
    try:
        return priorities.index(priority)
    except ValueError:
        raise ValueError(
            f"unknown alarm priority: {priority!r} (declared: {list(priorities)})"
        ) from None


def at_least_as_severe(first: Any, second: Any, scale: Any = None) -> bool:
    """Return whether ``first`` is at least as severe as ``second``."""
    return priority_rank(first, scale) <= priority_rank(second, scale)


def _priorities_of(scale: Any) -> tuple[str, ...]:
    """Return the ordered tiers of a resolved scale, or the default."""
    if scale is None:
        return tuple(ALARM_PRIORITIES)
    if isinstance(scale, dict):
        return tuple(scale.get("priorities") or ALARM_PRIORITIES)
    return tuple(scale)


def migrate_severity(stored: Any, scale: Any = None) -> dict[str, Any]:
    """Map one stored severity string to a priority declared by ``scale``.

    An unrecognised string maps to the *most severe* interpretation the scale
    declares and is reported. A site whose alarm was already miscounted must not
    have it miscounted quieter: the failure mode of guessing low is an unnoticed
    shutdown, and of guessing high is an annoyed operator. That reasoning does
    not change when the site chooses its own tiers -- only which tier is the top
    one does.
    """
    resolved = scale if isinstance(scale, dict) else None
    migration = (resolved or {}).get("migration") or SEVERITY_MIGRATION
    fallback = (resolved or {}).get("fallback") or UNKNOWN_SEVERITY_FALLBACK
    raw = str(stored if stored is not None else "").strip().lower()
    if raw == "":
        return {"priority": fallback, "recognised": False, "stored": stored}
    mapped = migration.get(raw)
    if mapped is None:
        return {"priority": fallback, "recognised": False, "stored": stored}
    return {"priority": mapped, "recognised": True, "stored": stored}


def count_by_priority(alarms: Any, scale: Any = None) -> dict[str, Any]:
    """Count alarms by the priorities ``scale`` declares.

    This is what the navigation roll-up and the panel badges call, so an alarm
    authored as ``critical`` is counted by whatever counts criticals -- which is
    the defect this module closes. The counts carry **every** declared tier,
    including the empty ones, so a badge row does not silently change shape when
    a site happens to have no alarms in one class.
    """
    priorities = _priorities_of(scale)
    counts = {priority: 0 for priority in priorities}
    unrecognised: list[Any] = []
    for alarm in alarms or []:
        source = alarm.get("priority", alarm.get("severity")) if isinstance(alarm, dict) else None
        result = migrate_severity(source, scale)
        counts[result["priority"]] = counts.get(result["priority"], 0) + 1
        if not result["recognised"]:
            unrecognised.append(result["stored"])
    return {"counts": counts, "unrecognised": unrecognised}
