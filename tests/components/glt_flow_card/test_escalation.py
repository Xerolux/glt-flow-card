"""Escalation reaches only configured targets, and never twice (T6-10).

The philosophy is configuration with conservative defaults, decided with the
user on 2026-09-02. An unconfigured installation escalates to **nobody**: an
escalation nobody asked for is a page at 3am nobody asked for.

Deduplication must survive a restart, or the Phase-6 restart safety stops at the
alarm and leaves the pager.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.alarm_vocabulary import (
    ALARM_PRIORITIES,
    ESCALATION_STAGE_KINDS,
)

from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = "EXPECTED_RED[phase6-escalation]: configured escalation stages are unavailable"
EFFECT_PREFIX = "PHASE6_NOTIFY_LEDGER "


def escalation_gaps() -> list[str]:
    """Return every escalation behaviour the Companion does not yet have."""
    gaps: list[str] = []

    try:
        from custom_components.glt_flow_card import notifications
    except ImportError:
        return ["there is no notifications module, so there are no escalation stages"]

    stages_for = getattr(notifications, "stages_for", None)
    if stages_for is None:
        gaps.append("notifications has no stages_for(); there is no escalation at all")
        return gaps

    # The conservative default: nothing configured escalates to nobody.
    if stages_for({"priority": "critical"}, policy={}):
        gaps.append("an unconfigured installation must escalate to nobody")

    policy = {
        "escalation": [
            {"kind": "immediate", "service": "persistent_notification.create",
             "priorities": ["critical"]},
            {"kind": "delayed", "after_seconds": 900,
             "service": "persistent_notification.create", "priorities": ["critical"]},
        ]
    }
    stages = stages_for({"priority": "critical"}, policy=policy) or []
    if len(stages) != 2:
        gaps.append(f"both configured stages must apply to a critical alarm, got {len(stages)}")
    if any(stage.get("kind") not in ESCALATION_STAGE_KINDS for stage in stages):
        gaps.append("a stage kind is outside the declared set")
    if [s.get("after_seconds", 0) for s in stages] != sorted(
        s.get("after_seconds", 0) for s in stages
    ):
        gaps.append("stages must be returned in the order they fire")

    # A stage that names other priorities must not fire for this alarm.
    if stages_for({"priority": "info"}, policy=policy):
        gaps.append("a stage configured for critical must not fire for an info alarm")
    if not all(p in ALARM_PRIORITIES for p in ("critical", "info")):
        gaps.append("the test's priorities are not the declared ones")

    key = getattr(notifications, "escalation_key", None)
    if key is None:
        gaps.append(
            "notifications has no escalation_key(); a restart must not re-fire a "
            "stage that already fired"
        )
    else:
        first = key(project_id="p", alarm_id="a", anchor="2026-09-02T12:00:00Z", stage=0)
        again = key(project_id="p", alarm_id="a", anchor="2026-09-02T12:00:00Z", stage=0)
        later = key(project_id="p", alarm_id="a", anchor="2026-09-02T13:00:00Z", stage=0)
        if first != again:
            gaps.append("the escalation key must be stable across a restart")
        if first == later:
            gaps.append("a new activation must produce a new escalation key")

    return gaps


async def test_expected_red_phase6_escalation(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    notification_ledger: Any,
) -> None:
    """Stages fire in order, for their priorities, once across a restart."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, **notification_ledger.evidence())

    report(RED_MARKER, escalation_gaps(), "configured escalation stages are unavailable")


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------

POLICY = {
    "escalation": [
        {"kind": "delayed", "after_seconds": 900,
         "service": "persistent_notification.create", "priorities": ["critical"]},
        {"kind": "immediate", "after_seconds": 0,
         "service": "persistent_notification.create", "priorities": ["critical"]},
    ]
}


def test_an_unconfigured_installation_escalates_to_nobody() -> None:
    """An escalation nobody asked for is a page at 3am nobody asked for."""
    from custom_components.glt_flow_card import notifications

    assert notifications.stages_for({"priority": "critical"}, policy={}) == []
    assert notifications.stages_for({"priority": "critical"}, policy=None) == []
    assert notifications.stages_for({"priority": "critical"},
                                    policy={"escalation": []}) == []


def test_stages_are_returned_in_the_order_they_fire() -> None:
    """The policy above declares them out of order on purpose."""
    from custom_components.glt_flow_card import notifications

    stages = notifications.stages_for({"priority": "critical"}, policy=POLICY)
    assert [stage["after_seconds"] for stage in stages] == [0, 900]


def test_a_stage_fires_only_for_the_priorities_it_names() -> None:
    from custom_components.glt_flow_card import notifications

    assert len(notifications.stages_for({"priority": "critical"}, policy=POLICY)) == 2
    assert notifications.stages_for({"priority": "info"}, policy=POLICY) == []


def test_a_stage_naming_no_priorities_applies_to_all() -> None:
    """Omitting the field is not the same as naming an empty set."""
    from custom_components.glt_flow_card import notifications

    policy = {"escalation": [{"kind": "immediate", "service": "persistent_notification.create"}]}
    for priority in ALARM_PRIORITIES:
        assert len(notifications.stages_for({"priority": priority}, policy=policy)) == 1
    empty = {"escalation": [{"kind": "immediate", "priorities": []}]}
    assert notifications.stages_for({"priority": "critical"}, policy=empty) == []


def test_a_legacy_severity_still_selects_the_right_stages() -> None:
    """`fault` migrates to `critical`, so a stored alarm keeps its escalation."""
    from custom_components.glt_flow_card import notifications

    assert len(notifications.stages_for({"severity": "fault"}, policy=POLICY)) == 2


def test_an_undeclared_stage_kind_or_priority_raises() -> None:
    from custom_components.glt_flow_card import notifications

    with pytest.raises(ValueError, match="unknown escalation stage kind"):
        notifications.stages_for({"priority": "critical"},
                                 policy={"escalation": [{"kind": "shout"}]})
    with pytest.raises(ValueError, match="unknown alarm priority in stage"):
        notifications.stages_for(
            {"priority": "critical"},
            policy={"escalation": [{"kind": "immediate", "priorities": ["urgent"]}]},
        )


def test_the_escalation_key_survives_a_restart_and_changes_on_reactivation() -> None:
    """Without the anchor a restart re-fires every stage; without stability it
    re-fires them on every reload."""
    from custom_components.glt_flow_card import notifications

    first = notifications.escalation_key(
        project_id="p", alarm_id="a", anchor="2026-09-02T12:00:00Z", stage=0)
    again = notifications.escalation_key(
        project_id="p", alarm_id="a", anchor="2026-09-02T12:00:00Z", stage=0)
    later = notifications.escalation_key(
        project_id="p", alarm_id="a", anchor="2026-09-02T13:00:00Z", stage=0)
    second_stage = notifications.escalation_key(
        project_id="p", alarm_id="a", anchor="2026-09-02T12:00:00Z", stage=1)
    assert first == again
    assert first != later
    assert first != second_stage


def test_every_stage_kind_in_the_closed_set_is_usable() -> None:
    """A declared kind nothing accepts is a vocabulary entry that lies."""
    from custom_components.glt_flow_card import notifications

    for kind in ESCALATION_STAGE_KINDS:
        policy = {"escalation": [{"kind": kind, "service": "persistent_notification.create"}]}
        assert len(notifications.stages_for({"priority": "critical"}, policy=policy)) == 1
