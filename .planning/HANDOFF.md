# GLT Flow Card v1.1 — Living Cross-AI Execution Handoff

**Last updated:** 2026-09-01T20:41:43+02:00
**Canonical scope:** Implement and verify all original roadmap items **1-30**.
**Overall status:** Paused at the user's request. Phase 1 implementation and all 14 reported code-review fixes are committed with full post-fix gates passing. Phase 2 planning is complete with 17 plans and 61 tasks, but implementation has not started; one bounded final plan-check verdict remains open because its last run was intentionally interrupted. Phases 3-10 have not started.
**Maintainer rule:** Update this file whenever implementation, review, verification, or blockers change.

## Purpose and User Intent

This is the durable, AI-independent execution record for the full GLT Flow Card v1.1 roadmap. It exists so another AI can continue safely without relying on chat history.

The user explicitly requested implementation of **all original items 1-30**. No numbered requirement is deferred. A feature is not considered complete merely because code or a plan exists: its applicable behavioral tests, audits, exact-artifact checks, and phase verification must also pass.

## Safety and Authorization Boundaries

- Work is limited to repository source, generated artifacts, documentation, isolated development environments, and tests unless the user gives new explicit authorization.
- Do not perform live Home Assistant writes, remote-site writes, physical-bus writes, or plant/equipment service calls. Live control validation requires separate approval with exact bounded targets.
- Do not create, publish, push, or advertise a public HACS repository, GitHub release, GitHub Pages deployment, or other public artifact without an exact target and explicit authorization. The user authorized this paused repository snapshot to be pushed to `origin/main`; no release or other publication was authorized.
- Local HACS staging and isolated Home Assistant container tests are allowed; they are not public publication.
- Never echo, store, log, or commit credentials, tokens, secrets, remote URLs containing secrets, or private payloads.
- Shared and security-sensitive behavior must fail closed when Companion authority is unavailable. Browser role checks are UX only.
- Edit authored sources and generators first. Generated runtime copies are acceptance artifacts, not independent sources of truth.
- Preserve unrelated or concurrent changes. Never reset, overwrite, or revert another worker's edits without evidence and coordination.

## Current Repository Snapshot

This is a timestamped snapshot, not a substitute for a fresh `git status` when resuming.

| Field | Snapshot at 2026-09-01T20:41:43+02:00 |
|---|---|
| Repository | `C:\Users\basti\Documents\GitHub\glt-flow-card` |
| Branch | `main` |
| HEAD before this pause handoff update | `7d77583` |
| Upstream comparison | `origin/main...HEAD`: 0 behind, 0 ahead after the pause handoff push |
| Push/publication | Pause state pushed to `origin/main` through `0f935ac`; no release authorized or created |
| Working tree | Clean after committing Phase 2 planning and before creating pause artifacts |
| Active recovery marker | None |
| Preserved local fix branch | `gsd-reviewfix/01-phase1-code-fixes` is already merged; retained only as local history |
| Temporary worktrees/containers | None active |

Before editing, refresh this section with `git status --short --branch`, `git rev-parse --short HEAD`, `git rev-list --left-right --count origin/main...HEAD`, and `git worktree list`. If the recovery marker still exists, inspect it and coordinate with the active review fixer before touching overlapping files.

## Authoritative Planning and Evidence Artifacts

Read these as a set; no single file is sufficient:

- Project intent and constraints: [PROJECT.md](PROJECT.md)
- Full phase ownership and success criteria: [ROADMAP.md](ROADMAP.md)
- Exact requirement language and Definition of Done: [REQUIREMENTS.md](REQUIREMENTS.md)
- Current workflow position, decisions, todos, and blockers: [STATE.md](STATE.md)
- This living cross-AI checklist: [HANDOFF.md](HANDOFF.md)
- Machine-readable pause handoff: [HANDOFF.json](HANDOFF.json)
- Exact Phase 2 resume marker: [`.continue-here.md`](phases/02-authoritative-policy-controls-collaboration/.continue-here.md)
- Phase 1 decisions and acceptance model: [01-CONTEXT.md](phases/01-trusted-contract-release-foundation/01-CONTEXT.md)
- Phase 1 research: [01-RESEARCH.md](phases/01-trusted-contract-release-foundation/01-RESEARCH.md)
- Phase 1 UI contract: [01-UI-SPEC.md](phases/01-trusted-contract-release-foundation/01-UI-SPEC.md)
- Phase 1 threat ledger: [01-THREATS.md](phases/01-trusted-contract-release-foundation/01-THREATS.md)
- Phase 1 validation design: [01-VALIDATION.md](phases/01-trusted-contract-release-foundation/01-VALIDATION.md)
- Phase 1 implementation plans and summaries: `.planning/phases/01-trusted-contract-release-foundation/01-01-PLAN.md` through `01-13-PLAN.md` and matching `SUMMARY.md` files
- Independent Phase 1 code review and open findings: [01-REVIEW.md](phases/01-trusted-contract-release-foundation/01-REVIEW.md)
- Compact Phase 1 execution evidence, when regenerated: `.planning/tmp/phase1-evidence.json`
- Phase 2 decisions and planning: `phases/02-authoritative-policy-controls-collaboration/02-CONTEXT.md`, `02-UI-SPEC.md`, `02-RESEARCH.md`, `02-PATTERNS.md`, `02-THREATS.md`, `02-VALIDATION.md`, `02-SOURCE-AUDIT.md`, and `02-01-PLAN.md` through `02-17-PLAN.md`

The current `ROADMAP.md`, `REQUIREMENTS.md`, and `STATE.md` record Phase 1 as implementation-complete/ready for verification. The stricter acceptance status in this handoff takes precedence for resumption: Phase 1 and its requirements are **not finally verified** until the remaining checklist below passes and a final verification report exists.

## Ten-Phase Execution Map

| Phase | Name | Owned requirements | Current status | Next action |
|---:|---|---|---|---|
| 1 | Trusted Contract & Release Foundation | SCHEMA-01, DIFF-01, HACS-01 | ◆ 13/13 plans and 14/14 review fixes implemented; final verification open | Resume with one consolidated verification pass, not another review loop |
| 2 | Authoritative Policy, Controls & Collaboration | SEC-01, COLLAB-01 | ◆ 13/17 plans implemented; all twelve Phase-2 sentinels report implemented | Execute plan 02-14 (migration and lifecycle), then 02-15 through 02-17 |
| 3 | Semantic Equipment & Provenance | OPS-01, SEM-01, MAP-01, PROF-01, PROTO-01 | ○ Not started | Start after Phase 2 verification |
| 4 | Runtime Operations & Drill-Down | OPS-02, NAV-01 | ○ Not started | Start after Phase 3 verification |
| 5 | CAD Engineering & Extension Platform | CAT-01, ENG-01, ENG-02, CAD-01, SDK-01 | ○ Not started | Start after Phase 4 verification |
| 6 | Alarms, Notifications & Schedules | ALM-01, ALM-02, SCH-01 | ○ Not started | Start after Phase 5 verification |
| 7 | Trends, Energy & Reproducible Reports | HIST-01, ENER-01, REPORT-01 | ○ Not started | Start after Phase 6 verification |
| 8 | Safe Simulation, Commissioning & Assets | SIM-01, DIAG-01, ASSET-01 | ○ Not started | Start after Phase 7 verification |
| 9 | Failure-Isolated Multi-Site Supervision | SITE-01 | ○ Not started | Start after Phase 8 verification |
| 10 | Product-Wide Usability & Release Evidence | I18N-01, A11Y-01, TEST-01 | ○ Not started | Close product-wide evidence after Phase 9 verification |

## Requirement Checklist — Original Items 1-30

Checkboxes represent final acceptance, not implementation alone. All remain unchecked until their phase verifier and applicable release evidence pass.

- [ ] **1 — OPS-01: Deterministic operational state** — Owner: Phase 3 — Status: Not started.
- [ ] **2 — OPS-02: Profile-driven object panels and command outcomes** — Owner: Phase 4 — Status: Not started.
- [ ] **3 — SEC-01: Authoritative server-side permissions** — Owner: Phase 2 — Status: Planning complete; implementation and verification not started.
- [ ] **4 — ALM-01: Restart-safe alarm lifecycle** — Owner: Phase 6 — Status: Not started.
- [ ] **5 — ALM-02: Notification and escalation policies** — Owner: Phase 6 — Status: Not started.
- [ ] **6 — SCH-01: Schedules, calendars, exceptions, and DST** — Owner: Phase 6 — Status: Not started.
- [ ] **7 — SEM-01: Validated semantic equipment hierarchy** — Owner: Phase 3 — Status: Not started.
- [ ] **8 — MAP-01: Explainable entity mapping and iDM profiles** — Owner: Phase 3 — Status: Not started.
- [ ] **9 — PROF-01: Versioned parametric equipment profiles** — Owner: Phase 3 — Status: Not started.
- [ ] **10 — CAT-01: Verified 300-plus symbol catalog** — Owner: Phase 5 — Status: Not started.
- [ ] **11 — ENG-01: Typed compatible ports and stable endpoints** — Owner: Phase 5 — Status: Not started.
- [ ] **12 — ENG-02: Deterministic obstacle-aware auto-routing** — Owner: Phase 5 — Status: Not started.
- [ ] **13 — CAD-01: Transactional full CAD designer workflow** — Owner: Phase 5 — Status: Not started.
- [ ] **14 — NAV-01: Permission-safe contextual navigation** — Owner: Phase 4 — Status: Not started.
- [ ] **15 — HIST-01: Honest Recorder-backed trends** — Owner: Phase 7 — Status: Not started.
- [ ] **16 — SIM-01: Deterministic no-write simulation** — Owner: Phase 8 — Status: Not started.
- [ ] **17 — DIAG-01: Read-only commissioning diagnostics** — Owner: Phase 8 — Status: Not started.
- [ ] **18 — ENER-01: Unit-safe reproducible energy views** — Owner: Phase 7 — Status: Not started.
- [ ] **19 — ASSET-01: Bounded maintenance and asset workflows** — Owner: Phase 8 — Status: Not started.
- [ ] **20 — REPORT-01: Reproducible reports and deliveries** — Owner: Phase 7 — Status: Not started.
- [ ] **21 — SITE-01: Failure-isolated multi-site supervision** — Owner: Phase 9 — Status: Not started.
- [ ] **22 — SDK-01: Versioned declarative extension SDK** — Owner: Phase 5 — Status: Not started.
- [ ] **23 — PROTO-01: Registry-derived protocol provenance** — Owner: Phase 3 — Status: Not started.
- [ ] **24 — SCHEMA-01: Bounded shared schema, migrations, and bundles** — Owner: Phase 1 — Status: Implementation complete; independent review fixes and final verification pending.
- [ ] **25 — DIFF-01: Semantic selective comparison and rollback** — Owner: Phase 1 — Status: Implementation complete; CR-02/CR-03/CR-04 fixes and final verification pending.
- [ ] **26 — COLLAB-01: Revision-plus-lease collaborative editing** — Owner: Phase 2 — Status: Planning complete; implementation and verification not started.
- [ ] **27 — HACS-01: Correct Companion/plugin packaging and lifecycle** — Owner: Phase 1 — Status: Implementation complete; independent review fixes and final verification pending. Local staging only; no public publication authorized.
- [ ] **28 — I18N-01: Complete extensible localization** — Owner: Phase 10 — Status: Not started.
- [ ] **29 — A11Y-01: WCAG 2.2 AA-oriented behavior and evidence** — Owner: Phase 10 — Status: Not started.
- [ ] **30 — TEST-01: Exact-artifact, security, E2E, failure, and capacity gates** — Owner: Phase 10 — Status: Not started; Phase 1 establishes only its prerequisite release foundation.

## Phase 1 — Exact Current Status

### Implemented baseline before independent review

- [x] All **13/13 Phase 1 plans** were implemented and committed.
- [x] The deterministic build passed before review.
- [x] The full Node suite passed **89/89** before review.
- [x] Exact staged artifacts passed both isolated Home Assistant lanes: **2024.8.0 = 64/64** and **2026.8.3 = 64/64**.
- [x] Local dashboard-plugin and Companion integration HACS staging was generated and independently validated without public publication.
- [x] Phase 1 release evidence mapped all planned tasks and the T-01 through T-08 threat owners before review.

These checks are a pre-review baseline. They must be rerun after fixes; they do not close final verification by themselves.

### Independent review and fix result

The standard-depth reviews inspected the same 95-file scope and cumulatively reported **14 concrete findings**. All 14 are implemented and recorded in [01-REVIEW-FIX.md](phases/01-trusted-contract-release-foundation/01-REVIEW-FIX.md), status `all_fixed`, committed by `fc05158`. The fixes cover cross-runtime number/Unicode parity, array mutation ordering, dependency closure, rollback identity, bounded preview retention, deterministic clean-checkout artifacts, hermetic gates, equal-clock eviction, and recoverable exactly-once audit persistence.

Post-fix evidence is green: Node **93/93**, local Python **90/90**, exact-dist Chromium **18/18**, Home Assistant 2024.8.0 **91/91**, Home Assistant 2026.8.3 **91/91**, HACS categories, release acceptance, provenance, clean tracked export, Windows checkout, and Linux Node 22 checkout. No service attempts, live HA writes, bus/plant writes, publication, or running containers remain.

The last [01-REVIEW.md](phases/01-trusted-contract-release-foundation/01-REVIEW.md) records the audit-persistence blocker that was subsequently fixed by `83d8b32`. A further clean-review rerun was deliberately interrupted on 2026-09-01 at the user's instruction to stop repeated checking. Do not restart an iterative review loop; if closing Phase 1 later, use one bounded consolidated verifier and record its verdict.

### Phase 1 remaining acceptance checklist

- [x] Complete and commit the cumulative fix report for all 14 review findings, including targeted behavioral regression tests and exact commit references (`83d8b32`, report commit `fc05158`).
- [ ] Obtain a final clean consolidated verdict if Phase 1 is formally closed later. Repetitive review loops were stopped by explicit user instruction on 2026-09-01.
- [x] Re-run the complete post-fix implementation gate set: Node 93/93, Python 90/90, exact-dist 18/18, both HA lanes 91/91, HACS, provenance, release acceptance, clean tracked export, Windows and Linux checkout evidence.
- [ ] Run the Phase 1 security audit against [01-THREATS.md](phases/01-trusted-contract-release-foundation/01-THREATS.md); create and pass the security report, with no unresolved blocking severity.
- [ ] Run the Phase 1 UI audit against [01-UI-SPEC.md](phases/01-trusted-contract-release-foundation/01-UI-SPEC.md); create and pass the UI review, including exact-dist keyboard/reflow/no-side-effect evidence.
- [ ] Run schema drift and codebase drift checks; record results and resolve blocking drift without editing generated artifacts alone.
- [ ] Run the independent Phase 1 goal verifier and create `.planning/phases/01-trusted-contract-release-foundation/01-VERIFICATION.md` with a passing verdict and evidence links.
- [ ] Only after all preceding items pass, mark Phase 1 and SCHEMA-01, DIFF-01, and HACS-01 finally complete in this file and reconcile `ROADMAP.md`, `REQUIREMENTS.md`, and `STATE.md` in one evidence-linked commit.

## Phases 2-10 — Remaining Work

For each remaining phase, follow the phase's exact goal and requirements in `ROADMAP.md` and `REQUIREMENTS.md`. Do not replace behavioral evidence with source-token assertions.

Phase 2 planning is complete and committed as `7d77583`. Its 17 plans contain 61 tasks across 14 waves. The prior checker found a recursive T2-16 owner; the planning revision corrected it. The final checker was then intentionally interrupted at the user's stop request, so the first resume action is one bounded plan check—not another planning cycle.

- [ ] **Phase 2:** Establish authoritative default-deny Companion permissions, configured exact control targets, trusted audit, and atomic revision-plus-lease collaboration; prove multi-user denials and fail-closed shared behavior.
- [ ] **Phase 3:** Build the validated semantic hierarchy, versioned profiles, explainable entity mapping, registry-derived provenance, and deterministic operational state shared across UI/backend.
- [ ] **Phase 4:** Deliver profile-driven operational panels, explicit command result states, contextual drill-down, deep links, breadcrumbs, and permission-filtered navigation.
- [ ] **Phase 5:** Deliver the verified 300-plus catalog, typed ports, deterministic routing, transactional accessible CAD tools, and a bounded declarative SDK without privileged project scripts.
- [ ] **Phase 6:** Deliver restart-safe alarms, suppression/shelving/hysteresis, observable notifications/escalations, and audited timezone/DST-safe schedule/calendar execution.
- [ ] **Phase 7:** Deliver bounded Recorder history, honest provenance/coverage, reset-aware unit-safe energy calculations, and reproducible screen/CSV/print report models.
- [ ] **Phase 8:** Deliver deterministic virtual-time simulation with hard service-write blocking, read-only commissioning diagnostics, and bounded maintenance/assets/work-order evidence.
- [ ] **Phase 9:** Deliver backend-only remote credentials, allowlisted sites, bounded concurrent remote access, permission-safe partial roll-ups, failure isolation, and exact remote audit.
- [ ] **Phase 10:** Close German/English localization, WCAG-oriented accessibility, exact release compatibility, failure injection, and measured 100/500/2,000-object capacity evidence across the complete product.

For every phase: discuss unresolved product decisions, research unstable framework/API details from authoritative sources, create checked plans, execute in dependency order, review code, audit security and UI when applicable, run drift checks, verify the goal independently, then update all four tracking artifacts.

## How to Resume Safely

1. Read, in order: `AGENTS.md`, `.planning/HANDOFF.json`, `.planning/HANDOFF.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and `.planning/phases/02-authoritative-policy-controls-collaboration/.continue-here.md`, then the current phase's planning artifacts.
2. Refresh Git state. Inspect the current branch, HEAD, upstream divergence, working tree, worktrees, active recovery markers, and recent commits. Do not discard or fold concurrent work silently.
3. If a recovery marker exists, determine whether its worker/worktree/branch is active. Resume or reconcile that exact effort before starting an overlapping fix. Preserve the marker until recovery is complete.
4. Treat claims in summaries as historical evidence. Re-run the relevant gates after any source, dependency, generator, test, workflow, packaging, schema, or generated-artifact change.
5. Use exact shipped artifacts for browser, HACS, Home Assistant, and release checks. A passing source-module test does not prove the packaged artifact.
6. Use isolated/fake/container Home Assistant lanes and read-only diagnostics. Never infer permission for a live service call, remote operation, or plant write.
7. For security-sensitive behavior, prove success and denial with server-owned identity, target, policy, bounds, timestamps, and audit. Client UI restrictions do not count as enforcement.
8. Commit narrowly scoped work with exact evidence references. Do not push or publish unless the user separately authorizes the exact destination.
9. Before handing off again, update this document's snapshot, status, requirement checkboxes, remaining checklist, evidence paths, commit hashes, blockers, and change log.

## Evidence and Completion Rules

- Mark a requirement or phase checkbox `[x]` only after its owned implementation is committed, required behavioral tests pass, applicable security/UI/release gates pass, and the independent phase verification report has a passing verdict.
- Implementation-only milestones must use explicit text such as `Implementation complete; verification pending` and remain unchecked.
- Record exact commit hashes and repository-relative report/evidence paths for every completion claim.
- Timestamp every update in ISO 8601 with timezone. Also update the snapshot timestamp when Git state is refreshed.
- Never erase a blocker, failed gate, review finding, or superseded decision. Mark it resolved with date, commit, and evidence path, and retain its history.
- Keep `.planning/HANDOFF.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and `.planning/STATE.md` consistent. If concurrent work prevents an immediate synchronized edit, document the discrepancy here as an explicit blocker and reconcile it before phase completion.
- Preserve original requirement numbering 1-30 and one primary owner phase per requirement.
- Do not claim capacity, compatibility, accessibility, security, HACS availability, or release readiness from token checks, mocks alone, local staging alone, or pre-fix evidence.

## Compact Change Log

| Timestamp | Change | Commit/evidence |
|---|---|---|
| 2026-09-01T20:41:43+02:00 | Paused all phase work at explicit user request. Committed the complete Phase 2 planning package (17 plans/61 tasks), recorded the interrupted final plan check as the exact resume gate, and pushed the pause state to `origin/main`; no release. | `7d77583`; `0f935ac`; `HANDOFF.json`; `phases/02-authoritative-policy-controls-collaboration/.continue-here.md` |
| 2026-09-01T19:21:11+02:00 | Stopped repeated review loops at explicit user request; recorded all 14 findings fixed and the full post-fix gate results; left consolidated security/UI/goal verification and Phases 2-10 open. | `83d8b32`; `fc05158`; `phases/01-trusted-contract-release-foundation/01-REVIEW-FIX.md` |
| 2026-09-01T17:38:29+02:00 | Created the canonical cross-AI handoff; captured the strict distinction between Phase 1 implementation and final verification; recorded all 30 requirements, open review findings, safety boundaries, and remaining phases. | Handoff commit pending at document creation; todo capture `d9ad33d`; review report `.planning/phases/01-trusted-contract-release-foundation/01-REVIEW.md` |
