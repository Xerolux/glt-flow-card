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
    pytest.mark.expected_red,
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
