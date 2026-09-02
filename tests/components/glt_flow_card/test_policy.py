"""Deny-default route/principal authorization matrix (T2-01, T2-02, T2-03).

The matrix is generated from the *runtime* command registration, never from
source tokens: a route that exists but is not declared, or a declared route that
is not registered, is a policy hole and must fail here.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects
from .test_policy_enumeration import enumeration_gaps
from .policy_contract import (
    CAPABILITIES,
    COMMAND_POLICY_CONTRACT,
    ERROR_CODES,
    HA_ADMIN_CAPABILITIES,
    MATRIX_PRINCIPALS,
    ROLE_CAPABILITIES,
    ROLES,
    capabilities_for,
    expect_allowed,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase2-policy-matrix]: "
    "centralized deny-default policy matrix is unavailable"
)
EFFECT_PREFIX = "PHASE2_POLICY_EFFECTS "


def emit_effects(effects: LifecycleEffects, **extra: Any) -> None:
    """Print the zero-effect ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    payload = {
        "service_attempts": snapshot["service_attempts"],
        "session_attempts": snapshot["sessions"],
        "listeners": snapshot["listeners"],
        "subscriptions": snapshot["subscriptions"],
        "cursors": snapshot["cursors"],
        "leases": snapshot["leases"],
        **extra,
    }
    print(f"{EFFECT_PREFIX}{json.dumps(payload, sort_keys=True)}")


def load_policy_module() -> Any:
    """Return the shipped policy module, or None while it does not exist."""
    try:
        from custom_components.glt_flow_card import policy
    except ImportError:
        return None
    return policy


def registered_routes(effects: LifecycleEffects) -> tuple[str, ...]:
    """Return the exact set of routes Home Assistant actually registered."""
    return tuple(
        name for name in effects.websocket_commands if name.startswith("glt_flow_card/")
    )


# --------------------------------------------------------------------------
# Contract self-consistency. These hold before and after implementation and
# guarantee the matrix itself cannot drift into a meaningless shape.
# --------------------------------------------------------------------------


def test_contract_declares_each_route_once_with_valid_metadata() -> None:
    """The declared surface is unique, complete and internally consistent."""
    routes = [policy.route for policy in COMMAND_POLICY_CONTRACT]
    assert len(routes) == len(set(routes)), "duplicate route declaration"
    for policy in COMMAND_POLICY_CONTRACT:
        assert policy.route.startswith("glt_flow_card/")
        if policy.state == "active":
            assert policy.capability in CAPABILITIES
        else:
            assert policy.capability is None or policy.capability in CAPABILITIES
        if policy.requires_lease:
            assert policy.state == "active", policy.route
            assert policy.requires_revision, policy.route


def test_role_capabilities_are_monotonic_and_closed() -> None:
    """Each stronger role is a superset, and no capability is invented."""
    for stronger, weaker in zip(ROLES[1:], ROLES):
        assert ROLE_CAPABILITIES[weaker] <= ROLE_CAPABILITIES[stronger], stronger
    for role, capabilities in ROLE_CAPABILITIES.items():
        assert capabilities <= set(CAPABILITIES), role


def test_ha_admin_ceiling_grants_no_project_content_authority() -> None:
    """Resolved A2: HA administration is membership recovery, not access."""
    forbidden = {
        "project.read",
        "project.list",
        "project.write",
        "project.delete",
        "control.read",
        "control.execute",
        "evidence.read",
        "evidence.telemetry.write",
        "remote.read",
        "remote.control",
    }
    assert HA_ADMIN_CAPABILITIES.isdisjoint(forbidden)
    assert "lease.engineering" not in HA_ADMIN_CAPABILITIES
    assert capabilities_for("unassigned") == frozenset()


def test_deferred_and_retired_routes_are_allowed_for_nobody() -> None:
    """A declared route that is not active must fail closed for every principal."""
    for policy in COMMAND_POLICY_CONTRACT:
        if policy.state == "active":
            continue
        for principal in MATRIX_PRINCIPALS:
            assert expect_allowed(principal, policy) is False, (principal, policy.route)


def test_error_codes_are_stable_and_non_enumerating() -> None:
    """Missing and denied objects share one code so existence cannot leak."""
    assert "not_found_or_denied" in ERROR_CODES
    assert "not_found" not in ERROR_CODES
    assert "forbidden" not in ERROR_CODES
    assert len(ERROR_CODES) == len(set(ERROR_CODES))


async def test_every_registered_route_is_declared_in_the_contract(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """No handler may exist outside the declared policy surface."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    declared = {policy.route for policy in COMMAND_POLICY_CONTRACT}
    registered = set(registered_routes(lifecycle_effects))
    assert registered - declared == set(), "undeclared route registered"
    assert declared - registered == set(), "declared route was never registered"
    emit_effects(lifecycle_effects, routes=len(registered))


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def test_expected_red_phase2_policy_matrix(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """The Companion enforces one deny-default manifest for every route."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, routes=len(registered_routes(lifecycle_effects)))

    gaps: list[str] = []
    policy = load_policy_module()
    if policy is None:
        gaps.append("custom_components.glt_flow_card.policy does not exist")
    else:
        manifest = getattr(policy, "COMMAND_POLICIES", None)
        if manifest is None:
            gaps.append("policy.COMMAND_POLICIES is missing")
        else:
            declared = {entry.route for entry in COMMAND_POLICY_CONTRACT}
            shipped = set(manifest)
            for missing in sorted(declared - shipped):
                gaps.append(f"route not declared in the manifest: {missing}")
            for extra in sorted(shipped - declared):
                gaps.append(f"manifest declares an unknown route: {extra}")
            for route in sorted(declared & shipped):
                expected = next(e for e in COMMAND_POLICY_CONTRACT if e.route == route)
                actual = manifest[route]
                for field in ("scope", "capability", "enumeration", "state",
                              "requires_lease", "requires_revision", "project_field",
                              "any_of"):
                    if getattr(actual, field, None) != getattr(expected, field):
                        gaps.append(
                            f"{route}.{field} is {getattr(actual, field, None)!r}, "
                            f"expected {getattr(expected, field)!r}"
                        )
        for name in ("ROLE_CAPABILITIES", "HA_ADMIN_CAPABILITIES", "authorize"):
            if not hasattr(policy, name):
                gaps.append(f"policy.{name} is missing")
        role_map = getattr(policy, "ROLE_CAPABILITIES", None)
        if isinstance(role_map, dict):
            for role, expected_caps in ROLE_CAPABILITIES.items():
                if set(role_map.get(role, ())) != set(expected_caps):
                    gaps.append(f"role {role} capability set does not match the contract")

    gaps.extend(await enumeration_gaps(hass, phase2_users))

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  policy gap: {gap}")
    assert not gaps, "centralized deny-default policy matrix is unavailable"
