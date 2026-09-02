"""Conservative Phase-2 migration of legacy authority data (T2-15).

Migration is copy-safe, idempotent and never elevating. It may read a legacy
project's `permissions` block once, to avoid stranding an existing installation
with no members at all, but only from the *active head* - never from an
imported candidate - and only into roles that the legacy block already implied.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

#: The Phase-2 lease TTL window. Legacy option values outside it are tightened
#: on upgrade, idempotently.
LEASE_TTL_MIN = 60
LEASE_TTL_MAX = 900

#: How a legacy permissions block maps onto fixed Phase-2 roles. The mapping is
#: deliberately lossy downward: a legacy "designer" becomes an engineer, not an
#: admin, because the legacy block never expressed membership administration.
LEGACY_ROLE_MAP = {
    "designers": "engineer",
    "operators": "operator",
    "viewers": "viewer",
}

#: A legacy audit list has no server provenance, so it is retained under a
#: label that can never be confused with Phase-2 trusted evidence.
LEGACY_AUDIT_LABEL = "legacy_untrusted"

LEGACY_HEAD: dict[str, Any] = {
    "id": "legacy-plant",
    "revision": 3,
    "config": {
        "type": "custom:glt-flow-card",
        "schema_version": 2,
        "project": {"id": "legacy-plant", "name": "Legacy Plant", "revision": 3},
        "permissions": {
            "designers": ["user-designer"],
            "operators": ["user-operator"],
        },
        "views": [],
        "equipment": [],
        "paths": [],
        "datapoints": [],
    },
}

MALFORMED_HEAD: dict[str, Any] = {
    "id": "malformed-plant",
    "revision": 1,
    "config": {"permissions": {"designers": "not-a-list", "operators": [None, 42]}},
}


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def test_legacy_role_mapping_never_grants_administration() -> None:
    """No legacy permission implies membership administration."""
    assert "admin" not in LEGACY_ROLE_MAP.values()
    assert LEGACY_ROLE_MAP["designers"] == "engineer"


def test_lease_ttl_window_tightens_the_legacy_lock_range() -> None:
    """The legacy 30-3600s lock range does not survive the upgrade."""
    from custom_components.glt_flow_card.const import OPTION_SPECS

    default, minimum, maximum = OPTION_SPECS["default_lock_ttl"]
    assert (minimum, maximum) == (LEASE_TTL_MIN, LEASE_TTL_MAX)
    assert default == 300


@pytest.mark.parametrize(
    ("stored", "expected"),
    [
        (30, LEASE_TTL_MIN),      # below the window: clamped up, not reset
        (3600, LEASE_TTL_MAX),    # above it: clamped down, intent preserved
        (120, 120),               # already inside it: untouched
        ("not-an-int", 300),      # malformed: the default, the only safe answer
    ],
)
def test_option_migration_clamps_instead_of_resetting(stored: Any, expected: int) -> None:
    """A deliberate legacy choice becomes the nearest legal one, idempotently."""
    from custom_components.glt_flow_card.const import migrate_options

    once = migrate_options({"default_lock_ttl": stored})
    assert once["default_lock_ttl"] == expected
    assert migrate_options(once) == once


def test_lease_registry_and_options_share_one_window() -> None:
    """Two copies of a bound are one edit away from drifting apart."""
    from custom_components.glt_flow_card import const, project_leases

    assert project_leases.MIN_TTL_SECONDS is const.LEASE_TTL_MIN_SECONDS
    assert project_leases.MAX_TTL_SECONDS is const.LEASE_TTL_MAX_SECONDS


def test_legacy_audit_label_cannot_be_mistaken_for_trusted_history() -> None:
    """Retained legacy rows carry a label with no server provenance claim."""
    assert LEGACY_AUDIT_LABEL == "legacy_untrusted"
    assert "trusted" not in LEGACY_AUDIT_LABEL.replace("untrusted", "")


def test_malformed_legacy_permissions_are_representable() -> None:
    """The malformed fixture really is malformed in more than one way."""
    permissions = MALFORMED_HEAD["config"]["permissions"]
    assert not isinstance(permissions["designers"], list)
    assert any(not isinstance(value, str) for value in permissions["operators"])


async def migration_gaps(hass: HomeAssistant) -> list[str]:
    """Return every unmet migration guarantee."""
    access = load("project_access")
    if access is None:
        return [
            "custom_components.glt_flow_card.project_access does not exist, so "
            "legacy authority cannot be migrated conservatively"
        ]

    gaps: list[str] = []
    repository = access.access_repository(hass)
    if repository is None:
        return ["the loaded runtime exposes no ACL repository"]
    if not hasattr(repository, "async_bootstrap_from_legacy"):
        return ["project_access.async_bootstrap_from_legacy is missing"]

    first = await repository.async_bootstrap_from_legacy(
        LEGACY_HEAD["id"], LEGACY_HEAD["config"]
    )
    state = await repository.async_get(LEGACY_HEAD["id"])
    if state.role_of("user-designer") != "engineer":
        gaps.append("a legacy designer did not become an engineer")
    if state.role_of("user-operator") != "operator":
        gaps.append("a legacy operator did not become an operator")
    if any(role == "admin" for _, role in state.assignments):
        gaps.append("migration granted membership administration")

    revision_after_first = state.access_revision
    second = await repository.async_bootstrap_from_legacy(
        LEGACY_HEAD["id"], LEGACY_HEAD["config"]
    )
    state = await repository.async_get(LEGACY_HEAD["id"])
    if state.access_revision != revision_after_first:
        gaps.append("repeating the migration changed the access revision")
    if first != second:
        gaps.append("the migration receipt is not idempotent")

    await repository.async_bootstrap_from_legacy(
        MALFORMED_HEAD["id"], MALFORMED_HEAD["config"]
    )
    malformed = await repository.async_get(MALFORMED_HEAD["id"])
    if malformed.assignments:
        gaps.append("a malformed legacy permissions block produced assignments")

    if hasattr(repository, "async_bootstrap_from_candidate"):
        gaps.append("an imported candidate can bootstrap the ACL")
    return gaps


async def test_legacy_locks_are_retired_without_becoming_leases(
    hass: HomeAssistant,
    config_entry: Any,
    lifecycle_effects: Any,
) -> None:
    """A persisted lock is dropped, never minted into an exclusive lease.

    Turning a row in a file into a lease would hand an absent browser the one
    exclusive editor on upgrade, with nobody present to release it.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    manager = hass.data["glt_flow_card"]["manager"]
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]

    manager.data["locks"] = {"legacy-plant": {"user_id": "user-designer", "expires": "2099-01-01T00:00:00+00:00"}}
    manager.data["audit"] = [{"id": "legacy-1", "action": "project.save", "user_id": "user-designer"}]
    manager._migrate_legacy_authority()

    assert manager.data["locks"] == {}
    assert runtime.leases.diagnostics()["active_leases"] == 0
    row = manager.data["audit"][0]
    assert row["provenance"] == LEGACY_AUDIT_LABEL
    assert row["trusted"] is False

    # Idempotent: a second load finds nothing left to change.
    before = json.dumps(manager.data["audit"], sort_keys=True)
    manager._migrate_legacy_authority()
    assert json.dumps(manager.data["audit"], sort_keys=True) == before
    assert manager.data["locks"] == {}


async def test_a_legacy_client_cannot_reach_a_privileged_route(
    hass: HomeAssistant,
    config_entry: Any,
    phase2_users,
) -> None:
    """An old card's routes answer `feature_unavailable`, never a fallback.

    A card built before Phase 2 knows nothing about leases or revisions. It must
    not be given a privileged path that skips them; it gets the read-only shell.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    await hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id].access.async_assign(
        project_id="legacy-plant", user_id=phase2_users.principal("engineer").user_id, role="engineer"
    )
    connection = await phase2_users.async_connect("engineer")
    for message in (
        {"type": "glt_flow_card/projects/lock", "project_id": "legacy-plant"},
        {"type": "glt_flow_card/projects/unlock", "project_id": "legacy-plant"},
        {
            "type": "glt_flow_card/control/execute",
            "project_id": "legacy-plant",
            "entity_id": "switch.pump_1",
            "domain": "switch",
            "service": "turn_on",
        },
    ):
        response = await connection.command(message)
        assert response["success"] is False
        assert response["error"]["code"] == "feature_unavailable", message["type"]
    await phase2_users.async_close()
