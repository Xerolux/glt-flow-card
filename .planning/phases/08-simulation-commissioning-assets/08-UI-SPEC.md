---
phase: 08-simulation-commissioning-assets
---

# Phase 8 UI Contract

Three surfaces, in German and English, rendered from what the Companion decided.

## Everywhere: simulated is not a colour

A simulated value carries **the word and a shape**, never a tint. A control room
may be monochrome, forced colours discard the palette, and a screen reader gets
nothing from either. The provider is stated next to the value — `simuliert` /
`simulated` — and the card carries a persistent banner naming who started the
session and when it expires.

This is the rule that makes T8-09 a safety assertion rather than a styling one:
the whole hazard is that a rehearsal reads as commissioned plant.

## Simulation

A scenario is a **list of ticks**, shown as a table, not a timeline widget: the
table is the accessible form and there is no pointer-only alternative to build.

The session banner states, in words: that simulation is active, which project,
who started it, and when it ends. A session that has expired says so rather than
disappearing — a banner that vanishes is indistinguishable from one that was
never there.

Every refusal caused by simulation says **simulation** was the reason, and is
distinct in wording from "the Companion could not tell" (T8-04). An operator who
sees "refused" without which of the two applies cannot know whether to wait.

## Commissioning

A read-only table, one row per reference, with columns: reference, where it is
declared, diagnosis, evidence, remediation link.

**The diagnosis is the four-way answer**, not "missing": `present`,
`registered_not_loaded`, `unregistered`, `missing`, plus the value-level findings
(`wrong_unit`, `wrong_device_class`, `duplicate_binding`, `stale`,
`service_missing`).

No aggregate percentage. Counts per diagnosis, because the invented score is
T8-17 and replacing it with a better-computed invented score would be the same
defect with a nicer formula.

Remediation is a **link**. Nothing on this surface writes, and the surface says
so once, plainly.

## Assets and work orders

Form fields, never `prompt()` — third time this rule is written down, and the
first two are Phase 6's acknowledgement comment and Phase 7's report schedule.

A work order shows its **entries**, oldest first, each with actor and time. The
current status is derived from the entries rather than stored beside them, so
the record and the display cannot disagree.

An invalid transition is refused **before** the entry is appended, with both the
current status and the attempted one named. "Invalid transition" alone leaves
the operator to guess which half was wrong.

Attachment limits are stated **before** an attachment is chosen, not after it is
rejected. A limit discovered by hitting it is a limit that wasted the work.

Operator text — asset name, note, scenario label — is set as text content and
never interpolated into markup, and the assertion is structural: no elements
created, no `on*` attributes, and the text still reaches the reader.
