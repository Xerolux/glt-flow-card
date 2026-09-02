"""Alarm state is filtered to the projects a caller may read.

`glt_flow_card/alarms/list` is declared `enumeration="filter"`, which means the
policy guard deliberately admits an unauthorized caller: refusing would itself
tell them that rows exist. Filtering is therefore the handler's job — and the
handler did not do it. Any authenticated Home Assistant user who named a
project id received that project's complete alarm state and history.

These tests are written the way the leak was found: a principal with no
membership at all, naming a project directly.
"""
from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

OPEN_PROJECT = "enumeration-open"
HIDDEN_PROJECT = "enumeration-hidden"


async def _seed(hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users) -> None:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for

    manager = _manager(hass)
    for project_id, label in ((OPEN_PROJECT, "Pump running dry"),
                              (HIDDEN_PROJECT, "Burner fault on the plant you cannot see")):
        manager.data["alarm_state"][f"{project_id}:alm"] = {
            "project_id": project_id, "alarm_id": "alm", "active": True, "label": label,
        }
        manager.data["alarm_history"].insert(0, {
            "project_id": project_id, "alarm_id": "alm", "transition": "active", "label": label,
        })

    runtime = _runtime_for(hass)
    await runtime.access.async_assign(
        project_id=OPEN_PROJECT,
        user_id=phase2_users.principal("viewer").user_id,
        role="viewer",
    )


async def test_an_unassigned_caller_reads_no_alarm_at_all(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """The shape of the leak as it was found."""
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("unassigned")
    response = await connection.command({
        "type": "glt_flow_card/alarms/list", "project_id": HIDDEN_PROJECT, "limit": 50,
    })
    assert response["success"] is True, "a filtered route must not deny"
    assert response["result"] == {"states": [], "history": []}
    await phase2_users.async_close()


async def test_a_member_reads_their_own_project_and_no_other(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/alarms/list", "project_id": OPEN_PROJECT, "limit": 50,
    })
    result = response["result"]
    assert {row["project_id"] for row in result["states"]} == {OPEN_PROJECT}
    assert {row["project_id"] for row in result["history"]} == {OPEN_PROJECT}
    await phase2_users.async_close()


async def test_naming_a_hidden_project_is_answered_like_an_empty_one(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """A member of one project learns nothing about another by naming it."""
    await _seed(hass, config_entry, phase2_users)
    connection = await phase2_users.async_connect("viewer")
    hidden = await connection.command({
        "type": "glt_flow_card/alarms/list", "project_id": HIDDEN_PROJECT, "limit": 50,
    })
    absent = await connection.command({
        "type": "glt_flow_card/alarms/list", "project_id": "no-such-project", "limit": 50,
    })
    assert hidden["result"] == absent["result"] == {"states": [], "history": []}
    await phase2_users.async_close()


async def test_the_limit_is_not_a_count_oracle(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Rows are filtered before the limit, so a hidden project cannot consume a page.

    Slicing first would let an unauthorized project's rows fill the caller's
    page. The caller would see fewer rows than they hold, and the difference
    would count what they may not see.
    """
    await _seed(hass, config_entry, phase2_users)
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    # Twenty hidden rows ahead of the visible one in the newest-first history.
    for index in range(20):
        manager.data["alarm_history"].insert(0, {
            "project_id": HIDDEN_PROJECT, "alarm_id": f"noise-{index}", "transition": "active",
        })

    connection = await phase2_users.async_connect("viewer")
    response = await connection.command({
        "type": "glt_flow_card/alarms/list", "project_id": OPEN_PROJECT, "limit": 5,
    })
    history = response["result"]["history"]
    assert len(history) == 1, "the caller's own row was pushed out by rows they cannot see"
    assert history[0]["project_id"] == OPEN_PROJECT
    await phase2_users.async_close()
