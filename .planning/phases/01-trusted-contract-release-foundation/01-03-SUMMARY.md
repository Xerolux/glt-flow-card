---
phase: 01-trusted-contract-release-foundation
plan: 03
subsystem: project-contract
tags: [json-schema-2020-12, ajv, deterministic-fixtures, semantic-diff, resource-limits]

requires:
  - phase: 01-02
    provides: Exact Ajv dependency and focused fixture test command
provides:
  - Singular versioned raw project and bundle contracts with bounded resource policy
  - Machine-readable semantic diff identities, categories, order, dependency, and impact rules
  - Reproducible shared manifest for golden, malformed, hostile, boundary, and scale-correctness fixtures
affects: [01-04-contract-adapters, 01-05-migrations-diff, 01-06-safe-bundles, 01-13-release-acceptance]

tech-stack:
  added: []
  patterns: [raw-before-normalize schemas, repository-local ref closure, temporary generated corpus, correctness-only scale classes]

key-files:
  created:
    - schemas/project/0.schema.json
    - schemas/project/1.schema.json
    - schemas/project/2.schema.json
    - schemas/bundle-manifest.schema.json
    - schemas/limits.json
    - schemas/diff-policy.json
    - tools/generate-contract-fixtures.mjs
    - test/fixtures/contracts/manifest.json
    - test/contract-fixtures.test.mjs
  modified: []

key-decisions:
  - "Use stable reserved .invalid schema IDs and resolve every non-fragment ref from the repository-owned canonical registry without network access."
  - "Represent legacy documents as absent version 0, preserve explicit version 1, and make version 2 require raw project identity/revision metadata before normalization."
  - "Commit only the compact fixture manifest; regenerate all bodies in disposable temporary directories from canonical schemas, limits, policy, fixed seeds, and documented example provenance."
  - "Treat the 100, 500, and 2,000 object fixtures solely as contract/diff correctness inputs; Phase 10 owns measured capacity and performance evidence."

patterns-established:
  - "Canonical contracts: authored schemas and policies live only under schemas/; packaged copies must be generated from these bytes."
  - "Corpus evidence: every fixture has a stable class, expected outcome/code/pointer, SHA-256 digest, correctness-only scope, and deterministic generator seed or source."

requirements-completed: [SCHEMA-01, DIFF-01]

duration: 10min
completed: 2026-09-01
---

# Phase 1 Plan 3: Canonical Contract and Fixture Corpus Summary

**Versioned Draft 2020-12 raw project contracts, exact JSON/archive budgets, semantic diff policy, and a deterministic 64-case cross-runtime fixture manifest**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-31T22:48:04Z
- **Completed:** 2026-08-31T22:57:53Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Authored the singular project schema lineage for absent-v0, explicit-v1, and required-project-metadata v2 raw documents, plus the bounded `.gltproject` manifest schema.
- Encoded exact 5 MiB JSON, tree/string/ID/path/error, and 32/128 MiB archive budgets alongside executable semantic diff identity, order, dependency, category, and impact policy.
- Generated a deterministic 64-case corpus covering all 32 declared stable outcome codes and below/at/above classes for every JSON and archive limit.
- Preserved the documented iDM YAML as provenance-backed legacy golden input while keeping normalization defaults outside the raw contract.
- Added fixed-seed 100/500/2,000-object correctness fixtures with expected SHA-256 digests and explicit non-capacity/non-performance evidence labels.

## Task Commits

Each TDD task was committed as a RED specification followed by GREEN implementation:

1. **Task 1 RED: Specify canonical raw contracts and policy** - `7dca5cf` (test)
2. **Task 1 GREEN: Author canonical project contracts** - `1a4cd5d` (feat)
3. **Task 2 RED: Specify deterministic fixture evidence** - `6498738` (test)
4. **Task 2 GREEN: Generate bounded contract corpus** - `fd6a427` (feat)

## Files Created/Modified

- `schemas/project/0.schema.json`, `1.schema.json`, `2.schema.json` - Repository-local Draft 2020-12 lineage for raw legacy, historical, and current project documents.
- `schemas/bundle-manifest.schema.json` - Bounded project/asset manifest with local refs and a 254-asset cap that reserves the manifest and project entries.
- `schemas/limits.json` - Exact shared preflight and archive resource budgets.
- `schemas/diff-policy.json` - Stable diff categories, identity collections, meaningful-order rules, reference edges, and impact vocabulary.
- `tools/generate-contract-fixtures.mjs` - Deterministic temporary corpus producer with canonical policy/source hashing.
- `test/fixtures/contracts/manifest.json` - Compact expected outcomes, pointers, seeds, policy hashes, provenance, and body digests.
- `test/contract-fixtures.test.mjs` - Structural contract, policy, singularity, determinism, boundary, digest, and evidence-scope tests.

## Decisions Made

- Used stable `https://schemas.glt-flow-card.invalid/` IDs so the schemas have absolute identities but can never be mistaken for authorized remote fetch targets.
- Shared v2 `$defs` with v0/v1 through closed repository-owned refs, keeping one canonical definition graph while retaining explicit version entry points.
- Required `type` on all raw projects and required `project.id`, `project.name`, and `project.revision` only at v2; migrations can supply them, but raw v2 validation cannot silently default them.
- Modeled duplicate IDs and dangling references as stable semantic fixture outcomes rather than pretending JSON Schema can resolve cross-document identity relationships.
- Reserved two of the 256 archive entries for `manifest.json` and `project.json`, limiting declared assets to 254.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made the canonical path scan portable on Windows**
- **Found during:** Task 1 GREEN
- **Issue:** The RED test passed a file URL object to `node:path.join`, so the singularity check failed before inspecting authored schema paths on Windows.
- **Fix:** Converted the repository URL once with `fileURLToPath` and used that native path for recursive traversal and relative-path comparison.
- **Files modified:** `test/contract-fixtures.test.mjs`
- **Verification:** The canonical-path test passes and reports exactly the four authored `*.schema.json` files.
- **Committed in:** `1a4cd5d`

**2. [Rule 1 - Bug] Reserved both fixed bundle entries in the asset cap**
- **Found during:** Task 2 GREEN
- **Issue:** An initial 255-asset manifest cap plus `manifest.json` and `project.json` could describe 257 entries, exceeding the canonical 256-entry archive budget.
- **Fix:** Reduced `assets.maxItems` to 254 and bound it in the limits test to `max_entries - 2`.
- **Files modified:** `schemas/bundle-manifest.schema.json`, `test/contract-fixtures.test.mjs`, `test/fixtures/contracts/manifest.json`
- **Verification:** `npm run test:fixtures` passes the schema/limit assertion and regenerated policy digest.
- **Committed in:** `fd6a427`

---

**Total deviations:** 2 auto-fixed bugs
**Impact on plan:** Both fixes preserve the planned contract and evidence scope; neither adds runtime behavior, external effects, or a second source of truth.

## Issues Encountered

- The plan's prose says "seven canonical contract files," while every authoritative path list and truth enumerates six (`project/{0,1,2}`, bundle manifest, limits, and diff policy). Execution followed that exact six-file canonical set and proves its singularity; the remaining three plan files are the generator, compact manifest, and test.
- Context7 CLI was not installed, so no package was downloaded. The phase's official Draft 2020-12/Ajv research and the locked local Ajv 8.20.0 compiler were used directly.

## Verification

- `node --test test/contract-fixtures.test.mjs --test-name-pattern="schema|limits|policy|canonical paths"` - 5/5 structural contract tests passed.
- `npm run test:fixtures` - 9/9 schema, policy, deterministic corpus, boundary, digest, and evidence-scope tests passed.
- `npm run check` - checked production bundle syntax passed.
- `npm test` - full Node suite passed 32/32.
- Two generator runs in separate system temporary directories produced byte-identical file snapshots.
- `git ls-files test/fixtures/contracts` reports only `manifest.json`; all generated bodies remain disposable.
- Repository schema scan reports only `schemas/project/{0,1,2}.schema.json` and `schemas/bundle-manifest.schema.json`.

## TDD Gate Compliance

- Task 1 RED `7dca5cf` failed only because canonical contract files were absent; GREEN `1a4cd5d` made all five scoped tests pass.
- Task 2 RED `6498738` left the existing contract tests green and failed only on the absent generator/manifest; GREEN `fd6a427` made all nine fixture tests pass.
- No refactor-only commit was needed.

## Known Stubs

None. Empty collections, empty defaults, and the temporary `null` depth seed in the generator are intentional deterministic fixture data or accumulators, not unwired production behavior.

## Authentication Gates

None.

## User Setup Required

None - no external service, live Home Assistant, browser session, physical bus, remote site, or plant access is required.

## Next Phase Readiness

- Plan 01-04 can compile JavaScript/Python adapters against the same canonical schemas, limits, stable codes, pointers, and generated bodies without remote refs.
- Plans 01-05 and 01-06 can consume the explicit diff/reference policy and hostile archive metadata seeds.
- Phase 10 remains the sole owner of measured 100/500/2,000 capacity and performance claims.

## Self-Check: PASSED

- All nine created contract, policy, generator, manifest, and test files exist.
- All four TDD task commits exist in git history: `7dca5cf`, `1a4cd5d`, `6498738`, `fd6a427`.
- Scoped and full Node verification passed after the final production commit.
- No generated fixture body, duplicate authored schema, tracked deletion, untracked runtime output, endpoint, auth path, storage schema, live call, publication, physical-bus write, or plant write was introduced.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
