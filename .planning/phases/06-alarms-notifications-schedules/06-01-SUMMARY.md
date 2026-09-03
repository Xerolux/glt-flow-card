# 06-01 Summary — the gate, the ledger and the corpus

**Status:** complete. `node --test test/phase6-gate.test.mjs` 31/31,
`npm test` 354/354, `npm run test:python` 338 passed + 1 deselected.

## Task 1 — the gate

`tools/verify-phase6.mjs` derives `PHASE_DIR`, `THREAT_PREFIX`, both roadmap
slice bounds, the plan regex, the outer script, the orchestrator tool and the
release leaf from one `PHASE = 6`. Nothing else names the phase.

The threat count is not a literal, and is not replaced by a different literal:
`readThreatRows` requires ids contiguous from `T6-01`, unique, and each carrying
an owner command. That is stronger than the count check it replaces — a register
missing `T6-07` entirely still has a plausible number of rows.

Mutation tests cover the three bugs Phase 5 inherited (collapsed slice bounds, a
previous-phase plan regex, a disagreeing threat count) plus the graph and
evidence failures. `assertCommandGraph` on the repository reports one path to
the leaf.

**Found while writing it.** Phase 5's own gate carries two cosmetic string bugs
inherited from Phase 4: its error message says "must be the owner command of
T5-14 alone" while it checks `T5-16`, and its closing line says "all fourteen
threat owners" while there are sixteen. Neither changes a verdict, and Phase 5
is closed, so `tools/verify-phase5.mjs` was left alone — recorded here so the
next reader does not think the numbers mean something. Phase 6's equivalents are
derived from the loaded register, so they cannot drift.

## Task 2 — the notification dimension

`NotificationLedger` records service, recipients and outcome for every
notification attempt. The containment check runs in the fixture's **teardown**,
which is the mechanism that matters: a test can assert everything it meant to
assert and still have reached a person.

`test_escapes_the_fixture_on_purpose` is a permanent, deselected test that
reaches outside the fixture and asserts nothing about it.
`test_a_passing_test_that_escaped_still_fails` runs it as a subprocess and reads
the outcome — pytest reports `1 passed, 1 warning, 1 error`, the body passing and
teardown failing it.

Both recipient shapes are read. The legacy per-service API names `target`; the
entity API names `entity_id`. A check on one leaves half the surface unread, and
a check on the *service* alone misses the subtler case: the fixture's own
notifier carrying a real phone number in its payload.

`pytest.ini` gained a `not escaping_notification` default selection and the
marker registration `--strict-markers` requires.

## Task 3 — the corpus

`alarm_factory.py` carries the evaluators it defeats, and the defeat is
executed:

| Naive implementation | What it gets wrong | Measured |
|---|---|---|
| `shipped_active_alarm` | no operator, threshold, hysteresis or delay | disagrees on 3 of 4 threshold fixtures |
| `last_delay_wins` | `delay` is free in the closure | collapses 5 s and 300 s onto 300 s |
| `restarting_delay` | re-arms on every change | trails the last change; lateness grows with the fault |

A membership alarm where both evaluators agree is included deliberately, so a
test cannot pass by asserting they always disagree. The `expected` column is
asserted against the *backend's* `_state_active`, so if the two ever diverge the
corpus is wrong rather than the engine.

The DST dates are verified against `Europe/Berlin` with `zoneinfo` rather than
trusted: 02:30 does not exist on 2027-03-28, is ambiguous on 2027-10-31, and an
ordinary day is present as a control.

## Not done here

The fourteen RED sentinels are registered in `tools/assert-red.mjs` but their
test files do not exist yet, so `node tools/phase6-red-gate.mjs` reports all
fourteen BROKEN. That is the expected state after wave 0; plans 06-04 and 06-05
create them. Phase 5 reported the same after 05-01.
