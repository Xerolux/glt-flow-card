# 10-01 — The gate, and the ledger for a measurement that measured nothing

**Status:** complete.

Two things had to change rather than be inherited from the Phase-9 gate.

**The roadmap slice end was a derivation that breaks at the last phase.** Every
earlier gate wrote `### Phase ${PHASE + 1}:`, which worked because every earlier
phase had a successor heading. Phase 10 has none. It is derived now as the next
phase heading if one exists and the next top-level section otherwise — writing a
literal there would have been exactly the class of bug this file's own docstring
records three of.

**The effect ledger asks this phase's question.** Phase 7's was a query
exceeding its bound, Phase 8's an effect reaching plant during a rehearsal,
Phase 9's a socket opened while proving a bound. Phase 10's is **a measurement
that measured nothing** — and it is the most believable of the four, because it
looks like good news: a capacity scenario that builds no objects finishes in
three milliseconds, reports comfortably under budget, and every downstream
artifact repeats that number as a fact about the product.

A measurement therefore carries the count it actually built. Declaring 2,000 and
building 0 fails; building 1,999 fails too, because that is not the scenario
anyone recorded a budget for.
