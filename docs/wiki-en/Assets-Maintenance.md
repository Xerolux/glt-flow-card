# Maintenance & assets

A maintenance record exists to answer a question months later, usually for
someone who was not there: **was this maintained, by whom, and what was
found?**

Every defect the rework found here destroyed that answer — not the workflow.

**This is not a CMMS.** This product's requirements explicitly exclude claims
of CMMS, Brick, Haystack, ISO-50001 or ISO-55000 compliance. What exists are
bounded, evidenced workflows: plans, work orders, records. Spare parts and
documents are **attachments to a completion**, not an inventory system.

## The record is appended to, never overwritten

A work order is a **sequence of entries**, not a row that gets updated.

Previously, saving wrote `{**old, **new}`. Completing an order thereby deleted
**who had opened it and when** — and a completed record was indistinguishable
from one rewritten after the fact. A maintenance history that can change
unnoticed is evidence of nothing.

A **correction is a new entry** that names what it corrects. The wrong entry
stays and is marked corrected. That is the difference between a history and a
draft.

The current status is **derived** from the entries, not stored alongside. A
stored status can disagree with the entries that should have produced it — and
then record and display contradict each other while both look authoritative.

## Transitions are closed

Previously any string was a valid status: `"banana"` passed, and a completed
order could silently reopen.

| From | To |
|---|---|
| `open` | `assigned`, `in_progress`, `cancelled` |
| `assigned` | `in_progress`, `open`, `cancelled` |
| `in_progress` | `blocked`, `completed`, `cancelled` |
| `blocked` | `in_progress`, `cancelled` |
| `completed` | `open` (**with a reason**) |
| `cancelled` | — |

Checked **before** appending, so a refused transition leaves no trace. The
refusal names **both** sides — the current and the attempted status — because
"invalid transition" alone leaves the operator guessing which half was wrong.

**Reopening needs a reason, returning does not.** The same target means
different things depending on origin: `assigned → open` returns an order,
`completed → open` says the work was, after all, not done. Only the second must
justify itself.

## Due dates are computed

Previously `due` was a hand-typed date — no interval planning, no
operating-hours planning, no computation, no reminder.

### Two models, never converted into each other

| Model | What it measures |
|---|---|
| `interval` | **calendar time** — every six months, on local calendar boundaries |
| `operating_hours` | **measured runtime** — only advances while the plant runs |

Converting one into the other would mean deciding how many hours a month has.
A month *is* not an hour count: 720, 743 or 745 depending on where the DST
change falls — and **zero** operating hours for a pump that stood still.

Intervals use the calendar, not multiplication:

- Six months from **31 January** is **31 July**, not 30 July.
- One month from **31 August** is **30 September**, not 1 October.
- A plan at 09:00 stays at 09:00 across the DST change.

A plan **without a prior completion is due immediately**, not never due: that
is the most likely thing in the building that needs attention.

### Operating hours state their coverage

Operating hours carry the same coverage statement as every phase-7
measurement. Below the threshold the answer is **"not decidable"** — the
measured value is still displayed; the *decision* is withheld, not the record.

The direction is deliberate: too few reported runtime hours make an
**overdue** maintenance look like one that is not due yet. That direction ends
in damage.

## Limits, and they are stated up front

| Limit | Default | Why |
|---|---|---|
| Attachment size | 5 MB | One photo at full resolution. |
| Attachments per order | 20 | |
| Entries per order | 500 | More is a symptom, not a record. |
| Retention of completed orders | 730 days | Long enough for the next annual audit. |

The attachment limits are **named before** a file is chosen. A limit discovered
by bumping into it has destroyed the work — and in a plant room that work is a
photo somebody climbed a ladder for.

An oversized attachment is **refused, not truncated**: a half-saved photo looks
like a record and is not one.

The file type is checked **on the content**, not the extension. A name is an
assertion by whoever typed it.

**An open order is never deleted**, however old it is. Age is no reason to
forget work that was not done. An unreadable timestamp also keeps the record —
dropping evidence over a format problem is the wrong trade. Deletions are
**recorded**: a record that vanishes without cause is worse than one never
kept.

## Responsibility

The responsible party is a **Home Assistant user**, not free text. "Who is
accountable" must be resolvable, notifiable and permission-checkable.

## What does not exist

- **No spare-parts inventory, no purchasing, no costs.** Attachments on
  completion, nothing more.
- **No notification of its own.** Phase 6 owns the delivery path, and its
  allowlist applies unchanged.
- **No compliance statement** towards CMMS, Brick, Haystack or ISO standards.
