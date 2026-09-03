"""Endpoint identity, mirrored for the Companion (ENG-01, T5-05).

A connection means a pair: the equipment and the port on it. A port id alone is
not an identity -- several pieces of equipment share a profile, so ``out`` names
a port on every pump in the plant -- and geometry is derived from the resolved
port rather than stored on the path, so moving equipment moves the endpoint and
never changes which port is meant.

This exists on the server as well as in the browser for the reason every mirror
in this component exists: a rule enforced only in the browser is not enforced.
A project arriving through the websocket API, a merge, or a bundle import has
not been through the editor, and an endpoint that silently detached there would
be persisted as authoritative.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

#: The collections whose ids are object identity, and which a paste rewrites.
#: Profiles are deliberately absent: a profile is shared, and duplicating one on
#: paste would turn a single equipment type into two that drift apart.
REMAPPED_COLLECTIONS: tuple[str, ...] = (
    "equipment", "paths", "groups", "layers", "views", "alarms",
)

#: The fields inside each collection that point at a remapped id.
REFERENCE_FIELDS: dict[str, tuple[str, ...]] = {
    "equipment": ("layer",),
    "paths": ("from_equipment", "to_equipment", "layer"),
    "groups": ("layer",),
    "alarms": ("equipment_id",),
    "datapoints": ("parent", "equipment_id"),
}


def port_anchor(equipment: Mapping[str, Any], port: Mapping[str, Any]) -> dict[str, float]:
    """Where a port sits, derived from the side it declares and its box."""
    x = float(equipment.get("x") or 0)
    y = float(equipment.get("y") or 0)
    width = float(equipment.get("width") or 0)
    height = float(equipment.get("height") or 0)
    side = port.get("side")
    if side == "left":
        return {"x": x, "y": y + height / 2}
    if side == "right":
        return {"x": x + width, "y": y + height / 2}
    if side == "top":
        return {"x": x + width / 2, "y": y}
    if side == "bottom":
        return {"x": x + width / 2, "y": y + height}
    return {"x": x + width / 2, "y": y + height / 2}


def _ports_of(project: Mapping[str, Any], equipment: Mapping[str, Any]) -> list[Any]:
    own = equipment.get("ports")
    if isinstance(own, list) and own:
        return own
    for profile in project.get("profiles") or []:
        if isinstance(profile, Mapping) and profile.get("id") == equipment.get("profile"):
            ports = profile.get("ports")
            return list(ports) if isinstance(ports, list) else []
    return []


def _detached(reason: str, detail: dict[str, Any]) -> dict[str, Any]:
    return {
        "broken": True, "reason": reason, "detail": detail,
        "equipment": None, "port": None, "anchor": None,
    }


def resolve_endpoint(project: Mapping[str, Any], path: Mapping[str, Any], end: str) -> dict[str, Any]:
    """Resolve one end of a connection to the equipment and port it names.

    An endpoint that cannot be resolved is *reported*, with both ends named.
    Snapping it to the nearest port would turn a diagram somebody has to fix
    into a diagram that is quietly wrong, and a quietly wrong diagram is the one
    that gets built.
    """
    if end not in ("from", "to"):
        raise ValueError(f'an endpoint is "from" or "to", not {end!r}')
    equipment_id = path.get(f"{end}_equipment")
    port_id = path.get(f"{end}_port")
    equipment = next(
        (item for item in project.get("equipment") or []
         if isinstance(item, Mapping) and item.get("id") == equipment_id),
        None,
    )
    if equipment is None:
        return _detached("equipment_missing", {
            "path_id": path.get("id"), "end": end,
            "equipment_id": equipment_id, "port_id": port_id,
        })
    if not isinstance(port_id, str) or not port_id:
        return _detached("port_unspecified", {
            "path_id": path.get("id"), "end": end,
            "equipment_id": equipment.get("id"), "port_id": None,
        })
    port = next(
        (item for item in _ports_of(project, equipment)
         if isinstance(item, Mapping) and item.get("id") == port_id),
        None,
    )
    if port is None:
        return _detached("port_missing", {
            "path_id": path.get("id"), "end": end,
            "equipment_id": equipment.get("id"), "port_id": port_id,
        })
    return {
        "broken": False, "reason": None, "detail": None,
        "equipment": equipment, "port": port, "anchor": port_anchor(equipment, port),
    }


def broken_endpoints(project: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Every endpoint that no longer resolves, with both ends named."""
    broken: list[dict[str, Any]] = []
    for path in project.get("paths") or []:
        if not isinstance(path, Mapping):
            continue
        for end in ("from", "to"):
            resolved = resolve_endpoint(project, path, end)
            if resolved["broken"]:
                broken.append({**resolved["detail"], "reason": resolved["reason"]})
    return broken


def _next_free_id(candidate: str, taken: set[str]) -> str:
    if candidate not in taken:
        return candidate
    suffix = 2
    while f"{candidate}-{suffix}" in taken:
        suffix += 1
    return f"{candidate}-{suffix}"


def remap_identifiers(
    project: Mapping[str, Any],
    prefix: str = "copy",
    existing: Iterable[str] = (),
) -> dict[str, Any]:
    """Give a project fresh object ids, rewriting every reference to them.

    Deterministic by construction: a new id is its prefix and its old id, never
    a clock reading. The previous paste used a timestamp, which made the same
    paste produce different documents on two machines and put two collaborators
    into a merge over a difference neither of them made.

    Port ids are not remapped. A port id is scoped to its profile, the profile
    is not being copied, and rewriting ``out`` to ``copy-out`` would break the
    endpoint this function exists to preserve.
    """
    if not isinstance(prefix, str) or not prefix:
        raise ValueError("remapping needs a prefix")
    taken = set(existing)
    mapping: dict[str, str] = {}
    for collection in REMAPPED_COLLECTIONS:
        for item in project.get(collection) or []:
            identifier = item.get("id") if isinstance(item, Mapping) else None
            if not isinstance(identifier, str) or identifier in mapping:
                continue
            fresh = _next_free_id(f"{prefix}-{identifier}", taken)
            taken.add(fresh)
            mapping[identifier] = fresh

    def rewrite(value: Any) -> Any:
        return mapping.get(value, value) if isinstance(value, str) else value

    result = dict(project)
    for collection in REMAPPED_COLLECTIONS:
        items = project.get(collection)
        if not isinstance(items, list):
            continue
        rewritten = []
        for item in items:
            if not isinstance(item, Mapping):
                rewritten.append(item)
                continue
            copy = dict(item)
            copy["id"] = rewrite(copy.get("id"))
            for field in REFERENCE_FIELDS.get(collection, ()):
                if field in copy:
                    copy[field] = rewrite(copy[field])
            if isinstance(item.get("members"), list):
                copy["members"] = [rewrite(member) for member in item["members"]]
            rewritten.append(copy)
        result[collection] = rewritten

    if isinstance(project.get("datapoints"), list):
        datapoints = []
        for item in project["datapoints"]:
            if not isinstance(item, Mapping):
                datapoints.append(item)
                continue
            copy = dict(item)
            copy["id"] = rewrite(copy.get("id"))
            for field in REFERENCE_FIELDS["datapoints"]:
                if field in copy:
                    copy[field] = rewrite(copy[field])
            datapoints.append(copy)
        result["datapoints"] = datapoints

    model = project.get("semantic_model")
    if isinstance(model, Mapping) and isinstance(model.get("nodes"), list):
        result["semantic_model"] = {
            **model,
            "nodes": [
                {**node, "id": rewrite(node.get("id")), "parent": rewrite(node.get("parent"))}
                if isinstance(node, Mapping) else node
                for node in model["nodes"]
            ],
        }
    return result
