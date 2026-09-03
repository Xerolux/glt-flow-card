"""Commissioning answers from the registries, read-only, without inventing findings.

The registry corpus drives the four-way diagnosis, because collapsing the four
combinations into `missing` is the defect that sends an engineer to look for a
typo when an integration failed to set up.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from custom_components.glt_flow_card import commissioning
from custom_components.glt_flow_card.dispatch_vocabulary import DIAGNOSES

EFFECT_PREFIX = "PHASE8_COMMISSIONING_EFFECTS "

CORPUS = json.loads(
    (Path(__file__).parent / "fixtures" / "registry_corpus.json").read_text(encoding="utf-8")
)


@dataclass
class FakeRegistryEntry:
    platform: str | None = None
    config_entry_id: str | None = None
    device_id: str | None = None
    unit_of_measurement: str | None = None
    original_device_class: str | None = None


@dataclass
class FakeState:
    state: str = "21.0"
    attributes: dict[str, Any] | None = None
    last_updated: datetime | None = None


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps({"network": 0, **counts}, sort_keys=True))


def test_the_four_registry_and_state_combinations_are_four_diagnoses():
    """T8-13. `missing` is one of four answers, not the only one.

    The shipped diagnostic reported all four as `missing`. Each sends an
    engineer somewhere different: a typo, a disabled entity or a failed
    integration setup, a template entity with no provenance, and an actual
    absence.
    """
    now = datetime(2027, 6, 1, 12, 0, tzinfo=timezone.utc)
    checked = 0
    for case in CORPUS["cases"]:
        entry = FakeRegistryEntry(
            platform=case["platform"],
            unit_of_measurement=case["unit"],
            original_device_class=case["device_class"],
        ) if case["in_registry"] else None
        state = FakeState(last_updated=now) if case["in_states"] else None
        expectation = None
        if case["expected"] == "wrong_unit":
            expectation = {"unit": "°C"}
        elif case["expected"] == "wrong_device_class":
            expectation = {"device_class": "temperature"}

        finding = commissioning.diagnose_entity(
            case["entity_id"], registry_entry=entry, state=state,
            expectation=expectation, now=now,
        )
        assert finding["code"] == case["expected"], (
            f"{case['entity_id']}: {case['why']} -- got {finding['code']}"
        )
        checked += 1
    _emit(notification=0, remote=0, service=0, references=checked)
    assert checked == len(CORPUS["cases"])


def test_provenance_is_read_from_the_registry_rather_than_the_entity_id():
    """PROTO-01 forbids inferring a protocol from a name; the same applies here."""
    entry = FakeRegistryEntry(platform="modbus", config_entry_id="ce1", device_id="d1")
    finding = commissioning.diagnose_entity(
        "sensor.looks_like_knx_but_is_not", registry_entry=entry, state=FakeState(),
    )
    assert finding["evidence"]["platform"] == "modbus"
    assert finding["evidence"]["config_entry_id"] == "ce1"
    assert finding["evidence"]["device_id"] == "d1"


def test_an_unregistered_entity_is_information_not_a_fault():
    """A template or YAML entity is a normal way to run Home Assistant.

    Reporting it as something to fix would train an engineer to ignore the
    view, which is the same outcome as reporting things that are not true.
    """
    finding = commissioning.diagnose_entity("sensor.template", registry_entry=None, state=FakeState())
    assert finding["code"] == "unregistered"
    assert finding["severity"] == "info"


# --- References are declared, never guessed (T8-11) -------------------------


def test_a_version_string_is_not_reported_as_a_missing_entity():
    """D9. `collect()` treated any string containing a dot as an entity id.

    A version number, a filename and a decimal written as text each became a
    "missing entity", so the readiness view reported things that were not true.
    """
    config = {
        "version": "1.2.3",
        "notes": "see docs/readme.md",
        "threshold": "21.5",
        "title": "Anlage 2.0",
        "datapoints": [{"id": "d1", "entity": "sensor.real_one"}],
    }
    references = commissioning.collect_references(config)
    assert [entry["reference"] for entry in references] == ["sensor.real_one"], (
        "the collector invented references from strings that merely contain a dot"
    )


def test_every_reference_names_where_it_was_declared():
    """A finding without a location is one an engineer cannot act on."""
    config = {
        "equipment": [{"id": "pump-1", "bindings": {"flow": "sensor.flow"}}],
        "datapoints": [{"id": "d1", "entity": "sensor.return"}],
        "controls": [{"id": "c1", "domain": "switch", "service": "turn_on",
                      "target": {"entity_id": ["switch.pump"]}}],
    }
    references = commissioning.collect_references(config)
    by_reference = {entry["reference"]: entry for entry in references}
    assert by_reference["sensor.flow"]["site"] == "equipment.bindings.flow"
    assert by_reference["sensor.flow"]["owner"] == "pump-1"
    assert by_reference["sensor.return"]["site"] == "datapoints.entity"
    assert by_reference["switch.pump"]["site"] == "controls.target"


def test_services_are_collected_alongside_entities():
    """T8-15. A control naming an absent service is otherwise found by pressing it."""
    config = {"controls": [{"id": "c1", "domain": "switch", "service": "turn_on"}]}
    references = commissioning.collect_references(config)
    service = next(entry for entry in references if entry["kind"] == "service")
    assert service["reference"] == "switch.turn_on"
    assert service["owner"] == "c1"


# --- Values, duplicates and bounds ------------------------------------------


def test_a_unit_mismatch_names_both_sides():
    """T8-16. A refusal stating one side leaves the engineer guessing which."""
    entry = FakeRegistryEntry(platform="knx", unit_of_measurement="%")
    finding = commissioning.diagnose_entity(
        "sensor.flow", registry_entry=entry, state=FakeState(), expectation={"unit": "°C"},
    )
    assert finding["code"] == "wrong_unit"
    assert "°C" in finding["remediation"] and "%" in finding["remediation"]
    assert finding["evidence"]["expected_unit"] == "°C"
    assert finding["evidence"]["unit"] == "%"


def test_a_device_class_mismatch_is_distinct_from_a_unit_mismatch():
    """They have different causes and different fixes."""
    entry = FakeRegistryEntry(platform="bacnet", original_device_class="humidity")
    finding = commissioning.diagnose_entity(
        "sensor.flow", registry_entry=entry, state=FakeState(),
        expectation={"device_class": "temperature"},
    )
    assert finding["code"] == "wrong_device_class"


def test_two_slots_reading_one_entity_are_reported_with_both_named():
    references = commissioning.collect_references({
        "equipment": [{"id": "pump-1", "bindings": {"flow": "sensor.x", "return": "sensor.x"}}],
    })
    duplicates = commissioning.find_duplicate_bindings(references)
    assert len(duplicates) == 1
    assert duplicates[0]["code"] == "duplicate_binding"
    sites = duplicates[0]["evidence"]["sites"]
    assert len(sites) == 2 and all("pump-1" in site for site in sites)


def test_staleness_is_computed_server_side_with_an_age():
    """D17. The browser built ages from `Date.now()`, so a wrong clock invented them."""
    now = datetime(2027, 6, 1, 12, 0, tzinfo=timezone.utc)
    state = FakeState(last_updated=now - timedelta(minutes=45))
    finding = commissioning.diagnose_entity(
        "sensor.flow", registry_entry=FakeRegistryEntry(platform="modbus"),
        state=state, now=now, stale_minutes=10,
    )
    assert finding["code"] == "stale"
    assert finding["evidence"]["age_minutes"] == 45.0


def test_suggestions_are_bounded_and_say_so():
    """T8-12. `unused` returned every entity in the installation."""
    answer = commissioning.bounded_suggestions([f"sensor.n{i}" for i in range(500)])
    assert len(answer["suggestions"]) == commissioning.MAX_SUGGESTIONS
    assert answer["total"] == 500
    assert answer["truncated"] is True
    assert answer["limit"] == commissioning.MAX_SUGGESTIONS


def test_an_untruncated_answer_does_not_claim_to_be_truncated():
    answer = commissioning.bounded_suggestions(["sensor.a", "sensor.b"])
    assert answer["truncated"] is False
    assert answer["suggestions"] == ["sensor.a", "sensor.b"]


# --- Readiness is counts, not a score (T8-17) -------------------------------


def test_readiness_is_counts_per_diagnosis_with_no_invented_percentage():
    """D13's score counted issues rather than entities and could go negative."""
    findings = [
        commissioning.diagnose_entity("sensor.a", registry_entry=None, state=None),
        commissioning.diagnose_entity("sensor.a", registry_entry=None, state=None),
        commissioning.diagnose_entity(
            "sensor.b", registry_entry=FakeRegistryEntry(platform="knx"), state=FakeState(),
        ),
    ]
    summary = commissioning.summarise(findings)
    assert set(summary["counts"]) == set(DIAGNOSES)
    assert summary["counts"]["missing"] == 2
    # Two findings on one entity is one affected entity, not two.
    assert summary["affected_references"] == 1
    assert "score" not in summary and "percent" not in summary


# --- Read-only, by execution (T8-14) ----------------------------------------


def test_a_full_run_dispatches_nothing_while_still_producing_findings(hass, config_entry):
    """T8-14. "Read-only by construction" is a claim by inspection.

    Inspection is what missed D8, so this runs a full diagnostic over a project
    that references controls, alarms and meters, and asserts the dispatch ledger
    is empty **and** that findings were produced — an empty ledger from an empty
    run is the vacuous pass this suite corrected in Phase 4 and again in Phase 7.
    """
    from tests.components.glt_flow_card.dispatch_factory import DispatchLedger

    ledger = DispatchLedger()
    config = {
        "equipment": [{"id": "pump-1", "bindings": {"flow": "sensor.flow", "ret": "sensor.ret"}}],
        "datapoints": [{"id": "d1", "entity": "sensor.missing_one"}],
        "alarms": [{"id": "a1", "entity": "sensor.flow"}],
        "controls": [{"id": "c1", "domain": "switch", "service": "turn_on"}],
        "energy": {"meters": [{"id": "m1", "entity": "sensor.meter"}]},
    }
    references = commissioning.collect_references(config)
    findings = [
        commissioning.diagnose_entity(entry["reference"], registry_entry=None, state=None)
        for entry in references if entry["kind"] == "entity"
    ]
    findings.extend(commissioning.find_duplicate_bindings(references))
    summary = commissioning.summarise(findings)

    _emit(**ledger.counts(), references=len(references))
    ledger.assert_nothing_physical("a commissioning run")
    assert ledger.performed == [], "commissioning performed an effect"
    # And it actually did work, so the empty ledger is not the empty run.
    assert len(references) >= 5, "the run examined almost nothing"
    assert summary["counts"]["missing"] > 0, "the run produced no findings"


def test_remediation_is_a_link_and_never_an_action():
    """Nothing on this surface writes, including its suggested next steps."""
    finding = commissioning.diagnose_entity("sensor.x", registry_entry=None, state=None)
    assert isinstance(finding["remediation"], str)
    for verb in ("delete", "remove", "reset", "call", "execute", "löschen"):
        assert verb not in finding["remediation"].lower(), (
            f"the remediation reads like an action: {finding['remediation']!r}"
        )
