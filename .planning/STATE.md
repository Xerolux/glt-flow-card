---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: in_progress
stopped_at: Phase 2 execution in progress; plans 02-01 through 02-13 complete
last_updated: "2026-09-02T06:10:00.000Z"
last_activity: 2026-09-02 -- plan 02-13 executed; every one of the twelve Phase-2 sentinels is implemented
progress:
  total_phases: 10
  completed_phases: 1
  total_plans: 30
  completed_plans: 26
  percent: 22
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-31)

**Core value:** Operators and engineers can safely understand, operate, engineer, and diagnose a real building plant from one trustworthy Home Assistant interface.
**Current focus:** Phase 02 — authoritative-policy-controls-collaboration

## Current Position

Phase: 02 (authoritative-policy-controls-collaboration) — EXECUTING
Plan: 13 of 17 implemented (61 tasks planned)
Status: all twelve Phase-2 sentinels are implemented; migration/lifecycle,
packaging, documentation and the phase gate remain
Last activity: 2026-09-02 -- plans 02-01 through 02-13 committed on `claude/chatgpt-continuation-hi3y86` (PR #3)

Progress: [██░░░░░░░░] 22%

### Phase 2 sentinel state

`npm run test:phase2` reports 12 implemented, 0 controlled RED, 0 broken.

| Sentinel | Owner plan | State |
|---|---|---|
| phase2-policy-matrix | 02-06 | implemented |
| phase2-access-revocation | 02-07 | implemented |
| phase2-evidence-pagination | 02-10 | implemented |
| phase2-leases | 02-08 | implemented |
| phase2-collaboration-guard | 02-09 | implemented |
| phase2-merge | 02-09 | implemented |
| phase2-configured-controls | 02-11 | implemented |
| phase2-control-evidence | 02-11 | implemented |
| phase2-migration-lifecycle | 02-14 | implemented |
| phase2-authority-reducers | 02-12 | implemented |
| phase2-ui-fixture-seed | 02-12 | implemented |
| phase2-ui | 02-13 | implemented |

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: 20 min
- Total execution time: 1.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 4 | 81 min | 20 min |

**Recent Trend:**

- Last 3 plans: 37 min, 10 min, 19 min
- Trend: Raw-contract parity completed near the rolling average

*Updated after each plan completion*
| Phase 01 P02 | 37min | 3 tasks | 13 files |
| Phase 01 P03 | 10min | 2 tasks | 9 files |
| Phase 01 P04 | 19min | 2 tasks | 11 files |
| Phase 01 P05 | 15min | 3 tasks | 9 files |
| Phase 01 P06 | 30min | 2 tasks | 7 files |
| Phase 01 P07 | 26min | 2 tasks | 7 files |
| Phase 01 P08 | 24min | 3 tasks | 13 files |
| Phase 01 P09 | 22min | 2 tasks | 22 files |
| Phase 01 P10 | 18min | 2 tasks | 10 files |
| Phase 01 P11 | 33min | 3 tasks | 11 files |
| Phase 01 P12 | 28min | 2 tasks | 25 files |
| Phase 01 P13 | 34min | 2 tasks | 13 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- [Roadmap]: Use ten dependency-ordered brownfield vertical slices; every phase uses `mvp` mode.
- [Roadmap]: Each of the 30 v1.1 requirements has one primary phase owner; cross-cutting gates do not duplicate ownership.
- [Roadmap]: The Companion is authoritative for shared security-sensitive behavior; standalone shared projects fail read-only.
- [Roadmap]: Schema validation/migration and canonical artifact generation precede feature expansion.
- [Roadmap]: Localization, accessibility, security, realistic tests, and generated-artifact equality are continuous gates closed globally in Phase 10.
- [Phase 01-01]: Pin every registry artifact in the exact-set policy, including both PyPI wheel and source distributions.
- [Phase 01-01]: Treat automatic npm lifecycle hooks as fail-closed policy; only Ajv's reviewed prepublish hook is allowed.
- [Phase 01-01]: Write canonical online evidence to .planning/tmp/phase01-provenance.json by default for the next plan.
- [Phase 01]: Controlled RED requires both an approved marker and the matching exact-dist or lifecycle effect ledger.
- [Phase 01]: Clean Home Assistant dependency resolution uses the Linux/container lane because HA 2026.2.3 pins lru-dict 1.3.0 without a Windows Python 3.13 wheel.
- [Phase 01]: Use reserved .invalid schema IDs with repository-local ref closure and no remote schema fetching.
- [Phase 01]: Treat 100/500/2,000 object fixtures as correctness-only inputs; Phase 10 owns measured capacity evidence.
- [Phase 01]: Commit only the compact corpus manifest and regenerate fixture bodies in disposable temporary directories.
- [Phase 01]: Enforce raw bytes and tree budgets before schema validation in both runtimes. — Pre-validator limits prevent oversized and deeply nested inputs from reaching Draft 2020-12 evaluation or normalization.
- [Phase 01]: Generate standalone Ajv validators with canonical fingerprints. — Build-time generation avoids browser runtime compilation and makes schema drift fail closed.
- [Phase 01]: Use sorted-key UTF-8 canonical JSON with preserved array order. — Shared canonical bytes make JavaScript and Python SHA-256 evidence stable across runtimes.
- [Phase 01]: Resolve Python schema references from an in-memory repository-only registry. — Unknown refs fail with NoSuchResource and cannot trigger network resolution.
- [Phase 01]: Preserve the legacy schema-v1 core config shape while adding validated schema-v2 migration candidates and receipts. — Compatible additive evidence avoids breaking existing browser and bundle consumers.
- [Phase 01]: Treat only policy-declared identity collection order as irrelevant and keep semantic diff output non-executable. — This removes reorder noise without creating an unsafe patch path or hiding undeclared array semantics.
- [Phase 01]: Expand diff selection only through changed add/remove dependencies and fail closed on missing or cyclic metadata. — Unchanged targets need no selected operation while ambiguous dependency evidence must block.
- [Phase 01]: Preflight the complete ZIP32 central/local directory and archive limits before exposing bytes or creating extraction paths. — Reject traversal, aliases, collisions, overlap, encryption, unsupported methods, CRC/hash mismatches, and resource bombs at the trust boundary.
- [Phase 01]: Treat bundle assets as opaque bytes authenticated by SHA-256, with active-content canaries proving zero execution. — Asset names, MIME types, and contents remain data throughout read, write, parity, and extraction tests.
- [Phase 01]: Use canonical JSON, fixed ZIP metadata, lexical paths, and store-or-deflate parity for deterministic JavaScript/Python bundles. — Identical logical input must produce byte-stable archives and identical acceptance evidence in both runtimes.
- [Phase 01]: Keep active heads, immutable snapshots, journals, audit metadata, and the retained legacy backup under independent Home Assistant Store keys and versions.
- [Phase 01]: Write and verify the untouched legacy backup before staging migrated heads, expose no staged head, and promote only after digest read-back succeeds.
- [Phase 01]: Accept only expected revision, opaque user-bound preview identity, project identity, and stable selected operation IDs; recompute migration, diff, closure, and candidate server-side.
- [Phase 01]: Represent rollback as a new forward transaction from a verified server-owned content-addressed snapshot, never as history mutation or a client receipt.
- [Phase 01]: Resolve PREPARED journals deterministically to a verified old head when no snapshot exists or a verified new head when the immutable snapshot exists.
- [Phase 01]: Keep WebSocket commands component-scoped and guarded; publish one compatibility runtime only after recovery and remove it before awaited unload cleanup. — The supported registration API has no unregister callback, and the declared minimum lane cannot assume ConfigEntry.runtime_data.
- [Phase 01]: Retain only bounded lock TTL, snapshot retention, and audit retention options, with candidate reload rollback to the prior stored and effective runtime. — Every exposed option must have an observable secure effect and failed setup must not strand the entry on candidate values.
- [Phase 01]: Construct diagnostics from a fixed metadata allowlist with counts and 12-character digest/build prefixes. — Recursive redaction can miss future project, asset, state, audit, token, URL, and exception fields at the diagnostics trust boundary.
- [Phase 01]: Treat the pre-v1 card and pre-extension editor bodies as canonical authored bases so generated release files are output-only.
- [Phase 01]: Compile standalone Ajv validators from canonical schemas inside the temporary compiler tree and bundle src/v100/entry.js exactly once.
- [Phase 01]: Use a non-circular canonical manifest with relative source/artifact SHA-256 evidence and latest source-affecting commit plus dirty marker.
- [Phase 01]: Record Node 22 as the declared build target and retain exact Ajv/esbuild versions to avoid host-patch manifest drift.
- [Phase 01]: Keep release verification independent and prove it with isolated double builds plus four seeded drift failures.
- [Phase 01]: Keep integration repository stage rooted at custom_components/glt_flow_card while zip_release members remain component-relative for direct HACS extraction. — Repository validation and release-asset extraction have distinct roots.
- [Phase 01]: Validate HACS stages independently by re-enumerating and hashing source, build, stage, and ZIP bytes without importing the stager. — Independent verification must not trust staging implementation or metadata.
- [Phase 01]: Keep Companion category evidence local and credential-free; public repository creation or discoverability is not a Phase-1 success criterion. — Publication requires separate explicit authorization and an exact target.
- [Phase 01]: Keep Project safety as one Projects-adjacent native action with five accessible tabs.
- [Phase 01]: Use local pure contract and bundle functions only for read-only inspection; route every shared mutation through authoritative Companion preview, apply, and rollback.
- [Phase 01]: Render custom assets as opaque text metadata and prove zero HTML, SVG, script, remote network, service, or localStorage effects.
- [Phase 01]: Fail shared v0.4 ProjectStore operations closed when a present Companion rejects, retaining local behavior only without WebSocket authority.
- [Phase 01]: Resolve stable HA releases from official PyPI metadata and pin architecture-specific official GHCR platform digests before execution.
- [Phase 01]: Match each HA lane to the exact official pytest harness dependency and run the complete component suite from exact staged artifacts.
- [Phase 01]: Preserve the evidence-backed 2024.8.0 minimum; package schema authorities component-locally and bridge OptionsFlow compatibility.
- [Phase 01]: Keep CI read-only, preflight provenance before image execution, and transfer one manifest-hashed stage into separate validation jobs.
- [Phase 01]: Make double-build and exact-dist tools emit hash-bound evidence so release acceptance can consume proof without rebuilding.
- [Phase 01]: Separate read-only release verification from same-repository publication with narrowly scoped contents, identity-token and attestation permissions.
- [Phase 01]: Run twenty unique current commands including each T-01 through T-08 owner exactly once and map all thirty task rows to behavioral evidence.
- [Phase 01]: Treat the Companion integration-category shape as local release evidence, not public HACS availability or capacity certification.

### Pending Todos

**Count:** 1

- [Maintain cross-AI execution handoff](todos/pending/2026-09-01-maintain-cross-ai-execution-handoff.md) — Keep the canonical cross-AI checklist current as roadmap work and verification progress.

### Blockers/Concerns

- [Phase 2]: No known technical blocker. The bounded plan check passed on 2026-09-02 (see `02-PLAN-CHECK.md`); execution is under way.
- [Phase 2]: Shared mutation routes now require a valid bearer at the policy boundary. Plan 02-09 must still add the decisive in-lock recheck; the boundary check alone cannot see authority that changes mid-request.
- [Phase 1]: Resolved in planning — lanes are discovered and digest-pinned at execution, and Companion packaging is validated as a local integration-category artifact without unauthorized publication.
- [Phase 5]: SDK trust, distribution, and compatibility policy must forbid project-bundled privileged execution.
- [Phase 6]: Deployment alarm philosophy and supported schedule/calendar authoring APIs require decisions.
- [Phase 7]: Recorder API lanes and energy/report calculation contracts must be pinned.
- [Phase 9]: Remote authentication, SSRF allowlisting, and partial-failure budgets require prototyping.
- [Phase 10]: Numeric 100/500/2,000-object budgets require representative hardware measurements.

## Deferred Items

No numbered v1.1 requirement is deferred.

## Session Continuity

Last session: 2026-09-02T06:10:00.000Z
Stopped at: Phase 2 execution; plans 02-01 through 02-13 complete and pushed
Resume file: .planning/phases/02-authoritative-policy-controls-collaboration/.continue-here.md
