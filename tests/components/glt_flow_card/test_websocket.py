"""Project transaction WebSocket boundary tests.

Phase 2 moved every shared mutation behind the policy boundary, so these tests
now assert the fail-closed contract rather than the pre-Phase-2 one: a write
with no lease evidence is refused before it reaches the transaction
coordinator, and denial codes are the stable non-enumerating set. Plan 02-09
restores the full guarded preview/apply/rollback flow once leases exist.
"""
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

#: Routes that mutate shared project state. None of them may succeed without a
#: connection-bound lease, and none of them may leave a trace when refused.
MUTATION_REQUESTS: tuple[tuple[str, dict[str, Any]], ...] = (
    (
        "glt_flow_card/projects/preview",
        {"project_id": "plant-a", "expected_revision": 0, "candidate": {}},
    ),
    (
        "glt_flow_card/projects/apply",
        {
            "project_id": "plant-a",
            "preview_id": "any",
            "expected_revision": 0,
            "selected_ids": [],
        },
    ),
    (
        "glt_flow_card/projects/rollback",
        {
            "project_id": "plant-a",
            "snapshot_id": "sha256:" + "0" * 64,
            "expected_revision": 0,
            "confirmation": "ROLLBACK plant-a",
        },
    ),
    ("glt_flow_card/projects/delete", {"project_id": "plant-a"}),
)


async def command(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    return await client.receive_json()


async def test_shared_mutations_are_refused_without_lease_evidence(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """A capable engineer still cannot write without a lease, and nothing changes."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    engineer = phase2_users.principal("engineer")
    access = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id].access
    await access.async_assign(project_id="plant-a", user_id=engineer.user_id, role="admin")

    manager = hass.data["glt_flow_card"]["manager"]
    before = manager.project_repository.list_heads()
    connection = await phase2_users.async_connect("engineer")

    for route, payload in MUTATION_REQUESTS:
        response = await connection.command({"type": route, **payload})
        assert response["success"] is False, route
        assert response["error"]["code"] == "lease_required", route

    assert manager.project_repository.list_heads() == before
    await phase2_users.async_close()


async def test_compatibility_save_is_refused_without_lease_evidence(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    phase2_users,
) -> None:
    """The legacy save route is guarded exactly like every other mutation."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    engineer = phase2_users.principal("engineer")
    access = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id].access
    await access.async_assign(project_id="plant-a", user_id=engineer.user_id, role="engineer")
    client = await phase2_users.async_connect("engineer")

    saved = await client.command({
        "type": "glt_flow_card/projects/save",
        "project": {"id": "plant-a", "config": project()},
        "expected_revision": 0,
        "autosave": False,
    })
    assert saved["success"] is False
    assert saved["error"]["code"] == "lease_required"

    manager = hass.data["glt_flow_card"]["manager"]
    assert manager.project_repository.get_head("plant-a") is None
    assert manager.project_transactions is not None
    await phase2_users.async_close()


async def test_reads_are_authorized_and_do_not_enumerate(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    hass_ws_client,
    phase2_users,
) -> None:
    """An assigned reader sees a project; everyone else cannot tell it exists."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    viewer = phase2_users.principal("viewer")
    manager = hass.data["glt_flow_card"]["manager"]
    await manager.save_project(
        {"id": "plant-a", "config": project()},
        autosave=False,
        user_id=viewer.user_id,
        expected_revision=0,
    )

    access = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id].access
    await access.async_assign(project_id="plant-a", user_id=viewer.user_id, role="viewer")

    assigned = await phase2_users.async_connect("viewer")
    listed = await assigned.command({"type": "glt_flow_card/projects/list"})
    assert listed["success"] is True
    assert [entry["id"] for entry in listed["result"]] == ["plant-a"]

    unassigned = await phase2_users.async_connect("unassigned")
    hidden = await unassigned.command({"type": "glt_flow_card/projects/list"})
    assert hidden["success"] is True
    assert hidden["result"] == []

    denied = await unassigned.command({
        "type": "glt_flow_card/projects/get",
        "project_id": "plant-a",
    })
    missing = await unassigned.command({
        "type": "glt_flow_card/projects/get",
        "project_id": "no-such-plant",
    })
    assert denied["success"] is False
    assert denied["error"]["code"] == "not_found_or_denied"
    assert denied["error"] == missing["error"]

    await phase2_users.async_close()


async def test_retired_and_deferred_routes_fail_closed(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    hass_ws_client,
) -> None:
    """Legacy locks, caller-selected control and remote transport are inert."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    for payload in (
        {"type": "glt_flow_card/projects/lock", "project_id": "plant-a"},
        {"type": "glt_flow_card/projects/unlock", "project_id": "plant-a"},
        {
            "type": "glt_flow_card/control/execute",
            "project_id": "plant-a",
            "entity_id": "switch.pump",
            "domain": "switch",
            "service": "turn_on",
        },
        {"type": "glt_flow_card/audit/add", "event": {"action": "forged"}},
        {"type": "glt_flow_card/remote/list"},
        {"type": "glt_flow_card/remote/states", "site_id": "x", "entity_ids": []},
    ):
        response = await command(client, payload)
        assert response["success"] is False, payload["type"]
        assert response["error"]["code"] == "feature_unavailable", payload["type"]

    await client.close()
