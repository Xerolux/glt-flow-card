"""Remote is a scoped path, not a second product (T9-08 … T9-12).

Every rule the local path enforces applies unchanged one network hop out: the
same capabilities, the same project scoping, the same four command outcomes, the
same trusted audit, the same simulation gate. T9-09 and T9-11 exist because the
remote path was written as its own thing.
"""
from __future__ import annotations

import asyncio
import json

import pytest

from custom_components.glt_flow_card import remote_fanout, site_vocabulary

EFFECT_PREFIX = "PHASE9_AUTHORITY_EFFECTS "


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps(
        {"network": 0, "remote": 0, "service": 0, "socket": 0, **counts}, sort_keys=True,
    ))


async def test_a_site_bound_to_projects_is_unreachable_without_one(hass, config_entry, phase2_users):
    """T9-09. `remote_control` checked only the service domain.

    The caller's `project_id` drove a role check but was never checked against
    the *site*, so an operator authorized on project A could operate site B.

    Exercised through the route rather than by calling the helper directly: the
    helper takes Home Assistant's connection object, and a test that hands it a
    client would be testing something the product never does.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    manager = _manager(hass)
    manager.data["projects"]["mine"] = {"id": "mine", "config": {}}
    manager.data["projects"]["theirs"] = {"id": "theirs", "config": {}}
    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id="mine",
        user_id=phase2_users.principal("operator").user_id,
        role=phase2_users.principal("operator").project_role,
    )
    manager.site_allowlist = []
    manager.remote_sites = {
        "s1": {"id": "s1", "project_ids": ["mine"], "token": "t", "url": "https://a.invalid/"},
        "s2": {"id": "s2", "project_ids": ["theirs"], "token": "t", "url": "https://b.invalid/"},
    }

    connection = await phase2_users.async_connect("operator")

    # The caller's own site answers -- absent, because the fixture host is not
    # allowlisted so nothing connects, but *present in the answer* with a reason
    # that is not `not_permitted`.
    mine = await connection.command({
        "type": "glt_flow_card/remote/states", "site_id": "s1", "entity_ids": [],
    })
    assert mine["success"] is True
    mine_absent = {entry["site_id"]: entry["reason"] for entry in mine["result"]["absent_sites"]}
    assert mine_absent.get("s1") != "not_permitted", "the caller's own site was withheld"

    # Another project's site is withheld, and withheld looks exactly like any
    # other absence -- which is the point.
    theirs = await connection.command({
        "type": "glt_flow_card/remote/states", "site_id": "s2", "entity_ids": [],
    })
    assert theirs["success"] is True
    theirs_absent = {entry["site_id"]: entry["reason"]
                     for entry in theirs["result"]["absent_sites"]}
    _emit(sites=2)
    assert theirs_absent["s2"] == "not_permitted", (
        "an operator reached a site belonging to another project"
    )
    assert theirs["result"]["states"] == {}


async def test_an_unauthorized_site_read_is_refused_opaquely(hass, config_entry, phase2_users):
    """T9-08. `remote/states` checked nothing at all.

    The refusal does not distinguish "no such site" from "not allowed": a caller
    who learns which one applies has learned the site exists.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    _manager(hass).remote_sites = {}
    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/remote/states", "site_id": "nope", "entity_ids": ["sensor.a"],
    })
    assert response["success"] is False
    assert response["error"]["code"] == "not_found_or_denied"


async def test_a_site_listing_is_filtered_and_then_limited(hass, config_entry, phase2_users):
    """T9-10. Limiting first turns the limit into a count oracle.

    Third route to need this rule, after `alarms/list` and `history/series`.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    manager = _manager(hass)
    manager.data["projects"]["mine"] = {"id": "mine", "config": {}}
    manager.data["projects"]["theirs"] = {"id": "theirs", "config": {}}
    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id="mine", user_id=phase2_users.principal("viewer").user_id, role="viewer",
    )

    # Many sites the caller may not see, and one they may. If the limit were
    # applied first, the others would fill the page and the answer would be
    # empty -- which is how a limit becomes a count oracle.
    manager.remote_sites = {
        f"other{i}": {"id": f"other{i}", "project_ids": ["theirs"], "token": "t",
                      "url": "https://x.example/"}
        for i in range(20)
    }
    manager.remote_sites["mine"] = {"id": "mine", "project_ids": ["mine"], "token": "t",
                                    "url": "https://y.example/"}

    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({"type": "glt_flow_card/remote/list", "limit": 5})
    assert response["success"] is True
    sites = response["result"]["sites"]
    assert [site["id"] for site in sites] == ["mine"], (
        "the listing leaked sites the caller may not see, or the limit ate the caller's own"
    )
    # And neither the token nor the URL travels.
    assert all("token" not in site and "url" not in site for site in sites)


# --- The four outcomes (T9-11, T9-12) ---------------------------------------


def test_a_timeout_is_effect_unknown_rather_than_failed():
    """The distinction matters more over a network, not less.

    A timeout on a POST is the canonical case where the service may well have
    run. Reporting it as failed invites a retry, and a retry after an unknown is
    how plant gets operated twice.
    """
    assert site_vocabulary.outcome_for_failure("timeout") == "effect_unknown"


def test_a_refused_connection_is_a_failure():
    """Nothing was sent, so the operator can be told it definitely did not run.

    If everything were `effect_unknown` the distinction would carry no
    information at all.
    """
    assert site_vocabulary.outcome_for_failure("connection_refused") == "failed"


def test_every_declared_outcome_is_reachable_from_some_failure_or_success():
    """An outcome nothing can produce is a word in a list.

    `accepted` is the local path's durable pre-dispatch record and has no remote
    analogue, which is stated here rather than left as an unexplained gap.
    """
    produced = {site_vocabulary.outcome_for_failure(reason)
                for reason in site_vocabulary.REMOTE_FAILURES}
    produced |= {"confirmed", "sent"}
    missing = set(site_vocabulary.REMOTE_OUTCOMES) - produced
    assert missing == {"accepted"}, f"unreachable outcomes: {missing}"


def test_the_classifier_and_the_outcome_rule_agree_on_every_shape():
    """A reason the classifier produces that the outcome rule rejects would
    raise inside a failure handler, which is the worst place to raise."""
    for error in (TimeoutError(), ConnectionRefusedError(), PermissionError(),
                  ValueError(), RuntimeError()):
        reason = remote_fanout.classify_failure(error)
        assert site_vocabulary.outcome_for_failure(reason) in ("effect_unknown", "failed")


async def test_a_remote_control_is_gated_by_simulation_before_anything_is_sent():
    """Phase 8 gated this path, so Phase 9 inherits a gate rather than adding one.

    Asserted here because "inherited" is a claim, and a claim about a safety
    gate deserves a test in the phase that relies on it.
    """
    from custom_components.glt_flow_card import dispatch_gate

    decision = dispatch_gate.decide_dispatch("remote_control", is_simulating=lambda: True)
    assert decision.outcome == "refused"
    assert decision.reason == "simulation_active"
    assert asyncio  # the module is async throughout; this keeps the import honest
