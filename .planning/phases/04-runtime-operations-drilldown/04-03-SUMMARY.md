# 04-03 — RED: navigation resolution and roll-up counts

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

The two navigation oracles were specified before `navigation.py` existed, so
the resolver would be built to close them rather than patched afterwards.

**An unauthorized address and a non-existent one must be indistinguishable** —
not similar, identical, down to the bytes, because a difference in wording,
shape or timing is an enumeration oracle for anyone who can paste a URL.

**A count over an unauthorized subtree is never rendered, not even as zero.**
Zero is information: it says the subtree exists and is empty, which is more
than a principal without access is entitled to know. The sentinel demands the
absence of a count, not a count of nothing.
