"""A report schedule is validated when authored and executed by the runner (T7-15).

D20: the designer collects ``schedule`` from a free-text ``prompt()`` --
"Automatik (z.B. 1 07:00) oder leer" -- and stores it on the definition. No
parser, no validator and no runner reads it. The designer's table renders the
string back to the operator under the heading "Automatik", which is the entire
extent of the feature.

So the product displays an automation that does not exist. That is the same
class as Phase 6's shelving, which wrote a field nothing read: a feature that
reports success and does nothing is worse than one that is missing, because the
operator stops checking.
"""
from __future__ import annotations

import pytest

from .phase7_red import emit_queries, missing, report

# The expected_red marker was removed by plan 07-15: this file's sentinel passes.
pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase7-report-schedule]: "
    "validated and executed report schedules are unavailable"
)
EFFECT_PREFIX = "PHASE7_SCHEDULE_QUERIES "


def test_expected_red_phase7_report_schedule(recorder_ledger, notification_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger)
    gaps: list[str] = []

    gap = missing("report_schedule", "validate")
    if gap:
        gaps.append(gap)
        report(RED_MARKER, gaps, "report schedules are unavailable")
        return

    from custom_components.glt_flow_card import report_schedule

    # Refused at save, not discovered at the moment it should have run. This is
    # Phase 6's rule for schedule times applied to the same class of field.
    # An absent schedule is how a report says it runs on demand, and that is
    # valid. An empty string is not absence: the shipped designer stores one
    # when the operator leaves the prompt blank, the 5->6 migration quarantines
    # it, and by the time one reaches the validator something has gone wrong.
    on_demand = report_schedule.validate({"id": "r1"})
    if on_demand.get("ok") is not True or on_demand.get("scheduled") is not False:
        gaps.append("a report with no schedule was treated as broken rather than on-demand")

    for invalid in ("1 07:00", "tea", "", "Automatik"):
        outcome = report_schedule.validate({"schedule": invalid})
        if outcome.get("ok") is not False:
            gaps.append(f"the free-text schedule {invalid!r} was accepted unparsed")

    valid = report_schedule.validate({"schedule": {"days": [1], "kind": "instant", "time": "07:00"}})
    if valid.get("ok") is not True:
        gaps.append("a well-formed schedule was refused")

    # One runner, not a second one that drifts from Phase 6's. The product
    # already had four things disagreeing about alarm severity.
    if missing("report_schedule", "due_instants"):
        gaps.append(
            "report schedules do not resolve through the Phase-6 resolution, so a "
            "second scheduler would drift from the first"
        )

    # Every run recorded, successful or failed, and distinguishable from one
    # that never ran at all.
    record = getattr(report_schedule, "record_run", None)
    if record is None:
        gaps.append("report_schedule.record_run does not exist")
    else:
        failed = record({"id": "monthly"}, outcome="failed", error="renderer unavailable")
        if failed.get("outcome") != "failed" or not failed.get("error"):
            gaps.append("a failed run is not recorded with its error")

    # An unconfigured installation delivers a report to nobody, and the
    # notification ledger's teardown is what proves it.
    if notification_ledger.attempts:
        gaps.append("authoring or validating a schedule reached a notification target")

    report(RED_MARKER, gaps, "report schedules are unavailable")
