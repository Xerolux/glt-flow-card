---
phase: 07-trends-energy-reports
status: planned
requirements: [HIST-01, ENER-01, REPORT-01]
---

# Phase 07 Validation Map

The gate parses the table below. Six columns, and the threat cell carries every
threat the row's command proves, so coverage is checked against the register
without the two documents having to word anything identically.

## Requirement coverage

| Requirement | Threats | What is proven | Kind | Command | Status |
|---|---|---|---|---|---|
| HIST-01 | T7-21 | Trend, energy and report shapes are closed by schema 6, with a sequential 5→6 migration | Dual-runtime contract | `node --test test/v100-migrations.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q -x` | ⏳ planned |
| HIST-01 | T7-01 | History routes are declared in both policy tables, enforced server-side, enumeration-filtered with the limit applied after filtering, and every read and export is audited | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_history_routes.py -q -x` | ⏳ planned |
| HIST-01 | T7-02 | Row, entity and window bounds are configured numbers enforced before the query; a request past a bound is refused with the limit named or answered from statistics and labelled | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_history_bounds.py -q -x` | ⏳ planned |
| HIST-01 | T7-03, T7-04, T7-05 | Every series carries coverage and gaps; an empty response is not a populated window; a gap is never interpolated and an unreadable binary sample is never off | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_series_coverage.py -q -x` | ⏳ planned |
| HIST-01 | T7-06 | Replaying an instant shows what was recorded at that instant, and an entity without history is unknown rather than live | Browser contract | `node --test test/replay-truth.test.mjs` | ⏳ planned |
| HIST-01 | T7-07 | Named periods resolve on local-calendar boundaries across the transition corpus, including 23- and 25-hour days and 743- and 745-hour months | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_period_resolution.py -q -x` | ⏳ planned |
| HIST-01 | T7-08 | The browser and the Companion produce identical period resolutions over the committed corpus, compared as canonical bytes | Dual-runtime contract | `node --test test/period-parity.test.mjs` | ⏳ planned |
| ENER-01 | T7-09, T7-10 | A counter is differenced across the resolved period and a rate integrated over it; a period outside the statistic's coverage is out of coverage, never consumption | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_energy_counters.py -q -x` | ⏳ planned |
| ENER-01 | T7-11, T7-12, T7-13 | Units are validated before arithmetic and an incompatible pair refused with a reason; every total states its coverage and its exclusions; a circular quantity is never averaged arithmetically | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_energy_units.py -q -x` | ⏳ planned |
| REPORT-01 | T7-14, T7-18 | A run records window, timezone, aggregate, deadband, sources and coverage, and re-running reproduces the value or names which input changed | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_report_runs.py -q -x` | ⏳ planned |
| REPORT-01 | T7-15 | A report schedule is validated at authoring time, executed by the Phase-6 runner, and every run — successful or failed — is recorded | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_report_schedule.py -q -x` | ⏳ planned |
| REPORT-01 | T7-16, T7-17, T7-18 | Screen, CSV and print derive from one model and agree on values a serialisation round-trip would break; no exported row carries a borrowed value | Browser contract | `node --test test/report-renderings.test.mjs` | ⏳ planned |
| HIST-01, REPORT-01 | T7-19, T7-20, T7-22 | The trend and report surfaces are operable without a pointer in both languages, offer a tabular alternative to every chart, never interpolate operator text into markup, and render the authoritative value rather than a confident zero | Exact artifact | `node tools/run-exact-dist-playwright.mjs --grep=phase-7-trends` | ⏳ planned |
| HIST-01 | T7-23 | Authored source, generated card, stage, lanes and release evidence agree, and no test reached a live Recorder or exceeded a declared bound | Release | `npm run test:phase7:release` | ⏳ planned |

## Success-criterion coverage

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Bounded raw and statistics queries expose aggregation, deadband, interpolation policy, quality, gaps, coverage, alarm markers, two cursors, comparison ranges, zoom, templates, exports and explicit retention and source provenance, without claiming a separate historian | `test_history_routes.py`, `test_history_bounds.py`, `test_series_coverage.py`, exact-dist `phase-7-trends` | planned |
| 2 | Electricity, heat, cooling, water, gas, PV, battery, tariffs, costs, CO₂, virtual meters, peak demand and comparisons use compatible units, reset-aware meter math, missing-data coverage and reproducible day, month and year boundaries | `test_energy_counters.py`, `test_energy_units.py`, `test_period_resolution.py`, `test/period-parity.test.mjs` | planned |
| 3 | Engineers version branded period reports from selected KPIs, trends, alarms, energy, coverage and maintenance data; on-demand, scheduled and event runs yield matching screen, CSV and print values and record inputs, results and delivery attempts | `test_report_runs.py`, `test_report_schedule.py`, `test/report-renderings.test.mjs` | planned |
| 4 | Missing, partial, stale, incompatible and Recorder-failure fixtures never become false zero or normal values, and rerunning a recorded period reproduces the result or reports an explicit provenance change | `test_series_coverage.py`, `test_energy_units.py`, `test_report_runs.py` | planned |
| 5 | Supported HA-lane integration tests and exact-artifact browser tests cover bounded queries and exports, date, time and DST, German and English formatting, keyboard-accessible chart alternatives, print layout, schedule and restart failure, and representative history volumes | every row above, plus the lane matrix in `test:phase7:release` | planned |

Criterion 4 carries the obligation this phase exists for, and it is worth stating
separately because it is the one a passing test suite can most easily fake. Each
of the five fixture classes — missing, partial, stale, incompatible, Recorder
failure — must be asserted to produce a **stated** outcome, not merely a
non-crashing one. A test that feeds a Recorder failure and asserts the series is
empty has confirmed the defect rather than caught it.

## Bounds asserted

| Bound | Default | Where |
|---|---|---|
| Maximum raw-query window | conservative; longer windows answered from statistics and labelled | `test_history_bounds.py` |
| Maximum entities per query | bounded, refused rather than invisibly chunked | `test_history_bounds.py` |
| Maximum rows per response | bounded; the response declares whether it hit the cap | `test_history_bounds.py` |
| Enumeration limit application | after filtering, never before | `test_history_routes.py` |
| Report runs retained | bounded, oldest dropped | `test_report_runs.py` |
| Cached series retained | bounded | `test_history_bounds.py` |
| Export rows | bounded; a truncated export says so | `test/report-renderings.test.mjs` |
| Report schedule executions recorded | bounded | `test_report_schedule.py` |

Each default is a **site decision** recorded in `07-CONTEXT.md` and
`07-RESEARCH.md` §6, not a product opinion — the same treatment Phase 6 gave the
alarm philosophy. The tests assert that the mechanism is configurable *and* that
the shipped default is the conservative value.

## Not proven here

- **A separate historian.** This phase reads Home Assistant's Recorder and says
  so. No time-series database, no retention policy of our own, no write path into
  history. The product must stop implying otherwise, and that retirement is
  asserted rather than assumed.
- **Measured capacity at representative history volumes.** Phase 10 owns capacity
  for the whole product. Phase 7 bounds the *shape* of the query cost and asserts
  the bounds are enforced; it does not certify a figure.
- **Simulation, commissioning and maintenance authoring.** Phase 8. A report may
  *read* asset data; it does not author it.
- **Remote-site history.** Phase 9.
- **That the Recorder contracts hold identically on the oldest supported lane.**
  Only the lane matrix in `test:phase7:release` can prove that, and it needs a
  Docker engine this container does not have. The plans state the contract they
  assume and assert it in the lanes, so a lane where it differs fails loudly
  rather than silently computing a different number.
- **The composed release leaf.** `npm run test:phase7:release` is expected to
  stay `planned` here for the reason above; a composed leaf verified from its
  legs is a leaf nobody composed.
