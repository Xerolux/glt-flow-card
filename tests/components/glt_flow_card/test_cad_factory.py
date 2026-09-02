"""The CAD corpus is adversarial, and stays that way (ENG-01, ENG-02).

A fixture set is only worth what it refuses to let pass. These tests hold the
corpus to its own claim: that a router which reasons only about two anchors
fails on it, that the pair meant to be refused differs in exactly one respect,
and that every port shape the schema admits is actually present. Without them
the corpus could be softened one edit at a time -- a box nudged aside, a wall
shortened -- and the routing suite would keep passing while proving less.
"""
from __future__ import annotations

import pytest

from custom_components.glt_flow_card.project_contract import evaluate_project_contract
from custom_components.glt_flow_card.semantic_model import validate_semantic_model

from . import cad_factory

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def test_the_corpus_is_a_valid_schema_4_project() -> None:
    result = evaluate_project_contract(cad_factory.cad_project())
    assert result["errors"] == []
    assert result["valid"] is True
    assert result["schema_version"] == 4


def test_the_corpus_is_a_valid_semantic_model() -> None:
    project = cad_factory.cad_project()
    assert validate_semantic_model(project["semantic_model"]) == []


def test_a_naive_router_runs_into_the_plant_room() -> None:
    """At least three fixtures defeat an elbow through the midpoint."""
    defeated = {
        path["id"]: cad_factory.blocked_naively(path)
        for path in cad_factory.paths()
        if cad_factory.blocked_naively(path)
    }
    assert len(defeated) >= 3, defeated
    assert "path-obstructed" in defeated
    assert defeated["path-obstructed"] == ("eq-barrier",)


def test_the_corridor_has_exactly_one_way_through() -> None:
    """Both corridor routes must use the gap, so their spacing is a decision."""
    left, top, right, bottom = cad_factory.CORRIDOR_GAP
    for wall in ("eq-wall-upper", "eq-wall-lower"):
        _, wall_top, _, wall_bottom = cad_factory.equipment_box(wall)
        assert wall_bottom <= top or wall_top >= bottom, f"{wall} intrudes into the gap"
    for path_id in cad_factory.CORRIDOR_PATH_IDS:
        path = cad_factory.path_by_id(path_id)
        start = cad_factory.port_anchor(path["from_equipment"], path["from_port"])
        end = cad_factory.port_anchor(path["to_equipment"], path["to_port"])
        assert start[0] < left and end[0] > right, "a corridor route bypasses the corridor"


def test_the_naive_crossing_hides_one_route_inside_the_other() -> None:
    """Two routes that must cross are laid on top of each other instead."""
    first, second = (
        cad_factory.naive_midpoint_route(cad_factory.path_by_id(path_id))
        for path_id in cad_factory.CROSSING_PATH_IDS
    )
    assert cad_factory.collinear_overlap(first, second) > 0, (
        "the crossing fixture no longer distinguishes a crossing from an overlap"
    )


def test_three_routes_terminate_at_one_many_port() -> None:
    endpoints = {
        (path["to_equipment"], path["to_port"])
        for path in cad_factory.paths()
        if path["id"] in cad_factory.JUNCTION_PATH_IDS
    }
    assert len(cad_factory.JUNCTION_PATH_IDS) == 3
    assert len(endpoints) == 1, "the junction stopped being a junction"
    equipment_id, port_id = endpoints.pop()
    port = next(p for p in cad_factory.ports_of(equipment_id) if p["id"] == port_id)
    assert port["multiplicity"] == "many"


def test_every_port_kind_and_multiplicity_appears() -> None:
    kinds: set[str] = set()
    multiplicities: set[str] = set()
    sides: set[str] = set()
    directions: set[str] = set()
    for path in cad_factory.paths():
        for equipment_id in (path["from_equipment"], path["to_equipment"]):
            for port in cad_factory.ports_of(equipment_id):
                kinds.add(port["kind"])
                multiplicities.add(port["multiplicity"])
                sides.add(port["side"])
                directions.add(port["direction"])
    assert kinds == {"process", "signal", "power"}
    assert multiplicities == {"one", "many"}
    assert sides == {"left", "right", "top", "bottom"}
    assert directions == {"in", "out", "bidirectional"}


def test_the_incompatible_pair_differs_only_in_medium() -> None:
    """One wrong thing, so a refusal that names another has found a different bug."""
    path = cad_factory.path_by_id(cad_factory.INCOMPATIBLE_PATH_ID)
    source = next(port for port in cad_factory.ports_of(path["from_equipment"])
                  if port["id"] == path["from_port"])
    target = next(port for port in cad_factory.ports_of(path["to_equipment"])
                  if port["id"] == path["to_port"])
    assert source["medium"] != target["medium"]
    assert source["kind"] == target["kind"] == "process"
    assert (source["direction"], target["direction"]) == ("out", "in")
    assert cad_factory.blocked_naively(path) == (), "the refused pair must be trivial to route"


def test_a_shared_profile_means_a_port_id_is_not_an_identity() -> None:
    """Several equipment carry ``p-out``; only the pair identifies an endpoint."""
    holders = [
        equipment_id for equipment_id in cad_factory.equipment_ids()
        if any(port["id"] == "p-out" for port in cad_factory.ports_of(equipment_id))
    ]
    assert len(holders) > 1, "the corpus stopped testing endpoint identity"
