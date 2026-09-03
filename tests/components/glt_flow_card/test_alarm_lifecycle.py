"""One backend alarm lifecycle, under controlled time (T6-02, T6-03).

Two defects the audit located, both of which need more than one alarm or more
than one state change to expose:

**D2 -- every delayed alarm on one entity uses the last one's delay.** The
scheduled coroutine binds `pid`, `a`, `e` and `k` as default arguments and
leaves `delay` free, so it reads the loop's final value. A single-alarm test
passes on the broken code, because with one iteration the free variable happens
to hold the right number. Two alarms with different delays is the minimum.

**D10 -- the delay is "quiet for N seconds", not "active for N seconds".** The
pending task is cancelled and recreated on every intermediate active state, so a
sensor whose value keeps changing while staying above threshold drags its own
annunciation along behind the last change. A delay exists to suppress a
transient, not a persistent fault that happens to be noisy.

Time is controlled throughout. Nothing here sleeps.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed
import homeassistant.util.dt as dt_util

from custom_components.glt_flow_card.alarm_vocabulary import (
    ALARM_STATES,
    SUPPRESSION_REASONS,
)

from .alarm_factory import (
    anchored_delay,
    hysteresis_sequence,
    oscillating_transitions,
    threshold_alarms,
    two_delays_on_one_entity,
)
from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase6-lifecycle]: "
    "per-alarm anchored delays and hysteresis transitions are unavailable"
)
EFFECT_PREFIX = "PHASE6_LIFECYCLE_EFFECTS "

PROJECT_ID = "lifecycle-plant"
ENTITY = "sensor.vorlauf_temperatur"


async def _seed(hass: HomeAssistant, config_entry: MockConfigEntry, alarms: list[dict[str, Any]]) -> Any:
    """Load the integration with one project carrying `alarms`."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    manager.data["projects"][PROJECT_ID] = {
        "id": PROJECT_ID,
        "config": {"alarms": alarms, "schedules": []},
    }
    # Seeding `manager.data` directly bypasses `save_project`, which is what
    # refreshes the entity-filtered subscription in production.
    manager.async_refresh_alarm_subscription()
    return manager


async def _advance(hass: HomeAssistant, seconds: float) -> None:
    """Move controlled time forward and let every due task run."""
    async_fire_time_changed(hass, dt_util.utcnow() + dt_util.dt.timedelta(seconds=seconds))
    await hass.async_block_till_done()


async def lifecycle_gaps(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> list[str]:
    """Return every lifecycle behaviour the Companion does not yet have."""
    gaps: list[str] = []

    try:
        from custom_components.glt_flow_card import alarm_engine
    except ImportError:
        return [
            "there is no alarm_engine module, so the lifecycle cannot be tested "
            "without a running Home Assistant and will be tested shallowly"
        ]

    # The engine must be callable without Home Assistant. A lifecycle that can
    # only be exercised through a full integration is one that will be
    # exercised rarely.
    #
    # `suppression_for` is deliberately not checked here: it belongs to plan
    # 06-07 and to `test_alarm_suppression.py`. A sentinel that requires another
    # plan's work cannot go green when its own owner lands, which makes the
    # gate's owner column a fiction.
    for name in ("evaluate", "decide"):
        if not hasattr(alarm_engine, name):
            gaps.append(f"alarm_engine has no {name}()")

    # D2: two alarms, one entity, two delays.
    alarms = two_delays_on_one_entity()
    configured = {alarm["id"]: alarm["delay_seconds"] for alarm in alarms}
    scheduled = getattr(alarm_engine, "scheduled_delays", None)
    if scheduled is None:
        gaps.append(
            "alarm_engine cannot report the delay each pending alarm is waiting, "
            "so D2 cannot be observed without timing the whole run"
        )
    else:
        actual = scheduled(alarms)
        if actual != configured:
            gaps.append(
                f"each alarm must wait its own delay; configured {configured}, scheduled {actual}"
            )

    # D10: the anchor.
    transitions = oscillating_transitions(60)
    fires_at = getattr(alarm_engine, "annunciates_at", None)
    if fires_at is None:
        gaps.append("alarm_engine has no annunciates_at(), so the anchor cannot be asserted")
    elif fires_at(transitions, 60) != anchored_delay(transitions, 60):
        gaps.append(
            "a continuously active alarm must annunciate at first_activation + delay, "
            "not trail the last state change"
        )

    # Hysteresis needs the previous state, and the declared states must be the
    # closed set rather than whatever the engine happens to write.
    evaluate = getattr(alarm_engine, "evaluate", None)
    if evaluate is not None:
        previous = False
        for state, expected in hysteresis_sequence():
            try:
                active = evaluate(state, threshold_alarms()[0], previous)
            except TypeError:
                gaps.append("evaluate() does not take the previous active state")
                break
            if bool(active) is not expected:
                gaps.append(f"hysteresis: {state} evaluated {active}, expected {expected}")
                break
            previous = bool(active)

    states = getattr(alarm_engine, "STATES", None)
    if states is not None and tuple(states) != ALARM_STATES:
        gaps.append(f"the engine's states {tuple(states)} are not the declared {ALARM_STATES}")

    decide = getattr(alarm_engine, "decide", None)
    if decide is not None:
        decision = decide(threshold_alarms()[0], "85", previous_active=False)
        if not isinstance(decision, dict) or "reason" not in decision:
            gaps.append("a transition must produce a decision record carrying a reason")
        elif decision.get("suppressed_by") not in (None, *SUPPRESSION_REASONS):
            gaps.append("a decision's suppressed_by is outside the declared set")

    return gaps


async def test_expected_red_phase6_lifecycle(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """Each alarm keeps its own delay, anchored to its first activation."""
    await _seed(hass, config_entry, two_delays_on_one_entity())
    emit_effects(EFFECT_PREFIX, lifecycle_effects, alarms=len(two_delays_on_one_entity()))

    gaps = await lifecycle_gaps(hass, config_entry)
    report(RED_MARKER, gaps, "per-alarm anchored delays and hysteresis transitions are unavailable")


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------


def test_two_alarms_on_one_entity_keep_their_own_delays() -> None:
    """D2, closed. One alarm cannot show this; two with different delays can."""
    alarms = two_delays_on_one_entity()
    configured = {alarm["id"]: alarm["delay_seconds"] for alarm in alarms}
    assert len(set(configured.values())) == 2, "the fixture must carry two distinct delays"
    from custom_components.glt_flow_card import alarm_engine

    assert alarm_engine.scheduled_delays(alarms) == configured


def test_the_naive_binding_would_have_collapsed_them() -> None:
    """The defect reproduced beside the fix, so this is not mistaken for a refactor."""
    from .alarm_factory import last_delay_wins

    alarms = two_delays_on_one_entity()
    naive = last_delay_wins(alarms)
    assert len(set(naive.values())) == 1, "the reproduced defect no longer collapses"
    from custom_components.glt_flow_card import alarm_engine

    assert alarm_engine.scheduled_delays(alarms) != naive


def test_a_delay_is_anchored_to_the_first_activation() -> None:
    """D10, closed. A delay suppresses a transient, not a noisy persistent fault."""
    from custom_components.glt_flow_card import alarm_engine
    from .alarm_factory import restarting_delay

    transitions = oscillating_transitions(60)
    assert alarm_engine.annunciates_at(transitions, 60) == 60
    assert alarm_engine.annunciates_at(transitions, 60) == anchored_delay(transitions, 60)
    # And it differs from the implementation it replaces, by a lot.
    assert restarting_delay(transitions, 60) > alarm_engine.annunciates_at(transitions, 60)


def test_a_genuine_clear_resets_the_anchor() -> None:
    """Otherwise the anchor is a one-way latch and the delay never applies again."""
    from custom_components.glt_flow_card import alarm_engine

    assert alarm_engine.annunciates_at([(0.0, True), (5.0, False)], 60) is None
    assert alarm_engine.annunciates_at([(0.0, True), (5.0, False), (10.0, True)], 60) == 70


def test_hysteresis_needs_the_previous_state() -> None:
    from custom_components.glt_flow_card import alarm_engine

    previous = False
    for state, expected in hysteresis_sequence():
        active = alarm_engine.evaluate(state, threshold_alarms()[0], previous)
        assert active is expected, f"{state} -> {active}, expected {expected}"
        previous = active


def test_the_stateless_walk_differs_so_hysteresis_is_really_exercised() -> None:
    from custom_components.glt_flow_card import alarm_engine

    stateless = [
        alarm_engine.evaluate(state, threshold_alarms()[0], False)
        for state, _ in hysteresis_sequence()
    ]
    assert stateless != [expected for _, expected in hysteresis_sequence()]


def test_the_engine_agrees_with_the_manager_it_replaced() -> None:
    """A move, not a rewrite: every corpus fixture keeps its answer."""
    from custom_components.glt_flow_card import _state_active, alarm_engine

    for alarm in threshold_alarms():
        for previous in (False, True):
            assert alarm_engine.evaluate(alarm["probe_state"], alarm, previous) == _state_active(
                alarm["probe_state"], alarm, previous
            ), alarm["id"]


def test_an_unavailable_entity_is_indeterminate_not_cleared() -> None:
    """The restart fix's foundation: three answers, not two."""
    from custom_components.glt_flow_card import alarm_engine

    alarm = {"id": "a", "active_states": ["on"]}
    for raw in ("unavailable", "unknown", None, ""):
        assert alarm_engine.classify_state(raw, alarm) == "indeterminate", raw
    assert alarm_engine.classify_state("on", alarm) == "active"
    assert alarm_engine.classify_state("off", alarm) == "inactive"


def test_a_site_that_really_alarms_on_unavailable_is_honoured() -> None:
    """Declaring it in `active_states` is a deliberate choice, not an accident."""
    from custom_components.glt_flow_card import alarm_engine

    alarm = {"id": "a", "active_states": ["unavailable"]}
    assert alarm_engine.classify_state("unavailable", alarm) == "active"


def test_every_decision_carries_a_reason_from_the_closed_set() -> None:
    from custom_components.glt_flow_card import alarm_engine

    for alarm in threshold_alarms():
        decision = alarm_engine.decide(alarm, alarm["probe_state"])
        assert decision["reason"] in alarm_engine.TRANSITION_REASONS, alarm["id"]
        assert decision["state"] in alarm_engine.STATES, alarm["id"]
        assert decision["suppressed_by"] is None


def test_a_suppressed_decision_names_which_suppression_applied() -> None:
    from custom_components.glt_flow_card import alarm_engine

    decision = alarm_engine.decide(
        threshold_alarms()[0], "85",
        suppression={"reason": "shelved", "by": "anna", "until": "2026-09-09T14:00:00Z"},
    )
    assert decision["reason"] == "suppressed"
    assert decision["suppressed_by"] == "shelved"
    assert decision["suppression"]["by"] == "anna"


def test_an_undeclared_suppression_reason_raises() -> None:
    """A reason outside the set would make "why is this quiet" unanswerable."""
    from custom_components.glt_flow_card import alarm_engine

    with pytest.raises(ValueError, match="unknown suppression reason"):
        alarm_engine.decide(threshold_alarms()[0], "85", suppression={"reason": "because"})


def test_a_first_activation_with_a_delay_is_pending_not_active() -> None:
    from custom_components.glt_flow_card import alarm_engine

    alarm = two_delays_on_one_entity()[1]
    decision = alarm_engine.decide(alarm, "85", previous_active=False)
    assert decision["reason"] == "delay_pending"
    assert decision["active"] is False
    assert decision["delay_seconds"] == alarm["delay_seconds"]


def test_the_engine_needs_no_running_home_assistant() -> None:
    """Asserted, because a lifecycle testable only end to end is tested shallowly.

    Checked against the module's *imports*, parsed, rather than against its text.
    A substring search over the source fails on the docstring that states this
    very rule, which would make the honest thing to do deleting the explanation.
    """
    import ast
    import inspect

    from custom_components.glt_flow_card import alarm_engine

    tree = ast.parse(inspect.getsource(alarm_engine))
    imported: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.append(node.module)
    reached = [name for name in imported if name.split(".")[0] == "homeassistant"]
    assert not reached, f"the engine reached for Home Assistant: {reached}"
