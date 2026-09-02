"""Bounded, server-recomputed three-way merge recovery.

A conflict never resolves itself. The server recomputes the semantic diff from
its own verified base and current head against the engineer's candidate, and
applies only a selection that provably touches nothing the other writer changed.

There is no last-writer-wins, no automatic merge and no client patch body: the
caller may name stable operation identifiers, and nothing else. Anything that
overlaps, depends on an unselected operation, or exceeds the bounds comes back
as a new conflict with the candidate explicitly preserved.
"""
from __future__ import annotations

from collections.abc import Mapping
import json
from typing import Any

from .project_diff import compute_project_diff, expand_diff_selection

#: Conflict evidence bounds. Beyond these the response says it was truncated
#: rather than silently trimming, so the UI can tell the engineer.
MAX_MERGE_OPERATIONS = 100
MAX_MERGE_BYTES = 256 * 1024

#: Outcomes a merge attempt may report. `overwrite` is deliberately absent.
MERGE_OUTCOMES = (
    "applied",
    "conflict",
    "blocked_overlap",
    "blocked_dependency",
    "truncated",
)


class MergeBlocked(Exception):
    """A merge selection cannot be applied without losing an update."""

    def __init__(self, outcome: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(outcome)
        self.outcome = outcome
        self.detail = dict(detail or {})


def _revision_of(document: Mapping[str, Any] | None) -> int:
    if not isinstance(document, Mapping):
        return 0
    project = document.get("project")
    return int(project.get("revision", 0)) if isinstance(project, Mapping) else 0


def _paths(operations: list[Mapping[str, Any]]) -> set[str]:
    return {str(operation.get("path", "")) for operation in operations}


def _truncate(operations: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    """Cap the evidence by both operation count and serialized size."""
    capped = operations[:MAX_MERGE_OPERATIONS]
    truncated = len(operations) > len(capped)
    while capped and len(json.dumps(capped).encode("utf-8")) > MAX_MERGE_BYTES:
        capped.pop()
        truncated = True
    return capped, truncated


def compute_merge_preview(
    *,
    base: Mapping[str, Any],
    current: Mapping[str, Any],
    candidate: Mapping[str, Any],
) -> dict[str, Any]:
    """Return bounded three-way evidence and the selectable operations.

    `base` is the revision the engineer started from, `current` is the verified
    head another writer has since committed, and `candidate` is what the
    engineer has in front of them. All three are server-side documents: the
    caller supplies no patch.
    """
    theirs = compute_project_diff(base, current)
    mine = compute_project_diff(base, candidate)

    their_paths = _paths(theirs["operations"])
    selectable: list[dict[str, Any]] = []
    overlapping: list[dict[str, Any]] = []
    for operation in mine["operations"]:
        target = dict(operation)
        if str(operation.get("path", "")) in their_paths:
            overlapping.append(target)
        else:
            selectable.append(target)

    operations, truncated = _truncate(selectable)
    if truncated:
        outcome = "truncated"
    elif overlapping:
        outcome = "blocked_overlap"
    elif not selectable:
        outcome = "conflict"
    else:
        outcome = "conflict"

    return {
        "outcome": outcome,
        "base_revision": _revision_of(base),
        "current_revision": _revision_of(current),
        "candidate_revision": _revision_of(candidate),
        "base_digest": theirs["source_digest"],
        "current_digest": theirs["candidate_digest"],
        "candidate_digest": mine["candidate_digest"],
        "operations": operations,
        "overlapping": [
            {"id": entry["id"], "path": entry["path"]} for entry in overlapping
        ],
        "truncated": truncated,
        # The backend never stores the candidate. Saying so explicitly is what
        # lets the browser keep it through every failure.
        "candidate_preserved": True,
    }


def resolve_merge_selection(
    *,
    base: Mapping[str, Any],
    current: Mapping[str, Any],
    candidate: Mapping[str, Any],
    selected_ids: list[str],
) -> dict[str, Any]:
    """Recompute a selection server-side and refuse anything that loses work.

    The selection is expanded through the Phase-1 dependency closure, so a
    caller cannot apply half of a change. Every selected operation must be
    non-overlapping, or the whole attempt is a new conflict.
    """
    preview = compute_merge_preview(base=base, current=current, candidate=candidate)
    if preview["truncated"]:
        raise MergeBlocked("truncated", {"reason": "evidence exceeded the declared bounds"})

    available = {operation["id"] for operation in preview["operations"]}
    overlapping = {entry["id"] for entry in preview["overlapping"]}
    unknown = [entry for entry in selected_ids if entry not in available]
    if any(entry in overlapping for entry in unknown):
        raise MergeBlocked("blocked_overlap", {"reason": "selection touches a changed path"})
    if unknown:
        raise MergeBlocked("blocked_dependency", {"reason": "unknown operation selected"})

    mine = compute_project_diff(base, candidate)
    closure = expand_diff_selection(mine, list(selected_ids))
    if any(entry in overlapping for entry in closure["selected"]):
        raise MergeBlocked(
            "blocked_dependency",
            {"reason": "a required dependency touches a changed path"},
        )
    return {
        "outcome": "applied",
        "selected": closure["selected"],
        "added": closure.get("added", []),
        "base_revision": preview["base_revision"],
        "current_revision": preview["current_revision"],
        "candidate_revision": preview["candidate_revision"],
        "candidate_preserved": True,
    }
