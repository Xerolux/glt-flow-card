# 04-06 — A resumable, bounded view stream

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Home Assistant's websocket API supplies no sequence number and no replay, so
gap detection is ours to build. `view_stream.py` reads the snapshot and its
sequence **in one critical section with no `await` between them** — the two
values must describe the same instant or the client resumes from a sequence
that never matched its data.

Every streamed event carries a monotonic sequence the client can check.
Snapshot concurrency and resync rate are bounded and answer `rate_limited`
when exceeded, because every condition that triggers a resync is one a client
controls: an unbounded resync is a client-triggered amplifier.

`if budget.last_at` was the bug the lifecycle test found here — a falsy `0.0`
at monotonic zero short-circuited the interval check and skipped the throttle
entirely on the first window.
