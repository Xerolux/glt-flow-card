---
phase: 06-alarms-notifications-schedules
status: planned
asvs_level: 1
asvs_version: 5.0.0
requirements: [ALM-01, ALM-02, SCH-01]
---

# Phase 06 Threat Register

Every Phase-6 threat is a release blocker until its owner command passes against
behavioral tests and, where applicable, the exact generated artifacts. Phase 6's
threats have a shape the earlier phases did not: this is the first phase whose
subject matter is **an effect that reaches a human**. An alarm that does not
annunciate, a notification that silently fails, and a schedule that skips an hour
are all failures an operator cannot detect from inside the product, because the
product's own report of them is the thing that is wrong.

The register therefore concentrates on claims of success that are not success.
No test may contact a live Home Assistant, remote site, fieldbus, plant target or
any real notification recipient.

## ASVS L1 Mapping

| ASVS area | Phase-6 control |
|---|---|
| V1 Architecture | One backend evaluator owns alarm state; browsers render it and derive nothing time-dependent themselves. |
| V5 Validation | Alarm and schedule shapes are closed by schema 5 before any field is read; every bound is enforced before interpretation. |
| V7 Error handling & logging | Every notification and schedule execution records service, target, outcome and error. No outcome is discarded and no exception is swallowed. |
| V8 Data protection | Alarm history and schedule-run state are bounded with a configured retention; acknowledgement comments are stored as data, never interpolated into markup. |
| V13 API | Schedule authoring routes are declared in both policy tables, enforced server-side, and enumeration-filtered like every other project-scoped collection. |
| V14 Configuration | Notification targets are an explicit per-site allowlist; an unconfigured installation reaches no external recipient. |

## Canonical Threats

| ID | STRIDE | Abuse case / invariant | Owner plan | Blocking evidence | Status |
|---|---|---|---|---|---|
| T6-01 | Repudiation / Safety | Shelving reports success and suppresses nothing, so an operator believes an alarm is quiet while it still processes and notifies. Suppression is consulted at the point of decision and the decision records which suppression applied. | 06-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_suppression.py -q -x` | ✅ verified |
| T6-02 | Tampering / Safety | Two alarms on one entity share the last one's delay, because the delay is a free variable in the closure. A five-second alarm annunciates at five minutes. Each pending task carries its own delay, asserted with two different delays on one entity. | 06-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_lifecycle.py -q -x` | ✅ verified |
| T6-03 | Safety | The delay restarts on every intermediate active state, so a persistently faulty sensor that oscillates faster than the delay never annunciates at all. The delay is anchored to the first activation and is not restarted by subsequent active states. | 06-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_lifecycle.py -q -x` | ✅ verified |
| T6-04 | Repudiation / Safety | One restart re-notifies, un-acknowledges and un-shelves every active alarm, because entities pass through `unavailable` and that is classified as inactive. Restart is proven by a test that actually restarts, not one that asserts a guard exists. | 06-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_restart.py -q -x` | ✅ verified |
| T6-05 | Spoofing / Integrity | Four derivations of "is this alarm active" disagree and the authoritative one is displayed nowhere. The backend evaluates, the surfaces render, and the shipped card's evaluator is retired reachable and inert — asserted against `dist/glt-flow-card.js`, not against `src/`. | 06-15 | `node --test test/shipped-alarm-truth.test.mjs` | ✅ verified |
| T6-06 | Denial | Every state change in the whole Home Assistant instance scans every project × every alarm. An entity→alarm index bounds the cost, is rebuilt from exactly one place, and every mutation path is compared against a full rescan. | 06-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_index.py -q -x` | ✅ verified |
| T6-07 | Repudiation | A notification failure is discarded twice — `blocking=False` throws the result away and a bare `except` throws the exception away — so a delivery nobody received is indistinguishable from one they did. Every attempt records service, target, outcome and error. | 06-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_notification_delivery.py -q -x` | ✅ verified |
| T6-08 | Elevation / Tampering | `_notify_alarm` calls any domain and service named in the project document, with no allowlist, while schedules and controls both guard theirs. Notification targets are an explicit per-site allowlist checked immediately before the call; an unlisted target is a recorded refusal. | 06-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_notification_delivery.py -q -x` | ✅ verified |
| T6-09 | Safety | A delivery failure removes, downgrades or hides the alarm, so the least deliverable alarm becomes the least visible. An alarm nobody could be told about stays active, unshelved and surfaced. | 06-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_notification_delivery.py -q -x` | ✅ verified |
| T6-10 | Repudiation | Escalation duplicates across a restart, or an escalation stage fires that nobody configured. Stages are configured, deduplicated on a key that survives restart, and an unconfigured installation escalates to nobody. | 06-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_escalation.py -q -x` | ✅ verified |
| T6-11 | Safety / Correctness | A schedule in the lost hour is silently skipped and one in the ambiguous hour is saved from double-firing only by a fold-blind dedupe key. Schedules resolve to UTC instants using the site timezone and `fold`, proven against a committed corpus of transition dates. | 06-12 | `py -3.13 -m pytest tests/components/glt_flow_card/test_schedule_dst.py -q -x` | ✅ verified |
| T6-12 | Tampering | The browser preview and the Python runner disagree about a transition date, so an engineer verifies one behaviour and the plant executes another. Both runtimes are compared byte-for-byte against the shared fixture corpus. | 06-12 | `node --test test/schedule-dst-parity.test.mjs` | ✅ verified |
| T6-13 | Elevation / Information disclosure | Schedule authoring has no authorization boundary of its own — schedules are edited as project config with no route, no audit and no enumeration filter. Routes are declared in both policy tables, enforced server-side, and enumeration-filtered. | 06-13 | `py -3.13 -m pytest tests/components/glt_flow_card/test_schedule_routes.py -q -x` | ✅ verified |
| T6-14 | Repudiation | A schedule edit or a schedule execution failure leaves no audit row, so a plant that ran the wrong sequence cannot say what changed or what failed. Edits and executions, successful and failed, are audited with server provenance. | 06-13 | `py -3.13 -m pytest tests/components/glt_flow_card/test_schedule_routes.py -q -x` | ✅ verified |
| T6-15 | Tampering / Safety | A binding offers an edit the bound Home Assistant entity cannot perform — a calendar without `CREATE_EVENT`, or an authoring path for a non-admin whom `require_admin` will reject — and the failure surfaces as an opaque error or not at all. Capability is read before the affordance is offered. | 06-14 | `py -3.13 -m pytest tests/components/glt_flow_card/test_schedule_bindings.py -q -x` | ✅ verified |
| T6-16 | Denial / Integrity | Retained state grows without bound: `schedule_runs` is never pruned because its cutoff comparison is broken, `ack_alarm` inserts history with no cap, and `alarm_state` keeps entries for alarms that were remapped or deleted. Every bound is a configured number and reconciliation runs from one place. | 06-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_retention.py -q -x` | ✅ verified |
| T6-17 | Integrity | A `critical` alarm authored in the editor is counted in no roll-up, because four undeclared severity vocabularies disagree. One closed vocabulary, one declared migration for stored strings, and a test that authors in the UI and reads the roll-up. | 06-02 | `node --test test/alarm-vocabulary.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_vocabulary.py -q -x` | ✅ verified |
| T6-18 | Validation | Every field the engine reads is undeclared, so `delay_seconds: "soon"` and `time: "tea"` are schema-valid and fail at runtime inside an effect. Schema 5 closes both shapes with a sequential 4→5 migration. | 06-03 | `node --test test/v100-migrations.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q -x` | ✅ verified |
| T6-19 | Denial / Accessibility | Alarm acknowledgement, shelving and schedule editing are reachable only by pointer, or a state change is announced by colour alone, so a kiosk or screen-reader installation cannot operate the plant. Every operation has a non-pointer path and every state change is announced. | 06-17 | `node tools/run-exact-dist-playwright.mjs --grep=phase-6-alarms` | ✅ verified |
| T6-20 | Elevation / Injection | An acknowledgement comment, alarm name or schedule name authored by one operator is rendered as markup to another. Operator text is set as text content, never interpolated into markup, asserted in the shipped artifact. | 06-16 | `node tools/run-exact-dist-playwright.mjs --grep=phase-6-alarms` | ✅ verified |
| T6-21 | Tampering / Supply chain | Authored source, generated card, Companion copy, HACS stage/ZIP, HA lanes, docs or release evidence diverge; or a test causes a real service effect or reaches a real recipient. Build once, compare exact bytes, install the exact stage, fail on any unintended effect. | 06-20 | `npm run test:phase6:release` | ⏳ planned |

## Evidence Status

Every row begins `planned`. This register is written before execution and no row
may be marked `verified` from planning alone, nor from its parts passing
separately.

**Evidence status, 2026-09-02.** Twenty of the twenty-one rows are `verified`.
Each owner command was run as one command at head and passed; where two rows
name the same command, the command was run for each row rather than inferred
from the other's result. The exact-dist browser suite reported its effect ledger
with `callService: 0`, `network: []`, `dialogs: []` and `scriptInsertion: []`,
and reached the controlled fake notifier only.

T6-21 stays `planned`, for the same reason T5-16, T4-14, T3-14 and T2-16 do, and
it is an environment limit rather than a defect. Its owner is the composed
`npm run test:phase6:release` leaf. Run at head here, its first leg
`validate:hacs-staging` passes -- staging, the plugin and integration categories,
the Companion ZIP install layout and the no-publication-credentials check all
pass -- and its second leg `test:ha-artifacts` then fails before any test runs:

```
failed to connect to the docker API at unix:///var/run/docker.sock
Error: no supported Home Assistant lane passed within 12 bounded candidates
```

Every one of the twelve bounded lane candidates probes `docker info`, so no lane
resolves and the leaf cannot execute. Marking the row from the legs that do run
would be marking a composed leaf nobody composed, which is the thing this
register exists to prevent.

**A second environment limit, distinct from T6-21's.** The composed
`npm run test:phase6` gate also cannot complete in this container, and not for
T6-21's reason. Phase 6's `F6-06` runs the Phase-5 gate, which runs Phase 4's,
and so on down to `F-01 Dependency provenance`:

```
node --test test/provenance.test.mjs && node tools/verify-provenance.mjs --online
```

The first half passes. The second needs `api.github.com` to read source metadata,
and the egress proxy answers `403` for that host (`registry.npmjs.org` answers
`200` and is in the proxy's no-proxy list, so this is host-specific, not a
network outage). The recursion therefore bottoms out at Phase 1 with
`source metadata for @playwright/test request returned HTTP 403`.

This is recorded here rather than under T6-21 because the two limits are
independent: a container with a Docker engine but the same egress policy would
still fail `F-01`, and a container with unrestricted egress but no Docker engine
would still fail `test:phase6:release`. Both are environment, and neither is
evidence about the Phase-6 code.

## Effect Ledger Obligation

Phase 6 extends the effect ledger with a **notification** dimension. The existing
ledger proves zero unintended service calls; that is necessary and no longer
sufficient, because this phase's whole subject is a service call that is
*intended*. The ledger therefore also records, for every test run, each
notification attempt with its service, target and outcome, and the phase gate
asserts that the set of targets reached during the suite is exactly the
controlled fake — no `notify.*` service belonging to a real notifier, and no
recipient outside the fixture.

A test that reaches a real recipient is a HIGH finding and blocks release, even
if it passes.

## Blocking Rule

Phase closure may change a row to `verified` only when the listed owner command
passes, emits non-skipped behavioral evidence, and the Phase-6 evidence manifest
binds the command output to the exact generated artifacts. Any HIGH finding,
missing owner, skipped test, zero-test run, unbounded retention, live target,
real recipient, swallowed failure or non-zero unintended service effect blocks
release.
