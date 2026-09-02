"""GLT Flow Card Companion 1.0.

Persistent projects, optimistic revisions, locks, server-side controls, alarm lifecycle,
schedules, work orders, reports, audit and optional remote Home Assistant sites.
"""
from __future__ import annotations

import asyncio
import itertools
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store

from uuid import uuid4

from .configured_controls import (
    ControlRateLimiter,
    ControlRejected,
    preview_payload,
    resolve_control,
)
from .const import (
    DOMAIN,
    MAX_AUDIT,
    SAFE_SERVICE_DOMAINS,
    STORE_KEY,
    STORE_VERSION,
    LEGACY_AUDIT_LABEL,
    migrate_options,
    normalize_options,
)
from .policy import (
    POLICY_VERSION,
    PolicyCoordinator,
    PolicyDenied,
    capabilities_for,
)
from .policy_sessions import (
    CursorInvalid,
    EvidenceCursorRegistry,
    SubscriptionDenied,
    SubscriptionRegistry,
)
from .trusted_evidence import (
    ControlEvidenceRecorder,
    TelemetryRejected,
    TelemetryStore,
    TrustedEvidenceStore,
)
from .project_access import AccessConflict, ProjectAccessRepository
from .navigation import portfolio as roll_up_portfolio, resolve_address
from .panels import addressable_objects, compose_panel
from .provenance import ProvenanceService
from .view_stream import SnapshotRefused, ViewStreamService
from .policy import ROLES
from .project_leases import (
    DEFAULT_TTL_SECONDS,
    MAX_TTL_SECONDS,
    MIN_TTL_SECONDS,
    PURPOSE_CAPABILITY,
    PURPOSE_ENGINEERING,
    PURPOSE_MEMBERSHIP_ADMIN,
    PURPOSES,
    LeaseDenied,
    LeaseInvalid,
    LeaseRegistry,
)
from .project_repository import ProjectRepository
from .project_transactions import (
    MutationDenied,
    MutationGuard,
    ProjectTransactionCoordinator,
    TransactionConflict,
)

#: How long a browser may treat one capability snapshot as fresh. The client
#: refreshes at half of this; at the end of it, shared mode goes read-only
#: whether or not a refresh has been attempted.
CAPABILITY_SNAPSHOT_SECONDS = 300

#: How many entities one provenance request may name. A bound here keeps a
#: single request from walking a large installation's whole registry.
MAX_PROVENANCE_ENTITIES = 200


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

    def __init__(self, hass: HomeAssistant, options: dict[str, int] | None = None) -> None:
        self.hass = hass
        self.effective_options = normalize_options(options or {})
        self.store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self.data: dict[str, Any] = {
            "projects": {}, "templates": {}, "audit": [], "alarm_state": {},
            "alarm_history": [], "work_orders": {}, "report_history": [],
            "locks": {}, "schedule_runs": {},
        }
        self.remote_sites: dict[str, dict[str, Any]] = {}
        self._alarm_tasks: dict[str, asyncio.Task] = {}
        self._unsubs: list[Any] = []
        self.project_repository = ProjectRepository(
            hass,
            max_versions=self.effective_options["max_versions"],
            max_audit=self.effective_options["max_audit"],
        )
        self.project_transactions = ProjectTransactionCoordinator(self.project_repository)
        self._legacy_projects: dict[str, Any] = {}

    async def async_load(self) -> None:
        loaded = await self.store.async_load()
        if isinstance(loaded, dict):
            self.data.update(loaded)
            self._legacy_projects = deepcopy(loaded.get("projects", {}))
        for key, default in {
            "projects": {}, "templates": {}, "audit": [], "alarm_state": {},
            "alarm_history": [], "work_orders": {}, "report_history": [],
            "locks": {}, "schedule_runs": {},
        }.items():
            self.data.setdefault(key, default)
        self._migrate_legacy_authority()
        await self.project_repository.async_initialize()
        await self.project_transactions.async_recover()
        self.data["projects"] = {
            project["id"]: project for project in self.project_repository.list_heads()
        }

    def _migrate_legacy_authority(self) -> None:
        """Retire persisted legacy authority without creating any new authority.

        Legacy locks were rows in a file; Phase-2 leases are ephemeral,
        connection-bound capabilities. A persisted lock therefore cannot become
        a lease - there is no connection to bind it to and nobody is holding it
        - so it is dropped. The alternative, minting a lease for whoever the
        file names, would hand an absent browser an exclusive editor on upgrade.

        Legacy audit rows are kept and labelled instead of deleted: throwing
        away a site's history would be its own kind of dishonesty. The label
        makes them unmistakable for Phase-2 trusted evidence, which is authored
        by the server and lives in a different store entirely.

        Both steps are idempotent: a second load finds no locks to drop and no
        unlabelled rows to label.
        """
        if self.data.get("locks"):
            self.data["locks"] = {}
        events = self.data.get("audit")
        if not isinstance(events, list):
            return
        for event in events:
            if isinstance(event, dict) and event.get("provenance") != LEGACY_AUDIT_LABEL:
                event["provenance"] = LEGACY_AUDIT_LABEL
                event["trusted"] = False

    async def async_save(self) -> None:
        legacy_payload = deepcopy(self.data)
        legacy_payload["projects"] = deepcopy(self._legacy_projects)
        await self.store.async_save(legacy_payload)

    async def async_close(self) -> None:
        """Release every runtime resource owned by this manager."""
        unsubs, self._unsubs = self._unsubs, []
        for unsubscribe in reversed(unsubs):
            unsubscribe()

        tasks, self._alarm_tasks = list(self._alarm_tasks.values()), {}
        for task in tasks:
            if not task.done():
                task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        self.remote_sites.clear()
        self.project_transactions._previews.clear()

    async def add_audit(self, event: dict[str, Any], user_id: str | None, user_name: str | None) -> dict[str, Any]:
        entry = deepcopy(event)
        entry.setdefault("at", _utc())
        entry.setdefault("id", f"audit-{int(datetime.now(timezone.utc).timestamp()*1000)}")
        entry["user_id"] = user_id
        entry["user_name"] = user_name
        self.data["audit"].insert(0, entry)
        self.data["audit"] = self.data["audit"][: self.effective_options["max_audit"]]
        await self.async_save()
        return deepcopy(entry)

    def projects(self) -> list[dict[str, Any]]:
        return self.project_repository.list_heads()

    def project(self, project_id: str) -> dict[str, Any] | None:
        return self.project_repository.get_head(project_id)

    async def save_project(
        self,
        project: dict[str, Any],
        autosave: bool,
        user_id: str | None,
        expected_revision: int | None = None,
        guard: MutationGuard | None = None,
    ) -> dict[str, Any]:
        entry = await self.project_transactions.compatibility_save(
            user_id=user_id,
            project=project,
            expected_revision=expected_revision,
            autosave=autosave,
            lease=guard,
        )
        self.data["projects"][entry["id"]] = deepcopy(entry)
        return entry

    async def delete_project(
        self, project_id: str, guard: MutationGuard | None = None
    ) -> bool:
        """Delete one project, re-authorizing immediately before the write."""
        await self.project_transactions._check_guard(guard)
        existed = await self.project_repository.delete_head(project_id)
        self.data["projects"].pop(project_id, None)
        self.data["locks"].pop(project_id, None)
        if existed:
            await self.async_save()
        return existed

    async def lock_project(self, project_id: str, user_id: str | None, user_name: str | None, ttl: int | None) -> dict[str, Any]:
        self._prune_locks()
        lock = self.data["locks"].get(project_id)
        if lock and lock.get("user_id") != user_id:
            raise RuntimeError(f"locked_by:{lock.get('user_name') or lock.get('user_id')}")
        effective_ttl = self.effective_options["default_lock_ttl"] if ttl is None else ttl
        expires = datetime.now(timezone.utc) + timedelta(
            seconds=max(30, min(int(effective_ttl), 3600))
        )
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


#: Incremented on every runtime publication. Every ephemeral capability the
#: Companion issues carries the generation it was issued under, so nothing that
#: survives an unload can be replayed against the next setup.
_GENERATION = itertools.count(1)


@dataclass(slots=True)
class CompanionRuntime:
    """Entry-scoped runtime compatible with HA versions without runtime_data."""

    entry_id: str
    manager: GltStore
    access: ProjectAccessRepository | None = None
    policy: PolicyCoordinator | None = None
    leases: LeaseRegistry | None = None
    subscriptions: SubscriptionRegistry | None = None
    cursors: EvidenceCursorRegistry | None = None
    evidence: TrustedEvidenceStore | None = None
    telemetry: TelemetryStore | None = None
    controls: ControlEvidenceRecorder | None = None
    control_rates: ControlRateLimiter | None = None
    provenance: ProvenanceService | None = None
    views: ViewStreamService | None = None
    generation: int = 0
    available: bool = True

    async def async_invalidate(self) -> None:
        """Hide the runtime before anything it owns is released.

        Availability disappears first so no request admitted after this point
        can observe a half-released runtime. Every ephemeral capability dies
        with the generation, so nothing issued before an unload can be replayed
        against the next setup.
        """
        self.available = False
        for owned in (self.leases, self.subscriptions, self.cursors):
            if owned is not None:
                owned.invalidate_generation()
        if self.provenance is not None:
            # A cached provenance record from a dead generation would claim a
            # dead entity is live, which is the one thing this data must never do.
            self.provenance.invalidate()
        if self.views is not None:
            # Snapshot budgets are per connection and per generation. A budget
            # surviving an unload would let a pre-reload client keep spending.
            self.views.clear()

    async def async_close(self) -> None:
        """Close the complete entry-owned runtime, tolerating repetition."""
        await self.async_invalidate()
        await self.manager.async_close()


def _component_data(hass: HomeAssistant) -> dict[str, Any]:
    """Return component data without relying on ConfigEntry.runtime_data."""
    data = hass.data.setdefault(DOMAIN, {})
    data.setdefault("runtimes", {})
    data.setdefault("commands_registered", False)
    data.setdefault("yaml_config", {})
    data.setdefault("pending_options", {})
    data.setdefault("suppress_option_updates", set())
    return data


def _runtime_for(
    hass: HomeAssistant, entry_id: str | None = None
) -> CompanionRuntime | None:
    """Resolve an exact loaded runtime from the minimum supported HA lane."""
    data = hass.data.get(DOMAIN)
    if not isinstance(data, dict):
        return None
    runtimes = data.get("runtimes")
    if not isinstance(runtimes, dict):
        return None
    if entry_id is not None:
        runtime = runtimes.get(entry_id)
        return runtime if isinstance(runtime, CompanionRuntime) else None
    loaded = [runtime for runtime in runtimes.values() if isinstance(runtime, CompanionRuntime)]
    return loaded[0] if len(loaded) == 1 else None


def _manager(hass: HomeAssistant) -> GltStore:
    runtime = _runtime_for(hass)
    if runtime is None:
        raise RuntimeError("GLT Flow Card Companion is not loaded")
    return runtime.manager


def _project_for(hass: HomeAssistant, project_id: str) -> dict[str, Any] | None:
    return _manager(hass).project(project_id)


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
    """Return only the projects this principal may read.

    Filtering happens at the source: an unauthorized project is omitted, never
    returned with redacted fields, so the response cannot reveal that it exists.
    """
    runtime = _runtime_for(hass)
    heads = _manager(hass).projects()
    visible = set(runtime.policy.visible_projects(connection, [head["id"] for head in heads]))
    connection.send_result(msg["id"], [head for head in heads if head["id"] in visible])


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/get", vol.Required("project_id"): str})
@websocket_api.async_response
async def ws_projects_get(hass, connection, msg):
    """Return one project, answering missing and unauthorized identically."""
    project = _manager(hass).project(msg["project_id"])
    if project is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return
    connection.send_result(msg["id"], project)


def _project_entity_ids(config: Mapping[str, Any]) -> set[str]:
    """Every entity the project itself references.

    Provenance answers questions about a project's own datapoints. Describing an
    entity the project never mentions would turn a project-scoped read into a
    registry search, which is a different and much larger permission.
    """
    referenced: set[str] = set()
    for collection in ("datapoints", "equipment"):
        rows = config.get(collection)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            for key in ("entity_id", "entity", "state_entity"):
                value = row.get(key)
                if isinstance(value, str) and value:
                    referenced.add(value)
    model = config.get("semantic_model")
    nodes = model.get("nodes") if isinstance(model, Mapping) else None
    if isinstance(nodes, list):
        for node in nodes:
            if isinstance(node, Mapping) and isinstance(node.get("entity_id"), str):
                referenced.add(node["entity_id"])
    return referenced


def _mutation_guard(hass, connection, msg, *, capability: str) -> MutationGuard:
    """Build the authority evidence a mutation carries into the commit lock."""
    decision = msg[DECISION_KEY]
    return MutationGuard(
        project_id=decision.project_id,
        user_id=decision.actor.user_id,
        session_id=str(decision.actor.session_id or decision.actor.connection_id),
        purpose=PURPOSE_ENGINEERING,
        effective_capability=capability,
        access_revision=decision.access_revision,
        lease=str(msg.get("lease_token", "")),
        revision=int(msg.get("expected_revision", 0)),
        digest=msg.get("expected_digest"),
        policy_version=decision.policy_version,
    )


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/save", vol.Required("project"): dict, vol.Optional("autosave", default=False): bool, vol.Optional("expected_revision"): int, vol.Required("lease_token"): str})
@websocket_api.async_response
async def ws_projects_save(hass, connection, msg):
    try:
        user_id, user_name, _is_admin = _user(connection)
        project = msg["project"]
        pid = str(project.get("id") or project.get("config", {}).get("project", {}).get("id") or "")
        result = await _manager(hass).save_project(
            project,
            msg["autosave"],
            user_id,
            msg.get("expected_revision"),
            guard=_mutation_guard(hass, connection, msg, capability="project.write"),
        )
        await _manager(hass).add_audit({"action":"project.save","detail":{"project_id":pid,"revision":result["revision"]}}, user_id, user_name)
        connection.send_result(msg["id"], result)
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
    except (TransactionConflict, RuntimeError) as err:
        connection.send_error(msg["id"], "revision_conflict", str(err))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_project", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/projects/preview",
    vol.Required("project_id"): str,
    vol.Required("expected_revision"): vol.All(int, vol.Range(min=0)),
    vol.Required("candidate"): dict,
    vol.Required("lease_token"): str,
})
@websocket_api.async_response
async def ws_projects_preview(hass, connection, msg):
    try:
        uid, _uname, _admin = _user(connection)
        result = await _manager(hass).project_transactions.preview(
            user_id=uid,
            project_id=msg["project_id"],
            expected_revision=msg["expected_revision"],
            candidate=msg["candidate"],
        )
        connection.send_result(msg["id"], result)
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
    except TransactionConflict as err:
        connection.send_error(msg["id"], "revision_conflict", str(err))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_project", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/projects/apply",
    vol.Required("project_id"): str,
    vol.Required("preview_id"): str,
    vol.Required("expected_revision"): vol.All(int, vol.Range(min=0)),
    vol.Required("selected_ids"): vol.All([str], vol.Length(max=5000)),
    vol.Required("lease_token"): str,
})
@websocket_api.async_response
async def ws_projects_apply(hass, connection, msg):
    try:
        uid, _uname, _admin = _user(connection)
        result = await _manager(hass).project_transactions.apply(
            user_id=uid,
            project_id=msg["project_id"],
            preview_id=msg["preview_id"],
            expected_revision=msg["expected_revision"],
            selected_ids=msg["selected_ids"],
            guard=_mutation_guard(hass, connection, msg, capability="project.write"),
        )
        _manager(hass).data["projects"][msg["project_id"]] = deepcopy(result)
        connection.send_result(msg["id"], result)
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
    except TransactionConflict as err:
        connection.send_error(msg["id"], "revision_conflict", str(err))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_selection", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/projects/rollback",
    vol.Required("project_id"): str,
    vol.Required("snapshot_id"): str,
    vol.Required("expected_revision"): vol.All(int, vol.Range(min=0)),
    vol.Required("confirmation"): str,
    vol.Required("lease_token"): str,
})
@websocket_api.async_response
async def ws_projects_rollback(hass, connection, msg):
    try:
        uid, _uname, _admin = _user(connection)
        result = await _manager(hass).project_transactions.rollback(
            user_id=uid,
            project_id=msg["project_id"],
            snapshot_id=msg["snapshot_id"],
            expected_revision=msg["expected_revision"],
            confirmation=msg["confirmation"],
            guard=_mutation_guard(hass, connection, msg, capability="project.write"),
        )
        _manager(hass).data["projects"][msg["project_id"]] = deepcopy(result)
        connection.send_result(msg["id"], result)
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
    except TransactionConflict as err:
        connection.send_error(msg["id"], "revision_conflict", str(err))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_snapshot", str(err))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/projects/delete", vol.Required("project_id"): str, vol.Required("lease_token"): str})
@websocket_api.async_response
async def ws_projects_delete(hass, connection, msg):
    try:
        # Delete carries the same evidence as any other shared mutation, so a
        # revoked role or an expired lease stops it at the commit boundary too.
        guard = _mutation_guard(hass, connection, msg, capability="project.delete")
        connection.send_result(msg["id"], await _manager(hass).delete_project(
            msg["project_id"], guard=guard
        ))
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/controls/preview",
    vol.Required("project_id"): str,
    vol.Required("control_id"): str,
    vol.Required("expected_revision"): vol.All(int, vol.Range(min=0)),
    vol.Optional("input", default={}): dict,
})
@websocket_api.async_response
async def ws_controls_preview(hass, connection, msg):
    """Describe exactly what a control would do, resolved from the head."""
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    head = _project_for(hass, decision.project_id)
    if head is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return
    if int(head["revision"]) != int(msg["expected_revision"]):
        connection.send_error(msg["id"], "revision_conflict", "revision_conflict")
        return
    try:
        runtime.control_rates.check(
            kind="preview",
            user_id=decision.actor.user_id,
            project_id=decision.project_id,
        )
        resolved = resolve_control(head["config"], msg["control_id"], msg["input"])
    except ControlRejected as rejected:
        code = "rate_limited" if rejected.reason == "rate_limited" else "invalid_input"
        connection.send_error(msg["id"], code, rejected.reason)
        return
    connection.send_result(msg["id"], preview_payload(resolved))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/controls/execute",
    vol.Required("project_id"): str,
    vol.Required("control_id"): str,
    vol.Required("expected_revision"): vol.All(int, vol.Range(min=0)),
    vol.Optional("input", default={}): dict,
})
@websocket_api.async_response
async def ws_controls_execute(hass, connection, msg):
    """Dispatch one configured control at most once, with honest evidence.

    Resolved A4: this is an operational path. It re-checks capability, head and
    Home Assistant permission, but it does not take an engineering lease -
    operating a plant is not engineering it.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    correlation_id = f"ctl:{uuid4().hex}"

    head = _project_for(hass, decision.project_id)
    if head is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return
    if int(head["revision"]) != int(msg["expected_revision"]):
        connection.send_error(msg["id"], "revision_conflict", "revision_conflict")
        return

    try:
        runtime.control_rates.check(
            kind="execute",
            user_id=decision.actor.user_id,
            project_id=decision.project_id,
        )
        resolved = resolve_control(head["config"], msg["control_id"], msg["input"])
    except ControlRejected as rejected:
        code = "rate_limited" if rejected.reason == "rate_limited" else "invalid_input"
        connection.send_error(msg["id"], code, rejected.reason)
        return

    # Durable `accepted` first. If this fails, nothing was dispatched and there
    # is nothing to repair.
    try:
        await runtime.controls.async_accept(
            project_id=decision.project_id,
            actor_user_id=decision.actor.user_id,
            control_id=resolved.control_id,
            correlation_id=correlation_id,
            target=resolved.target,
        )
    except Exception:
        connection.send_error(msg["id"], "effect_unknown", "failed_before_dispatch")
        return

    try:
        await hass.services.async_call(
            resolved.domain,
            resolved.service,
            dict(resolved.service_data),
            blocking=True,
            target=dict(resolved.target),
            context=Context(user_id=decision.actor.user_id),
        )
    except Exception:
        # The attempt happened or it did not, and the Companion cannot tell.
        # It records that honestly and never tries again on its own.
        await runtime.controls.async_record_state(
            project_id=decision.project_id,
            actor_user_id=decision.actor.user_id,
            correlation_id=correlation_id,
            state="result_unknown",
        )
        connection.send_result(msg["id"], {
            "correlation_id": correlation_id,
            "state": "result_unknown",
        })
        return

    await runtime.controls.async_record_state(
        project_id=decision.project_id,
        actor_user_id=decision.actor.user_id,
        correlation_id=correlation_id,
        state="dispatched",
    )

    # Only a matching readback may upgrade this to confirmed.
    state = "timed_out"
    readback = resolved.readback
    if readback.get("entity_id"):
        observed = hass.states.get(readback["entity_id"])
        if observed is not None and observed.state == readback.get("expect_state"):
            state = "readback_confirmed"
    await runtime.controls.async_record_state(
        project_id=decision.project_id,
        actor_user_id=decision.actor.user_id,
        correlation_id=correlation_id,
        state=state,
    )
    connection.send_result(msg["id"], {
        "correlation_id": correlation_id,
        "state": state,
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/evidence/list",
    vol.Required("project_id"): str,
    vol.Optional("cursor"): vol.Any(str, None),
})
@websocket_api.async_response
async def ws_evidence_list(hass, connection, msg):
    """Return one authorized page of trusted evidence.

    Rows are filtered by project before pagination, so a project the caller
    cannot read never influences a page, an offset or a cursor.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    session_id = str(decision.actor.session_id or decision.actor.connection_id)
    scope = {
        "user_id": decision.actor.user_id,
        "session_id": session_id,
        "project_id": decision.project_id,
        "filter": "trusted",
    }
    try:
        cursor = msg.get("cursor")
        if cursor:
            page = await runtime.cursors.async_next_page(cursor=cursor, **scope)
        else:
            page = await runtime.cursors.async_first_page(**scope)
    except CursorInvalid:
        connection.send_error(msg["id"], "invalid_input", "cursor_invalid")
        return
    connection.send_result(msg["id"], {**page, "provenance": "trusted"})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/telemetry/list",
    vol.Required("project_id"): str,
})
@websocket_api.async_response
async def ws_telemetry_list(hass, connection, msg):
    """Return this caller's own untrusted telemetry, labelled as such."""
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    rows = runtime.telemetry.rows(decision.actor.user_id)
    # A separate route, a separate result shape and an explicit provenance
    # label: nothing here can be mistaken for, or merged with, trusted history.
    connection.send_result(msg["id"], {"rows": rows, "provenance": "untrusted"})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/telemetry/add",
    vol.Required("project_id"): str,
    vol.Required("payload"): dict,
})
@websocket_api.async_response
async def ws_telemetry_add(hass, connection, msg):
    """Append one bounded, rate-limited, permanently untrusted telemetry row."""
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    try:
        row = await runtime.telemetry.async_add(
            user_id=decision.actor.user_id,
            session_id=str(decision.actor.session_id or decision.actor.connection_id),
            payload=msg["payload"],
        )
    except TelemetryRejected as rejected:
        connection.send_error(msg["id"], str(rejected), str(rejected))
        return
    connection.send_result(msg["id"], {"id": row["id"], "trusted": False})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/access/get",
    vol.Required("project_id"): str,
})
@websocket_api.async_response
async def ws_access_get(hass, connection, msg):
    """Return the minimal membership inventory for one project.

    Resolved A2: this is the whole surface a Home Assistant administrator
    without a project assignment may see - the project id, who holds what, and
    the access revision that guards the next change. No title, no content, no
    counts, no evidence.
    """
    runtime = _runtime_for(hass)
    inventory = await runtime.access.async_membership_inventory(msg["project_id"])
    inventory["eligible_users"] = await runtime.access.async_eligible_users(hass)
    connection.send_result(msg["id"], inventory)


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/access/set",
    vol.Required("project_id"): str,
    vol.Required("user_id"): str,
    vol.Required("role"): vol.Any(vol.In(ROLES), None),
    vol.Required("expected_access_revision"): vol.All(int, vol.Range(min=0)),
    vol.Required("lease_token"): str,
})
@websocket_api.async_response
async def ws_access_set(hass, connection, msg):
    """Assign or revoke one fixed role under a guarded, exact-revision commit.

    Resolved A3: the access revision and the content revision are separate
    streams. This route advances only the access revision, and it validates the
    administration-purpose lease that scopes the change - never the engineering
    lease that guards content.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    session_id = str(decision.actor.session_id or decision.actor.connection_id)

    if not runtime.leases.validate(
        token=msg["lease_token"],
        project_id=msg["project_id"],
        user_id=decision.actor.user_id,
        session_id=session_id,
        purpose=PURPOSE_MEMBERSHIP_ADMIN,
        access_revision=decision.access_revision,
    ):
        connection.send_error(msg["id"], "lease_expired", "lease_expired")
        return

    if msg["user_id"] == decision.actor.user_id and msg["role"] is not None:
        # Self-grant is the one change membership administration may never make.
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
        return

    eligible = {entry["user_id"] for entry in await runtime.access.async_eligible_users(hass)}
    if msg["role"] is not None and msg["user_id"] not in eligible:
        connection.send_error(msg["id"], "invalid_input", "invalid_input")
        return

    try:
        if msg["role"] is None:
            state = await runtime.access.async_revoke(
                project_id=msg["project_id"],
                user_id=msg["user_id"],
                expected_access_revision=msg["expected_access_revision"],
            )
        else:
            state = await runtime.access.async_assign(
                project_id=msg["project_id"],
                user_id=msg["user_id"],
                role=msg["role"],
                expected_access_revision=msg["expected_access_revision"],
            )
    except AccessConflict:
        connection.send_error(msg["id"], "revision_conflict", "revision_conflict")
        return
    except ValueError:
        connection.send_error(msg["id"], "invalid_input", "invalid_input")
        return

    # The membership change is itself an authority change, so every lease and
    # subscription bound to the previous access revision must stop being valid.
    runtime.leases.invalidate_access_revision(msg["project_id"], state.access_revision)
    await runtime.subscriptions.async_publish(
        msg["project_id"], {"type": "access_changed", "project_id": msg["project_id"]}
    )
    connection.send_result(msg["id"], {
        "project_id": msg["project_id"],
        "access_revision": state.access_revision,
        "assignments": [
            {"user_id": user, "role": role} for user, role in state.assignments
        ],
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/projects/lock",
    vol.Required("project_id"): str,
    vol.Optional("ttl_seconds"): vol.All(int, vol.Range(min=30, max=3600)),
})
@websocket_api.async_response
async def ws_projects_lock(hass, connection, msg):
    """Retired. The policy boundary already answered `feature_unavailable`.

    The route stays registered so an old card receives a stable code instead of
    an unknown-command error, and so no caller can mistake a persisted
    user-only lock for a write guard.
    """
    connection.send_error(msg["id"], "feature_unavailable", "feature_unavailable")


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/projects/unlock",
    vol.Required("project_id"): str,
})
@websocket_api.async_response
async def ws_projects_unlock(hass, connection, msg):
    """Retired alongside `projects/lock`; see that handler."""
    connection.send_error(msg["id"], "feature_unavailable", "feature_unavailable")


def _lease_context(hass, connection, msg):
    """Resolve the exact binding a lease is issued and validated against."""
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    return runtime.leases, {
        "project_id": decision.project_id,
        "user_id": decision.actor.user_id,
        "session_id": str(decision.actor.session_id or decision.actor.connection_id),
        "access_revision": decision.access_revision,
    }


def _lease_purpose(msg, decision):
    """Resolve the requested purpose and refuse one the principal cannot hold."""
    purpose = msg.get("purpose", PURPOSE_ENGINEERING)
    capability = PURPOSE_CAPABILITY.get(purpose)
    if capability is None or capability not in decision.capabilities:
        raise PolicyDenied("capability_denied", {"purpose": purpose})
    return purpose


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/leases/acquire",
    vol.Required("project_id"): str,
    vol.Optional("purpose", default=PURPOSE_ENGINEERING): vol.In(PURPOSES),
    vol.Optional("ttl_seconds", default=DEFAULT_TTL_SECONDS): vol.All(
        int, vol.Range(min=MIN_TTL_SECONDS, max=MAX_TTL_SECONDS)
    ),
})
@websocket_api.async_response
async def ws_leases_acquire(hass, connection, msg):
    """Grant the one exclusive lease for a project, or refuse anonymously."""
    registry, context = _lease_context(hass, connection, msg)
    try:
        purpose = _lease_purpose(msg, msg[DECISION_KEY])
        lease = registry.acquire(**context, purpose=purpose, ttl_seconds=msg["ttl_seconds"])
    except PolicyDenied as denied:
        connection.send_error(msg["id"], denied.code, denied.code)
        return
    except LeaseDenied as denied:
        # The response says a lease is held. It never says by whom.
        connection.send_error(msg["id"], denied.code, denied.code)
        return
    except ValueError:
        connection.send_error(msg["id"], "invalid_input", "invalid_input")
        return
    connection.send_result(msg["id"], {
        "lease_token": lease.token,
        "purpose": lease.purpose,
        "expires_in": lease.expires_in,
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/leases/renew",
    vol.Required("project_id"): str,
    vol.Required("lease_token"): str,
    vol.Optional("purpose", default=PURPOSE_ENGINEERING): vol.In(PURPOSES),
    vol.Optional("ttl_seconds", default=DEFAULT_TTL_SECONDS): vol.All(
        int, vol.Range(min=MIN_TTL_SECONDS, max=MAX_TTL_SECONDS)
    ),
})
@websocket_api.async_response
async def ws_leases_renew(hass, connection, msg):
    """Rotate the bearer and extend the lease. The old bearer dies at once."""
    registry, context = _lease_context(hass, connection, msg)
    try:
        purpose = _lease_purpose(msg, msg[DECISION_KEY])
        lease = registry.renew(
            token=msg["lease_token"], **context, purpose=purpose, ttl_seconds=msg["ttl_seconds"]
        )
    except PolicyDenied as denied:
        connection.send_error(msg["id"], denied.code, denied.code)
        return
    except LeaseInvalid:
        connection.send_error(msg["id"], "lease_expired", "lease_expired")
        return
    except (LeaseDenied, ValueError):
        connection.send_error(msg["id"], "invalid_input", "invalid_input")
        return
    connection.send_result(msg["id"], {
        "lease_token": lease.token,
        "purpose": lease.purpose,
        "expires_in": lease.expires_in,
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/leases/release",
    vol.Required("project_id"): str,
    vol.Required("lease_token"): str,
    vol.Optional("purpose", default=PURPOSE_ENGINEERING): vol.In(PURPOSES),
})
@websocket_api.async_response
async def ws_leases_release(hass, connection, msg):
    """Release a lease the caller actually holds."""
    registry, context = _lease_context(hass, connection, msg)
    try:
        purpose = _lease_purpose(msg, msg[DECISION_KEY])
        registry.release(token=msg["lease_token"], **context, purpose=purpose)
    except PolicyDenied as denied:
        connection.send_error(msg["id"], denied.code, denied.code)
        return
    except LeaseInvalid:
        connection.send_error(msg["id"], "lease_expired", "lease_expired")
        return
    connection.send_result(msg["id"], {"released": True})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/leases/status",
    vol.Required("project_id"): str,
})
@websocket_api.async_response
async def ws_leases_status(hass, connection, msg):
    """Report whether the project is being edited, never by whom."""
    registry, context = _lease_context(hass, connection, msg)
    connection.send_result(msg["id"], registry.held_state(context["project_id"]))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/provenance/get",
    vol.Required("project_id"): str,
    # Optional: a request that names no entity is a legitimate empty request,
    # and requiring the field would make the route unprobeable by the policy
    # matrix without teaching that matrix about this one route's shape.
    vol.Optional("entity_ids", default=[]): [str],
})
@websocket_api.async_response
async def ws_provenance_get(hass, connection, msg):
    """Describe where a project's datapoint values come from.

    The caller names entities, but only those the *project* already references
    are described. Without that restriction this route would be a way to probe
    the whole entity registry from inside any project the caller can read.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project = _manager(hass).project(decision.project_id)
    if project is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return

    referenced = _project_entity_ids(project.get("config") or {})
    requested = [entity_id for entity_id in msg["entity_ids"][:MAX_PROVENANCE_ENTITIES]]
    described = [
        await runtime.provenance.async_describe(entity_id)
        for entity_id in requested
        if entity_id in referenced
    ]
    connection.send_result(msg["id"], {
        "project_id": decision.project_id,
        "rows": described,
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/navigation/resolve",
    vol.Required("project_id"): str,
    # Optional so the generic policy prober reaches a decision rather than a
    # schema rejection; an empty address resolves to nothing, opaquely.
    vol.Optional("address", default=""): str,
})
@websocket_api.async_response
async def ws_navigation_resolve(hass, connection, msg):
    """Resolve one deep link, re-authorizing from scratch every time.

    A malformed address, an unknown node and a project the caller is not a
    member of all answer identically. Anything else turns a shareable URL into
    a way to probe a hierarchy one segment at a time.
    """
    decision = msg[DECISION_KEY]
    project = _manager(hass).project(decision.project_id)
    # An empty address is the generic policy prober's shape, not a probe of this
    # project: it names nothing, so it answers successfully having resolved
    # nothing. This mirrors panels/get and provenance/get.
    if not msg["address"]:
        connection.send_result(msg["id"], {
            "project_id": decision.project_id,
            "address": None, "node": None, "ancestry": [], "children": [],
        })
        return

    resolved = (
        resolve_address(project.get("config") or {}, msg["address"])
        if project is not None
        else None
    )
    if resolved is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return
    connection.send_result(msg["id"], {"project_id": decision.project_id, **resolved})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/navigation/portfolio",
})
@websocket_api.async_response
async def ws_navigation_portfolio(hass, connection, msg):
    """Roll up every project this principal may open, and nothing else.

    The totals are summed from the already-filtered set. Computing them across
    every project and filtering the rows afterwards would announce a fault in a
    project the caller cannot open -- the row would be hidden and the number
    would not.

    An unassigned principal receives an empty roll-up rather than a denial: a
    denial would confirm that projects exist at all.
    """
    runtime = _runtime_for(hass)
    heads = _manager(hass).projects()
    visible = set(runtime.policy.visible_projects(
        connection, [head["id"] for head in heads],
    ))
    permitted = [head for head in heads if head["id"] in visible]
    connection.send_result(msg["id"], roll_up_portfolio(permitted))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/views/subscribe",
    vol.Required("project_id"): str,
})
@websocket_api.async_response
async def ws_views_subscribe(hass, connection, msg):
    """Return a snapshot with the sequence it was read at, then stream events.

    The snapshot and its sequence come from one critical section. Anything else
    loses an event emitted between the read and the stamp, and a lost event is
    precisely the gap the client is supposed to notice.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project = _manager(hass).project(decision.project_id)
    if project is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return

    config = project.get("config") or {}

    def read() -> dict:
        return {
            "project_id": decision.project_id,
            "objects": addressable_objects(config),
            "revision": project.get("revision"),
        }

    try:
        result = runtime.views.snapshot(id(connection), read)
    except SnapshotRefused as refused:
        connection.send_error(msg["id"], refused.code, refused.code)
        return

    try:
        unsubscribe = await runtime.subscriptions.async_subscribe(
            project_id=decision.project_id,
            user_id=decision.actor.user_id,
            session_id=decision.actor.session_id or "",
            send=lambda event: connection.send_event(msg["id"], event),
        )
    except SubscriptionDenied:
        connection.send_error(msg["id"], "rate_limited", "rate_limited")
        return
    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/panels/get",
    vol.Required("project_id"): str,
    # Optional with a default so the generic policy prober can reach this
    # handler and receive a policy decision rather than a schema rejection. An
    # empty object id resolves to no panel, which is the same opaque denial an
    # unknown id gets.
    vol.Optional("object_id", default=""): str,
})
@websocket_api.async_response
async def ws_panels_get(hass, connection, msg):
    """Compose one profile-driven object panel, server-side.

    The control list is filtered here, against this principal's *current*
    capabilities, because the browser must not derive one: its capability
    snapshot can be five minutes stale and would not see a revocation.

    A missing object and an object the caller may not open answer identically.
    Distinguishing them would turn this route into a way to enumerate a
    project's contents one id at a time.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project = _manager(hass).project(decision.project_id)
    if project is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return

    config = project.get("config") or {}
    entity_ids = _project_entity_ids(config)
    states = {
        entity_id: getattr(hass.states.get(entity_id), "state", None)
        for entity_id in entity_ids
    }
    # An empty object id is the generic policy prober's shape, not a probe of
    # this project: it describes nothing, so it answers successfully with no
    # panel. This mirrors provenance/get, where an empty entity list is a
    # legitimate empty request rather than a denial.
    if not msg["object_id"]:
        connection.send_result(msg["id"], {
            "project_id": decision.project_id, "object_id": None, "regions": [],
        })
        return

    panel = compose_panel(
        config,
        msg["object_id"],
        capabilities=decision.capabilities,
        states=states,
    )
    if panel is None:
        connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
        return
    connection.send_result(msg["id"], {"project_id": decision.project_id, **panel})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/capabilities/get",
    vol.Required("project_id"): str,
})
@websocket_api.async_response
async def ws_capabilities_get(hass, connection, msg):
    """Return the caller's own authority for one project.

    This is the snapshot the browser uses to decide what to *show*. It is
    deliberately about the asking user only: it names no other member, no other
    session and no hidden project, and every route the user then calls is
    authorized again on its own. The sequence lets a client detect that it has
    missed an event and refresh instead of trusting what it already holds.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project = _manager(hass).project(decision.project_id)
    connection.send_result(msg["id"], {
        "project_id": decision.project_id,
        "role": decision.role,
        "capabilities": sorted(decision.capabilities),
        "policy_version": decision.policy_version,
        "access_revision": decision.access_revision,
        "generation": runtime.generation,
        "sequence": runtime.subscriptions.sequence(),
        "revision": (project or {}).get("revision"),
        "expires_in": CAPABILITY_SNAPSHOT_SECONDS,
    })


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/list"})
@websocket_api.async_response
async def ws_templates_list(hass, connection, msg):
    data = list(_manager(hass).data["templates"].values())
    data.sort(key=lambda x: x.get("updated", ""), reverse=True)
    connection.send_result(msg["id"], deepcopy(data))


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/save", vol.Required("template"): dict})
@websocket_api.async_response
async def ws_templates_save(hass, connection, msg):
    """Save one shared template. Policy already proved template.write."""
    uid, _uname, _admin = _user(connection)
    t = deepcopy(msg["template"])
    tid = str(t.get("id") or f"template-{int(datetime.now(timezone.utc).timestamp()*1000)}")
    t.update({"id":tid,"updated":_utc(),"updated_by":uid})
    _manager(hass).data["templates"][tid] = t
    await _manager(hass).async_save()
    connection.send_result(msg["id"], t)


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/templates/delete", vol.Required("template_id"): str})
@websocket_api.async_response
async def ws_templates_delete(hass, connection, msg):
    """Delete one shared template. Policy already proved template.write."""
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
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
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
        uid, uname, _admin = _user(connection)
        result = await _manager(hass).ack_alarm(msg["project_id"], msg["alarm_id"], uid, uname, msg["comment"])
        await _manager(hass).add_audit({"action":"alarm.ack","detail":{"project_id":msg["project_id"],"alarm_id":msg["alarm_id"],"comment":msg["comment"]}}, uid, uname)
        connection.send_result(msg["id"], result)
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/alarms/shelve", vol.Required("project_id"): str, vol.Required("alarm_id"): str, vol.Optional("minutes", default=60): int})
@websocket_api.async_response
async def ws_alarms_shelve(hass, connection, msg):
    try:
        uid, _uname, _admin = _user(connection)
        connection.send_result(msg["id"], await _manager(hass).shelve_alarm(msg["project_id"], msg["alarm_id"], msg["minutes"], uid))
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")


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
        uid, _uname, _admin = _user(connection)
        work_order = {**msg["work_order"], "project_id":msg["project_id"]}
        connection.send_result(msg["id"], await _manager(hass).save_work_order(work_order, uid))
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/reports/run", vol.Required("project_id"): str, vol.Required("report_id"): str})
@websocket_api.async_response
async def ws_reports_run(hass, connection, msg):
    try:
        uid, _uname, _admin = _user(connection)
        connection.send_result(msg["id"], await _manager(hass).run_report(msg["project_id"], msg["report_id"], uid))
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")


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
    """Return trusted evidence for the projects this caller may read.

    The route keeps its legacy name so an older card still works, but the broad
    read is gone: rows are filtered to authorized projects before serialization.
    """
    runtime = _runtime_for(hass)
    visible = set(runtime.policy.visible_projects(
        connection, [head["id"] for head in _manager(hass).projects()]
    ))
    rows = runtime.evidence.rows(visible)[: msg["limit"]]
    connection.send_result(msg["id"], rows)


_COMMAND_HANDLERS = (
    ws_projects_list, ws_projects_get, ws_projects_save, ws_projects_preview,
    ws_projects_apply, ws_projects_rollback, ws_projects_delete,
    ws_access_get, ws_access_set,
    ws_controls_preview, ws_controls_execute,
    ws_evidence_list, ws_telemetry_list, ws_telemetry_add,
    ws_projects_lock, ws_projects_unlock,
    ws_leases_acquire, ws_leases_renew, ws_leases_release, ws_leases_status,
    ws_capabilities_get, ws_provenance_get, ws_panels_get, ws_views_subscribe,
    ws_navigation_resolve, ws_navigation_portfolio,
    ws_templates_list, ws_templates_save,
    ws_templates_delete, ws_control_execute, ws_alarms_list, ws_alarms_ack,
    ws_alarms_shelve, ws_work_orders_list, ws_work_orders_save, ws_reports_run,
    ws_reports_list, ws_remote_list, ws_remote_states, ws_remote_control,
    ws_audit_add, ws_audit_list,
)


#: Private key under which an authorized decision reaches its handler.
DECISION_KEY = "_glt_decision"


def _guard_command(command):
    """Enforce the deny-default policy boundary before any handler runs.

    Home Assistant dispatches WebSocket commands through a synchronous
    callback, and the decision is made here rather than inside the scheduled
    handler coroutine. That ordering is the guarantee: an unauthorized request
    never reaches a handler, so it can have no effect to undo.
    """

    @wraps(command)
    def guarded(hass, connection, msg):
        runtime = _runtime_for(hass)
        if runtime is None or not runtime.available:
            connection.send_error(
                msg["id"],
                "not_loaded",
                "GLT Flow Card Companion is not loaded",
            )
            return None

        coordinator = runtime.policy
        if coordinator is None:
            connection.send_error(msg["id"], "not_loaded", "policy is unavailable")
            return None

        try:
            decision = coordinator.authorize(connection, msg)
        except PolicyDenied as denied:
            connection.send_error(msg["id"], denied.code, denied.code)
            return None

        if decision.policy.requires_lease:
            registry = runtime.leases
            token = msg.get("lease_token")
            if registry is None or not token:
                connection.send_error(msg["id"], "lease_required", "lease_required")
                return None
            valid = registry.validate(
                token=str(token),
                project_id=decision.project_id,
                user_id=decision.actor.user_id,
                session_id=str(decision.actor.session_id or decision.actor.connection_id),
                purpose=PURPOSE_ENGINEERING,
                access_revision=decision.access_revision,
            )
            if not valid:
                connection.send_error(msg["id"], "lease_expired", "lease_expired")
                return None

        # `ActiveConnection` is slotted, so the decision travels with the
        # already-validated message under a private key instead.
        msg[DECISION_KEY] = decision
        return command(hass, connection, msg)

    return guarded


COMMANDS = tuple(_guard_command(command) for command in _COMMAND_HANDLERS)


def _register_commands_once(hass: HomeAssistant) -> None:
    """Register the immutable command surface once per component lifetime."""
    data = _component_data(hass)
    if data["commands_registered"]:
        return
    for command in COMMANDS:
        websocket_api.async_register_command(hass, command)
    data["commands_registered"] = True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload validated options and restore the effective runtime on failure."""
    data = _component_data(hass)
    suppressed = data["suppress_option_updates"]
    if entry.entry_id in suppressed:
        suppressed.discard(entry.entry_id)
        return
    runtime = _runtime_for(hass, entry.entry_id)
    if runtime is None:
        return
    previous = dict(runtime.manager.effective_options)
    try:
        candidate = normalize_options(dict(entry.options), strict=True)
    except ValueError:
        suppressed.add(entry.entry_id)
        hass.config_entries.async_update_entry(entry, options=previous)
        return

    data["pending_options"][entry.entry_id] = candidate
    try:
        reloaded = await hass.config_entries.async_reload(entry.entry_id)
    except Exception:
        reloaded = False
    finally:
        data["pending_options"].pop(entry.entry_id, None)
    if reloaded:
        return

    suppressed.add(entry.entry_id)
    hass.config_entries.async_update_entry(entry, options=previous)
    await hass.config_entries.async_unload(entry.entry_id)
    data["pending_options"][entry.entry_id] = previous
    try:
        restored = await hass.config_entries.async_setup(entry.entry_id)
    finally:
        data["pending_options"].pop(entry.entry_id, None)
        suppressed.discard(entry.entry_id)
    if not restored:
        raise RuntimeError("failed to restore previous GLT Flow Card options")


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    yaml_config = config.get(DOMAIN, {}) if isinstance(config.get(DOMAIN, {}), dict) else {}
    data = _component_data(hass)
    data["yaml_config"] = deepcopy(yaml_config)
    _register_commands_once(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = _component_data(hass)
    _register_commands_once(hass)
    if _runtime_for(hass, entry.entry_id) is not None:
        return True

    pending = data["pending_options"].get(entry.entry_id)
    # `migrate_options` rather than `normalize_options`: an installation whose
    # stored lock TTL predates the Phase-2 window keeps its intent (clamped to
    # the nearest bound) instead of being silently reset to the default.
    options = pending or migrate_options(dict(entry.options))
    if pending is None and dict(entry.options) != options:
        hass.config_entries.async_update_entry(entry, options=options)

    manager = GltStore(hass, options)
    try:
        await manager.async_load()
        remote = data["yaml_config"].get("remote_sites", [])
        if isinstance(remote, list) and remote:
            manager.configure_remote_sites(remote)

        async def state_listener(event):
            await manager.process_state_change(event)

        manager._unsubs.extend(
            [
                hass.bus.async_listen("state_changed", state_listener),
                async_track_time_change(hass, manager.run_schedules, second=0),
            ]
        )
    except Exception:
        await manager.async_close()
        raise

    access = ProjectAccessRepository(hass)
    evidence = TrustedEvidenceStore(hass, max_rows=options["max_audit"])
    telemetry = TelemetryStore(hass)
    try:
        await access.async_initialize()
        await evidence.async_initialize()
        await telemetry.async_initialize()
    except Exception:
        await manager.async_close()
        raise

    generation = next(_GENERATION)

    def may_read_project(project_id: str, user_id: str) -> bool:
        """Re-authorize one subscriber against the current ACL.

        The Home Assistant administrator ceiling is deliberately not applied:
        it grants membership recovery, never project content, so it must not
        keep a subscription alive.
        """
        role = access.get(project_id).role_of(user_id)
        return "project.read" in capabilities_for(role, is_ha_admin=False)

    def recheck_before_commit(evidence: MutationGuard) -> None:
        """Re-authorize a mutation immediately before anything durable exists.

        The boundary already authorized this request. This runs inside the
        coordinator's lock, after the candidate is computed and before the
        PREPARED journal, so it is the only place that can prove none of the
        authority inputs moved in between.
        """
        state = access.get(evidence.project_id)
        if state.access_revision != evidence.access_revision:
            raise MutationDenied("authority_stale")
        if evidence.effective_capability not in capabilities_for(
            state.role_of(evidence.user_id), is_ha_admin=False
        ):
            raise MutationDenied("capability_denied")
        if not runtime.leases.validate(
            token=evidence.lease,
            project_id=evidence.project_id,
            user_id=evidence.user_id,
            session_id=evidence.session_id,
            purpose=evidence.purpose,
            access_revision=evidence.access_revision,
        ):
            raise MutationDenied("lease_expired")
        if evidence.policy_version != POLICY_VERSION:
            raise MutationDenied("authority_stale")

    runtime = CompanionRuntime(
        entry_id=entry.entry_id,
        manager=manager,
        access=access,
        policy=PolicyCoordinator(access, hass=hass),
        leases=LeaseRegistry(generation=generation),
        subscriptions=SubscriptionRegistry(
            authorize=may_read_project, generation=generation
        ),
        cursors=EvidenceCursorRegistry(
            rows_for=lambda scope: evidence.rows({scope.project_id}),
            generation=generation,
        ),
        evidence=evidence,
        telemetry=telemetry,
        controls=ControlEvidenceRecorder(hass, evidence=evidence),
        control_rates=ControlRateLimiter(),
        provenance=ProvenanceService(hass, generation=generation),
        generation=generation,
    )
    # The stream service reads the subscription registry's counter, so it is
    # attached after the runtime exists rather than constructed inside it.
    runtime.views = ViewStreamService(
        sequence_of=runtime.subscriptions.sequence, generation=generation,
    )
    manager.project_transactions.set_mutation_guard(recheck_before_commit)
    data["runtimes"][entry.entry_id] = runtime
    data["manager"] = manager
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.get(DOMAIN)
    if not isinstance(data, dict):
        return True
    runtimes = data.get("runtimes")
    runtime = runtimes.pop(entry.entry_id, None) if isinstance(runtimes, dict) else None
    data.pop("manager", None)
    if isinstance(runtime, CompanionRuntime):
        await runtime.async_close()
    return True
