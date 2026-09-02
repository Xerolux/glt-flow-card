# Runtime operations and drill-down

What an operator can do at runtime, and what each thing does and does not
promise.

## The object panel

Every profiled object opens the same panel. The regions are fixed and in order:

| Region | What it shows |
|---|---|
| Identity | Name, containment path, profile and version |
| State | The resolved operational state, as symbol and word |
| Values | Profile-declared datapoints with units |
| Runtime | Operating hours and starts, when the profile declares them |
| Quality | Where the value came from and whether it is live |
| Alarms | Alarms on this object |
| Controls | Only what you may execute, right now |
| Trend | Declared unavailable until Phase 7 |

The panel is composed by the Companion, not assembled in the browser. That is
not an implementation detail: a browser deciding its own control list would be
working from a capability snapshot that can be five minutes old, and would not
see a permission that had just been revoked.

A control you may not execute is **absent**. There is no greyed-out control and
no "you need role X" hint, because both tell you the control exists.

The panel carries no domain, service or entity target. The Companion resolves
those from the verified project head when you actually run something.

## Operating hours, starts and trends

Hours and starts are ordinary datapoints a profile declares, so they appear
without any history query.

Trends are **not available yet**. The region says so rather than showing
nothing or inventing a line. Honest Recorder-backed history — with coverage,
gaps and provenance — is Phase 7 work.

## Command outcomes

| Outcome | Meaning | What you can do |
|---|---|---|
| Accepted | The server wrote the command down | Cancel, while still cancellable |
| Sent | Home Assistant was asked | Wait |
| **Confirmed** | A read-back showed the plant moved | Dismiss |
| No confirmation | Nothing came back in time | Check current state, open the audit |
| Effect unknown | The result cannot be determined | Check current state, open the audit |
| Failed after dispatch | It failed after Home Assistant was asked | Check current state, open the audit |
| Failed — not sent | It failed before anything was asked | — |
| Cancelled — not sent | You cancelled in time | — |
| Not permitted | You may not run this | — |

Only **Confirmed** is shown as success. Accepted and Sent are not the plant
moving, and presenting either as done is the specific lie this design prevents.

There is no retry button anywhere. Repairing forward is a new, separately
authorized command — a retry sitting beside "effect unknown" invites running a
command twice on plant that may already have moved.

## Navigation

The URL holds the whole view: which node, which time window, which alarm. A
link therefore reproduces exactly what you were looking at, and going back
returns you to it with its context intact.

Every link is authorized when it is opened, not when it was created. A URL gets
pasted into a chat and opened by somebody else, so nothing about a link is
trusted for having once worked for you.

A link you may not follow and a link to something that does not exist give the
same answer. Telling them apart would let anyone map what exists by trying
addresses.

## Counts

A roll-up covers only the projects you are a member of — the totals as well as
the rows. A total computed across everything and then filtered for display would
announce an alarm in a project you cannot open.

A count of zero is shown as **no count**, not as "0". Otherwise an empty thing
you are allowed to see would look different from a thing you are not.

## When the view loses track

The view knows which update it expects next. If one goes missing, or the
connection drops, or your access changes, it says it is not live, keeps showing
the last values it actually observed together with their age, and stops
accepting input.

It never fills a gap by guessing the values in between, and it never needs a
page reload to recover.

## What was removed

The old browser-side permission check is gone. It granted control to everyone
whenever no permission list was configured at all, which is the opposite of
failing closed. So is the tap action that called a Home Assistant service
directly with whatever the card configuration named.

Both are retired and tested to produce no effect. Authorization is the
Companion's, and always was meant to be.
