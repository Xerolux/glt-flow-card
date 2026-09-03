# 08-01 — Gate, dispatch ledger, corpora

**Status:** complete.

`tools/verify-phase8.mjs` derives everything from `PHASE`. The six `F` ids that
Phase 7 left as literals are now derived too: that file's own docstring records
three residual bugs from an earlier phase, every one of them a literal that
should have been a derivation, so leaving six more would have been ignoring its
own lesson.

**The dispatch ledger is stricter than its two predecessors**, because its
subject is a safety question rather than a correctness one. A dispatch is
recorded *before* the outcome is known, so a test cannot prove a refusal from a
return value while something else dispatched — the defect class here is a path
that answers "refused" and calls anyway. An unknown dispatch kind raises rather
than being recorded as "other": the enumeration test depends on the kind list
being complete, and a ledger that quietly accepted an unlisted kind would let a
new path through the one test written to catch exactly that.

**Both corpora were committed before anything read them.** The scenario corpus
contains a case whose value changes per tick — a corpus of constants would prove
reproducibility on something that cannot vary. The registry corpus contains all
four registry/state combinations, since collapsing them is T8-13.
