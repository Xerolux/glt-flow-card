"""Trusted evidence and untrusted telemetry — two stores that must never merge.

Trusted evidence is authored by server workflows. The server assigns the actor,
the time, the result and the correlation identifier; a caller contributes only
the fact that something happened. Telemetry is authored by a browser. It is
useful, it is bounded, and it is permanently labelled untrusted, because nothing
about it can be verified.

They live in different stores with different schemas, different bounds and
different read paths. That separation is the whole security property: if a
browser could write into the trusted stream, or if one export could interleave
them, the audit trail would only be as trustworthy as its least trustworthy row.
"""
from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import secrets
import time
from collections.abc import Callable
from typing import Any

from homeassistant.helpers.storage import Store

from .const import (
    TELEMETRY_STORE_KEY,
    TELEMETRY_STORE_VERSION,
    TRUSTED_EVIDENCE_STORE_KEY,
    TRUSTED_EVIDENCE_STORE_VERSION,
)


@dataclass(frozen=True)
class EvidenceBounds:
    """Resolved A1. Changing any of these needs measurements, not an edit."""

    max_trusted_event_bytes: int = 8 * 1024
    max_trusted_store_bytes: int = 32 * 1024 * 1024
    max_telemetry_event_bytes: int = 4 * 1024
    telemetry_per_minute: int = 30
    telemetry_burst: int = 10
    max_telemetry_rows: int = 1000
    max_telemetry_bytes: int = 4 * 1024 * 1024


BOUNDS = EvidenceBounds()

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

#: Points at which a test may inject a failure. The ones before dispatch must
#: leave the plant untouched; the ones after it must leave the evidence honest.
FAILURE_BARRIERS = (
    "before_accepted_append",
    "after_accepted_append",
    "before_dispatch",
    "during_dispatch",
    "after_dispatch",
    "before_readback",
    "after_readback",
    "after_evidence_append",
)


class TelemetryRejected(Exception):
    """A telemetry row exceeded its bounds or tried to claim trust."""


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize(value: Any, depth: int = 0) -> Any:
    """Strip control characters and cap nesting on any stored detail.

    Carriage returns and newlines are removed because an audit line that can
    contain them can forge a second audit line.
    """
    if depth > 4:
        return None
    if isinstance(value, str):
        return value.replace("\r", " ").replace("\n", " ")[:512]
    if isinstance(value, Mapping):
        return {
            str(key)[:64]: _sanitize(item, depth + 1)
            for key, item in list(value.items())[:16]
        }
    if isinstance(value, list):
        return [_sanitize(item, depth + 1) for item in value[:32]]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:512]


def _size(document: Any) -> int:
    return len(json.dumps(document, sort_keys=True, ensure_ascii=False).encode("utf-8"))


class TrustedEvidenceStore:
    """Append-only server-authored evidence. There is no client write path."""

    def __init__(self, hass: Any, *, max_rows: int = 5000, clock: Callable[[], float] = time.monotonic) -> None:
        self._store: Store[dict[str, Any]] = Store(
            hass, TRUSTED_EVIDENCE_STORE_VERSION, TRUSTED_EVIDENCE_STORE_KEY
        )
        self._events: list[dict[str, Any]] = []
        self._max_rows = max_rows
        self._clock = clock
        self._sequence = 0

    async def async_initialize(self) -> None:
        """Load persisted evidence, tolerating an absent or invalid store."""
        loaded = await self._store.async_load()
        events = loaded.get("events") if isinstance(loaded, Mapping) else None
        self._events = list(events) if isinstance(events, list) else []
        self._sequence = len(self._events)

    async def async_record(
        self,
        *,
        action: str,
        project_id: str,
        actor_user_id: str,
        result: str,
        correlation_id: str | None = None,
        target: Mapping[str, Any] | None = None,
        detail: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create one trusted event. Every authoritative field comes from here."""
        self._sequence += 1
        event = {
            "id": f"evidence:{self._sequence}:{secrets.token_urlsafe(8)}",
            "at": _utc(),
            "trusted": True,
            "action": str(action),
            "project_id": str(project_id),
            "user_id": str(actor_user_id),
            "result": str(result),
            "correlation_id": correlation_id,
            "target": _sanitize(dict(target or {})),
            "detail": _sanitize(dict(detail or {})),
        }
        if _size(event) > BOUNDS.max_trusted_event_bytes:
            event["detail"] = {"truncated": True}
        self._events.insert(0, event)
        self._prune()
        await self._store.async_save({"events": deepcopy(self._events)})
        return deepcopy(event)

    def _prune(self) -> None:
        """Keep the newest events within both the row and byte budgets."""
        del self._events[self._max_rows :]
        while self._events and _size(self._events) > BOUNDS.max_trusted_store_bytes:
            self._events.pop()

    def rows(self, project_ids: set[str]) -> list[dict[str, Any]]:
        """Return evidence for the named projects only, newest first.

        Filtering happens here, at the source, so an unauthorized project can
        never influence a page, a count or a cursor offset.
        """
        return [
            deepcopy(event)
            for event in self._events
            if event["project_id"] in project_ids
        ]

    def __len__(self) -> int:
        return len(self._events)


class TelemetryStore:
    """Bounded, rate-limited, permanently untrusted browser telemetry."""

    def __init__(self, hass: Any, *, clock: Callable[[], float] = time.monotonic) -> None:
        self._store: Store[dict[str, Any]] = Store(
            hass, TELEMETRY_STORE_VERSION, TELEMETRY_STORE_KEY
        )
        self._rows: list[dict[str, Any]] = []
        self._buckets: dict[str, list[float]] = {}
        self._clock = clock

    async def async_initialize(self) -> None:
        """Load persisted telemetry, tolerating an absent or invalid store."""
        loaded = await self._store.async_load()
        rows = loaded.get("rows") if isinstance(loaded, Mapping) else None
        self._rows = list(rows) if isinstance(rows, list) else []

    def _rate_check(self, user_id: str) -> None:
        now = self._clock()
        bucket = self._buckets.setdefault(user_id, [])
        bucket[:] = [stamp for stamp in bucket if now - stamp < 60]
        if len(bucket) >= BOUNDS.telemetry_per_minute:
            raise TelemetryRejected("rate_limited")
        recent = [stamp for stamp in bucket if now - stamp < 1]
        if len(recent) >= BOUNDS.telemetry_burst:
            raise TelemetryRejected("rate_limited")
        bucket.append(now)

    async def async_add(
        self, *, user_id: str, session_id: str, payload: Mapping[str, Any]
    ) -> dict[str, Any]:
        """Store one telemetry row with server-assigned provenance.

        Whatever the payload claims about who acted, when, or with what result
        is discarded. The row keeps only what the server itself observed.
        """
        self._rate_check(user_id)
        if _size(dict(payload)) > BOUNDS.max_telemetry_event_bytes:
            raise TelemetryRejected("invalid_input")

        row = {
            "id": f"telemetry:{secrets.token_urlsafe(8)}",
            # Server metadata replaces every claim the payload might have made.
            "trusted": False,
            "at": _utc(),
            "user_id": str(user_id),
            "session_id": str(session_id),
            "payload": _sanitize({
                key: value
                for key, value in dict(payload).items()
                if key not in {"trusted", "user_id", "at", "action", "result",
                               "correlation_id", "kind"}
            }),
        }
        self._rows.insert(0, row)
        self._prune()
        await self._store.async_save({"rows": deepcopy(self._rows)})
        return deepcopy(row)

    def _prune(self) -> None:
        del self._rows[BOUNDS.max_telemetry_rows :]
        while self._rows and _size(self._rows) > BOUNDS.max_telemetry_bytes:
            self._rows.pop()

    def rows(self, user_id: str) -> list[dict[str, Any]]:
        """Return one user's telemetry, newest first."""
        return [deepcopy(row) for row in self._rows if row["user_id"] == user_id]

    def __len__(self) -> int:
        return len(self._rows)


class ControlEvidenceRecorder:
    """Record the lifecycle of one configured-control request.

    There is deliberately no retry entry point. A control that may already have
    moved a physical thing is repaired forward by a person deciding to act
    again, never by code deciding for them.
    """

    def __init__(self, hass: Any, *, evidence: TrustedEvidenceStore | None = None) -> None:
        self._hass = hass
        # `is not None`, never `or`: this class defines __len__, so an empty
        # store is falsy and `or` would silently create a second one.
        self._evidence = evidence if evidence is not None else TrustedEvidenceStore(hass)
        self._barriers: set[str] = set()

    def supports_barrier(self, barrier: str) -> bool:
        """Return whether a failure can be injected at this exact point."""
        return barrier in FAILURE_BARRIERS

    def inject_failure(self, barrier: str) -> None:
        """Arm a failure at one named barrier, for fault-injection tests."""
        if barrier not in FAILURE_BARRIERS:
            raise ValueError(f"{barrier!r} is not an injectable barrier")
        self._barriers.add(barrier)

    def _barrier(self, name: str) -> None:
        if name in self._barriers:
            self._barriers.discard(name)
            raise RuntimeError(f"injected failure at {name}")

    async def async_accept(
        self,
        *,
        project_id: str,
        actor_user_id: str,
        control_id: str,
        correlation_id: str,
        target: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Record `accepted` durably *before* anything is dispatched.

        If this write fails, nothing has been dispatched and nothing needs
        repair. That ordering is what makes the evidence trustworthy.
        """
        self._barrier("before_accepted_append")
        event = await self._evidence.async_record(
            action="control.execute",
            project_id=project_id,
            actor_user_id=actor_user_id,
            result="accepted",
            correlation_id=correlation_id,
            target=target,
            detail={"control_id": control_id},
        )
        self._barrier("after_accepted_append")
        return event

    async def async_record_state(
        self,
        *,
        project_id: str,
        actor_user_id: str,
        correlation_id: str,
        state: str,
        detail: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Record one further lifecycle state for the same correlation."""
        if state not in CONTROL_EVIDENCE_STATES:
            raise ValueError(f"{state!r} is not a control evidence state")
        return await self._evidence.async_record(
            action="control.execute",
            project_id=project_id,
            actor_user_id=actor_user_id,
            result=state,
            correlation_id=correlation_id,
            detail=detail or {},
        )


def trusted_evidence_store(hass: Any) -> TrustedEvidenceStore | None:
    """Return the loaded runtime's trusted evidence store, or None."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "evidence", None) if runtime is not None else None


def telemetry_store(hass: Any) -> TelemetryStore | None:
    """Return the loaded runtime's telemetry store, or None."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "telemetry", None) if runtime is not None else None
