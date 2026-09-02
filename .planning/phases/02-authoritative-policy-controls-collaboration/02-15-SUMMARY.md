---
phase: 02-authoritative-policy-controls-collaboration
plan: 15
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: []
---

# Plan 02-15 Summary — Exact Artifacts and HA Lanes

## What was built

**Task 1 — canonical build and packaging.** The packaging allowlists already
carried every Phase-2 Python module (fixed twice earlier in this branch, the
second time behind a drift guard that fails when an authored module is not
staged). The new browser modules reach `dist/` through the single canonical
esbuild entry, so they need no allowlist entry of their own; the double-build
and checked-in-output comparisons in `verify:release` already prove they are
byte-identical. CI remains read-only, full-SHA and build-once: `ha-artifacts`
downloads the exact stage `validate` produced rather than rebuilding one.

**Task 2 — the lanes prove what they claim.** Two real gaps:

- The lanes ran the suite but never checked *how much* of it ran. A lane that
  collects almost nothing because an import quietly failed exits 0 and looks
  like success, which defeats the point of running the matrix on a second HA
  version at all. `assertCompleteRun` reads the pytest summary and fails on a
  short run, on any skip and on any deselect. The floor sits well below the
  current suite size so it catches a collapsed run, not a stale count.
- The lanes ran with the pytest cache provider enabled. The container is root
  and the workspace is a bind mount, so the `.pytest_cache` it wrote was
  root-owned on the host and workspace cleanup failed with `EACCES` after any
  failure — the exact symptom seen earlier on this branch. Nothing in the lane
  needs the cache, so it is switched off.

`verify:release` now consumes the staged packages instead of ignoring them: it
compares every staged artifact copied verbatim from the repository against the
bytes it has just verified, so a stale stage cannot ship behind a green
preflight. It still never stages — re-staging there would only prove the stager
is self-consistent — so both release workflows stage first and verify after.

`validate:hacs-staging`, `test:ha-artifacts` and `verify:release` remain
non-recursive leaves: none invokes `test:phase2` or the phase gate. Plan 02-17
alone aggregates them.

## Verification

| Command | Result |
|---|---|
| `npm run build` | 16 validated outputs |
| `node tools/run-unit-tests.mjs` | 125 passed, 0 failed, 0 skipped |
| `pytest tests/components/glt_flow_card -q` | 175 passed |
| `npm run validate:hacs-staging` | 4 PASS |
| `npm run verify:release` | double build, checked-in outputs, four mutation refusals, staged package identity (29 files) |
| `npm run test:ha-artifacts` | **not runnable here** — no Docker daemon in this container; it runs in the `ha-artifacts` CI job |

The two HA lanes are the one gate that cannot be executed locally in this
environment. The changes above are exercised by CI on this branch.

## Constraints honoured

No credential, public endpoint or live target introduced. No release is
authorized. No live Home Assistant, remote site, fieldbus or plant service is
contacted.
