---
phase: 01-trusted-contract-release-foundation
plan: 07
subsystem: authoritative-project-persistence
tags: [home-assistant-store, optimistic-concurrency, immutable-snapshots, transaction-journal, recovery]

requires:
  - phase: 01-05
    provides: Canonical schema-v2 migration receipts, semantic operations, stable IDs, impact, and dependency closure
provides:
  - Independent versioned stores for active heads, immutable snapshots, transaction journals, audit metadata, and retained legacy backup
  - Verified one-time copy-on-write import from the legacy monolithic store without destructive conversion
  - HA-user-bound preview and server-recomputed dependency-closed selective apply
  - PREPARED journal recovery and server-owned forward rollback revisions
affects: [01-08-lifecycle, 01-11-project-safety, 01-12-ha-artifacts, 01-13-release-acceptance]

tech-stack:
  added: []
  patterns: [split versioned repositories, copy-on-write legacy import, content-addressed immutable snapshots, PREPARED-COMMITTED journal, deterministic startup recovery]

key-files:
  created:
    - custom_components/glt_flow_card/project_repository.py
    - custom_components/glt_flow_card/project_transactions.py
    - tests/components/glt_flow_card/test_project_repository.py
    - tests/components/glt_flow_card/test_project_transactions.py
    - tests/components/glt_flow_card/test_websocket.py
  modified:
    - custom_components/glt_flow_card/const.py
    - custom_components/glt_flow_card/__init__.py

key-decisions:
  - "Keep active heads, immutable snapshots, journals, audit metadata, and the retained legacy backup under independent Home Assistant Store keys and versions."
  - "Write and verify the untouched legacy backup before staging migrated heads, expose no staged head, and promote only after digest read-back succeeds."
  - "Accept only expected revision, opaque user-bound preview identity, project identity, and stable selected operation IDs; recompute migration, diff, closure, and candidate server-side."
  - "Represent rollback as a new forward transaction from a verified server-owned content-addressed snapshot, never as history mutation or a client receipt."
  - "Resolve PREPARED journals deterministically to a verified old head when no snapshot exists or a verified new head when the immutable snapshot exists."

patterns-established:
  - "Import: retained raw backup -> migrated staged heads -> digest read-back -> atomic promotion marker."
  - "Mutation: PREPARED metadata -> immutable snapshot -> snapshot read-back -> active head -> head read-back -> COMMITTED metadata."
  - "Recovery: absent snapshot plus verified old head aborts; verified snapshot plus old/new head commits the new head; any third state fails availability."

requirements-completed: [SCHEMA-01, DIFF-01, HACS-01]

duration: 26min
completed: 2026-09-01
---

# Phase 01 Plan 07: Authoritative Project Persistence Summary

**Split Home Assistant repositories with retained legacy backup, HA-bound server-recomputed selective apply, immutable forward rollback, and crash-safe PREPARED-journal recovery**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-01T00:21:00Z
- **Completed:** 2026-09-01T00:47:12Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added independent versioned Home Assistant stores for active project heads, content-addressed snapshots, transaction journals, project audit metadata, and the one retained legacy backup.
- Migrated legacy project heads and inline versions copy-on-write through the existing raw-first contract and sequential schema migration, verified canonical digests after persistence read-back, and left the original monolithic project payload untouched.
- Bound previews to authenticated Home Assistant user identity, project identity, expected revision, base digest, candidate digest, and opaque server ID while returning canonical migration, operation, impact, ordering, and closure evidence.
- Made apply re-read the active head and recompute migration, semantic diff, stable IDs, dependency closure, and selected candidate entirely on the server; clients can provide neither candidate content nor dependency metadata at mutation time.
- Added PREPARED-to-COMMITTED transactions with immutable snapshot and active-head read-back checks, plus deterministic startup recovery for interruptions before or after snapshot/head persistence.
- Made rollback resolve only a server-owned snapshot under the same project identity, require exact typed confirmation and expected revision, and create a new immutable forward revision.
- Routed the compatibility `projects/save` command through the coordinator and added real Home Assistant WebSocket preview/apply/rollback authorization and error boundaries.

## Task Commits

Each TDD task was committed as a RED specification followed by GREEN implementation:

1. **Task 1 RED: Specify split project store safety** - `1f4ad82` (test)
2. **Task 1 GREEN: Add verified split project repositories** - `94f9c53` (feat)
3. **Task 2 RED: Specify authoritative project transactions** - `03b4068` (test)
4. **Task 2 GREEN: Journal authoritative project transactions** - `4510775` (feat)

## Files Created/Modified

- `custom_components/glt_flow_card/project_repository.py` - Split Store ownership, defensive-copy APIs, one-time legacy import, immutable snapshot enforcement, and persisted read-back helpers.
- `custom_components/glt_flow_card/project_transactions.py` - User-bound preview, authoritative selection materialization, journaled apply, forward rollback, metadata audit, and startup recovery.
- `custom_components/glt_flow_card/const.py` - Independent store keys and version constants.
- `custom_components/glt_flow_card/__init__.py` - Repository/coordinator startup, authoritative project access, compatibility save delegation, and preview/apply/rollback WebSocket commands.
- `tests/components/glt_flow_card/test_project_repository.py` - Store identity, deep-copy, import, retention, immutable snapshot, and injected-failure tests.
- `tests/components/glt_flow_card/test_project_transactions.py` - T-01/T-02/T-06 preview, selection, stale, rollback, recovery, and redaction tests.
- `tests/components/glt_flow_card/test_websocket.py` - Supported Home Assistant WebSocket happy-path, forged snapshot, role rejection, and compatibility-save tests.

## Decisions Made

- Kept the existing monolithic Store for unrelated alarm, schedule, template, work-order, and remote-site state, but stopped it from persisting the runtime project-head cache. The original project payload remains retained while the split repository is authoritative.
- Used content-addressed snapshot identities derived from both project identity and canonical project digest so snapshots cannot be moved across projects or overwritten with different content.
- Stored candidate content only in the coordinator's opaque in-memory preview record. Apply accepts stable IDs only and reconstructs its result from freshly recomputed server operations before full contract validation.
- Included only user/project IDs, revisions, hashes, snapshot/transaction IDs, selected stable IDs, action, and result in project audit storage; project and candidate bodies never enter audit metadata.
- Required administrators to create new shared projects. Existing project preview/apply/save/rollback continues to require a server-evaluated designer role.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Fixture Bug] Replaced an invalid inline legacy-version marker with a real legacy project document**
- **Found during:** Task 1 GREEN
- **Issue:** The initial test fixture used `{untouched: true}` as an inline historical config, so the required raw validation correctly rejected it before the intended import/retry assertions ran.
- **Fix:** Used a valid historical schema-v0 card document and kept the untouched-payload assertion on the retained backup.
- **Files modified:** `tests/components/glt_flow_card/test_project_repository.py`
- **Verification:** Repository suite passed 8/8 import, retry, retention, and immutability cases.
- **Committed in:** `94f9c53`

**2. [Rule 1 - Bug] Bounded opaque preview-ID collision retries**
- **Found during:** Task 2 GREEN
- **Issue:** A deterministic test ID factory exposed that an endlessly colliding provider could otherwise loop forever while allocating a preview ID.
- **Fix:** Made the test provider monotonic and added an eight-attempt fail-closed production bound.
- **Files modified:** `custom_components/glt_flow_card/project_transactions.py`, `tests/components/glt_flow_card/test_project_transactions.py`
- **Verification:** Transaction suite completed without a hang and all stale/identity cases passed.
- **Committed in:** `4510775`

**3. [Rule 2 - Missing Critical] Prevented unrelated legacy-store saves from overwriting the retained project source**
- **Found during:** Task 2 GREEN integration
- **Issue:** The existing manager persists its whole runtime dictionary for alarms, schedules, and audit. After split-store loading, that runtime dictionary contains new authoritative heads and would have destructively rewritten the legacy project field on the next unrelated save.
- **Fix:** Retain the loaded legacy project map separately and substitute it into every monolithic-store save while keeping split heads as the runtime cache and authoritative read source.
- **Files modified:** `custom_components/glt_flow_card/__init__.py`
- **Verification:** Compatibility-save WebSocket test proves split/head cache equality, while repository tests prove the legacy source and backup remain unchanged.
- **Committed in:** `4510775`

**4. [Rule 2 - Security] Required admin authority for creation of a new shared project**
- **Found during:** Task 2 GREEN WebSocket authorization review
- **Issue:** Existing-project writes checked designer role, but a nonexistent project had no server-owned permissions from which to derive designer authority.
- **Fix:** Require an authenticated Home Assistant administrator for first creation; subsequent mutations use the stored project role.
- **Files modified:** `custom_components/glt_flow_card/__init__.py`
- **Verification:** Admin creation succeeds and a read-only Home Assistant user is rejected at the preview boundary.
- **Committed in:** `4510775`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 2 Rule 2 critical/security omissions)
**Impact on plan:** All fixes strengthen the planned persistence and authorization boundary. No schema expansion, external dependency, live Home Assistant target, network request, service call, publication, remote site, physical bus, or plant write was added.

## Issues Encountered

- The repository's full component directory intentionally still contains `EXPECTED_RED[missing-lifecycle-cleanup]` from Plan 01-02. Its supported fixture reached the declared unload leak and is owned by Plan 01-08; Plan 01-07 did not alter or repeatedly retry that separate RED gate.
- Home Assistant's installed test stack emits its existing aiohttp inheritance deprecation warning. It does not affect the focused transaction/store results.

## Verification

- `py -3.13 -m pytest tests/components/glt_flow_card/test_project_repository.py tests/components/glt_flow_card/test_project_transactions.py tests/components/glt_flow_card/test_websocket.py -q` - 19/19 split-store, transaction, and WebSocket tests passed.
- T-01 owner command with `-k "preview or selection or stale or closure"` - 3 passed, 8 deselected.
- T-02 owner command with `-k "rollback or receipt or identity"` - 2 passed, 9 deselected.
- T-06 owner command with `-k "interruption or recovery or journal or immutable"` - 5 passed, 4 deselected.
- Focused repository/transaction/WebSocket plus migration/diff regression suite - 26/26 passed.
- `npm test` - full Node suite passed 63/63.
- Explicit `py -3.13 -m py_compile` over every Companion Python module passed.
- `git diff --check` passed before the final production commit.

## TDD Gate Compliance

- Task 1 RED `1f4ad82` failed on absent split-store constants/module; GREEN `94f9c53` passed all independent-store, legacy import, retry, retention, and immutability cases.
- Task 2 RED `03b4068` failed on the absent transaction coordinator; GREEN `4510775` passed all authoritative preview/apply, concurrency, rollback, recovery, authorization, and redaction cases.
- No refactor-only commit was necessary.

## Known Stubs

None. Empty stores, selected-operation lists, preview caches, and recovery result lists are intentional initialized runtime collections or explicit unchanged/empty-selection evidence; they do not feed placeholder UI.

## Threat Flags

None. The new WebSocket and persistence surfaces are exactly the T-01/T-02/T-06 planned trust boundaries and are covered by their owner commands. No unplanned endpoint, network, service, file-extraction, remote-site, bus, or plant surface was introduced.

## Authentication Gates

None.

## User Setup Required

None - all verification used isolated Home Assistant fixtures and in-memory/temp Store doubles; no live Home Assistant, browser account, remote site, publication, physical bus, or plant access is required.

## Next Phase Readiness

- Plan 01-08 can bind the split repository/coordinator to resource-exact Config Entry lifetime and expose allowlisted recovery/store diagnostics.
- Plan 01-11 can implement its five-step Project safety UI using only preview ID, expected revision, selected stable IDs, snapshot ID, and typed rollback confirmation.
- Plan 01-12 can prove exact-artifact upgrade retains the legacy backup, migrated heads, snapshot history, and recovery evidence across supported Home Assistant lanes.

## Self-Check: PASSED

- All five created source/test artifacts and both modified integration artifacts exist on disk.
- TDD commits `1f4ad82`, `94f9c53`, `03b4068`, and `4510775` exist in repository history and are ordered RED before GREEN for each task.
- All three threat-owner commands, the combined 19-test plan gate, migration/diff regressions, full Node suite, Companion compilation, and diff check passed after the final production commit.
- The working tree contained only this summary before its summary commit; no generated distribution artifact, temporary test file, live-system state, or unrelated user file remained modified.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
