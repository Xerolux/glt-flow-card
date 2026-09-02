"""History reads go through a server-owned boundary (T7-01).

D5: every history read in the product today is a browser ``callApi`` to
``history/period``. The project policy built in Phase 2 and routed through by
Phases 3 to 6 has never seen a history request, and no export is audited. This
is the last product area that reads shared data with no policy route.

Every assertion here is about an *outcome* -- a route that enforces, a caller
who sees only their own rows, an audit row that exists. None of them names a
module or a function, because Phase 6 lost a cycle to a sentinel that demanded a
``schedule_audit`` module when the audit correctly lived in the manager, and a
contract that names an implementation shape rather than an effect fails correct
work.
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
    "EXPECTED_RED[phase7-history-routes]: "
    "server-owned, filtered and audited history routes are unavailable"
)
EFFECT_PREFIX = "PHASE7_HISTORY_QUERIES "

#: The four routes 07-08 declares. Each is a capability boundary, not a helper.
EXPECTED_ROUTES = (
    "glt_flow_card/history/series",
    "glt_flow_card/history/statistics",
    "glt_flow_card/history/export",
    "glt_flow_card/history/coverage",
)


def test_expected_red_phase7_history_routes(recorder_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger, routes=len(EXPECTED_ROUTES))
    gaps: list[str] = []

    gap = missing("history_routes", "HISTORY_ROUTES")
    if gap:
        gaps.append(gap)
    else:
        from custom_components.glt_flow_card import history_routes
        from custom_components.glt_flow_card import policy

        declared = set(getattr(history_routes, "HISTORY_ROUTES", ()))
        for route in EXPECTED_ROUTES:
            if route not in declared:
                gaps.append(f"{route} is not declared")

        # Both tables, deliberately duplicated at different trust boundaries: a
        # route present in only one passes the prober and fails the contract.
        #
        # `COMMAND_POLICIES` is asked for by name because it is the mapping the
        # guard itself consults -- asserting against the thing that decides,
        # rather than against a table that might merely describe it. The first
        # draft of this guessed at `POLICY_TABLE`, which is the mistake this
        # file's own docstring warns about: a contract that names a shape rather
        # than an effect fails correct work.
        for route in EXPECTED_ROUTES:
            declared_policy = policy.COMMAND_POLICIES.get(route)
            if declared_policy is None:
                gaps.append(f"{route} is absent from the shipped policy table")
                continue
            expected_capability = history_routes.CAPABILITIES[route]
            if declared_policy.capability != expected_capability:
                gaps.append(
                    f"{route} requires {declared_policy.capability!r}, "
                    f"not the declared {expected_capability!r}"
                )

        # Filtering, not denial: a refusal tells an unauthorized caller that
        # rows exist. And the limit is applied *after* filtering, or it becomes
        # a count oracle for rows the caller may not see.
        enumeration = getattr(history_routes, "ENUMERATION", {})
        for route in ("glt_flow_card/history/series", "glt_flow_card/history/statistics"):
            if enumeration.get(route) != "filter":
                gaps.append(f"{route} denies rather than filters, which leaks that rows exist")
            # And the guard must agree, or the declaration is a comment.
            guarded = policy.COMMAND_POLICIES.get(route)
            if guarded is not None and guarded.enumeration != "filter":
                gaps.append(f"{route} is declared filtering but the guard denies")

        if missing("history_routes", "audit_read"):
            gaps.append(
                "no history read or export is audited; an export leaves the building "
                "and is the same defect class as a control with no evidence"
            )

    # The browser must issue no Recorder request of its own once 07-17 lands,
    # and this sentinel must be able to see that. An empty ledger here is the
    # correct starting state, not evidence of anything yet.
    if recorder_ledger.asked():
        gaps.append("the sentinel itself queried a Recorder, which it must not")

    report(RED_MARKER, gaps, "server-owned history routes are unavailable")
