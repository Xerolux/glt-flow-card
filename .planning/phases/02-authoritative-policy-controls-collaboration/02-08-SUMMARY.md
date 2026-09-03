---
phase: 02-authoritative-policy-controls-collaboration
plan: 08
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-10]
---

# Plan 02-08 Summary — Connection-Bound Exclusive Leases (GREEN)

## What was built

**Task 1 — the opaque lease algorithm.** `project_leases.py` implements
`LeaseRegistry` with `secrets.token_urlsafe(32)` bearers, a stored SHA-256
digest compared with `hmac.compare_digest`, an injected monotonic clock and
token factory, a default TTL of 300 seconds within a closed 60-900 range, one
lease per project, and binding to project, user, session, purpose, access
revision and runtime generation. Renewal rotates the bearer and kills the
previous one immediately. Expiry is decided by the clock alone, with no grace
period. Lease operations are capped at 30 per user per project per minute.
Nothing is persisted, `diagnostics()` returns counts only, and `held_state()`
reports that a project is being edited without ever saying by whom.

**Task 2 — the lease endpoints and runtime cleanup.** Four routes replace the
legacy locks: `leases/acquire`, `leases/renew`, `leases/release` and
`leases/status`. `projects/lock` and `projects/unlock` stay registered as
retired stubs so an old card gets a stable `feature_unavailable` rather than an
unknown-command error, and so nobody can mistake a persisted user-only lock for
a write guard. Every lease-guarded route now takes a required `lease_token`, and
the policy boundary validates the bearer against the live connection *before*
the handler runs. `CompanionRuntime.async_invalidate` bumps the generation, so
no bearer issued before an unload can be replayed against the next setup.

## Verification

| Command | Result |
|---|---|
| `pytest test_project_leases.py -q -x` | 7 passed — including the live acquire/renew/release lifecycle |
| `pytest test_project_leases.py test_policy.py -q -x` | 13 passed |
| `pytest tests/components/glt_flow_card -q` | 150 passed, 7 named sentinels RED |
| `npm run test:phase2` | 10 controlled RED, 2 implemented, 0 broken |

## Decisions

- **`any_of` admission.** A lease endpoint serves two different capabilities —
  engineering and membership recovery — so `RoutePolicy` gained an `any_of` set
  that governs *admission* while the route makes the precise per-purpose
  decision itself. Without it an unassigned Home Assistant administrator could
  never reach the one endpoint that exists to un-strand a project.
- **`lease_held` is a stable code.** It says a lease exists and nothing more, so
  it is safe to publish and belongs in the non-enumerating set.
- **The bearer is validated at the boundary, not in the handler.** The guard
  already had the connection identity and the decision; checking there means a
  forged or stale bearer never reaches transaction code.
- **`projects/save` lost its content-derived role check.** Policy decides, and
  a second check derived from the project body is exactly the seam Phase 2
  exists to remove.

## Follow-ups

- 02-09 adds the in-lock `MutationGuard`, which re-validates the same lease
  immediately before the PREPARED journal is written. The boundary check is
  necessary but not sufficient: authority can still change between the two.
