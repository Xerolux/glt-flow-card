# 04-12 — Losing the thread, honestly

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`src/v100/view-resync.mjs` compares each event's sequence against the one it
expects and treats anything else as a gap. The view goes stale **in the same
transition** — there is no frame in which a number is displayed as live after
the client knows it may not be.

**Nothing is interpolated across a gap.** An interpolated value is a number the
plant never reported, rendered with the same authority as one it did.

Operator input survives the resync, so recovery does not cost a half-filled
form and does not require a page reload.
