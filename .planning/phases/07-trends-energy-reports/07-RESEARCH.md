---
phase: 07-trends-energy-reports
kind: research
flag: RESOLVED
resolved_at: 2026-09-02
against: Home Assistant 2026.2.3 (vendored)
---

# Phase 07 Research — Recorder contracts and valid period arithmetic

The roadmap's flag has two halves: pin the Recorder history and statistics
contracts across the supported lanes, and define what a valid energy or report
calculation, period and output limit is given those contracts.

Both are resolved below **by execution against the vendored Home Assistant
2026.2.3**, not by reading documentation. Where a number appears it was measured
by running the vendored code; the probes are reproduced so anyone can re-run
them.

The headline finding reverses part of the audit's framing, and it should shape
the plans: **Home Assistant already does correctly, server-side, most of what
the audit found us doing wrongly in the browser.** The defect is not that the
right arithmetic is hard. It is that we wrote our own instead of asking.

## 1. Which contracts exist

`recorder/websocket_api.py` registers eleven commands. Three matter here:

| Command | Shape |
|---|---|
| `recorder/statistics_during_period` | many ids, **required** `period` ∈ `5minute`, `hour`, `day`, `week`, `month`; optional `types` ⊆ {`change`, `last_reset`, `max`, `mean`, `min`, `state`, `sum`}; optional `units` |
| `recorder/statistic_during_period` | **one** id, `types` ⊆ {`max`, `mean`, `min`, `change`}, and a `PERIOD_SCHEMA` accepting `calendar`, `fixed_period` or `rolling_window` |
| `recorder/list_statistic_ids` | optional `statistic_type` ∈ {`sum`, `mean`}; returns the metadata below |

Raw states stay on `history/period` (REST) and `history/history_during_period`
(websocket).

**`year` exists, but not where you would look for it.** The plural command's
`period` enum stops at `month`. The singular command takes a
`CalendarStatisticPeriod` whose `period` is
`Literal["hour", "day", "week", "month", "year"]` plus an integer `offset` and a
`first_weekday`. So a yearly figure is one `statistic_during_period` call, not a
`statistics_during_period` call — and a naive reading of the plural command alone
concludes, wrongly, that the product must aggregate years itself.

**Statistics metadata** (`recorder/models/statistics.py:63`) carries
`mean_type`, `has_sum`, `unit_of_measurement` and `unit_class`. `mean_type` is
`StatisticMeanType`: `NONE = 0`, `ARITHMETIC = 1`, `CIRCULAR = 2`. The circular
case is real and matters for a plant — wind direction and any other angular
quantity, where an arithmetic mean of 350° and 10° gives 180°, the exact opposite
of the truth. `has_mean` is deprecated and is removed in 2026.4, so anything we
write reads `mean_type`.

## 2. Periods are already resolved in the site timezone

This is the finding that retires audit defect D9 rather than fixing it.

`reduce_week_ts_factory` and its day and month siblings build their bucket
boundaries with `datetime.fromtimestamp(tz=dt_util.get_default_time_zone())`,
and the source carries the comment *"We have to recreate `_local_from_timestamp`
in the closure in case the timezone changes"*. The boundaries are local
midnights, not UTC epoch multiples.

Measured for `Europe/Berlin` by calling the vendored factories directly:

| Period | Probe date | Resolved span |
|---|---|---|
| day | 2027-03-28 (spring forward) | `00:00+01:00 → 00:00+02:00` = **23.00 h** |
| day | 2027-10-31 (fall back) | `00:00+02:00 → 00:00+01:00` = **25.00 h** |
| day | 2027-06-15 (ordinary) | 24.00 h |
| week | 2027-03-22 … | **167.00 h** |
| week | 2027-10-25 … | **169.00 h** |
| week | 2027-06-14 … | 168.00 h |
| month | March 2027 | **743.00 h** |
| month | October 2027 | **745.00 h** |
| month | June 2027 | 720.00 h |

And `resolve_period` for the calendar specs, with "now" fixed at
2027-11-15 09:30+01:00:

| Spec | Resolved |
|---|---|
| `calendar: {period: year, offset: 0}` | 2027-01-01T00:00+01:00 → 2028-01-01T00:00+01:00 (8760 h) |
| `calendar: {period: year, offset: -1}` | 2026-01-01 → 2027-01-01 (8760 h) |
| `calendar: {period: month, offset: 0}` | 2027-11-01T00:00+01:00 → 2027-12-01T00:00+01:00 (720 h) |
| `calendar: {period: month, offset: -1}` | 2027-10-01T00:00**+02:00** → 2027-11-01T00:00**+01:00** (**745 h**) |
| `calendar: {period: day, offset: -1}` | 2027-11-14 → 2027-11-15 (24 h) |
| `calendar: {period: week, first_weekday: mon}` | 2027-11-15 → 2027-11-22 |
| `calendar: {period: week, first_weekday: sun}` | 2027-11-14 → 2027-11-21 |
| `rolling_window: {duration: 24h}` | 2027-11-14T09:30 → 2027-11-15T09:30 |

Every boundary is local midnight with the offset in force on that date, and the
fall-back month is 745 hours rather than 744.

Compare what ships: `Math.floor(x / bucketMs) * bucketMs` is always exactly
`bucketMs` long and aligned to the UTC epoch. For Berlin every "daily" bucket is
displaced by one or two hours year-round, and on a transition day it contains an
hour too much or too little of the wrong day. `bucket_minutes` cannot express a
month at all, and the report designer offers months and years.

**Consequence for the plan.** Named periods are delegated: `day`, `week`,
`month` to the plural command's `period`, and `year` (and offsets, and
`first_weekday`) to the singular command's calendar spec. The site timezone must
be Home Assistant's configured timezone, because that is what these functions
read; the preview must therefore resolve server-side, exactly as Phase 6's
schedule preview does and for the same reason.

## 3. `change` is already reset-aware, and we must not re-implement it

`statistics.py:1958` computes, per row: `statistics_row["change"] = _sum - prev_sum`,
where `sum` is the Recorder's running total for the statistic. The sensor
integration's statistics compiler maintains that total across meter resets
(via `last_reset` and `state_class: total_increasing`), so `change` over a period
is the reset-aware consumption for that period.

This retires the audit's demand that we build reset-aware meter arithmetic. We
would be duplicating a well-tested implementation and, given that resets are
rare and hard to fixture, almost certainly getting it wrong in a way nobody
notices for months.

**But `change` has a trap, and it is exactly this phase's failure shape.**
At `statistics.py:1947`: `prev_sum = prev_sums.get(statistic_id) or 0`. When the
window begins before the statistic's first recorded row — a sensor added last
week, queried for last year — there is no previous sum, `prev_sum` is `0`, and
the first bucket's `change` is *the entire accumulated total*. It is not an
error, not a null, and not obviously wrong: a plausible large number in the first
period of the window. This becomes a threat with its own owner: a period that
starts before the statistic exists must be reported as **out of coverage**, never
as consumption.

Note also `_sum is None → change = None`. Null is a legitimate answer from this
API and must survive to the surface as "no data", not be coerced to zero on the
way.

## 4. Gaps are omitted, not emitted

`_reduce_statistics` (`statistics.py:1116`) builds its output by walking the rows
that exist and grouping them by period. A period with no underlying rows produces
no row in the result — the API returns a shorter list, not a list with holes.

So the Recorder tells us *what it has*, and the absence of a bucket is the only
signal that data is missing. Every layer above must materialise the expected
buckets from the resolved period and mark the ones the Recorder did not return.
An implementation that maps the returned list straight onto a chart draws a
continuous line through the gap, which is audit defects D1, D6 and D10 arriving
by a new route. The coverage fraction is computed here — expected buckets against
returned buckets — and travels with the result.

## 5. `minimal_response` and raw states

Established in the source audit and repeated here because it constrains the raw
path: `minimal_response` omits `attributes` from every intermediate row
(`recorder/history/__init__.py:855` and its comment), and is bypassed only for
`NEED_ATTRIBUTE_DOMAINS` = {`climate`, `humidifier`, `input_datetime`,
`thermostat`, `water_heater`} (`recorder/history/const.py:15`).

An attribute-bound trend therefore works on a `climate` entity and returns two
usable points on a `sensor`, from identical code. Either the raw path requests
attributes when the point is attribute-bound and accepts the cost, or it refuses
the binding with a reason. Silently returning two points is not one of the two
acceptable answers.

## 6. What a bounded read is

Nothing in the Recorder API bounds a raw-state query: not rows, not entities, not
window. The bound is ours to impose, and it belongs on the server side of the
route because the browser cannot be trusted to ask for less than it wants.

The shape the plans should take, consistent with every other collection in this
product since Phase 2:

- A **maximum window** for the raw path, above which the request is answered from
  statistics or refused with a reason naming the limit — never silently truncated,
  because a silently truncated window produces a chart of the wrong period with
  no indication.
- A **maximum entity count** per request, refused rather than chunked invisibly.
- A **maximum row count**, with the response declaring whether it hit the cap.
- **Enumeration filtering** with the limit applied *after* filtering. Phase 6
  established the reason: applying a limit before filtering turns the limit into
  a count oracle for rows the caller may not see.

## 7. What this settles, and what it leaves open

**Settled by measurement.** The commands and their schemas; that `year` is
reachable only through the singular command's calendar spec; that day, week and
month boundaries are already local-timezone-correct, with 23/25-hour days and
743/745-hour months; that `change` is reset-aware; that a missing previous sum
silently yields the whole total; that gaps are omitted rather than emitted; and
that `minimal_response` splits attribute behaviour by domain.

**Left to the site, and to be defaulted conservatively.** The bound values
themselves — maximum window, maximum entities, maximum rows — are site
configuration in the same way Phase 6's alarm philosophy is. The pattern is
established: build the mechanism, configure the policy, default conservatively,
and document each default as a site decision rather than a product opinion.

**Not resolvable here.** Whether these contracts hold identically on the oldest
supported lane can only be proven by the lane matrix in `test:ha-artifacts`,
which needs a Docker engine this container does not have. The plans must
therefore state the contract they assume and assert it in the HA lanes, so a lane
where it differs fails loudly rather than silently computing a different number.

## Probes

Both are re-runnable through the repository's pinned interpreter and were the
source of every measurement above.

```
node tools/python-launcher.mjs <probe>
```

- `tools/research/phase7-probe-statistics-periods.py` calls
  `reduce_day_ts_factory`, `reduce_week_ts_factory` and `reduce_month_ts_factory`
  with the default timezone set to `Europe/Berlin`, and prints each resolved
  bucket with its span in hours.
- `tools/research/phase7-probe-resolve-period.py` fixes "now" at
  2027-11-15T09:30+01:00 and calls `resolve_period` for each calendar, rolling
  and fixed spec.

Both are committed rather than left as scratch files, so every number in this
document stays checkable by re-running it. Plan 07-01 turns their output into a
committed fixture corpus that the two runtimes are compared against.
