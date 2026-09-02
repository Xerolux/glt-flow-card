"""Declared bounds and evidence states for configured controls.

Resolved A1 fixes these numbers as release gates rather than tuning knobs, so
they live in one place that both the control tests and the evidence tests read.
"""
from __future__ import annotations

# -- Resolved A1: configured-control request bounds -------------------------
MAX_REQUEST_BYTES = 4 * 1024
MAX_INPUT_DEPTH = 4
MAX_INPUT_NODES = 64
MAX_INPUT_KEYS = 16
MAX_STRING_LENGTH = 512
MAX_ARRAY_LENGTH = 32

#: Preview is cheap and idempotent; execute is neither.
PREVIEW_RATE_PER_MINUTE = 30
EXECUTE_RATE_PER_MINUTE = 10
EXECUTE_BURST = 3

# -- Resolved A1: evidence bounds -------------------------------------------
MAX_TRUSTED_EVENT_BYTES = 8 * 1024
MAX_TRUSTED_STORE_BYTES = 32 * 1024 * 1024
MAX_TELEMETRY_EVENT_BYTES = 4 * 1024
TELEMETRY_RATE_PER_MINUTE = 30
TELEMETRY_BURST = 10
MAX_TELEMETRY_ROWS = 1000
MAX_TELEMETRY_BYTES = 4 * 1024 * 1024

#: Every distinct control lifecycle state. `succeeded` is deliberately absent:
#: a dispatch that has not been read back is not a success.
CONTROL_EVIDENCE_STATES = (
    "accepted",
    "dispatched",
    "readback_confirmed",
    "timed_out",
    "denied",
    "failed_before_dispatch",
    "failed_after_dispatch",
    "result_unknown",
    "cancelled_before_dispatch",
)

#: States that mean a physical action may have happened. None of them may ever
#: trigger an automatic repeat.
POST_DISPATCH_STATES = frozenset({
    "dispatched",
    "readback_confirmed",
    "timed_out",
    "failed_after_dispatch",
    "result_unknown",
})

#: The only request fields a browser may send for a configured control.
ALLOWED_REQUEST_FIELDS = frozenset({
    "type",
    "id",
    "project_id",
    "control_id",
    "expected_revision",
    "expected_digest",
    "input",
    "correlation_id",
})

#: Fields a caller must never be able to influence. Each one is resolved from
#: the verified current project head instead.
FORBIDDEN_REQUEST_FIELDS = frozenset({
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

#: Service-data shapes that must be rejected before any dispatch.
MALICIOUS_INPUTS: tuple[tuple[str, object], ...] = (
    ("unknown key", {"unexpected": 1}),
    ("template string", {"value": "{{ states('sensor.secret') }}"}),
    ("nested service call", {"value": {"service": "homeassistant.stop"}}),
    ("target override", {"entity_id": "switch.other"}),
    ("area override", {"area_id": "everything"}),
    ("oversized string", {"value": "x" * (MAX_STRING_LENGTH + 1)}),
    ("oversized array", {"value": list(range(MAX_ARRAY_LENGTH + 1))}),
    ("too deep", {"a": {"b": {"c": {"d": {"e": 1}}}}}),
    ("too many keys", {f"k{index}": index for index in range(MAX_INPUT_KEYS + 1)}),
    ("non-object input", ["not", "an", "object"]),
)

#: A control definition as it appears in a verified project head. Everything the
#: server needs is here; nothing is taken from the request.
SAMPLE_CONTROL = {
    "id": "pump-1-start",
    "label": "Start pump 1",
    "domain": "switch",
    "service": "turn_on",
    "target": {"entity_id": "switch.pump_1"},
    "data": {"transition": 0},
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {"reason": {"type": "string", "maxLength": 120}},
    },
    "gates": {"simulation": False, "maintenance": False},
    "readback": {"entity_id": "switch.pump_1", "expect_state": "on", "timeout_seconds": 10},
}
