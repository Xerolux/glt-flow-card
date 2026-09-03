# 04-08 — Roll-up counts that leak nothing

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Counts are summed from the **already-filtered** project set, never computed
across everything and filtered afterwards for display. That ordering is the
whole finding: a portfolio total computed first and masked second still
reflects objects the viewer may not know about.

An authorized-but-empty subtree and an unauthorized one are indistinguishable,
which means an authorized zero is reported as **no count at all** rather than
as `0`.
