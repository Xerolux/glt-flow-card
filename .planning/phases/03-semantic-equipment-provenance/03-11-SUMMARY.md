# 03-11 — Instantiation and upgrade are guarded mutations

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Both carry an exact revision and require a lease, like every other shared write
since Phase 2. A profile upgrade is a bulk edit of shared content, and treating
it as a special case would be a second write path with weaker rules — which is
what a second write path always becomes.
