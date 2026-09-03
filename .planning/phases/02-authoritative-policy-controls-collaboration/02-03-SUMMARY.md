---
phase: 02-authoritative-policy-controls-collaboration
plan: 03
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
red_sentinels: [phase2-leases, phase2-collaboration-guard, phase2-merge]
---

# Plan 02-03 Summary — Lease, Guard and Merge RED Contracts

## What was built

**Task 1 — connection-bound exclusive lease lifecycle.**
`test_project_leases.py` fixes the TTL range at 60-900 seconds (the legacy
30-3600 lock range is deliberately not carried over), names the six binding
dimensions a token must be checked against (project, user, session, purpose,
access revision, runtime generation), and forbids owner or token detail in a
denial. The sentinel drives a `LeaseRegistry` through a manually advanced clock:
out-of-range TTLs are rejected; a second connection of the same user and a
second engineer both lose exclusivity; each binding dimension invalidates the
token; renewal rotates the bearer and kills the previous one; expiry is exact
with no grace period; releasing a session and changing the runtime generation
both drop the lease; and no token may appear in diagnostics output.

**Task 2 — immediate-precommit collaboration guard.**
`test_collaboration.py` derives the shared-mutation route set from the policy
manifest, so no route can be omitted, and asserts that every lease-requiring
route also requires an exact revision. It names the six guard inputs that must
be re-read inside the coordinator lock and keeps the content and access revision
streams separate (resolved A3). The sentinel requires a `MutationGuard`
carrying all six inputs, a coordinator that accepts an in-lock guard, and a
`compatibility_save` with no optional-revision fallback and explicit lease
evidence.

**Task 3 — bounded three-way merge and retry recovery.**
`test_merge.py` fixes the conflict evidence at base/current/candidate revisions
bounded to 100 operations and 256 KiB with explicit truncation, and excludes
`overwrite` and `last_writer_wins` from the possible outcomes. Fixtures model a
real non-overlap (two engineers editing different equipment) and a real overlap,
and a supporting test proves the Phase-1 semantic diff already supplies the
stable operation ids merge selection reuses. The sentinel requires a
`project_merge.compute_merge_preview` that returns all three revisions, applies
a non-overlapping selection, blocks an overlapping one, and reports the
candidate as preserved.

## Verification

| Command | Result |
|---|---|
| `assert-red --expected=phase2-leases -- pytest test_project_leases.py` | CONTROLLED_RED accepted |
| `assert-red --expected=phase2-collaboration-guard -- pytest test_collaboration.py` | CONTROLLED_RED accepted |
| `assert-red --expected=phase2-merge -- pytest test_merge.py` | CONTROLLED_RED accepted |

## Decisions

- Lease tests drive the registry directly through an injected manual clock
  rather than through wall-clock sleeps, so expiry evidence is deterministic and
  the just-before / exactly-at / just-after boundaries are all provable.
- The shared-save seam test asserts only that the seam stays inspectable and
  takes a revision parameter. Asserting the *pre*-Phase-2 signature would turn
  the GREEN plan into a test edit; the sentinel owns the real assertion, so it
  can never pass by looking at nothing.
- Merge fixtures use the schema-valid `type` key for equipment, which the
  Phase-1 project contract requires; the diff would otherwise reject the
  document before any merge behavior was exercised.
