---
phase: 02-authoritative-policy-controls-collaboration
plan: 06
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-01, T2-02, T2-03]
---

# Plan 02-06 Summary — Deny-Default Policy Boundary (GREEN)

## What was built

**Task 1 — the immutable capability and command policy contract.**
`custom_components/glt_flow_card/policy.py` declares the fixed roles, the closed
capability set, the role/capability matrix, the Home Assistant administrator
ceiling, the stable public error codes, and `COMMAND_POLICIES`: every registered
route with its scope, capability, project-field source, enumeration mode,
lease/revision requirement, rate class and implementation state. `RoutePolicy`
validates itself at import, so an unknown scope, capability, enumeration mode or
a lease-guarded route without a revision cannot be declared at all.

`PolicyCoordinator` derives the actor only from `connection.user` — a request
that carries `user_id`, `actor`, `role` or `at` contributes nothing — and
intersects the server-owned role with the Home Assistant ceiling. Retired and
deferred routes fail closed with `feature_unavailable`, which keeps the legacy
locks, the caller-selected `control/execute`, client-authored `audit/add` and
all three remote routes declared and inert (resolved A6).

**Task 2 — server-owned access and authorized reads.**
`custom_components/glt_flow_card/project_access.py` is a separate versioned
store with defensive copies, read-back verification, a monotonic access
revision, a 512-member bound, a last-admin guard, and a one-time conservative
bootstrap from a verified active head. The legacy mapping is deliberately lossy
downward — a designer becomes an engineer, never an admin.
`_guard_command` now authorizes *before* the handler runs, `projects/list`
filters at the source, `projects/get` answers missing and unauthorized
identically, and the legacy content-derived `_project_role` checks are gone from
the alarm, work-order, report and template handlers.

## Verification

| Command | Result |
|---|---|
| `pytest test_policy.py test_policy_enumeration.py -q` | 10 passed — the full route x principal matrix is GREEN |
| `pytest tests/components/glt_flow_card -q` | 147 passed, 7 named sentinels still RED |
| `npm test` | 122 passed, 2 named reducer sentinels RED |
| `npm run test:phase2` | 11 controlled RED, 1 implemented, 0 broken |

## Decisions

- **Authorization is synchronous.** Home Assistant dispatches WebSocket commands
  through a synchronous callback. Deciding there, rather than inside the
  scheduled handler coroutine, is what guarantees an unauthorized request never
  reaches a handler and so can have no effect to undo. Membership is held in
  memory and only written through `_persist`, so a read needs no I/O.
- **A filtered collection is reachable by everyone authenticated.** Refusing the
  call outright would itself reveal that rows exist. Every `filter` route
  returns an empty result instead, and the probe checks the row filtering
  separately.
- **Component-wide surfaces use the union of a principal's project capabilities.**
  Templates and the component evidence list belong to no single project, so
  authority for them is what the principal already holds somewhere. A user with
  no assignment anywhere still holds nothing.
- **`projects/save` resolves its project through a dotted field**, because the
  legacy route carries the id inside the document rather than beside it. No
  other part of the message may name the project.
- **Shared mutations return `lease_required` until 02-08 lands.** A write with
  no lease evidence is exactly what COLLAB-01 forbids, so the routes are
  unreachable rather than unguarded in the meantime. `test_websocket.py` now
  asserts that fail-closed contract; 02-09 restores the full guarded flow.

## Follow-ups for later plans

- 02-07 owns `policy_sessions` (subscriptions, cursors) and the ACL write route.
- 02-08 owns `project_leases`, which flips the `lease_required` gate to a real
  lease check.
- 02-09 owns the in-lock `MutationGuard` and the merge module.
