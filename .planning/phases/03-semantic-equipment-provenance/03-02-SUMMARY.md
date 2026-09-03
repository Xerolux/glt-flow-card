# 03-02 — The hierarchy and vocabulary contract, as a gap list

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

One named sentinel per file states the whole contract before any of it exists.
Cycles, dangling parents, level inversion, multiple parents and over-bounds
trees are each a failing expectation rather than a note in a design document.

Stating them as a gap list rather than as prose is what makes the later GREEN
wave checkable: a rule nobody wrote as a failing test is a rule that ships when
someone forgets it.
