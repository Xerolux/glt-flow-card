"""Versioned parametric equipment profiles (T3-07, T3-08).

A profile is authored once and instantiated many times, so two instantiations of
one version must be identical or "the same profile" means nothing. An upgrade
must carry an engineer's overrides forward, and where it cannot, say so: a
silently dropped override is lost engineering work that nobody is told about.

A profile also must not become a second way to name an effect. Phase 2 removed
the caller-authored control path; a profile that could name a domain, a service
or a target would put it straight back.
"""
from __future__ import annotations

import json
from typing import Any

import pytest

RED_MARKER = (
    "EXPECTED_RED[phase3-profiles]: "
    "versioned override-preserving profiles are unavailable"
)
EFFECT_PREFIX = "PHASE3_PROFILE_EFFECTS "

#: Everything a profile must be able to declare.
PROFILE_SECTIONS = (
    "slots", "controls", "state_signals", "alarms", "ports",
    "diagnostics", "maintenance", "symbols",
)

#: Fields a profile control may never carry. Each one is an effect the server
#: resolves from the verified head.
FORBIDDEN_CONTROL_FIELDS = (
    "domain", "service", "entity_id", "device_id", "area_id", "target", "service_data",
)


def load(name: str) -> Any:
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps({"service_attempts": 0, **extra}, sort_keys=True))


def _profile(version: str = "1.0.0", **overrides: Any) -> dict[str, Any]:
    profile = {
        "id": "heat-pump",
        "version": version,
        "equipment_type": "heat_pump",
        "slots": [
            {"id": "flow_temperature", "unit": "degC", "direction": "input"},
            {"id": "return_temperature", "unit": "degC", "direction": "input"},
        ],
        "controls": [{"id": "set_mode", "input_schema": {"properties": {"mode": {"type": "string"}}}}],
        "state_signals": [{"id": "running", "from": "compressor"}],
        "alarms": [{"id": "high_flow", "severity": "warning"}],
        "ports": [{"id": "flow_out", "medium": "heating_flow", "direction": "output"}],
        "diagnostics": [{"id": "hours", "unit": "h"}],
        "maintenance": {"interval_hours": 8760},
        "symbols": ["heat-pump"],
    }
    profile.update(overrides)
    return profile


def test_the_forbidden_control_fields_are_the_effect_fields() -> None:
    """The list is the Phase-2 boundary restated, not a new invention."""
    assert "domain" in FORBIDDEN_CONTROL_FIELDS
    assert "service" in FORBIDDEN_CONTROL_FIELDS
    assert "target" in FORBIDDEN_CONTROL_FIELDS


def test_a_profile_declares_every_section_the_requirement_names() -> None:
    """The fixture is only meaningful if it exercises the whole shape."""
    profile = _profile()
    for section in PROFILE_SECTIONS:
        assert section in profile, section


def profile_gaps() -> list[str]:
    """Return every unmet profile guarantee."""
    module = load("equipment_profiles")
    if module is None:
        return [
            "custom_components.glt_flow_card.equipment_profiles does not exist, so "
            "a profile cannot be versioned or instantiated"
        ]

    gaps: list[str] = []
    for name in ("instantiate_profile", "upgrade_instance", "validate_profile", "ProfileRejected"):
        if not hasattr(module, name):
            gaps.append(f"equipment_profiles.{name} is missing")
    if gaps:
        return gaps

    profile = _profile()
    if module.validate_profile(profile):
        gaps.append(f"a complete profile was rejected: {module.validate_profile(profile)}")

    # A profile that names an effect is the caller-authored control path.
    for forbidden in FORBIDDEN_CONTROL_FIELDS:
        hostile = _profile()
        hostile["controls"] = [{"id": "start", forbidden: "switch"}]
        if not module.validate_profile(hostile):
            gaps.append(f"a profile control carrying {forbidden} was accepted")

    # Two instantiations of one version are the same thing or the word "version"
    # is decorative.
    overrides = {"slots": {"flow_temperature": {"entity_id": "sensor.flow"}}}
    first = module.instantiate_profile(profile, overrides=overrides)
    second = module.instantiate_profile(profile, overrides=overrides)
    if json.dumps(first, sort_keys=True) != json.dumps(second, sort_keys=True):
        gaps.append("two instantiations of one profile version differ")
    if first.get("profile") != "heat-pump" or first.get("profile_version") != "1.0.0":
        gaps.append("an instance does not record the profile and version it came from")

    # An upgrade carries what it can and reports what it cannot.
    newer = _profile(version="2.0.0")
    newer["slots"] = [
        {"id": "flow_temperature", "unit": "degC", "direction": "input"},
        {"id": "supply_pressure", "unit": "bar", "direction": "input"},
    ]
    instance = module.instantiate_profile(profile, overrides={
        "slots": {
            "flow_temperature": {"entity_id": "sensor.flow"},
            "return_temperature": {"entity_id": "sensor.return"},
        },
    })
    report = module.upgrade_instance(instance, profile, newer)
    carried = report.get("carried", {}).get("slots", {})
    if "flow_temperature" not in carried:
        gaps.append("an override that still addresses a slot was not carried")
    if not any("return_temperature" in str(entry) for entry in report.get("cannot_carry", [])):
        gaps.append("an override addressing a removed slot was dropped without a report")
    if report.get("instance", {}).get("profile_version") != "2.0.0":
        gaps.append("the upgraded instance does not record the new version")

    # Upgrading twice to the same version changes nothing further.
    again = module.upgrade_instance(report["instance"], newer, newer)
    if json.dumps(again["instance"], sort_keys=True) != json.dumps(report["instance"], sort_keys=True):
        gaps.append("upgrading to the version already held is not a no-op")
    return gaps


def test_expected_red_phase3_profiles() -> None:
    """Profiles are versioned, deterministic and never name an effect."""
    emit_effects(sections=len(PROFILE_SECTIONS))
    gaps = profile_gaps()
    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  profile gap: {gap}")
    assert not gaps, "versioned override-preserving profiles are unavailable"
