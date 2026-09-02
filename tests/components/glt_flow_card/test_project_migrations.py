"""Pure sequential project migration contract tests."""
from __future__ import annotations

from copy import deepcopy
import json

import pytest

from custom_components.glt_flow_card.project_migrations import (
    CURRENT_PROJECT_SCHEMA_VERSION,
    migrate_project_document,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def _legacy_project() -> dict:
    return {
        "type": "custom:glt-flow-card",
        "title": "Werk Süd",
        "equipment": [{"id": "pump-1", "type": "pump", "vendor_data": {"channel": 7}}],
        "extensions": {"vendor_alpha": {"retained": True}},
        "unknown_top_level": {"retained": "yes"},
    }


def _version_two_project() -> dict:
    return {
        **_legacy_project(),
        "schema_version": 2,
        "project": {"id": "werk-sud", "name": "Werk Süd", "revision": 0},
    }


def _current_project() -> dict:
    return {
        **_version_two_project(),
        "schema_version": 4,
        "contributions": [],
        "semantic_model": {"nodes": []},
    }


def test_migration_is_sequential_copy_on_write_and_receipted() -> None:
    source = _legacy_project()
    original = deepcopy(source)

    result = migrate_project_document(source, dry_run=True)

    assert CURRENT_PROJECT_SCHEMA_VERSION == 4
    assert source == original
    assert result["candidate"] is not source
    assert [(step["from"], step["to"]) for step in result["receipt"]["steps"]] == [(0, 1), (1, 2), (2, 3), (3, 4)]
    assert result["receipt"]["warnings"] == []
    assert result["receipt"]["loss"] == {"dropped": [], "preserved": []}
    assert result["candidate"]["project"] == {"id": "werk-sud", "name": "Werk Süd", "revision": 0}
    assert result["candidate"]["extensions"] == original["extensions"]
    assert result["candidate"]["unknown_top_level"] == original["unknown_top_level"]


def test_dry_run_apply_and_current_idempotence_are_identical() -> None:
    version_one = {**_legacy_project(), "schema_version": 1}
    assert migrate_project_document(version_one, dry_run=True) == migrate_project_document(
        version_one, dry_run=False
    )

    current = _current_project()
    result = migrate_project_document(current)
    assert result["candidate"] == current
    assert result["receipt"]["steps"] == []
    assert result["receipt"]["source_digest"] == result["receipt"]["candidate_digest"]


def test_future_and_invalid_sources_fail_closed() -> None:
    with pytest.raises(ValueError, match="unsupported project schema version 5"):
        migrate_project_document({**_current_project(), "schema_version": 5})
    with pytest.raises(ValueError, match="source project contract is invalid"):
        migrate_project_document({"schema_version": 1, "title": "missing card type"})


def test_result_is_json_serializable_without_loss_markers() -> None:
    encoded = json.dumps(migrate_project_document(_legacy_project()), ensure_ascii=False)
    assert "vendor_alpha" in encoded
    assert '"dropped": []' in encoded


def test_synthesized_empty_project_matches_a_migrated_one() -> None:
    """The empty-project template must be what the migration would produce.

    Deriving only `schema_version` was not enough: schema 4 added a
    `contributions` collection, the hand-written template did not gain it, and a
    synthesized rollback snapshot stopped being byte-identical to a migrated
    one. Taking the template, declaring it one version older, and migrating it
    back must return the same document -- which fails loudly the next time a
    migration step adds a collection the template does not.
    """
    from custom_components.glt_flow_card.project_transactions import (
        ProjectTransactionCoordinator,
    )

    template = ProjectTransactionCoordinator._empty_project("plant-a", "Plant A")
    assert template["schema_version"] == CURRENT_PROJECT_SCHEMA_VERSION

    older = {**template, "schema_version": CURRENT_PROJECT_SCHEMA_VERSION - 1}
    older.pop("contributions", None)
    migrated = migrate_project_document(older, dry_run=True)["candidate"]
    assert migrated == template
