"""Authenticated multi-principal Home Assistant fixtures for Phase-2 tests.

Every Phase-2 authorization claim must be proven against real Home Assistant
identities. This factory creates distinct `MockUser` principals with their own
credentials, refresh tokens and access tokens, then opens genuinely
authenticated WebSocket connections for them. No test may hand the integration a
caller-authored actor: the only identity the Companion may read is the one
Home Assistant attaches to the active connection.

Principals
----------
``viewer``/``operator``/``engineer``/``engineer_two``/``admin`` are ordinary
Home Assistant users whose Phase-2 project role is assigned server-side.
``ha_admin`` is a Home Assistant administrator with no project membership, which
is the ceiling case for minimal membership administration. ``unassigned`` is an
ordinary user with no membership at all.

Sessions
--------
A *session* is one refresh token. Two sessions for one user model two browser
tabs or two devices; a reconnect always asks for a new session so a lease or
cursor bound to the previous session can never be resurrected.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from homeassistant.auth.const import GROUP_ID_ADMIN, GROUP_ID_USER
from homeassistant.auth.models import Credentials
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockUser

CLIENT_ID = "https://glt-flow-card.test/phase2"

#: key -> (display name, project role, Home Assistant administrator)
PRINCIPAL_SPECS: dict[str, tuple[str, str | None, bool]] = {
    "viewer": ("Phase2 Viewer", "viewer", False),
    "operator": ("Phase2 Operator", "operator", False),
    "engineer": ("Phase2 Engineer", "engineer", False),
    "engineer_two": ("Phase2 Engineer Two", "engineer", False),
    "admin": ("Phase2 Project Admin", "admin", False),
    "ha_admin": ("Phase2 HA Administrator", None, True),
    "unassigned": ("Phase2 Unassigned", None, False),
}


@dataclass(frozen=True)
class Principal:
    """A real Home Assistant identity plus its intended Phase-2 project role."""

    key: str
    name: str
    project_role: str | None
    is_admin: bool
    user: MockUser

    @property
    def user_id(self) -> str:
        """Return the server-owned Home Assistant user id."""
        return self.user.id


@dataclass
class Connection:
    """One authenticated WebSocket client bound to a principal and session."""

    principal: Principal
    session: str
    session_id: str
    connection_id: int
    client: Any

    @property
    def user_id(self) -> str:
        """Return the connected principal's Home Assistant user id."""
        return self.principal.user_id

    async def command(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Send one WebSocket command and return its exact response envelope."""
        await self.client.send_json_auto_id(dict(payload))
        return await self.client.receive_json()


class Phase2UserFactory:
    """Create Phase-2 principals, per-session tokens and live connections."""

    def __init__(self, hass: HomeAssistant, local_auth: Any, ws_client: Any) -> None:
        self._hass = hass
        self._local_auth = local_auth
        self._ws_client = ws_client
        self._principals: dict[str, Principal] = {}
        self._tokens: dict[tuple[str, str], str] = {}
        self._refresh_tokens: dict[tuple[str, str], str] = {}
        self._connections: list[Connection] = []
        self._next_connection = 0

    # -- principals ---------------------------------------------------------
    async def async_prepare(self) -> None:
        """Create every declared principal as a real Home Assistant user."""
        for key, (name, project_role, is_admin) in PRINCIPAL_SPECS.items():
            if key in self._principals:
                continue
            group = await self._hass.auth.async_get_group(
                GROUP_ID_ADMIN if is_admin else GROUP_ID_USER
            )
            user = MockUser(name=name, groups=[group]).add_to_hass(self._hass)
            self._principals[key] = Principal(
                key=key,
                name=name,
                project_role=project_role,
                is_admin=is_admin,
                user=user,
            )

    def principal(self, key: str) -> Principal:
        """Return the named Phase-2 principal created by ``async_prepare``."""
        if key not in PRINCIPAL_SPECS:
            raise KeyError(f"unknown Phase-2 principal {key!r}")
        existing = self._principals.get(key)
        if existing is None:
            raise RuntimeError("Phase2UserFactory.async_prepare() was not awaited")
        return existing

    def principals(self) -> tuple[Principal, ...]:
        """Return every declared principal in a stable order."""
        return tuple(self.principal(key) for key in PRINCIPAL_SPECS)

    def role_of(self, key: str) -> str | None:
        """Return the intended server-side project role for a principal."""
        return self.principal(key).project_role

    # -- credentials and tokens --------------------------------------------
    async def async_refresh_token_id(self, key: str, session: str = "default") -> str:
        """Return the refresh-token id that identifies one principal session."""
        await self.async_access_token(key, session)
        return self._refresh_tokens[(key, session)]

    async def async_access_token(self, key: str, session: str = "default") -> str:
        """Mint (once per session) a real access token for a principal."""
        cached = self._tokens.get((key, session))
        if cached is not None:
            return cached

        principal = self.principal(key)
        credential = Credentials(
            id=f"phase2-{key}-{session}",
            auth_provider_type="homeassistant",
            auth_provider_id=None,
            data={"username": f"{key}-{session}"},
            is_new=False,
        )
        principal.user.credentials.append(credential)
        refresh_token = await self._hass.auth.async_create_refresh_token(
            principal.user, f"{CLIENT_ID}/{session}", credential=credential
        )
        token = self._hass.auth.async_create_access_token(refresh_token)
        self._tokens[(key, session)] = token
        self._refresh_tokens[(key, session)] = refresh_token.id
        return token

    # -- connections --------------------------------------------------------
    async def async_connect(self, key: str, session: str | None = None) -> Connection:
        """Open one authenticated WebSocket connection for a principal session.

        Omitting ``session`` allocates a fresh session, which is what a real
        reconnect does: the previous binding can never be reused.
        """
        self._next_connection += 1
        connection_id = self._next_connection
        resolved = session if session is not None else f"auto-{connection_id}"
        token = await self.async_access_token(key, resolved)
        client = await self._ws_client(self._hass, token)
        connection = Connection(
            principal=self.principal(key),
            session=resolved,
            session_id=self._refresh_tokens[(key, resolved)],
            connection_id=connection_id,
            client=client,
        )
        self._connections.append(connection)
        return connection

    async def async_disconnect(self, connection: Connection) -> None:
        """Close one connection and forget its session binding."""
        if connection in self._connections:
            self._connections.remove(connection)
        await connection.client.close()

    async def async_close(self) -> None:
        """Close every connection this factory opened."""
        connections, self._connections = list(self._connections), []
        for connection in connections:
            await connection.client.close()


@dataclass
class ControlledService:
    """A named fake Home Assistant service with an explicit allowlist.

    The default is zero allowed calls. A test that legitimately needs a service
    attempt must name the exact domain and service first, and the recorded call
    keeps the exact domain, service, data, target and context so configured
    control evidence can be compared byte for byte.
    """

    hass: HomeAssistant
    calls: list[dict[str, Any]] = field(default_factory=list)
    _allowed: set[tuple[str, str]] = field(default_factory=set)

    @property
    def allowed(self) -> tuple[tuple[str, str], ...]:
        """Return the currently allowed (domain, service) pairs."""
        return tuple(sorted(self._allowed))

    def allow(self, domain: str, service: str) -> None:
        """Permit exactly one domain/service pair and register the fake."""
        self._allowed.add((domain, service))
        if not self.hass.services.has_service(domain, service):
            self.hass.services.async_register(domain, service, self._record)

    def _record(self, call: Any) -> None:
        """Record one permitted service call without any external effect."""
        self.calls.append(
            {
                "domain": call.domain,
                "service": call.service,
                "data": dict(call.data),
                "target": dict(getattr(call, "target", None) or {}),
                "context_id": getattr(call.context, "id", None),
                "context_user_id": getattr(call.context, "user_id", None),
            }
        )

    def is_allowed(self, domain: str, service: str) -> bool:
        """Return whether a domain/service pair was explicitly permitted."""
        return (domain, service) in self._allowed

    def reset(self) -> None:
        """Clear recorded calls without widening the allowlist."""
        self.calls.clear()
