"""The declared history boundary: which routes exist, and how they enumerate.

Until this phase every history read in the product was a browser ``callApi``
straight to ``history/period`` (D5). The project policy built in Phase 2, and
routed through by every phase since, had never seen a history request, and no
export was audited. This was the last product area reading shared data with no
route of its own.

That is not only an authorization argument. Bounds (07-09), the statistics
contract, local-calendar periods (07-06) and coverage (07-10) are all
server-side concerns, and the browser is the wrong place to decide any of them.
Moving the boundary is what makes the rest of the phase possible.

This module holds the *declaration*. The handlers live in ``__init__.py`` beside
every other route's, because that is where the guard, the decision and the
manager already are -- and because Phase 6 lost a cycle to a contract that
demanded a ``schedule_audit`` module when the audit correctly lived in the
manager. Where code lives is not the invariant; what it does is.
"""
from __future__ import annotations

from typing import Any

#: The four routes this phase declares, each a capability boundary.
HISTORY_ROUTES: tuple[str, ...] = (
    "glt_flow_card/history/series",
    "glt_flow_card/history/statistics",
    "glt_flow_card/history/export",
    "glt_flow_card/history/coverage",
)

#: How each route enumerates.
#:
#: ``filter`` on the two that return rows, and that is load-bearing: the policy
#: guard deliberately does **not** deny, because a refusal would itself tell an
#: unauthorized caller that rows exist. Filtering is the handler's job, and the
#: limit is applied *after* filtering or it becomes a count oracle for rows the
#: caller may not see. Phase 6 established this for ``schedules/list`` after the
#: ``alarms/list`` leak; it is applied here before it can happen again.
ENUMERATION: dict[str, str] = {
    "glt_flow_card/history/series": "filter",
    "glt_flow_card/history/statistics": "filter",
    "glt_flow_card/history/coverage": "opaque",
    "glt_flow_card/history/export": "opaque",
}

#: Which capability each route requires. Mirrored from ``policy.py`` so a test
#: can compare the two rather than trusting that they agree.
CAPABILITIES: dict[str, str] = {
    "glt_flow_card/history/series": "history.read",
    "glt_flow_card/history/statistics": "history.read",
    "glt_flow_card/history/coverage": "history.read",
    "glt_flow_card/history/export": "history.export",
}


def audit_read(
    route: str,
    *,
    project_id: str,
    entities: int,
    window_hours: float,
    rows: int,
    contract: str,
) -> dict[str, Any]:
    """Return the audit row for one history read or export.

    Every read and every export writes one. An export leaves the building, and
    an export with no audit row is the same defect class as a control with no
    evidence -- the product cannot afterwards say what left, or when, or how
    much of it.

    The row records size rather than content. What a query *asked for* is the
    thing a bound governs and the thing an operator later needs to explain; the
    values themselves are already in the Recorder.
    """
    if route not in HISTORY_ROUTES:
        raise ValueError(f"unknown history route: {route!r}")
    return {
        "action": "history.export" if route.endswith("/export") else "history.read",
        "detail": {
            "contract": contract,
            "entities": int(entities),
            "project_id": project_id,
            "rows": int(rows),
            "route": route,
            "window_hours": round(float(window_hours), 4),
        },
    }
