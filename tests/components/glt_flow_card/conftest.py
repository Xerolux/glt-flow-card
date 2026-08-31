"""Supported Home Assistant fixtures for GLT Flow Card Companion tests."""
from __future__ import annotations

from collections.abc import Callable, Generator
from copy import deepcopy
from dataclasses import dataclass, field
import sys
from pathlib import Path
from types import ModuleType
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

import pytest

if sys.platform == "win32" and "fcntl" not in sys.modules:
    fcntl = ModuleType("fcntl")
    fcntl.LOCK_EX = 1
    fcntl.LOCK_NB = 2
    fcntl.flock = lambda _fd, _flags: None
    sys.modules["fcntl"] = fcntl
if sys.platform == "win32" and "resource" not in sys.modules:
    resource = ModuleType("resource")
    resource.RLIMIT_NOFILE = 0
    resource.getrlimit = lambda _limit: (2048, 2048)
    resource.setrlimit = lambda _limit, _value: None
    sys.modules["resource"] = resource

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntryState
    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.common import MockConfigEntry


pytest_plugins = "pytest_homeassistant_custom_component.plugins"
DOMAIN = "glt_flow_card"
PROJECT_CUSTOM_COMPONENTS = Path(__file__).resolve().parents[3] / "custom_components"


@pytest.hookimpl(trylast=True)
def pytest_runtest_setup() -> None:
    """Permit only loopback sockets needed by the Windows asyncio self-pipe."""
    if sys.platform == "win32":
        import pytest_socket

        pytest_socket.socket_allow_hosts(["127.0.0.1", "localhost"])


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Load the repository integration through Home Assistant's custom loader."""
    import custom_components

    project_path = str(PROJECT_CUSTOM_COMPONENTS)
    if project_path not in custom_components.__path__:
        custom_components.__path__.insert(0, project_path)


@pytest.fixture
def config_entry(hass: HomeAssistant) -> MockConfigEntry:
    """Create the single supported Companion config entry."""
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    entry = MockConfigEntry(
        domain=DOMAIN,
        title="GLT Flow Card Companion",
        unique_id="glt-flow-card-test",
        data={},
        options={
            "default_lock_ttl": 300,
            "max_versions": 60,
            "max_audit": 5000,
        },
    )
    entry.add_to_hass(hass)
    return entry


@dataclass
class LifecycleEffects:
    """Record integration-owned effects without allowing external I/O."""

    hass: HomeAssistant
    websocket_commands: list[str] = field(default_factory=list)
    active_listeners: dict[int, str] = field(default_factory=dict)
    service_attempts: list[dict[str, Any]] = field(default_factory=list)
    session_attempts: list[dict[str, Any]] = field(default_factory=list)
    _next_listener: int = 0

    def track_unsubscribe(self, kind: str, unsubscribe: Callable[[], Any]) -> Callable[[], Any]:
        """Wrap a supported HA unsubscribe callback and retain its active count."""
        self._next_listener += 1
        token = self._next_listener
        self.active_listeners[token] = kind

        def tracked_unsubscribe() -> Any:
            self.active_listeners.pop(token, None)
            return unsubscribe()

        return tracked_unsubscribe

    def snapshot(self) -> dict[str, int | list[str]]:
        """Return exact observable counts for the current entry runtime."""
        domain_data = self.hass.data.get(DOMAIN)
        manager = domain_data.get("manager") if isinstance(domain_data, dict) else None
        alarm_tasks = getattr(manager, "_alarm_tasks", {}) if manager is not None else {}
        return {
            "commands": len(self.websocket_commands),
            "command_names": list(self.websocket_commands),
            "listeners": len(self.active_listeners),
            "managers": int(manager is not None),
            "stores": int(getattr(manager, "store", None) is not None),
            "tasks": sum(not task.done() for task in alarm_tasks.values()),
            "sessions": len(self.session_attempts),
            "service_attempts": len(self.service_attempts),
        }


@pytest.fixture
def lifecycle_effects(hass: HomeAssistant) -> Generator[LifecycleEffects]:
    """Instrument only GLT-owned resource registrations and reject live effects."""
    from custom_components import glt_flow_card as integration

    effects = LifecycleEffects(hass)
    original_register = integration.websocket_api.async_register_command
    original_bus_listen = hass.bus.async_listen
    original_track_time = integration.async_track_time_change

    def register_command(test_hass: HomeAssistant, command: Callable[..., Any]) -> None:
        schema = getattr(command, "schema", {})
        command_type = str(schema.get("type", getattr(command, "__name__", "unknown")))
        effects.websocket_commands.append(command_type)
        original_register(test_hass, command)

    def bus_listen(event_type: str, listener: Callable[..., Any], *args: Any, **kwargs: Any):
        unsubscribe = original_bus_listen(event_type, listener, *args, **kwargs)
        if event_type == "state_changed":
            return effects.track_unsubscribe("state_changed", unsubscribe)
        return unsubscribe

    def track_time(*args: Any, **kwargs: Any):
        unsubscribe = original_track_time(*args, **kwargs)
        return effects.track_unsubscribe("schedule_tick", unsubscribe)

    async def reject_service(domain: str, service: str, data: dict[str, Any] | None = None, **kwargs: Any) -> None:
        attempt = {"domain": domain, "service": service, "data": deepcopy(data or {})}
        effects.service_attempts.append(attempt)
        raise AssertionError(f"live service attempt blocked: {domain}.{service}")

    def reject_session(*args: Any, **kwargs: Any):
        effects.session_attempts.append({"args": len(args), "kwargs": sorted(kwargs)})
        raise AssertionError("live client session attempt blocked")

    with (
        patch.object(integration.websocket_api, "async_register_command", side_effect=register_command),
        patch.object(type(hass.bus), "async_listen", side_effect=bus_listen),
        patch.object(integration, "async_track_time_change", side_effect=track_time),
        patch.object(type(hass.services), "async_call", side_effect=reject_service),
        patch.object(integration, "async_get_clientsession", side_effect=reject_session),
    ):
        yield effects


@pytest.fixture
def assert_entry_state(config_entry: MockConfigEntry) -> Callable[[ConfigEntryState], None]:
    """Assert the public ConfigEntry state with a focused failure."""
    from homeassistant.config_entries import ConfigEntryState

    def assert_state(expected: ConfigEntryState) -> None:
        assert config_entry.state is expected

    return assert_state
