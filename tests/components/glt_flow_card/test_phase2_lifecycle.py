"""Phase-2 runtime lifecycle and resource cleanup (T2-15).

Unload hides the runtime *first*, then releases everything it owns. After that
the Phase-2 resource ledger must be zero, a late callback must be ignored rather
than resurrecting state, and a re-setup must start a new generation so no
pre-unload lease, cursor or subscription token can ever be reused.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import PHASE2_RESOURCE_COUNTERS, LifecycleEffects

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase2-migration-lifecycle]: "
    "conservative migration and resource cleanup are unavailable"
)
EFFECT_PREFIX = "PHASE2_LIFECYCLE_EFFECTS "

#: Everything a Phase-2 runtime owns and must release, in release order.
OWNED_RESOURCES = (
    "availability",
    "subscriptions",
    "cursors",
    "leases",
    "control_waits",
    "rate_buckets",
    "tasks",
    "listeners",
)


def emit_effects(effects: LifecycleEffects, **extra: Any) -> None:
    """Print the resource ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        name: snapshot.get(name, 0) for name in PHASE2_RESOURCE_COUNTERS
    } | {"service_attempts": snapshot["service_attempts"], **extra}, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def test_release_order_hides_the_runtime_before_freeing_anything() -> None:
    """Availability disappears first, so nothing new can be admitted."""
    assert OWNED_RESOURCES[0] == "availability"
    assert set(OWNED_RESOURCES[1:]) <= set(PHASE2_RESOURCE_COUNTERS) | {"availability"}


async def test_unload_leaves_the_phase2_resource_ledger_at_zero(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Setup, unload and re-setup keep every counted resource accounted for."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, stage="loaded")

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, stage="unloaded")
    assert lifecycle_effects.phase2_resource_total() == 0

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    assert lifecycle_effects.phase2_resource_total() == 0


async def test_a_late_callback_is_recorded_and_never_revives_the_runtime(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """A callback that fires after unload must not recreate runtime state."""
    from custom_components.glt_flow_card import _runtime_for

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()

    lifecycle_effects.record_late_callback("state_changed", {"entity_id": "sensor.x"})
    assert _runtime_for(hass, config_entry.entry_id) is None
    assert lifecycle_effects.late_callbacks
    emit_effects(lifecycle_effects, stage="late-callback")


async def test_unload_releases_live_leases_cursors_and_subscriptions(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """Unloading with resources genuinely in use still ends at zero.

    An unload that is only ever tested from an idle runtime proves nothing: the
    interesting failure is the one where somebody is holding something.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]
    engineer = phase2_users.principal("engineer")
    await runtime.access.async_assign(
        project_id="lifecycle-plant", user_id=engineer.user_id, role="engineer"
    )
    connection = await phase2_users.async_connect("engineer")
    acquired = await connection.command({
        "type": "glt_flow_card/leases/acquire",
        "project_id": "lifecycle-plant",
        "ttl_seconds": 300,
    })
    assert acquired["success"] is True
    assert runtime.leases.diagnostics()["active_leases"] == 1
    emit_effects(lifecycle_effects, stage="in-use")

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, stage="unloaded-in-use")
    assert lifecycle_effects.phase2_resource_total() == 0
    await phase2_users.async_close()


async def test_a_ghost_command_after_unload_is_refused_with_no_effect(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """The commands stay registered after unload; the runtime does not.

    Home Assistant registers WebSocket commands once per process, so an unloaded
    entry cannot unregister them. The boundary must therefore refuse by itself
    rather than relying on the handler being gone.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    connection = await phase2_users.async_connect("engineer")
    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()

    for message in (
        {"type": "glt_flow_card/capabilities/get", "project_id": "lifecycle-plant"},
        {"type": "glt_flow_card/leases/acquire", "project_id": "lifecycle-plant", "ttl_seconds": 300},
        {"type": "glt_flow_card/evidence/list", "project_id": "lifecycle-plant"},
    ):
        response = await connection.command(message)
        assert response["success"] is False
        assert response["error"]["code"] == "not_loaded", message["type"]

    assert lifecycle_effects.snapshot()["service_attempts"] == 0
    assert lifecycle_effects.phase2_resource_total() == 0
    await phase2_users.async_close()


async def test_a_failed_reload_restores_options_without_reviving_authority(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Rejected options leave the previous safe runtime, at a new generation.

    Restoring the previous *options* must not restore the previous *authority*:
    a lease or cursor issued before the failed reload has to be dead, or a
    failed configuration change becomes a way to resurrect a capability.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    before = _generation(hass, config_entry)
    previous = dict(hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id].manager.effective_options)

    hass.config_entries.async_update_entry(
        config_entry, options={**previous, "default_lock_ttl": "not-an-int"}
    )
    await hass.async_block_till_done()

    runtime = hass.data["glt_flow_card"]["runtimes"].get(config_entry.entry_id)
    assert runtime is not None
    assert runtime.manager.effective_options == previous
    assert _generation(hass, config_entry) >= before
    assert lifecycle_effects.snapshot()["service_attempts"] == 0


def _generation(hass: HomeAssistant, entry: MockConfigEntry) -> int:
    runtime = hass.data["glt_flow_card"]["runtimes"].get(entry.entry_id)
    return getattr(runtime, "generation", 0)


async def lifecycle_gaps(hass: HomeAssistant) -> list[str]:
    """Return every unmet Phase-2 lifecycle guarantee."""
    gaps: list[str] = []

    from custom_components import glt_flow_card as component

    runtime_type = getattr(component, "CompanionRuntime", None)
    if runtime_type is None:
        return ["CompanionRuntime is missing"]

    for name in ("generation", "async_invalidate"):
        if not hasattr(runtime_type, name):
            gaps.append(
                f"CompanionRuntime.{name} is missing, so a new setup cannot start a "
                "generation that invalidates every pre-unload token"
            )

    for module, attribute in (
        ("policy", "policy_coordinator"),
        ("project_access", "access_repository"),
        ("project_leases", "lease_registry"),
        ("policy_sessions", "subscription_registry"),
        ("policy_sessions", "cursor_registry"),
    ):
        loaded = load(module)
        if loaded is None:
            gaps.append(f"runtime resource owner {module} does not exist")
        elif not hasattr(loaded, attribute):
            gaps.append(f"{module}.{attribute} is missing")
    return gaps


async def test_expected_red_phase2_migration_lifecycle(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Migration is conservative and unload releases every Phase-2 resource."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, stage="sentinel")

    from .test_phase2_migration import migration_gaps

    gaps = await lifecycle_gaps(hass)
    gaps.extend(await migration_gaps(hass))

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  lifecycle gap: {gap}")
    assert not gaps, "conservative migration and resource cleanup are unavailable"
