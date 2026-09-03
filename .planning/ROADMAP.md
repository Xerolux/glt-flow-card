# Roadmap: GLT Flow Card

## Overview

Milestone v1.1 hardens the existing Platform 1.0 surface as ten dependency-ordered vertical slices. Each phase connects the authored domain model, runtime/editor experience, authoritative Companion behavior, executable tests, documentation, and generated artifacts where applicable. Security, schema and migration safety, German/English localization, accessibility, realistic failure/load evidence, and artifact equality begin in the earliest responsible phase and remain acceptance gates through release.

## Phases

**Phase Numbering:** Integer phases are planned milestone work; decimal phases are reserved for urgent insertions.

- [x] **Phase 1: Trusted Contract & Release Foundation** - Make project data, Companion lifecycle, migrations, and shipped artifacts safe and reproducible. (completed 2026-09-01)
- [x] **Phase 2: Authoritative Policy, Controls & Collaboration** - Enforce server-owned permissions, exact control targets, trustworthy audit, and conflict-safe shared editing.
- [x] **Phase 3: Semantic Equipment & Provenance** - Establish stable semantics, profiles, mapping, provenance, and deterministic operational state.
- [x] **Phase 4: Runtime Operations & Drill-Down** - Deliver profile-driven plant operation with confirmed commands and permission-safe contextual navigation.
- [x] **Phase 5: CAD Engineering & Extension Platform** - Deliver the verified catalog, typed connectivity, deterministic routing, transactional CAD, and declarative SDK.
- [x] **Phase 6: Alarms, Notifications & Schedules** - Make time-sensitive operational workflows authoritative, restart-safe, observable, and timezone-correct.
- [x] **Phase 7: Trends, Energy & Reproducible Reports** - Turn Recorder data into honest trends, unit-safe energy views, and matching period reports.
- [x] **Phase 8: Safe Simulation, Commissioning & Assets** - Support pre-commissioning scenarios, read-only diagnostics, and bounded maintenance workflows without plant-write risk.
- [x] **Phase 9: Failure-Isolated Multi-Site Supervision** - Supervise authorized remote Home Assistant sites without credential exposure, policy bypass, or global failure.
- [x] **Phase 10: Product-Wide Usability & Release Evidence** - Close localization, accessibility, capacity, compatibility, and exact-artifact release evidence across all workflows.

## Phase Details

### Phase 1: Trusted Contract & Release Foundation

**Goal**: Existing and new projects can be validated, migrated, compared, installed, upgraded, and shipped without data loss, lifecycle leaks, or generated-artifact drift.
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, DIFF-01, HACS-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. The frontend and Companion accept and reject the same valid, invalid, historical, malformed, and boundary fixtures before normalization, with bounded JSON Schema 2020-12 path errors that an engineer can act on.
  2. An engineer can dry-run sequential migrations, inspect semantic changes, selectively apply them, and restore a verified backup after an injected failure without changing the original project or losing custom assets.
  3. A Home Assistant administrator can clean-install, upgrade, reload, and unload the Companion in declared minimum/current HA lanes; options alter runtime behavior, migration-safe split stores retain data, and unload leaves no listeners, tasks, WebSocket registrations, or manager state behind.
  4. A clean checkout produces one traceable card build whose committed `dist`, Companion `www`, and other generated release copies are byte-equal to the canonical output and whose package manifest/checksums identify the exact sources.
  5. Executable Python and browser checks prove schema parity, archive safety, migration rollback, extension registration order, install/upgrade/unload, and artifact equality; source-token assertions alone cannot pass the phase.

**Known defects closed**: Generated source/runtime drift, disconnected Config Flow options, unsafe single-store migration, weak input bounds at project/bundle boundaries, and `async_unload_entry` reporting success while leaving runtime registrations active.
**Research flag**: Confirm the supported minimum/current Home Assistant matrix and the exact HACS packaging model for the dashboard artifact plus Companion.
**Plans**: 13 plans across 11 dependency-ordered waves

  - Wave 0: `01-01` — dependency provenance allowlist and verifier
  - Wave 1: `01-02` — executable Node, Python/HA, and exact-dist browser harness
  - Wave 2: `01-03` — canonical raw schemas, limits, policy, and shared fixtures
  - Wave 3: `01-04` — JavaScript/Python raw-contract parity
  - Wave 4: `01-05` — immutable migrations and semantic selective diff
  - Wave 5: `01-06` safe bundles; `01-07` split stores and journaled transactions
  - Wave 6: `01-08` — Config Entry lifecycle, options, localization, diagnostics
  - Wave 7: `01-09` — deterministic single-source build and drift verification
  - Wave 8: `01-10` local HACS category staging; `01-11` Project-safety UI
  - Wave 9: `01-12` — immutable minimum/current HA lane and exact-artifact proof
  - Wave 10: `01-13` — release acceptance, evidence, and bilingual guidance

**UI hint**: yes

### Phase 2: Authoritative Policy, Controls & Collaboration

**Goal**: Every shared read, mutation, subscription, control, remote operation, and audit decision is server-authorized, while concurrent engineers cannot overwrite one another.
**Depends on**: Phase 1
**Requirements**: SEC-01, COLLAB-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Authenticated Viewer, Operator, Engineer, and Admin test users receive only their server-owned, default-deny project capabilities across every query, command, subscription, list/count, remote action, and audit read, and no user can create or edit ACLs beyond Home Assistant authority.
  2. A control request names a configured control, the Companion overwrites caller targets with the exact project-owned entity/service payload, rejects unexpected or oversized data, and records the normalized target, actor, acceptance, readback, timeout, or failure result.
  3. Security events use server timestamps and identities, distinguish trusted audit records from bounded client telemetry, paginate safely, and remain queryable only by authorized users.
  4. Two browser sessions prove atomic expected-revision plus lease-token saves, renewal, expiry, reconnect, unauthorized/unlocked denial, conflict detection, and non-destructive merge/retry/recovery without a lost update.
  5. A shared project becomes read-only when Companion authority is unavailable and never falls back to direct privileged browser calls; local standalone engineering remains explicitly separate.

**Known defects closed**: Advisory-only locks, optional revision checks, broad authenticated read exposure, caller-selected control/audit mismatch, arbitrary client-authored audit events, self-selected new-project privileges, and unbounded shared API inputs.
**Plans**: 17 plans across 14 dependency-ordered waves

Plans:
- [ ] 02-01-PLAN.md — Establish authenticated principals, strict RED classification, effects and threat scaffolding.
- [ ] 02-02-PLAN.md — Specify deny-default policy, server ACL, revocation and cursor RED contracts.
- [ ] 02-03-PLAN.md — Specify lease, atomic mutation and merge RED contracts.
- [ ] 02-04-PLAN.md — Specify configured-control, trusted evidence, migration and lifecycle RED contracts.
- [ ] 02-05-PLAN.md — Specify reducer and two-browser exact-dist RED contracts.
- [ ] 02-06-PLAN.md — Implement centralized policy and authorized server-owned reads.
- [ ] 02-07-PLAN.md — Implement bounded membership administration, subscriptions and opaque cursors.
- [ ] 02-08-PLAN.md — Implement connection-bound purpose leases.
- [ ] 02-09-PLAN.md — Implement immediate-precommit mutation guards and bounded merge recovery.
- [ ] 02-10-PLAN.md — Implement trusted evidence and separate telemetry repositories.
- [ ] 02-11-PLAN.md — Implement configured controls and one-attempt evidence lifecycle.
- [ ] 02-12-PLAN.md — Implement fail-closed authority UI and evidence surfaces.
- [ ] 02-13-PLAN.md — Implement collaboration, conflicts, candidate recovery and control UI.
- [ ] 02-14-PLAN.md — Close conservative migration and resource-zero lifecycle.
- [ ] 02-15-PLAN.md — Build, stage and test exact HACS artifacts on both HA lanes.
- [ ] 02-16-PLAN.md — Close bilingual authority/collaboration docs and exact Pages/Wiki workflow delivery.
- [ ] 02-17-PLAN.md — Close threats, validation, fail-closed evidence and no-rebuild release acceptance.
**UI hint**: yes

### Phase 3: Semantic Equipment & Provenance

**Goal**: Operators and engineers work from one validated semantic equipment model whose identity, provenance, mappings, profiles, and operational state agree everywhere.
**Depends on**: Phase 2
**Requirements**: OPS-01, SEM-01, MAP-01, PROF-01, PROTO-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. An engineer can model stable Site → Building → Floor → System → Subsystem → Equipment → Datapoint relationships with validated tags, units, media, and directions; invalid references and cycles fail in both runtimes, while valid semantic paths drive permission checks, navigation, diagnostics, and roll-ups.
  2. Datapoints show integration, device, config-entry, and communication-health provenance from Home Assistant registries for BACnet, Modbus, KNX, OPC UA, and other sources without name-based protocol guesses.
  3. A versioned equipment profile can be instantiated repeatedly with identity, slots, controls, state signals, alarms, typed ports, diagnostics, maintenance metadata, compatible symbols, and migration-safe instance overrides preserved across round trips.
  4. The designer explains ranked registry/device/area/profile mapping candidates, previews a semantic diff, requires acceptance, preserves manual overrides, supports undo, and passes realistic tested iDM profile fixtures.
  5. Representative live, stale, invalid, unavailable, pending, failed, manual/local, interlocked, maintenance, warning/fault, running/standby/off fixtures produce one severity-ranked state whose symbol, quality, freshness, German/English accessible label, and drill-down evidence agree.

**Known defects closed**: Browser/domain rule divergence, unstable or weakly validated semantic identities, name-inferred provenance, silent unsafe auto-binding, and unproven operational-state token claims.
**Plans**: 17 plans across 11 dependency-ordered waves

Plans:
- [ ] 03-01-PLAN.md — Stand up registry fixtures, iDM corpus, sentinel keys and command scripts.
- [ ] 03-02-PLAN.md — Specify the hierarchy, cycle and vocabulary RED contracts.
- [ ] 03-03-PLAN.md — Specify provenance, communication health and their authorization RED contracts.
- [ ] 03-04-PLAN.md — Specify profile, mapping, state and exact-dist UI RED contracts.
- [ ] 03-05-PLAN.md — Introduce schema 3 and the sequential 2-3 migration.
- [ ] 03-06-PLAN.md — Implement containment, cycle rejection, bounds and closed vocabularies.
- [ ] 03-07-PLAN.md — Integrate the new collections into diff, closure and bundles.
- [ ] 03-08-PLAN.md — Implement registry-derived provenance, health and its authorized route.
- [ ] 03-09-PLAN.md — Bind the provenance cache to the runtime generation.
- [ ] 03-10-PLAN.md — Implement versioned profiles and override-preserving upgrades.
- [ ] 03-11-PLAN.md — Expose profile instantiation and upgrade as guarded mutations.
- [ ] 03-12-PLAN.md — Implement explained, dual-runtime mapping ranking.
- [ ] 03-13-PLAN.md — Expose ranking, acceptance and undo without automatic binding.
- [ ] 03-14-PLAN.md — Implement the deterministic operational-state precedence.
- [ ] 03-15-PLAN.md — Build the semantic, provenance, mapping and state surfaces.
- [ ] 03-16-PLAN.md — Document the Phase-3 contract in English and German.
- [ ] 03-17-PLAN.md — Package the new modules and close the Phase-3 gate.
**UI hint**: yes

### Phase 4: Runtime Operations & Drill-Down

**Goal**: Operators can understand and safely operate profile-driven equipment from portfolio to datapoint with contextual, accessible, permission-filtered navigation.
**Depends on**: Phase 3
**Requirements**: OPS-02, NAV-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Every supported profile opens a consistent object panel showing standard values, alarms, Recorder trends, hours/starts, quality/freshness, and only the controls permitted by the Companion, without hand-designed popups.
  2. Commands visibly and separately reach accepted, readback-confirmed, timed-out, and failed outcomes, and browser E2E evidence proves the displayed target/result matches the Companion’s authoritative audit record.
  3. Users can deep-link and use browser history through portfolio/site, plant, subsystem, equipment, datapoint, alarm, and trend views while breadcrumbs preserve time/alarm context and unauthorized links or aggregate counts never appear or resolve.
  4. Snapshot/event reconnect and sequence-gap scenarios resynchronize incremental views without presenting stale data as live or requiring a full page reload.
  5. The exact generated card completes the runtime workflow by keyboard and assistive labels in German and English at mobile, tablet, widescreen, and secure kiosk/leitstand layouts with visible focus, non-color state cues, and no direct-service security fallback.

**Known defects closed**: Browser-invented permissions/state, optimistic service success, direct privileged fallbacks, unauthorized aggregate leakage, and prototype-load behavior that token tests never execute.
**Plans**: 17 plans across 13 dependency-ordered waves

Plans:
- [ ] 04-01-PLAN.md — Stand up the Phase-4 sentinels, operations corpus and effect ledger.
- [ ] 04-02-PLAN.md — Specify the panel composition, enumeration and view-stream RED contracts.
- [ ] 04-03-PLAN.md — Specify the address resolution and aggregate-count RED contracts.
- [ ] 04-04-PLAN.md — Specify the panel, navigation, outcome, resync and exact-dist UI RED contracts.
- [ ] 04-05-PLAN.md — Compose the profile-driven object panel on the server.
- [ ] 04-06-PLAN.md — Implement the sequenced, bounded view stream.
- [ ] 04-07-PLAN.md — Implement bounded, re-authorized address resolution.
- [ ] 04-08-PLAN.md — Compute aggregate counts over the authorized scope only.
- [ ] 04-09-PLAN.md — Make the address the whole navigation state.
- [ ] 04-10-PLAN.md — Render the server-composed panel without adding browser authority.
- [ ] 04-11-PLAN.md — Present the nine control states as separated operator outcomes.
- [ ] 04-12-PLAN.md — Detect sequence gaps honestly and resync without stale-as-live.
- [ ] 04-13-PLAN.md — Ship the operations surfaces and retire the legacy operate path.
- [ ] 04-14-PLAN.md — Close the Phase-4 lifecycle and packaging obligations.
- [ ] 04-15-PLAN.md — Close the exact-dist accessibility and localization matrix.
- [ ] 04-16-PLAN.md — Document the Phase-4 contract in English and German.
- [ ] 04-17-PLAN.md — Build the Phase-4 gate and close the phase honestly.
**UI hint**: yes

### Phase 5: CAD Engineering & Extension Platform

**Goal**: Engineers can construct and exchange large, semantically valid diagrams with deterministic geometry, transactional editing, and bounded declarative extensions.
**Depends on**: Phase 4
**Requirements**: CAT-01, ENG-01, ENG-02, CAD-01, SDK-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Engineers can search and filter at least 300 generated, unique, semantically valid symbol variants across the required domains/styles, and catalog evidence plus state/contrast visual tests prove the published count and behavior.
  2. Profile ports expose medium, direction, signal/power, multiplicity, and preferred side; incompatible connections are blocked with an explanation, while valid connections preserve stable endpoint IDs through edits, copy/paste, bundles, and migrations.
  3. The router produces repeatable orthogonal, obstacle-avoiding paths with direction/medium rules, stable junctions/T-pieces, clear crossings, parallel spacing, and bounded incremental rerouting after moves in realistic browser scenarios without freezing the editor.
  4. Layers, locking, z-order, guides/snapping, alignment/distribution, lasso/multi-select, ID-remapped cross-project copy/paste, search, minimap, nested groups, masters, undo/redo, shortcuts, and non-pointer alternatives behave as reversible transactions.
  5. Separately installed namespaced SDK contributions for symbols, profiles/templates, renderers/widgets/panels, and translations pass manifest/version/conflict/compatibility checks, survive schema-safe exchange, and cannot introduce arbitrary privileged project-script execution.

**Known defects closed**: Unproven catalog-count claims, unstable/detached routes, synchronous full reroutes, pointer-only editing gaps, executable bundle/plugin risk, and fragile prototype registration without behavioral compatibility tests.
**Research flag**: Define trusted SDK installation, review, distribution, and compatibility policy; same-realm JavaScript is not treated as a sandbox. **Answered 2026-09-02:** contributions are data; no contributed code executes in any realm (05-RESEARCH section 5). The executable alternative and public pack distribution are deferred and recorded in [FUTURE-ROADMAP.md](FUTURE-ROADMAP.md) as F-01 and F-02.
**Plans**: 20 plans across 8 dependency-ordered waves

Plans:
- [x] 05-01-PLAN.md — Stand up the Phase-5 gate, CAD corpus and extended effect ledger.
- [x] 05-02-PLAN.md — Specify the catalog evidence and typed-port RED contracts.
- [x] 05-03-PLAN.md — Specify the routing, designer and SDK RED contracts.
- [x] 05-04-PLAN.md — Introduce schema 4 and the sequential 3-4 migration.
- [x] 05-05-PLAN.md — Generate catalog evidence and fill the fire/electrical domain.
- [x] 05-06-PLAN.md — Prove state and contrast legibility, and ship the symbol browser.
- [x] 05-07-PLAN.md — Implement typed ports and explained compatibility refusal.
- [x] 05-08-PLAN.md — Make endpoint identity survive edits, bundles and migration.
- [x] 05-09-PLAN.md — Establish routing determinism as the precondition for the rest.
- [x] 05-10-PLAN.md — Implement obstacle-aware geometry, junctions, crossings and spacing.
- [x] 05-11-PLAN.md — Make rerouting incremental and retire the eight-line router.
- [x] 05-12-PLAN.md — Model editing as commands with proven inverses.
- [x] 05-13-PLAN.md — Implement id-remapping cross-project copy and paste.
- [x] 05-14-PLAN.md — Ship the designer surfaces and retire the legacy editor dialogs.
- [x] 05-15-PLAN.md — Close the non-pointer editing workflow as one keyboard scenario.
- [x] 05-16-PLAN.md — Define the data-only contribution format and prove nothing executes.
- [x] 05-17-PLAN.md — Make extension installation atomic, namespaced and version-checked.
- [x] 05-18-PLAN.md — Close the Phase-5 lifecycle and packaging obligations.
- [x] 05-19-PLAN.md — Document the Phase-5 contract in English and German.
- [x] 05-20-PLAN.md — Build the Phase-5 gate and close the phase honestly.
**UI hint**: yes

### Phase 6: Alarms, Notifications & Schedules

**Goal**: Operators can rely on one restart-safe alarm lifecycle, observable notification escalation, and audited Home Assistant-backed schedule execution.
**Depends on**: Phase 5
**Requirements**: ALM-01, ALM-02, SCH-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Controlled-time tests and the runtime UI agree on priority/class, condition, delay, hysteresis, active/returned/acknowledged state, acknowledgement comment, shelving expiry, maintenance suppression, bounded history/deduplication, and direct plant/equipment/trend links across restart.
  2. Multiple alarms on one entity retain their own delays, cancel pending tasks deterministically, suppress shelved/maintenance occurrences and notifications, and reactivate correctly after clear, acknowledgement, restart, and simultaneous state changes.
  3. Immediate and delayed escalation reaches only configured Home Assistant notification services/recipients, records every attempt/result, avoids restart duplicates, and surfaces delivery failure without hiding or discarding the alarm.
  4. Engineers can create or bind weekly schedules, holidays, exceptions, vacations, special days, and operating periods through supported HA schedule/calendar/script capabilities, preview the effective value across timezone/DST cases, and inspect audited execution failures.
  5. Python HA and exact-card browser tests exercise transitions, denial, malformed input, restart, notifier failure, schedule failure, German/English text, keyboard/focus announcements, and generated-artifact equality rather than checking for lifecycle keywords.

**Known defects closed**: Shelving that does not suppress processing/notifications, loop-closure delay tasks using the wrong delay, full alarm scans on every state change, split browser/backend lifecycle truth, duplicate restart notifications, and swallowed schedule/notification failures.
**Research flag**: RESOLVED 2026-09-02 — see `06-RESEARCH.md`. HA 2026.2.3 supports schedule authoring over `schedule/create|update|delete` (admin-gated), calendar authoring via `calendar.create_event` gated on `CalendarEntityFeature.CREATE_EVENT`, and per-Bundesland holidays via `binary_sensor.workday`. The alarm philosophy is configuration with conservative defaults, decided with the user; the priority vocabulary is the one deliberate exception.
Plans:
- [x] 06-01-PLAN.md — Stand up the Phase-6 gate, the notification-aware effect ledger and the alarm corpus.
- [x] 06-02-PLAN.md — Close the alarm vocabulary and migrate the four that disagree.
- [x] 06-03-PLAN.md — Introduce schema 5 and the sequential 4-5 migration.
- [x] 06-04-PLAN.md — Specify the lifecycle, suppression, restart, index and retention RED contracts.
- [x] 06-05-PLAN.md — Specify the notification, escalation, schedule, DST and shipped-truth RED contracts.
- [x] 06-06-PLAN.md — Build the lifecycle engine with per-alarm and anchored delays.
- [x] 06-07-PLAN.md — Make suppression real, consulted where the decision is made.
- [x] 06-08-PLAN.md — Make the lifecycle restart-safe and re-arm pending delays.
- [x] 06-09-PLAN.md — Index the alarm scan and prove the index cannot go stale.
- [x] 06-10-PLAN.md — Bound retention and reconcile alarm state against the project.
- [x] 06-11-PLAN.md — Make notification and escalation recorded, allowlisted and failure-visible.
- [x] 06-12-PLAN.md — Resolve schedules to instants and prove both runtimes agree across DST.
- [x] 06-13-PLAN.md — Give schedules routes, authorization, enumeration filtering and audit.
- [x] 06-14-PLAN.md — Bind schedules to supported Home Assistant capabilities.
- [x] 06-15-PLAN.md — Retire the second, third and fourth alarm evaluators.
- [x] 06-16-PLAN.md — Ship the alarm surface: list, detail, acknowledgement and shelving.
- [x] 06-17-PLAN.md — Ship the schedule surface and the DST preview.
- [x] 06-18-PLAN.md — Ship the alarm philosophy as configuration with conservative defaults.
- [x] 06-19-PLAN.md — Document the Phase-6 contract in English and German.
- [x] 06-20-PLAN.md — Build out the Phase-6 gate and close the phase honestly.
**UI hint**: yes

### Phase 7: Trends, Energy & Reproducible Reports

**Goal**: Users can inspect honest Recorder history, reproduce unit-safe energy periods, and generate reports whose screen and exports share one verified data model.
**Depends on**: Phase 6
**Requirements**: HIST-01, ENER-01, REPORT-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Bounded Recorder raw/statistics queries expose aggregation, deadband, interpolation policy, quality/gaps/coverage, alarm markers, two cursors, comparison ranges, zoom/statistics, templates, exports, and explicit retention/source provenance without claiming a separate historian.
  2. Electricity, heat, cooling, water, gas, PV, battery, tariffs, costs, CO2, virtual meters, peak demand, and building/plant comparisons use compatible units, reset-aware meter math, missing-data coverage, and reproducible day/month/year boundaries.
  3. Engineers can version branded period reports from selected KPIs, trends, alarms, energy, coverage, and maintenance data; on-demand, scheduled, and event runs yield matching screen, CSV, and print-PDF values and record inputs, results, and delivery attempts.
  4. Missing, partial, stale, incompatible, and Recorder-failure fixtures never become false zero/normal values, and rerunning a recorded period reproduces the same result or reports an explicit provenance change.
  5. Supported HA-lane integration tests and exact-artifact browser tests cover bounded queries/exports, date/time/DST, German/English formatting, keyboard-accessible chart alternatives, print layout, schedule/restart failure, and representative history volumes.

**Known defects closed**: KPI-snapshot-only reports, omission of alarm and maintenance content, in-memory utility behavior presented as a historian, missing-as-zero analytics, unbounded exports, and Recorder API behavior untested against Home Assistant.
**Research flag**: RESOLVED 2026-09-02 — see `07-RESEARCH.md`. HA 2026.2.3 already resolves `day`, `week`, `month` and `year` on local-midnight boundaries in the configured timezone (measured: 23- and 25-hour days, 743- and 745-hour months for Europe/Berlin), `change` is reset-aware over the Recorder's reset-corrected running sum, and `year` is reachable only through `recorder/statistic_during_period`'s calendar spec. Three traps recorded with owners: a window starting before a statistic exists reports the whole accumulated total as the first period's consumption; gaps are omitted from results rather than emitted; and `mean_type` CIRCULAR exists. Nothing in the Recorder API bounds a raw query, so bounds are ours and belong server-side.
Plans:
- [x] 07-01-PLAN.md — Stand up the Phase-7 gate, the query-dimension effect ledger and the Recorder fixture corpus.
- [x] 07-02-PLAN.md — Close the measured-value shape and the period vocabulary in both runtimes.
- [x] 07-03-PLAN.md — Introduce schema 6 and the sequential 5-6 migration.
- [x] 07-04-PLAN.md — Specify the history route, bounds, coverage and replay RED contracts.
- [x] 07-05-PLAN.md — Specify the period, energy, report and rendering RED contracts.
- [x] 07-06-PLAN.md — Resolve named periods on local-calendar boundaries.
- [x] 07-07-PLAN.md — Prove both runtimes resolve periods identically.
- [x] 07-08-PLAN.md — Give history its own routes, authorization, filtering and audit.
- [x] 07-09-PLAN.md — Bound every query dimension and refuse past the bound.
- [x] 07-10-PLAN.md — Carry coverage and gaps with every series.
- [x] 07-11-PLAN.md — Make replay read the record, not the present.
- [x] 07-12-PLAN.md — Difference counters and integrate rates over resolved periods.
- [x] 07-13-PLAN.md — Validate units and state exclusions before arithmetic.
- [x] 07-14-PLAN.md — Record what a report run was computed from.
- [x] 07-15-PLAN.md — Execute report schedules through the Phase-6 runner.
- [x] 07-16-PLAN.md — Derive screen, CSV and print from one model.
- [x] 07-17-PLAN.md — Retire the six browser evaluators reachable and inert.
- [x] 07-18-PLAN.md — Ship the trend and report surfaces.
- [x] 07-19-PLAN.md — Prove every retired value is reached, not merely reachable.
- [x] 07-20-PLAN.md — Build out the Phase-7 gate and close the phase honestly.
**UI hint**: yes

### Phase 8: Safe Simulation, Commissioning & Assets

**Goal**: Engineers can test designs, diagnose readiness, and manage bounded equipment maintenance without any simulation or commissioning path reaching physical services.
**Depends on**: Phase 7
**Requirements**: SIM-01, DIAG-01, ASSET-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Engineers can run repeatable virtual-time value, pump, valve, sequence, and fault scenarios before entities exist; every simulated value is visibly marked and local/remote physical service gateways remain hard-blocked under direct, reconnect, and failure-injection attempts.
  2. A read-only commissioning view lists every referenced entity/service as OK, unavailable, unknown, stale with age, missing, wrong unit/device class, duplicate/incompatible, or unused, with registry provenance, evidence, and remediation links that do not perform writes.
  3. Equipment assets support interval/operating-hour plans, responsible people, due/overdue and next-due calculation, reminders, valid work-order transitions, immutable completion history, and bounded photos/documents/parts evidence.
  4. Profile, alarm, history, and asset context remains linked while simulation and live state providers are clearly separated, so users cannot confuse simulated success with commissioned plant evidence.
  5. Deterministic backend/browser tests prove virtual-time replay, all service denials, diagnostic accuracy, due/reset math, invalid transitions, oversized/unsafe attachment rejection, German/English accessible workflows, and exact generated-card behavior.

**Known defects closed**: Simulation/commissioning write reachability risk, non-repeatable diagnostic claims, weak work-order input bounds, uncontrolled attachment/storage growth, and maintenance calculations without executable evidence.
**Plans**: 16
**UI hint**: yes

- [x] 08-01-PLAN.md — Stand up the Phase-8 gate, the dispatch effect ledger and the scenario and registry corpora.
- [x] 08-02-PLAN.md — Close the dispatch, diagnosis and transition vocabularies, and introduce schema 7.
- [x] 08-03-PLAN.md — Derive record identity from content, in one helper both runtimes use.
- [x] 08-04-PLAN.md — Make a scenario a pure function of definition and tick, validated against the profile.
- [x] 08-05-PLAN.md — Give the simulation session an owner, a bounded TTL and an end.
- [x] 08-06-PLAN.md — Consult one dispatch decision at the point of dispatch, and fail closed.
- [x] 08-07-PLAN.md — Enumerate every dispatch path and prove none escapes the gate.
- [x] 08-08-PLAN.md — Mark notifications during a rehearsal rather than silencing them.
- [x] 08-09-PLAN.md — Move the commissioning diagnostic to the Companion and stop it inventing findings.
- [x] 08-10-PLAN.md — Check services, units, device classes and duplicates, and bound the suggestions.
- [x] 08-11-PLAN.md — Prove commissioning writes nothing, and replace the invented score with counts.
- [x] 08-12-PLAN.md — Make work orders append-only with a closed transition table.
- [x] 08-13-PLAN.md — Bound attachments, completion history and the work-order store.
- [x] 08-14-PLAN.md — Ship the simulation, commissioning and asset surfaces.
- [x] 08-15-PLAN.md — Compute due and next-due from interval and operating-hour plans.
- [x] 08-16-PLAN.md — Document the contract and close the Phase-8 register from commands.

### Phase 9: Failure-Isolated Multi-Site Supervision

**Goal**: A central GLT can supervise and operate authorized remote Home Assistant sites with bounded concurrency, exact policy, partial-data honesty, and failure isolation.
**Depends on**: Phase 8
**Requirements**: SITE-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Only administrators can configure server-owned allowed destinations and backend-only credentials; validation blocks arbitrary/private destinations outside policy, credentials never reach browser responses/logs/exports, and renewal/revocation takes effect predictably.
  2. Bounded concurrent connections/subscriptions expose site freshness, latency, circuit state, and communication health; one slow, invalid, or offline site produces explicit partial results without blocking or falsifying healthy sites and portfolio roll-ups.
  3. Remote controls and history reuse the same project/site/entity permissions, configured target normalization, simulation write block, result states, and exact authoritative audit as local operations.
  4. Permission-filtered portfolio/site navigation and reports preserve context without exposing unauthorized site metadata, entity IDs, aggregate counts, or unavailable data as complete.
  5. Failure-injection and load tests prove concurrency/total-deadline/circuit-breaker behavior, reconnect/revocation, partial subscriptions, memory/latency budgets, and generated-card recovery; sequential per-entity fan-out cannot satisfy the phase.

**Known defects closed**: Sequential remote-state reads with per-entity timeouts, under-validated remote targets/services, missing remote success/failure audit, broad remote metadata/proxy exposure, and lack of failure-isolated partial roll-ups.
**Research flag**: Prototype remote authentication lifecycle, SSRF allowlist policy, bounded subscriptions, reconnect, per-entity permissions, and representative partial-failure budgets.
**Research flag**: RESOLVED 2026-09-02 — see `09-RESEARCH.md`. `/api/states` returns every state in one request while the shipped code asks per entity; `subscribe_entities` takes an entity list where `subscribe_events` with `state_changed` delivers every change on the remote instance; an allowlist alone does not survive DNS rebinding so the resolved address must be checked at connection time; and `POST /api/services` returns the states it changed, which is the readback Phase 4's `confirmed` outcome needs and the shipped code discards.
**Plans**: 12
**UI hint**: yes

- [ ] 09-01-PLAN.md — Stand up the Phase-9 gate, the socket ledger and the site corpus.
- [ ] 09-02-PLAN.md — Close the site health, failure and outcome vocabularies in both runtimes.
- [ ] 09-03-PLAN.md — Make destinations a server-owned allowlist checked at connection time.
- [ ] 09-04-PLAN.md — Give a site a health state and a circuit breaker that says it is open.
- [ ] 09-05-PLAN.md — Read one request per site, bounded, with a total deadline the request owns.
- [ ] 09-06-PLAN.md — Report failures from a closed set, and prove no credential leaves.
- [ ] 09-07-PLAN.md — Enforce the same capability and project scoping on every remote route.
- [ ] 09-08-PLAN.md — Give remote controls the four outcomes and the audit local ones have.
- [ ] 09-09-PLAN.md — Make a partial roll-up state its own completeness.
- [ ] 09-10-PLAN.md — Bound subscriptions per site and in total, and name their entities.
- [ ] 09-11-PLAN.md — Ship the site health, roll-up and remote-value surfaces.
- [ ] 09-12-PLAN.md — Document the contract and close the Phase-9 register from commands.

### Phase 10: Product-Wide Usability & Release Evidence

**Goal**: The exact v1.1 release is demonstrably localized, accessible, compatible, resilient, and performant across every completed operator and engineering workflow.
**Depends on**: Phase 9
**Requirements**: I18N-01, A11Y-01, TEST-01
**Mode**: mvp
**Success Criteria** (what must be TRUE):

  1. Complete German and English catalogs cover frontend, designer, Companion, errors, states, dates/times, units, plurals, and reports; pseudo-locale, missing-key, Unicode, locale/timezone/DST, and RTL-readiness tests prove that another locale needs data changes rather than code edits.
  2. Runtime and designer workflows pass automated and recorded manual WCAG 2.2 AA-oriented checks for names/roles, full keyboard and drag alternatives, visible/unobscured focus, no traps, contrast/non-color states, zoom/reflow, touch, reduced motion, announcements, and mobile/tablet/widescreen/kiosk operation.
  3. Release gates execute pure-core, Python HA, authenticated multi-user, browser E2E/visual/accessibility, YAML/schema/migration, artifact byte-equality/provenance, clean HACS install/upgrade/unload, and failure-injection suites against the exact packaged artifacts.
  4. Repeatable 100-, 500-, and 2,000-object scenarios measure render, live updates, routing, editing, persistence, remote partial failure, memory, concurrency, and latency against recorded numeric budgets on representative browser/HA hardware.
  5. An evidence-linked claim registry, package checksums/attestations, minimum/current HA results, and clean install proof show which capabilities passed; no failed or token-only capability is presented as production-ready.

**Known defects closed**: Hardcoded/incomplete locale behavior, CSS-only or token-only accessibility claims, a 2,000-object diagnostics micro-test presented as platform capacity, absence of real Python/browser/security tests, unproven HA compatibility, and release copies that can drift from reviewed source.
**Research flag**: Derive numeric capacity budgets from representative hardware and finalize the evidence/claim publication format before release.
**Research flag**: RESOLVED 2026-09-02 — see `10-RESEARCH.md`. Automated rule engines decide only a minority of WCAG success criteria by construction, so an automated pass and a recorded manual pass stay separate claims that the registry has no schema for merging; a capacity number measured in an environment not marked representative supports "the scenario is bounded and runs" and never "the platform handles N objects"; and a pseudo-locale generated from the catalogs at test time enumerates hardcoded strings rather than counting them, where a checked-in one drifts from what it tests.
**Plans**: 15
**UI hint**: yes

- [ ] 10-01-PLAN.md — Stand up the Phase-10 gate and the measured-nothing ledger.
- [ ] 10-02-PLAN.md — One catalog per language, with completeness as a computation.
- [ ] 10-03-PLAN.md — Generate a pseudo-locale that makes a missing key visible.
- [ ] 10-04-PLAN.md — Move the legacy base's hundred hardcoded strings into the catalog.
- [ ] 10-05-PLAN.md — Format from configuration or refuse, and make plurals data.
- [ ] 10-06-PLAN.md — Compare the two runtimes' wording as canonical bytes.
- [ ] 10-07-PLAN.md — Give every interactive element a real role and an accessible name.
- [ ] 10-08-PLAN.md — Assert names, roles, focus and reflow in the exact artifact.
- [ ] 10-09-PLAN.md — Sweep every shipped surface automatically, and fail on an unswept one.
- [ ] 10-10-PLAN.md — Build a capacity harness whose numbers carry their environment.
- [ ] 10-11-PLAN.md — Build the claim registry that refuses a claim with no evidence.
- [ ] 10-12-PLAN.md — Publish what was never exercised here, with reasons.
- [ ] 10-13-PLAN.md — Record budgets, and bound what a measurement may claim.
- [ ] 10-14-PLAN.md — Document accessibility, localization and release evidence.
- [ ] 10-15-PLAN.md — Close the register from commands, and fix the traceability debt.

## Requirement Coverage

Every v1.1 requirement has exactly one primary owner. Cross-cutting gates in later phases verify earlier requirements without changing ownership.

| Requirement | Primary Phase | Requirement | Primary Phase | Requirement | Primary Phase |
|-------------|---------------|-------------|---------------|-------------|---------------|
| SCHEMA-01 | Phase 1 | OPS-02 | Phase 4 | SCH-01 | Phase 6 |
| DIFF-01 | Phase 1 | NAV-01 | Phase 4 | HIST-01 | Phase 7 |
| HACS-01 | Phase 1 | CAT-01 | Phase 5 | ENER-01 | Phase 7 |
| SEC-01 | Phase 2 | ENG-01 | Phase 5 | REPORT-01 | Phase 7 |
| COLLAB-01 | Phase 2 | ENG-02 | Phase 5 | SIM-01 | Phase 8 |
| OPS-01 | Phase 3 | CAD-01 | Phase 5 | DIAG-01 | Phase 8 |
| SEM-01 | Phase 3 | SDK-01 | Phase 5 | ASSET-01 | Phase 8 |
| MAP-01 | Phase 3 | ALM-01 | Phase 6 | SITE-01 | Phase 9 |
| PROF-01 | Phase 3 | ALM-02 | Phase 6 | I18N-01 | Phase 10 |
| PROTO-01 | Phase 3 | A11Y-01 | Phase 10 | TEST-01 | Phase 10 |

**Coverage**: 30/30 mapped; 0 unmapped; 0 duplicated.

## Progress

**Execution Order:** Phases execute in numeric order from 1 through 10.

| Phase | Plans Complete | Threats verified | Status | Completed |
|-------|----------------|------------------|--------|-----------|
| 1. Trusted Contract & Release Foundation | 13/13 | 10/10 rows, F-01 blocked | Complete | 2026-09-01 |
| 2. Authoritative Policy, Controls & Collaboration | 17/17 | 15/16 (T2-16 blocked) | Complete | 2026-09-01 |
| 3. Semantic Equipment & Provenance | 17/17 | 13/14 (T3-14 blocked) | Complete | 2026-09-01 |
| 4. Runtime Operations & Drill-Down | 17/17 | 13/14 (T4-14 blocked) | Complete | 2026-09-02 |
| 5. CAD Engineering & Extension Platform | 20/20 | 15/16 (T5-16 blocked) | Complete | 2026-09-02 |
| 6. Alarms, Notifications & Schedules | 20/20 | 20/21 (T6-21 blocked) | Complete | 2026-09-02 |
| 7. Trends, Energy & Reproducible Reports | 20/20 | 22/23 (T7-23 blocked) | Complete | 2026-09-02 |
| 8. Safe Simulation, Commissioning & Assets | 16/16 | 24/25 (T8-25 blocked) | Complete | 2026-09-02 |
| 9. Failure-Isolated Multi-Site Supervision | 12/12 | 19/20 (T9-20 blocked) | Complete | 2026-09-02 |
| 10. Product-Wide Usability & Release Evidence | 15/15 | 16/17 (T10-16 blocked) | Complete | 2026-09-03 |

**Every blocked row is the same row.** Each phase's `test:phaseN:release` leaf
runs `test:ha-artifacts`, which probes `docker info` across twelve bounded lane
candidates; this environment has no Docker engine. Each is recorded with its
exact failure output in its own register, and none is marked from its parts
passing separately.

Phases 3 and 4 have no per-plan summaries; their registers and phase summaries
carry the evidence. That gap is tracked in the close-out work rather than
papered over here.

**Every row in the milestone is now either verified or blocked by the
environment.** T10-03 was carried as `not met` — a status this project had not
needed before — while 132 strings remained outside the catalog; it was finished
on 2026-09-03. The nine blocked rows are all the same composed release leaf.

---
*Roadmap created: 2026-08-31 for milestone v1.1 Production-Ready GLT Platform*
