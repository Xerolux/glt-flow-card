"""Many sites, bounded, within one deadline (T9-01, T9-02, T9-17).

The shipped read was `for entity_id in entity_ids[:200]` with an awaited request
and a 15-second timeout inside: two hundred entities against one unresponsive
site is fifty minutes inside a websocket handler.

Every test here proves a bound **without sleeping**. A test that waits out a
deadline takes as long as the deadline, and a suite that takes minutes to prove
a timeout is a suite somebody eventually deletes — at which point the bound stops
being tested at all.
"""
from __future__ import annotations

import asyncio
import json

import pytest

from custom_components.glt_flow_card import remote_fanout
from custom_components.glt_flow_card.remote_fanout import MAX_ENTITIES, read_sites
from tests.components.glt_flow_card.site_factory import (
    FakeClock,
    FakeSite,
    FakeTransport,
    LiveSocketReached,
    SiteLedger,
)

EFFECT_PREFIX = "PHASE9_FANOUT_EFFECTS "


def _emit(ledger, **extra):
    print(EFFECT_PREFIX + json.dumps({**ledger.counts(), **extra}, sort_keys=True))


def _states(prefix, count):
    return {f"sensor.{prefix}_{index}": {"state": str(index)} for index in range(count)}


def _harness(sites):
    clock = FakeClock()
    ledger = SiteLedger()
    transport = FakeTransport(sites, clock=clock, ledger=ledger)
    return clock, ledger, transport


async def test_one_request_per_site_regardless_of_entity_count():
    """T9-01. The shipped code asked once per entity.

    `GET /api/states` returns everything in one response, and over a slow link
    the round trips *are* the cost. Two hundred entities must not be two hundred
    requests.
    """
    sites = [FakeSite(site_id="a", states=_states("a", 200)),
             FakeSite(site_id="b", states=_states("b", 200))]
    clock, ledger, transport = _harness(sites)

    result = await read_sites(
        ["a", "b"], list(_states("a", 200)) + list(_states("b", 200)),
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )

    _emit(ledger, entities=400)
    assert len(ledger.requests_for("a")) == 1, (
        f"site a took {len(ledger.requests_for('a'))} requests for 200 entities"
    )
    assert len(ledger.requests_for("b")) == 1
    assert result.complete
    assert len(result.answers[0].states) == 200


async def test_sites_are_asked_concurrently_up_to_a_declared_bound():
    """Concurrency is a configured number, not a literal buried in a loop."""
    sites = [FakeSite(site_id=f"s{i}", states=_states(f"s{i}", 2)) for i in range(8)]
    clock, ledger, transport = _harness(sites)

    inflight = {"now": 0, "peak": 0}

    async def counting_fetch(site_id, timeout):
        inflight["now"] += 1
        inflight["peak"] = max(inflight["peak"], inflight["now"])
        try:
            await asyncio.sleep(0)  # yield, so overlap is observable
            return await transport.get_states(site_id, timeout=timeout)
        finally:
            inflight["now"] -= 1

    await read_sites(
        [site.site_id for site in sites], [],
        fetch=counting_fetch, concurrency=3, monotonic=clock.monotonic,
    )
    _emit(ledger, peak=inflight["peak"])
    assert inflight["peak"] <= 3, f"{inflight['peak']} sites were in flight at once"


async def test_one_hanging_site_does_not_hold_the_others():
    """T9-02. The total deadline belongs to the request.

    Bounded concurrency alone still lets n sites times a timeout accumulate, and
    a person waiting for a screen has a budget that does not depend on how many
    sites a colleague configured.
    """
    sites = [
        FakeSite(site_id="fast", states=_states("f", 3), latency=0.01),
        FakeSite(site_id="slow", behaviour="timeout", latency=99.0),
        FakeSite(site_id="other", states=_states("o", 3), latency=0.01),
    ]
    clock, ledger, transport = _harness(sites)

    async def fetch(site_id, timeout):
        if site_id == "slow":
            # Hangs rather than sleeping for real time: the point is that the
            # deadline cuts it, not that the test waits.
            await asyncio.Event().wait()
        return await transport.get_states(site_id, timeout=timeout)

    result = await read_sites(
        ["fast", "slow", "other"], [], fetch=fetch,
        total_deadline=0.05, site_timeout=10.0, monotonic=clock.monotonic,
    )

    _emit(ledger)
    assert result.deadline_reached
    # The healthy sites are still there. Failing the whole roll-up would make
    # two working plants invisible, which is worse than the missing one.
    assert result.answered == ["fast", "other"]
    absent = {entry["site_id"]: entry for entry in result.absent}
    assert absent["slow"]["reason"] == "deadline_reached"
    assert absent["slow"]["state"] == "unreachable"


async def test_a_site_that_times_out_is_absent_with_a_reason_not_an_error():
    """Partial is an answer. The whole request must not fail."""
    sites = [FakeSite(site_id="a", states=_states("a", 2)),
             FakeSite(site_id="b", behaviour="timeout")]
    clock, ledger, transport = _harness(sites)

    result = await read_sites(
        ["a", "b"], [],
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )
    _emit(ledger)
    assert result.answered == ["a"]
    assert result.absent == [{"reason": "timeout", "site_id": "b", "state": "unreachable"}]
    assert not result.complete


@pytest.mark.parametrize(
    ("behaviour", "reason"),
    [
        ("refused", "connection_refused"),
        ("unauthorized", "unauthorized"),
        ("malformed", "malformed_response"),
        ("timeout", "timeout"),
    ],
)
async def test_every_failure_shape_maps_to_a_declared_reason(behaviour, reason):
    """No `str(err)` anywhere. The exception carries the host; the reason does not."""
    sites = [FakeSite(site_id="s", behaviour=behaviour)]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        ["s"], [], fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )
    assert result.absent[0]["reason"] == reason


async def test_a_site_whose_breaker_is_open_is_not_asked_at_all():
    """`circuit_open` is distinct from `unreachable`, and cheaper.

    A site that is down should stop costing a request per client per view.
    """
    sites = [FakeSite(site_id="a", states=_states("a", 2)), FakeSite(site_id="b")]
    clock, ledger, transport = _harness(sites)

    result = await read_sites(
        ["a", "b"], [],
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        is_open=lambda site_id: site_id == "b",
        monotonic=clock.monotonic,
    )
    _emit(ledger)
    assert ledger.requests_for("b") == [], "an open breaker still cost a request"
    absent = {entry["site_id"]: entry for entry in result.absent}
    assert absent["b"]["state"] == "circuit_open"
    assert absent["b"]["state"] != "unreachable", (
        "a site broken for a while and one that just failed read identically"
    )


async def test_a_slow_site_still_answers_and_is_marked_slow():
    """`slow` is an answer. Treating it as a failure would discard real data."""
    sites = [FakeSite(site_id="s", states=_states("s", 2), latency=5.0)]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        ["s"], [], fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        site_timeout=10.0, latency_budget=1.0, monotonic=clock.monotonic,
    )
    assert result.answers[0].state == "slow"
    assert result.answers[0].answered
    assert result.answers[0].states


async def test_latency_travels_with_every_answer():
    """A value with no age reads like a current one."""
    sites = [FakeSite(site_id="s", states=_states("s", 1), latency=0.4)]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        ["s"], [], fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )
    assert result.answers[0].latency is not None
    assert result.answers[0].latency > 0


# --- Truncation says so (T9-17) --------------------------------------------


async def test_an_over_long_entity_list_says_it_was_truncated():
    """Third occurrence of this shape: Phase 7's rows, Phase 8's suggestions, now this."""
    sites = [FakeSite(site_id="s", states=_states("s", 3))]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        ["s"], [f"sensor.n{i}" for i in range(MAX_ENTITIES + 50)],
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )
    assert result.truncated is True
    assert result.limit == MAX_ENTITIES


async def test_a_request_within_the_limit_does_not_claim_truncation():
    sites = [FakeSite(site_id="s", states=_states("s", 3))]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        ["s"], ["sensor.s_0"],
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )
    assert result.truncated is False


# --- The fixture is the only network ---------------------------------------


async def test_reaching_a_real_host_raises_rather_than_being_recorded():
    """By the time a ledger could be read, the request has gone out with a token."""
    ledger = SiteLedger()
    with pytest.raises(LiveSocketReached):
        ledger.record(site_id="s", host="real-site.example", path="/api/states")


def test_the_failure_classifier_covers_every_declared_reason_it_can_produce():
    """A reason the classifier can return that the vocabulary does not declare
    would reach a surface as an unknown word."""
    from custom_components.glt_flow_card.site_vocabulary import REMOTE_FAILURES

    produced = {
        remote_fanout.classify_failure(error)
        for error in (
            TimeoutError(), ConnectionRefusedError(), PermissionError(),
            ValueError(), RuntimeError(),
        )
    }
    assert produced <= set(REMOTE_FAILURES), f"{produced - set(REMOTE_FAILURES)} is undeclared"
