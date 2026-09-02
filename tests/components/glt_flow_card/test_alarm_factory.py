"""The corpus must actually defeat the evaluators it claims to defeat.

`cad_factory.py` established the rule in Phase 5: a corpus that asserts nothing
about the naive implementation is a corpus that might be describing it. Every
claim the Phase-6 audit makes about a defect is executed here against the
reproduced defect, so the phase starts from measured disagreement rather than
from a reading of the source.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from custom_components.glt_flow_card import _state_active

from .alarm_factory import (
    FALL_BACK,
    LEGACY_SEVERITIES,
    SITE_TIMEZONE,
    SPRING_FORWARD,
    TRANSITION_TIME,
    anchored_delay,
    binding_cases,
    build_corpus,
    dst_schedules,
    hysteresis_sequence,
    last_delay_wins,
    legacy_severity_alarms,
    notification_policies,
    oscillating_transitions,
    restarting_delay,
    shipped_active_alarm,
    suppression_cases,
    threshold_alarms,
    two_delays_on_one_entity,
)


def test_the_shipped_evaluator_disagrees_on_at_least_three_fixtures() -> None:
    disagreements = [
        alarm["id"]
        for alarm in threshold_alarms()
        if shipped_active_alarm(alarm["probe_state"], alarm) != alarm["expected"]
    ]
    assert len(disagreements) >= 3, disagreements


def test_the_backend_evaluator_gives_the_expected_answer() -> None:
    # The corpus's `expected` column must be the *backend's* answer, not an
    # opinion. If these ever diverge the corpus is wrong, not the engine.
    for alarm in threshold_alarms():
        assert _state_active(alarm["probe_state"], alarm) is alarm["expected"], alarm["id"]


def test_a_membership_alarm_is_present_so_disagreement_is_not_universal() -> None:
    # A test asserting the two evaluators always disagree would pass on a corpus
    # that contains only threshold alarms, and would prove nothing about the
    # cases where the card is right.
    agreeing = [
        alarm["id"]
        for alarm in threshold_alarms()
        if shipped_active_alarm(alarm["probe_state"], alarm) == alarm["expected"]
    ]
    assert agreeing, "every fixture disagrees; the corpus cannot detect a false positive"


def test_hysteresis_needs_the_previous_state() -> None:
    previous = False
    for state, expected in hysteresis_sequence():
        active = _state_active(state, threshold_alarms()[0], previous)
        assert active is expected, f"{state} -> {active}, expected {expected}"
        previous = active


def test_hysteresis_chatters_without_the_previous_state() -> None:
    # The same walk with `previous_active` forced to False. If this agreed with
    # the walk above, the sequence would not be exercising hysteresis at all.
    stateless = [
        _state_active(state, threshold_alarms()[0], False)
        for state, _ in hysteresis_sequence()
    ]
    stateful = [expected for _, expected in hysteresis_sequence()]
    assert stateless != stateful


def test_two_delays_on_one_entity_expose_the_closure_defect() -> None:
    alarms = two_delays_on_one_entity()
    configured = {alarm["id"]: alarm["delay_seconds"] for alarm in alarms}
    assert len(set(configured.values())) == 2, "one delay cannot show the defect"
    scheduled = last_delay_wins(alarms)
    assert scheduled != configured
    assert len(set(scheduled.values())) == 1, "the naive binding must collapse both"


def test_the_restarting_delay_trails_the_last_change() -> None:
    delay = 60.0
    transitions = oscillating_transitions(delay)
    intended = anchored_delay(transitions, delay)
    naive = restarting_delay(transitions, delay)
    assert intended == delay, intended
    assert naive is not None and naive > intended, (naive, intended)
    # The gap is the whole window, not a rounding difference: the naive answer
    # trails the last change in the window, and in a plant there is no last
    # change.
    assert naive - intended >= delay * 3


def test_a_longer_oscillation_drags_the_naive_answer_further() -> None:
    # The property that makes it a defect rather than a slow path: the lateness
    # grows with the fault's duration. A fault that persists twice as long
    # annunciates twice as late.
    short = restarting_delay(oscillating_transitions(30), 30)
    long = restarting_delay(oscillating_transitions(120), 120)
    assert short is not None and long is not None
    assert long > short * 2


def test_every_suppression_state_is_represented() -> None:
    now = datetime(2026, 9, 2, 12, 0, tzinfo=ZoneInfo(SITE_TIMEZONE))
    cases = suppression_cases(now)
    suppressions = {case.get("expected_suppression") for case in cases}
    assert {"shelved", "acknowledged", "maintenance"} <= suppressions
    # An expired shelf is the case that separates "shelving is implemented" from
    # "shelving is stored": a field nobody re-reads never expires.
    assert None in suppressions, "no expired shelf in the corpus"
    assert any(case.get("expected_refusal") for case in cases), "no over-long shelf"


def test_every_stored_severity_string_appears() -> None:
    present = {alarm["severity"] for alarm in legacy_severity_alarms()}
    assert present == set(LEGACY_SEVERITIES)
    # `critical` is the one the navigation roll-up counts in no branch today.
    assert "critical" in present


def test_both_dst_transitions_carry_an_entry_in_the_affected_hour() -> None:
    schedules = {entry["id"]: entry for entry in dst_schedules()}
    assert schedules["sched-spring-forward"]["on_date"] == SPRING_FORWARD
    assert schedules["sched-fall-back"]["on_date"] == FALL_BACK
    for key in ("sched-spring-forward", "sched-fall-back"):
        assert schedules[key]["time"] == TRANSITION_TIME
    assert schedules["sched-spring-forward"]["expected_status"] == "nonexistent"
    assert schedules["sched-fall-back"]["expected_status"] == "ambiguous"
    # A control on an ordinary day, so a resolver that answers "nonexistent" to
    # everything cannot pass.
    assert schedules["sched-ordinary"]["expected_status"] == "normal"


def test_the_transition_dates_are_real_for_the_site_timezone() -> None:
    # The dates are asserted against the zone rather than trusted, because a
    # corpus whose "transition date" is an ordinary day proves nothing.
    zone = ZoneInfo(SITE_TIMEZONE)
    hour, minute = (int(part) for part in TRANSITION_TIME.split(":"))

    def exists(date: str) -> bool:
        year, month, day = (int(part) for part in date.split("-"))
        moment = datetime(year, month, day, hour, minute, tzinfo=zone)
        return moment == moment.astimezone(ZoneInfo("UTC")).astimezone(zone)

    def ambiguous(date: str) -> bool:
        year, month, day = (int(part) for part in date.split("-"))
        moment = datetime(year, month, day, hour, minute, tzinfo=zone)
        other = moment.replace(fold=not moment.fold)
        return exists(date) and moment.utcoffset() != other.utcoffset()

    assert not exists(SPRING_FORWARD), f"{TRANSITION_TIME} exists on {SPRING_FORWARD}"
    assert ambiguous(FALL_BACK), f"{TRANSITION_TIME} is not ambiguous on {FALL_BACK}"
    assert exists("2027-06-15") and not ambiguous("2027-06-15")


def test_a_calendar_without_create_event_is_in_the_corpus() -> None:
    bindings = {case["id"]: case for case in binding_cases()}
    readonly = bindings["binding-calendar-readonly"]
    assert readonly["supported_features"] == 0
    assert readonly["expected_writable"] is False
    assert readonly["expected_refusal"] == "calendar_cannot_create_events"
    # And a writable one, so "everything is read-only" cannot pass.
    assert bindings["binding-calendar-writable"]["expected_writable"] is True
    # The admin gate is a distinct refusal from the capability gate.
    assert (
        bindings["binding-schedule-entity"]["expected_refusal_for_non_admin"]
        != readonly["expected_refusal"]
    )


def test_the_notification_policies_cover_the_default_and_the_unlisted_case() -> None:
    outcomes = {policy["expected_outcome"] for policy in notification_policies()}
    assert {"no_target_configured", "service_not_allowed", "delivered", "failed"} == outcomes
    failing = next(p for p in notification_policies() if p["expected_outcome"] == "failed")
    # The rule that makes the feature honest: a delivery failure never removes,
    # downgrades or hides the alarm.
    assert failing["expected_alarm_still_active"] is True


def test_the_corpus_assembles_with_states_for_every_referenced_entity() -> None:
    corpus = build_corpus()
    config = corpus.project["config"]
    referenced = {
        alarm["entity"] for alarm in config["alarms"] if alarm.get("entity")
    }
    referenced |= {
        entry["entity_id"] for entry in config["schedules"] if entry.get("entity_id")
    }
    referenced |= {
        entry["binding"]["entity_id"]
        for entry in config["schedules"]
        if entry.get("binding")
    }
    referenced |= {case["entity_id"] for case in config["bindings"]}
    missing = referenced - set(corpus.states)
    assert not missing, f"no seeded state for {sorted(missing)}"
    assert corpus.project["schema_version"] == 5
    assert config["timezone"] == SITE_TIMEZONE
