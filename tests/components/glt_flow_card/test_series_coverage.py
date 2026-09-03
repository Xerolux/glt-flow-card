"""Coverage and gaps travel with every series (T7-03, T7-04, T7-05).

Six of the audit's defects are one defect in six costumes, and three of them are
here: an empty Recorder response presented as a populated window (D1), a gap
drawn as a straight line because non-numeric samples are dropped (D6), and an
unreadable binary sample recorded as off (D7).

None of them produces a value an ordinary assertion would flinch at, which is
why every assertion here is about what the answer *says about itself*.

`07-VALIDATION.md` criterion 4 names the trap this file must not fall into: a
test that feeds a Recorder failure and asserts the series is empty has confirmed
the defect rather than caught it, because a correct implementation and a broken
one both produce an empty series. Only the stated source tells them apart, and
the corpus case for it expects `source: "unavailable"` for exactly that reason.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from .phase7_red import emit_queries, missing, report

# The expected_red marker was removed by plan 07-10: this file's sentinel
# passes. The RED gate still classifies it, running the file with filtering off.
pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase7-series-coverage]: "
    "coverage and gaps travelling with every series are unavailable"
)
EFFECT_PREFIX = "PHASE7_COVERAGE_QUERIES "

CORPUS = json.loads(
    (Path(__file__).parent / "fixtures" / "recorder_corpus.json").read_text(encoding="utf-8")
)


def _case(name: str) -> dict:
    for entry in CORPUS["cases"]:
        if entry["name"] == name:
            return entry
    raise AssertionError(f"the corpus has no case named {name!r}")


def test_expected_red_phase7_series_coverage(recorder_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger, cases=len(CORPUS["cases"]))
    gaps: list[str] = []

    gap = missing("series_coverage", "build_series")
    if gap:
        gaps.append(gap)
        report(RED_MARKER, gaps, "series coverage is unavailable")
        return

    from custom_components.glt_flow_card import series_coverage

    # D1. An empty response must not become a populated window.
    empty = series_coverage.build_series(_case("missing"))
    if empty.get("coverage") != 0:
        gaps.append("an empty response reports coverage above zero")
    if empty.get("value") is not None or empty.get("points"):
        gaps.append("an empty response carries points it never received")

    # The distinction criterion 4 turns on: a Recorder failure and an empty
    # result are the same series and different answers.
    failed = series_coverage.build_series(_case("recorder-failure"))
    if failed.get("source") != "unavailable":
        gaps.append(
            "a Recorder failure is indistinguishable from an empty result; only "
            "the stated source separates a correct implementation from a broken one"
        )

    # D6. A gap is carried, and nothing interpolates across it.
    partial = series_coverage.build_series(_case("partial"))
    if not partial.get("gaps"):
        gaps.append("three consecutive missing days produced no gap, so the line closes over them")
    expected = _case("partial")["expect"]["coverage"]
    if abs(float(partial.get("coverage", 0)) - expected) > 0.001:
        gaps.append(f"coverage is {partial.get('coverage')!r}, expected about {expected}")

    # D7. An unreadable binary sample is indeterminate, never off. "I could not
    # read the fault contact" must never be recorded as "it is healthy".
    binary = getattr(series_coverage, "binary_sample", None)
    if binary is None:
        gaps.append("series_coverage.binary_sample does not exist")
    else:
        for raw in ("unavailable", "unknown", None):
            if binary(raw) == 0:
                gaps.append(f"an unreadable binary sample {raw!r} is recorded as off")

    # A complete series says so. Without this, the absent badge starts meaning
    # "we forgot to check" rather than "there is nothing missing".
    whole = series_coverage.build_series(_case("complete"))
    if whole.get("coverage") != 1:
        gaps.append("a complete series does not state that it is complete")

    report(RED_MARKER, gaps, "series coverage is unavailable")
