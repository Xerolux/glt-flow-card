# 07-18 — Ship the six trend surfaces

**Status:** complete. 455 Node, 510 Python, 59 exact-dist browser tests pass.

## What shipped

`src/v100/project-trends.js` defines six custom elements, registered and
present in the exact artifact: `glt-flow-card-coverage-badge`, `-trend-chart`,
`-trend-table`, `-period-picker`, `-energy-summary`, `-report-designer`.
`test/e2e/project-trends.spec.mjs` holds them to `07-UI-SPEC.md` in ten tests,
all in the `phase-7-trends` grep group.

The assertions that carry weight, and why each is structural rather than
textual:

- A gap is **two** `[data-segment]` spans, not one styled differently. Counted,
  because dashed, lighter and a tooltip all render identically on a monochrome
  kiosk and in forced colours.
- Coverage is stated at 100 %, so the badge's absence never comes to mean
  "we forgot to check".
- The keyboard table marks a gap as `[data-gap-row]` carrying its interval —
  not a blank cell, not an omitted one.
- Injection is asserted by structure (`querySelectorAll("img").length`, `on*`
  attributes, `window.__pwned`) **and** by the text still reaching the reader.
  Escaping that also swallows the name would pass a structural check alone.

## Four defects this plan found

**The exact-dist runner skipped the new spec entirely.** Its spec list is
hard-coded; `project-trends.spec.mjs` was not on it, and the run returned
"No tests found" — a suite that runs nothing reports success, which is the same
confident-zero shape as the alarm-state and Phase-4 defects. The list stays
explicit so run order is stated rather than inherited from directory order, but
the runner now refuses when the list and `test/e2e/` disagree, and names the
drift. Mutation-verified: removing the entry fails with
`unlisted on disk: test/e2e/project-trends.spec.mjs`.

**The chart closed a line over a gap.** It broke a segment only on a null
point, so a hole expressed as a declared gap between two present readings drew
as one unbroken run — exactly the "six-hour outage drawn as a steady line"
defect. The series is not promised to be padded with nulls across a hole, so a
break depending on that padding closes the line over the absence the Companion
just reported. `gaps` is authoritative now. An unparseable timestamp on either
side also breaks: joining two readings whose order cannot be established draws
a continuity nobody measured.

**`glt_flow_card/history/statistics` was a shell.** It built no request, asked
the Recorder nothing, and returned a hard-coded empty series — while 07-08's
summary recorded four routes as shipped. Its answer was *honest*
(`source: "unavailable"`), which is precisely why a string assertion could not
separate it from a working route that found nothing. It now mirrors the raw
route and takes `expected_instants` for the same reason that route does.
The new assertion discriminates on the **gap**, which a route that never asked
cannot produce; reverting the handler to the shell fails it.

**The browser named no history route at all.** The surfaces render what they
are given, and nothing loaded them — retiring the card's own Recorder call
(D9) had left no replacement in the product. `loadHistory` calls the two routes
and a trends panel reaches it, so they are exercised rather than merely present
as strings. A failure returns a stated `unavailable` source rather than
throwing, because a correct empty answer and a broken one look identical on an
axis. `ws()` now passes a fully qualified type through unchanged, so a call
site can name the exact wire route it depends on.

## Left undone, deliberately

`history/coverage` and `history/export` are still shells returning stated
`unavailable`. Coverage needs the period's **expected instants**, and that
grid's bucket step is a decision that wants a corpus behind it — inferring it
from the rows that came back is the defect `expected_instants` exists to
prevent (the same error 07-10 corrected). Half-implementing it here would have
invented an API no plan specifies. Both routes say they have no answer, which
is the one thing they must never get wrong. **This is open work for 07-19/07-20
or a new plan, not a closed item.**

## Bearing on 07-19

07-19 must prove every retired value is *reached*. `loadHistory` now has a
caller, but the trends panel fetches on open and is **not throttled** — the
alarm path needed `ALARM_REFRESH_MS` for exactly this, and the same burst
assertion is owed here.
