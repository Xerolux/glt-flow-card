---
phase: 01
slug: trusted-contract-release-foundation
status: verified
nyquist_compliant: true
wave_0_complete: true
last_updated: 2026-09-01
plan_count: 13
task_count: 30
---

# Phase 01 Validation Strategy

Execution evidence is complete. `npm run test:phase1` recorded every current focused suite and each unique T-01..T-08 owner command exactly once in `.planning/tmp/phase1-evidence.json`, with command/output and exact-artifact SHA-256 identities. Tests used isolated fixtures, supported fake Home Assistant harnesses or digest-pinned disposable official HA images; no live HA, remote site, bus or plant write was authorized or performed.

## Layers and Canonical Paths

| Layer | Canonical harness/evidence |
|---|---|
| Provenance | `tools/provenance-allowlist.json` plus read-only official registry/source/integrity verifier |
| Contract | `schemas/project/{0,1,2}.schema.json`, `schemas/bundle-manifest.schema.json`, `schemas/limits.json`, `schemas/diff-policy.json` only |
| Node/Python | Shared corpus; Python tests only under `tests/components/glt_flow_card/` |
| Browser | Playwright loads exact generated `dist/glt-flow-card.js`; generated dist/www/editor are outputs only |
| Packaging | Deterministic build then separate local plugin and integration-category staging validation |
| Home Assistant | Official release/image preflight, immutable digest+architecture lock, supported pytest HA harness/container bootstrap |
| Acceptance | `npm run test:phase1` emits requirement/ROADMAP/threat/hash evidence and fails on missing/skipped suites |

## Exact Task Map (30 tasks)

| Task | Evidence target | Automated command | Status |
|---|---|---|---|
| 01-01-T1 | Exact five-entry immutable provenance policy rejects ranges/drift/scripts | `node --test test/provenance.test.mjs --test-name-pattern="allowlist"` | verified 2026-09-01 |
| 01-01-T2 | Official npm/PyPI/source metadata and archive integrity verify read-only | `node --test test/provenance.test.mjs && node tools/verify-provenance.mjs --online` | verified 2026-09-01 |
| 01-02-T1 | Verified exact Node/Python/browser tools and canonical scripts install/dry-run | `node tools/verify-provenance.mjs --online && npm ci --ignore-scripts && py -3.13 -m pip install --dry-run -r requirements-test.txt` | verified 2026-09-01 |
| 01-02-T2 | Exact-dist happy path records controlled RED and zero forbidden effects | `npm run test:e2e:red` | verified 2026-09-01 |
| 01-02-T3 | Supported HA pytest lifecycle records controlled RED and resource ledger | `node tools/assert-red.mjs --expected=missing-lifecycle-cleanup -- py -3.13 -m pytest tests/components/glt_flow_card/test_init.py -q` | verified 2026-09-01 |
| 01-03-T1 | Canonical raw schemas/limits/diff policy are complete and singular | `node --test test/contract-fixtures.test.mjs --test-name-pattern="schema|limits|policy|canonical paths"` | verified 2026-09-01 |
| 01-03-T2 | Deterministic hostile/boundary and 100/500/2,000 correctness fixtures match | `npm run test:fixtures` | verified 2026-09-01 |
| 01-04-T1 | JS enforces raw budgets/schema and canonical evidence before normalization | `npm run test:contract:js` | verified 2026-09-01 |
| 01-04-T2 | Python results exactly equal JS across all corpus/limit cases | `npm run test:contract:parity && node --test --test-name-pattern="rejects raw oversized and deeply nested documents" test/v100-contract.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_contract.py -q -k "oversized or deep"` | verified 2026-09-01 |
| 01-05-T1 | Pure sequential 0→1→2 migration parity, dry-run, receipt and idempotence | `npm run test:migrations && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q` | verified 2026-09-01 |
| 01-05-T2 | Five semantic categories, impact and dependency closure match | `npm run test:diff && py -3.13 -m pytest tests/components/glt_flow_card/test_project_diff.py -q` | verified 2026-09-01 |
| 01-05-T3 | Existing core/examples preserve semantics through hardened path | `node --test test/v100-core.test.mjs test/v100-migrations.test.mjs test/v100-diff.test.mjs` | verified 2026-09-01 |
| 01-06-T1 | Hostile/over-limit ZIPs reject before extraction in both runtimes | `npm run test:bundle && py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q -k "reject or limit or collision or traversal"` | verified 2026-09-01 |
| 01-06-T2 | Deterministic valid bundles round-trip opaque assets without active effects | `npm run test:bundle && py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q -k "roundtrip or opaque or deterministic"` | verified 2026-09-01 |
| 01-07-T1 | Split stores import legacy data once with retained verified backup | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_repository.py -q` | verified 2026-09-01 |
| 01-07-T2 | Preview/apply/rollback/recovery is authoritative, immutable and journaled | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_transactions.py tests/components/glt_flow_card/test_websocket.py -q` | verified 2026-09-01 |
| 01-08-T1 | Setup/reload/unload/re-setup has exact one/zero owned resources | `py -3.13 -m pytest tests/components/glt_flow_card/test_init.py -q` | verified 2026-09-01 |
| 01-08-T2 | Single-instance options validate, affect runtime and rollback failed reload | `py -3.13 -m pytest tests/components/glt_flow_card/test_options.py -q` | verified 2026-09-01 |
| 01-08-T3 | Localized allowlisted diagnostics exclude all sensitive canaries | `py -3.13 -m pytest tests/components/glt_flow_card/test_diagnostics.py -q -k "redact or canary or allowlist"` | verified 2026-09-01 |
| 01-09-T1 | Sole staged build produces canonical schema/runtime outputs and exact dist/www | `npm run build && node --test test/release-build.test.mjs --test-name-pattern="single build|manifest|schema copies|dist www"` | verified 2026-09-01 |
| 01-09-T2 | Independent double-build detects byte/hash/version/schema/generated drift | `npm run verify:release` | verified 2026-09-01 |
| 01-10-T1 | Exact local plugin/integration stages and deterministic Companion ZIP exist | `npm run stage:hacs && node --test test/hacs-staging.test.mjs --test-name-pattern="stage|zip|no publication"` | verified 2026-09-01 |
| 01-10-T2 | Both local category shapes validate independently without credentials | `npm run validate:hacs-staging` | verified 2026-09-01 |
| 01-11-T1 | Approved shell/read-only tabs, locale, keyboard/focus and responsive behavior pass exact-dist | `npm run build && npm run test:e2e -- --grep="shell|validate|bundles|evidence|keyboard|locale"` | verified 2026-09-01 |
| 01-11-T2 | Guided semantic selective apply/conflict/rollback has no fallback/service call | `npm run build && npm run test:e2e -- --grep="migrate|diff|selective apply|conflict|rollback|no fallback|no service"` | verified 2026-09-01 |
| 01-11-T3 | Full exact-dist UI/accessibility matrix and opaque-asset effect tests pass | `npm run build && npm run test:e2e -- --grep="opaque asset|xss|network|no service" && npm run test:e2e` | verified 2026-09-01 |
| 01-12-T1 | Bounded resolver pins official lanes and, when needed, atomically raises all minimum-version metadata to the first passing supported release before rebuild/restage/revalidation | `node --test test/ha-lanes.test.mjs && npm run resolve:ha-minimum -- --max-candidates=12` | verified 2026-09-01 |
| 01-12-T2 | Exact artifacts install/upgrade/reload/unload/re-setup on both verified lanes | `npm run test:ha-artifacts` | verified 2026-09-01 |
| 01-13-T1 | Full source→tested→staged→releasable evidence chain passes without a public Companion mirror | `npm run test:release-acceptance` | verified 2026-09-01 |
| 01-13-T2 | Fail-closed gate maps every requirement/ROADMAP/threat to exact evidence | `node --test test/phase1-gate.test.mjs && npm run test:phase1` | verified 2026-09-01 |

The table has exactly one row for each real task. No three consecutive implementation tasks lack automated verification.

## Canonical Threat Ownership

Stable descriptions, assets/boundaries and mitigations are authoritative in `01-THREATS.md`.

| ID | Owner | Exact owner command | Status |
|---|---|---|---|
| T-01 Client alters candidate/selection after preview | 01-07-T2 | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_transactions.py tests/components/glt_flow_card/test_websocket.py -q -k "preview or selection or stale or closure"` | verified 2026-09-01 |
| T-02 User invokes rollback with browser-forged receipt | 01-07-T2 | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_transactions.py tests/components/glt_flow_card/test_websocket.py -q -k "rollback or receipt or identity"` | verified 2026-09-01 |
| T-03 Oversized/deep/regex-hostile JSON | 01-04-T2 | `npm run test:contract:parity && node --test --test-name-pattern="rejects raw oversized and deeply nested documents" test/v100-contract.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_contract.py -q -k "oversized or deep"` | verified 2026-09-01 |
| T-04 ZIP traversal, alias, collision, overlap, bomb | 01-06-T1 | `npm run test:bundle && py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q -k "reject or limit or collision or traversal"` | verified 2026-09-01 |
| T-05 SVG/HTML/script asset executes during inspection | 01-11-T3 | `npm run build && npm run test:e2e -- --grep="opaque asset|xss|network|no service" && npm run test:e2e` | verified 2026-09-01 |
| T-06 Interrupted apply corrupts head/history | 01-07-T2 | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_transactions.py -q -k "interruption or recovery or journal or immutable"` | verified 2026-09-01 |
| T-07 Diagnostics or bundle leaks remote tokens/state | 01-08-T3 | `py -3.13 -m pytest tests/components/glt_flow_card/test_diagnostics.py -q -k "redact or canary or allowlist"` | verified 2026-09-01 |
| T-08 Generated/release artifact differs from reviewed source | 01-13-T1 | `npm run test:release-acceptance` | verified 2026-09-01 |

Any failed, skipped, missing or non-reproducible owner command leaves the HIGH threat open and blocks execution readiness/sign-off. Supporting controls in plan threat tables do not replace these owners.

## Requirement and Source Audit

| Item | Plans | Status |
|---|---|---|
| SCHEMA-01 raw-before-normalization parity, stable errors and bounds | 01-03, 01-04 | COVERED |
| SCHEMA-01 sequential migrations, dry-run, receipts, canonical digest, legacy backup/rollback | 01-05, 01-07, 01-11 | COVERED |
| SCHEMA-01 bounded `.gltproject` and opaque assets | 01-06, 01-11 | COVERED |
| DIFF-01 five categories, impact, ordering policy and dependency closure | 01-05 | COVERED |
| DIFF-01 expected revision, server recomputation and same-path selective apply | 01-07, 01-11 | COVERED |
| HACS-01 split stores, Config Entry lifecycle/options/diagnostics | 01-07, 01-08 | COVERED |
| HACS-01 deterministic build/copy/manifest and two category shapes | 01-09, 01-10 | COVERED |
| HACS-01 verified immutable HA install/upgrade/reload/unload/re-setup | 01-12 | COVERED |
| UI-SPEC one action/five tabs/five steps/copy/states/accessibility | 01-11 | COVERED |
| Exact-artifact release/requirement evidence | 01-09 through 01-13 | COVERED |
| Research local Companion staging resolution | 01-10, 01-13 | COVERED |
| Research immutable HA lane resolution | 01-12 | COVERED |
| Research bounded 100/500/2,000 correctness fixtures without capacity claims | 01-03, 01-04, 01-05 | COVERED |
| ROADMAP: runtime parity/actionable diagnostics | 01-04, 01-13 | COVERED |
| ROADMAP: no-loss migration and verified rollback | 01-05, 01-07, 01-11, 01-12 | COVERED |
| ROADMAP: safe selective apply without stale overwrite | 01-05, 01-07, 01-11 | COVERED |
| ROADMAP: reproducible dashboard/Companion installation and upgrade | 01-09, 01-10, 01-12, 01-13 | COVERED |
| ROADMAP: source/generated/release equality | 01-09, 01-11, 01-12, 01-13 | COVERED |

Excluded as later scope: live plant/fieldbus controls, remote-site operations, Phase-10 capacity/performance certification, and public Companion repository creation/publication. An optional future upload must be disabled by default and separately authorized with an exact target/token; it is not Phase-1 evidence.

## Sampling and Sign-off

- Quick loops target under 30 seconds where practical: contract JS/parity, migration, diff, focused pytest and filtered Playwright.
- Exact build, full UI and HA lanes run at owning plan/CI gates.
- Token greps, syntax-only checks, screenshots alone and workflow presence do not satisfy requirements or threats.
- [x] Provenance verifier passed before install.
- [x] Wave-0 controlled RED evidence exists and later paths are GREEN.
- [x] All 30 task commands passed without required skips.
- [x] All eight canonical HIGH owner commands passed.
- [x] `npm run test:phase1` emitted complete requirement/ROADMAP/hash evidence.
- [x] No live HA, remote, bus, plant write or unauthorized public Companion publication occurred.

`wave_0_complete` and `nyquist_compliant` are true because every checkbox above is backed by committed plan summaries plus the final hashed Phase-1 evidence report.
