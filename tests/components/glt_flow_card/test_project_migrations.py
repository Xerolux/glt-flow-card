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
        "schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
        "contributions": [],
        "semantic_model": {"nodes": []},
    }


def test_migration_is_sequential_copy_on_write_and_receipted() -> None:
    source = _legacy_project()
    original = deepcopy(source)

    result = migrate_project_document(source, dry_run=True)

    assert CURRENT_PROJECT_SCHEMA_VERSION == 5
    assert source == original
    assert result["candidate"] is not source
    assert [(step["from"], step["to"]) for step in result["receipt"]["steps"]] == [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]
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
    # One past the current version, derived, so this keeps testing the future
    # boundary instead of testing a version that has since shipped.
    future = CURRENT_PROJECT_SCHEMA_VERSION + 1
    with pytest.raises(ValueError, match=f"unsupported project schema version {future}"):
        migrate_project_document({**_current_project(), "schema_version": future})
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

    # Collections the *last* migration step introduces, which a document at the
    # previous version would not carry. Per-boundary by nature: the 3-to-4 step
    # added `contributions`, and the 4-to-5 step adds none -- it closes the
    # alarm and schedule shapes rather than introducing a collection. Whoever
    # adds the next step updates this list, and this comment says why.
    introduced_by_the_last_step: tuple[str, ...] = ()

    older = {**template, "schema_version": CURRENT_PROJECT_SCHEMA_VERSION - 1}
    for collection in introduced_by_the_last_step:
        older.pop(collection, None)
    migrated = migrate_project_document(older, dry_run=True)["candidate"]
    assert migrated == template


def test_the_migrations_field_lists_and_schema_5_declare_the_same_fields() -> None:
    """Two lists that must agree, asserted rather than reviewed.

    They disagreed once during development -- ``state`` was declared in the
    schema and missing from the migration's list -- and the symptom was not a
    validation error but a Phase-4 roll-up counting nothing, because the
    migration quarantined a field the schema was happy to keep. A mismatch of
    this shape is silent by nature.
    """
    import json
    from pathlib import Path

    from custom_components.glt_flow_card.project_migrations import SCHEMA_MIRRORED_FIELDS

    root = Path(__file__).resolve().parents[3]
    schema = json.loads(
        (root / "schemas" / "project" / "5.schema.json").read_text(encoding="utf-8")
    )
    for shape, fields in SCHEMA_MIRRORED_FIELDS.items():
        declared = sorted(schema["$defs"][shape]["properties"])
        assert sorted(fields) == declared, shape
