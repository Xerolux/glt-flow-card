"""When is this next due? Computed from a declared plan, never typed by hand.

D23: ``due`` was a date string somebody wrote, with no interval plan, no
operating-hour plan, no next-due calculation and no reminder -- four of
ASSET-01's named capabilities absent behind a field that looked like it had
them.

Two models, and they are kept apart for the same reason Phase 7 keeps counters
and rates apart and Phase 6 keeps intervals and instants apart:

- an **interval** plan is calendar time: every six months, on local-calendar
  boundaries;
- an **operating-hour** plan is measured running time, which advances only when
  the plant runs.

Converting one into the other would mean deciding how many hours a month is, and
a month is not a number of hours -- it is 720, 743 or 745 depending on where the
transition falls, and it is *zero* running hours for a pump that stayed off.

Phase 7's period resolution and measured-value shape are reused rather than
paralleled. A second notion of "a month" is how two parts of a product begin
disagreeing, which is the defect Phase 6 found four times over in one register.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from . import period_resolution
from .measured_value import canonical_number

#: The models a plan may declare. Schema 7 makes `model` required, so a plan
#: cannot arrive without saying which of these it is.
PLAN_MODELS: tuple[str, ...] = ("interval", "operating_hours")

#: How much of the window the Recorder must have covered before an
#: operating-hour answer is given.
#:
#: Below this the honest answer is "not determinable" rather than a smaller
#: number presented with the same confidence -- Phase 7's D16 in a new subject,
#: where a month with half its meters offline reported a smaller, confident cost.
#:
#: A site decision with a conservative default: 0.9 means a plan will decline to
#: answer rather than under-report running hours, and under-reporting hours
#: means a service that is overdue looks like one that is not.
MIN_COVERAGE = 0.9

#: What a due calculation can conclude.
DUE_STATES: tuple[str, ...] = ("due", "not_due", "overdue", "not_determinable")

#: Which named period an interval plan's unit maps to.
PERIOD_SPECS: dict[str, str] = {"day": "day", "week": "week-mon", "month": "month", "year": "year"}


class PlanRejected(ValueError):
    """A plan was refused, with a reason."""

    def __init__(self, reason: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or {}


def _add_period(moment: datetime, period: str, count: int, timezone_name: str) -> datetime:
    """Advance a moment by whole calendar periods, in the site timezone.

    Calendar arithmetic, not a multiplication. "Six months from 31 January" and
    "six times 30 days from 31 January" are different dates, and only the first
    is what a maintenance plan means.
    """
    zone = period_resolution._zone(timezone_name)  # noqa: SLF001 - one zone resolver, deliberately
    local = moment.astimezone(zone)
    if period == "day":
        return (local.astimezone(timezone.utc) + timedelta(days=count)).astimezone(zone)
    if period == "week":
        return (local.astimezone(timezone.utc) + timedelta(weeks=count)).astimezone(zone)
    if period == "month":
        target = period_resolution._add_months(local.date().replace(day=1), count)  # noqa: SLF001
        day = min(local.day, _days_in_month(target.year, target.month))
        return local.replace(year=target.year, month=target.month, day=day)
    if period == "year":
        try:
            return local.replace(year=local.year + count)
        except ValueError:
            # 29 February in a non-leap year. Falls back to the 28th rather than
            # to 1 March, because a plan set on the last day of February means
            # the end of February.
            return local.replace(year=local.year + count, day=28)
    raise PlanRejected("unknown_period", {"period": period})


def _days_in_month(year: int, month: int) -> int:
    first = date(year, month, 1)
    return (period_resolution._add_months(first, 1) - first).days  # noqa: SLF001


def next_due(plan: Any, *, now: datetime, timezone_name: str = "UTC") -> dict[str, Any]:
    """Return when an interval plan is next due, and whether it is overdue now."""
    plan = plan if isinstance(plan, dict) else {}
    if plan.get("model") != "interval":
        raise PlanRejected("wrong_model", {"model": plan.get("model")})

    period = str(plan.get("period") or "")
    if period not in PERIOD_SPECS:
        # Refused rather than defaulted. A plan whose period silently became
        # "month" is a service interval nobody chose.
        raise PlanRejected("unknown_period", {"period": period, "allowed": sorted(PERIOD_SPECS)})

    every = plan.get("every")
    if not isinstance(every, int) or isinstance(every, bool) or every < 1:
        raise PlanRejected("interval_not_positive", {"every": every})

    last = plan.get("last_completed")
    if not last:
        # Never done. Due now rather than never: a plan with no completion is
        # the most likely thing in the building to need attention.
        return {
            "coverage": None, "due_at": None, "state": "due",
            "why": "no completion has been recorded for this plan",
        }

    try:
        completed = datetime.fromisoformat(str(last))
    except (TypeError, ValueError):
        raise PlanRejected("unreadable_last_completed", {"last_completed": last}) from None

    due_at = _add_period(completed, period, every, timezone_name)
    state = "overdue" if now > due_at else "not_due"
    return {
        "coverage": None,
        "due_at": period_resolution.canonical_instant(due_at),
        "state": state,
        "why": None,
    }


def hours_due(plan: Any, measured: Any) -> dict[str, Any]:
    """Return whether an operating-hour plan is due, from a measured value.

    `measured` carries Phase 7's shape -- value, unit, coverage, gaps -- so the
    hours arrive with the honesty about what produced them that Phase 7 spent a
    whole phase establishing.
    """
    plan = plan if isinstance(plan, dict) else {}
    if plan.get("model") != "operating_hours":
        raise PlanRejected("wrong_model", {"model": plan.get("model")})

    threshold = plan.get("hours")
    if not isinstance(threshold, (int, float)) or isinstance(threshold, bool) or threshold <= 0:
        raise PlanRejected("hours_not_positive", {"hours": threshold})

    measured = measured if isinstance(measured, dict) else {}
    coverage = measured.get("coverage")
    value = measured.get("value")

    if value is None or not isinstance(coverage, (int, float)):
        return {
            "coverage": coverage, "hours": None, "state": "not_determinable",
            "why": "no measured running hours are available for this window",
        }
    if coverage < MIN_COVERAGE:
        # The honest answer. Under-reporting hours makes a service that is
        # overdue look like one that is not, which is the direction that ends
        # with a failed bearing.
        return {
            "coverage": canonical_number(coverage), "hours": canonical_number(value),
            "state": "not_determinable",
            "why": (f"only {round(coverage * 100)}% of the window was recorded; "
                    f"at least {round(MIN_COVERAGE * 100)}% is required to decide"),
        }

    state = "overdue" if value > threshold else ("due" if value == threshold else "not_due")
    return {
        "coverage": canonical_number(coverage),
        "hours": canonical_number(value),
        "state": state,
        "why": None,
    }
