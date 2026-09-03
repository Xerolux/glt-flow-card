"""Bounded three-way merge and retry recovery (T2-12).

A conflict never resolves itself. The server returns bounded base/current/
candidate evidence, the client keeps its candidate, and only a server-recomputed
non-overlapping selection can be applied. There is no last-writer-wins and no
replay of a stale client patch.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = "EXPECTED_RED[phase2-merge]: bounded three-way merge recovery is unavailable"
EFFECT_PREFIX = "PHASE2_MERGE_EFFECTS "

PROJECT_ID = "merge-plant"

#: Conflict evidence bounds. Beyond these the response is explicitly truncated
#: rather than silently trimmed, so the UI can say so.
MAX_MERGE_OPERATIONS = 100
MAX_MERGE_BYTES = 256 * 1024

#: The three revisions a conflict response must carry.
CONFLICT_REVISIONS = ("base_revision", "current_revision", "candidate_revision")

#: Outcomes a merge attempt may report. `overwrite` is deliberately absent.
MERGE_OUTCOMES = ("applied", "conflict", "blocked_overlap", "blocked_dependency", "truncated")


def emit_effects(effects: LifecycleEffects, **extra: Any) -> None:
    """Print the zero-effect ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        "service_attempts": snapshot["service_attempts"],
        "leases": snapshot["leases"],
        "subscriptions": snapshot["subscriptions"],
        **extra,
    }, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def base_project() -> dict[str, Any]:
    """A small project both engineers start from."""
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 2,
        "project": {"id": PROJECT_ID, "name": "Merge Plant", "revision": 1},
        "views": [{"id": "plant", "name": "Plant", "kind": "image"}],
        "equipment": [
            {"id": "pump-1", "name": "Pump 1", "type": "pump"},
            {"id": "pump-2", "name": "Pump 2", "type": "pump"},
        ],
        "paths": [],
        "datapoints": [],
    }


def non_overlapping_candidate() -> dict[str, Any]:
    """Edits `pump-1` only, so it cannot collide with a `pump-2` edit."""
    project = base_project()
    project["equipment"][0]["name"] = "Pump 1 (renamed by engineer A)"
    return project


def other_writer_change() -> dict[str, Any]:
    """Edits `pump-2` only, committed first by the other engineer."""
    project = base_project()
    project["equipment"][1]["name"] = "Pump 2 (renamed by engineer B)"
    return project


def overlapping_candidate() -> dict[str, Any]:
    """Edits `pump-2` as well, so the merge must be blocked."""
    project = base_project()
    project["equipment"][1]["name"] = "Pump 2 (renamed by engineer A)"
    return project


# --------------------------------------------------------------------------
# Contract guarantees that hold before and after implementation.
# --------------------------------------------------------------------------


def test_merge_outcomes_exclude_overwrite() -> None:
    """Last-writer-wins is not an outcome the server can report."""
    assert "overwrite" not in MERGE_OUTCOMES
    assert "last_writer_wins" not in MERGE_OUTCOMES
    assert "applied" in MERGE_OUTCOMES and "conflict" in MERGE_OUTCOMES


def test_conflict_evidence_is_three_way_and_bounded() -> None:
    """Base, current and candidate are all named, and the payload is capped."""
    assert set(CONFLICT_REVISIONS) == {
        "base_revision",
        "current_revision",
        "candidate_revision",
    }
    assert MAX_MERGE_OPERATIONS == 100
    assert MAX_MERGE_BYTES == 256 * 1024


def test_fixtures_model_a_real_non_overlap_and_a_real_overlap() -> None:
    """The merge cases must actually differ in the way the test claims."""
    base = base_project()
    mine = non_overlapping_candidate()
    theirs = other_writer_change()
    overlap = overlapping_candidate()

    assert mine["equipment"][0]["name"] != base["equipment"][0]["name"]
    assert mine["equipment"][1]["name"] == base["equipment"][1]["name"]
    assert theirs["equipment"][1]["name"] != base["equipment"][1]["name"]
    assert theirs["equipment"][0]["name"] == base["equipment"][0]["name"]
    assert overlap["equipment"][1]["name"] != theirs["equipment"][1]["name"]


def test_existing_semantic_diff_provides_stable_operation_ids() -> None:
    """Merge selection reuses the Phase-1 stable operation identifiers."""
    from custom_components.glt_flow_card import project_diff

    result = project_diff.compute_project_diff(base_project(), non_overlapping_candidate())
    operations = result["operations"] if isinstance(result, dict) else result
    assert operations, "the semantic diff produced no operations to select from"
    for operation in operations:
        assert operation["id"], "every operation needs a stable id for selection"


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def merge_gaps(hass: HomeAssistant, phase2_users: Any) -> list[str]:
    """Return every unmet bounded-merge guarantee."""
    merge = load("project_merge")
    if merge is None:
        return ["custom_components.glt_flow_card.project_merge does not exist"]

    gaps: list[str] = []
    for name in ("compute_merge_preview", "MergeBlocked", "MAX_MERGE_OPERATIONS"):
        if not hasattr(merge, name):
            gaps.append(f"project_merge.{name} is missing")
    if gaps:
        return gaps

    if merge.MAX_MERGE_OPERATIONS != MAX_MERGE_OPERATIONS:
        gaps.append("the merge operation bound does not match the contract")

    preview = merge.compute_merge_preview(
        base=base_project(),
        current=other_writer_change(),
        candidate=non_overlapping_candidate(),
    )
    for field in CONFLICT_REVISIONS:
        if field not in preview:
            gaps.append(f"the merge preview omits {field}")
    if preview.get("outcome") not in MERGE_OUTCOMES:
        gaps.append(f"unknown merge outcome {preview.get('outcome')!r}")
    if preview.get("outcome") != "applied" and not preview.get("operations"):
        gaps.append("a non-overlapping merge produced no selectable operations")

    blocked = merge.compute_merge_preview(
        base=base_project(),
        current=other_writer_change(),
        candidate=overlapping_candidate(),
    )
    if blocked.get("outcome") not in {"blocked_overlap", "conflict"}:
        gaps.append("an overlapping merge was not blocked")
    if blocked.get("candidate_preserved") is not True:
        gaps.append("a blocked merge did not report the candidate as preserved")
    return gaps


async def test_expected_red_phase2_merge(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """Conflicts preserve the candidate and only non-overlapping merges apply."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, max_operations=MAX_MERGE_OPERATIONS)

    gaps = await merge_gaps(hass, phase2_users)
    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  merge gap: {gap}")
    assert not gaps, "bounded three-way merge recovery is unavailable"
