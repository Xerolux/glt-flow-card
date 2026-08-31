---
phase: 01-trusted-contract-release-foundation
plan: 04
subsystem: project-contract
tags: [json-schema-2020-12, ajv-standalone, python-jsonschema, canonical-json, raw-preflight, parity]

requires:
  - phase: 01-03
    provides: Canonical versioned schemas, shared limits, semantic reference policy, and deterministic fixture corpus
provides:
  - Raw-first JavaScript project evidence with bounded stable diagnostics and canonical SHA-256
  - Deterministic standalone Ajv validators with schema and limits fingerprints
  - Repository-local Python Draft 2020-12 adapter with byte-identical evidence
  - Isolated 64-fixture JavaScript/Python parity runner and T-03 owner evidence
affects: [01-05-migrations-diff, 01-06-safe-bundles, 01-07-transactions, 01-11-project-safety, 01-13-release-acceptance]

tech-stack:
  added: []
  patterns: [raw-before-schema preflight, standalone generated validators, repository-only schema registry, sorted canonical JSON, isolated JSON-lines parity]

key-files:
  created:
    - src/v100/project-contract.mjs
    - src/v100/generated/project-validators.mjs
    - tools/generate-project-validators.mjs
    - custom_components/glt_flow_card/project_contract.py
    - test/v100-contract.test.mjs
    - tests/components/glt_flow_card/test_project_contract.py
    - tools/compare-contract-runtimes.mjs
  modified:
    - package.json
    - tools/generate-contract-fixtures.mjs
    - test/contract-fixtures.test.mjs
    - test/fixtures/contracts/manifest.json

key-decisions:
  - "Measure raw bytes before decoding and all tree, string, identifier, path, node, depth, and collection evidence before schema validation in both runtimes."
  - "Generate CSP-compatible Ajv validators at build time and prove freshness from repository-owned schema and limits fingerprints."
  - "Use sorted-key UTF-8 canonical JSON with semantic array order preserved and compare isolated runtime JSON-lines byte-for-byte."
  - "Build the Python validator registry only from the four canonical repository schemas so unknown refs fail closed without retrieval."

patterns-established:
  - "Contract evidence DTO: {valid, errors, schema_version, canonical, digest, limits} is stable and fully serializable."
  - "Stable errors relocate required properties to their RFC 6901 pointer, sort by path/code/params, cap at 100, and include an explicit overflow sentinel."
  - "T-03 fixtures remain correctness evidence only; no capacity or performance claim is inferred from 100/500/2,000-object cases."

requirements-completed: [SCHEMA-01]

duration: 19min
completed: 2026-09-01
---

# Phase 01 Plan 04: Raw-First Cross-Runtime Contract Summary

**Bounded raw project validation with generated Ajv validators, repository-local Python Draft 2020-12 evaluation, sorted canonical SHA-256 evidence, and byte-identical parity across all 64 shared fixtures**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-31T23:02:09Z
- **Completed:** 2026-08-31T23:21:38Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Enforced the 5 MiB byte limit before UTF-8 decoding/JSON parsing and iteratively measured depth, nodes, collection size, string bytes, ID characters, and path characters before schema validation, migration, defaults, or normalization.
- Generated standalone Ajv Draft 2020-12 validators from exactly the three project schemas and bundle manifest, with deterministic full-output and embedded fingerprint drift checks.
- Normalized Ajv and Python `jsonschema` failures into stable `{code,path,params}` issues, relocated required properties to their offending pointers, sorted deterministically, and capped evidence at 100 entries.
- Added sorted-key canonical JSON and SHA-256 implementations that preserve array order, reject non-JSON values, and do not mutate caller data.
- Proved exact JavaScript/Python JSON-lines bytes for every golden, malformed, raw-trap, reference, hostile, boundary, archive-metadata, and 100/500/2,000 correctness fixture in separate processes.
- Closed the T-03 owner command with focused raw oversized/deep tests in both runtimes and no live Home Assistant, network retrieval, remote-site, service, bus, or plant effects.

## Task Commits

Each TDD task was committed as a RED specification followed by GREEN implementation:

1. **Task 1 RED: Specify bounded JavaScript contract evidence** - `fec5ef0` (test)
2. **Task 1 GREEN: Implement bounded JavaScript contract evidence** - `5a6f724` (feat)
3. **Task 2 RED: Specify Python contract parity** - `0356084` (test)
4. **Task 2 GREEN: Implement exact Python contract parity** - `82dae35` (feat)

## Files Created/Modified

- `src/v100/project-contract.mjs` - Browser-safe raw preflight, stable validation/reference evidence, canonical JSON, and synchronous SHA-256.
- `src/v100/generated/project-validators.mjs` - Generated standalone Ajv validators plus canonical schema and limit fingerprints.
- `tools/generate-project-validators.mjs` - Deterministic standalone-code producer and stale-output checker.
- `custom_components/glt_flow_card/project_contract.py` - Equivalent Python preflight, local registry, schema/reference validation, canonicalization, digest, and JSON-lines adapter.
- `tools/compare-contract-runtimes.mjs` - Bounded temporary-corpus runner that compares isolated Node/Python output bytes and complete DTOs.
- `test/v100-contract.test.mjs` - JS boundary, canonical, corpus, drift, immutability, stable order/cap, and T-03 tests.
- `tests/components/glt_flow_card/test_project_contract.py` - Python canonical, local-registry, raw-limit, stable-error, reference, and immutability tests.
- `package.json` - Focused generated-validator build/freshness scripts alongside existing contract parity scripts.
- `tools/generate-contract-fixtures.mjs`, `test/contract-fixtures.test.mjs`, `test/fixtures/contracts/manifest.json` - Correct canonical digest evidence independent of source formatting.

## Decisions Made

- Kept raw input and canonical evidence separate: original byte count governs the pre-parse limit, while the accepted document digest always covers sorted-key canonical UTF-8 bytes.
- Used a pure ES2022 SHA-256 implementation in the authored browser module instead of importing Node crypto or making the synchronous contract API browser-incompatible.
- Adapted Ajv's one generated CommonJS runtime-helper binding into a deterministic ESM import so the committed `.mjs` output works in Node and future browser bundling.
- Configured Python's immutable `referencing.Registry` without a retrieval callback; every canonical `$ref` resolves from the in-memory repository set and unknown refs raise `NoSuchResource`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected fixture canonical hashes that covered source formatting**
- **Found during:** Task 1 GREEN
- **Issue:** The existing manifest labeled each accepted fixture body SHA as `canonical_sha256`, so pretty/compact source formatting changed the purported canonical digest.
- **Fix:** Canonicalized the parsed fixture with sorted object keys and preserved array order before calculating the expected canonical SHA-256; retained the independent raw body digest unchanged.
- **Files modified:** `tools/generate-contract-fixtures.mjs`, `test/contract-fixtures.test.mjs`, `test/fixtures/contracts/manifest.json`
- **Verification:** `npm run test:fixtures` passes 9/9 and separate fixture generations remain byte-identical.
- **Committed in:** `5a6f724`

---

**Total deviations:** 1 auto-fixed bug
**Impact on plan:** The correction makes the pre-existing fixture evidence match the plan's canonical serialization contract without changing raw fixture bodies, schemas, limits, or evidence scope.

## Issues Encountered

- Ajv standalone ESM output retained one CommonJS `require` for its UCS-2 length helper. The deterministic generator replaces that exact generated binding with an equivalent ESM import, and the full generated file is drift-checked.
- On Windows, the Home Assistant pytest plugin's socket guard blocked the asyncio loopback self-pipe. The focused test module explicitly enables socket construction while the existing conftest immediately restricts connections to `127.0.0.1`/`localhost`; contract schemas still have no retrieval callback and tests perform no network access.
- Python stdout initially used the Windows code page for a golden Unicode middle dot. The isolated comparator now forces UTF-8 and the adapter fixes `\n` JSON-lines, allowing a literal byte comparison before DTO comparison.

## Verification

- `npm run test:contract:js` - 9/9 raw-limit, canonical, stable-diagnostic, corpus, immutability, schema-drift, and seeded comparator-drift tests passed.
- `npm run test:contract:parity` - byte-identical JavaScript/Python evidence passed for all 64 fixtures.
- Exact T-03 owner command - parity plus focused JS and Python oversized/deep checks passed (1 JS; 2 Python, 8 deselected).
- `npm test` - full Node suite passed 41/41.
- `npm run test:fixtures` - canonical fixture contract passed 9/9.
- `npm run check` - distribution syntax check passed.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_project_contract.py -q` - Python contract suite passed 10/10 with one upstream Home Assistant deprecation warning.
- `py -3.13 -m py_compile` over all Companion Python modules passed.
- `npm run verify:contract:validators` passed with current canonical schema/limits fingerprints.

## TDD Gate Compliance

- Task 1 RED `fec5ef0` failed on the absent JavaScript adapter; GREEN `5a6f724` made all focused JavaScript and fixture evidence tests pass.
- Task 2 RED `0356084` failed on the absent Python adapter; GREEN `82dae35` made Python tests, full corpus parity, seeded drift, and exact T-03 checks pass.
- No refactor-only commit was necessary.

## Known Stubs

None. Null evidence fields are intentional fail-closed output when raw preflight prevents parsing/canonicalization; empty error arrays represent valid evidence.

## Threat Flags

None. The planned Python schema-file access is repository-local and uses an in-memory no-retrieval registry; no endpoint, authentication path, persistence schema, remote access, or active-content surface was introduced.

## Authentication Gates

None.

## User Setup Required

None - no external service, live Home Assistant, browser session, remote site, physical bus, or plant access is required.

## Next Phase Readiness

- Plan 01-05 can reuse canonical bytes/digests, stable errors, version selection, and reference checks for pure sequential migration receipts and semantic diffs.
- Plan 01-06 can reuse the generated bundle validator and shared archive metadata corpus while adding archive-specific preflight.
- T-03 is verified by its exact owner command; 100/500/2,000 inputs remain correctness-only evidence and Phase 10 still owns measured capacity claims.

## Self-Check: PASSED

- All seven planned created artifacts and all four modified support artifacts exist.
- All four TDD commits exist in order: `fec5ef0`, `5a6f724`, `0356084`, `82dae35`.
- Full Node, fixture, parity, focused T-03, Python contract, Python compilation, distribution syntax, and generated drift checks passed after the final production commit.
- No generated fixture body, network fetch, endpoint, auth path, store mutation, publication, live Home Assistant call, remote-site call, physical-bus write, or plant write was introduced.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
