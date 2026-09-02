"""Versioned parametric equipment profiles.

A profile is authored once and instantiated many times. Two instantiations of
one version must therefore be identical, or "the same profile" means nothing.

An instance stores only the profile it came from, the version, and its own
overrides. Upgrading carries every override that still addresses something the
new version has and *reports* the ones it cannot: dropping an override silently
loses engineering work nobody is told about, and refusing the upgrade strands
the project on an old version forever.

A profile never names an effect. Phase 2 removed the caller-authored control
path, and a profile that could name a domain, a service or a target would put
it straight back - so a control here carries an id, a bounded input schema and
its gates, and the Companion still resolves the rest from the verified head.
"""
from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from typing import Any

#: Fields a profile control may never carry. Each is an effect the server
#: resolves from the verified project head.
FORBIDDEN_CONTROL_FIELDS = frozenset({
    "domain", "service", "entity_id", "device_id", "area_id", "target", "service_data",
    "context", "user_id",
})

#: Sections a profile may declare. The set is closed so a profile cannot grow a
#: field the contract has never seen.
PROFILE_SECTIONS = (
    "slots", "controls", "state_signals", "alarms", "ports",
    "diagnostics", "maintenance", "symbols",
)

MAX_SLOTS = 128
MAX_CONTROLS = 64


class ProfileRejected(Exception):
    """A profile or an instantiation was refused before anything was stored."""

    def __init__(self, code: str, detail: Mapping[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = dict(detail or {})


def _semantic_version(value: Any) -> bool:
    parts = str(value or "").split(".")
    return len(parts) == 3 and all(part.isdigit() for part in parts)


def validate_profile(profile: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Return every problem with a profile, empty when it is acceptable."""
    errors: list[dict[str, Any]] = []
    if not isinstance(profile, Mapping):
        return [{"code": "profile_not_an_object", "path": "/"}]
    if not profile.get("id"):
        errors.append({"code": "profile_id_missing", "path": "/id"})
    if not _semantic_version(profile.get("version")):
        errors.append({"code": "profile_version_invalid", "path": "/version",
                       "detail": {"version": profile.get("version")}})

    slots = profile.get("slots")
    if not isinstance(slots, list):
        errors.append({"code": "profile_slots_missing", "path": "/slots"})
    elif len(slots) > MAX_SLOTS:
        errors.append({"code": "profile_slots_exceeded", "path": "/slots"})

    controls = profile.get("controls") or []
    if not isinstance(controls, list):
        errors.append({"code": "profile_controls_invalid", "path": "/controls"})
    else:
        if len(controls) > MAX_CONTROLS:
            errors.append({"code": "profile_controls_exceeded", "path": "/controls"})
        for index, control in enumerate(controls):
            path = f"/controls/{index}"
            if not isinstance(control, Mapping):
                errors.append({"code": "profile_control_invalid", "path": path})
                continue
            if not control.get("id"):
                errors.append({"code": "profile_control_id_missing", "path": f"{path}/id"})
            named = FORBIDDEN_CONTROL_FIELDS & set(control)
            if named:
                # This is the Phase-2 boundary restated: a profile names a
                # control, never the effect that control produces.
                errors.append({
                    "code": "profile_control_names_an_effect",
                    "path": path,
                    "detail": {"fields": sorted(named)},
                })
    return errors


def _slot_ids(profile: Mapping[str, Any]) -> set[str]:
    slots = profile.get("slots")
    if not isinstance(slots, list):
        return set()
    return {str(slot.get("id")) for slot in slots if isinstance(slot, Mapping) and slot.get("id")}


def instantiate_profile(
    profile: Mapping[str, Any], *, overrides: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    """Create one instance of a profile version.

    The result is a pure function of the profile and the overrides, so two calls
    with the same inputs produce byte-identical instances.
    """
    errors = validate_profile(profile)
    if errors:
        raise ProfileRejected("profile_invalid", {"errors": errors})

    declared = _slot_ids(profile)
    slot_overrides = (overrides or {}).get("slots") or {}
    unknown = sorted(set(slot_overrides) - declared)
    if unknown:
        raise ProfileRejected("override_addresses_unknown_slot", {"slots": unknown})

    return {
        "profile": str(profile["id"]),
        "profile_version": str(profile["version"]),
        "overrides": deepcopy(dict(overrides or {})),
    }


def upgrade_instance(
    instance: Mapping[str, Any],
    current: Mapping[str, Any],
    target: Mapping[str, Any],
) -> dict[str, Any]:
    """Move an instance to a newer profile version, carrying what still applies.

    Returns the upgraded instance together with what was carried and what could
    not be. The report is the point: an upgrade that quietly loses an override
    is indistinguishable from one that worked.
    """
    errors = validate_profile(target)
    if errors:
        raise ProfileRejected("profile_invalid", {"errors": errors})

    declared = _slot_ids(target)
    overrides = dict(instance.get("overrides") or {})
    slot_overrides = dict(overrides.get("slots") or {})

    carried_slots: dict[str, Any] = {}
    cannot_carry: list[dict[str, Any]] = []
    for slot_id, value in slot_overrides.items():
        if slot_id in declared:
            carried_slots[slot_id] = deepcopy(value)
        else:
            cannot_carry.append({
                "path": f"/overrides/slots/{slot_id}",
                "reason": "slot_absent_in_target_version",
                "value": deepcopy(value),
            })

    carried = {key: deepcopy(value) for key, value in overrides.items() if key != "slots"}
    if carried_slots or "slots" in overrides:
        carried["slots"] = carried_slots

    upgraded = {
        "profile": str(target["id"]),
        "profile_version": str(target["version"]),
        "overrides": carried,
    }
    void = current  # the current version is accepted for symmetry and auditing
    del void
    return {
        "instance": upgraded,
        "carried": carried,
        "cannot_carry": cannot_carry,
        "from_version": str(instance.get("profile_version") or ""),
        "to_version": str(target["version"]),
    }


def equipment_profiles(hass: Any) -> Any:
    """Return the loaded runtime, or None. Profiles are pure data operations."""
    from . import _runtime_for  # local import avoids a module import cycle

    return _runtime_for(hass)
