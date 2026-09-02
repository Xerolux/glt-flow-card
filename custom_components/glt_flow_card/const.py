DOMAIN = "glt_flow_card"
STORE_VERSION = 1
STORE_KEY = "glt_flow_card.projects"
PROJECT_HEADS_STORE_VERSION = 1
PROJECT_HEADS_STORE_KEY = "glt_flow_card.project_heads"
PROJECT_SNAPSHOTS_STORE_VERSION = 1
PROJECT_SNAPSHOTS_STORE_KEY = "glt_flow_card.project_snapshots"
PROJECT_JOURNAL_STORE_VERSION = 1
PROJECT_JOURNAL_STORE_KEY = "glt_flow_card.project_journals"
PROJECT_AUDIT_STORE_VERSION = 1
PROJECT_AUDIT_STORE_KEY = "glt_flow_card.project_audit"
PROJECT_LEGACY_BACKUP_STORE_VERSION = 1
PROJECT_LEGACY_BACKUP_STORE_KEY = "glt_flow_card.project_legacy_backup"
PROJECT_ACCESS_STORE_VERSION = 1
PROJECT_ACCESS_STORE_KEY = "glt_flow_card.project_access"
TRUSTED_EVIDENCE_STORE_VERSION = 1
TRUSTED_EVIDENCE_STORE_KEY = "glt_flow_card.trusted_evidence"
# A separate key, version and schema: trusted evidence and browser telemetry
# must never share a store, because a shared store is one bug away from a
# shared trust level.
TELEMETRY_STORE_VERSION = 1
TELEMETRY_STORE_KEY = "glt_flow_card.telemetry"
MAX_AUDIT = 5000
MAX_VERSIONS = 60
DEFAULT_LOCK_TTL = 300
OPTION_SPECS = {
    "default_lock_ttl": (DEFAULT_LOCK_TTL, 30, 3600),
    "max_versions": (MAX_VERSIONS, 5, 500),
    "max_audit": (MAX_AUDIT, 100, 50000),
}
SAFE_SERVICE_DOMAINS = {
    "switch", "fan", "number", "select", "climate", "cover", "light",
    "input_boolean", "input_number", "input_select", "water_heater", "button", "script"
}


def normalize_options(raw, *, strict=False):
    """Return supported effective options and remove legacy no-effect keys."""
    source = raw if isinstance(raw, dict) else {}
    result = {}
    for name, (default, minimum, maximum) in OPTION_SPECS.items():
        value = source.get(name, default)
        valid = type(value) is int and minimum <= value <= maximum
        if not valid:
            if strict:
                raise ValueError(
                    f"{name} must be an integer from {minimum} to {maximum}"
                )
            value = default
        result[name] = value
    return result
