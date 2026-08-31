---
phase: 01-trusted-contract-release-foundation
plan: 02
subsystem: test-infrastructure
tags: [playwright, pytest, home-assistant, exact-dist, controlled-red]

requires:
  - phase: 01-01
    provides: Exact provenance allowlist and online artifact verification
provides:
  - Exact locked Node and Python test-tool declarations with focused Phase-1 commands
  - Hermetic exact-dist Playwright fixture with external-effect accounting
  - Supported Home Assistant Config Entry lifecycle fixture with resource accounting
  - Fail-closed controlled RED classifier bound to named evidence ledgers
affects: [01-03-schema-contract, 01-08-companion-lifecycle, 01-11-project-safety, 01-13-release-acceptance]

tech-stack:
  added: [ajv-8.20.0, playwright-test-1.62.1, zip-js-2.8.30, jsonschema-4.26.0, pytest-homeassistant-custom-component-0.13.316]
  patterns: [exact-dist browser testing, supported HA Config Entry testing, controlled RED evidence classification, blocked external effects]

key-files:
  created:
    - requirements-test.txt
    - playwright.config.mjs
    - tools/assert-red.mjs
    - tools/run-exact-dist-playwright.mjs
    - test/e2e/fixtures/fake-ha.mjs
    - test/e2e/project-safety.spec.mjs
    - tests/components/glt_flow_card/conftest.py
    - tests/components/glt_flow_card/test_init.py
  modified:
    - .gitignore
    - package.json
    - package-lock.json
    - pytest.ini

key-decisions:
  - "Accept a missing-feature RED only when the process exits with assertion status 1 and emits both its approved marker and the matching effect ledger."
  - "Load the generated dist/glt-flow-card.js from a loopback-only server and fail immediately on service calls, non-loopback requests, or unexpected localStorage writes."
  - "Exercise Companion setup, reload, unload, and re-setup through Home Assistant Config Entry APIs while measuring integration-owned listeners, tasks, sessions, stores, and managers."
  - "Keep clean Home Assistant dependency resolution in a Linux/container compatibility lane because Home Assistant 2026.2.3 pins lru-dict 1.3.0 without a native Windows Python 3.13 wheel."

patterns-established:
  - "Controlled RED means missing product behavior with deterministic runtime evidence, never a syntax, fixture, launch, timeout, resource, or prohibited-effect failure."
  - "Browser and Companion harnesses block external effects before later plans add privileged behavior."

requirements-completed: [SCHEMA-01, DIFF-01, HACS-01]

duration: 37min
completed: 2026-09-01
---

# Phase 1 Plan 2: Wave-0 Executable Harness Summary

**Exact locked test tools plus evidence-bound browser and Home Assistant lifecycle RED gates that execute real release paths without contacting live systems**

## Performance

- **Duration:** 37 min
- **Started:** 2026-08-31T22:05:09Z
- **Completed:** 2026-08-31T22:41:59Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Locked the three provenance-approved npm test dependencies, declared the two exact Python test roots, and added focused contract, browser, Python, release, and Phase-1 scripts.
- Served and loaded the actual `dist/glt-flow-card.js` through a loopback-only Playwright runner; the missing Project safety workflow now produces a classified RED with a filesystem ledger and no external network, service, or storage effects.
- Exercised Companion setup, reload, unload, re-setup, and final unload through supported Home Assistant Config Entry APIs with exact resource snapshots and blocked client-session/service-call boundaries.
- Proved the lifecycle RED is product behavior: both unloads leave two listeners and the manager/store active, while task, session, and service-attempt counts remain zero.
- Hardened the classifier so named markers without their corresponding `EXACT_DIST_EFFECTS` or `LIFECYCLE_EFFECTS` evidence cannot pass.

## Task Commits

Each task was committed atomically; behavior seeds preserve the intended RED state:

1. **Task 1: Pin the verified test and contract toolchain** - `cbf91ad` (chore)
2. **Task 2 RED: Establish the exact-dist Project safety RED path** - `685bc86` (test)
3. **Task 2 harness: Classify the exact-dist RED result** - `803542b` (feat)
4. **Task 3 RED: Establish the supported Home Assistant lifecycle RED path** - `d4f3d6d` (test)
5. **Task 3 harness: Require evidence for both controlled RED gates** - `38108d2` (feat)

## Files Created/Modified

- `package.json`, `package-lock.json` - Exact npm tools and focused harness commands.
- `requirements-test.txt`, `pytest.ini` - Exact Python test roots and canonical Companion test discovery/plugin configuration.
- `playwright.config.mjs` - Deterministic single-worker Chromium configuration with failure artifacts outside authored source.
- `tools/run-exact-dist-playwright.mjs` - Loopback-only exact-dist server and effect-ledger collector.
- `tools/assert-red.mjs` - Fail-closed marker, exit-code, infrastructure-failure, and evidence classifier.
- `test/e2e/fixtures/fake-ha.mjs`, `test/e2e/project-safety.spec.mjs` - Fake HA boundary and Project safety acceptance seed.
- `tests/components/glt_flow_card/conftest.py`, `tests/components/glt_flow_card/test_init.py` - Supported HA lifecycle fixtures and exact resource expectations.
- `.gitignore` - Ignores disposable provenance evidence under `.planning/tmp/`.

## Decisions Made

- Kept missing product behavior explicitly RED instead of making future Project safety or lifecycle cleanup claims green prematurely.
- Required exact evidence prefixes per RED name so a copied assertion marker cannot masquerade as a successfully exercised harness.
- Used Home Assistant's Config Entry methods and pytest fixtures rather than calling integration setup functions directly.
- Limited Windows test shims to the POSIX-only `fcntl` and `resource` imports needed before plugin loading; no production code or live Home Assistant runtime is modified.
- Reserved clean dependency installation for Linux/container CI because the exact Home Assistant dependency closure is not natively installable on Windows Python 3.13 without a compiler toolchain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ignored the provenance verifier's disposable evidence directory**
- **Found during:** Task 1
- **Issue:** Rerunning the required online provenance gate creates `.planning/tmp/phase01-provenance.json`, which otherwise appeared as untracked runtime output.
- **Fix:** Added `.planning/tmp/` to `.gitignore` while preserving the report as disposable local evidence.
- **Files modified:** `.gitignore`
- **Committed in:** `cbf91ad`

**2. [Rule 3 - Blocking] Made supported HA fixtures load before Windows-only POSIX imports**
- **Found during:** Task 3
- **Issue:** Home Assistant's test plugin imports `fcntl` and `resource` before collection on Windows, and its isolated `custom_components` package initially masked the repository integration.
- **Fix:** Disabled only the plugin's automatic early load, installed Windows test-process shims before explicit supported plugin loading, and prepended the repository custom-component path inside the fixture.
- **Files modified:** `pytest.ini`, `tests/components/glt_flow_card/conftest.py`
- **Verification:** The lifecycle test completed all five Config Entry transitions and reached only `EXPECTED_RED[missing-lifecycle-cleanup]`.
- **Committed in:** `d4f3d6d`

**3. [Rule 3 - Blocking] Patched slotted Home Assistant services at their owning classes**
- **Found during:** Task 3
- **Issue:** Current Home Assistant `EventBus` and `ServiceRegistry` instances expose read-only slotted methods, so instance-level effect instrumentation failed during fixture setup.
- **Fix:** Patched the owning classes for the fixture lifetime while delegating safe listener registration and rejecting service calls.
- **Files modified:** `tests/components/glt_flow_card/conftest.py`
- **Verification:** The supported lifecycle completed with zero external session or service attempts and emitted the exact lifecycle ledger.
- **Committed in:** `d4f3d6d`

---

**Total deviations:** 3 auto-fixed blocking harness issues
**Impact on plan:** All changes remain test-only or ignore/config wiring; they make the planned controlled RED paths executable without broadening production behavior or live-system access.

## Issues Encountered

- A clean native Windows Python 3.13 resolution of `pytest-homeassistant-custom-component==0.13.316` reaches Home Assistant 2026.2.3, which pins `lru-dict==1.3.0`. That release has no matching Windows Python 3.13 wheel and attempts an MSVC source build. No compiler or alternative package was installed. The supported lifecycle harness itself was executed successfully in the available environment; reproducible clean installation remains a Linux/container CI lane requirement.

## Verification

- `node tools/verify-provenance.mjs --online` - five approved package records verified live.
- `npm ci --ignore-scripts` - exact lockfile installation completed with zero vulnerabilities.
- `npm ls --depth=0` - all six declared npm dependencies resolved at their locked versions.
- `npm run check` - production dist syntax passed.
- `npm test` - 23/23 existing Node tests passed.
- `npm run test:e2e:red` - accepted only `EXPECTED_RED[missing-project-safety-ui]` with `EXACT_DIST_EFFECTS` evidence.
- `node tools/assert-red.mjs --expected=missing-lifecycle-cleanup -- py -3.13 -m pytest tests/components/glt_flow_card/test_init.py -q` - accepted only the lifecycle-cleanup RED with the five-state `LIFECYCLE_EFFECTS` ledger.

## TDD Gate Compliance

- Task 2 RED behavior is committed in `685bc86`; its classifier harness follows in `803542b`.
- Task 3 RED behavior is committed in `d4f3d6d`; evidence-bound classification follows in `38108d2`.
- Future feature plans intentionally own the GREEN implementation for Project safety and lifecycle cleanup.

## Known Stubs

None. Empty arrays/objects in the new files are effect accumulators and boundary defaults used by executable fixtures, not unwired UI data.

## User Setup Required

- Use the repository's Linux/container compatibility lane for a clean installation of the exact Home Assistant test dependency closure. No live Home Assistant, credentials, browser session, physical bus, remote site, or plant access is required.

## Next Phase Readiness

- Schema, project safety, lifecycle, and release plans can use the named focused commands and evidence classifiers without inventing new harness behavior.
- The two intended product gaps are isolated: Project safety UI is absent, and Companion unload retains its listeners and manager/store.
- Clean native Windows Python 3.13 dependency installation should not be treated as a supported acceptance lane until upstream provides the pinned wheel or the project explicitly adopts a compiler-backed lane.

## Self-Check: PASSED

- All created harness/config files exist.
- Task commits exist in git history: `cbf91ad`, `685bc86`, `803542b`, `d4f3d6d`, `38108d2`.
- Both controlled RED classifiers passed with their matching runtime evidence.
- No production endpoint, auth path, schema, generated artifact, external publication, live HA call, physical-bus write, remote-site call, or plant write was introduced.
- No unexpected tracked deletion or untracked generated file remains.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
