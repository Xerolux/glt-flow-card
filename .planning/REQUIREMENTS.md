# Requirements: GLT Flow Card

**Defined:** 2026-08-31  
**Milestone:** v1.1 Production-Ready GLT Platform  
**Core Value:** Operators and engineers can safely understand, operate, engineer, and diagnose a real building plant from one trustworthy Home Assistant interface.

## v1.1 Requirements

All 30 numbered requirements are committed scope. The parenthetical number preserves the user's original roadmap numbering.

### Operations and Security

- [ ] **OPS-01 (1)**: An operator sees one deterministic, severity-ranked equipment state covering Auto, Manual, Local, Remote, Fault, Warning, Locked, Interlock, Maintenance, communication error, invalid/stale value, command pending, command failed, running, standby, and off; the symbol, quality, freshness, accessible label, and drill-down all agree on that state.
- [ ] **OPS-02 (2)**: An operator opens a profile-driven object panel for each supported equipment type and can view standard values, alarms, trends, hours/starts, and permitted controls without manually designing each popup; commands expose accepted, readback-confirmed, timed-out, and failed outcomes separately.
- [ ] **SEC-01 (3)**: Viewer, Operator, Engineer, and Admin permissions are enforced by the Companion for every project-scoped query, command, subscription, remote action, and audit read; ACLs are server-owned, default-deny, cannot grant more authority than Home Assistant, and are proven with multi-user denial tests.

### Alarms, Notifications, and Schedules

- [ ] **ALM-01 (4)**: Alarms use one restart-safe backend lifecycle with priority/class, condition, delay, hysteresis, active/returned/acknowledged states, acknowledgement comment, shelving expiry, maintenance suppression, bounded history, deduplication, and direct links to plant, equipment, and trend context.
- [ ] **ALM-02 (5)**: Notification and escalation policies target explicit Home Assistant notification services/recipients, support delayed and immediate escalation, record every attempt/result, suppress duplicates across restart, respect shelving/maintenance, and surface delivery failures without losing the alarm.
- [ ] **SCH-01 (6)**: Engineers create or bind weekly schedules, holidays, exceptions, vacations, special days, and operating periods through supported Home Assistant schedule/calendar/script capabilities; the UI previews the effective value with timezone/DST behavior and the Companion audits executions and failures.

### Semantic Engineering and Equipment Profiles

- [ ] **SEM-01 (7)**: Projects model stable Site → Building → Floor → System → Subsystem → Equipment → Datapoint relationships plus validated tags, units, media, and directions; invalid references/cycles are rejected and semantic paths drive navigation, permissions, diagnostics, and roll-ups.
- [ ] **MAP-01 (8)**: The designer ranks entity-mapping candidates from registries, device/area membership, integration provenance, names, units, device classes, and profile expectations; it explains confidence, previews diffs, requires human acceptance, preserves manual overrides, supports undo, and ships tested iDM profiles.
- [ ] **PROF-01 (9)**: Versioned parametric equipment profiles define identity, slots, controls, state signals, alarms, ports, diagnostics, maintenance metadata, and compatible symbols once and can be instantiated repeatedly with migration-safe overrides.
- [ ] **CAT-01 (10)**: A searchable, categorized symbol catalog exposes at least 300 unique, semantically valid variants across HVAC, hydraulics, refrigeration, air handling, fire/electrical representation, DIN/P&ID, and Neo-2030 styles; generated catalog evidence and state/contrast visual tests prove the published count.

### CAD Designer and Navigation

- [ ] **ENG-01 (11)**: Every profile exposes typed ports for medium, direction, signal/power, multiplicity, and preferred side; incompatible connections are blocked with an explanation while valid connections preserve stable endpoint IDs across edits and migration.
- [ ] **ENG-02 (12)**: Auto-routing produces deterministic orthogonal paths that avoid equipment, honor port direction/medium, create stable junctions/T-pieces, represent crossings clearly, keep parallel spacing, and incrementally reroute affected segments after moves without freezing the editor.
- [ ] **CAD-01 (13)**: The designer provides transactional layer visibility/locking, z-order, snapping/guides, alignment/distribution, lasso/multi-select, cross-project copy/paste with ID remapping, search, minimap, groups/nested groups, reusable masters, undo/redo, keyboard shortcuts, and non-pointer alternatives.
- [ ] **NAV-01 (14)**: Users navigate from portfolio/site overview through plant, subsystem, equipment, datapoint, alarm, and trend using permission-filtered links and breadcrumbs that preserve time/alarm context, support browser history/deep links, and never leak unauthorized aggregate counts.

### History, Simulation, Diagnostics, Energy, Assets, Reports

- [ ] **HIST-01 (15)**: Recorder-backed trends expose bounded raw/statistics queries, aggregation, deadband, interpolation policy, quality/gaps/coverage, alarm markers, two cursors, comparison ranges, zoom/statistics, reusable templates, exports, and honest retention/provenance without claiming a separate historian database.
- [ ] **SIM-01 (16)**: Engineers build and run deterministic virtual-time scenarios before entities exist, including values, pumps, valves, sequences, and faults; simulated state is visibly marked and all local/remote physical service gateways are hard-blocked while simulation is active.
- [ ] **DIAG-01 (17)**: A read-only commissioning view lists every referenced entity and service with OK/unavailable/unknown/stale age, missing entity/service, wrong unit/device class, duplicate/incompatible mapping, communication provenance, and unused-entity suggestions, with evidence and safe remediation links.
- [ ] **ENER-01 (18)**: Energy views model electricity, heat, cooling, water, gas, PV, battery, tariffs, costs, CO2, virtual meters, peak demand, and building/plant comparisons with unit-safe conversions, reset-aware meter math, missing-data coverage, and reproducible day/month/year periods.
- [ ] **ASSET-01 (19)**: Equipment assets support maintenance plans, interval or operating-hour due logic, immutable history, responsible person, work-order state transitions, completion evidence/photos/documents/parts, next-due calculation, reminders, and bounded attachment/storage behavior.
- [ ] **REPORT-01 (20)**: Engineers define branded, versioned period reports containing selected KPIs, trends, alarms, energy, coverage, and maintenance data; on-demand/scheduled/event runs produce matching screen/CSV/print-PDF models, record inputs/results/delivery attempts, and remain reproducible.

### Multi-Site, Extensibility, Provenance, Projects, Collaboration

- [ ] **SITE-01 (21)**: A central GLT supervises multiple Home Assistant instances through backend-only credentials, server-owned site allowlists, bounded concurrent connections/subscriptions, site health/freshness/latency/circuit state, failure-isolated partial roll-ups, authorized remote controls/history, and exact audit records.
- [ ] **SDK-01 (22)**: A versioned, namespaced declarative SDK supports separately installable symbol packs, profiles/templates, renderers/widgets/panels, and translations with manifest validation, compatibility tests, conflict handling, and no arbitrary privileged project-script execution.
- [ ] **PROTO-01 (23)**: Datapoints display Home Assistant registry-derived integration/device/config-entry provenance and communication health for BACnet, Modbus, KNX, OPC UA, and other sources without inferring protocols from names or implementing native fieldbus drivers.
- [ ] **SCHEMA-01 (24)**: One bounded JSON Schema 2020-12 contract validates projects, profiles, extensions, and `.gltproject` bundles before normalization; sequential frontend/backend-parity migrations support dry-run, backups, rollback, understandable path errors, safe archive extraction, custom assets, and historical fixtures.
- [ ] **DIFF-01 (25)**: Project comparison reports semantic additions/removals/moves/binding/config changes with stable IDs, ignores irrelevant ordering noise, previews impact, and lets an engineer selectively apply or roll back changes through the same validation/revision path.
- [ ] **COLLAB-01 (26)**: Shared engineering enforces expected revision plus server lease/lock token atomically, supports renewal/expiry/reconnect, prevents unauthorized or unlocked saves, detects two-client conflicts, and offers non-destructive merge/retry/recovery without lost updates.
- [ ] **HACS-01 (27)**: The Companion is a correctly packaged HACS Home Assistant integration with manifest, Config Flow/options, translations, diagnostics, explicit supported HA versions, setup/unload/reload cleanup, migration-safe storage, release ZIP/install/upgrade verification, while the dashboard plugin remains correctly distributed as a frontend artifact.

### Product-Wide Usability and Evidence

- [ ] **I18N-01 (28)**: All user-facing frontend, designer, Companion, error, state, date/time, unit, plural, and report text uses complete German and English catalogs with pseudo-locale, missing-key, locale formatting, Unicode, timezone/DST, and RTL-readiness tests; more locales can be added without code edits.
- [ ] **A11Y-01 (29)**: Runtime and designer meet WCAG 2.2 AA-oriented behavior for names/roles, keyboard workflows, visible/unobscured focus, no traps, contrast/non-color states, zoom/reflow, touch targets, reduced motion, announcements, drag alternatives, mobile/tablet/widescreen, secure kiosk/leitstand, and manual plus automated assistive-technology evidence.
- [ ] **TEST-01 (30)**: Release gates execute pure-core tests, Python Home Assistant integration tests, authenticated multi-user security tests, browser E2E/visual/accessibility tests, YAML/schema/migration tests, artifact byte-equality/provenance checks, clean HACS install/upgrade/unload, failure injection, and measured 100/500/2,000-object scenarios for render, updates, routing, editing, persistence, remote partial failure, memory, and latency budgets.

## Future Requirements

No numbered capability is deferred. A capability may remain explicitly experimental only until its acceptance evidence passes; it may not be marketed as production-ready before then.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native BACnet, Modbus, KNX, OPC UA, SNMP, or IEC drivers | Home Assistant integrations remain the protocol and device gateway. |
| Certified fire, security, life-safety, or industrial safety control | The project has no certified safety lifecycle and must not imply one. |
| Separate historian/database or replacement automation server | Recorder and Home Assistant remain the records/state/service platform. |
| Full CMMS, Brick, Haystack, ISO 50001, or ISO 55000 conformance claims | Implement useful bounded workflows without claiming standards conformance absent dedicated validation. |
| Arbitrary executable project plugins | Privileged code must be separately installed, reviewed, permissioned, and versioned. |
| Tamper-evident or audit-grade claims for mutable local records | Activity/audit logs remain bounded operational evidence unless an integrity model is implemented and verified. |
| Physical-bus or plant-write commissioning by default | Commissioning is read-only; any live write requires separate explicit approval and bounded targets. |

## Definition of Done

A requirement is complete only when:

1. Authored source, frontend integration, Companion behavior, schema/migration, documentation, and generated artifacts agree where applicable.
2. Automated behavioral tests exercise success, denial, invalid input, restart/reconnect, and partial-failure paths at the appropriate layer.
3. Security-sensitive behavior is authoritative server-side and cross-user denial tests pass.
4. German/English, keyboard/focus, quality/freshness, mobile/kiosk, and error states are covered for its user-facing workflows.
5. The exact shipped card and Companion artifacts pass reproducible build, equality, packaging, install, upgrade, and unload gates.
6. Any required manual Home Assistant/browser verification is recorded; no physical plant write is performed without separate approval.
7. The implementation and evidence are committed atomically and linked from the phase verification report.

## Traceability

Filled during roadmap creation. Every requirement must map to exactly one primary phase; cross-cutting verification can appear in later phase success criteria without changing primary ownership.

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPS-01 | Phase 3 | Pending |
| OPS-02 | Phase 4 | Pending |
| SEC-01 | Phase 2 | Pending |
| ALM-01 | Phase 6 | Pending |
| ALM-02 | Phase 6 | Pending |
| SCH-01 | Phase 6 | Pending |
| SEM-01 | Phase 3 | Pending |
| MAP-01 | Phase 3 | Pending |
| PROF-01 | Phase 3 | Pending |
| CAT-01 | Phase 5 | Pending |
| ENG-01 | Phase 5 | Pending |
| ENG-02 | Phase 5 | Pending |
| CAD-01 | Phase 5 | Pending |
| NAV-01 | Phase 4 | Pending |
| HIST-01 | Phase 7 | Pending |
| SIM-01 | Phase 8 | Pending |
| DIAG-01 | Phase 8 | Pending |
| ENER-01 | Phase 7 | Pending |
| ASSET-01 | Phase 8 | Pending |
| REPORT-01 | Phase 7 | Pending |
| SITE-01 | Phase 9 | Pending |
| SDK-01 | Phase 5 | Pending |
| PROTO-01 | Phase 3 | Pending |
| SCHEMA-01 | Phase 1 | Pending |
| DIFF-01 | Phase 1 | Pending |
| COLLAB-01 | Phase 2 | Pending |
| HACS-01 | Phase 1 | Pending |
| I18N-01 | Phase 10 | Pending |
| A11Y-01 | Phase 10 | Pending |
| TEST-01 | Phase 10 | Pending |

**Coverage:**
- v1.1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0
- Duplicated primary mappings: 0

---
*Requirements defined: 2026-08-31*  
*Last updated: 2026-08-31 after roadmap creation and exact phase traceability for user roadmap items 1–30*
