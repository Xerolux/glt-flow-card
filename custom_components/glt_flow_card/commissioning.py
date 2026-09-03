"""Is this installation ready? Answered from the registries, read-only.

Three defects shape this module, and the first two are about the answer being
*wrong* rather than missing.

**D8: it ran in the browser.** ``diagnoseConfig(config, hassStates)`` read the
state map the card was handed, so the provenance DIAG-01 requires -- which
integration, which device, which config entry -- was not merely missing but
unreachable from where the code ran. ``entity_registry`` and ``device_registry``
exist only in the Companion. This is the third phase to move a decision here
after alarms and trends, which suggests it is the product's architecture rather
than a per-phase preference.

**D9: it guessed what a reference was.** ``collect()`` treated *any string
containing a dot* as an entity id, so a version string, a filename and a decimal
written as text each became a "missing entity". An engineer who learns the
readiness view reports things that are not true stops reading it, and then
nothing else it reports matters. References here come from **declared**
locations only.

**D13: it collapsed four answers into one.** Registry membership and
state-machine membership are independent questions, and the four combinations
send an engineer to four different places. Reporting all of them as ``missing``
sends them to look for a typo when the real answer is that an integration failed
to set up.

Nothing in this module writes. That is asserted by execution in
``test_commissioning.py`` rather than claimed here, because "read-only by
construction" is a claim by inspection and inspection is what missed D8.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .dispatch_vocabulary import DIAGNOSES, INFORMATIONAL_DIAGNOSES

#: How many unused-entity suggestions an answer may carry.
#:
#: `unused` previously returned every entity in the installation the project did
#: not reference. On a real Home Assistant that is thousands of rows rendered
#: into a modal (D14). The bound is stated in the answer so a truncated list
#: cannot read as a complete one.
MAX_SUGGESTIONS = 50

#: How long a state may go unchanged before it is stale, by default.
DEFAULT_STALE_MINUTES = 10

#: Where a reference may be declared. Closed, and the whole point of D9's fix:
#: a reference the schema does not declare is not a reference, however much the
#: string looks like an entity id.
REFERENCE_SITES: tuple[str, ...] = (
    "equipment.bindings",
    "datapoints.entity",
    "alarms.entity",
    "controls.target",
    "energy.meters.entity",
    "kpis.entity",
    "maintenance_plans.hours_entity",
)


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def collect_references(config: Any) -> list[dict[str, Any]]:
    """Return every declared entity and service reference, with where it came from.

    Each reference carries its declaring site, so a finding can say "the pump's
    `flow` slot names this entity" rather than "an entity is missing". A finding
    without a location is one an engineer cannot act on.
    """
    config = config if isinstance(config, dict) else {}
    found: list[dict[str, Any]] = []

    def add(kind: str, value: Any, site: str, owner: str) -> None:
        text = _text(value)
        if not text or "." not in text:
            return
        found.append({"kind": kind, "owner": owner, "reference": text, "site": site})

    for item in config.get("equipment") or []:
        if not isinstance(item, dict):
            continue
        owner = _text(item.get("id")) or _text(item.get("name"))
        for slot, entity in (item.get("bindings") or {}).items():
            add("entity", entity, f"equipment.bindings.{slot}", owner)

    for item in config.get("datapoints") or []:
        if isinstance(item, dict):
            add("entity", item.get("entity"), "datapoints.entity", _text(item.get("id")))

    for item in config.get("alarms") or []:
        if isinstance(item, dict):
            add("entity", item.get("entity"), "alarms.entity", _text(item.get("id")))

    for item in config.get("kpis") or []:
        if isinstance(item, dict):
            add("entity", item.get("entity"), "kpis.entity", _text(item.get("id")))

    for item in (config.get("energy") or {}).get("meters") or []:
        if isinstance(item, dict):
            add("entity", item.get("entity"), "energy.meters.entity", _text(item.get("id")))

    for item in config.get("maintenance_plans") or []:
        if isinstance(item, dict):
            add("entity", item.get("hours_entity"), "maintenance_plans.hours_entity",
                _text(item.get("id")))

    # Services are references too (D12). A control naming a service that does
    # not exist is otherwise discovered when an operator presses the button --
    # the same "fails at the call, not the request" shape Phase 4 closed for
    # controls and Phase 6 for calendar bindings.
    for item in config.get("controls") or []:
        if not isinstance(item, dict):
            continue
        domain = _text(item.get("domain"))
        service = _text(item.get("service"))
        if domain and service:
            found.append({
                "kind": "service",
                "owner": _text(item.get("id")),
                "reference": f"{domain}.{service}",
                "site": "controls.target",
            })
        for entity in (item.get("target") or {}).get("entity_id") or []:
            add("entity", entity, "controls.target", _text(item.get("id")))

    return sorted(found, key=lambda entry: (entry["reference"], entry["site"], entry["owner"]))


def diagnose_entity(
    reference: str,
    *,
    registry_entry: Any = None,
    state: Any = None,
    expectation: dict[str, Any] | None = None,
    now: datetime | None = None,
    stale_minutes: int = DEFAULT_STALE_MINUTES,
) -> dict[str, Any]:
    """Return one entity's diagnosis, with the evidence that produced it.

    The registry and the state machine are asked separately because they are
    separate questions, and the four combinations are four different problems.
    """
    in_registry = registry_entry is not None
    in_states = state is not None

    evidence: dict[str, Any] = {
        "in_registry": in_registry,
        "in_states": in_states,
        # Read from the registry, never inferred from the entity id. PROTO-01
        # forbids inferring a protocol from a name, and the same reasoning
        # applies to the integration that owns an entity.
        "platform": getattr(registry_entry, "platform", None),
        "config_entry_id": getattr(registry_entry, "config_entry_id", None),
        "device_id": getattr(registry_entry, "device_id", None),
    }

    if not in_registry and not in_states:
        return _finding(reference, "missing", "error", evidence,
                        "check the entity id for a typo, or create the entity")
    if in_registry and not in_states:
        # Not a typo. Disabled, or its integration failed to set up.
        return _finding(reference, "registered_not_loaded", "error", evidence,
                        "the entity is registered but not loaded: check whether it is disabled "
                        "or its integration failed to start")
    if not in_registry and in_states:
        # A template or YAML entity. A normal way to run Home Assistant, so it
        # is informational -- it states the absence of provenance, not a fault.
        return _finding(reference, "unregistered", "info", evidence,
                        "this entity has no registry entry, so no integration, device or "
                        "config-entry provenance can be reported for it")

    expected = expectation or {}
    actual_unit = getattr(registry_entry, "unit_of_measurement", None) or (
        (getattr(state, "attributes", None) or {}).get("unit_of_measurement")
    )
    actual_class = getattr(registry_entry, "original_device_class", None) or (
        (getattr(state, "attributes", None) or {}).get("device_class")
    )
    evidence["unit"] = actual_unit
    evidence["device_class"] = actual_class

    if expected.get("unit") and actual_unit and expected["unit"] != actual_unit:
        # Both sides named. A finding stating only one leaves the engineer to
        # guess which is wrong, which Phase 5 established is a tool disagreeing
        # with a human without saying why.
        return _finding(
            reference, "wrong_unit", "error",
            {**evidence, "expected_unit": expected["unit"]},
            f"the profile expects {expected['unit']} and the entity reports {actual_unit}",
        )
    if expected.get("device_class") and actual_class and expected["device_class"] != actual_class:
        return _finding(
            reference, "wrong_device_class", "error",
            {**evidence, "expected_device_class": expected["device_class"]},
            f"the profile expects {expected['device_class']} and the entity reports {actual_class}",
        )

    moment = now or datetime.now(timezone.utc)
    changed = getattr(state, "last_updated", None) or getattr(state, "last_changed", None)
    if isinstance(changed, datetime):
        age_minutes = (moment - changed).total_seconds() / 60
        if age_minutes > stale_minutes:
            # Computed here, in the Companion, with an age. D17: the browser
            # built ages from `Date.now()`, so a client with a wrong clock
            # reported plausible wrong ages and the answer was not reproducible.
            return _finding(
                reference, "stale", "warning",
                {**evidence, "age_minutes": round(age_minutes, 1)},
                f"no update for {round(age_minutes)} minutes",
            )

    return _finding(reference, "present", "info", evidence, None)


def _finding(
    reference: str, code: str, severity: str, evidence: dict[str, Any], remediation: str | None,
) -> dict[str, Any]:
    assert code in DIAGNOSES, f"undeclared diagnosis: {code}"
    return {
        "code": code,
        "evidence": evidence,
        "reference": reference,
        # A link, never an action. Nothing on this surface writes.
        "remediation": remediation,
        "severity": severity,
    }


def find_duplicate_bindings(references: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return one finding per entity bound to more than one slot.

    Two slots reading one entity is occasionally deliberate and usually a
    copy-paste error, so it is a warning that names **both** slots rather than
    an error that names neither.
    """
    seen: dict[str, list[dict[str, Any]]] = {}
    for entry in references:
        if entry["kind"] != "entity":
            continue
        seen.setdefault(entry["reference"], []).append(entry)

    duplicates = []
    for reference, entries in sorted(seen.items()):
        if len(entries) < 2:
            continue
        duplicates.append(_finding(
            reference, "duplicate_binding", "warning",
            {"sites": [f"{entry['owner']}:{entry['site']}" for entry in entries]},
            "two or more slots read this entity; confirm that is intended",
        ))
    return duplicates


def summarise(findings: list[dict[str, Any]]) -> dict[str, Any]:
    """Return counts per diagnosis, and no invented aggregate.

    D13's score was ``100 - issues/refs*100``: it counted issues rather than
    entities, so two findings on one entity subtracted twice and thirty findings
    on ten entities gave a negative clamped to zero -- presented as a readiness
    percentage.

    Replacing it with a better-computed percentage would be the same defect with
    a nicer formula. The honest answer to "how ready is this?" is a list of what
    is wrong, so that is what this returns.
    """
    counts = {code: 0 for code in DIAGNOSES}
    affected: set[str] = set()
    for finding in findings:
        counts[finding["code"]] += 1
        if finding["code"] not in INFORMATIONAL_DIAGNOSES:
            affected.add(finding["reference"])
    return {
        "affected_references": len(affected),
        "counts": counts,
        "total_references": len({finding["reference"] for finding in findings}),
    }


def bounded_suggestions(unused: list[str]) -> dict[str, Any]:
    """Return a bounded list of unused entities, and say that it is bounded."""
    ordered = sorted(unused)
    return {
        "limit": MAX_SUGGESTIONS,
        "suggestions": ordered[:MAX_SUGGESTIONS],
        "total": len(ordered),
        "truncated": len(ordered) > MAX_SUGGESTIONS,
    }
