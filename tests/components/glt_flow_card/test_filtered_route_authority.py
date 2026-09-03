"""Every project-scoped filtered route omits the rows of a project the caller cannot read.

A route declared ``enumeration="filter"`` is deliberately *admitted* by the
policy guard even when the caller holds nothing: refusing outright would itself
tell them that rows exist, which is the enumeration T2-04 forbids. The
consequence is that filtering is the handler's job, and a handler that forgets
leaks in a way no permission test notices — the call succeeds, which is exactly
what the policy matrix expects of a filtered route.

**Since the close-out review this is enforced by the boundary rather than by the
handlers.** `_guard_command` answers a project-scoped filtered route itself when
the caller lacks its capability, sending the empty result the route declares in
`RoutePolicy.empty_result`. The handler is never invoked, so it cannot forget a
filter it is never asked to perform, and `RoutePolicy.__post_init__` refuses to
declare such a route at all without an empty answer. The handlers keep their own
checks as defence in depth; `test_the_boundary_filters_without_the_handlers`
below proves the boundary alone is sufficient.

That is not a hypothetical. It shipped four times:

* ``alarms/list`` — fixed in ``9f53bcb`` after a probe found any authenticated
  user could read a hidden project's complete alarm state and history.
* ``work_orders/list``, ``reports/list`` and ``evidence/list`` — found by the
  Phase-2 review pass, in the same shape, because the ``alarms/list`` fix was
  applied to the instance rather than to the class. ``evidence/list`` returned
  the trusted audit trail: who operated which entity, and with what result.

`test_policy_enumeration.py` cannot catch this. It asserts response *codes*, and
for a filtered route a success is the correct code no matter what rows come back
with it. This module asserts the rows.

The point of deriving the route list from ``COMMAND_POLICY_CONTRACT`` rather
than listing routes by hand is that a filtered route added later is covered the
day it is declared: it must appear in ``SEEDED`` or in ``NOT_EXERCISED`` with a
reason, or ``test_every_filtered_route_is_accounted_for`` fails.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .policy_contract import COMMAND_POLICY_CONTRACT

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

HIDDEN = "filtered-authority-hidden"

#: Routes this module seeds with rows for a project the probe never grants
#: anyone. Each entry is the request body beside `project_id`.
SEEDED: dict[str, dict[str, Any]] = {
    "glt_flow_card/alarms/list": {"limit": 50},
    "glt_flow_card/work_orders/list": {},
    "glt_flow_card/reports/list": {},
    "glt_flow_card/schedules/list": {},
    "glt_flow_card/evidence/list": {},
}

#: Filtered project-scoped routes this module does not exercise, and why. A
#: reason is required: "not covered here" with no reason is how a route stops
#: being covered anywhere.
NOT_EXERCISED: dict[str, str] = {
    "glt_flow_card/telemetry/list": (
        "returns only the calling user's own untrusted rows, keyed by user id "
        "rather than by project, so a cross-project seed cannot reach it and an "
        "empty answer here would prove nothing. Its own bound is "
        "test_evidence_pagination.py."
    ),
    "glt_flow_card/history/series": (
        "reads the Recorder, which this lane does not run. Its authorization is "
        "asserted against a fake recorder in test_history_routes.py."
    ),
    "glt_flow_card/history/statistics": (
        "reads the Recorder, as history/series does; same owner."
    ),
}


def filtered_project_routes() -> list[str]:
    """Every active, project-scoped, filtered route in the declared contract."""
    return sorted(
        policy.route
        for policy in COMMAND_POLICY_CONTRACT
        if policy.enumeration == "filter"
        and policy.scope == "project"
        and policy.state == "active"
    )


def test_every_filtered_route_is_accounted_for() -> None:
    """A filtered route added later must be seeded here or excused with a reason.

    This is the guard that makes the module a class-level defence rather than
    four more instance fixes.
    """
    declared = set(filtered_project_routes())
    covered = set(SEEDED) | set(NOT_EXERCISED)
    missing = declared - covered
    assert not missing, (
        "these project-scoped filtered routes are neither seeded nor excused, so "
        f"nothing proves they filter their rows: {sorted(missing)}"
    )
    stale = covered - declared
    assert not stale, f"these entries name routes that are no longer declared: {sorted(stale)}"


def rows_in(result: Any) -> list[Any]:
    """Collect every row from a result, whatever shape the route returns.

    Routes answer with a bare list, with `{"rows": [...]}`, and with
    `{"states": [...], "history": [...]}`. Walking the structure means this
    assertion does not have to be rewritten per route — and a route that
    invents a fifth shape is still covered.
    """
    if isinstance(result, list):
        return list(result)
    if isinstance(result, dict):
        found: list[Any] = []
        for value in result.values():
            if isinstance(value, (list, dict)):
                found.extend(rows_in(value))
        return found
    return []


async def _seed(hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users) -> None:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    manager = _manager(hass)
    runtime = _runtime_for(hass)
    admin = phase2_users.principal("admin")

    await manager.save_project(
        {
            "id": HIDDEN,
            "config": {
                "type": "custom:glt-flow-card",
                "schema_version": 2,
                "project": {"id": HIDDEN, "name": HIDDEN, "revision": 0},
                "views": [], "equipment": [], "paths": [], "datapoints": [],
                "schedules": [{"id": "s1", "name": "Night setback on a plant you cannot see"}],
            },
        },
        autosave=False,
        user_id=admin.user_id,
        expected_revision=0,
    )
    manager.data["alarm_state"][f"{HIDDEN}:alm"] = {
        "project_id": HIDDEN, "alarm_id": "alm", "active": True,
        "label": "Burner fault on a plant you cannot see",
    }
    manager.data["alarm_history"].insert(0, {
        "project_id": HIDDEN, "alarm_id": "alm", "transition": "active",
        "label": "Burner fault on a plant you cannot see",
    })
    manager.data["work_orders"]["wo1"] = {
        "id": "wo1", "project_id": HIDDEN, "title": "Replace a burner you cannot see",
    }
    manager.data["report_history"].insert(0, {
        "id": "r1", "project_id": HIDDEN, "title": "Monthly energy for a plant you cannot see",
    })
    manager.data["schedule_history"].insert(0, {
        "project_id": HIDDEN, "schedule_id": "s1", "result": "ran",
    })
    await runtime.evidence.async_record(
        action="control.dispatch",
        project_id=HIDDEN,
        actor_user_id=admin.user_id,
        result="readback_confirmed",
        target={"entity_id": "switch.a_burner_you_cannot_see"},
    )


def body_for(route: str) -> dict[str, Any]:
    return {"type": route, "project_id": HIDDEN, **SEEDED[route]}


@pytest.mark.parametrize("route", sorted(SEEDED))
async def test_the_seed_is_visible_to_someone(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users, route: str,
) -> None:
    """Vacuity guard: prove the seed reaches each route before proving it is hidden.

    Without this, a route that answers empty for *everyone* — a typo in a store
    key, a shape this module does not know how to seed — would pass the leak
    assertion below while measuring nothing at all.
    """
    await _seed(hass, config_entry, phase2_users)
    from custom_components.glt_flow_card import _runtime_for

    await _runtime_for(hass).access.async_assign(
        project_id=HIDDEN,
        user_id=phase2_users.principal("admin").user_id,
        role="admin",
    )
    connection = await phase2_users.async_connect("admin")
    response = await connection.command(body_for(route))
    assert response["success"] is True, response
    assert rows_in(response["result"]), (
        f"{route} returned nothing to a project admin, so the hidden-caller "
        "assertion for this route would have passed over an empty store"
    )


@pytest.mark.parametrize("route", sorted(SEEDED))
async def test_an_unassigned_caller_reads_no_row(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users, route: str,
) -> None:
    """The leak itself: a principal with no membership, naming the project directly."""
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("unassigned")
    response = await connection.command(body_for(route))
    assert response["success"] is True, (
        f"{route} is declared enumeration=filter and must not deny: a refusal "
        "tells an unauthorized caller that rows exist"
    )
    leaked = rows_in(response["result"])
    assert leaked == [], f"{route} returned {len(leaked)} row(s) of a project this caller cannot read"


async def test_the_boundary_filters_without_the_handlers(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """The property WR-01 asked for: omission is impossible, not merely tested for.

    Every assertion above would still pass if the guarantee lived in eight
    handlers that each happen to be correct today. This one takes the handler out
    of the path -- it is replaced by one that returns the store unfiltered, which
    *is* the original defect -- and requires the answer to stay empty anyway,
    because the boundary answered before the handler ran.
    """
    await _seed(hass, config_entry, phase2_users)
    from custom_components.glt_flow_card import _guard_command, _manager

    ran: list[str] = []

    def unfiltered(hass_, connection, msg):
        # The shape of the leak: read the message, return everything, filter
        # nothing. If this ever runs for an unauthorized caller, it leaks.
        ran.append(msg["type"])
        connection.send_result(
            msg["id"], list(_manager(hass_).data["work_orders"].values())
        )

    class _Connection:
        """The two methods the boundary uses, plus the principal it reads."""

        def __init__(self, user):
            self.user = user
            self.refresh_token_id = "probe-session"
            self.results: list = []
            self.errors: list = []

        def send_result(self, _id, result):
            self.results.append(result)

        def send_error(self, _id, code, _message):
            self.errors.append(code)

    unassigned = phase2_users.principal("unassigned")
    connection = _Connection(unassigned.user)
    guarded = _guard_command(unfiltered)
    guarded(
        hass,
        connection,
        {"id": 1, "type": "glt_flow_card/work_orders/list", "project_id": HIDDEN},
    )

    assert ran == [], (
        "the unfiltered handler ran. A project-scoped filtered route must be "
        "answered by the boundary for a caller who may not read the project, so "
        "that no handler can leak by forgetting to filter."
    )
    assert connection.errors == [], (
        "a filtered route must not deny: a refusal tells an unauthorized caller "
        f"that rows exist. Got {connection.errors}"
    )
    assert connection.results == [[]], (
        f"the boundary answered {connection.results}, not the route's declared "
        "empty result"
    )


def test_every_filtered_route_declares_its_empty_answer() -> None:
    """A filtered route cannot be declared without one, and that is the guard.

    `RoutePolicy.__post_init__` refuses the declaration, so this is checked at
    import; asserting it here says *why* the refusal exists.
    """
    from custom_components.glt_flow_card.policy import COMMAND_POLICIES

    for policy in COMMAND_POLICIES.values():
        if policy.enumeration == "filter" and policy.scope == "project" and policy.state == "active":
            assert policy.empty_result, policy.route
            answer = policy.empty_answer()
            assert isinstance(answer, (list, dict)), policy.route
            assert policy.empty_answer() is not policy.empty_answer(), (
                f"{policy.route}: empty_answer must return a fresh value, or one "
                "caller's response could be mutated into another's"
            )
