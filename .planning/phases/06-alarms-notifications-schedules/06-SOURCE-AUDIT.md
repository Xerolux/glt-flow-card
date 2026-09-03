# Phase 6 source audit — alarms, notifications, schedules

**Read this before planning anything.** The Phase-5 audit called three of five
requirements "essentially greenfield" and was wrong; substantial
implementations already existed and the claim had to be withdrawn. This audit
was therefore written the other way round: every load-bearing claim below was
read at its line, and the two that could be executed were executed.

**Headline: none of the three areas is greenfield.** All three have working
implementations, and the shipped card carries a *second*, independent alarm
evaluation that disagrees with the backend's. Every defect the roadmap lists
for this phase is present and locatable, and there are more.

---

## 1. Alarms

### Where the engine lives

`custom_components/glt_flow_card/__init__.py`:

| Concern | Lines |
|---|---|
| Condition evaluation and hysteresis | `_state_active`, 144–173 |
| Delay task registry `self._alarm_tasks` | 189 |
| Task cancellation on unload | `async_close`, 255–260 |
| Transition, history, notify trigger | `alarm_transition`, 346–369 |
| Notification dispatch | `_notify_alarm`, 371–382 |
| Acknowledgement | `ack_alarm`, 384–390 |
| Shelving | `shelve_alarm`, 392–398 |
| State-change scan | `process_state_change`, 455–486 |
| Listener registration | 1941 |

State survives a restart: `alarm_state` and `alarm_history` are keys of
`self.data`, which `async_save` persists and `async_load` restores.
`_alarm_tasks` is in-memory only, so a **pending delay is lost on restart and
never re-armed**.

### Confirmed defects

**D1 — Shelving is inert.** Verified by grep across `custom_components/`,
`src/` and `dist/`: `shelved_until` appears in exactly three places, all
writes — set at 395, cleared at 363, and `shelved_by` at 396. It is **read
nowhere**. Neither `alarm_transition` nor `_notify_alarm` nor
`process_state_change` consults it. Shelving today changes one field in a dict
that nothing inspects, so a shelved alarm still processes and still notifies.

**D2 — Every delayed alarm on one entity uses the last one's delay.** Lines
467–481:

```python
delay = int(alarm.get("delay_seconds", 0) or 0)
...
    async def delayed(pid=project_id, a=deepcopy(alarm), e=entity_id, k=key):
        try:
            await asyncio.sleep(delay)
```

`pid`, `a`, `e` and `k` are bound as default arguments. **`delay` is not** — it
is a free variable read from the enclosing scope when the coroutine actually
runs, which is after the loop has finished and `delay` holds its final value.
Two alarms on one entity with different `delay_seconds` therefore both wait the
second one's delay. A five-second and a five-minute alarm both annunciate at
five minutes, or both at five seconds.

**D3 — Every state change in the installation scans every alarm.** Line 1941
subscribes to the bare bus event with no entity filter, and lines 460–462 then
iterate every project × every alarm and filter afterwards. There is no
entity→alarm index. Cost is O(state changes × projects × alarms), for every
state change in the whole Home Assistant instance, not just this card's.

**D4 — Three sources of truth for "is this alarm active", and they disagree.**

1. Backend `_state_active` (144–173): operators, thresholds, hysteresis, delay.
2. Shipped card `activeAlarm` (`src/generated-bases/glt-flow-card.base.js:4611`,
   `dist/glt-flow-card.js:4611`): a string membership test only — no operator,
   no threshold, no hysteresis, no delay. It disagrees with the backend for
   every threshold alarm. Its acknowledgement path calls a Home Assistant
   service directly and never reaches the backend.
3. `src/v100/index.js:81` `alarmsPanel`: a *third* derivation, which posts
   ack/shelve to the backend but **never calls `alarms/list`** — confirmed by
   grep over `dist`: `alarms/ack` and `alarms/shelve` appear once each,
   `alarms/list` not at all. The backend's authoritative state is displayed
   nowhere.

And a fourth: `panels.py:187` and `navigation.py:160` read a *design-time
config field* `alarm["state"]`, which the engine never writes — it writes
`self.data["alarm_state"]`. Those badges are permanently detached from the
running engine.

**D5 — One restart re-notifies, un-acknowledges and un-shelves every active
alarm.** `alarm_state` is persisted, but on restart entities pass through
`unavailable`, which `_state_active` classifies as inactive (173). The
sequence: persisted `active=True` → `unavailable` → `alarm_transition(False)`,
which at 361–363 writes `cleared`, sets `acknowledged=False` and **pops
`shelved_until`** → the entity returns with the same real value →
`alarm_transition(True)` → line 369 notifies again. There is no startup grace
period and no `homeassistant_started` guard.

**D6 — Notification and schedule failures are doubly invisible.** Both call
`services.async_call(..., blocking=False)`, which discards the outcome, and
both then wrap it in a bare `except Exception` that returns (382) or continues
(519). A failed notification is not recorded, not retried and not surfaced.

### Defects not on the roadmap's list

**D7 — `alarms/list` returned every project's alarm state to any caller.**
Found here, verified with a probe — a principal with no membership named a
project and received its state and history — and **fixed in commit `9f53bcb`
before this phase was planned**, because it was a live authorization hole
rather than phase work. Recorded here so the phase does not re-plan it, and so
the enumeration tests in `test_alarm_enumeration.py` are known to exist.

**D8 — `schedule_runs` is never pruned.** Line 522 keeps entries whose
`k.split(":")[-1][:10] >= cutoff`, but `run_key` is
`f"{project_id}:{sched_id}:{key_minute}"` and `key_minute` itself contains a
colon (`2026-09-02T14:30`). Executed: `split(":")[-1][:10]` yields `"30"`, and
`"30" >= "2026-08-19"` is lexicographically true forever. No entry is ever
dropped; the persisted store grows without bound.

**D9 — `ack_alarm` does not trim history.** `alarm_transition` caps at
`MAX_AUDIT` (366); `ack_alarm` inserts at 387 with no cap. Repeated
acknowledgements grow `alarm_history` indefinitely.

**D10 — The delay is "quiet for N seconds", not "active for N seconds".**
Lines 468–471 cancel and recreate the pending task on every intermediate
active state change, so a sensor oscillating above threshold faster than
`delay_seconds` never annunciates at all.

**D11 — Notifications have no service-domain allowlist.** Schedules check
`domain not in allowed` (509) and controls check `_safe_domains`;
`_notify_alarm` checks nothing and will call any domain and service named in
the project document.

**D12 — The severity vocabulary is not unified.** The shipped editor writes
`critical | warning | info` (`base.js:5024`), `navigation.py:38` counts only
`("fault", "warning")`, `project-operations.js` branches on `"fault"`, and
`alarm_transition` defaults to `"warning"` (357). A `critical` alarm authored
in the UI is counted in no roll-up.

**D13 — `shelve` writes no audit row** while `ack` does (1580). Suppression is
the less auditable of the two.

**D14 — Alarm state is never reconciled against the project.** `ports.py:24`
remaps alarm ids on paste, but `alarm_state` is keyed `f"{project_id}:{alarm_id}"`
and nothing reconciles it, so remapped or deleted alarms leave permanent
entries.

### Test coverage today

Essentially none for behaviour. `test/v100-backend.test.mjs:11–12` is a
**string-presence** test — it asserts the bundle text contains the substrings
`"delay_seconds"`, `"hysteresis"`, `"notification"`, `"run_schedules"`. That is
the "checking for lifecycle keywords" the roadmap's success criterion 5 names
as the thing to replace. `test_init.py` injects a fake task into `_alarm_tasks`
only to prove unload cancels it. No test exercises a transition, a delay,
hysteresis, acknowledgement, shelving or restart.

---

## 2. Notifications

**One function, twelve lines**, `__init__.py:371–382`, called from exactly one
place (`alarm_transition`, 368–369, `if active:`).

What exists: a project-supplied `notification.service` string, split on the
dot, called with `blocking=False`.

What does **not** exist, verified by grep returning zero hits across
`custom_components/` and `src/`: any reference to `notify.` or
`persistent_notification`; any escalation, priority routing, recipient group,
retry or backoff; any record of a delivery attempt or result in audit,
evidence or history; any suppression check against `shelved_until`,
`acknowledged` or severity; any domain allowlist; any deduplication key; any
deep link.

There are four `services.async_call` sites in the integration in total: 380
(notification), 515 (schedules), 918 (`controls/execute`), 1554 (the legacy
service route).

---

## 3. Schedules

`run_schedules` (488–523), armed at 1942 with
`async_track_time_change(hass, manager.run_schedules, second=0)` — every minute,
with `now` in Home Assistant **local** time.

It is a weekly evaluator: `days` (weekday numbers) plus an exact `HH:MM` string
comparison. There is **no** operating-period, holiday, exception, vacation or
special-day concept, and **no calendar or script integration** — grep for
`calendar` over `custom_components/`, `src/v100/` and
`schemas/project/4.schema.json` returns zero hits. `script` appears only as an
allowed service domain in `const.py:47`.

**No websocket surface exists for schedules.** No `glt_flow_card/schedules/*`
route in `__init__.py` and none declared in `policy.py`. Schedules are edited
only as project config through the ordinary project save path — which means
there is no authorization boundary of their own, no audit of an edit, and no
route for a preview.

**Timezone and DST handling: none.** Local wall-clock strings are compared
directly. Spring-forward silently skips a schedule whose `time` falls in the
lost hour. Fall-back is saved from firing twice only by the `run_key` dedupe —
incidentally, not by design — and that key mixes local time into a value stored
as UTC.

Browser side: `src/v100/index.js:102` `showSchedules` is the editor (name,
days, time, service, entity), shipped at `dist:34047`. The v040 layer and the
generated base have **zero** schedule hits — schedules are a v100-only surface.

---

## 4. What the schema declares

`schemas/project/4.schema.json`:

- `schedules` (644–650): an array of `identifiedObject`, `maxItems: 100000`.
  No `days`, no `time`, no `service`, no `entity_id`, no `enabled`.
- `alarms` at project level (623–629): an array of `identifiedObject`. No
  `delay_seconds`, no `hysteresis`, no `condition`, no `severity`, no
  `notification`, no `active_states`.
- `alarms` at equipment level (403–409): an array of `openObject`.

Every field the engine reads is therefore **undeclared**. A project can carry a
`delay_seconds` of `"soon"` and the schema will accept it. Phase 5's schema 4
closed the `port` shape for exactly this reason; alarms and schedules are the
next two.

---

## 5. What this means for planning

The work is not "build an alarm system". It is:

1. **Unify the lifecycle.** One backend truth, and browser surfaces that render
   it rather than re-deriving it. Three derivations that disagree is worse than
   one that is wrong, because at least one wrong answer is consistent.
2. **Close the schema.** Alarms and schedules need declared shapes before any
   behaviour can be relied on.
3. **Make suppression real.** Shelving and maintenance must be consulted where
   the decision is made, not written where nothing reads them.
4. **Make failure visible.** A notification or schedule that failed must be
   recorded and surfaced, not swallowed twice over.
5. **Index the scan.** An entity→alarm index, so a state change costs what it
   should.
6. **Retire the second evaluator** the way Phase 5 retired the legacy router:
   reachable and inert, so a test can prove the replacement.

Nothing here is a blank page, and every one of these has a defect to point at.
