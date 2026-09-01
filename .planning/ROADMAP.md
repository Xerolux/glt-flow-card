# Roadmap: GLT Flow Card

## Overview

Milestone v1.1 hardens the existing Platform 1.0 surface as ten dependency-ordered vertical slices. Each phase connects the authored domain model, runtime/editor experience, authoritative Companion behavior, executable tests, documentation, and generated artifacts where applicable. Security, schema and migration safety, German/English localization, accessibility, realistic failure/load evidence, and artifact equality begin in the earliest responsible phase and remain acceptance gates through release.

## Phases

**Phase Numbering:** Integer phases are planned milestone work; decimal phases are reserved for urgent insertions.

- [x] **Phase 1: Trusted Contract & Release Foundation** - Make project data, Companion lifecycle, migrations, and shipped artifacts safe and reproducible. (completed 2026-09-01)
- [ ] **Phase 2: Authoritative Policy, Controls & Collaboration** - Enforce server-owned permissions, exact control targets, trustworthy audit, and conflict-safe shared editing.
- [ ] **Phase 3: Semantic Equipment & Provenance** - Establish stable semantics, profiles, mapping, provenance, and deterministic operational state.
- [ ] **Phase 4: Runtime Operations & Drill-Down** - Deliver profile-driven plant operation with confirmed commands and permission-safe contextual navigation.
- [ ] **Phase 5: CAD Engineering & Extension Platform** - Deliver the verified catalog, typed connectivity, deterministic routing, transactional CAD, and declarative SDK.
- [ ] **Phase 6: Alarms, Notifications & Schedules** - Make time-sensitive operational workflows authoritative, restart-safe, observable, and timezone-correct.
- [ ] **Phase 7: Trends, Energy & Reproducible Reports** - Turn Recorder data into honest trends, unit-safe energy views, and matching period reports.
- [ ] **Phase 8: Safe Simulation, Commissioning & Assets** - Support pre-commissioning scenarios, read-only diagnostics, and bounded maintenance workflows without plant-write risk.
- [ ] **Phase 9: Failure-Isolated Multi-Site Supervision** - Supervise authorized remote Home Assistant sites without credential exposure, policy bypass, or global failure.
- [ ] **Phase 10: Product-Wide Usability & Release Evidence** - Close localization, accessibility, capacity, compatibility, and exact-artifact release evidence across all workflows.

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
**Plans**: TBD
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
**Plans**: TBD
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
**Research flag**: Define trusted SDK installation, review, distribution, and compatibility policy; same-realm JavaScript is not treated as a sandbox.
**Plans**: TBD
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
**Research flag**: Confirm supported HA schedule/calendar authoring APIs and the deployment alarm philosophy, priorities, shelving/escalation limits, recipients, and retention.
**Plans**: TBD
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
**Research flag**: Pin Recorder history/statistics contracts across supported HA lanes and define valid energy/report calculations, periods, and output limits.
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

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
**Plans**: TBD
**UI hint**: yes

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
**Plans**: TBD
**UI hint**: yes

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

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Trusted Contract & Release Foundation | 13/13 | Complete   | 2026-09-01 |
| 2. Authoritative Policy, Controls & Collaboration | 0/17 | Planned; paused before implementation | - |
| 3. Semantic Equipment & Provenance | 0/TBD | Not started | - |
| 4. Runtime Operations & Drill-Down | 0/TBD | Not started | - |
| 5. CAD Engineering & Extension Platform | 0/TBD | Not started | - |
| 6. Alarms, Notifications & Schedules | 0/TBD | Not started | - |
| 7. Trends, Energy & Reproducible Reports | 0/TBD | Not started | - |
| 8. Safe Simulation, Commissioning & Assets | 0/TBD | Not started | - |
| 9. Failure-Isolated Multi-Site Supervision | 0/TBD | Not started | - |
| 10. Product-Wide Usability & Release Evidence | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-31 for milestone v1.1 Production-Ready GLT Platform*
