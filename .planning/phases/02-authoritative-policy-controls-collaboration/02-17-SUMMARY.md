---
phase: 02-authoritative-policy-controls-collaboration
plan: 17
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-01, T2-02, T2-03, T2-04, T2-05, T2-06, T2-07, T2-08, T2-09, T2-10, T2-11, T2-12, T2-13, T2-14, T2-15]
threats_pending: [T2-16]
---

# Plan 02-17 Summary — The Phase-2 Gate

## What was built

**Task 1 — the orchestrator.** `tools/verify-phase2.mjs` answers one question:
is every Phase-2 requirement, roadmap truth, plan, threat and resolved
assumption bound, right now, to a command that actually ran, actually passed,
skipped nothing and asserted something? Missing, failed, skipped, zero-count,
stale, unmapped and orphan evidence each fail closed with their own message, and
the evidence manifest is written only after everything has passed, so a
half-finished run leaves nothing that could be mistaken for evidence.

It proves its own shape before running anything. The package/tool subprocess
graph must be acyclic, `test:phase2` must reach `test:phase2:release` by exactly
one path, and nothing reachable from that leaf may reach back into the
orchestrator — otherwise the gate could pass by running itself, which is the
most convincing kind of nothing.

Two extraction rules make that graph true rather than merely plausible. A
reference inside a comment or a sentence is advice, not an edge, so a tool that
documents its own CLI or tells a user what to run is not a cycle — this found
three real false positives. And the orchestrator declares the edges it takes
from the threat register, which no static read of its source could see.

`test/phase2-gate.test.mjs` seeds all four graph mutations the plan names — the
outer command calling itself, the leaf calling the outer command, a reachable
release helper calling back, two outer-to-leaf paths — plus eight evidence
mutations, against the pure functions with no command execution.

**Task 2 — release acceptance and the closed registers.** Release acceptance now
requires the Phase-1 gate's own evidence manifest and checks it was produced
against the same build manifest: a Phase-2 release resting on Phase-1
foundations nobody re-ran is resting on nothing. It still consumes the
manifest-hashed stage, never rebuilds, never publishes, and invokes neither
Phase-2 command. `release.yml` gained the Phase-1 gate and dropped its separate
`test:ha-artifacts` step, because the Phase-1 gate already runs those exact
lanes — that removes a second thirty-minute pass rather than adding one.

`node tools/build-site.mjs` was the gate's first honest casualty: it prints
nothing and asserts nothing, so the gate refused it as a run that proved
nothing. `tools/verify-docs-site.mjs` replaces it with the two properties that
matter — complete non-empty sources, byte-identical two-run builds — in pure
Node, and `docs.yml` now calls the same tool.

## Evidence status

**T2-01 through T2-15 are verified.** Each owner command was run at this head
and passed with non-skipped behavioral counts.

**T2-16 remains planned.** Its owner installs the exact stage on two
digest-pinned Home Assistant images, which needs a Docker engine. This execution
environment has none. The Phase-1 gate (F2-06) also cannot complete here: its
dependency-provenance step reaches package source metadata that the environment's
network policy answers with HTTP 403. Both are environment limits, not
repository defects, and both run in CI — `ha-artifacts` in `validate.yml` and the
full chain in `release.yml`. Marking T2-16 verified without running it is
precisely the failure the register exists to prevent, so it is not marked.

`npm run test:phase2` therefore reaches F2-05 here and fails closed at F2-06,
which is the gate behaving correctly rather than a defect to work around.

## Verification

| Command | Result |
|---|---|
| `node --test test/phase2-gate.test.mjs` | 22 passed |
| `node --test test/phase1-gate.test.mjs` | 7 passed |
| `node tools/run-unit-tests.mjs` | 147 passed, 0 failed, 0 skipped |
| `pytest tests/components/glt_flow_card -q` | 175 passed |
| `node tools/run-exact-dist-playwright.mjs` | 29 passed |
| `npm run validate:hacs-staging` | 4 PASS |
| `npm run verify:release` | double build, checked-in outputs, four mutation refusals, staged package identity |
| `node tools/verify-docs-site.mjs` | 19 sources, 41 site files byte-identical |
| Owner commands T2-01 … T2-15 | all pass |
| `npm run test:phase2` | graph verified, F2-01 … F2-05 pass, fails closed at F2-06 (no Docker, provenance endpoints blocked) |

## Constraints honoured

No publication, no live Home Assistant, remote site, fieldbus or plant contact,
no credential handling. No release is authorized.
