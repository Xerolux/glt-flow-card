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
MAX_AUDIT = 5000
MAX_VERSIONS = 60
DEFAULT_LOCK_TTL = 300
SAFE_SERVICE_DOMAINS = {
    "switch", "fan", "number", "select", "climate", "cover", "light",
    "input_boolean", "input_number", "input_select", "water_heater", "button", "script"
}
