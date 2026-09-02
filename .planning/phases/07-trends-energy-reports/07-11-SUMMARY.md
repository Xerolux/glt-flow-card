# 07-11 — Replay reads the record, not the present

**Status:** complete. Closes T7-06 (D8).

`_stateAt` returned the **live** state when an entity had no series, so replaying
last Tuesday showed today's value for everything the Recorder did not keep —
mixed into the same view as entities that do have history, with nothing
distinguishing them.

Worth being precise about why that is the most misleading possible wrong answer:
it is not corrupt, not stale, and not obviously missing. It is **the correct
current value of the right entity, presented as the value at a time it was never
measured.** Nothing about it looks wrong.

An entity with no recorded history is now a stated unknown with a reason, in both
languages — Phase 6's `indeterminate` decision applied to history. A vanished
entity has not returned to normal, and an entity with no history was not in its
present state last Tuesday.

Samples that all *postdate* the instant asked about are also unknown rather than
answered with the earliest one: reporting a value from after the question is the
nearest-neighbour defect from the export path (D22) wearing a different hat.

`live` is still accepted so the function drops in where `_stateAt` was, and is
deliberately never read. `isResolved` is the single call site for the question
every surface must ask, so a surface cannot forget to and quietly render `null`
as a blank that reads as zero.

`replay-truth.test.mjs` moved out of the RED exclusion list into the regression
run.

---

*Written retrospectively during 07-20 from the plan's commits (42070e6, c053df3); the summary was missed when the plan landed. Nothing here is recalled — every claim is taken from the committed message and the code at head.*
