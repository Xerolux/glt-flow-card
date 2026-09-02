"""One deny-by-default authorization boundary for every Companion route.

Nothing in this module reads project content. Authority comes from exactly two
places: the fixed role a server-owned ACL assigns to a Home Assistant user, and
that user's own Home Assistant authority. The effective capability set is the
intersection, so a project can never grant more than Home Assistant already
allows, and a Home Assistant administrator never inherits project content.

Every registered `glt_flow_card/*` route is declared once in
:data:`COMMAND_POLICIES`. A route that is registered but not declared, or
declared but not registered, is a policy hole; the tests compare the two sets
exactly. A route whose behavior a later phase owns stays declared with a
non-``active`` state, which keeps it reachable by the boundary and unavailable
to everyone.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

DOMAIN_PREFIX = "glt_flow_card/"

#: Fixed project roles, weakest first. The order is for display only;
#: authorization always uses the explicit capability sets below.
ROLES: tuple[str, ...] = ("viewer", "operator", "engineer", "admin")

#: Every capability the Companion knows. A capability outside this set cannot be
#: declared on a route or granted to a role.
CAPABILITIES: tuple[str, ...] = (
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
_ENGINEER = _OPERATOR | {"project.write", "template.write", "lease.engineering"}
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

#: Resolved A2. An authenticated Home Assistant administrator with no project
#: assignment can inventory and repair membership so a project cannot be
#: stranded without an admin. That is all: no content, control, evidence or
#: telemetry capability is included, and the engineering lease is not either.
HA_ADMIN_CAPABILITIES: frozenset[str] = frozenset({
    "project.access.read",
    "project.access.write",
    "lease.administration",
})

#: A user with neither an assignment nor Home Assistant administrator rights.
UNASSIGNED_CAPABILITIES: frozenset[str] = frozenset()

#: Stable public error codes. A handler may return only these, with bounded
#: non-sensitive parameters; a raw exception string is never a public code.
ERROR_CODES: tuple[str, ...] = (
    "not_found_or_denied",
    "capability_denied",
    "authority_stale",
    "lease_required",
    "lease_expired",
    "lease_held",
    "revision_conflict",
    "invalid_input",
    "effect_unknown",
    "rate_limited",
    "feature_unavailable",
    "not_loaded",
)

#: The policy manifest's own version. A browser that advertises a different
#: version is incompatible and must fall back to read-only rather than guess.
POLICY_VERSION = 1


class PolicyDenied(Exception):
    """A request was refused. Carries one stable public code."""

    def __init__(self, code: str, detail: dict[str, Any] | None = None) -> None:
        if code not in ERROR_CODES:
            raise ValueError(f"{code!r} is not a stable public error code")
        super().__init__(code)
        self.code = code
        self.detail = dict(detail or {})


@dataclass(frozen=True)
class RoutePolicy:
    """Everything the boundary needs to decide one route, declared once."""

    route: str
    scope: str
    capability: str | None
    project_field: str | None
    enumeration: str
    requires_lease: bool
    requires_revision: bool
    state: str
    rate_class: str = "default"
    #: When set, holding *any* of these capabilities admits the request. The
    #: route then does the precise per-purpose check itself. A lease route needs
    #: this because engineering and membership recovery are different
    #: capabilities reaching the same endpoint.
    any_of: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.scope not in {"component", "project"}:
            raise ValueError(f"{self.route}: unknown scope {self.scope!r}")
        if self.enumeration not in {"none", "filter", "opaque"}:
            raise ValueError(f"{self.route}: unknown enumeration {self.enumeration!r}")
        if self.state not in {"active", "deferred", "retired"}:
            raise ValueError(f"{self.route}: unknown state {self.state!r}")
        if self.capability is not None and self.capability not in CAPABILITIES:
            raise ValueError(f"{self.route}: unknown capability {self.capability!r}")
        if self.scope == "project" and self.project_field is None:
            raise ValueError(f"{self.route}: a project-scoped route needs a project field")
        if self.requires_lease and not self.requires_revision:
            raise ValueError(f"{self.route}: a lease-guarded route must also be revisioned")
        for capability in self.any_of:
            if capability not in CAPABILITIES:
                raise ValueError(f"{self.route}: unknown capability {capability!r}")


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
    rate_class: str = "default",
    any_of: tuple[str, ...] = (),
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
        rate_class=rate_class,
        any_of=any_of,
    )


_DECLARED: tuple[RoutePolicy, ...] = (
    # -- projects ---------------------------------------------------------
    _route("glt_flow_card/projects/list", "project.list", scope="component",
           enumeration="filter"),
    _route("glt_flow_card/projects/get", "project.read"),
    _route("glt_flow_card/projects/save", "project.write", project_field="project.id",
           lease=True, revision=True, rate_class="mutation"),
    _route("glt_flow_card/projects/preview", "project.write", lease=True, revision=True,
           rate_class="mutation"),
    _route("glt_flow_card/projects/apply", "project.write", lease=True, revision=True,
           rate_class="mutation"),
    _route("glt_flow_card/projects/rollback", "project.write", lease=True, revision=True,
           rate_class="mutation"),
    _route("glt_flow_card/projects/delete", "project.delete", lease=True, revision=True,
           rate_class="mutation"),
    # Legacy user-only locks are replaced by connection-bound leases (02-08).
    _route("glt_flow_card/projects/lock", None, state="retired"),
    _route("glt_flow_card/projects/unlock", None, state="retired"),
    # -- leases (02-08) ---------------------------------------------------
    _route("glt_flow_card/leases/acquire", "lease.engineering", rate_class="lease",
           any_of=("lease.engineering", "lease.administration")),
    _route("glt_flow_card/leases/renew", "lease.engineering", rate_class="lease",
           any_of=("lease.engineering", "lease.administration")),
    _route("glt_flow_card/leases/release", "lease.engineering", rate_class="lease",
           any_of=("lease.engineering", "lease.administration")),
    _route("glt_flow_card/leases/status", "project.read"),
    # -- templates --------------------------------------------------------
    _route("glt_flow_card/templates/list", "template.read", scope="component",
           enumeration="filter"),
    _route("glt_flow_card/templates/save", "template.write", scope="component"),
    _route("glt_flow_card/templates/delete", "template.write", scope="component"),
    # -- controls ---------------------------------------------------------
    # The caller-selected service route is replaced entirely by 02-11.
    _route("glt_flow_card/control/execute", None, state="retired"),
    # -- alarms, work orders, reports -------------------------------------
    _route("glt_flow_card/alarms/list", "alarm.read", enumeration="filter"),
    _route("glt_flow_card/alarms/ack", "alarm.write"),
    _route("glt_flow_card/alarms/shelve", "alarm.write"),
    _route("glt_flow_card/work_orders/list", "work_order.read", enumeration="filter"),
    _route("glt_flow_card/work_orders/save", "work_order.write"),
    _route("glt_flow_card/reports/run", "report.run"),
    _route("glt_flow_card/reports/list", "report.read", enumeration="filter"),
    # -- remote sites: declared, unavailable until Phase 9 (resolved A6) ---
    _route("glt_flow_card/remote/list", "remote.read", scope="component",
           enumeration="filter", state="deferred"),
    _route("glt_flow_card/remote/states", "remote.read", scope="component",
           state="deferred"),
    _route("glt_flow_card/remote/control", "remote.control", state="deferred"),
    # -- audit ------------------------------------------------------------
    # Client-authored trusted audit is retired; 02-10 owns bounded telemetry.
    _route("glt_flow_card/audit/add", None, scope="component", state="retired"),
    _route("glt_flow_card/audit/list", "evidence.read", scope="component",
           enumeration="filter"),
)

#: Route name -> policy. Immutable and complete.
COMMAND_POLICIES: dict[str, RoutePolicy] = {policy.route: policy for policy in _DECLARED}

if len(COMMAND_POLICIES) != len(_DECLARED):  # pragma: no cover - import-time guard
    raise RuntimeError("duplicate route declaration in COMMAND_POLICIES")


@dataclass(frozen=True)
class Actor:
    """The authenticated principal, derived only from the live connection."""

    user_id: str
    user_name: str | None
    is_ha_admin: bool
    session_id: str | None
    connection_id: int | None


@dataclass(frozen=True)
class Decision:
    """An allow decision plus the evidence a handler may rely on."""

    actor: Actor
    policy: RoutePolicy
    project_id: str | None
    role: str | None
    capabilities: frozenset[str]
    access_revision: int
    policy_version: int = POLICY_VERSION


def actor_from_connection(connection: Any) -> Actor:
    """Derive the actor from the active Home Assistant WebSocket connection.

    Nothing in the request payload contributes. A message that carries a
    `user_id`, `actor`, `role` or `at` field is simply ignored here; the strict
    route schemas reject those fields before they reach a handler.
    """
    user = getattr(connection, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        raise PolicyDenied("not_loaded")
    return Actor(
        user_id=str(user_id),
        user_name=getattr(user, "name", None),
        is_ha_admin=bool(getattr(user, "is_admin", False)),
        session_id=getattr(connection, "refresh_token_id", None),
        connection_id=id(connection),
    )


def capabilities_for(role: str | None, *, is_ha_admin: bool) -> frozenset[str]:
    """Return the effective capability set for one principal on one project.

    A project role and the Home Assistant administrator ceiling are additive,
    but the ceiling contributes only the minimal membership-recovery
    capabilities: an administrator without an assignment still reads no project.
    """
    granted = ROLE_CAPABILITIES.get(role, UNASSIGNED_CAPABILITIES) if role else UNASSIGNED_CAPABILITIES
    if is_ha_admin:
        granted = granted | HA_ADMIN_CAPABILITIES
    return frozenset(granted)


class PolicyCoordinator:
    """Decide every route with the same inputs, in the same order, every time."""

    def __init__(self, access_repository: Any, *, hass: Any = None) -> None:
        self._access = access_repository
        self._hass = hass

    def policy_for(self, route: str) -> RoutePolicy:
        """Return the declared policy, or fail closed for an unknown route."""
        policy = COMMAND_POLICIES.get(route)
        if policy is None:
            raise PolicyDenied("feature_unavailable", {"route": route})
        return policy

    def project_id_for(self, policy: RoutePolicy, msg: dict[str, Any]) -> str | None:
        """Resolve the project from the declared request field only.

        A dotted field names a path inside the request body, for the legacy save
        route whose project id lives in the document rather than beside it. No
        other part of the message may ever name the project.
        """
        if policy.scope != "project" or policy.project_field is None:
            return None
        value: Any = msg
        for part in policy.project_field.split("."):
            value = value.get(part) if isinstance(value, dict) else None
        if not isinstance(value, str) or not value:
            raise PolicyDenied("invalid_input", {"field": policy.project_field})
        return value

    async def async_authorize(
        self, connection: Any, msg: dict[str, Any], *, route: str | None = None
    ) -> Decision:
        """Authorize one request and return the evidence the handler may use."""
        return self.authorize(connection, msg, route=route)

    def authorize(
        self, connection: Any, msg: dict[str, Any], *, route: str | None = None
    ) -> Decision:
        """Authorize one request synchronously.

        The Home Assistant WebSocket boundary dispatches through a synchronous
        callback. Deciding there - rather than inside a scheduled coroutine -
        is what guarantees an unauthorized request never reaches a handler at
        all, so it can have no effect to undo.
        """
        resolved_route = route or str(msg.get("type", ""))
        policy = self.policy_for(resolved_route)
        if policy.state == "retired":
            raise PolicyDenied("feature_unavailable", {"route": policy.route})
        if policy.state == "deferred":
            raise PolicyDenied("feature_unavailable", {"route": policy.route})

        actor = actor_from_connection(connection)
        project_id = self.project_id_for(policy, msg)

        role, access_revision = self._role_for(actor, project_id)
        capabilities = (
            capabilities_for(role, is_ha_admin=actor.is_ha_admin)
            if policy.scope == "project"
            else self._component_capabilities(actor)
        )

        # A collection is protected by filtering its rows, not by refusing the
        # call: refusing would itself tell an unauthorized caller that rows
        # exist. Every filtered route returns an empty result instead.
        admitted = (
            bool(capabilities & set(policy.any_of))
            if policy.any_of
            else policy.capability is None or policy.capability in capabilities
        )
        if policy.enumeration != "filter" and not admitted:
            raise PolicyDenied("not_found_or_denied")

        return Decision(
            actor=actor,
            policy=policy,
            project_id=project_id,
            role=role,
            capabilities=capabilities,
            access_revision=access_revision,
        )

    def _role_for(self, actor: Actor, project_id: str | None) -> tuple[str | None, int]:
        """Return the server-owned role and access revision for one project."""
        if project_id is None or self._access is None:
            return None, 0
        state = self._access.get(project_id)
        return state.role_of(actor.user_id), state.access_revision

    def _component_capabilities(self, actor: Actor) -> frozenset[str]:
        """Return what a principal may do on component-wide, unscoped surfaces.

        Templates and the component-wide evidence list belong to no single
        project, so authority for them is the union of what this principal
        already holds somewhere. A user with no assignment anywhere still holds
        nothing, which keeps the default deny intact.
        """
        granted: set[str] = set()
        if self._access is not None:
            for project_id in self._access.project_ids():
                role = self._access.get(project_id).role_of(actor.user_id)
                if role:
                    granted |= ROLE_CAPABILITIES[role]
        if actor.is_ha_admin:
            granted |= HA_ADMIN_CAPABILITIES
        return frozenset(granted)

    def visible_projects(self, connection: Any, project_ids: list[str]) -> list[str]:
        """Filter a collection at the source, before anything is serialized."""
        actor = actor_from_connection(connection)
        visible: list[str] = []
        for project_id in project_ids:
            role, _ = self._role_for(actor, project_id)
            capabilities = capabilities_for(role, is_ha_admin=actor.is_ha_admin)
            if "project.read" in capabilities:
                visible.append(project_id)
        return visible

    def may_read_project(self, connection: Any, project_id: str) -> bool:
        """Return whether one principal may read one project's content."""
        actor = actor_from_connection(connection)
        role, _ = self._role_for(actor, project_id)
        return "project.read" in capabilities_for(role, is_ha_admin=actor.is_ha_admin)


def authorize(hass: Any, connection: Any, msg: dict[str, Any]) -> Decision:
    """Authorize one request against the loaded runtime's policy coordinator."""
    coordinator = policy_coordinator(hass)
    if coordinator is None:
        raise PolicyDenied("not_loaded")
    return coordinator.authorize(connection, msg)


def policy_coordinator(hass: Any) -> PolicyCoordinator | None:
    """Return the loaded runtime's policy coordinator, or None when unloaded."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "policy", None) if runtime is not None else None
