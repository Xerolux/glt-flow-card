# 03-06 — The graph rules JSON Schema cannot express

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

One parent per node, enforced level order, cycle rejection, bounded depth and
breadth — in both runtimes, because a rule enforced on one side is a rule the
other side can be talked out of.

**A cycle reports the node that closes the loop**, which is the one a person can
act on; reporting the whole cycle leaves them to find it.

**Semantic paths are derived on read and never stored.** A stored path is a
second source of truth for the same fact, and it goes stale silently the first
time a parent changes.
