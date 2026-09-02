"""The Phase-4 operations corpus can express every case the phase must close.

A corpus that quietly stopped containing a restricted object would turn every
enumeration test green without proving anything, so the corpus itself is
tested before anything is built on it.
"""
from __future__ import annotations

import json
from pathlib import Path

from custom_components.glt_flow_card.project_contract import _PROJECT_VALIDATORS
from custom_components.glt_flow_card.semantic_model import validate_semantic_model

from .panel_factory import (
    COUNT_ORACLE_SUBSYSTEM,
    RESTRICTED,
    operations_project,
    project_without,
    visible_equipment,
)

FIXTURE = Path(__file__).resolve().parents[3] / "test/fixtures/operations/site.project.json"


def test_the_corpus_is_a_valid_schema_3_project() -> None:
    project = operations_project()
    assert list(_PROJECT_VALIDATORS[3].iter_errors(project)) == []
    assert validate_semantic_model(project["semantic_model"]) == []


def test_the_reduced_corpus_is_also_valid() -> None:
    """Hidden-vs-missing tests compare against a project that really lacks it."""
    reduced = project_without(set(RESTRICTED))
    assert list(_PROJECT_VALIDATORS[3].iter_errors(reduced)) == []
    assert validate_semantic_model(reduced["semantic_model"]) == []
    remaining = {item["id"] for item in reduced["equipment"]}
    assert remaining.isdisjoint(RESTRICTED)


def test_each_role_sees_a_materially_different_subtree() -> None:
    roles = ["admin", "engineer", "operator", "viewer"]
    seen = {role: visible_equipment(role) for role in roles}
    assert seen["operator"] < seen["engineer"], "an operator must see strictly less"
    assert seen["viewer"] == seen["operator"]
    every = {item["id"] for item in operations_project()["equipment"]}
    assert seen["admin"] < every, "no role may open the fully restricted object"


def test_an_unassigned_principal_sees_nothing() -> None:
    """A Home Assistant administrator without an assignment still reads nothing."""
    for role in ("admin", "engineer", "operator", "viewer"):
        assert visible_equipment(role, assigned=False) == set()


def test_the_count_oracle_subsystem_has_only_a_restricted_alarm_bearer() -> None:
    """T4-04's case: a roll-up here would announce an alarm nobody may reach."""
    project = operations_project()
    children = {
        node["id"] for node in project["semantic_model"]["nodes"]
        if node.get("parent") == COUNT_ORACLE_SUBSYSTEM
    }
    assert children, "the oracle subsystem must have children"
    bearers = {
        alarm["equipment_id"] for alarm in project["alarms"]
        if alarm["equipment_id"] in children
    }
    assert bearers, "the oracle subsystem must carry an alarm"
    assert bearers <= set(RESTRICTED), "every alarm bearer here must be restricted"


def test_hours_and_starts_are_declared_as_ordinary_datapoints() -> None:
    """OPS-02 wants hours and starts; they need no Recorder read to show."""
    nodes = {node["id"]: node for node in operations_project()["semantic_model"]["nodes"]}
    for prefix in ("hp1", "hp2", "boiler"):
        for suffix, unit in (("hours", "h"), ("starts", "count")):
            node = nodes[f"dp-{prefix}-{suffix}"]
            assert node["level"] == "datapoint"
            assert node["unit"] == unit
            assert node["entity_id"].startswith("sensor.")


def test_no_profile_control_can_name_a_dispatch_target() -> None:
    """Schema 3 forbids it; this asserts the corpus does not try anyway."""
    forbidden = {"domain", "service", "target", "entity_id", "data"}
    for profile in operations_project()["profiles"]:
        for control in profile["controls"]:
            assert forbidden.isdisjoint(control), control["id"]


def test_the_committed_browser_fixture_matches_the_factory() -> None:
    """The browser and the Companion must exercise the same project."""
    assert json.loads(FIXTURE.read_text("utf-8")) == operations_project()
