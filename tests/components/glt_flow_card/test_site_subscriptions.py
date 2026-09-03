"""Subscriptions are bounded and named (T9-16).

Bounding the *number* of subscriptions is pointless if each one is a firehose,
so the primitive matters as much as the count: `subscribe_events` with
`state_changed` delivers every change on the remote instance, which for twenty
watched entities on a site with two thousand is a hundredfold amplification.
"""
from __future__ import annotations

import json

import pytest

from custom_components.glt_flow_card.site_subscriptions import (
    MAX_ENTITIES_PER_SUBSCRIPTION,
    RemoteSubscriptions,
    SubscriptionRefused,
)

EFFECT_PREFIX = "PHASE9_SUBSCRIPTION_EFFECTS "


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps(
        {"network": 0, "remote": 0, "service": 0, "socket": 0, **counts}, sort_keys=True,
    ))


def _subs(**kwargs):
    return RemoteSubscriptions(**kwargs)


def test_a_subscription_names_its_entities_rather_than_taking_everything():
    """The measurement that made this module necessary.

    `subscribe_events` would satisfy every count-based assertion in this file
    while delivering a hundred times the traffic, so the command itself is
    asserted.
    """
    subscriptions = _subs()
    entry = subscriptions.subscribe(site_id="a", entity_ids=["sensor.x", "sensor.y"], token="t1")
    _emit(subscriptions=1)
    assert entry["command"] == "subscribe_entities", (
        "a subscription used the firehose primitive"
    )
    assert entry["entity_ids"] == ["sensor.x", "sensor.y"]


def test_a_subscription_with_no_entities_is_refused_rather_than_meaning_everything():
    """"Everything" is the amplification this module exists to prevent."""
    with pytest.raises(SubscriptionRefused) as refused:
        _subs().subscribe(site_id="a", entity_ids=[], token="t1")
    assert refused.value.reason == "no_entities_named"


def test_the_per_site_bound_is_enforced_and_names_its_limit():
    subscriptions = _subs(per_site=2)
    subscriptions.subscribe(site_id="a", entity_ids=["sensor.x"], token="t1")
    subscriptions.subscribe(site_id="a", entity_ids=["sensor.y"], token="t2")
    with pytest.raises(SubscriptionRefused) as refused:
        subscriptions.subscribe(site_id="a", entity_ids=["sensor.z"], token="t3")
    assert refused.value.reason == "site_subscription_limit"
    assert refused.value.detail["limit"] == 2


def test_the_total_bound_is_a_property_of_this_machine_not_a_consequence():
    """Not `per-site x sites`.

    A consequence grows every time somebody adds a site, and the thing being
    protected — this Companion's memory and sockets — does not.
    """
    subscriptions = _subs(per_site=4, total=3)
    subscriptions.subscribe(site_id="a", entity_ids=["sensor.x"], token="t1")
    subscriptions.subscribe(site_id="b", entity_ids=["sensor.y"], token="t2")
    subscriptions.subscribe(site_id="c", entity_ids=["sensor.z"], token="t3")
    with pytest.raises(SubscriptionRefused) as refused:
        subscriptions.subscribe(site_id="d", entity_ids=["sensor.w"], token="t4")
    assert refused.value.reason == "total_subscription_limit"
    assert refused.value.detail["limit"] == 3


def test_an_over_long_entity_list_is_refused_with_its_limit():
    with pytest.raises(SubscriptionRefused) as refused:
        _subs().subscribe(
            site_id="a",
            entity_ids=[f"sensor.n{i}" for i in range(MAX_ENTITIES_PER_SUBSCRIPTION + 1)],
            token="t1",
        )
    assert refused.value.reason == "too_many_entities"
    assert refused.value.detail["limit"] == MAX_ENTITIES_PER_SUBSCRIPTION


def test_releasing_frees_the_slot():
    """Asserted rather than assumed.

    A bound that counts up and never down is a bound that eventually refuses
    everything, and the failure looks like a limit being correctly enforced.
    """
    subscriptions = _subs(per_site=1)
    subscriptions.subscribe(site_id="a", entity_ids=["sensor.x"], token="t1")
    with pytest.raises(SubscriptionRefused):
        subscriptions.subscribe(site_id="a", entity_ids=["sensor.y"], token="t2")

    subscriptions.release(site_id="a", token="t1")
    assert subscriptions.count("a") == 0
    # The slot is genuinely free, not merely counted as free.
    subscriptions.subscribe(site_id="a", entity_ids=["sensor.y"], token="t2")
    assert subscriptions.count("a") == 1


def test_releasing_an_unknown_subscription_is_refused_rather_than_ignored():
    """Silently ignoring it would let a double-release free somebody else's slot."""
    with pytest.raises(SubscriptionRefused) as refused:
        _subs().release(site_id="a", token="nope")
    assert refused.value.reason == "subscription_not_found"


def test_removing_a_site_releases_what_is_held_against_it():
    """Revocation must reach held resources, not only new requests.

    A site removed from the allowlist while four subscriptions are open would
    otherwise keep receiving from it.
    """
    subscriptions = _subs()
    subscriptions.subscribe(site_id="a", entity_ids=["sensor.x"], token="t1")
    subscriptions.subscribe(site_id="a", entity_ids=["sensor.y"], token="t2")
    subscriptions.subscribe(site_id="b", entity_ids=["sensor.z"], token="t3")

    assert subscriptions.release_site("a") == 2
    assert subscriptions.count("a") == 0
    assert subscriptions.count("b") == 1


def test_the_limits_are_readable_so_a_surface_can_state_them():
    described = _subs().describe()
    assert described["limits"]["per_site"] > 0
    assert described["limits"]["total"] > 0
    assert described["limits"]["entities_per_subscription"] > 0
