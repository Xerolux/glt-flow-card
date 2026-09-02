"""The Phase-4 operations corpus.

A panel test proves nothing about enumeration unless the corpus actually
contains something the caller may not see. This factory builds one schema-3
project where the seven Phase-2 principals each end up with a materially
different authorized subtree, including the three cases the threat register
names:

* an object an engineer may open and an operator may not (T4-01, T4-02),
* an object no non-admin may open at all (T4-03),
* a subsystem whose *only* alarm-bearing child is unauthorized, so a naive
  roll-up would announce an alarm in a subtree the caller cannot enter (T4-04).

The bodies are built here rather than committed expanded, per the Phase-1
decision to commit a compact corpus rather than generated fixture text. The one
committed JSON file is the browser's copy of the same project.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

#: Restricted objects, and the capability level that may open each.
#: "engineer" means viewer/operator are excluded; "none" means nobody but a
#: project admin acting through an explicit assignment.
RESTRICTED = {
    "eq-hp-secondary": "engineer",
    "eq-boiler-backup": "none",
}

#: The subsystem whose only alarm-bearing child is restricted. A count taken
#: over the whole subtree would leak that an alarm exists inside it.
COUNT_ORACLE_SUBSYSTEM = "sub-backup"


def _semantic_nodes() -> list[dict[str, Any]]:
    nodes = [
        {"id": "site-north", "level": "site", "parent": None, "name": "North Plant"},
        {"id": "site-south", "level": "site", "parent": None, "name": "South Plant"},
        {"id": "bldg-north-1", "level": "building", "parent": "site-north", "name": "Hall 1"},
        {"id": "floor-north-1", "level": "floor", "parent": "bldg-north-1", "name": "Level 0"},
        {"id": "sys-heat", "level": "system", "parent": "floor-north-1", "name": "Heating"},
        {"id": "sub-primary", "level": "subsystem", "parent": "sys-heat", "name": "Primary"},
        {"id": COUNT_ORACLE_SUBSYSTEM, "level": "subsystem", "parent": "sys-heat",
         "name": "Backup"},
        {"id": "eq-hp-primary", "level": "equipment", "parent": "sub-primary",
         "name": "Heat pump 1"},
        {"id": "eq-hp-secondary", "level": "equipment", "parent": "sub-primary",
         "name": "Heat pump 2"},
        {"id": "eq-boiler-backup", "level": "equipment", "parent": COUNT_ORACLE_SUBSYSTEM,
         "name": "Backup boiler"},
    ]
    # Datapoints, including the hours and starts OPS-02 asks the panel to show.
    # They are ordinary profile-declared entity values, so they need no Recorder
    # read and stay inside Phase 4's boundary.
    for equipment, prefix in (
        ("eq-hp-primary", "hp1"),
        ("eq-hp-secondary", "hp2"),
        ("eq-boiler-backup", "boiler"),
    ):
        nodes.extend([
            {"id": f"dp-{prefix}-flow", "level": "datapoint", "parent": equipment,
             "name": "Flow temperature", "unit": "degC", "medium": "heating_flow",
             "direction": "input", "semantic_tags": ["measurement"],
             "entity_id": f"sensor.{prefix}_flow_temperature", "freshness_seconds": 120},
            {"id": f"dp-{prefix}-hours", "level": "datapoint", "parent": equipment,
             "name": "Operating hours", "unit": "h", "direction": "input",
             "semantic_tags": ["measurement"],
             "entity_id": f"sensor.{prefix}_operating_hours", "freshness_seconds": 3600},
            {"id": f"dp-{prefix}-starts", "level": "datapoint", "parent": equipment,
             "name": "Starts", "unit": "count", "direction": "input",
             "semantic_tags": ["measurement"],
             "entity_id": f"sensor.{prefix}_starts", "freshness_seconds": 3600},
        ])
    return nodes


def _profiles() -> list[dict[str, Any]]:
    return [
        {
            "id": "profile-heat-pump",
            "equipment_type": "heat_pump",
            "version": "2.0.0",
            "slots": [
                {"id": "flow_temperature", "unit": "degC", "required": True},
                {"id": "operating_hours", "unit": "h", "required": False},
                {"id": "starts", "unit": "count", "required": False},
            ],
            # Deny-default: schema 3 gives a profile control only id, label,
            # input_schema and gates, with unevaluatedProperties false, so it
            # cannot name a domain, service or target even by accident. Phase 2
            # resolves the dispatch target from the verified head.
            "controls": [
                {"id": "set_flow_setpoint",
                 "label": {"de": "Vorlauf-Sollwert", "en": "Flow setpoint"},
                 "input_schema": {"type": "number", "minimum": 20, "maximum": 70}},
                {"id": "enable", "label": {"de": "Freigabe", "en": "Enable"}},
            ],
        },
        {
            "id": "profile-boiler",
            "equipment_type": "boiler",
            "version": "1.0.0",
            "slots": [{"id": "flow_temperature", "unit": "degC", "required": True}],
            "controls": [{"id": "enable", "label": {"de": "Freigabe", "en": "Enable"}}],
        },
    ]


def _equipment() -> list[dict[str, Any]]:
    return [
        {"id": "eq-hp-primary", "type": "heat_pump", "profile": "profile-heat-pump",
         "entity_id": "sensor.hp1_flow_temperature"},
        {"id": "eq-hp-secondary", "type": "heat_pump", "profile": "profile-heat-pump",
         "entity_id": "sensor.hp2_flow_temperature"},
        {"id": "eq-boiler-backup", "type": "boiler", "profile": "profile-boiler",
         "entity_id": "sensor.boiler_flow_temperature"},
    ]


def _alarms() -> list[dict[str, Any]]:
    return [
        # The primary subsystem's alarm is visible to everyone who may open it.
        {"id": "alm-hp1-lowflow", "equipment_id": "eq-hp-primary",
         "severity": "warning", "state": "active", "label": "Low flow"},
        # The only alarm under the backup subsystem hangs off the object nobody
        # may open. A roll-up that counts it leaks the subtree's contents.
        {"id": "alm-boiler-fault", "equipment_id": "eq-boiler-backup",
         "severity": "fault", "state": "active", "label": "Burner fault"},
    ]


def operations_project() -> dict[str, Any]:
    """One schema-3 project with every enumeration case the phase must close."""
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 3,
        "project": {"id": "operations-corpus", "name": "Operations corpus", "revision": 1},
        "title": "Operations corpus",
        "sites": [
            {"id": "site-north", "name": "North Plant"},
            {"id": "site-south", "name": "South Plant"},
        ],
        "semantic_model": {"nodes": _semantic_nodes()},
        "profiles": _profiles(),
        "equipment": _equipment(),
        "alarms": _alarms(),
        "datapoints": [],
    }


def visible_equipment(role: str, *, assigned: bool = True) -> set[str]:
    """The equipment ids a principal in `role` may open.

    This mirrors what the server must decide; the tests assert the server agrees
    rather than trusting this helper. An unassigned principal sees nothing at
    all, which is the Phase-2 rule that a Home Assistant administrator without a
    project assignment still reads no project.
    """
    if not assigned:
        return set()
    every = {item["id"] for item in _equipment()}
    if role in ("admin", "engineer"):
        return every - {"eq-boiler-backup"}
    if role in ("operator", "viewer"):
        return every - set(RESTRICTED)
    return set()


def project_without(equipment_ids: set[str]) -> dict[str, Any]:
    """The corpus with some equipment removed, for hidden-vs-missing checks."""
    project = deepcopy(operations_project())
    project["equipment"] = [
        item for item in project["equipment"] if item["id"] not in equipment_ids
    ]
    keep = {node["id"] for node in project["semantic_model"]["nodes"]} - equipment_ids
    project["semantic_model"]["nodes"] = [
        node for node in project["semantic_model"]["nodes"]
        if node["id"] in keep and node.get("parent") not in equipment_ids
    ]
    project["alarms"] = [
        alarm for alarm in project["alarms"]
        if alarm["equipment_id"] not in equipment_ids
    ]
    return project
