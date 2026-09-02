---
phase: 02-authoritative-policy-controls-collaboration
plan: 12
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-13]
---

# Plan 02-12 Summary — Browser Authority (GREEN)

## What was built

**Task 1 — the fail-closed reducer.** `src/v100/project-authority.mjs` holds a
pure, synchronous reducer. "Read-only in the same render cycle" is only provable
if the decision is a function of state, so nothing in the module awaits, times
out, or reads a clock: expiry is decided by the `now` carried on each action.
All ten authority-loss events — absent, loading, stale, rejected,
sequence-gapped, incompatible, role revoked, lease expired, lease lost,
Companion disconnected — produce a read-only shared mode with a distinct reason
in one transition, so a control can never stay enabled behind an error toast.
`sharedWritable` is a conjunction of the whole authority chain, so a new loss
event cannot accidentally leave an affordance enabled, and an unknown action
returns the state unchanged rather than widening what the browser believes.

The bearer lives in a closure inside `createProjectAuthorityClient`; only
`expires_in` and `purpose` reach the reducer, so no token, hidden project or
other user's identity can enter renderable or exportable state. Authority loss
never discards a dirty candidate — it marks it preserved in memory. Rows loaded
under an authority that is now doubted are cleared; a lost lease does not clear
them, because it never granted the read.

Renewal follows 02-13's contract: the prompt comes first at half the TTL
remaining, and automatic renewal is the later fallback at 40% that only a dirty
candidate earns. A clean idle lease is allowed to lapse, so one open browser
cannot hold the only editing lease indefinitely.

**Task 2 — the authority state bar and access surface.** Project safety keeps
its single trigger and its exact five tabs. `glt-flow-card-authority-bar` sits
between the scope banner and the tabs and is present on all of them, reading in
the order a user needs before acting. It is a custom element so its live regions
survive every re-render of the tabs beneath it; it uses bare `aria-live` regions
rather than a second `role="status"`/`role="alert"` pair, so the visible status
blocks stay unambiguous to a reader walking the dialog by role. A blocking
banner appears only for a genuine loss — "no lease yet" stays a chip, because
alerting on every read-only moment trains users to ignore the alert that
matters. When an authority change removes the focused action, focus moves to the
section heading.

Overview gains Shared authority, My access, Collaboration and Control policy.
The control count is *absent*, not redacted, for a user who may not read the
project, and Manage project access is absent rather than disabled. The access
surface offers only server-returned eligible users, exactly four fixed roles and
no capability checkbox anywhere; a change carries the exact access revision plus
an administration lease that is released immediately after, and the inventory is
reloaded rather than patched.

**Task 3 — separated evidence.** Evidence keeps the Phase-1 release cards and
adds two independent bordered sections with their own queries, cursors, empty
and stale states, and separate provenance-labelled exports. A failed next page
keeps the loaded rows and marks them stale rather than dropping history the user
was authorized to see. There is no combined total and no shared timeline.

## Deviation: the capability snapshot route

The Phase-2 UI contract requires one server snapshot of the caller's own
authority, and the exact-dist fixture has served `capabilities/get` since the
RED wave — but no such route was ever declared or registered, so plans 02-06 to
02-11 left the browser with no honest source for its snapshot. This plan adds
it: `glt_flow_card/capabilities/get`, carrying `project.read`, so an unassigned
caller gets the same opaque `not_found_or_denied` a hidden project gives and
learns nothing. It reports the asking user's own authority only.
`SubscriptionRegistry.sequence()` exposes the sequence the snapshot is
consistent with. The exact route count in the lifecycle ledger moved 36 → 37,
which is the registration oracle doing its job.

**Follow-up for 02-13/02-14:** the server does not yet return a role→capability
matrix, so `RoleMatrixDisclosure` renders its declared `unavailable` state. The
browser deliberately does not invent one — a client-side matrix would be exactly
the browser-derived authority this phase exists to prevent.

## Verification

| Command | Result |
|---|---|
| `node --test test/phase2-authority.test.mjs` | 5 passed, 0 failed |
| `node tools/run-exact-dist-playwright.mjs` | 28 passed; only `phase-2-ui` red (02-13 owns it) |
| `node tools/run-unit-tests.mjs` | 115 passed, 0 failed, 0 skipped |
| `pytest tests/components/glt_flow_card -q` | 165 passed |
| `npm run validate:hacs-staging` | 4 PASS |
| `node tools/phase2-red-gate.mjs` | 2 controlled RED, 10 implemented, 0 broken |

`phase2-authority-reducers` and `phase2-ui-fixture-seed` are GREEN. The gate key
`phase2-authority-reducers` still classifies as controlled RED because it runs
`test/phase2-collaboration.test.mjs` alongside it, and that sentinel belongs to
plan 02-13.

## Constraints honoured

No live Home Assistant write, no service call, no remote or physical-bus write,
no credential handling. No release is authorized. Every artifact was rebuilt
from the authored `src/v100/` modules; `dist/` and the Companion `www` copy are
generated outputs and byte-identical.
