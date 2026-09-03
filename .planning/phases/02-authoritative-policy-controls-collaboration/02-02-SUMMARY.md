---
phase: 02-authoritative-policy-controls-collaboration
plan: 02
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
red_sentinels: [phase2-policy-matrix, phase2-access-revocation, phase2-evidence-pagination]
---

# Plan 02-02 Summary — Backend Authorization RED Contracts

## What was built

**Task 1 — deny-default command and principal behavior.**
`policy_contract.py` states the Phase-2 authorization contract as test-owned
data: the four fixed roles, the closed capability set, the role/capability
matrix, the Home Assistant administrator ceiling, the stable non-enumerating
error codes, and every declared route with its scope, capability, project field,
enumeration mode, lease/revision requirement and implementation state. Legacy
`projects/lock`, `projects/unlock`, `control/execute` and `audit/add` are
declared *retired*; the three `remote/*` routes are declared *deferred* — still
policy-declared, but allowed for nobody until Phase 9 (resolved A6).

`test_policy.py` verifies the contract's own consistency, then compares the
routes Home Assistant actually registered against the declared surface: an
undeclared registration and a declared-but-unregistered route both fail.
`test_policy_enumeration.py` supplies a schema-valid probe payload for every
route and owns the live route x principal probe.

**Task 2 — server-owned access and subscription revocation.**
`test_project_access.py` proves a stored project body that names itself an
admin grants nothing, and specifies the ACL repository contract: fresh projects
start at access revision 0 with no assignments; assigning advances the revision
by exactly one; legacy bootstrap never adopts a self-granted member; a stale
access revision and an unknown role are rejected; the last admin cannot be
removed. `test_policy_subscriptions.py` specifies per-event reauthorization: a
revoked subscriber gets one minimal sequenced `access_revoked` event and no
protected detail afterwards, events are strictly sequenced, no event may carry a
project body, candidate, token or member list, and unsubscribing releases the
registration.

**Task 3 — opaque scoped evidence pagination.**
`test_evidence_pagination.py` fixes the page contract at exactly 50 rows with no
total, offset or page number; the cursor must be an opaque high-entropy token
that does not decode to caller-readable state; replay across user, session,
project or filter must fail with `CursorInvalid`; and a runtime generation
change must invalidate every outstanding cursor (resolved A5).

## Verification

| Command | Result |
|---|---|
| `assert-red --expected=phase2-policy-matrix -- pytest test_policy.py test_policy_enumeration.py` | CONTROLLED_RED accepted |
| `assert-red --expected=phase2-access-revocation -- pytest test_project_access.py test_policy_subscriptions.py` | CONTROLLED_RED accepted |
| `assert-red --expected=phase2-evidence-pagination -- pytest test_evidence_pagination.py` | CONTROLLED_RED accepted |
| `pytest tests/components/glt_flow_card -q` | 111 passed, 3 named sentinels failed, 0 skipped |

## Decisions

- Each RED file carries exactly one product-completeness sentinel and collects
  every unmet guarantee as a *gap list*. The classifier requires exactly one
  named failure, so scattering assertions across many tests would make a
  controlled RED indistinguishable from a broken harness. The gap list keeps the
  full matrix in one failure and names each missing behavior individually.
- The route x principal probe lives in `test_policy_enumeration.py` and is
  consumed by the sentinel in `test_policy.py`, matching the registry's single
  declared sentinel node id for `phase2-policy-matrix`.
- `conftest.py` now reads the registered route name from Home Assistant's
  supported `_ws_command` attribute; the previous `schema.get("type")` lookup
  silently recorded function names, which would have let an undeclared route
  pass the registration oracle.

## Follow-ups

- `policy_contract.py` is a new shared test module that was not listed in the
  plan's `files_modified`; the matrix needed one place to state the contract.
