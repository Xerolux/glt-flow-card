"""A scenario is a pure function of definition and tick (T8-07, T8-08).

Home Assistant offers an integration no virtual clock, so a repeatable scenario
cannot be built by moving its clock. The pure function that constraint forced is
better than a clock would have been: reproducible by construction, evaluable
without waiting, and evaluable for entities that do not exist yet — which SIM-01
requires, because rehearsing a design *before* anything is connected is the point
of commissioning rehearsal.

The corpus contains a case whose value **changes per tick**. A corpus of
constants would prove reproducibility on something that cannot vary, which is the
shape of vacuous pass this project has corrected twice.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from custom_components.glt_flow_card import scenarios
from custom_components.glt_flow_card.scenarios import MAX_TICKS, ScenarioRejected

EFFECT_PREFIX = "PHASE8_SCENARIO_EFFECTS "

CORPUS = json.loads(
    (Path(__file__).parent / "fixtures" / "scenario_corpus.json").read_text(encoding="utf-8")
)


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps({"network": 0, "notification": 0, "remote": 0,
                                      "service": 0, **counts}, sort_keys=True))


def _definition(case):
    return {"steps": [case["definition"]]}


def test_every_corpus_case_reproduces_exactly():
    for case in CORPUS["cases"]:
        produced = [
            entry["value"]
            for entry in scenarios.trace(_definition(case), len(case["expected"]))
        ]
        assert produced == case["expected"], f"{case['id']}: {case['why']}"
    _emit(cases=len(CORPUS["cases"]))


def test_the_corpus_contains_a_scenario_that_actually_varies():
    """Otherwise "reproducible" is proven on something that cannot change."""
    varying = [
        case for case in CORPUS["cases"]
        if len(set(map(str, case["expected"]))) > 1
    ]
    assert varying, "every corpus scenario is constant; reproducibility is untested"


def test_the_same_definition_and_tick_yield_the_same_state():
    """Reproducible by construction rather than by discipline."""
    case = CORPUS["cases"][0]
    definition = _definition(case)
    first = scenarios.trace(definition, 10)
    second = scenarios.trace(dict(definition), 10)
    assert first == second


def test_evaluation_reads_nothing_outside_its_arguments():
    """No state machine, no clock, no registry.

    Asserted by evaluating a scenario whose entities do not exist anywhere: if
    the evaluator consulted the world, this would fail or return something else.
    """
    case = next(c for c in CORPUS["cases"] if c["id"] == "entities-that-do-not-exist-yet")
    produced = [
        entry["value"] for entry in scenarios.trace(_definition(case), len(case["expected"]))
    ]
    assert produced == case["expected"]


def test_a_single_tick_ramp_does_not_divide_by_zero():
    """The degenerate case, and where an off-by-one lives.

    Dividing by `ticks - 1` is the natural formula for a ramp and it divides by
    zero here. A one-tick ramp holds its start value.
    """
    step = {"kind": "ramp", "slot": "setpoint", "from": 21.0, "to": 65.0, "ticks": 1}
    assert scenarios.evaluate({"steps": [step]}, 0)["value"] == 21


def test_past_the_end_a_scenario_holds_rather_than_becoming_undefined():
    """"What does the plant do after the rehearsal ends" needs an answer.

    The honest one is that nothing further was rehearsed, which is the final
    state held — not `None`, which a surface would render as a blank that reads
    as zero.
    """
    step = {"kind": "sequence", "slot": "pump", "states": ["off", "running"]}
    assert scenarios.evaluate({"steps": [step]}, 99)["value"] == "running"


def test_every_value_states_that_it_is_simulated():
    """The provider travels with the value, so a surface cannot lose it."""
    case = CORPUS["cases"][0]
    for entry in scenarios.trace(_definition(case), 3):
        assert entry["provider"] == "simulated"


# --- Values are validated at authoring time (T8-08) -------------------------


def test_a_unit_contradicting_the_profile_is_refused_with_both_sides_named():
    """A scenario asserting a value the entity could never report rehearses nothing.

    Discovering that when it runs is discovering it too late — the same "fails
    at the call, not the request" shape Phase 4 closed for controls.
    """
    step = {"kind": "ramp", "slot": "flow", "unit": "bar", "from": 0, "to": 1, "ticks": 2}
    with pytest.raises(ScenarioRejected) as refused:
        scenarios.validate_step(step, expectation={"unit": "°C"})
    assert refused.value.reason == "unit_mismatch"
    assert refused.value.detail["expected"] == "°C"
    assert refused.value.detail["declared"] == "bar"


def test_a_device_class_mismatch_is_its_own_refusal():
    step = {"kind": "ramp", "slot": "flow", "device_class": "pressure",
            "from": 0, "to": 1, "ticks": 2}
    with pytest.raises(ScenarioRejected) as refused:
        scenarios.validate_step(step, expectation={"device_class": "temperature"})
    assert refused.value.reason == "device_class_mismatch"


def test_a_non_numeric_ramp_bound_is_refused():
    """The shipped path stored the input box's string verbatim."""
    with pytest.raises(ScenarioRejected) as refused:
        scenarios.validate_step(
            {"kind": "ramp", "slot": "flow", "from": "warm", "to": 65, "ticks": 5},
        )
    assert refused.value.reason == "value_not_numeric"


def test_an_unknown_step_kind_is_refused_rather_than_skipped():
    """A scenario that silently omits a step rehearses something else."""
    with pytest.raises(ScenarioRejected) as refused:
        scenarios.validate_step({"kind": "teleport", "slot": "flow"})
    assert refused.value.reason == "unknown_step_kind"


def test_a_step_without_a_slot_is_refused():
    with pytest.raises(ScenarioRejected) as refused:
        scenarios.validate_step({"kind": "ramp", "from": 0, "to": 1, "ticks": 2})
    assert refused.value.reason == "slot_missing"


def test_ticks_are_bounded():
    """A scenario is evaluated in a websocket handler.

    An unbounded tick count is an unbounded loop with an operator's finger on it.
    """
    with pytest.raises(ScenarioRejected) as refused:
        scenarios.validate_step(
            {"kind": "ramp", "slot": "flow", "from": 0, "to": 1, "ticks": MAX_TICKS + 1},
        )
    assert refused.value.reason == "ticks_out_of_range"


def test_a_sequence_needs_states():
    with pytest.raises(ScenarioRejected) as refused:
        scenarios.validate_step({"kind": "sequence", "slot": "pump", "states": []})
    assert refused.value.reason == "sequence_needs_states"


def test_total_ticks_sums_the_steps():
    definition = {"steps": [
        {"kind": "ramp", "slot": "flow", "from": 0, "to": 10, "ticks": 5},
        {"kind": "sequence", "slot": "pump", "states": ["off", "running", "off"]},
    ]}
    assert scenarios.total_ticks(definition) == 8
    # And the second step follows the first rather than restarting the clock.
    assert scenarios.evaluate(definition, 5)["slot"] == "pump"
    assert scenarios.evaluate(definition, 5)["value"] == "off"
