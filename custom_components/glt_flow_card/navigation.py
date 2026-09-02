"""Resolve a deep link, and roll up only what the caller may open (NAV-01).

A URL is shareable. It gets pasted into a chat and opened by somebody else, so
nothing about a link may be trusted for having once been valid for someone:
every resolve re-authorizes from scratch, and an address the caller may not
follow is indistinguishable from one that does not exist.

The address is caller-supplied input into a tree walk, so it is bounded before
it is parsed rather than during the walk.

Counts are the subtler half. The portfolio spans projects and Phase 2 assigns
membership per project, so the dangerous shape is a total computed across every
project and *then* filtered for display: it announces a fault in a project the
caller is not a member of even though the row itself is hidden. Totals here are
computed from the already-filtered set. And an authorized count of zero is
reported as no count at all, because a rendered zero distinguishes "you may see
this and it is empty" from "you may not see this".
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

#: Re-asserted from the Phase-3 vocabulary bounds. An address deeper than the
#: hierarchy can be is rejected before any walk begins.
MAX_ADDRESS_DEPTH = 32

#: The whole serialized address. Bounded so a crafted string cannot be parsed
#: at all, let alone walked.
MAX_ADDRESS_LENGTH = 1024

#: One path segment. Matches the schema-3 id shape closely enough to reject
#: control characters, traversal and percent-encoding tricks outright.
MAX_SEGMENT_LENGTH = 200

#: Severities a roll-up reports. Closed: an unknown severity is not counted
#: rather than passed through into a number nobody can interpret.
COUNTED_SEVERITIES = ("fault", "warning")


class AddressInvalid(Exception):
    """The address is malformed. Never distinguishable from "not found"."""


def _valid_segment(segment: str) -> bool:
    if not segment or len(segment) > MAX_SEGMENT_LENGTH:
        return False
    if segment in (".", ".."):
        return False
    return all(
        character.isalnum() or character in "_-.~:@+"
        for character in segment
    )


def parse_address(address: str) -> tuple[str, ...]:
    """Validate and split an address. Bounded before anything is walked."""
    if not isinstance(address, str) or not address:
        raise AddressInvalid("empty address")
    if len(address) > MAX_ADDRESS_LENGTH:
        raise AddressInvalid("address too long")
    # A remote address is Phase 9's; until then it must be as absent as any
    # other unknown target, so it is refused here rather than half-resolved.
    if address.startswith("remote:"):
        raise AddressInvalid("remote addresses are deferred")
    segments = address.split("/")
    if len(segments) > MAX_ADDRESS_DEPTH:
        raise AddressInvalid("address deeper than the hierarchy bound")
    for segment in segments:
        if not _valid_segment(segment):
            raise AddressInvalid("malformed segment")
    return tuple(segments)


def _nodes(config: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    model = config.get("semantic_model") or {}
    return {
        node["id"]: node
        for node in model.get("nodes", [])
        if isinstance(node, Mapping) and isinstance(node.get("id"), str)
    }


def _ancestry(nodes: Mapping[str, Mapping[str, Any]], node_id: str) -> list[dict[str, Any]]:
    """The containment path, derived rather than stored.

    A stored path can disagree with the parents it claims to describe; a derived
    one cannot. An ancestor the caller cannot open is not a case here: within a
    project, membership is uniform.
    """
    chain: list[dict[str, Any]] = []
    seen: set[str] = set()
    current: str | None = node_id
    while current and current in nodes and current not in seen:
        seen.add(current)
        node = nodes[current]
        chain.append({
            "id": node["id"],
            "level": node.get("level"),
            "name": node.get("name") or node["id"],
        })
        parent = node.get("parent")
        current = parent if isinstance(parent, str) else None
    chain.reverse()
    return chain


def resolve_address(config: Mapping[str, Any], address: str) -> dict[str, Any] | None:
    """Resolve one address inside one already-authorized project.

    Returns None for anything the caller must not be able to distinguish from a
    missing target: a malformed address, an unknown node, or a path whose
    segments do not actually form a containment chain.
    """
    try:
        segments = parse_address(address)
    except AddressInvalid:
        return None

    nodes = _nodes(config)
    node_id = segments[-1]
    node = nodes.get(node_id)
    if node is None:
        return None

    # The address must describe a real containment chain, or a caller could
    # reach any node by naming a plausible prefix.
    chain = [entry["id"] for entry in _ancestry(nodes, node_id)]
    if list(segments) != chain[-len(segments):]:
        return None

    children = [
        {
            "id": child["id"],
            "level": child.get("level"),
            "name": child.get("name") or child["id"],
        }
        for child in nodes.values()
        if child.get("parent") == node_id
    ]
    return {
        "address": "/".join(chain),
        "node": {"id": node_id, "level": node.get("level"), "name": node.get("name") or node_id},
        "ancestry": _ancestry(nodes, node_id),
        "children": children,
    }


def _counts_for(config: Mapping[str, Any]) -> dict[str, int]:
    """Alarm counts for one project. Zero counts are omitted, not reported.

    A rendered zero is an oracle one level up: it distinguishes an authorized
    empty scope from an unauthorized one.
    """
    counts: dict[str, int] = {}
    for alarm in config.get("alarms", []) or []:
        if not isinstance(alarm, Mapping):
            continue
        severity = alarm.get("severity")
        if severity in COUNTED_SEVERITIES and alarm.get("state") == "active":
            counts[severity] = counts.get(severity, 0) + 1
    return {name: value for name, value in counts.items() if value > 0}


def portfolio(projects: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Roll up the projects the caller may open, and nothing else.

    `projects` must already be filtered to the caller's memberships. The totals
    are summed from that filtered set: computing them first and filtering
    afterwards is the leak this function exists to avoid.
    """
    rows: list[dict[str, Any]] = []
    totals: dict[str, int] = {}
    for project in projects:
        config = project.get("config") or {}
        counts = _counts_for(config)
        row: dict[str, Any] = {
            "project_id": project.get("id"),
            "name": (config.get("project") or {}).get("name") or project.get("id"),
        }
        if counts:
            row["counts"] = counts
        for severity, value in counts.items():
            totals[severity] = totals.get(severity, 0) + value
        rows.append(row)
    return {
        "projects": rows,
        "totals": {name: value for name, value in totals.items() if value > 0},
    }
