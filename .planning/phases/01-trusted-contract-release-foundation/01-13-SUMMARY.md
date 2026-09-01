---
phase: 01-trusted-contract-release-foundation
plan: 13
subsystem: release-evidence
tags: [supply-chain, release, provenance, home-assistant, hacs, playwright, pytest]

requires:
  - phase: 01-09
    provides: Deterministic source-bound build manifest and generated artifact equality
  - phase: 01-10
    provides: Independently validated local HACS plugin and integration category stages
  - phase: 01-11
    provides: Exact-dist project safety browser behavior and opaque-asset effect proof
  - phase: 01-12
    provides: Immutable minimum/current Home Assistant artifact lanes
provides:
  - Exact no-rebuild source-to-release acceptance for card and Companion bytes
  - Least-privilege same-repository release publication with checksums and attestation
  - Fail-closed Phase-1 evidence manifest covering 30 tasks, five roadmap criteria and T-01 through T-08
  - Evidence-backed English/German installation, project-safety and Companion boundaries
affects: [phase-02-authoritative-policy, phase-10-release-evidence, SCHEMA-01, DIFF-01, HACS-01]

tech-stack:
  added: []
  patterns: [evidence-producing prerequisite gates, no-rebuild publication handoff, command-output hashing, exact owner-command deduplication]

key-files:
  created:
    - tools/verify-release-acceptance.mjs
    - tools/verify-phase1.mjs
    - test/phase1-gate.test.mjs
  modified:
    - .github/workflows/release.yml
    - tools/verify-release.mjs
    - tools/run-exact-dist-playwright.mjs
    - README.md
    - README.de.md
    - docs/wiki/Installation.md
    - docs/wiki/YAML-Projects.md
    - docs/wiki/Companion-Backend.md
    - .planning/phases/01-trusted-contract-release-foundation/01-THREATS.md
    - .planning/phases/01-trusted-contract-release-foundation/01-VALIDATION.md

key-decisions:
  - "Make double-build and exact-dist tools emit hash-bound evidence so release acceptance can consume proof without rebuilding."
  - "Separate read-only release verification from a same-repository publication job with only contents, identity-token and attestation write permissions."
  - "Run twenty unique current commands, including each canonical T-01..T-08 owner command exactly once, and map all thirty task rows to that behavioral evidence."
  - "Describe the Companion integration-category shape as local release validation evidence, not public HACS Companion availability or capacity certification."

patterns-established:
  - "Evidence chain: provenance policy/report -> build manifest/double build -> HACS stage -> exact-dist browser -> immutable HA lanes -> release assets."
  - "Phase gates reject missing, skipped, zero-test, stale, failed or unmapped evidence before writing a verified report."

requirements-completed: [SCHEMA-01, DIFF-01, HACS-01]

duration: 34min
completed: 2026-09-01
---

# Phase 1 Plan 13: Release Acceptance and Evidence Closure Summary

**Exact card and Companion release bytes are joined to reviewed source, browser and immutable Home Assistant evidence, then handed to a least-privilege no-rebuild publisher with complete Phase-1 requirement and threat mappings.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-01T14:40:00Z
- **Completed:** 2026-09-01T15:14:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Added T-08 acceptance that verifies provenance, lockfile/source fingerprints, double-build evidence, generated copies, local HACS stages, exact-dist browser results, immutable HA lanes, version/tag agreement, and final release asset hashes without rebuilding.
- Replaced the release workflow's rebuild-and-zip publication with a read-only verification job and a downloaded-asset publication job using full-SHA actions, checksums, provenance, attestation, and narrowly scoped write permissions.
- Added a fail-closed Phase-1 orchestrator that executes 20 unique behavioral commands, including T-01 through T-08 exactly once, and hashes outputs while mapping all 30 tasks, three requirements and five roadmap criteria.
- Closed every canonical threat and validation row and added English/German guidance that distinguishes standalone operation, Companion authority, local integration-category staging, physical-write exclusion, and unmeasured capacity.

## Task Commits

Each task followed RED/GREEN TDD commits:

1. **Task 1 RED: release-chain failures and workflow policy** - `50648d9` (test)
2. **Task 1 GREEN: exact release acceptance and no-rebuild publication** - `7e46228` (feat)
3. **Task 2 RED: Phase-1 mapping, stale evidence and documentation boundaries** - `1755894` (test)
4. **Task 2 GREEN: complete evidence gate and bilingual guidance** - `21ba51a` (feat)

## Files Created/Modified

- `tools/verify-release-acceptance.mjs` - Joins existing evidence and stages exact card, Companion ZIP, checksums and release provenance.
- `tools/verify-phase1.mjs` - Executes, hashes and maps all focused Phase-1 and canonical owner evidence.
- `test/phase1-gate.test.mjs` - Proves chain-break rejection, owner uniqueness, fail-closed evidence and documentation boundaries.
- `.github/workflows/release.yml` - Verifies once, downloads exact assets, attests and publishes only to the current repository.
- `tools/verify-release.mjs` - Emits canonical double-build and checked-in-output evidence.
- `tools/run-exact-dist-playwright.mjs` - Emits the tested card identity and non-skipped browser result.
- `README.md`, `README.de.md`, `docs/wiki/*.md` - Document the tested project/release boundary in English and German.
- `01-THREATS.md`, `01-VALIDATION.md` - Record verified owner commands, task evidence and completed sign-off.

## Evidence Results

- `node --test test/phase1-gate.test.mjs`: 6/6 passed.
- `npm run test:phase1`: 20/20 unique commands passed with no required skip or zero-test result.
- Canonical threat owners: T-01, T-02, T-03, T-04, T-05, T-06, T-07 and T-08 each executed exactly once.
- Exact browser suite: 18/18 Playwright tests passed with only loopback page/card requests and no service or storage effect.
- Immutable HA lanes: 64/64 canonical tests passed on each of Home Assistant 2024.8.0 and 2026.8.3 for linux/amd64.
- Dashboard card SHA-256: `f7d0729f537cdae6cbd12cd40ae49b811770b28ec7ecf794e6c19e6ab2d376fb`.
- Companion ZIP SHA-256: `74b92468ce24912402194f73b424129c94ee454a4adf3c8b5edcbc253fc83ad9`.
- Build manifest SHA-256: `db728e8ff2b0fb2e88a4f4532a95c3d713fdd088d48e3e8f1b1e985ace891e3e`.

## Decisions Made

- Evidence producers write canonical reports into ignored runtime evidence storage; committed scripts and tests define the fail-closed contract while CI regenerates evidence for each authorized tag.
- Release publication uses `gh release create` rather than an unpinned third-party release action, and it cannot run until downloaded asset checksums and tag provenance match.
- Historical controlled-RED work remains evidenced by its commits and prior summaries; the final gate runs current GREEN behavioral suites and maps all historical task rows without recursively invoking itself.
- Phase 1 certifies correctness and packaging at bounded fixture sizes, not 100/500/2,000-object performance capacity or complete Phase-2 shared authorization.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added immutable evidence outputs to prerequisite verifiers**
- **Found during:** Task 1 (Prove reviewed source equals tested and releasable artifacts)
- **Issue:** Existing double-build and exact-dist commands printed results but did not leave hashable evidence for a later no-rebuild acceptance step.
- **Fix:** Added canonical release-build and exact-dist evidence reports with pass/skip and artifact identities.
- **Files modified:** `tools/verify-release.mjs`, `tools/run-exact-dist-playwright.mjs`
- **Verification:** Seeded missing-double-build and skipped-browser evidence both fail; the complete chain passes.
- **Committed in:** `7e46228`

**2. [Rule 2 - Missing Critical] Closed canonical threat and validation ledgers from executed evidence**
- **Found during:** Task 2 (Emit complete Phase-1 evidence and truthful bilingual documentation)
- **Issue:** The canonical ledgers still described successfully executed owner commands and task evidence as pending, which would make sign-off internally inconsistent.
- **Fix:** Marked all 30 task rows and T-01..T-08 verified, completed the sign-off checklist, and bound those files into the evidence manifest.
- **Files modified:** `.planning/phases/01-trusted-contract-release-foundation/01-THREATS.md`, `.planning/phases/01-trusted-contract-release-foundation/01-VALIDATION.md`
- **Verification:** No pending/unchecked Phase-1 validation entries remain; the post-update full gate passed.
- **Committed in:** `21ba51a`

---

**Total deviations:** 2 auto-fixed (2 missing critical functionality)
**Impact on plan:** Both additions were required to make no-rebuild acceptance and final sign-off auditable; no feature scope, external publication or live system access was added.

## Issues Encountered

None. Every bounded evidence command passed on its first final-gate execution; no authentication gate, package substitution, live Home Assistant access, remote-site operation, physical bus or plant write occurred.

## Known Stubs

None. The only empty-string default found by the stub scan is the intentional recursive-directory default in `tools/verify-release.mjs`; it does not flow to UI rendering or evidence claims.

## Threat Flags

None beyond the planned T-08 release/publication surface. The release workflow remains current-repository-only, tag-authorized, checksum-verified, attested and least-privilege.

## User Setup Required

None - no external service configuration required.

## TDD Gate Compliance

- Task 1: RED `50648d9` precedes GREEN `7e46228`.
- Task 2: RED `1755894` precedes GREEN `21ba51a`.

## Next Phase Readiness

- Phase 1 is complete with SCHEMA-01, DIFF-01 and HACS-01 evidence closed.
- Phase 2 can build authoritative shared policy and controls on the validated project, transaction, Companion lifecycle and exact-release foundations.
- Phase 10 still owns representative hardware capacity measurement; these Phase-1 correctness fixtures must not be promoted into performance claims.

## Self-Check: PASSED

- All three created implementation/test files and this summary exist.
- RED/GREEN commits `50648d9`, `7e46228`, `1755894` and `21ba51a` resolve in Git.
- The final Phase-1 evidence report is verified and all 13 Phase-1 plans now have summaries.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
