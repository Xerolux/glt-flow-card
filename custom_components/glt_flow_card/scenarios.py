"""A scenario is a pure function of its definition and a tick.

``08-RESEARCH.md`` established that Home Assistant offers an integration no
virtual clock: ``dt_util.utcnow()`` is patched only inside its own test harness.
So a repeatable scenario cannot be built by moving Home Assistant's clock.

That constraint produced a better design than a clock would have. A pure
function is:

- **reproducible by construction** rather than by discipline -- tick *n* yields
  the same state on any machine, at any time, in any order;
- **evaluable without waiting**, so a ten-hour rehearsal is a test that runs in
  milliseconds; and
- **evaluable for entities that do not exist yet** (D7), because nothing is read
  from the state machine to produce it. SIM-01 requires exactly that: building a
  scenario *before* the entities exist is the point of commissioning rehearsal.

The shipped path stored ``querySelector("[data-value]").value`` verbatim -- an
unvalidated string with no number, no unit, no device class and no range (D4) --
and nothing ever read it back (D5).
"""
from __future__ import annotations

from typing import Any

from .measured_value import canonical_number

#: The step kinds a scenario may use. Closed: an unknown kind is refused rather
#: than skipped, because a scenario that silently omits a step rehearses
#: something other than what was written.
STEP_KINDS: tuple[str, ...] = ("ramp", "sequence", "hold")

#: Why a scenario or one of its values was refused. Closed, and each distinct
#: because they call for different corrections from the author.
SCENARIO_REFUSALS: tuple[str, ...] = (
    "unknown_step_kind",
    "unit_mismatch",
    "device_class_mismatch",
    "value_not_numeric",
    "ramp_needs_bounds",
    "sequence_needs_states",
    "ticks_out_of_range",
    "slot_missing",
)

#: The largest number of ticks a step may declare.
#:
#: A bound rather than a suggestion: a scenario is evaluated in a websocket
#: handler, and an unbounded tick count is an unbounded loop with an operator's
#: finger on it.
MAX_TICKS = 10_000


class ScenarioRejected(ValueError):
    """A scenario was refused, with a reason from the closed set."""

    def __init__(self, reason: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or {}


def _refuse(reason: str, **detail: Any) -> ScenarioRejected:
    assert reason in SCENARIO_REFUSALS, f"undeclared refusal reason: {reason}"
    return ScenarioRejected(reason, detail)


def validate_step(step: Any, *, expectation: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return the step, validated against what the slot can actually report.

    Validated at authoring time, not at evaluation time. A scenario that asserts
    a value the entity could never produce is a rehearsal of something that
    cannot happen, and discovering that when it runs is discovering it too late
    -- the same "fails at the call, not at the request" shape Phase 4 closed for
    controls and Phase 6 for calendar bindings.
    """
    if not isinstance(step, dict):
        raise _refuse("unknown_step_kind", kind=type(step).__name__)
    kind = step.get("kind")
    if kind not in STEP_KINDS:
        raise _refuse("unknown_step_kind", kind=kind)

    slot = step.get("slot")
    if not isinstance(slot, str) or not slot:
        raise _refuse("slot_missing")

    expected = expectation or {}
    declared_unit = step.get("unit")
    expected_unit = expected.get("unit")
    if expected_unit and declared_unit and declared_unit != expected_unit:
        # Both sides named. A refusal that states only one leaves the author to
        # guess which half is wrong, which Phase 5 established is a tool
        # disagreeing with a human without saying why.
        raise _refuse("unit_mismatch", expected=expected_unit, declared=declared_unit, slot=slot)

    declared_class = step.get("device_class")
    expected_class = expected.get("device_class")
    if expected_class and declared_class and declared_class != expected_class:
        raise _refuse(
            "device_class_mismatch", expected=expected_class, declared=declared_class, slot=slot,
        )

    ticks = step.get("ticks")
    if kind in ("ramp", "hold"):
        if not isinstance(ticks, int) or isinstance(ticks, bool) or ticks < 1:
            raise _refuse("ticks_out_of_range", ticks=ticks)
        if ticks > MAX_TICKS:
            raise _refuse("ticks_out_of_range", ticks=ticks, maximum=MAX_TICKS)

    if kind == "ramp":
        for bound in ("from", "to"):
            value = step.get(bound)
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise _refuse("value_not_numeric", bound=bound, value=value)
        if step.get("from") is None or step.get("to") is None:
            raise _refuse("ramp_needs_bounds")

    if kind == "sequence":
        states = step.get("states")
        if not isinstance(states, list) or not states:
            raise _refuse("sequence_needs_states")
        if len(states) > MAX_TICKS:
            raise _refuse("ticks_out_of_range", ticks=len(states), maximum=MAX_TICKS)
        for state in states:
            if not isinstance(state, str):
                raise _refuse("value_not_numeric", value=state)

    return dict(step)


def step_length(step: dict[str, Any]) -> int:
    """Return how many ticks one step occupies."""
    if step["kind"] == "sequence":
        return len(step["states"])
    return int(step["ticks"])


def evaluate_step(step: dict[str, Any], tick: int) -> Any:
    """Return one step's value at one tick.

    A ramp with a single tick is the degenerate case, and it is where an
    off-by-one lives: dividing by ``ticks - 1`` is the natural formula and it
    divides by zero. A one-tick ramp holds its start value.
    """
    kind = step["kind"]
    if kind == "sequence":
        return step["states"][tick]
    if kind == "hold":
        return canonical_number(step["from"]) if isinstance(step.get("from"), (int, float)) else step.get("value")

    total = int(step["ticks"])
    start = float(step["from"])
    end = float(step["to"])
    if total <= 1:
        return canonical_number(start)
    fraction = tick / (total - 1)
    return canonical_number(start + (end - start) * fraction)


def evaluate(definition: Any, tick: int) -> dict[str, Any]:
    """Return the state a scenario asserts at one tick.

    Reads nothing outside its arguments -- no state machine, no clock, no
    registry. That is what makes it reproducible, and what lets it evaluate for
    entities that do not exist yet.
    """
    if not isinstance(definition, dict):
        raise _refuse("unknown_step_kind", kind=type(definition).__name__)
    steps = [validate_step(step) for step in definition.get("steps") or []]
    if not steps:
        raise _refuse("sequence_needs_states")

    if tick < 0:
        raise _refuse("ticks_out_of_range", ticks=tick)

    cursor = tick
    for step in steps:
        length = step_length(step)
        if cursor < length:
            return {
                "provider": "simulated",
                "slot": step["slot"],
                "tick": tick,
                "unit": step.get("unit"),
                "value": evaluate_step(step, cursor),
            }
        cursor -= length

    # Past the end, the scenario holds its final state rather than becoming
    # undefined. An undefined tail would make "what does the plant do after the
    # rehearsal ends" a question with no answer, and the honest answer is that
    # nothing further was rehearsed.
    last = steps[-1]
    return {
        "provider": "simulated",
        "slot": last["slot"],
        "tick": tick,
        "unit": last.get("unit"),
        "value": evaluate_step(last, step_length(last) - 1),
    }


def trace(definition: Any, ticks: int) -> list[dict[str, Any]]:
    """Return a scenario's whole trace, for comparison against a corpus."""
    if not isinstance(ticks, int) or isinstance(ticks, bool) or ticks < 0 or ticks > MAX_TICKS:
        raise _refuse("ticks_out_of_range", ticks=ticks, maximum=MAX_TICKS)
    return [evaluate(definition, tick) for tick in range(ticks)]


def total_ticks(definition: Any) -> int:
    """Return how many ticks a scenario declares in total."""
    steps = [validate_step(step) for step in (definition or {}).get("steps") or []]
    return sum(step_length(step) for step in steps)
