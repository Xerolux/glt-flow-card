---
phase: 02-authoritative-policy-controls-collaboration
plan: 01
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
---

# Plan 02-01 Summary — Wave-0 Scaffolding

## What was built

**Task 1 — canonical threat/evidence contract.** `02-THREATS.md` now carries a
machine-checkable `Status` column (every row starts `planned`) alongside the
existing owner and blocking-command columns. T2-01..T2-16 each appear exactly
once, the ASVS L1 mapping and the fail-closed release rule are intact, and no
threat was renumbered or weakened.

**Task 2 — authenticated multi-principal fixtures.** `tests/components/
glt_flow_card/user_factory.py` adds `Phase2UserFactory`, which creates seven
real Home Assistant principals: `viewer`, `operator`, `engineer`,
`engineer_two`, `admin` (ordinary users with server-assigned project roles),
`ha_admin` (a Home Assistant administrator with no project membership) and
`unassigned`. Each principal/session pair gets its own credential, refresh
token and access token, so two connections for one user are distinguishable and
a reconnect always allocates a new session that cannot reuse a prior binding.
`ControlledService` is a named fake service with an explicit allowlist that
defaults to zero permitted calls and records exact domain, service, data,
target and context. `conftest.py` exposes `phase2_users` and
`controlled_service`, and `LifecycleEffects` now counts subscriptions, cursors,
leases, control waits, rate buckets and late callbacks, with
`phase2_resource_total()` and `reset()`.

**Task 3 — strict RED classifier, browser ledger and Phase-2 entry points.**
`tools/assert-red.mjs` gained the twelve Phase-2 registry entries. Each binds
one literal `EXPECTED_RED[...]` marker, one task-specific effect-ledger prefix,
and one sentinel identity derived from a fixed naming rule (pytest node ids use
`test_expected_red_<key with underscores>`; Node/Playwright titles use
`[expected-red:<key>]`). It now also rejects zero-test runs, skipped tests,
collection/import errors and any failing test that is not the named sentinel.
`test/assert-red.test.mjs` mutation-tests the accepted case plus sixteen
rejection classes against deterministic fake output emitted by
`test/fixtures/red-emitter.mjs`. `test/e2e/fixtures/fake-ha.mjs` records
sessionStorage, IndexedDB, history, clipboard, console, diagnostics/export,
WebSocket request bodies and subscriptions in addition to the existing sinks,
seeds token / current-project / other-user sentinels, and adds
`scanSeededSecrets()` and `formatEffectLedger()`.

## Verification

| Command | Result |
|---|---|
| `python -c` threat-register assertion | T2 register OK |
| `pytest tests/components/glt_flow_card/test_init.py -q -x` | 7 passed |
| `node --test test/assert-red.test.mjs test/phase1-gate.test.mjs` | 28 passed |
| `node -e` phase2 script presence check | present |
| `npm test` | 114 passed, 0 failed, 0 skipped |
| `npm run test:python` | 94 passed |

## Decisions

- Seven principals rather than five: the fixed role matrix needs four project
  roles, concurrency needs a second engineer, and the HA-ceiling cases need both
  an unassigned HA administrator and an unassigned ordinary user.
- One refresh token per session. Session identity is the refresh-token id, which
  is what a lease or cursor must bind to, and what a reconnect must invalidate.
- The Phase-2 resource ledger reads registries through a tolerant accessor, so a
  registry that a later plan has not created yet contributes zero and starts
  failing on leaks the moment it exists.
- `test:phase2` initially runs the controlled `test:phase2:quick` suite. Plan
  02-17 replaces it with `tools/verify-phase2.mjs` and adds the sole
  non-recursive `test:phase2:release` leaf; 02-01 deliberately does not create
  that leaf or assign T2-16.

## Follow-ups

- `test/fixtures/red-emitter.mjs` is a new test-only fixture that was not listed
  in the plan's `files_modified`; it exists so the classifier mutation tests
  never spawn a real suite.
