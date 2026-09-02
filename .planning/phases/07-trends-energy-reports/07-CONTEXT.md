# Phase 7 context — Trends, Energy & Reproducible Reports

**Requirements:** HIST-01, ENER-01, REPORT-01
**Depends on:** Phase 6
**Mode:** mvp

## Phase Boundary

**In scope.** Bounded Recorder reads through a server-owned route, over both the
raw-state and long-term-statistics paths; series interpretation that reports
coverage and gaps instead of interpolating across them; local-calendar periods
resolved in the site timezone; unit-safe, reset-aware energy over those periods;
and versioned period reports whose screen, CSV and print views share one verified
model and whose runs record their inputs.

**Out of scope.** Simulation and commissioning (Phase 8 owns SIM-01 and DIAG-01);
maintenance authoring beyond *reading* asset data into a report (Phase 8 owns
ASSET-01); remote-site history (Phase 9); measured capacity numbers at
representative volumes (Phase 10 owns that for the whole product, and this phase
bounds the *shape* of the cost rather than certifying a figure).

Explicitly out of scope, and worth naming because the current product implies
otherwise: **this phase does not build a historian.** It reads Home Assistant's
Recorder and says so. A separate time-series database, a retention policy of our
own, or a write path into history are all things the product must stop implying
it has.

## The shape of this phase

Phase 6 dealt with effects that reach a human and fail silently. Phase 7 deals
with **numbers that reach a human and are wrong in a plausible direction**.

That difference decides the whole approach. A silent failure can be caught by
asserting that something happened. A plausible wrong number cannot — every test
that checks "is there a value here" passes. The audit's D1, D6, D7, D10, D16 and
D18 are one defect in six costumes: each turns *absent* into a number, and none
of them produces a value an assertion would flinch at. A six-hour outage drawn as
a straight line is not a broken chart; it is a steady plant. A cumulative meter
reading multiplied by a price is not obviously absurd until someone checks the
decimal point.

So the phase's tests must assert on **what the product says about its own
answer**, not only on the answer. Coverage, gaps, units, period boundaries and
provenance are the outputs under test.

## Implementation Decisions

### The server owns history

Every history read today is a browser `callApi`, so the card's project policy —
built in Phase 2 and routed through by Phases 3 to 6 — never sees a history
request, and no export is audited. This is the last product area that reads
shared data with no policy route.

History moves behind Companion routes with the same properties every other
collection has: declared in both policy tables, enforced server-side,
enumeration-filtered with the limit applied *after* filtering, and audited. The
browser asks and renders; it does not decide what it may read.

This is not only an authorization argument. Bounds, the statistics path,
local-calendar periods and coverage are all server-side concerns, and the
browser is the wrong place to decide any of them.

### Coverage travels with every number

Every series, every period total and every report figure carries a coverage
fraction and a gap list. Not a warning appended when someone remembers — a field
of the result, so a consumer that ignores it has to ignore it deliberately.

The renderer refuses to draw across a gap. A break in the line is the honest
picture, and it is the one thing that distinguishes "the plant was steady" from
"we have no idea".

An absent sample is never zero, never the nearest neighbour, and never the
average of its neighbours.

### A period is a local-calendar object, resolved where the data is

Buckets today are aligned to the UTC epoch, so a "day" starts at 01:00 or 02:00
local and a transition day is 23 or 25 hours long. Phase 6 proved exactly this
for schedules; the resolution reuses that work rather than reinventing it.

Periods are named — `day`, `week`, `month`, `year`, `custom` — resolved
server-side in the site timezone, and proven against a committed corpus of
transition dates with both runtimes compared **byte for byte**, not verdict for
verdict. Phase 6 learned that lesson the expensive way: the two runtimes agreed
on every value and disagreed on every byte, because `toISOString()` writes
milliseconds and Python's `isoformat()` omits them at zero.

### Two meter models, never blurred

An instantaneous power series and a cumulative meter reading are different
things, and the product currently integrates one while multiplying the other by
a price. Each keeps its own model:

- **Rate** (`W`, `kW`, `m³/h`): integrated over the period, with gaps excluded
  from the integral and reported as missing coverage rather than integrated
  through.
- **Counter** (`kWh`, `m³`): differenced across the period boundary, reset-aware,
  with a reset recorded as an event rather than absorbed into the difference.

Conversion between them is a declared operation with a declared unit, never an
implicit consequence of which field someone read. This is the same rule Phase 6
set for interval and instant schedule bindings, for the same reason: blurring two
models silently changes what a number means.

### Units are checked, not displayed

The unit is read from the entity today for display and never compared against
anything. A meter in `Wh` and one in `kWh` contribute to the same euro total,
three orders of magnitude apart.

Units are validated before arithmetic: against the meter's declared unit, against
the unit the price is denominated in, and against the model the meter is bound
to. An incompatible pair is **refused with a reason**, not converted on a guess
and not silently dropped. Phase 5 established that refusing beats degrading, and
a wrong cost figure is a worse degradation than a missing one.

### A report records its inputs

What ships today is a screenshot with a filename: current display values, no
period, an id minted from the clock, and a schedule string nothing parses.

A report run records the window, the timezone, the aggregate, the deadband, the
coverage, and the provenance of each source. Rerunning it either reproduces the
same result or reports **which input changed**. That second half matters as much
as the first: a report that quietly produces a different number the second time
is worse than one that refuses.

Report ids are content-derived or explicitly authored, never `Date.now()` —
Phase 5 found and fixed the same defect in paste.

### One model, three renderings

Screen, CSV and print-PDF are three renderings of one verified model, not three
pieces of formatting code that happen to agree today. The print view currently
rebuilds its table by splitting the CSV on `;` and newlines, so any value
containing either breaks the structure — the quoting the CSV writer correctly
applied is discarded rather than parsed. Deriving one rendering from another's
serialisation is the defect; they derive from the model instead.

### Retirement, again reachable and inert

`aggregateSeries`, `integrateEnergy`, `energySummary`, `reportCsv`, `printReport`
and `trendCsv` all stay reachable and do nothing, the way Phase 5 retired the
midpoint router and Phase 6 retired `activeAlarm`. A test proves the replacement
rather than proving the absence of something nothing checks.

Phase 6 added a caveat to that pattern that this phase inherits: **reachable is
not reached.** Retiring `activeAlarm` left it reading a field only one panel ever
wrote, and three surfaces reported a confident zero for it. The artifact grep
passed throughout, because the call *existed*. Every retirement in this phase
needs an outcome assertion that renders the surface and reads the number, not
only a grep proving the old path is inert.

## Open question for research

The roadmap's flag has two halves, and both are answerable by execution against
the vendored Home Assistant rather than by reasoning:

1. **Which Recorder contracts exist across the supported lanes**, and what each
   returns: `history/period` versus `history/history_during_period`,
   `recorder/statistics_during_period` and its `period` values, which statistic
   types (`mean`, `min`, `max`, `sum`, `state`) exist for which `state_class`,
   what `sum` means for a resetting counter, and what a gap looks like in each.
2. **What a valid energy and report calculation is** given those contracts:
   which period boundaries the statistics API itself supports, whether it
   resolves them in the site timezone, and what output limits keep a bounded
   read bounded.

Recorded in `07-RESEARCH.md` when resolved, with the measurements that resolved
it.
