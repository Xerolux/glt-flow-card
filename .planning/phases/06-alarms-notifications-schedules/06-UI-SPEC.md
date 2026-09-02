# Phase 06 UI Contract

Written before implementation so the exact-dist tests assert a specification
rather than describing whatever got built.

Phase 6's UI has one governing rule that the earlier phases' did not need: **the
surface displays state it was given and derives none of its own.** Every "is
this active", "is this suppressed", "did this notify" and "when does this next
run" is a value that arrived from the Companion. The card may sort, filter,
group and phrase; it may not decide.

## Custom elements

| Element | Responsibility |
|---|---|
| `glt-flow-card-alarm-list` | The authoritative alarm list from `alarms/list`: priority, condition, state, since, suppression reason, last delivery outcome. Sorts and filters; evaluates nothing. |
| `glt-flow-card-alarm-detail` | One alarm: its condition in words, its history, its delivery attempts, and links to plant, equipment and trend context. |
| `glt-flow-card-alarm-actions` | Acknowledge (with comment) and shelve (with an expiry bounded by the site maximum). Posts and re-reads; never predicts the result. |
| `glt-flow-card-schedule-editor` | Weekly entries, bindings, and the effective-value preview. |
| `glt-flow-card-schedule-preview` | For a chosen date: the resolved instants, and the two DST answers. |
| `glt-flow-card-alarm-settings` | The site's alarm philosophy — priorities in use, shelving maximum, escalation stages, notify allowlist, retention. |

Phase-2/3/4/5 elements are reused unchanged.

## The alarm list

- Every row shows **priority as a word and a shape**, never colour alone. A red
  dot on a monochrome kiosk is no information at all.
- State is one of the declared set, spelled out: active, returned, acknowledged.
  A row that is suppressed says **why and until when** — "shelved by anna until
  09.09.2026, 14:00" — because "quiet" without a reason is the defect D1 shipped.
- A row whose last notification **failed** says so on the row, not only in the
  detail view. The alarm is not downgraded, not hidden and not sorted below the
  successful ones: an alarm nobody could be told about is more urgent, not less.
- The list renders what `alarms/list` returned. It does not merge in entity
  states and re-derive activity — that re-derivation is D4, and this phase
  retires it.
- An empty list says the installation has no active alarms. It does not render
  an empty container that reads as a loading state forever.

## Acknowledgement and shelving

- Acknowledge takes an optional comment. The comment is **text content**, never
  interpolated into markup, and it is displayed with its author and time.
- Shelve takes an expiry. The control offers durations up to the site maximum and
  **refuses longer ones in the UI with the reason**, while the server enforces
  the same bound independently — the browser check is UX, exactly as every phase
  since Phase 2 has required.
- Both actions post to the Companion and then re-read. Neither optimistically
  paints the new state: an optimistic acknowledgement that the server refused is
  a lie the operator will act on.
- A failed action says what failed and leaves the previous state visible.

## Delivery visibility

- The detail view lists every attempt: time, service, target, outcome, and the
  error text when there was one. This is the visible half of the decision record.
- An installation with no configured targets says so plainly — "no notification
  targets configured; alarms are annunciated here only" — rather than showing an
  empty list that looks like nothing happened. That is the conservative default
  made legible instead of made invisible.

## The schedule editor and preview

- An entry declares which kind of binding it is: an **instant** (fire a service
  at a time) or an **interval** (an operating period). The research establishes
  these are different concepts in Home Assistant too; the UI does not blur them.
- A binding to a Home Assistant entity shows the entity, what it can do, and
  **what it cannot** — a calendar without `CREATE_EVENT` shows as read-only with
  that reason, and an authoring action unavailable to a non-admin says so before
  it is attempted rather than failing opaquely.
- The preview takes a date and shows the resolved instants for it. On a
  transition date it states the answer in words:
  - spring forward: "02:30 does not exist on 28.03.2027 — this entry will not
    run" (and the configured resolution, once one is chosen);
  - fall back: "02:30 occurs twice on 31.10.2027 — this entry runs once, at
    02:30+02:00".
  These two sentences are the reason the preview exists. An engineer cannot
  derive either from an `HH:MM` field.
- Execution history shows failures, with the service and the error. A schedule
  that silently did nothing is the defect this replaces.

## Non-pointer operation

Every operation above has a keyboard path: navigate the alarm list, open a
detail, acknowledge with a comment, shelve with an expiry, edit a schedule entry,
open the preview and change its date. The shortcut table is the help text, as in
Phase 5.

A state change — an alarm activating, an acknowledgement landing, a delivery
failing — is announced through a live region. A change visible only as a colour
shift is not a change a screen-reader operator was told about.

## Accessibility and localization

- German and English, both complete. Dates and times render in the site locale;
  the preview's DST sentences are authored in both languages, not string-joined
  from fragments.
- Contrast and non-colour cues are asserted in both languages and both themes,
  the way Phase 5 asserted the catalog.
- Focus is never trapped in the acknowledge or shelve dialog, and it returns to
  the row that opened it.

## Forbidden in the generated artifact

Asserted against `dist/glt-flow-card.js`, not against `src/`:

- No `alert()` and no bare `confirm()` — Phase 5 established this and Phase 6
  does not reintroduce them for acknowledgement or shelving.
- No `prompt()` on the acknowledgement-comment path.
- No threshold comparison or hysteresis arithmetic reachable from the retired
  `activeAlarm` entry point, and no `callService` reachable from it.
- No operator-authored string (alarm name, acknowledgement comment, schedule
  name, target label) reaching `innerHTML`.
- No timezone arithmetic that reads the browser's zone instead of the site's.
