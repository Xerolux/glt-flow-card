"""Bound every dimension of a history query, before the query runs.

``07-RESEARCH.md`` §6 established the fact this module exists for: **nothing in
the Recorder API bounds a raw query.** Not rows, not entities, not window. So the
bound is ours to impose, and it belongs on the server side of the route because
the browser cannot be trusted to ask for less than it wants -- and, since 07-08,
is not the one asking.

What ships today has no bound at all (D3). The entity count is however many
entities are on the card, chunked forty at a time but unlimited in chunks; the
window is ``max(replay.hours, trend.hours)`` defaulting to 168; and raw states
have no row cap.

**The rule that matters here is refuse-or-downgrade, never truncate.** A refused
query is visibly refused. A downgraded one says it was answered from statistics.
A silently truncated one produces a chart of the wrong period that looks exactly
like a chart of the right one -- and that is this phase's defining failure, a
plausible answer nobody can tell is wrong.

Every default below is a **site decision**, in the sense Phase 6 established for
the alarm philosophy: build the mechanism, configure the policy, default
conservatively, and record each default as a decision rather than a product
opinion. The values are deliberately modest. A site that needs more says so.
"""
from __future__ import annotations

from typing import Any

from .period_vocabulary import REFUSAL_REASONS

#: The conservative defaults. Each is a site decision, not a product opinion.
#:
#: - 40 entities matches the chunk size the shipped code already used, so the
#:   default refuses nothing that worked before while giving the bound a name.
#: - 168 hours of *raw* states is a week, which is what a trend view is for.
#:   Longer windows are answered from statistics, which return one row per
#:   period rather than one per state change.
#: - 50 000 rows is a response an operator's browser can still render. Beyond it
#:   the answer is a chart nobody can read, delivered slowly.
DEFAULT_BOUNDS: dict[str, int] = {
    "max_entities": 40,
    "max_points": 4000,
    "max_raw_window_hours": 168,
    "max_rows": 50_000,
}

#: Outcomes a bound decision may reach. Closed, and "truncate" is deliberately
#: absent: it is the behaviour this module exists to make unreachable.
DECISION_OUTCOMES: tuple[str, ...] = ("allow", "downgrade", "refuse")


def resolve_bounds(settings: Any) -> dict[str, int]:
    """Return the effective bounds for a site.

    Configurable *and* conservative: a site may raise or lower any of them, and
    an installation that configured nothing gets the modest defaults rather than
    no bound at all.
    """
    resolved = dict(DEFAULT_BOUNDS)
    for name in DEFAULT_BOUNDS:
        value = (settings or {}).get(name)
        if isinstance(value, bool) or not isinstance(value, int):
            continue
        if value < 1:
            # A bound of zero or less is not a stricter bound, it is a broken
            # one: it would refuse every query and read as an outage.
            continue
        resolved[name] = value
    return resolved


def decide_query(request: Any, bounds: Any) -> dict[str, Any]:
    """Decide whether a query may run as asked, and say what happens if not.

    Returns one of three outcomes and never a fourth. `allow` runs as asked;
    `refuse` names the limit it enforced, because a bare refusal tells an
    engineer the tool disagrees with them while a reason tells them which of the
    two is wrong; `downgrade` answers from statistics and **labels itself**, so
    the reader knows which contract produced the number.
    """
    effective = resolve_bounds(bounds if isinstance(bounds, dict) else {})
    contract = str((request or {}).get("contract") or "raw")
    entities = int((request or {}).get("entities") or 0)
    window_hours = float((request or {}).get("window_hours") or 0)

    if entities > effective["max_entities"]:
        return _refusal(
            "entities_exceed_limit",
            limit=effective["max_entities"],
            detail=f"{entities} entities requested, limit {effective['max_entities']}",
        )

    if contract == "raw" and window_hours > effective["max_raw_window_hours"]:
        # Downgraded rather than refused: the caller asked a question that is
        # answerable, just not from raw states. Refusing would be correct and
        # unhelpful; truncating would be helpful and wrong.
        return {
            "limit": effective["max_raw_window_hours"],
            "outcome": "downgrade",
            "reason": "window_exceeds_limit",
            "source": "statistics",
        }

    return {"limit": None, "outcome": "allow", "reason": None, "source": contract}


def _refusal(reason: str, *, limit: int, detail: str) -> dict[str, Any]:
    if reason not in REFUSAL_REASONS:
        raise ValueError(f"unknown refusal reason: {reason!r}")
    return {"detail": detail, "limit": limit, "outcome": "refuse", "reason": reason, "source": None}


def cap_rows(rows: list[Any], bounds: Any) -> dict[str, Any]:
    """Return at most `max_rows` rows, and say whether the cap was reached.

    The declaration is the point. A capped response that does not say so is a
    truncation wearing a different name, and the reader has no way to know the
    series continues past the edge of what they were given.
    """
    effective = resolve_bounds(bounds if isinstance(bounds, dict) else {})
    limit = effective["max_rows"]
    return {"capped": len(rows) > limit, "limit": limit, "rows": list(rows)[:limit]}
