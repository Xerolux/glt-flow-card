"""A roll-up that says how complete it is.

D17: a portfolio figure computed while one site was silent was presented as the
portfolio. That is Phase 7's D16 one network hop out, and it is the defect this
whole phase is named after: **an answer that is incomplete and does not say so.**

The temptation is to treat a partial result as an error, because errors are
simpler. That is wrong in both directions:

- failing the whole roll-up because one site is down makes four healthy sites
  invisible, which is worse than the missing one;
- returning the four and calling it the portfolio is the defect.

So a roll-up carries which sites answered, which did not and why, and **an
aggregate whose completeness is not stated is refused rather than rendered.**

Phase 7's coverage vocabulary is reused rather than paralleled. A second notion
of "how complete is this" is how two parts of a product start disagreeing, which
Phase 6 found four times over in one register.
"""
from __future__ import annotations

from typing import Any

from .measured_value import canonical_number
from .site_vocabulary import ANSWERING_STATES


class IncompleteAggregate(ValueError):
    """An aggregate was built without stating its completeness."""


def coverage_of(answers: list[Any]) -> float:
    """Return the fraction of sites that answered.

    The same shape as Phase 7's series coverage, deliberately: a person who has
    learned to read one reads the other without being taught twice.
    """
    total = len(answers)
    if total == 0:
        return 0.0
    answered = sum(1 for answer in answers if getattr(answer, "state", None) in ANSWERING_STATES)
    return canonical_number(answered / total)


def roll_up(
    answers: list[Any], *, values: dict[str, float] | None = None, label: str = "",
) -> dict[str, Any]:
    """Aggregate across sites, stating what the aggregate is missing.

    `values` maps site id to that site's contribution. A site that did not answer
    must not appear in it: contributing zero for a silent site is exactly how a
    portfolio total comes out smaller and confident.
    """
    answered = [a for a in answers if getattr(a, "state", None) in ANSWERING_STATES]
    answered_ids = {a.site_id for a in answered}
    absent = [
        {"reason": getattr(a, "reason", None), "site_id": a.site_id, "state": a.state}
        for a in answers if a.site_id not in answered_ids
    ]

    contributions = {
        site_id: value for site_id, value in (values or {}).items() if site_id in answered_ids
    }
    ignored = sorted(set(values or {}) - answered_ids)

    return {
        "absent_sites": sorted(absent, key=lambda entry: entry["site_id"]),
        "answered_sites": sorted(answered_ids),
        "complete": not absent,
        "coverage": coverage_of(answers),
        "label": label,
        # Named, so a reader can see whose number is missing rather than only
        # that one is. "Two sites are missing" and "the two northern plants are
        # missing" lead to different actions.
        "ignored_contributions": ignored,
        "total": canonical_number(sum(contributions.values())) if contributions else None,
        "total_sites": len(answers),
    }


def require_stated_completeness(aggregate: Any) -> dict[str, Any]:
    """Return the aggregate, or refuse one that does not state its completeness.

    A guard rather than a convention. A convention is followed until somebody
    adds a fourth aggregate in a hurry, and the failure is silent by
    construction: the number renders and looks right.
    """
    aggregate = aggregate if isinstance(aggregate, dict) else {}
    for field in ("absent_sites", "answered_sites", "complete", "coverage", "total_sites"):
        if field not in aggregate:
            raise IncompleteAggregate(
                f"an aggregate omitted {field!r}; a figure that does not state what it is "
                "missing must not be shown",
            )
    return aggregate
