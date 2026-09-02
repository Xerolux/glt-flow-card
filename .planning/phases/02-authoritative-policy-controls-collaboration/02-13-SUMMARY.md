---
phase: 02-authoritative-policy-controls-collaboration
plan: 13
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-13, T2-14]
---

# Plan 02-13 Summary — Collaboration and Configured Controls (GREEN)

## What was built

**Task 1 — the collaboration and control state machines.**
`src/v100/project-collaboration.mjs` keeps a candidate through every recoverable
failure: lease expiry, lease loss, disconnect, conflict, role revocation, a
failed merge, an overlap block and a stale authority all mark it `preserved`
rather than clearing it. Only `commit/confirmed` with an authoritative receipt
or an explicit `candidate/discarded` clears one, and an unknown action returns
the state unchanged so a stray server event cannot throw work away.

There is no bearer in the module at all. The lease lives in the authority
client's closure and goes straight to the server on each request, so
collaboration state cannot leak a token it never receives — a stronger property
than storing one carefully would be. Conflict recovery offers refresh, merge
preview, retry with a fresh lease and discard; `overwrite` and `force` are
absent because a user shown an overwrite button will eventually press it, and an
exact expected revision exists so that nobody has to. The merge closure is read
from the server's own preview, so a browser that misunderstands the schema
cannot drop a dependency.

`src/v100/configured-control.mjs` has no retry entry point of any kind.
`readback_confirmed` is the only state presentable as a completed action:
`accepted` means the server wrote it down, `dispatched` means Home Assistant was
asked, and calling either a success is exactly the lie the list exists to
prevent. A result string the contract does not name becomes `result_unknown`
instead of being rendered verbatim into a safety-critical status line, and
server-owned fields are stripped from the request body before it is assembled.

**Task 2 — lease bar and conflict recovery.** Migrate & compare keeps every
Phase-1 validation, diff and backup prerequisite and gains
`glt-flow-card-lease-control` (lease state, expiry countdown, candidate chip,
base/current/candidate revision triplet, acquire/renew/release/discard) and
`glt-flow-card-conflict-recovery`. A viewer or operator sees no disabled lease
button: an affordance they can never use is only a way to make them feel
refused. A lease held elsewhere is anonymous.

**Task 3 — the control primitive.** `glt-flow-card-control-confirm` renders the
server's own normalized effect summary read-only. No domain, service or target
field exists in the DOM to edit or smuggle; the safe choice takes initial focus;
no result state offers a retry, and a timed-out or unknown result directs the
user to the current state and the trusted audit.

The two evidence streams became one `glt-flow-card-evidence-view` element used
twice with different props, which makes "they never share a filter, a cursor, a
total or a style" structural rather than a convention. All five surface elements
take their whole input in a single `props` assignment and repaint once, so a
half-updated surface — new revision, old lease — cannot be shown even for one
frame.

**Regression signal restored.** `PHASE_GATE_SUITES` in `tools/run-unit-tests.mjs`
is now empty: both Phase-2 browser sentinels are green, so they belong in
`npm test` as ordinary regression tests.

## Verification

| Command | Result |
|---|---|
| `node --test test/phase2-collaboration.test.mjs` | 5 passed |
| `node tools/run-exact-dist-playwright.mjs` | 29 passed, 0 failed |
| `node tools/run-unit-tests.mjs` | 125 passed, 0 failed, 0 skipped |
| `pytest tests/components/glt_flow_card -q` | 165 passed |
| `npm run validate:hacs-staging` | 4 PASS |
| `node tools/phase2-red-gate.mjs` | **12 implemented, 0 controlled RED, 0 broken** |

## Constraints honoured

No live Home Assistant write, no service call, no remote or physical-bus write,
no credential handling. No release is authorized. Every artifact was rebuilt
from the authored `src/v100/` modules; `dist/` and the Companion `www` copy are
byte-identical.
