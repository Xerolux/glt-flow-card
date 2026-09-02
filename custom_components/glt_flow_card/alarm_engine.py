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


# ---------------------------------------------------------------------------
# Suppression
# ---------------------------------------------------------------------------

#: The site's shelving maximum, in days. Conservative default, decided with the
#: user on 2026-09-02: long enough for a planned outage, short enough that a
#: forgotten shelf expires. Configurable, and documented as a site decision.
DEFAULT_SHELVING_MAXIMUM_DAYS = 7

#: Why a shelve request was refused. Closed, and distinct from the suppression
#: reasons: this is why the request failed, not why an alarm is quiet.
SHELVE_REFUSALS = ("shelve_exceeds_maximum", "shelve_in_the_past", "shelve_malformed")


def _parse_instant(value: Any) -> Any:
    """Parse an ISO instant, returning None rather than raising.

    A malformed expiry must produce a declared refusal, not a traceback in the
    middle of a state scan.
    """
    from datetime import datetime

    if value is None:
        return None
    if hasattr(value, "tzinfo"):
        return value
    try:
        parsed = datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None
    return parsed


def refuse_shelve(
    until: Any,
    *,
    now: Any,
    settings: dict[str, Any] | None = None,
) -> str | None:
    """Return a refusal code for a shelve request, or None when it is allowed.

    The bound was previously a silent clamp: a request for ninety days became
    seven and the operator was never told. A clamp is a worse answer than a
    refusal here, because the operator walks away believing the alarm is quiet
    for three months.

    An absent expiry is not refused -- clearing a shelf is not a shelve.
    """
    if until is None:
        return None
    parsed = _parse_instant(until)
    if parsed is None:
        return "shelve_malformed"
    if parsed <= now:
        return "shelve_in_the_past"
    maximum_days = int(
        (settings or {}).get("shelving_maximum_days", DEFAULT_SHELVING_MAXIMUM_DAYS)
    )
    from datetime import timedelta

    if parsed > now + timedelta(days=maximum_days):
        return "shelve_exceeds_maximum"
    return None


def suppression_for(
    alarm: dict[str, Any],
    *,
    state: Any = None,
    now: Any,
    settings: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Return why this alarm is suppressed, or None when it is not.

    One function, called from the one place the decision is made, so processing
    and notification cannot disagree about whether an alarm is quiet.

    Before this, `shelved_until` was written in two places, cleared in one and
    read in **none**. Shelving changed a field in a dict nothing inspected, so a
    shelved alarm still processed and still notified while the product reported
    success. That is worse than a missing feature: the operator believes the
    alarm is quiet.

    Precedence is deliberate. Maintenance is the plant's state and outranks an
    individual's shelf; a shelf outranks an acknowledgement, because a shelf was
    chosen with an expiry and an acknowledgement only says "seen".
    """
    if alarm.get("maintenance"):
        return {"reason": "maintenance", "by": None, "until": None}

    until = alarm.get("shelved_until")
    if until is not None:
        parsed = _parse_instant(until)
        # A shelf that has expired is not a shelf. A malformed one is not
        # honoured either: an unparseable expiry must not suppress forever,
        # which is the failure mode that keeps an alarm quiet indefinitely.
        if parsed is not None and parsed > now:
            return {
                "reason": "shelved",
                "by": alarm.get("shelved_by"),
                "until": parsed.isoformat() if hasattr(parsed, "isoformat") else str(parsed),
            }

    if alarm.get("acknowledged"):
        return {"reason": "acknowledged", "by": alarm.get("ack_user_name"), "until": None}

    return None


# ---------------------------------------------------------------------------
# Restart safety
# ---------------------------------------------------------------------------

#: How long after Home Assistant starts transitions are suppressed.
#:
#: Entities do not all arrive at once on boot; a scan that runs while they are
#: still settling sees a plant in a state it was never in. Conservative because
#: the cost of waiting is a late annunciation and the cost of not waiting is a
#: page for every alarm in the installation.
DEFAULT_STARTUP_GRACE_SECONDS = 60


def startup_grace_active(
    *,
    started_at: Any,
    now: Any,
    settings: dict[str, Any] | None = None,
) -> bool:
    """Return whether transitions are still suppressed after a start.

    `started_at` is None before Home Assistant has reported itself started, and
    that counts as inside the grace: the guard must be closed before the event
    arrives, not opened by its absence.
    """
    if started_at is None:
        return True
    from datetime import timedelta

    seconds = int(
        (settings or {}).get("startup_grace_seconds", DEFAULT_STARTUP_GRACE_SECONDS)
    )
    return now < started_at + timedelta(seconds=seconds)


def rearm_pending_delays(pending: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return what is left of each pending delay after a restart.

    `_alarm_tasks` is in-memory only, so a delay pending at shutdown was lost
    and never fired. Re-arming it from zero would be almost as wrong: a
    four-minute-old five-minute delay must fire in one minute, not five, or a
    restart silently extends every delay in the installation.

    An entry whose delay already elapsed while the process was down returns
    zero, so it annunciates immediately rather than being skipped.
    """
    rearmed: list[dict[str, Any]] = []
    for entry in pending or []:
        delay = max(0.0, float(_numeric(entry.get("delay_seconds", 0)) or 0.0))
        age = max(0.0, float(_numeric(entry.get("anchor_age_seconds", 0)) or 0.0))
        remaining = max(0.0, delay - age)
        rearmed.append({
            **entry,
            "fires_in_seconds": int(remaining) if remaining.is_integer() else remaining,
        })
    return rearmed


def pending_from_state(
    alarm_state: dict[str, Any],
    *,
    now: Any,
) -> list[dict[str, Any]]:
    """Return the delays that were pending when the process stopped.

    Read from persisted state rather than from the in-memory task registry,
    which is the whole point: the registry did not survive.
    """
    from datetime import datetime

    pending: list[dict[str, Any]] = []
    for key, row in (alarm_state or {}).items():
        anchor = row.get("delay_anchor")
        delay = _numeric(row.get("delay_seconds", 0)) or 0
        if not anchor or delay <= 0 or row.get("active"):
            continue
        parsed = _parse_instant(anchor)
        if parsed is None:
            continue
        pending.append({
            "key": key,
            "project_id": row.get("project_id"),
            "alarm_id": row.get("alarm_id"),
            "delay_seconds": int(delay),
            "anchor_age_seconds": max(0.0, (now - parsed).total_seconds()),
        })
    return rearm_pending_delays(pending)
