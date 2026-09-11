import pytest

from .test_project_transactions import project

pytestmark = [pytest.mark.enable_socket, pytest.mark.allow_hosts(["127.0.0.1", "localhost"])]


async def test_admin_can_create_but_cannot_overwrite_with_create(hass, config_entry, phase2_users):
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    connection = await phase2_users.async_connect("ha_admin")
    message = {"type": "glt_flow_card/projects/create", "project": {
        "id": "new-live-project", "name": "New project", "config": project("new-live-project")}}
    result = await connection.command(message)
    assert result["success"], result
    assert result["result"]["revision"] == 1
    repeat = await connection.command(message)
    assert not repeat["success"]
    from custom_components.glt_flow_card import _runtime_for
    runtime = _runtime_for(hass)
    assert runtime.access.get("new-live-project").role_of(phase2_users.principal("ha_admin").user_id) == "admin"


async def test_viewer_cannot_bootstrap_a_project(hass, config_entry, phase2_users):
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    connection = await phase2_users.async_connect("viewer")
    result = await connection.command({"type": "glt_flow_card/projects/create", "project": {
        "id": "not-created", "config": project("not-created")}})
    assert not result["success"]
    from custom_components.glt_flow_card import _manager
    assert _manager(hass).project("not-created") is None
