---
phase: 01-trusted-contract-release-foundation
status: complete
completed: 2026-09-01
summary_written: 2026-09-03
requirements: [SCHEMA-01, HACS-01]
review: 01-REVIEW.md, 01-REVIEW-FIX.md, 01-REVIEW-VERIFY.md
---

# Phase 1 Summary — Trusted Contract & Release Foundation

> **Written at close-out**, from the 13 plan summaries, the three review
> documents and the code at head — not at execution time. Phase 1 closed with a
> review record instead of a summary; this fills the gap without pretending to
> be contemporaneous.

All thirteen plans are implemented.

## What was built

**One canonical contract in two runtimes** (01-03, 01-04). A project document
has one canonical byte form, produced identically by Python and JavaScript, and
a fixture corpus proves it across the boundaries that break naive
implementations: safe-integer limits, fixed-versus-exponent rendering,
subnormals, and lone surrogates. The rule the phase settled and every later
phase inherited: **parity is compared as canonical bytes, not as verdicts.**

**Deterministic migration and semantic diff** (01-05). Migrations are sequential
and receipted; a diff is over meaning rather than text, with dependency closure
so a selection that would leave a dangling reference cannot be applied.

**Safe cross-runtime bundles** (01-06). Symlinks, duplicate names, case
collisions and prefix overlaps are refused before anything is written.

**Authoritative persistence** (01-07). Snapshots are immutable and
digest-verified, the head is read back after every write, and a journal makes
the mutation recoverable rather than merely attempted.

**Companion lifecycle, options and diagnostics** (01-08).

**A deterministic release build and local HACS staging** (01-09, 01-10). Built
once, byte-compared, staged as both a plugin-category and an
integration-category package — and validated **without any publication target,
credential or upload path**, which is what makes "release evidence" something
this repository can produce without publishing anything.

**Project Safety UI** (01-11), **immutable HA artifact lanes** (01-12), and
**release acceptance** (01-13), which joins the source, build, stage, browser,
HA and release identities into one evidence chain that fails closed on a
missing, skipped, zero-test, stale or unmapped result.

## The review record

Phase 1 is the only phase reviewed **four times**, and the record is worth
keeping visible: fourteen findings across four iterations, five of them
critical. Among them: the two runtimes disagreeing on the canonical bytes of
large numbers; multiple array deletions persisting the wrong project; removal
dependency closure reversed so unselected objects were deleted; restore rolling
back to the *post*-apply snapshot; and unbounded dry-run previews as a
persistent memory-exhaustion path.

The last, and the one that stood open when the review closed, was **CR-01
iteration 4**: an audit-store failure after the head had committed returned an
error to the client, so a successful mutation reported as failed and its
authoritative audit event was lost for good. It is fixed by making the audit
projection part of the recoverable protocol — the canonical event is durable in
the journal before the store is touched, an outage returns the verified head
marked `audit_pending`, `async_recover` covers `AUDIT_PENDING` as well as
`PREPARED`, and that recovery runs before any head is published.

`01-REVIEW-VERIFY.md` (2026-09-03) confirms that fix against head. `01-REVIEW.md`
is deliberately **not** edited: it records what was true when it was written.

## The standing limitation

**F-01, dependency provenance, has never passed in this container.**
`verify:provenance --online` requests source metadata for `@playwright/test` and
the egress proxy answers HTTP 403. It fails closed rather than skipping, which
is correct — and it is the floor of every phase gate, because each gate recurses
into the one before it. **No phase gate from 2 upward has ever completed its
recursion here.** Every phase's release leaf is unrun for the same family of
reasons: no Docker engine, and no verified provenance.
