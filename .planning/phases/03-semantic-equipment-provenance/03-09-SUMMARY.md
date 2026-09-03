# 03-09 — A cache that cannot outlive its generation

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

The provenance cache is generation-stamped: an entry cannot survive the runtime
generation that produced it. A cache that outlives a reload answers from a
registry that no longer exists, which is worse than not answering.

It joins the lifecycle ledger, and **unload leaves the Phase-3 resource counters
at zero** alongside Phase 2's. A ledger that counts only the newest phase's
resources reports a clean unload while the previous phase leaks.
