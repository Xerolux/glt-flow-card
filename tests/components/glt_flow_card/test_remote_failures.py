"""Failures say little, and credentials say nothing (T9-06, T9-07).

`connection.send_error(msg["id"], "remote_failed", str(err))` returned the
exception, and `aiohttp` connection errors carry the host and port they failed to
reach. So a caller could enumerate internal topology by triggering failures — and
an error string is also an *interface*, one that changes with a library version.

The credential half is asserted by search rather than by inspection. A claim that
a secret does not leak is worth exactly as much as the search that looked for it,
which is why the sentinel token is a distinctive string rather than something
like "secret" that would match ordinary prose.
"""
from __future__ import annotations

import json

import pytest

from custom_components.glt_flow_card import remote_fanout, site_destinations
from custom_components.glt_flow_card.remote_fanout import read_sites
from custom_components.glt_flow_card.site_vocabulary import (
    REMOTE_FAILURES,
    outcome_for_failure,
)
from tests.components.glt_flow_card.site_factory import (
    SENTINEL_TOKEN,
    FakeClock,
    FakeSite,
    FakeTransport,
    SiteLedger,
)

EFFECT_PREFIX = "PHASE9_FAILURE_EFFECTS "


def _emit(ledger, **extra):
    print(EFFECT_PREFIX + json.dumps({**ledger.counts(), **extra}, sort_keys=True))


def _harness(sites):
    clock = FakeClock()
    ledger = SiteLedger()
    return clock, ledger, FakeTransport(sites, clock=clock, ledger=ledger)


async def test_no_failure_reason_carries_a_host_or_a_port():
    """These reasons reach the browser."""
    sites = [
        FakeSite(site_id="refused", behaviour="refused"),
        FakeSite(site_id="unauth", behaviour="unauthorized"),
        FakeSite(site_id="bad", behaviour="malformed"),
        FakeSite(site_id="slow", behaviour="timeout"),
    ]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        [site.site_id for site in sites], [],
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )
    _emit(ledger, sites=len(sites))

    for entry in result.absent:
        reason = entry["reason"]
        assert reason in REMOTE_FAILURES, f"{reason} is not a declared reason"
        # The fixture's exceptions deliberately contain the host and, in the
        # unauthorized case, the token. None of it may survive into the reason.
        assert "glt-fake-site" not in reason
        assert "8123" not in reason
        assert SENTINEL_TOKEN not in reason


async def test_the_sentinel_token_appears_in_no_output_of_any_remote_path():
    """T9-07, asserted by search.

    The fixture's `unauthorized` site raises an exception whose text *contains*
    the token — deliberately, so that a path returning `str(err)` would fail
    here rather than pass by never being tested.
    """
    sites = [
        FakeSite(site_id="ok", states={"sensor.a": {"state": "1"}}),
        FakeSite(site_id="unauth", behaviour="unauthorized"),
        FakeSite(site_id="refused", behaviour="refused"),
        FakeSite(site_id="slow", behaviour="timeout"),
        FakeSite(site_id="bad", behaviour="malformed"),
    ]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        [site.site_id for site in sites], [],
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )

    rendered = json.dumps({
        "absent": result.absent,
        "answered": result.answered,
        "answers": [
            {"latency": a.latency, "reason": a.reason, "site_id": a.site_id,
             "state": a.state, "states": a.states}
            for a in result.answers
        ],
        "deadline_reached": result.deadline_reached,
        "limit": result.limit,
        "truncated": result.truncated,
    })
    _emit(ledger, searched_bytes=len(rendered))
    assert SENTINEL_TOKEN not in rendered, "a site token reached the result"
    assert "Bearer" not in rendered


async def test_the_failure_branches_are_actually_exercised():
    """The half that stops the search above being vacuous.

    A search for a secret across an output that was never produced finds
    nothing, and looks exactly like a search that found nothing because there
    was nothing to find.
    """
    sites = [
        FakeSite(site_id="unauth", behaviour="unauthorized"),
        FakeSite(site_id="refused", behaviour="refused"),
        FakeSite(site_id="bad", behaviour="malformed"),
    ]
    clock, ledger, transport = _harness(sites)
    result = await read_sites(
        [site.site_id for site in sites], [],
        fetch=lambda site_id, timeout: transport.get_states(site_id, timeout=timeout),
        monotonic=clock.monotonic,
    )
    reasons = {entry["reason"] for entry in result.absent}
    assert reasons == {"unauthorized", "connection_refused", "malformed_response"}, (
        "not every failure branch ran, so the leak search proved nothing"
    )


def test_a_destination_refusal_reason_carries_no_address():
    """An attacker probing destinations learns which addresses exist from the
    difference between "not allowlisted" and "not routable" — so neither reason
    may name one."""
    with pytest.raises(site_destinations.DestinationRefused) as refused:
        site_destinations.validate_site(
            {"id": "s", "url": "https://internal.corp.example:8123/", "token": SENTINEL_TOKEN},
            allowlist=["site-a.example"],
        )
    assert SENTINEL_TOKEN not in refused.value.reason
    assert "internal" not in refused.value.reason
    assert "8123" not in refused.value.reason


def test_the_exception_is_still_available_server_side():
    """Not returned is not the same as not recorded.

    An operator reading logs needs the detail the browser must not receive.
    """
    with pytest.raises(site_destinations.DestinationRefused) as refused:
        site_destinations.validate_site(
            {"id": "s", "url": "https://internal.corp.example/", "token": "t"},
            allowlist=["site-a.example"],
        )
    assert refused.value.detail["host"] == "internal.corp.example"


# --- A timeout is not a failure (T9-12's rule, asserted at its source) -------


def test_a_timeout_implies_effect_unknown_rather_than_failed():
    """The distinction matters more over a network, not less.

    A timeout on a POST is the canonical case where the service may well have
    run, and reporting it as failed invites a retry — which is how plant gets
    operated twice.
    """
    assert outcome_for_failure("timeout") == "effect_unknown"
    assert outcome_for_failure("deadline_reached") == "effect_unknown"


def test_a_refused_connection_is_a_failure_because_nothing_was_sent():
    """The other side of the distinction, and it is what keeps it meaningful.

    If everything were `effect_unknown`, the operator could never be told that
    a command definitely did not run.
    """
    assert outcome_for_failure("connection_refused") == "failed"
    assert outcome_for_failure("unauthorized") == "failed"


def test_an_undeclared_failure_reason_is_refused():
    with pytest.raises(ValueError, match="unknown_remote_failure"):
        outcome_for_failure("something_new")


def test_every_declared_reason_maps_to_an_outcome():
    """A reason with no outcome would fall through to whatever the caller does last."""
    for reason in REMOTE_FAILURES:
        assert outcome_for_failure(reason) in ("effect_unknown", "failed")


def test_the_classifier_never_returns_the_exception_text():
    """Belt and braces on the thing that actually leaked."""
    for error in (
        ConnectionRefusedError("connection refused by internal.corp.example:8123"),
        PermissionError(f"401 bad token {SENTINEL_TOKEN}"),
    ):
        reason = remote_fanout.classify_failure(error)
        assert SENTINEL_TOKEN not in reason
        assert "internal" not in reason
