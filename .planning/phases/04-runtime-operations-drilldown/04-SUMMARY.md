---
phase: 04-runtime-operations-drilldown
status: complete
completed: 2026-09-02
requirements: [OPS-02, NAV-01]
threats_green: [T4-01, T4-02, T4-03, T4-04, T4-05, T4-06, T4-07, T4-08, T4-09, T4-10, T4-11, T4-12, T4-13]
threats_pending: [T4-14]
---

# Phase 4 Summary — Runtime Operations & Drill-Down

All seventeen plans are implemented. The Phase-4 sentinel gate reports **ten
implemented, zero controlled RED, zero broken**.

## What was built

**The panel is composed on the server** (04-05, 04-10). Every profiled object
opens the same ordered regions. The control list arrives filtered against this
principal's *current* capabilities, so a forbidden control is absent rather than
disabled — a disabled control still announces that the control exists. The
response carries no domain, service or target at all. The trend region renders a
declared `history_unavailable` state, because HIST-01 owns history and inventing
content here would duplicate an ownership the roadmap assigns to Phase 7.

**The view stream is resumable and bounded** (04-06, 04-12). Home Assistant's
websocket API supplies no sequence number and no replay, so gap detection is
ours. The snapshot and its sequence are read in one critical section with no
await between them; the client holds the sequence it expects and treats anything
else as a gap, going stale in one transition without interpolating. Snapshots
have their own budget because every condition that triggers a resync is one a
client controls.

**Navigation is server-resolved** (04-07, 04-08, 04-09). The address is the
whole view state and lives in the URL. Every resolve re-authorizes from scratch,
because a URL gets pasted into a chat and opened by somebody else. Malformed,
unknown, non-member and deferred-remote addresses answer identically. Counts are
summed from the already-filtered project set, and an authorized zero is reported
as no count at all.

**Outcomes stay apart** (04-11). All nine Phase-2 states render distinctly, only
`readback_confirmed` is success, and no state offers a retry.

**Surfaces and retirement** (04-13). Five elements ship in the generated
artifact, and the legacy operate path is retired the way Phase 2 retired
`control/execute`: declared, reachable, and proven inert.

**Lifecycle, docs and gate** (04-14, 04-15, 04-16, 04-17). Bilingual
documentation, a wiki page, and `tools/verify-phase4.mjs` with 22 gate mutation
tests.

## What the work taught

Four findings came out of the code rather than the plan.

1. **The threat model described an authority the product does not have.** The
   first operations corpus hid individual pieces of equipment inside one
   project. `AccessService.async_assign` takes `(project_id, user_id, role)` and
   has no object granularity, so within a project membership is uniform.
   Implementing per-object ACLs would have duplicated Phase 2's ownership. The
   corpus is now two projects, and T4-04 moved to where it actually bites: a
   portfolio total computed across every project and *then* filtered for display.

2. **The same lane-portability bug, twice.** The semantic parity test reached for
   `node` and `src/`; two commits later the corpus test reached for a top-level
   `test/` directory. Both pass locally and fail only in `ha-artifacts`. It now
   has a guard — `test_lane_portability.py` — rather than a third one-off fix.

3. **`if budget.last_at` skipped the snapshot throttle at monotonic zero.** A
   falsy `0.0` short-circuited the interval check. Found by the lifecycle test,
   not by review.

4. **German overflows 320px.** The exact-dist matrix caught a real responsive
   bug that English never would have.

## Verification

| Command | Result |
|---|---|
| `node tools/phase4-red-gate.mjs` | 10 implemented, 0 controlled RED, 0 broken |
| `node --test test/phase4-gate.test.mjs` | 22 passed |
| `node tools/run-unit-tests.mjs` | 214 passed, 0 failed, 0 skipped |
| `pytest tests/components/glt_flow_card -q` | 224 passed |
| `node tools/run-exact-dist-playwright.mjs` | 38 passed |
| `node tools/verify-docs-site.mjs` | 20 sources, byte-identical builds |
| `npm run validate:hacs-staging` | 4 PASS |

T4-01 through T4-13 were run at head and marked `verified`. T4-14 stays
`planned`: its owner needs a Docker engine this container does not have.
