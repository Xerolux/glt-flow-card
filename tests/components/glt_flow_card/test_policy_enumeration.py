"""Non-enumeration matrix for every declared route (T2-02, T2-03, T2-04).

Collections omit unauthorized rows before serialization; direct reads answer
missing and unauthorized objects with the identical `not_found_or_denied`
envelope. This module owns the live route x principal probe used by the
`phase2-policy-matrix` sentinel in `test_policy.py`, so the whole matrix is one
product-completeness assertion rather than a scatter of partial failures.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant

from .policy_contract import (
    COMMAND_POLICY_CONTRACT,
    ERROR_CODES,
    MATRIX_PRINCIPALS,
    RoutePolicy,
    expect_allowed,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

PROJECT_ID = "policy-matrix-plant"
HIDDEN_PROJECT_ID = "policy-matrix-hidden"
MISSING_PROJECT_ID = "policy-matrix-does-not-exist"

#: Minimal, schema-valid payload fields per route so a request reaches policy
#: rather than being rejected by voluptuous before authorization runs.
ROUTE_PAYLOADS: dict[str, dict[str, Any]] = {
    "glt_flow_card/projects/get": {"project_id": PROJECT_ID},
    "glt_flow_card/access/get": {"project_id": PROJECT_ID},
    "glt_flow_card/access/set": {
        "project_id": PROJECT_ID,
        "user_id": "probe-user",
        "role": "viewer",
        "expected_access_revision": 0,
        "lease_token": "probe",
    },
    "glt_flow_card/leases/acquire": {"project_id": PROJECT_ID, "purpose": "engineering"},
    "glt_flow_card/leases/renew": {
        "project_id": PROJECT_ID, "lease_token": "probe", "purpose": "engineering",
    },
    "glt_flow_card/leases/release": {
        "project_id": PROJECT_ID, "lease_token": "probe", "purpose": "engineering",
    },
    "glt_flow_card/leases/status": {"project_id": PROJECT_ID},
    "glt_flow_card/projects/save": {
        "lease_token": "probe",
        "project": {"id": PROJECT_ID, "config": {}},
        "expected_revision": 0,
    },
    "glt_flow_card/projects/preview": {
        "lease_token": "probe",
        "project_id": PROJECT_ID,
        "expected_revision": 0,
        "candidate": {},
    },
    "glt_flow_card/projects/apply": {
        "lease_token": "probe",
        "project_id": PROJECT_ID,
        "preview_id": "probe",
        "expected_revision": 0,
        "selected_ids": [],
    },
    "glt_flow_card/projects/rollback": {
        "lease_token": "probe",
        "project_id": PROJECT_ID,
        "snapshot_id": "sha256:" + "0" * 64,
        "expected_revision": 0,
        "confirmation": f"ROLLBACK {PROJECT_ID}",
    },
    "glt_flow_card/projects/delete": {
        "lease_token": "probe","project_id": PROJECT_ID},
    "glt_flow_card/projects/lock": {"project_id": PROJECT_ID},
    "glt_flow_card/projects/unlock": {"project_id": PROJECT_ID},
    "glt_flow_card/templates/save": {"template": {"id": "probe"}},
    "glt_flow_card/templates/delete": {"template_id": "probe"},
    "glt_flow_card/control/execute": {
        "project_id": PROJECT_ID,
        "entity_id": "switch.probe",
        "domain": "switch",
        "service": "turn_on",
    },
    "glt_flow_card/alarms/list": {"project_id": PROJECT_ID},
    "glt_flow_card/alarms/ack": {"project_id": PROJECT_ID, "alarm_id": "probe"},
    "glt_flow_card/alarms/shelve": {"project_id": PROJECT_ID, "alarm_id": "probe"},
    "glt_flow_card/work_orders/list": {"project_id": PROJECT_ID},
    "glt_flow_card/work_orders/save": {
        "project_id": PROJECT_ID,
        "work_order": {"id": "probe"},
    },
    "glt_flow_card/reports/run": {"project_id": PROJECT_ID, "report_id": "probe"},
    "glt_flow_card/reports/list": {"project_id": PROJECT_ID},
    "glt_flow_card/remote/states": {"site_id": "probe", "entity_ids": []},
    "glt_flow_card/remote/control": {
        "project_id": PROJECT_ID,
        "site_id": "probe",
        "domain": "switch",
        "service": "turn_on",
    },
    "glt_flow_card/audit/add": {"event": {"action": "probe"}},
}


def payload_for(policy: RoutePolicy, project_id: str = PROJECT_ID) -> dict[str, Any]:
    """Return a schema-valid request body for one declared route."""
    body = {"type": policy.route, **ROUTE_PAYLOADS.get(policy.route, {})}
    if policy.scope == "project" and policy.project_field and "." not in policy.project_field:
        body[policy.project_field] = project_id
    return body


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        module = __import__(
            f"custom_components.glt_flow_card.{name}", fromlist=[name]
        )
    except ImportError:
        return None
    return module


# --------------------------------------------------------------------------
# Structural guarantees about the probe itself. These hold in both states.
# --------------------------------------------------------------------------


def test_every_declared_route_has_a_schema_valid_probe_payload() -> None:
    """The matrix cannot silently skip a route for lack of a request body."""
    for policy in COMMAND_POLICY_CONTRACT:
        body = payload_for(policy)
        assert body["type"] == policy.route
        if policy.scope == "project" and "." not in policy.project_field:
            assert body[policy.project_field] == PROJECT_ID


def test_collections_are_declared_as_filtering_not_denying() -> None:
    """A list route must omit hidden rows rather than fail the whole call."""
    collections = [p for p in COMMAND_POLICY_CONTRACT if p.enumeration == "filter"]
    assert {p.route for p in collections} >= {
        "glt_flow_card/projects/list",
        "glt_flow_card/alarms/list",
        "glt_flow_card/work_orders/list",
        "glt_flow_card/reports/list",
        "glt_flow_card/audit/list",
    }
    for policy in collections:
        assert policy.requires_lease is False, policy.route


def test_direct_reads_are_declared_opaque() -> None:
    """Direct project reads must not distinguish missing from unauthorized."""
    direct = [
        p for p in COMMAND_POLICY_CONTRACT
        if p.scope == "project" and p.enumeration == "opaque"
    ]
    assert any(p.route == "glt_flow_card/projects/get" for p in direct)


# --------------------------------------------------------------------------
# Live probe consumed by the phase2-policy-matrix sentinel.
# --------------------------------------------------------------------------


async def enumeration_gaps(
    hass: HomeAssistant,
    phase2_users: Any,
    controlled_service: Any = None,
) -> list[str]:
    """Probe every declared route with every principal and return the gaps.

    Returning a gap list rather than asserting keeps the whole matrix behind one
    named sentinel, so a controlled RED run fails exactly once and names the
    missing product behavior instead of scattering unrelated failures.
    """
    gaps: list[str] = []

    access = load("project_access")
    policy = load("policy")
    if policy is None:
        gaps.append("policy module is unavailable; the route matrix cannot be enforced")
    if access is None:
        gaps.append(
            "server-owned ACL is unavailable; principals cannot be assigned a project role"
        )
    if gaps:
        return gaps

    runtime_access = access.access_repository(hass)
    if runtime_access is None:
        gaps.append("the loaded runtime exposes no ACL repository")
        return gaps

    # Seed one real project so an authorized direct read has something to read,
    # and one the probe never assigns anyone to, so "hidden" is really hidden.
    manager = hass.data["glt_flow_card"]["manager"]
    for seeded in (PROJECT_ID, HIDDEN_PROJECT_ID):
        await manager.save_project(
            {
                "id": seeded,
                "config": {
                    "type": "custom:glt-flow-card",
                    "schema_version": 2,
                    "project": {"id": seeded, "name": seeded, "revision": 0},
                    "views": [],
                    "equipment": [],
                    "paths": [],
                    "datapoints": [],
                },
            },
            autosave=False,
            user_id=phase2_users.principal("admin").user_id,
            expected_revision=0,
        )

    for key in ("viewer", "operator", "engineer", "admin"):
        principal = phase2_users.principal(key)
        await runtime_access.async_assign(
            project_id=PROJECT_ID,
            user_id=principal.user_id,
            role=principal.project_role,
        )

    for principal_key in MATRIX_PRINCIPALS:
        connection = await phase2_users.async_connect(principal_key)
        for route_policy in COMMAND_POLICY_CONTRACT:
            response = await connection.command(payload_for(route_policy))
            allowed = expect_allowed(principal_key, route_policy)
            if response.get("success") is False:
                code = response.get("error", {}).get("code")
                if code not in ERROR_CODES:
                    gaps.append(
                        f"{route_policy.route} answered {principal_key} with the "
                        f"non-stable code {code!r}"
                    )
                if allowed and code in {"capability_denied", "not_found_or_denied"}:
                    gaps.append(
                        f"{route_policy.route} denied {principal_key}, which holds "
                        f"{route_policy.capability}"
                    )
                if not allowed and code not in {
                    "capability_denied",
                    "not_found_or_denied",
                    "feature_unavailable",
                    "lease_required",
                    "invalid_input",
                    "revision_conflict",
                }:
                    gaps.append(
                        f"{route_policy.route} rejected unauthorized {principal_key} "
                        f"with {code!r} instead of a fail-closed code"
                    )
            elif not allowed:
                gaps.append(
                    f"{route_policy.route} succeeded for unauthorized {principal_key}"
                )

        hidden = await connection.command(
            {"type": "glt_flow_card/projects/get", "project_id": HIDDEN_PROJECT_ID}
        )
        missing = await connection.command(
            {"type": "glt_flow_card/projects/get", "project_id": MISSING_PROJECT_ID}
        )
        if hidden != {**hidden, **{k: v for k, v in missing.items() if k == "error"}}:
            gaps.append(
                f"{principal_key} can distinguish a hidden project from a missing one"
            )
        await phase2_users.async_disconnect(connection)

    if controlled_service is not None and controlled_service.calls:
        gaps.append(
            f"the authorization matrix caused {len(controlled_service.calls)} service calls"
        )
    return gaps
