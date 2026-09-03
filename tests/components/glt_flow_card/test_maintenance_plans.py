"""Due and next-due are computed from a declared plan (T8-21).

D23: `due` was a date string somebody wrote. Four of ASSET-01's named
capabilities — interval plans, operating-hour plans, next-due calculation and
reminders — were absent behind a field that looked like it had them.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from custom_components.glt_flow_card import maintenance_plans
from custom_components.glt_flow_card.maintenance_plans import MIN_COVERAGE, PlanRejected

EFFECT_PREFIX = "PHASE8_PLAN_EFFECTS "


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps({"network": 0, "notification": 0, "remote": 0,
                                      "service": 0, **counts}, sort_keys=True))


def test_an_interval_plan_advances_by_calendar_months_not_by_thirty_days():
    """"Six months from 31 January" and "six times 30 days" are different dates.

    Only the first is what a maintenance plan means, and multiplying is the
    obvious wrong implementation.
    """
    plan = {"model": "interval", "period": "month", "every": 6,
            "last_completed": "2027-01-31T09:00:00+01:00"}
    answer = maintenance_plans.next_due(
        plan, now=datetime(2027, 6, 1, tzinfo=timezone.utc), timezone_name="Europe/Berlin",
    )
    _emit(plans=1)
    # 31 July, not 30 July (6 x 30 days from 31 January is 30 July).
    assert answer["due_at"].startswith("2027-07-31")
    assert answer["state"] == "not_due"


def test_a_month_end_that_does_not_exist_clamps_rather_than_overflowing():
    """31 August plus one month is 30 September, not 1 October."""
    plan = {"model": "interval", "period": "month", "every": 1,
            "last_completed": "2027-08-31T09:00:00+02:00"}
    answer = maintenance_plans.next_due(
        plan, now=datetime(2027, 9, 1, tzinfo=timezone.utc), timezone_name="Europe/Berlin",
    )
    assert answer["due_at"].startswith("2027-09-30")


def test_a_yearly_plan_set_on_29_february_falls_back_to_the_28th():
    """The end of February is what the plan meant, not the start of March."""
    plan = {"model": "interval", "period": "year", "every": 1,
            "last_completed": "2028-02-29T09:00:00+01:00"}
    answer = maintenance_plans.next_due(
        plan, now=datetime(2028, 3, 1, tzinfo=timezone.utc), timezone_name="Europe/Berlin",
    )
    assert answer["due_at"].startswith("2029-02-28")


def test_an_interval_crossing_a_transition_lands_on_the_local_wall_clock():
    """A plan due at 09:00 stays due at 09:00 after the clocks change.

    Adding elapsed hours would move it to 08:00 or 10:00, which is the same
    class of defect as Phase 7's epoch-aligned buckets.
    """
    plan = {"model": "interval", "period": "month", "every": 1,
            "last_completed": "2027-10-15T09:00:00+02:00"}
    answer = maintenance_plans.next_due(
        plan, now=datetime(2027, 10, 20, tzinfo=timezone.utc), timezone_name="Europe/Berlin",
    )
    assert answer["due_at"].startswith("2027-11-15T09:00:00"), answer["due_at"]
    # And the offset moved, because November is winter time.
    assert answer["due_at"].endswith("+01:00")


def test_a_plan_never_completed_is_due_now_rather_than_never():
    """A plan with no completion is the most likely thing in the building to need attention."""
    plan = {"model": "interval", "period": "month", "every": 6}
    answer = maintenance_plans.next_due(plan, now=datetime(2027, 6, 1, tzinfo=timezone.utc))
    assert answer["state"] == "due"
    assert answer["why"]


def test_overdue_is_derived_rather_than_stored():
    plan = {"model": "interval", "period": "month", "every": 1,
            "last_completed": "2027-01-01T09:00:00+01:00"}
    answer = maintenance_plans.next_due(
        plan, now=datetime(2027, 6, 1, tzinfo=timezone.utc), timezone_name="Europe/Berlin",
    )
    assert answer["state"] == "overdue"


def test_an_unknown_period_is_refused_rather_than_defaulted():
    """A plan whose period silently became "month" is an interval nobody chose."""
    with pytest.raises(PlanRejected) as refused:
        maintenance_plans.next_due(
            {"model": "interval", "period": "sometimes", "every": 1},
            now=datetime(2027, 6, 1, tzinfo=timezone.utc),
        )
    assert refused.value.reason == "unknown_period"


def test_the_two_models_are_not_interchangeable():
    """Converting one into the other would mean deciding how many hours a month is.

    A month is 720, 743 or 745 hours depending on the transition — and zero
    running hours for a pump that stayed off.
    """
    with pytest.raises(PlanRejected) as refused:
        maintenance_plans.next_due(
            {"model": "operating_hours", "hours": 2500},
            now=datetime(2027, 6, 1, tzinfo=timezone.utc),
        )
    assert refused.value.reason == "wrong_model"
    with pytest.raises(PlanRejected):
        maintenance_plans.hours_due({"model": "interval", "period": "month", "every": 1}, {})


# --- Operating hours carry their coverage ----------------------------------


def test_operating_hours_below_the_coverage_threshold_do_not_decide():
    """Phase 7's D16 in a new subject.

    A month with half its meters offline reported a smaller, confident cost.
    Here it would report fewer running hours — and under-reporting hours makes a
    service that is overdue look like one that is not, which is the direction
    that ends with a failed bearing.
    """
    plan = {"model": "operating_hours", "hours": 2500}
    measured = {"value": 2400.0, "coverage": 0.5, "unit": "h", "gaps": [{"start": "x", "end": "y"}]}
    answer = maintenance_plans.hours_due(plan, measured)
    assert answer["state"] == "not_determinable"
    assert "50%" in answer["why"]
    # The number is still reported, so the reader can see what was measured --
    # it is the *decision* that is withheld, not the evidence.
    assert answer["hours"] == 2400


def test_operating_hours_with_full_coverage_decide():
    plan = {"model": "operating_hours", "hours": 2500}
    assert maintenance_plans.hours_due(
        plan, {"value": 2600.0, "coverage": 1.0, "unit": "h"},
    )["state"] == "overdue"
    assert maintenance_plans.hours_due(
        plan, {"value": 100.0, "coverage": MIN_COVERAGE, "unit": "h"},
    )["state"] == "not_due"


def test_missing_measured_hours_are_not_determinable_rather_than_zero():
    """Zero running hours and no measurement are different facts.

    Reading absence as zero would report every unmeasured pump as never having
    run, which is the confident-zero shape this project has now corrected in
    three separate phases.
    """
    answer = maintenance_plans.hours_due({"model": "operating_hours", "hours": 2500}, {})
    assert answer["state"] == "not_determinable"
    assert answer["hours"] is None


def test_a_non_positive_hour_threshold_is_refused():
    for hours in (0, -1, None, "many"):
        with pytest.raises(PlanRejected):
            maintenance_plans.hours_due({"model": "operating_hours", "hours": hours}, {})
