"""Every query dimension is bounded before the query runs (T7-02).

D3: nothing in the Recorder API bounds a raw query -- not rows, not entities,
not window -- so the bound is ours to impose, and it belongs server-side because
the browser cannot be trusted to ask for less than it wants. Today the entity
count is the number of entities on the card, the window is
``max(replay.hours, trend.hours)`` defaulting to 168, and there is no row cap at
all.

The assertion that matters most is the one about *refusal*. A window past the
limit must be refused with the limit named, or answered from statistics and
labelled -- never silently truncated, because a truncated window produces a
chart of the wrong period that looks exactly like a chart of the right one.
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
    "EXPECTED_RED[phase7-history-bounds]: "
    "enforced row, entity and window bounds are unavailable"
)
EFFECT_PREFIX = "PHASE7_BOUNDS_QUERIES "

#: The three dimensions 07-09 bounds, each a configured number.
BOUND_NAMES = ("max_entities", "max_raw_window_hours", "max_rows")


def test_expected_red_phase7_history_bounds(recorder_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger, bounds=len(BOUND_NAMES))
    gaps: list[str] = []

    gap = missing("history_bounds", "resolve_bounds")
    if gap:
        gaps.append(gap)
        report(RED_MARKER, gaps, "enforced query bounds are unavailable")
        return

    from custom_components.glt_flow_card import history_bounds

    bounds = history_bounds.resolve_bounds({})
    for name in BOUND_NAMES:
        if name not in bounds:
            gaps.append(f"{name} is not a configured bound")

    # Configurable *and* conservative by default, the treatment Phase 6 gave the
    # alarm philosophy: build the mechanism, configure the policy, default
    # conservatively, and document each default as a site decision.
    configured = history_bounds.resolve_bounds({"max_entities": 5})
    if configured.get("max_entities") != 5:
        gaps.append("a site cannot configure max_entities, so the bound is a constant")

    # Refused with the limit named, or downgraded and labelled. Never truncated.
    decide = getattr(history_bounds, "decide_query", None)
    if decide is None:
        gaps.append("history_bounds.decide_query does not exist, so nothing enforces a bound")
    else:
        over = decide({"contract": "raw", "entities": 1, "window_hours": 100_000}, bounds)
        if over.get("outcome") == "truncate":
            gaps.append(
                "an over-long window is silently truncated, producing a chart of the "
                "wrong period that looks exactly like a chart of the right one"
            )
        if over.get("outcome") not in {"refuse", "downgrade"}:
            gaps.append("an over-long window is neither refused nor downgraded")
        if over.get("outcome") == "refuse" and str(bounds.get("max_raw_window_hours")) not in str(
            over.get("reason", "")
        ) + str(over.get("limit", "")):
            gaps.append("a refusal does not name the limit it enforced")
        if over.get("outcome") == "downgrade" and over.get("source") != "statistics":
            gaps.append("a downgraded query does not label itself as answered from statistics")

    report(RED_MARKER, gaps, "enforced query bounds are unavailable")
