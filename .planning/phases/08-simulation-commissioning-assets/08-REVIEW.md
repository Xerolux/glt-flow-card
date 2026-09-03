---
phase: 08-simulation-commissioning-assets
reviewed: 2026-09-03
head: 0bf8702
depth: standard
reviewer: close-out review pass
method: read at head, plus an exhaustive probe of the dispatch gate's truth table
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: no_defects_found
---

# Phase 08: Code Review Report

**Scope.** `dispatch_gate.py`, `dispatch_vocabulary.py`, `commissioning.py`,
`maintenance_plans.py`, `attachments.py`, the scenario and work-order paths, and
`test_dispatch_enumeration.py`.

## Summary

No defect found, and this is the strongest safety work in the project.

The phase's headline defect was that **simulation blocked nothing**: no server
path read `simulation.enabled`, so an engineer rehearsing a sequence on a
Saturday was operating the plant while the interface displayed
"Simulationsmodus aktiv". The fix is a single gate with three properties, each of
which the module states and each of which this pass verified.

### The truth table, probed exhaustively

`decide_dispatch` was called for all six declared kinds × four states of the
simulation reader. Every cell:

| kind | reader raises | reader absent (`None`) | not simulating | simulating |
|---|---|---|---|---|
| `control` | **refused** | **refused** | dispatch | refused |
| `remote_control` | **refused** | **refused** | dispatch | refused |
| `schedule_service` | **refused** | **refused** | dispatch | refused |
| `notification` | simulated | simulated | dispatch | simulated |
| `report_delivery` | simulated | simulated | dispatch | simulated |
| `audit` | dispatch | dispatch | dispatch | dispatch |

An undeclared kind is **refused**, naming the kind.

Four things this table gets right that are easy to get wrong:

1. **Every physical kind fails closed on "cannot tell."** The one moment the
   Companion is unwell is the moment the block must not stop working.
2. **`None` is "nobody told me", not "no".** The module records that it first
   wrote `bool(is_simulating)`, which turns a missing reader into a silent
   fail-*open*. `bool(None)` is `False`, and `False` means "go ahead".
3. **`simulation_state_unavailable` is a different reason from
   `simulation_active`.** One means "you are rehearsing", the other "the
   Companion is unwell and is protecting you". An operator who cannot tell them
   apart does not know whether to wait.
4. **`audit` dispatches always.** The record of what happened must be kept,
   *especially* during a rehearsal.

### The reader is a callable, and that is load-bearing

`is_simulating` is passed as a callable rather than a value so the state is read
**at the moment of dispatch**, not captured when the handler started — a session
that expired or began while a handler was awaiting something is exactly the
window the gate exists to cover. It also keeps the error handling in one place:
invoking it at each call site would put "what if this raises" in six places, and
one of them would get it wrong.

### Notification is marked, not silenced

A markable effect still goes out when the state cannot be read, carrying a
sentence that says the state could not be determined. Silence here would be the
safety defect in the other direction: a rehearsal window in which nobody is told
about a real fault.

### The gate cannot be forgotten

`test_dispatch_enumeration.py` parses the Companion with `ast`, finds every
`async_call` and `remote_control` call site, and requires `decide_dispatch` in
the same function. Its exemption dict is **empty**, and its comment records that
it was written expecting two entries — the notification path and the remote
transport — and that both turned out to be wrong reasoning: "a marked effect
still has to *ask* — that is how it learns to mark itself", and "the handler
above it" is exactly the reasoning that produces a gate with the shape of
somebody's memory.

This is the pattern the Phase-2 pass had to invent for filtered routes. Phase 8
had already built it, for the class where it matters most.

## Evidence

| Command | Result |
|---|---|
| exhaustive probe: 6 kinds × 4 reader states, plus an undeclared kind | table above; no cell fails open |
| `pytest` over the seven Phase-8 owner modules | 81 passed |

## Verdict

**No defects found.** T8-25's release leaf is unrun here for the standing
reason.
