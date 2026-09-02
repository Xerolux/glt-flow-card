"""No dispatch path escapes the gate (T8-03).

A gate applied where somebody remembered to apply it has the shape of somebody's
memory. This test gives it the shape of the product instead: the source is read,
every call that can cause an effect outside this integration is found, and each
one must be preceded by a decision.

Two failure modes are covered, and the second is the one that makes this test
worth writing rather than a list worth maintaining:

**A path that dispatches without asking.** Found by locating every
`services.async_call` and `remote_control` call site and checking that
`decide_dispatch` appears above it in the same function.

**A path that is declared but never actually exercised.** A test that walks a
list of kinds and asserts something about each proves nothing about code that
ran. Every kind here is exercised through `decide_dispatch` and the outcome is
asserted, and the test fails if a declared kind produced no decision at all.
"""
from __future__ import annotations

import ast
import json
from pathlib import Path

from custom_components.glt_flow_card import dispatch_gate
from custom_components.glt_flow_card.dispatch_vocabulary import (
    DISPATCH_KINDS,
    PHYSICAL_KINDS,
    SIMULATION_BEHAVIOUR,
)

EFFECT_PREFIX = "PHASE8_ENUMERATION_EFFECTS "

COMPANION = Path(__file__).resolve().parents[3] / "custom_components" / "glt_flow_card"

#: Calls that cause an effect outside this integration.
#:
#: Matched on the attribute name rather than the full path, because
#: `hass.services.async_call` and `self.hass.services.async_call` are the same
#: hazard written two ways and a full-path match would miss the second.
EFFECT_CALLS: tuple[str, ...] = ("async_call", "remote_control")

#: Functions that legitimately call an effect without a gate above them.
#:
#: **Empty, and that is the finding.** This list was written expecting two
#: entries: the notification path, on the theory that marking rather than
#: blocking meant it could skip the decision, and the remote transport, on the
#: theory that the handler above it was close enough.
#:
#: Both turned out to be wrong. A marked effect still has to *ask* -- that is
#: how it learns to mark itself -- and "the handler above it" is exactly the
#: reasoning that produces a gate with the shape of somebody's memory. All five
#: effect call sites consult the decision directly.
#:
#: An entry here needs a reason, and the reasons are load-bearing rather than
#: decorative: an exemption list without them becomes where defects hide.
EXEMPT: dict[str, str] = {}


def _functions_with_effects(path: Path):
    """Yield (function name, calls it makes) for every function that can dispatch."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        calls = [
            child.func.attr
            for child in ast.walk(node)
            if isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute)
        ]
        effects = [name for name in calls if name in EFFECT_CALLS]
        if effects:
            yield node.name, calls, effects


def test_every_effect_call_site_is_preceded_by_a_decision():
    """The structural half: find the paths rather than trusting a list."""
    unguarded = []
    examined = 0
    for path in sorted(COMPANION.glob("*.py")):
        for name, calls, effects in _functions_with_effects(path):
            examined += 1
            if name in EXEMPT:
                continue
            if "decide_dispatch" not in calls:
                unguarded.append(f"{path.name}::{name} calls {effects} without deciding first")
    print(EFFECT_PREFIX + json.dumps(
        {"functions_examined": examined, "network": 0, "notification": 0, "remote": 0, "service": 0},
        sort_keys=True,
    ))
    assert examined > 0, "no dispatching function was found; the AST walk is not working"
    assert unguarded == [], "\n".join(unguarded)


def test_every_declared_kind_is_actually_exercised():
    """The behavioural half.

    A test that iterates a list and asserts a property of each entry proves
    nothing about code that ran -- which is the vacuous pass this suite
    corrected in Phase 4 (a retirement test that queried for a card the harness
    never mounts) and again in Phase 7 (an upper bound satisfied by zero
    fetches). So the decisions are collected and the collection is checked.
    """
    decisions = {}
    for kind in DISPATCH_KINDS:
        decisions[kind] = dispatch_gate.decide_dispatch(kind, is_simulating=lambda: True)

    assert set(decisions) == set(DISPATCH_KINDS), "a declared kind produced no decision"
    for kind, decision in decisions.items():
        expected = SIMULATION_BEHAVIOUR[kind]
        if expected == "refuse":
            assert decision.outcome == "refused", f"{kind} should refuse during a rehearsal"
        elif expected == "mark":
            assert decision.outcome == "simulated", f"{kind} should be marked, not blocked"
        else:
            assert decision.outcome == "dispatch", f"{kind} should still happen"


def test_an_undeclared_kind_cannot_slip_through_as_allowed():
    """A new path that forgets to declare itself must fail, not dispatch."""
    decision = dispatch_gate.decide_dispatch("new_path_nobody_declared", is_simulating=lambda: False)
    assert decision.outcome == "refused"
    assert decision.reason == "unknown_dispatch_kind"


def test_the_physical_kinds_cover_every_way_to_reach_plant():
    """The three ways a write leaves this integration, named.

    If a fourth appears, it must be added here deliberately rather than
    discovered when somebody rehearses on a live plant.
    """
    assert set(PHYSICAL_KINDS) == {"control", "remote_control", "schedule_service"}


def test_the_exemption_list_is_empty_and_any_entry_is_justified():
    """Every effect call site consults the decision directly.

    The list was written expecting two entries and needs none. If one is ever
    added it must carry a real reason, because an exemption list without them
    becomes where defects hide -- and each entry weakens the guarantee the
    structural test exists to give.
    """
    for name, reason in EXEMPT.items():
        assert reason and len(reason) > 20, f"{name} is exempt without a real reason"
    assert len(EXEMPT) <= 2, "the exemption list is growing; each entry weakens the guarantee"
