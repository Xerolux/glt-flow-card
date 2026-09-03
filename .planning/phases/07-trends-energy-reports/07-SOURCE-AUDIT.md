---
phase: 07-trends-energy-reports
kind: source-audit
requirements: [HIST-01, ENER-01, REPORT-01]
audited_at: 2026-09-02
---

# Phase 07 Source Audit

None of the three areas is greenfield. Trends, energy and reports all ship
today, they all render confidently, and every one of them answers a question it
was never given the data to answer.

That is the shape of this phase, and it is worth stating before the list. Phase 6
dealt with effects that reach a human and fail silently. Phase 7 deals with
**numbers that reach a human and are wrong in a plausible direction**. A chart
that draws a straight line through a six-hour outage does not look broken; it
looks like a steady plant. A cost figure computed from a cumulative meter
reading is not obviously absurd until someone checks the decimal point. An
operator cannot detect any of this from inside the product, because the product
does not know either.

Line references are to the authored sources — `src/generated-bases/glt-flow-card.base.js`
(the pre-v1 card body, a build input) and `src/v100/core.mjs` — not to `dist/`.

## A. History acquisition

**D1 — an empty response is presented as a full window.**
`base.js:441 _ensureHistory`. On success the method sets
`_historyRange = { start, end }` unconditionally, after `this._history.clear()`.
If Recorder is disabled, purged, or simply returns nothing for these entities,
the map is empty and the range still claims the whole window. The chart then
renders an empty plot inside a populated axis and the replay slider offers a
range with nothing in it. Nothing anywhere says "no data". *No data* and *a flat
plant* are drawn identically.

**D2 — attribute trends are structurally empty for most domains, and never say why.**
The request is built with `&minimal_response` (`base.js:457`). Read in the
vendored recorder (`recorder/history/__init__.py`, the `_sorted_states_to_dict`
branch at line 855 and its comment: *"With minimal response we only provide a
native State for the first and last response. All the states in-between only
provide the `state` and the `last_changed`"*), `minimal_response` omits
`attributes` from every intermediate row. `_seriesFor` (`base.js:787`) reads
`entry.attributes?.[field.attribute]` for an attribute-bound point and then
`.filter(Boolean)` drops every sample that came back `undefined`. An attribute
trend therefore renders two points, or none, and reports no error.

The nastier half is that it is not uniform. `minimal_response` is bypassed for
`NEED_ATTRIBUTE_DOMAINS` (`recorder/history/const.py:15`), which is exactly
`climate`, `humidifier`, `input_datetime`, `thermostat` and `water_heater`. So an
attribute trend on a `climate` entity works, and the identical trend on a
`sensor` renders two points — one behaviour, two outcomes, no explanation, and
the working case is the one an engineer is most likely to try first.

**D3 — the query is unbounded in every dimension that matters.**
Entities are chunked 40 at a time (`base.js:454`) but the number of chunks is
the number of entities on the card; the window is
`max(replay.hours, trend.hours)` defaulting to 168 (`base.js:445`); and raw
states have no row limit. There is no cap on rows returned, no cap on total
window, and no downgrade to statistics for long windows. The roadmap's
"unbounded exports" defect starts here, before any export.

**D4 — Recorder statistics are never used.**
`recorder/statistics_during_period` appears nowhere in the repository. Every
window, however long, is answered with raw states. This is the whole of the
"in-memory utility behaviour presented as a historian" defect: the product
offers trends, comparison ranges and periods while only ever holding a
browser-side array of raw states for one window.

**D5 — there is no server-side boundary on history at all.**
Every read is `this._hass.callApi("GET", "history/period/…")` from the browser.
The card's own project policy — the thing Phase 2 built and Phases 3 to 6 all
route through — never sees a history request. Whatever Home Assistant lets the
signed-in user read, the card reads, for every entity on the card, and no export
is audited. This is the only remaining product area that reads shared data with
no policy route.

## B. Series interpretation

**D6 — a gap is drawn as a straight line.**
`base.js:787 _seriesFor` coerces each sample with `numeric(raw)` and drops
`null` results with `.filter(Boolean)`. `unavailable` and `unknown` are not
numeric, so they vanish, and the chart connects the sample before the outage to
the sample after it. Six hours of missing data become a clean interpolation. The
"missing as normal" defect in its purest form: the fabricated value is not zero,
it is plausible.

**D7 — a missing binary sample is asserted to be off.**
Same function: `if (value === null && point.binary) value = ON_STATES.has(...) ? 1 : 0`.
`unavailable` is not in `ON_STATES`, so an unavailable binary point is recorded
as `0`. For a fault contact, "I could not read it" is recorded as "it is
healthy".

**D8 — replay of a past moment shows the present.**
`base.js:345 _stateAt` returns the *live* state when the entity has no series
(`if (!series || !series.length) return live`). Replaying last Tuesday shows
today's value for every entity Recorder did not keep, mixed into the same view
as entities that do have history, with nothing distinguishing them.

## C. Aggregation and periods

**D9 — buckets are aligned to the UTC epoch, so a "day" is not a day.**
`core.mjs:312 aggregateSeries` buckets with `Math.floor(p.x / bucketMs) * bucketMs`.
For `Europe/Berlin` a 24-hour bucket starts at 01:00 or 02:00 local, and on a
transition day the local day is 23 or 25 hours long. Phase 6 established exactly
this for schedules and proved it against a committed corpus; energy periods have
the same defect and the roadmap explicitly requires "reproducible day/month/year
boundaries". `bucket_minutes` cannot express a month or a year at all — the
periods the report designer offers are not expressible by the aggregator that
would have to compute them.

**D10 — an empty bucket produces no point, and the chart joins across it.**
Buckets are built only from samples present, so a period with no data is absent
from the output rather than present-and-empty. Downstream this is
indistinguishable from D6.

**D11 — `sum` over instantaneous samples is dimensionally meaningless.**
Same function, final ternary. Summing watt samples does not produce watt-hours;
the result depends on the sampling rate. It is offered next to `min`, `max` and
`avg` as though it were an equal choice.

**D12 — an unrecognised aggregate silently becomes the mean.**
The ternary chain ends in an unguarded `else`. `aggregate: "p95"` computes a
mean and reports no error.

**D13 — the deadband thins exported data without recording that it did.**
`src/v100/index.js:171` wraps `_seriesFor` so every consumer — chart *and* CSV
export — receives the deadbanded series. The export carries no note of the
deadband, the aggregate or the bucket, so the same file cannot be reproduced or
even interpreted later.

## D. Energy

**D14 — cost is a cumulative meter reading multiplied by a price.**
`core.mjs:331 energySummary` reads `Number.parseFloat(st.state)` and computes
`value * price_per_unit`. For a lifetime kWh meter reading 148 231 this reports a
cost of 148 231 × price and labels it, in `v1-addons.js:10`, as a
"Kostenindikator … aus aktuell konfigurierten Zählerständen". There is no period,
no difference between two readings, and no reset handling of any kind.

**D15 — units are displayed but never checked.**
Same function: the unit is read from the entity for *display*
(`st?.attributes?.unit_of_measurement || m.unit`) and never compared against
`m.unit` or against the unit the price is denominated in. A meter in Wh and one
in kWh contribute to the same euro total, off by three orders of magnitude.

**D16 — an unavailable meter silently shrinks the total.**
`if (!Number.isFinite(value)) continue`. A month in which half the meters were
offline reports a smaller cost, confidently, with no coverage statement. The
caller cannot distinguish "no meters configured" from "no meters readable".

**D17 — CO2 exists only for electricity, silently.**
`m.kind === "electricity"` gates the factor. Gas and district heat produce
`null` with no indication that the figure excludes them, while the panel totals
present one CO₂ number for the site.

**D18 — integration runs straight through gaps and mis-reads units.**
`core.mjs:324 integrateEnergy` trapezoid-integrates consecutive samples. Two
samples six hours apart contribute `(y₁+y₂)/2 × 6 h` as though the plant ran at
their average throughout — fabricated energy, again in a plausible direction.
Its `unit` argument recognises only `MW`, `kW` and an implicit `W`; every other
unit falls through to the factor `1`, so a `BTU/h` sensor is integrated as
watts. It returns a bare number with no unit, no period and no coverage.

## E. Reports

**D19 — a "report" is a snapshot of the current screen.**
`base.js:5429 reportCsv` iterates `card._config.kpis`, `alarms` and `assets` and
writes `card._display?.(…)` — the value being rendered right now. The designer
offers day, week, month and year (`v1-addons.js:12`); nothing downstream reads
`period`. A "Monatsbericht" contains one instant, and says so nowhere.

**D20 — a scheduled report never runs.**
`v1-addons.js:12` collects `schedule` from a free-text `prompt()`
("Automatik (z.B. 1 07:00) oder leer") and stores it on the definition. No
parser, no validator and no runner reads it. The designer's table renders the
string back to the operator under the heading "Automatik", which is the entire
extent of the feature.

**D21 — the print view reconstructs the table by splitting the CSV.**
`base.js:5436 printReport` calls `reportCsv`, then rebuilds rows with
`csv.split("\n")` and cells with `line.split(";")`, then strips surrounding
quotes with `replace(/^"|"$/g, "")`. Any value containing `;` — a German decimal
list, an equipment name, an acknowledgement comment — becomes extra columns; any
value containing a newline becomes extra rows. The CSV quoting that `csvCell`
correctly applied is discarded rather than parsed.

**D22 — the trend export joins by nearest neighbour at unbounded distance.**
`base.js:5418 trendCsv` builds a union of all timestamps and, for each entity and
each timestamp, picks the sample minimising `Math.abs(x.x - ts)`. There is no
maximum distance. A sample from four hours away is written into the row for this
minute with no marker, so the exported file states values that were never
measured at the times it attributes them to.

**D23 — report ids are minted from the clock.**
`report_${Date.now()}` (`v1-addons.js:12`). Phase 5 found and fixed exactly this
in paste: a clock-derived id is not reproducible and collides within a
millisecond. Reports are the one artefact in the product that is explicitly
required to be reproducible.

**D24 — three `prompt()` calls on the report authoring path.**
Name, period and schedule are each a `window.prompt`. Phase 5 recorded five
remaining `prompt()` calls on editor naming paths; these are three of the same
class, on a path that also validates nothing it collects.

## What this means for the plan

Four things follow, and they should shape the wave order rather than be
rediscovered during execution.

**The server has to own history.** D5 is not one defect among twenty-four; it is
the reason most of the others cannot be fixed where they live. Bounds (D3),
statistics (D4), local-calendar periods (D9), coverage (D1, D16) and audit are
all server-side concerns, and the browser cannot be the place they are decided.

**Coverage is a first-class output, not a warning.** D1, D6, D7, D10, D16, D18
are one defect wearing six costumes: every one of them turns *absent* into a
number. Every series, every period total and every report figure needs a
coverage fraction and a gap list travelling beside it, and a renderer that
refuses to draw across a gap.

**A period is a local-calendar object.** D9 makes this Phase 6's DST lesson
again, and the resolution should reuse it rather than reinvent it: resolve
periods server-side in the site timezone, prove both runtimes agree byte for
byte against a committed corpus of transition dates.

**Reproducibility is what a report is for.** D13, D19, D20, D21, D22, D23 all
say the same thing: what shipped is a screenshot with a filename. A report has to
record its inputs — window, timezone, aggregate, deadband, coverage, provenance —
and rerunning it must either reproduce the number or say which input changed.
