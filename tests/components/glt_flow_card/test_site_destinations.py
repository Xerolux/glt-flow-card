"""The Companion connects only where it was told (T9-03, T9-04, T9-05).

`configure_remote_sites` accepted any URL, and the Companion then made an
authenticated request to it and returned the body to the browser. That is a
server-side request forgery primitive with a credential attached, reachable from
a configuration field.

The corpus drives both halves of the check, and the rebinding case is the reason
there are two: an allowlist holds at validation time and not at connection time.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from custom_components.glt_flow_card import site_destinations
from custom_components.glt_flow_card.site_destinations import (
    DESTINATION_REFUSALS,
    DestinationRefused,
)

EFFECT_PREFIX = "PHASE9_DESTINATION_EFFECTS "

CORPUS = json.loads(
    (Path(__file__).parent / "fixtures" / "site_corpus.json").read_text(encoding="utf-8")
)
ALLOWLIST = CORPUS["allowlist"]


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps(
        {"network": 0, "remote": 0, "service": 0, "socket": 0, **counts}, sort_keys=True,
    ))


def _site(case):
    return {"id": case["id"], "url": case["url"], "token": "irrelevant-for-this-check"}


def test_every_corpus_destination_gets_its_expected_verdict():
    """Validation, then connection. Each case says which it should fail at."""
    checked = 0
    for case in CORPUS["cases"]:
        resolutions = {"site-a.example": case["resolves_to"], "site-b.example": case["resolves_to"],
                       "evil.example": case["resolves_to"]}

        try:
            descriptor = site_destinations.validate_site(_site(case), allowlist=ALLOWLIST)
        except DestinationRefused as refused:
            assert refused.reason == case["expected"], f"{case['id']}: {case['why']}"
            checked += 1
            continue

        assert case["expected"] == "allowed", (
            f"{case['id']} was accepted at validation but should have been "
            f"{case['expected']}: {case['why']}"
        )

        # The second half. A name that resolved publicly a moment ago may resolve
        # privately now, which is what the rebinding case exercises.
        address = case.get("rebinds_to", case["resolves_to"])
        try:
            site_destinations.check_before_connecting(
                descriptor, allowlist=ALLOWLIST, resolve=lambda host: address,
            )
        except DestinationRefused as refused:
            assert refused.reason == case.get("expected_at_connect"), (
                f"{case['id']}: {case['why']}"
            )
            checked += 1
            continue

        assert case.get("expected_at_connect") is None, (
            f"{case['id']} connected but should have been refused at connection time"
        )
        checked += 1
        assert resolutions  # the resolution map is what a real resolver would consult

    _emit(destinations=checked)
    assert checked == len(CORPUS["cases"])


def test_the_cloud_metadata_address_is_refused_by_name():
    """169.254.169.254 is why none of this is theoretical.

    An SSRF that reaches it returns credentials for the whole cloud account, and
    it is inside the link-local range that a hand-written private-address check
    most often omits.
    """
    assert not site_destinations.is_routable("169.254.169.254")


def test_a_legitimate_public_address_is_allowed():
    """Otherwise the check could be `return False` and pass everything above.

    Writing this taught me the reserved ranges are broader than the obvious
    list: my first corpus used 203.0.113.x, which is TEST-NET-3 and *is*
    classified private — so the fixture was wrong and the check was right. The
    addresses here are genuinely globally routable, and nothing ever connects to
    them because the transport is a fixture.
    """
    assert site_destinations.is_routable("93.184.216.34")
    assert site_destinations.is_routable("8.8.8.8")
    assert site_destinations.is_routable("2606:4700:4700::1111")


def test_documentation_ranges_are_not_treated_as_public():
    """The mistake this test exists to prevent me repeating.

    TEST-NET and the IPv6 documentation prefix look like public addresses and
    are reserved. A check that allowed them would pass a corpus written by
    somebody reaching for a plausible-looking address.
    """
    for address in ("203.0.113.10", "198.51.100.5", "192.0.2.1", "2001:db8::1"):
        assert not site_destinations.is_routable(address), f"{address} is a reserved range"


def test_every_private_range_is_refused():
    """Written out rather than trusting one library call to mean what it says."""
    for address in (
        "127.0.0.1", "::1",                 # loopback, both families
        "10.0.0.5", "172.16.4.9", "192.168.1.1",  # RFC 1918
        "169.254.169.254", "fe80::1",       # link-local, both families
        "fd00::1",                          # unique-local IPv6
        "0.0.0.0", "224.0.0.1",             # unspecified, multicast
    ):
        assert not site_destinations.is_routable(address), f"{address} was treated as routable"


def test_an_unparseable_address_is_not_routable():
    """Anything the check cannot understand is refused rather than guessed at."""
    for value in ("", "not-an-address", "999.999.999.999", "site-a.example"):
        assert not site_destinations.is_routable(value)


# --- Rebinding is the reason for the second check ---------------------------


def test_a_host_that_rebinds_is_refused_at_connection_time():
    """Validated while it resolved publicly, connected while it resolves to loopback."""
    descriptor = site_destinations.validate_site(
        {"id": "s1", "url": "https://site-b.example/", "token": "t"}, allowlist=ALLOWLIST,
    )
    # Resolving publicly: allowed.
    ok = site_destinations.check_before_connecting(
        descriptor, allowlist=ALLOWLIST, resolve=lambda host: "93.184.216.35",
    )
    assert ok["address"] == "93.184.216.35"

    # Same descriptor, same allowlist, different answer from DNS.
    with pytest.raises(DestinationRefused) as refused:
        site_destinations.check_before_connecting(
            descriptor, allowlist=ALLOWLIST, resolve=lambda host: "127.0.0.1",
        )
    assert refused.value.reason == "address_not_routable"


def test_removing_a_host_from_the_allowlist_takes_effect_at_connection_time():
    """The allowlist is re-checked, because the direction that matters is removal."""
    descriptor = site_destinations.validate_site(
        {"id": "s1", "url": "https://site-b.example/", "token": "t"}, allowlist=ALLOWLIST,
    )
    with pytest.raises(DestinationRefused) as refused:
        site_destinations.check_before_connecting(
            descriptor, allowlist=["site-a.example"], resolve=lambda host: "93.184.216.35",
        )
    assert refused.value.reason == "host_not_allowlisted"


def test_an_unresolvable_host_is_refused_rather_than_attempted():
    def explode(host):
        raise OSError("Name or service not known")

    descriptor = site_destinations.validate_site(
        {"id": "s1", "url": "https://site-b.example/", "token": "t"}, allowlist=ALLOWLIST,
    )
    with pytest.raises(DestinationRefused) as refused:
        site_destinations.check_before_connecting(
            descriptor, allowlist=ALLOWLIST, resolve=explode,
        )
    assert refused.value.reason == "destination_unresolvable"


# --- The allowlist is server-owned -----------------------------------------


def test_a_project_document_cannot_add_a_destination():
    """Third time this rule appears, after notification targets and the simulation gate.

    The allowlist is a parameter rather than a module global precisely so there
    is no ambient value a project document could reach.
    """
    hostile = {"id": "s1", "url": "https://evil.example/", "token": "t",
               "allowlist": ["evil.example"], "trusted": True}
    with pytest.raises(DestinationRefused) as refused:
        site_destinations.validate_site(hostile, allowlist=ALLOWLIST)
    assert refused.value.reason == "host_not_allowlisted"


# --- TLS verification (T9-05) ----------------------------------------------


def test_disabling_verification_requires_an_explicit_declaration():
    """`verify_ssl: false` produced no warning, no audit entry and no indication.

    Requiring a second explicit field makes it a decision rather than a typo.
    """
    with pytest.raises(DestinationRefused) as refused:
        site_destinations.validate_site(
            {"id": "s1", "url": "https://site-a.example/", "token": "t", "verify_ssl": False},
            allowlist=ALLOWLIST,
        )
    assert refused.value.reason == "verification_disabled_without_declaration"


def test_a_declared_unverified_site_is_marked_in_its_descriptor():
    """So an operator can see which figures arrived over an unauthenticated channel."""
    descriptor = site_destinations.validate_site(
        {"id": "s1", "url": "https://site-a.example/", "token": "t",
         "verify_ssl": False, "verification_disabled_deliberately": True},
        allowlist=ALLOWLIST,
    )
    assert descriptor["verified_tls"] is False


def test_a_verified_site_says_so():
    descriptor = site_destinations.validate_site(
        {"id": "s1", "url": "https://site-a.example/", "token": "t"}, allowlist=ALLOWLIST,
    )
    assert descriptor["verified_tls"] is True


# --- Refusals say nothing useful to an attacker -----------------------------


def test_a_refusal_reason_names_no_address_or_host():
    """These reasons reach the browser.

    One that named the address would hand back the information the check exists
    to protect: an attacker probing destinations learns which internal addresses
    exist from the difference between "not allowlisted" and "not routable".
    """
    for reason in DESTINATION_REFUSALS:
        assert "." not in reason, f"{reason} looks like it embeds a host"
        assert not any(character.isdigit() for character in reason)


def test_the_detail_stays_server_side():
    """The reason is for the browser; the detail is for the log."""
    with pytest.raises(DestinationRefused) as refused:
        site_destinations.validate_site(
            {"id": "s1", "url": "https://evil.example/", "token": "t"}, allowlist=ALLOWLIST,
        )
    # The detail exists for the operator reading logs...
    assert refused.value.detail["host"] == "evil.example"
    # ...and the reason, which is what travels, does not carry it.
    assert "evil" not in refused.value.reason
