"""Trusted evidence versus untrusted telemetry (T2-09).

These are two different things that happen to look alike. Trusted evidence is
authored by server workflows with server actor, server time and a server
result. Telemetry is authored by a browser, is permanently labelled untrusted,
lives in a separate store with its own bounds and cursors, and can never be
relabelled, merged into, or exported alongside trusted history.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant

from .control_contract import (
    MAX_TELEMETRY_BYTES,
    MAX_TELEMETRY_EVENT_BYTES,
    MAX_TELEMETRY_ROWS,
    MAX_TRUSTED_EVENT_BYTES,
    MAX_TRUSTED_STORE_BYTES,
    TELEMETRY_BURST,
    TELEMETRY_RATE_PER_MINUTE,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

#: Fields only the server may set on a trusted event.
SERVER_OWNED_FIELDS = ("id", "at", "user_id", "action", "result", "correlation_id")

#: A telemetry payload that tries to look like trusted history in every way a
#: client could attempt.
FORGED_TELEMETRY: dict[str, Any] = {
    "trusted": True,
    "user_id": "someone-else",
    "at": "1999-01-01T00:00:00+00:00",
    "action": "control.execute",
    "result": "readback_confirmed",
    "correlation_id": "forged-correlation",
    "kind": "security",
}


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def test_trusted_and_telemetry_bounds_are_distinct_and_declared() -> None:
    """Two stores, two sets of limits; neither inherits the other's."""
    assert MAX_TRUSTED_EVENT_BYTES == 8 * 1024
    assert MAX_TRUSTED_STORE_BYTES == 32 * 1024 * 1024
    assert MAX_TELEMETRY_EVENT_BYTES == 4 * 1024
    assert (TELEMETRY_RATE_PER_MINUTE, TELEMETRY_BURST) == (30, 10)
    assert (MAX_TELEMETRY_ROWS, MAX_TELEMETRY_BYTES) == (1000, 4 * 1024 * 1024)
    assert MAX_TELEMETRY_EVENT_BYTES < MAX_TRUSTED_EVENT_BYTES


def test_forged_telemetry_fixture_attempts_every_impersonation() -> None:
    """The fixture must actually try to forge each server-owned field."""
    for field in SERVER_OWNED_FIELDS:
        if field == "id":
            continue
        assert field in FORGED_TELEMETRY, field
    assert FORGED_TELEMETRY["trusted"] is True


def test_legacy_client_authored_audit_is_retired() -> None:
    """`audit/add` let a browser write history; the contract retires it."""
    from .policy_contract import COMMAND_POLICY_CONTRACT

    audit_add = next(
        policy for policy in COMMAND_POLICY_CONTRACT
        if policy.route == "glt_flow_card/audit/add"
    )
    assert audit_add.state == "retired"
    assert audit_add.capability is None


async def trusted_evidence_gaps(hass: HomeAssistant) -> list[str]:
    """Return every unmet trusted/untrusted separation guarantee."""
    evidence = load("trusted_evidence")
    if evidence is None:
        return [
            "custom_components.glt_flow_card.trusted_evidence does not exist, so "
            "trusted history and browser telemetry are not separated"
        ]

    gaps: list[str] = []
    for name in ("TrustedEvidenceStore", "TelemetryStore", "TelemetryRejected"):
        if not hasattr(evidence, name):
            gaps.append(f"trusted_evidence.{name} is missing")
    if gaps:
        return gaps

    if evidence.TrustedEvidenceStore is evidence.TelemetryStore:
        gaps.append("trusted evidence and telemetry share one store")

    telemetry = evidence.TelemetryStore(hass)
    stored = await telemetry.async_add(
        user_id="real-user", session_id="s1", payload=dict(FORGED_TELEMETRY)
    )
    if stored.get("trusted") is not False:
        gaps.append("a telemetry row is not permanently labelled untrusted")
    for field in ("user_id", "at"):
        if stored.get(field) == FORGED_TELEMETRY.get(field):
            gaps.append(f"telemetry kept the client-supplied {field}")
    if stored.get("result") == FORGED_TELEMETRY["result"]:
        gaps.append("telemetry kept a client-supplied control result")

    trusted = evidence.TrustedEvidenceStore(hass)
    if hasattr(trusted, "async_add_from_client"):
        gaps.append("the trusted store exposes a client-authored write path")

    bounds = getattr(evidence, "BOUNDS", None)
    if bounds is None:
        gaps.append("trusted_evidence.BOUNDS is missing")
    else:
        for field, expected in (
            ("max_trusted_event_bytes", MAX_TRUSTED_EVENT_BYTES),
            ("max_trusted_store_bytes", MAX_TRUSTED_STORE_BYTES),
            ("max_telemetry_event_bytes", MAX_TELEMETRY_EVENT_BYTES),
            ("telemetry_per_minute", TELEMETRY_RATE_PER_MINUTE),
            ("telemetry_burst", TELEMETRY_BURST),
            ("max_telemetry_rows", MAX_TELEMETRY_ROWS),
            ("max_telemetry_bytes", MAX_TELEMETRY_BYTES),
        ):
            if getattr(bounds, field, None) != expected:
                gaps.append(
                    f"bound {field} is {getattr(bounds, field, None)!r}, expected {expected}"
                )
    return gaps
