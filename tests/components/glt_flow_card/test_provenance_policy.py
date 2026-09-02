"""Provenance is a project-scoped read, not a registry search (T3-05).

Two properties matter here. A project the caller cannot see must answer exactly
as a project that does not exist, or the difference between the two answers
becomes a way to enumerate projects. And the route must describe only entities
the project itself references, or a project-scoped read becomes a way to probe
the whole entity registry.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .registry_factory import RegistryFactory

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase3-provenance-policy]: "
    "authorized non-enumerating provenance reads are unavailable"
)
EFFECT_PREFIX = "PHASE3_PROVENANCE_POLICY_EFFECTS "


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps({"service_attempts": 0, "network": 0, **extra}, sort_keys=True))


def test_the_route_is_declared_in_the_policy_contract() -> None:
    """An undeclared route is a route the boundary never sees."""
    from .policy_contract import COMMAND_POLICY_CONTRACT

    policy = next(
        (entry for entry in COMMAND_POLICY_CONTRACT
         if entry.route == "glt_flow_card/provenance/get"),
        None,
    )
    assert policy is not None, "provenance/get is not declared"
    assert policy.scope == "project"
    assert policy.capability == "project.read"
    assert policy.enumeration == "opaque"


async def _seed(hass: HomeAssistant, entry: MockConfigEntry, users) -> tuple[Any, str]:
    """Load the integration and give the viewer one project with one datapoint."""
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][entry.entry_id]
    factory = RegistryFactory(hass)
    cases = factory.seed_provenance_matrix()
    seen = cases["core_integration"].entity_id
    unseen = cases["no_device"].entity_id

    viewer = users.principal("viewer")
    await runtime.access.async_assign(project_id="prov-plant", user_id=viewer.user_id, role="viewer")
    await hass.data["glt_flow_card"]["manager"].save_project(
        {
            "id": "prov-plant",
            "config": {
                "type": "custom:glt-flow-card",
                "schema_version": 3,
                "project": {"id": "prov-plant", "name": "Prov", "revision": 0},
                "semantic_model": {"nodes": []},
                "views": [], "equipment": [], "paths": [],
                "datapoints": [{"id": "dp-1", "entity_id": seen}],
            },
        },
        autosave=False,
        user_id=viewer.user_id,
        expected_revision=0,
    )
    return (seen, unseen)


async def test_a_hidden_project_answers_exactly_as_a_missing_one(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """The difference between hidden and missing is the enumeration channel."""
    emit_effects(cases=2)
    seen, _ = await _seed(hass, config_entry, phase2_users)

    connection = await phase2_users.async_connect("operator")  # holds no project
    hidden = await connection.command({
        "type": "glt_flow_card/provenance/get",
        "project_id": "prov-plant",
        "entity_ids": [seen],
    })
    missing = await connection.command({
        "type": "glt_flow_card/provenance/get",
        "project_id": "does-not-exist",
        "entity_ids": [seen],
    })
    assert hidden["success"] is False
    assert hidden["error"] == missing["error"]
    assert hidden["error"]["code"] == "not_found_or_denied"
    await phase2_users.async_close()


async def test_only_entities_the_project_references_are_described(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """A project-scoped read must not become a registry search."""
    seen, unseen = await _seed(hass, config_entry, phase2_users)

    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/provenance/get",
        "project_id": "prov-plant",
        "entity_ids": [seen, unseen],
    })
    assert response["success"] is True
    described = [row["entity_id"] for row in response["result"]["rows"]]
    assert described == [seen], described
    assert unseen not in json.dumps(response["result"])
    await phase2_users.async_close()


async def test_expected_red_phase3_provenance_policy(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Provenance authorizes per project and never enumerates."""
    emit_effects(cases=3)
    gaps: list[str] = []
    seen, unseen = await _seed(hass, config_entry, phase2_users)

    outsider = await phase2_users.async_connect("operator")
    hidden = await outsider.command({
        "type": "glt_flow_card/provenance/get",
        "project_id": "prov-plant", "entity_ids": [seen],
    })
    missing = await outsider.command({
        "type": "glt_flow_card/provenance/get",
        "project_id": "nope", "entity_ids": [seen],
    })
    if hidden.get("error") != missing.get("error"):
        gaps.append("a hidden project and a missing project answer differently")

    viewer = await phase2_users.async_connect("viewer")
    allowed = await viewer.command({
        "type": "glt_flow_card/provenance/get",
        "project_id": "prov-plant", "entity_ids": [seen, unseen],
    })
    if allowed.get("success") is not True:
        gaps.append("an authorized viewer could not read provenance")
    else:
        rows = allowed["result"]["rows"]
        if [row["entity_id"] for row in rows] != [seen]:
            gaps.append("an entity the project does not reference was described")
        if rows and not rows[0].get("integration", {}).get("source"):
            gaps.append("a described row carries no source")

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  provenance policy gap: {gap}")
    assert not gaps, "authorized non-enumerating provenance reads are unavailable"
    await phase2_users.async_close()
