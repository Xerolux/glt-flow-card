# 09-01 — The gate, and a transport that cannot reach a network

**Status:** complete. Foundation for every Phase-9 row.

The gate derives from a single `PHASE` constant, for the reason recorded in
`tools/verify-phase9.mjs` itself: literals that should have been derivations
caused three residual bugs in earlier gates. It proves one acyclic path to
`test:phase9:release`, reaches it exactly once, and runs the Phase-8 gate —
a Phase-9 claim resting on Phase-8 guarantees nobody re-ran is resting on
nothing.

**The fixture transport is the phase's real foundation.** Each phase's effect
ledger answers the question that phase can get wrong *while passing*. Phase 7's
was a query exceeding its bound; Phase 8's was an effect reaching the plant
during a rehearsal. Phase 9's is **a test that proves a bound while opening a
real socket** — which proves nothing about the product and something alarming
about the suite.

Two decisions in `site_factory.py` are load-bearing:

**A real socket raises rather than being recorded.** Every other ledger
violation in this codebase is something a test asserts afterwards. This one
cannot wait: by the time the ledger is read, the request has already left the
building with a credential attached.

**Latency is injected, never slept.** A test proving a total deadline by
sleeping for the deadline takes as long as the deadline, and a suite that takes
minutes to prove a timeout is a suite nobody runs — so it gets deleted, and the
bound stops being tested. The fixture advances a clock instead.

The site host is `glt-fake-site.invalid`, which exists on no network by
construction, so a request recorded against any other host left the fixture by
definition.

The corpus is committed before anything reads it, so no test can quietly grow
the cases that happen to pass.
