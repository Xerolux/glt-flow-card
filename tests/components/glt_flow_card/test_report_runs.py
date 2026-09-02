"""A report run records what it was computed from, and reproduces it (T7-14, T7-18).

D19: ``reportCsv`` iterates ``card._config.kpis``, ``alarms`` and ``assets`` and
writes ``card._display?.(...)`` -- the value being rendered right now. The
designer offers day, week, month and year; nothing downstream reads ``period``.
A "Monatsbericht" contains one instant and says so nowhere.

D23: ids are ``report_${Date.now()}``. Phase 5 found and fixed the same defect
in paste, for the same two reasons: a clock-derived id is not reproducible and
collides within a millisecond. Reports are the one artefact in this product that
is explicitly required to be reproducible.

Both halves of reproducibility are asserted. A report that silently produces a
different number the second time is worse than one that refuses, because the
first version has already been sent to someone.
"""
from __future__ import annotations

import pytest

from .phase7_red import emit_queries, missing, report

pytestmark = [
    pytest.mark.expected_red,
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase7-report-runs]: "
    "reports that record their inputs and reproduce their values are unavailable"
)
EFFECT_PREFIX = "PHASE7_REPORT_QUERIES "

#: What a run must record, from 07-PATTERNS' recorded-run shape.
RECORDED_INPUTS = (
    "aggregate", "coverage", "deadband", "produced_at", "report_id",
    "sources", "timezone", "version", "window",
)


def test_expected_red_phase7_report_runs(recorder_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger, inputs=len(RECORDED_INPUTS))
    gaps: list[str] = []

    gap = missing("report_runs", "execute")
    if gap:
        gaps.append(gap)
        report(RED_MARKER, gaps, "recorded report runs are unavailable")
        return

    from custom_components.glt_flow_card import report_runs

    definition = {
        "content": ["kpis"],
        "id": "monthly",
        "period": {"name": "month", "offset": -1},
        "version": 1,
    }
    run = report_runs.execute(definition, now="2027-11-15T09:30:00+01:00", timezone="Europe/Berlin")

    for field in RECORDED_INPUTS:
        if field not in run:
            gaps.append(f"a run does not record {field}")

    # The content comes from the resolved period, not from the current screen.
    window = run.get("window") or {}
    if not window.get("start", "").startswith("2027-10-01"):
        gaps.append(
            "a monthly run's window is not the resolved month; the shipped report "
            "is a snapshot of the current screen with a period label nothing reads"
        )

    # Reproducible, or explicit about which input changed.
    again = report_runs.execute(definition, now="2027-11-15T09:30:00+01:00", timezone="Europe/Berlin")
    if again.get("value") != run.get("value"):
        gaps.append("re-running over unchanged inputs produced a different value")
    changed = report_runs.execute(
        {**definition, "version": 2}, now="2027-11-15T09:30:00+01:00", timezone="Europe/Berlin"
    )
    if not changed.get("changed_inputs"):
        gaps.append("re-running over changed inputs did not name which input changed")

    # D23. Ids are content-derived or authored, never minted from the clock.
    if str(run.get("report_id", "")).startswith("report_") and run.get("report_id") != definition["id"]:
        gaps.append("a report id was minted from the clock, so no run can be reproduced")

    # Retention is bounded with a conservative default, as Phase 6 bounded
    # alarm history. Unbounded state is a leak with a friendly name.
    if missing("report_runs", "prune_runs"):
        gaps.append("report runs are retained without bound")

    report(RED_MARKER, gaps, "recorded report runs are unavailable")
