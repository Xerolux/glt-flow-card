# 03-12 — Ranking that carries its reasons

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete. Closes T3-09.

Ranking is **pure and identical in both runtimes** over a shared corpus, so a
suggestion cannot depend on which side computed it.

**Every candidate carries the reasons that produced its score.** A ranked list
without them is an oracle: an engineer can accept it or ignore it, but cannot
disagree with it — and the case where the engineer is right is exactly the case
the reasons exist for.

A manual override sorts first and survives re-ranking, because an override that
a later re-rank can bury is not an override.
