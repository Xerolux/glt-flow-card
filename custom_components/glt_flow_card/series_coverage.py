"""Build a series that says what it does not know.

Six of the audit's defects are one defect in six costumes -- D1, D6, D7, D10,
D16 and D18 -- and three of them are closed here. Each turns *absent* into a
number, and none produces a value an ordinary assertion would flinch at:

- D1: an empty Recorder response sets a full range over an empty map, so the
  chart draws a plot inside an axis that claims data.
- D6: a non-numeric sample is dropped by ``.filter(Boolean)`` and the line closes
  over the hole, so a six-hour outage renders as a steady plant.
- D7: an unreadable binary sample is recorded as ``0``, so "I could not read the
  fault contact" becomes "the fault contact is healthy".
- D10: an empty period produces no bucket, and the chart joins across it.

The research established the fact that makes coverage computable at all: the
Recorder **omits** empty periods rather than emitting them, so a shorter returned
list is the only signal that data is missing. Coverage is therefore expected
buckets against returned buckets, and it has to be computed here -- where the
expectation is known -- because nothing downstream can reconstruct it.
"""
from __future__ import annotations

from typing import Any

from .measured_value import absent, coverage_of, measured

#: What a sample can be when it is not a number. Closed, and `indeterminate` is
#: a first-class answer rather than a failure to produce one -- the same
#: decision Phase 6 made for an alarm on an unavailable entity.
SAMPLE_STATES: tuple[str, ...] = ("value", "indeterminate")

#: Raw states that mean "the value could not be read". Neither is off, and
#: neither is zero.
UNREADABLE: frozenset[str] = frozenset({"unavailable", "unknown", "none", ""})


def binary_sample(raw: Any) -> Any:
    """Return 1, 0 or None for a binary point.

    ``None`` for anything unreadable, and that is the whole of D7. Today
    ``unavailable`` is not in ``ON_STATES`` so it falls through to ``0``, and a
    fault contact nobody could read is recorded as healthy. There is no
    interpretation of an unreadable sample that is safe to guess: off is a
    claim, and on is a different claim.
    """
    if raw is None:
        return None
    text = str(raw).strip().lower()
    if text in UNREADABLE:
        return None
    if text in {"on", "true", "1", "open", "active", "heat", "cool"}:
        return 1
    if text in {"off", "false", "0", "closed", "idle", "standby"}:
        return 0
    return None


def _instant(row: Any) -> str | None:
    for key in ("start", "time", "last_updated", "last_changed"):
        value = (row or {}).get(key) if isinstance(row, dict) else None
        if isinstance(value, str) and value:
            return value
    return None


def _numeric(row: Any) -> float | None:
    for key in ("change", "value", "mean", "state"):
        value = (row or {}).get(key) if isinstance(row, dict) else None
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return None
    return None


def gaps_between(expected_instants: list[str], returned_instants: list[str]) -> list[dict[str, str]]:
    """Return the intervals the Recorder did not answer for.

    Consecutive missing buckets are merged into one gap rather than listed
    separately, because a renderer needs the *interval* to break the line across,
    and three adjacent one-bucket gaps would be drawn as three breaks with two
    invisible segments between them.
    """
    present = set(returned_instants)
    gaps: list[dict[str, str]] = []
    run_start: str | None = None
    for index, instant in enumerate(expected_instants):
        if instant not in present:
            if run_start is None:
                run_start = instant
            continue
        if run_start is not None:
            gaps.append({"end": instant, "start": run_start})
            run_start = None
    if run_start is not None and expected_instants:
        gaps.append({"end": expected_instants[-1], "start": run_start})
    return gaps


def _whole_window(expected_instants: list[str], case: Any) -> list[dict[str, str]]:
    """Return one gap spanning everything that was asked for.

    Used when nothing came back at all. A single interval rather than one gap
    per bucket: a renderer needs the span to break across, and seven adjacent
    one-day gaps would draw as seven breaks with six invisible segments between
    them.
    """
    if len(expected_instants) >= 2:
        return [{"end": expected_instants[-1], "start": expected_instants[0]}]
    window = case.get("window") or []
    if len(window) == 2:
        return [{"end": str(window[1]), "start": str(window[0])}]
    if len(expected_instants) == 1:
        return [{"end": expected_instants[0], "start": expected_instants[0]}]
    return []


def build_series(case: Any) -> dict[str, Any]:
    """Build one series from a Recorder answer, with its coverage and gaps.

    Takes the corpus case shape so the same function is exercised by the fixture
    corpus and by the live path: ``expected_buckets`` is what the resolved period
    asked for, ``returned`` is what came back, and ``error`` is present when the
    Recorder failed.
    """
    case = case or {}
    period = case.get("period")
    unit = case.get("unit_of_measurement")
    expected_buckets = int(case.get("expected_buckets") or 0)

    # A Recorder failure is a *stated* outcome. This is the trap 07-VALIDATION
    # criterion 4 names: a correct implementation and a broken one both produce
    # an empty series, and only the source separates them. Returning `absent`
    # with source "statistics" here would confirm the defect rather than catch
    # it.
    if case.get("error"):
        # The gaps cover the whole expected window. Reporting coverage 0 with an
        # empty gap list would leave a renderer nothing to break the line
        # across, so the chart would draw an unbroken nothing and the operator
        # would see a flat plant rather than an absent one. Found by the
        # no-Recorder route test rather than by inspection.
        expected_all = [str(entry) for entry in (case.get("expected_instants") or [])]
        return {
            **absent(
                gaps=_whole_window(expected_all, case),
                period=period,
                source="unavailable",
                unit=unit,
            ),
            "error": str(case["error"]),
            "expected_buckets": expected_buckets,
            "points": [],
            "returned_buckets": 0,
        }

    returned = [row for row in (case.get("returned") or []) if isinstance(row, dict)]
    returned_instants = [instant for instant in (_instant(row) for row in returned) if instant]

    points: list[dict[str, Any]] = []
    for row in returned:
        instant = _instant(row)
        value = _numeric(row)
        if instant is None:
            continue
        # A null value is a *bucket the Recorder answered for with no number*,
        # which is not the same as a bucket it never returned. It becomes an
        # indeterminate point rather than a dropped one, so the line breaks
        # there instead of closing over it.
        points.append({
            "at": instant,
            "state": "value" if value is not None else "indeterminate",
            "value": value,
        })

    answered = [point for point in points if point["state"] == "value"]
    coverage = coverage_of(expected_buckets, len(answered))

    # The expectation comes from the resolved period, not from what came back.
    # That is the whole reason coverage is computed here: only the caller that
    # resolved the period knows which buckets were asked for, and inferring the
    # grid from the returned rows would make a series with three missing days
    # look like a shorter series with none.
    expected_instants = [
        instant for instant in (case.get("expected_instants") or []) if instant
    ]
    gaps = gaps_between(expected_instants, [point["at"] for point in answered])
    if not gaps and expected_buckets > len(answered):
        # No grid was supplied and buckets are missing. The gap is real and its
        # position is unknown, so the window is named rather than nothing: "some
        # of this is missing" is honest, and silence is not.
        window = case.get("window") or []
        if len(window) == 2:
            gaps = [{"end": str(window[1]), "start": str(window[0])}]

    if not answered:
        return {
            **absent(gaps=gaps, period=period, source=str(case.get("contract") or "statistics"), unit=unit),
            "expected_buckets": expected_buckets,
            "points": points,
            "returned_buckets": len(returned),
        }

    total = sum(point["value"] for point in answered)
    return {
        **measured(
            coverage=coverage,
            gaps=gaps,
            period=period,
            source=str(case.get("contract") or "statistics"),
            unit=unit,
            value=total,
        ),
        "expected_buckets": expected_buckets,
        "points": points,
        "returned_buckets": len(returned),
    }
