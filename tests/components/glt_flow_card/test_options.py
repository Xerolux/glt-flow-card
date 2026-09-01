"""Config Flow and atomic runtime option behavior."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.const import DOMAIN

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


async def test_user_flow_creates_one_entry_and_aborts_duplicates(
    hass: HomeAssistant,
) -> None:
    """The Companion remains a single-instance integration."""
    first = await hass.config_entries.flow.async_init(
        DOMAIN,
        context={"source": "user"},
    )
    assert first["type"] == "form"

    created = await hass.config_entries.flow.async_configure(
        first["flow_id"],
        user_input={},
    )
    assert created["type"] == "create_entry"

    duplicate = await hass.config_entries.flow.async_init(
        DOMAIN,
        context={"source": "user"},
    )
    assert duplicate["type"] == "abort"
    assert duplicate["reason"] == "single_instance_allowed"


async def test_options_schema_rejects_out_of_range_and_boolean_values(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
) -> None:
    """Every retained option has an explicit integer range."""
    flow = await hass.config_entries.options.async_init(config_entry.entry_id)
    schema = flow["data_schema"]

    assert schema(
        {
            "default_lock_ttl": 120,
            "max_versions": 20,
            "max_audit": 200,
        }
    ) == {
        "default_lock_ttl": 120,
        "max_versions": 20,
        "max_audit": 200,
    }
    for invalid in (
        {"default_lock_ttl": 29, "max_versions": 20, "max_audit": 200},
        {"default_lock_ttl": 120, "max_versions": 501, "max_audit": 200},
        {"default_lock_ttl": 120, "max_versions": 20, "max_audit": True},
    ):
        with pytest.raises(vol.Invalid):
            schema(invalid)


async def test_options_have_observable_runtime_and_retention_effects(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
) -> None:
    """TTL and both retention limits drive the loaded manager and repository."""
    hass.config_entries.async_update_entry(
        config_entry,
        options={
            "default_lock_ttl": 120,
            "max_versions": 5,
            "max_audit": 100,
        },
    )
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    from custom_components import glt_flow_card as integration

    manager = integration._manager(hass)
    assert manager.effective_options == {
        "default_lock_ttl": 120,
        "max_versions": 5,
        "max_audit": 100,
    }
    assert manager.project_repository.max_versions == 5
    assert manager.project_repository.max_audit == 100

    lock = await manager.lock_project("plant-a", "user-a", "User A", None)
    remaining = datetime.fromisoformat(lock["expires"]) - datetime.now(timezone.utc)
    assert 115 <= remaining.total_seconds() <= 120

    manager.data["audit"] = [{"id": f"legacy-{index}"} for index in range(100)]
    await manager.add_audit({"id": "new"}, "user-a", "User A")
    assert len(manager.data["audit"]) == 100
    assert manager.data["audit"][0]["id"] == "new"

    repository = manager.project_repository
    repository._audit["events"] = [
        {"id": f"project-{index}"} for index in range(100)
    ]
    await repository.append_audit({"id": "project-new"})
    assert len(repository.list_audit()) == 100

    for revision in range(6):
        await repository.put_snapshot(
            {
                "id": f"snapshot-{revision}",
                "project_id": "plant-a",
                "revision": revision,
                "digest": str(revision),
                "config": {},
            }
        )
    assert [
        snapshot["revision"]
        for snapshot in repository.list_snapshots("plant-a")
    ] == [1, 2, 3, 4, 5]


async def test_option_update_reloads_to_one_new_effective_runtime(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
) -> None:
    """A successful options update atomically replaces the loaded runtime."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    from custom_components import glt_flow_card as integration

    previous = integration._runtime_for(hass, config_entry.entry_id)
    hass.config_entries.async_update_entry(
        config_entry,
        options={
            "default_lock_ttl": 180,
            "max_versions": 10,
            "max_audit": 250,
        },
    )
    await hass.async_block_till_done()

    current = integration._runtime_for(hass, config_entry.entry_id)
    assert current is not None and current is not previous
    assert current.manager.effective_options == {
        "default_lock_ttl": 180,
        "max_versions": 10,
        "max_audit": 250,
    }
    assert len(hass.data[DOMAIN]["runtimes"]) == 1


async def test_failed_option_reload_restores_previous_effective_configuration(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
) -> None:
    """A failed candidate reload restores both stored and live prior options."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    from custom_components import glt_flow_card as integration

    previous_options = dict(config_entry.options)
    original_load = integration.GltStore.async_load
    failed = False

    async def fail_candidate_once(manager):
        nonlocal failed
        if manager.effective_options["max_versions"] == 10 and not failed:
            failed = True
            raise RuntimeError("candidate reload failed")
        await original_load(manager)

    with patch.object(integration.GltStore, "async_load", new=fail_candidate_once):
        hass.config_entries.async_update_entry(
            config_entry,
            options={
                "default_lock_ttl": 180,
                "max_versions": 10,
                "max_audit": 250,
            },
        )
        await hass.async_block_till_done()

    runtime = integration._runtime_for(hass, config_entry.entry_id)
    assert failed is True
    assert runtime is not None
    assert runtime.manager.effective_options == previous_options
    assert dict(config_entry.options) == previous_options


async def test_legacy_no_effect_options_are_removed_on_setup(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
) -> None:
    """Legacy bypass switches disappear while safe retained values survive."""
    hass.config_entries.async_update_entry(
        config_entry,
        options={
            "server_enforced": False,
            "default_lock_ttl": 90,
            "max_versions": 7,
            "max_audit": 150,
            "unused_legacy_flag": True,
        },
    )

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    assert dict(config_entry.options) == {
        "default_lock_ttl": 90,
        "max_versions": 7,
        "max_audit": 150,
    }
