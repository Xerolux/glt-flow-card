# 07-10 — Coverage and gaps travel with every series

**Status:** complete. Both tasks verified at head. T7-03, T7-04 and T7-05 are
green.

## What was built

`series_coverage.py`: `build_series`, `binary_sample` and `gaps_between`. Four of
the audit's defects close here — D1, D6, D7 and D10 — and they are one defect in
four costumes, each turning *absent* into a number.

## The decisions

**A Recorder failure carries `source: "unavailable"`.** This is the distinction
criterion 4 turns on and the one this file could most easily have got wrong: a
correct implementation and a broken one both produce an empty series, and only
the stated source separates them. Returning an empty result sourced
`"statistics"` would have *confirmed* the defect while passing every assertion
about the result's shape.

**A null inside a returned bucket is not the same as a bucket that never came
back.** The first is an answer — the Recorder looked and had no number — and it
becomes an indeterminate point, so the line breaks there. The second is a gap.
Collapsing them would lose the difference between "the plant was unreadable" and
"we were not told".

**An unreadable binary sample is `None`, never `0`.** There is no interpretation
that is safe to guess: off is a claim and on is a different claim. Today
`unavailable` is not in `ON_STATES`, so it falls through to `0`, and a fault
contact nobody could read is recorded as healthy.

**Consecutive missing buckets merge into one gap.** A renderer needs the interval
to break across; three adjacent one-bucket gaps would draw as three breaks with
two invisible segments between them, which is a worse lie than one honest break.

## What the work found

**I inferred the expected grid from what came back, which is the defect.** The
first version derived the bucket spacing from the returned rows. That makes a
series with three missing days look like a shorter series with none — the
Recorder omits empty periods, so the returned list is *exactly* the thing that
cannot tell you what was expected.

The fix is not cleverer inference. It is that **coverage must be computed where
the expectation is known**: only the caller that resolved the period knows which
buckets were asked for. The corpus now carries `expected_instants`, which is what
the live path gets from `period_resolution`, and `test/phase7-corpus.test.mjs`
asserts every case has one *and* that it agrees with the case's own
`expected_buckets` — so a grid cannot silently disappear or drift out of step
with the count beside it.

## Scope gap in my own plan, recorded rather than hidden

The four history routes from 07-08 still answer `coverage: 0`, `source:
"unavailable"`. `series_coverage.build_series` is correct and tested against the
corpus, but **no plan in this phase explicitly owns issuing the Recorder query
itself.** 07-08 declared the routes, 07-09 bounded them, 07-10 computes coverage
from an answer — and the step that *obtains* the answer was never written down as
a task.

That is an omission in the planning, not a discovery about the code. It should be
picked up before the surfaces land in 07-18, because a surface that renders an
always-empty series would pass its own rendering tests and show an operator
nothing — which is precisely the "reachable is not reached" failure T7-22 exists
to block. The natural home is an added task in 07-12, which is the first plan
that needs real rows.

## Evidence at head

- `py -3.13 -m pytest tests/.../test_series_coverage.py` — passes against all
  nine corpus cases.
- `node --test test/phase7-corpus.test.mjs` — 11 passed.
- `npm test` — 449 passed, 0 failed.
- `npm run test:python` — 505 passed, 5 deselected.
- `node tools/phase7-red-gate.mjs` — 6 controlled RED, 5 implemented, 0 broken.
