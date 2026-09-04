"""Absence belongs to the site, and a dead site stops costing (T9-13, T9-15)."""
from __future__ import annotations

import json

from custom_components.glt_flow_card import site_health
from custom_components.glt_flow_card.remote_fanout import SiteAnswer
from custom_components.glt_flow_card.site_health import COOLDOWN_SECONDS, SiteBreakers
from .site_factory import FakeClock

EFFECT_PREFIX = "PHASE9_HEALTH_EFFECTS "


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps(
        {"network": 0, "remote": 0, "service": 0, "socket": 0, **counts}, sort_keys=True,
    ))


def test_a_site_that_did_not_answer_contributes_no_entity_states():
    """T9-13, and the sharpest assertion in the phase.

    The shipped code wrote `{"state": "unavailable"}` for an entity it could not
    ask about. `unavailable` is a *real* Home Assistant state, so the entity we
    failed to read and the entity that is genuinely down produced the same word.
    """
    absent = SiteAnswer(site_id="b", state="unreachable", reason="timeout")
    assert site_health.site_answer_states(absent) == {}, (
        "a site that did not answer invented entity states"
    )


def test_a_genuinely_unavailable_remote_entity_is_still_unavailable():
    """The other direction, and it is what keeps the two distinguishable.

    A fix that simply dropped every `unavailable` would pass the test above and
    lose real information: a remote entity that *is* down is a fact the operator
    needs.
    """
    answered = SiteAnswer(
        site_id="a", state="healthy",
        states={"sensor.x": {"entity_id": "sensor.x", "state": "unavailable"}},
    )
    states = site_health.site_answer_states(answered)
    assert states["sensor.x"]["state"] == "unavailable"


def test_merging_keeps_absence_absent():
    """An entity missing from the merge is missing, not zero and not unavailable."""
    merged = site_health.merge_states([
        SiteAnswer(site_id="a", state="healthy",
                   states={"sensor.a": {"entity_id": "sensor.a", "state": "21"}}),
        SiteAnswer(site_id="b", state="unreachable", reason="timeout"),
    ])
    _emit(sites=2)
    assert set(merged) == {"sensor.a"}
    assert "sensor.b" not in merged


# --- The breaker (T9-15) ----------------------------------------------------


def test_a_breaker_opens_only_after_repeated_failures():
    """Three, not one. A single failure is ordinary on a network.

    Opening on one would make a brief blip look like an outage for the whole
    cooldown, and an operator would learn to distrust the indicator.
    """
    clock = FakeClock()
    breakers = SiteBreakers(monotonic=clock.monotonic)
    for _ in range(2):
        breakers.record_failure("s")
        assert not breakers.should_skip("s")
    breakers.record_failure("s")
    assert breakers.should_skip("s"), "three consecutive failures did not open the breaker"


def test_an_open_breaker_says_it_is_open():
    """`circuit_open` and `unreachable` are different facts.

    One has been failing for a while; the other just failed. A view showing them
    identically hides how long the problem has existed.
    """
    clock = FakeClock()
    breakers = SiteBreakers(monotonic=clock.monotonic)
    for _ in range(3):
        breakers.record_failure("s")
    described = breakers.describe("s")
    assert described["open"] is True
    assert described["consecutive_failures"] == 3


def test_the_breaker_half_opens_after_the_cooldown_and_admits_one_probe():
    """A burst of probes is the load the breaker exists to prevent, in a new shape."""
    clock = FakeClock()
    breakers = SiteBreakers(monotonic=clock.monotonic)
    for _ in range(3):
        breakers.record_failure("s")

    assert breakers.should_skip("s")
    clock.advance(COOLDOWN_SECONDS + 1)
    # Exactly one probe gets through...
    assert not breakers.should_skip("s")
    # ...and the next is still skipped, so a burst cannot form.
    assert breakers.should_skip("s")


def test_a_success_closes_the_breaker_completely():
    """Not a decrement.

    A site that answers is working; carrying old failures forward would keep it
    one blip away from opening for no reason anybody could see.
    """
    clock = FakeClock()
    breakers = SiteBreakers(monotonic=clock.monotonic)
    for _ in range(3):
        breakers.record_failure("s")
    clock.advance(COOLDOWN_SECONDS + 1)
    breakers.should_skip("s")  # take the probe
    breakers.record_success("s")

    assert not breakers.should_skip("s")
    assert breakers.describe("s") == {
        "consecutive_failures": 0, "open": False, "opened_at": None, "probing": False,
    }


def test_a_failure_during_the_probe_reopens_rather_than_accumulating():
    clock = FakeClock()
    breakers = SiteBreakers(monotonic=clock.monotonic)
    for _ in range(3):
        breakers.record_failure("s")
    clock.advance(COOLDOWN_SECONDS + 1)
    breakers.should_skip("s")
    breakers.record_failure("s")
    assert breakers.should_skip("s"), "a failed probe did not re-close the gate"


def test_breakers_are_per_site():
    """One dead site must not silence a healthy neighbour."""
    clock = FakeClock()
    breakers = SiteBreakers(monotonic=clock.monotonic)
    for _ in range(3):
        breakers.record_failure("dead")
    assert breakers.should_skip("dead")
    assert not breakers.should_skip("alive")
