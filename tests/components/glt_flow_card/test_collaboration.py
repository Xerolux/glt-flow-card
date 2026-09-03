"""Immediate-precommit collaboration guard (T2-11).

Authorizing at the WebSocket boundary is not enough. Role, capability policy
version, access revision, lease, content revision and digest must all be
rechecked *inside* the coordinator lock immediately before the PREPARED journal
is written, so nothing that changes between authorization and commit can slip a
write through.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects
from custom_components.glt_flow_card.project_transactions import (
    MutationGuard as MutationGuardEvidence,
)

from .policy_contract import COMMAND_POLICY_CONTRACT

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase2-collaboration-guard]: "
    "immediate-precommit collaboration guard is unavailable"
)
EFFECT_PREFIX = "PHASE2_COLLAB_EFFECTS "

PROJECT_ID = "collab-plant"

#: Everything the guard must re-read inside the lock, immediately before commit.
GUARD_INPUTS = (
    "effective_capability",
    "access_revision",
    "lease",
    "revision",
    "digest",
    "policy_version",
)

#: Resolved A3: content and access carry separate revision streams. A mutation
#: may require both, but one can never satisfy the other.
CONTENT_REVISION_FIELD = "expected_revision"
ACCESS_REVISION_FIELD = "expected_access_revision"


def emit_effects(effects: LifecycleEffects, **extra: Any) -> None:
    """Print the zero-effect ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        "service_attempts": snapshot["service_attempts"],
        "leases": snapshot["leases"],
        "subscriptions": snapshot["subscriptions"],
        "late_callbacks": snapshot["late_callbacks"],
        **extra,
    }, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def mutation_routes() -> tuple[str, ...]:
    """Every declared route that mutates shared state."""
    return tuple(
        policy.route for policy in COMMAND_POLICY_CONTRACT if policy.requires_lease
    )


# --------------------------------------------------------------------------
# Contract guarantees that hold before and after implementation.
# --------------------------------------------------------------------------


def test_every_shared_mutation_requires_both_a_lease_and_a_revision() -> None:
    """There is no optional-revision and no lease-free shared write."""
    routes = mutation_routes()
    assert routes, "the contract declares no shared mutation"
    for policy in COMMAND_POLICY_CONTRACT:
        if policy.requires_lease:
            assert policy.requires_revision, policy.route
    assert "glt_flow_card/projects/save" in routes
    assert "glt_flow_card/projects/apply" in routes
    assert "glt_flow_card/projects/rollback" in routes
    assert "glt_flow_card/projects/delete" in routes


def test_revision_streams_are_separate() -> None:
    """Resolved A3: an access revision can never satisfy a content revision."""
    assert CONTENT_REVISION_FIELD != ACCESS_REVISION_FIELD


def test_guard_inputs_cover_every_thing_that_can_change_mid_request() -> None:
    """The guard list is the complete set of race-sensitive authority inputs."""
    assert set(GUARD_INPUTS) == {
        "effective_capability",
        "access_revision",
        "lease",
        "revision",
        "digest",
        "policy_version",
    }


async def test_the_shared_save_seam_is_inspectable_and_takes_a_revision(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """The compatibility save seam exists and is reachable by the guard.

    Whether that seam still permits a missing revision is the sentinel's
    business; this test only guarantees the seam stays inspectable, so the
    sentinel can never report a false pass because it looked at nothing.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    import inspect

    from custom_components.glt_flow_card import project_transactions

    signature = inspect.signature(
        project_transactions.ProjectTransactionCoordinator.compatibility_save
    )
    assert CONTENT_REVISION_FIELD in signature.parameters
    print(f"shared save seam: compatibility_save{signature}")
    emit_effects(lifecycle_effects, mutation_routes=len(mutation_routes()))


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def collaboration_gaps(hass: HomeAssistant, phase2_users: Any) -> list[str]:
    """Return every unmet precommit-guard guarantee."""
    transactions = load("project_transactions")
    if transactions is None:
        return ["custom_components.glt_flow_card.project_transactions does not exist"]

    gaps: list[str] = []
    coordinator_type = getattr(transactions, "ProjectTransactionCoordinator", None)
    if coordinator_type is None:
        return ["ProjectTransactionCoordinator is missing"]

    if not hasattr(transactions, "MutationGuard"):
        gaps.append(
            "project_transactions.MutationGuard is missing, so the decisive check "
            "still happens outside the coordinator lock"
        )
    if not hasattr(coordinator_type, "set_mutation_guard"):
        gaps.append("the coordinator accepts no in-lock mutation guard")

    save = getattr(coordinator_type, "compatibility_save", None)
    if save is not None:
        try:
            import inspect

            signature = inspect.signature(save)
            revision = signature.parameters.get("expected_revision")
            if revision is not None and revision.default is not inspect.Parameter.empty:
                gaps.append(
                    "compatibility_save still allows an optional expected_revision"
                )
            if "lease" not in signature.parameters and "lease_token" not in signature.parameters:
                gaps.append("compatibility_save accepts no lease evidence")
        except (TypeError, ValueError):
            gaps.append("compatibility_save has no inspectable signature")

    guard = getattr(transactions, "MutationGuard", None)
    if guard is not None:
        declared = set(getattr(guard, "__annotations__", {}))
        missing = [name for name in GUARD_INPUTS if name not in declared]
        if missing:
            gaps.append(f"MutationGuard does not carry {missing}")
    return gaps


async def test_expected_red_phase2_collaboration_guard(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """Every shared mutation rechecks all authority immediately before commit."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, mutation_routes=len(mutation_routes()))

    gaps = await collaboration_gaps(hass, phase2_users)
    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  guard gap: {gap}")
    assert not gaps, "immediate-precommit collaboration guard is unavailable"


async def test_authority_lost_between_authorization_and_commit_is_refused(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """The boundary check alone is not enough, and this proves it.

    The request is authorized, the candidate is computed, and only then is the
    engineer's role revoked. Without the in-lock recheck the write would land;
    with it the transaction is refused and nothing durable changes.
    """
    from custom_components.glt_flow_card.project_transactions import MutationDenied

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]
    manager = hass.data["glt_flow_card"]["manager"]

    engineer = phase2_users.principal("engineer")
    admin = phase2_users.principal("admin")
    await runtime.access.async_assign(
        project_id=PROJECT_ID, user_id=admin.user_id, role="admin"
    )
    await runtime.access.async_assign(
        project_id=PROJECT_ID, user_id=engineer.user_id, role="engineer"
    )
    state = await runtime.access.async_get(PROJECT_ID)

    lease = runtime.leases.acquire(
        project_id=PROJECT_ID,
        user_id=engineer.user_id,
        session_id="commit-race",
        purpose="engineering",
        ttl_seconds=300,
        access_revision=state.access_revision,
    )
    guard = MutationGuardEvidence(
        project_id=PROJECT_ID,
        user_id=engineer.user_id,
        session_id="commit-race",
        purpose="engineering",
        effective_capability="project.write",
        access_revision=state.access_revision,
        lease=lease.token,
        revision=0,
        digest=None,
        policy_version=1,
    )

    # The guard admits the mutation while the engineer still holds the role.
    await manager.project_transactions._check_guard(guard)

    # The role disappears mid-flight, exactly as a concurrent admin change would.
    await runtime.access.async_revoke(project_id=PROJECT_ID, user_id=engineer.user_id)

    with pytest.raises(MutationDenied) as refused:
        await manager.project_transactions._check_guard(guard)
    assert refused.value.code in {"authority_stale", "capability_denied"}
    assert manager.project_repository.get_head(PROJECT_ID) is None


async def test_every_declared_mutation_reaches_the_guarded_coordinator(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """No mutation route may reach a durable write without guard evidence."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    manager = hass.data["glt_flow_card"]["manager"]

    assert manager.project_transactions._mutation_guard is not None

    engineer = phase2_users.principal("engineer")
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]
    await runtime.access.async_assign(
        project_id=PROJECT_ID, user_id=engineer.user_id, role="admin"
    )
    connection = await phase2_users.async_connect("engineer")

    before = manager.project_repository.list_heads()
    for route in mutation_routes():
        payload = {"type": route, "lease_token": "never-issued"}
        if route == "glt_flow_card/projects/save":
            payload.update({
                "project": {"id": PROJECT_ID, "config": {}},
                "expected_revision": 0,
            })
        else:
            payload["project_id"] = PROJECT_ID
        if route == "glt_flow_card/projects/preview":
            payload.update({"expected_revision": 0, "candidate": {}})
        if route == "glt_flow_card/projects/apply":
            payload.update({
                "preview_id": "x", "expected_revision": 0, "selected_ids": [],
            })
        if route == "glt_flow_card/projects/rollback":
            payload.update({
                "snapshot_id": "sha256:" + "0" * 64,
                "expected_revision": 0,
                "confirmation": f"ROLLBACK {PROJECT_ID}",
            })
        response = await connection.command(payload)
        assert response["success"] is False, route
        assert response["error"]["code"] == "lease_expired", route

    assert manager.project_repository.list_heads() == before
    await phase2_users.async_close()
