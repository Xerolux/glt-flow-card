"""The simulation session: owned, bounded, and ending by itself (T8-02, T8-06).

`simulation.enabled` lived in the **project document**, which is operator input,
and the one gate the product had read `gates.simulation` from the same place. So
the data deciding whether a write reached plant was authored by the people the
block exists to protect. Phase 6 established the rule after finding a
notification service name in a project document acting as an authorization; this
is that rule with plant writes behind it.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from custom_components.glt_flow_card.simulation_session import (
    DEFAULT_TTL_SECONDS,
    MAX_TTL_SECONDS,
    SessionRejected,
    SimulationSessions,
)

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
