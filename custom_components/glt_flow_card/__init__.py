"""GLT Flow Card Companion 1.0.

Persistent projects, optimistic revisions, locks, server-side controls, alarm lifecycle,
schedules, work orders, reports, audit and optional remote Home Assistant sites.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store

from .const import (
    DEFAULT_LOCK_TTL,
    DOMAIN,
    MAX_AUDIT,
    MAX_VERSIONS,
    SAFE_SERVICE_DOMAINS,
    STORE_KEY,
    STORE_VERSION,
)


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user(connection) -> tuple[str | None, str | None, bool]:
    user = getattr(connection, "user", None)
    return (
        getattr(user, "id", None),
        getattr(user, "name", None),
        bool(getattr(user, "is_admin", False)),
    )


def _entity_id(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return str(value.get("entity") or value.get("entity_id") or "")
    return ""


def _project_role(project: dict[str, Any] | None, user_id: str | None, is_admin: bool) -> str:
    if is_admin:
        return "designer"
    permissions = (project or {}).get("config", {}).get("permissions", {})
    if user_id and user_id in permissions.get("designers", []):
        return "designer"
    if user_id and user_id in permissions.get("operators", []):
        return "operator"
    return "viewer"


def _role_at_least(role: str, required: str) -> bool:
    levels = {"viewer": 0, "operator": 1, "designer": 2}
    return levels.get(role, 0) >= levels.get(required, 0)


def _safe_domains(project: dict[str, Any] | None) -> set[str]:
    configured = (project or {}).get("config", {}).get("security", {}).get("allowed_service_domains")
    if isinstance(configured, list) and configured:
        return set(map(str, configured)) & SAFE_SERVICE_DOMAINS
    return set(SAFE_SERVICE_DOMAINS)


def _state_active(state: str | None, alarm: dict[str, Any], previous_active: bool = False) -> bool:
    raw = str(state or "").lower()
    active_states = [str(x).lower() for x in alarm.get("active_states", [])]
    inactive_states = [str(x).lower() for x in alarm.get("inactive_states", [])]
    cond = alarm.get("condition") or {}
    if cond.get("operator"):
        try:
            value = float(raw)
            threshold = float(cond.get("value"))
            hysteresis = float(alarm.get("hysteresis", 0) or 0)
        except (TypeError, ValueError):
            return False
        op = cond.get("operator")
        if op == ">":
            return value > threshold - (hysteresis if previous_active else 0)
        if op == ">=":
            return value >= threshold - (hysteresis if previous_active else 0)
        if op == "<":
            return value < threshold + (hysteresis if previous_active else 0)
        if op == "<=":
            return value <= threshold + (hysteresis if previous_active else 0)
        if op == "==":
            return value == threshold
        if op == "!=":
            return value != threshold
    if active_states:
        return raw in active_states
    if inactive_states:
        return raw not in inactive_states
    return raw not in {"off", "0", "ok", "normal", "none", "idle", "clear", "unavailable", "unknown", ""}


class GltStore:
    """Persistent GLT platform state."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self.data: dict[str, Any] = {
            "projects": {}, "templates": {}, "audit": [], "alarm_state": {},
            "alarm_history": [], "work_orders": {}, "report_history": [],
            "locks": {}, "schedule_runs": {},
        }
        self.remote_sites: dict[str, dict[str, Any]] = {}
        self._alarm_tasks: dict[str, asyncio.Task] = {}
        self._unsubs: list[Any] = []

    async def async_load(self) -> None:
        loaded = await self.store.async_load()
        if isinstance(loaded, dict):
            self.data.update(loaded)
        for key, default in {
            "projects": {}, "templates": {}, "audit": [], "alarm_state": {},
            "alarm_history": [], "work_orders": {}, "report_history": [],
            "locks": {}, "schedule_runs": {},
        }.items():
            self.data.setdefault(key, default)

    async def async_save(self) -> None:
        await self.store.async_save(self.data)

    async def add_audit(self, event: dict[str, Any], user_id: str | None, user_name: str | None) -> dict[str, Any]:
        entry = deepcopy(event)
        entry.setdefault("at", _utc())
        entry.setdefault("id", f"audit-{int(datetime.now(timezone.utc).timestamp()*1000)}")
        entry["user_id"] = user_id
        entry["user_name"] = user_name
        self.data["audit"].insert(0, entry)
        self.data["audit"] = self.data["audit"][:MAX_AUDIT]
        await self.async_save()
        return deepcopy(entry)

    def projects(self) -> list[dict[str, Any]]:
        result = list(self.data["projects"].values())
        result.sort(key=lambda item: item.get("updated", ""), reverse=True)
        return deepcopy(result)

    def project(self, project_id: str) -> dict[str, Any] | None:
        item = self.data["projects"].get(project_id)
        return deepcopy(item) if item else None

    async def save_project(self, project: dict[str, Any], autosave: bool, user_id: str | None, expected_revision: int | None = None) -> dict[str, Any]:
        project_id = str(project.get("id") or project.get("config", {}).get("project", {}).get("id") or "").strip()
        if not project_id:
            raise ValueError("project.id is required")
        old = self.data["projects"].get(project_id, {})
        old_revision = int(old.get("revision", 0))
        if expected_revision is not None and int(expected_revision) != old_revision:
            raise RuntimeError(f"revision_conflict:{old_revision}")
        versions = list(old.get("versions", []))
        if old.get("config") and not autosave:
            versions.insert(0, {
                "id": f"v-{int(datetime.now(timezone.utc).timestamp()*1000)}",
                "created": _utc(), "user_id": user_id,
                "revision": old_revision, "config": deepcopy(old["config"]),
            })
            versions = versions[:MAX_VERSIONS]
        entry = deepcopy(project)
        entry["id"] = project_id
        entry["revision"] = old_revision + 1
        entry["updated"] = _utc()
        entry["updated_by"] = user_id
        entry["versions"] = versions
        entry.setdefault("config", {})
        entry["config"].setdefault("schema_version", 1)
        entry["config"].setdefault("project", {})
        entry["config"]["project"].update({"id": project_id, "revision": entry["revision"]})
        self.data["projects"][project_id] = entry
        await self.async_save()
        return deepcopy(entry)

    async def delete_project(self, project_id: str) -> bool:
        existed = self.data["projects"].pop(project_id, None) is not None
        self.data["locks"].pop(project_id, None)
        if existed:
            await self.async_save()
        return existed

    async def lock_project(self, project_id: str, user_id: str | None, user_name: str | None, ttl: int) -> dict[str, Any]:
        self._prune_locks()
        lock = self.data["locks"].get(project_id)
        if lock and lock.get("user_id") != user_id:
            raise RuntimeError(f"locked_by:{lock.get('user_name') or lock.get('user_id')}")
        expires = datetime.now(timezone.utc) + timedelta(seconds=max(30, min(int(ttl), 3600)))
        entry = {"project_id": project_id, "user_id": user_id, "user_name": user_name, "expires": expires.isoformat()}
        self.data["locks"][project_id] = entry
        await self.async_save()
        return deepcopy(entry)

    async def unlock_project(self, project_id: str, user_id: str | None, is_admin: bool) -> bool:
        lock = self.data["locks"].get(project_id)
        if not lock:
            return True
        if not is_admin and lock.get("user_id") != user_id:
            raise PermissionError("project lock belongs to another user")
        self.data["locks"].pop(project_id, None)
        await self.async_save()
        return True

    def _prune_locks(self) -> None:
        now = datetime.now(timezone.utc)
        for pid, lock in list(self.data["locks"].items()):
            try:
                expired = datetime.fromisoformat(lock["expires"]) <= now
            except Exception:
                expired = True
            if expired:
                self.data["locks"].pop(pid, None)

    async def alarm_transition(self, project_id: str, alarm: dict[str, Any], active: bool, state: str | None) -> None:
        key = f"{project_id}:{alarm.get('id')}"
        current = self.data["alarm_state"].get(key, {})
        if bool(current.get("active")) == active:
            current["last_value"] = state
            self.data["alarm_state"][key] = current
            return
        now = _utc()
        next_state = {
            **current,
            "project_id": project_id, "alarm_id": alarm.get("id"),
            "name": alarm.get("name"), "severity": alarm.get("severity", "warning"),
            "active": active, "changed": now, "last_value": state,
        }
        if not active:
            next_state["cleared"] = now
            next_state["acknowledged"] = False
            next_state.pop("shelved_until", None)
        self.data["alarm_state"][key] = next_state
        self.data["alarm_history"].insert(0, {**deepcopy(next_state), "transition": "active" if active else "normal"})
        self.data["alarm_history"] = self.data["alarm_history"][:MAX_AUDIT]
        await self.async_save()
        if active:
            await self._notify_alarm(alarm)

    async def _notify_alarm(self, alarm: dict[str, Any]) -> None:
        notification = alarm.get("notification") or {}
        spec = notification.get("service")
        if not spec or "." not in spec:
            return
        domain, service = spec.split(".", 1)
        data = deepcopy(notification.get("data") or {})
        data.setdefault("message", notification.get("message") or f"GLT Alarm: {alarm.get('name') or alarm.get('id')}")
        try:
            await self.hass.services.async_call(domain, service, data, blocking=False)
        except Exception:
            return

    async def ack_alarm(self, project_id: str, alarm_id: str, user_id: str | None, user_name: str | None, comment: str) -> dict[str, Any]:
        key = f"{project_id}:{alarm_id}"
        state = self.data["alarm_state"].setdefault(key, {"project_id": project_id, "alarm_id": alarm_id})
        state.update({"acknowledged": True, "ack_at": _utc(), "ack_user_id": user_id, "ack_user_name": user_name, "ack_comment": comment})
        self.data["alarm_history"].insert(0, {**deepcopy(state), "transition": "ack"})
        await self.async_save()
        return deepcopy(state)

    async def shelve_alarm(self, project_id: str, alarm_id: str, minutes: int, user_id: str | None) -> dict[str, Any]:
        key = f"{project_id}:{alarm_id}"
        state = self.data["alarm_state"].setdefault(key, {"project_id": project_id, "alarm_id": alarm_id})
        state["shelved_until"] = (datetime.now(timezone.utc) + timedelta(minutes=max(1, min(int(minutes), 10080)))).isoformat()
        state["shelved_by"] = user_id
        await self.async_save()
        return deepcopy(state)

    async def save_work_order(self, work_order: dict[str, Any], user_id: str | None) -> dict[str, Any]:
        wid = str(work_order.get("id") or f"wo-{int(datetime.now(timezone.utc).timestamp()*1000)}")
        old = self.data["work_orders"].get(wid, {})
        entry = {**old, **deepcopy(work_order), "id": wid, "updated": _utc(), "updated_by": user_id}
        entry.setdefault("created", _utc())
        entry.setdefault("status", "open")
        self.data["work_orders"][wid] = entry
        await self.async_save()
        return deepcopy(entry)

    async def run_report(self, project_id: str, report_id: str, user_id: str | None) -> dict[str, Any]:
        project = self.data["projects"].get(project_id, {})
        config = project.get("config", {})
        definition = next((x for x in config.get("reports", {}).get("definitions", []) if x.get("id") == report_id), {"id": report_id, "name": report_id})
        snapshot = {"id": f"report-{int(datetime.now(timezone.utc).timestamp()*1000)}", "project_id": project_id, "report_id": report_id, "name": definition.get("name"), "created": _utc(), "created_by": user_id, "kpis": []}
        for kpi in config.get("kpis", []):
            eid = _entity_id(kpi.get("entity") or kpi)
            st = self.hass.states.get(eid) if eid else None
            snapshot["kpis"].append({"name": kpi.get("name") or kpi.get("label") or eid, "entity_id": eid, "state": st.state if st else None, "unit": st.attributes.get("unit_of_measurement") if st else None})
        self.data["report_history"].insert(0, snapshot)
        self.data["report_history"] = self.data["report_history"][:1000]
        await self.async_save()
        return deepcopy(snapshot)

    def configure_remote_sites(self, sites: list[dict[str, Any]]) -> None:
        self.remote_sites = {str(s.get("id")): deepcopy(s) for s in sites if s.get("id") and s.get("url") and s.get("token")}

    async def remote_states(self, site_id: str, entity_ids: list[str]) -> dict[str, Any]:
        site = self.remote_sites.get(site_id)
        if not site:
            raise ValueError("remote site not found")
        session = async_get_clientsession(self.hass, verify_ssl=site.get("verify_ssl", True))
        headers = {"Authorization": f"Bearer {site['token']}", "Content-Type": "application/json"}
        result = {}
        for entity_id in entity_ids[:200]:
            async with session.get(f"{site['url'].rstrip('/')}/api/states/{entity_id}", headers=headers, timeout=15) as resp:
                if resp.status == 200:
                    result[entity_id] = await resp.json()
                else:
                    result[entity_id] = {"state": "unavailable", "error": resp.status}
        return result

    async def remote_control(self, site_id: str, domain: str, service: str, data: dict[str, Any]) -> Any:
        site = self.remote_sites.get(site_id)
        if not site:
            raise ValueError("remote site not found")
        if domain not in SAFE_SERVICE_DOMAINS:
            raise PermissionError("service domain not allowed")
        session = async_get_clientsession(self.hass, verify_ssl=site.get("verify_ssl", True))
        headers = {"Authorization": f"Bearer {site['token']}", "Content-Type": "application/json"}
        async with session.post(f"{site['url'].rstrip('/')}/api/services/{domain}/{service}", headers=headers, json=data, timeout=15) as resp:
            if resp.status >= 300:
                raise RuntimeError(f"remote service failed: HTTP {resp.status}")
            return await resp.json()

    async def process_state_change(self, event) -> None:
        entity_id = event.data.get("entity_id")
        new_state = event.data.get("new_state")
        if not entity_id:
            return
        for project_id, project in list(self.data["projects"].items()):
            for alarm in project.get("config", {}).get("alarms", []):
                if _entity_id(alarm.get("entity")) != entity_id:
                    continue
                key = f"{project_id}:{alarm.get('id')}"
                current = self.data["alarm_state"].get(key, {})
                active = _state_active(getattr(new_state, "state", None), alarm, bool(current.get("active")))
                delay = int(alarm.get("delay_seconds", 0) or 0)
                if active and delay > 0 and not current.get("active"):
                    task = self._alarm_tasks.pop(key, None)
                    if task:
                        task.cancel()
                    async def delayed(pid=project_id, a=deepcopy(alarm), e=entity_id, k=key):
                        try:
                            await asyncio.sleep(delay)
                            st = self.hass.states.get(e)
                            cur = self.data["alarm_state"].get(k, {})
                            if _state_active(st.state if st else None, a, bool(cur.get("active"))):
                                await self.alarm_transition(pid, a, True, st.state if st else None)
                        except asyncio.CancelledError:
                            return
                    self._alarm_tasks[key] = self.hass.async_create_task(delayed())
                else:
                    task = self._alarm_tasks.pop(key, None)
                    if task and not active:
                        task.cancel()
                    await self.alarm_transition(project_id, alarm, active, getattr(new_state, "state", None))

    async def run_schedules(self, now: datetime) -> None:
        weekday = now.weekday()
        key_minute = now.strftime("%Y-%m-%dT%H:%M")
        dirty = False
        for project_id, project in list(self.data["projects"].items()):
            config = project.get("config", {})
            allowed = _safe_domains(project)
            for sched in config.get("schedules", []):
                if sched.get("enabled", True) is False:
                    continue
                if weekday not in sched.get("days", [0,1,2,3,4,5,6]):
                    continue
                if sched.get("time") != now.strftime("%H:%M"):
                    continue
                run_key = f"{project_id}:{sched.get('id')}:{key_minute}"
                if self.data["schedule_runs"].get(run_key):
                    continue
                spec = str(sched.get("service") or "")
                if "." not in spec:
                    continue
                domain, service = spec.split(".", 1)
                if domain not in allowed:
                    continue
                data = deepcopy(sched.get("data") or {})
                if sched.get("entity_id"):
                    data.setdefault("entity_id", sched["entity_id"])
                try:
                    await self.hass.services.async_call(domain, service, data, blocking=False)
                    self.data["schedule_runs"][run_key] = _utc()
                    dirty = True
                except Exception:
                    continue
        if dirty:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
            self.data["schedule_runs"] = {k:v for k,v in self.data["schedule_runs"].items() if k.split(":")[-1][:10] >= cutoff}
            await self.async_save()


def _manager(hass: HomeAssistant) -> GltStore:
    return hass.data[DOMAIN]["manager"]


def _project_for(hass: HomeAssistant, project_id: str) -> dict[str, Any] | None:
    return _manager(hass).data["projects"].get(project_id)


def _require_project_role(hass, connection, msg, required: str) -> tuple[dict[str, Any] | None, str | None, str | None, bool]:
    user_id, user_name, is_admin = _user(connection)
    project_id = str(msg.get("project_id") or "")
    project = _project_for(hass, project_id) if project_id else None
    role = _project_role(project, user_id, is_admin)
    if not _role_at_least(role, required):
        raise PermissionError(f"{required} role required")
    return project, user_id, user_name, is_admin


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/list"})
@websocket_api.async_response
async def ws_projects_list(hass, connection, msg):
    connection.send_result(msg["id"], _manager(hass).projects())


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/get", vol.Required("project_id"): str})
@websocket_api.async_response
async def ws_projects_get(hass, connection, msg):
    connection.send_result(msg["id"], _manager(hass).project(msg["project_id"]))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/save", vol.Required("project"): dict, vol.Optional("autosave", default=False): bool, vol.Optional("expected_revision"): int})
@websocket_api.async_response
async def ws_projects_save(hass, connection, msg):
    try:
        user_id, user_name, is_admin = _user(connection)
        project = msg["project"]
        pid = str(project.get("id") or project.get("config", {}).get("project", {}).get("id") or "")
        existing = _project_for(hass, pid)
        if existing and not _role_at_least(_project_role(existing, user_id, is_admin), "designer"):
            raise PermissionError("designer role required")
        result = await _manager(hass).save_project(project, msg["autosave"], user_id, msg.get("expected_revision"))
        await _manager(hass).add_audit({"action":"project.save","detail":{"project_id":pid,"revision":result["revision"]}}, user_id, user_name)
        connection.send_result(msg["id"], result)
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))
    except RuntimeError as err:
        connection.send_error(msg["id"], "revision_conflict", str(err))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_project", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/delete", vol.Required("project_id"): str})
@websocket_api.async_response
async def ws_projects_delete(hass, connection, msg):
    try:
        _require_project_role(hass, connection, msg, "designer")
        connection.send_result(msg["id"], await _manager(hass).delete_project(msg["project_id"]))
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/lock", vol.Required("project_id"): str, vol.Optional("ttl_seconds", default=DEFAULT_LOCK_TTL): int})
@websocket_api.async_response
async def ws_projects_lock(hass, connection, msg):
    try:
        _project, uid, uname, _admin = _require_project_role(hass, connection, msg, "designer")
        connection.send_result(msg["id"], await _manager(hass).lock_project(msg["project_id"], uid, uname, msg["ttl_seconds"]))
    except (PermissionError, RuntimeError) as err:
        connection.send_error(msg["id"], "locked", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/unlock", vol.Required("project_id"): str})
@websocket_api.async_response
async def ws_projects_unlock(hass, connection, msg):
    try:
        _project, uid, _uname, admin = _require_project_role(hass, connection, msg, "designer")
        connection.send_result(msg["id"], await _manager(hass).unlock_project(msg["project_id"], uid, admin))
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/list"})
@websocket_api.async_response
async def ws_templates_list(hass, connection, msg):
    data = list(_manager(hass).data["templates"].values())
    data.sort(key=lambda x: x.get("updated", ""), reverse=True)
    connection.send_result(msg["id"], deepcopy(data))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/save", vol.Required("template"): dict})
@websocket_api.async_response
async def ws_templates_save(hass, connection, msg):
    uid, _uname, admin = _user(connection)
    if not admin:
        connection.send_error(msg["id"], "forbidden", "admin required for global templates")
        return
    t = deepcopy(msg["template"])
    tid = str(t.get("id") or f"template-{int(datetime.now(timezone.utc).timestamp()*1000)}")
    t.update({"id":tid,"updated":_utc(),"updated_by":uid})
    _manager(hass).data["templates"][tid] = t
    await _manager(hass).async_save()
    connection.send_result(msg["id"], t)


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/delete", vol.Required("template_id"): str})
@websocket_api.async_response
async def ws_templates_delete(hass, connection, msg):
    _uid, _uname, admin = _user(connection)
    if not admin:
        connection.send_error(msg["id"], "forbidden", "admin required")
        return
    existed = _manager(hass).data["templates"].pop(msg["template_id"], None) is not None
    await _manager(hass).async_save()
    connection.send_result(msg["id"], existed)


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/control/execute", vol.Required("project_id"): str, vol.Required("entity_id"): str, vol.Required("domain"): str, vol.Required("service"): str, vol.Optional("service_data", default={}): dict})
@websocket_api.async_response
async def ws_control_execute(hass, connection, msg):
    try:
        project, uid, uname, _admin = _require_project_role(hass, connection, msg, "operator")
        domain = msg["domain"]
        if domain not in _safe_domains(project):
            raise PermissionError(f"service domain {domain} is not allowed")
        entity_id = msg["entity_id"]
        before = hass.states.get(entity_id)
        data = deepcopy(msg["service_data"])
        data.setdefault("entity_id", entity_id)
        await hass.services.async_call(domain, msg["service"], data, blocking=True, context=Context(user_id=uid))
        after = hass.states.get(entity_id)
        event = {"action":"control.execute","detail":{"project_id":msg["project_id"],"entity_id":entity_id,"service":f"{domain}.{msg['service']}","before":before.state if before else None,"after":after.state if after else None}}
        await _manager(hass).add_audit(event, uid, uname)
        connection.send_result(msg["id"], {"ok":True,"before":before.state if before else None,"after":after.state if after else None})
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))
    except Exception as err:
        connection.send_error(msg["id"], "service_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/alarms/list", vol.Optional("project_id"): str, vol.Optional("limit", default=500): int})
@websocket_api.async_response
async def ws_alarms_list(hass, connection, msg):
    pid = msg.get("project_id")
    states = [deepcopy(x) for x in _manager(hass).data["alarm_state"].values() if not pid or x.get("project_id") == pid]
    hist = [deepcopy(x) for x in _manager(hass).data["alarm_history"] if not pid or x.get("project_id") == pid][:msg["limit"]]
    connection.send_result(msg["id"], {"states":states,"history":hist})


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/alarms/ack", vol.Required("project_id"): str, vol.Required("alarm_id"): str, vol.Optional("comment", default=""): str})
@websocket_api.async_response
async def ws_alarms_ack(hass, connection, msg):
    try:
        _project, uid, uname, _admin = _require_project_role(hass, connection, msg, "operator")
        result = await _manager(hass).ack_alarm(msg["project_id"], msg["alarm_id"], uid, uname, msg["comment"])
        await _manager(hass).add_audit({"action":"alarm.ack","detail":{"project_id":msg["project_id"],"alarm_id":msg["alarm_id"],"comment":msg["comment"]}}, uid, uname)
        connection.send_result(msg["id"], result)
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/alarms/shelve", vol.Required("project_id"): str, vol.Required("alarm_id"): str, vol.Optional("minutes", default=60): int})
@websocket_api.async_response
async def ws_alarms_shelve(hass, connection, msg):
    try:
        _project, uid, _uname, _admin = _require_project_role(hass, connection, msg, "operator")
        connection.send_result(msg["id"], await _manager(hass).shelve_alarm(msg["project_id"], msg["alarm_id"], msg["minutes"], uid))
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/work_orders/list", vol.Optional("project_id"): str})
@websocket_api.async_response
async def ws_work_orders_list(hass, connection, msg):
    pid = msg.get("project_id")
    data = [deepcopy(x) for x in _manager(hass).data["work_orders"].values() if not pid or x.get("project_id") == pid]
    connection.send_result(msg["id"], data)


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/work_orders/save", vol.Required("project_id"): str, vol.Required("work_order"): dict})
@websocket_api.async_response
async def ws_work_orders_save(hass, connection, msg):
    try:
        _project, uid, _uname, _admin = _require_project_role(hass, connection, msg, "operator")
        work_order = {**msg["work_order"], "project_id":msg["project_id"]}
        connection.send_result(msg["id"], await _manager(hass).save_work_order(work_order, uid))
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/reports/run", vol.Required("project_id"): str, vol.Required("report_id"): str})
@websocket_api.async_response
async def ws_reports_run(hass, connection, msg):
    try:
        _project, uid, _uname, _admin = _require_project_role(hass, connection, msg, "operator")
        connection.send_result(msg["id"], await _manager(hass).run_report(msg["project_id"], msg["report_id"], uid))
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/reports/list", vol.Optional("project_id"): str})
@websocket_api.async_response
async def ws_reports_list(hass, connection, msg):
    pid = msg.get("project_id")
    connection.send_result(msg["id"], [deepcopy(x) for x in _manager(hass).data["report_history"] if not pid or x.get("project_id") == pid])


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/remote/list"})
@websocket_api.async_response
async def ws_remote_list(hass, connection, msg):
    sites = [{k:v for k,v in site.items() if k != "token"} for site in _manager(hass).remote_sites.values()]
    connection.send_result(msg["id"], sites)


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/remote/states", vol.Required("site_id"): str, vol.Required("entity_ids"): [str]})
@websocket_api.async_response
async def ws_remote_states(hass, connection, msg):
    try:
        connection.send_result(msg["id"], await _manager(hass).remote_states(msg["site_id"], msg["entity_ids"]))
    except Exception as err:
        connection.send_error(msg["id"], "remote_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/remote/control", vol.Required("project_id"): str, vol.Required("site_id"): str, vol.Required("domain"): str, vol.Required("service"): str, vol.Optional("service_data", default={}): dict})
@websocket_api.async_response
async def ws_remote_control(hass, connection, msg):
    try:
        _require_project_role(hass, connection, msg, "operator")
        result = await _manager(hass).remote_control(msg["site_id"], msg["domain"], msg["service"], msg["service_data"])
        connection.send_result(msg["id"], result)
    except Exception as err:
        connection.send_error(msg["id"], "remote_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/audit/add", vol.Required("event"): dict})
@websocket_api.async_response
async def ws_audit_add(hass, connection, msg):
    uid, uname, _admin = _user(connection)
    connection.send_result(msg["id"], await _manager(hass).add_audit(msg["event"], uid, uname))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/audit/list", vol.Optional("limit", default=250): vol.All(int, vol.Range(min=1, max=5000))})
@websocket_api.async_response
async def ws_audit_list(hass, connection, msg):
    connection.send_result(msg["id"], deepcopy(_manager(hass).data["audit"][:msg["limit"]]))


COMMANDS = (
    ws_projects_list, ws_projects_get, ws_projects_save, ws_projects_delete,
    ws_projects_lock, ws_projects_unlock, ws_templates_list, ws_templates_save,
    ws_templates_delete, ws_control_execute, ws_alarms_list, ws_alarms_ack,
    ws_alarms_shelve, ws_work_orders_list, ws_work_orders_save, ws_reports_run,
    ws_reports_list, ws_remote_list, ws_remote_states, ws_remote_control,
    ws_audit_add, ws_audit_list,
)


async def _ensure_manager(hass: HomeAssistant, yaml_config: dict[str, Any] | None = None) -> GltStore:
    if DOMAIN in hass.data and hass.data[DOMAIN].get("manager"):
        manager = hass.data[DOMAIN]["manager"]
    else:
        manager = GltStore(hass)
        await manager.async_load()
        hass.data.setdefault(DOMAIN, {})["manager"] = manager
        for command in COMMANDS:
            websocket_api.async_register_command(hass, command)
        async def state_listener(event):
            await manager.process_state_change(event)
        unsub_bus = hass.bus.async_listen("state_changed", state_listener)
        unsub_time = async_track_time_change(hass, manager.run_schedules, second=0)
        manager._unsubs.extend([unsub_bus, unsub_time])
    remote = (yaml_config or {}).get("remote_sites", []) if isinstance(yaml_config, dict) else []
    if remote:
        manager.configure_remote_sites(remote)
    return manager


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    yaml_config = config.get(DOMAIN, {}) if isinstance(config.get(DOMAIN, {}), dict) else {}
    await _ensure_manager(hass, yaml_config)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await _ensure_manager(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Single shared manager remains active while Home Assistant is running.
    return True
