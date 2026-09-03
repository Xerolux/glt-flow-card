---
phase: 07-trends-energy-reports
reviewed: 2026-09-03
head: 0bf8702
depth: standard
reviewer: close-out review pass
method: read at head, targeting the four ways a chart can lie while every test passes
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: no_defects_found
---

# Phase 07: Code Review Report

**Scope.** `energy_model.py`, `energy_units.py`, `period_resolution.py`,
`history_bounds.py`, `history_routes.py`, `measured_value.py`,
`src/v100/period-resolution.mjs`, `measured-value.mjs`, `report-renderings.mjs`,
and the two parity corpora.

## Summary

No defect found. This phase's failure mode is not a crash: it is a chart that
draws a confident, plausible, wrong number. The pass therefore targeted the four
places where that is easiest, and each is handled deliberately, with the
reasoning recorded beside the code.

**T7-13 — the circular mean.** `energy_units.py` reads the *declared*
`StatisticMeanType` rather than guessing from the unit, and computes a bearing
from the sine and cosine sums. Exactly-opposed directions return
`circular_mean_required` rather than an invented bearing. The comment states why
this matters: an arithmetic mean of 350° and 10° is 180° — due south when the
wind was blowing very nearly due north — and "it is not an error, not an
outlier, and nothing downstream would flag it."

**T7-09 — the zero-previous-sum trap.** The research found it at Home
Assistant's `statistics.py:1947`: `prev_sum = prev_sums.get(statistic_id) or 0`.
A window beginning before a statistic's first recorded row gets `0` for the
previous sum, so the first bucket's `change` is the **entire accumulated
total** — a plausible large number, not a null. `period_total` discards the row
*at* the first recorded instant as unusable rather than merely suspect, and
reports the instants outside coverage instead of quietly shortening the window.

**T7-08 — browser and server agreeing on a boundary.** Both runtimes resolve
periods and are compared as **canonical bytes** over a corpus, not as verdicts.
The same for the instant grid. This is the discipline the project adopted after
hitting the byte trap four times, applied here to the one number an engineer
verifies in the browser and the plant then computes for itself.

**T7-05 / T7-04 — the unread sample.** `measured_value.py` opens by naming both:
a gap the line closes over, and an unreadable binary sample recorded as off. "I
could not read the fault contact" and "the fault contact is healthy" are
different statements, and only one of them is safe to draw.

## Info

### IN-01: `07-21` has a summary and no plan

Every other executed plan in the project has both. `07-21-SUMMARY.md` documents
work done **after** the phase closed — the bucket grid and the last two history
routes, which shipped as shells answering a stated `unavailable` — and it
explains why it was a plan rather than an afternoon: the bucket step is a
decision, not a derivation, and inventing it inside `07-18` would have invented
semantics no plan specified.

The asymmetry is worth leaving as it is rather than back-filling a plan file. A
plan written after its own summary is a plan nobody planned from, and the
summary already says plainly that this was carry-over closed after the fact.

## Evidence

| Command | Result |
|---|---|
| `node --test test/period-parity.test.mjs test/instant-grid-parity.test.mjs test/report-renderings.test.mjs` | 6 passed |
| `pytest test_energy_units.py test_energy_counters.py test_history_bounds.py test_history_routes.py test_period_resolution.py test_instant_grid.py -q` | 25 passed |
| `node tools/run-exact-dist-playwright.mjs` | 92 passed, including the `phase-7-trends` specs |

## Class-level sweeps

`history/series` and `history/statistics` are `enumeration="filter"` and
project-scoped, so they were in the Phase-2 sweep's scope. Both resolve the
project from the decision, ask `visible_projects` for `history.read`, and filter
**before** applying the limit — the ordering that keeps a page size from
becoming a count oracle. `history/export` carries its own capability and is
rate-limited like a mutation, because what it costs is the reason, not what it
writes.

## Verdict

**No defects found.** T7-23's release leaf is unrun here for the standing
reason.
