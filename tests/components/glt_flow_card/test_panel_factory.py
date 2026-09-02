"""The Phase-4 operations corpus can express every case the phase must close.

A corpus that quietly stopped containing a project the caller may not open would
turn every enumeration test green without proving anything, so the corpus itself
is tested before anything is built on it.
"""
from __future__ import annotations

import json
from pathlib import Path

from custom_components.glt_flow_card.project_contract import _PROJECT_VALIDATORS
from custom_components.glt_flow_card.semantic_model import validate_semantic_model

from .panel_factory import (
    CONTROL_CAPABLE_ROLES,
    COUNT_ORACLE_SUBSYSTEM,
    RESTRICTED_EQUIPMENT,
    controls_expected,
    operations_project,
    restricted_project,
)

# Beside this file, not at the repository root. The Home Assistant lanes copy
# only `custom_components/` and `tests/` into their workspace, so a fixture
# under a top-level `test/` directory simply does not exist there -- the same
# mistake that made the semantic parity test reach for a missing `src/`.
FIXTURE = Path(__file__).resolve().parent / "fixtures/operations-project.json"


def test_both_corpus_projects_are_valid_schema_4_projects() -> None:
    for project in (operations_project(), restricted_project()):
        assert list(_PROJECT_VALIDATORS[4].iter_errors(project)) == [], project["project"]["id"]
        assert validate_semantic_model(project["semantic_model"]) == []


def test_the_two_projects_share_no_object_or_alarm() -> None:
    """Otherwise a cross-project leak would be invisible: the ids would match."""
    open_ids = {item["id"] for item in operations_project()["equipment"]}
    closed_ids = {item["id"] for item in restricted_project()["equipment"]}
    assert open_ids.isdisjoint(closed_ids)
    open_alarms = {alarm["id"] for alarm in operations_project()["alarms"]}
    closed_alarms = {alarm["id"] for alarm in restricted_project()["alarms"]}
    assert open_alarms.isdisjoint(closed_alarms)


def test_the_restricted_project_holds_the_only_fault() -> None:
    """T4-04: a portfolio roll-up must not announce it to a non-member."""
    open_severities = {alarm["severity"] for alarm in operations_project()["alarms"]}
    closed_severities = {alarm["severity"] for alarm in restricted_project()["alarms"]}
    assert "fault" not in open_severities
    assert "fault" in closed_severities


def test_the_count_oracle_subsystem_lives_in_the_restricted_project() -> None:
    nodes = {node["id"] for node in restricted_project()["semantic_model"]["nodes"]}
    assert COUNT_ORACLE_SUBSYSTEM in nodes
    open_nodes = {node["id"] for node in operations_project()["semantic_model"]["nodes"]}
    assert COUNT_ORACLE_SUBSYSTEM not in open_nodes


def test_the_restricted_equipment_is_only_in_the_restricted_project() -> None:
    open_ids = {item["id"] for item in operations_project()["equipment"]}
    closed_ids = {item["id"] for item in restricted_project()["equipment"]}
    assert set(RESTRICTED_EQUIPMENT) <= closed_ids
    assert set(RESTRICTED_EQUIPMENT).isdisjoint(open_ids)


def test_roles_differ_by_capability_not_by_visibility() -> None:
    """Within a project, membership is uniform; only capability separates roles.

    Phase 2's ACL assigns one role per (project, user) and has no object
    granularity, so a corpus that hid objects from a member would be modelling
    an authority the product does not have.
    """
    assert not controls_expected("viewer")
    for role in CONTROL_CAPABLE_ROLES:
        assert controls_expected(role), role


def test_hours_and_starts_are_declared_as_ordinary_datapoints() -> None:
    """OPS-02 wants hours and starts; they need no Recorder read to show."""
    nodes = {node["id"]: node for node in operations_project()["semantic_model"]["nodes"]}
    for prefix in ("hp1", "hp2"):
        for suffix, unit in (("hours", "h"), ("starts", "count")):
            node = nodes[f"dp-{prefix}-{suffix}"]
            assert node["level"] == "datapoint"
            assert node["unit"] == unit
            assert node["entity_id"].startswith("sensor.")


def test_no_profile_control_can_name_a_dispatch_target() -> None:
    """Schema 3 forbids it; this asserts the corpus does not try anyway."""
    forbidden = {"domain", "service", "target", "entity_id", "data"}
    for project in (operations_project(), restricted_project()):
        for profile in project["profiles"]:
            for control in profile["controls"]:
                assert forbidden.isdisjoint(control), control["id"]


def test_the_committed_browser_fixture_matches_the_factory() -> None:
    """The browser and the Companion must exercise the same project.

    One file, read by both. The browser reaches it from the repository root
    where Playwright runs; the Companion reaches it from beside this test,
    which is the only place both the lane and the browser can see.
    """
    assert json.loads(FIXTURE.read_text("utf-8")) == operations_project()
