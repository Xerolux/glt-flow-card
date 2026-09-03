"""The simulation session: who is rehearsing, on what, and until when.

D2 is why this is a module rather than a boolean. The shipped product kept
``simulation.enabled`` in the **project document**, which is operator input, and
read a per-control ``gates.simulation`` from the same place. So the data that
decided whether a write reached plant was authored by the same people the block
exists to protect.

Phase 6 established the rule after finding a notification service name in a
project document acting as an authorization: **a safety-relevant policy is site
configuration, never project data.** This is that rule with plant writes behind
it instead of a message.

Two more properties, both learned from earlier phases:

**It expires.** A rehearsal that never ends makes the plant unoperable, and
somebody will then work around the block -- which leaves the site worse off than
having no block at all. The session carries a TTL.

**An over-long request is refused, not capped.** Phase 6 shipped a 90-day
shelve request silently truncated to 7 days, and the operator walked away
believing an alarm was quiet for three months. Truncation is a lie told by
arithmetic.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .content_id import content_id

#: The longest a session may last, and the default when none is asked for.
#:
#: Four hours is a long maintenance window and a short working day. It is a site
#: decision like every Phase-6 alarm default, documented rather than argued: a
#: rehearsal outliving the shift that started it is the failure mode, because
#: the next shift finds the plant unoperable and does not know why.
MAX_TTL_SECONDS = 4 * 60 * 60
DEFAULT_TTL_SECONDS = 60 * 60

#: Why a session request was refused.
SESSION_REFUSALS: tuple[str, ...] = (
    "ttl_exceeds_maximum",
    "ttl_not_positive",
    "session_not_found",
    "project_missing",
)


class SessionRejected(ValueError):
    """A session request was refused, with a reason from the closed set."""

    def __init__(self, reason: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or {}


class SimulationSessions:
    """The Companion's record of which projects are being rehearsed.

    Held in runtime state rather than in a project document, and deliberately
    not persisted across a restart: a Home Assistant restart is exactly the
    moment an operator most needs the plant to be operable, and a rehearsal that
    survived one would be a block nobody remembered enabling.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}

    def start(
        self,
        *,
        project_id: str,
        actor_user_id: str,
        actor_name: str = "",
        ttl_seconds: int | None = None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        """Begin a rehearsal, or refuse and say why."""
        if not project_id:
            raise SessionRejected("project_missing")

        requested = DEFAULT_TTL_SECONDS if ttl_seconds is None else int(ttl_seconds)
        if requested <= 0:
            raise SessionRejected("ttl_not_positive", {"requested": requested})
        if requested > MAX_TTL_SECONDS:
            # Refused, not capped. See the module docstring: a silently
            # truncated duration is a lie told by arithmetic, and the operator
            # walks away believing something that is not true.
            raise SessionRejected(
                "ttl_exceeds_maximum", {"requested": requested, "maximum": MAX_TTL_SECONDS},
            )

        started = now or datetime.now(timezone.utc)
        expires = started + timedelta(seconds=requested)
        session = {
            "actor_name": actor_name,
            "actor_user_id": actor_user_id,
            "expires_at": expires.isoformat(),
            "project_id": project_id,
            "started_at": started.isoformat(),
            "ttl_seconds": requested,
        }
        session["id"] = content_id("simulation_session", session)
        self._sessions[project_id] = session
        return dict(session)

    def stop(self, *, project_id: str) -> dict[str, Any]:
        """End a rehearsal. Stopping one that is not running is not an error."""
        return self._sessions.pop(project_id, {"project_id": project_id, "stopped": True})

    def active(self, *, project_id: str, now: datetime | None = None) -> dict[str, Any] | None:
        """Return the live session for a project, or None.

        An expired session is removed here rather than by a timer. A timer that
        failed to fire would leave the plant blocked, and this way expiry is a
        property of the question rather than of a background task nobody watches.
        """
        session = self._sessions.get(project_id)
        if session is None:
            return None
        moment = now or datetime.now(timezone.utc)
        try:
            expires = datetime.fromisoformat(str(session["expires_at"]))
        except (TypeError, ValueError):
            # An unreadable expiry does **not** extend the session. The failure
            # mode of the other choice is a rehearsal that never ends because
            # its clock field got corrupted, which is the worst outcome
            # available here.
            self._sessions.pop(project_id, None)
            return None
        if expires <= moment:
            self._sessions.pop(project_id, None)
            return None
        return dict(session)

    def is_simulating(self, *, project_id: str, now: datetime | None = None) -> bool:
        return self.active(project_id=project_id, now=now) is not None

    def snapshot(self, *, now: datetime | None = None) -> list[dict[str, Any]]:
        """Return every live session, for the surface's banner."""
        return [
            session
            for project_id in list(self._sessions)
            if (session := self.active(project_id=project_id, now=now)) is not None
        ]
