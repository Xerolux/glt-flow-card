"""Units are checked and exclusions stated before arithmetic (T7-11, T7-12, T7-13).

D15: the unit is read from the entity for *display* and never compared against
anything, so a meter in Wh and one in kWh contribute to the same euro total
three orders of magnitude apart.

D16: an unavailable meter is silently skipped, so a month with half the meters
offline reports a smaller, confident cost. The caller cannot distinguish "no
meters configured" from "no meters readable".

D17: CO2 exists only for ``kind == "electricity"``, so gas and district heat
vanish from a figure presented as the site's.

T7-13 comes from the research: ``StatisticMeanType.CIRCULAR`` is real, and an
arithmetic mean of 350 and 10 degrees is 180 -- exactly the opposite of the
truth, and a value nothing downstream would flag.
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
    "EXPECTED_RED[phase7-energy-units]: "
    "unit validation, stated exclusions and circular means are unavailable"
)
EFFECT_PREFIX = "PHASE7_UNITS_QUERIES "


def test_expected_red_phase7_energy_units(recorder_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger)
    gaps: list[str] = []

    gap = missing("energy_units", "check_units")
    if gap:
        gaps.append(gap)
        report(RED_MARKER, gaps, "unit validation is unavailable")
        return

    from custom_components.glt_flow_card import energy_units

    # D15. Wh against a price in EUR/kWh is refused with a reason, not scaled on
    # a guess and not silently dropped.
    refusal = energy_units.check_units({"unit": "Wh", "price_unit": "EUR/kWh", "model": "counter"})
    if refusal.get("ok") is not False:
        gaps.append("a meter in Wh was combined with a price denominated in EUR/kWh")
    if refusal.get("reason") != "incompatible_unit":
        gaps.append("an incompatible unit pair carries no reason from the closed set")

    matched = energy_units.check_units({"unit": "kWh", "price_unit": "EUR/kWh", "model": "counter"})
    if matched.get("ok") is not True:
        gaps.append("a matching unit pair was refused")

    # The model must agree with the unit: a counter in kW is a declaration error.
    mismatch = energy_units.check_units({"unit": "kW", "model": "counter"})
    if mismatch.get("ok") is not False:
        gaps.append("a counter declared in kW was accepted, which is a rate wearing a counter's name")

    # D16 and D17. A total states its coverage and names what it left out.
    total = getattr(energy_units, "site_total", None)
    if total is None:
        gaps.append("energy_units.site_total does not exist")
    else:
        partial = total([
            {"id": "a", "medium": "electricity", "unit": "kWh", "value": 100.0},
            {"id": "b", "medium": "gas", "unit": "m³", "value": None},
        ])
        if not partial.get("excluded"):
            gaps.append(
                "an unavailable meter was silently skipped, so a month with half the "
                "meters offline reports a smaller, confident number"
            )
        if partial.get("coverage") == 1:
            gaps.append("a total missing a meter claims full coverage")

        # "No meters configured" and "no meters readable" are different results.
        empty = total([])
        unreadable = total([{"id": "a", "medium": "electricity", "unit": "kWh", "value": None}])
        if empty.get("reason") == unreadable.get("reason"):
            gaps.append("no meters configured is indistinguishable from no meters readable")

        co2 = total([{"id": "g", "medium": "gas", "unit": "m³", "value": 10.0}])
        if co2.get("co2") is not None and not co2.get("co2_excluded"):
            gaps.append("a CO₂ figure does not name the media it excludes")

    # T7-13. A circular quantity is never averaged arithmetically.
    circular = getattr(energy_units, "mean_for", None)
    if circular is None:
        gaps.append("energy_units.mean_for does not exist")
    else:
        result = circular([350.0, 10.0], mean_type=2)
        if result.get("value") == 180.0:
            gaps.append(
                "an angular quantity was averaged arithmetically: the mean of 350° and "
                "10° came out as 180°, which is exactly the opposite of the truth"
            )
        if result.get("ok") is False and result.get("reason") != "circular_mean_required":
            gaps.append("a refused circular mean carries no reason from the closed set")

    report(RED_MARKER, gaps, "unit validation is unavailable")
