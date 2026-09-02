---
phase: 08-simulation-commissioning-assets
requirements: [SIM-01, DIAG-01, ASSET-01]
---

# Phase 8 Source Audit

Twenty-six locatable defects across simulation, commissioning diagnostics and
asset maintenance. They are recorded here with file and symbol so a plan can
close one and a test can name it.

One of them is a **safety** defect rather than a correctness defect, and it
governs the shape of the whole phase.

## Simulation (SIM-01)

**D1 — `simulation.enabled` blocks nothing.** `src/v100/index.js::showSimulation`
writes `cfg.simulation.enabled` into the project document. No server path reads
it. `ws_controls_execute` (`__init__.py:1354`) calls `hass.services.async_call`
unconditionally, and `ws_remote_control` (`__init__.py:2798`) forwards an
arbitrary domain and service with no gate at all.

The only simulation check in the product is
`configured_controls.py:189`, which refuses when *that individual control
definition* carries `gates.simulation`. A control whose definition omits the
key executes for real **while the interface says "Simulationsmodus aktiv"**.

This is the phase's headline defect. SIM-01 requires that all local and remote
physical service gateways are hard-blocked while simulation is active, and the
product presently blocks nothing while claiming to block everything. An engineer
testing a design believes they are rehearsing and are in fact operating plant.

**D2 — the gate is project data.** `definition.get("gates")` is read from the
project document, which is operator input. Phase 6 established that a
safety-relevant policy is site configuration and never project data, after a
notification service name in a project document was found acting as an
authorization. Same shape, higher stakes.

**D3 — there is no virtual time.** Nothing in the product advances a clock,
replays a scenario, or produces the same result twice. A "scenario" is a state
string and a value string typed into two inputs.

**D4 — a simulated value is an unvalidated string.**
`cfg.simulation.states[item.id] = {state, value}` stores
`querySelector("[data-value]").value` verbatim: no number, no unit, no device
class, no range.

**D5 — simulated state is not marked, because nothing reads it.**
`deriveOperationalState` in `core.mjs` never mentions `simulation`. A simulated
value is stored and then displayed nowhere, so the requirement that it be
"visibly marked" is not merely unmet — the mechanism it would mark does not run.

**D6 — one simulation flag for every viewer.** `simulation.enabled` lives in the
shared project document, so one engineer's rehearsal changes what every operator
on that project sees, with no indication of who enabled it or when.

**D7 — no scenario can exist before its entities do.** SIM-01 requires building
scenarios *before entities exist*; every current path keys off `hassStates[id]`
and produces "missing" for an entity that has not been created yet.

## Commissioning diagnostics (DIAG-01)

**D8 — diagnostics run in the browser against a snapshot.**
`core.mjs::diagnoseConfig(config, hassStates)` reads the state map the card was
handed. It has no registry access, so integration, device and config-entry
provenance — which DIAG-01 requires — are not merely missing, they are
unreachable from where the code runs.

**D9 — the reference collector is a heuristic that guesses.**
`collect()` treats *any string containing a dot* as an entity id. A version
string, a filename, a decimal written as text and a hostname all become
"referenced entities", and each then reports `missing`. The diagnostic invents
its own findings.

**D10 — no unit or device-class check exists.** DIAG-01 names "wrong unit/device
class" explicitly; `diagnoseConfig` compares nothing against the profile.

**D11 — no duplicate or incompatible mapping detection.** Two slots bound to the
same entity, or an entity bound to a slot whose profile forbids its device
class, are both silent.

**D12 — no service is checked.** The criterion says "every referenced entity
**and service**". Services are never collected, so a control naming a service
that does not exist is discovered when an operator presses the button.

**D13 — the score is an invented percentage.**
`100 - issues.length / refs.size * 100` counts issues, not entities, so two
findings on one entity subtract twice and thirty findings on ten entities report
a negative score clamped to 0. It is presented as a readiness figure.

**D14 — `unused` is unbounded.** `Object.keys(hassStates).filter(...)` returns
every entity in the installation that the project does not reference. On a real
Home Assistant that is thousands of rows rendered into a modal.

**D15 — no evidence, no remediation, no provenance.** A finding is a message
string. There is no link to what produced it and no safe next step, so the view
cannot be acted on without leaving it.

**D16 — nothing proves diagnostics are read-only.** The claim is architectural,
made by inspection, and no test asserts that running a full diagnostic produces
an empty service ledger.

**D17 — staleness has no age.** `stale` reports "Seit N min nicht aktualisiert"
built from `Date.now()` in the browser, so a client with a wrong clock reports
plausible wrong ages, and the answer is not reproducible.

## Assets and maintenance (ASSET-01)

**D18 — the work-order title comes from `prompt()`.**
`src/v100/index.js::showMaintenance` collects it with `prompt("Aufgabe", …)`.
This is the third occurrence of the pattern Phase 6 closed for acknowledgement
comments and Phase 7 closed for report schedules.

**D19 — ids are minted from the clock.** `id: \`wo_${Date.now()}\``. The
identical defect Phase 5 fixed in paste and Phase 7 fixed in report runs: not
reproducible, and colliding within a millisecond. **Third occurrence.**

**D20 — two stores, never reconciled.** The browser pushes into
`cfg.work_orders` (project document) while `ws_work_orders_save` writes
`manager.data["work_orders"]` (Companion storage). Neither reads the other, so
the maintenance table an engineer sees and the one the Companion holds are
different lists that both claim to be the work orders.

**D21 — no state transitions.** `save_work_order` does
`{**old, **work_order}`: any `status` string is accepted, a completed order can
return to open, and `"banana"` is a valid status.

**D22 — no history and nothing immutable.** `updated` is overwritten in place.
Who did what, and when, is destroyed by the next save. ASSET-01 requires
immutable completion history.

**D23 — no due logic of any kind.** `due` is a date string typed by a human.
There is no interval plan, no operating-hour plan, no next-due calculation and
no reminder — four of ASSET-01's named capabilities.

**D24 — no completion evidence.** No photos, documents or parts, and therefore
no size bound, no type check and no storage accounting. The requirement asks for
bounded attachments; the product has unbounded nothing.

**D25 — the work-order store grows without limit.**
`manager.data["work_orders"]` is a dict that is only ever written to. Phase 6
named this shape: unbounded state is a leak with a friendly name.

**D26 — the responsible person is free text.** `assignee` is an arbitrary
string, not a Home Assistant user, so "who is responsible" cannot be resolved,
notified, or permission-checked.

## What is already sound and must not be disturbed

- `configured_controls.py` already refuses unsafe service domains, unknown
  controls and incomplete definitions, and Phase 4's four separated command
  outcomes are intact. Phase 8 must make the simulation block *reach* that path,
  not replace it.
- The policy table already declares `work_order.read` and `work_order.write`
  with `work_orders/list` enumerating `filter`. The boundary exists; what is
  missing is behaviour behind it.
- Phase 7's `measured_value` shape, period resolution and coverage vocabulary
  are directly reusable for operating-hour plans, and should be reused rather
  than paralleled.
