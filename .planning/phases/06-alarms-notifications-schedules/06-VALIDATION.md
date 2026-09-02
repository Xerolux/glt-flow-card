---
phase: 06-alarms-notifications-schedules
status: planned
requirements: [ALM-01, ALM-02, SCH-01]
---

# Phase 06 Validation Map

The gate parses the table below. Six columns, and the threat cell carries every
threat the row's command proves, so coverage is checked against the register
without the two documents having to word anything identically.

## Requirement coverage

| Requirement | Threats | What is proven | Kind | Command | Status |
|---|---|---|---|---|---|
| ALM-01 | T6-18 | Alarm and schedule shapes are closed by schema 5, with a sequential 4→5 migration | Dual-runtime contract | `node --test test/v100-migrations.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q -x` | ⏳ planned |
| ALM-01 | T6-17 | One closed priority vocabulary, migrated from the four that disagree, counted identically by editor and roll-up | Dual-runtime contract | `node --test test/alarm-vocabulary.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_vocabulary.py -q -x` | ⏳ planned |
| ALM-01 | T6-02, T6-03 | Each alarm keeps its own delay, the delay is anchored to first activation, and hysteresis and transitions are exercised under controlled time | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_lifecycle.py -q -x` | ⏳ planned |
| ALM-01 | T6-01 | Shelving, maintenance and acknowledgement suppress at the point of decision, and the decision records which one applied | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_suppression.py -q -x` | ⏳ planned |
| ALM-01 | T6-04 | A real restart does not re-notify, un-acknowledge or un-shelve, and pending delays are re-armed | Lifecycle | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_restart.py -q -x` | ⏳ planned |
| ALM-01 | T6-06 | The entity→alarm index is rebuilt from one place and matches a full rescan through every mutation path | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_index.py -q -x` | ⏳ planned |
| ALM-01 | T6-16 | History, schedule-run state and alarm state are bounded and reconciled, with the bound a configured number | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_alarm_retention.py -q -x` | ⏳ planned |
| ALM-01 | T6-05 | The backend is the only evaluator; the shipped card renders it and its own evaluator is retired reachable and inert | Exact artifact | `node --test test/shipped-alarm-truth.test.mjs` | ⏳ planned |
| ALM-02 | T6-07, T6-08, T6-09 | Every attempt records service, target, outcome and error; targets are an explicit allowlist; a delivery failure never hides the alarm | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_notification_delivery.py -q -x` | ⏳ planned |
| ALM-02 | T6-10 | Immediate and delayed escalation reach only configured targets, deduplicate across restart, and default to nobody | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_escalation.py -q -x` | ⏳ planned |
| SCH-01 | T6-11 | Schedules resolve to UTC instants across the lost and ambiguous hours, without relying on the dedupe cache for correctness | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_schedule_dst.py -q -x` | ⏳ planned |
| SCH-01 | T6-12 | The browser preview and the Python runner produce identical resolutions over the committed transition corpus | Dual-runtime contract | `node --test test/schedule-dst-parity.test.mjs` | ⏳ planned |
| SCH-01 | T6-13, T6-14 | Schedule routes are declared in both policy tables, enforced server-side, enumeration-filtered, and every edit and execution is audited | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_schedule_routes.py -q -x` | ⏳ planned |
| SCH-01 | T6-15 | Holidays, exceptions, vacations, special days and operating periods bind to supported HA capabilities, and capability is read before an affordance is offered | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_schedule_bindings.py -q -x` | ⏳ planned |
| ALM-01, SCH-01 | T6-19, T6-20 | The alarm and schedule surfaces are operable without a pointer in both languages, announce state changes, and never interpolate operator text into markup | Exact artifact | `node tools/run-exact-dist-playwright.mjs --grep=phase-6-alarms` | ⏳ planned |
| ALM-01 | T6-21 | Authored source, generated card, stage, lanes and release evidence agree, and no test reached a real recipient | Release | `npm run test:phase6:release` | ⏳ planned |

## Success-criterion coverage

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Controlled-time tests and the runtime UI agree on priority, condition, delay, hysteresis, states, comment, shelving expiry, maintenance suppression, bounded history and context links across restart | `test_alarm_lifecycle.py`, `test_alarm_suppression.py`, `test_alarm_restart.py`, `test_alarm_retention.py`, exact-dist `phase-6-alarms` | planned |
| 2 | Multiple alarms on one entity keep their own delays, cancel deterministically, suppress shelved and maintenance occurrences, and reactivate after clear, ack, restart and simultaneous changes | `test_alarm_lifecycle.py`, `test_alarm_suppression.py`, `test_alarm_restart.py`, `test_alarm_index.py` | planned |
| 3 | Immediate and delayed escalation reaches only configured services, records every attempt and result, avoids restart duplicates, and surfaces failure without hiding the alarm | `test_notification_delivery.py`, `test_escalation.py` | planned |
| 4 | Weekly schedules, holidays, exceptions, vacations, special days and operating periods bind through supported HA capabilities, preview across timezone and DST, and audit failures | `test_schedule_bindings.py`, `test_schedule_dst.py`, `test_schedule_routes.py`, `test/schedule-dst-parity.test.mjs`, exact-dist `phase-6-alarms` | planned |
| 5 | Python and exact-card tests exercise transitions, denial, malformed input, restart, notifier failure, schedule failure, German and English text, keyboard and focus announcements, and artifact equality — rather than checking for lifecycle keywords | every row above; `test/v100-backend.test.mjs`'s string-presence assertions are replaced, not supplemented | planned |

Criterion 5 carries one explicit obligation the others do not: the audit found
that today's only alarm "test" asserts the bundle text contains the substrings
`delay_seconds`, `hysteresis`, `notification` and `run_schedules`. Phase 6 must
**delete those assertions**, not leave them passing alongside real ones. A
keyword check that survives next to a behavioural test still reports success when
the behaviour breaks and the word remains.

## Bounds asserted

| Bound | Default | Where |
|---|---|---|
| Shelving maximum duration | 7 days | `test_alarm_suppression.py` |
| Alarm history entries retained | bounded, oldest dropped | `test_alarm_retention.py` |
| `schedule_runs` retention window | bounded, prune proven to drop | `test_alarm_retention.py` |
| Notification attempts recorded per alarm | bounded | `test_notification_delivery.py` |
| Escalation stages per policy | bounded; none configured by default | `test_escalation.py` |
| Notify service allowlist | empty by default, explicit opt-in | `test_notification_delivery.py` |
| Service call timeout | explicit, blocking | `test_notification_delivery.py` |
| Alarms scanned per state change | bounded by the index, not by the alarm count | `test_alarm_index.py` |

Each default is a **site decision** recorded in `06-CONTEXT.md` and
`06-RESEARCH.md` §6, not a product opinion. The tests assert that the mechanism
is configurable *and* that the shipped default is the conservative value.

## Not proven here

- **Real delivery to a real recipient.** Never, in any phase. Notifications are
  tested against the controlled fake service the Phase-2 fixtures provide, and
  the effect ledger asserts the set of targets reached is exactly that fake.
- **Trend and history reads.** Phase 7 owns HIST-01. Phase 6 proves an alarm
  *links* to trend context; it does not prove the trend.
- **Remote-site alarm aggregation.** Phase 9.
- **Measured capacity under thousands of alarms.** Phase 10 owns capacity. Phase 6
  proves the index bounds the *shape* of the cost, with a fixture corpus, not the
  measured number.
- **The composed release leaf.** `npm run test:phase6:release` needs a Docker
  engine this container does not have; its parts pass individually and the row
  stays `planned` for exactly that reason.
