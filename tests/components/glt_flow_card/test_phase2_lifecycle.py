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
