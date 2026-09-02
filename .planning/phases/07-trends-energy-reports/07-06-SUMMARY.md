# 07-06 — Local-calendar period resolution

**Status:** complete. Both tasks verified at head. T7-07's sentinel is green.

## What was built

`custom_components/glt_flow_card/period_resolution.py` resolves the nine corpus
specs — day, week with either first weekday, month, year, each with an offset,
plus a rolling window — to a start, an end and a span, in the site timezone.

`src/v100/period-resolution.mjs` mirrors it for display only, and is structurally
incapable of issuing a query.

## Three bugs, one shape

Every one was caught by the sentinel and every one produced **a plausible number
that no assertion about the result's structure would have caught**. That is this
phase's whole thesis, and it took three tries to get right in the module written
to embody it.

**Adding a timedelta to a zone-aware datetime is wall-clock arithmetic.**
`datetime(2027, 10, 31, tzinfo=BER) + timedelta(days=1)` is
`2027-11-01T00:00+02:00` — an offset that does not exist on that date. The
boundaries are built from calendar `date` arithmetic instead, letting the zone
decide the offset when the midnight is constructed.

This is the shipped defect arriving from the other side. `Math.floor(x / bucketMs)`
gives a constant-length bucket by dividing epoch milliseconds; adding a timedelta
gives a constant-length bucket by ignoring the transition. Both produce 24-hour
days in a year that contains a 23 and a 25.

**CPython subtracts same-zone aware datetimes as if they were naive.**
`datetime.__sub__` short-circuits when `self.tzinfo is other.tzinfo`. So

```
datetime(2027, 11, 1, tzinfo=BER) - datetime(2027, 10, 31, tzinfo=BER)  ==  24 hours
```

while converting both to UTC gives 25. The two instants print their own offsets,
`+01:00` and `+02:00`, on their face.

The instructive part: **the boundaries were already correct when the span was
wrong.** Every start and end matched the corpus exactly, and only the derived
number was off — by exactly the hour this phase is about. A test that checked
the boundaries and trusted the span would have passed.

**A rolling window is a duration.** Subtracting 24 hours in wall-clock time is
wrong twice a year by an hour. It is subtracted in UTC and brought back.

## The browser has no timezone database

`Intl.DateTimeFormat` with `timeZoneName: "longOffset"` is the only way to ask a
browser for a zone's offset without shipping one, and it must be asked **at an
instant**. Local midnight is therefore resolved in two passes: the first uses the
offset at the naive instant, which is the wrong side of a transition for
wall-clock times near one; the second uses the offset the first pass produced.

Stated as a rule, because it is the root of every defect in this area: *the
offset is a property of a zone at a moment, not a property of a zone.*

## Evidence at head

`py -3.13 -m pytest tests/.../test_period_resolution.py` — passes; all 36 corpus
entries resolve to the boundaries and spans the vendored Home Assistant produced,
including 23- and 25-hour days, 167- and 169-hour weeks, and 743- and 745-hour
months.
