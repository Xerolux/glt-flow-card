"""One decision, consulted at the point of dispatch.

This module closes the phase's headline defect, which is a **safety** defect
rather than a correctness one.

The shipped product blocked nothing. `ws_controls_execute` called
``hass.services.async_call`` unconditionally, `ws_remote_control` forwarded an
arbitrary domain and service, and no server path read ``simulation.enabled`` at
all. The only check in the product refused when an individual control
*definition* carried ``gates.simulation`` -- so a control whose definition
omitted the key executed for real while the interface displayed
"Simulationsmodus aktiv".

An engineer rehearsing a sequence on a Saturday was operating the plant, and had
been told they were not.

Three properties, and none of them is optional:

**Consulted at the point of dispatch.** Not at the top of a handler, where a
later branch can slip past it, and not in a wrapper somebody has to remember to
use. The call site that performs the effect is the call site that asks.

**Enumerated, not inferred.** `DISPATCH_KINDS` is closed and
`test_dispatch_enumeration.py` walks every declared path. A gate applied where
somebody remembered to apply it has the shape of somebody's memory.

**Fails closed.** If simulation state cannot be read, a physical kind is
refused. An unknown that resolves to "go ahead" is worse than not having the
feature, because the feature is what persuaded the engineer they were safe.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .dispatch_vocabulary import DISPATCH_KINDS, behaviour_for


@dataclass(frozen=True)
class DispatchDecision:
    """What one dispatch path was told to do, and why.

    `outcome` is one of `dispatch`, `simulated` or `refused`. Three rather than
    two, and the third is load-bearing: `simulated` means the effect was
    deliberately not performed and the caller should say so on the surface,
    which is different from `refused`, where something went wrong.
    """

    outcome: str
    reason: str | None = None
    detail: dict[str, Any] | None = None

    @property
    def may_dispatch(self) -> bool:
        return self.outcome == "dispatch"

    @property
    def is_marked(self) -> bool:
        """True when the effect happens but must announce that it was simulated."""
        return self.outcome == "simulated"


def decide_dispatch(
    kind: str,
    *,
    is_simulating: Callable[[], bool] | bool | None,
) -> DispatchDecision:
    """Decide whether one effect may leave the integration.

    `is_simulating` is a callable rather than a value on purpose. The state must
    be read *now*, at the moment of dispatch, not captured when the handler
    started: a session that expired -- or was started -- while a handler was
    awaiting something is exactly the window this gate exists to cover.

    A callable that raises is treated as "cannot tell", which refuses. That is
    the fail-closed rule, and it is why the callable is not simply invoked by
    the caller and passed in as a bool: doing so would move the error handling
    to every call site and one of them would get it wrong.
    """
    if kind not in DISPATCH_KINDS:
        # Not defaulted either way. Allowing would let an unlisted path move
        # plant during a rehearsal; refusing would silently disable a path
        # nobody meant to disable. Refusing *and saying the kind is unknown*
        # is the only honest answer.
        return DispatchDecision("refused", "unknown_dispatch_kind", {"kind": kind})

    behaviour = behaviour_for(kind)
    if behaviour == "allow":
        # The record of what happened must be kept, especially during a
        # rehearsal.
        return DispatchDecision("dispatch")

    try:
        if callable(is_simulating):
            simulating = is_simulating()
        elif is_simulating is None:
            # `None` is "nobody told me", not "no". `bool(None)` is False, and
            # writing it that way -- which this first did -- turns a missing
            # reader into a silent fail-*open*: the gate would wave every
            # dispatch through precisely when the Companion could not answer.
            simulating = None
        else:
            simulating = bool(is_simulating)
    except Exception:  # noqa: BLE001 - any failure to read is "cannot tell"
        simulating = None

    if simulating is None:
        if behaviour == "refuse":
            # Distinct from `simulation_active`, because the two call for
            # different responses: one means "you are rehearsing", the other
            # "the Companion is unwell and is protecting you". An operator who
            # cannot tell them apart does not know whether to wait.
            return DispatchDecision("refused", "simulation_state_unavailable", {"kind": kind})
        # A markable effect still goes out when the state cannot be read, and
        # says it could not be determined. Silence here would be the safety
        # defect in the other direction.
        return DispatchDecision("simulated", "simulation_state_unavailable", {"kind": kind})

    if not simulating:
        return DispatchDecision("dispatch")

    if behaviour == "refuse":
        return DispatchDecision("refused", "simulation_active", {"kind": kind})
    return DispatchDecision("simulated", "simulation_active", {"kind": kind})


def simulation_notice(decision: DispatchDecision, language: str = "de") -> str:
    """Return the sentence a marked effect carries.

    Written out in both languages rather than assembled from fragments. Phase 6
    established this for the schedule preview: a sentence built from pieces
    reads as machine output in exactly the situation where a human needs to
    trust it.
    """
    unavailable = decision.reason == "simulation_state_unavailable"
    if language == "en":
        if unavailable:
            return ("Simulation state could not be determined; treat this as a rehearsal "
                    "until the Companion confirms otherwise.")
        return "Produced during a simulation. The plant was not operated."
    if unavailable:
        return ("Der Simulationszustand war nicht feststellbar; behandeln Sie dies als Probelauf, "
                "bis der Companion etwas anderes bestätigt.")
    return "Während einer Simulation erzeugt. Die Anlage wurde nicht bedient."
