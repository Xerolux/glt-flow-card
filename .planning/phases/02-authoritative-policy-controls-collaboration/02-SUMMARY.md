---
phase: 02-authoritative-policy-controls-collaboration
status: complete
completed: 2026-09-02
summary_written: 2026-09-03
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-01, T2-02, T2-03, T2-04, T2-05, T2-06, T2-07, T2-08, T2-09, T2-10, T2-11, T2-12, T2-13, T2-14, T2-15]
threats_pending: [T2-16]
---

# Phase 2 Summary — Authoritative Policy, Controls & Collaboration

> **Written at close-out**, from the 17 plan summaries, `02-VALIDATION.md` and
> the code at head — not at execution time. Phase 2 was the only phase from 2
> onward that closed without one.

All seventeen plans are implemented.

## What was built

**One deny-by-default boundary** (02-06). Authority comes from exactly two
places: the fixed role a server-owned ACL assigns, and the caller's own Home
Assistant authority. The effective set is their **intersection**, so a project
can never grant past Home Assistant and a Home Assistant administrator inherits
no project content — an unassigned HA admin gets membership repair and nothing
else, which is what keeps a project from being stranded without an admin
without turning every HA admin into a reader of every plant.

Every route is declared once in `COMMAND_POLICIES`. Registered-but-undeclared
and declared-but-unregistered are both policy holes and the tests compare the
two sets exactly. A route a later phase owns stays declared in a non-`active`
state: reachable by the boundary, unavailable to everyone.

The decision is made in the **synchronous** WebSocket callback rather than in a
scheduled coroutine. That is what makes "an unauthorized request never reaches a
handler" true rather than approximately true: there is no effect to undo.

**Membership, subscriptions and cursors** (02-07). Rows are filtered at the
source, before serialization, so an unauthorized project cannot influence a
page, a count or a cursor offset.

**Connection-bound exclusive leases** (02-08). The legacy user-only lock was a
row in a file; a lease is an opaque, rotated, connection-bound capability that
dies with its connection. A persisted lock therefore could not become a lease on
upgrade — nobody is holding it — so it was dropped rather than minted for
whoever the file named.

**The in-lock recheck** (02-09). Role, ACL, lease, revision, digest and policy
version are re-read **inside** the existing transaction's critical section. The
boundary check alone cannot see authority that changes mid-request.

**Trusted evidence and untrusted telemetry** (02-10). Two stores, two routes,
two result shapes, an explicit provenance label on each. Client-authored trusted
audit is retired: nothing a browser sends can be merged into the authoritative
record.

**Configured controls** (02-11). The caller no longer names a domain, service or
target. The server resolves one control id against the verified current head.
`control/execute` is retired.

**Browser authority** (02-12, 02-13). Authority loss is read-only in the same
render cycle, with no fallback to `callService`, local storage, Lovelace
mutation or a direct network call.

**Migration, lifecycle, artifacts, docs and the gate** (02-14 … 02-17).

## What the work taught

Legacy audit rows were **kept and labelled** rather than deleted. Throwing away
a site's history would be its own kind of dishonesty; labelling it says exactly
how much it can be trusted.

## Verification

`02-VALIDATION.md` records T2-01 through T2-15 as verified against their owner
commands. **T2-16 stays pending**: it needs `npm run test:phase2:release`, whose
HA artifact lanes need a Docker engine this container does not have.

## Correction at close-out

The 2026-09-03 review pass (`02-REVIEW.md`) found a **critical** defect this
phase's own matrix could not see: three routes declared `enumeration="filter"`
returned the rows of projects the caller cannot read — `work_orders/list`,
`reports/list` and, worst, `evidence/list`, which handed over the trusted audit
trail. It is the `alarms/list` leak of `9f53bcb` repeated, because that fix was
applied to the instance rather than to the class.

All three are fixed, and `test_filtered_route_authority.py` now closes the class
by deriving its route list from the policy contract and asserting rows rather
than response codes. That this phase shipped with the defect, and that the
finding is recorded here rather than quietly folded into the narrative above,
is the honest reading of what Phase 2 achieved: the boundary is right, and the
handlers behind it needed a guard the phase did not build.
