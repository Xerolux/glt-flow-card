# Phase 06 Research

**Conducted:** 2026-09-02
**Method:** Measured against the repository at `f4c4b35` and the vendored Home
Assistant 2026.2.3 under `.venv/lib/python3.13/site-packages/homeassistant/`.
Every claim below is marked with how it was established; the DST claims were
**executed**, not read.

The roadmap carries one research flag for this phase, with two halves:

> Confirm supported HA schedule/calendar authoring APIs **and** the deployment
> alarm philosophy, priorities, shelving/escalation limits, recipients, and
> retention.

Sections 1–4 answer the first half. Section 6 answers the second, which the
user settled on 2026-09-02.

---

## 1. What Home Assistant offers for schedule authoring

**Established from the source.** `homeassistant/components/schedule/` is a
storage-backed collection, not just a YAML integration. `async_setup` builds a
`ScheduleStorageCollection` over a `Store` and then registers

```python
DictStorageCollectionWebsocket(
    storage_collection, DOMAIN, DOMAIN,
    BASE_SCHEMA | STORAGE_SCHEDULE_SCHEMA,
    BASE_SCHEMA | STORAGE_SCHEDULE_SCHEMA,
).async_setup(hass)
```

`StorageCollectionWebsocket` (`helpers/collection.py:538`) registers four
commands from that prefix — `schedule/list`, `schedule/create`,
`schedule/update`, `schedule/delete`. **`list` is open to any authenticated
user; `create`, `update` and `delete` are each wrapped in
`websocket_api.require_admin`** (569–624).

So schedules *are* authorable over the websocket API, and that is the supported
path. Two consequences for this phase:

- We do not need to invent a persistence mechanism for a weekly schedule that a
  site wants to own in Home Assistant. We can bind to a `schedule.*` entity.
- We cannot create one on the operator's behalf unless that operator is an HA
  admin. A card-level "engineer" role does not satisfy `require_admin`, so any
  authoring path we surface must degrade honestly for a non-admin rather than
  fail with a websocket error the UI swallows. This is the same shape as the
  Phase-2 rule: the browser may render the affordance, the server decides.

**The declared shape** (`schedule/__init__.py:115–148`) is narrower than ours:

| Field | Shape |
|---|---|
| `name` | required, non-empty string |
| `icon` | optional, `cv.icon` |
| `monday`…`sunday` | list of `{from, to, data?}` |
| `from` / `to` | `cv.time`; `to` additionally accepts the literal `"24:00:00"`, deserialised to `time.max` |
| `data` | free dict of `bool | str | int | float` |

That is an **interval** model (`from`/`to` per weekday), where ours is an
**instant** model (a single `HH:MM` that fires a service). They are not the
same concept and the mismatch is load-bearing: an HA schedule says "the plant is
in day mode between these hours"; our `run_schedules` says "call this service at
this minute". A binding must therefore say which of the two it is, and cannot
silently convert one into the other.

`schedule`'s own services are only `reload` and `get_schedule` (208–216) — there
is no "fire at" service. The entity is a binary state plus `next_event`
(`ATTR_NEXT_EVENT`), which is exactly what an *operating period* is, and exactly
what a *special-day one-shot* is not.

**Conclusion for SCH-01.** Weekly schedules and operating periods bind to
`schedule.*` entities. Everything with a date in it does not.

## 2. What Home Assistant offers for calendar authoring

**Established from the source.** `calendar/const.py:21` declares

```python
class CalendarEntityFeature(IntFlag):
    CREATE_EVENT = 1
    DELETE_EVENT = 2
    UPDATE_EVENT = 4
```

`calendar/__init__.py:325` registers `calendar.create_event` with
`required_features=[CalendarEntityFeature.CREATE_EVENT]`, and 756/796/841 gate
the websocket paths on the same flags. `calendar.get_events` (292) is
unrestricted and is the read path.

**`local_calendar` is the implementing example** — `local_calendar/calendar.py:62`
sets `_attr_supported_features` and implements `async_create_event` (119),
`async_delete_event` (128) and `async_update_event` (150). It is a core
integration, so "bind to a calendar" is a supported deployment, not a
third-party assumption.

**Conclusion for SCH-01.** Holidays, vacations, exceptions and special days bind
to a `calendar.*` entity: dated, named, recurring where the calendar supports
recurrence, and *editable only where the bound entity declares the feature*. A
binding must read `supported_features` and say what it cannot do, rather than
offering an edit that the service call will reject. This is the same defect
shape Phase 4 closed for controls — an affordance whose feasibility was never
checked.

## 3. Holidays specifically

**Established from the source.** `workday/const.py:16–21` carries
`CONF_PROVINCE`, `CONF_WORKDAYS`, `CONF_EXCLUDES`, `CONF_OFFSET`,
`CONF_ADD_HOLIDAYS`, `CONF_REMOVE_HOLIDAYS`. `binary_sensor.workday` is
therefore a first-class "is today a working day, in this country and province,
with these local additions and removals" signal.

That matters for the country this card is written for: German public holidays
are *per-Bundesland*, and `CONF_PROVINCE` is how HA already expresses that. A
holiday calendar we invented would have to reimplement it and would be wrong for
Bayern, Sachsen and the rest.

**Conclusion.** Holidays bind to `binary_sensor.workday`-style entities where a
site has one, and to a `calendar.*` entity otherwise. This card does not ship a
holiday table.

## 4. DST — executed, not read

`run_schedules` is armed with `async_track_time_change(hass, ..., second=0)`.
`helpers/event.py:1905` documents it as firing "every time the **local** time
matches a pattern", delegating to `async_track_utc_time_change(..., local=True)`
and thence to `dt_util.find_next_time_expression_time`.

That function is careful. `util/dt.py:416–536` handles both transitions
explicitly, using `_datetime_exists` (538) and `_datetime_ambiguous` (546) and
`fold`. **Home Assistant's scheduling is correct. Ours is not**, because we
compare `now.strftime("%H:%M")` against a stored wall-clock string and key the
dedupe on a fold-blind `%Y-%m-%dT%H:%M`.

Executed against `Europe/Berlin` with the vendored HA:

**Spring forward, 2027-03-28.** Consecutive ticks are

```
01:57+01:00 → 01:58+01:00 → 01:59+01:00 → 03:00+02:00 → 03:01+02:00
```

The wall-clock minutes `02:00`–`02:59` are **never delivered**. A schedule at
`02:30` — an ordinary night-setback time on a German heating plant — is silently
skipped for that day, with no run recorded and nothing surfaced. This is the
audit's claim, confirmed.

**Fall back, 2027-10-31.** Iterating in real time across the transition, every
ambiguous wall-clock minute is delivered **twice**:

```
2027-10-31T02:28  →  02:28:00+02:00  and  02:28:00+01:00
2027-10-31T02:30  →  02:30:00+02:00  and  02:30:00+01:00
```

Both deliveries produce the identical `run_key`, because `%Y-%m-%dT%H:%M`
discards the offset. The second execution is therefore suppressed — **by the
deduplication cache, not by the schedule logic**. That is luck, and it is luck
that D8 destroys: `schedule_runs` is never pruned today only because its cutoff
comparison is broken, and a correct prune with a short window would restore the
double-fire.

**Conclusion.** The runner must resolve a schedule to an *instant* using the
timezone and fold, not compare wall-clock strings; the dedupe key must carry the
resolved UTC instant, so it stops being the thing that accidentally holds the
correctness together. The preview must show, for a given day, what the effective
value is — including "this time does not exist on 2027-03-28" and "this time
occurs twice on 2027-10-31" — because those are the two answers an engineer
cannot derive from a `HH:MM` field.

The private helpers `_datetime_exists` and `_datetime_ambiguous` express exactly
the two predicates we need. They are underscore-prefixed, so we implement the
same two predicates ourselves — they are four lines each — rather than importing
a private name that can vanish in a minor release. The dual-runtime rule applies:
the browser preview and the Python runner must agree, proven against a committed
fixture corpus of transition dates, the way Phase 5 proved the router.

## 5. Notification surfaces

**Established from the source.** There are two, and both are current:

- **Legacy per-service.** `notify/legacy.py` registers one service per notifier,
  so a site has `notify.mobile_app_x`, `notify.persistent_notification` and so
  on. Schema (`notify/const.py:33–36`): `message` required, `title`, `target`
  (list of strings) and `data` optional.
- **Entity-based.** `notify/__init__.py:85` registers `notify.send_message` as an
  entity service, with `NotifyEntityFeature` (64) declaring capability.

`persistent_notification` is separate (`persistent_notification/__init__.py`),
with `create`/`dismiss` services and its own websocket subscription. It is the
only notification surface that requires no configuration at all and reaches
nobody outside the HA frontend — which makes it the correct *default-safe*
target for a test run and for an installation that has configured nothing.

**Established by grep, returning zero hits:** the integration references neither
`notify.` nor `persistent_notification` anywhere. `_notify_alarm`
(`__init__.py:371–382`) splits a project-supplied string on the first dot and
calls whatever it names, with **no allowlist** — while schedules check
`domain not in allowed` and controls check `SAFE_SERVICE_DOMAINS`
(`const.py:44–48`, which does not contain `notify`). Notification is the one
outward-facing call in the integration with no domain guard at all (D11).

**Conclusion for ALM-02.** An escalation target is a *configured* pair of
(service, optional target list), validated against a site allowlist before a
call is attempted, with `persistent_notification` as the only entry an
unconfigured installation gets. Every attempt records service, target, outcome
and error text — `blocking=False` discards the outcome, so the call must become
blocking with an explicit timeout, and the bare `except` must record rather than
swallow (D6).

## 6. The alarm philosophy — the second half of the flag

**This is not a research question. It is a site decision, and the user made it
on 2026-09-02:** build the mechanism, ship conservative defaults, document each
default as a site decision rather than baking one in.

The reasoning is recorded in `06-CONTEXT.md`; the operative table is repeated
here because plans bind to research, not to context:

| Setting | Default | Configurable | Why this default |
|---|---|---|---|
| Shelving maximum | 7 days | yes | Covers a planned outage; a forgotten shelf still expires |
| Escalation stages | none | yes | An escalation nobody configured is a page nobody asked for |
| Escalation targets | none | yes | An unconfigured installation guesses no recipient |
| Notify allowlist | empty, explicit opt-in | yes | Matches how schedules and controls already guard domains |
| Alarm history | bounded, oldest dropped | yes (bound) | Unbounded retained state is a leak with a friendly name |
| Priority vocabulary | one closed set | **no** | D12 is four disagreeing vocabularies; a configurable vocabulary would make it five |

The last row is the one deliberate exception, and it is worth being explicit
about. Sites legitimately differ on *how many* priority classes they use and
*what they escalate*, and both of those are configuration. They do not
legitimately differ on whether the editor's word and the roll-up's word are the
same word. Today `critical | warning | info` is written by the editor,
`("fault", "warning")` is counted by the navigation roll-up, and
`alarm_transition` defaults to `"warning"` — so an alarm an engineer marked
`critical` is counted in no roll-up anywhere. That is a bug, not a preference,
and the fix is one closed vocabulary with a declared migration for the strings
already stored in the field.

**What "conservative default" means operationally:** a fresh installation that
configures nothing must be **quiet and safe** — it annunciates in the UI, it
records history, it notifies nobody. It must not be quiet *and wrong*: an alarm
that could not be delivered is still shown, still active and still unshelved.
Silence toward a recipient is a default; silence toward the operator is a
defect.

## 7. What this research rules out

- **Reimplementing a calendar.** SCH-01 says "through supported Home Assistant
  schedule/calendar/script capabilities". Sections 1–3 establish that all four
  needed capabilities exist. Anything we build that duplicates them is scope we
  do not have and a second source of truth we spent Phase 5 removing.
- **Converting between the interval and instant models silently.** They are
  different concepts; a binding declares which it is.
- **Offering an edit without checking `supported_features`.** The read path is
  unrestricted, the write paths are gated, and the gate is per-entity.
- **Trusting `require_admin` to be satisfied.** A card engineer is not
  necessarily an HA admin; the authoring surface must say so instead of failing
  opaquely.
- **Keeping `blocking=False`.** ALM-02 requires recording every attempt and
  result. `blocking=False` makes the result unobtainable, so the requirement and
  the current call are incompatible.
