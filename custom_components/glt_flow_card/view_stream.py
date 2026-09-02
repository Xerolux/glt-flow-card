"""A resumable, bounded, authority-checked view stream (T4-09, T4-10).

Home Assistant's websocket API supplies no sequence number and no replay:
``connection.send_event`` and ``messages.event_message`` carry neither, so
ordering and gap detection are this integration's own responsibility.

The half that already existed is ``SubscriptionRegistry``, which stamps every
emission with a monotonic sequence and re-authorizes per emission. The half this
module adds is the snapshot: it must be read *with* the sequence it corresponds
to, in one critical section. A snapshot stamped outside that section would let an
event emitted between the read and the stamp vanish silently -- which is exactly
the gap the client is meant to detect.

A snapshot is also the most expensive read in the phase, and every condition
that triggers a resync is one a client controls: it can drop and reconnect at
will. So snapshots are rate limited and only one may be in flight per
subscription. A client that exceeds either receives ``rate_limited`` and stays
visibly stale, which is the honest failure -- and a bounded one.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
import time
from typing import Any

#: At most one snapshot may be in flight for a subscription at a time.
MAX_SNAPSHOTS_IN_FLIGHT = 1

#: The shortest interval between two snapshots on one connection, in seconds.
#: A view that resyncs on every event is a denial of service against its own
#: backend; this is the floor that makes a resync storm bounded.
MIN_SNAPSHOT_INTERVAL_SECONDS = 0.5

#: Snapshots allowed in one window, and the window, per connection.
SNAPSHOT_BURST = 8
SNAPSHOT_WINDOW_SECONDS = 10.0


class SnapshotRefused(Exception):
    """A snapshot was refused by a bound rather than by authorization."""

    def __init__(self, code: str = "rate_limited") -> None:
        super().__init__(code)
        self.code = code


@dataclass
class _ConnectionBudget:
    """The snapshot budget for one connection, in one runtime generation."""

    taken: list[float] = field(default_factory=list)
    in_flight: int = 0
    #: None rather than 0.0: a monotonic clock legitimately reads 0.0, and
    #: `if budget.last_at` would then short-circuit and skip the throttle
    #: entirely. Rare in production, and exactly the kind of latent bug that
    #: only shows up once something else changes the clock's origin.
    last_at: float | None = None


@dataclass
class ViewStreamService:
    """Own snapshot production and its bounds for one runtime generation."""

    sequence_of: Callable[[], int]
    generation: int = 1
    monotonic: Callable[[], float] = time.monotonic
    _budgets: dict[int, _ConnectionBudget] = field(default_factory=dict)

    def _budget(self, connection_id: int) -> _ConnectionBudget:
        return self._budgets.setdefault(connection_id, _ConnectionBudget())

    def _admit(self, connection_id: int) -> None:
        """Raise SnapshotRefused unless this connection may take a snapshot."""
        budget = self._budget(connection_id)
        now = self.monotonic()
        if budget.in_flight >= MAX_SNAPSHOTS_IN_FLIGHT:
            raise SnapshotRefused()
        if budget.last_at is not None and (now - budget.last_at) < MIN_SNAPSHOT_INTERVAL_SECONDS:
            raise SnapshotRefused()
        budget.taken = [at for at in budget.taken if now - at < SNAPSHOT_WINDOW_SECONDS]
        if len(budget.taken) >= SNAPSHOT_BURST:
            raise SnapshotRefused()

    def snapshot(
        self,
        connection_id: int,
        read: Callable[[], Mapping[str, Any]],
    ) -> dict[str, Any]:
        """Read the view and its sequence together, under this connection's budget.

        `read` is called exactly once, and the sequence is taken immediately
        afterwards without awaiting in between. Nothing in this method yields,
        which is what makes "one critical section" true rather than aspirational:
        the registry cannot emit while this runs.
        """
        self._admit(connection_id)
        budget = self._budget(connection_id)
        budget.in_flight += 1
        try:
            body = read()
            sequence = self.sequence_of()
        finally:
            budget.in_flight -= 1
        now = self.monotonic()
        budget.last_at = now
        budget.taken.append(now)
        return {
            "snapshot": dict(body),
            "sequence": sequence,
            "generation": self.generation,
        }

    def forget(self, connection_id: int) -> None:
        """Drop a connection's budget. Called when its subscriptions go away."""
        self._budgets.pop(connection_id, None)

    def resource_ledger(self) -> dict[str, int]:
        """What this service still holds. Must reach zero after unload."""
        return {
            "budgets": len(self._budgets),
            "in_flight": sum(budget.in_flight for budget in self._budgets.values()),
        }

    def clear(self) -> None:
        """Release everything. A post-unload callback must find nothing."""
        self._budgets.clear()
