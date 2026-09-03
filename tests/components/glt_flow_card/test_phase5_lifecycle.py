"""Phase-5 extension state does not outlive the runtime that owns it (T5-15).

Phase 5 adds one thing a reload could strand: the per-project extension
registries. A pack surviving an unload would be a pack accepted under one
project schema version living on into an installation running another, and a
resolvable symbol from a dead generation is worse than a missing one -- a
diagram would keep drawing something nobody validated.

The release order is the Phase-2 one and matters for the same reason:
availability disappears first, so nothing admitted after that point can observe
a half-released runtime.
"""
from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.sdk_registry import (
    InstallRefused,
    SdkRegistry,
    project_references,
    referring_projects,
)

from .panel_seed import seed_operations_project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def _manifest(namespace: str = "acme") -> dict:
    return {
        "namespace": namespace,
        "version": "1.0.0",
        "supports_schema_versions": [4],
        "contributions": [
            {"id": f"{namespace}/pump", "kind": "symbol",
             "payload": {"markup": "<svg><circle r='19'/></svg>"}},
        ],
    }


def _drawing_with(contribution_id: str) -> dict:
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 4,
        "equipment": [{"id": "e1", "type": "pump", "symbol_variant": contribution_id}],
    }


def test_a_project_reference_is_found_wherever_it_is_written() -> None:
    project = {
        "equipment": [
            {"id": "a", "symbol": "acme/pump"},
            {"id": "b", "symbol_variant": "acme/valve"},
            {"id": "c", "profile": "acme/pump-profile"},
            {"id": "d", "symbol": "heat_pump_neo"},
        ],
        "profiles": [{"id": "local", "extends": "acme/base"}],
        "contributions": [{"id": "acme/translation"}],
    }
    assert project_references(project) == {
        "acme/pump", "acme/valve", "acme/pump-profile", "acme/base", "acme/translation",
    }
    # A first-party symbol carries no namespace and is not a pack reference.
    assert "heat_pump_neo" not in project_references(project)


def test_removing_a_referenced_pack_is_refused_and_names_the_referrers() -> None:
    """A dangling symbol is a diagram that silently stops meaning something."""
    registry = SdkRegistry("p1")
    registry.install(_manifest())
    projects = {"p1": _drawing_with("acme/pump")}

    with pytest.raises(InstallRefused) as refusal:
        registry.remove("acme", projects)
    assert refusal.value.code == "pack_still_referenced"
    assert refusal.value.detail == {
        "namespace": "acme",
        "referrers": [{"project_id": "p1", "contributions": ["acme/pump"]}],
    }
    # Refused means nothing changed: the symbol still resolves.
    assert registry.resolve("acme/pump") is not None


def test_removing_an_unreferenced_pack_succeeds_and_the_symbol_stops_resolving() -> None:
    registry = SdkRegistry("p1")
    registry.install(_manifest())
    projects = {"p1": _drawing_with("other/pump")}
    assert registry.remove("acme", projects)["removed"] == 1
    assert registry.resolve("acme/pump") is None, "a stale symbol is still resolvable"


def test_a_refusal_names_only_projects_the_caller_handed_in() -> None:
    """The registry never goes looking, so it cannot name a hidden project."""
    registry = SdkRegistry("p1")
    registry.install(_manifest())
    assert referring_projects({}, ["acme/pump"]) == []
    assert registry.remove("acme", {})["namespace"] == "acme"


async def test_invalidation_clears_every_phase5_registry(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    registry = runtime.extensions.setdefault("operations-corpus", SdkRegistry("operations-corpus"))
    registry.install(_manifest())
    assert registry.resource_ledger() == {"packs": 1, "contributions": 1}

    await runtime.async_invalidate()
    assert runtime.available is False
    assert runtime.extensions == {}
    assert registry.resource_ledger() == {"packs": 0, "contributions": 0}
    await phase2_users.async_close()


async def test_availability_disappears_before_the_registries_are_released(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """A request admitted mid-teardown must never see a half-released runtime."""
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    registry = runtime.extensions.setdefault("operations-corpus", SdkRegistry("operations-corpus"))
    seen: list[bool] = []
    original = registry.clear

    def observe() -> None:
        seen.append(runtime.available)
        original()

    registry.clear = observe  # type: ignore[method-assign]
    await runtime.async_invalidate()
    assert seen == [False], "the runtime was still available while releasing"
    await phase2_users.async_close()


async def test_unload_leaves_no_extension_state_behind(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    runtime.extensions.setdefault("operations-corpus", SdkRegistry("operations-corpus")).install(
        _manifest()
    )
    await phase2_users.async_close()

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()

    runtimes = hass.data.get("glt_flow_card", {}).get("runtimes", {})
    assert config_entry.entry_id not in runtimes
    assert runtime.available is False
    assert runtime.extensions == {}


async def test_a_late_resolve_after_unload_is_inert(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """A callback that fires after teardown finds nothing, and does not raise."""
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    registry = runtime.extensions.setdefault("operations-corpus", SdkRegistry("operations-corpus"))
    registry.install(_manifest())
    await phase2_users.async_close()
    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()

    assert registry.resolve("acme/pump") is None
    assert registry.list_packs() == []
    registry.clear()
    assert registry.resource_ledger() == {"packs": 0, "contributions": 0}
