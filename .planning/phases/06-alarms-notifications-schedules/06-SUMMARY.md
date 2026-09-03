# Phase 6 — Alarms, Notifications & Schedules

**Status:** complete. 20 of 20 plans implemented. 20 of 21 threats verified;
T6-21 blocked by an environment limit, recorded below.
**Requirements:** ALM-01, ALM-02, SCH-01

## What the phase found

Every earlier phase was scoped to something a developer could check by reading
the screen. This one was not. An alarm that never annunciates, a notification
nobody received and a schedule that skipped an hour all look identical, from
inside the product, to the same things working — because the product's own
report of them is the part that is wrong. Six of the defects below had been
shipping and reporting success.

**Shelving suppressed nothing.** The field was written in two places, cleared in
one, and read in *none*. A shelved alarm went on processing and went on
notifying while the interface said it was quiet. That is worse than the feature
being absent: an absent feature does not persuade an operator to stop looking.

**One entity's alarms shared the last one's delay.** The delay was a free
variable captured by a closure, so a five-second alarm on an entity that also
carried a five-minute alarm annunciated at five minutes.

**And the delay restarted on every intermediate active state.** A sensor that
moves every ten seconds and stays over its threshold has a permanent fault; the
delay chased the last change, and in a plant the last change never comes. The
alarm most worth raising was the one that could never raise.

**A restart looked like every alarm resetting at once.** Entities pass through
`unavailable` on the way up, `unavailable` was classified as inactive, and so a
restart cleared acknowledgement, cleared suppression and then re-notified
everything. `indeterminate` is the honest third answer: a vanished entity has
not returned to normal, and nobody knows what it is doing.

**Four evaluators disagreed about whether an alarm was active,** and the
authoritative one was displayed nowhere. **Four severity vocabularies disagreed
too**, so an alarm authored as `critical` in the editor was counted in no
roll-up at all.

**Every state change in the whole instance scanned every project × every
alarm.** **Retention had three separate leaks** — `schedule_runs` never pruned
because its cutoff comparison was inverted, `ack_alarm` appended history with no
cap, and `alarm_state` kept entries for alarms long since deleted.

**Notification failure was discarded twice over** — `blocking=False` threw the
result away and a bare `except` threw the exception away — and the service it
called was whatever the *project document* named, with no allowlist, while
schedules and controls both guarded theirs.

**Schedules had no boundary of their own.** They were edited as project config:
no route, no authorization, no audit, no enumeration filter, for the thing that
drives the plant. And they compared wall-clock strings, so 02:30 on the spring
transition silently never ran, while 02:30 on the autumn transition was saved
from firing twice only by a dedupe key that happened to be blind to the offset —
luck that fixing the broken prune comparison would have destroyed.

## What shipped

| Area | Result |
|---|---|
| Lifecycle | One backend evaluator; per-alarm anchored delays; `indeterminate` as a first-class state; a 60-second startup grace |
| Suppression | Maintenance, shelving, acknowledgement — consulted at the point of decision, and every suppressed decision names which one applied |
| Restart | Pending delays re-armed against their stored anchor; proven by a test that restarts, not one that asserts a guard exists |
| Index | Entity→alarm index rebuilt from exactly one place, every mutation path compared against a full rescan |
| Notification | Blocking call with an explicit timeout; service, target, outcome and error recorded for every attempt; per-site allowlist; an unlisted target is a *recorded refusal* |
| Schedules | Resolution to UTC instants with `fold`; own routes, authorization, enumeration filter and audit; capability read before an affordance is offered |
| Surfaces | Six elements in both languages; priority as word *and* shape; every operation reachable without a pointer |

Schema 5 closes the alarm and schedule shapes with a sequential receipted 4→5
migration in both runtimes.

## The decisions worth carrying forward

**A third answer beats a wrong second one.** `indeterminate` exists because
"unavailable" is neither active nor recovered, and collapsing it into either one
produced a restart that looked like a plant-wide reset.

**Compare instants, never wall clocks.** The DST corpus is committed and both
runtimes are compared **byte for byte** against it, not verdict for verdict.
Agreeing on every value while disagreeing on every byte is exactly what happened
first: `toISOString()` writes milliseconds and Python's `isoformat()` omits them
at zero.

**Resolve the preview where the runner runs.** Resolving in the browser answers
for the browser's timezone, and a browser in a different zone from the plant is
normal. The engineer must be shown what the runner will do.

**Refuse, do not cap.** A 90-day shelve request used to be trimmed to seven
silently, and the operator walked away believing the alarm was quiet for three
months. It is now refused with the reason.

**Filter, do not deny — and filter before you limit.** `schedules/list` returns
the caller's rows rather than refusing, because a refusal tells an unauthorized
caller that rows exist. The limit is applied *after* filtering, or it becomes a
count oracle.

**A failed delivery never touches the alarm.** Removing, downgrading or hiding
an alarm nobody could be told about would make the least deliverable alarm the
least visible.

**Policy is configuration; vocabulary is not.** Decided with the user on
2026-09-02. Sites differ, legitimately, about which classes they use and what
escalates — both configurable, every default conservative, each documented as a
site decision. They do not differ legitimately about whether the word in the
editor and the word in the roll-up are the same word. A fresh installation is
*silent and safe*, not silent and wrong: it annunciates on screen, writes
history, and reaches nobody.

**Assert the outcome, not the shape of the implementation.** One RED sentinel
demanded a `schedule_audit` module; the audit correctly lives in the manager, so
a correct implementation failed its own contract. The gap was rewritten to
assert the behaviour by AST. A contract that names a file rather than an effect
tests the plan, not the product.

**A grep cannot tell reachable from reached.** T6-05's owner asserted that the
shipped artifact contains `alarms/list` and that `activeAlarm` is inert. Both
held, and three surfaces still reported a confident zero, because the one place
that fetched the state was the panel that displayed it. The fix moved the fetch
to the card, throttled; the assertion moved to the exact-dist suite, where it
renders the card, opens nothing, and demands the state be there. An artifact
grep is the right test for *what shipped* and the wrong test for *what runs*.

## Limitations, stated

**T6-21 is `planned`.** Its owner is the composed `test:phase6:release` leaf.
Run at head here, `validate:hacs-staging` passes and `test:ha-artifacts` then
fails before any test runs: all twelve bounded lane candidates probe
`docker info`, and this container has no Docker engine. The row stays unmarked
because a composed leaf verified from its parts is a leaf nobody composed.
T5-16, T4-14, T3-14 and T2-16 stand unmarked for the same reason.

**Three or four alarm priority classes.** A site that uses four or five cannot
express that today. Extending the closed set is a schema change, not a setting,
and it is raised rather than taken.

> **Closed 2026-09-03.** The limitation rested on a conflation. The invariant
> the closed vocabulary established is *exactly one declared vocabulary, read by
> both runtimes* — it never required exactly three members. A site now declares
> its own ordered scale of two to six tiers in site **options** (not project
> documents, for the reason `notify_allowlist` is not project data), both
> runtimes resolve it from that one place, and the parity corpus compares every
> acceptance **and every refusal** across fourteen scales. A stored priority the
> site does not declare is reported, never silently re-tiered. A site that
> declares nothing is byte-identical to before, asserted rather than assumed.


**Measured capacity is still outstanding.** The index bounds the *shape* of the
scan cost. What it costs at thousands of alarms is Phase 10's measurement.

**Carried from Phase 5, still open:** two diagonal routes no lane offset can
separate; five `prompt()` calls on editor naming paths; the v040 extension parts
05 and 06 still absent from the shipped artifact.

## Evidence at head

- Node suite: 377 passed, 0 failed, 0 skipped.
- Companion suite: 463 passed. One test is deselected by design — the
  `escaping_notification` sentinel is *meant* to reach outside the fixture, and
  `test_notification_ledger` runs it as a subprocess and asserts that it failed.
- Exact-dist browser suite: 48 passed. The Phase-6 run reported `callService: 0`,
  `network: []`, `dialogs: []` and `scriptInsertion: []`, and reached the
  controlled fake notifier only.
- Documentation: 22 sources present, 41 generated files byte-identical twice.
- RED gate: 0 controlled RED, 14 implemented, 0 broken.
- Phase-6 gate: graph proven acyclic with exactly one path to the release leaf;
  F6-01 to F6-05 pass. F6-06 chains through the Phase-5, -4, -3 and -2 gates and
  bottoms out at Phase 1's `verify:provenance --online`, which needs
  `api.github.com`; this container's egress proxy answers `403` for that host
  while `registry.npmjs.org` answers `200`. The gate fails closed rather than
  skipping, which is the intended behaviour of a provenance check that cannot
  reach its source.

Both blocked commands are environment limits and they are independent: a
container with Docker but the same egress policy would still fail `F-01`, and
one with open egress but no Docker would still fail the release leaf.
