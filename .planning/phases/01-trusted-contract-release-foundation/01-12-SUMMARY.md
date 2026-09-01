---
phase: 01-trusted-contract-release-foundation
plan: 12
subsystem: release-compatibility
tags: [home-assistant, ghcr, pytest, docker, hacs, immutable-digests, github-actions]

requires:
  - phase: 01-09
    provides: Canonical manifest-bound release build with deterministic staged artifacts
  - phase: 01-10
    provides: Separately validated HACS plugin and integration category packages
  - phase: 01-11
    provides: Exact-dist Project safety bytes and authoritative Companion lifecycle behavior
provides:
  - Bounded official Home Assistant minimum/current lane discovery with architecture-specific immutable GHCR digests
  - Exact staged ZIP/card install, upgrade, reload, unload, re-setup, recovery, identity, and zero-effect evidence
  - Read-only SHA-pinned CI that builds once, transfers manifest-hashed stages, and validates HACS categories separately
affects: [01-13-release-acceptance, HACS-01, SCHEMA-01, DIFF-01, T-06, T-08]

tech-stack:
  added: []
  patterns: [official metadata preflight, platform-digest container lanes, exact-artifact pytest workspace, read-only artifact handoff]

key-files:
  created:
    - tools/resolve-ha-lanes.mjs
    - tools/test-ha-artifacts.mjs
    - test/ha-lanes.test.mjs
    - .github/workflows/hacs.yml
  modified:
    - .github/workflows/validate.yml
    - .github/workflows/build-v1.yml
    - custom_components/glt_flow_card/config_flow.py
    - custom_components/glt_flow_card/project_contract.py
    - custom_components/glt_flow_card/project_diff.py
    - tools/build.mjs
    - tools/stage-hacs-packages.mjs
    - tools/validate-hacs-staging.mjs
    - tools/verify-release.mjs

key-decisions:
  - "Derive stable Home Assistant releases from official PyPI metadata, then pin the runner platform digest from the official GHCR manifest index before any image execution."
  - "Match each Home Assistant lane to the exact pytest-homeassistant-custom-component release whose official dependency metadata pins that Home Assistant version."
  - "Keep the advertised 2024.8.0 floor because the exact staged artifacts pass there after packaging schema authorities and preserving OptionsFlow compatibility."
  - "CI preflights provenance without Docker, transfers one manifest-hashed stage, and only then runs isolated network-disabled pytest containers."

patterns-established:
  - "Bounded compatibility ownership: probe no more than 12 official stable candidates and atomically replace all seven minimum declarations only after full restage and two-lane success."
  - "Exact artifact harness: independently verify stage, ZIP member, card, build, version, architecture, and HA package identities before executing the complete lifecycle suite."
  - "Read-only CI provenance: full-SHA actions, contents: read, build-once upload/download handoff, and separate plugin/integration validation jobs."

requirements-completed: [HACS-01, SCHEMA-01, DIFF-01]

duration: 28min
completed: 2026-09-01
---

# Phase 01 Plan 12: Immutable Home Assistant Artifact Lanes Summary

**Official digest-pinned Home Assistant 2024.8.0 and 2026.8.3 lanes executing the exact staged Companion ZIP and dashboard card through full install, upgrade, recovery, reload, unload, and re-setup behavior**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-01T14:12:12Z
- **Completed:** 2026-09-01T14:40:00Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments

- Added a fail-closed resolver that reads official PyPI/GHCR metadata, rejects prerelease or mutable-only lanes, limits minimum probing to 12 candidates, records architecture/index/platform digests, and owns atomic minimum replacement across all seven declarations.
- Proved the existing 2024.8.0 floor with pytest harness 0.13.152 and current stable 2026.8.3 with harness 0.13.357; both linux/amd64 lanes ran 64 exact-artifact tests successfully.
- Installed the manifest-hashed staged Companion ZIP and card into isolated temporary Home Assistant workspaces, verified archive members and byte identities, and exercised clean setup, duplicate prevention, preview/apply, migration/upgrade evidence, rollback/recovery, reload, unload, and re-setup with zero service, session, remote, or plant effects.
- Converted owned CI workflows to read-only permissions and full-SHA actions, with one uploaded/downloaded release stage and separately gated HACS plugin/integration category jobs.

## Task Commits

Both tasks followed RED/GREEN TDD with one deterministic provenance correction:

1. **Task 1 RED: Specify immutable HA lane resolution** - `5ab93ce` (test)
2. **Task 1 GREEN: Resolve immutable Home Assistant lanes** - `a10fc8c` (feat)
3. **Task 2 RED: Specify exact HA artifact CI lanes** - `071c31f` (test)
4. **Task 2 GREEN: Run exact artifacts on pinned HA lanes** - `61c2361` (feat)
5. **Post-task provenance: Refresh release build identity** - `ceec188` (fix)

## Files Created/Modified

- `tools/resolve-ha-lanes.mjs` - Official release catalog, immutable architecture resolution, exact harness matching, bounded probes, evidence, and atomic minimum ownership.
- `tools/test-ha-artifacts.mjs` - Stage/hash verification, safe ZIP extraction, isolated Docker/pytest workspaces, exact package identity, and two-lane lifecycle execution.
- `test/ha-lanes.test.mjs` - Behavioral contracts for candidate bounds, official digests, harness metadata, minimum ownership, runner isolation, and CI provenance.
- `.github/workflows/validate.yml` - Build-once manifest-hashed stage handoff into preflighted HA artifact lanes.
- `.github/workflows/build-v1.yml` - Read-only deterministic release/HACS validation with immutable action references and no bot push.
- `.github/workflows/hacs.yml` - Shared stage plus separate plugin and integration category validation jobs.
- `custom_components/glt_flow_card/config_flow.py` - Compatible OptionsFlow config-entry ownership across the declared minimum and current HA APIs.
- `custom_components/glt_flow_card/project_contract.py`, `custom_components/glt_flow_card/project_diff.py` - Resolve packaged schema authorities relative to the installed integration.
- `custom_components/glt_flow_card/schemas/*`, `dist/schemas/*` - Package the canonical limits and diff-policy authorities required by installed artifacts.
- `tools/build.mjs`, `tools/stage-hacs-packages.mjs`, `tools/validate-hacs-staging.mjs`, `tools/verify-release.mjs` - Generate, stage, hash, and independently verify the added packaged authorities.
- `README.md`, `README.de.md`, `docs/wiki/Installation.md`, `packaging/hacs-integration/README.md` - Explicit, replaceable 2024.8.0 minimum declarations.

## Decisions Made

- The resolver uses the official Home Assistant PyPI catalog as the stable-release authority and GHCR platform manifests as the image authority; no date-based Python inference or speculative future lane exists.
- Preflight mode resolves and records the advertised floor/current lane provenance without starting Docker. Image pulls and pytest execution occur only after that evidence is available.
- The declared floor remained 2024.8.0 because the first and only probed candidate passed; no minimum metadata replacement was necessary.
- The complete existing Companion component suite is the minimum probe as well as the final lane suite, avoiding a weak subset that could select an incompatible floor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Infrastructure] Started the installed Docker Desktop Linux engine**
- **Found during:** Task 1 GREEN
- **Issue:** Docker Desktop was installed but its Linux engine was stopped, so the supported official-image harness could not run.
- **Fix:** Started the existing Docker Desktop helper hidden and verified `docker info` reported a linux/x86_64 engine; no daemon configuration, registry login, or live HA connection was used.
- **Verification:** Both official platform-digest images imported their exact Home Assistant package versions and completed the suite.
- **Committed in:** No repository file change.

**2. [Rule 1 - Packaging Bug] Included runtime schema authorities in the Companion artifact**
- **Found during:** Task 1 GREEN exact ZIP import
- **Issue:** Installed `project_contract.py` and `project_diff.py` searched outside the integration for `schemas/limits.json` and `schemas/diff-policy.json`; exact ZIP installation therefore failed while repository-local tests passed.
- **Fix:** Resolve authorities component-locally, generate them into the integration/dist package, and extend build, stage, ZIP, and independent release validators.
- **Verification:** Freshly extracted exact ZIP imports and all 64 component tests pass in both HA lanes.
- **Committed in:** `a10fc8c`

**3. [Rule 1 - Compatibility Bug] Preserved OptionsFlow behavior on HA 2024.8.0**
- **Found during:** Task 1 GREEN minimum lane
- **Issue:** HA 2024.8 did not inject the modern `OptionsFlow.config_entry` property used by current releases.
- **Fix:** Pass and retain the entry explicitly while preferring the framework property when available.
- **Verification:** Options setup/reload/recovery cases pass on both 2024.8.0 and 2026.8.3.
- **Committed in:** `a10fc8c`

**4. [Rule 3 - Blocking Harness] Removed duplicate pytest plugin registration in isolated copies**
- **Found during:** Task 1 GREEN harness bootstrap
- **Issue:** The exact pinned pytest package auto-loaded its entry point while the copied repository conftest registered it again.
- **Fix:** Normalize only the isolated copied conftest and fail if the expected declaration is absent; authored tests remain unchanged.
- **Verification:** Both container suites collect and pass 64 tests without duplicate-plugin errors.
- **Committed in:** `a10fc8c`

**5. [Rule 1 - Provenance Drift] Refreshed the clean authored-source build identity after commits**
- **Found during:** Overall release verification
- **Issue:** The pre-commit manifest recorded the prior dirty source state; after task commits a fresh canonical build correctly produced a different clean build identity.
- **Fix:** Regenerate once from the clean task commits and commit only the resulting manifest identity.
- **Verification:** `npm run verify:release` passes checked-in output and seeded drift checks; the final restaged artifacts pass both exact HA lanes.
- **Committed in:** `ceec188`

---

**Total deviations:** 5 auto-fixed (3 Rule 1 correctness/provenance fixes, 2 Rule 3 blocking environment/harness fixes)
**Impact on plan:** Every fix was necessary to execute the supported exact-artifact contract or keep the declared minimum truthful. No dependency, endpoint, credential, publication target, live Home Assistant, remote site, service target, browser session, physical bus, or plant operation was added.

## Issues Encountered

- A Windows child-process launch of `npm` was unreliable; the resolver now invokes the already-running npm CLI through `process.execPath`/`npm_execpath`, preserving the locked toolchain without installing anything.
- The expected recovery test deliberately logs a candidate reload failure before proving restoration; both lanes still finish 64/64 green with zero residual resources.

## Verification

- `node --test test/ha-lanes.test.mjs` - 9/9 resolver, ownership, isolation, and workflow contract tests passed.
- `npm run test:ha-artifacts -- --lanes-file .planning/tmp/ha-lanes.json` - final manifest-hashed ZIP/card passed 64/64 on HA 2024.8.0 and 64/64 on HA 2026.8.3.
- Minimum lane: `linux/amd64`, platform digest `sha256:9024f2f8977b80a819c71bda11dba53c2e2306528a8b2d9c9035999708f701d1`, harness 0.13.152.
- Current lane: `linux/amd64`, platform digest `sha256:8e9751cb66d3ba6624f5360a7d31b0c6821f7f5b3fb8ba0d10d58f0f481c540c`, harness 0.13.357.
- Final stage identity: manifest `2aaa700dc64fa6ca0e6075dd720b74789eca7707fb021fa71e0dd3f673fa33ad`, ZIP `74b92468ce24912402194f73b424129c94ee454a4adf3c8b5edcbc253fc83ad9`, card `f7d0729f537cdae6cbd12cd40ae49b811770b28ec7ecf794e6c19e6ab2d376fb`.
- `npm test` - complete Node suite passed 83/83.
- `py -3.13 -m pytest tests/components/glt_flow_card -q` - local Companion suite passed 63/63.
- `npm run validate:hacs-staging` - plugin, Companion ZIP install layout, no-credential, and integration category checks passed.
- `npm run verify:release` - double-build, checked-in output, and all seeded drift failures passed.

## TDD Gate Compliance

- Task 1 RED `5ab93ce` failed six missing resolver/runner contracts; GREEN `a10fc8c` passed bounded resolution, official digest, harness, atomic ownership, and exact-artifact execution.
- Task 2 RED `071c31f` failed the missing/read-write/mutable workflow contracts; GREEN `61c2361` passed SHA pinning, read-only permissions, stage transfer, provenance preflight, and separate HACS category gates.
- No refactor-only commit was necessary.

## Known Stubs

None. The scan found no TODO, FIXME, placeholder, coming-soon text, empty UI data source, or goal-blocking hardcoded empty value in the created or modified execution/workflow files.

## Threat Flags

None. Official PyPI/GHCR reads and temporary local archive extraction are the planned provenance/harness surface. No unplanned endpoint, authentication path, persistent file boundary, schema authority, service call, remote-site action, fieldbus access, or plant write was introduced.

## Authentication Gates

None. Official metadata and image reads were anonymous and no credentials were requested or stored.

## User Setup Required

None - the final evidence used the installed local Docker Linux engine, official read-only metadata/images, isolated temporary pytest workspaces, and exact repository stages without a live Home Assistant instance.

## Next Phase Readiness

- Plan 01-13 can consume immutable minimum/current compatibility evidence tied to the final staged artifact hashes.
- The 2024.8.0 advertised minimum is evidence-backed; the automatic bounded raise path remains available if a future compatibility change invalidates it.

## Self-Check: PASSED

- Both created tools, the lane test, the HACS workflow, packaged authority files, and all modified source/workflow files exist.
- RED/GREEN commits `5ab93ce`, `a10fc8c`, `071c31f`, `61c2361`, and provenance commit `ceec188` resolve in git history.
- Final exact-stage evidence records both immutable lanes as verified with the final manifest, ZIP, and card hashes.
- Complete Node, local Companion, HACS staging, release verification, YAML parsing, whitespace, stub, and threat-surface checks passed.
- Working tree was clean immediately before summary creation.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
