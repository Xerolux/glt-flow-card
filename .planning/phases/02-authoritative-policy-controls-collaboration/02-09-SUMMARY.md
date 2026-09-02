---
phase: 02-authoritative-policy-controls-collaboration
plan: 09
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-11, T2-12]
---

# Plan 02-09 Summary — In-Lock Guard and Bounded Merge (GREEN)

## What was built

**Task 1 — one immediate-precommit guard for every mutation.**
`ProjectTransactionCoordinator.set_mutation_guard` installs a callback the
coordinator invokes *inside its own lock*, after the candidate is computed and
immediately before the PREPARED journal — the last point at which nothing
durable exists yet. `MutationGuard` carries the project, actor, session,
purpose, effective capability, access revision, lease bearer, content revision,
digest and policy version; the runtime's `recheck_before_commit` re-reads the
ACL and the lease registry and refuses with `authority_stale`,
`capability_denied` or `lease_expired`.

`compatibility_save` lost its optional-revision fallback: a shared save that
does not name the revision it replaces is a lost update waiting to happen. Every
content-derived `_require_project_role` check is gone from the mutation
handlers — policy decided at the boundary, and the guard decides again at the
commit.

**Task 2 — bounded server-recomputed three-way merge.** `project_merge.py`
recomputes the semantic diff twice from server documents: base against the
current head (what the other writer did) and base against the candidate (what
this engineer did). Operations touching a path the other writer changed are
*overlapping* and can never be selected; the rest are selectable.
`resolve_merge_selection` expands a selection through the Phase-1 dependency
closure and refuses if a required dependency overlaps, so a caller cannot apply
half a change. Evidence is capped at 100 operations and 256 KiB with explicit
truncation, `overwrite` is not an outcome, and every response says
`candidate_preserved: true` — the backend never stores the candidate, which is
what lets the browser keep it through any failure.

## Verification

| Command | Result |
|---|---|
| `pytest test_collaboration.py test_project_access.py test_project_transactions.py -q -x` | 44 passed |
| `pytest test_merge.py -q -x` | 5 passed |
| `pytest tests/components/glt_flow_card -q` | 159 passed, 2 named sentinels RED |
| `npm run test:phase2` | 5 controlled RED, 7 implemented, 0 broken |

## Decisions

- **The race is proven, not asserted.** `test_authority_lost_between_
  authorization_and_commit_is_refused` admits the mutation through the guard
  while the engineer holds the role, revokes the role, and shows the same
  evidence is then refused with nothing written. That is the concrete
  demonstration that a boundary check alone is insufficient, which is the entire
  reason T2-11 exists.
- **Every declared mutation route is checked as a set.** The second new test
  derives the route list from the policy manifest rather than hard-coding it, so
  a future route that forgets its guard fails here rather than shipping.
- **Merge overlap is decided by path, not by value.** Two writers editing the
  same path is a conflict even when the values happen to agree: treating equal
  values as mergeable would silently drop one engineer's intent.

## Follow-ups

- Plan 02-11 owns the configured-control execution path; `phase2-configured-
  controls` and `phase2-control-evidence` remain the two backend sentinels.
