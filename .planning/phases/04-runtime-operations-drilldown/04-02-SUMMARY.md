# 04-02 — RED: panel composition, panel enumeration, view stream

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Three backend sentinels written before the implementation existed, each
carrying exactly one marker and listing every unmet guarantee as an explicit
gap rather than leaving them implicit in a single failing assertion.

The discipline that matters here: **a RED test asserts behavior, never the
absence of a symbol.** A test that fails because `panels.py` does not yet
export a name passes the moment the name exists, empty. These fail because the
composed panel does not yet arrive filtered, because enumeration still answers
differently for absent and forbidden, and because the stream still carries no
sequence — and they keep failing until those things are true.
