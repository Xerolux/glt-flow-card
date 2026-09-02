"""The Phase-4 operations corpus.

A panel test proves nothing about enumeration unless the corpus actually
contains something the caller may not see. The first draft of this factory got
the boundary wrong: it hid individual pieces of equipment inside one project, as
though authorization were per-object. It is not. Phase 2's ACL assigns one fixed
role per ``(project, user)`` -- ``async_assign(project_id, user_id, role)`` has
no object granularity -- so within a project, membership is uniform. Inventing
per-object ACLs here would duplicate an authority Phase 2 owns.

The real boundary is the project, and the portfolio spans projects. So the
corpus is two projects:

* ``operations-corpus`` -- every principal below is a member.
* ``restricted-corpus`` -- only the engineer and the admin are members.

That gives the enumeration threats something true to bite on:

* a principal reading a project it is not a member of (T4-02, T4-03),
* a portfolio roll-up that must not count alarms living in a project the caller
  cannot open (T4-04) -- the restricted project holds the only fault in the
  corpus,
* and within an authorized project, roles differing by *capability* rather than
  by visibility: an operator holds ``control.execute`` and a viewer does not,
  so the same panel offers controls to one and none to the other (T4-01).

Bodies are built here rather than committed expanded, per the Phase-1 decision
to commit a compact corpus. The one committed JSON file is the browser's copy of
the authorized project.
"""
from __future__ import annotations

from typing import Any

#: The project every corpus principal may open.
OPEN_PROJECT_ID = "operations-corpus"

#: The project only the engineer and admin may open. Its contents -- objects,
#: alarms, addresses and counts -- must be invisible to everyone else, and
#: indistinguishable from a project that does not exist.
RESTRICTED_PROJECT_ID = "restricted-corpus"

#: The equipment that lives only in the restricted project.
RESTRICTED_EQUIPMENT = ("eq-boiler-backup",)

#: The subsystem in the restricted project whose child carries the corpus's only
#: fault. A portfolio roll-up that counts it announces an alarm in a project the
#: caller cannot enter.
COUNT_ORACLE_SUBSYSTEM = "sub-backup"

#: Principals holding ``control.execute`` on the open project. A viewer does
#: not, so its panel must carry no controls at all.
CONTROL_CAPABLE_ROLES = ("operator", "engineer", "admin")


def _datapoints_for(equipment: str, prefix: str) -> list[dict[str, Any]]:
    """Flow plus the hours and starts OPS-02 asks the panel to show.

    Hours and starts are ordinary profile-declared entity values, which is why
    Phase 4 can show them without a Recorder read.
    """
    return [
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
    ]


def _heat_pump_profile() -> dict[str, Any]:
    return {
        "id": "profile-heat-pump",
        "equipment_type": "heat_pump",
        "version": "2.0.0",
        "slots": [
            {"id": "flow_temperature", "unit": "degC", "required": True},
            {"id": "operating_hours", "unit": "h", "required": False},
            {"id": "starts", "unit": "count", "required": False},
        ],
        # Deny-default: schema 3 gives a profile control only id, label,
        # input_schema and gates, with unevaluatedProperties false, so it cannot
        # name a domain, service or target even by accident. Phase 2 resolves
        # the dispatch target from the verified head.
        "controls": [
            {"id": "set_flow_setpoint",
             "label": {"de": "Vorlauf-Sollwert", "en": "Flow setpoint"},
             "input_schema": {"type": "number", "minimum": 20, "maximum": 70}},
            {"id": "enable", "label": {"de": "Freigabe", "en": "Enable"}},
        ],
    }


def _boiler_profile() -> dict[str, Any]:
    return {
        "id": "profile-boiler",
        "equipment_type": "boiler",
        "version": "1.0.0",
        "slots": [{"id": "flow_temperature", "unit": "degC", "required": True}],
        "controls": [{"id": "enable", "label": {"de": "Freigabe", "en": "Enable"}}],
    }


def operations_project(project_id: str = OPEN_PROJECT_ID) -> dict[str, Any]:
    """The project every corpus principal may open."""
    nodes = [
        {"id": "site-north", "level": "site", "parent": None, "name": "North Plant"},
        {"id": "bldg-north-1", "level": "building", "parent": "site-north", "name": "Hall 1"},
        {"id": "floor-north-1", "level": "floor", "parent": "bldg-north-1", "name": "Level 0"},
        {"id": "sys-heat", "level": "system", "parent": "floor-north-1", "name": "Heating"},
        {"id": "sub-primary", "level": "subsystem", "parent": "sys-heat", "name": "Primary"},
        {"id": "eq-hp-primary", "level": "equipment", "parent": "sub-primary",
         "name": "Heat pump 1"},
        {"id": "eq-hp-secondary", "level": "equipment", "parent": "sub-primary",
         "name": "Heat pump 2"},
    ]
    nodes.extend(_datapoints_for("eq-hp-primary", "hp1"))
    nodes.extend(_datapoints_for("eq-hp-secondary", "hp2"))
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 3,
        "project": {"id": project_id, "name": "Operations corpus", "revision": 0},
        "title": "Operations corpus",
        "sites": [{"id": "site-north", "name": "North Plant"}],
        "semantic_model": {"nodes": nodes},
        "profiles": [_heat_pump_profile()],
        "equipment": [
            {"id": "eq-hp-primary", "type": "heat_pump", "profile": "profile-heat-pump",
             "entity_id": "sensor.hp1_flow_temperature"},
            {"id": "eq-hp-secondary", "type": "heat_pump", "profile": "profile-heat-pump",
             "entity_id": "sensor.hp2_flow_temperature"},
        ],
        "alarms": [
            {"id": "alm-hp1-lowflow", "equipment_id": "eq-hp-primary",
             "severity": "warning", "state": "active", "label": "Low flow"},
        ],
        "datapoints": [],
    }


def restricted_project(project_id: str = RESTRICTED_PROJECT_ID) -> dict[str, Any]:
    """The project only the engineer and admin may open.

    It holds the corpus's only *fault*, so a portfolio roll-up that reaches
    across projects would announce it to principals who cannot open it.
    """
    nodes = [
        {"id": "site-south", "level": "site", "parent": None, "name": "South Plant"},
        {"id": "bldg-south-1", "level": "building", "parent": "site-south", "name": "Hall 2"},
        {"id": "floor-south-1", "level": "floor", "parent": "bldg-south-1", "name": "Level 0"},
        {"id": "sys-backup", "level": "system", "parent": "floor-south-1", "name": "Backup"},
        {"id": COUNT_ORACLE_SUBSYSTEM, "level": "subsystem", "parent": "sys-backup",
         "name": "Backup boiler group"},
        {"id": "eq-boiler-backup", "level": "equipment", "parent": COUNT_ORACLE_SUBSYSTEM,
         "name": "Backup boiler"},
    ]
    nodes.extend(_datapoints_for("eq-boiler-backup", "boiler"))
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 3,
        "project": {"id": project_id, "name": "Restricted corpus", "revision": 0},
        "title": "Restricted corpus",
        "sites": [{"id": "site-south", "name": "South Plant"}],
        "semantic_model": {"nodes": nodes},
        "profiles": [_boiler_profile()],
        "equipment": [
            {"id": "eq-boiler-backup", "type": "boiler", "profile": "profile-boiler",
             "entity_id": "sensor.boiler_flow_temperature"},
        ],
        "alarms": [
            {"id": "alm-boiler-fault", "equipment_id": "eq-boiler-backup",
             "severity": "fault", "state": "active", "label": "Burner fault"},
        ],
        "datapoints": [],
    }


def controls_expected(role: str) -> bool:
    """Whether a principal in `role` should be offered any control at all.

    Within an authorized project the difference between roles is capability,
    not visibility: everyone who may open the project sees the same objects,
    and only ``control.execute`` holders are offered a control.
    """
    return role in CONTROL_CAPABLE_ROLES
