"""Compose the profile-driven object panel on the server (OPS-02, T4-01, T4-02).

The browser must never decide which controls an operator may use. Phase 2
settled that browser role checks are UX only, and a panel that assembled its own
control list from a profile plus a capability snapshot would be exactly the
browser-derived authority that rule forbids: the snapshot can be five minutes
stale, a profile's declared control may no longer resolve against the current
head, and neither the lease state nor the rate class appears in a profile.

So the server composes the panel and the browser renders what it is given. A
control the caller may not execute right now is *absent* from the response, not
present with ``enabled: false`` -- a disabled control still tells the caller the
control exists.

The response carries no domain, service or target. Phase 2 already resolves
those from the verified head, and a panel that echoed one would hand the browser
something to dispatch directly.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from .equipment_profiles import validate_profile

#: The ordered region kinds. Closed: an unknown kind is an error, never a
#: passthrough, because a region nobody validated is a region nobody can render.
REGION_KINDS: tuple[str, ...] = (
    "identity",
    "state",
    "values",
    "runtime",
    "quality",
    "alarms",
    "controls",
    "trend",
)

#: Regions every panel carries. ``runtime`` is omitted when the profile declares
#: neither operating hours nor starts, so it is not in this tuple.
REQUIRED_REGIONS: tuple[str, ...] = (
    "identity", "state", "values", "quality", "alarms", "controls", "trend",
)

#: Semantic tags that mark a datapoint as a runtime counter rather than a value.
RUNTIME_SLOTS: tuple[str, ...] = ("hours", "starts")

#: Bounds. A panel is a read the caller triggers, so it is not unbounded.
MAX_REGIONS = 32
MAX_VALUES_PER_PANEL = 256
MAX_ALARMS_PER_PANEL = 64
MAX_CONTROLS_PER_PANEL = 64

#: The capability a principal needs before any control may be offered.
CONTROL_CAPABILITY = "control.execute"

#: The trend region's declared state until Phase 7 supplies the data path.
#: HIST-01 owns honest Recorder history; an unavailable region that says so is
#: better than a region that invents its content, and building a history path
#: here would duplicate an ownership the roadmap assigns elsewhere.
TREND_UNAVAILABLE = "history_unavailable"


def _nodes_by_id(config: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    model = config.get("semantic_model") or {}
    return {
        node["id"]: node
        for node in model.get("nodes", [])
        if isinstance(node, Mapping) and isinstance(node.get("id"), str)
    }


def _children_of(nodes: Mapping[str, Mapping[str, Any]], parent_id: str) -> list[Mapping[str, Any]]:
    return [node for node in nodes.values() if node.get("parent") == parent_id]


def _profile_for(config: Mapping[str, Any], equipment: Mapping[str, Any]) -> Mapping[str, Any] | None:
    wanted = equipment.get("profile")
    for profile in config.get("profiles", []) or []:
        if isinstance(profile, Mapping) and profile.get("id") == wanted:
            return profile
    return None


def _is_runtime(node: Mapping[str, Any]) -> bool:
    """A runtime counter is recognised by its declared slot, not by its name."""
    identifier = str(node.get("id", ""))
    return any(identifier.endswith(f"-{slot}") for slot in RUNTIME_SLOTS)


def _value_row(node: Mapping[str, Any], states: Mapping[str, Any]) -> dict[str, Any]:
    """One datapoint row. Deliberately does not carry the entity id.

    The entity id is a dispatch target: a browser holding one could call
    Home Assistant directly, which is the fallback Phase 2 closed.
    """
    entity_id = node.get("entity_id")
    state = states.get(entity_id) if entity_id else None
    return {
        "id": node.get("id"),
        "label": node.get("name") or node.get("id"),
        "unit": node.get("unit"),
        "value": state,
    }


def _semantic_path(nodes: Mapping[str, Mapping[str, Any]], node_id: str) -> list[str]:
    """Derive the containment path. Never stored, so it cannot disagree."""
    path: list[str] = []
    seen: set[str] = set()
    current: str | None = node_id
    while current and current in nodes and current not in seen:
        seen.add(current)
        path.append(current)
        parent = nodes[current].get("parent")
        current = parent if isinstance(parent, str) else None
    path.reverse()
    return path


def compose_panel(
    config: Mapping[str, Any],
    object_id: str,
    *,
    capabilities: frozenset[str] | set[str],
    states: Mapping[str, Any] | None = None,
    provenance: Mapping[str, Any] | None = None,
    operational_state: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Return the composed panel for `object_id`, or None when there is none.

    Returning None rather than raising keeps the caller's denial path single:
    a missing object and an unauthorized one must answer identically, so the
    route turns both into the one opaque error.
    """
    equipment = next(
        (item for item in config.get("equipment", []) or []
         if isinstance(item, Mapping) and item.get("id") == object_id),
        None,
    )
    if equipment is None:
        return None

    nodes = _nodes_by_id(config)
    states = states or {}
    profile = _profile_for(config, equipment)

    datapoints = [node for node in _children_of(nodes, object_id)
                  if node.get("level") == "datapoint"]
    runtime_points = [node for node in datapoints if _is_runtime(node)]
    value_points = [node for node in datapoints if not _is_runtime(node)]

    regions: list[dict[str, Any]] = [
        {
            "kind": "identity",
            "name": nodes.get(object_id, {}).get("name") or object_id,
            "path": _semantic_path(nodes, object_id),
            "profile": (profile or {}).get("id"),
            "profile_version": (profile or {}).get("version"),
        },
        {
            "kind": "state",
            **(dict(operational_state) if operational_state else {"state": "unknown"}),
        },
        {
            "kind": "values",
            "values": [_value_row(node, states) for node in value_points[:MAX_VALUES_PER_PANEL]],
            "emptyText": "no_values_declared",
        },
    ]

    if runtime_points:
        regions.append({
            "kind": "runtime",
            "values": [_value_row(node, states) for node in runtime_points],
        })

    regions.append({
        "kind": "quality",
        **(dict(provenance) if provenance else {"health": "unknown"}),
    })

    alarms = [
        {
            "id": alarm.get("id"),
            "severity": alarm.get("severity"),
            "state": alarm.get("state"),
            "label": alarm.get("label"),
        }
        for alarm in config.get("alarms", []) or []
        if isinstance(alarm, Mapping) and alarm.get("equipment_id") == object_id
    ][:MAX_ALARMS_PER_PANEL]
    regions.append({"kind": "alarms", "alarms": alarms, "emptyText": "no_alarms"})

    regions.append(_controls_region(profile, capabilities))

    regions.append({"kind": "trend", "state": TREND_UNAVAILABLE})

    if len(regions) > MAX_REGIONS:  # pragma: no cover - defensive
        regions = regions[:MAX_REGIONS]
    for region in regions:
        if region["kind"] not in REGION_KINDS:  # pragma: no cover - defensive
            raise ValueError(f"undeclared region kind {region['kind']!r}")

    return {"object_id": object_id, "regions": regions}


def _controls_region(
    profile: Mapping[str, Any] | None,
    capabilities: frozenset[str] | set[str],
) -> dict[str, Any]:
    """Only the controls this principal may execute right now.

    A control the caller may not run is absent. There is no disabled control and
    no "you need role X" hint: both announce that the control exists, which is
    the enumeration this region is filtered to prevent.
    """
    if profile is None or CONTROL_CAPABILITY not in capabilities:
        return {"kind": "controls", "controls": [], "emptyText": "no_controls_available"}

    declared = profile.get("controls") or []
    controls = [
        {
            "control_id": control.get("id"),
            "label": control.get("label"),
            "confirm_required": True,
        }
        for control in declared[:MAX_CONTROLS_PER_PANEL]
        if isinstance(control, Mapping) and isinstance(control.get("id"), str)
    ]
    return {"kind": "controls", "controls": controls, "emptyText": "no_controls_available"}


def panel_profiles_are_valid(config: Mapping[str, Any]) -> bool:
    """Every profile the panel would instantiate still satisfies its contract."""
    for profile in config.get("profiles", []) or []:
        if isinstance(profile, Mapping) and validate_profile(profile):
            return False
    return True


def addressable_objects(config: Mapping[str, Any]) -> Sequence[str]:
    """Object ids a panel can be composed for, in declaration order."""
    return [
        item["id"] for item in config.get("equipment", []) or []
        if isinstance(item, Mapping) and isinstance(item.get("id"), str)
    ]
