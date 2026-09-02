"""Configured-control normalization and bounds (T2-06, T2-07).

A browser names a control, never a service. The Companion resolves the exact
domain, service, target and immutable data from the verified current project
head, and every malformed, oversized, templated, overriding, gated,
unauthorized or rate-limited request is rejected before any Home Assistant
service call is attempted.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects
from .control_contract import (
    ALLOWED_REQUEST_FIELDS,
    EXECUTE_BURST,
    EXECUTE_RATE_PER_MINUTE,
    FORBIDDEN_REQUEST_FIELDS,
    MALICIOUS_INPUTS,
    MAX_ARRAY_LENGTH,
    MAX_INPUT_DEPTH,
    MAX_INPUT_KEYS,
    MAX_INPUT_NODES,
    MAX_REQUEST_BYTES,
    MAX_STRING_LENGTH,
    PREVIEW_RATE_PER_MINUTE,
    SAMPLE_CONTROL,
)
from .policy_contract import ROLE_CAPABILITIES

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase2-configured-controls]: "
    "authoritative configured controls are unavailable"
)
EFFECT_PREFIX = "PHASE2_CONTROL_EFFECTS "

PROJECT_ID = "control-plant"


def emit_effects(
    effects: LifecycleEffects, controlled: Any = None, **extra: Any
) -> None:
    """Print the zero-call ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        "blocked_service_attempts": snapshot["service_attempts"],
        "controlled_service_calls": len(controlled.calls) if controlled else 0,
        "control_waits": snapshot["control_waits"],
        "rate_buckets": snapshot["rate_buckets"],
        **extra,
    }, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def project_with_control() -> dict[str, Any]:
    """A verified project head that defines exactly one configured control."""
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 2,
        "project": {"id": PROJECT_ID, "name": "Control Plant", "revision": 1},
        "views": [{"id": "plant", "name": "Plant", "kind": "image"}],
        "equipment": [{"id": "pump-1", "name": "Pump 1", "type": "pump"}],
        "paths": [],
        "datapoints": [],
        "controls": [dict(SAMPLE_CONTROL)],
    }


# --------------------------------------------------------------------------
# Contract guarantees that hold before and after implementation.
# --------------------------------------------------------------------------


def test_request_fields_cannot_name_a_service_or_a_target() -> None:
    """The caller chooses a control; the server chooses everything else."""
    assert ALLOWED_REQUEST_FIELDS.isdisjoint(FORBIDDEN_REQUEST_FIELDS)
    for field in ("domain", "service", "entity_id", "target", "service_data"):
        assert field in FORBIDDEN_REQUEST_FIELDS
        assert field not in ALLOWED_REQUEST_FIELDS


def test_declared_bounds_match_resolved_a1() -> None:
    """The bounds are release gates, so they are asserted, not assumed."""
    assert MAX_REQUEST_BYTES == 4096
    assert (MAX_INPUT_DEPTH, MAX_INPUT_NODES, MAX_INPUT_KEYS) == (4, 64, 16)
    assert (MAX_STRING_LENGTH, MAX_ARRAY_LENGTH) == (512, 32)
    assert (PREVIEW_RATE_PER_MINUTE, EXECUTE_RATE_PER_MINUTE, EXECUTE_BURST) == (30, 10, 3)


def test_operator_executes_controls_without_an_engineering_lease() -> None:
    """Resolved A4: operating a plant is not engineering it."""
    operator = ROLE_CAPABILITIES["operator"]
    assert "control.execute" in operator
    assert "lease.engineering" not in operator
    assert "project.write" not in operator


def test_every_malicious_input_case_is_actually_malicious() -> None:
    """The rejection table must not contain a payload that is really valid."""
    names = [name for name, _ in MALICIOUS_INPUTS]
    assert len(names) == len(set(names))
    assert len(MALICIOUS_INPUTS) >= 10
    for name, payload in MALICIOUS_INPUTS:
        if isinstance(payload, dict):
            allowed = set(SAMPLE_CONTROL["input_schema"]["properties"])
            assert set(payload) - allowed or name in {
                "oversized string", "oversized array", "too deep", "too many keys",
            }, name


def test_sample_control_resolves_its_whole_effect_from_the_head() -> None:
    """A control definition is self-contained; a request adds only input."""
    for field in ("domain", "service", "target", "data", "gates", "readback"):
        assert field in SAMPLE_CONTROL
    assert "entity_id" not in SAMPLE_CONTROL["data"], (
        "immutable data must never smuggle a target"
    )


async def test_no_controlled_service_call_happens_without_an_explicit_allow(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    controlled_service,
) -> None:
    """The default posture of the control tests is zero service calls."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    with pytest.raises(AssertionError):
        await hass.services.async_call("switch", "turn_on", {}, blocking=True)
    assert controlled_service.calls == []
    emit_effects(lifecycle_effects, controlled_service, rejections=len(MALICIOUS_INPUTS))


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def control_gaps(hass: HomeAssistant, controlled_service: Any) -> list[str]:
    """Return every unmet configured-control guarantee."""
    controls = load("configured_controls")
    if controls is None:
        return ["custom_components.glt_flow_card.configured_controls does not exist"]

    gaps: list[str] = []
    for name in ("resolve_control", "normalize_input", "ControlRejected", "BOUNDS"):
        if not hasattr(controls, name):
            gaps.append(f"configured_controls.{name} is missing")
    if gaps:
        return gaps

    bounds = controls.BOUNDS
    for field, expected in (
        ("max_request_bytes", MAX_REQUEST_BYTES),
        ("max_depth", MAX_INPUT_DEPTH),
        ("max_nodes", MAX_INPUT_NODES),
        ("max_keys", MAX_INPUT_KEYS),
        ("max_string", MAX_STRING_LENGTH),
        ("max_array", MAX_ARRAY_LENGTH),
        ("preview_per_minute", PREVIEW_RATE_PER_MINUTE),
        ("execute_per_minute", EXECUTE_RATE_PER_MINUTE),
        ("execute_burst", EXECUTE_BURST),
    ):
        if getattr(bounds, field, None) != expected:
            gaps.append(f"bound {field} is {getattr(bounds, field, None)!r}, expected {expected}")

    head = project_with_control()
    try:
        resolved = controls.resolve_control(head, "pump-1-start", {"reason": "test"})
    except Exception as error:  # noqa: BLE001 - any failure here is a gap
        gaps.append(f"resolving a valid control raised {error!r}")
        return gaps

    if resolved.domain != "switch" or resolved.service != "turn_on":
        gaps.append("the resolved service does not come from the project head")
    if resolved.target != {"entity_id": "switch.pump_1"}:
        gaps.append("the resolved target does not come from the project head")
    if "entity_id" in resolved.service_data:
        gaps.append("the resolved service data smuggled a target")

    if controls.resolve_control.__doc__ is None:
        gaps.append("resolve_control is undocumented")

    for name, payload in MALICIOUS_INPUTS:
        try:
            controls.normalize_input(SAMPLE_CONTROL, payload)
            gaps.append(f"a malicious input was accepted: {name}")
        except controls.ControlRejected:
            pass
        except Exception as error:  # noqa: BLE001
            gaps.append(f"{name} raised {type(error).__name__} instead of ControlRejected")

    try:
        controls.resolve_control(head, "not-a-control", {})
        gaps.append("an unknown control id resolved successfully")
    except controls.ControlRejected:
        pass

    if controlled_service.calls:
        gaps.append(
            f"resolution and rejection caused {len(controlled_service.calls)} service calls"
        )
    return gaps


async def test_expected_red_phase2_configured_controls(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    controlled_service,
) -> None:
    """Controls resolve from the head and reject everything else with no call."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, controlled_service, rejections=len(MALICIOUS_INPUTS))

    gaps = await control_gaps(hass, controlled_service)
    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  control gap: {gap}")
    assert not gaps, "authoritative configured controls are unavailable"
