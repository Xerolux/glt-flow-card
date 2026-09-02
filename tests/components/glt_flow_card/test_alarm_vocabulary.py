"""The Companion half of the closed alarm vocabulary.

The counting test is the one that matters: today a ``critical`` alarm authored
in the shipped editor is counted by ``navigation.py``'s
``COUNTED_SEVERITIES = ("fault", "warning")`` -- which is to say, by nothing.
"""
from __future__ import annotations

import pytest

from custom_components.glt_flow_card.alarm_vocabulary import (
    ALARM_PRIORITIES,
    ALARM_STATES,
    ESCALATION_STAGE_KINDS,
    NOTIFICATION_OUTCOMES,
    SCHEDULE_BINDING_KINDS,
    SEVERITY_MIGRATION,
    SUPPRESSION_REASONS,
    UNKNOWN_SEVERITY_FALLBACK,
    at_least_as_severe,
    count_by_priority,
    is_alarm_state,
    is_escalation_stage_kind,
    is_notification_outcome,
    is_priority,
    is_schedule_binding_kind,
    is_suppression_reason,
    migrate_severity,
    priority_rank,
)

from .alarm_factory import LEGACY_SEVERITIES, legacy_severity_alarms

SETS = {
    "ALARM_PRIORITIES": ALARM_PRIORITIES,
    "ALARM_STATES": ALARM_STATES,
    "SUPPRESSION_REASONS": SUPPRESSION_REASONS,
    "NOTIFICATION_OUTCOMES": NOTIFICATION_OUTCOMES,
    "ESCALATION_STAGE_KINDS": ESCALATION_STAGE_KINDS,
    "SCHEDULE_BINDING_KINDS": SCHEDULE_BINDING_KINDS,
}


def test_every_vocabulary_is_immutable_and_closed() -> None:
    for name, members in SETS.items():
        assert isinstance(members, tuple), f"{name} is mutable"
    for check in (
        is_priority,
        is_alarm_state,
        is_suppression_reason,
        is_notification_outcome,
        is_escalation_stage_kind,
        is_schedule_binding_kind,
    ):
        assert check("definitely-not-a-member") is False
        assert check(None) is False


def test_priorities_are_ordered() -> None:
    assert ALARM_PRIORITIES == ("critical", "warning", "info")
    assert priority_rank("critical") == 0
    assert at_least_as_severe("critical", "warning")
    assert at_least_as_severe("warning", "warning")
    assert not at_least_as_severe("info", "warning")


def test_an_unknown_priority_raises_rather_than_sorting_somewhere() -> None:
    with pytest.raises(ValueError, match="unknown alarm priority"):
        priority_rank("kaputt")


def test_every_stored_severity_in_the_corpus_maps() -> None:
    for severity in LEGACY_SEVERITIES:
        result = migrate_severity(severity)
        assert result["recognised"], severity
        assert is_priority(result["priority"]), severity
    assert migrate_severity("fault")["priority"] == migrate_severity("critical")["priority"]


def test_an_unknown_string_maps_to_the_most_severe_and_is_reported() -> None:
    result = migrate_severity("stufe-rot")
    assert result["recognised"] is False
    assert result["priority"] == UNKNOWN_SEVERITY_FALLBACK == ALARM_PRIORITIES[0]
    assert result["stored"] == "stufe-rot"


def test_a_critical_alarm_authored_in_the_editor_is_counted() -> None:
    # The shipped editor offers exactly these three (base.js: Störung / Warnung
    # / Hinweis). Every one of them must land in a bucket somebody reads.
    authored = [{"severity": s} for s in ("critical", "warning", "info")]
    result = count_by_priority(authored)
    assert result["counts"] == {"critical": 1, "warning": 1, "info": 1}
    assert result["unrecognised"] == []


def test_the_legacy_counting_rule_missed_it() -> None:
    # `navigation.py`'s rule reproduced, and shown to disagree, so the fix
    # cannot be mistaken for a refactor.
    legacy_counted = ("fault", "warning")
    authored = [{"severity": "critical"}, {"severity": "warning"}]
    legacy_total = sum(1 for a in authored if a["severity"] in legacy_counted)
    total = sum(count_by_priority(authored)["counts"].values())
    assert legacy_total == 1
    assert total == 2


def test_no_alarm_falls_out_of_the_count() -> None:
    alarms = legacy_severity_alarms() + [
        {"severity": "zzz"}, {"severity": ""}, {"severity": None},
    ]
    result = count_by_priority(alarms)
    assert sum(result["counts"].values()) == len(alarms)
    assert len(result["unrecognised"]) == 3


def test_priority_wins_over_a_legacy_severity_on_the_same_alarm() -> None:
    # During the migration an alarm can carry both. The declared field decides,
    # or the migration is undone by every read.
    result = count_by_priority([{"priority": "info", "severity": "fault"}])
    assert result["counts"] == {"critical": 0, "warning": 0, "info": 1}


def test_the_migration_table_stays_inside_the_set() -> None:
    for stored, mapped in SEVERITY_MIGRATION.items():
        assert is_priority(mapped), f"{stored} maps to the undeclared {mapped}"
    reachable = set(SEVERITY_MIGRATION.values())
    for priority in ALARM_PRIORITIES:
        assert priority in reachable, f"no stored string maps to {priority}"


def test_the_corpus_severity_alarms_all_land_somewhere() -> None:
    result = count_by_priority(legacy_severity_alarms())
    assert sum(result["counts"].values()) == len(LEGACY_SEVERITIES)
    assert result["unrecognised"] == []
    # `critical` and `fault` collapse onto one tier, so that tier holds two.
    assert result["counts"]["critical"] == 2
