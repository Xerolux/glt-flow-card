"""Server-owned project membership.

The ACL lives in its own versioned Home Assistant store, never inside a project
document. That separation is the whole point: a project body can be imported,
rolled back or edited by anyone who can write it, so anything it says about
membership is a claim, not a fact.

A legacy project's `permissions` block is read exactly once, from a verified
active head, so an existing installation is not stranded with no members. The
mapping is deliberately lossy downward — a legacy designer becomes an engineer,
never an admin — because the legacy block never expressed membership
administration in the first place.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from copy import deepcopy
import json
from dataclasses import dataclass, field
from typing import Any

from homeassistant.helpers.storage import Store

from .const import PROJECT_ACCESS_STORE_KEY, PROJECT_ACCESS_STORE_VERSION
from .policy import ROLES

#: An ACL may hold at most this many assignments, so a grant loop cannot grow
#: the store without bound.
MAX_MEMBERS = 512

#: How a legacy `permissions` block maps onto fixed Phase-2 roles.
LEGACY_ROLE_MAP: dict[str, str] = {
    "designers": "engineer",
    "operators": "operator",
    "viewers": "viewer",
}

StoreFactory = Callable[[Any, int, str], Any]


class AccessConflict(Exception):
    """An ACL change was refused: stale revision, bad role, or last admin."""


@dataclass(frozen=True)
class AccessState:
    """An immutable view of one project's membership."""

    project_id: str
    access_revision: int
    assignments: tuple[tuple[str, str], ...] = field(default=())
    bootstrap: Mapping[str, Any] | None = None

    def role_of(self, user_id: str) -> str | None:
        """Return the fixed role assigned to one user, or None."""
        for assigned_user, role in self.assignments:
            if assigned_user == user_id:
                return role
        return None

    def admins(self) -> tuple[str, ...]:
        """Return every user holding the admin role."""
        return tuple(user for user, role in self.assignments if role == "admin")


def _empty() -> dict[str, Any]:
    return {"projects": {}}


def _default_store_factory(hass: Any, version: int, key: str) -> Store[dict[str, Any]]:
    return Store(hass, version, key)


class ProjectAccessRepository:
    """Own project membership, its revision stream, and its bootstrap receipt."""

    def __init__(self, hass: Any, *, store_factory: StoreFactory | None = None) -> None:
        factory = store_factory or _default_store_factory
        self._store = factory(hass, PROJECT_ACCESS_STORE_VERSION, PROJECT_ACCESS_STORE_KEY)
        self._data: dict[str, Any] = _empty()
        self._loaded = False

    async def async_initialize(self) -> None:
        """Load the ACL store and reject a structurally invalid one."""
        loaded = await self._store.async_load()
        self._data = deepcopy(loaded) if isinstance(loaded, Mapping) else _empty()
        self._data.setdefault("projects", {})
        if not isinstance(self._data["projects"], dict):
            raise ValueError("project access store is invalid")
        self._loaded = True

    def _entry(self, project_id: str) -> dict[str, Any]:
        return self._data["projects"].setdefault(
            project_id, {"access_revision": 0, "assignments": [], "bootstrap": None}
        )

    async def _persist(self, project_id: str) -> None:
        """Save the ACL and verify the read-back before returning.

        The comparison goes through a JSON round-trip because the store
        serializes to JSON: an in-memory tuple and its persisted list are the
        same fact, and only a real divergence may raise here.
        """
        await self._store.async_save(deepcopy(self._data))
        written = await self._store.async_load()
        if not isinstance(written, Mapping):
            raise AccessConflict("project access store did not read back")
        stored = written.get("projects", {}).get(project_id)
        expected = json.loads(json.dumps(self._data["projects"].get(project_id)))
        if json.loads(json.dumps(stored)) != expected:
            raise AccessConflict("project access read-back did not match the write")

    async def async_get(self, project_id: str) -> AccessState:
        """Return the current membership for one project."""
        return self.get(project_id)

    def get(self, project_id: str) -> AccessState:
        """Return the current membership without awaiting.

        Membership is held in memory and only written through `_persist`, so a
        read needs no I/O. The WebSocket boundary is a synchronous callback, and
        a synchronous read is what lets policy decide before a handler runs.
        """
        entry = self._data["projects"].get(project_id)
        if entry is None:
            return AccessState(project_id=project_id, access_revision=0)
        return AccessState(
            project_id=project_id,
            access_revision=int(entry.get("access_revision", 0)),
            assignments=tuple(
                (str(user), str(role))
                for user, role in sorted(entry.get("assignments", []))
            ),
            bootstrap=deepcopy(entry.get("bootstrap")),
        )

    async def async_assign(
        self,
        *,
        project_id: str,
        user_id: str,
        role: str,
        expected_access_revision: int | None = None,
    ) -> AccessState:
        """Assign one fixed role, advancing the access revision by exactly one."""
        if role not in ROLES:
            raise ValueError(f"{role!r} is not a fixed project role")
        if not user_id:
            raise ValueError("an assignment needs a Home Assistant user id")

        entry = self._entry(project_id)
        current = int(entry.get("access_revision", 0))
        if expected_access_revision is not None and expected_access_revision != current:
            raise AccessConflict(
                f"access_revision_conflict:{current}"
            )

        assignments = {str(user): str(assigned) for user, assigned in entry["assignments"]}
        if user_id not in assignments and len(assignments) >= MAX_MEMBERS:
            raise AccessConflict(f"project access is limited to {MAX_MEMBERS} members")
        assignments[user_id] = role

        entry["assignments"] = sorted(assignments.items())
        entry["access_revision"] = current + 1
        await self._persist(project_id)
        return await self.async_get(project_id)

    async def async_revoke(
        self,
        *,
        project_id: str,
        user_id: str,
        expected_access_revision: int | None = None,
    ) -> AccessState:
        """Remove one assignment, refusing to strand a project without an admin."""
        entry = self._entry(project_id)
        current = int(entry.get("access_revision", 0))
        if expected_access_revision is not None and expected_access_revision != current:
            raise AccessConflict(f"access_revision_conflict:{current}")

        assignments = {str(user): str(role) for user, role in entry["assignments"]}
        if user_id not in assignments:
            return await self.async_get(project_id)

        remaining_admins = [
            user for user, role in assignments.items() if role == "admin" and user != user_id
        ]
        if assignments[user_id] == "admin" and not remaining_admins:
            raise AccessConflict("the last project admin cannot be removed")

        del assignments[user_id]
        entry["assignments"] = sorted(assignments.items())
        entry["access_revision"] = current + 1
        await self._persist(project_id)
        return await self.async_get(project_id)

    async def async_seed_first_admin(
        self, *, project_id: str, user_id: str
    ) -> AccessState | None:
        """Seed the saving Home Assistant admin as the first project admin.

        A single-admin installation with no projects could otherwise never
        bootstrap shared state: membership administration may not self-grant,
        and an engineering lease needs an assignment. Seeding the first admin
        on first save is the same once-and-conservative move the legacy
        permissions bootstrap makes, and it is available exactly when the
        project has no assignments and no stored content yet.
        """
        entry = self._entry(project_id)
        if entry.get("assignments"):
            return None
        receipt = entry.get("bootstrap")
        if isinstance(receipt, Mapping) and receipt.get("source") == "first_admin":
            return await self.async_get(project_id)
        entry["assignments"] = [(str(user_id), "admin")]
        entry["access_revision"] = int(entry.get("access_revision", 0)) + 1
        entry["bootstrap"] = {
            "source": "first_admin",
            "adopted": 1,
            "roles": [str(user_id)],
            "skipped": None,
        }
        await self._persist(project_id)
        return await self.async_get(project_id)

    async def async_bootstrap_from_legacy(
        self, project_id: str, head_config: Mapping[str, Any] | None
    ) -> dict[str, Any]:
        """Adopt a legacy `permissions` block once, conservatively.

        Only an *active head* may be passed here. The receipt is idempotent: a
        repeat returns the same receipt and does not move the access revision.
        """
        entry = self._entry(project_id)
        existing = entry.get("bootstrap")
        if existing is not None:
            return deepcopy(existing)

        if entry["assignments"]:
            # The project already has server-owned membership, so the legacy
            # block is just content now. Adopting from it here is exactly the
            # self-grant this store exists to prevent.
            receipt = {"source": "legacy_permissions", "adopted": 0, "roles": [],
                       "skipped": "acl_already_exists"}
            entry["bootstrap"] = receipt
            await self._persist(project_id)
            return deepcopy(receipt)

        adopted: dict[str, str] = {}
        permissions = (head_config or {}).get("permissions")
        if isinstance(permissions, Mapping):
            for legacy_key, role in LEGACY_ROLE_MAP.items():
                members = permissions.get(legacy_key)
                if not isinstance(members, list):
                    continue
                for member in members:
                    if not isinstance(member, str) or not member:
                        continue
                    # A stronger existing adoption always wins, so one user
                    # listed twice cannot be demoted by iteration order.
                    if ROLES.index(role) > ROLES.index(adopted.get(member, ROLES[0])):
                        adopted[member] = role
                    else:
                        adopted.setdefault(member, role)

        adopted = dict(sorted(adopted.items())[:MAX_MEMBERS])
        receipt = {
            "source": "legacy_permissions",
            "adopted": len(adopted),
            "roles": sorted({role for role in adopted.values()}),
            "skipped": None,
        }

        if adopted:
            assignments = {str(user): str(role) for user, role in entry["assignments"]}
            for user, role in adopted.items():
                assignments.setdefault(user, role)
            entry["assignments"] = sorted(assignments.items())
            entry["access_revision"] = int(entry.get("access_revision", 0)) + 1
        entry["bootstrap"] = receipt
        await self._persist(project_id)
        return deepcopy(receipt)

    async def async_membership_inventory(self, project_id: str) -> dict[str, Any]:
        """Return the minimal shell a Home Assistant administrator may read.

        Resolved A2: enough to see who holds what and to repair it, and nothing
        else. No title, no content, no counts, no evidence.
        """
        state = await self.async_get(project_id)
        return {
            "project_id": project_id,
            "access_revision": state.access_revision,
            "assignments": [
                {"user_id": user, "role": role} for user, role in state.assignments
            ],
        }

    async def async_eligible_users(self, hass: Any) -> list[dict[str, str]]:
        """List the Home Assistant users a role may be assigned to.

        The set comes from Home Assistant's own user store, so a request can
        never introduce an arbitrary identifier. System-generated and inactive
        users are excluded: an assignment must name a person who can actually
        sign in.
        """
        users = await hass.auth.async_get_users()
        return sorted(
            (
                {"user_id": user.id, "name": user.name or ""}
                for user in users
                if user.is_active and not user.system_generated
            ),
            key=lambda entry: entry["user_id"],
        )

    def project_ids(self) -> tuple[str, ...]:
        """Return every project the ACL knows about."""
        return tuple(sorted(self._data["projects"]))


def access_repository(hass: Any) -> ProjectAccessRepository | None:
    """Return the loaded runtime's ACL repository, or None when unloaded."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "access", None) if runtime is not None else None
