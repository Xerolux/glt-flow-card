"""The Phase-5 CAD corpus: geometry that forces a router to make a decision.

A routing test proves nothing if a straight line would have been right. Every
fixture here is therefore adversarial by construction, and the module carries
the naive router it is adversarial *against* -- an elbow through the midpoint,
which is what routing code degenerates into when nobody proves otherwise -- so
that "this corpus is hard" is a property the suite checks rather than a claim
the docstring makes.

The five situations, and what each one is here to break:

``obstruction``
    Equipment sits directly on the line between two ports. The naive route runs
    through the middle of it.

``corridor``
    Two routes have to share the one gap between two walls. One of them fails
    naively by running into a wall; both of them, once through, occupy the same
    corridor, so spacing is a decision and not an afterthought.

``crossing``
    Two routes in a closed box, diagonally opposed. They must cross -- no
    detour exists -- and the naive router does something worse than cross: it
    lays both routes along the same vertical, so they overlap for their whole
    length instead of meeting at a point. A crossing is legible; an overlap
    hides one route inside another.

``junction``
    Three routes terminate at one ``many`` port. This is the case that is
    legitimately allowed to share geometry, and it exists so that "routes touch"
    is not treated as an error everywhere.

``distribution`` and ``mismatch``
    Every port kind and multiplicity the schema admits, plus one pair that must
    be refused: a cooling-flow outlet offered to a heating-flow inlet. Both are
    process ports pointing the right way, so the only thing wrong with the pair
    is the medium, and a refusal that names anything else is wrong.

Ports live on profiles, not on equipment, and several pieces of equipment share
a profile on purpose. That means the port id ``p-out`` is not an identity: only
``(equipment, port)`` is. The corpus would be easier to write with unique port
ids everywhere, and it would then quietly stop testing the thing ENG-01 exists
to fix.
"""
from __future__ import annotations

from typing import Any

#: The project id the CAD fixtures live under.
CAD_PROJECT_ID = "cad-corpus"

_EPSILON = 1e-6

#: Every piece of equipment: id, profile, its box, and the group it belongs to.
#: The boxes are the obstacle field -- there is no separate obstacle list,
#: because a router that only avoids declared obstacles avoids nothing real.
_EQUIPMENT: tuple[dict[str, Any], ...] = (
    # -- obstruction: a barrier squarely on the sightline ---------------------
    {"id": "eq-source-a", "profile": "profile-source", "group": "obstruction",
     "name": "Primary supply", "box": (0, 0, 100, 80)},
    {"id": "eq-barrier", "profile": "profile-barrier", "group": "obstruction",
     "name": "Switch cabinet", "box": (200, -40, 140, 160)},
    {"id": "eq-sink-a", "profile": "profile-sink", "group": "obstruction",
     "name": "Primary load", "box": (440, 0, 100, 80)},

    # -- corridor: one gap, two routes ---------------------------------------
    {"id": "eq-wall-upper", "profile": "profile-barrier", "group": "corridor",
     "name": "Riser block north", "box": (220, 180, 240, 60)},
    {"id": "eq-wall-lower", "profile": "profile-barrier", "group": "corridor",
     "name": "Riser block south", "box": (220, 300, 240, 60)},
    {"id": "eq-source-b", "profile": "profile-source", "group": "corridor",
     "name": "Corridor supply north", "box": (0, 230, 100, 60)},
    {"id": "eq-sink-b", "profile": "profile-sink", "group": "corridor",
     "name": "Corridor load north", "box": (560, 230, 100, 60)},
    {"id": "eq-source-c", "profile": "profile-source", "group": "corridor",
     "name": "Corridor supply south", "box": (0, 400, 100, 60)},
    {"id": "eq-sink-c", "profile": "profile-sink", "group": "corridor",
     "name": "Corridor load south", "box": (560, 120, 100, 60)},

    # -- crossing: a closed box with two diagonals ----------------------------
    {"id": "eq-cross-lid", "profile": "profile-barrier", "group": "crossing",
     "name": "Ceiling slab", "box": (780, -80, 220, 60)},
    {"id": "eq-cross-floor", "profile": "profile-barrier", "group": "crossing",
     "name": "Floor slab", "box": (780, 280, 220, 60)},
    {"id": "eq-cross-core", "profile": "profile-barrier", "group": "crossing",
     "name": "Structural core", "box": (860, 80, 60, 100)},
    {"id": "eq-cross-nw", "profile": "profile-source", "group": "crossing",
     "name": "Diagonal supply north", "box": (700, 0, 80, 60)},
    {"id": "eq-cross-sw", "profile": "profile-source", "group": "crossing",
     "name": "Diagonal supply south", "box": (700, 200, 80, 60)},
    {"id": "eq-cross-ne", "profile": "profile-sink", "group": "crossing",
     "name": "Diagonal load north", "box": (1000, 0, 80, 60)},
    {"id": "eq-cross-se", "profile": "profile-sink", "group": "crossing",
     "name": "Diagonal load south", "box": (1000, 200, 80, 60)},

    # -- junction: three into one --------------------------------------------
    {"id": "eq-branch-1", "profile": "profile-branch", "group": "junction",
     "name": "Branch 1", "box": (380, 440, 80, 60)},
    {"id": "eq-branch-2", "profile": "profile-branch", "group": "junction",
     "name": "Branch 2", "box": (380, 530, 80, 60)},
    {"id": "eq-branch-3", "profile": "profile-branch", "group": "junction",
     "name": "Branch 3", "box": (380, 620, 80, 60)},
    {"id": "eq-manifold", "profile": "profile-manifold", "group": "junction",
     "name": "Header manifold", "box": (700, 500, 160, 80)},

    # -- distribution: the signal and power kinds -----------------------------
    {"id": "eq-controller", "profile": "profile-controller", "group": "distribution",
     "name": "Plant controller", "box": (1200, 440, 120, 80)},
    {"id": "eq-switchgear", "profile": "profile-switchgear", "group": "distribution",
     "name": "Switchgear", "box": (1200, 600, 120, 80)},
    {"id": "eq-panel", "profile": "profile-panel", "group": "distribution",
     "name": "Sub-panel", "box": (1450, 600, 120, 80)},

    # -- mismatch: the pair that must be refused ------------------------------
    {"id": "eq-chiller", "profile": "profile-chiller", "group": "mismatch",
     "name": "Chiller", "box": (1200, 0, 120, 80)},
    {"id": "eq-radiator", "profile": "profile-radiator", "group": "mismatch",
     "name": "Radiator circuit", "box": (1450, 0, 120, 80)},
)

_PROFILES: tuple[dict[str, Any], ...] = (
    {"id": "profile-source", "equipment_type": "supply_header", "version": "1.0.0",
     "ports": [{"id": "p-out", "medium": "heating_flow", "direction": "out",
                "side": "right", "kind": "process", "multiplicity": "one",
                "label": {"de": "Vorlauf", "en": "Flow"}}]},
    {"id": "profile-sink", "equipment_type": "load", "version": "1.0.0",
     "ports": [{"id": "p-in", "medium": "heating_flow", "direction": "in",
                "side": "left", "kind": "process", "multiplicity": "one",
                "label": {"de": "Vorlauf", "en": "Flow"}}]},
    # A barrier is equipment with no ports at all. Nothing routes to it; it
    # exists only to be in the way, which is a role real plant rooms are full of.
    {"id": "profile-barrier", "equipment_type": "structure", "version": "1.0.0",
     "ports": []},
    {"id": "profile-branch", "equipment_type": "branch", "version": "1.0.0",
     "ports": [{"id": "p-out", "medium": "heating_flow", "direction": "out",
                "side": "right", "kind": "process", "multiplicity": "one",
                "label": {"de": "Abgang", "en": "Branch"}}]},
    {"id": "profile-manifold", "equipment_type": "manifold", "version": "1.0.0",
     "ports": [
         {"id": "p-header", "medium": "heating_flow", "direction": "in",
          "side": "left", "kind": "process", "multiplicity": "many",
          "label": {"de": "Sammler", "en": "Header"}},
         {"id": "p-balance", "medium": "heating_flow", "direction": "bidirectional",
          "side": "top", "kind": "process", "multiplicity": "one",
          "label": {"de": "Abgleich", "en": "Balance"}},
     ]},
    {"id": "profile-controller", "equipment_type": "controller", "version": "1.0.0",
     "ports": [
         {"id": "p-bus", "medium": "none", "direction": "in", "side": "left",
          "kind": "signal", "multiplicity": "many",
          "label": {"de": "Feldbus", "en": "Fieldbus"}},
         {"id": "p-cmd", "medium": "none", "direction": "out", "side": "right",
          "kind": "signal", "multiplicity": "one",
          "label": {"de": "Befehl", "en": "Command"}},
     ]},
    {"id": "profile-switchgear", "equipment_type": "switchgear", "version": "1.0.0",
     "ports": [
         {"id": "p-feed", "medium": "electrical", "direction": "in", "side": "left",
          "kind": "power", "multiplicity": "one",
          "label": {"de": "Einspeisung", "en": "Incomer"}},
         {"id": "p-bus", "medium": "electrical", "direction": "out", "side": "bottom",
          "kind": "power", "multiplicity": "many",
          "label": {"de": "Sammelschiene", "en": "Busbar"}},
     ]},
    {"id": "profile-panel", "equipment_type": "panel", "version": "1.0.0",
     "ports": [
         {"id": "p-feed", "medium": "electrical", "direction": "in", "side": "left",
          "kind": "power", "multiplicity": "one",
          "label": {"de": "Zuleitung", "en": "Feed"}},
         {"id": "p-signal", "medium": "none", "direction": "in", "side": "top",
          "kind": "signal", "multiplicity": "one",
          "label": {"de": "Meldung", "en": "Status"}},
     ]},
    {"id": "profile-chiller", "equipment_type": "chiller", "version": "1.0.0",
     "ports": [{"id": "p-out", "medium": "cooling_flow", "direction": "out",
                "side": "right", "kind": "process", "multiplicity": "one",
                "label": {"de": "Kaltwasser", "en": "Chilled flow"}}]},
    {"id": "profile-radiator", "equipment_type": "radiator_circuit", "version": "1.0.0",
     "ports": [{"id": "p-in", "medium": "heating_flow", "direction": "in",
                "side": "left", "kind": "process", "multiplicity": "one",
                "label": {"de": "Heizkreis", "en": "Heating circuit"}}]},
)

_PATHS: tuple[dict[str, Any], ...] = (
    {"id": "path-obstructed", "from_equipment": "eq-source-a", "from_port": "p-out",
     "to_equipment": "eq-sink-a", "to_port": "p-in", "medium": "heating_flow"},
    {"id": "path-corridor-north", "from_equipment": "eq-source-b", "from_port": "p-out",
     "to_equipment": "eq-sink-b", "to_port": "p-in", "medium": "heating_flow"},
    {"id": "path-corridor-south", "from_equipment": "eq-source-c", "from_port": "p-out",
     "to_equipment": "eq-sink-c", "to_port": "p-in", "medium": "heating_flow"},
    {"id": "path-cross-descending", "from_equipment": "eq-cross-nw", "from_port": "p-out",
     "to_equipment": "eq-cross-se", "to_port": "p-in", "medium": "heating_flow"},
    {"id": "path-cross-ascending", "from_equipment": "eq-cross-sw", "from_port": "p-out",
     "to_equipment": "eq-cross-ne", "to_port": "p-in", "medium": "heating_flow"},
    {"id": "path-junction-1", "from_equipment": "eq-branch-1", "from_port": "p-out",
     "to_equipment": "eq-manifold", "to_port": "p-header", "medium": "heating_flow"},
    {"id": "path-junction-2", "from_equipment": "eq-branch-2", "from_port": "p-out",
     "to_equipment": "eq-manifold", "to_port": "p-header", "medium": "heating_flow"},
    {"id": "path-junction-3", "from_equipment": "eq-branch-3", "from_port": "p-out",
     "to_equipment": "eq-manifold", "to_port": "p-header", "medium": "heating_flow"},
    {"id": "path-power", "from_equipment": "eq-switchgear", "from_port": "p-bus",
     "to_equipment": "eq-panel", "to_port": "p-feed", "medium": "electrical"},
    {"id": "path-signal", "from_equipment": "eq-controller", "from_port": "p-cmd",
     "to_equipment": "eq-panel", "to_port": "p-signal", "medium": "none"},
    # Both process, both pointing the right way, geometrically trivial. The only
    # thing wrong with it is the medium, so a refusal blaming anything else has
    # found a different bug than the one it thinks it found.
    {"id": "path-incompatible", "from_equipment": "eq-chiller", "from_port": "p-out",
     "to_equipment": "eq-radiator", "to_port": "p-in", "medium": "heating_flow"},
)

#: The pair whose media disagree. 05-07's refusal must name this and only this.
INCOMPATIBLE_PATH_ID = "path-incompatible"

#: The three routes that terminate at one ``many`` port.
JUNCTION_PATH_IDS = ("path-junction-1", "path-junction-2", "path-junction-3")

#: The two routes that share the corridor between the riser blocks.
CORRIDOR_PATH_IDS = ("path-corridor-north", "path-corridor-south")

#: The two routes that cannot avoid each other.
CROSSING_PATH_IDS = ("path-cross-descending", "path-cross-ascending")

#: The free rectangle between the riser blocks -- the only way through.
CORRIDOR_GAP: tuple[float, float, float, float] = (220.0, 240.0, 460.0, 300.0)

_BY_ID = {entry["id"]: entry for entry in _EQUIPMENT}
_PROFILE_BY_ID = {entry["id"]: entry for entry in _PROFILES}


def equipment_ids() -> tuple[str, ...]:
    """Every piece of equipment in the corpus, in declaration order."""
    return tuple(entry["id"] for entry in _EQUIPMENT)


def equipment_box(equipment_id: str) -> tuple[float, float, float, float]:
    """The ``(left, top, right, bottom)`` an obstacle occupies."""
    x, y, width, height = _BY_ID[equipment_id]["box"]
    return (float(x), float(y), float(x + width), float(y + height))


def port_anchor(equipment_id: str, port_id: str) -> tuple[float, float]:
    """Where a port sits on its equipment, derived from the declared side.

    Deriving it means the corpus cannot drift: move a box and every anchor on it
    moves with it, which is exactly what the designer has to do too.
    """
    entry = _BY_ID[equipment_id]
    profile = _PROFILE_BY_ID[entry["profile"]]
    port = next(candidate for candidate in profile["ports"] if candidate["id"] == port_id)
    left, top, right, bottom = equipment_box(equipment_id)
    return {
        "left": (left, (top + bottom) / 2),
        "right": (right, (top + bottom) / 2),
        "top": ((left + right) / 2, top),
        "bottom": ((left + right) / 2, bottom),
    }[port["side"]]


def naive_midpoint_route(path: dict[str, Any]) -> list[tuple[float, float]]:
    """The elbow-through-the-midpoint route this corpus exists to defeat.

    Out to half the horizontal distance, across, and in. It is what a router
    produces when it is given two anchors and told nothing about the room.
    """
    start = port_anchor(path["from_equipment"], path["from_port"])
    end = port_anchor(path["to_equipment"], path["to_port"])
    middle = (start[0] + end[0]) / 2
    points = [start, (middle, start[1]), (middle, end[1]), end]
    deduplicated: list[tuple[float, float]] = []
    for point in points:
        if not deduplicated or deduplicated[-1] != point:
            deduplicated.append(point)
    return deduplicated


def _enters(segment: tuple[tuple[float, float], tuple[float, float]],
            box: tuple[float, float, float, float]) -> bool:
    """Whether a segment passes through a box's interior, not merely its edge.

    A route leaving a port slides along the edge of its own equipment, and a
    corridor route runs flush against a wall. Neither is a collision, so the
    test is strict interior containment of the clipped midpoint rather than any
    intersection at all.
    """
    (x0, y0), (x1, y1) = segment
    left, top, right, bottom = box
    start, end = 0.0, 1.0
    for delta, distance in (
        (-(x1 - x0), x0 - left), ((x1 - x0), right - x0),
        (-(y1 - y0), y0 - top), ((y1 - y0), bottom - y0),
    ):
        if delta == 0:
            if distance < 0:
                return False
            continue
        ratio = distance / delta
        if delta < 0:
            start = max(start, ratio)
        else:
            end = min(end, ratio)
        if start > end:
            return False
    middle = (start + end) / 2
    x = x0 + (x1 - x0) * middle
    y = y0 + (y1 - y0) * middle
    return (left + _EPSILON < x < right - _EPSILON
            and top + _EPSILON < y < bottom - _EPSILON)


def blocked_by(points: list[tuple[float, float]], ignore: tuple[str, ...] = ()) -> tuple[str, ...]:
    """The equipment a polyline runs through, excluding its own endpoints."""
    hits: set[str] = set()
    for index in range(len(points) - 1):
        segment = (points[index], points[index + 1])
        for entry in _EQUIPMENT:
            if entry["id"] in ignore or entry["id"] in hits:
                continue
            if _enters(segment, equipment_box(entry["id"])):
                hits.add(entry["id"])
    return tuple(sorted(hits))


def blocked_naively(path: dict[str, Any]) -> tuple[str, ...]:
    """What the naive route for one path runs into."""
    return blocked_by(
        naive_midpoint_route(path),
        ignore=(path["from_equipment"], path["to_equipment"]),
    )


def collinear_overlap(first: list[tuple[float, float]],
                      second: list[tuple[float, float]]) -> float:
    """How far two polylines lie on top of each other rather than crossing.

    Two routes crossing meet at a point and measure zero here. Two routes laid
    along the same line hide one inside the other, and that is what this
    measures -- an overlap is a legibility failure even when nothing collides.
    """
    total = 0.0
    for index in range(len(first) - 1):
        (ax0, ay0), (ax1, ay1) = first[index], first[index + 1]
        for other in range(len(second) - 1):
            (bx0, by0), (bx1, by1) = second[other], second[other + 1]
            if ay0 == ay1 and by0 == by1 and ay0 == by0:
                low = max(min(ax0, ax1), min(bx0, bx1))
                high = min(max(ax0, ax1), max(bx0, bx1))
                total += max(0.0, high - low)
            elif ax0 == ax1 and bx0 == bx1 and ax0 == bx0:
                low = max(min(ay0, ay1), min(by0, by1))
                high = min(max(ay0, ay1), max(by0, by1))
                total += max(0.0, high - low)
    return total


def paths() -> list[dict[str, Any]]:
    """A fresh copy of every path, so a caller mutating one cannot poison another."""
    return [dict(path) for path in _PATHS]


def path_by_id(path_id: str) -> dict[str, Any]:
    return next(dict(path) for path in _PATHS if path["id"] == path_id)


def ports_of(equipment_id: str) -> list[dict[str, Any]]:
    profile = _PROFILE_BY_ID[_BY_ID[equipment_id]["profile"]]
    return [dict(port) for port in profile["ports"]]


def _semantic_nodes() -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = [
        {"id": "site-cad", "level": "site", "parent": None, "name": "CAD reference site"},
        {"id": "bldg-cad", "level": "building", "parent": "site-cad", "name": "Plant building"},
        {"id": "floor-cad", "level": "floor", "parent": "bldg-cad", "name": "Basement"},
        {"id": "sys-cad", "level": "system", "parent": "floor-cad", "name": "Distribution"},
    ]
    groups: list[str] = []
    for entry in _EQUIPMENT:
        if entry["group"] not in groups:
            groups.append(entry["group"])
    for group in groups:
        nodes.append({"id": f"sub-{group}", "level": "subsystem", "parent": "sys-cad",
                      "name": group.capitalize()})
    for entry in _EQUIPMENT:
        nodes.append({"id": entry["id"], "level": "equipment",
                      "parent": f"sub-{entry['group']}", "name": entry["name"]})
    return nodes


def cad_project(project_id: str = CAD_PROJECT_ID) -> dict[str, Any]:
    """The schema-4 CAD corpus."""
    equipment = []
    for entry in _EQUIPMENT:
        x, y, width, height = entry["box"]
        equipment.append({
            "id": entry["id"],
            "type": _PROFILE_BY_ID[entry["profile"]]["equipment_type"],
            "profile": entry["profile"],
            "layer": f"layer-{entry['group']}",
            "x": x, "y": y, "width": width, "height": height,
        })
    layers = []
    for entry in _EQUIPMENT:
        layer = {"id": f"layer-{entry['group']}", "name": entry["group"].capitalize()}
        if layer not in layers:
            layers.append(layer)
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 4,
        "contributions": [],
        "project": {"id": project_id, "name": "CAD corpus", "revision": 0},
        "title": "CAD corpus",
        "sites": [{"id": "site-cad", "name": "CAD reference site"}],
        "semantic_model": {"nodes": _semantic_nodes()},
        "profiles": [
            {**profile, "ports": [dict(port) for port in profile["ports"]]}
            for profile in _PROFILES
        ],
        "equipment": equipment,
        "layers": layers,
        "paths": paths(),
        "datapoints": [],
    }
