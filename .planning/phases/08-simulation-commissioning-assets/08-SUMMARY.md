# Phase 8 — Safe Simulation, Commissioning and Assets

**Status:** closed. 24 of 25 threats verified; T8-25 blocked by the environment,
recorded with its exact failure.

**Evidence at head:** 469 Node, 615 Python (1 deselected), 72 exact-dist browser
tests, `verify-docs-site` 25 sources / 41 byte-identical site files.

## What this phase was about

Phase 6's threats concerned effects that reach a human and fail silently. Phase
7's concerned numbers that reach a human and are wrong in a plausible direction.

**Phase 8's concern a belief about the plant that is wrong in a comforting
direction:**

- *"I am only rehearsing."* — and the service call went to the plant.
- *"The installation is ready."* — from a browser snapshot with no registry behind it.
- *"That maintenance was done."* — from a record that was overwritten.

The first is a **safety** defect rather than a correctness one, and it decided
the shape of the whole phase.

## The headline

**Simulation blocked nothing.** `ws_controls_execute` called
`hass.services.async_call` unconditionally, `ws_remote_control` forwarded an
arbitrary domain and service, and no server path read `simulation.enabled` at
all. The one check the product had refused only when an individual control
*definition* carried `gates.simulation` — so a control omitting the key executed
for real while the interface displayed "Simulationsmodus aktiv".

An engineer rehearsing a sequence on a Saturday was operating the plant, and the
product had told them they were not.

Worse, that one gate read from the **project document**, which is operator
input. The data deciding whether a write reached plant was authored by the people
the block exists to protect — Phase 6's notification-allowlist defect with plant
writes behind it instead of a message.

All five effect call sites now consult one decision immediately before the
effect. The decision is enumerated rather than remembered, and it fails closed.

**Notification is marked, not silenced**, and that is a deliberate decision
against the obvious reading. Blocking everything during a rehearsal would
suppress alarms and turn a commissioning test into a window in which nobody is
told about a real fault — a safety defect in the other direction, and a worse
one, because a person who hears nothing assumes nothing happened.

## What else shipped

**Scenarios are pure functions of definition and tick.** Home Assistant offers an
integration no virtual clock, and the design that constraint forced is better
than a clock: reproducible by construction, evaluable without waiting, and
evaluable for entities that do not exist yet — which SIM-01 requires and no
clock-based design could have given.

**Commissioning moved to the Companion and stopped inventing findings.** Registry
provenance is unreachable from the browser, so the previous design could not have
answered DIAG-01 at all. The reference collector treated any string containing a
dot as an entity id, reporting version numbers as missing entities; an engineer
who learns the readiness view says untrue things stops reading it. Registry and
state-machine membership are now four answers rather than one.

**Maintenance records became append-only.** `{**old, **new}` erased who opened a
work order and when. A correction is a new entry naming what it corrects, and
status is derived from the entries so the record and the display cannot disagree.

**Due dates are computed** from declared interval or operating-hour plans, using
calendar arithmetic and Phase 7's coverage.

## Three defects the tests found while being written

Recorded because they are the phase's own lesson about where defects live:

**`bool(None)` is `False`.** The dispatch gate coerced a missing simulation
reader into "not simulating" — a silent fail-*open* in the module whose entire
purpose is failing closed.

**The exemption list needed no entries.** It was written expecting two. A marked
effect still has to *ask* — that is how it learns to mark itself — and "the
handler above it is close enough" is exactly the reasoning that produces a gate
with the shape of somebody's memory.

**The content-id mirror stringified numbers**, so every id containing a number
differed between runtimes while a string-only corpus passed. That is worse than
the clock-derived ids it replaces: it looks stable and is not.

## A pattern closed on its third occurrence

Clock-derived ids: `paste_${Date.now()}` in Phase 5, `report_${Date.now()}` in
Phase 7, `wo_${Date.now()}` here. Fixing it a third time in a third place would
have guaranteed a fourth, so it is now one shared content-id helper both runtimes
use and compare byte for byte.

## Limitations

- **`unregistered` carries no provenance** by construction — a template or YAML
  entity has no registry entry to read one from. Stated rather than worked around.
- **Attachment type checking is not virus scanning.** It catches obvious
  mislabelling and says so.
- **No notification path of its own.** Phase 6 owns delivery and its allowlist
  applies unchanged; this phase only marks.
- **No CMMS claims.** REQUIREMENTS rules out conformance claims and the
  documentation says so explicitly.
- **Remote-site simulation** beyond the dispatch block is Phase 9's — which
  inherits a gate rather than needing to add one.

## Environment limits

Four, unchanged from Phase 7 except that T8-25 replaces T7-23 as the blocked row:

1. Container browser revision 1194 vs `@playwright/test` 1.62.1 expecting 1234 —
   the exact-dist rows rest on the documented override.
2. GitHub API scoped to this session's repository, blocking F-01 and every gate
   recursing into Phase 1.
3. No Docker engine — blocks T8-25, recorded with its exact output.
4. In CI, the Home Assistant harness version pin.

**No release is authorized, and none was made.**
