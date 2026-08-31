---
phase: 01-trusted-contract-release-foundation
plan: 05
subsystem: project-migration-diff
tags: [copy-on-write, semantic-diff, canonical-digests, dependency-closure, javascript-python-parity]

requires:
  - phase: 01-04
    provides: Raw-first validated project documents, canonical JSON, stable SHA-256 evidence, and cross-runtime contract parity
provides:
  - Pure exact-step 0-to-1-to-2 migrations with target validation, receipts, dry-run equivalence, and loss accounting
  - Policy-driven semantic add/remove/move/binding/config operations with stable impact and hashes
  - Deterministic transitive dependency selection closure with fail-closed missing and cyclic metadata handling
  - Backward-compatible core migration and diff shapes augmented with hardened evidence
affects: [01-06-safe-bundles, 01-07-transactions, 01-11-project-safety, 01-13-release-acceptance]

tech-stack:
  added: []
  patterns: [exact-version migration registry, validate-every-target, policy-only semantic diff, canonical operation evidence, transitive selection closure]

key-files:
  created:
    - src/v100/project-migrations.mjs
    - src/v100/project-diff.mjs
    - custom_components/glt_flow_card/project_migrations.py
    - custom_components/glt_flow_card/project_diff.py
    - test/v100-migrations.test.mjs
    - test/v100-diff.test.mjs
    - tests/components/glt_flow_card/test_project_migrations.py
    - tests/components/glt_flow_card/test_project_diff.py
  modified:
    - src/v100/core.mjs

key-decisions:
  - "Retain the legacy schema-v1 config/from/to/changed migration surface while exposing the validated schema-v2 candidate and canonical receipt as compatible additive fields."
  - "Treat only top-level identity-keyed collection order as irrelevant; compare every other array positionally unless future policy explicitly says otherwise."
  - "Represent semantic operation locations as escaped stable-ID JSON pointers and keep patch application outside the pure diff module."
  - "Add dependency requirements only when a referenced target is itself added or removed, so unchanged installed dependencies do not become unrelated selected changes."

patterns-established:
  - "Migration result: {candidate, receipt} is pure in both dry-run/apply modes and every exact step validates before the next step runs."
  - "Semantic operation: stable ID, category, escaped path, object identity, field pointer, before/after hash and value, impact, and sorted dependency reasons."
  - "Cross-runtime adapters emit the same compact UTF-8 JSON-lines bytes for shared migration and diff requests."

requirements-completed: [SCHEMA-01, DIFF-01]

duration: 15min
completed: 2026-09-01
---

# Phase 01 Plan 05: Deterministic Migration and Semantic Diff Summary

**Pure sequential 0-to-1-to-2 migrations and policy-driven semantic change selection with canonical receipts, transitive dependency closure, and byte-equivalent JavaScript/Python results**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-31T23:27:53Z
- **Completed:** 2026-08-31T23:43:13Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added exact version-keyed migration registries that clone canonical input, validate the raw source and every target, preserve unknown extension/vendor data, reject unsupported future versions, and emit ordered digest/loss receipts.
- Added semantic diff modules driven by the canonical `schemas/diff-policy.json`, with five distinct categories, stable escaped-ID pointers, before/after hashes, deterministic impact, and reorder-noise suppression limited to declared identity collections.
- Added deterministic transitive selection closure that explains added dependencies and fails closed for unknown selections, missing dependency operations, or cycles without exposing any patch/apply path.
- Proved compact JSON-lines byte parity for JavaScript and Python migrations/diffs, plus focused Python behavior suites and the full 53-test Node suite.
- Preserved `ensureV1`, the legacy `migrateProject` return fields, partial-object `projectDiff` behavior, bundle schema-v1 round trips, and the identities/references of all four existing YAML examples while adding hardened evidence for valid projects.

## Task Commits

Each TDD task was committed as a RED specification followed by GREEN implementation:

1. **Task 1 RED: Specify sequential copy-on-write migration parity** - `b7415fd` (test)
2. **Task 1 GREEN: Implement sequential migration parity** - `c4091ea` (feat)
3. **Task 2 RED: Specify semantic diff and dependency parity** - `eaffecd` (test)
4. **Task 2 GREEN: Implement policy-driven semantic diff parity** - `dd96ce4` (feat)
5. **Task 3 RED: Specify hardened public-core compatibility** - `7e88f57` (test)
6. **Task 3 GREEN: Delegate public core paths with compatible shapes** - `33cd5d4` (feat)

## Files Created/Modified

- `src/v100/project-migrations.mjs` - Browser-safe exact-step migration registry, validation gates, canonical digests, and loss-accounted receipts.
- `custom_components/glt_flow_card/project_migrations.py` - Python-equivalent migrations plus UTF-8 JSON-lines parity adapter.
- `src/v100/project-diff.mjs` - Policy-loaded semantic comparison, stable operations/impact, dependency annotation, and closure validation.
- `custom_components/glt_flow_card/project_diff.py` - Repository-policy Python semantic diff and closure implementation with equivalent output ordering.
- `src/v100/core.mjs` - Compatible public migration/diff delegation while retaining legacy normalization and partial-object behavior.
- `test/v100-migrations.test.mjs` - Sequential, purity, idempotence, invalid/future, extension, parity, public-shape, and example regressions.
- `test/v100-diff.test.mjs` - Five-category, ordering, hash, impact, closure, hostile metadata, parity, and public-shape regressions.
- `tests/components/glt_flow_card/test_project_migrations.py` - Focused Python migration behavior and serialization coverage.
- `tests/components/glt_flow_card/test_project_diff.py` - Focused Python semantic operations, reorder, closure, and fail-closed coverage.

## Decisions Made

- Kept the public `SCHEMA_VERSION = 1` normalized config contract for existing browser/bundle consumers; `migrateProject` now adds the schema-v2 `candidate` and `receipt` without removing or changing its legacy fields.
- Used canonical leaf/value hashes rather than positional array patches, so evidence remains stable under object-key and identity-collection reordering and cannot be mistaken for an executable patch.
- Loaded the shared diff policy directly in both runtimes instead of duplicating identity, category, order, dependency, or impact declarations in implementation code.
- Used stable operation IDs as the dependency graph nodes and sorted both dependency reasons and closure output for deterministic preview/recompute behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Normalized decomposed Unicode safely in generated project IDs**
- **Found during:** Task 1 GREEN
- **Issue:** NFKD combining marks were converted to extra separators, yielding `werk-su-d`; the first Windows parity subprocess also decoded UTF-8 stdin through the locale code page.
- **Fix:** Removed combining marks before slug punctuation replacement and explicitly configured Python JSON-lines stdin/stdout as UTF-8.
- **Files modified:** `src/v100/project-migrations.mjs`, `custom_components/glt_flow_card/project_migrations.py`
- **Verification:** Unicode migration fixture and exact JavaScript/Python byte comparison pass.
- **Committed in:** `c4091ea`

**2. [Rule 3 - Blocking] Enabled only loopback socket construction for focused Windows Python tests**
- **Found during:** Task 1 GREEN
- **Issue:** Home Assistant's session fixtures create an asyncio self-pipe before tests run, while pytest-socket blocks socket construction by default on Windows.
- **Fix:** Applied the repository-established `enable_socket` plus `127.0.0.1`/`localhost` markers to both new pure Python suites; no external connection is permitted.
- **Files modified:** `tests/components/glt_flow_card/test_project_migrations.py`, `tests/components/glt_flow_card/test_project_diff.py`
- **Verification:** Both focused Python suites pass with no network, service, persistence, bus, or plant activity.
- **Committed in:** `c4091ea`, `eaffecd`

**3. [Rule 1 - Bug] Kept reorder fixture references contract-valid**
- **Found during:** Task 2 GREEN
- **Issue:** A reorder-only fixture replaced the equipment collection but retained a path that referenced the original equipment ID, so raw contract validation correctly rejected the test before diffing.
- **Fix:** Removed paths from that isolated ordering fixture so it tests only declared collection-order behavior.
- **Files modified:** `test/v100-diff.test.mjs`
- **Verification:** Reorder-only comparison reports zero operations and `/equipment` ordering noise, while a non-policy tag reorder still emits a config operation.
- **Committed in:** `dd96ce4`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking issue)
**Impact on plan:** All fixes were required for deterministic Unicode evidence or isolated test correctness. No schema, endpoint, persistence, publication, live Home Assistant, physical-bus, or plant scope was added.

## Issues Encountered

- The final combined PowerShell command passed a literal `*.py` to `py_compile`; rerunning with explicit `Get-ChildItem` enumeration compiled every Companion Python module successfully.
- Node's direct test runtime and the temporary esbuild ES2022 bundle both accept the authored JSON import for `schemas/diff-policy.json`; no generated distribution artifact was changed.

## Verification

- `npm run test:migrations` - 6/6 sequential, purity, parity, compatibility, and example tests passed.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q` - 4/4 Python migration tests passed.
- `npm run test:diff` - 6/6 category, ordering, impact, closure, hostile metadata, parity, and compatibility tests passed.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_project_diff.py -q` - 3/3 Python diff tests passed.
- `node --test test/v100-core.test.mjs test/v100-migrations.test.mjs test/v100-diff.test.mjs` - 20/20 core and hardened-path tests passed.
- `npm test` - full Node suite passed 53/53.
- `npm run verify:contract:validators` and `npm run check` passed.
- Temporary esbuild IIFE bundle of `src/v100/entry.js` targeting ES2022 built and passed `node --check`; the temporary output was removed.
- Explicit `py -3.13 -m py_compile` over every `custom_components/glt_flow_card/*.py` module passed.

## TDD Gate Compliance

- Task 1 RED `b7415fd` failed on absent migration modules; GREEN `c4091ea` passed exact-step JavaScript/Python parity.
- Task 2 RED `eaffecd` failed on absent diff modules; GREEN `dd96ce4` passed five-category operations and closure parity.
- Task 3 RED `7e88f57` failed on missing hardened public evidence/delegation; GREEN `33cd5d4` passed all compatibility and existing-example regressions.
- No refactor-only commit was necessary.

## Known Stubs

None. Empty operation, warning, loss, dependency, and ordering-noise arrays are intentional evidence for unchanged or lossless results; null before/after hashes represent an absent side of add/remove operations.

## Threat Flags

None. The new modules are pure except for Python's planned repository-local read of `schemas/diff-policy.json`; they add no endpoint, authentication path, persistence, remote access, executable patch, schema write, or active-content surface.

## Authentication Gates

None.

## User Setup Required

None - no external service, live Home Assistant, browser session, remote site, publication, physical bus, or plant access is required.

## Next Phase Readiness

- Plan 01-06 can embed validated schema-v2 candidates and canonical receipts/digests into safe bundle evidence without duplicating migration logic.
- Plan 01-07 can recompute semantic operations and dependency closure server-side from canonical project bytes before applying an authorized transaction.
- T-01 and T-02 now have stable supporting algorithms; their authoritative transaction/rollback ownership remains in Plan 01-07 as declared by the threat ledger.

## Self-Check: PASSED

- All eight created artifacts, the modified core module, and this summary exist on disk.
- All six TDD commits exist in order: `b7415fd`, `c4091ea`, `eaffecd`, `dd96ce4`, `7e88f57`, `33cd5d4`.
- Focused migration/diff parity, Python behavior, core compatibility, full Node, validator freshness, distribution syntax, temporary ES2022 bundling, and Companion Python compilation gates passed after the final production commit.
- The working tree contained only this summary before the summary commit; no generated distribution file, temporary bundle, live system, or unrelated user file remained modified.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
