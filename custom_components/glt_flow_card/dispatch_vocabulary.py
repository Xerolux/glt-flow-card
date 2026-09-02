"""Three closed vocabularies, so two parts of the product cannot disagree.

Phase 6 shipped **four** independent alarm-severity vocabularies, and an alarm
created in the editor as `critical` was counted in none of them. The lesson was
not "be careful"; it was that a word shared between parts of a product needs one
declaration and a test that compares the copies.

These three are declared here and mirrored in `src/v100/dispatch-vocabulary.mjs`.
Mirrored rather than generated, so a change on one side has to be made on the
other and a test catches the moment it is not.
"""
from __future__ import annotations

import json
from typing import Any

#: Every path through which an effect can leave this integration.
#:
#: Measured by enumerating call sites rather than recalled, because the whole
#: simulation block depends on the list being complete: a gate applied to the
#: paths somebody remembered has the shape of somebody's memory.
DISPATCH_KINDS: tuple[str, ...] = (
    "control",
    "remote_control",
    "schedule_service",
    "notification",
    "audit",
    "report_delivery",
)

#: What a dispatch decision can answer. Three outcomes, not two, and the third
#: is the point: `simulated` means the effect was deliberately not performed and
#: the caller should say so, which is different from `refused`, where something
#: went wrong.
DISPATCH_OUTCOMES: tuple[str, ...] = ("dispatch", "simulated", "refused")

#: How each kind behaves while a simulation session is active.
#:
#: The split between `refuse` and `mark` is a safety decision in both
#: directions. Refusing a notification would make a rehearsal a window in which
#: nobody is told about a real fault. Marking a control would move plant.
SIMULATION_BEHAVIOUR: dict[str, str] = {
    "control": "refuse",
    "remote_control": "refuse",
    "schedule_service": "refuse",
    "notification": "mark",
    "report_delivery": "mark",
    # The record of what happened must be kept, especially during a rehearsal.
    "audit": "allow",
}

#: The kinds that move plant. Derived from the behaviour table rather than
#: written twice, so the two cannot drift apart.
PHYSICAL_KINDS: tuple[str, ...] = tuple(
    kind for kind in DISPATCH_KINDS if SIMULATION_BEHAVIOUR[kind] == "refuse"
)

#: Why a dispatch was not performed. Closed, and each distinct because they need
#: different responses from the person reading them.
DISPATCH_REASONS: tuple[str, ...] = (
    # "You are rehearsing."
    "simulation_active",
    # "The Companion cannot tell whether you are rehearsing, and is protecting
    # you." An unknown that resolved to "go ahead" would be worse than having no
    # feature at all, because the feature is what persuaded the engineer they
    # were safe.
    "simulation_state_unavailable",
    "unknown_dispatch_kind",
)

#: What a commissioning check can conclude about one reference.
#:
#: The first four are the registry/state-machine combinations, and they are four
#: answers rather than one because they send an engineer to four different
#: places. The rest are value-level findings.
DIAGNOSES: tuple[str, ...] = (
    "present",
    "registered_not_loaded",
    "unregistered",
    "missing",
    "wrong_unit",
    "wrong_device_class",
    "duplicate_binding",
    "stale",
    "service_missing",
)

#: Diagnoses that are not faults. `unregistered` states the absence of
#: provenance for a template or YAML entity, which is a normal way to run Home
#: Assistant and must not be reported as something to fix.
INFORMATIONAL_DIAGNOSES: tuple[str, ...] = ("present", "unregistered")

#: The states a work order can be in.
WORK_ORDER_STATES: tuple[str, ...] = (
    "open", "assigned", "in_progress", "blocked", "completed", "cancelled",
)

#: The transitions that exist. Everything else is refused *before* an entry is
#: appended, with both the current and the attempted status named -- "invalid
#: transition" alone leaves the operator to guess which half was wrong.
#:
#: `completed -> open` exists, because reopening a work order is a real thing
#: that happens. What must not exist is a *silent* one: it carries a reason, and
#: it is appended as its own entry, so a completion stays distinguishable from a
#: rewrite. `cancelled` is terminal.
WORK_ORDER_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "open": ("assigned", "in_progress", "cancelled"),
    "assigned": ("in_progress", "open", "cancelled"),
    "in_progress": ("blocked", "completed", "cancelled"),
    "blocked": ("in_progress", "cancelled"),
    "completed": ("open",),
    "cancelled": (),
}

#: The transitions that require a stated reason, as `from -> to` pairs.
#:
#: Keyed on the pair rather than the target, because the same destination means
#: different things depending on where it came from: `assigned -> open` is
#: handing a job back, and `completed -> open` is saying the work was not in
#: fact done. Only the second needs to justify itself.
TRANSITIONS_REQUIRING_REASON: tuple[tuple[str, str], ...] = (
    ("completed", "open"),
    ("open", "cancelled"),
    ("assigned", "cancelled"),
    ("in_progress", "cancelled"),
    ("blocked", "cancelled"),
    ("in_progress", "blocked"),
)


def transition_needs_reason(current: str, target: str) -> bool:
    """Return whether this transition must carry a stated reason."""
    return (current, target) in TRANSITIONS_REQUIRING_REASON


def _membership(members: tuple[str, ...], label: str):
    def check(value: Any) -> bool:
        return isinstance(value, str) and value in members
    check.__doc__ = f"Return whether the value is a declared {label}."
    return check


is_dispatch_kind = _membership(DISPATCH_KINDS, "dispatch kind")
is_dispatch_outcome = _membership(DISPATCH_OUTCOMES, "dispatch outcome")
is_diagnosis = _membership(DIAGNOSES, "diagnosis")
is_work_order_state = _membership(WORK_ORDER_STATES, "work order state")


def behaviour_for(kind: str) -> str:
    """Return how a kind behaves during simulation, or refuse.

    Refuses an unknown kind rather than defaulting. A default of `allow` would
    let a new dispatch path move plant during a rehearsal; a default of `refuse`
    would look safe while silently disabling a path nobody meant to disable.
    Neither is a decision this function is entitled to make.
    """
    if kind not in DISPATCH_KINDS:
        raise ValueError(f"unknown_dispatch_kind: {kind!r}")
    return SIMULATION_BEHAVIOUR[kind]


def transition_allowed(current: str, target: str) -> bool:
    """Return whether one work-order transition exists."""
    if current not in WORK_ORDER_TRANSITIONS:
        return False
    return target in WORK_ORDER_TRANSITIONS[current]


def canonical_vocabulary() -> str:
    """Return the canonical bytes both runtimes must agree on.

    The project's existing canonical form -- compact separators and sorted keys,
    all the way down. Comparing values and bytes later is how this codebase lost
    three cycles: `toISOString()` writing milliseconds Python omits, `0` against
    `0.0`, and default `json.dumps` separators against `JSON.stringify`.
    """
    return json.dumps(
        vocabulary_fingerprint(), ensure_ascii=False, separators=(",", ":"), sort_keys=True,
    )


def vocabulary_fingerprint() -> dict[str, Any]:
    """The bytes both runtimes must agree on, for the parity test."""
    return {
        "diagnoses": list(DIAGNOSES),
        "dispatch_kinds": list(DISPATCH_KINDS),
        "dispatch_outcomes": list(DISPATCH_OUTCOMES),
        "dispatch_reasons": list(DISPATCH_REASONS),
        "informational_diagnoses": list(INFORMATIONAL_DIAGNOSES),
        "physical_kinds": list(PHYSICAL_KINDS),
        "simulation_behaviour": dict(SIMULATION_BEHAVIOUR),
        "transitions_requiring_reason": [list(pair) for pair in TRANSITIONS_REQUIRING_REASON],
        "work_order_states": list(WORK_ORDER_STATES),
        "work_order_transitions": {k: list(v) for k, v in WORK_ORDER_TRANSITIONS.items()},
    }
