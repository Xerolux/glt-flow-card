"""A site declares its own alarm priority scale, end to end (2026-09-03).

Phase 6 closed the alarm vocabulary because four components disagreed about
what a word meant, and recorded "a site cannot express four or five priority
classes" as a limitation needing a schema change.

It did not need one. The invariant the closed vocabulary established is
*exactly one declared vocabulary, read by both runtimes* -- it never required
exactly three members, and the phase conflated the two. `alarm_settings()` had
already described priorities as a site decision; the product just did not let a
site make it, so a plant with a separate safety-shutdown class above its faults
had to record two different things under one word.

These tests are end to end rather than unit, because the unit behaviour is
already covered in both runtimes by `test_alarm_vocabulary.py` and
`test/alarm-vocabulary.test.mjs`. What was missing is proof that a declared
scale actually reaches the roll-up an operator reads.
"""
from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card import alarm_vocabulary, navigation

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

FOUR_TIER = {
    "alarm_priorities": ["safety", "critical", "warning", "info"],
    "alarm_severity_mapping": {"shutdown": "safety", "trip": "safety"},
}


def project(alarms: list[dict]) -> dict:
    """One project whose alarms the *engine* considers active.

    `_counts_for` reads the engine's runtime state rather than a design-time
    `active` field -- that was Phase 6's D4, a badge showing a value nobody
    updated -- so the fixture has to supply it the way the manager does.
    """
    return {
        "id": "scale-plant",
        "config": {
            "alarms": alarms,
            "_alarm_runtime": {
                str(alarm["id"]): {"active": True} for alarm in alarms
            },
        },
    }


def test_a_four_tier_site_rolls_up_on_four_tiers() -> None:
    """The whole point: a class above `critical` is counted as its own class."""
    scale = alarm_vocabulary.resolve_priority_scale(FOUR_TIER)
    rolled = navigation.portfolio(
        [project([
            {"id": "a", "priority": "shutdown", "active": True},
            {"id": "b", "priority": "fault", "active": True},
            {"id": "c", "priority": "warning", "active": True},
        ])],
        scale,
    )
    assert rolled["totals"] == {"safety": 1, "critical": 1, "warning": 1}, (
        "a shutdown must roll up as `safety`, not be folded into `critical`"
    )


def test_the_same_corpus_on_the_default_scale_folds_them_together() -> None:
    """The contrast that shows the scale is doing the work.

    Without this, the assertion above would also pass if `portfolio` ignored the
    scale and happened to have a `safety` bucket for another reason.
    """
    rolled = navigation.portfolio(
        [project([
            {"id": "a", "priority": "shutdown", "active": True},
            {"id": "b", "priority": "fault", "active": True},
            {"id": "c", "priority": "warning", "active": True},
        ])]
    )
    assert rolled["totals"] == {"critical": 2, "warning": 1}, (
        "on the default scale `shutdown` is an undeclared string and folds into "
        "the most severe tier, which is the behaviour that has always shipped"
    )


def test_a_site_that_declares_nothing_is_byte_identical_to_before() -> None:
    """The backwards-compatibility claim, asserted rather than assumed."""
    corpus = [project([
        {"id": "a", "priority": "critical", "active": True},
        {"id": "b", "severity": "warn", "active": True},
    ])]
    assert navigation.portfolio(corpus, alarm_vocabulary.resolve_priority_scale({})) \
        == navigation.portfolio(corpus)


async def test_the_site_scale_reaches_alarm_settings(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """The option is read where the rest of the alarm philosophy is read."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    settings = manager.alarm_settings()
    assert "priority_scale" in settings, (
        "alarm_settings() has described priorities as a site decision since "
        "Phase 6; it must actually carry the scale"
    )
    assert list(settings["priority_scale"]["priorities"]) == list(
        alarm_vocabulary.ALARM_PRIORITIES
    ), "a site that declared nothing must get the default"
    assert settings["priority_scale"]["declared"] is False


def test_a_mistyped_scale_degrades_to_the_default_and_says_so() -> None:
    """A badge row must not disappear because one option was mistyped.

    The refusal is surfaced rather than raised: this is read on every roll-up,
    and losing the alarm display entirely is a worse answer than showing the
    default and reporting the mistake.
    """
    from custom_components.glt_flow_card import GltStore

    degraded = GltStore._resolved_priority_scale({"alarm_priorities": ["only-one"]})
    assert list(degraded["priorities"]) == list(alarm_vocabulary.ALARM_PRIORITIES)
    assert degraded["rejected"]["code"] == "priority_count_out_of_range", (
        "the mistake must be visible, not swallowed"
    )
