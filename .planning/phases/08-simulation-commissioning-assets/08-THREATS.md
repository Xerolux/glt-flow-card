---
phase: 08-simulation-commissioning-assets
status: verified-except-T8-25
asvs_level: 1
asvs_version: 5.0.0
requirements: [SIM-01, DIAG-01, ASSET-01]
---

# Phase 08 Threat Register

Every Phase-8 threat is a release blocker until its owner command passes against
behavioral tests and, where applicable, the exact generated artifacts.

Phase 6's threats concerned effects that fail silently. Phase 7's concerned
numbers wrong in a plausible direction. **Phase 8's concern a belief about the
plant that is wrong in a comforting direction** — "I am only rehearsing", "the
installation is ready", "that maintenance was done" — and T8-01 is a safety
threat rather than a correctness one.

No test may contact a live Home Assistant, Recorder, remote site, fieldbus,
plant target or notification recipient.

## ASVS L1 Mapping

| ASVS L1 area | Phase-8 rows |
|---|---|
| V1 Architecture | T8-01, T8-02, T8-03 |
| V4 Access control | T8-04, T8-14, T8-19 |
| V5 Validation | T8-08, T8-09, T8-15, T8-16 |
| V7 Error handling and logging | T8-05, T8-17, T8-18 |
| V8 Data protection | T8-12, T8-20, T8-21 |
| V11 Business logic | T8-06, T8-07, T8-10, T8-11, T8-13 |

## Canonical Threats

| ID | Category | Threat and the guarantee that closes it | Plan | Owner command | Status |
|---|---|---|---|---|---|
| T8-01 | Safety / Spoofing | Simulation blocks nothing: no server path reads `simulation.enabled`, so a control dispatches to the plant while the interface says a rehearsal is running. Every dispatch path consults one server-side decision at the point of dispatch, and a physical kind is refused while a session is active. | 08-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_simulation_gate.py -q -x` | ✅ verified |
| T8-02 | Safety / Elevation | The gate is a key in the project document, so operator-authored data decides whether a write reaches plant. Simulation state is site runtime state the Companion owns; a project document cannot enable, disable, or exempt itself from it. | 08-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_simulation_gate.py -q -x` | ✅ verified |
| T8-03 | Safety | A dispatch path added later forgets the gate, and the omission is invisible because the gate is applied where somebody remembered to apply it. Dispatch kinds are a closed enumeration and a test walks every declared path, so an unlisted path fails rather than dispatches. | 08-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_dispatch_enumeration.py -q -x` | ✅ verified |
| T8-04 | Safety / Denial | Simulation state cannot be read and the dispatch proceeds, so the one moment the Companion is unwell is the moment the block stops working. An unreadable state refuses every physical kind, with a reason distinct from an ordinary simulated refusal. | 08-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_simulation_gate.py -q -x` | ✅ verified |
| T8-05 | Safety / Repudiation | An alarm raised during a rehearsal is silenced along with the plant writes, so a real fault during a test goes unreported. Notification is *marked* rather than blocked, and the message states that the plant was simulated. | 08-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_simulation_gate.py -q -x` | ✅ verified |
| T8-06 | Business logic | A rehearsal never ends, so the plant cannot be operated and someone works around the block. A session carries a bounded TTL with an explicit maximum, refused rather than capped, and expires without intervention. | 08-05 | `py -3.13 -m pytest tests/components/glt_flow_card/test_simulation_session.py -q -x` | ✅ verified |
| T8-07 | Business logic / Integrity | A scenario is a state string typed into a box, so nothing is repeatable and no scenario can exist before its entities do. A scenario is a pure function from definition and tick to state, reproducible byte for byte and evaluated without reading the state machine. | 08-04 | `py -3.13 -m pytest tests/components/glt_flow_card/test_scenarios.py -q -x` | ✅ verified |
| T8-08 | Validation | A simulated value is an unvalidated string with no unit, type or range, so a scenario asserts something the entity could never report. Simulated values are validated against the profile's declared unit and device class before a scenario is saved. | 08-04 | `py -3.13 -m pytest tests/components/glt_flow_card/test_scenarios.py -q -x` | ✅ verified |
| T8-09 | Spoofing / Safety | Simulated state is indistinguishable from measured state on screen, so a successful rehearsal reads as commissioned plant. Every simulated value is marked as text and shape wherever it appears, and the provider is stated. | 08-14 | `node tools/run-exact-dist-playwright.mjs --grep=phase-8-simulation` | ✅ verified |
| T8-10 | Integrity | Diagnostics run in the browser against a state snapshot, so registry provenance is unreachable and two clients disagree about readiness. The diagnostic is computed by the Companion from the registries and the state machine, and the browser renders its answer. | 08-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-11 | Integrity / Denial | The reference collector treats any string containing a dot as an entity, so a version string is reported as a missing entity and the view reports things that are not true. References are collected from declared locations only, and each finding names where it came from. | 08-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-12 | Denial | `unused` returns every entity in the installation that the project does not reference, unbounded, rendered into a modal. Suggestions are bounded and the bound is stated in the answer. | 08-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-13 | Integrity | "Registered but not loaded", "unregistered", and "missing" are collapsed into one `missing` finding, sending an engineer to look for a typo when an integration failed to set up. The registry and the state machine are two questions and the four combinations are four diagnoses. | 08-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-14 | Tampering | A commissioning run performs a write, so asking whether the plant is ready changes it. A full diagnostic run is proven to produce an empty service ledger, by execution rather than by inspection. | 08-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-15 | Validation | A referenced service that does not exist is discovered when an operator presses the button. Services are collected and checked alongside entities, and a missing service is a finding with the control that names it. | 08-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-16 | Validation | A binding whose unit or device class contradicts the profile is silent, as is one entity bound to two slots. Unit, device class and duplicate bindings are checked against profile expectations and reported with both sides named. | 08-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-17 | Repudiation | A readiness score is `100 - issues/refs*100`, so two findings on one entity subtract twice and the number is presented as a percentage of readiness. Readiness is stated as counts per diagnosis with no invented aggregate, or an aggregate whose definition is written down and tested. | 08-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| T8-18 | Repudiation / Integrity | A work order is overwritten in place, so completing one erases who opened it and when, and a "completed" record cannot be distinguished from a rewritten one. Entries are append-only and a correction is a new entry naming what it corrects. | 08-12 | `py -3.13 -m pytest tests/components/glt_flow_card/test_work_orders.py -q -x` | ✅ verified |
| T8-19 | Business logic | Any status string is accepted, so a completed order can silently return to open. Transitions are a closed table checked before an entry is appended, and a reopen is its own transition with a reason. | 08-12 | `py -3.13 -m pytest tests/components/glt_flow_card/test_work_orders.py -q -x` | ✅ verified |
| T8-20 | Denial / Data protection | Attachments and work orders grow without bound, and an attachment has no size, count or type limit. Both are bounded with stated limits, refused rather than truncated, and the oldest completed history is retained by an explicit policy. | 08-13 | `py -3.13 -m pytest tests/components/glt_flow_card/test_work_orders.py -q -x` | ✅ verified |
| T8-21 | Integrity | Due dates are typed by hand with no interval or operating-hour plan, so "next due" is whatever someone last wrote. Due logic is computed from a declared plan, reuses Phase 7's period and measured-value vocabulary, and an operating-hour plan states its coverage. | 08-15 | `py -3.13 -m pytest tests/components/glt_flow_card/test_maintenance_plans.py -q -x` | ✅ verified |
| T8-22 | Repudiation | Ids are minted from the clock for the third time in this codebase, so no asset record is reproducible and two created in the same millisecond collide. Ids are content-derived through one shared helper both runtimes use. | 08-03 | `node --test test/content-id.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_content_id.py -q -x` | ✅ verified |
| T8-23 | Elevation / Injection | An asset name, work-order note or scenario label authored by one user is rendered as markup to another. Operator text is set as text content and never interpolated into markup, asserted structurally in the shipped artifact. | 08-14 | `node tools/run-exact-dist-playwright.mjs --grep=phase-8-simulation` | ✅ verified |
| T8-24 | Denial / Accessibility | A commissioning or maintenance workflow is unreachable without a pointer, or a state is announced by colour alone. Every workflow is keyboard-reachable and every state is announced as text, asserted against the generated artifact. | 08-14 | `node tools/run-exact-dist-playwright.mjs --grep=phase-8-simulation` | ✅ verified |
| T8-25 | Tampering / Supply chain | Authored source, generated card, Companion copy, HACS stage/ZIP, HA lanes, docs or release evidence diverge; or a test reaches a live service, a real plant target, or exceeds a declared bound. Build once, compare exact bytes, install the exact stage, fail on any unintended effect. | 08-16 | `npm run test:phase8:release` | ⏳ planned |

## Evidence Status

Every row begins `planned`. This register is written before execution and no row
may be marked `verified` from planning alone, nor from its parts passing
separately, nor from a sibling row that names the same command.

Two rules are carried forward from every closure since Phase 6, and they apply
to every row here:

**A row is marked from its own owner command, run at head.** Where two rows name
the same command, the command is run for each row rather than inferred from the
other's result.

**An artifact grep is not evidence that a surface works.** Any row whose evidence
is a grep over `dist/` needs a second assertion that renders the surface and
reads the value. T7-22 made that blocking for Phase 7 and found the phase
repeating Phase 6's defect; the same requirement stands here.

### Closed on 2026-09-02

T8-01 through T8-24 are `verified`, each marked from **its own** owner command
run at head. Where rows share a command the command was run for each row rather
than credited once: `test_simulation_gate.py` ran separately for T8-01, T8-02,
T8-04 and T8-05, `test_commissioning.py` for each of T8-10 through T8-17, and
the exact-dist suite for each of T8-09, T8-23 and T8-24.

**Two owner commands named files that did not exist**, which is the register
doing its job rather than a bookkeeping problem: the session tests had been
written inside `test_simulation_gate.py` and the scenario tests existed only as
a manual check. Both were written where the register says they live, rather than
the register edited to match what happened to exist.

### The paired outcome assertion

T8-09, T8-23 and T8-24 are grep-adjacent rows, so per the Blocking Rule each
carries an assertion that renders the surface and reads the value. T8-09's is the
one that matters: the test injects a stylesheet forcing every colour to black on
white and then requires the word *and* the shape to still be present.
Mutation-verified — marking by colour alone fails with "the word is missing with
colour removed".

### Three defects the tests found while being written

**`bool(None)` is `False`.** `decide_dispatch` coerced a missing simulation
reader to "not simulating", which is a silent fail-*open* in the module whose
entire purpose is failing closed. Found by the test written to assert the
opposite.

**The exemption list was empty.** `test_dispatch_enumeration.py` was written
expecting two justified exemptions — the notification path, and the remote
transport "gated close enough by the handler above". Both were wrong: a marked
effect still has to *ask* (that is how it learns to mark itself), and "the
handler above it" is exactly the reasoning that produces a gate with the shape
of somebody's memory. All five effect call sites consult the decision directly.

**The browser's content-id mirror stringified numbers.** Every id containing a
number differed between runtimes, and a corpus of string-only payloads passed.
That is worse than the clock-derived ids it replaces: it looks stable and is not.

### Blocked, with its exact failure

**T8-25 stays `planned`.** Its own owner command, `npm run test:phase8:release`,
was run at head and failed:

```
failed to connect to the docker API at unix:///var/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /var/run/docker.sock: connect: no such file or directory
FAIL minimum probe HA 2024.8.0: docker info --format {{.ServerVersion}}/{{.OSType}}/{{.Architecture}} failed with status 1
```

Same reason T7-23, T6-21, T5-16, T4-14, T3-14 and T2-16 stayed `planned`: the
leaf installs the exact HACS stage on digest-pinned Home Assistant images and
this container has no Docker engine. It is not marked from its parts passing
individually — the error Phase 5's closure made and Phase 6's corrected.

The three other environment limits Phase 7 recorded are unchanged and still
apply: the container's Playwright browser revision (1194 against an expected
1234, so the exact-dist rows above rest on the documented
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` override), GitHub API access scoped to this
session's own repository, and the CI-side Home Assistant harness version pin.

## Effect Ledger Obligation

Every Phase-8 test emits a `PHASE8_*_EFFECTS` line carrying the counts that must
be zero: `service`, `network`, `remote`, `notification`. A simulation test that
proves a refusal while some other path dispatched has proven nothing, and the
ledger is what makes that visible rather than argued.

## Blocking Rule

A live service call, a plant target reached during simulation, an invented
diagnostic finding, an overwritten maintenance record, or a non-zero unintended
effect blocks release.
