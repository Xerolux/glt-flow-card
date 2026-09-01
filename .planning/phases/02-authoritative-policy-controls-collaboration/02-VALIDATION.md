---
phase: 02
slug: authoritative-policy-controls-collaboration
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-01
---

# Phase 02 — Validation Strategy

> Continuous validation contract for SEC-01 and COLLAB-01. Every protected path must prove both allowed behavior and zero-effect denial.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | pytest + pytest-homeassistant-custom-component 0.13.316; Node 22 test runner; Playwright 1.62.1 |
| **Config files** | `pytest.ini`, `playwright.config.mjs`, `tests/components/glt_flow_card/conftest.py` |
| **Quick run command** | `npm run test:phase2:quick` |
| **Full local command** | `npm run build && npm test && npm run test:python && npm run test:e2e` |
| **Release/HA leaf command** | `npm run test:phase2:release` |
| **Max task feedback latency** | 30 seconds for focused tests; full gates after every wave |

## Sampling Rate

- **After every task commit:** Run the task's focused Python/Node behavioral suite and its relevant denial/effect-ledger cases.
- **After every plan wave:** Run `npm run build && npm test && npm run test:python`; add exact-dist Playwright for any UI or browser-state wave.
- **After the security boundary wave:** Run the complete registered-command × principal allow/deny matrix and zero-service-effect suite.
- **Before phase verification:** Run the full local, exact-dist two-browser, HACS, immutable Home Assistant lane, release, provenance, and clean-checkout gates.
- **No sampling gap:** No three consecutive implementation tasks may complete without an automated behavioral command.

## Requirement Verification Map

| Requirement | Threat Refs | Secure Behavior | Test Type | Automated Command | Status |
|-------------|-------------|-----------------|-----------|-------------------|--------|
| SEC-01 | T2-01, T2-02, T2-03 | Registered routes exactly equal deny-default policy manifest; fixed role matrix and HA ceiling | HA integration matrix | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy.py -q -x` | ⬜ pending |
| SEC-01 | T2-04 | Unauthorized/missing project list, count, search, audit, cursor, remote, and subscription paths do not enumerate | Multi-user HA + E2E | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy_enumeration.py tests/components/glt_flow_card/test_policy_subscriptions.py -q -x` | ⬜ pending |
| SEC-01 | T2-05 | Project/import content cannot self-grant; ACL revisions and HA authority caps are server-owned | Store/WS integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_access.py -q -x` | ⬜ pending |
| SEC-01 | T2-06, T2-07 | Configured control ID resolves exact current-head service/target/data; malicious overrides and bounds cause zero calls | Controlled service integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_configured_controls.py -q -x` | ⬜ pending |
| SEC-01 | T2-08 | Accepted/dispatched/confirmed/timeout/denied/result-unknown evidence is server-authored and correlation-stable | Failure injection | `py -3.13 -m pytest tests/components/glt_flow_card/test_control_evidence.py -q -x` | ⬜ pending |
| SEC-01 | T2-09 | Trusted audit and untrusted telemetry remain separate, bounded, paginated, redacted, and scope-authorized | Store/WS integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_trusted_evidence.py tests/components/glt_flow_card/test_evidence_pagination.py -q -x` | ⬜ pending |
| COLLAB-01 | T2-10 | One exclusive project lease, connection/user binding, rotation, renewal, expiry, release, reconnect invalidation | Async multi-connection HA | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_leases.py -q -x` | ⬜ pending |
| COLLAB-01 | T2-11 | Every shared mutation atomically rechecks role, lease, revision, access revision, digest, and policy under race barriers | Concurrency/failure injection | `py -3.13 -m pytest tests/components/glt_flow_card/test_collaboration.py -q -x` | ⬜ pending |
| COLLAB-01 | T2-12 | Bounded three-way conflict evidence preserves candidate; non-overlap merge succeeds, overlap/second conflict never loses updates | Python + Node reducers | `py -3.13 -m pytest tests/components/glt_flow_card/test_merge.py -q -x && node --test test/phase2-collaboration.test.mjs` | ⬜ pending |
| SEC-01 / COLLAB-01 | T2-13 | Authority loss is same-render-cycle read-only with no service, shared storage, token, target, or network fallback | Node + exact-dist E2E | `node --test test/phase2-authority.test.mjs && node tools/run-exact-dist-playwright.mjs --grep=authority` | ⬜ pending |
| SEC-01 / COLLAB-01 | T2-14 | Two browsers prove roles, leases, conflict/retry/merge, DE/EN, keyboard/focus/live regions, 320px reflow, and secret absence | Exact-dist Playwright | `node tools/run-exact-dist-playwright.mjs --grep=phase-2-ui` | ⬜ pending |
| SEC-01 / COLLAB-01 | T2-15 | Legacy migration is idempotent and reload/unload clears every subscription/task/cursor/lease/rate bucket | HA lifecycle | `py -3.13 -m pytest tests/components/glt_flow_card/test_phase2_migration.py tests/components/glt_flow_card/test_phase2_lifecycle.py -q -x` | ⬜ pending |
| SEC-01 / COLLAB-01 | T2-16 | Exact generated/HACS artifacts pass minimum/current HA lanes and release gates with zero unintended service attempts | Release/HA artifact | `npm run test:phase2:release` | ⬜ pending |

## Wave 0 Requirements

- [ ] `tests/components/glt_flow_card/user_factory.py` — five principals, admin/non-admin ceilings, access tokens, same-user and second-user connections.
- [ ] `tests/components/glt_flow_card/test_policy.py` and `test_policy_enumeration.py` — command inventory and non-enumerating role matrix.
- [ ] `tests/components/glt_flow_card/test_project_access.py`, `test_policy_subscriptions.py`, `test_evidence_pagination.py` — ACL, subscription, and cursor harnesses.
- [ ] `tests/components/glt_flow_card/test_project_leases.py`, `test_collaboration.py`, `test_merge.py` — lease and race/merge harnesses.
- [ ] `tests/components/glt_flow_card/test_configured_controls.py`, `test_control_evidence.py`, `test_trusted_evidence.py` — controlled-service and evidence fault injection.
- [ ] `tests/components/glt_flow_card/test_phase2_migration.py`, `test_phase2_lifecycle.py` — upgrade/resource ledgers.
- [ ] `test/phase2-authority.test.mjs`, `test/phase2-collaboration.test.mjs` — browser state machines.
- [ ] `test/e2e/fixtures/shared-authority.mjs`, `test/e2e/project-authority.spec.mjs` — shared two-context coordinator and exact-dist scenarios.
- [ ] `package.json` scripts `test:phase2:quick`, outer `test:phase2`, and non-recursive leaf `test:phase2:release`; release acceptance must require both Phase 1 and Phase 2 evidence without invoking either Phase-2 script.

## Non-Recursive Command Ownership

- `npm run test:phase2` is the only outer Phase-2 orchestrator entry and executes `tools/verify-phase2.mjs`.
- `tools/verify-phase2.mjs` executes each canonical threat owner once and invokes `npm run test:phase2:release` exactly once for T2-16.
- `npm run test:phase2:release` is a leaf aggregation of `validate:hacs-staging`, `test:ha-artifacts`, `verify:release`, and `test:release-acceptance`; those commands validate the existing manifest-hashed stage and effect evidence and never call the outer orchestrator or the leaf.
- `test/phase2-gate.test.mjs` must parse the complete `package.json`/tool subprocess dependency graph, reject direct or indirect cycles, reject any second reachable T2-16 leaf invocation, and prove the outer-to-leaf path occurs exactly once.

## Mandatory Failure Injection

- ACL bootstrap/save/read-back failures, malformed legacy ACL, repeated migration.
- Simultaneous lease acquisition, renewal at expiry, disconnect during renewal, role/access revision change, old-token replay.
- Mutation barriers before/after guard, journal, snapshot, head, and audit; exactly one authorized commit and no lost update.
- Trusted evidence failure before dispatch and after dispatch; no automatic repeat of a physical action.
- Wrong/late/missing readback, permission revocation while waiting, and listener cleanup.
- Cursor/lease/token cross-user, connection, project, filter, and restart replay.
- Oversized/deep/key-heavy/rate-heavy inputs at below/equal/above boundaries with bounded memory/store growth.
- Reload/unload during active leases, subscriptions, cursors, and control waits; runtime unavailable first and resource ledger zero afterward.

## Manual-Only Verifications

All Phase-2 acceptance behavior is automated. No live Home Assistant, remote site, fieldbus, or plant write is required or authorized.

## Validation Sign-Off

- [x] All planned requirement surfaces have automated commands or explicit Wave 0 dependencies.
- [x] Sampling continuity prevents three consecutive unverified implementation tasks.
- [x] Failure injection covers every authoritative durable/effect boundary.
- [x] No watch-mode flags or live control targets are used.
- [x] Exact generated artifacts, not source modules alone, are required at the phase gate.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-09-01; execution evidence pending
