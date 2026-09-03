# 05-01 — The evidence machinery, before any feature

> **Reconstructed at close-out**, from this plan, `05-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`tools/phase5-red-gate.mjs` classifies the Phase-5 sentinels on the pattern
Phases 2, 3 and 4 established: a run counts as controlled RED only when exactly
one named sentinel fails carrying its literal marker *and* the effect-ledger
prefix for that task. Harness failures, zero-test runs and skips are rejected
rather than counted.

The ledger is extended for what this phase newly makes possible. SDK-01 ships
contributions as **data**, so the two effects that would falsify the whole
platform are:

- **any evaluation of contributed content** — a descriptor passed to a
  function constructor, a renderer that is itself a function, markup inserted
  where it would execute;
- **any contributed network fetch** — a symbol that reaches out for its own
  image is a symbol whose behaviour the installation does not control.

Both fail the ledger. That is what makes "nothing contributed executes" a
measurement rather than a design intention, and it is why the SDK plans later in
the phase could be reviewed for correctness rather than for whether they had
quietly opened a hole.
