---
phase: 01-trusted-contract-release-foundation
plan: 01
subsystem: supply-chain
tags: [npm, pypi, github, provenance, integrity, tdd]

requires: []
provides:
  - Exact provenance allowlist for the five approved Phase-1 dependency candidates
  - Read-only official registry, source ownership, lifecycle-script, and artifact-byte verifier
  - Deterministic recorded-response tests for provenance tampering and cleanup behavior
affects: [01-02-toolchain-harness, 01-13-release-acceptance]

tech-stack:
  added: []
  patterns: [exact-set provenance policy, recorded fetch fixtures, disposable artifact verification]

key-files:
  created:
    - tools/provenance-allowlist.json
    - tools/verify-provenance.mjs
    - test/provenance.test.mjs
  modified: []

key-decisions:
  - "Pin every registry artifact in the exact-set policy, including both PyPI wheel and source distributions."
  - "Treat automatic npm lifecycle hooks as fail-closed policy; only Ajv's reviewed prepublish hook is allowed."
  - "Write canonical online evidence to .planning/tmp/phase01-provenance.json by default for the next plan."

patterns-established:
  - "Registry metadata, GitHub ownership, lifecycle hooks, registry hashes, and downloaded bytes must all agree before a candidate is accepted."
  - "Fixture verification uses recorded responses and the same production verification path without network access."

requirements-completed: [SCHEMA-01, HACS-01]

duration: 15min
completed: 2026-08-31
---

# Phase 1 Plan 1: Dependency Provenance Gate Summary

**Fail-closed provenance policy and read-only verifier for five exact npm/PyPI candidates, including official source ownership and downloaded-byte integrity**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-31T21:41:55Z
- **Completed:** 2026-08-31T21:57:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Committed exactly five immutable candidate identities with canonical registry endpoints, GitHub owners/repositories, exact artifact sets, and reviewed lifecycle-script policy.
- Implemented a built-in Node verifier that performs only official read-only network requests, hashes persisted downloads inside disposable temporary directories, and removes those bytes on every exit path.
- Added offline recorded-response coverage for identity, source, lifecycle, registry-integrity, PyPI artifact-set, and downloaded-byte tampering.
- Verified all five candidates live against npm, PyPI, files.pythonhosted.org, and GitHub without installing packages, changing lockfiles, publishing, authenticating, or reaching Home Assistant/plant systems.

## Task Commits

Each task was committed atomically with TDD RED and GREEN gates:

1. **Task 1 RED: Commit exact registry and source provenance policy tests** - `d6f7de0` (test)
2. **Task 1 GREEN: Commit exact registry and source provenance policy** - `5e40045` (chore)
3. **Task 2 RED: Verify official metadata and downloaded integrity tests** - `ee6b797` (test)
4. **Task 2 GREEN: Verify official metadata and downloaded integrity read-only** - `8a1957c` (feat)

## Files Created/Modified

- `tools/provenance-allowlist.json` - Authored exact-set policy for the five approved npm/PyPI candidates.
- `tools/verify-provenance.mjs` - Official metadata/source/download verifier and canonical report writer.
- `test/provenance.test.mjs` - Allowlist schema/tamper tests plus deterministic recorded-response verifier tests.

## Decisions Made

- Pinned every PyPI distribution returned for each exact version, not only the wheel, so registry file-set additions or removals fail closed.
- Compared only npm scripts that run automatically as lifecycle hooks; ordinary package-owned development scripts are not treated as install-time behavior.
- Kept the report reproducible by omitting wall-clock data and hashing a recursively canonicalized policy document.
- Restricted report output to `.planning/tmp` and rejected unknown CLI arguments, leaving no package-selection or installation path in the verifier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added a safe default provenance evidence path**
- **Found during:** Task 2 (Verify official metadata and downloaded integrity read-only)
- **Issue:** The initial CLI required `--output`, while Plan 01-02 invokes `--online` without that option and requires the report.
- **Fix:** Defaulted output to `.planning/tmp/phase01-provenance.json` while retaining explicit `--output` support and path containment.
- **Files modified:** `tools/verify-provenance.mjs`
- **Verification:** `node tools/verify-provenance.mjs --online` verified all five records and created the canonical report at the default path.
- **Committed in:** `8a1957c`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The correction preserves the planned read-only scope and makes the next plan's documented command executable.

## Issues Encountered

None.

## Verification

- `npm test` - 23/23 tests passed.
- `npm run check` - production card syntax passed.
- `node --test test/provenance.test.mjs` - 8/8 provenance tests passed.
- `node tools/verify-provenance.mjs --online --output=.planning/tmp/phase01-provenance.json` - all five official records and seven artifacts verified.

## TDD Gate Compliance

- RED commits exist for both tasks: `d6f7de0`, `ee6b797`.
- GREEN commits follow their corresponding RED commits: `5e40045`, `8a1957c`.

## User Setup Required

None - no dependency was installed and no credentials or external service configuration are required.

## Next Phase Readiness

- Plan 01-02 can rerun the verifier to create `.planning/tmp/phase01-provenance.json` before exact dependency installation.
- No blockers remain for the verified Node/Python/browser harness setup.

## Self-Check: PASSED

- Created files exist: `tools/provenance-allowlist.json`, `tools/verify-provenance.mjs`, `test/provenance.test.mjs`.
- Task commits exist in git history: `d6f7de0`, `5e40045`, `ee6b797`, `8a1957c`.
- No unexpected tracked deletions or untracked generated files remain.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-08-31*
