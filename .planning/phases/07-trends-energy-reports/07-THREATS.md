---
phase: 07-trends-energy-reports
status: verified-except-T7-23
asvs_level: 1
asvs_version: 5.0.0
requirements: [HIST-01, ENER-01, REPORT-01]
---

# Phase 07 Threat Register

Every Phase-7 threat is a release blocker until its owner command passes against
behavioral tests and, where applicable, the exact generated artifacts.

Phase 6's threats concerned effects that reach a human and fail silently.
Phase 7's concern **numbers that reach a human and are wrong in a plausible
direction**, which is a harder thing to test for. A silent failure can be caught
by asserting that something happened; a plausible wrong number passes every
assertion of that kind. A straight line through a six-hour outage is not a broken
chart, it is a steady plant. A cumulative meter reading multiplied by a price is
not obviously absurd until someone checks the decimal point.

The register therefore concentrates on **what the product says about its own
answer**. Coverage, units, period boundaries, bounds and provenance are the
outputs under test, not decoration around them.

No test may contact a live Home Assistant, Recorder, remote site, fieldbus, plant
target or notification recipient.

## ASVS L1 Mapping

| ASVS area | Phase-7 control |
|---|---|
| V1 Architecture | One server-owned history boundary; the browser asks and renders and decides nothing about what it may read. |
| V5 Validation | Units, periods and bounds are validated before arithmetic; an incompatible pair is refused with a reason rather than converted on a guess. |
| V7 Error handling & logging | Every query and every report run records its contract, window, coverage and provenance. A Recorder failure is a stated outcome, never an empty series. |
| V8 Data protection | Series caches and report runs are bounded with a configured retention; operator text in a report is data, never interpolated into markup or into a serialisation another view parses. |
| V13 API | History and report routes are declared in both policy tables, enforced server-side, and enumeration-filtered with the limit applied after filtering. |
| V14 Configuration | Query bounds and retention are per-site configuration with conservative defaults, each documented as a site decision. |

## Canonical Threats

| ID | STRIDE | Abuse case / invariant | Owner plan | Blocking evidence | Status |
|---|---|---|---|---|---|
| T7-01 | Elevation / Information disclosure | History is read straight from the browser, so the project policy never sees a history request and no export is audited. Reads go through declared routes, enforced server-side, enumeration-filtered with the limit applied after filtering, and audited. | 07-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_history_routes.py -q -x` | ✅ verified |
| T7-02 | Denial | A query is unbounded in rows, entities and window, so one card can ask for every state of every entity for a year. Every bound is a configured number enforced before the query, and a request past a bound is refused with the limit named or answered from statistics and labelled. | 07-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_history_bounds.py -q -x` | ✅ verified |
| T7-03 | Spoofing / Safety | An empty or partial Recorder response is presented as a populated window: the range is set, the map is empty, and the chart draws a plot inside an axis that claims data. No data and a flat plant are distinguishable in the result and on the screen. | 07-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_series_coverage.py -q -x` | ✅ verified |
| T7-04 | Safety / Integrity | A gap is interpolated: non-numeric samples are dropped and the line is drawn across the hole, so an outage renders as a steady value. Gaps are carried in the result and the renderer breaks the line rather than crossing it. | 07-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_series_coverage.py -q -x` | ✅ verified |
| T7-05 | Safety | A missing binary sample is asserted to be off, so "I could not read the fault contact" is recorded as "the fault contact is healthy". An unreadable binary sample is indeterminate, never zero. | 07-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_series_coverage.py -q -x` | ✅ verified |
| T7-06 | Spoofing | Replaying a past moment shows the present: an entity with no history falls back to its live state, mixed into the same view as entities that do have history, with nothing distinguishing them. A replayed entity without history is shown as unknown at that instant. | 07-11 | `node --test test/replay-truth.test.mjs` | ✅ verified |
| T7-07 | Tampering / Correctness | Periods are aligned to the UTC epoch, so a "day" starts at 01:00 or 02:00 local and a transition day is the wrong length. Named periods resolve on local-calendar boundaries, proven against a committed corpus including 23- and 25-hour days and 743- and 745-hour months. | 07-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_period_resolution.py -q -x` | ✅ verified |
| T7-08 | Tampering | The browser axis and the server query disagree about a period boundary, so an engineer verifies one window and the report computes another. Both runtimes are compared byte for byte against the shared period corpus. | 07-07 | `node --test test/period-parity.test.mjs` | ✅ verified |
| T7-09 | Integrity / Safety | A window that begins before a statistic exists reports the entire accumulated total as the first period's consumption, because the Recorder's previous sum defaults to zero. A period outside the statistic's coverage is reported as out of coverage, never as consumption. | 07-12 | `py -3.13 -m pytest tests/components/glt_flow_card/test_energy_counters.py -q -x` | ✅ verified |
| T7-10 | Integrity | Cost is a cumulative meter reading multiplied by a price, with no period and no differencing, and the figure is labelled as the site's cost. A counter is differenced across the resolved period and a rate is integrated over it, and the two models are never converted into each other implicitly. | 07-12 | `py -3.13 -m pytest tests/components/glt_flow_card/test_energy_counters.py -q -x` | ✅ verified |
| T7-11 | Integrity | Units are displayed but never checked, so a meter in Wh and one in kWh contribute to the same total three orders of magnitude apart. Units are validated against the meter, the model and the price's denomination before arithmetic, and an incompatible pair is refused with a reason. | 07-13 | `py -3.13 -m pytest tests/components/glt_flow_card/test_energy_units.py -q -x` | ✅ verified |
| T7-12 | Safety / Integrity | An unavailable meter silently shrinks a total and an excluded medium silently shrinks a CO2 figure, so a month with half the meters offline reports a smaller, confident number. Every total carries coverage and states which sources it excluded and why. | 07-13 | `py -3.13 -m pytest tests/components/glt_flow_card/test_energy_units.py -q -x` | ✅ verified |
| T7-13 | Integrity | An angular quantity is averaged arithmetically, so a mean of 350 and 10 degrees is 180 -- exactly the opposite of the truth. The statistic's declared mean type is read and a circular quantity is either averaged circularly or refused. | 07-13 | `py -3.13 -m pytest tests/components/glt_flow_card/test_energy_units.py -q -x` | ✅ verified |
| T7-14 | Repudiation | A report is a snapshot of the current screen with a period label nothing reads, so a "monthly report" contains one instant and says so nowhere. A run records window, timezone, aggregate, deadband, sources and coverage, and re-running reproduces the value or names which input changed. | 07-14 | `py -3.13 -m pytest tests/components/glt_flow_card/test_report_runs.py -q -x` | ✅ verified |
| T7-15 | Repudiation | A report definition carries a schedule string that no parser, validator or runner reads, so a scheduled report never runs while the designer displays its automation. A schedule is validated at authoring time and executed by the same runner Phase 6 built, with every run recorded. | 07-15 | `py -3.13 -m pytest tests/components/glt_flow_card/test_report_schedule.py -q -x` | ✅ verified |
| T7-16 | Tampering / Integrity | The print view rebuilds its table by splitting the CSV, so a value containing a semicolon, newline or quote silently becomes extra columns or rows. Screen, CSV and print derive from one model and agree on values a serialisation round-trip would break. | 07-16 | `node --test test/report-renderings.test.mjs` | ✅ verified |
| T7-17 | Integrity | An export joins series by nearest neighbour at unbounded distance, so a sample from hours away is written into this minute's row with no marker. Exported rows carry the value measured in that interval or an explicit blank, never a borrowed one. | 07-16 | `node --test test/report-renderings.test.mjs` | ✅ verified |
| T7-18 | Repudiation / Integrity | Report ids are minted from the clock and exported series are silently thinned by a deadband the file does not record, so no export can be reproduced or even interpreted later. Ids are content-derived or authored, and every export states the aggregate, deadband and bounds that produced it. | 07-17 | `node --test test/report-renderings.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_report_runs.py -q -x` | ✅ verified |
| T7-19 | Elevation / Injection | An equipment name, KPI label or acknowledgement comment authored by one operator is rendered as markup to another in a report or a chart tooltip. Operator text is set as text content and never interpolated into markup, asserted in the shipped artifact. | 07-18 | `node tools/run-exact-dist-playwright.mjs --grep=phase-7-trends` | ✅ verified |
| T7-20 | Denial / Accessibility | A chart is the only way to read a trend and a state change is announced by colour alone, so a kiosk or screen-reader installation cannot read the plant's history. Every chart has a keyboard-reachable tabular alternative and every state is announced as text. | 07-18 | `node tools/run-exact-dist-playwright.mjs --grep=phase-7-trends` | ✅ verified |
| T7-21 | Validation | Every field the trend, energy and report code reads is undeclared, so `period: "sometimes"`, `deadband: "a bit"` and a meter with no model are schema-valid and fail at runtime inside a computed figure. Schema 6 closes all three shapes with a sequential 5-6 migration. | 07-03 | `node --test test/v100-migrations.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q -x` | ✅ verified |
| T7-22 | Spoofing / Integrity | The retired browser evaluators stay reachable but nothing fetches what replaced them, so a surface renders a confident zero while the authoritative value exists unread -- the defect Phase 6 shipped and this register must not repeat. Every retirement is proven by rendering the surface and reading the number, not by grepping the artifact. | 07-19 | `node tools/run-exact-dist-playwright.mjs --grep=phase-7-trends` | ✅ verified |
| T7-23 | Tampering / Supply chain | Authored source, generated card, Companion copy, HACS stage/ZIP, HA lanes, docs or release evidence diverge; or a test reaches a live Recorder or exceeds a declared query bound. Build once, compare exact bytes, install the exact stage, fail on any unintended effect. | 07-20 | `npm run test:phase7:release` | ⏳ planned |

## Evidence Status

Every row begins `planned`. This register is written before execution and no row
may be marked `verified` from planning alone, nor from its parts passing
separately, nor from a sibling row that names the same command.

### Closed on 2026-09-02

T7-01 through T7-22 are `verified`. Each was marked from **its own** owner
command, run at head, including the seven pairs and triples that name the same
command: `test_series_coverage.py` was run once for T7-03, again for T7-04 and
again for T7-05, and so on. T7-19, T7-20 and T7-22 each got their own
exact-dist run rather than one run credited three times.

**T7-22 is the paired outcome assertion the Blocking Rule demands**, and it was
not a formality. Its run found the register's own prediction come true: the
trend surfaces rendered a confident zero because only the panel fetched
anything, and `_seriesFor` still called the retired `aggregateSeries`. Both were
fixed in 07-19, and the assertion is mutation-verified in both directions —
removing the fetch fails the reached-not-reachable test, removing the throttle
turns ten renders into 23 Recorder queries.

### Blocked, with exact failures

Phase 6 closed having found **two** independent environment limits where it had
recorded one. Phase 7 found **four**, and records each with the output it
actually produced rather than its likely cause.

**1. The container's browser build predates the pinned Playwright.** The bare
owner command cannot launch a browser:

```
Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
```

`/opt/pw-browsers` holds revision **1194**; `@playwright/test` 1.62.1 wants
**1234**. The rows above were therefore run with the override
`playwright.config.mjs` documents for exactly this case
(`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`),
under which all 61 exact-dist tests pass and the twelve `phase-7-trends` tests
pass. **The marks above rest on that override, not on the bare command**, and
F7-04 in the phase gate — which does not set it — fails.

**2. GitHub API access is scoped to this session's own repository.** The cause
recorded in Phase 6, "`api.github.com` 403 through the egress proxy", is no
longer accurate and would have been carried forward unexamined.
`https://api.github.com/rate_limit` now answers **200**. What fails is every
third-party repository endpoint F-01 needs:

```
{"message":"GitHub access to this repository is not enabled for this session. Use add_repo to request access. ..."}
```

All five provenance sources return 403 (`microsoft/playwright`,
`gildas-lormeau/zip.js`, `ajv-validator/ajv`, `python-jsonschema/jsonschema`,
`MatthewFlamm/pytest-homeassistant-custom-component`), so
`node tools/verify-provenance.mjs --online` fails with
`Provenance verification failed: source metadata for @playwright/test request returned HTTP 403`.
This blocks F-01, and therefore the Phase-1 gate that every later gate recurses
into. Attaching five third-party repositories with credentials to satisfy a
provenance check would be a disproportionate permission change and was not done.

**3. No Docker engine, which is what blocks T7-23 here.**

```
failed to connect to the docker API at unix:///var/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /var/run/docker.sock: connect: no such file or directory
Error: no supported Home Assistant lane passed within 12 bounded candidates
```

Same reason T6-21, T5-16, T4-14, T3-14 and T2-16 stayed `planned`.

**4. In CI, T7-23's leaf fails for a different reason than it does here**, which
is why "likely cause" would have been wrong in both directions. The `ha-artifacts`
job fails at lane resolution with
`no supported pytest Home Assistant harness pins homeassistant==2026.9.0`:
Home Assistant 2026.9.0 was published 2026-09-02T16:23:17Z and
`pytest-homeassistant-custom-component` 0.13.362 still pins
`homeassistant==2026.9.0b6`. That is not this branch's failure and no resolver
change was pushed for it.

**T7-23 stays `planned`.** Its own owner command,
`npm run test:phase7:release`, was run at head and failed with limit 3 above.
It is not marked from its parts passing individually — the error Phase 5's
closure made and Phase 6's corrected.

## Effect Ledger Obligation

Phase 7 extends the effect ledger with a **query** dimension. The existing
dimensions are necessary and no longer sufficient: this phase's subject is a read
that is *intended*, and the question is whether it stayed inside its bounds.

For every test run the ledger records each Recorder request with its contract
(`statistics`, `statistic`, `raw`), entity count, window length and returned row
count. The phase gate asserts that no request exceeded the declared bounds, that
no request reached a live Recorder, and that every series rendered during the
suite carried a coverage value.

A test that reaches a live Recorder, or one that renders a number with no
coverage, is a HIGH finding and blocks release even if it passes.

## Blocking Rule

Phase closure may change a row to `verified` only when the listed owner command
passes, emits non-skipped behavioral evidence, and the Phase-7 evidence manifest
binds the command output to the exact generated artifacts. Any HIGH finding,
missing owner, skipped test, zero-test run, unbounded query, unbounded retention,
live Recorder, uncovered number, swallowed failure or non-zero unintended service
effect blocks release.

Two rules are carried forward from Phase 6's closure and apply to every row here:

**A row is marked from its own owner command, run at head.** Where two rows name
the same command, the command is run for each row rather than inferred from the
other's result.

**An artifact grep is not evidence that a surface works.** T6-05 was verified by
a command that proved the shipped bytes contained a call and the old evaluator
was inert, and three surfaces still reported a confident zero because nothing
reached that call. Any row whose evidence is a grep over `dist/` needs a second
assertion that renders the surface and reads the value. T7-22 exists to make that
a blocking requirement rather than a habit.
