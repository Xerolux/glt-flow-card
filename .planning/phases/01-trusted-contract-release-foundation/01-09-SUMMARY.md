---
phase: 01-trusted-contract-release-foundation
plan: 09
subsystem: deterministic-release-build
tags: [esbuild, ajv, sha256, reproducible-builds, release-verification, supply-chain]

requires:
  - phase: 01-06
    provides: Canonical project/bundle schemas, deterministic opaque bundles, and cross-runtime contract fingerprints
  - phase: 01-08
    provides: Companion lifecycle, manifest version authority, diagnostics, and generated www runtime destination
provides:
  - One staged canonical build for card, editor, schemas, Companion copies, and machine-readable provenance
  - Byte-identical dist/Companion card outputs assembled from authored bases and one fresh v1 bundle
  - Independent isolated double-build, checked-in drift, version, schema, validator, and mutation verification
  - CI and compatibility entry points delegated to the sole npm build command
affects: [01-10-hacs-staging, 01-11-exact-dist-ui, 01-12-ha-artifacts, 01-13-release-acceptance, T-08]

tech-stack:
  added: []
  patterns: [validated temporary staging, atomic per-output replacement, canonical sorted manifest, independent double-build verification]

key-files:
  created:
    - tools/build.mjs
    - tools/verify-release.mjs
    - src/generated-bases/glt-flow-card.base.js
    - src/generated-bases/editor-app.base.js
    - custom_components/glt_flow_card/build-manifest.json
  modified:
    - tools/apply-v100.mjs
    - tools/generate-project-validators.mjs
    - package.json
    - .github/workflows/build-v1.yml
    - test/release-build.test.mjs
    - test/contract-fixtures.test.mjs

key-decisions:
  - "Treat the pre-v1 card and pre-extension editor bodies as canonical authored bases so generated dist, Companion, and docs files are never build inputs."
  - "Compile standalone Ajv validators from canonical schemas inside the temporary compiler tree and bundle src/v100/entry.js exactly once."
  - "Exclude the manifest self-hash, timestamps, randomness, and absolute paths while recording canonical source/tool/artifact identities and the latest source-affecting commit plus dirty marker."
  - "Record the declared Node 22 build target rather than a host patch version so otherwise identical CI and local artifacts do not drift."
  - "Keep release verification independent of build implementation and prove the verifier with four seeded artifact-specific failures."

patterns-established:
  - "Build: canonical authored inputs -> temporary compiler/stage -> complete validation -> atomic destination replacement."
  - "Provenance: sorted relative paths with SHA-256 and byte sizes; no self-reference, clock, random value, secret, or absolute path."
  - "Verification: build twice in isolated roots, enumerate exact paths, compare bytes, recompute authorities, compare checked-in outputs, then seed negative drift."

requirements-completed: [SCHEMA-01, HACS-01]

duration: 22min
completed: 2026-09-01
---

# Phase 01 Plan 09: Deterministic Release Build Summary

**One validated source-to-artifact build with canonical SHA-256 provenance and an independent double-build drift gate for the card, Companion, editor, and schemas**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-01T01:24:02Z
- **Completed:** 2026-09-01T01:46:00Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- Added `npm run build` as the sole producer of all 12 declared generated outputs, with complete temporary staging and validation before destination replacement.
- Made the card and editor build from canonical authored bases instead of reading generated `dist`, Companion, or docs outputs.
- Generated standalone Ajv validator bytes from the canonical repository schemas inside the temporary compiler tree and bundled the v1 entry exactly once for ES2022.
- Produced byte-identical `dist/glt-flow-card.js` and Companion `www/glt-flow-card.js`, exact canonical schema copies in both release destinations, and a bounded marked editor extension region.
- Added a canonical build manifest containing relative source/artifact paths, sizes, SHA-256 identities, version authorities, exact Ajv/esbuild versions, the Node 22 build target, schema fingerprints, and source commit/dirty evidence.
- Replaced the mutating legacy `apply-v100.mjs` implementation with a compatibility delegate and routed the v1 GitHub workflow through the canonical npm build.
- Added independent release verification that proves isolated builds have identical paths/bytes/manifests, recomputes every authority without trusting manifest claims, and compares fresh results with committed artifacts.
- Proved one-byte card drift, version disagreement, canonical schema drift, and missing-output drift all fail with artifact-specific evidence.

## Task Commits

Each TDD task was committed as a RED specification followed by GREEN implementation and focused correctness fixes:

1. **Task 1 RED: Specify deterministic release build outputs** - `e7377c8` (test)
2. **Task 1 GREEN: Build deterministic release artifacts** - `ca0ff37` (feat)
3. **Task 1 fix: Remove temporary paths from release bytes** - `fb789ed` (fix)
4. **Task 1 provenance: Record stable build provenance** - `b71cc89` (chore)
5. **Task 2 RED: Specify independent release drift verification** - `aad88b6` (test)
6. **Task 2 GREEN: Verify release artifacts independently** - `4c7e161` (feat)
7. **Task 2 regression: Distinguish generated schema copies** - `7edf0c0` (fix)
8. **Cross-environment fix: Pin the declared Node build target** - `91ae804` (fix)
9. **Provenance refresh: Bind manifest to committed target inputs** - `38d6f3a` (chore)

## Files Created/Modified

- `tools/build.mjs` - Sole staged build, fresh validator compilation, single v1 bundle, canonical copies/manifest, validation, and atomic output replacement.
- `tools/verify-release.mjs` - Independent double-build, committed-output, authority, hash, schema/compiler, and negative-mutation verifier.
- `tools/apply-v100.mjs` - Non-mutating compatibility delegate to the canonical builder.
- `tools/generate-project-validators.mjs` - Reusable deterministic validator-source compiler while retaining the existing generate/check CLI.
- `src/generated-bases/glt-flow-card.base.js` - Authored pre-v1 card base previously recoverable only from a generated artifact.
- `src/generated-bases/editor-app.base.js` - Authored pre-extension online editor base.
- `custom_components/glt_flow_card/build-manifest.json` - Canonical machine-readable source/tool/version/artifact evidence.
- `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js` - Byte-identical freshly assembled runtime outputs.
- `dist/schemas/`, `custom_components/glt_flow_card/schemas/` - Exact release copies of canonical project and bundle schemas.
- `docs/editor/app.js` - Authored editor base plus one bounded generated extension region.
- `package.json` - Canonical `build` script; existing `verify:release` script now has its implementation.
- `.github/workflows/build-v1.yml` - One canonical build invocation and complete generated-output staging.
- `test/release-build.test.mjs` - Positive build/manifest/copy/equality behavior and independent negative drift evidence.
- `test/contract-fixtures.test.mjs` - Singular authored schema assertion updated to recognize only the planned generated release destinations.

## Decisions Made

- Generated runtime, schema, and editor files are outputs only. Their preserved legacy/editor bodies now live under `src/generated-bases/` as explicit authored inputs.
- The build manifest omits its own hash and every clock/random/absolute value. Artifact hashes cover every other output, while source hashes cover every byte that can influence the build.
- Git provenance uses the latest commit affecting canonical build inputs plus an independently recomputed dirty marker, avoiding a commit self-reference while remaining source-traceable.
- The manifest records Node `22` as the declared build target and exact Ajv/esbuild package versions. This avoids host-patch churn while keeping the versioned compiler inputs explicit.
- Verification independently reimplements path enumeration, SHA-256, version/schema authority checks, source evidence, and mutation probes instead of importing build helpers or trusting the manifest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added canonical authored card and editor bases**
- **Found during:** Task 1 GREEN
- **Issue:** The pre-v1 card and pre-extension editor bodies existed only inside generated outputs, so a nominal fresh build would have trusted possibly drifted release files.
- **Fix:** Mechanically extracted the existing reviewed bodies into `src/generated-bases/` and made the build consume only those authored files.
- **Files modified:** `src/generated-bases/glt-flow-card.base.js`, `src/generated-bases/editor-app.base.js`, `tools/build.mjs`
- **Verification:** Isolated builds succeed with no generated output used as an input; checked-in output comparison and source fingerprints pass.
- **Committed in:** `ca0ff37`

**2. [Rule 3 - Blocking] Mirrored the canonical diff policy into the temporary compiler tree**
- **Found during:** Task 1 GREEN
- **Issue:** The copied v1 source imports `schemas/diff-policy.json`; the first isolated bundle correctly failed because that canonical non-schema policy input was absent from the compiler root.
- **Fix:** Copy the canonical policy into the temporary compiler tree and include it in manifest source evidence.
- **Files modified:** `tools/build.mjs`
- **Verification:** Fresh validator/v1 bundling and all four Task 1 behavior tests pass.
- **Committed in:** `ca0ff37`

**3. [Rule 2 - Missing Critical] Routed the existing CI producer through the canonical build**
- **Found during:** Task 1 GREEN
- **Issue:** The existing workflow still bundled v1 separately before invoking the compatibility tool, violating the one-bundle/one-producer contract even though the delegated build ignored that file.
- **Fix:** Replace both steps with `npm run build` and stage the complete authored/generated build set.
- **Files modified:** `.github/workflows/build-v1.yml`
- **Verification:** Workflow now has one release build invocation; local canonical build and release verifier pass.
- **Committed in:** `ca0ff37`

**4. [Rule 1 - Determinism Bug] Removed random temporary paths from esbuild module comments**
- **Found during:** Task 1 post-commit rebuild
- **Issue:** Esbuild emitted temporary absolute module paths into readable bundle comments, changing ten lines and both card hashes on every run.
- **Fix:** Set the temporary compiler root as esbuild's stable working directory and bundle the relative `src/v100/entry.js` path.
- **Files modified:** `tools/build.mjs`, generated card copies, build manifest
- **Verification:** Consecutive card and manifest SHA-256 values are identical; independent isolated double-build equality passes.
- **Committed in:** `fb789ed`, `b71cc89`

**5. [Rule 1 - Regression] Kept the singular authored-schema test compatible with planned release copies**
- **Found during:** Overall `npm test`
- **Issue:** The pre-existing test treated new Companion schema outputs as a second authored schema tree, although the build proves they are exact generated copies.
- **Fix:** Exclude only the declared `dist/schemas/` and Companion schema destinations while continuing to reject any other authored schema tree.
- **Files modified:** `test/contract-fixtures.test.mjs`
- **Verification:** Focused regression passes and the full Node suite passes 69/69.
- **Committed in:** `7edf0c0`

**6. [Rule 1 - Cross-Environment Drift] Replaced the host Node patch version with the declared Node 22 target**
- **Found during:** Final verification
- **Issue:** Recording Node 25.9.0 from this host would force manifest drift when the canonical GitHub workflow runs its declared Node 22 environment, despite identical compiler inputs and payload bytes.
- **Fix:** Record and independently verify the declared Node 22 build target while retaining exact Ajv 8.20.0 and esbuild 0.25.12 versions.
- **Files modified:** `tools/build.mjs`, `tools/verify-release.mjs`, `test/release-build.test.mjs`, build manifest
- **Verification:** Focused manifest/double-build/mutation tests and `npm run verify:release` pass with stable checked-in bytes.
- **Committed in:** `91ae804`, `38d6f3a`

---

**Total deviations:** 6 auto-fixed (3 Rule 1 bugs/regressions, 2 Rule 2 missing critical controls, 1 Rule 3 blocker)
**Impact on plan:** Every deviation was necessary to make generated files output-only, preserve the one-producer contract, or keep deterministic verification correct across runs/environments. No HACS packaging/category behavior, endpoint, authentication path, live Home Assistant access, publication, remote call, physical-bus access, or plant write was added.

## Issues Encountered

- The host-provided Node runtime is 25.9.0 rather than the repository's CI Node 22. A disposable checksum-verified official Node 22 archive execution was attempted but blocked by the execution policy before download. The canonical workflow remains pinned to Node 22, and the manifest intentionally records that declared target instead of the host patch version.

## Verification

- `npm run build` - produced and validated all 12 declared outputs from canonical authored sources.
- `npm run verify:release` - passed isolated double-build equality, checked-in artifact parity, and all four negative mutation classes.
- `node --test --test-name-pattern="single build|manifest|schema copies|dist www" test/release-build.test.mjs` - Task 1 behavior passed 4/4.
- `node --test --test-name-pattern="double build|drift mutations" test/release-build.test.mjs` - Task 2 behavior passed 2/2.
- `npm test` - full Node suite passed 69/69.
- `py -3.13 -m compileall -q custom_components/glt_flow_card` - Companion sources compiled.
- `npm run verify:contract:validators` - checked-in standalone validators match canonical schema compilation.
- `node --check tools/build.mjs` and `node --check tools/verify-release.mjs` - both release tools parse.
- `git diff --check` - no whitespace errors.
- T-08 supporting control - deterministic build, manifest, double-build, dist/www equality, canonical source/schema/compiler evidence, and drift gate pass. The canonical T-08 owner remains Plan 01-13 Task 1.

## TDD Gate Compliance

- Task 1 RED `e7377c8` failed because `tools/build.mjs` did not exist; GREEN `ca0ff37` passed complete staged-output, manifest, schema-copy, and dist/www behavior. Determinism fixes followed in `fb789ed` and `b71cc89`.
- Task 2 RED `aad88b6` failed because `tools/verify-release.mjs` did not exist; GREEN `4c7e161` passed isolated equality and all negative mutation behavior. Regression/environment fixes followed in `7edf0c0`, `91ae804`, and `38d6f3a`.
- No refactor-only commit was necessary.

## Known Stubs

None. Stub-scan `placeholder` hits are existing form input hints in the canonicalized editor/runtime and are wired to real fields; no TODO, FIXME, coming-soon output, empty mock data source, or goal-blocking placeholder was introduced.

## Threat Flags

None. The new filesystem reads/writes and provenance manifest are the planned T-08 deterministic-build surface. No unplanned network endpoint, auth boundary, remote-site access, archive extraction behavior, schema trust boundary, service call, physical bus, or plant surface was introduced.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-10 can stage HACS artifacts from one verified deterministic build without adding a second producer.
- Plans 01-11/01-12 can run exact-dist browser and Home Assistant lanes against manifest-identified bytes.
- Plan 01-13 retains ownership of the full T-08 release-acceptance command, checksums, provenance allowlist, action pinning, packaging, and attestation.

## Self-Check: PASSED

- All five key created files and every declared generated output exist on disk.
- All nine Task 1/Task 2 RED, GREEN, corrective, and provenance commits exist in git history.
- Canonical build, independent release verification, full 69-test Node suite, Companion compilation, validator drift, syntax, and whitespace gates passed.
- Worktree was clean immediately before summary/tracking updates.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
