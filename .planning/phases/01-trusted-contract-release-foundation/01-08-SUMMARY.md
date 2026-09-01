---
phase: 01-trusted-contract-release-foundation
plan: 08
subsystem: companion-lifecycle-options-diagnostics
tags: [home-assistant, config-entry, options-flow, diagnostics, privacy, lifecycle]

requires:
  - phase: 01-07
    provides: Split project repositories, authoritative transactions, immutable snapshots, and deterministic recovery
provides:
  - Resource-exact Config Entry setup, reload, unload, and re-setup with component-scope guarded WebSocket commands
  - Strictly validated lock, version-retention, and audit-retention options with atomic failed-reload restoration
  - Explicitly allowlisted diagnostics with build, store, count, digest-prefix, and recovery evidence
  - Complete English and German setup, options, abort, and error metadata
affects: [01-09-contract-integration, 01-12-ha-artifacts, 01-13-release-acceptance, companion-support]

tech-stack:
  added: []
  patterns: [entry-scoped compatibility runtime, component-scope guarded commands, atomic options rollback, explicit diagnostics allowlist]

key-files:
  created:
    - custom_components/glt_flow_card/diagnostics.py
    - tests/components/glt_flow_card/test_options.py
    - tests/components/glt_flow_card/test_diagnostics.py
  modified:
    - custom_components/glt_flow_card/__init__.py
    - custom_components/glt_flow_card/config_flow.py
    - custom_components/glt_flow_card/const.py
    - custom_components/glt_flow_card/project_repository.py
    - custom_components/glt_flow_card/manifest.json
    - custom_components/glt_flow_card/strings.json
    - custom_components/glt_flow_card/translations/en.json
    - custom_components/glt_flow_card/translations/de.json
    - tests/components/glt_flow_card/conftest.py
    - tests/components/glt_flow_card/test_init.py
    - test/v100-backend.test.mjs

key-decisions:
  - "Register the immutable WebSocket command surface once at component scope, but resolve exactly one currently loaded entry runtime for every invocation and return a stable not_loaded error otherwise."
  - "Use a hass.data compatibility runtime map instead of assuming ConfigEntry.runtime_data on the declared minimum Home Assistant lane."
  - "Retain only default_lock_ttl, max_versions, and max_audit; every option is a strict bounded integer with a tested repository or runtime effect."
  - "Treat option changes as candidate reloads and restore both stored options and a newly loaded prior-effective runtime if candidate setup fails."
  - "Build diagnostics from a fixed metadata allowlist; expose only counts and 12-character digest/build prefixes, never recursively redact runtime payloads."

patterns-established:
  - "Lifecycle: component registration -> entry recovery/load -> listener registration -> runtime publication -> unavailable-first unload -> awaited cleanup."
  - "Options: normalize and validate -> stage candidate -> reload -> commit effective runtime or unload failed state and restore prior options/runtime."
  - "Diagnostics: derive named metadata fields from repository summaries and counts without traversing project, audit, remote, or Home Assistant state bodies."

requirements-completed: [HACS-01, SCHEMA-01]

duration: 24min
completed: 2026-09-01
---

# Phase 01 Plan 08: Companion Lifecycle, Options, and Diagnostics Summary

**Leak-free Config Entry lifecycle with atomic bounded options and T-07-safe allowlisted diagnostics for the Home Assistant Companion**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-01T00:51:49Z
- **Completed:** 2026-09-01T01:15:30Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Replaced the shared never-unloaded manager with one entry-scoped runtime that is published only after split-store initialization and transaction recovery succeed.
- Registered all 25 WebSocket commands exactly once at component scope and guarded them so unloaded invocations return the stable `not_loaded` contract without resolving stale managers.
- Made unload remove runtime visibility first, unsubscribe both Home Assistant listeners, cancel and await alarm tasks, clear ephemeral previews and remote-site configuration, and remove the compatibility manager reference.
- Removed the ineffective `server_enforced` and unknown legacy options, rejected booleans and out-of-range values, and gave lock TTL, snapshot retention, and both audit stores observable bounded behavior.
- Added atomic options reload with tested recovery from candidate setup failure back to the previously stored and effective configuration.
- Added diagnostics containing only integration/schema/build identities, effective options, store versions, resource counts, digest prefixes, and sanitized recovery counts.
- Proved T-07 with distinct project, snapshot, asset, entity-state, audit-body, remote URL, token, journal identity, state, and raw-exception canaries.
- Completed English and German setup, options, abort, and error metadata and classified the entityless Companion as a Home Assistant service integration.
- Updated the backend Node smoke contract to assert the three effective options and Config Entry reload wiring without resurrecting the removed inert option.

## Task Commits

Each TDD task was committed as a RED specification followed by GREEN implementation:

1. **Task 1 RED: Specify resource-exact Companion lifecycle** - `e26c1a9` (test)
2. **Task 1 GREEN: Make Companion lifecycle resource-exact** - `9c56e3a` (feat)
3. **Task 2 RED: Specify validated atomic options** - `f56a5ec` (test)
4. **Task 2 GREEN: Apply validated options atomically** - `e3d856d` (feat)
5. **Task 3 RED: Specify allowlisted Companion diagnostics** - `344065a` (test)
6. **Task 3 GREEN: Add allowlisted localized diagnostics** - `04f682d` (feat)

## Files Created/Modified

- `custom_components/glt_flow_card/__init__.py` - Entry runtime ownership, guarded commands, awaited cleanup, effective options, atomic reload/restore, and option-driven lock/audit behavior.
- `custom_components/glt_flow_card/config_flow.py` - Current supported Options Flow API and strict retained-option schema.
- `custom_components/glt_flow_card/const.py` - Central option defaults, ranges, and normalization.
- `custom_components/glt_flow_card/project_repository.py` - Per-runtime snapshot and project-audit retention limits.
- `custom_components/glt_flow_card/diagnostics.py` - Explicit support metadata allowlist and build/digest-prefix evidence.
- `custom_components/glt_flow_card/manifest.json` - Service integration classification.
- `custom_components/glt_flow_card/strings.json` - Canonical English flow, abort, option, and error strings.
- `custom_components/glt_flow_card/translations/en.json` - Complete English localized metadata.
- `custom_components/glt_flow_card/translations/de.json` - Complete German localized metadata.
- `tests/components/glt_flow_card/conftest.py` - Registered-command capture for lifecycle invocation evidence.
- `tests/components/glt_flow_card/test_init.py` - Exact resource counts, pending-task cancellation, unavailable command, and recovery-order behavior.
- `tests/components/glt_flow_card/test_options.py` - Single-instance, range, effect, reload, rollback, and legacy-option behavior.
- `tests/components/glt_flow_card/test_diagnostics.py` - Allowlist shape, T-07 canary absence, build identity, and bilingual metadata behavior.
- `test/v100-backend.test.mjs` - Cross-stack smoke assertions for the retained option contract and lifecycle reload wiring.

## Decisions Made

- Kept component-scope WebSocket registrations for the entire integration lifetime because the supported registration API has no unregister callback. Every registered handler is instead guarded by the current entry-runtime resolver.
- Kept the existing `hass.data[DOMAIN]["manager"]` key only as a loaded-state compatibility view for existing callers while making the per-entry runtime map authoritative and removing both on unload.
- Published the runtime only after repository initialization and PREPARED-journal recovery, so commands and listeners cannot observe an unrecovered manager.
- Applied snapshot retention per project by revision while preserving immutable identities for retained snapshots. Both legacy and project-transaction audit paths use the same effective audit limit.
- Restored failed candidate options through supported Config Entry unload/setup operations rather than mutating private entry state.
- Allowed only known recovery state/result labels into diagnostics; unknown journal values collapse to an `other` count, preventing raw exception or attacker-controlled strings from becoming support output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Fixture Bug] Updated the lifecycle command count after Plan 01-07 expanded the command surface**
- **Found during:** Task 1 RED/GREEN
- **Issue:** The inherited controlled RED expected 22 commands, while the authoritative project transaction work now registers 25. The stale count masked the intended unload assertions.
- **Fix:** Updated the exact count to 25 and retained the invariant that reload/re-setup never duplicates registrations.
- **Files modified:** `tests/components/glt_flow_card/test_init.py`
- **Verification:** Lifecycle setup/reload/unload/re-setup test passes with 25 commands at every stage, two/zero listeners, and one/zero runtime resources.
- **Committed in:** `e26c1a9`

**2. [Rule 1 - Compatibility Bug] Replaced the obsolete writable OptionsFlow config_entry pattern**
- **Found during:** Task 2 RED
- **Issue:** The existing constructor assigned Home Assistant's read-only `OptionsFlow.config_entry` property, so opening the options form failed before validation.
- **Fix:** Use the supported no-argument Options Flow construction and resolve `self.config_entry` after flow initialization.
- **Files modified:** `custom_components/glt_flow_card/config_flow.py`
- **Verification:** Real Home Assistant options-flow initialization returns the complete bounded schema and rejects invalid values.
- **Committed in:** `e3d856d`

**3. [Rule 2 - Missing Critical] Enforced retained options inside the split project repository**
- **Found during:** Task 2 GREEN
- **Issue:** `max_versions` and the project-transaction audit limit could not have an executable effect without updating `project_repository.py`, which was omitted from the task file list.
- **Fix:** Added configured per-project snapshot pruning and configured project-audit truncation while retaining immutable snapshots inside the bound.
- **Files modified:** `custom_components/glt_flow_card/project_repository.py`
- **Verification:** Option behavior tests prove six snapshots become revisions 1-5 under a limit of five and both audit paths remain at the configured maximum.
- **Committed in:** `e3d856d`

**4. [Rule 1 - Regression] Replaced the stale Node smoke assertion for the removed inert option**
- **Found during:** Post-wave full `npm test` integration gate
- **Issue:** `test/v100-backend.test.mjs` still required the removed `server_enforced` token even though Plan 01-08 correctly retained only options with executable effects.
- **Fix:** Assert the three bounded effective option keys, strict normalization, update-listener registration, and Config Entry reload call; explicitly assert that `server_enforced` stays absent from the Options Flow.
- **Files modified:** `test/v100-backend.test.mjs`
- **Verification:** Targeted backend tests pass 2/2 and the full Node suite passes 63/63.
- **Committed in:** `0fcbba4`

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs/regressions, 1 Rule 2 missing critical behavior)
**Impact on plan:** All changes were required to make the planned lifecycle and retained options observable and correct. No dependency, live Home Assistant target, network request, remote call, publication, service call, physical bus, or plant write was added.

## Issues Encountered

None. The Windows fake-Home-Assistant lane completed all component tests. Its existing aiohttp inheritance deprecation and intentional duplicate-ZIP fixture warnings remain non-blocking upstream/test-fixture warnings.

## Verification

- `py -3.13 -m pytest tests/components/glt_flow_card/test_init.py tests/components/glt_flow_card/test_websocket.py -q` - 5/5 lifecycle and WebSocket regression tests passed.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_options.py -q` - 6/6 Config Flow and atomic options tests passed.
- Focused lifecycle/options/repository/transaction/WebSocket regression suite - 28/28 tests passed.
- T-07 owner command `py -3.13 -m pytest tests/components/glt_flow_card/test_diagnostics.py -q -k "redact or canary or allowlist"` - 2 passed, 1 deselected.
- `py -3.13 -m pytest tests/components/glt_flow_card -q` - full Companion suite passed 63/63.
- `py -3.13 -m compileall -q custom_components/glt_flow_card` - all Companion Python modules compiled.
- `node --test test/v100-backend.test.mjs` - targeted backend smoke tests passed 2/2.
- `npm test` - full Node suite passed 63/63 after the post-wave regression fix.
- `git diff --check` - no whitespace errors.

## TDD Gate Compliance

- Task 1 RED `e26c1a9` failed on pending-task leakage, stale command resolution, and absent runtime accessor; GREEN `9c56e3a` passed lifecycle, recovery-order, unavailable-command, and WebSocket regression behavior.
- Task 2 RED `f56a5ec` failed on the obsolete Options Flow constructor, absent effective settings, absent reload, absent rollback, and retained legacy flags; GREEN `e3d856d` passed all six option behaviors plus repository/transaction regressions.
- Task 3 RED `344065a` failed because the diagnostics module did not exist; GREEN `04f682d` passed allowlist, T-07 canary, build identity, and localization behavior.
- No refactor-only commit was necessary.

## Known Stubs

None. Empty runtime maps, listener/task collections, and diagnostic zero-count values are deliberate initialized or unloaded-state representations, not placeholder UI or unwired data.

## Threat Flags

None. Diagnostics are the planned T-07 owner surface and are covered by the exact ledger command. Lifecycle recovery supports planned T-06. No unplanned endpoint, auth path, remote-site access, file extraction, schema trust boundary, bus, or plant surface was introduced.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Config Entry lifecycle, option effects, and diagnostics are ready for Plan 01-09 contract integration work.
- The full fake-Home-Assistant Companion suite is green with no live Home Assistant, remote-site, service, physical-bus, or plant interaction.

## Self-Check: PASSED

- Created diagnostics and both new test files exist on disk.
- All six Task 1-3 RED/GREEN commits and post-wave regression commit `0fcbba4` exist in git history.
- The full 63-test Companion suite, exact T-07 owner command, compileall, targeted backend smoke, full 63-test Node suite, and whitespace gates passed.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
