# 07-21 — The bucket grid, and the last two history routes

**Status:** complete. 458 Node, 527 Python tests pass. Phase 7 now has no open
carry-over.

## Why this was a plan and not an afternoon

Phase 7 closed with `history/coverage` and `history/export` as shells answering
a stated `unavailable`. That was the right call at the time: coverage is
measured against the grid a window *should* have produced, and the grid's bucket
step is a **decision**, not a derivation. Building it inside 07-18 would have
invented semantics no plan specified.

**The window and the bucket are different things.** A month at daily resolution
has 28–31 buckets; the same month hourly has 743, 744 or 745. Neither number is
derivable from the other without first saying which resolution was meant. So
`BUCKET_STEPS` is a closed table, mirrored in both runtimes and compared
directly by a test:

| Window | Step | Count |
|---|---|---|
| `day`, `day-previous`, `rolling-24h` | hour | 23, 24 or 25 |
| `week-mon`, `week-sun` | day | 7 |
| `month`, `month-previous` | day | 28–31 |
| `year`, `year-previous` | month | 12 |

**The grid is never derived from the answer.** The Recorder omits an empty
period entirely, so a grid built from the rows that came back reports a month
missing nine days as a complete 22-day month at full coverage. That is the
defect `expected_instants` exists to prevent, and it is exactly the error 07-10
had already made once.

## The arithmetic, and why it is three cases

An hour is added in **absolute** time: an hour is an hour on both sides of a
transition and only its wall-clock label moves. That is what makes a
spring-forward day 23 hourly buckets and a fall-back day 25.

A day and a month are stepped on the **local calendar** and handed back to the
zone. Adding a `timedelta` to an aware datetime is wall-clock arithmetic that
keeps the original offset, and would produce a 24-hour day where the calendar
says 23 — the same defect this module was written to fix, arriving from the
other side.

A **rolling** 24-hour window stays 24 hours even on a 25-hour calendar day,
because it is a duration. The calendar answer and the duration answer
deliberately differ here, and the corpus contains both so neither can be
"fixed" into the other.

## The corpus is proven three ways

A corpus checked only against the function that generated it proves determinism
and nothing else. So the invariants are computed **independently** of
`expected_instants`:

- Consecutive hourly instants are one *elapsed* hour apart — computed from the
  instants, not from the step that made them. A wall-clock implementation fails
  this at a fall-back transition, where two instants share a wall clock and two
  hours separate them.
- Every daily and monthly instant is a local midnight, and every monthly one is
  the first of a month. A constant 86 400 000 ms step passes for most of the
  year and puts 23:00 or 01:00 in the list exactly twice.
- The grid begins at the window start, never overruns its end, is ordered, and
  repeats nothing. An off-by-one appending the end would report one bucket more
  than the Recorder can return, so *every* complete answer would show a gap.
- The load-bearing numbers (23, 25, 31/745, 31/743, 12, 24) are additionally
  asserted as literals a human wrote, so a regression has to change a number a
  person chose rather than one the code produced.

22 cases across **Europe/Berlin**, **UTC**, **Australia/Adelaide** (half-hour
offset, southern-hemisphere transitions running the other way) and
**Pacific/Chatham** (+12:45), so a pass cannot be an artefact of one zone's
rules. Both runtimes are compared byte for byte.

## The routes

`history/coverage` resolves its period server-side in the **project's** declared
timezone (falling back to Home Assistant's), answers coverage *without* the
values — which is the whole reason it is a separate route from `series` — and
refuses an unknown period rather than defaulting, because a coverage figure for
"sometimes" would silently be a figure for today.

`history/export` returns the **model**, not a rendering: the three renderings
all derive from it, because deriving one from another's serialisation is the
defect 07-16 closed. It carries the grid, so a cell is filled only from a sample
inside its own interval rather than a borrowed neighbour, and the provenance
needed to interpret it a month later — aggregate, bounds, deadband, period,
start, end, step and timezone. It is audited with its row count *before* the
result is sent: an export that failed to audit must not be an export that
happened.

## One thing the test corrected

I asserted the export refusal would be `not_permitted`. It is
`not_found_or_denied`, and the difference matters: the route enumerates
`opaque`, so the refusal deliberately does not distinguish "there is no such
project" from "you may not export it" — a caller who learns which one applies
has learned the project exists. The generic guard denies before the handler
runs, so the handler's own capability check is a **backstop**, and now says so
rather than posing as the live path.

Mutation-verified: emptying the grid fails the coverage assertion.
