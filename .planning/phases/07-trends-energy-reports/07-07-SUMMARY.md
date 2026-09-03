# 07-07 — Byte-identical period resolution across both runtimes

**Status:** complete. T7-08's sentinel is green and has been promoted out of the
RED exclusion list into the regression run.

## What the work found

**Every boundary matched on the first run; only the bytes differed.** The
browser wrote `"span_hours":25` and the Companion wrote `"span_hours":25.0`, for
all 36 entries. Identical values, different bytes — which is precisely the
failure Phase 6 spent a cycle on, and which 07-02 repeated, and which the parity
sentinel was deliberately written to compare bytes for.

That makes four occurrences in this phase alone:

| Where | Divergence |
|---|---|
| Phase 6 schedules | `toISOString()` milliseconds against `isoformat()` at zero |
| 07-02 measured value | coverage `0` against `0.0` |
| 07-02 vocabulary | insertion order against `sort_keys` |
| 07-06 period span | `25` against `25.0` |

**Solving it once per module is why it kept recurring.** Each fix was correct and
local, and the next value type crossing the boundary met the same rock. So
`canonical_number` is now public and shared, and every number that crosses goes
through it.

The general form is worth stating: **a value type that crosses runtimes needs its
canonical form decided where the value is produced, not where it is compared.**
The comparison is where a divergence is noticed, which is far too late to be
where it is prevented.

## The corpus is what makes this meaningful

The parity test proves the two runtimes agree with each other. `test_period_resolution.py`
proves the Companion agrees with Home Assistant. Neither alone is enough: two
runtimes that agree on the wrong boundaries would pass the first, and a
Companion that is right while the browser draws a different axis would pass the
second.

## Evidence at head

`node --test test/period-parity.test.mjs` — passes over all 36 entries, comparing
canonical bytes. `npm test` — 448 passed, 0 failed, with the suite now in the
regression run rather than excluded from it.
