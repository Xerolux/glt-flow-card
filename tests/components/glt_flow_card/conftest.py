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
from homeassistant.exceptions import HomeAssistantError

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

#: Captured at import, before any fixture patches the class. `lifecycle_effects`
#: and `controlled_service` both replace `ServiceRegistry.async_call`, so a
#: fixture that captured "the current implementation" would chain onto the other
#: fixture's blocker and refuse a call the test explicitly permitted.
try:  # pragma: no cover - import guard for environments without Home Assistant
    from homeassistant.core import ServiceRegistry as _ServiceRegistry

    PRISTINE_SERVICE_CALL = _ServiceRegistry.async_call
except ImportError:  # pragma: no cover
    PRISTINE_SERVICE_CALL = None
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


#: Phase-2 runtime resources that must all return to zero after unload.
PHASE2_RESOURCE_COUNTERS = (
    "listeners",
    "tasks",
    "subscriptions",
    "cursors",
    "leases",
    "control_waits",
    "rate_buckets",
    "provenance_cache",
    "late_callbacks",
    "managers",
    "stores",
)


@dataclass
class LifecycleEffects:
    """Record integration-owned effects without allowing external I/O."""

    hass: HomeAssistant
    websocket_commands: list[str] = field(default_factory=list)
    registered_commands: dict[str, Callable[..., Any]] = field(default_factory=dict)
    active_listeners: dict[int, str] = field(default_factory=dict)
    service_attempts: list[dict[str, Any]] = field(default_factory=list)
    session_attempts: list[dict[str, Any]] = field(default_factory=list)
    late_callbacks: list[dict[str, Any]] = field(default_factory=list)
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

    def record_late_callback(self, kind: str, detail: Any = None) -> None:
        """Record a callback that fired after its owning runtime was released."""
        self.late_callbacks.append({"kind": kind, "detail": detail})

    def _phase2_counts(self, manager: Any) -> dict[str, int]:
        """Count Phase-2 runtime resources, defaulting to zero before they exist.

        Phase-2 introduces these registries incrementally. Counting them through
        a tolerant accessor keeps the ledger honest at every wave: a registry
        that does not exist yet contributes zero, and the moment a plan adds one
        the same ledger starts failing on leaked entries.
        """

        def size(*names: str) -> int:
            for name in names:
                container = getattr(manager, name, None)
                if container is not None:
                    try:
                        return len(container)
                    except TypeError:
                        return int(bool(container))
            return 0

        return {
            "subscriptions": size("_subscriptions", "subscriptions"),
            "cursors": size("_cursors", "cursors"),
            "leases": size("_leases", "leases", "project_leases"),
            "control_waits": size("_control_waits", "control_waits"),
            "rate_buckets": size("_rate_buckets", "rate_buckets", "control_rates"),
            "provenance_cache": size("_provenance_cache", "provenance_cache"),
        }

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
            "late_callbacks": len(self.late_callbacks),
            **self._phase2_counts(manager),
        }

    def phase2_resource_total(self, snapshot: dict[str, Any] | None = None) -> int:
        """Return the summed Phase-2 resource count; zero means fully released."""
        current = snapshot if snapshot is not None else self.snapshot()
        return sum(int(current.get(name, 0)) for name in PHASE2_RESOURCE_COUNTERS)

    def reset(self) -> None:
        """Clear recorded attempts so one test can assert successive phases."""
        self.service_attempts.clear()
        self.session_attempts.clear()
        self.late_callbacks.clear()


@pytest.fixture
def lifecycle_effects(hass: HomeAssistant) -> Generator[LifecycleEffects]:
    """Instrument only GLT-owned resource registrations and reject live effects."""
    from custom_components import glt_flow_card as integration

    effects = LifecycleEffects(hass)
    original_register = integration.websocket_api.async_register_command
    original_bus_listen = hass.bus.async_listen
    original_track_time = integration.async_track_time_change

    def register_command(test_hass: HomeAssistant, command: Callable[..., Any]) -> None:
        command_type = str(
            getattr(command, "_ws_command", None) or getattr(command, "__name__", "unknown")
        )
        effects.websocket_commands.append(command_type)
        effects.registered_commands[command.__name__] = command
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
async def phase2_users(hass: HomeAssistant, local_auth, hass_ws_client):
    """Provide the Phase-2 multi-principal authenticated identity factory."""
    from .user_factory import Phase2UserFactory

    factory = Phase2UserFactory(hass, local_auth, hass_ws_client)
    await factory.async_prepare()
    try:
        yield factory
    finally:
        await factory.async_close()


@pytest.fixture
def controlled_service(hass: HomeAssistant) -> Generator[Any]:
    """Provide a named fake service that permits zero calls until allowed.

    The global blocker stays in force for every unnamed domain/service, so a
    test proves an intended service attempt only by naming it first.
    """
    from .user_factory import ControlledService

    controlled = ControlledService(hass)
    original_call = PRISTINE_SERVICE_CALL

    # `patch.object(..., side_effect=...)` installs a MagicMock as a class
    # attribute, so the instance lookup does not bind `self`; the replacement
    # therefore takes the call arguments only, exactly like the global blocker.
    async def guarded_call(domain, service, data=None, *args, **kwargs):
        if not controlled.is_allowed(str(domain), str(service)):
            raise AssertionError(f"live service attempt blocked: {domain}.{service}")
        return await original_call(hass.services, domain, service, data, *args, **kwargs)

    with patch.object(type(hass.services), "async_call", side_effect=guarded_call):
        yield controlled


@pytest.fixture
def notification_ledger(hass: HomeAssistant) -> Generator[Any]:
    """Record every notification attempt and fail the test if one escaped.

    Phase 6 is the first phase whose subject is a service call that is
    *intended*, so the Phase-2 rule -- zero unintended effects -- no longer
    settles the question. A suite can assert everything it meant to assert and
    still have paged somebody.

    The containment check therefore runs in **teardown**, after the test body
    has finished. A test that reached a real notification service or named a
    real recipient fails even when every one of its own assertions passed.

    The fixture registers exactly one notifier, `glt_fake_notify.send`, which
    exists nowhere in Home Assistant, and permits exactly one recipient. A test
    that needs a delivery failure calls `fail_next()`; the raised error is
    recorded as an outcome rather than escaping, because "the notifier threw" is
    the behaviour under test, not a broken harness.
    """
    from .user_factory import (
        FAKE_NOTIFY_DOMAIN,
        FAKE_NOTIFY_SERVICE,
        NotificationLedger,
    )

    ledger = NotificationLedger()
    original_call = PRISTINE_SERVICE_CALL
    failures: list[str] = []

    def fail_next(message: str = "notifier unavailable") -> None:
        """Make the next fixture notification attempt raise, once."""
        failures.append(message)

    async def fake_notifier(call: Any) -> None:
        if failures:
            raise HomeAssistantError(failures.pop(0))

    hass.services.async_register(FAKE_NOTIFY_DOMAIN, FAKE_NOTIFY_SERVICE, fake_notifier)

    async def guarded_call(domain, service, data=None, *args, **kwargs):
        domain, service = str(domain), str(service)
        payload = dict(data or {})
        if not ledger.is_notification(domain, service):
            return await original_call(hass.services, domain, service, data, *args, **kwargs)
        try:
            result = await original_call(hass.services, domain, service, data, *args, **kwargs)
        except Exception as error:  # noqa: BLE001 - the outcome is the subject
            ledger.record(domain, service, payload, "failed", str(error))
            raise
        ledger.record(domain, service, payload, "delivered")
        return result

    ledger.fail_next = fail_next  # type: ignore[attr-defined]
    with patch.object(type(hass.services), "async_call", side_effect=guarded_call):
        yield ledger
    # Teardown, not the test body: this is what turns a passing test that
    # reached outside the fixture into a failing one.
    ledger.assert_contained()


@pytest.fixture
def assert_entry_state(config_entry: MockConfigEntry) -> Callable[[ConfigEntryState], None]:
    """Assert the public ConfigEntry state with a focused failure."""
    from homeassistant.config_entries import ConfigEntryState

    def assert_state(expected: ConfigEntryState) -> None:
        assert config_entry.state is expected

    return assert_state
