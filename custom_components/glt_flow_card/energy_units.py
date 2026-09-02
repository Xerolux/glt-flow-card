"""Validate units before arithmetic, and say what a total left out.

Three defects close here, and all three produce a number rather than an error.

D15: the unit is read from the entity for *display* and never compared against
anything, so a meter in ``Wh`` and one in ``kWh`` contribute to the same euro
total three orders of magnitude apart.

D16: an unavailable meter is silently skipped, so a month with half the meters
offline reports a smaller, confident cost. The caller cannot distinguish "no
meters configured" from "no meters readable".

D17: CO2 exists only for ``kind == "electricity"``, so gas and district heat
vanish from a figure presented as the site's.

And T7-13, from the research rather than the audit: ``StatisticMeanType.CIRCULAR``
is real, and an arithmetic mean of 350 and 10 degrees is 180 -- exactly the
opposite of the truth, and a value nothing downstream would flag.

The rule throughout is Phase 5's: **refuse, do not degrade.** An incompatible
pair is refused with a reason rather than converted on a guess, because a wrong
cost figure is a worse degradation than a missing one.
"""
from __future__ import annotations

import math
from typing import Any

from .measured_value import canonical_number, coverage_of
from .period_vocabulary import REFUSAL_REASONS

#: Units grouped by what they measure, with their factor to the group's base.
#: A pair is convertible when both sides are in the same group.
UNIT_GROUPS: dict[str, dict[str, float]] = {
    "energy": {"wh": 0.001, "kwh": 1.0, "mwh": 1000.0},
    "power": {"w": 0.001, "kw": 1.0, "mw": 1000.0},
    "volume": {"ml": 0.000001, "l": 0.001, "m³": 1.0, "m3": 1.0},
    "volume_flow": {"l/min": 0.06, "l/h": 0.001, "m³/h": 1.0, "m3/h": 1.0},
    "mass": {"g": 0.001, "kg": 1.0, "t": 1000.0},
}

#: Which groups each meter model may legitimately be declared in. A counter in
#: kW is a rate wearing a counter's name, and that is a declaration error rather
#: than a conversion problem.
MODEL_GROUPS: dict[str, tuple[str, ...]] = {
    "counter": ("energy", "volume", "mass"),
    "rate": ("power", "volume_flow"),
}

#: Home Assistant's `StatisticMeanType`, mirrored rather than imported so this
#: module states the contract it checks against. A test asserts the two agree.
MEAN_NONE = 0
MEAN_ARITHMETIC = 1
MEAN_CIRCULAR = 2


def _normalise(unit: Any) -> str:
    return str(unit or "").strip().lower()


def group_of(unit: Any) -> str | None:
    """Return the measurement group a unit belongs to, or None."""
    text = _normalise(unit)
    for group, members in UNIT_GROUPS.items():
        if text in members:
            return group
    return None


def check_units(meter: Any) -> dict[str, Any]:
    """Return whether a meter's units are usable together, and why not.

    Checked *before* any arithmetic. The alternative -- computing and then
    noticing -- is how a figure wrong by a factor of a thousand reaches a
    screen.
    """
    meter = meter or {}
    unit = meter.get("unit")
    model = meter.get("model")
    price_unit = meter.get("price_unit")

    if model not in MODEL_GROUPS:
        return _refuse("undeclared_meter_model", f"model {model!r} is not declared")

    # Two different questions wear the same name, and conflating them is how
    # the first draft of this got it wrong.
    #
    # The entity's unit against the *declared* unit is a disagreement about what
    # the meter is. It is refused, not converted: converting would paper over a
    # misconfiguration, and the site should correct the declaration rather than
    # have the product quietly compensate for it.
    #
    # The declared unit against the *price* unit is an arithmetic question with
    # an exact answer. Wh and kWh are the same quantity at a factor of 1000, and
    # refusing that would be pedantry rather than safety. "Not converted on a
    # guess" means exactly that: a factor between two units of the same group is
    # not a guess.
    entity_unit = meter.get("entity_unit")
    if entity_unit and _normalise(entity_unit) != _normalise(unit):
        return _refuse(
            "incompatible_unit",
            f"the entity reports {entity_unit!r} and the meter declares {unit!r}",
        )

    unit_group = group_of(unit)
    if unit_group is None:
        return _refuse("incompatible_unit", f"unit {unit!r} is not a unit this product knows")
    if unit_group not in MODEL_GROUPS[model]:
        return _refuse(
            "incompatible_unit",
            f"a {model} declared in {unit!r} is a {unit_group} quantity",
        )

    if price_unit:
        denominator = str(price_unit).split("/", 1)[-1]
        price_group = group_of(denominator)
        if price_group is None or price_group != unit_group:
            return _refuse(
                "incompatible_unit",
                f"meter in {unit!r} against a price in {price_unit!r}",
            )
        factor = UNIT_GROUPS[unit_group][_normalise(unit)] / UNIT_GROUPS[price_group][_normalise(denominator)]
        return {"factor": canonical_number(factor), "ok": True, "reason": None}

    return {"factor": 1, "ok": True, "reason": None}


def _refuse(reason: str, detail: str) -> dict[str, Any]:
    if reason not in REFUSAL_REASONS:
        raise ValueError(f"unknown refusal reason: {reason!r}")
    return {"detail": detail, "factor": None, "ok": False, "reason": reason}


def site_total(meters: Any) -> dict[str, Any]:
    """Total a site's meters, stating coverage and every exclusion.

    D16 is that a skipped meter shrinks the total silently. Every exclusion is
    named with a reason, and the coverage says how much of the site the number
    actually describes.

    "No meters configured" and "no meters readable" are different results,
    because they call for different actions: one is a setup task and the other
    is a fault.
    """
    rows = [row for row in (meters or []) if isinstance(row, dict)]
    if not rows:
        return {
            "co2": None,
            "co2_excluded": [],
            "coverage": 0,
            "excluded": [],
            "reason": "no_meters_configured",
            "value": None,
        }

    included: list[float] = []
    excluded: list[dict[str, Any]] = []
    co2_total = 0.0
    co2_excluded: list[str] = []
    co2_seen = False

    for row in rows:
        value = row.get("value")
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            excluded.append({"id": row.get("id"), "reason": "no_value"})
            continue
        checked = check_units({**row, "model": row.get("model", "counter")})
        if not checked["ok"]:
            excluded.append({"id": row.get("id"), "reason": checked["reason"]})
            continue
        included.append(float(value))

        # D17: a CO2 figure that silently omits gas and district heat is
        # presented as the site's. Every medium without a factor is named.
        factor = row.get("co2_factor_g_per_unit")
        if isinstance(factor, (int, float)) and not isinstance(factor, bool):
            co2_total += float(value) * float(factor) / 1000
            co2_seen = True
        else:
            co2_excluded.append(str(row.get("medium") or row.get("id")))

    return {
        "co2": canonical_number(round(co2_total, 6)) if co2_seen else None,
        "co2_excluded": sorted(set(co2_excluded)),
        "coverage": coverage_of(len(rows), len(included)),
        "excluded": excluded,
        "reason": None if included else "no_meters_readable",
        "value": canonical_number(sum(included)) if included else None,
    }


def mean_for(values: Any, *, mean_type: int = MEAN_ARITHMETIC) -> dict[str, Any]:
    """Return the mean appropriate to the quantity, or refuse.

    An arithmetic mean of 350 and 10 degrees is 180: due south, when the wind
    was blowing very nearly due north. It is not an error, not an outlier, and
    nothing downstream would flag it -- which is why the declared mean type is
    read rather than the unit guessed at.
    """
    numbers = [
        float(value) for value in (values or [])
        if isinstance(value, (int, float)) and not isinstance(value, bool)
    ]
    if not numbers:
        return {"ok": True, "reason": None, "value": None}

    if mean_type == MEAN_CIRCULAR:
        radians = [math.radians(value) for value in numbers]
        sin_sum = sum(math.sin(angle) for angle in radians)
        cos_sum = sum(math.cos(angle) for angle in radians)
        if abs(sin_sum) < 1e-12 and abs(cos_sum) < 1e-12:
            # Opposed directions cancelling exactly: there is no mean bearing,
            # and inventing one would be worse than saying so.
            return {"ok": False, "reason": "circular_mean_required", "value": None}
        degrees = (math.degrees(math.atan2(sin_sum, cos_sum)) + 360) % 360
        return {"ok": True, "reason": None, "value": canonical_number(round(degrees, 6))}

    if mean_type == MEAN_NONE:
        return {"ok": False, "reason": "unknown_aggregate", "value": None}

    return {
        "ok": True,
        "reason": None,
        "value": canonical_number(round(sum(numbers) / len(numbers), 6)),
    }
