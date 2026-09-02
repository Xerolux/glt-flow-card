# 07-05 — The period, energy and report RED contracts

**Status:** complete. Seven sentinels, each controlled RED for its own reason.

## What was written

| Sentinel | Threats | Reports missing |
|---|---|---|
| `test_period_resolution.py` | T7-07 | local-calendar resolution, refusal of unknown names |
| `test/period-parity.test.mjs` | T7-08 | byte-identical resolution across both runtimes |
| `test_energy_counters.py` | T7-09, T7-10 | reset-aware differencing, gap-excluding integration |
| `test_energy_units.py` | T7-11, T7-12, T7-13 | unit validation, stated exclusions, circular means |
| `test_report_runs.py` | T7-14, T7-18 | recorded inputs, reproducibility, content-derived ids |
| `test_report_schedule.py` | T7-15 | validation at authoring, one runner, recorded runs |
| `test/report-renderings.test.mjs` | T7-16, T7-17 | one model, no borrowed values, stated provenance |

## What the work found

**The corpus is what makes the period sentinel worth anything.** Every span it
asserts — 23 and 25 hour days, 167 and 169 hour weeks, 743 and 745 hour months —
was measured by running the vendored Home Assistant, not chosen. A sentinel that
asserted "a day is 24 hours" would pass against the defect.

**The parity sentinel compares bytes from its first line.** This is the third
time this phase has met the same rock: Phase 6 agreed on every value and
disagreed on every byte over milliseconds, and 07-02 repeated it over `0` against
`0.0` within an hour of the warning being written down. Both happened because the
comparison was written as values first and bytes later. Writing it as bytes from
the outset is the only version of this lesson that has ever held.

**Three sentinels assert the *absence* of a plausible number**, which is a
different shape from asserting a correct one:

- a window starting before the statistic exists must not report the accumulated
  total as consumption — the `prev_sums.get(id) or 0` trap;
- a six-hour gap must not be integrated through;
- an arithmetic mean of 350° and 10° must not come out as 180°.

Each of those *is a number*, and a plausible one. No assertion about the shape
of the result would catch any of them; only asserting the specific wrong value
does.

**The report-schedule sentinel documents a feature that does not exist.** The
designer collects a schedule from a `prompt()`, stores it, and renders it back
under the heading "Automatik". Nothing parses it and nothing runs it. That is
Phase 6's shelving defect in a new place: a feature that reports success and does
nothing is worse than one that is missing, because the operator stops checking.

## Evidence at head

`node tools/phase7-red-gate.mjs` — 11 controlled RED, 0 implemented, 0 broken.
`npm test` — 447 passed, with the three browser sentinels excluded from the
regression run and still classified by the gate. `npm run test:python` — 499
passed, 9 deselected. The HA lane, simulated locally, removes the nine marked
files by marker and runs 492 tests against a floor of 120.
