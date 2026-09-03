"""Registry-derived datapoint provenance and communication health (T3-04, T3-06).

Provenance answers two questions an operator must be able to ask of any value:
where does this come from, and is it actually live. Both answers come from Home
Assistant's own registries. Neither is ever inferred from an entity id or a
friendly name, because a name is a label somebody typed, not evidence.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant

from .registry_factory import UNKNOWN_INTEGRATION, RegistryFactory

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase3-provenance]: "
    "registry-derived provenance and communication health are unavailable"
)
EFFECT_PREFIX = "PHASE3_PROVENANCE_EFFECTS "

#: Every health value the card may report. `unknown` is a value, not a gap.
HEALTH_VALUES = ("live", "stale", "unavailable", "disabled", "unknown")

#: Fields a provenance record must state a source for. A row with no source is
#: an assertion nobody can check.
SOURCED_FIELDS = ("integration", "config_entry", "device", "area", "health")


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps({"service_attempts": 0, "network": 0, **extra}, sort_keys=True))


def test_health_values_distinguish_unknown_from_unavailable() -> None:
    """An entity nobody can find and an entity reporting unavailable differ."""
    assert "unknown" in HEALTH_VALUES
    assert "unavailable" in HEALTH_VALUES
    assert "live" in HEALTH_VALUES


def test_every_provenance_field_must_carry_a_source() -> None:
    """The contract names the fields, so a sourceless row is a test failure."""
    assert "integration" in SOURCED_FIELDS
    assert "health" in SOURCED_FIELDS


async def provenance_gaps(hass: HomeAssistant) -> list[str]:
    """Return every unmet provenance guarantee."""
    module = load("provenance")
    if module is None:
        return [
            "custom_components.glt_flow_card.provenance does not exist, so a "
            "datapoint cannot say where its value comes from"
        ]

    gaps: list[str] = []
    for name in ("ProvenanceService", "KNOWN_INTEGRATIONS", "HEALTH_VALUES"):
        if not hasattr(module, name):
            gaps.append(f"provenance.{name} is missing")
    if gaps:
        return gaps

    if tuple(module.HEALTH_VALUES) != HEALTH_VALUES:
        gaps.append(f"health values are {tuple(module.HEALTH_VALUES)}, expected {HEALTH_VALUES}")

    factory = RegistryFactory(hass)
    cases = factory.seed_provenance_matrix()
    service = module.ProvenanceService(hass)

    core = await service.async_describe(cases["core_integration"].entity_id)
    if core.get("integration", {}).get("domain") != "modbus":
        gaps.append("a modbus entity did not report modbus as its integration")
    if core.get("health", {}).get("value") != "live":
        gaps.append(f"a fresh registered entity is not live, got {core.get('health')}")
    for field in SOURCED_FIELDS:
        section = core.get(field)
        if not isinstance(section, dict) or not section.get("source"):
            gaps.append(f"provenance field {field} carries no source")
    if not core.get("device", {}).get("manufacturer"):
        gaps.append("a device-backed entity reported no manufacturer")

    # The two traps: an implementation that reads the protocol out of the name
    # gets both of these backwards.
    misleading = await service.async_describe(cases["modbus_named_knx"].entity_id)
    if misleading.get("integration", {}).get("domain") != "modbus":
        gaps.append("an entity named knx but owned by modbus reported the name, not the registry")
    other = await service.async_describe(cases["knx_named_modbus"].entity_id)
    if other.get("integration", {}).get("domain") != "knx":
        gaps.append("an entity named modbus but owned by knx reported the name, not the registry")

    unknown = await service.async_describe(cases["unknown_integration"].entity_id)
    if unknown.get("integration", {}).get("domain") != UNKNOWN_INTEGRATION:
        gaps.append("an unfamiliar integration was not reported as its own domain")
    if unknown.get("integration", {}).get("known") is not False:
        gaps.append("an unfamiliar integration was not marked unknown to the card")

    unregistered = await service.async_describe(cases["unregistered"].entity_id)
    if unregistered.get("integration", {}).get("domain") is not None:
        gaps.append("an entity absent from the registry claimed an integration")

    absent = await service.async_describe(cases["absent"].entity_id)
    if absent.get("health", {}).get("value") != "unknown":
        gaps.append(f"an entity that does not exist is not unknown, got {absent.get('health')}")

    unavailable = await service.async_describe(cases["unavailable"].entity_id)
    if unavailable.get("health", {}).get("value") != "unavailable":
        gaps.append(f"an unavailable entity is not unavailable, got {unavailable.get('health')}")

    disabled = await service.async_describe(cases["disabled_by_user"].entity_id)
    if disabled.get("health", {}).get("value") != "disabled":
        gaps.append(f"a disabled entity is not disabled, got {disabled.get('health')}")

    # Freshness is decided against a carried budget, never against a clock the
    # service reads for itself, so the test can state the age exactly.
    stale = await service.async_describe(
        cases["core_integration"].entity_id, freshness_seconds=60, age_seconds=600,
    )
    if stale.get("health", {}).get("value") != "stale":
        gaps.append(f"a value older than its budget is not stale, got {stale.get('health')}")

    return gaps


async def test_expected_red_phase3_provenance(hass: HomeAssistant) -> None:
    """Provenance is read from the registries, and health tells the truth."""
    emit_effects(cases=10)
    gaps = await provenance_gaps(hass)
    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  provenance gap: {gap}")
    assert not gaps, "registry-derived provenance and communication health are unavailable"
