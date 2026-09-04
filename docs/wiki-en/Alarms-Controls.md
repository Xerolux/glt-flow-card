# Alarms & operations

The Companion decides which alarms are active — every surface only displays
what it decided. That is the most important rule on this page, and it has a
reason: a browser deciding on its own works with a snapshot that may be
minutes old.

## The lifecycle

An alarm has a **condition** (operator, threshold, hysteresis or a list of
active states), a **delay**, a **priority** and optionally a notification
policy.

### States

| State | Meaning |
|---|---|
| `active` | The condition holds. |
| `returned` | The condition no longer holds. |
| `acknowledged` | An operator acknowledged the alarm. |
| `indeterminate` | The entity is `unavailable` or `unknown`. |

`indeterminate` is not an emergency intermediate state but an honest answer: a
disappeared entity has **not** returned to normal. Nobody knows what it is
doing. Before phase 6, `unavailable` counted as "inactive" — and because every
entity is briefly `unavailable` during a restart, a restart looked like *all
alarms reset at once*: acknowledgements were taken back, suppressions deleted,
and afterwards every alarm reported again.

### Delay

The delay is anchored to the **first activation**. It suppresses an outlier,
not a persistent fault that happens to be restless.

A sensor whose value changes every ten seconds while staying above the
threshold has a persistent fault. Before phase 6 the delay restarted on every
change, so such an alarm trailed the last value change — and in a plant the
last value change never stops.

After a restart, a running delay is re-anchored against its stored anchor: a
five-minute delay that is four minutes old reports in one minute, not in five.

### Startup grace

After Home Assistant starts, no transitions are reported for **60 seconds**
(configurable). Entities do not arrive simultaneously during boot, and a scan
during that window sees a plant in a state it was never in. The value is still
recorded — only the transition is withheld.

## Priorities

Exactly three, ordered:

| Priority | Meaning |
|---|---|
| `critical` | The plant is down or unsafe. |
| `warning` | Action needed, not immediately. |
| `info` | For the record. |

**This vocabulary is the one phase-6 setting that is not configurable**, and
that is deliberate. Sites rightly differ in *which* classes they use and *what*
escalates — both configurable. They do not rightly differ in whether the word
in the editor and the word in the overview are the same word.

Before phase 6 there were four independent vocabularies, and an alarm created
as `critical` in the editor was counted in **no** overview.

Stored values are migrated. `fault` becomes `critical` — in the existing data
those are the same tier under two names. An unknown string migrates to the
**heaviest** interpretation and is reported: guessing too low causes an
unnoticed shutdown; guessing too high, an annoyed operator.

**Known limitation.** A site with four or five alarm classes cannot express
that today. That would be a schema change, not a setting.

## Suppression

Three reasons, in this order:

1. **Maintenance** — the plant's state, outranks any individual's decision.
2. **Shelving** — chosen with an expiry.
3. **Acknowledgement** — only says "seen".

Every suppression is checked at the point where the decision is made, so
processing and notification cannot disagree. And every suppressed decision
states **which** suppression applied.

Before phase 6, shelving did nothing: the field was written in two places,
deleted in one and read in **none**. A shelved alarm kept running and reporting
while the product reported success. That is worse than a missing feature,
because the operator believes it is quiet.

An expired shelf ends without intervention. An unreadable expiry date does
**not** suppress — that is the failure mode that would silence an alarm
forever.

## Notification and escalation

Every delivery attempt is recorded with service, recipient, outcome and error
text. The call is blocking with an explicit timeout — before, it was
`blocking=False` in a bare `except`, so the outcome was discarded twice and a
message that never arrived was indistinguishable from one that did.

**A failed delivery never removes, devalues or hides the alarm.** An alarm
nobody could be informed about is more urgent than one people were informed
about — not less.

### The allowlist

Notification targets are **site configuration**, never project data. A service
name in the project document is operator input, not authorisation.

Default: `persistent_notification.create` — visible in Home Assistant, reaches
nobody. A disallowed target is **recorded** as `refused`, not silently
skipped: whoever configured a target the site does not allow must see that,
otherwise they believe the message went out.

## The alarm philosophy is your decision

Agreed with the user on 2026-09-02: the mechanism is built, the policy is
configured. Every default is conservative and each is documented as a site
decision, not a product opinion.

| Setting | Default | Why this default |
|---|---|---|
| Shelving maximum | 7 days | Long enough for a planned shutdown, short enough that a forgotten shelf expires. |
| Escalation tiers | none | An escalation nobody asked for is a 3 a.m. call nobody asked for. |
| Escalation targets | none | An unconfigured installation guesses no recipient. |
| Notify allowlist | empty, explicit opt-in | Matches how schedules and control commands already gate their service domains. |
| Alarm history | bounded, oldest drops | Unboundedly growing state is a leak with a friendly name. |
| Startup grace | 60 seconds | Entities do not arrive simultaneously during boot. |
| Schedule-run retention | 14 days | Long enough for "did the setback run last week?". |

**A freshly installed plant is quiet and safe, not quiet and wrong.** It
annunciates in the UI, records history and notifies nobody. Silence towards a
recipient is a default; silence towards the operator would be a bug.

The shelving maximum is **refused, not clamped**. Before, a request over 90
days was silently shortened to 7 without anyone learning — the operator walked
away believing the alarm would stay quiet for three months.

## Operating

Acknowledging and shelving run through the Companion (`alarms/ack`,
`alarms/shelve`) and are audited. The surface sends and re-reads; it paints
nothing optimistically ahead of the server, because an optimistically shown
acknowledgement the server refused is a lie the operator acts on.

Priority is shown as a **word and as a shape**, never colour alone. On a
monochrome kiosk, in forced colours or for a screen reader, a red dot is no
information.

## What is not on this page

- **Trends and histories** – phase 7. An alarm *links* to trend context; the
  trend itself does not belong here.
- **Alarms from remote sites** – phase 9.
- **Measured capacity** at thousands of alarms – phase 10. The index bounds the
  *shape* of the cost; the measured number is still outstanding.
