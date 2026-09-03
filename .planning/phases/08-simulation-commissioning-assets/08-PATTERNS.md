---
phase: 08-simulation-commissioning-assets
---

# Phase 8 Patterns

## The dispatch decision has one owner

Every path that can cause an effect outside this integration asks the same
function, at the point of dispatch, and does not decide for itself.

```
decide_dispatch(kind, *, simulation) -> {"outcome": "dispatch"|"simulated"|"refused", "reason": ...}
```

`kind` comes from a closed enumeration of dispatch kinds. A new path that
forgets to ask is caught by the enumeration test, not by review.

**Physical dispatch is blocked; notification is marked.** These are different
answers to different questions and collapsing them would be a second defect
either way:

| Kind | While simulating | Why |
|---|---|---|
| `control` | **refused** | A rehearsal must not move plant. |
| `remote_control` | **refused** | Same, one network hop away. |
| `schedule_service` | **refused** | A schedule firing a real service during a rehearsal is the same write with a timer in front of it. |
| `notification` | **marked** | An alarm during a rehearsal is still an alarm. Silencing it is a safety defect in the other direction; the message says the plant was simulated. |
| `audit` | **allowed** | The record of what happened must be kept, especially during a rehearsal. |
| `report_delivery` | **marked** | A report produced from simulated inputs must say so on its face, not fail to arrive. |

## Fail closed, and say which way it failed

If simulation state cannot be read, `decide_dispatch` refuses a physical kind.
An unknown that resolves to "go ahead" is worse than not having the feature,
because the feature is what persuaded the engineer they were safe.

The refusal carries a distinct reason (`simulation_state_unavailable`) from an
ordinary simulated refusal (`simulation_active`), because they call for
different responses: one is "you are rehearsing", the other is "the Companion is
unwell and is protecting you".

## Simulation state is site runtime state

Not project data. `simulation.enabled` in the project document is operator
input, and D2 makes it an authorization. The Companion owns the simulation
session: who started it, when, for which project, and when it expires.

**It expires.** A rehearsal that never ends is a plant that can never be
operated, and someone will then work around it. A session carries a bounded TTL
with an explicit maximum, refused rather than capped when exceeded — the rule
Phase 6 set for shelving after a 90-day request was silently truncated to 7.

## A reference is declared, never guessed

Diagnostics collect entity and service references from the places the schema
says they live — profile slots, control definitions, alarm conditions, datapoint
bindings, energy meters — and never by scanning values for a dot (D9).

The collector returns *where* each reference came from, so a finding can say
"the pump's `flow` slot names this entity" rather than "an entity is missing".
A finding without a location is a finding an engineer cannot act on.

## Registry and state machine are two questions

`in the registry` and `in the state machine` are independent, and the four
combinations are four different diagnoses:

| Registry | States | Diagnosis |
|---|---|---|
| yes | yes | present |
| yes | no | `registered_not_loaded` — disabled, or its integration failed to set up |
| no | yes | `unregistered` — a template or YAML entity, which is fine but has no provenance |
| no | no | `missing` |

The shipped code collapses all of these into `missing`, which sends an engineer
to look for a typo when the actual answer is "that integration failed to load".

## Every finding carries evidence and a safe next step

A finding is `{code, severity, reference, evidence, remediation}` where
`evidence` names what was read to reach it (registry entry, state, profile
expectation) and `remediation` is a *link*, never an action. Nothing in the
commissioning view writes.

## Records are append-only

A work order is a sequence of entries, not a mutable row. A correction is a new
entry that names what it corrects. `{**old, **new}` destroys the answer the
record exists to give (D22).

Transitions are a closed table, checked before the entry is appended. `"banana"`
is not a status, and neither is going back to `open` from `completed` — that is a
*reopen*, which is a different entry with a reason.

## Content-derived ids, in one place

D19 is the third clock-derived id in this codebase. Phase 5 fixed it in paste,
Phase 7 in report runs, and this phase would be the third independent fix. The
pattern closes once: a shared `content_id(kind, payload)` in both runtimes,
which the earlier two are then free to adopt.
