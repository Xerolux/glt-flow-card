"""Two meter models, kept apart, over a resolved period.

D14: ``energySummary`` reads ``Number.parseFloat(st.state)`` and computes
``value * price_per_unit``. For a lifetime kWh meter reading 148 231 that reports
a cost of 148 231 x price and calls it the site's. There is no period, no
difference between two readings, and no reset handling of any kind.

D18: ``integrateEnergy`` trapezoid-integrates consecutive samples, so two samples
six hours apart contribute six hours at their average as though the plant ran
that way throughout -- fabricated energy, in a plausible direction.

The two models are never converted into each other implicitly, which is Phase 6's
interval-and-instant rule in a new subject:

- a **counter** accumulates, and its consumption for a period is a *difference*
  across the period boundary;
- a **rate** is an instantaneous measurement, and its energy for a period is an
  *integral* over it.

Reset handling is the Recorder's, not ours. ``07-RESEARCH.md`` established that
``change`` is ``sum - prev_sum`` over a reset-corrected running total, so a
counter's period consumption is already reset-aware. Re-implementing meter reset
detection would duplicate a well-tested implementation and -- since resets are
rare and hard to fixture -- get it wrong in a way nobody notices for months.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from .measured_value import absent, canonical_number, coverage_of, measured
from .series_coverage import gaps_between

#: The two models. Closed, and a meter must declare which it is: schema 6 makes
#: `model` required for exactly this reason.
METER_MODELS: tuple[str, ...] = ("counter", "rate")


def _model_of(meter: Any) -> str:
    model = (meter or {}).get("model")
    if model not in METER_MODELS:
        raise ValueError(f"undeclared_meter_model: {model!r}")
    return model


def _instants(case: Any) -> list[str]:
    return [str(entry) for entry in ((case or {}).get("expected_instants") or [])]


def _first_recorded(case: Any) -> str | None:
    return (case or {}).get("statistic_first_row")


def period_total(meter: Any, case: Any) -> dict[str, Any]:
    """Return a counter's consumption for the resolved period.

    Uses the Recorder's ``change``, which is already reset-aware. What this adds
    is the thing the Recorder cannot know: **which buckets were asked for**, and
    therefore which of them lie outside the statistic's own coverage.
    """
    model = _model_of(meter)
    if model != "counter":
        raise ValueError(f"period_total is for counters, not {model!r}")

    unit = (meter or {}).get("unit")
    expected = _instants(case)
    returned = [row for row in ((case or {}).get("returned") or []) if isinstance(row, dict)]

    # T7-09, the trap the research found at `statistics.py:1947`:
    # `prev_sum = prev_sums.get(statistic_id) or 0`. When the window begins
    # before the statistic's first recorded row there is no previous sum, it
    # defaults to zero, and the first bucket's `change` is the *entire
    # accumulated total*. It is not an error, not a null, and not obviously
    # wrong -- a plausible large number in the first period of the window.
    first_row = _first_recorded(case)
    out_of_coverage = [
        instant for instant in expected
        if first_row is not None and _before(instant, first_row)
    ]

    usable = []
    for row in returned:
        instant = str(row.get("start") or "")
        change = row.get("change")
        if first_row is not None and _before(instant, first_row):
            # Inside the statistic's rows but before its first recorded value is
            # impossible; a row *at* the first instant is where the zero-previous
            # -sum trap bites, so its change is unusable rather than merely
            # suspect.
            continue
        if instant and first_row is not None and instant == first_row:
            continue
        if isinstance(change, (int, float)) and not isinstance(change, bool):
            usable.append((instant, float(change)))

    covered = coverage_of(len(expected), len(usable))
    gaps = gaps_between(expected, [instant for instant, _ in usable])

    if not usable:
        return {
            **absent(gaps=gaps, period=(case or {}).get("period"), source="statistics", unit=unit),
            "out_of_coverage": out_of_coverage,
        }

    return {
        **measured(
            coverage=covered,
            gaps=gaps,
            period=(case or {}).get("period"),
            source="statistics",
            unit=unit,
            value=canonical_number(sum(value for _, value in usable)),
        ),
        "out_of_coverage": out_of_coverage,
    }


def _before(left: str, right: str) -> bool:
    try:
        return datetime.fromisoformat(left) < datetime.fromisoformat(right)
    except (TypeError, ValueError):
        return False


def integrate_rate(meter: Any, series: Any) -> dict[str, Any]:
    """Integrate a rate over a period, excluding gaps from the integral.

    D18 is that the shipped code integrates *through* a gap: two samples six
    hours apart contribute six hours at their average. The plant may have been
    off for five of them. Excluding the gap and reporting the excluded span is
    the only answer that is not an invention -- and reporting it matters as much
    as excluding it, because a total that quietly covers half a period is a
    smaller number presented with the same confidence as a whole one.
    """
    model = _model_of(meter)
    if model != "rate":
        raise ValueError(f"integrate_rate is for rates, not {model!r}")

    unit = (meter or {}).get("unit")
    points = [row for row in ((series or {}).get("points") or []) if isinstance(row, dict)]
    gaps = [row for row in ((series or {}).get("gaps") or []) if isinstance(row, dict)]

    total = 0.0
    integrated_seconds = 0.0
    for left, right in zip(points, points[1:]):
        start = str(left.get("time") or left.get("at") or "")
        end = str(right.get("time") or right.get("at") or "")
        if _spans_gap(start, end, gaps):
            continue
        seconds = _seconds_between(start, end)
        if seconds <= 0:
            continue
        left_value = left.get("value")
        right_value = right.get("value")
        if not _is_number(left_value) or not _is_number(right_value):
            continue
        total += (float(left_value) + float(right_value)) / 2 * (seconds / 3600)
        integrated_seconds += seconds

    span_seconds = _seconds_between(
        str((points[0] or {}).get("time") or (points[0] or {}).get("at") or "") if points else "",
        str((points[-1] or {}).get("time") or (points[-1] or {}).get("at") or "") if points else "",
    )
    covered = 0.0 if span_seconds <= 0 else min(1.0, integrated_seconds / span_seconds)

    if integrated_seconds <= 0:
        return absent(gaps=gaps, period=(series or {}).get("period"), source="raw", unit=unit)

    return measured(
        coverage=canonical_number(round(covered, 6)),
        gaps=gaps,
        period=(series or {}).get("period"),
        source="raw",
        unit=unit,
        value=canonical_number(round(total, 6)),
    )


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _seconds_between(start: str, end: str) -> float:
    try:
        return (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds()
    except (TypeError, ValueError):
        return 0.0


def _spans_gap(start: str, end: str, gaps: list[dict[str, Any]]) -> bool:
    """Return whether the interval between two samples crosses a known gap."""
    for gap in gaps:
        gap_start = str(gap.get("start") or "")
        gap_end = str(gap.get("end") or "")
        if not gap_start or not gap_end:
            continue
        if not _before(end, gap_start) and not _before(gap_end, start):
            return True
    return False
