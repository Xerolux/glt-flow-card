# 07-12 — Two meter models, kept apart

**Status:** complete. Closes T7-09 and T7-10, plus a task the planning omitted.

A counter's consumption for a period is a **difference** across the period
boundary; a rate's energy is an **integral** over it. The two are never converted
into each other implicitly — Phase 6's interval-and-instant rule in a new
subject — and schema 6 makes `model` required so a meter cannot arrive without
saying which it is.

**Reset handling stays the Recorder's.** `change` is already a difference over a
reset-corrected running sum. Re-implementing meter reset detection would
duplicate a well-tested implementation and, since resets are rare and hard to
fixture, get it wrong in a way nobody notices for months. What this adds is the
thing the Recorder cannot know: which buckets were *asked for*, and therefore
which lie outside the statistic's own coverage.

**T7-09.** A window beginning before the statistic's first recorded row is
reported as out of coverage rather than as consumption. The Recorder defaults its
previous sum to zero there, so the first bucket's change is the entire
accumulated total — a plausible large number in the first period of the window,
not an error and not a null.

**T7-10.** A rate integral excludes gaps rather than integrating through them,
**and reports the excluded span**. The reporting matters as much as the
excluding: a total that quietly covers half a period is a smaller number
presented with the same confidence as a whole one.

## The task my planning omitted

07-08 declared the four history routes, 07-09 bounded them, 07-10 computed
coverage from an answer — and **no plan owned obtaining the answer**, so the
routes returned an honestly-sourced empty result. It was written into this plan
as task 3 and had to land before 07-18: a surface built on an always-empty series
would pass its own rendering tests and show an operator nothing, which is exactly
the failure T7-22 exists to block.

**I caught myself shipping decoration.** The first `_ask_recorder` returned the
request as its own answer. It satisfied the tests, looked wired, and queried
nothing — the defect this phase keeps finding in other people's code, and writing
it took about a minute. It now calls the real
`statistics_during_period` / `statistic_during_period` / `get_significant_states`
on the Recorder's own executor, because those are synchronous and touch the
database. A disabled Recorder is a supported configuration rather than a fault
and is reported as a stated outcome.

Expected instants come from the resolved period and are passed in, never derived
from the answer: the Recorder omits empty periods, so what came back is exactly
the thing that cannot say what was asked for.

**That test found a real defect in my 07-10 code.** The failure branch reported
coverage 0 with an *empty gap list*, so a renderer had nothing to break the line
across and would draw an unbroken nothing — a flat plant rather than an absent
one. A failed query now carries one gap spanning everything asked for: one
interval rather than one per bucket, because seven adjacent one-day gaps would
draw as seven breaks with six invisible segments between them.

---

*Written retrospectively during 07-20 from the plan's commits (b281f19, a3c15af); the summary was missed when the plan landed. Nothing here is recalled — every claim is taken from the committed message and the code at head.*
