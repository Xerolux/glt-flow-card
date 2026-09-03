---
phase: 01-trusted-contract-release-foundation
verified: 2026-09-03
head: 06cfd55
source_review: .planning/phases/01-trusted-contract-release-foundation/01-REVIEW.md
source_fix: .planning/phases/01-trusted-contract-release-foundation/01-REVIEW-FIX.md
findings_in_scope: 14
open_at_head: 0
status: verified
---

# Phase 01: Consolidated review verification

`01-REVIEW.md` was written at `76af1b2` and closes with
`status: issues_found` — one BLOCKER, iteration-4 CR-01. `01-REVIEW-FIX.md`
records the fix in `83d8b32` but was itself written at fix time. Neither
document says whether the fix still holds. This one is that check, run against
head.

The review file is **not** edited. It is the record of what was true when it
was written, and rewriting it to say something else would destroy the only
evidence that the finding was ever open.

## The finding

**CR-01 (iteration 4)** — `_commit` persisted the snapshot and head, marked the
journal `COMMITTED`, and only then awaited `_audit`. An audit-store failure
after that point raised out of `apply`/`rollback`, so the client was told the
apply had failed while the head had in fact advanced. `async_recover` scanned
only `PREPARED` journals, so a restart could not reconstruct the lost
authoritative event. A false failure invites an unsafe retry, and the audit
record required for a shared mutation was gone for good.

## What is true at head

Read at `custom_components/glt_flow_card/project_transactions.py` and
`project_repository.py`:

1. **The journal carries the audit event before the audit store is touched.**
   `journal["audit_event"]` is composed at PREPARE (line 652) and the journal is
   written `AUDIT_PENDING` with `final_state: COMMITTED` *after* the head is
   verified and *before* `_complete_audit` runs (685-690), each write
   read-back-verified. The event to be projected is durable before the
   projection is attempted.

2. **An audit outage is a success, not a failure.** The `except OSError` at 692
   returns the verified head with `audit_pending: True`. The client is told what
   actually happened — the mutation landed, its audit projection has not — so
   there is no false failure left to retry against.

3. **Recovery covers the state.** `async_recover` (737) selects journals in
   `{"PREPARED", "AUDIT_PENDING"}`, and for an `AUDIT_PENDING` journal
   re-verifies the snapshot, re-asserts the head, then completes the audit and
   only then finalizes the journal to its `final_state`.

4. **Recovery runs before availability.** `__init__.py:250` awaits
   `async_recover()` inside `async_load`, after `async_initialize` and **before**
   `self.data["projects"]` is populated from `list_heads()`. Nothing reads a head
   until repair has completed.

5. **Replay is safe.** `repository.append_audit` (455) requires an event id and
   merges by id, so completing the same journal twice yields one durable event.
   Audit identity is derived deterministically from the transaction, so the id
   is the same on every attempt.

The remaining 13 findings across iterations 1-3 are in code paths continuously
exercised by the suites below; none reappeared.

## Evidence

| Command | Result |
|---|---|
| `node tools/python-launcher.mjs -m pytest tests/components/glt_flow_card/test_project_transactions.py tests/components/glt_flow_card/test_project_repository.py -q` | 32 passed |

## Verdict

**Closed.** The one BLOCKER left open by `01-REVIEW.md` is fixed at head, and
the fix is the recoverable-protocol one the review asked for rather than a
narrower patch that only silences the reported case. Phase 1 carries no open
review finding.

What this verification does **not** cover is unchanged from the phase itself:
dependency provenance (F-01) still fails in this container with HTTP 403 on the
`@playwright/test` source-metadata request, so the Phase-1 gate has never
completed its own recursion here.
