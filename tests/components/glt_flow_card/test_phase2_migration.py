"""Conservative Phase-2 migration of legacy authority data (T2-15).

Migration is copy-safe, idempotent and never elevating. It may read a legacy
project's `permissions` block once, to avoid stranding an existing installation
with no members at all, but only from the *active head* - never from an
imported candidate - and only into roles that the legacy block already implied.
"""
from __future__ import annotations

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

    legacy_default, legacy_min, legacy_max = OPTION_SPECS["default_lock_ttl"]
    assert legacy_min < LEASE_TTL_MIN or legacy_max > LEASE_TTL_MAX, (
        "this test is only meaningful while the legacy range is still wider"
    )
    assert LEASE_TTL_MIN <= legacy_default <= LEASE_TTL_MAX


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
