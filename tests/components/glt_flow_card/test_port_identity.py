"""An endpoint survives every path that could detach it (ENG-01, T5-05).

Four paths can break a connection's meaning -- an edit, a copy/paste, a bundle
round trip and a migration -- and fixing one of them and calling it identity is
how the other three keep shipping. All four are asserted here, against the CAD
corpus rather than a two-object fixture, because a corpus with shared profiles
is the one where a port id alone stops being an identity.
"""
from __future__ import annotations

import copy

import pytest

from custom_components.glt_flow_card.ports import (
    broken_endpoints,
    port_anchor,
    remap_identifiers,
    resolve_endpoint,
)
from custom_components.glt_flow_card.project_migrations import migrate_project_document

from . import cad_factory

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def test_every_endpoint_in_the_corpus_resolves() -> None:
    project = cad_factory.cad_project()
    assert broken_endpoints(project) == []


def test_geometry_is_derived_from_the_port_not_stored_on_the_path() -> None:
    """The factory computes anchors its own way; both must agree."""
    project = cad_factory.cad_project()
    for path in project["paths"]:
        for end in ("from", "to"):
            resolved = resolve_endpoint(project, path, end)
            expected = cad_factory.port_anchor(
                path[f"{end}_equipment"], path[f"{end}_port"]
            )
            assert (resolved["anchor"]["x"], resolved["anchor"]["y"]) == expected


def test_moving_equipment_moves_the_endpoint_and_not_its_meaning() -> None:
    project = cad_factory.cad_project()
    path = next(p for p in project["paths"] if p["id"] == "path-obstructed")
    before = resolve_endpoint(project, path, "from")

    moved = copy.deepcopy(project)
    for item in moved["equipment"]:
        if item["id"] == "eq-source-a":
            item["x"] += 250
            item["y"] -= 40
    after = resolve_endpoint(moved, path, "from")

    assert after["port"]["id"] == before["port"]["id"]
    assert after["equipment"]["id"] == before["equipment"]["id"]
    assert after["anchor"] != before["anchor"], "the anchor did not follow the equipment"


def test_a_port_that_no_longer_exists_is_reported_never_reattached() -> None:
    project = copy.deepcopy(cad_factory.cad_project())
    for profile in project["profiles"]:
        if profile["id"] == "profile-source":
            profile["ports"] = []
    broken = broken_endpoints(project)
    assert broken, "a deleted port left every endpoint resolving"
    for entry in broken:
        assert entry["reason"] == "port_missing"
        assert entry["port_id"] == "p-out"
        assert entry["equipment_id"]
        assert entry["path_id"]


def test_a_shared_profile_means_the_pair_is_the_identity() -> None:
    """Several equipment carry ``p-out``; the endpoints must not collide."""
    project = cad_factory.cad_project()
    holders = {
        path["from_equipment"] for path in project["paths"] if path["from_port"] == "p-out"
    }
    assert len(holders) > 1
    anchors = {
        (path["from_equipment"],
         resolve_endpoint(project, path, "from")["anchor"]["x"],
         resolve_endpoint(project, path, "from")["anchor"]["y"])
        for path in project["paths"] if path["from_port"] == "p-out"
    }
    assert len(anchors) == len(holders), "two equipment resolved to one endpoint"


def test_a_paste_remaps_ids_and_the_endpoints_follow() -> None:
    project = cad_factory.cad_project()
    pasted = remap_identifiers(project, prefix="copy")

    original_ids = {item["id"] for item in project["equipment"]}
    pasted_ids = {item["id"] for item in pasted["equipment"]}
    assert original_ids.isdisjoint(pasted_ids), "paste kept a source equipment id"

    for path in pasted["paths"]:
        assert path["from_equipment"] in pasted_ids
        assert path["to_equipment"] in pasted_ids
    # Port ids are profile-scoped and the profile was not copied.
    assert [p["from_port"] for p in pasted["paths"]] == [
        p["from_port"] for p in project["paths"]
    ]
    assert broken_endpoints(pasted) == []


def test_a_paste_is_deterministic_and_does_not_read_a_clock() -> None:
    project = cad_factory.cad_project()
    assert remap_identifiers(project, prefix="copy") == remap_identifiers(
        project, prefix="copy"
    )


def test_a_paste_into_a_project_that_already_holds_the_ids_does_not_collide() -> None:
    project = cad_factory.cad_project()
    first = remap_identifiers(project, prefix="copy")
    taken = {item["id"] for item in first["equipment"]}
    second = remap_identifiers(project, prefix="copy", existing=taken)
    assert taken.isdisjoint({item["id"] for item in second["equipment"]})
    assert broken_endpoints(second) == []


def test_a_migration_carries_the_endpoints_through() -> None:
    """Down to schema 3 and back up: the endpoints must be the ones we started with."""
    project = cad_factory.cad_project()
    down = copy.deepcopy(project)
    down["schema_version"] = 3
    down.pop("contributions", None)
    restored = migrate_project_document(down, dry_run=True)["candidate"]
    assert restored["schema_version"] == 4
    for original, carried in zip(project["paths"], restored["paths"], strict=True):
        assert (carried["from_equipment"], carried["from_port"]) == (
            original["from_equipment"], original["from_port"]
        )
        assert (carried["to_equipment"], carried["to_port"]) == (
            original["to_equipment"], original["to_port"]
        )
    assert broken_endpoints(restored) == []


def test_an_anchor_is_taken_from_the_declared_side() -> None:
    equipment = {"id": "e", "x": 10, "y": 20, "width": 100, "height": 40}
    assert port_anchor(equipment, {"side": "left"}) == {"x": 10, "y": 40}
    assert port_anchor(equipment, {"side": "right"}) == {"x": 110, "y": 40}
    assert port_anchor(equipment, {"side": "top"}) == {"x": 60, "y": 20}
    assert port_anchor(equipment, {"side": "bottom"}) == {"x": 60, "y": 60}
    # A port with no declared side sits at the centre rather than nowhere.
    assert port_anchor(equipment, {}) == {"x": 60, "y": 40}
