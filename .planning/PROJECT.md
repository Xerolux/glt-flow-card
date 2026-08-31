# GLT Flow Card

## What This Is

GLT Flow Card is a Home-Assistant-based GLT/BMS/SCADA visualization and engineering platform for operators, engineers, facility managers, and advanced Home Assistant users. It combines live plant diagrams, a visual designer, secure Companion-backed operations, alarms, trends, schedules, semantic equipment models, diagnostics, energy, maintenance, reporting, and multi-site supervision.

The repository already contains a broad Platform 1.0 implementation. This project cycle turns those feature claims into production-depth behavior with authoritative backend rules, coherent data models, realistic tests, measurable performance, and release-ready packaging.

## Core Value

Operators and engineers can safely understand, operate, engineer, and diagnose a real building plant from one trustworthy Home Assistant interface.

## Current Milestone: v1.1 Production-Ready GLT Platform

**Goal:** Implement and verify all 30 requested GLT capabilities as coherent, secure, production-grade workflows rather than isolated UI labels or token-presence stubs.

**Target features:**
- Operational states, parametric equipment, professional object controls, alarms, schedules, historian, notifications, and drill-down.
- Semantic engineering, entity auto-mapping, intelligent ports/routing, CAD-grade editing, simulation, commissioning diagnostics, and schema-safe project exchange.
- Server-enforced roles, multi-user locking, asset/energy/report workflows, true multi-site, plugin SDK, protocol provenance, HACS Companion setup, i18n, accessibility, and realistic E2E/load/release gates.

## Requirements

### Validated

- ✓ Home Assistant custom card renders equipment, datapoints, paths, KPIs, and multiple views from Lovelace configuration — existing baseline.
- ✓ Visual editor supports diagram construction, inspector editing, YAML exchange, projects, templates, and preview — existing baseline.
- ✓ Pure JavaScript engineering core exposes schema normalization, operational-state derivation, entity scoring, routing, diagnostics, aggregation, diffs, and project bundles — existing baseline.
- ✓ Optional Home Assistant Companion registers a config flow and WebSocket command surface for projects and operations — existing baseline.
- ✓ Generated card artifacts, HACS metadata, documentation site, examples, and GitHub Actions release paths exist — existing baseline.

### Active

- [ ] Every one of the 30 user-specified capabilities has explicit, testable acceptance criteria and a single roadmap owner.
- [ ] Existing Platform 1.0 claims are audited against executable frontend, backend, security, migration, accessibility, packaging, and load tests.
- [ ] Known correctness and security defects are fixed before additional claims are treated as complete.
- [ ] Frontend, Companion, standalone designer, schema, documentation, and generated artifacts stay behaviorally consistent.
- [ ] Release evidence demonstrates safe operation with representative Home Assistant states and 100, 500, and 2,000 engineered objects.

### Out of Scope

- Native BACnet, Modbus, KNX, OPC UA, SNMP, or IEC fieldbus drivers — Home Assistant integrations remain the protocol layer; GLT Flow Card visualizes provenance and communication health.
- Certified fire, security, life-safety, or industrial safety control — this product is not a certified safety system.
- Replacing Home Assistant as automation server, historian database, authentication provider, or device gateway — integrate with host capabilities instead of duplicating them.
- Unbounded symbol count as a quality metric — the existing 300+ variants must first be semantically correct, operable, searchable, and tested.

## Context

- The current package reports version 1.0.0 and documentation claims most requested features are present.
- Codebase mapping found a browser-first modular monolith with pure engineering modules in `src/v100/`, prototype-decorated UI integrations, generated distribution artifacts, and a large optional Companion manager in `custom_components/glt_flow_card/__init__.py`.
- Existing tests are mainly Node smoke/token checks; Python backend behavior, real browser interaction, Home Assistant integration, authorization boundaries, alarm transitions, accessibility, migration, and realistic load are not proven.
- Known defects include ineffective alarm shelving, delay-task closure bugs, unenforced project locks, incomplete unload cleanup, incomplete reports, control-target/audit mismatch, broad read exposure, weak input bounds, and sequential remote-state fan-out.
- The user explicitly requested implementation of all items 1–30 without further scope reduction.

## Constraints

- **Host platform:** Home Assistant remains the runtime, state source, service broker, authentication system, Recorder, notification system, and fieldbus integration layer.
- **Security:** Browser role checks are UX only; all shared reads, writes, controls, remote calls, and authoritative audit events require server-side enforcement.
- **Compatibility:** Preserve standalone card operation where safe, while clearly disabling privileged shared operations when Companion enforcement is required.
- **Source of truth:** Edit authored modules and generators; never treat an isolated change to `dist/glt-flow-card.js` or the Companion `www` copy as complete.
- **Project data:** Introduce bounded schema validation and migration without losing existing Lovelace/YAML projects.
- **Performance:** Publish capacity claims only after repeatable browser/backend measurements at 100, 500, and 2,000 objects.
- **Quality:** Use executable behavioral tests; source-token assertions alone cannot satisfy a requirement.
- **Hardware safety:** No physical bus or plant write is implied by repository development or test scaffolding; live control tests require a separate, explicit approval and bounded targets.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat current v1 code as a starting implementation, not proof of completion | Mapping exposed critical untested and insecure paths behind broad feature claims | — Pending |
| Organize work as vertical operational and engineering slices | Each phase must connect model, UI, Companion, tests, docs, and generated artifacts | — Pending |
| Make the Companion authoritative for shared security-sensitive workflows | Editable browser configuration cannot be a security boundary | — Pending |
| Keep Home Assistant integrations as protocol drivers | Native industrial protocol stacks would be a different product scope | — Pending |
| Require reproducible build and artifact equality gates | The repository checks in multiple generated runtime copies | — Pending |
| Execute all 30 requested areas; do not defer them as optional v2 ideas | The user explicitly requested the complete list | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-31 after brownfield initialization for the full 1–30 scope*
