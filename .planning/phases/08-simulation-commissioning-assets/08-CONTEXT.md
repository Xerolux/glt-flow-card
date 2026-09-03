---
phase: 08-simulation-commissioning-assets
requirements: [SIM-01, DIAG-01, ASSET-01]
---

# Phase 8 Context

## What this phase is about

Phase 6 concerned effects that reach a human and fail silently. Phase 7
concerned numbers that reach a human and are wrong in a plausible direction.

**Phase 8 concerns a belief about the plant that is wrong in a comforting
direction.** All three subjects share it:

- *"I am only rehearsing."* — and the service call went to the plant.
- *"The installation is ready."* — from a browser snapshot with no registry
  behind it.
- *"That maintenance was done."* — from a record that was overwritten.

The first of those is a safety defect, not a correctness defect, and it decides
the shape of the phase.

## The rule the phase is built on

**A simulation that can reach a physical service is not a simulation.**

D1 is not "simulation mode has a gap". Nothing reads `simulation.enabled` on any
server path, so the product blocks *nothing* while displaying
"Simulationsmodus aktiv". An engineer rehearsing a sequence on a Saturday is
operating the plant and has been told they are not.

Three consequences follow, and they are not negotiable within this phase:

**The block is server-side and global.** Not a per-control key in the project
document — that is D2, and it is Phase 6's notification-allowlist defect with
plant writes behind it instead of a message. The simulation state is site
runtime state that the Companion owns, and every dispatch path consults it at
the point of dispatch.

**The block is enumerated, not inferred.** Every path that can reach a physical
service is named in one list, and a test walks that list. A gate placed on the
paths somebody remembered is a gate with the shape of somebody's memory.

**The block fails closed.** If the Companion cannot determine whether simulation
is active, it refuses the dispatch. An unknown that resolves to "go ahead" is
the failure mode that makes the whole feature worse than not having it.

## Commissioning is read-only, and that must be provable

DIAG-01's value is that an engineer can ask "is this installation ready?" before
anything is operated. That answer is worthless if asking changes something, and
"it is read-only by construction" is a claim by inspection — which is precisely
what D16 records. The phase owes an executable proof: a full diagnostic run
produces an empty service ledger.

The read-only rule also settles where diagnostics live. Registry provenance —
which integration, which device, which config entry — exists only in Home
Assistant's registries, which the browser cannot reach (D8). So the diagnostic
moves to the Companion, and the browser renders what it decided. That is the
same division Phase 6 drew for alarms and Phase 7 for trends, for the third
time, which is a sign it is the product's actual architecture rather than a
per-phase choice.

## A diagnostic that invents findings is worse than none

D9 is the one to hold on to. `collect()` treats any string containing a dot as
an entity reference, so a version number becomes a missing entity. An engineer
who learns that the readiness view reports things that are not true stops
reading it, and then it does not matter what else it reports.

So references are collected from **declared** places — profile slots, control
definitions, alarm conditions, datapoint bindings — and never by pattern-matching
values. If a reference cannot be located by declaration, it is not a reference.

## Assets: the record is the deliverable

A maintenance record exists to answer a question months later, usually to
somebody who was not there: *was this serviced, by whom, and what did they
find?* Every ASSET-01 defect destroys the answer rather than the workflow.

D22 is the sharpest: `{**old, **work_order}` overwrites in place, so completing
a work order erases who opened it and when. The completion history must be
append-only, and a correction must be a new entry that says what it corrects.

D19 — clock-derived ids — is the **third** occurrence of a defect Phase 5 and
Phase 7 each fixed once. Three occurrences is a pattern, not a coincidence, and
this phase should close it where it can be closed once rather than a fourth
time: a shared content-derived id helper both runtimes use.

## Deliberately not in this phase

- **Physical-bus or plant-write commissioning.** Out of scope for the product,
  per REQUIREMENTS. Commissioning is read-only; a live write is a separate,
  explicitly approved, bounded action and this phase does not introduce one.
- **A CMMS.** ASSET-01 asks for bounded workflows, and REQUIREMENTS explicitly
  rules out full CMMS conformance claims. Parts and documents are evidence
  attached to a completion, not an inventory system.
- **Notifying the responsible person.** Phase 6 owns notification, and its
  allowlist rules apply unchanged. This phase makes "responsible" resolvable;
  it does not add a second delivery path.
- **Remote-site simulation.** Phase 9 owns remote sites. This phase must ensure
  the remote dispatch path is *in* the enumerated block list, so Phase 9 inherits
  a gate rather than needing to remember one.

## Decisions carried in

- Server-side enforcement for everything shared; browser role checks are UX only.
- No live Home Assistant writes, plant calls, or credential handling in tests.
- No release is authorized.
- Source of truth is the authored modules and generators.
