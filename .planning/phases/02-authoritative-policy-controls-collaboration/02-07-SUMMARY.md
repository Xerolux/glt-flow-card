---
phase: 02-authoritative-policy-controls-collaboration
plan: 07
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-04, T2-05]
---

# Plan 02-07 Summary — Membership, Subscriptions and Cursors (GREEN)

## What was built

**Task 1 — server-owned membership administration.** Two new routes,
`access/get` and `access/set`. `access/get` returns only the minimal inventory
resolved A2 permits: the project id, who holds what, the access revision that
guards the next change, and the eligible users — no title, content, counts or
evidence. Eligible users come from Home Assistant's own user store and exclude
inactive and system-generated accounts, so a request can never introduce an
arbitrary identifier. `access/set` validates an *administration-purpose* lease
(never the engineering lease that guards content), refuses self-grant, refuses a
user Home Assistant does not know, and commits under an exact
`expected_access_revision`. Resolved A3 holds: the commit advances only the
access revision, and the content revision is untouched. A successful change
invalidates every lease bound to the previous access revision and publishes an
`access_changed` event.

The legacy bootstrap now runs only into an *empty* ACL. Once a project has
server-owned membership, its legacy `permissions` block is just content, and
adopting from it would be precisely the self-grant this store exists to prevent.

**Task 2 — per-event subscriptions.** `policy_sessions.SubscriptionRegistry`
caps a connection at eight subscriptions, assigns a monotonic sequence, and
re-authorizes on *every* emission rather than caching the decision that admitted
the subscription. A subscriber whose authority has gone receives one minimal
`access_revoked` event — type, project, sequence, reason — and nothing
afterwards. The runtime's authorization callback deliberately does not apply the
Home Assistant administrator ceiling: that ceiling grants membership recovery,
never project content, so it must not keep a subscription alive.

**Task 3 — scoped opaque cursors.** `policy_sessions.EvidenceCursorRegistry`
issues `token_urlsafe(32)` bearers, stores only their SHA-256 digest and matches
with `hmac.compare_digest`, pages at exactly 50 rows, expires after 300 idle
seconds on an injected clock, and enforces 32 cursors per connection and 256 per
integration with oldest-idle-first eviction. A cursor is bound to user, session,
project, filter and runtime generation; any mismatch raises `CursorInvalid`. The
page response carries `rows`, `cursor` and `has_more` and nothing else — a
total, offset or page number would each reveal rows the caller cannot see.

## Verification

| Command | Result |
|---|---|
| `pytest test_project_access.py -q -x` | 9 passed, including the live HA-admin bootstrap and the self-grant/stale-revision refusals |
| `pytest test_policy_subscriptions.py -q -x` | passed |
| `pytest test_evidence_pagination.py -q -x` | passed |
| `pytest tests/components/glt_flow_card -q` | 155 passed, 4 named sentinels RED |
| `npm run test:phase2` | 7 controlled RED, 5 implemented, 0 broken |

## Decisions

- **The cursor registry lives in `policy_sessions.py`, as plan 02-07 specifies.**
  The RED test written in 02-02 had looked for it in `trusted_evidence`; the
  plan is the specification, so the test was pointed at the real owner.
- **Bootstrap adopts legacy permissions only into an empty ACL.** That keeps an
  existing installation from being stranded with no members while making the
  self-grant case impossible, and it is what the RED contract actually asserts.
- **Subscription authorization ignores the HA administrator ceiling.** Content
  reads need `project.read`, which the ceiling does not grant; applying it here
  would let an unassigned administrator keep receiving project detail.

## Follow-ups

- 02-10 owns the trusted-evidence and telemetry stores that feed
  `EvidenceCursorRegistry.rows_for`; the registry takes the row source as a
  callable so the paging contract is already provable without them.
