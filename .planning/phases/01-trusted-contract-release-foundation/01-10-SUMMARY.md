---
phase: 01-trusted-contract-release-foundation
plan: 10
subsystem: local-hacs-release-staging
tags: [hacs, home-assistant, deterministic-zip, sha256, release-packaging, supply-chain]

requires:
  - phase: 01-09
    provides: Canonical manifest-hashed card, Companion runtime, schemas, and deterministic release build
provides:
  - Independent local HACS plugin and integration-category repository stages
  - Deterministic component-relative Companion release ZIP with explicit HACS install relationship
  - Independent category, manifest, hash, layout, archive, and no-publication validation
affects: [01-11-exact-dist-ui, 01-12-ha-artifacts, 01-13-release-acceptance, HACS-01, T-08]

tech-stack:
  added: []
  patterns: [manifest-gated staging, explicit category roots, component-relative zip release, independent mutation validation]

key-files:
  created:
    - packaging/hacs-plugin/hacs.json
    - packaging/hacs-integration/hacs.json
    - packaging/hacs-integration/README.md
    - tools/stage-hacs-packages.mjs
    - tools/validate-hacs-staging.mjs
    - test/hacs-staging.test.mjs
  modified:
    - package.json
    - custom_components/glt_flow_card/build-manifest.json
    - test/contract-fixtures.test.mjs
    - .gitignore

key-decisions:
  - "Keep the integration repository stage rooted at custom_components/glt_flow_card, but make the zip_release members component-relative because HACS extracts the asset directly into /config/custom_components/glt_flow_card."
  - "Treat the Companion category as local release evidence only; require no repository target, credential, user_setup, upload, mirror, or discoverability claim."
  - "Validate stages independently by re-enumerating and hashing source, build, stage, and ZIP bytes rather than importing the stager or trusting its manifest."
  - "Use stored ZIP members with fixed 1980 timestamps, lexical order, fixed Unix 0644 modes, no data descriptors, no extended timestamps, and no native compression stream."

patterns-established:
  - "HACS category separation: plugin root card and metadata are validated independently from the integration custom_components tree and release ZIP."
  - "Release ZIP install contract: repository layout and extraction layout are both explicit, distinct, and mutation-tested."
  - "Local distribution evidence: category validity is proven without manufacturing or publishing a Companion endpoint."

requirements-completed: [HACS-01]

duration: 18min
completed: 2026-09-01
---

# Phase 01 Plan 10: Local HACS Category Staging Summary

**Manifest-bound dashboard and Companion packages with deterministic ZIP installation semantics and independent local HACS category validation**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-01T01:49:01Z
- **Completed:** 2026-09-01T02:06:06Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added repository-shaped local stages for the HACS plugin and integration categories, with the dashboard card copied byte-for-byte from `dist/glt-flow-card.js` and the Companion copied from an explicit 20-file allowlist.
- Added a deterministic `glt-flow-card-companion.zip` whose component-relative members install directly into `/config/custom_components/glt_flow_card`, while the repository stage retains the required single `custom_components/glt_flow_card/` root.
- Bound both stages to the canonical build manifest, package/Companion/runtime versions, generated artifact hashes, source hashes, and a canonical staging manifest containing every file and ZIP-member digest.
- Added independent validation for exact category metadata, single-integration layout, Home Assistant manifest/config-flow/translation structure, generated copy equality, ZIP paths/signatures/order/modes/timestamps/compression, and explicit install targets.
- Added eight executable negative mutations covering category confusion, extra integration roots, version drift, plugin hash drift, unsafe ZIP roots, extra ZIP members, stale runtime copies, and stale schema copies.
- Kept Phase 1 strictly local: no repository creation, public Companion endpoint, credential, upload command, mirror hook, or publication success criterion was added.

## Task Commits

Both tasks followed RED/GREEN TDD with supporting correctness commits:

1. **Task 1 RED: Specify exact local package staging** - `0b8ffc8` (test)
2. **Task 1 GREEN: Stage plugin and integration-category packages** - `d3de15c` (feat)
3. **Task 1 hygiene: Ignore disposable release stages** - `714e512` (chore)
4. **Task 2 RED: Specify independent category and mutation validation** - `267060c` (test)
5. **Task 2 GREEN: Validate category stages and release ZIP independently** - `5e603dc` (feat)
6. **Task 2 provenance: Bind staging to committed build inputs** - `6c1478b` (chore)
7. **Task 2 regression: Exclude declared staged schema copies** - `aea3c38` (fix)

## Files Created/Modified

- `packaging/hacs-plugin/hacs.json` - Authored dashboard/plugin category metadata.
- `packaging/hacs-integration/hacs.json` - Authored integration-category `zip_release` metadata for the local Companion artifact.
- `packaging/hacs-integration/README.md` - Documents local-only status and the repository-tree versus ZIP-install relationship.
- `tools/stage-hacs-packages.mjs` - Verifies canonical build sources/artifacts, stages both categories, creates deterministic ZIP bytes, and records a canonical staging manifest.
- `tools/validate-hacs-staging.mjs` - Independently validates plugin, integration, Home Assistant, archive, hash, version, and no-publication contracts.
- `test/hacs-staging.test.mjs` - Positive category/staging/install tests and eight negative mutation classes.
- `package.json` - Adds `stage:hacs` and `validate:hacs-staging` entry points.
- `custom_components/glt_flow_card/build-manifest.json` - Refreshes the canonical package source hash and committed clean build identity.
- `test/contract-fixtures.test.mjs` - Excludes only the declared disposable HACS schema copies from authored-schema uniqueness checks.
- `.gitignore` - Keeps disposable `build/` release evidence out of source history.

## Decisions Made

- The integration stage is a repository-shaped validation tree with exactly one `custom_components/glt_flow_card/` directory. The release ZIP intentionally omits that prefix because HACS `zip_release` extraction targets the component directory itself.
- The Companion ZIP uses stored entries instead of platform-provided compression. Fixed order, timestamps, attributes, and writer options make bytes stable across repeated runs without adding another archive dependency.
- The validator shares no implementation imports with the stager. It maintains its own allowlist and recomputes all identities so a compromised or mistaken staging manifest cannot make invalid bytes pass.
- Official HACS action validation remains a later endpoint-backed lane: its repository input cannot validate an unpublished arbitrary local tree. This plan proves the same category/layout invariants locally and makes no public-discoverability claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Ignored disposable HACS release stages**
- **Found during:** Task 1 post-commit staging
- **Issue:** `npm run stage:hacs` produced the intended `build/release/` evidence as untracked source candidates, risking accidental release-artifact commits and a permanently dirty tree.
- **Fix:** Added the disposable `build/` root to `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** Repeated default staging leaves `git status --short` clean.
- **Committed in:** `714e512`

**2. [Rule 1 - Regression] Excluded the declared staged schema copies from authored-schema uniqueness**
- **Found during:** Overall `npm test`
- **Issue:** The pre-existing authored-schema test counted the new disposable integration-stage schema copies as a second authored contract tree.
- **Fix:** Excluded only `build/release/hacs-integration/custom_components/glt_flow_card/schemas/`, preserving rejection of every undeclared schema location.
- **Files modified:** `test/contract-fixtures.test.mjs`
- **Verification:** Focused authored-schema test and full 74-test Node suite pass.
- **Committed in:** `aea3c38`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 regression, 1 Rule 2 missing critical control)
**Impact on plan:** Both fixes preserve source/generated boundaries and test intent. No package scope, endpoint, publication, authentication, live Home Assistant access, remote call, physical-bus access, or plant write was added.

## Issues Encountered

- Filesystem enumeration order differed from the authored allowlist order. Repository stages now compare exact sets order-independently, while ZIP member order remains a strict deterministic contract.
- Python `compileall` correctly created `__pycache__` in the disposable integration stage; the validator rejected it as an extra member. Re-staging from the allowlist removed the cache, after which validation passed again.

## TDD Gate Compliance

- Task 1: RED `0b8ffc8` precedes GREEN `d3de15c`.
- Task 2: RED `267060c` precedes GREEN `5e603dc`.
- Both RED phases failed for missing planned tools, and both GREEN phases pass their positive and negative behavior suites.

## Known Stubs

None.

## Authentication Gates

None. All staging and validation is local and credential-free.

## Verification

- `npm run stage:hacs && node --test test/hacs-staging.test.mjs --test-name-pattern="stage|zip|no publication"` - passed exact stage, deterministic ZIP, independent category, no-publication, and mutation behavior (5/5 due matching validator/mutation names).
- `npm run validate:hacs-staging` - passed plugin category, integration category, Companion ZIP install layout, hash/version/source checks, and no-publication checks.
- `node tools/validate-hacs-staging.mjs --category plugin` - passed the plugin category independently.
- `node tools/validate-hacs-staging.mjs --category integration` - passed the integration category and ZIP independently.
- `npm run verify:release` - passed double-build equality, checked-in generated outputs, and all four release drift mutations.
- `npm test` - full Node suite passed 74/74.
- `py -3.13 -m compileall -q build/release/hacs-integration/custom_components/glt_flow_card` - staged Companion Python sources compiled; a clean re-stage then proved caches are excluded.

## User Setup Required

None - no external service, public repository, credentials, Home Assistant instance, physical bus, or plant access is required.

## Next Phase Readiness

- Plan 01-11 can exercise the exact staged dashboard bytes in browser/UI safety lanes.
- Plan 01-12 can install the exact component-relative Companion ZIP into isolated Home Assistant lanes.
- Plan 01-13 can consume both category manifests, staging hashes, and ZIP identities for release acceptance without rebuilding or publishing a different artifact.

## Self-Check: PASSED

- All six planned authored files exist and all seven Plan 01-10 task/support commits resolve in git history.
- The canonical build manifest records committed source commit `5e603dcf086f6efdb5e331e5b72629e57c44aa5d` with `dirty: false`.
- Stub scan found no placeholder/TODO/FIXME behavior in changed files.
- Threat-surface scan found no unplanned network endpoint, authentication path, schema trust boundary, or publication path; the release/file-access surface is the planned T-08 supporting control.
- Working tree was clean before summary creation.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
