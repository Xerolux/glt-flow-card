"""Server-owned project access control (T2-05, and T2-02's HA ceiling).

The ACL is a separate versioned server store. Project JSON, imports, rollbacks
and content edits can never create or elevate an assignment, and every ACL
change is itself a guarded shared mutation with an exact access revision.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects
from .policy_contract import HA_ADMIN_CAPABILITIES, ROLES

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase2-access-revocation]: "
    "server-owned access and revocation are unavailable"
)
EFFECT_PREFIX = "PHASE2_ACCESS_EFFECTS "

PROJECT_ID = "access-plant"

#: Resolved A2 bound: an ACL may hold at most this many assignments.
MAX_MEMBERS = 512

#: A legacy project body that tries to grant itself membership. Nothing in here
#: may ever become authoritative.
SELF_GRANTING_PROJECT: dict[str, Any] = {
    "type": "custom:glt-flow-card",
    "schema_version": 2,
    "project": {"id": PROJECT_ID, "name": "Access Plant", "revision": 0},
    "permissions": {
        "designers": ["attacker-user-id"],
        "operators": ["attacker-user-id"],
        "admins": ["attacker-user-id"],
    },
    "access": {"assignments": [{"user_id": "attacker-user-id", "role": "admin"}]},
    "views": [],
    "equipment": [],
    "paths": [],
    "datapoints": [],
}


def emit_effects(effects: LifecycleEffects, **extra: Any) -> None:
    """Print the zero-effect ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        "service_attempts": snapshot["service_attempts"],
        "session_attempts": snapshot["sessions"],
        "subscriptions": snapshot["subscriptions"],
        "leases": snapshot["leases"],
        "late_callbacks": snapshot["late_callbacks"],
        **extra,
    }, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


# --------------------------------------------------------------------------
# Contract guarantees that hold before and after implementation.
# --------------------------------------------------------------------------


def test_self_granting_project_content_is_never_an_authority_source() -> None:
    """Every membership-looking key in project JSON is inert by contract."""
    for key in ("permissions", "access"):
        assert key in SELF_GRANTING_PROJECT, "the fixture must actually try to self-grant"
    assert set(ROLES) == {"viewer", "operator", "engineer", "admin"}


def test_ha_admin_membership_surface_is_minimal() -> None:
    """Resolved A2: bootstrap authority is membership only, never content."""
    assert HA_ADMIN_CAPABILITIES == {
        "project.access.read",
        "project.access.write",
        "lease.administration",
    }


def test_member_bound_is_declared() -> None:
    """The ACL is bounded so a grant loop cannot exhaust the store."""
    assert MAX_MEMBERS == 512


async def test_legacy_project_permissions_do_not_reach_the_runtime_role(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """A stored project that claims membership grants nothing to that user."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    manager = hass.data["glt_flow_card"]["manager"]
    await manager.save_project(
        {"id": PROJECT_ID, "config": SELF_GRANTING_PROJECT},
        autosave=False,
        user_id=phase2_users.principal("admin").user_id,
        expected_revision=0,
    )

    # No principal in this fixture is the user the project body names, and the
    # stored body may not turn that name into authority for anyone.
    claimed = set(SELF_GRANTING_PROJECT["permissions"]["admins"])
    for principal in phase2_users.principals():
        assert principal.user_id not in claimed
    emit_effects(lifecycle_effects, assignments=0)


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def access_gaps(hass: HomeAssistant, phase2_users: Any) -> list[str]:
    """Return every unmet server-owned access guarantee."""
    gaps: list[str] = []
    access = load("project_access")
    if access is None:
        return ["custom_components.glt_flow_card.project_access does not exist"]

    for name in ("ProjectAccessRepository", "access_repository", "AccessConflict"):
        if not hasattr(access, name):
            gaps.append(f"project_access.{name} is missing")
    if gaps:
        return gaps

    repository = access.access_repository(hass)
    if repository is None:
        return ["the loaded runtime exposes no ACL repository"]

    admin = phase2_users.principal("admin")
    engineer = phase2_users.principal("engineer")

    # Bootstrap: the first assignment must be creatable and must be exact.
    state = await repository.async_get(PROJECT_ID)
    if state.assignments:
        gaps.append("a fresh project must start with no assignments")
    if state.access_revision != 0:
        gaps.append("a fresh project must start at access revision 0")

    await repository.async_assign(
        project_id=PROJECT_ID, user_id=admin.user_id, role="admin"
    )
    state = await repository.async_get(PROJECT_ID)
    if state.access_revision != 1:
        gaps.append("assigning a role must advance the access revision by exactly one")
    if state.role_of(admin.user_id) != "admin":
        gaps.append("the assigned role was not persisted")

    # Content can never self-grant.
    if hasattr(repository, "async_bootstrap_from_legacy"):
        await repository.async_bootstrap_from_legacy(PROJECT_ID, SELF_GRANTING_PROJECT)
        state = await repository.async_get(PROJECT_ID)
        if state.role_of("attacker-user-id") is not None:
            gaps.append("project content self-granted a membership")
    else:
        gaps.append("project_access.async_bootstrap_from_legacy is missing")

    # A stale access revision must be rejected atomically.
    try:
        await repository.async_assign(
            project_id=PROJECT_ID,
            user_id=engineer.user_id,
            role="engineer",
            expected_access_revision=0,
        )
        gaps.append("a stale access revision was accepted")
    except access.AccessConflict:
        pass
    except TypeError:
        gaps.append("async_assign does not accept an expected access revision")

    # An unknown role must never be storable.
    try:
        await repository.async_assign(
            project_id=PROJECT_ID, user_id=engineer.user_id, role="superuser"
        )
        gaps.append("an unknown role was accepted")
    except (ValueError, access.AccessConflict):
        pass

    # The last admin cannot be removed.
    try:
        await repository.async_revoke(project_id=PROJECT_ID, user_id=admin.user_id)
        gaps.append("the last admin was removed, which strands the project")
    except access.AccessConflict:
        pass

    return gaps


async def test_expected_red_phase2_access_revocation(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """Membership is server-owned, exact-revisioned and impossible to self-grant."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, assignments=0)

    from .test_policy_subscriptions import subscription_gaps

    gaps = await access_gaps(hass, phase2_users)
    gaps.extend(await subscription_gaps(hass, phase2_users))

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  access gap: {gap}")
    assert not gaps, "server-owned access and revocation are unavailable"


async def test_ha_admin_can_bootstrap_the_first_admin_but_reads_no_content(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """Resolved A2 end to end, over the real WebSocket boundary.

    An unassigned Home Assistant administrator can see who holds what, take an
    administration lease, and assign the first project Admin - and remains
    unable to read the project itself before or after doing so.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    manager = hass.data["glt_flow_card"]["manager"]
    await manager.save_project(
        {"id": PROJECT_ID, "config": SELF_GRANTING_PROJECT},
        autosave=False,
        user_id=phase2_users.principal("ha_admin").user_id,
        expected_revision=0,
    )

    ha_admin = await phase2_users.async_connect("ha_admin")
    inventory = await ha_admin.command({
        "type": "glt_flow_card/access/get",
        "project_id": PROJECT_ID,
    })
    assert inventory["success"] is True
    assert inventory["result"]["assignments"] == []
    assert inventory["result"]["access_revision"] == 0
    for forbidden in ("config", "title", "revision", "audit", "counts"):
        assert forbidden not in inventory["result"]

    # The project body is unreadable to this principal, before the change.
    denied = await ha_admin.command({
        "type": "glt_flow_card/projects/get",
        "project_id": PROJECT_ID,
    })
    assert denied["success"] is False
    assert denied["error"]["code"] == "not_found_or_denied"

    lease = await ha_admin.command({
        "type": "glt_flow_card/leases/acquire",
        "project_id": PROJECT_ID,
        "purpose": "membership_admin",
        "ttl_seconds": 300,
    })
    assert lease["success"] is True

    first_admin = phase2_users.principal("admin")
    assigned = await ha_admin.command({
        "type": "glt_flow_card/access/set",
        "project_id": PROJECT_ID,
        "user_id": first_admin.user_id,
        "role": "admin",
        "expected_access_revision": 0,
        "lease_token": lease["result"]["lease_token"],
    })
    assert assigned["success"] is True
    assert assigned["result"]["access_revision"] == 1
    assert assigned["result"]["assignments"] == [
        {"user_id": first_admin.user_id, "role": "admin"}
    ]

    # ... and still unreadable afterwards: recovery is not membership.
    still_denied = await ha_admin.command({
        "type": "glt_flow_card/projects/get",
        "project_id": PROJECT_ID,
    })
    assert still_denied["success"] is False
    assert still_denied["error"]["code"] == "not_found_or_denied"
    await phase2_users.async_close()


async def test_membership_administration_refuses_self_grant_and_stale_revisions(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """A membership change cannot elevate its own author or race another."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]

    ha_admin = await phase2_users.async_connect("ha_admin")
    lease = await ha_admin.command({
        "type": "glt_flow_card/leases/acquire",
        "project_id": PROJECT_ID,
        "purpose": "membership_admin",
        "ttl_seconds": 300,
    })
    token = lease["result"]["lease_token"]

    self_grant = await ha_admin.command({
        "type": "glt_flow_card/access/set",
        "project_id": PROJECT_ID,
        "user_id": phase2_users.principal("ha_admin").user_id,
        "role": "admin",
        "expected_access_revision": 0,
        "lease_token": token,
    })
    assert self_grant["success"] is False
    assert self_grant["error"]["code"] == "capability_denied"

    unknown_user = await ha_admin.command({
        "type": "glt_flow_card/access/set",
        "project_id": PROJECT_ID,
        "user_id": "not-a-home-assistant-user",
        "role": "viewer",
        "expected_access_revision": 0,
        "lease_token": token,
    })
    assert unknown_user["success"] is False
    assert unknown_user["error"]["code"] == "invalid_input"

    stale = await ha_admin.command({
        "type": "glt_flow_card/access/set",
        "project_id": PROJECT_ID,
        "user_id": phase2_users.principal("viewer").user_id,
        "role": "viewer",
        "expected_access_revision": 7,
        "lease_token": token,
    })
    assert stale["success"] is False
    assert stale["error"]["code"] == "revision_conflict"

    assert (await runtime.access.async_get(PROJECT_ID)).assignments == ()

    ordinary = await phase2_users.async_connect("unassigned")
    hidden = await ordinary.command({
        "type": "glt_flow_card/access/get",
        "project_id": PROJECT_ID,
    })
    assert hidden["success"] is False
    assert hidden["error"]["code"] == "not_found_or_denied"
    await phase2_users.async_close()
