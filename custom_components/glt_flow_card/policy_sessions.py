"""Per-connection subscriptions and opaque evidence cursors.

Both are session-scoped capabilities that must not outlive the authority that
created them. A subscription re-authorizes on *every* emission rather than
caching the decision that admitted it, and a cursor is a short-lived piece of
server state rather than an encoded offset the caller could edit.

Neither is persisted. Both are bound to the runtime generation, so a callback
that fires after an unload, or a cursor presented after a restart, is inert.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
import hashlib
import hmac
import secrets
import time
from typing import Any

# -- subscriptions ----------------------------------------------------------

#: A connection may hold at most this many subscriptions.
MAX_SUBSCRIPTIONS_PER_CONNECTION = 8

#: The event a client receives when its authority disappears. It carries no
#: project body, no other member's identity and no lease token.
REVOCATION_EVENT = "access_revoked"


class SubscriptionDenied(Exception):
    """A subscription could not be created."""


@dataclass
class _Subscription:
    """One live subscription. The authorization is re-checked per emission."""

    token: int
    project_id: str
    user_id: str
    session_id: str
    send: Callable[[dict[str, Any]], None]
    generation: int
    revoked: bool = False


@dataclass
class SubscriptionRegistry:
    """Own every live subscription for one runtime generation."""

    authorize: Callable[[str, str], bool] | None = None
    generation: int = 1
    _subscriptions: dict[int, _Subscription] = field(default_factory=dict)
    _sequence: int = 0
    _next_token: int = 0

    def _may_read(self, project_id: str, user_id: str) -> bool:
        """Re-authorize one subscriber against the *current* authority."""
        if self.authorize is None:
            return True
        return bool(self.authorize(project_id, user_id))

    def _next_sequence(self) -> int:
        self._sequence += 1
        return self._sequence

    async def async_subscribe(
        self,
        *,
        project_id: str,
        user_id: str,
        session_id: str,
        send: Callable[[dict[str, Any]], None],
    ) -> Callable[[], None]:
        """Register one subscription and return its unsubscribe callback."""
        if not self._may_read(project_id, user_id):
            raise SubscriptionDenied("not_found_or_denied")
        held = sum(
            1 for entry in self._subscriptions.values() if entry.session_id == session_id
        )
        if held >= MAX_SUBSCRIPTIONS_PER_CONNECTION:
            raise SubscriptionDenied("rate_limited")

        self._next_token += 1
        token = self._next_token
        self._subscriptions[token] = _Subscription(
            token=token,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
            send=send,
            generation=self.generation,
        )

        def unsubscribe() -> None:
            self._subscriptions.pop(token, None)

        return unsubscribe

    async def async_publish(self, project_id: str, event: dict[str, Any]) -> int:
        """Emit one event to every *currently* authorized subscriber.

        A subscriber whose authority has gone receives one minimal revocation
        event and nothing afterwards. The decision is made here, at emission
        time: a subscription never carries a cached grant.
        """
        delivered = 0
        for entry in list(self._subscriptions.values()):
            if entry.project_id != project_id or entry.generation != self.generation:
                continue
            if self._may_read(entry.project_id, entry.user_id):
                entry.send({**event, "sequence": self._next_sequence()})
                delivered += 1
                continue
            if not entry.revoked:
                entry.revoked = True
                entry.send({
                    "type": REVOCATION_EVENT,
                    "project_id": entry.project_id,
                    "sequence": self._next_sequence(),
                    "reason": "not_found_or_denied",
                })
            self._subscriptions.pop(entry.token, None)
        return delivered

    def release_session(self, session_id: str) -> int:
        """Drop every subscription held by one connection."""
        dropped = 0
        for token, entry in list(self._subscriptions.items()):
            if entry.session_id == session_id:
                del self._subscriptions[token]
                dropped += 1
        return dropped

    def invalidate_generation(self) -> None:
        """Start a new generation; every prior callback becomes inert."""
        self.generation += 1
        self._subscriptions.clear()

    def active_count(self) -> int:
        """Return how many subscriptions are live right now."""
        return len(self._subscriptions)

    def __len__(self) -> int:
        return self.active_count()


# -- evidence cursors -------------------------------------------------------

#: Exactly one page size. There is no caller-selected limit and no total.
PAGE_SIZE = 50
#: A cursor expires after this many idle seconds.
CURSOR_IDLE_SECONDS = 300
#: Registry bounds. Eviction is deterministic: the oldest idle cursor first.
MAX_CURSORS_PER_CONNECTION = 32
MAX_CURSORS_PER_INTEGRATION = 256


class CursorInvalid(Exception):
    """A cursor is unknown, expired, tampered with, or out of its scope."""


@dataclass(frozen=True)
class _CursorScope:
    """Everything a cursor is bound to. All of it must match on every page."""

    user_id: str
    session_id: str
    project_id: str
    filter: str
    generation: int


@dataclass
class _Cursor:
    """Server-side cursor state. The bearer itself is never stored."""

    digest: str
    scope: _CursorScope
    offset: int
    touched_at: float


@dataclass
class EvidenceCursorRegistry:
    """Issue and redeem opaque, scope-bound, expiring page cursors."""

    rows_for: Callable[[_CursorScope], list[dict[str, Any]]] | None = None
    clock: Callable[[], float] = time.monotonic
    token_factory: Callable[[], str] = lambda: secrets.token_urlsafe(32)
    generation: int = 1
    _cursors: dict[str, _Cursor] = field(default_factory=dict)

    @staticmethod
    def _digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _prune(self) -> None:
        """Drop idle-expired cursors. Expiry is decided by the clock alone."""
        now = self.clock()
        for digest, cursor in list(self._cursors.items()):
            if now - cursor.touched_at >= CURSOR_IDLE_SECONDS:
                del self._cursors[digest]

    def _evict(self, scope: _CursorScope) -> None:
        """Keep both bounds, dropping the oldest idle cursor first."""
        def oldest(candidates: list[tuple[str, _Cursor]]) -> str:
            return min(candidates, key=lambda item: item[1].touched_at)[0]

        session = [
            item for item in self._cursors.items()
            if item[1].scope.session_id == scope.session_id
        ]
        while len(session) >= MAX_CURSORS_PER_CONNECTION:
            del self._cursors[oldest(session)]
            session = [
                item for item in self._cursors.items()
                if item[1].scope.session_id == scope.session_id
            ]
        while len(self._cursors) >= MAX_CURSORS_PER_INTEGRATION:
            del self._cursors[oldest(list(self._cursors.items()))]

    def _rows(self, scope: _CursorScope) -> list[dict[str, Any]]:
        return list(self.rows_for(scope)) if self.rows_for is not None else []

    def _page(self, scope: _CursorScope, offset: int) -> dict[str, Any]:
        rows = self._rows(scope)[offset : offset + PAGE_SIZE]
        has_more = len(self._rows(scope)) > offset + len(rows)
        cursor = None
        if has_more:
            self._prune()
            self._evict(scope)
            token = self.token_factory()
            self._cursors[self._digest(token)] = _Cursor(
                digest=self._digest(token),
                scope=scope,
                offset=offset + len(rows),
                touched_at=self.clock(),
            )
            cursor = token
        # No total, no offset, no page number: each of those would reveal rows
        # the caller is not allowed to see.
        return {"rows": rows, "cursor": cursor, "has_more": has_more}

    async def async_first_page(
        self, *, user_id: str, session_id: str, project_id: str, filter: str = "all"
    ) -> dict[str, Any]:
        """Return the first authorized page and, if needed, a fresh cursor."""
        scope = _CursorScope(
            user_id=user_id,
            session_id=session_id,
            project_id=project_id,
            filter=filter,
            generation=self.generation,
        )
        return self._page(scope, 0)

    async def async_next_page(
        self,
        *,
        cursor: str,
        user_id: str,
        session_id: str,
        project_id: str,
        filter: str = "all",
    ) -> dict[str, Any]:
        """Redeem a cursor, but only in the exact scope that issued it."""
        self._prune()
        scope = _CursorScope(
            user_id=user_id,
            session_id=session_id,
            project_id=project_id,
            filter=filter,
            generation=self.generation,
        )
        wanted = self._digest(cursor)
        found = None
        for digest, entry in self._cursors.items():
            if hmac.compare_digest(digest, wanted):
                found = entry
                break
        if found is None or found.scope != scope:
            raise CursorInvalid("cursor_invalid")
        del self._cursors[found.digest]
        return self._page(scope, found.offset)

    def release_session(self, session_id: str) -> int:
        """Drop every cursor held by one connection."""
        dropped = 0
        for digest, cursor in list(self._cursors.items()):
            if cursor.scope.session_id == session_id:
                del self._cursors[digest]
                dropped += 1
        return dropped

    def invalidate_generation(self) -> None:
        """Start a new generation; every outstanding cursor dies."""
        self.generation += 1
        self._cursors.clear()

    def active_count(self) -> int:
        """Return how many cursors are live right now."""
        self._prune()
        return len(self._cursors)

    def __len__(self) -> int:
        return self.active_count()


def subscription_registry(hass: Any) -> SubscriptionRegistry | None:
    """Return the loaded runtime's subscription registry, or None."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "subscriptions", None) if runtime is not None else None


def cursor_registry(hass: Any) -> EvidenceCursorRegistry | None:
    """Return the loaded runtime's evidence cursor registry, or None."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "cursors", None) if runtime is not None else None
