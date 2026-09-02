---
phase: 07-trends-energy-reports
status: planned
kind: ui-contract
---

# Phase 07 UI Contract

Written before implementation, as in Phases 4, 5 and 6, so the surfaces are
designed against a stated contract rather than described afterwards.

One rule governs everything below, and it is the phase's whole subject:
**the screen never shows a number without showing what it is a number of.**
A value, its unit, its period and its coverage travel together or none of them
appears.

## Elements

Six custom elements, defined in the generated artifact:

| Element | Purpose |
|---|---|
| `glt-flow-card-trend-chart` | One or more series over a resolved period, with gaps broken rather than crossed |
| `glt-flow-card-trend-table` | The keyboard-reachable tabular alternative to every chart |
| `glt-flow-card-coverage-badge` | Coverage and gaps for one series or one total, as text |
| `glt-flow-card-period-picker` | Named periods, offsets and a custom range, with the resolved boundaries shown |
| `glt-flow-card-energy-summary` | Per-medium totals with unit, period, coverage and exclusions |
| `glt-flow-card-report-designer` | Report definitions, their runs, and the inputs each run recorded |

Every element renders in German and English, and every string is written out in
both languages rather than assembled from fragments. Phase 6 established that: a
sentence built from pieces reads like a machine wrote it in whichever language it
was not designed in.

## The chart

**A gap is a break, never a line.** This is the single most important pixel in
the phase. The renderer receives gaps in the series and draws no segment across
them. A dashed segment, a lighter colour or a tooltip is not sufficient — on a
monochrome kiosk and in forced colours those are all the same line.

**Coverage is on the chart, not behind it.** Every chart shows its coverage as
text near the title: *"Abdeckung 94 % · 3 Lücken"*. A chart at 100 % says so
too, so that the absence of the badge never means "we forgot to check".

**Nothing is distinguished by colour alone.** Series are distinguished by colour
*and* by a marker shape and a label, the way Phase 6 gave alarm priorities a word
and a shape. A control room may be monochrome, a viewer may be colour-blind, and
forced-colours mode discards the palette entirely.

**The period is stated, resolved.** The chart names the period it is showing with
its resolved boundaries and offset — *"Oktober 2027 · 01.10. 00:00 MESZ bis
01.11. 00:00 MEZ · 745 h"* — because a month is not always 720 hours and the
engineer must be able to see which month, in which zone, at which offset.

**The source is stated.** *"aus Langzeitstatistik"* or *"aus Rohwerten"*. The two
answer subtly different questions and the reader is entitled to know which one
they are looking at.

## The tabular alternative

Every chart has one, reachable by keyboard, exposing exactly the values the chart
plots — not a rounded summary. A gap appears as a row marked as a gap, with its
interval, not as a blank cell and not as an omitted row.

This is not a concession for a minority. Phase 4 established that the control-room
kiosk has no pointer at all; there, the table is the only way to read a trend, and
a chart-only trend is a trend that installation cannot use.

## The period picker

Named periods (`Tag`, `Woche`, `Monat`, `Jahr`), an offset (*"voriger Monat"*),
and a custom range. On every choice it shows the **resolved** boundaries in the
site timezone, before the query runs.

It says the two sentences a reader cannot derive from a date field, both written
out in full in both languages:

> Dieser Tag hat 23 Stunden — die Zeitumstellung fällt hinein.

> Dieser Monat hat 745 Stunden — die Zeitumstellung fällt hinein.

The resolution is **server-side**, for the same reason Phase 6's schedule preview
is: resolving in the browser answers for the browser's timezone, and a browser in
a different zone from the plant is normal.

## The energy summary

One row per medium, never one number across media. Each row carries value, unit,
period, coverage, and — when a source was excluded — which one and why.

A total that excluded something says so **in the total's own row**, not in a
footnote: *"1 240 kWh · Abdeckung 87 % · 2 Zähler ohne Daten"*. The current
product silently shrinks a total when a meter is unavailable, which is the defect
that makes a quiet month look like a cheap one.

A refused unit pair is shown as a refusal with its reason, not as a missing row:
*"Zähler in Wh, Preis in €/kWh — nicht verrechenbar"*. Phase 5 established that a
bare refusal tells an engineer the tool disagrees with them, while a reason tells
them which of the two is wrong.

## The report designer

Definitions carry a name, a period, selected content, formats and an optional
schedule. Every one of those is a **form field**, not a `window.prompt`: the
three prompts on this path today collect values nothing validates.

Each definition lists its runs, and each run shows the inputs it recorded —
window, timezone, aggregate, deadband, coverage, sources. A run whose re-execution
would differ says which input changed, before the operator asks for it again.

A schedule is validated when it is authored, with the invalid case explained at
that moment rather than discovered at the time it should have run. This is Phase
6's rule for schedule times, applied to the same class of field.

## Operator text is text

Report names, KPI labels, equipment names and acknowledgement comments are set as
text content and never interpolated into markup — asserted in the shipped
artifact, in the exact-dist suite, because Phase 5 found retirements that existed
only in files nobody ships.

The test asserts **structure, not substrings**: whether the browser parsed
something as markup, meaning an element that exists or an attribute that got
attached. Escaped text still contains `onerror=` as characters, so a substring
search fails a correct implementation — Phase 6 lost a cycle to exactly that.

And escaping must not mean discarding: the operator's words still have to reach
the person reading them.

## Every value is reached, not merely reachable

Phase 6's closing lesson, written into this contract as a requirement rather than
an aspiration. The exact-dist suite renders each surface, opens nothing, and
reads the numbers on it. A surface that displays a confident zero because nothing
fetched the authoritative value fails, even when the artifact contains every call
it needs.

## Print

The print view is a rendering of the model, not a re-parse of the CSV. It carries
the same period, coverage and source statements the screen does — a printed
report handed to someone who cannot ask a follow-up question needs them more, not
less.
