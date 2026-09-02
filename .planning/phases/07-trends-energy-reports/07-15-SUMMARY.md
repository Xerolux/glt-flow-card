# 07-15 — Report schedules are validated and resolved by one runner

**Status:** complete. Closes T7-15 (D20).

The designer collected a schedule from a free-text `prompt()`, stored it, and
rendered it back under the heading "Automatik". No parser, no validator and **no
runner** read it — so the product displayed an automation that did not exist.
That is Phase 6's shelving defect in a new place: a feature that reports success
and does nothing is worse than one that is missing, because the operator stops
checking.

**Validated at authoring time**, with its own refusal reason. A free-text string
is refused *as free text* rather than folded into "invalid": the operator typed
what the old designer asked them for, and telling them that shape is not a
schedule is a different message from telling them their time is wrong.

**One runner.** Resolved through the same `schedule_time` the plant schedules
use, so a report scheduled for 02:30 on a transition date gets the same answer
the plant does, including the nonexistent and ambiguous cases. A second scheduler
would certainly get those wrong, and would certainly get them wrong differently.

Every run is recorded, successful or not — the shipped path recorded nothing, so
a report that never ran and one that ran and failed were the same absence of
evidence. `skipped` is distinct from `failed`: a schedule that did not fire
because its date does not exist is not one that tried and could not.

## I deferred to the sentinel this time, and it was right

I had accepted an empty schedule string as "no schedule". Absence of the key is
how a report says it runs on demand; an **empty string** is what the shipped
designer stores when the operator leaves the prompt blank, and the 5→6 migration
quarantines it. By the time one reaches the validator something has gone wrong,
and accepting it would let a bug that blanks the field look exactly like a
deliberate choice. The sentinel now asserts both halves so neither can be relaxed
back.

`is_wall_time` is promoted out of `schedule_time` rather than the regex
duplicated. Two validators written from the same intent are how they start
disagreeing about 24:00.

---

*Written retrospectively during 07-20 from the plan's commits (c3e5ba7); the summary was missed when the plan landed. Nothing here is recalled — every claim is taken from the committed message and the code at head.*
