"""Configured controls: the caller names a control, the server names everything else.

The legacy route accepted a domain, a service, an entity and a service-data
blob from the browser, then called Home Assistant with them. That is a remote
code path into a building's plant. It is replaced entirely.

Here a request may carry only a control identifier, the revision and digest it
believes it is acting on, and the bounded input the control's own schema
declares. The domain, the service, the target and every immutable field are
reconstructed from the verified current project head. Everything else — unknown
keys, templates, nested calls, target overrides, oversized or over-deep input,
unsafe service pairs, and closed maintenance or simulation gates — is refused
before Home Assistant is asked to do anything at all.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from copy import deepcopy
from dataclasses import dataclass
import json
import time
from typing import Any

from .const import SAFE_SERVICE_DOMAINS


@dataclass(frozen=True)
class ControlBounds:
    """Resolved A1. These are release gates, not tuning knobs."""

    max_request_bytes: int = 4 * 1024
    max_depth: int = 4
    max_nodes: int = 64
    max_keys: int = 16
    max_string: int = 512
    max_array: int = 32
    preview_per_minute: int = 30
    execute_per_minute: int = 10
    execute_burst: int = 3


BOUNDS = ControlBounds()

#: Keys that must never appear in caller input. Each one is resolved from the
#: verified project head instead, so accepting one would hand the caller the
#: authority this module exists to keep.
FORBIDDEN_INPUT_KEYS = frozenset({
    "domain",
    "service",
    "entity_id",
    "device_id",
    "area_id",
    "target",
    "service_data",
    "context",
    "user_id",
    "actor",
    "at",
    "result",
})

#: Substrings that indicate a Home Assistant template. A control takes values,
#: never expressions: an expression is evaluated with the Companion's authority.
TEMPLATE_MARKERS = ("{{", "}}", "{%", "%}")


class ControlRejected(Exception):
    """A control request was refused before any service attempt."""

    def __init__(self, reason: str, detail: Mapping[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = dict(detail or {})


@dataclass(frozen=True)
class ResolvedControl:
    """Exactly what the server will ask Home Assistant to do."""

    control_id: str
    domain: str
    service: str
    target: dict[str, Any]
    service_data: dict[str, Any]
    readback: dict[str, Any]
    label: str


def _walk(value: Any, depth: int = 1) -> tuple[int, int]:
    """Return (nodes, max depth) for one input document."""
    if isinstance(value, Mapping):
        nodes, deepest = 1, depth
        for item in value.values():
            child_nodes, child_depth = _walk(item, depth + 1)
            nodes += child_nodes
            deepest = max(deepest, child_depth)
        return nodes, deepest
    if isinstance(value, list):
        nodes, deepest = 1, depth
        for item in value:
            child_nodes, child_depth = _walk(item, depth + 1)
            nodes += child_nodes
            deepest = max(deepest, child_depth)
        return nodes, deepest
    return 1, depth


def _reject_templates(value: Any) -> None:
    if isinstance(value, str):
        for marker in TEMPLATE_MARKERS:
            if marker in value:
                raise ControlRejected("template_not_allowed")
        return
    if isinstance(value, Mapping):
        for item in value.values():
            _reject_templates(item)
        return
    if isinstance(value, list):
        for item in value:
            _reject_templates(item)


def normalize_input(control: Mapping[str, Any], payload: Any) -> dict[str, Any]:
    """Validate caller input against the control's own declared schema.

    The bounds are checked before the schema so an oversized or deeply nested
    document is refused without walking all of it.
    """
    if not isinstance(payload, Mapping):
        raise ControlRejected("input_must_be_an_object")

    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    if len(encoded) > BOUNDS.max_request_bytes:
        raise ControlRejected("input_too_large")

    nodes, depth = _walk(payload)
    if depth > BOUNDS.max_depth:
        raise ControlRejected("input_too_deep")
    if nodes > BOUNDS.max_nodes:
        raise ControlRejected("input_has_too_many_nodes")
    if len(payload) > BOUNDS.max_keys:
        raise ControlRejected("input_has_too_many_keys")

    forbidden = FORBIDDEN_INPUT_KEYS & set(payload)
    if forbidden:
        raise ControlRejected("input_names_a_server_owned_field",
                              {"fields": sorted(forbidden)})
    _reject_templates(payload)

    schema = control.get("input_schema") or {}
    declared = set(schema.get("properties", {}))
    unknown = set(payload) - declared
    if unknown:
        raise ControlRejected("input_has_unknown_keys", {"fields": sorted(unknown)})

    normalized: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str) and len(value) > BOUNDS.max_string:
            raise ControlRejected("input_string_too_long", {"field": key})
        if isinstance(value, list) and len(value) > BOUNDS.max_array:
            raise ControlRejected("input_array_too_long", {"field": key})
        if isinstance(value, Mapping):
            raise ControlRejected("input_value_must_be_scalar", {"field": key})
        normalized[key] = value
    return normalized


def resolve_control(
    head: Mapping[str, Any], control_id: str, payload: Any
) -> ResolvedControl:
    """Resolve one control's whole effect from the verified current head.

    Nothing in `payload` reaches the returned domain, service or target: those
    come from the stored definition alone.
    """
    controls = head.get("controls")
    if not isinstance(controls, list):
        raise ControlRejected("project_defines_no_controls")

    definition = next(
        (entry for entry in controls
         if isinstance(entry, Mapping) and entry.get("id") == control_id),
        None,
    )
    if definition is None:
        raise ControlRejected("unknown_control")

    gates = definition.get("gates") or {}
    if gates.get("maintenance") or gates.get("simulation"):
        raise ControlRejected("control_gate_closed")

    domain = str(definition.get("domain") or "")
    service = str(definition.get("service") or "")
    if not domain or not service:
        raise ControlRejected("control_definition_incomplete")
    if domain not in SAFE_SERVICE_DOMAINS:
        raise ControlRejected("unsafe_service_domain", {"domain": domain})

    target = dict(definition.get("target") or {})
    if not target:
        raise ControlRejected("control_definition_incomplete")

    immutable = dict(definition.get("data") or {})
    for owned in ("entity_id", "device_id", "area_id"):
        if owned in immutable:
            # Immutable data must not smuggle a target past the target field.
            raise ControlRejected("control_data_names_a_target")

    normalized_input = normalize_input(definition, payload)
    return ResolvedControl(
        control_id=control_id,
        domain=domain,
        service=service,
        target=target,
        service_data={**immutable, **normalized_input},
        readback=dict(definition.get("readback") or {}),
        label=str(definition.get("label") or control_id),
    )


class ControlRateLimiter:
    """Separate preview and execute budgets, per user and project."""

    def __init__(self, *, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._buckets: dict[tuple[str, str, str], list[float]] = {}

    def check(self, *, kind: str, user_id: str, project_id: str) -> None:
        """Consume one unit of the named budget, or raise."""
        limit = (
            BOUNDS.preview_per_minute if kind == "preview" else BOUNDS.execute_per_minute
        )
        now = self._clock()
        bucket = self._buckets.setdefault((kind, user_id, project_id), [])
        bucket[:] = [stamp for stamp in bucket if now - stamp < 60]
        if len(bucket) >= limit:
            raise ControlRejected("rate_limited")
        if kind == "execute":
            recent = [stamp for stamp in bucket if now - stamp < 1]
            if len(recent) >= BOUNDS.execute_burst:
                raise ControlRejected("rate_limited")
        bucket.append(now)

    def active_count(self) -> int:
        """Return how many rate buckets are currently held."""
        return len(self._buckets)

    def clear(self) -> None:
        """Drop every bucket, as an unload must."""
        self._buckets.clear()


def preview_payload(resolved: ResolvedControl) -> dict[str, Any]:
    """Return a bounded, read-only summary safe to show in a confirmation.

    It describes what will happen. It is not authority: execute re-resolves
    everything from the head again rather than trusting anything echoed here.
    """
    return {
        "control_id": resolved.control_id,
        "label": resolved.label,
        "summary": f"{resolved.domain}.{resolved.service}",
        "target": deepcopy(resolved.target),
        "input": deepcopy(resolved.service_data),
    }


def configured_controls(hass: Any) -> ControlRateLimiter | None:
    """Return the loaded runtime's control rate limiter, or None."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "control_rates", None) if runtime is not None else None
