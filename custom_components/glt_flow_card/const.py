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

#: Resolved A1. The legacy 30-3600s lock window does not survive the upgrade:
#: a 30-second lease expires faster than a person can read a confirmation, and
#: an hour-long one strands a project when a browser tab closes. This is the one
#: source of truth for the window; `project_leases` imports it rather than
#: restating it, because two copies of a bound are one edit away from drifting.
LEASE_TTL_MIN_SECONDS = 60
LEASE_TTL_MAX_SECONDS = 900

OPTION_SPECS = {
    "default_lock_ttl": (DEFAULT_LOCK_TTL, LEASE_TTL_MIN_SECONDS, LEASE_TTL_MAX_SECONDS),
    "max_versions": (MAX_VERSIONS, 5, 500),
    "max_audit": (MAX_AUDIT, 100, 50000),
}

#: Legacy audit rows have no server provenance. They are kept - throwing away a
#: site's history would be its own kind of dishonesty - under a label that can
#: never be read as a claim about who did what.
LEGACY_AUDIT_LABEL = "legacy_untrusted"
SAFE_SERVICE_DOMAINS = {
    "switch", "fan", "number", "select", "climate", "cover", "light",
    "input_boolean", "input_number", "input_select", "water_heater", "button", "script"
}


def migrate_options(raw):
    """Bring stored options into the current window without losing intent.

    A value outside the new range is clamped to the nearest bound rather than
    reset to the default: an installation that deliberately chose 3600 seconds
    meant "as long as possible", and 900 is that, while 300 would be a silent
    third choice nobody made. Clamping is idempotent, so an upgrade that runs
    twice produces the same options as one that runs once.
    """
    source = dict(raw) if isinstance(raw, dict) else {}
    for name, (_default, minimum, maximum) in OPTION_SPECS.items():
        value = source.get(name)
        if type(value) is int:
            source[name] = min(max(value, minimum), maximum)
    return normalize_options(source)


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
