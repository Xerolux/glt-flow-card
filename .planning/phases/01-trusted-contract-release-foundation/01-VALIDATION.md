---
phase: 1
slug: trusted-contract-release-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for trustworthy project contracts, migrations, rollback, lifecycle cleanup, and exact release artifacts.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | Node 22 `node:test`; `pytest` with Home Assistant fixtures; Playwright 1.62.x |
| **Config files** | Existing `package.json`; Python and Playwright configuration installed in Wave 0 |
| **Quick run command** | `npm run test:contract` |
| **Full suite command** | `npm run test:phase1` |
| **Estimated runtime** | Quick: <30 seconds; full local suite: <10 minutes excluding the compatibility matrix |

The Node and Python validators MUST consume the same raw fixture corpus and compare stable error codes, JSON-pointer paths, migration steps, canonical hashes, semantic operations, and archive outcomes. Browser tests MUST load the exact staged distribution bundle, not source modules.

---

## Sampling Rate

- **After every task commit:** Run `npm run test:contract` plus the directly affected targeted test file.
- **After every plan wave:** Run `npm test`, targeted Python integration tests, `npm run build`, `npm run verify:generated`, and the Project-safety Playwright spec.
- **Before `$gsd-verify-work`:** `npm run test:phase1`, the minimum/current Home Assistant matrix, both HACS category validations, and exact-artifact verification MUST be green.
- **Max feedback latency:** 30 seconds for the task-level contract loop.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-W0-01 | TBD | 0 | SCHEMA-01 | T-03 | Raw bounded validation rejects malformed, oversized, deeply nested, future-version, and reference-invalid projects before defaults | parity/unit | `npm run test:contract` | ❌ W0 | ⬜ pending |
| 1-W0-02 | TBD | 0 | SCHEMA-01 | T-04, T-05 | Archive preflight rejects traversal, ambiguous names, bombs, executable inspection, unsupported entries, and manifest mismatch before extraction | unit/property | `node --test test/v100-bundle.test.mjs` | ❌ W0 | ⬜ pending |
| 1-W0-03 | TBD | 0 | SCHEMA-01, DIFF-01 | T-01, T-02, T-06 | Migration/apply is immutable, revision-checked, journaled, and restores a verified server-owned snapshot after injected failures | integration | `py -3.12 -m pytest tests/components/glt_flow_card/test_project_transactions.py -q` | ❌ W0 | ⬜ pending |
| 1-W0-04 | TBD | 0 | DIFF-01 | T-01 | Semantic diff ignores reorder noise, closes dependencies for selective apply, and never bypasses the transaction path | unit/e2e | `node --test test/v100-diff.test.mjs && npm run test:e2e -- --grep "project safety"` | ❌ W0 | ⬜ pending |
| 1-W0-05 | TBD | 0 | HACS-01 | T-07 | Setup/options/reload/unload are idempotent, diagnostics remain redacted, and teardown releases every task, listener, WebSocket registration, and manager resource | HA integration | `py -3.12 -m pytest tests/components/glt_flow_card/test_init.py tests/components/glt_flow_card/test_options.py -q` | ❌ W0 | ⬜ pending |
| 1-W0-06 | TBD | 0 | HACS-01 | T-08 | One clean build produces byte-identical copies with matching versions, SHA-256 provenance, deterministic archives, and installable HACS artifacts | build/release | `npm run verify:release` | ❌ W0 | ⬜ pending |

Threat references are defined in `01-RESEARCH.md` and MUST be copied into the implementing plan's `<threat_model>` section.

---

## Wave 0 Requirements

- [ ] `schemas/`, `limits.json`, `diff-policy.json`, and `test/fixtures/contracts/` — canonical contract and shared valid/invalid/boundary/historical/adversarial corpus.
- [ ] `tools/build.mjs` validator/build pipeline — Ajv Draft 2020-12 standalone generation and deterministic build manifest.
- [ ] `tests/components/glt_flow_card/` plus pytest configuration — executable Python parity, Config Entry lifecycle, split-store migration, transaction, options, diagnostics, and WebSocket tests.
- [ ] `playwright.config.mjs` and `test/e2e/` — exact-dist fake-HA browser harness with German/English, responsive, keyboard, failure, rollback, and zero-plant-call assertions.
- [ ] `tools/verify-release.mjs` — double-build drift, copy equality, version/hash/archive layout, release ZIP, and historical-upgrade checks.
- [ ] Independent HACS plugin and integration validation jobs plus hassfest and exact-artifact install matrix.
- [ ] Replace token-only `test/v100-backend.test.mjs` and smoke assertions as authoritative requirement gates.

---

## Manual-Only Verifications

No Phase-1 behavior is allowed to depend solely on manual verification. Visual review may supplement automated screenshots, focus, reflow, and theme assertions, but it cannot replace them.

---

## Validation Sign-Off

- [ ] All planned tasks have an `<automated>` verification or an explicit Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 creates every missing fixture, harness, and release verifier listed above.
- [ ] No watch-mode flags are used in gates.
- [ ] Task-level contract feedback latency is below 30 seconds.
- [ ] JavaScript/Python fixture parity is exact.
- [ ] Browser and install checks exercise the exact packaged artifacts.
- [ ] Minimum/current Home Assistant lanes and both HACS categories are green.
- [ ] `nyquist_compliant: true` and `wave_0_complete: true` are set only after the evidence exists.

**Approval:** pending execution evidence
