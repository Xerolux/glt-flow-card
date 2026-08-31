"""Optional persistent project/audit backend for GLT Flow Card."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, MAX_AUDIT, MAX_VERSIONS, STORE_KEY, STORE_VERSION


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


class GltStore:
    """Small HA storage wrapper. Data never leaves Home Assistant."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self.data: dict[str, Any] = {"projects": {}, "templates": {}, "audit": []}

    async def async_load(self) -> None:
        loaded = await self.store.async_load()
        if isinstance(loaded, dict):
            self.data.update(loaded)
        self.data.setdefault("projects", {})
        self.data.setdefault("templates", {})
        self.data.setdefault("audit", [])

    async def async_save(self) -> None:
        await self.store.async_save(self.data)

    def projects(self) -> list[dict[str, Any]]:
        result = list(self.data["projects"].values())
        result.sort(key=lambda item: item.get("updated", ""), reverse=True)
        return deepcopy(result)

    def project(self, project_id: str) -> dict[str, Any] | None:
        item = self.data["projects"].get(project_id)
        return deepcopy(item) if item else None

    async def save_project(self, project: dict[str, Any], autosave: bool, user_id: str | None) -> dict[str, Any]:
        project_id = str(project.get("id") or "").strip()
        if not project_id:
            raise ValueError("project.id is required")
        old = self.data["projects"].get(project_id, {})
        versions = list(old.get("versions", []))
        if old.get("config") and not autosave:
            versions.insert(0, {
                "id": f"{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                "created": _utc(),
                "user_id": user_id,
                "config": deepcopy(old["config"]),
            })
            versions = versions[:MAX_VERSIONS]
        entry = deepcopy(project)
        entry["id"] = project_id
        entry["updated"] = _utc()
        entry["updated_by"] = user_id
        entry["versions"] = versions
        self.data["projects"][project_id] = entry
        await self.async_save()
        return deepcopy(entry)

    async def delete_project(self, project_id: str) -> bool:
        existed = self.data["projects"].pop(project_id, None) is not None
        if existed:
            await self.async_save()
        return existed

    def templates(self) -> list[dict[str, Any]]:
        result = list(self.data["templates"].values())
        result.sort(key=lambda item: item.get("updated", ""), reverse=True)
        return deepcopy(result)

    async def save_template(self, template: dict[str, Any]) -> dict[str, Any]:
        template_id = str(template.get("id") or "").strip()
        if not template_id:
            raise ValueError("template.id is required")
        entry = deepcopy(template)
        entry["updated"] = _utc()
        self.data["templates"][template_id] = entry
        await self.async_save()
        return deepcopy(entry)

    async def delete_template(self, template_id: str) -> bool:
        existed = self.data["templates"].pop(template_id, None) is not None
        if existed:
            await self.async_save()
        return existed

    async def add_audit(self, event: dict[str, Any], user_id: str | None, user_name: str | None) -> dict[str, Any]:
        entry = deepcopy(event)
        entry.setdefault("at", _utc())
        entry["user_id"] = user_id
        entry["user_name"] = user_name
        self.data["audit"].insert(0, entry)
        self.data["audit"] = self.data["audit"][:MAX_AUDIT]
        await self.async_save()
        return deepcopy(entry)


def _manager(hass: HomeAssistant) -> GltStore:
    return hass.data[DOMAIN]


def _user(connection) -> tuple[str | None, str | None]:
    user = getattr(connection, "user", None)
    return getattr(user, "id", None), getattr(user, "name", None)


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/list"})
@websocket_api.async_response
async def ws_projects_list(hass, connection, msg):
    connection.send_result(msg["id"], _manager(hass).projects())


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/get", vol.Required("project_id"): str})
@websocket_api.async_response
async def ws_projects_get(hass, connection, msg):
    connection.send_result(msg["id"], _manager(hass).project(msg["project_id"]))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/save", vol.Required("project"): dict, vol.Optional("autosave", default=False): bool})
@websocket_api.async_response
async def ws_projects_save(hass, connection, msg):
    try:
        user_id, _ = _user(connection)
        result = await _manager(hass).save_project(msg["project"], msg["autosave"], user_id)
        connection.send_result(msg["id"], result)
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_project", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/delete", vol.Required("project_id"): str})
@websocket_api.async_response
async def ws_projects_delete(hass, connection, msg):
    connection.send_result(msg["id"], await _manager(hass).delete_project(msg["project_id"]))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/list"})
@websocket_api.async_response
async def ws_templates_list(hass, connection, msg):
    connection.send_result(msg["id"], _manager(hass).templates())


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/save", vol.Required("template"): dict})
@websocket_api.async_response
async def ws_templates_save(hass, connection, msg):
    try:
        connection.send_result(msg["id"], await _manager(hass).save_template(msg["template"]))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_template", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/delete", vol.Required("template_id"): str})
@websocket_api.async_response
async def ws_templates_delete(hass, connection, msg):
    connection.send_result(msg["id"], await _manager(hass).delete_template(msg["template_id"]))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/audit/add", vol.Required("event"): dict})
@websocket_api.async_response
async def ws_audit_add(hass, connection, msg):
    user_id, user_name = _user(connection)
    connection.send_result(msg["id"], await _manager(hass).add_audit(msg["event"], user_id, user_name))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/audit/list", vol.Optional("limit", default=200): vol.All(int, vol.Range(min=1, max=1000))})
@websocket_api.async_response
async def ws_audit_list(hass, connection, msg):
    connection.send_result(msg["id"], deepcopy(_manager(hass).data["audit"][: msg["limit"]]))


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    manager = GltStore(hass)
    await manager.async_load()
    hass.data[DOMAIN] = manager
    for command in (
        ws_projects_list, ws_projects_get, ws_projects_save, ws_projects_delete,
        ws_templates_list, ws_templates_save, ws_templates_delete,
        ws_audit_add, ws_audit_list,
    ):
        websocket_api.async_register_command(hass, command)
    return True
