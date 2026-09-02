"""Config Entry lifecycle RED seed for the GLT Flow Card Companion."""
from __future__ import annotations

from collections.abc import Callable
import asyncio
import inspect
import json
from unittest.mock import patch

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects


#: One listener at load, not two.
#:
#: Phase 6 replaced the bare `state_changed` bus listener with an
#: entity-filtered `async_track_state_change_event` that follows the alarm
#: index. This fixture configures no projects, so there are no alarmed entities
#: and there is nothing to subscribe to -- previously the integration listened
#: to *every* state change in the instance even with zero alarms configured.
#: `test_the_alarm_subscription_is_tracked_and_released` covers the case where
#: entities do exist, so the ledger still proves the new subscription is
#: released rather than merely absent.
EXPECTED_LOADED = {
    "commands": 45,
    "listeners": 1,
    "managers": 1,
    "stores": 1,
    "tasks": 0,
    "sessions": 0,
    "service_attempts": 0,
    "subscriptions": 0,
    "cursors": 0,
    "leases": 0,
    "control_waits": 0,
    "rate_buckets": 0,
    "provenance_cache": 0,
    "late_callbacks": 0,
}
EXPECTED_UNLOADED = {
    "commands": 45,
    "listeners": 0,
    "managers": 0,
    "stores": 0,
    "tasks": 0,
    "sessions": 0,
    "service_attempts": 0,
    "subscriptions": 0,
    "cursors": 0,
    "leases": 0,
    "control_waits": 0,
    "rate_buckets": 0,
    "provenance_cache": 0,
    "late_callbacks": 0,
}


def comparable(snapshot: dict[str, object]) -> dict[str, object]:
    """Remove diagnostic command names from exact count comparisons."""
    return {key: value for key, value in snapshot.items() if key != "command_names"}


@pytest.mark.enable_socket
@pytest.mark.allow_hosts(["127.0.0.1", "localhost"])
async def test_config_entry_lifecycle_is_resource_exact(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    assert_entry_state: Callable[[ConfigEntryState], None],
) -> None:
    """Set up, reload, unload, and re-setup through supported HA interfaces."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert_entry_state(ConfigEntryState.LOADED)
    from custom_components import glt_flow_card as integration

    manager = integration._manager(hass)
    after_setup = lifecycle_effects.snapshot()
    pending_alarm = asyncio.create_task(asyncio.sleep(3600))
    manager._alarm_tasks["test:pending"] = pending_alarm

    assert await hass.config_entries.async_reload(config_entry.entry_id)
    await hass.async_block_till_done()
    assert_entry_state(ConfigEntryState.LOADED)
    after_reload = lifecycle_effects.snapshot()

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    assert_entry_state(ConfigEntryState.NOT_LOADED)
    after_unload = lifecycle_effects.snapshot()

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert_entry_state(ConfigEntryState.LOADED)
    after_re_setup = lifecycle_effects.snapshot()

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    assert_entry_state(ConfigEntryState.NOT_LOADED)
    after_final_unload = lifecycle_effects.snapshot()

    assert pending_alarm.done()
    assert pending_alarm.cancelled()

    evidence = {
        "setup": after_setup,
        "reload": after_reload,
        "unload": after_unload,
        "re_setup": after_re_setup,
        "final_unload": after_final_unload,
    }
    print(f"LIFECYCLE_EFFECTS {json.dumps(evidence, sort_keys=True)}")

    expected = {
        "setup": EXPECTED_LOADED,
        "reload": EXPECTED_LOADED,
        "unload": EXPECTED_UNLOADED,
        "re_setup": EXPECTED_LOADED,
        "final_unload": EXPECTED_UNLOADED,
    }
    actual = {name: comparable(snapshot) for name, snapshot in evidence.items()}
    if actual != expected:
        raise AssertionError(
            "EXPECTED_RED[missing-lifecycle-cleanup]: exact lifecycle resources remain after unload"
        )


class _Connection:
    """Minimal supported command connection surface for availability checks."""

    def __init__(self) -> None:
        self.errors: list[tuple[int, str, str]] = []
        self.results: list[tuple[int, object]] = []

    def send_error(self, msg_id: int, code: str, message: str) -> None:
        self.errors.append((msg_id, code, message))

    def send_result(self, msg_id: int, result: object) -> None:
        self.results.append((msg_id, result))


@pytest.mark.enable_socket
@pytest.mark.allow_hosts(["127.0.0.1", "localhost"])
async def test_commands_resolve_only_loaded_runtime(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Component-scope commands remain registered but fail closed after unload."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    command = lifecycle_effects.registered_commands["ws_projects_list"]

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()

    connection = _Connection()
    pending = command(hass, connection, {"id": 7, "type": "glt_flow_card/projects/list"})
    if inspect.isawaitable(pending):
        await pending
    await hass.async_block_till_done()

    assert connection.results == []
    assert connection.errors == [
        (7, "not_loaded", "GLT Flow Card Companion is not loaded"),
    ]


@pytest.mark.enable_socket
@pytest.mark.allow_hosts(["127.0.0.1", "localhost"])
async def test_recovery_finishes_before_runtime_is_available(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """A Config Entry is not observable until transaction recovery completes."""
    from custom_components import glt_flow_card as integration

    original_recover = integration.ProjectTransactionCoordinator.async_recover
    observations: list[bool] = []

    async def observe_recovery(coordinator):
        observations.append(integration._runtime_for(hass, config_entry.entry_id) is None)
        return await original_recover(coordinator)

    with patch.object(
        integration.ProjectTransactionCoordinator,
        "async_recover",
        new=observe_recovery,
    ):
        assert await hass.config_entries.async_setup(config_entry.entry_id)
        await hass.async_block_till_done()

    assert observations == [True]
    assert integration._runtime_for(hass, config_entry.entry_id) is not None
    assert await hass.config_entries.async_unload(config_entry.entry_id)


@pytest.mark.enable_socket
@pytest.mark.allow_hosts(["127.0.0.1", "localhost"])
async def test_phase2_user_factory_creates_distinct_authenticated_principals(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """Every Phase-2 principal is a real HA identity with its own access token."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    keys = ("viewer", "operator", "engineer", "engineer_two", "admin", "ha_admin", "unassigned")
    principals = [phase2_users.principal(key) for key in keys]
    assert len({principal.user_id for principal in principals}) == len(keys)
    assert [principal.is_admin for principal in principals] == [
        False, False, False, False, False, True, False
    ]
    assert phase2_users.principal("admin").project_role == "admin"
    assert phase2_users.principal("ha_admin").project_role is None

    token_a = await phase2_users.async_access_token("engineer", session="a")
    token_b = await phase2_users.async_access_token("engineer", session="b")
    assert token_a != token_b


@pytest.mark.enable_socket
@pytest.mark.allow_hosts(["127.0.0.1", "localhost"])
async def test_phase2_user_factory_binds_connections_and_sessions(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """Two connections for one user differ, and reconnect never reuses a session."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    first = await phase2_users.async_connect("engineer", session="a")
    second = await phase2_users.async_connect("engineer", session="b")
    other = await phase2_users.async_connect("engineer_two")

    assert first.user_id == second.user_id
    assert first.session_id != second.session_id
    assert first.connection_id != second.connection_id
    assert other.user_id != first.user_id

    await phase2_users.async_disconnect(first)
    reconnected = await phase2_users.async_connect("engineer")
    assert reconnected.session_id != first.session_id
    assert reconnected.connection_id != first.connection_id

    await phase2_users.async_close()


@pytest.mark.enable_socket
@pytest.mark.allow_hosts(["127.0.0.1", "localhost"])
async def test_controlled_service_fixture_defaults_to_zero_allowed_calls(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    controlled_service,
) -> None:
    """The controlled fake service records exact payloads and allows none by default."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    assert controlled_service.allowed == ()
    assert controlled_service.calls == []

    controlled_service.allow("switch", "turn_on")
    await hass.services.async_call(
        "switch", "turn_on", {"entity_id": "switch.pump"}, blocking=True
    )
    assert len(controlled_service.calls) == 1
    recorded = controlled_service.calls[0]
    assert recorded["domain"] == "switch"
    assert recorded["service"] == "turn_on"
    assert recorded["data"] == {"entity_id": "switch.pump"}
    assert recorded["context_id"]

    with pytest.raises(AssertionError):
        await hass.services.async_call("light", "turn_on", {}, blocking=True)


@pytest.mark.enable_socket
@pytest.mark.allow_hosts(["127.0.0.1", "localhost"])
async def test_lifecycle_ledger_accounts_for_every_phase2_resource(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Phase-2 runtime resources are counted and return to zero after unload."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    snapshot = lifecycle_effects.snapshot()
    for counter in (
        "subscriptions",
        "cursors",
        "leases",
        "control_waits",
        "rate_buckets",
        "late_callbacks",
    ):
        assert counter in snapshot, counter

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    after = lifecycle_effects.snapshot()
    assert lifecycle_effects.phase2_resource_total(after) == 0

    lifecycle_effects.reset()
    assert lifecycle_effects.service_attempts == []


async def test_the_alarm_subscription_is_tracked_and_released(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """An installation with alarms holds one more listener, and gives it back.

    The count in `EXPECTED_LOADED` is zero-alarm by construction, so on its own
    it would pass just as well against a subscription that was never created.
    This is the other half: with an alarmed entity present the ledger sees the
    subscription, and after unload it sees nothing.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    baseline = lifecycle_effects.snapshot()["listeners"]
    manager = _manager(hass)
    manager.data["projects"]["plant-a"] = {
        "id": "plant-a",
        "config": {"alarms": [{"id": "alm", "entity": "binary_sensor.x",
                               "active_states": ["on"]}], "schedules": []},
    }
    manager.async_refresh_alarm_subscription()
    assert lifecycle_effects.snapshot()["listeners"] == baseline + 1

    # Re-subscribing replaces rather than accumulates: a refresh per project
    # save would otherwise leak one listener each time.
    manager.async_refresh_alarm_subscription()
    assert lifecycle_effects.snapshot()["listeners"] == baseline + 1

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()
    assert lifecycle_effects.snapshot()["listeners"] == 0
