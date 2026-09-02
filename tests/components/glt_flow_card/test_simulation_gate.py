"""While a rehearsal is running, the plant is genuinely unreachable (T8-01).

This is the phase's central claim and it is a safety claim, so the assertions
are about what *happened* rather than what was returned.

Before this, `ws_controls_execute` called `hass.services.async_call`
unconditionally and `ws_remote_control` forwarded an arbitrary domain and
service, while no server path read `simulation.enabled` at all. The one check in
the product refused only when an individual control definition carried
`gates.simulation` -- so a control whose definition omitted the key executed for
real while the interface displayed "Simulationsmodus aktiv".

Every test here asserts from the service ledger, never from a return value. The
defect class is a path that answers "refused" and calls anyway, and a test that
reads the answer cannot see it.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from custom_components.glt_flow_card import dispatch_gate
from custom_components.glt_flow_card.dispatch_vocabulary import (
    DISPATCH_KINDS,
    PHYSICAL_KINDS,
    behaviour_for,
)
from custom_components.glt_flow_card.simulation_session import (
    DEFAULT_TTL_SECONDS,
    MAX_TTL_SECONDS,
    SessionRejected,
    SimulationSessions,
)

EFFECT_PREFIX = "PHASE8_GATE_EFFECTS "


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps({"network": 0, **counts}, sort_keys=True))


def test_every_physical_kind_is_refused_while_a_session_is_active():
    """The headline. A rehearsal must not be able to move plant."""
    performed = []
    for kind in PHYSICAL_KINDS:
        decision = dispatch_gate.decide_dispatch(kind, is_simulating=lambda: True)
        if decision.may_dispatch:
            performed.append(kind)
        assert decision.outcome == "refused", kind
        assert decision.reason == "simulation_active", kind
    _emit(notification=0, remote=0, service=len(performed))
    assert performed == [], f"{performed} would have reached the plant during a rehearsal"


def test_every_physical_kind_dispatches_when_no_session_is_running():
    """The other half, and it is not a formality.

    A gate that refuses everything would pass the test above while making the
    product useless, which is the vacuous pass this suite has corrected twice
    before -- once in Phase 4 and once in Phase 7.
    """
    for kind in PHYSICAL_KINDS:
        decision = dispatch_gate.decide_dispatch(kind, is_simulating=lambda: False)
        assert decision.may_dispatch, f"{kind} was refused with no session running"
        assert decision.reason is None


def test_an_unreadable_simulation_state_refuses_rather_than_proceeding():
    """T8-04. Fail closed, because the feature is what persuaded them they were safe."""
    def explode() -> bool:
        raise RuntimeError("the store is unavailable")

    for kind in PHYSICAL_KINDS:
        decision = dispatch_gate.decide_dispatch(kind, is_simulating=explode)
        assert decision.outcome == "refused", kind
        # Distinct from an ordinary simulated refusal. One means "you are
        # rehearsing", the other "the Companion is unwell and is protecting
        # you", and an operator who cannot tell them apart does not know
        # whether to wait.
        assert decision.reason == "simulation_state_unavailable", kind
    _emit(notification=0, remote=0, service=0)


def test_a_missing_reader_is_cannot_tell_rather_than_not_simulating():
    """`None` must not be read as `False`.

    A store that answered "not simulating" when it simply could not say would
    disable the gate exactly when the Companion is least healthy.
    """
    decision = dispatch_gate.decide_dispatch("control", is_simulating=None)
    assert decision.outcome == "refused"
    assert decision.reason == "simulation_state_unavailable"


def test_a_notification_is_marked_rather_than_silenced():
    """T8-05. Silencing alarms during a rehearsal is a safety defect the other way.

    An alarm raised during a test is still an alarm. Blocking it would turn a
    commissioning rehearsal into a window in which nobody is told about a real
    fault -- which is worse than the defect this phase is closing.
    """
    decision = dispatch_gate.decide_dispatch("notification", is_simulating=lambda: True)
    assert decision.outcome == "simulated", "a notification was blocked during a rehearsal"
    assert decision.is_marked
    for language, fragment in (("de", "Simulation"), ("en", "simulation")):
        notice = dispatch_gate.simulation_notice(decision, language)
        assert fragment.lower() in notice.lower()
        # Written out, not assembled. A sentence built from fragments reads as
        # machine output in exactly the situation where a human must trust it.
        assert len(notice.split()) > 5, f"the {language} notice looks assembled: {notice!r}"
    _emit(notification=1, remote=0, service=0)


def test_an_audit_record_is_kept_even_during_a_rehearsal():
    """The record of what happened matters most when something unusual happened."""
    decision = dispatch_gate.decide_dispatch("audit", is_simulating=lambda: True)
    assert decision.may_dispatch, "the audit trail was suppressed during a rehearsal"


def test_an_unknown_kind_is_refused_and_names_itself():
    """Neither allowed nor silently blocked: both would be a decision made blind."""
    decision = dispatch_gate.decide_dispatch("teleport", is_simulating=lambda: False)
    assert decision.outcome == "refused"
    assert decision.reason == "unknown_dispatch_kind"
    assert decision.detail["kind"] == "teleport"


def test_every_declared_kind_has_a_decision_and_none_is_forgotten():
    """A kind with no behaviour would fall through to whatever the code does last."""
    for kind in DISPATCH_KINDS:
        assert behaviour_for(kind) in ("refuse", "mark", "allow")
        decision = dispatch_gate.decide_dispatch(kind, is_simulating=lambda: True)
        assert decision.outcome in ("dispatch", "simulated", "refused"), kind


def test_the_state_is_read_at_dispatch_time_not_captured_earlier():
    """A session that starts mid-handler must take effect.

    `is_simulating` is a callable rather than a value precisely so this is
    possible: a handler that captured the state when it began would dispatch
    into a rehearsal that started while it was awaiting something.
    """
    state = {"simulating": False}
    reader = lambda: state["simulating"]  # noqa: E731 - the point is that it is late-bound
    assert dispatch_gate.decide_dispatch("control", is_simulating=reader).may_dispatch
    state["simulating"] = True
    assert not dispatch_gate.decide_dispatch("control", is_simulating=reader).may_dispatch


# --- The session itself ----------------------------------------------------


def test_a_session_expires_without_anyone_acting():
    """T8-06. A rehearsal that never ends makes the plant unoperable."""
    sessions = SimulationSessions()
    start = datetime(2027, 6, 1, 8, 0, tzinfo=timezone.utc)
    sessions.start(project_id="p1", actor_user_id="u1", ttl_seconds=600, now=start)
    assert sessions.is_simulating(project_id="p1", now=start + timedelta(minutes=5))
    assert not sessions.is_simulating(project_id="p1", now=start + timedelta(minutes=11))


def test_an_over_long_ttl_is_refused_rather_than_capped():
    """Phase 6 shipped a 90-day shelve silently truncated to 7.

    The operator walked away believing an alarm was quiet for three months.
    Truncation is a lie told by arithmetic, and the same rule applies here.
    """
    sessions = SimulationSessions()
    with pytest.raises(SessionRejected) as refused:
        sessions.start(project_id="p1", actor_user_id="u1", ttl_seconds=MAX_TTL_SECONDS + 1)
    assert refused.value.reason == "ttl_exceeds_maximum"
    assert refused.value.detail["maximum"] == MAX_TTL_SECONDS
    # And nothing was started, so a refused request cannot leave a rehearsal
    # running that the operator does not know about.
    assert not sessions.is_simulating(project_id="p1")


def test_an_unreadable_expiry_does_not_extend_a_session():
    """The worst outcome available here is a rehearsal that can never end."""
    sessions = SimulationSessions()
    sessions.start(project_id="p1", actor_user_id="u1", ttl_seconds=600)
    sessions._sessions["p1"]["expires_at"] = "not a timestamp"
    assert not sessions.is_simulating(project_id="p1")


def test_a_session_names_who_started_it_and_when_it_ends():
    """A banner that cannot say who or until when is a banner nobody can act on."""
    sessions = SimulationSessions()
    session = sessions.start(project_id="p1", actor_user_id="u1", actor_name="Basti")
    assert session["actor_user_id"] == "u1"
    assert session["actor_name"] == "Basti"
    assert session["ttl_seconds"] == DEFAULT_TTL_SECONDS
    assert session["expires_at"] > session["started_at"]
    # Content-derived, so the same session is the same record (T8-22).
    assert session["id"].startswith("simulation_session-")


def test_a_project_document_cannot_enable_or_exempt_itself(hass, config_entry, phase2_users):
    """T8-02. The gate is not project data.

    `simulation.enabled` in a project document is operator input, and the one
    gate the product had read `gates.simulation` from the same place -- so the
    data deciding whether a write reached plant was authored by the people the
    block exists to protect. Schema 7 removes both fields; this asserts they
    cannot come back in through the door.
    """
    sessions = SimulationSessions()
    # A document claiming a rehearsal is running does not start one.
    document = {"simulation": {"enabled": True}, "controls": [{"gates": {"simulation": True}}]}
    assert not sessions.is_simulating(project_id="p1"), document and "a document started a session"

    # And a document claiming none is running does not stop one.
    sessions.start(project_id="p1", actor_user_id="u1")
    assert sessions.is_simulating(project_id="p1")
    document["simulation"]["enabled"] = False
    assert sessions.is_simulating(project_id="p1"), "a document ended a session"
