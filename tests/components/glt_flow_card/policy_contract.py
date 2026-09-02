"""The Phase-2 authorization contract, expressed as test-owned data.

This module is the specification the Companion must satisfy. It is deliberately
kept in the test tree: the tests assert that the shipped
`custom_components.glt_flow_card.policy` manifest matches this contract exactly,
so an implementation cannot quietly widen a capability, add an undeclared route,
or drop a route from the manifest.

Terminology
-----------
capability      A fixed server-owned permission name. Roles are mapped to
                capabilities in code; project content never contributes one.
scope           ``component`` routes are not project-scoped. ``project`` routes
                resolve exactly one project from a declared request field.
enumeration     ``filter`` collections omit unauthorized rows entirely.
                ``opaque`` direct reads answer missing and unauthorized alike.
state           ``active``   the route is implemented and enforced.
                ``deferred`` the route is declared but fails closed
                             ``feature_unavailable`` until a later phase.
                ``retired``  the route is declared but permanently fails closed;
                             its behavior moved to a Phase-2 replacement.
"""
from __future__ import annotations

from dataclasses import dataclass

#: Fixed project roles, weakest first. Roles are totally ordered for display
#: only; authorization always uses the explicit capability sets below.
ROLES = ("viewer", "operator", "engineer", "admin")

#: Every capability the Companion knows. Nothing outside this set may appear in
#: a role mapping or a route declaration.
CAPABILITIES = (
    "project.list",
    "project.read",
    "project.write",
    "project.delete",
    "project.access.read",
    "project.access.write",
    "template.read",
    "template.write",
    "control.read",
    "control.execute",
    "alarm.read",
    "alarm.write",
    "work_order.read",
    "work_order.write",
    "report.read",
    "report.run",
    "evidence.read",
    "evidence.telemetry.write",
    "lease.engineering",
    "lease.administration",
    "remote.read",
    "remote.control",
)

_VIEWER = frozenset({
    "project.list",
    "project.read",
    "template.read",
    "control.read",
    "alarm.read",
    "work_order.read",
    "report.read",
    "evidence.read",
    "remote.read",
})
_OPERATOR = _VIEWER | {
    "control.execute",
    "alarm.write",
    "work_order.write",
    "report.run",
    "evidence.telemetry.write",
}
_ENGINEER = _OPERATOR | {
    "project.write",
    "template.write",
    "lease.engineering",
}
_ADMIN = _ENGINEER | {
    "project.delete",
    "project.access.read",
    "project.access.write",
    "remote.control",
}

#: Fixed role -> capability matrix. This is the whole of project authority.
ROLE_CAPABILITIES: dict[str, frozenset[str]] = {
    "viewer": _VIEWER,
    "operator": frozenset(_OPERATOR),
    "engineer": frozenset(_ENGINEER),
    "admin": frozenset(_ADMIN),
}

#: An authenticated Home Assistant administrator with no project assignment.
#: Resolved A2: this exists only so membership can be bootstrapped and
#: recovered. It grants no project content, control, evidence or telemetry
#: authority, and it can never read a project body.
HA_ADMIN_CAPABILITIES = frozenset({
    "project.access.read",
    "project.access.write",
    "lease.administration",
})

#: A user with no assignment and no Home Assistant administrator rights.
UNASSIGNED_CAPABILITIES: frozenset[str] = frozenset()

#: Stable, non-enumerating error codes. Handlers may return only these.
ERROR_CODES = (
    "not_found_or_denied",
    "capability_denied",
    "authority_stale",
    "lease_required",
    "lease_expired",
    "revision_conflict",
    "invalid_input",
    "effect_unknown",
    "rate_limited",
    "feature_unavailable",
    "not_loaded",
)


@dataclass(frozen=True)
class RoutePolicy:
    """One declared WebSocket route and everything policy needs to decide it."""

    route: str
    scope: str
    capability: str | None
    project_field: str | None
    enumeration: str
    requires_lease: bool
    requires_revision: bool
    state: str

    def __post_init__(self) -> None:
        assert self.scope in {"component", "project"}, self.route
        assert self.enumeration in {"none", "filter", "opaque"}, self.route
        assert self.state in {"active", "deferred", "retired"}, self.route
        if self.capability is not None:
            assert self.capability in CAPABILITIES, self.route
        if self.scope == "project":
            assert self.project_field is not None, self.route


def _route(
    route: str,
    capability: str | None,
    *,
    scope: str = "project",
    project_field: str | None = "project_id",
    enumeration: str = "opaque",
    lease: bool = False,
    revision: bool = False,
    state: str = "active",
) -> RoutePolicy:
    return RoutePolicy(
        route=route,
        scope=scope,
        capability=capability,
        project_field=project_field if scope == "project" else None,
        enumeration=enumeration,
        requires_lease=lease,
        requires_revision=revision,
        state=state,
    )


#: The complete declared route surface. Registered routes must equal this set
#: exactly: an undeclared registration and a declared-but-unregistered route are
#: both failures.
COMMAND_POLICY_CONTRACT: tuple[RoutePolicy, ...] = (
    # -- projects ---------------------------------------------------------
    _route("glt_flow_card/projects/list", "project.list", scope="component",
           enumeration="filter"),
    _route("glt_flow_card/projects/get", "project.read"),
    _route("glt_flow_card/projects/save", "project.write", project_field="project.id",
           lease=True, revision=True),
    _route("glt_flow_card/projects/preview", "project.write", lease=True, revision=True),
    _route("glt_flow_card/projects/apply", "project.write", lease=True, revision=True),
    _route("glt_flow_card/projects/rollback", "project.write", lease=True, revision=True),
    _route("glt_flow_card/projects/delete", "project.delete", lease=True, revision=True),
    # Legacy user-only locks are replaced by connection-bound leases.
    _route("glt_flow_card/projects/lock", None, state="retired"),
    _route("glt_flow_card/projects/unlock", None, state="retired"),
    # -- templates --------------------------------------------------------
    _route("glt_flow_card/templates/list", "template.read", scope="component",
           enumeration="filter"),
    _route("glt_flow_card/templates/save", "template.write", scope="component"),
    _route("glt_flow_card/templates/delete", "template.write", scope="component"),
    # -- controls ---------------------------------------------------------
    # The legacy caller-selected service route is replaced entirely.
    _route("glt_flow_card/control/execute", None, state="retired"),
    # -- alarms, work orders, reports -------------------------------------
    _route("glt_flow_card/alarms/list", "alarm.read", enumeration="filter"),
    _route("glt_flow_card/alarms/ack", "alarm.write"),
    _route("glt_flow_card/alarms/shelve", "alarm.write"),
    _route("glt_flow_card/work_orders/list", "work_order.read", enumeration="filter"),
    _route("glt_flow_card/work_orders/save", "work_order.write"),
    _route("glt_flow_card/reports/run", "report.run"),
    _route("glt_flow_card/reports/list", "report.read", enumeration="filter"),
    # -- remote sites (Phase 9 owns the transport) ------------------------
    _route("glt_flow_card/remote/list", "remote.read", scope="component",
           enumeration="filter", state="deferred"),
    _route("glt_flow_card/remote/states", "remote.read", scope="component",
           state="deferred"),
    _route("glt_flow_card/remote/control", "remote.control", state="deferred"),
    # -- audit ------------------------------------------------------------
    # Client-authored trusted audit is retired; telemetry replaces it.
    _route("glt_flow_card/audit/add", None, scope="component", state="retired"),
    _route("glt_flow_card/audit/list", "evidence.read", scope="component",
           enumeration="filter"),
)

#: Routes registered before Phase 2. Every one of them must still be declared,
#: so no legacy handler can escape the policy boundary.
LEGACY_ROUTES = tuple(policy.route for policy in COMMAND_POLICY_CONTRACT)

#: Principals used by the route x principal matrix, in a stable order.
MATRIX_PRINCIPALS = (
    "viewer",
    "operator",
    "engineer",
    "admin",
    "ha_admin",
    "unassigned",
)


def capabilities_for(principal_key: str) -> frozenset[str]:
    """Return the exact capability set a principal may hold on a project."""
    if principal_key == "ha_admin":
        return HA_ADMIN_CAPABILITIES
    if principal_key == "unassigned":
        return UNASSIGNED_CAPABILITIES
    if principal_key == "engineer_two":
        return ROLE_CAPABILITIES["engineer"]
    return ROLE_CAPABILITIES[principal_key]


def expect_allowed(principal_key: str, policy: RoutePolicy) -> bool:
    """Return whether a principal may reach a route's behavior at all.

    Deferred and retired routes are never allowed for anyone, which is what
    makes them safe to keep declared.

    A ``filter`` collection is reachable by every authenticated principal and
    protected by omitting rows. Refusing the call outright would leak the fact
    that rows exist, which is exactly the enumeration T2-04 forbids; the probe
    checks the row filtering separately.
    """
    if policy.state != "active":
        return False
    if policy.enumeration == "filter":
        return True
    if policy.capability is None:
        return False
    return policy.capability in capabilities_for(principal_key)


def matrix() -> tuple[tuple[str, RoutePolicy, bool], ...]:
    """Return the full principal x route expectation matrix."""
    return tuple(
        (principal, policy, expect_allowed(principal, policy))
        for principal in MATRIX_PRINCIPALS
        for policy in COMMAND_POLICY_CONTRACT
    )
