# Phase 07 Patterns

Most of what this phase needs is already load-bearing somewhere in the
repository. Phase 7 introduces three new ideas — the **measured value**, the
**delegated period** and the **recorded run** — and reuses the rest.

## One evaluator, and the surfaces render it

Established by Phase 2 for authority, Phase 4 for control lists, Phase 5 for
routing, Phase 6 for alarms. The Companion decides; the browser draws what it
decided.

History is the last shared read in the product with no policy route: every query
today is a browser `callApi`, so bounds, filtering and audit have nowhere to
live. The move is the same one every previous phase made, for the same reason.

## Retire, do not delete — and prove it was reached

Established in Phase 4 for controls, Phase 5 for the midpoint router, Phase 6 for
`activeAlarm`. `aggregateSeries`, `integrateEnergy`, `energySummary`,
`reportCsv`, `printReport` and `trendCsv` all stay reachable and inert, so a test
can prove the replacement rather than prove the absence of something nothing
checks. The assertion reads `dist/glt-flow-card.js`, because a retirement
authored in `src/` that never reached the artifact is not a retirement.

**Phase 6 added the caveat this phase must carry.** Retiring `activeAlarm` left
it reading a field that only one panel ever wrote, and three surfaces reported a
confident zero for months' worth of alarms. The artifact grep passed the whole
time, because the call *existed*. Reachable is not reached. Every retirement here
gets an outcome assertion that renders the surface and reads the number, not only
a grep proving the old path is inert.

## Refuse, do not degrade

Established in Phase 5 for unroutable pairs and unresolvable endpoints, extended
in Phase 6 to shelving maxima, which are refused rather than silently capped.

Here it governs units and bounds. An incompatible unit pair is refused with a
reason — never converted on a guess, never silently dropped from a total. A
window past the raw-query limit is refused with the limit named, or answered from
statistics and *labelled* as such — never silently truncated, because a truncated
window produces a chart of the wrong period that looks exactly like a chart of
the right one.

## Filter, do not deny; limit after filtering

Established in Phase 2 and restated in Phase 6 for `schedules/list`. A refusal
tells an unauthorized caller that rows exist. A limit applied before filtering
turns the limit into a count oracle for rows the caller may not see.

## Byte-for-byte parity against a committed corpus

Established in Phase 3 (canonical bytes, not verdicts), used again in Phase 6 for
the DST corpus. Period resolution exists in both runtimes — the browser needs it
to label an axis, the Companion needs it to answer a query — so it is proven
identical against a shared committed corpus by comparing canonical bytes.

Phase 6's specific lesson stands as a warning: the two runtimes agreed on every
value and disagreed on every byte, because `toISOString()` writes milliseconds
and Python's `isoformat()` omits them at zero. The corpus comparison must be of
canonical bytes from the first commit, not retrofitted after a value comparison
passes.

## Measured value

**New.** Every number this phase produces travels with the evidence for it:

```
{value, unit, coverage, gaps, source, period, resolved_at}
```

- `coverage` is a fraction: expected buckets against buckets the Recorder
  returned. Not a boolean, and not a warning appended by a caller who remembered.
- `gaps` is the list of intervals with no data, so a renderer can break the line
  rather than draw through it.
- `source` says which contract answered — `statistics`, `raw`, or `unavailable` —
  because "we have no data" and "we did not ask" are different answers.
- `unit` is the unit the value is *in*, checked before any arithmetic, never
  inferred from which field someone read.

The motivation is the audit's D1, D6, D7, D10, D16 and D18: six defects that are
one defect, each turning *absent* into a number, and none of them producing a
value that an ordinary assertion would flinch at. A test can only catch a
plausible wrong number by asserting on what the product says about its own
answer. Making that a field rather than a convention means a consumer who ignores
it has to ignore it deliberately.

`value: null` with `coverage: 0` is a valid, complete answer. Zero is not a
substitute for it, and neither is the nearest neighbour.

## Delegated period

**New.** A named period is resolved by asking Home Assistant, not by arithmetic
of ours.

`07-RESEARCH.md` measured that the Recorder already resolves `day`, `week`,
`month` and `year` on local-midnight boundaries in the configured timezone, with
23- and 25-hour days and 743- and 745-hour months. Our `Math.floor(x / bucketMs)`
is always exactly 24 hours, aligned to the UTC epoch, and cannot express a month
at all.

So `day`, `week` and `month` go to `recorder/statistics_during_period`, and
`year`, offsets and `first_weekday` go to `recorder/statistic_during_period`'s
calendar spec. The product's own period code exists to *name* a period, validate
it, and render its boundaries — never to compute them.

This is Phase 6's interval-and-instant rule generalised: two models exist, and
converting between them silently changes what a number means. The difference is
that here one of the two models is already implemented correctly by someone else,
and the pattern is to ask rather than to re-derive.

## Rate and counter are different models

**Reused shape, new subject.** Phase 6 kept interval and instant schedule
bindings from ever being converted into each other. The same rule governs meters:

- A **rate** (`W`, `kW`, `m³/h`) is integrated over the period, with gaps
  excluded from the integral rather than integrated through, and the excluded
  span reported as missing coverage.
- A **counter** (`kWh`, `m³`) is differenced across the period boundary, which
  the Recorder's `change` already does reset-aware.

Conversion between the two is a declared operation with a declared unit, never an
implicit consequence of which field a caller read. What ships today integrates
one model and multiplies the other by a price, and calls both "energy".

## Recorded run

**New.** A report run records what it was computed from:

```
{report_id, version, window, timezone, aggregate, deadband, sources[], coverage, produced_at}
```

Re-running reproduces the value or names **which input changed**. Both halves
matter: a report that silently produces a different number the second time is
worse than one that refuses, because the first version has already been sent to
someone.

This is Phase 1's receipt pattern and Phase 2's audit provenance applied to a
computed artifact rather than a mutation. Report ids are content-derived or
explicitly authored — never `Date.now()`, which Phase 5 already found and fixed
in paste, for the same reason: a clock-derived id is not reproducible and
collides within a millisecond.

## One model, three renderings

**Restated, because the current code violates it structurally.** Screen, CSV and
print-PDF derive from one verified model. `printReport` today rebuilds its table
by splitting the CSV on `;` and newlines, discarding the quoting the CSV writer
correctly applied — so any value containing a semicolon becomes extra columns.

Deriving one rendering from another's serialisation is the defect, not the
symptom. The test asserts the three renderings agree on values a naive
serialisation round-trip would break: a semicolon, a newline, a quote, a comma
decimal.

## Bounded retention, configured

Established in Phase 6 for alarm history and schedule runs. Report runs and any
cached series accumulate, so each gets a configured bound with a conservative
default, documented as a site decision. Unbounded state is a leak with a friendly
name.

## The effect ledger, extended

Phase 6 added a notification dimension because the phase's own subject was an
intended service call. Phase 7 adds a **query dimension**: every Recorder request
a test makes is recorded with its contract, entity count, window and row count,
and the gate asserts no test exceeded the declared bounds or reached a live
Recorder.

The existing prohibitions still hold — zero unintended service calls, no live
Home Assistant, no real recipient — and remain necessary rather than sufficient.
