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

# The expected_red marker was removed by plan 07-08: this file's sentinel
# passes, so it is a regression suite now rather than a specification of
# something missing. The RED gate still classifies it -- it runs the file with
# filtering off, and assert-red.mjs reports a sentinel that passes as
# implemented rather than as broken.
pytestmark = [
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


async def test_a_route_with_no_recorder_states_it_rather_than_returning_empty(
    hass, config_entry, phase2_users,
) -> None:
    """The distinction 07-VALIDATION criterion 4 turns on.

    A Home Assistant with the Recorder disabled is a supported configuration,
    not a fault. The route must say so: an empty series sourced "statistics"
    and an empty series sourced "unavailable" look identical to every assertion
    about the result's shape, and only the second is true here.

    This is also what proves the query is wired at all. Before the Recorder
    query landed the handler returned a hard-coded `source: "unavailable"`,
    which would pass an assertion that only checked the string.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for, _ask_recorder

    manager = _manager(hass)
    manager.data["projects"]["history-live"] = {
        "id": "history-live",
        "config": {"timezone": "Europe/Berlin", "trend": {}},
    }
    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id="history-live",
        user_id=phase2_users.principal("viewer").user_id,
        role="viewer",
    )

    # The query function itself, so the branch is reached rather than inferred
    # from the handler's output.
    answer, error = await _ask_recorder(hass, {
        "contract": "statistics",
        "message": {
            "end_time": "2027-06-08T00:00:00+02:00",
            "period": "day",
            "start_time": "2027-06-01T00:00:00+02:00",
            "statistic_ids": ["sensor.a"],
            "types": ["change"],
        },
    })
    assert answer is None
    assert error, "a disabled Recorder produced neither an answer nor a reason"

    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/history/series",
        "project_id": "history-live",
        "entity_ids": ["sensor.a"],
        "start_time": "2027-06-01T00:00:00+02:00",
        "end_time": "2027-06-08T00:00:00+02:00",
        "expected_instants": [
            f"2027-06-0{day}T00:00:00+02:00" for day in range(1, 8)
        ],
    })
    assert response["success"] is True
    assert response["result"]["source"] == "unavailable", (
        "a route with no Recorder returned an empty series without saying why"
    )
    assert response["result"]["coverage"] == 0
    # Seven days were asked for and none came back, so the gap is the window.
    assert response["result"]["gaps"], "seven missing days produced no gap"

    # The statistics route, which shipped as a shell: it built no request, asked
    # the Recorder nothing and returned a hard-coded empty series. Its answer
    # was honest -- `source: "unavailable"` -- which is exactly why a string
    # assertion could not tell it apart from a working route that found nothing.
    #
    # The gap is what separates them. A route that never asked cannot say which
    # days are missing, so seven expected days with nothing behind them must
    # come back as a gap rather than as a quiet zero.
    statistics = await connection.command({
        "type": "glt_flow_card/history/statistics",
        "project_id": "history-live",
        "entity_ids": ["sensor.a"],
        "period": "day",
        "start_time": "2027-06-01T00:00:00+02:00",
        "end_time": "2027-06-08T00:00:00+02:00",
        "expected_instants": [
            f"2027-06-0{day}T00:00:00+02:00" for day in range(1, 8)
        ],
    })
    assert statistics["success"] is True
    assert statistics["result"]["source"] == "unavailable", (
        "the statistics route returned an empty series without saying why"
    )
    assert statistics["result"]["coverage"] == 0
    assert statistics["result"]["gaps"], (
        "seven missing days produced no gap: the route did not ask the Recorder"
    )


async def test_coverage_answers_from_the_period_grid_rather_than_from_the_rows(
    hass, config_entry, phase2_users,
):
    """`history/coverage` measures the answer against the window that was asked for.

    Both this route and `history/export` shipped in 07-08 as shells returning a
    hard-coded empty result, and Phase 7 closed with them still shells because
    the grid they need is a decision rather than a derivation. 07-21 made that
    decision; this is the assertion that it reached the route.

    The discriminating value is `expected`. A shell cannot produce it, and
    neither can an implementation that infers the grid from what came back --
    the Recorder omits an empty period entirely, so a month with nine missing
    days returns 22 rows and an inferred grid calls that a complete month.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    manager = _manager(hass)
    manager.data["projects"]["coverage-live"] = {
        "id": "coverage-live",
        "config": {"timezone": "Europe/Berlin", "trend": {}},
    }
    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id="coverage-live",
        user_id=phase2_users.principal("viewer").user_id,
        role="viewer",
    )

    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/history/coverage",
        "project_id": "coverage-live",
        "entity_ids": ["sensor.a"],
        "period": "day",
    })
    assert response["success"] is True
    result = response["result"]
    assert result["step"] == "hour", "a day is measured in hourly buckets"
    assert result["expected"] in (23, 24, 25), (
        f"a day resolved to {result['expected']} hourly buckets; only 23, 24 and 25 are possible"
    )
    assert result["period"]["timezone"] == "Europe/Berlin", (
        "the period was resolved in the wrong timezone -- the project declares Europe/Berlin"
    )
    # No Recorder here, so nothing came back and the whole window is the gap.
    assert result["source"] == "unavailable"
    assert result["coverage"] == 0
    assert result["gaps"], "a window with nothing behind it reported no gap"


async def test_coverage_refuses_an_unknown_period_rather_than_defaulting(
    hass, config_entry, phase2_users,
):
    """A coverage figure for "sometimes" would silently be a figure for today."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    _manager(hass).data["projects"]["coverage-live"] = {
        "id": "coverage-live", "config": {"timezone": "Europe/Berlin", "trend": {}},
    }
    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id="coverage-live",
        user_id=phase2_users.principal("viewer").user_id,
        role="viewer",
    )
    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/history/coverage",
        "project_id": "coverage-live",
        "entity_ids": ["sensor.a"],
        "period": "sometimes",
    })
    assert response["success"] is False
    assert response["error"]["code"] == "unknown_period"


async def test_export_is_a_separate_capability_from_reading(
    hass, config_entry, phase2_users,
):
    """Whoever may read the plant's history is not automatically whoever may export it.

    A viewer holds `history.read` and not `history.export`, so the export is
    refused outright rather than filtered. Unlike a listing there is no honest
    partial answer to an export: half a month of data carried out of the
    building under a name that says "March" is worse than a refusal.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    _manager(hass).data["projects"]["export-live"] = {
        "id": "export-live", "config": {"timezone": "Europe/Berlin", "trend": {}},
    }
    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id="export-live",
        user_id=phase2_users.principal("viewer").user_id,
        role="viewer",
    )
    viewer = await phase2_users.async_connect("viewer")
    refused = await viewer.command({
        "type": "glt_flow_card/history/export",
        "project_id": "export-live",
        "entity_ids": ["sensor.a"],
        "period": "day",
    })
    assert refused["success"] is False, "a viewer exported history without history.export"
    # `not_found_or_denied`, not `not_permitted`, and the difference is the
    # point: the route enumerates `opaque`, so the refusal deliberately does not
    # distinguish "there is no such project" from "you may not export it". A
    # caller who learns which of the two applies has learned that the project
    # exists. The generic guard denies before the handler runs, which is why the
    # handler's own capability check is a backstop rather than the live path.
    assert refused["error"]["code"] == "not_found_or_denied"


async def test_an_export_states_what_would_be_needed_to_reproduce_it(
    hass, config_entry, phase2_users,
):
    """An export that cannot be interpreted later is a file, not evidence.

    The shipped export wrote the value being rendered at that moment, with no
    period, no aggregate, no bounds and no timezone. A month later nobody could
    say what it was a export *of*.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    _manager(hass).data["projects"]["export-live"] = {
        "id": "export-live",
        "config": {"timezone": "Europe/Berlin", "trend": {}, "historian": {"deadband": 0.5}},
    }
    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id="export-live",
        user_id=phase2_users.principal("admin").user_id,
        role="admin",
    )
    admin = await phase2_users.async_connect("admin")
    response = await admin.command({
        "type": "glt_flow_card/history/export",
        "project_id": "export-live",
        "entity_ids": ["sensor.a"],
        "period": "day",
    })
    assert response["success"] is True
    provenance = response["result"]["provenance"]
    for field in ("aggregate", "bounds", "deadband", "end", "period", "start", "step", "timezone"):
        assert field in provenance, f"an export omitted {field}, so it cannot be reproduced"
    assert provenance["timezone"] == "Europe/Berlin"
    assert provenance["deadband"] == 0.5, (
        "the export did not state the deadband that thinned it"
    )
    # The grid travels with the rows so a cell is filled only from a sample
    # inside its own interval, never from a borrowed neighbour.
    assert response["result"]["expected_instants"], "an export carried no grid"
