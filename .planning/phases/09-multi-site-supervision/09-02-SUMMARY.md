# 09-02 — What a site can be, in both runtimes

**Status:** complete. Foundation for T9-13.

Four site states — `healthy`, `slow`, `unreachable`, `circuit_open` — plus a
closed set of failure reasons and the four command outcomes reused from Phase 4
rather than redefined.

**`unavailable` is deliberately not a site state.** It is a real *entity* state,
and reusing the word for a site is exactly how the shipped code made "we could
not ask" indistinguishable from "it is down". The test asserts its absence, so
reintroducing it fails rather than passes.

**`slow` is an answer.** Treating it as absent would discard real data, so
`ANSWERING_STATES` is `("healthy", "slow")` and everything downstream derives
completeness from that one list.

**One home for "a timeout is `effect_unknown`".** Written out at four call sites,
one of them eventually says `failed` — and a retry offered after an unknown is
how plant gets operated twice. `outcome_for_failure` refuses an undeclared
reason rather than defaulting it.

The two runtimes are compared as **canonical bytes**, not verdicts. This
codebase has hit that trap four times now, twice within Phases 8 and 9: two
earlier parity efforts agreed on every value and disagreed on every byte —
`toISOString()` milliseconds, `0` versus `0.0`, separators and nested key
ordering. A verdict-level comparison would have passed each time.
