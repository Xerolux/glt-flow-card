"""The validated semantic containment model, mirrored for the Companion.

A rule that exists only in JavaScript is a rule the server does not enforce, so
the graph checks the JSON Schema cannot express - acyclicity, level order,
single parent, depth and breadth bounds - live here as well, and the parity
suite proves the two runtimes agree.
"""
from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

_VOCABULARIES = json.loads(
    (Path(__file__).resolve().parent / "schemas" / "vocabularies.json").read_text(encoding="utf-8")
)

SEMANTIC_LEVELS: tuple[str, ...] = tuple(_VOCABULARIES["levels"])
UNITS: dict[str, Any] = dict(_VOCABULARIES["units"])
MEDIA: tuple[str, ...] = tuple(_VOCABULARIES["media"])
DIRECTIONS: tuple[str, ...] = tuple(_VOCABULARIES["directions"])
SEMANTIC_TAGS: tuple[str, ...] = tuple(_VOCABULARIES["semantic_tags"])
BOUNDS: dict[str, int] = dict(_VOCABULARIES["bounds"])

_LEVEL_INDEX = {level: index for index, level in enumerate(SEMANTIC_LEVELS)}


def _error(code: str, path: str, detail: Mapping[str, Any] | None = None) -> dict[str, Any]:
    error = {"code": code, "path": path}
    if detail is not None:
        error["detail"] = dict(detail)
    return error


def _nodes(model: Any) -> list[Any]:
    nodes = model.get("nodes") if isinstance(model, Mapping) else None
    return list(nodes) if isinstance(nodes, list) else []


def validate_semantic_model(model: Any) -> list[dict[str, Any]]:
    """Return every problem with a semantic model, empty when acceptable."""
    nodes = _nodes(model)
    errors: list[dict[str, Any]] = []

    if len(nodes) > BOUNDS["max_nodes"]:
        return [_error("semantic_model_too_large", "/semantic_model/nodes",
                       {"nodes": len(nodes), "max": BOUNDS["max_nodes"]})]

    by_id: dict[str, tuple[Mapping[str, Any], str]] = {}
    children: dict[str, int] = {}
    for index, node in enumerate(nodes):
        path = f"/semantic_model/nodes/{index}"
        if not isinstance(node, Mapping) or not isinstance(node.get("id"), str) or not node["id"]:
            errors.append(_error("semantic_node_id_missing", path))
            continue
        if node["id"] in by_id:
            errors.append(_error("semantic_node_duplicate_id", path, {"id": node["id"]}))
            continue
        by_id[node["id"]] = (node, path)

    for node, path in by_id.values():
        if node.get("level") not in _LEVEL_INDEX:
            errors.append(_error("semantic_level_unknown", path, {"level": node.get("level")}))
        for field, vocabulary in (("unit", UNITS), ("medium", MEDIA), ("direction", DIRECTIONS)):
            value = node.get(field)
            if value is None:
                continue
            known = value in vocabulary
            if not known:
                errors.append(_error(f"semantic_{field}_unknown", f"{path}/{field}", {"value": value}))
        tags = node.get("semantic_tags")
        if isinstance(tags, list):
            for tag_index, tag in enumerate(tags):
                if tag not in SEMANTIC_TAGS:
                    errors.append(_error("semantic_tag_unknown",
                                         f"{path}/semantic_tags/{tag_index}", {"tag": tag}))

        parent = node.get("parent")
        if parent is None:
            continue
        target = by_id.get(parent)
        if target is None:
            errors.append(_error("semantic_parent_missing", f"{path}/parent", {"parent": parent}))
            continue
        children[parent] = children.get(parent, 0) + 1
        parent_level = _LEVEL_INDEX.get(target[0].get("level"))
        node_level = _LEVEL_INDEX.get(node.get("level"))
        if parent_level is not None and node_level is not None:
            if node_level < parent_level:
                errors.append(_error("semantic_level_inverted", f"{path}/parent",
                                     {"level": node.get("level"), "parent_level": target[0].get("level")}))
            elif target[0].get("level") == "datapoint":
                errors.append(_error("semantic_datapoint_has_child", f"{path}/parent", {"parent": parent}))

    for parent, count in children.items():
        if count > BOUNDS["max_children"]:
            errors.append(_error("semantic_children_exceeded",
                                 by_id.get(parent, ({}, "/semantic_model/nodes"))[1],
                                 {"children": count, "max": BOUNDS["max_children"]}))

    for node_id, (node, path) in by_id.items():
        seen = {node_id}
        current = node.get("parent")
        depth = 1
        while current is not None:
            if current in seen:
                errors.append(_error("semantic_cycle", f"{path}/parent", {"closes_at": current}))
                break
            seen.add(current)
            following = by_id.get(current)
            if following is None:
                break
            depth += 1
            if depth > BOUNDS["max_depth"]:
                errors.append(_error("semantic_depth_exceeded", path,
                                     {"depth": depth, "max": BOUNDS["max_depth"]}))
                break
            current = following[0].get("parent")

    return errors


def semantic_path(model: Any, node_id: str) -> list[str]:
    """Derive a node's containment path, root first. Never stored."""
    by_id = {node["id"]: node for node in _nodes(model)
             if isinstance(node, Mapping) and isinstance(node.get("id"), str)}
    path: list[str] = []
    seen: set[str] = set()
    current: Any = node_id
    while current is not None and current in by_id and current not in seen:
        seen.add(current)
        path.insert(0, current)
        current = by_id[current].get("parent")
    return path


def same_dimension(left: str, right: str) -> bool:
    """Whether two units can be compared or summed at all."""
    a = UNITS.get(left)
    b = UNITS.get(right)
    return bool(a and b and a["dimension"] == b["dimension"])
