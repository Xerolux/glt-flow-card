---
phase: 01-trusted-contract-release-foundation
fixed_at: 2026-09-01T17:16:27.6778130Z
review_path: .planning/phases/01-trusted-contract-release-foundation/01-REVIEW.md
iteration: 4
findings_in_scope: 14
fixed: 14
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-01T17:16:27.6778130Z
**Source review:** `.planning/phases/01-trusted-contract-release-foundation/01-REVIEW.md`
**Iteration:** 4
**Scope:** Cumulative result across all four review/fix iterations, including the fresh final review.

**Summary:**

- Findings in scope: 14
- Fixed: 14
- Skipped: 0

## Fixed Issues

### Iteration 1 — CR-01: Python and JavaScript produce different canonical bytes for valid large numbers

**Files modified:** `custom_components/glt_flow_card/project_contract.py`, `tests/components/glt_flow_card/test_project_contract.py`, `tools/generate-contract-fixtures.mjs`, `test/fixtures/contracts/manifest.json`
**Commit:** `8f2f820`
**Applied fix:** Replaced binary-integer rendering with ECMAScript-compatible shortest-decimal expansion and added direct/raw parity coverage at safe-integer, fixed/exponent, and subnormal boundaries.

### Iteration 1 — CR-02: Applying multiple array deletions persists the wrong project

**Files modified:** `custom_components/glt_flow_card/project_transactions.py`, `tests/components/glt_flow_card/test_project_transactions.py`
**Commit:** `d7a46aa`
**Applied fix:** Applies selected array removals in descending index order before replacements/additions and verifies exact candidate equality for shrinking, mixed, nested, and compatibility-save cases. Fixed: requires human verification.

### Iteration 1 — CR-03: Removal dependency closure is reversed and can delete unselected objects

**Files modified:** `custom_components/glt_flow_card/project_diff.py`, `src/v100/project-diff.mjs`, `tests/components/glt_flow_card/test_project_diff.py`, `test/v100-diff.test.mjs`
**Commit:** `de8c1ea`
**Applied fix:** Preserved source-to-target dependencies for additions and inverted removal dependencies so referenced targets require removal or retargeting of their sources. Fixed: requires human verification.

### Iteration 1 — CR-04: Restore verified backup rolls back to the post-apply snapshot

**Files modified:** `custom_components/glt_flow_card/project_transactions.py`, `src/v100/project-safety.js`, `tests/components/glt_flow_card/test_project_transactions.py`, `test/e2e/fixtures/fake-ha.mjs`, `test/e2e/project-safety.spec.mjs`, `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `docs/editor/app.js`, `custom_components/glt_flow_card/build-manifest.json`
**Commit:** `3ca2a49`
**Applied fix:** Returns and persists an explicit verified pre-apply `rollback_snapshot_id`, synthesizes a revision-zero backup for new projects, and makes the UI restore only that snapshot. Fixed: requires human verification.

### Iteration 1 — CR-05: Unbounded dry-run previews allow persistent Home Assistant memory exhaustion

**Files modified:** `custom_components/glt_flow_card/project_transactions.py`, `tests/components/glt_flow_card/test_project_transactions.py`
**Commit:** `70e489a`
**Applied fix:** Added deterministic TTL expiry, one-active-preview replacement per user/project, global entry and byte budgets, oldest-first eviction, and terminal preview invalidation.

### Iteration 1 — WR-01: Escaped lone surrogates crash Python validation instead of failing closed

**Files modified:** `custom_components/glt_flow_card/project_contract.py`, `src/v100/project-contract.mjs`, `tests/components/glt_flow_card/test_project_contract.py`, `test/v100-contract.test.mjs`, `tools/generate-contract-fixtures.mjs`, `test/fixtures/contracts/manifest.json`
**Commit:** `9897ebd`
**Applied fix:** Both runtimes now reject lone high/low surrogates with stable `contract.type` evidence while accepting valid surrogate pairs.

### Iteration 1 — WR-02: The UI keeps offering a consumed preview after apply or rollback

**Files modified:** `src/v100/project-safety.js`, `test/e2e/project-safety.spec.mjs`, `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `custom_components/glt_flow_card/build-manifest.json`
**Commit:** `7dbff20`
**Applied fix:** Limits the apply action to `preview-ready`; consumed previews require a fresh dry run after apply or rollback.

### Iteration 2 — CR-01: Integrated manifests are generated from platform-transformed bytes and make every release lane fail

**Files modified:** `.gitattributes`, `custom_components/glt_flow_card/build-manifest.json`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `dist/glt-flow-card.js`, `test/fixtures/contracts/manifest.json`, `tools/build.mjs`, `test/release-build.test.mjs`, `tools/stage-hacs-packages.mjs`, `test/hacs-staging.test.mjs`
**Commits:** `798961b`, `bb637af`, `e90b00e`, `25677be`
**Generated integration commits:** `ecdb0bc`, `1e1a1b9`, `51c755e`
**Applied fix:** Enforced LF for repository text files, regenerated canonical fingerprints/artifacts, removed checkout-specific `node_modules` paths from bundled bytes, and kept HACS staging on the destination filesystem so clean Windows and Linux release lanes are byte-stable.

### Iteration 2 — WR-01: Retarget-and-remove closure omits the newly referenced target

**Files modified:** `custom_components/glt_flow_card/project_diff.py`, `src/v100/project-diff.mjs`, `tests/components/glt_flow_card/test_project_diff.py`, `test/v100-diff.test.mjs`, `tests/components/glt_flow_card/test_project_transactions.py`
**Commit:** `6b5a27f`
**Generated integration commit:** `ecdb0bc` (superseded by final checkout-independent bytes in `51c755e`)
**Applied fix:** Every changed reference field now depends on an `add` operation for its post-change target; JS, Python, and coordinator tests prove remove-and-retarget selections materialize a valid candidate. Fixed: requires human verification.

### Iteration 2 — WR-02: Project Safety success text identifies the post-apply snapshot as the backup

**Files modified:** `src/v100/project-safety.js`, `test/e2e/project-safety.spec.mjs`, `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `custom_components/glt_flow_card/build-manifest.json`
**Commit:** `00a56e1`
**Generated integration commit:** `ecdb0bc` (superseded by final checkout-independent bytes in `51c755e`)
**Applied fix:** Apply and rollback success evidence now displays `rollback_snapshot_id`; exact-distribution assertions prove the displayed ID equals the rollback request and differs from the applied head snapshot.

### Iteration 3 — CR-01: Growing an array past single-digit indices silently drops candidate values

**Files modified:** `custom_components/glt_flow_card/project_transactions.py`, `tests/components/glt_flow_card/test_project_transactions.py`
**Commit:** `c0c8ee3`
**Applied fix:** Groups numeric array removals and mutations by structural parent, applies removals in descending numeric order and additions/replacements in ascending numeric order, and verifies exact persistence for 12-element and nested-array growth plus a selective double-digit update. Fixed: requires human verification.

### Iteration 3 — CR-02: The default test and CI gate depends on ignored local release evidence

**Files modified:** `test/phase1-gate.test.mjs`, `tools/test-clean-checkout.mjs`, `.github/workflows/validate.yml`, `.github/workflows/build-v1.yml`
**Commit:** `76af1b2`
**Applied fix:** Builds a fresh HACS stage inside the acceptance test's temporary fixture, derives bounded synthetic test evidence only from committed authorities, orders both mandatory workflows to build and stage before the default suite, and adds a tracked-only `git archive HEAD` build/stage/test gate.

### Iteration 3 — WR-01: Equal-time preview eviction can discard the authority being returned

**Files modified:** `custom_components/glt_flow_card/project_transactions.py`, `tests/components/glt_flow_card/test_project_transactions.py`
**Commit:** `a776b3b`
**Applied fix:** Replaces random-token tie-breaking with an explicit monotonic insertion sequence, fails closed if a new preview cannot be retained, and proves newest-token retention under equal-clock entry and byte-budget pressure with adversarial IDs.

### Iteration 4 — CR-01: Audit persistence failure reports a failed apply after committing the project

**Files modified:** `custom_components/glt_flow_card/project_repository.py`, `custom_components/glt_flow_card/project_transactions.py`, `tests/components/glt_flow_card/test_project_repository.py`, `tests/components/glt_flow_card/test_project_transactions.py`
**Commit:** `83d8b32`
**Applied fix:** Introduces a recoverable `AUDIT_PENDING` transaction state whose journal contains the canonical audit event, allocates collision-checked transaction identities, derives each audit identity deterministically from its transaction, and makes audit insertion immutable and idempotent. An audit-store outage after the verified head now returns an unambiguous successful result marked `audit_pending`; startup repair completes the durable audit projection before availability and only then finalizes the journal. Failure injection immediately before the audit write and after the durable write proves the final head digest, restart recovery, safe retry after an aborted transaction, idempotent replay, and exactly one durable audit event per transaction. Fixed: requires human verification.

## Skipped Issues

None.

## Verification

- Full Node suite: 93/93 passed on the integrated Windows checkout.
- Full Python Companion suite: 90/90 passed locally.
- Exact-distribution Chromium suite: 18/18 passed with no Home Assistant service or plant command.
- Immutable Home Assistant lanes: 91 tests passed on HA 2024.8.0 and 91 tests passed on HA 2026.8.3; no service attempts were recorded.
- HACS plugin and integration-category staging passed, including deterministic ZIP and mutation rejection.
- Release build, double-build equality, checked-in output equality, mutation gates, and release acceptance passed.
- Online provenance verification passed for all 5 approved package records.
- The new tracked-only `git archive HEAD` gate built, staged HACS packages, and passed the full default Node suite without `build/` or `.planning/tmp/` from the developer workspace.
- Fresh Windows checkout: 0 tracked CRLF files; 20/20 contract/build/HACS tests and release verification passed.
- Fresh Linux Node 22 clone: 20/20 contract/build/HACS tests, HACS validation, and release verification passed.

---

_Fixed: 2026-09-01T17:16:27.6778130Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 4_
