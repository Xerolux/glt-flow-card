# 06-04 Summary — the alarm RED contracts

**Status:** complete. Five controlled-RED sentinels, each accepted by
`tools/assert-red.mjs` for exactly its own named reason.

## Written so the defect cannot be satisfied by accident

| Sentinel | What makes it a real contract |
|---|---|
| `phase6-lifecycle` | Two alarms on one entity with **different** delays. One alarm passes on the broken code: with a single iteration the free `delay` variable happens to hold the right number. Also asserts `first_activation + delay`, not "annunciates eventually" — the naive implementation *does* annunciate, it just trails the last state change. |
| `phase6-suppression` | Asserts what shelving **did**, never that `shelved_until` is set. Asserting the field would pass today, which is the whole defect. Includes an expired shelf, which separates "shelving is implemented" from "shelving is stored". |
| `phase6-restart` | Requires a third classification. An entity that went `unavailable` has not returned to normal, and "cleared" is the one answer that is certainly wrong. Also requires a pending delay re-armed against its persisted anchor: a four-minute-old five-minute delay fires in one minute, not five. |
| `phase6-index` | Compares against an **independent full rescan written in the test**, never a second call to the builder. Comparing a function with itself proves determinism, not correctness. |
| `phase6-retention` | Reproduces the current prune and asserts it drops nothing. If that ever stops being true the test says so, rather than quietly measuring something else. |

Each sentinel collects *gaps* rather than asserting one at a time. A sentinel
that stops at the first missing behaviour tells the GREEN plan one item per run.

## The `expected_red` marker

The sentinels are deselected from the default suite by a registered marker, and
`npm run test:phase6:quick` selects them explicitly. A suite that is red for the
length of a wave stops telling anyone anything; the RED gate says which red is
intended and which is not.

This is a **selection, not a skip**: `assert-red.mjs` rejects a zero-test or
skipped run, so a sentinel that vanished fails the gate rather than passing
quietly. `pytest.ini` registers the marker under `--strict-markers`.
