"""Counters are differenced and rates integrated, over a resolved period (T7-09, T7-10).

D14: ``energySummary`` reads ``Number.parseFloat(st.state)`` and computes
``value * price_per_unit``. For a lifetime kWh meter reading 148 231 that
reports a cost of 148 231 x price and labels it "Kostenindikator ... aus
aktuell konfigurierten Zaehlerstaenden". There is no period, no difference
between two readings, and no reset handling at all.

D18: ``integrateEnergy`` trapezoid-integrates consecutive samples, so two
samples six hours apart contribute six hours at their average as though the
plant ran that way throughout -- fabricated energy, in a plausible direction.

T7-09 is the trap the research found at ``statistics.py:1947``:
``prev_sum = prev_sums.get(statistic_id) or 0``. A window that begins before
the statistic's first row reports the entire accumulated total as the first
period's consumption. It is not an error, not a null, and not obviously wrong.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from .phase7_red import emit_queries, missing, report

pytestmark = [
    pytest.mark.expected_red,
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase7-energy-counters]: "
    "reset-aware counter differencing and gap-excluding rate integration are unavailable"
)
EFFECT_PREFIX = "PHASE7_ENERGY_QUERIES "

CORPUS = json.loads(
    (Path(__file__).parent / "fixtures" / "recorder_corpus.json").read_text(encoding="utf-8")
)


def _case(name: str) -> dict:
    for entry in CORPUS["cases"]:
        if entry["name"] == name:
            return entry
    raise AssertionError(f"the corpus has no case named {name!r}")


def test_expected_red_phase7_energy_counters(recorder_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger, models=2)
    gaps: list[str] = []

    gap = missing("energy_model", "period_total")
    if gap:
        gaps.append(gap)
        report(RED_MARKER, gaps, "period energy arithmetic is unavailable")
        return

    from custom_components.glt_flow_card import energy_model

    # A counter is differenced across the resolved period, using the Recorder's
    # reset-aware `change` rather than an implementation of ours.
    complete = _case("complete")
    total = energy_model.period_total({"model": "counter", "unit": "kWh"}, complete)
    if total.get("value") != complete["expect"]["value"]:
        gaps.append(
            f"a counter total is {total.get('value')!r}, expected "
            f"{complete['expect']['value']} from the reset-aware change"
        )
    if total.get("coverage") != 1:
        gaps.append("a complete counter total does not state its coverage")

    # T7-09: a window that starts before the statistic exists is out of
    # coverage, never consumption.
    trap = _case("trap-window-precedes-statistic")
    early = energy_model.period_total({"model": "counter", "unit": "kWh"}, trap)
    if early.get("value") == trap["returned"][0]["change"]:
        gaps.append(
            "a window starting before the statistic exists reported the entire "
            "accumulated total as the first period's consumption"
        )
    if not early.get("out_of_coverage"):
        gaps.append("a period before the statistic's first row is not reported as out of coverage")

    # A null change survives as null rather than being coerced to zero.
    null_case = _case("trap-null-sum")
    nulls = energy_model.period_total({"model": "counter", "unit": "kWh"}, null_case)
    if nulls.get("coverage") == 1:
        gaps.append("a null change was counted as data")

    # D18: a rate integral excludes gaps rather than integrating through them.
    integrate = getattr(energy_model, "integrate_rate", None)
    if integrate is None:
        gaps.append("energy_model.integrate_rate does not exist")
    else:
        with_gap = integrate(
            {"model": "rate", "unit": "kW"},
            {
                "points": [
                    {"time": "2027-06-01T00:00:00+02:00", "value": 10.0},
                    {"time": "2027-06-01T06:00:00+02:00", "value": 10.0},
                ],
                "gaps": [
                    {"end": "2027-06-01T06:00:00+02:00", "start": "2027-06-01T00:00:00+02:00"}
                ],
            },
        )
        if with_gap.get("value") not in (None, 0):
            gaps.append(
                "a six-hour gap was integrated through, inventing energy the plant "
                "may never have used"
            )
        if with_gap.get("coverage") == 1:
            gaps.append("a rate integral over a gap claims full coverage")

    # The two models are never converted implicitly.
    try:
        energy_model.period_total({"unit": "kWh"}, complete)
    except ValueError:
        pass
    else:
        gaps.append("a meter with no declared model was computed anyway")

    report(RED_MARKER, gaps, "period energy arithmetic is unavailable")
