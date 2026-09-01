"""Privacy-preserving diagnostics for the GLT Flow Card Companion."""
from __future__ import annotations

from collections import Counter
from hashlib import sha256
from pathlib import Path
import re
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from . import _runtime_for
from .const import (
    DOMAIN,
    PROJECT_AUDIT_STORE_VERSION,
    PROJECT_HEADS_STORE_VERSION,
    PROJECT_JOURNAL_STORE_VERSION,
    PROJECT_LEGACY_BACKUP_STORE_VERSION,
    PROJECT_SNAPSHOTS_STORE_VERSION,
    STORE_VERSION,
    normalize_options,
)
from .project_migrations import CURRENT_PROJECT_SCHEMA_VERSION

INTEGRATION_VERSION = "1.0.0"
_DIGEST_PREFIX = re.compile(r"^[0-9a-fA-F]{12}")
_JOURNAL_STATES = {"PREPARED", "COMMITTED", "ABORTED"}
_RECOVERY_RESULTS = {"verified_old_head", "verified_new_head"}


def _card_digest_prefix() -> str:
    """Return a short identity for the installed, reviewed card artifact."""
    card_path = Path(__file__).with_name("www") / "glt-flow-card.js"
    try:
        return sha256(card_path.read_bytes()).hexdigest()[:12]
    except OSError:
        return "missing"


def _digest_prefixes(values: list[dict[str, Any]]) -> list[str]:
    """Expose only valid digest prefixes, never record identity or content."""
    prefixes = {
        match.group(0).lower()
        for value in values
        if (match := _DIGEST_PREFIX.match(str(value.get("digest") or "")))
    }
    return sorted(prefixes)


def _safe_import_status(repository) -> dict[str, Any]:
    """Allowlist non-sensitive legacy import recovery evidence."""
    raw = repository.import_status().get("legacy_import", {})
    return {
        "status": str(raw.get("status") or "unknown"),
        "source": str(raw.get("source") or "unknown"),
        "project_count": int(raw.get("project_count") or 0),
    }


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> dict[str, Any]:
    """Return an explicit support allowlist without project or plant payloads."""
    runtime = _runtime_for(hass, entry.entry_id)
    manager = runtime.manager if runtime is not None else None
    options = (
        dict(manager.effective_options)
        if manager is not None
        else normalize_options(dict(entry.options))
    )

    heads: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []
    journals: list[dict[str, Any]] = []
    project_audit: list[dict[str, Any]] = []
    import_status = {
        "status": "not_loaded",
        "source": "unknown",
        "project_count": 0,
    }
    if manager is not None:
        repository = manager.project_repository
        heads = repository.list_heads()
        snapshots = repository.list_snapshots()
        journals = repository.list_journals()
        project_audit = repository.list_audit()
        import_status = _safe_import_status(repository)

    journal_states = Counter(
        state if state in _JOURNAL_STATES else "other"
        for journal in journals
        for state in [str(journal.get("state") or "other")]
    )
    recovery_results = Counter(
        result
        for journal in journals
        for result in [str(journal.get("recovery_result") or "")]
        if result in _RECOVERY_RESULTS
    )

    return {
        "integration": {
            "domain": DOMAIN,
            "version": INTEGRATION_VERSION,
            "project_schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
            "loaded": runtime is not None,
        },
        "build": {
            "card_sha256_prefix": _card_digest_prefix(),
            "identity": f"{DOMAIN}@{INTEGRATION_VERSION}",
        },
        "options": options,
        "stores": {
            "legacy": STORE_VERSION,
            "project_heads": PROJECT_HEADS_STORE_VERSION,
            "project_snapshots": PROJECT_SNAPSHOTS_STORE_VERSION,
            "project_journals": PROJECT_JOURNAL_STORE_VERSION,
            "project_audit": PROJECT_AUDIT_STORE_VERSION,
            "legacy_backup": PROJECT_LEGACY_BACKUP_STORE_VERSION,
        },
        "counts": {
            "projects": len(heads),
            "snapshots": len(snapshots),
            "journals": len(journals),
            "project_audit_events": len(project_audit),
            "legacy_audit_events": len(manager.data["audit"]) if manager else 0,
            "locks": len(manager.data["locks"]) if manager else 0,
            "alarm_tasks": len(manager._alarm_tasks) if manager else 0,
            "listeners": len(manager._unsubs) if manager else 0,
            "remote_sites": len(manager.remote_sites) if manager else 0,
        },
        "digests": {
            "project_head_prefixes": _digest_prefixes(heads),
            "snapshot_prefixes": _digest_prefixes(snapshots),
        },
        "recovery": {
            "legacy_import": import_status,
            "journals_by_state": dict(sorted(journal_states.items())),
            "results": dict(sorted(recovery_results.items())),
        },
    }
