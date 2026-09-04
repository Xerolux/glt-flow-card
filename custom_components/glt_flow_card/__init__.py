"""GLT Flow Card Companion 1.0.

Persistent projects, optimistic revisions, locks, server-side controls, alarm lifecycle,
schedules, work orders, reports, audit and optional remote Home Assistant sites.
"""
from __future__ import annotations

import asyncio
import itertools
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass, field
import json
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_time_change,
)
from homeassistant.helpers.storage import Store

from uuid import uuid4

from homeassistant.util import dt as dt_util

from . import (
    alarm_engine,
    alarm_vocabulary,
    dispatch_gate,
    remote_fanout,
    history_bounds,
    history_routes,
    notifications,
    period_resolution,
    recorder_query,
    schedule_time,
    scenarios,
    series_coverage,
    site_destinations,
    site_health,
    site_rollup,
    site_vocabulary,
)
from .simulation_session import SessionRejected, SimulationSessions
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
from .sdk_registry import InstallRefused, SdkRegistry, visible_packs
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
            "locks": {}, "schedule_runs": {}, "schedule_history": [],
        }
        self.remote_sites: dict[str, dict[str, Any]] = {}
        #: Which hosts the Companion may connect to. Server configuration, never
        #: project data -- the same rule as the notification allowlist and the
        #: simulation gate.
        self.site_allowlist: list[str] = []
        self.site_refusals: list[dict[str, Any]] = []
        self.site_breakers = site_health.SiteBreakers(monotonic=time.monotonic)
        self._alarm_tasks: dict[str, asyncio.Task] = {}
        #: When Home Assistant reported itself started. None means "not yet",
        #: and that counts as inside the startup grace: the guard must be closed
        #: before the event arrives, not opened by its absence.
        self._started_at: datetime | None = None
        #: The current entity-filtered state subscription, replaced whenever the
        #: index changes. Held separately from `_unsubs` because it is torn down
        #: and rebuilt during normal operation, not only at unload.
        self._alarm_unsub: Any = None
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
            "locks": {}, "schedule_runs": {}, "schedule_history": [],
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
        if self._alarm_unsub is not None:
            self._alarm_unsub()
            self._alarm_unsub = None

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
        # `project_saved`, `alarm_added`, `alarm_removed`, `ids_remapped` and
        # `migrated` all arrive through this one write, so one call covers five
        # of the declared mutation paths.
        self.async_refresh_alarm_subscription()
        return entry

    async def delete_project(
        self, project_id: str, guard: MutationGuard | None = None
    ) -> bool:
        """Delete one project, re-authorizing immediately before the write."""
        await self.project_transactions._check_guard(guard)
        existed = await self.project_repository.delete_head(project_id)
        self.data["projects"].pop(project_id, None)
        self.data["locks"].pop(project_id, None)
        self.async_refresh_alarm_subscription()
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
        self.data["alarm_history"] = self._append_history(
            {**deepcopy(next_state), "transition": "active" if active else "normal"}
        )
        await self.async_save()
        if active:
            await self._notify_alarm(alarm, project_id)

    async def _notify_alarm(self, alarm: dict[str, Any], project_id: str = "") -> None:
        """Deliver one alarm's notification and record what happened.

        Replaces twelve lines that called with `blocking=False` inside a bare
        `except`, so a delivery nobody received was indistinguishable from one
        they did, and that called whatever domain and service the project
        document named with no allowlist at all.
        """
        policy = dict(alarm.get("notification") or {})
        policy.setdefault(
            "message", f"GLT Alarm: {alarm.get('name') or alarm.get('id')}"
        )
        settings = self.alarm_settings()
        record = await notifications.deliver(
            self.hass,
            policy,
            allowlist=settings["notify_allowlist"],
            timeout_seconds=settings["notify_timeout_seconds"],
        )
        key = f"{project_id}:{alarm.get('id')}"
        state = self.data["alarm_state"].setdefault(
            key, {"project_id": project_id, "alarm_id": alarm.get("id")}
        )
        attempts = [record, *(state.get("delivery_attempts") or [])]
        state["delivery_attempts"] = attempts[: settings["notify_attempt_bound"]]
        state["last_delivery"] = record
        # The rule that makes the whole feature honest. The obvious
        # implementation treats a failed notify as handled; an alarm nobody
        # could be told about is more urgent than one they were told about.
        assert notifications.alarm_survives_delivery_failure(
            state, outcome=record["outcome"]
        )

    async def ack_alarm(self, project_id: str, alarm_id: str, user_id: str | None, user_name: str | None, comment: str) -> dict[str, Any]:
        key = f"{project_id}:{alarm_id}"
        state = self.data["alarm_state"].setdefault(key, {"project_id": project_id, "alarm_id": alarm_id})
        state.update({"acknowledged": True, "ack_at": _utc(), "ack_user_id": user_id, "ack_user_name": user_name, "ack_comment": comment})
        # D9: this path inserted with no cap while `alarm_transition` capped at
        # MAX_AUDIT, so acknowledgement was the unbounded one.
        self.data["alarm_history"] = self._append_history(
            {**deepcopy(state), "transition": "ack"}
        )
        await self.async_save()
        return deepcopy(state)

    def alarm_settings(self) -> dict[str, Any]:
        """Return the site's alarm philosophy: configuration, not product opinion.

        Priorities, shelving limits, escalation stages, recipients and retention
        are *site* decisions -- a plant's alarm philosophy belongs to the plant.
        The defaults here are the conservative ones agreed with the user on
        2026-09-02 and documented in `06-CONTEXT.md`, each as a site decision
        rather than a baked-in answer.
        """
        options = dict(self.effective_options or {})
        return {
            "shelving_maximum_days": int(options.get(
                "alarm_shelving_maximum_days", alarm_engine.DEFAULT_SHELVING_MAXIMUM_DAYS,
            )),
            "startup_grace_seconds": int(options.get(
                "alarm_startup_grace_seconds", alarm_engine.DEFAULT_STARTUP_GRACE_SECONDS,
            )),
            "history_bound": int(options.get("alarm_history_bound", MAX_AUDIT)),
            "schedule_run_retention_days": int(options.get(
                "schedule_run_retention_days",
                alarm_engine.DEFAULT_SCHEDULE_RUN_RETENTION_DAYS,
            )),
            # Site configuration, never project data: a service string in a
            # project document is operator input, not authorization.
            "notify_allowlist": tuple(
                options.get("notify_allowlist", notifications.DEFAULT_ALLOWLIST)
            ),
            "notify_timeout_seconds": int(options.get(
                "notify_timeout_seconds", notifications.DEFAULT_TIMEOUT_SECONDS,
            )),
            "notify_attempt_bound": int(options.get(
                "notify_attempt_bound", notifications.DEFAULT_ATTEMPT_BOUND,
            )),
            # The priority scale this site runs on. The docstring above has
            # always called priorities a site decision; until 2026-09-03 the
            # product did not let a site make it, so a plant with a separate
            # safety-shutdown class above its faults had to record two different
            # things under one word.
            #
            # A malformed scale resolves to the default rather than raising:
            # this is read on every roll-up and every badge, and a site that
            # mistyped one option must not lose its alarm display entirely. The
            # refusal is surfaced instead, so the mistake is visible and the
            # plant stays legible.
            "priority_scale": self._resolved_priority_scale(options),
        }

    @staticmethod
    def _resolved_priority_scale(options: Mapping[str, Any]) -> dict[str, Any]:
        """Resolve the site scale, degrading to the default and saying so."""
        try:
            return alarm_vocabulary.resolve_priority_scale(options)
        except alarm_vocabulary.AlarmScaleRejected as rejected:
            scale = alarm_vocabulary.resolve_priority_scale({})
            return {**scale, "rejected": {"code": rejected.code, **rejected.detail}}

    def _append_history(self, row: dict[str, Any]) -> list[dict[str, Any]]:
        """Append one alarm-history row through the single bounded path.

        Every writer goes through here. A bound applied at two call sites and
        forgotten at a third is how `ack_alarm` became the unbounded one.
        """
        return alarm_engine.append_history(
            self.data["alarm_history"], row, bound=self.alarm_settings()["history_bound"],
        )

    async def shelve_alarm(
        self, project_id: str, alarm_id: str, minutes: int, user_id: str | None,
    ) -> dict[str, Any]:
        """Shelve one alarm until an expiry, or refuse with a reason.

        The bound was previously a silent clamp -- `min(int(minutes), 10080)` --
        so a request for ninety days became seven and the operator was never
        told. That is a worse answer than a refusal: they walk away believing
        the alarm is quiet for three months.
        """
        now = datetime.now(timezone.utc)
        try:
            requested = int(minutes)
        except (TypeError, ValueError):
            raise ValueError("shelve_malformed") from None
        if requested < 1:
            raise ValueError("shelve_in_the_past")
        until = now + timedelta(minutes=requested)
        refusal = alarm_engine.refuse_shelve(until, now=now, settings=self.alarm_settings())
        if refusal is not None:
            raise ValueError(refusal)

        key = f"{project_id}:{alarm_id}"
        state = self.data["alarm_state"].setdefault(
            key, {"project_id": project_id, "alarm_id": alarm_id}
        )
        state["shelved_until"] = until.isoformat()
        state["shelved_by"] = user_id
        # D13: acknowledgement audited and shelving did not, which made the
        # *less* reversible of the two the less auditable.
        self.data["alarm_history"] = self._append_history(
            {**deepcopy(state), "transition": "shelve"}
        )
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

    def configure_remote_sites(
        self, sites: list[dict[str, Any]], *, allowlist: list[str] | None = None,
    ) -> None:
        """Accept only the sites that pass the destination check.

        D9: this accepted any `url` -- no scheme check, no host validation, no
        allowlist -- and the Companion then made an authenticated request to it
        and returned the body to the browser. A refused site is *dropped and
        recorded*, never silently kept: a site that looks configured and is not
        reachable is a plant somebody believes is being watched.
        """
        self.site_allowlist = list(allowlist or [])
        self.remote_sites = {}
        self.site_refusals = []
        for site in sites:
            try:
                descriptor = site_destinations.validate_site(site, allowlist=self.site_allowlist)
            except site_destinations.DestinationRefused as refused:
                self.site_refusals.append({
                    "reason": refused.reason, "site_id": str(site.get("id") or ""),
                })
                continue
            self.remote_sites[str(site["id"])] = {**deepcopy(site), "descriptor": descriptor}

    async def _fetch_site_states(self, site_id: str, *, timeout: float) -> list[dict[str, Any]]:
        """Fetch every state from one site in one request.

        `GET /api/states` returns all of them. The shipped code asked once per
        entity, so two hundred entities against one unresponsive site was fifty
        minutes inside a websocket handler -- and over a slow link the round
        trips *are* the cost.
        """
        site = self.remote_sites[site_id]
        descriptor = site["descriptor"]
        # Re-checked immediately before connecting, because a name allowlisted
        # and validated an hour ago may resolve to 127.0.0.1 now.
        site_destinations.check_before_connecting(
            descriptor,
            allowlist=self.site_allowlist,
            resolve=self._resolve_host,
        )
        session = async_get_clientsession(self.hass, verify_ssl=descriptor["verified_tls"])
        headers = {"Authorization": f"Bearer {site['token']}", "Content-Type": "application/json"}
        async with session.get(
            f"{site['url'].rstrip('/')}/api/states", headers=headers, timeout=timeout,
        ) as response:
            if response.status >= 400:
                raise PermissionError(f"HTTP {response.status}")
            return await response.json()

    async def read_remote_states(
        self, site_ids: list[str], entity_ids: list[str],
    ) -> dict[str, Any]:
        """Read many sites at once, and say which did not answer.

        Returns the fan-out result rather than a bare state map, because a state
        map cannot express "this site was silent" without inventing a state for
        its entities -- which is exactly what the shipped code did.
        """
        result = await remote_fanout.read_sites(
            [site_id for site_id in site_ids if site_id in self.remote_sites],
            entity_ids,
            fetch=lambda site_id, timeout: self._fetch_site_states(site_id, timeout=timeout),
            is_open=self.site_breakers.should_skip,
        )
        for answer in result.answers:
            if answer.answered:
                self.site_breakers.record_success(answer.site_id)
            elif answer.state != "circuit_open":
                self.site_breakers.record_failure(answer.site_id)
        return {
            "absent_sites": result.absent,
            "answered_sites": result.answered,
            "deadline_reached": result.deadline_reached,
            "limit": result.limit,
            # Merged with absence kept absent: an entity missing here is
            # missing, never `unavailable`.
            "states": site_health.merge_states(result.answers),
            "truncated": result.truncated,
        }

    def _resolve_host(self, host: str) -> str:
        """Resolve a host to the address that will actually be connected to."""
        import socket

        return socket.gethostbyname(host)

    async def remote_control(
        self, site_id: str, domain: str, service: str, data: dict[str, Any],
    ) -> dict[str, Any]:
        """Call one remote service, with the four outcomes local controls have.

        T9-11: this returned the remote's JSON on success and raised on any
        failure, so Phase 4's *accepted*, *sent*, *confirmed* and *failed after
        dispatch* all collapsed into two.

        T9-12: and a timeout was reported as a failure. Over a network that is
        the canonical case where the service may well have run, so it is
        `effect_unknown` -- reporting it as failed invites a retry, and a retry
        after an unknown is how plant gets operated twice.
        """
        site = self.remote_sites.get(site_id)
        if not site:
            raise ValueError("remote site not found")
        if domain not in SAFE_SERVICE_DOMAINS:
            raise PermissionError("service domain not allowed")

        descriptor = site["descriptor"]
        site_destinations.check_before_connecting(
            descriptor, allowlist=self.site_allowlist, resolve=self._resolve_host,
        )
        session = async_get_clientsession(self.hass, verify_ssl=descriptor["verified_tls"])
        headers = {"Authorization": f"Bearer {site['token']}", "Content-Type": "application/json"}
        url = f"{site['url'].rstrip('/')}/api/services/{domain}/{service}"

        try:
            async with session.post(url, headers=headers, json=data, timeout=15) as response:
                if response.status >= 300:
                    return {"outcome": "failed", "reason": "unauthorized", "readback": []}
                # `POST /api/services` returns the states it changed. That is
                # the readback `confirmed` needs, and the shipped code discarded
                # it.
                readback = await response.json()
        except asyncio.TimeoutError:
            return {"outcome": site_vocabulary.outcome_for_failure("timeout"),
                    "reason": "timeout", "readback": []}
        except Exception as error:  # noqa: BLE001 - mapped to a closed reason
            reason = remote_fanout.classify_failure(error)
            return {"outcome": site_vocabulary.outcome_for_failure(reason),
                    "reason": reason, "readback": []}

        return {
            "outcome": "confirmed" if readback else "sent",
            "reason": None,
            "readback": readback or [],
        }

    def alarm_index(self) -> dict[str, list[str]]:
        """Return the current entity to alarm index, rebuilt from one place."""
        return alarm_engine.rebuild_alarm_index(self.data["projects"])

    @callback
    def async_refresh_alarm_subscription(self) -> None:
        """Re-subscribe to exactly the entities that carry an alarm.

        Called from every path in `alarm_engine.INDEX_MUTATION_PATHS`. The
        subscription *follows* the index rather than being set up once: a
        newly-alarmed entity that nothing re-subscribed to is an alarm that
        never fires, which is a worse failure than the full scan this replaces.
        """
        # Reconciliation runs here because it answers the same question the
        # index does -- which alarms exist -- and two places asking it is how
        # they come to disagree.
        reconciled = alarm_engine.reconcile_alarm_state(
            self.data["alarm_state"], self.data["projects"],
        )
        if reconciled["dropped"]:
            self.data["alarm_state"] = reconciled["state"]
            for key in reconciled["dropped"]:
                self.data["alarm_history"] = self._append_history(
                    {"alarm_key": key, "transition": "reconciled", "at": _utc()}
                )

        if self._alarm_unsub is not None:
            self._alarm_unsub()
            self._alarm_unsub = None
        entities = alarm_engine.watched_entities(self.data["projects"])
        if not entities:
            return

        async def _listener(event) -> None:
            await self.process_state_change(event)

        self._alarm_unsub = async_track_state_change_event(
            self.hass, entities, _listener,
        )

    async def async_mark_started(self) -> None:
        """Open the startup grace period and re-arm the delays that survived.

        Both halves belong together: the grace exists because the boot scan is
        not trustworthy, and the re-arming exists because the tasks that were
        pending during the previous run are gone. Doing one without the other
        leaves either a mute installation or a set of delays that silently
        restarted from zero.
        """
        self._started_at = datetime.now(timezone.utc)
        pending = alarm_engine.pending_from_state(
            self.data["alarm_state"], now=self._started_at,
        )
        for entry in pending:
            key = entry["key"]
            if key in self._alarm_tasks and not self._alarm_tasks[key].done():
                continue
            project = self.data["projects"].get(entry["project_id"]) or {}
            alarm = next(
                (
                    candidate
                    for candidate in (project.get("config") or {}).get("alarms") or []
                    if candidate.get("id") == entry["alarm_id"]
                ),
                None,
            )
            if alarm is None:
                # The alarm is gone from the project. Plan 06-10 reconciles the
                # orphaned state; re-arming a task for it would annunciate an
                # alarm nobody can see.
                continue
            entity = _entity_id(alarm.get("entity"))
            if not entity:
                continue
            self._alarm_tasks[key] = self.hass.async_create_task(
                self._delayed_transition(
                    project_id=entry["project_id"],
                    alarm=deepcopy(alarm),
                    entity_id=entity,
                    key=key,
                    # What is *left* of the delay, not the whole delay again. A
                    # four-minute-old five-minute delay fires in one minute.
                    delay_seconds=entry["fires_in_seconds"],
                )
            )

    async def process_state_change(self, event) -> None:
        entity_id = event.data.get("entity_id")
        new_state = event.data.get("new_state")
        if not entity_id:
            return
        raw = getattr(new_state, "state", None)
        for project_id, project in list(self.data["projects"].items()):
            for alarm in project.get("config", {}).get("alarms", []):
                if _entity_id(alarm.get("entity")) != entity_id:
                    continue
                key = f"{project_id}:{alarm.get('id')}"
                current = self.data["alarm_state"].get(key, {})
                previous_active = bool(current.get("active"))
                # Suppression is read from the *runtime* state, not from the
                # project config: shelving and acknowledgement are things an
                # operator did, and the engine writes them into `alarm_state`.
                suppression = alarm_engine.suppression_for(
                    {**alarm, **current},
                    state=raw,
                    now=datetime.now(timezone.utc),
                    settings=self.alarm_settings(),
                )
                decision = alarm_engine.decide(
                    alarm, raw,
                    previous_active=previous_active,
                    previous_state=current.get("state"),
                    suppression=suppression,
                )

                if decision["reason"] == "suppressed":
                    # D1, closed. The alarm neither processes nor notifies, and
                    # the record says which suppression applied -- "quiet"
                    # without a reason is exactly what shelving shipped.
                    current["suppressed_by"] = decision["suppressed_by"]
                    current["suppression"] = decision["suppression"]
                    current["last_value"] = raw
                    self.data["alarm_state"][key] = current
                    continue

                if decision["reason"] == "indeterminate":
                    # An entity that vanished has not returned to normal. Holding
                    # the previous state is what stops a restart -- during which
                    # every entity passes through `unavailable` -- from looking
                    # like every alarm clearing at once, which is D5.
                    continue

                if alarm_engine.startup_grace_active(
                    started_at=self._started_at,
                    now=datetime.now(timezone.utc),
                    settings=self.alarm_settings(),
                ):
                    # D5's other half. Entities do not all arrive at once on
                    # boot, and a scan that runs while they are settling sees a
                    # plant in a state it was never in. The last value is still
                    # recorded, so nothing is lost -- only the transition is
                    # withheld.
                    current["last_value"] = raw
                    self.data["alarm_state"][key] = current
                    continue

                if decision["reason"] == "delay_pending":
                    # The anchor, not a restart. A pending task is left alone
                    # while the condition stays continuously active, so a sensor
                    # whose value keeps changing above threshold still
                    # annunciates at first_activation + delay. Cancelling and
                    # recreating here was D10, and it meant a persistent noisy
                    # fault never annunciated at all.
                    if key in self._alarm_tasks and not self._alarm_tasks[key].done():
                        continue
                    # Persisted, because `_alarm_tasks` is in-memory only: a
                    # delay pending at shutdown was lost and never fired.
                    current.setdefault("delay_anchor", _utc())
                    current["delay_seconds"] = decision["delay_seconds"]
                    current["project_id"] = project_id
                    current["alarm_id"] = alarm.get("id")
                    self.data["alarm_state"][key] = current
                    self._alarm_tasks[key] = self.hass.async_create_task(
                        self._delayed_transition(
                            project_id=project_id,
                            alarm=deepcopy(alarm),
                            entity_id=entity_id,
                            key=key,
                            # Read from the alarm this call is about. The defect
                            # (D2) was a free `delay` variable read after the
                            # loop finished, so every alarm on one entity waited
                            # the last one's delay.
                            delay_seconds=alarm_engine.scheduled_delays([alarm])[str(alarm.get("id"))],
                        )
                    )
                    continue

                task = self._alarm_tasks.pop(key, None)
                if task is not None and not decision["active"]:
                    task.cancel()
                await self.alarm_transition(project_id, alarm, decision["active"], raw)

    async def _delayed_transition(
        self, *, project_id: str, alarm: dict[str, Any], entity_id: str, key: str,
        delay_seconds: int,
    ) -> None:
        """Annunciate one alarm after its own delay, if it is still active.

        Every value this needs is a parameter. The version this replaces bound
        four of them as default arguments and left the fifth -- the delay --
        free, so it read the enclosing loop's final value when the coroutine
        actually ran.
        """
        try:
            await asyncio.sleep(delay_seconds)
            state = self.hass.states.get(entity_id)
            current = self.data["alarm_state"].get(key, {})
            raw = state.state if state else None
            if alarm_engine.evaluate(raw, alarm, bool(current.get("active"))):
                await self.alarm_transition(project_id, alarm, True, raw)
        except asyncio.CancelledError:
            return
        finally:
            if self._alarm_tasks.get(key) is asyncio.current_task():
                self._alarm_tasks.pop(key, None)

    def schedule_timezone(self, project: dict[str, Any]) -> str:
        """Return the timezone a project's schedules resolve against.

        The project may pin one; otherwise Home Assistant's. Pinning matters
        because the preview and the runner must agree, and a browser in a
        different zone from the plant is ordinary.
        """
        declared = (project.get("config") or {}).get("timezone")
        if isinstance(declared, str) and declared:
            return declared
        return str(getattr(self.hass.config, "time_zone", None) or "UTC")

    async def run_schedules(self, now: datetime) -> None:
        """Execute the schedules whose resolved instant falls due in this tick.

        Compares *instants*, not `now.strftime("%H:%M")` against a stored
        string. That comparison skipped the lost hour outright -- the wall-clock
        minute simply never arrived, so the equality never held and nothing
        recorded that anything was missed -- and it was saved from double-firing
        in the ambiguous hour only by a fold-blind dedupe key, which is to say by
        the cache rather than by the logic.
        """
        moment = now.astimezone(timezone.utc)
        dirty = False
        for project_id, project in list(self.data["projects"].items()):
            config = project.get("config", {})
            allowed = _safe_domains(project)
            zone = self.schedule_timezone(project)
            for sched in config.get("schedules", []):
                if sched.get("kind") == "interval":
                    # An operating period is a state, not an instant. Firing a
                    # service at one would be converting between the two models,
                    # which the bindings deliberately refuse to do.
                    continue
                try:
                    due = schedule_time.due_instants(sched, now=moment, zone=zone)
                except (ValueError, KeyError):
                    # A malformed entry is a schema failure, not a runtime one.
                    # Schema 5 quarantines these; an older stored entry is
                    # skipped rather than allowed to stop every later schedule.
                    continue
                for instant in due:
                    key = schedule_time.run_key(project_id, str(sched.get("id")), instant)
                    if self.data["schedule_runs"].get(key):
                        continue
                    outcome = await self._execute_schedule(
                        project_id, sched, allowed, instant=instant,
                    )
                    self.data["schedule_runs"][key] = outcome["at"]
                    dirty = True
        if dirty:
            # D8: this derived a date by splitting a composite key whose last
            # segment is the *minute*, so `"30" >= "2026-08-19"` held forever
            # and nothing was ever dropped. The prune reads the stored instant.
            self.data["schedule_runs"] = alarm_engine.prune_schedule_runs(
                self.data["schedule_runs"],
                retention_days=self.alarm_settings()["schedule_run_retention_days"],
                now=datetime.now(timezone.utc),
            )
            await self.async_save()

    def alarm_runtime_for(self, project_id: str) -> dict[str, Any]:
        """Return the engine's alarm rows for one project, keyed by alarm id.

        The panel badge and the portfolio roll-up both read this, so both show
        what the engine decided. They previously read `alarm["state"]` from the
        project *config* -- a design-time field the engine never writes -- which
        is why they were permanently detached from the running engine.
        """
        rows: dict[str, Any] = {}
        for row in self.data["alarm_state"].values():
            if row.get("project_id") != project_id:
                continue
            rows[str(row.get("alarm_id"))] = deepcopy(row)
        return rows

    def with_alarm_runtime(self, project: dict[str, Any]) -> dict[str, Any]:
        """Return a copy of `project` whose config carries the engine's rows."""
        copy = deepcopy(project)
        config = copy.setdefault("config", {})
        config["_alarm_runtime"] = self.alarm_runtime_for(str(copy.get("id")))
        return copy

    async def save_schedule(
        self, project_id: str, entry: dict[str, Any], *, actor: Any = None,
    ) -> dict[str, Any]:
        """Create or replace one schedule entry, validated and audited.

        Schedules were previously edited only as project config through the
        ordinary save path, so there was no audit of an edit at all -- for the
        thing that runs the plant. Every edit writes a row with server
        provenance now.
        """
        project = self.data["projects"].get(project_id)
        if project is None:
            raise ValueError("unknown_project")
        entry = deepcopy(entry)
        # Validated here, not at the runner. Schema 5 closed the shape; this is
        # the boundary that keeps a `time` of "tea" from being stored at all,
        # rather than discovered at the moment it was supposed to run.
        time = entry.get("time") or entry.get("from")
        if entry.get("kind", "instant") == "instant":
            if not time:
                raise ValueError("schedule_time_required")
            try:
                schedule_time.candidate_instants(
                    "2000-01-03", str(time), self.schedule_timezone(project),
                )
            except ValueError as error:
                raise ValueError("schedule_time_malformed") from error
        days = entry.get("days")
        if days is not None and not all(
            isinstance(day, int) and not isinstance(day, bool) and 0 <= day <= 6
            for day in days
        ):
            raise ValueError("schedule_days_malformed")

        config = project.setdefault("config", {})
        schedules = config.setdefault("schedules", [])
        replaced = False
        for index, existing in enumerate(schedules):
            if existing.get("id") == entry["id"]:
                schedules[index] = entry
                replaced = True
                break
        if not replaced:
            schedules.append(entry)

        await self.add_audit(
            {
                "action": "schedule.save",
                "detail": {
                    "project_id": project_id,
                    "schedule_id": entry["id"],
                    "replaced": replaced,
                },
            },
            getattr(actor, "user_id", None),
            getattr(actor, "user_name", None),
        )
        await self.async_save()
        return deepcopy(entry)

    async def delete_schedule(
        self, project_id: str, schedule_id: str, *, actor: Any = None,
    ) -> bool:
        """Remove one schedule entry, and audit the removal."""
        project = self.data["projects"].get(project_id)
        if project is None:
            return False
        schedules = (project.get("config") or {}).get("schedules") or []
        remaining = [entry for entry in schedules if entry.get("id") != schedule_id]
        removed = len(remaining) != len(schedules)
        if not removed:
            return False
        project["config"]["schedules"] = remaining
        await self.add_audit(
            {
                "action": "schedule.delete",
                "detail": {"project_id": project_id, "schedule_id": schedule_id},
            },
            getattr(actor, "user_id", None),
            getattr(actor, "user_name", None),
        )
        await self.async_save()
        return True

    async def _execute_schedule(
        self, project_id: str, sched: dict[str, Any], allowed: Any, *, instant: str,
    ) -> dict[str, Any]:
        """Run one schedule entry and record what happened.

        D6's schedule half: the previous call was `blocking=False` inside
        `except Exception: continue`, so a schedule that failed was
        indistinguishable from one that ran, and neither wrote an audit row. A
        plant that ran the wrong sequence has to be answerable from the audit.
        """
        record = {
            "project_id": project_id,
            "schedule_id": sched.get("id"),
            "instant": instant,
            "at": _utc(),
            "service": sched.get("service"),
            "outcome": "delivered",
            "error": None,
        }
        spec = notifications.split_service(sched.get("service"))
        if spec is None:
            record.update(outcome="refused", error="no service configured")
        else:
            domain, service = spec
            if domain not in allowed:
                record.update(
                    outcome="refused",
                    error=f"{domain} is not an allowed service domain",
                )
            else:
                data = deepcopy(sched.get("data") or {})
                if sched.get("entity_id"):
                    data.setdefault("entity_id", sched["entity_id"])
                # A schedule firing a real service during a rehearsal is the
                # same write with a timer in front of it, so it asks the same
                # question the button does.
                schedule_gate = dispatch_gate.decide_dispatch(
                    "schedule_service",
                    is_simulating=lambda: self.simulation_active(sched.get("project_id") or ""),
                )
                if not schedule_gate.may_dispatch:
                    # Recorded, not skipped. A schedule that did not run during
                    # a rehearsal must be distinguishable afterwards from one
                    # that ran and failed, and from one that never fired --
                    # which is the whole reason Phase 6 gave schedule runs an
                    # outcome field. It falls through to the same append below.
                    record.update(outcome="refused", error=schedule_gate.reason)
                else:
                    try:
                        await asyncio.wait_for(
                            self.hass.services.async_call(domain, service, data, blocking=True),
                            timeout=self.alarm_settings()["notify_timeout_seconds"],
                        )
                    except asyncio.TimeoutError:
                        record.update(outcome="timeout", error="no result within the timeout")
                    except Exception as error:  # noqa: BLE001 - the outcome is the subject
                        record.update(outcome="failed", error=str(error))
        self.data["schedule_history"] = alarm_engine.append_history(
            self.data.get("schedule_history") or [],
            record,
            bound=self.alarm_settings()["history_bound"],
        )
        return record

    def simulation_active(self, project_id: str) -> bool:
        """Return whether a project is being rehearsed.

        The store holds no runtime reference, so the runtime injects a reader
        when it is published. Absent one, this answers `None` by raising, which
        `decide_dispatch` treats as "cannot tell" and therefore refuses -- the
        fail-closed rule. A store that answered `False` here would silently
        disable the whole gate for schedules.
        """
        reader = getattr(self, "_simulation_reader", None)
        if reader is None:
            raise RuntimeError("simulation state reader is not attached")
        return bool(reader(project_id))

    def attach_simulation_reader(self, reader) -> None:
        self._simulation_reader = reader


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
    #: Which projects are being rehearsed. Runtime state the Companion owns, not
    #: a project-document field: D2 made operator-authored data decide whether a
    #: write reached plant.
    simulation: SimulationSessions = field(default_factory=SimulationSessions)
    #: One registry per project. Keyed rather than shared, so a listing
    #: cannot reach a project the caller never opened.
    extensions: dict[str, SdkRegistry] = field(default_factory=dict)
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
        # Installed packs belong to the runtime that validated them. Carrying
        # them across a reload would mean a pack accepted under one project
        # schema version surviving into an installation running another.
        for registry in self.extensions.values():
            registry.clear()
        self.extensions.clear()

    async def async_close(self) -> None:
        """Close the complete entry-owned runtime, tolerating repetition."""
        await self.async_invalidate()
        await self.manager.async_close()


def _component_data(hass: HomeAssistant) -> dict[str, Any]:
    """Return component data without relying on ConfigEntry.runtime_data."""
    data = hass.data.setdefault(DOMAIN, {})
    data.setdefault("runtimes", {})
    data.setdefault("commands_registered", False)
    data.setdefault("frontend_served", False)
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

    # The simulation gate, asked immediately before anything durable happens.
    #
    # T8-01. Before this, `hass.services.async_call` below ran unconditionally
    # while the interface displayed "Simulationsmodus aktiv", so an engineer
    # rehearsing a sequence was operating the plant and had been told they were
    # not. The state is read *now* rather than captured earlier: a session that
    # started or expired while this handler was awaiting something is exactly
    # the window the gate exists to cover.
    gate = dispatch_gate.decide_dispatch(
        "control",
        is_simulating=lambda: runtime.simulation.is_simulating(project_id=decision.project_id),
    )
    if not gate.may_dispatch:
        await _audit_simulation_refusal(hass, connection, decision, "control", gate, resolved.control_id)
        connection.send_error(msg["id"], gate.reason, f"{gate.reason}: control was not dispatched")
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
    # Declared `enumeration="filter"`, so the guard admits an unauthorized
    # caller by design and the filtering is the handler's job. It was not being
    # done: the cursor's row source filtered by *project*, and the project came
    # from the decision, so an unassigned caller who named a project id received
    # its trusted evidence -- who operated which entity, and with what result.
    # The `alarms/list` leak of `9f53bcb` again, on the audit trail this time.
    if not runtime.policy.visible_projects(
        connection, [decision.project_id], "evidence.read"
    ):
        connection.send_result(
            msg["id"],
            {"rows": [], "cursor": None, "has_more": False, "provenance": "trusted"},
        )
        return
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
    manager = _manager(hass)
    permitted = [
        manager.with_alarm_runtime(head) for head in heads if head["id"] in visible
    ]
    # One scale for the whole roll-up: it is a site setting, and totals summed
    # across projects tiered differently would be a number with no meaning.
    scale = manager.alarm_settings()["priority_scale"]
    connection.send_result(msg["id"], roll_up_portfolio(permitted, scale))


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
        {**config, "_alarm_runtime": _manager(hass).alarm_runtime_for(decision.project_id)},
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
        # Reachable and retired, but still a path to a service call -- so it
        # asks the same question. A gate applied only to the paths somebody
        # remembered has the shape of somebody's memory (T8-03).
        legacy_gate = dispatch_gate.decide_dispatch(
            "control",
            is_simulating=lambda: _runtime_for(hass).simulation.is_simulating(
                project_id=str(msg.get("project_id") or ""),
            ),
        )
        if not legacy_gate.may_dispatch:
            connection.send_error(
                msg["id"], legacy_gate.reason, f"{legacy_gate.reason}: control was not dispatched",
            )
            return
        await hass.services.async_call(domain, msg["service"], data, blocking=True, context=Context(user_id=uid))
        after = hass.states.get(entity_id)
        event = {"action":"control.execute","detail":{"project_id":msg["project_id"],"entity_id":entity_id,"service":f"{domain}.{msg['service']}","before":before.state if before else None,"after":after.state if after else None}}
        await _manager(hass).add_audit(event, uid, uname)
        connection.send_result(msg["id"], {"ok":True,"before":before.state if before else None,"after":after.state if after else None})
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
    except Exception as err:
        connection.send_error(msg["id"], "service_failed", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/alarms/list",
    # Optional with a default, so the generic policy prober reaches a
    # decision rather than a schema rejection; the guard resolves the
    # project from it and the handler reads it back off the decision.
    vol.Optional("project_id", default=""): str,
    vol.Optional("limit", default=500): int,
})
@websocket_api.async_response
async def ws_alarms_list(hass, connection, msg):
    """Return alarm state and history for the one project this request names.

    The route is declared `enumeration="filter"`, which means the policy guard
    deliberately does *not* deny an unauthorized caller -- refusing would itself
    tell them that rows exist. Filtering is therefore the handler's job, and
    this handler did not do it: it returned the named project's complete alarm
    state and history to anyone who could name the id.

    The project comes from the decision rather than from the message, so the
    rows returned are the rows for the project policy actually resolved.

    Rows are filtered before the limit is applied. Slicing first would let
    another project's rows consume the caller's page, turning the limit into a
    count oracle for a project they cannot open.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    manager = _manager(hass)
    project_id = decision.project_id
    permitted = runtime.policy.visible_projects(connection, [project_id], "alarm.read")
    if not permitted:
        # The same answer a project with no alarms gives. An unassigned caller
        # learns nothing about whether the project exists, or whether it is
        # quiet.
        connection.send_result(msg["id"], {"states": [], "history": []})
        return

    states = [
        deepcopy(row) for row in manager.data["alarm_state"].values()
        if row.get("project_id") == project_id
    ]
    history = [
        deepcopy(row) for row in manager.data["alarm_history"]
        if row.get("project_id") == project_id
    ][: msg["limit"]]
    connection.send_result(msg["id"], {"states": states, "history": history})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/schedules/list",
    # Optional with a default, so the generic policy prober reaches a decision
    # rather than a schema rejection. Phase 5 lost a round to exactly this.
    vol.Optional("project_id", default=""): str,
    vol.Optional("limit", default=500): int,
})
@websocket_api.async_response
async def ws_schedules_list(hass, connection, msg):
    """Return the schedules and execution history of the project this names.

    Declared `enumeration="filter"`, so the guard deliberately does not deny --
    refusing would itself tell an unauthorized caller that rows exist -- and the
    filtering is the handler's job. This is the shape of the `alarms/list` leak
    fixed in `9f53bcb`, applied before it can happen again.

    Rows are filtered *before* the limit. Slicing first would let another
    project's rows consume the caller's page, turning the limit into a count
    oracle for a project they cannot open.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    manager = _manager(hass)
    project_id = decision.project_id
    permitted = runtime.policy.visible_projects(connection, [project_id], "schedule.read")
    if not permitted:
        connection.send_result(msg["id"], {"schedules": [], "history": []})
        return

    project = manager.data["projects"].get(project_id) or {}
    schedules = deepcopy((project.get("config") or {}).get("schedules") or [])
    history = [
        deepcopy(row) for row in (manager.data.get("schedule_history") or [])
        if row.get("project_id") == project_id
    ][: msg["limit"]]
    connection.send_result(msg["id"], {
        "schedules": schedules,
        "history": history,
        "timezone": manager.schedule_timezone(project),
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/schedules/save",
    vol.Optional("project_id", default=""): str,
    vol.Optional("schedule", default=dict): dict,
})
@websocket_api.async_response
async def ws_schedules_save(hass, connection, msg):
    """Create or replace one schedule entry, and audit the edit."""
    decision = msg[DECISION_KEY]
    manager = _manager(hass)
    entry = dict(msg["schedule"] or {})
    if not entry.get("id"):
        connection.send_error(msg["id"], "invalid_input", "schedule_id_required")
        return
    try:
        saved = await manager.save_schedule(
            decision.project_id, entry, actor=decision.actor,
        )
    except ValueError as error:
        connection.send_error(msg["id"], "invalid_input", str(error))
        return
    connection.send_result(msg["id"], saved)


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/schedules/delete",
    vol.Optional("project_id", default=""): str,
    vol.Optional("schedule_id", default=""): str,
})
@websocket_api.async_response
async def ws_schedules_delete(hass, connection, msg):
    """Remove one schedule entry, and audit the removal."""
    decision = msg[DECISION_KEY]
    manager = _manager(hass)
    removed = await manager.delete_schedule(
        decision.project_id, str(msg["schedule_id"]), actor=decision.actor,
    )
    connection.send_result(msg["id"], {"removed": removed})


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/schedules/preview",
    vol.Optional("project_id", default=""): str,
    vol.Optional("schedule", default=dict): dict,
    vol.Optional("dates", default=list): [str],
})
@websocket_api.async_response
async def ws_schedules_preview(hass, connection, msg):
    """Resolve one entry across the dates asked for, and say what happens.

    Server-side, on the *site's* timezone, so the preview an engineer verifies
    is the resolution the runner will use. Resolving in the browser would answer
    for the browser's zone, and a browser in a different zone from the plant is
    ordinary.
    """
    decision = msg[DECISION_KEY]
    manager = _manager(hass)
    project = manager.data["projects"].get(decision.project_id) or {}
    zone = manager.schedule_timezone(project)
    entry = dict(msg["schedule"] or {})
    rows = []
    for date in list(msg["dates"])[:31]:
        try:
            rows.append({"date": date, **schedule_time.resolve_entry(entry, date, zone)})
        except ValueError as error:
            rows.append({"date": date, "status": "invalid", "error": str(error)})
    connection.send_result(msg["id"], {"timezone": zone, "dates": rows})


# -- history ---------------------------------------------------------------
#
# Four routes, and the boundary they create is the point of plan 07-08. Every
# history read used to be a browser `callApi`, so the project policy never saw
# one and no export was audited.
#
# The bodies here are deliberately thin. They enforce the boundary -- filter,
# bound, audit -- and hand the query itself to the modules that own it. Plans
# 07-09 and 07-10 fill in bounds and coverage; until they land these answer with
# an empty, honestly-sourced result rather than with a fabricated one.


async def _ask_recorder(hass, request):
    """Issue one Recorder request, returning `(answer, error)`.

    A failure is carried rather than raised, because the caller has to turn it
    into a *stated* outcome: a correct implementation and a broken one both
    produce an empty series, and only the stated source separates them.

    The Recorder's query functions are synchronous and touch the database, so
    they run on its own executor rather than the event loop. An installation
    with the Recorder disabled -- which is a supported configuration, not a
    fault -- reaches the first branch and reports it as a stated outcome rather
    than raising.
    """
    contract = request.get("contract")
    message = request.get("message") or {}
    try:
        from homeassistant.components.recorder import get_instance, statistics
        from homeassistant.components.recorder import history as recorder_history
    except ImportError:
        return None, "recorder is not installed"

    instance = None
    try:
        instance = get_instance(hass)
    except (KeyError, RuntimeError):
        instance = None
    if instance is None:
        return None, "recorder is not running"

    start = dt_util.parse_datetime(str(message.get("start_time") or ""))
    end = dt_util.parse_datetime(str(message.get("end_time") or ""))
    if start is None:
        return None, "query window has no start"

    try:
        if contract == "statistics":
            return await instance.async_add_executor_job(
                statistics.statistics_during_period,
                hass,
                start,
                end,
                set(message.get("statistic_ids") or []),
                message.get("period") or "day",
                None,
                set(message.get("types") or ("change",)),
            ), None
        if contract == "statistic":
            return await instance.async_add_executor_job(
                statistics.statistic_during_period,
                hass,
                start,
                end,
                str(message.get("statistic_id") or ""),
                set(message.get("types") or ("change",)),
                None,
            ), None
        return await instance.async_add_executor_job(
            recorder_history.get_significant_states,
            hass,
            start,
            end,
            list(message.get("entity_ids") or []),
        ), None
    except Exception as error:  # noqa: BLE001 - the outcome is the subject
        return None, str(error)


def _history_bounds_for(hass, project_id: str) -> dict:
    """Return the effective query bounds for one project.

    Read from the project's `trend` block, which schema 6 closed, so a site
    configures them where it configures everything else. An unconfigured
    installation gets the conservative defaults rather than no bound.
    """
    project = _manager(hass).data["projects"].get(project_id) or {}
    trend = (project.get("config") or {}).get("trend") or {}
    return history_bounds.resolve_bounds(trend)


async def _audit_simulation_refusal(hass, connection, decision, kind, gate, subject) -> None:
    """Record that an effect was withheld, and why.

    A refusal that leaves no trace is indistinguishable afterwards from a
    dispatch nobody attempted. During a rehearsal that distinction is the whole
    record: "we tried to start the pump and the block held" and "nobody tried"
    are different facts about a commissioning test.
    """
    uid, uname, _admin = _user(connection)
    await _manager(hass).add_audit({
        "action": "simulation.refused",
        "detail": {
            "kind": kind,
            "project_id": getattr(decision, "project_id", ""),
            "reason": gate.reason,
            "subject": subject,
        },
    }, uid, uname)


def _may_reach_site(hass, connection, site) -> bool:
    """Return whether this caller may reach one site.

    T9-09. `remote_control` checked only the service domain, which is a good
    check and was the *only* one: the caller's `project_id` drove a role check
    but was never checked against the site, so an operator on project A could
    operate site B.

    A site declares which projects it belongs to, and that binding is server
    configuration -- the same rule as the destination allowlist, the notification
    allowlist and the simulation gate. A site with no declared projects is
    reachable by anyone who holds `remote.read`, which is the pre-existing
    single-site behaviour and is stated here rather than left implicit.
    """
    runtime = _runtime_for(hass)
    project_ids = list((site or {}).get("project_ids") or [])
    if not project_ids:
        return True
    return bool(runtime.policy.visible_projects(connection, project_ids, "remote.read"))


def _site_timezone(hass, project_id: str) -> str:
    """Return the timezone a period is resolved in, for one project.

    The project's own timezone where it declares one, and Home Assistant's
    otherwise. Never the browser's: a browser in a different zone from the plant
    is normal, and a period resolved there answers for the wrong midnight. Phase
    6 established this for the schedule preview and the reason is unchanged.
    """
    project = _manager(hass).data["projects"].get(project_id) or {}
    declared = (project.get("config") or {}).get("timezone")
    return str(declared or getattr(hass.config, "time_zone", "") or "UTC")


def _history_window_hours(msg) -> float:
    """Return the requested window in hours, or zero when it is unparseable."""
    start = str(msg.get("start_time") or "")
    end = str(msg.get("end_time") or "")
    if not start or not end:
        return 0.0
    try:
        resolved_start = dt_util.parse_datetime(start)
        resolved_end = dt_util.parse_datetime(end)
    except (TypeError, ValueError):
        return 0.0
    if resolved_start is None or resolved_end is None:
        return 0.0
    return max(0.0, (resolved_end - resolved_start).total_seconds() / 3600)


async def _audit_history(hass, connection, route, *, project_id, msg, rows, contract):
    """Write the audit row for one history read or export."""
    uid, uname, _admin = _user(connection)
    await _manager(hass).add_audit(
        history_routes.audit_read(
            route,
            contract=contract,
            entities=len(list(msg.get("entity_ids") or [])),
            project_id=project_id,
            rows=rows,
            window_hours=_history_window_hours(msg),
        ),
        uid,
        uname,
    )


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/history/series",
    # Optional with defaults, so the generic policy prober reaches a decision
    # rather than a schema rejection. Phase 5 lost a round to exactly this.
    vol.Optional("project_id", default=""): str,
    vol.Optional("entity_ids", default=list): [str],
    vol.Optional("start_time", default=""): str,
    vol.Optional("end_time", default=""): str,
    vol.Optional("expected_instants", default=list): [str],
    vol.Optional("limit", default=500): int,
})
@websocket_api.async_response
async def ws_history_series(hass, connection, msg):
    """Return raw-state series for the entities of the project this names.

    Declared `enumeration="filter"`, so the guard deliberately does not deny and
    the filtering is the handler's job. An unpermitted caller gets an empty
    result rather than a refusal, because a refusal would itself say that rows
    exist.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project_id = decision.project_id
    permitted = runtime.policy.visible_projects(connection, [project_id], "history.read")
    if not permitted:
        connection.send_result(msg["id"], {"series": [], "coverage": 0, "source": "unavailable"})
        return
    # Bounded before the query runs, not after the response returns. A bound
    # checked afterwards has already paid for what it was meant to prevent.
    bounds = _history_bounds_for(hass, project_id)
    decision_on_bounds = history_bounds.decide_query({
        "contract": "raw",
        "entities": len(list(msg["entity_ids"] or [])),
        "window_hours": _history_window_hours(msg),
    }, bounds)
    if decision_on_bounds["outcome"] == "refuse":
        connection.send_error(
            msg["id"],
            decision_on_bounds["reason"],
            f"{decision_on_bounds['reason']}: {decision_on_bounds['detail']}",
        )
        return

    # Filtered first, limited second. Slicing first would let another project's
    # rows consume the caller's page, turning the limit into a count oracle.
    #
    # The expected instants come from the resolved period, never from the
    # answer: the Recorder omits empty periods, so what came back is exactly the
    # thing that cannot say what was asked for.
    expected = list(msg.get("expected_instants") or [])
    request = recorder_query.build_request(
        end=msg["end_time"] or "",
        entity_ids=msg["entity_ids"],
        period="custom",
        start=msg["start_time"] or "",
    )
    answer, query_error = await _ask_recorder(hass, request)
    shaped = recorder_query.shape_answer(
        request["contract"], answer, error=query_error, expected_instants=expected,
    )
    built = series_coverage.build_series(shaped)
    series = built.get("points") or []
    capped = history_bounds.cap_rows(series, bounds)
    await _audit_history(
        hass, connection, "glt_flow_card/history/series",
        contract=decision_on_bounds["source"] or "raw", msg=msg,
        project_id=project_id, rows=len(capped["rows"]),
    )
    connection.send_result(msg["id"], {
        "capped": capped["capped"],
        "coverage": built.get("coverage", 0),
        "gaps": built.get("gaps") or [],
        "series": capped["rows"][: msg["limit"]],
        # A downgraded query says so, and a failed one says so too. The reader is
        # entitled to know which contract produced what they are looking at, and
        # whether anything produced it at all.
        "source": (
            decision_on_bounds["source"]
            if decision_on_bounds["outcome"] == "downgrade"
            else built.get("source", "unavailable")
        ),
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/history/statistics",
    vol.Optional("project_id", default=""): str,
    vol.Optional("entity_ids", default=list): [str],
    vol.Optional("period", default="day"): str,
    vol.Optional("start_time", default=""): str,
    vol.Optional("end_time", default=""): str,
    # Same hazard as the raw route, and the same reason it cannot be inferred:
    # the Recorder omits an empty period entirely, so the answer is exactly the
    # thing that cannot say what was asked for.
    vol.Optional("expected_instants", default=list): [str],
    vol.Optional("limit", default=500): int,
})
@websocket_api.async_response
async def ws_history_statistics(hass, connection, msg):
    """Return long-term statistics for the entities of the project this names."""
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project_id = decision.project_id
    permitted = runtime.policy.visible_projects(connection, [project_id], "history.read")
    if not permitted:
        connection.send_result(msg["id"], {"series": [], "coverage": 0, "source": "unavailable"})
        return
    bounds = _history_bounds_for(hass, project_id)
    decision_on_bounds = history_bounds.decide_query({
        "contract": "statistics",
        "entities": len(list(msg["entity_ids"] or [])),
        "window_hours": _history_window_hours(msg),
    }, bounds)
    if decision_on_bounds["outcome"] == "refuse":
        connection.send_error(
            msg["id"],
            decision_on_bounds["reason"],
            f"{decision_on_bounds['reason']}: {decision_on_bounds['detail']}",
        )
        return

    expected = list(msg.get("expected_instants") or [])
    request = recorder_query.build_request(
        end=msg["end_time"] or "",
        entity_ids=msg["entity_ids"],
        period=msg["period"] or "day",
        start=msg["start_time"] or "",
    )
    answer, query_error = await _ask_recorder(hass, request)
    shaped = recorder_query.shape_answer(
        request["contract"], answer, error=query_error, expected_instants=expected,
    )
    built = series_coverage.build_series(shaped)
    series = built.get("points") or []
    capped = history_bounds.cap_rows(series, bounds)
    await _audit_history(
        hass, connection, "glt_flow_card/history/statistics",
        contract=decision_on_bounds["source"] or "statistics", msg=msg,
        project_id=project_id, rows=len(capped["rows"]),
    )
    connection.send_result(msg["id"], {
        "capped": capped["capped"],
        "coverage": built.get("coverage", 0),
        "gaps": built.get("gaps") or [],
        "series": capped["rows"][: msg["limit"]],
        "source": (
            decision_on_bounds["source"]
            if decision_on_bounds["outcome"] == "downgrade"
            else built.get("source", "unavailable")
        ),
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/history/coverage",
    vol.Optional("project_id", default=""): str,
    vol.Optional("entity_ids", default=list): [str],
    vol.Optional("period", default="day"): str,
    vol.Optional("start_time", default=""): str,
    vol.Optional("end_time", default=""): str,
})
@websocket_api.async_response
async def ws_history_coverage(hass, connection, msg):
    """Return what the Recorder has for this window, without the values.

    A separate route because coverage is a question an operator asks *before*
    committing to a query -- "is there anything there?" -- and answering it by
    fetching everything and counting would be the bound it exists to avoid.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project_id = decision.project_id
    permitted = runtime.policy.visible_projects(connection, [project_id], "history.read")
    if not permitted:
        connection.send_result(msg["id"], {"coverage": 0, "gaps": [], "source": "unavailable"})
        return

    # Resolved here, in the site timezone, and never in the browser: a browser in
    # a different zone from the plant is normal, and resolving there would answer
    # for the browser's zone. Same rule as the schedule preview.
    period = str(msg["period"] or "day")
    try:
        expected = period_resolution.expected_instants(
            period,
            now=dt_util.utcnow().isoformat(),
            timezone=_site_timezone(hass, project_id),
        )
        window = period_resolution.resolve(
            period,
            now=dt_util.utcnow().isoformat(),
            timezone=_site_timezone(hass, project_id),
        )
    except ValueError as error:
        # Refused rather than defaulted. A coverage figure for "sometimes" would
        # silently be a coverage figure for today.
        connection.send_error(msg["id"], "unknown_period", str(error))
        return

    bounds = _history_bounds_for(hass, project_id)
    decision_on_bounds = history_bounds.decide_query({
        "contract": "statistics",
        "entities": len(list(msg["entity_ids"] or [])),
        "window_hours": window["span_hours"],
    }, bounds)
    if decision_on_bounds["outcome"] == "refuse":
        connection.send_error(
            msg["id"],
            decision_on_bounds["reason"],
            f"{decision_on_bounds['reason']}: {decision_on_bounds['detail']}",
        )
        return

    request = recorder_query.build_request(
        end=window["end"], entity_ids=msg["entity_ids"], period=period, start=window["start"],
    )
    answer, query_error = await _ask_recorder(hass, request)
    shaped = recorder_query.shape_answer(
        request["contract"], answer, error=query_error, expected_instants=expected,
    )
    built = series_coverage.build_series(shaped)
    await _audit_history(
        hass, connection, "glt_flow_card/history/coverage",
        contract=decision_on_bounds["source"] or "statistics", msg=msg,
        project_id=project_id, rows=0,
    )
    # The values are deliberately not returned. This route answers "is there
    # anything there?", which an operator asks *before* committing to a query,
    # and answering it by fetching everything and counting would be the bound it
    # exists to avoid.
    connection.send_result(msg["id"], {
        "coverage": built.get("coverage", 0),
        "expected": len(expected),
        "gaps": built.get("gaps") or [],
        "period": window,
        "source": (
            decision_on_bounds["source"]
            if decision_on_bounds["outcome"] == "downgrade"
            else built.get("source", "unavailable")
        ),
        "step": period_resolution.bucket_for(period),
    })


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/history/export",
    vol.Optional("project_id", default=""): str,
    vol.Optional("entity_ids", default=list): [str],
    vol.Optional("period", default="day"): str,
    vol.Optional("start_time", default=""): str,
    vol.Optional("end_time", default=""): str,
    # Recorded in the audit row so the site can say what shape left the
    # building, never used to render here: the model is returned and the three
    # renderings all derive from it, because deriving one from another's
    # serialisation is the defect 07-16 closed.
    vol.Optional("format", default="csv"): str,
})
@websocket_api.async_response
async def ws_history_export(hass, connection, msg):
    """Export a bounded window, and audit that it left the building.

    A separate capability from reading. Whoever may look at the plant's history
    on screen is not automatically whoever may carry it out of the building, and
    the audit row is what lets the site say afterwards what left and how much.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project_id = decision.project_id
    # A backstop, not the live path. The route declares `history.export` and
    # enumerates `opaque`, so the generic guard denies an unauthorized caller
    # before this handler runs -- with `not_found_or_denied`, which deliberately
    # does not distinguish "no such project" from "not allowed", because a
    # caller who learns which one applies has learned the project exists.
    #
    # It stays because the cost of being wrong here is history leaving the
    # building. Unlike a listing there is no honest partial answer to an export:
    # half a month carried out under a name that says "March" is worse than a
    # refusal.
    permitted = runtime.policy.visible_projects(connection, [project_id], "history.export")
    if not permitted:
        connection.send_error(
            msg["id"], "not_permitted", "not_permitted: history.export is required to export history",
        )
        return

    period = str(msg["period"] or "day")
    timezone = _site_timezone(hass, project_id)
    try:
        window = period_resolution.resolve(
            period, now=dt_util.utcnow().isoformat(), timezone=timezone,
        )
        expected = period_resolution.expected_instants(
            period, now=dt_util.utcnow().isoformat(), timezone=timezone,
        )
    except ValueError as error:
        connection.send_error(msg["id"], "unknown_period", str(error))
        return

    start = str(msg["start_time"] or window["start"])
    end = str(msg["end_time"] or window["end"])
    bounds = _history_bounds_for(hass, project_id)
    decision_on_bounds = history_bounds.decide_query({
        "contract": "raw",
        "entities": len(list(msg["entity_ids"] or [])),
        "window_hours": _history_window_hours({"start_time": start, "end_time": end}),
    }, bounds)
    if decision_on_bounds["outcome"] == "refuse":
        connection.send_error(
            msg["id"],
            decision_on_bounds["reason"],
            f"{decision_on_bounds['reason']}: {decision_on_bounds['detail']}",
        )
        return

    request = recorder_query.build_request(
        end=end, entity_ids=msg["entity_ids"], period=period, start=start,
    )
    answer, query_error = await _ask_recorder(hass, request)
    shaped = recorder_query.shape_answer(
        request["contract"], answer, error=query_error, expected_instants=expected,
    )
    built = series_coverage.build_series(shaped)
    capped = history_bounds.cap_rows(built.get("points") or [], bounds)
    rows = capped["rows"]

    # Audited with the row count *before* the result is sent, so a site can say
    # afterwards what left the building and how much of it. An export that
    # failed to audit must not be an export that happened.
    await _audit_history(
        hass, connection, "glt_flow_card/history/export",
        contract=decision_on_bounds["source"] or "raw", msg=msg,
        project_id=project_id, rows=len(rows),
    )
    connection.send_result(msg["id"], {
        "coverage": built.get("coverage", 0),
        # The grid, so the browser fills a cell only from a sample inside that
        # interval and leaves an explicit blank otherwise. Without it the
        # renderer would have to guess where a row belongs, which is the
        # nearest-neighbour defect that wrote a sample from hours away into
        # this minute's row.
        "expected_instants": expected,
        "gaps": built.get("gaps") or [],
        # Everything needed to interpret or reproduce this later. An export that
        # does not state its aggregate, bounds, deadband, period and timezone
        # cannot be read a month from now, let alone re-run.
        "provenance": {
            "aggregate": request["contract"],
            "bounds": {"max_entities": bounds.get("max_entities"), "max_rows": bounds.get("max_rows"),
                       "max_window_hours": bounds.get("max_window_hours")},
            "deadband": ((_manager(hass).data["projects"].get(project_id) or {}).get("config") or {})
                        .get("historian", {}).get("deadband", 0),
            "end": end,
            "period": period,
            "start": start,
            "step": period_resolution.bucket_for(period),
            "timezone": timezone,
        },
        "rows": rows,
        "source": (
            decision_on_bounds["source"]
            if decision_on_bounds["outcome"] == "downgrade"
            else built.get("source", "unavailable")
        ),
        "truncated": capped["capped"],
    })


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
        connection.send_result(msg["id"], await _manager(hass).shelve_alarm(
            msg["project_id"], msg["alarm_id"], msg["minutes"], uid,
        ))
    except PermissionError:
        connection.send_error(msg["id"], "capability_denied", "capability_denied")
    except ValueError as error:
        # A refusal, with its reason. The browser offers only durations within
        # the site maximum, but that check is UX; this is the enforcement, and
        # it holds whatever the browser sent.
        code = str(error)
        if code not in alarm_engine.SHELVE_REFUSALS:
            raise
        connection.send_error(msg["id"], "invalid_input", code)


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/work_orders/list",
    # Optional with a default, so the generic policy prober reaches a decision
    # rather than a schema rejection, as `schedules/list` and `history/series`
    # already do.
    vol.Optional("project_id", default=""): str,
})
@websocket_api.async_response
async def ws_work_orders_list(hass, connection, msg):
    """Return the work orders of the project this names, if the caller may read it.

    Declared `enumeration="filter"`, so the guard deliberately does not deny --
    refusing would itself tell an unauthorized caller that rows exist -- and the
    filtering is the handler's job. This handler did none: it read
    `msg["project_id"]` and returned every matching row, so any authenticated
    Home Assistant user who named a project id received its work orders. It is
    the `alarms/list` leak of `9f53bcb`, in a route the fix did not reach.

    The project now comes from the decision rather than from the message, and
    the caller's own `work_order.read` decides.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project_id = decision.project_id
    if not runtime.policy.visible_projects(connection, [project_id], "work_order.read"):
        connection.send_result(msg["id"], [])
        return
    connection.send_result(msg["id"], [
        deepcopy(row) for row in _manager(hass).data["work_orders"].values()
        if row.get("project_id") == project_id
    ])


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


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/reports/list",
    vol.Optional("project_id", default=""): str,
})
@websocket_api.async_response
async def ws_reports_list(hass, connection, msg):
    """Return the report history of the project this names, if the caller may read it.

    The same leak as `work_orders/list` above, and for the same reason: a
    filtered route whose handler never filtered. A report row carries what the
    report found, so this returned the contents of a plant the caller cannot
    open.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    project_id = decision.project_id
    if not runtime.policy.visible_projects(connection, [project_id], "report.read"):
        connection.send_result(msg["id"], [])
        return
    connection.send_result(msg["id"], [
        deepcopy(row) for row in _manager(hass).data["report_history"]
        if row.get("project_id") == project_id
    ])


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/remote/list",
    # Optional with a default, so the generic policy prober reaches a decision
    # rather than a schema rejection. Phase 5 lost a round to exactly this and
    # Phase 7's history routes record the same note.
    vol.Optional("limit", default=100): vol.All(int, vol.Range(min=1, max=500)),
})
@websocket_api.async_response
async def ws_remote_list(hass, connection, msg):
    """List the sites this caller may see.

    T9-10. This returned **every** configured site to any caller: the token was
    stripped, which is right, but the url and name were not and nothing filtered
    by what the caller may reach.

    Filtered, then limited. Limiting first turns the limit into a count oracle
    for rows the caller may not see -- Phase 6 established this for
    `alarms/list` and Phase 7 for `history/series`, and this is the third route
    to need it.
    """
    decision = msg[DECISION_KEY]
    runtime = _runtime_for(hass)
    manager = _manager(hass)
    visible = []
    for site in manager.remote_sites.values():
        project_ids = list(site.get("project_ids") or [])
        if project_ids and not runtime.policy.visible_projects(
            connection, project_ids, "remote.read",
        ):
            continue
        visible.append({
            key: value for key, value in site.items()
            # The token never leaves, and neither does anything that would let a
            # caller reconstruct where the Companion connects.
            if key not in ("token", "url")
        })
    limit = int(msg.get("limit") or 100)
    connection.send_result(msg["id"], {
        "limit": limit,
        "sites": sorted(visible, key=lambda entry: str(entry.get("id")))[:limit],
        "truncated": len(visible) > limit,
    })


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/remote/states", vol.Required("site_id"): str, vol.Required("entity_ids"): [str]})
@websocket_api.async_response
async def ws_remote_states(hass, connection, msg):
    """Read state from one site, scoped and bounded.

    T9-08. This checked **nothing**: no role, no capability, no project scoping,
    so any caller who could reach the websocket read any entity of any
    configured site.

    T9-06. It also returned `str(err)`, and connection errors carry the host and
    port they failed to reach -- so failures enumerated internal topology.
    """
    manager = _manager(hass)
    requested = [str(msg["site_id"])]

    # Filtered, not denied -- the same shape as `history/series` and for the same
    # reason: a refusal would itself tell an unauthorized caller that the site
    # exists. A site the caller may not reach comes back **absent with a
    # reason**, which is exactly the vocabulary this phase built for a site that
    # did not answer. It is also why nothing connects on this path for a site
    # the caller has no business reaching.
    reachable, withheld = [], []
    for site_id in requested:
        site = manager.remote_sites.get(site_id)
        if site is not None and _may_reach_site(hass, connection, site):
            reachable.append(site_id)
        else:
            withheld.append({"reason": "not_permitted", "site_id": site_id,
                             "state": "unreachable"})

    result = await manager.read_remote_states(reachable, list(msg["entity_ids"] or []))
    result["absent_sites"] = sorted(
        [*result["absent_sites"], *withheld], key=lambda entry: entry["site_id"],
    )
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): "glt_flow_card/remote/control", vol.Required("project_id"): str, vol.Required("site_id"): str, vol.Required("domain"): str, vol.Required("service"): str, vol.Optional("service_data", default={}): dict})
@websocket_api.async_response
async def ws_remote_control(hass, connection, msg):
    try:
        _require_project_role(hass, connection, msg, "operator")
        # A remote control is the same plant write with a network hop in front
        # of it, so it is gated here rather than left for Phase 9 to remember.
        # Phase 9 inherits a gate instead of needing to add one.
        remote_gate = dispatch_gate.decide_dispatch(
            "remote_control",
            is_simulating=lambda: _runtime_for(hass).simulation.is_simulating(
                project_id=str(msg.get("project_id") or ""),
            ),
        )
        if not remote_gate.may_dispatch:
            connection.send_error(
                msg["id"], remote_gate.reason,
                f"{remote_gate.reason}: the remote service was not called",
            )
            return
        site = _manager(hass).remote_sites.get(str(msg["site_id"]))
        if site is None or not _may_reach_site(hass, connection, site):
            connection.send_error(msg["id"], "not_found_or_denied", "not_found_or_denied")
            return
        result = await _manager(hass).remote_control(
            msg["site_id"], msg["domain"], msg["service"], msg["service_data"],
        )
        await _manager(hass).add_audit({
            "action": "remote.control",
            "detail": {
                "domain": msg["domain"], "outcome": result["outcome"],
                "project_id": msg.get("project_id"), "service": msg["service"],
                "site_id": msg["site_id"],
            },
        }, *_user(connection)[:2])
        connection.send_result(msg["id"], result)
    except PermissionError as denied:
        # An unsafe service domain is *invalid input*, not a permission denial:
        # the caller holds `remote.control`, and the request is the thing that
        # is not acceptable. Distinguishing them matters because a capability
        # denial tells an operator to ask an administrator, and this tells them
        # to fix the request.
        connection.send_error(msg["id"], "invalid_input", str(denied))
    except site_destinations.DestinationRefused as refused:
        # `invalid_input` rather than the raw reason: from the caller's side the
        # request could not be made because the site's configuration is not
        # usable, and the specific reason names a host. The detail stays in the
        # log where an operator can act on it.
        connection.send_error(msg["id"], "invalid_input", refused.reason)


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


def _send_install_refusal(connection, msg, refused: InstallRefused) -> None:
    """Report a refused installation inside the declared error vocabulary.

    The registry's own reason codes are not added to ERROR_CODES. That set is
    the contract's closed vocabulary, and every code in it is one a client is
    expected to branch on; a code per installation mishap would widen the
    contract for detail that belongs in the message. So the wire code is
    `invalid_input` and the reason and its detail travel in the body, where the
    extension manager reads them to name both packs and the contested id.
    """
    connection.send_error(msg["id"], "invalid_input", json.dumps({
        "reason": refused.code, "detail": refused.detail,
    }, sort_keys=True))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/extensions/list",
})
@websocket_api.async_response
async def ws_extensions_list(hass, connection, msg):
    """Every installed pack in the projects this principal may open.

    Filtered rather than denied, for the same reason the portfolio roll-up is:
    an unassigned principal receives an empty list, which is exactly what an
    installation holding no packs would return, so a listing cannot be used to
    learn that a project exists.
    """
    runtime = _runtime_for(hass)
    visible = set(runtime.policy.visible_projects(
        connection, [head["id"] for head in _manager(hass).projects()],
    ))
    connection.send_result(msg["id"], visible_packs(runtime.extensions, visible))


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/extensions/install",
    vol.Optional("project_id", default=""): str,
    vol.Optional("manifest", default=dict): dict,
})
@websocket_api.async_response
async def ws_extensions_install(hass, connection, msg):
    """Install one pack against one project, all or nothing.

    The project is re-checked here even though the route carries a write
    capability: the capability says this principal may install *somewhere*, and
    only this check says where. A component-scoped route that took a project id
    on trust would be a write into any project whose id the caller could guess.
    """
    runtime = _runtime_for(hass)
    # The route is project-scoped, so policy has already resolved the project
    # and answered missing and unauthorized identically. Reading the id back
    # off the decision rather than off the message is what makes that true:
    # a handler that re-read msg["project_id"] could act on an id policy never
    # approved.
    project_id = msg[DECISION_KEY].project_id
    registry = runtime.extensions.setdefault(project_id, SdkRegistry(project_id))
    try:
        result = registry.install(msg["manifest"])
    except InstallRefused as refused:
        _send_install_refusal(connection, msg, refused)
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "glt_flow_card/extensions/remove",
    vol.Optional("project_id", default=""): str,
    vol.Optional("namespace", default=""): str,
})
@websocket_api.async_response
async def ws_extensions_remove(hass, connection, msg):
    """Remove one pack from one project."""
    runtime = _runtime_for(hass)
    project_id = msg[DECISION_KEY].project_id
    registry = runtime.extensions.get(project_id)
    try:
        if registry is None:
            raise InstallRefused("pack_not_installed", {"namespace": msg["namespace"]})
        # Only this project's document is offered. The registry never goes
        # looking for projects, which is what keeps a refusal from naming one
        # the caller cannot see.
        head = _manager(hass).project(project_id)
        result = registry.remove(
            msg["namespace"], {project_id: head} if head is not None else {},
        )
    except InstallRefused as refused:
        _send_install_refusal(connection, msg, refused)
        return
    connection.send_result(msg["id"], result)


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
    ws_alarms_shelve,
    ws_schedules_list, ws_schedules_save, ws_schedules_delete, ws_schedules_preview,
    ws_history_series, ws_history_statistics, ws_history_coverage, ws_history_export,
    ws_work_orders_list, ws_work_orders_save, ws_reports_run,
    ws_reports_list, ws_remote_list, ws_remote_states, ws_remote_control,
    ws_audit_add, ws_audit_list,
    ws_extensions_list, ws_extensions_install, ws_extensions_remove,
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

        # A project-scoped filtered route answers here, not in its handler.
        #
        # Such a route is *admitted* on purpose even when the caller holds
        # nothing: refusing would itself tell them that rows exist, which is the
        # enumeration T2-04 forbids. The consequence had always been that
        # filtering was the handler's job -- and four handlers forgot, three of
        # them found in the close-out review, one of those handing over the
        # trusted audit trail.
        #
        # The boundary sends the route's declared empty answer instead, so an
        # unauthorized caller never reaches the handler. The handler cannot
        # forget a filter it is never asked to perform, and a filtered route
        # added later cannot be declared at all without saying what its empty
        # answer looks like -- `RoutePolicy.__post_init__` refuses it at import.
        policy = decision.policy
        if (
            policy.enumeration == "filter"
            and policy.scope == "project"
            and policy.capability is not None
            and policy.capability not in decision.capabilities
        ):
            connection.send_result(msg["id"], policy.empty_answer())
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


async def _serve_bundled_frontend_once(hass: HomeAssistant) -> None:
    """Serve the bundled card so an integration install stays self-sufficient.

    HACS installs a repository in exactly one category. An integration-category
    install delivers this package including ``www/glt-flow-card.js``, but no
    Lovelace resource and no URL to load the card from, so the dashboard side
    fails closed with nothing to render. Registering the bundled ``www``
    directory gives that install the stable URL ``/{DOMAIN}/www/glt-flow-card.js``
    (with ``{DOMAIN}`` literally ``glt_flow_card``) next to the Dashboard and
    manual-copy installation paths.
    """
    data = _component_data(hass)
    if data["frontend_served"]:
        return
    data["frontend_served"] = True
    www_dir = Path(__file__).parent / "www"
    if not www_dir.is_dir():
        return
    # Imported here, not at module scope: the parity gates import this package
    # against minimal Home Assistant test lanes that do not ship the
    # static-path HTTP API, and the serving path never runs there.
    from homeassistant.components.http import StaticPathConfig, async_register_static_paths

    await async_register_static_paths(
        hass,
        [StaticPathConfig(f"/{DOMAIN}/www", str(www_dir), False)],
    )


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
    await _serve_bundled_frontend_once(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = _component_data(hass)
    _register_commands_once(hass)
    await _serve_bundled_frontend_once(hass)
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

        async def on_started(_event) -> None:
            await manager.async_mark_started()

        # D3, closed. This was `hass.bus.async_listen("state_changed", ...)`
        # with no entity filter, so every state change in the whole instance
        # reached a loop over every project and every alarm. The subscription
        # now follows the index and Home Assistant does the filtering.
        manager.async_refresh_alarm_subscription()
        manager._unsubs.append(
            async_track_time_change(hass, manager.run_schedules, second=0)
        )
        # A reload of the entry inside an already-running Home Assistant never
        # sees `homeassistant_started` again, so the grace would never lift and
        # no alarm would ever annunciate. Asking whether HA is already running
        # is the difference between a guard and a permanent mute.
        if hass.is_running:
            await manager.async_mark_started()
        else:
            manager._unsubs.append(
                hass.bus.async_listen_once("homeassistant_started", on_started)
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
            # Authorized at the source as well as at the handler. A cursor is
            # bound to a scope and redeemed later, possibly after the role that
            # issued it was revoked; deciding here means a page can never carry
            # a row the holder may not read *now*, whatever the handler did when
            # the cursor was minted.
            rows_for=lambda scope: (
                evidence.rows({scope.project_id})
                if "evidence.read" in capabilities_for(
                    access.get(scope.project_id).role_of(scope.user_id),
                    is_ha_admin=False,
                )
                else []
            ),
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
    # The schedule runner lives on the store, which holds no runtime reference,
    # so the reader is injected here. Without it the store raises and
    # `decide_dispatch` treats that as "cannot tell" and refuses -- fail closed,
    # rather than a store that answers False and silently disables the gate.
    manager.attach_simulation_reader(
        lambda project_id: runtime.simulation.is_simulating(project_id=project_id),
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
