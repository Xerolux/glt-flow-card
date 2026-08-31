"""Config Entry lifecycle RED seed for the GLT Flow Card Companion."""
from __future__ import annotations

from collections.abc import Callable
import json

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects


EXPECTED_LOADED = {
    "commands": 22,
    "listeners": 2,
    "managers": 1,
    "stores": 1,
    "tasks": 0,
    "sessions": 0,
    "service_attempts": 0,
}
EXPECTED_UNLOADED = {
    "commands": 22,
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
