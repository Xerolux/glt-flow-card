# 07-17 — Retire the six browser evaluators

**Status:** complete. RED gate: 0 controlled RED, 11 implemented, 0 broken.

`aggregateSeries`, `integrateEnergy`, `energySummary`, `trendCsv`, `reportCsv`
and `printReport` are inert, and `_ensureHistory` no longer reaches the Recorder
from the browser. Each entry point carries the defect it embodied, so the next
reader knows what it is a monument to.

## Two findings the work produced

**A retirement cannot be "reachable and inert" if nothing references it.**
`integrateEnergy` and `energySummary` are module-level exports of `core.mjs` that
nothing in the bundle imports, so esbuild drops them and the artifact cannot
carry the property. Keeping a fake reference alive so a test could assert a dead
function does nothing would be worse than the absence. The claim for those two is
therefore *absence*, which the pattern warns is weaker — and what makes it
sufficient is that the replacement is asserted separately by behaviour, in
`test_energy_counters.py` and `test_energy_units.py`. The warning is about
proving the absence of something *nothing checks*; these are checked, elsewhere
and by name.

**`test/v100-core.test.mjs` asserted the old aggregator's behaviour** and had to
be rewritten rather than deleted. It checked that a deadband dropped a point and
a 2000 ms bucket produced two averages — both behaviours wrong in a way the
assertion could not see, because x values of 0, 1000, 2000 and 3000 never touch a
timezone. **It passed for the whole life of D9.** It now asserts the retirement
and names where the behaviour went.

## What was deliberately left to later plans

`shipped-history-truth.test.mjs` reads `dist/` and says in its own docstring that
a grep is necessary and not sufficient: Phase 6's equivalent passed for the life
of a defect because `alarms/list` did appear in the bytes, in the one place
nothing reached. The outcome half is 07-19.

The assertion that the artifact reaches the Companion's history routes was left
to 07-18, which builds the surfaces that call them — **a test red for a reason
unrelated to what it names teaches its reader to ignore it.**

---

*Written retrospectively during 07-20 from the plan's commits (93ece20, f73346c); the summary was missed when the plan landed. Nothing here is recalled — every claim is taken from the committed message and the code at head.*
