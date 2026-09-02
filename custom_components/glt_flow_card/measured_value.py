"""The measured value: a number and the evidence for it, travelling together.

Mirrored from ``src/v100/measured-value.mjs`` rather than imported, and a test
proves the two produce identical canonical bytes.

Phase 7's audit found six defects that are one defect in six costumes -- D1, D6,
D7, D10, D16 and D18 -- and each of them turns *absent* into a number: an empty
Recorder response presented as a populated window; a dropped non-numeric sample
with the line closing over the hole; an unreadable binary sample recorded as off;
an omitted empty period joined across; an unavailable meter silently shrinking a
total; and integration running straight through a gap.

None of those produces a value an ordinary assertion would flinch at. That is why
coverage is a **field** and not a convention: a consumer that ignores it has to
ignore it deliberately, and a test can assert on what the product says about its
own answer rather than only on the answer.

``value: None`` with ``coverage: 0`` is a complete, valid answer. Zero is not a
substitute for it, and neither is the nearest neighbour.
"""
from __future__ import annotations

import json
from typing import Any

from .period_vocabulary import is_period_name, is_value_source

#: The fields every measured value carries. Closed.
MEASURED_FIELDS: tuple[str, ...] = (
    "coverage",
    "gaps",
    "period",
    "resolved_at",
    "source",
    "unit",
    "value",
)


def _check_coverage(coverage: Any) -> float:
    if isinstance(coverage, bool) or not isinstance(coverage, (int, float)):
        raise ValueError("a measured value needs a coverage fraction")
    if coverage != coverage:  # NaN
        raise ValueError("a measured value needs a coverage fraction")
    if coverage < 0 or coverage > 1:
        raise ValueError(f"coverage must be a fraction between 0 and 1, got {coverage}")
    return float(coverage)


def _check_gaps(gaps: Any) -> list[dict[str, str]]:
    if not isinstance(gaps, (list, tuple)):
        raise ValueError("gaps must be a list, empty when there are none")
    checked: list[dict[str, str]] = []
    for gap in gaps:
        start = (gap or {}).get("start") if isinstance(gap, dict) else None
        end = (gap or {}).get("end") if isinstance(gap, dict) else None
        if not isinstance(start, str) or not isinstance(end, str):
            raise ValueError("every gap names a start and an end")
        checked.append({"end": end, "start": start})
    return checked


def _canonical_number(value: float) -> float | int:
    """Return the number in the form both runtimes serialise identically.

    JavaScript has one number type, so ``JSON.stringify(0)`` is ``0`` and there is
    no ``0.0``. Python's ``json.dumps(0.0)`` is ``0.0``. A coverage of exactly
    zero or exactly one therefore produced identical values and different bytes
    -- which is precisely the failure Phase 6 spent a cycle on, arriving here by
    a new route within an hour of the lesson being written down.

    Non-integral floats need no help: both runtimes emit the shortest
    round-tripping representation, so 4/7 is ``0.5714285714285714`` in each.
    """
    integral = int(value)
    return integral if value == integral else value


def measured(
    *,
    value: float | None,
    unit: str | None = None,
    coverage: Any,
    gaps: Any = (),
    source: str,
    period: str | None = None,
    resolved_at: str | None = None,
) -> dict[str, Any]:
    """Build a measured value.

    Refuses to build one without coverage. That refusal is the whole point of the
    constructor: the alternative is a default, and a default coverage of 1 would
    reintroduce every defect above in a single line.
    """
    checked_coverage = _check_coverage(coverage)
    checked_gaps = _check_gaps(gaps)
    if not is_value_source(source):
        raise ValueError(f"unknown_source: {source!r}")
    if period is not None and not is_period_name(period):
        raise ValueError(f"unknown_period: {period!r}")
    if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
        raise ValueError("a measured value is a number or None, never a string or a placeholder")
    if value is not None and checked_coverage == 0:
        # The contradiction worth catching early: a number that covers nothing
        # came from somewhere it should not have.
        raise ValueError("a value with zero coverage is not a value")
    return {
        "coverage": _canonical_number(checked_coverage),
        "gaps": checked_gaps,
        "period": period,
        "resolved_at": resolved_at,
        "source": source,
        "unit": unit,
        "value": None if value is None else _canonical_number(float(value)),
    }


def absent(
    *,
    source: str,
    unit: str | None = None,
    period: str | None = None,
    gaps: Any = (),
    resolved_at: str | None = None,
) -> dict[str, Any]:
    """Build the answer for "we asked and there is nothing there".

    A named constructor rather than a convention, because this is the case the
    product currently cannot express, and every one of the six defects above is
    what happens when it has to be expressed as something else.
    """
    return measured(
        coverage=0,
        gaps=gaps,
        period=period,
        resolved_at=resolved_at,
        source=source,
        unit=unit,
        value=None,
    )


def has_value(entry: dict[str, Any] | None) -> bool:
    """Return whether this value carries a number at all."""
    return bool(entry) and entry.get("value") is not None


def is_complete(entry: dict[str, Any] | None) -> bool:
    """Return whether every expected bucket was answered."""
    return bool(entry) and entry.get("coverage") == 1 and not entry.get("gaps")


def coverage_of(expected_buckets: int, returned_buckets: int) -> float:
    """Compute coverage from what was expected against what came back.

    The research established that the Recorder omits empty periods rather than
    emitting them, so a shorter returned list is the only signal that data is
    missing. Materialising the expected buckets and comparing is therefore the
    only place coverage can honestly come from.
    """
    if isinstance(expected_buckets, bool) or not isinstance(expected_buckets, int):
        raise ValueError("expected bucket count must be a non-negative integer")
    if expected_buckets < 0:
        raise ValueError("expected bucket count must be a non-negative integer")
    if expected_buckets == 0:
        return 0.0
    returned = max(0, min(int(returned_buckets), expected_buckets))
    return returned / expected_buckets


def canonical_measured(entry: dict[str, Any]) -> str:
    """Return the canonical bytes both runtimes must agree on.

    Separators are given explicitly so Python's default ``", "`` spacing cannot
    make two identical values disagree on bytes. Phase 6 spent a cycle on that
    exact failure -- the runtimes agreed on every value and disagreed on every
    byte -- and the cause was serialisation both times.
    """
    return json.dumps(entry, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
