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


EXPECTED_LOADED = {
    "commands": 25,
    "listeners": 2,
    "managers": 1,
    "stores": 1,
    "tasks": 0,
    "sessions": 0,
    "service_attempts": 0,
}
EXPECTED_UNLOADED = {
    "commands": 25,
    "listeners": 0,
    "managers": 0,
    "stores": 0,
    "tasks": 0,
    "sessions": 0,
    "service_attempts": 0,
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
    pending_alarm = asyncio.create_task(asyncio.sleep(3600))
    manager._alarm_tasks["test:pending"] = pending_alarm
    after_setup = lifecycle_effects.snapshot()

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
