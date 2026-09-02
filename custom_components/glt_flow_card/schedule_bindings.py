"""Bind schedules to the Home Assistant capabilities that already exist.

Established against the vendored Home Assistant 2026.2.3 and recorded in
``06-RESEARCH.md``:

- ``schedule`` is storage-backed and authorable over the websocket API --
  ``schedule/list`` is open, and ``schedule/create``, ``schedule/update`` and
  ``schedule/delete`` are each wrapped in ``websocket_api.require_admin``. Its
  shape is an *interval* model, ``from``/``to`` per weekday.
- ``calendar.create_event`` is registered with
  ``required_features=[CalendarEntityFeature.CREATE_EVENT]``, and the websocket
  create/update/delete paths gate on the matching flags. A calendar that cannot
  be written to rejects the *call*, not the request.
- ``binary_sensor.workday`` already carries country, ``province``,
  ``add_holidays`` and ``remove_holidays``. German public holidays are
  per-Bundesland, and a table we shipped would be wrong for half the country.

Two rules follow, and both are the reason this module exists rather than a
handful of inline checks.

**Capability is read before an affordance is offered.** This is the defect shape
Phase 4 closed for controls: an affordance whose feasibility was never checked
fails at the service call, where the operator has already committed, instead of
at the request.

**The interval and instant models are never converted into each other.** An HA
schedule says the plant is in day mode *between these hours*; our runner says
call this service *at this minute*. Blurring them would let a binding silently
change what a schedule means.
"""
from __future__ import annotations

from typing import Any

from .alarm_vocabulary import SCHEDULE_BINDING_KINDS

#: `CalendarEntityFeature` (`homeassistant/components/calendar/const.py`).
#: Mirrored rather than imported so this module states the contract it checks
#: against, and a test asserts the two agree -- an import would make a silent
#: renumbering invisible.
CALENDAR_CREATE_EVENT = 1
CALENDAR_DELETE_EVENT = 2
CALENDAR_UPDATE_EVENT = 4

#: Which model each binding kind speaks. Load-bearing, and never converted.
BINDING_MODELS: dict[str, str] = {
    "operating_period": "interval",
    "holiday": "instant",
    "exception": "instant",
    "vacation": "instant",
    "special_day": "instant",
}

#: Why a binding cannot be written to. Closed, and each distinct from the others
#: because they need different answers from the operator.
BINDING_REFUSALS: tuple[str, ...] = (
    "calendar_cannot_create_events",
    "binding_is_read_only",
    "requires_home_assistant_admin",
    "binding_entity_missing",
    "unknown_binding_kind",
)

#: Entity domains each binding kind may bind to.
BINDING_DOMAINS: dict[str, tuple[str, ...]] = {
    "operating_period": ("schedule",),
    "holiday": ("calendar", "binary_sensor"),
    "exception": ("calendar",),
    "vacation": ("calendar",),
    "special_day": ("calendar",),
}


def model_of(kind: str) -> str:
    """Return `interval` or `instant` for one binding kind."""
    if kind not in SCHEDULE_BINDING_KINDS:
        raise ValueError(f"unknown binding kind: {kind!r}")
    return BINDING_MODELS[kind]


def _domain(entity_id: Any) -> str:
    text = str(entity_id or "")
    return text.split(".", 1)[0] if "." in text else ""


def describe(binding: dict[str, Any]) -> dict[str, Any]:
    """Return what this binding can and cannot do, and why.

    Every answer carries a reason from the closed set. A bare `writable: False`
    tells an engineer the tool disagrees with them; a reason tells them which of
    the two is wrong -- the same asymmetry Phase 5 established for port refusals.
    """
    kind = binding.get("kind")
    if kind not in SCHEDULE_BINDING_KINDS:
        return {"writable": False, "reason": "unknown_binding_kind", "model": None}

    entity_id = binding.get("entity_id")
    domain = _domain(entity_id)
    if not entity_id or domain not in BINDING_DOMAINS[kind]:
        return {"writable": False, "reason": "binding_entity_missing", "model": model_of(kind)}

    features = int(binding.get("supported_features") or 0)
    result: dict[str, Any] = {
        "kind": kind,
        "entity_id": entity_id,
        "model": model_of(kind),
        "writable": False,
        "reason": None,
        "can_create": False,
        "can_update": False,
        "can_delete": False,
    }

    if domain == "calendar":
        result["can_create"] = bool(features & CALENDAR_CREATE_EVENT)
        result["can_update"] = bool(features & CALENDAR_UPDATE_EVENT)
        result["can_delete"] = bool(features & CALENDAR_DELETE_EVENT)
        result["writable"] = result["can_create"]
        if not result["writable"]:
            result["reason"] = "calendar_cannot_create_events"
        return result

    if domain == "binary_sensor":
        # `binary_sensor.workday` is a *signal*: it answers whether today is a
        # working day, in a country and province Home Assistant already knows.
        # It is never written to, and saying so is the honest affordance.
        result["reason"] = "binding_is_read_only"
        return result

    # `schedule.*`: writable, but only by a Home Assistant admin, because
    # `schedule/create` and friends are wrapped in `require_admin`.
    result["writable"] = True
    result["requires_admin"] = True
    return result


def refuse_for_non_admin(binding: dict[str, Any]) -> str | None:
    """Return a refusal for a non-admin authoring attempt, or None.

    Reported *before* the websocket call rather than after. A card "engineer" is
    not necessarily a Home Assistant admin, and an authoring path that fails
    opaquely at the call leaves the operator with an error and no explanation.

    Distinct from the capability refusal on purpose: "this calendar cannot be
    written to" and "you may not write to it" need different answers from the
    person reading them.
    """
    if not binding.get("requires_admin"):
        return None
    return "requires_home_assistant_admin"


def bindable_entities(hass: Any, kind: str) -> list[dict[str, Any]]:
    """Return the entities a binding of this kind could use, described.

    Read from the live state machine, so the affordance offered matches what the
    installation actually has rather than what a project document remembers.
    """
    if kind not in SCHEDULE_BINDING_KINDS:
        raise ValueError(f"unknown binding kind: {kind!r}")
    found: list[dict[str, Any]] = []
    for state in getattr(hass, "states", None).async_all() if hass else []:
        entity_id = getattr(state, "entity_id", "")
        if _domain(entity_id) not in BINDING_DOMAINS[kind]:
            continue
        attributes = dict(getattr(state, "attributes", None) or {})
        found.append(describe({
            "kind": kind,
            "entity_id": entity_id,
            "supported_features": attributes.get("supported_features", 0),
        }))
    return sorted(found, key=lambda entry: str(entry.get("entity_id")))
