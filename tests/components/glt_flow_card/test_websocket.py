"""Project transaction WebSocket boundary tests."""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .test_project_transactions import project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


async def command(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    return await client.receive_json()


async def test_websocket_preview_apply_rollback_and_authorization(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    hass_ws_client,
    hass_read_only_access_token: str,
) -> None:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    admin = await hass_ws_client(hass)

    candidate = project()
    preview = await command(admin, {
        "type": "glt_flow_card/projects/preview",
        "project_id": "plant-a",
        "expected_revision": 0,
        "candidate": candidate,
    })
    assert preview["success"] is True
    assert preview["result"]["base_revision"] == 0
    selected_ids = [operation["id"] for operation in preview["result"]["operations"]]

    applied = await command(admin, {
        "type": "glt_flow_card/projects/apply",
        "project_id": "plant-a",
        "preview_id": preview["result"]["preview_id"],
        "expected_revision": 0,
        "selected_ids": selected_ids,
    })
    assert applied["success"] is True
    assert applied["result"]["revision"] == 1
    assert applied["result"]["snapshot_id"].startswith("sha256:")

    forged = await command(admin, {
        "type": "glt_flow_card/projects/rollback",
        "project_id": "plant-a",
        "snapshot_id": "sha256:" + "0" * 64,
        "expected_revision": 1,
        "confirmation": "ROLLBACK plant-a",
    })
    assert forged["success"] is False
    assert forged["error"]["code"] == "invalid_snapshot"

    read_only = await hass_ws_client(hass, hass_read_only_access_token)
    denied = await command(read_only, {
        "type": "glt_flow_card/projects/preview",
        "project_id": "plant-a",
        "expected_revision": 1,
        "candidate": {
            **applied["result"]["config"],
            "project": {**applied["result"]["config"]["project"], "revision": 1},
        },
    })
    assert denied["success"] is False
    assert denied["error"]["code"] == "forbidden"

    await admin.close()
    await read_only.close()


async def test_compatibility_save_uses_transaction_coordinator(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    hass_ws_client,
) -> None:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    saved = await command(client, {
        "type": "glt_flow_card/projects/save",
        "project": {"id": "plant-a", "config": project()},
        "expected_revision": 0,
        "autosave": False,
    })
    assert saved["success"] is True
    assert saved["result"]["revision"] == 1
    assert saved["result"]["snapshot_id"].startswith("sha256:")

    manager = hass.data["glt_flow_card"]["manager"]
    assert manager.project_repository.get_head("plant-a") == saved["result"]
    assert manager.data["projects"]["plant-a"] == saved["result"]
    assert manager.project_transactions is not None
    await client.close()

