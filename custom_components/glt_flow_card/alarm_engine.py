"""The one place alarm state is decided.

Phase 6's audit found four independent derivations of "is this alarm active" in
the product, and they disagree. Three derivations that disagree is worse than
one that is wrong: a single wrong answer is at least consistent, and an operator
can learn it. Four inconsistent answers cannot be learned at all.

So the Companion evaluates and every surface renders what it evaluated. This is
the rule Phase 4 established for control lists and Phase 2 for authority, and it
is here for the same reason: a browser deciding for itself works from a snapshot
that can be minutes old, and every question in this module is time-dependent.

**Nothing here imports from `homeassistant.core`.** The functions take state and
return decisions. A lifecycle that can only be exercised through a full
integration is a lifecycle that will be exercised shallowly, and the two defects
this module closes both needed more than one alarm or more than one state change
to see at all.
"""
from __future__ import annotations

from typing import Any

from .alarm_vocabulary import (
    ALARM_STATES,
    SUPPRESSION_REASONS,
    migrate_severity,
)

#: The states an alarm can be in, re-exported so a caller needs one import.
STATES = ALARM_STATES

#: States that mean "nobody knows", as distinct from "back to normal".
#:
#: This distinction is the whole restart fix. An entity that went `unavailable`
#: has not returned to normal; nobody has any idea what it is doing, and
#: "cleared" is the one answer that is certainly wrong -- it un-acknowledges and
#: un-shelves on the way past.
INDETERMINATE_RAW_STATES = frozenset({"unavailable", "unknown", "none", ""})

#: The default vocabulary for "this is not an alarm", when a project declares
#: neither `active_states` nor `inactive_states`. Carried over unchanged from
#: the manager's `_state_active` so this module is a move, not a rewrite.
DEFAULT_INACTIVE_STATES = frozenset({
    "off", "0", "ok", "normal", "none", "idle", "clear", "unavailable", "unknown", "",
})

#: Reasons a transition decision can carry. Closed, like every Phase-6 set.
TRANSITION_REASONS = (
    "threshold_crossed",
    "threshold_cleared",
    "state_matched",
    "state_cleared",
    "delay_pending",
    "indeterminate",
    "unchanged",
    "suppressed",
)


def _numeric(value: Any) -> float | None:
    """Return `value` as a float, or None when it is not a number.

    Returning None rather than raising keeps a malformed threshold from taking
    down the scan for every other alarm on the entity.
    """
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def classify_state(raw: Any, alarm: dict[str, Any]) -> str:
    """Return `active`, `inactive` or `indeterminate` for one raw state.

    Three answers, not two. The manager's `_state_active` returned a boolean, so
    `unavailable` and `off` were the same answer -- which is how a restart, in
    which every entity passes through `unavailable`, looked exactly like every
    alarm clearing at once.
    """
    text = "" if raw is None else str(raw).strip().lower()
    if text in INDETERMINATE_RAW_STATES:
        # An explicit `active_states` list that names one of these means the
        # site really did configure it as an alarm condition, so it is honoured.
        declared = [str(value).lower() for value in alarm.get("active_states") or []]
        if text in declared:
            return "active"
        return "indeterminate"
    return "active" if evaluate(raw, alarm, False) else "inactive"


def evaluate(raw: Any, alarm: dict[str, Any], previous_active: bool = False) -> bool:
    """Return whether the condition holds, given what it held a moment ago.

    `previous_active` is not optional in spirit: hysteresis is a property of the
    transition, not of the value. A caller that always passes False makes the
    alarm chatter across the band, and `test_alarm_lifecycle` asserts that the
    stateless walk differs from the stateful one so this cannot go unnoticed.
    """
    text = "" if raw is None else str(raw).strip().lower()
    condition = alarm.get("condition") or {}
    operator = condition.get("operator")

    if operator:
        value = _numeric(text)
        threshold = _numeric(condition.get("value"))
        hysteresis = _numeric(alarm.get("hysteresis", 0)) or 0.0
        if value is None or threshold is None:
            return False
        # The band applies only while the alarm is already active, so a rising
        # edge crosses at the threshold and a falling edge does not clear until
        # it is past the band.
        band = hysteresis if previous_active else 0.0
        if operator == ">":
            return value > threshold - band
        if operator == ">=":
            return value >= threshold - band
        if operator == "<":
            return value < threshold + band
        if operator == "<=":
            return value <= threshold + band
        if operator == "==":
            return value == threshold
        if operator == "!=":
            return value != threshold
        return False

    active_states = [str(value).lower() for value in alarm.get("active_states") or []]
    if active_states:
        return text in active_states
    inactive_states = [str(value).lower() for value in alarm.get("inactive_states") or []]
    if inactive_states:
        return text not in inactive_states
    return text not in DEFAULT_INACTIVE_STATES


def scheduled_delays(alarms: list[dict[str, Any]]) -> dict[str, int]:
    """Return the delay each alarm will actually wait.

    This exists so D2 can be *observed* rather than timed. The defect was that
    the scheduled coroutine bound `pid`, `a`, `e` and `k` as default arguments
    and left `delay` free, so it read the loop's final value after the loop
    finished: a five-second and a five-minute alarm on one entity both waited
    five minutes.

    The delay is read from the alarm the closure already carries, which removes
    the class of bug rather than this instance of it -- there is no loop
    variable left to capture wrongly.
    """
    return {
        str(alarm.get("id")): max(0, int(_numeric(alarm.get("delay_seconds", 0)) or 0))
        for alarm in alarms or []
    }


def annunciates_at(transitions: list[tuple[float, bool]], delay_seconds: float) -> float | None:
    """Return when a delayed alarm annunciates, anchored to its first activation.

    `transitions` is (elapsed_seconds, active) in order. Returns None when the
    condition never becomes continuously active.

    The delay exists to suppress a *transient*, not a persistent fault that
    happens to be noisy. The implementation this replaces cancelled and
    recreated the pending task on every intermediate active state, so a sensor
    whose value kept changing while staying above threshold dragged its own
    annunciation along behind the last change -- and in a plant, the changes do
    not stop.
    """
    anchor: float | None = None
    for at, active in transitions or []:
        if active:
            if anchor is None:
                anchor = at
        else:
            anchor = None
    return None if anchor is None else anchor + float(delay_seconds)


def decide(
    alarm: dict[str, Any],
    raw: Any,
    *,
    previous_active: bool = False,
    previous_state: str | None = None,
    suppression: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return one decision record: what the alarm is now, and why.

    Not a boolean. D1 is a feature that reported success and did nothing, and D6
    is a failure discarded twice; both are the same defect -- an effect whose
    outcome has nowhere to live -- and a record with a mandatory reason is the
    fix for both. A suppressed decision must be able to say *which* suppression
    applied, because "quiet" without a reason is what shelving already shipped.
    """
    classification = classify_state(raw, alarm)
    priority = migrate_severity(alarm.get("priority", alarm.get("severity")))["priority"]
    delay = max(0, int(_numeric(alarm.get("delay_seconds", 0)) or 0))
    threshold = bool((alarm.get("condition") or {}).get("operator"))

    if classification == "indeterminate":
        # Hold, do not clear. The previous state is carried forward so a restart
        # neither re-notifies nor un-acknowledges.
        return {
            "state": "indeterminate",
            "active": bool(previous_active),
            "priority": priority,
            "reason": "indeterminate",
            "suppressed_by": None,
            "value": None if raw is None else str(raw),
            "previous_state": previous_state,
        }

    active = evaluate(raw, alarm, previous_active)

    if suppression:
        reason = suppression.get("reason")
        if reason not in SUPPRESSION_REASONS:
            raise ValueError(f"unknown suppression reason: {reason!r}")
        return {
            "state": "acknowledged" if reason == "acknowledged" else "active",
            "active": active,
            "priority": priority,
            "reason": "suppressed",
            "suppressed_by": reason,
            "suppression": dict(suppression),
            "value": None if raw is None else str(raw),
            "previous_state": previous_state,
        }

    if active and not previous_active and delay > 0:
        return {
            "state": "active",
            "active": False,
            "priority": priority,
            "reason": "delay_pending",
            "suppressed_by": None,
            "delay_seconds": delay,
            "value": None if raw is None else str(raw),
            "previous_state": previous_state,
        }

    if active == previous_active:
        reason = "unchanged"
    elif active:
        reason = "threshold_crossed" if threshold else "state_matched"
    else:
        reason = "threshold_cleared" if threshold else "state_cleared"

    return {
        "state": "active" if active else "returned",
        "active": active,
        "priority": priority,
        "reason": reason,
        "suppressed_by": None,
        "value": None if raw is None else str(raw),
        "previous_state": previous_state,
    }
