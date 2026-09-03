# 05-03 — RED: routing, the designer, and the SDK

> **Reconstructed at close-out**, from this plan, `05-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Three sentinels, each stating a guarantee in the form that makes it testable at
all.

**"A router that is not deterministic cannot be tested for anything else."**
Every other routing property — no path through equipment, ports leaving on the
side they declare, compatible media — is only checkable against a path the
router reproduces. Determinism is asserted by byte equality of the routed output
across runs, so it is first in the sentinel and first in the phase.

**"Undo is proven as a property over generated sequences, not one click-path."**
A hand-written undo test proves that one recorded sequence inverts. The
guarantee is that *every* operation has an inverse and that undo never restores
a state the project was never in, which is a property over sequences and is
tested as one.

**"A contribution that executes fails the ledger, not a code review."** The SDK
sentinel does not ask a reviewer whether a descriptor could be evaluated; it
runs the ledger from 05-01 and fails on the attempt. A rule enforced by review
is a rule that holds until the reviewer is busy.
