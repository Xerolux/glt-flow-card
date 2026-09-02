# 07-09 — Bounded queries, enforced

**Status:** complete. Both tasks verified at head. T7-02's sentinel is green.

## What was built

`history_bounds.py` with `resolve_bounds`, `decide_query` and `cap_rows`, and the
enforcement wired into the `history/series` and `history/statistics` handlers.

## The rule, and why it is a closed set

Three outcomes: `allow`, `downgrade`, `refuse`. **`truncate` is deliberately not
one of them** — it is the behaviour this module exists to make unreachable, so it
is not expressible rather than merely unused.

A refused query is visibly refused, and names the limit it enforced: a bare
refusal tells an engineer the tool disagrees with them, while a reason tells them
which of the two is wrong. A downgraded query says it was answered from
statistics, so the reader knows which contract produced the number. A silently
truncated one produces a chart of the wrong period that looks exactly like a
chart of the right one.

Over-long windows **downgrade rather than refuse**, because the caller asked a
question that is answerable — just not from raw states. Refusing would be correct
and unhelpful; truncating would be helpful and wrong.

## The defaults are argued, not picked

| Bound | Default | Why this number |
|---|---|---|
| `max_entities` | 40 | The chunk size the shipped code already used, so the default refuses nothing that worked before while giving the bound a name |
| `max_raw_window_hours` | 168 | A week, which is what a trend view is for; longer goes to statistics, which return one row per period rather than one per state change |
| `max_rows` | 50 000 | A response a browser can still render; beyond it the answer is a chart nobody can read, delivered slowly |
| `max_points` | 4 000 | The value `ensureV1` already wrote, now actually resolved |

A bound of zero or less is ignored rather than honoured: it is not a stricter
bound, it is a broken one, and it would refuse every query and read as an outage.

## What the work found

**A bound the handler does not consult is decoration that passes its own unit
test.** `decide_query` being correct proves nothing about the route. This phase
has already produced two instances of exactly that: 07-03 shipped `max_points` as
a declared field nothing read, and Phase 6 shipped a retirement whose replacement
no surface ever called.

So the sentinel gained two handler-level tests, and both were **mutation-checked**
rather than trusted. Removing the refusal from the handler makes them fail with
*"three entities passed a bound of two"*; restoring it makes them pass. A test
that proves a bound holds by never crossing it proves nothing — the Phase-4
defect this session already had to fix once.

`max_points` is now a resolved bound rather than the inert field 07-03 recorded
as a limitation. That limitation is closed.

## A convention worth stating

Three sentinel files lost their `expected_red` marker in this plan, because their
sentinels pass. They are regression suites now, not specifications of something
missing — and leaving the marker on would have quietly excluded five genuinely
green behaviour tests from the default suite, which the deselect count made
visible: 9 deselected became 11 when the new handler tests inherited the module's
marker.

The RED gate still classifies all three. It runs each file with filtering off, so
`assert-red.mjs` reports a sentinel that passes as *implemented* rather than as a
broken harness — which is why the marker can come off the moment the plan lands
rather than at phase closure.

## Evidence at head

- `py -3.13 -m pytest tests/.../test_history_bounds.py` — 3 passed, including
  both mutation-checked handler tests.
- `npm run test:python` — 504 passed, 6 deselected.
- `npm test` — 448 passed, 0 failed.
- `node tools/phase7-red-gate.mjs` — 7 controlled RED, 4 implemented, 0 broken.
