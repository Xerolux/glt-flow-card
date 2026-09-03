"""The adversarial alarm, notification and schedule corpus for Phase 6.

Built the way `cad_factory.py` was: it carries the evaluators it defeats, next
to the fixtures that defeat them, so "the shipped card disagrees with the
backend" is an executable claim rather than a sentence in an audit.

Three naive implementations are reproduced here verbatim in behaviour:

``shipped_active_alarm``
    The card's `activeAlarm` (`dist/glt-flow-card.js`), a string-membership test
    with no operator, threshold, hysteresis or delay.
``last_delay_wins``
    The loop-closure defect: `delay` is a free variable read when the coroutine
    runs, after the loop has finished, so every alarm on one entity waits the
    last one's delay.
``restarting_delay``
    The delay that cancels and restarts on every intermediate active state, so a
    sensor whose value keeps changing while staying above threshold pushes its
    own annunciation out indefinitely -- it fires only once the changes stop.

None of the three is used by the integration. They exist so a test can assert
the intended answer *differs* from the naive one, which is the only way a
replacement proves it replaced anything.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

#: The site this corpus is written for. German heating plants are the subject,
#: and both DST transitions below are that zone's.
SITE_TIMEZONE = "Europe/Berlin"

#: A spring-forward date whose 02:00-02:59 local wall-clock hour does not exist.
SPRING_FORWARD = "2027-03-28"

#: A fall-back date whose 02:00-02:59 local wall-clock hour occurs twice.
FALL_BACK = "2027-10-31"

#: The wall-clock time both transition schedules use. An ordinary night-setback
#: time on a German heating plant, which is the point: this is not an exotic
#: case chosen to break the code.
TRANSITION_TIME = "02:30"

#: Every severity string the four disagreeing sources produce today.
#:
#: The editor writes the first three (`base.js`), `navigation.py` counts
#: ("fault", "warning"), `project-operations.js` branches on "fault", and
#: `alarm_transition` defaults to "warning". A `critical` alarm is therefore
#: counted by no roll-up anywhere.
LEGACY_SEVERITIES = ("critical", "warning", "info", "fault")


# ---------------------------------------------------------------------------
# The evaluators this corpus defeats
# ---------------------------------------------------------------------------

#: The card's default inactive vocabulary, copied from the shipped artifact.
SHIPPED_INACTIVE = (
    "off", "0", "ok", "normal", "none", "idle", "clear", "unavailable", "unknown",
)


def shipped_active_alarm(state: str | None, alarm: dict[str, Any]) -> bool:
    """Reproduce the shipped card's `activeAlarm`, exactly.

    No operator, no threshold, no hysteresis, no delay. For a threshold alarm
    with no `active_states` it falls through to the inactive-list test, so a
    temperature of "55" reads as active whatever the threshold says.
    """
    raw = str(state or "").lower()
    active_states = alarm.get("active_states") or []
    if active_states:
        return raw in [str(value).lower() for value in active_states]
    inactive = alarm.get("inactive_states") or list(SHIPPED_INACTIVE)
    return raw not in [str(value).lower() for value in inactive]


def last_delay_wins(alarms: list[dict[str, Any]]) -> dict[str, int]:
    """Reproduce the loop-closure defect: every alarm waits the last one's delay.

    The integration binds `pid`, `a`, `e` and `k` as default arguments and
    leaves `delay` free, so the scheduled coroutine reads it after the loop has
    finished. One alarm cannot show this; two with different delays can.
    """
    delay = 0
    scheduled: dict[str, int] = {}
    for alarm in alarms:
        delay = int(alarm.get("delay_seconds", 0) or 0)
    for alarm in alarms:
        scheduled[str(alarm["id"])] = delay
    return scheduled


def restarting_delay(
    transitions: list[tuple[float, bool]], delay_seconds: float
) -> float | None:
    """Reproduce the delay that restarts on every intermediate active state.

    `transitions` is (elapsed_seconds, active) in order. Returns the moment the
    alarm annunciates, or None when it never does within the window.

    A sensor that keeps changing while staying above threshold re-arms on every
    change, so the annunciation is dragged along behind the last change rather
    than measured from the first: the answer is `last_change + delay`, not
    `first_activation + delay`. In a plant the changes do not stop, so neither
    does the dragging -- which is the opposite of what a delay is for. A delay
    exists to suppress a transient, not a persistent fault that happens to be
    noisy.
    """
    armed_at: float | None = None
    for at, active in transitions:
        if active:
            armed_at = at  # the cancel-and-recreate
        else:
            armed_at = None
        if armed_at is not None:
            fires_at = armed_at + delay_seconds
            later = [t for t, _ in transitions if t > armed_at]
            if not later or min(later) > fires_at:
                return fires_at
    return None


def anchored_delay(
    transitions: list[tuple[float, bool]], delay_seconds: float
) -> float | None:
    """The intended behaviour: anchor to the first activation of a continuous run.

    Kept beside its naive twin so the difference is one call apart rather than
    one file apart.
    """
    anchor: float | None = None
    for at, active in transitions:
        if active and anchor is None:
            anchor = at
        elif not active:
            anchor = None
    return None if anchor is None else anchor + delay_seconds


# ---------------------------------------------------------------------------
# The corpus
# ---------------------------------------------------------------------------

@dataclass
class AlarmCorpus:
    """One schema-5-shaped project plus the states that exercise it."""

    project: dict[str, Any] = field(default_factory=dict)
    states: dict[str, str] = field(default_factory=dict)


def threshold_alarms() -> list[dict[str, Any]]:
    """Alarms whose truth a string-membership test gets wrong.

    Each entry carries `expected` -- the answer a real evaluator gives for
    `probe_state` -- so a test can compare it against `shipped_active_alarm`
    without restating the semantics.
    """
    return [
        {
            "id": "alarm-flow-high",
            "name": "Vorlauftemperatur zu hoch",
            "entity": "sensor.vorlauf_temperatur",
            "condition": {"operator": ">", "value": 80},
            "hysteresis": 3,
            "priority": "critical",
            "probe_state": "55",
            "expected": False,
            # 55 is well under 80, so the alarm is inactive. The shipped
            # evaluator says active, because "55" is not in its inactive list.
        },
        {
            "id": "alarm-flow-low",
            "name": "Vorlauftemperatur zu niedrig",
            "entity": "sensor.vorlauf_temperatur",
            "condition": {"operator": "<", "value": 40},
            "hysteresis": 2,
            "priority": "warning",
            "probe_state": "60",
            "expected": False,
        },
        {
            "id": "alarm-pressure",
            "name": "Anlagendruck kritisch",
            "entity": "sensor.anlagendruck",
            "condition": {"operator": "<", "value": 1.2},
            "hysteresis": 0.1,
            "priority": "critical",
            "probe_state": "2.4",
            "expected": False,
        },
        {
            "id": "alarm-pump-fault",
            "name": "Pumpe Störung",
            "entity": "binary_sensor.pumpe_stoerung",
            "active_states": ["on"],
            "priority": "fault",
            "probe_state": "on",
            "expected": True,
            # A membership alarm, where the two evaluators agree. It is here so
            # a test cannot pass by asserting that they always disagree.
        },
    ]


def hysteresis_sequence() -> list[tuple[str, bool]]:
    """A (state, expected_active) walk across a threshold of 80 with hysteresis 3.

    Rising crosses at 80; falling does not clear until below 77. A test that
    ignores `previous_active` chatters between 77 and 80 and this sequence says
    so.
    """
    return [
        ("70", False),
        ("79", False),
        ("81", True),
        ("79", True),   # still active: above 80 - 3
        ("78", True),
        ("76", False),  # cleared: below the hysteresis band
        ("79", False),  # does not re-arm until it crosses 80 again
        ("85", True),
    ]


def two_delays_on_one_entity() -> list[dict[str, Any]]:
    """Two alarms on one entity with different delays.

    One alarm cannot expose the loop-closure defect: with a single iteration the
    free variable happens to hold the right value. Two is the minimum, and the
    delays are far apart so a wrong binding is unmistakable rather than a
    timing argument.
    """
    return [
        {
            "id": "alarm-quick",
            "name": "Schnellmeldung",
            "entity": "sensor.vorlauf_temperatur",
            "condition": {"operator": ">", "value": 80},
            "delay_seconds": 5,
            "priority": "warning",
        },
        {
            "id": "alarm-slow",
            "name": "Dauermeldung",
            "entity": "sensor.vorlauf_temperatur",
            "condition": {"operator": ">", "value": 80},
            "delay_seconds": 300,
            "priority": "critical",
        },
    ]


def oscillating_transitions(delay_seconds: float = 60) -> list[tuple[float, bool]]:
    """A persistent fault whose sensor crosses the threshold faster than its delay.

    The condition is continuously true from t=0 in the sense that matters -- the
    plant is faulty the whole time -- but the state *changes* every 10 seconds,
    which is what the current implementation restarts on. The intended answer is
    `delay_seconds`; the naive one trails the final change in the window, and in
    a real plant there is no final change.
    """
    transitions: list[tuple[float, bool]] = []
    at = 0.0
    while at < delay_seconds * 4:
        transitions.append((at, True))
        at += 10.0
    return transitions


def suppression_cases(now: datetime) -> list[dict[str, Any]]:
    """Alarms in every suppression state, including one whose shelf expired.

    An expired shelf is the case that separates "shelving is implemented" from
    "shelving is stored": a stored field that nobody re-reads never expires.
    """
    return [
        {
            "id": "alarm-shelved",
            "name": "Geschelft",
            "entity": "binary_sensor.pumpe_stoerung",
            "active_states": ["on"],
            "priority": "warning",
            "shelved_until": (now + timedelta(days=2)).isoformat(),
            "shelved_by": "anna",
            "expected_suppression": "shelved",
        },
        {
            "id": "alarm-shelf-expired",
            "name": "Schelf abgelaufen",
            "entity": "binary_sensor.pumpe_stoerung",
            "active_states": ["on"],
            "priority": "warning",
            "shelved_until": (now - timedelta(hours=1)).isoformat(),
            "shelved_by": "anna",
            "expected_suppression": None,
        },
        {
            "id": "alarm-shelf-too-long",
            "name": "Schelf ueber dem Maximum",
            "entity": "binary_sensor.pumpe_stoerung",
            "active_states": ["on"],
            "priority": "warning",
            "shelved_until": (now + timedelta(days=90)).isoformat(),
            "shelved_by": "anna",
            "expected_refusal": "shelve_exceeds_maximum",
        },
        {
            "id": "alarm-acknowledged",
            "name": "Quittiert",
            "entity": "binary_sensor.pumpe_stoerung",
            "active_states": ["on"],
            "priority": "warning",
            "acknowledged": True,
            "expected_suppression": "acknowledged",
        },
        {
            "id": "alarm-maintenance",
            "name": "In Wartung",
            "entity": "binary_sensor.pumpe_stoerung",
            "active_states": ["on"],
            "priority": "warning",
            "maintenance": True,
            "expected_suppression": "maintenance",
        },
    ]


def legacy_severity_alarms() -> list[dict[str, Any]]:
    """One alarm per stored severity string, so no vocabulary is unrepresented."""
    return [
        {
            "id": f"alarm-severity-{severity}",
            "name": f"Schweregrad {severity}",
            "entity": "binary_sensor.pumpe_stoerung",
            "active_states": ["on"],
            "severity": severity,
        }
        for severity in LEGACY_SEVERITIES
    ]


def dst_schedules() -> list[dict[str, Any]]:
    """Schedules on both transition dates, plus a control on an ordinary day.

    `expected_status` names the answer the resolver must give. The control entry
    exists so a resolver that reports `nonexistent` for everything cannot pass.
    """
    return [
        {
            "id": "sched-spring-forward",
            "name": "Nachtabsenkung Zeitumstellung Fruehjahr",
            "kind": "instant",
            "days": [0, 1, 2, 3, 4, 5, 6],
            "time": TRANSITION_TIME,
            "service": "climate.set_temperature",
            "entity_id": "climate.heizkreis_1",
            "on_date": SPRING_FORWARD,
            "expected_status": "nonexistent",
            "expected_runs": 0,
        },
        {
            "id": "sched-fall-back",
            "name": "Nachtabsenkung Zeitumstellung Herbst",
            "kind": "instant",
            "days": [0, 1, 2, 3, 4, 5, 6],
            "time": TRANSITION_TIME,
            "service": "climate.set_temperature",
            "entity_id": "climate.heizkreis_1",
            "on_date": FALL_BACK,
            "expected_status": "ambiguous",
            "expected_runs": 1,
        },
        {
            "id": "sched-ordinary",
            "name": "Nachtabsenkung",
            "kind": "instant",
            "days": [0, 1, 2, 3, 4, 5, 6],
            "time": TRANSITION_TIME,
            "service": "climate.set_temperature",
            "entity_id": "climate.heizkreis_1",
            "on_date": "2027-06-15",
            "expected_status": "normal",
            "expected_runs": 1,
        },
        {
            "id": "sched-operating-period",
            "name": "Betriebszeit Buero",
            "kind": "interval",
            "binding": {"kind": "operating_period", "entity_id": "schedule.buero"},
            "on_date": "2027-06-15",
            "expected_status": "normal",
            "expected_runs": 0,
        },
    ]


def binding_cases() -> list[dict[str, Any]]:
    """Bindings whose capability must be read before an affordance is offered.

    The read-only calendar is the case Phase 4's control audit is the precedent
    for: an affordance whose feasibility was never checked fails at the service
    call, not at the request.
    """
    return [
        {
            "id": "binding-calendar-writable",
            "kind": "special_day",
            "entity_id": "calendar.betrieb",
            "supported_features": 7,  # CREATE | DELETE | UPDATE
            "expected_writable": True,
        },
        {
            "id": "binding-calendar-readonly",
            "kind": "holiday",
            "entity_id": "calendar.feiertage_extern",
            "supported_features": 0,
            "expected_writable": False,
            "expected_refusal": "calendar_cannot_create_events",
        },
        {
            "id": "binding-workday",
            "kind": "holiday",
            "entity_id": "binary_sensor.workday",
            "supported_features": 0,
            "expected_writable": False,
            "expected_refusal": "binding_is_read_only",
        },
        {
            "id": "binding-schedule-entity",
            "kind": "operating_period",
            "entity_id": "schedule.buero",
            "requires_admin": True,
            "expected_writable": True,
            "expected_refusal_for_non_admin": "requires_home_assistant_admin",
        },
    ]


def notification_policies() -> list[dict[str, Any]]:
    """Notification policies including the ones a default installation refuses."""
    return [
        {
            "id": "policy-default",
            "service": "",
            "expected_outcome": "no_target_configured",
        },
        {
            "id": "policy-unlisted",
            "service": "notify.mobile_app_phone",
            # `refused` is the declared member of NOTIFICATION_OUTCOMES; the
            # specific reason travels in the record's `error`, so the closed set
            # stays small and the explanation stays exact.
            "expected_outcome": "refused",
            # The project document is operator input. A service string in it is
            # not authorization, which is what D11 assumed.
        },
        {
            "id": "policy-allowed",
            "service": "glt_fake_notify.send",
            "data": {"target": "glt-test-recipient"},
            "expected_outcome": "delivered",
        },
        {
            "id": "policy-allowed-that-fails",
            "service": "glt_fake_notify.send",
            "data": {"target": "glt-test-recipient"},
            "fails": True,
            "expected_outcome": "failed",
            "expected_alarm_still_active": True,
        },
    ]


def build_corpus(now: datetime | None = None) -> AlarmCorpus:
    """Assemble the whole corpus as one project plus its entity states."""
    moment = now or datetime(2026, 9, 2, 12, 0, tzinfo=ZoneInfo(SITE_TIMEZONE))
    alarms = [
        *threshold_alarms(),
        *two_delays_on_one_entity(),
        *suppression_cases(moment),
        *legacy_severity_alarms(),
    ]
    project = {
        "id": "phase6-corpus",
        "name": "Phase-6 Alarmkorpus",
        "schema_version": 5,
        "config": {
            "timezone": SITE_TIMEZONE,
            "alarms": alarms,
            "schedules": dst_schedules(),
            "bindings": binding_cases(),
            "notifications": notification_policies(),
        },
    }
    states = {
        "sensor.vorlauf_temperatur": "55",
        "sensor.anlagendruck": "2.4",
        "binary_sensor.pumpe_stoerung": "on",
        "climate.heizkreis_1": "heat",
        "schedule.buero": "on",
        "calendar.betrieb": "off",
        "calendar.feiertage_extern": "off",
        "binary_sensor.workday": "on",
    }
    return AlarmCorpus(project=project, states=states)
