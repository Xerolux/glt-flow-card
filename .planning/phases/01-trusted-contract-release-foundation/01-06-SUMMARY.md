---
phase: 01-trusted-contract-release-foundation
plan: 06
subsystem: safe-project-bundles
tags: [zip-preflight, opaque-assets, deterministic-archives, crc-sha256, javascript-python-parity]

requires:
  - phase: 01-04
    provides: Raw-first project validation, canonical JSON, stable SHA-256 evidence, and shared archive limits
  - phase: 01-05
    provides: Exact-step migration to validated schema-v2 candidates
provides:
  - Complete ZIP32 central-directory preflight before any archive member is exposed or written
  - Stable JavaScript/Python rejection decisions for aliases, types, collisions, overlap, limits, CRC, hashes, manifests, references, and closure
  - Deterministic schema-v2 bundle writers with fixed metadata and byte-identical opaque assets
  - Controlled Companion extraction into a newly created contained transaction directory only after full verification
affects: [01-07-transactions, 01-11-project-safety, 01-13-release-acceptance]

tech-stack:
  added: []
  patterns: [central-directory-first preflight, verify-in-memory-before-exposure, canonical bundle closure, fixed ZIP metadata, opaque asset transport]

key-files:
  created:
    - src/v100/project-bundle.mjs
    - custom_components/glt_flow_card/project_bundle.py
    - test/v100-bundle.test.mjs
    - tests/components/glt_flow_card/test_project_bundle.py
  modified:
    - src/v100/core.mjs
    - src/v100/index.js
    - test/v100-core.test.mjs

key-decisions:
  - "Parse and validate raw ZIP32 central-directory and local-header structure before asking zip.js or Python zipfile to decompress any member."
  - "Verify every CRC, SHA-256 digest, canonical JSON document, project reference, manifest declaration, and archive member in memory before invoking exposure callbacks or creating a transaction directory."
  - "Use fixed 1980 timestamps, fixed ordering, canonical manifest/project bytes, sorted asset paths, and explicit store/deflate policy for deterministic writers."
  - "Treat asset bodies as opaque bytes and use zip.js's native entry with workers disabled so inspection cannot parse content or initiate runtime fetches."
  - "Make public bundle APIs asynchronous and update the authored browser handler to await and report safe import/export failures."

patterns-established:
  - "Bundle decision: {outcome, code, path, params} is byte-serializable and equivalent across JavaScript and Python."
  - "Archive import: central preflight -> bounded in-memory decompression/CRC -> canonical contract/hash/closure -> optional exposure or controlled transaction write."
  - "Bundle export: validate/migrate -> bind exact asset bytes and metadata -> canonicalize -> write fixed-order deterministic ZIP entries."

requirements-completed: [SCHEMA-01]

duration: 30min
completed: 2026-09-01
---

# Phase 01 Plan 06: Safe Cross-Runtime Project Bundles Summary

**Central-directory-first ZIP defense with deterministic schema-v2 archives, exact JavaScript/Python decisions, and opaque byte-preserving assets that are never parsed or executed**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-31T23:47:57Z
- **Completed:** 2026-09-01T00:17:32Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Closed T-04 with full archive-byte and central-directory bounds, NFC/forward-slash path normalization, absolute/drive/UNC/control/dot/traversal/backslash rejection, regular-file-only types, duplicate/case/prefix collision checks, local-record overlap checks, encryption/method restrictions, and count/compressed/expanded/asset/ratio limits.
- Added in-memory CRC and SHA-256 verification, canonical raw manifest/project enforcement, schema-v2 project validation, project/manifest identity matching, and exact project asset/manifest/archive member closure before any callback or filesystem write.
- Added deterministic JavaScript and Python writers that migrate validated input, enrich project asset evidence, sort assets by path, fix timestamps/order/attributes/compression, and produce repeatable bytes per runtime.
- Preserved SVG, HTML, script, and arbitrary binary assets byte-for-byte while active-content spies proved no DOM parsing, code execution, network fetch, Home Assistant service, remote-site, physical-bus, or plant effect.
- Replaced the unsafe synchronous core ZIP parser with safe asynchronous APIs and wired the authored browser import/export handlers to await them with user-visible failure handling.
- Added a Companion extraction API that creates its contained transaction directory only after complete preflight and verification, resolves every destination inside that new root, and removes partial transactions on write failure.

## Task Commits

Each TDD task was committed as a RED specification followed by GREEN implementation:

1. **Task 1 RED: Specify hostile archive rejection parity** - `3fa9e2f` (test)
2. **Task 1 GREEN: Reject unsafe archives before exposure** - `519af6d` (feat)
3. **Task 2 RED: Specify deterministic opaque bundle round trips** - `55f66dc` (test)
4. **Task 2 GREEN: Round-trip deterministic opaque project bundles** - `605f578` (feat)

## Files Created/Modified

- `src/v100/project-bundle.mjs` - Raw ZIP32 structure parser, bounded preflight, zip.js in-memory verification, canonical closure, stable decisions, and deterministic writer.
- `custom_components/glt_flow_card/project_bundle.py` - Equivalent Python inspection/writer, JSON-lines parity adapter, and controlled transaction extraction.
- `src/v100/core.mjs` - Safe asynchronous compatibility wrappers and public hardened bundle exports.
- `src/v100/index.js` - Awaited safe browser bundle import/export with error reporting.
- `test/v100-bundle.test.mjs` - Bounded hostile archives, zero-exposure assertions, deterministic metadata, active-content canaries, core compatibility, and cross-runtime exchange.
- `tests/components/glt_flow_card/test_project_bundle.py` - Python hostile, deterministic, opaque, and controlled-extraction behavior tests.
- `test/v100-core.test.mjs` - Migrated asynchronous safe-bundle compatibility regression.

## Decisions Made

- Used a small purpose-built ZIP32 structural parser in each runtime for security preflight, then the approved zip.js/Python standard readers only for bounded in-memory decompression and CRC verification. This avoids trusting extraction APIs to establish path safety or archive closure.
- Rejected ZIP64, multi-disk, prepended/appended, directory, symlink, special-file, and ambiguous local/central-header shapes because Phase-1 bundles fit comfortably inside canonical limits and gain no value from those representations.
- Required canonical JSON bytes with no whitespace variants for both `manifest.json` and `project.json`; content hashes therefore bind the exact bytes exchanged across runtimes.
- Sorted asset members by normalized path and fixed all writer-controlled metadata. Cross-runtime tests compare decisions, canonical project/manifest evidence, metadata, and opaque bytes while each runtime separately proves byte-deterministic archive output.
- Kept extraction and asset inspection separate: normal readers return verified copies of opaque bytes, while filesystem extraction is an explicit Python operation into a fresh transaction directory after full validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected hostile test archive mutations to target raw ZIP names and the intended project member**
- **Found during:** Task 1 GREEN
- **Issue:** Python `zipfile` normalizes backslashes and truncates NUL-containing names when writing fixtures, while the initial JavaScript CRC mutation matched `project.json` inside the manifest body instead of the second local header. The unreferenced-asset fixture also reused stale project size/hash evidence.
- **Fix:** Write same-length placeholders and patch raw local/central name bytes, select the second `project.json` occurrence, and recompute canonical project size/hash for the unreferenced case.
- **Files modified:** `test/v100-bundle.test.mjs`, `tests/components/glt_flow_card/test_project_bundle.py`
- **Verification:** All hostile cases now reach their intended stable error and keep exposure counters at zero.
- **Committed in:** `519af6d`

**2. [Rule 3 - Blocking] Removed zip.js runtime module fetches from opaque-content verification**
- **Found during:** Task 2 GREEN
- **Issue:** The default zip.js WASM codec loader attempted one internal `file:` fetch when the test replaced global `fetch`, obscuring the stronger requirement that bundle inspection perform zero network effects.
- **Fix:** Use the approved native zip.js entry with web workers disabled in implementation and metadata tests; deflate remains local and deterministic without any fetch.
- **Files modified:** `src/v100/project-bundle.mjs`, `test/v100-bundle.test.mjs`
- **Verification:** SVG/HTML/script canaries round-trip byte-identically with DOM, execution, and fetch counters at zero.
- **Committed in:** `605f578`

**3. [Rule 2 - Missing Critical] Updated existing browser and core callers for asynchronous safe bundle APIs**
- **Found during:** Task 2 GREEN
- **Issue:** Replacing the synchronous unsafe parser with bounded zip.js operations made the existing browser handlers and legacy core regression incorrect unless they awaited results and handled export rejection.
- **Fix:** Await safe bundle creation/import, preserve a project-only default plus an explicit asset-inclusive core result, and report export/import errors through the existing UI alert path.
- **Files modified:** `src/v100/core.mjs`, `src/v100/index.js`, `test/v100-core.test.mjs`
- **Verification:** Core compatibility test, source syntax, temporary ES2022 browser bundle, and full Node suite pass.
- **Committed in:** `605f578`

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical behavior, 1 Rule 3 blocker)
**Impact on plan:** The fixes corrected test targeting, prevented an internal codec fetch from weakening the opaque-content proof, and kept authored callers correct after the planned async security boundary. No schema, endpoint, publication, live Home Assistant, remote-site, physical-bus, or plant scope was added.

## Issues Encountered

- Context7 was unavailable in this runtime. The implementation used the already pinned `@zip.js/zip.js` 2.8.30 package's local official README/type declarations and Python 3.13 standard-library ZIP source for version-specific metadata, strictness, CRC, overlap, and writer options; no package was installed or substituted.
- Full bundle parity initially took about 66 seconds because three Python processes each loaded the test package. The parity test now sends three bounded JSON-lines requests through one process, reducing the bundle suite to about 34 seconds without weakening coverage.
- The shell safety layer rejected recursive temporary-directory cleanup. The browser bundle check instead wrote one explicit temporary artifact under `.planning/tmp`, verified it, and removed it with the repository edit tool; no temporary or untracked file remains.

## Verification

- `npm run test:bundle` - 10/10 hostile, closure, deterministic, opaque, core, and cross-runtime tests passed.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q -k "reject or limit or collision or traversal"` - 11 hostile/limit tests passed; 1 nonmatching test was deselected at the Task-1 gate.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q -k "roundtrip or opaque or deterministic"` - 2 deterministic/opaque tests passed; 13 nonmatching tests were deselected at the Task-2 gate.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q` - complete Python bundle suite passed 15/15, including controlled extraction.
- `npm test` - full Node suite passed 63/63.
- `npm run verify:contract:validators` and `npm run check` passed.
- `node --check` passed for `src/v100/project-bundle.mjs`, `src/v100/core.mjs`, and `src/v100/index.js`.
- Explicit `py -3.13 -m py_compile` over every `custom_components/glt_flow_card/*.py` module passed.
- Temporary esbuild IIFE of `src/v100/entry.js` targeting ES2022 built and passed `node --check`; the temporary output was removed.

## TDD Gate Compliance

- Task 1 RED `3fa9e2f` failed because both safe bundle modules were absent; GREEN `519af6d` passed exact T-04 rejection and decision-parity gates.
- Task 2 RED `55f66dc` failed because deterministic writer exports were absent; GREEN `605f578` passed deterministic round-trip, opaque canary, core compatibility, cross-runtime, and controlled-extraction gates.
- No refactor-only commit was necessary.

## Known Stubs

None. Empty asset/effect/exposure arrays are intentional assertions for bundles with no assets or rejected inputs; null accept-decision codes are a stable success representation.

## Threat Flags

None. The only new filesystem surface is the T-04-planned controlled extraction API: it is invoked explicitly, creates a fresh transaction directory after full verification, resolves all destinations inside it, opens members exclusively, and removes partial results on failure. No network, authentication, endpoint, service-call, remote-site, bus, or plant surface was introduced.

## Authentication Gates

None.

## User Setup Required

None - no external service, live Home Assistant, browser session, remote site, publication, physical bus, or plant access is required.

## Next Phase Readiness

- Plan 01-07 can accept only verified canonical project bytes and exact opaque assets from this module before server-side preview/apply recomputation.
- Plan 01-11 can inspect bundle metadata without rendering or parsing active custom assets, retaining T-05's zero-execution boundary.
- Plan 01-13 can package and release the authored bundle module through the existing generator while asserting generated-artifact equality.

## Self-Check: PASSED

- All authored modules and test files listed in this summary exist.
- TDD commits `3fa9e2f`, `519af6d`, `55f66dc`, and `605f578` are present in repository history.
- The summary exists at the canonical Plan 01-06 path.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
