# Project Research Summary

**Project:** GLT Flow Card — v1.1 Production-Ready GLT Platform  
**Domain:** Home Assistant-based GLT/BMS/SCADA visualization and engineering platform  
**Researched:** 2026-08-31  
**Confidence:** MEDIUM

## Executive Summary

GLT Flow Card is a brownfield production-hardening effort, not a greenfield feature build. The repository already presents a broad Platform 1.0 surface, but those claims are not yet proven by authoritative backend behavior, coherent persisted contracts, real browser and Home Assistant tests, measurable capacity, or reproducible release evidence. Experts build this class of product around explicit authority: Home Assistant owns identity, entity state, services, Recorder, notifications, and protocol integrations; the Companion owns GLT policy and shared lifecycle state; the browser renders projections and edits drafts. Current claims for secure roles, alarms, schedules, collaboration locks, reports, historian behavior, multi-site, accessibility, and 2,000-object scale must therefore be treated as unproven until their executable acceptance evidence passes.

Retain the browser-first JavaScript modular monolith, native Web Components, Node 22, esbuild, and optional Companion. Harden it with one bounded JSON Schema 2020-12 contract and sequential migrations, server-authoritative command/query/event APIs, split Home Assistant Store repositories, ports-and-adapters around Home Assistant, and a single canonical build. Add Playwright plus axe for browser behavior, pytest with the Home Assistant custom-component harness for Companion behavior, and cross-runtime schema fixtures using Ajv and Python jsonschema. Do not add microservices, a frontend framework rewrite, a second historian/database, native fieldbus drivers, or executable project plugins.

The primary risks are false authority, data loss, unsafe operations, and unsupported public claims. Mitigate them by enforcing authorization on every query, command, and subscription; resolving configured controls to exact server-owned targets; separating service acceptance from equipment readback; making alarms a single restart-safe backend state machine; preserving immutable migration inputs and rollback snapshots; hard-blocking writes in simulation and defaulting commissioning to read-only; isolating remote credentials and failures; and linking every release claim to behavioral evidence from the exact shipped artifacts. Accessibility, i18n, failure handling, security, and 100/500/2,000-object capacity are cross-cutting acceptance properties, not a final cosmetic pass.

## Key Findings

### Recommended Stack

Keep the existing runtime shape and introduce only focused validation, testing, and release tooling. Authored modules and schemas are the source of truth; `dist`, the Companion `www` copy, and designer assets are generated outputs whose equality is verified rather than independently edited. See [STACK.md](./STACK.md) for exact pins and compatibility details.

**Core technologies:**

- **Node.js 22 + native `node:test`:** build tooling and pure domain tests — already aligned with the ES2022 codebase and sufficient for deterministic engineering logic.
- **esbuild 0.25.12:** canonical browser bundling — retain it, but centralize invocation and stage every shipped copy from one output.
- **Native Web Components:** runtime card, editor, and standalone designer — preserve deployment compatibility and avoid an unrelated framework migration.
- **JSON Schema Draft 2020-12 + Ajv 8.20.0 standalone output:** canonical bounded project, bundle, and extension contract in JavaScript — validate serialized input before migration and normalization.
- **Python jsonschema 4.26.0:** independent Companion enforcement of the same contract — parity-test shared valid, invalid, boundary, and historical fixtures.
- **Playwright Test 1.62.1 + axe-core/playwright 4.13.0:** real-browser operator, engineering, resilience, visual, accessibility, and load evidence from the released bundle.
- **pytest-homeassistant-custom-component:** public-interface Companion tests for setup, auth, WebSocket, Store, services, controlled time, remote failures, and unload; pin a matching harness per supported HA lane.
- **Ruff, ESLint, TypeScript `checkJs`, HACS/hassfest, CodeQL, dependency review, pinned Actions, checksums and attestations:** static and release controls; attestations establish provenance, not safety.

Critical compatibility decision: keep explicit minimum and current Home Assistant lanes. The advertised HA 2024.8 floor is unproven until its historical Python/harness combination passes setup, operation, migration, upgrade, and unload. Raise the declared minimum deliberately if it cannot be supported cleanly.

### Expected Features

All 30 requested capabilities are milestone table stakes. None may be deferred to v2; a capability remains experimental or its claim is withdrawn until its row-level behavior is executable. See [FEATURES.md](./FEATURES.md) for the complete acceptance matrix.

**Must have (production claims):**

- Coherent operational states, safe profile-bound controls, authoritative roles, alarm lifecycle/notifications, and schedule bindings (1–6).
- Typed semantic model, explainable mapping, versioned profiles, a verified symbol catalog, typed ports, deterministic routing, and transactional CAD editing (7–13).
- Permission-safe drill-down, Recorder-backed trends, isolated simulation, read-only commissioning, energy, assets/work orders, and reproducible reports (14–20).
- Failure-isolated multi-site, versioned declarative SDK, registry-derived provenance, bounded schema/migrations, safe bundles/diffs, enforced revisions/leases, and correct Companion packaging/lifecycle (21–27).
- Complete i18n, WCAG-oriented keyboard/mobile/kiosk behavior, and realistic behavioral/load/release gates (28–30).

**Competitive differentiators, after table stakes are true:**

- Explainable human-approved semantic auto-mapping.
- One profile model driving symbols, controls, alarms, ports, diagnostics, and reports.
- Hard-isolated simulation paired with evidence-based commissioning.
- Context-preserving semantic operations from point to portfolio.
- A namespaced, versioned extension ecosystem with separately installed trusted executable code.

**Defer or reject:**

- No numbered capability is deferred. Defer native industrial protocol drivers, certified safety/SCADA claims, a parallel historian/database, full CMMS claims, full Brick/Haystack conformance claims, arbitrary executable project plugins, and tamper-evident/audit-grade claims without a real integrity model.

### Architecture Approach

Adopt a modular monolith with hexagonal boundaries. Pure JavaScript domain modules handle schema, migrations, state derivation, semantics, mapping, routing, diagnostics, aggregation, and diffs without I/O. Browser views consume immutable project snapshots plus HA/Companion updates through adapters. The Companion exposes versioned bounded WebSocket commands, queries, and subscriptions, then routes them through policy and application services to split repositories and HA/remote gateways. Home Assistant remains the platform of record. See [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**

1. **Pure domain core** — deterministic model rules, migrations, engineering algorithms, and serialization shared by runtime/editor tests.
2. **Runtime card and editor clients** — accessible projections and command-based draft editing; no authoritative security or operational state.
3. **HA frontend adapter and Companion client** — the only browser I/O boundaries, including reconnect and snapshot/event reconciliation.
4. **Companion API and policy layer** — bounded envelopes, server-derived identity, resource authorization, stable errors, pagination, and subscriptions.
5. **Application services** — projects, controls, alarms, schedules, assets, reports, collaboration, and remote-site workflows.
6. **Gateways and split repositories** — HA inventory/services/Recorder/notify, remote HA connections, versioned project/ACL/operations/audit persistence, and lifecycle cleanup.
7. **Plugin registry and canonical build** — declarative namespaced contributions plus one traceable source-to-artifact pipeline.

**Cross-cutting contracts:**

- Authentication and base permissions come from HA; server-owned project ACLs may only restrict further.
- Store bindings as `{site_id, entity_id}` and obtain provenance from registries; never infer protocol from names.
- Commands name a configured `control_id`; the server normalizes the exact target/data and records authoritative actor/result events.
- Service acceptance is not plant success; wait for HA readback or expose timeout/mismatch.
- Shared mutations require `expected_revision`, operation ID, and an enforced server lease when editing.
- Snapshots plus monotonic events drive clients; sequence gaps trigger resynchronization.
- Raw history stays in Recorder; GLT persists only its own lifecycle records, definitions, and bounded run metadata.
- Standalone mode offers local engineering only. Loss of Companion for a shared project degrades to read-only and never falls back to direct privileged calls.

### Critical Pitfalls

1. **Treating the browser as an authority** — enforce every read, write, control, subscription, remote operation, and audit decision in the Companion with multi-user default-deny tests.
2. **Corrupting or conflating persisted data** — validate before normalization, migrate a copy sequentially, split projects/ACLs/operations/audit/secrets, verify counts and hashes, and retain rollback snapshots.
3. **Unsafe or falsely successful operations** — allow only configured targets, preserve HA context, distinguish accepted/readback/failed states, and keep simulation and commissioning writes physically unreachable without separate approval.
4. **Dual or incomplete lifecycle engines** — make alarms authoritative in one restart-safe backend state machine; bind HA schedules rather than creating an unsupported competing runtime.
5. **Inventing normality from missing data** — carry quality, freshness, coverage, partial failures, units, and provenance through state, trends, energy, reports, roll-ups, and multi-site views.
6. **Unbounded project, archive, history, remote, or plugin inputs** — apply depth/size/count/time/concurrency limits, safe bundle extraction, server-owned site allowlists, secret redaction, and declarative plugin manifests.
7. **Claims outrunning evidence** — test the exact shipped bytes in browsers and HA; withdraw “historian,” “true multi-site,” “accessible,” “300+,” and “2,000 objects” until defined evidence passes.

## Implications for Roadmap

Use ten vertical phases. Each phase must cross authored model, frontend, Companion, tests, documentation, and generated artifacts where applicable; do not complete a frontend-only or backend-only layer and postpone integration.

### Phase 1: Contract, Lifecycle, Migration, and Canonical Release Build

**Rationale:** Every later capability depends on safe data, a real Companion lifecycle, and traceable artifacts.  
**Delivers:** Canonical JSON Schema and parity fixtures; sequential migrations/dry-run/rollback; split Store bootstrap; clean setup/unload/reload; versioned capability contract; one reproducible build and artifact manifest.  
**Addresses:** 24, 25, 27, and release foundations of 30.  
**Avoids:** Corrupting the only Store, stale generated copies, oversized imports, false HA-version compatibility, and unload leaks.

### Phase 2: Server Policy, Secure Controls, Audit, and Collaboration

**Rationale:** Close the known authorization, target/audit, and unenforced-lock defects before adding privileged workflows.  
**Delivers:** Server-owned ACLs; policy matrix for queries/commands/subscriptions; exact configured-control gateway; authoritative audit; revision plus lease APIs and two-client conflict recovery.  
**Addresses:** 2, 3, 26 and security portions of 23–27 and 30.  
**Avoids:** Browser roles, leaked reads/counts, arbitrary targets, optimistic success, client-authored audit, lost updates, and advisory-only locks.

### Phase 3: Inventory, Provenance, Semantics, Profiles, and Mapping

**Rationale:** Stable identity and typed relationships are prerequisites for operations, engineering, diagnostics, analytics, and multi-site.  
**Delivers:** Registry-derived inventory/provenance; semantic graph validation; versioned equipment profiles and migrations; deterministic operational-state contract; explainable candidate mapping with acceptance, overrides, diff, and undo.  
**Addresses:** 1, 7, 8, 9, 23.  
**Avoids:** Name-inferred protocols, unsafe silent binding, unstable IDs, invalid graphs, unit mismatch, and profile-instance drift.

### Phase 4: Runtime Operations, Controls, and Semantic Drill-Down

**Rationale:** Prove the end-to-end snapshot/event/action/readback flow and accessible runtime composition before broadening engineering UI.  
**Delivers:** Incremental runtime projection; state/quality/freshness overlays; server-mediated profile controls; pending/readback UX; permission-filtered roll-ups; deep-linkable breadcrumbs; leitstand/kiosk shell.  
**Addresses:** 1–3, 14, runtime portions of 29.  
**Avoids:** Browser-invented state, false success, unauthorized aggregate leakage, stale values presented as live, and inaccessible critical controls.

### Phase 5: Catalog, Typed Ports, Routing, CAD, Bundles, and SDK

**Rationale:** Engineering breadth is safe only after validated profiles, stable IDs, revisioned saves, and explicit plugin boundaries exist.  
**Delivers:** Generated unique 300+ variant catalog evidence; typed ports; deterministic incremental routing; transactional CAD commands/undo/redo; stable bundle/diff round trips; namespaced declarative plugin registry and compatibility fixtures.  
**Addresses:** 10–13, 22, engineering portions of 25 and 29.  
**Avoids:** Symbol-count theater, detached routes, broken references, synchronous full reroutes, executable bundle code, prototype mutation, and pointer-only editing.

### Phase 6: Authoritative Alarms, Notifications, and Schedule Bindings

**Rationale:** These time- and restart-sensitive workflows need the policy, indexes, persistence, adapters, and controlled-time harness established earlier.  
**Delivers:** One backend alarm transition table; delay/hysteresis/ack/shelving/suppression/restart behavior; occurrence dedupe and bounded escalation; explicit notifier targets; audited HA schedule/calendar/script bindings and effective-value previews.  
**Addresses:** 4, 5, 6.  
**Avoids:** Broken closure tasks, ineffective shelving, duplicate restart notifications, alarm floods, swallowed schedule failures, DST errors, and dual engines.

### Phase 7: Recorder Trends, Energy, and Reproducible Reports

**Rationale:** Analytics must use stable bindings and an isolated Recorder compatibility gateway rather than current snapshots or a parallel historian.  
**Delivers:** Bounded raw/statistics queries; gaps/coverage/provenance; unit-safe aggregation/export/replay; meter hierarchy and reset-aware energy models; versioned report definitions and matching screen/CSV/print models.  
**Addresses:** 15, 18, 20.  
**Avoids:** Missing-as-zero, invalid aggregation, API drift, snapshot-as-historian, irreproducible periods, and unbounded exports.

### Phase 8: Safe Simulation, Commissioning, and Asset Workflows

**Rationale:** These features reuse the state-provider abstraction, semantic profiles, alarms, inventory, and history while requiring an explicit no-write safety boundary.  
**Delivers:** Deterministic virtual-time scenarios with persistent simulation marking and blocked action gateways; evidence-linked read-only diagnostic findings; asset identity, maintenance plans, and bounded work-order state transitions/history.  
**Addresses:** 16, 17, 19.  
**Avoids:** Simulation or commissioning reaching plant services, non-repeatable diagnostics, uncontrolled attachments, invalid maintenance due logic, and overclaiming CMMS capability.

### Phase 9: True Multi-Site Supervision

**Rationale:** Remote behavior should reuse proven local identity, policy, control, history, reporting, and partial-data contracts rather than form a second security model.  
**Delivers:** Backend-only credentials; server-owned site allowlist; bounded remote connections/subscriptions; freshness/latency/circuit health; failure-isolated portfolio roll-ups; authorized remote controls/history and exact audit.  
**Addresses:** 21 and multi-site portions of 14, 15, 20, 23, and 29.  
**Avoids:** SSRF, token leakage, cross-site policy bypass, serial fan-out, one-site global failure, and false healthy/complete roll-ups.

### Phase 10: Product-Wide i18n, Accessibility, Capacity, and Release Evidence

**Rationale:** These qualities are implemented throughout earlier phases, then closed against all complete workflows and exact release artifacts.  
**Delivers:** Catalog completeness and pseudo-locale/RTL/DST tests; keyboard, focus, screen-reader, forced-color, reduced-motion, zoom, mobile, kiosk, and manual accessibility evidence; representative 100/500/2,000-object browser/backend scenarios; minimum/current HA install-upgrade-unload lanes; claim registry, checksums, attestations, and release installation proof.  
**Addresses:** 28–30 and final acceptance of 1–27.  
**Avoids:** Hardcoded locale behavior, responsive-CSS accessibility claims, algorithm-only scale claims, source-token acceptance, packaging drift, and unsupported Platform 1.0 marketing.

### Complete Capability Ownership

| Capability | Primary phase | Capability | Primary phase | Capability | Primary phase |
|---:|---:|---:|---:|---:|---:|
| 1 | 3 / 4 | 11 | 5 | 21 | 9 |
| 2 | 2 / 4 | 12 | 5 | 22 | 5 |
| 3 | 2 | 13 | 5 | 23 | 3 |
| 4 | 6 | 14 | 4 | 24 | 1 |
| 5 | 6 | 15 | 7 | 25 | 1 / 5 |
| 6 | 6 | 16 | 8 | 26 | 2 |
| 7 | 3 | 17 | 8 | 27 | 1 |
| 8 | 3 | 18 | 7 | 28 | 10 |
| 9 | 3 | 19 | 8 | 29 | 4–10 cross-cutting |
| 10 | 5 | 20 | 7 | 30 | 1–10 cross-cutting |

### Phase Ordering Rationale

- Schema, lifecycle, migrations, and build provenance precede any shared-state expansion because every feature reads or persists the same project contract.
- Server policy and exact action normalization precede all privileged controls, alarms, schedules, reports, assets, and remote operations.
- Inventory, semantics, and profiles precede runtime objects and CAD because they define stable identity, binding, state, control, port, and validation contracts.
- Local flows precede multi-site so remote adapters reuse one proven policy and failure model.
- Recorder, simulation, and reporting use ports-and-adapters established earlier rather than introducing alternate state or history stores.
- i18n, accessibility, resilience, and capacity tests begin in every phase; Phase 10 closes evidence rather than adding those qualities from scratch.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1:** Decide the supported HA minimum/current matrix and exact HACS packaging model for the dashboard plugin plus Companion.
- **Phase 5:** Define plugin trust, install, review, distribution, and compatibility policy; same-realm JavaScript is not sandboxed.
- **Phase 6:** Verify public schedule/calendar authoring APIs at the chosen minimum HA version and define deployment-specific alarm philosophy, priorities, shelving, escalation, and retention.
- **Phase 7:** Pin Recorder history/statistics interfaces across HA lanes, including evolving statistics metadata; define valid energy/report calculations and periods.
- **Phase 9:** Prototype remote authentication renewal/revocation, reconnect, per-entity permissions, SSRF allowlist policy, bounded subscriptions, and partial failure.
- **Phase 10:** Derive numeric latency, memory, Store, update-rate, and concurrency budgets from representative browsers and HA hardware before publishing support limits.

Phases with established patterns (focused repository research, not broad research-phase):

- **Phase 2:** Authorization matrices, exact service gateways, revision/lease concurrency, and server audit follow well-documented HA and web patterns.
- **Phase 3:** JSON Schema-backed typed graphs, registry provenance, profile validation, and explainable candidate scoring have clear contracts.
- **Phase 4:** Snapshot/event reducers, incremental view models, readback state, and native-first accessible controls are standard implementation patterns.
- **Phase 8:** Adapter-isolated simulation and read-only diagnostics are clear once domain contracts exist; only deployment work-order policy needs local decisions.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | MEDIUM | Tool choices are grounded in official current documentation and fit the repository; exact HA/Python lanes and performance budgets remain to be executed. |
| Features | MEDIUM | All 30 have explicit professional acceptance behavior based on standards and vendor/HA sources; site-specific alarm, reporting, maintenance, and safety policy is unresolved. |
| Architecture | HIGH | The modular-monolith boundaries and vertical order directly answer observed repository coupling, authority, storage, and generated-artifact defects. Ecosystem API details still require compatibility tests. |
| Pitfalls | HIGH | Current defects are codebase-evidenced and prevention maps directly to phase exits; deployment thresholds and policies remain variable. |

**Overall confidence:** MEDIUM

### Unproven Platform 1.0 Claims

Until executable evidence exists, do not treat the current UI, documentation, token tests, or package version as proof of:

- server-enforced roles or resource-filtered reads/subscriptions;
- exact safe controls, authoritative audit, or equipment readback success;
- complete alarm delay/hysteresis/ack/shelving/escalation/restart behavior;
- schedule/calendar authoring and DST-safe execution;
- enforceable collaboration locks and conflict recovery;
- bounded schema migrations and lossless `.gltproject` exchange;
- a semantically unique and tested 300+ symbol catalog;
- Recorder-quality historian/replay, complete energy math, or reproducible period reports;
- safe simulation isolation or commissioning behavior;
- CMMS-depth assets/work orders;
- true failure-isolated and securely authenticated multi-site supervision;
- clean Companion unload/reload and the advertised HA 2024.8 compatibility floor;
- complete i18n, WCAG 2.2 AA workflows, mobile/kiosk readiness, or 2,000-object support;
- equality and traceability of every released/generated artifact.

### Gaps to Address

- **Alarm philosophy:** define site-specific priorities, response/escalation times, shelving limits, acknowledgment/return behavior, recipients, flood targets, and retention before Phase 6 acceptance.
- **HA compatibility:** prove minimum/current lanes; raise the floor rather than retaining an unsupported claim.
- **Schedule editing:** bind existing HA entities unless a supported public authoring API is verified.
- **Recorder evolution:** isolate and fixture-test exact APIs and metadata per supported lane.
- **Remote security:** choose legitimate site destinations, renewal/revocation behavior, and secret rotation without enabling an arbitrary private-network proxy.
- **Audit retention:** benchmark split Store repositories; research a supported export/persistence route if bounded Store capacity is insufficient.
- **Plugin policy:** decide trusted distribution and compatibility rules; never import executable code from project bundles.
- **Capacity budgets:** establish numeric budgets only after repeatable 100/500/2,000-object measurement on representative hardware.
- **Release distribution:** validate the desired HACS experience for the separate plugin/integration artifact types.
- **Claims:** maintain an evidence-linked claim registry and label incomplete capabilities experimental rather than weakening acceptance.

## Sources

### Primary (HIGH confidence)

- [Home Assistant developer documentation](https://developers.home-assistant.io/) — frontend/custom-card contracts, WebSocket extensions, permissions, registries, config entries, lifecycle, manifests, localization, sensors, and Recorder changes.
- [Home Assistant user documentation](https://www.home-assistant.io/) — Recorder, notifications, schedules, and calendars.
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) — canonical validation dialect.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) — accessibility, keyboard, names, and dialogs.
- [ISA-18 alarm-management standards](https://www.isa.org/standards-and-publications/isa-standards/isa-18-series-of-standards) and [OPC UA Part 9](https://reference.opcfoundation.org/specs/OPC-10000-9/4.8) — alarm lifecycle model.
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [secrets](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), and [file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) guidance — boundary controls.
- [Playwright documentation](https://playwright.dev/docs/intro) — browser projects, traces, visual and ARIA snapshots.
- [HACS publishing documentation](https://hacs.xyz/docs/publish/start/) and [GitHub secure Actions guidance](https://docs.github.com/en/actions/reference/security/secure-use) — packaging, release, immutable actions, and provenance.
- [Project Haystack](https://project-haystack.org/doc/docHaystack/Intro), [Brick Schema](https://docs.brickschema.org/), [ISO 50001](https://www.iso.org/standard/69426.html), [ISO 55000](https://www.iso.org/standard/83053.html), and [U.S. DOE commissioning guidance](https://www.energy.gov/cmei/buildings/hvac-commissioning) — semantics, energy, assets, and commissioning boundaries.

### Secondary (MEDIUM confidence)

- Current Siemens and Schneider Electric professional BMS documentation cited in [FEATURES.md](./FEATURES.md) — industry workflows for graphics engineering, trends, schedules, reports, semantic onboarding, and multi-site supervision.
- Repository mapping and direct source inspection summarized in [ARCHITECTURE.md](./ARCHITECTURE.md) and [PITFALLS.md](./PITFALLS.md) — current coupling, security, lifecycle, alarm, reporting, locking, and artifact defects.

### Detailed Research

- [STACK.md](./STACK.md) — exact tools, pins, CI lanes, and testing harnesses.
- [FEATURES.md](./FEATURES.md) — all 30 acceptance rows, dependencies, differentiators, anti-features, and evidence.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — ownership, boundaries, APIs, flows, migration, scaling, and vertical order.
- [PITFALLS.md](./PITFALLS.md) — phase-specific failure modes, mitigations, rollback rules, and warning signs.

---
*Research completed: 2026-08-31*  
*Ready for roadmap: yes*
