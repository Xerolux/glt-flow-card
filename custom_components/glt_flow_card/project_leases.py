"""Ephemeral, connection-bound exclusive engineering leases.

A lease is a capability, not a record. It lives only in memory, it is bound to
the exact context it was issued in, its bearer rotates on every renewal, and it
expires on a monotonic clock with no grace period whatsoever. Nothing about a
lease is persisted, so a restart cannot resurrect one, and only the SHA-256
digest of a bearer is ever stored, so manager state cannot leak a usable token.

A caller that loses the race learns that *a* lease is held and nothing else. The
holder's identity is deliberately absent from every denial: knowing who is
editing is a project-membership question, not a lease question.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import hmac
import secrets
import time
from collections.abc import Callable
from typing import Any

from .const import DEFAULT_LOCK_TTL, LEASE_TTL_MAX_SECONDS, LEASE_TTL_MIN_SECONDS

#: Accepted lease TTLs. The legacy 30-3600s lock range is deliberately not
#: carried over. `const` owns the window so the options schema and this registry
#: cannot drift apart.
MIN_TTL_SECONDS = LEASE_TTL_MIN_SECONDS
MAX_TTL_SECONDS = LEASE_TTL_MAX_SECONDS
DEFAULT_TTL_SECONDS = DEFAULT_LOCK_TTL

#: Purposes a lease may be issued for.
PURPOSE_ENGINEERING = "engineering"
PURPOSE_MEMBERSHIP_ADMIN = "membership_admin"
PURPOSES = (PURPOSE_ENGINEERING, PURPOSE_MEMBERSHIP_ADMIN)

#: The capability each purpose requires.
PURPOSE_CAPABILITY = {
    PURPOSE_ENGINEERING: "lease.engineering",
    PURPOSE_MEMBERSHIP_ADMIN: "lease.administration",
}

#: Lease operations allowed per user, per project, per minute.
MAX_OPERATIONS_PER_MINUTE = 30


class LeaseDenied(Exception):
    """The lease could not be granted. Carries no owner identity."""

    def __init__(self, code: str = "lease_held", detail: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = dict(detail or {})


class LeaseInvalid(Exception):
    """A presented token is not valid in the context it was presented in."""


@dataclass(frozen=True)
class Lease:
    """What a holder receives. The bearer exists only here and in memory."""

    token: str
    project_id: str
    purpose: str
    expires_at: float
    expires_in: int


@dataclass
class _Held:
    """Manager-side lease state. It never contains a usable bearer."""

    digest: str
    project_id: str
    user_id: str
    session_id: str
    purpose: str
    access_revision: int
    generation: int
    expires_at: float


@dataclass
class LeaseRegistry:
    """Own every live lease for one runtime generation."""

    clock: Callable[[], float] = time.monotonic
    token_factory: Callable[[], str] = lambda: secrets.token_urlsafe(32)
    generation: int = 1
    _leases: dict[str, _Held] = field(default_factory=dict)
    _operations: dict[tuple[str, str], list[float]] = field(default_factory=dict)

    # -- helpers ------------------------------------------------------------
    @staticmethod
    def _digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _prune(self) -> None:
        """Drop every expired lease. Expiry is decided by the clock alone."""
        now = self.clock()
        for project_id, held in list(self._leases.items()):
            if held.expires_at <= now:
                del self._leases[project_id]

    def _rate_check(self, user_id: str, project_id: str) -> None:
        now = self.clock()
        bucket = self._operations.setdefault((user_id, project_id), [])
        bucket[:] = [stamp for stamp in bucket if now - stamp < 60]
        if len(bucket) >= MAX_OPERATIONS_PER_MINUTE:
            raise LeaseDenied("rate_limited")
        bucket.append(now)

    # -- lifecycle ----------------------------------------------------------
    def acquire(
        self,
        *,
        project_id: str,
        user_id: str,
        session_id: str,
        purpose: str = PURPOSE_ENGINEERING,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        access_revision: int = 0,
    ) -> Lease:
        """Grant the one exclusive lease for a project, or refuse anonymously."""
        if purpose not in PURPOSES:
            raise ValueError(f"{purpose!r} is not a lease purpose")
        if type(ttl_seconds) is not int or not MIN_TTL_SECONDS <= ttl_seconds <= MAX_TTL_SECONDS:
            raise ValueError(
                f"ttl_seconds must be an integer from {MIN_TTL_SECONDS} to {MAX_TTL_SECONDS}"
            )
        self._prune()
        self._rate_check(user_id, project_id)
        if project_id in self._leases:
            raise LeaseDenied("lease_held")

        token = self.token_factory()
        expires_at = self.clock() + ttl_seconds
        self._leases[project_id] = _Held(
            digest=self._digest(token),
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
            purpose=purpose,
            access_revision=access_revision,
            generation=self.generation,
            expires_at=expires_at,
        )
        return Lease(
            token=token,
            project_id=project_id,
            purpose=purpose,
            expires_at=expires_at,
            expires_in=ttl_seconds,
        )

    def _match(
        self,
        *,
        token: str,
        project_id: str,
        user_id: str,
        session_id: str,
        purpose: str,
        access_revision: int,
    ) -> _Held | None:
        """Return the held lease only when every binding dimension matches."""
        self._prune()
        held = self._leases.get(project_id)
        if held is None:
            return None
        if not hmac.compare_digest(held.digest, self._digest(token)):
            return None
        if (
            held.user_id != user_id
            or held.session_id != session_id
            or held.purpose != purpose
            or held.access_revision != access_revision
            or held.generation != self.generation
        ):
            return None
        return held

    def validate(
        self,
        *,
        token: str,
        project_id: str,
        user_id: str,
        session_id: str,
        purpose: str = PURPOSE_ENGINEERING,
        access_revision: int = 0,
    ) -> bool:
        """Return whether this exact bearer is valid in this exact context."""
        return self._match(
            token=token,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
            purpose=purpose,
            access_revision=access_revision,
        ) is not None

    def renew(
        self,
        *,
        token: str,
        project_id: str,
        user_id: str,
        session_id: str,
        purpose: str = PURPOSE_ENGINEERING,
        access_revision: int = 0,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> Lease:
        """Extend the lease and rotate the bearer. The old one dies at once."""
        if type(ttl_seconds) is not int or not MIN_TTL_SECONDS <= ttl_seconds <= MAX_TTL_SECONDS:
            raise ValueError(
                f"ttl_seconds must be an integer from {MIN_TTL_SECONDS} to {MAX_TTL_SECONDS}"
            )
        held = self._match(
            token=token,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
            purpose=purpose,
            access_revision=access_revision,
        )
        if held is None:
            raise LeaseInvalid("lease_expired")
        self._rate_check(user_id, project_id)

        rotated = self.token_factory()
        held.digest = self._digest(rotated)
        held.expires_at = self.clock() + ttl_seconds
        return Lease(
            token=rotated,
            project_id=project_id,
            purpose=purpose,
            expires_at=held.expires_at,
            expires_in=ttl_seconds,
        )

    def release(
        self,
        *,
        token: str,
        project_id: str,
        user_id: str,
        session_id: str,
        purpose: str = PURPOSE_ENGINEERING,
        access_revision: int = 0,
    ) -> bool:
        """Release a lease the caller actually holds."""
        held = self._match(
            token=token,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
            purpose=purpose,
            access_revision=access_revision,
        )
        if held is None:
            raise LeaseInvalid("lease_expired")
        del self._leases[project_id]
        return True

    # -- invalidation -------------------------------------------------------
    def release_session(self, session_id: str) -> int:
        """Drop every lease bound to one connection, as a disconnect must."""
        dropped = 0
        for project_id, held in list(self._leases.items()):
            if held.session_id == session_id:
                del self._leases[project_id]
                dropped += 1
        return dropped

    def release_user(self, user_id: str) -> int:
        """Drop every lease held by one user, as a role loss must."""
        dropped = 0
        for project_id, held in list(self._leases.items()):
            if held.user_id == user_id:
                del self._leases[project_id]
                dropped += 1
        return dropped

    def invalidate_access_revision(self, project_id: str, access_revision: int) -> None:
        """Drop a lease whose membership changed underneath it."""
        held = self._leases.get(project_id)
        if held is not None and held.access_revision != access_revision:
            del self._leases[project_id]

    def release_all(self, project_id: str | None = None) -> None:
        """Drop one project's lease, or every lease."""
        if project_id is None:
            self._leases.clear()
        else:
            self._leases.pop(project_id, None)

    def invalidate_generation(self) -> None:
        """Start a new runtime generation; nothing issued before survives."""
        self.generation += 1
        self._leases.clear()
        self._operations.clear()

    # -- observation --------------------------------------------------------
    def active_count(self) -> int:
        """Return how many leases are live right now."""
        self._prune()
        return len(self._leases)

    def held_state(self, project_id: str) -> dict[str, Any]:
        """Return the anonymous held state a client may see.

        It says whether the project is being edited and when that claim
        expires. It never says by whom: that is membership information, and a
        caller who cannot read the membership must not learn it here.
        """
        self._prune()
        held = self._leases.get(project_id)
        if held is None:
            return {"held": False, "purpose": None, "expires_in": 0}
        return {
            "held": True,
            "purpose": held.purpose,
            "expires_in": max(0, int(held.expires_at - self.clock())),
        }

    def diagnostics(self) -> dict[str, Any]:
        """Return counts only. No token, digest, user or session ever appears."""
        self._prune()
        return {
            "generation": self.generation,
            "active_leases": len(self._leases),
            "rate_buckets": len(self._operations),
        }

    def __len__(self) -> int:
        return self.active_count()


def lease_registry(hass: Any) -> LeaseRegistry | None:
    """Return the loaded runtime's lease registry, or None when unloaded."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "leases", None) if runtime is not None else None
