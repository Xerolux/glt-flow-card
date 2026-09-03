---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: in_progress
stopped_at: all ten phases closed and reviewed; close-out complete, no release authorized
last_updated: "2026-09-03T07:30:00.000Z"
last_activity: 2026-09-03 -- close-out: review passes for all ten phases, Phase 1 blocker verified closed at head, three filtered-route authorization leaks fixed and the class guarded, the SSRF destination re-check given a structural guard, the i18n sweep's blind spot found and closed, and every phase given a summary and a summary per plan
progress:
  total_phases: 10
  completed_phases: 10
  total_plans: 167
  completed_plans: 167
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-31)

**Core value:** Operators and engineers can safely understand, operate, engineer, and diagnose a real building plant from one trustworthy Home Assistant interface.
**Current focus:** close-out — review passes and the traceability the registry now checks

## Current Position

Phase: 10 (usability-release-evidence) — CLOSED
Plan: 15 of 15 implemented (15 plans across 7 waves)

**All ten phases are executed and closed.** The milestone's plans are done; what
remains is close-out, and one row that is honestly unfinished.

### The row that was carried as unfinished

**T10-03** was marked `not met` — not `verified`, and deliberately not `planned`
either — while 132 user-facing strings remained outside the catalog. The sweep
named each one and the claim registry published the corresponding claim **as
failed**, which is the registry working on its own author.

It was reported finished on 2026-09-03 — and that report was wrong, which the
review pass the same day found. The sweep asked a **linguistic** question: does
this string read like prose? `PROSE` needs two whitespace-separated words and
`GERMAN` needs an umlaut or a stop word, so eleven single-word German labels
(`Projektname`, `Layername`, `Aufgabe`, `⚡ Energie` and the rest) were invisible
to it while it printed PASS.

The sweep now asks a **structural** question alongside it: was the literal handed
to something that shows it? Any bare string passed to `prompt`, `confirm`,
`alert`, `.textContent` or `.innerText` is a finding whatever it looks like.
Nine keys were added, the sites rewritten, and two glyph-only buttons that had
no accessible name at all gained one. `verify-i18n-coverage` reports PASS on
both sweeps, and the structural one is mutation-checked against the exact blind
spot.

### Phase 10, in one paragraph

Localization, accessibility and release evidence are the same defect from three
angles — **a claim about the product that nothing behind it supports.** A locale
is data now rather than an edit to fourteen modules; a missing translation
throws instead of showing an English sentence to a German operator; formatting
refuses instead of falling back to the viewer's locale; every focusable element
has a role and a name where the product had zero `aria-label` attributes; an
automated sweep covers every registered surface with no rule disabled; and a
claim registry fails the build on a claim nothing supports, publishes a failed
claim as failed, and has no schema in which an automated result and a manual
pass combine into conformance. `10-SUMMARY.md` carries the detail and the limits.

### The blocked row, in every phase

T10-16, T9-20, T8-25, T7-23, T6-21, T5-16, T4-14, T3-14 and T2-16 all stay
`planned`. Each is owned by the composed `test:phaseN:release` leaf, whose
`test:ha-artifacts` leg probes `docker info` for twelve bounded candidates, and
this environment has no Docker engine. Each carries its exact failure output.

### What is claimed, and by what

`node tools/claim-registry.mjs` runs every claim's command and publishes the
result: **15 passed, 0 failed, 4 not exercised** at head. The four unexercised
capabilities are screen-reader behaviour, representative capacity, the pinned
Home Assistant lanes and dependency provenance — each with its reason, because a
reader who is not told assumes they were exercised.

### Environment limits, current as of Phase 10

1. The container's Chromium revision differs from the pinned one; since Phase 9
   `playwright.config.mjs` resolves that itself and prints the substitution, so
   no gate needs `PLAYWRIGHT_CHROMIUM_EXECUTABLE` set by hand.
2. All five third-party repository provenance endpoints answer 403;
   `api.github.com/rate_limit` answers 200, so this is a repository-scope limit
   rather than a network one. It blocks F-01 and every gate recursing into it,
   which means **no phase gate from 2 upward has ever completed its recursion in
   this environment.**
3. No Docker engine, which blocks the release leaf in every phase.
4. In CI that leaf fails for a different reason: Home Assistant 2026.9.0 was
   published while `pytest-homeassistant-custom-component` 0.13.362 still pins
   `homeassistant==2026.9.0b6`. Not this branch's failure; which release the
   product certifies against is a product decision, so no resolver change was
   pushed.

### Close-out, completed 2026-09-03

Every phase now carries a phase summary, a summary per plan, and a review.

**The review passes found four things worth having found**, three of them
security-relevant:

1. **Three filtered routes returned rows of projects the caller cannot read**
   (`work_orders/list`, `reports/list`, `evidence/list` — the last of these the
   trusted audit trail). This is the `alarms/list` leak of `9f53bcb` three more
   times, because that fix was applied to the instance rather than the class.
   Fixed, and `test_filtered_route_authority.py` now closes the class by
   deriving its route list from the policy contract and asserting **rows**
   rather than response codes.
2. **The SSRF destination re-check was correct by memory, not by construction.**
   Both outbound sites called it; nothing made that a property of the product.
   `test_outbound_destination_guard.py` gives it the same AST guarantee Phase 8
   built for service dispatch.
3. **The i18n sweep had a blind spot and T10-03 was closed on its PASS** — see
   above.
4. **The authored v040 source did not parse as JavaScript.** `part06` carried a
   ternary whose `?` reads as optional chaining, so the manual workflow that is
   supposed to bundle those parts could never have run. The token test proved
   each module was *mentioned* and never asked node to read the result; it now
   runs `node --check`.

Six phases came back with no defects: 3, 4, 6, 7, 8, and Phase 1's blocker
confirmed closed at head (`01-REVIEW-VERIFY.md`).

One warning is left open as a recorded decision, not an oversight: the correct
pattern for a filtered route lives in docstrings rather than in a shape that
makes the omission impossible (`02-REVIEW.md`, WR-01). The structural fix is a
refactor of eight handlers with different result shapes, which is not what a
close-out review should trade a tested fix for.

`REQUIREMENTS.md` traceability is current, and says which row is blocked wherever
a requirement is complete with an exception.

**No release is authorized and none was made.**
Last activity: 2026-09-03 -- close-out complete on `claude/chatgpt-continuation-hi3y86` (PR #3)

Progress: [██████████] 100%

### Phase 10 register

15 of 17 rows verified, each from its own owner command run at head. T10-03 is
`not met` with 154 strings named; T10-16 is blocked with its exact failure.

### Phase 9 register

19 of 20 rows verified, each from its own owner command run at head; where five
rows name one command, that command was run five times. T9-20 blocked, recorded
with its exact failure.

### Phase 7 sentinel state

`node tools/phase7-red-gate.mjs` reports 11 implemented, 0 controlled RED, 0 broken.

### Phase 6 sentinel state

`node tools/phase6-red-gate.mjs` reports 14 implemented, 0 controlled RED, 0 broken.

| Sentinel | Owner plan | State |
|---|---|---|
| phase6-vocabulary | 06-02 | implemented |
| phase6-lifecycle | 06-06 | implemented |
| phase6-suppression | 06-07 | implemented |
| phase6-restart | 06-08 | implemented |
| phase6-index | 06-09 | implemented |
| phase6-retention | 06-10 | implemented |
| phase6-notifications | 06-11 | implemented |
| phase6-escalation | 06-11 | implemented |
| phase6-schedule-dst | 06-12 | implemented |
| phase6-schedule-parity | 06-12 | implemented |
| phase6-schedule-routes | 06-13 | implemented |
| phase6-schedule-bindings | 06-14 | implemented |
| phase6-shipped-truth | 06-15 | implemented |
| phase6-ui | 06-17 | implemented |

### Phase 4 sentinel state

`node tools/phase4-red-gate.mjs` reports 10 implemented, 0 controlled RED, 0 broken.

| Sentinel | Owner plan | State |
|---|---|---|
| phase4-panels | 04-05 | implemented |
| phase4-panel-enumeration | 04-05 | implemented |
| phase4-view-stream | 04-06 | implemented |
| phase4-navigation | 04-07 | implemented |
| phase4-navigation-counts | 04-08 | implemented |
| phase4-panel-model | 04-10 | implemented |
| phase4-navigation-reducer | 04-09 | implemented |
| phase4-command-outcome | 04-11 | implemented |
| phase4-view-resync | 04-12 | implemented |
| phase4-ui | 04-13 | implemented |

### Phase 3 sentinel state

`node tools/phase3-red-gate.mjs` reports 7 implemented, 0 controlled RED, 0 broken.

| Sentinel | Owner plan | State |
|---|---|---|
| phase3-semantic-model | 03-07 | implemented |
| phase3-provenance | 03-08 | implemented |
| phase3-provenance-policy | 03-09 | implemented |
| phase3-profiles | 03-10 | implemented |
| phase3-mapping | 03-12 | implemented |
| phase3-equipment-state | 03-14 | implemented |
| phase3-ui | 03-15 | implemented |

### Phase 2 sentinel state

`npm run test:phase2:quick` reports 12 implemented, 0 controlled RED, 0 broken.

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

- [Phase 4]: No known technical blocker. All 17 plans are implemented; only the Docker-dependent T4-14 row and the review passes remain.
- [Phase 5]: No known technical blocker. All 20 plans are implemented; the Docker-dependent T5-16 row, the review passes, and three recorded limitations remain (two diagonals a lane offset cannot separate, five editor naming prompts, and v040 extension parts 05/06 still absent from the shipped artifact).
- [Phase 6]: No known technical blocker. All 20 plans are implemented and all 14 audited defects are closed, including the live `alarms/list` authorization hole fixed separately in `9f53bcb`. The Docker-dependent T6-21 row, the review passes, and two recorded limitations remain: a site cannot express four or five alarm priority classes (that is a schema change, not a setting), and measured capacity at thousands of alarms is Phase 10's.
- [Phase 3]: No known technical blocker. All 17 plans are implemented; only the Docker-dependent T3-14 row and the review passes remain.
- [Phase 2]: No known technical blocker. The bounded plan check passed on 2026-09-02 (see `02-PLAN-CHECK.md`); execution is complete.
- [Phase 2]: Shared mutation routes now require a valid bearer at the policy boundary. Plan 02-09 must still add the decisive in-lock recheck; the boundary check alone cannot see authority that changes mid-request.
- [Phase 1]: Resolved in planning — lanes are discovered and digest-pinned at execution, and Companion packaging is validated as a local integration-category artifact without unauthorized publication.
- [Phase 5]: SDK trust, distribution, and compatibility policy must forbid project-bundled privileged execution.
- [Phase 6]: RESOLVED. Schedule authoring is `schedule/create|update|delete` (admin-gated), calendar authoring is `calendar.create_event` gated on `CalendarEntityFeature.CREATE_EVENT`, holidays bind to `binary_sensor.workday` with its per-Bundesland `province`. The alarm philosophy is configuration with conservative defaults, decided with the user on 2026-09-02; the priority vocabulary is the one deliberate exception.
- [Phase 7]: RESOLVED. Home Assistant 2026.2.3 already resolves `day`, `week`, `month` and `year` on local-midnight boundaries in the configured timezone -- measured at 23- and 25-hour days and 743- and 745-hour months for Europe/Berlin -- and `change` is reset-aware over the Recorder's reset-corrected running sum. `year` is reachable only through `recorder/statistic_during_period`'s calendar spec. Three traps recorded with owners: a window starting before a statistic exists reports the whole accumulated total as the first period's consumption; gaps are omitted from results rather than emitted; and `mean_type` CIRCULAR exists. Nothing in the Recorder API bounds a raw query, so the bounds are ours and belong server-side. Planning is complete; execution has not started.
- [Phase 9]: Remote authentication, SSRF allowlisting, and partial-failure budgets require prototyping.
- [Phase 10]: Numeric 100/500/2,000-object budgets require representative hardware measurements.

## Deferred Items

No numbered v1.1 requirement is deferred.

Two capabilities are deliberately out of v1.1 and recorded in
[FUTURE-ROADMAP.md](FUTURE-ROADMAP.md) so the decisions stay visible:

- **F-01 Executable extension contributions.** SDK-01 ships contributions as
  data; no contributed code executes in any realm. This forecloses
  third-party computed rendering. Confirmed with the user on 2026-09-02.
- **F-02 Public distribution of symbol packs.** Local installation only;
  publication needs an exact target and separate authorization.

## Session Continuity

Last session: 2026-09-03T07:30:00.000Z
Stopped at: close-out complete -- all ten phases closed, summarised per plan and
reviewed; four review findings fixed and each guarded at the class rather than
the instance
Resume file: none. What remains needs a Docker engine, verified dependency
provenance, or a person with assistive technology -- see "Environment limits".
