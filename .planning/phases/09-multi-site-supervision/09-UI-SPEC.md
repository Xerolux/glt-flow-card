---
phase: 09-multi-site-supervision
---

# Phase 9 UI Contract

## The rule

**A view that is missing a site says so, in the view.** Not in a console, not
behind a hover, not as a subtly different shade. The whole value of a central
supervision screen is that a person stops looking at five screens — and the
moment they do, an unnoticed missing site is a plant nobody is watching.

## Every remote value carries two things

Its **age** and its **site's health**. A value read an hour ago from a site that
has been unreachable since reads exactly like a current one otherwise, which is
the spoofing threat T9-18 names.

Both are text and shape, never colour. Third time this is written down, and the
reasons have not changed: a monochrome control-room kiosk, forced colours, a
screen reader.

## Four site states, and they are different words

| State | Means |
|---|---|
| `healthy` | answered, within budget |
| `slow` | answered, over the latency budget |
| `unreachable` | asked, did not answer |
| `circuit_open` | **not asked**, because it has been failing |

The last two are the pair that matters. A site being skipped because its breaker
is open has been broken for a while; a site that was asked and did not answer
just failed. Showing them identically hides how long the problem has existed.

## A roll-up states its own completeness

"3 of 5 sites" beside every aggregate, and the two absent sites named. An
aggregate whose completeness is not stated must not be shown at all — the same
rule Phase 7 applied to a period total, one network hop out.

## Nothing offers a retry beside an unknown

A remote timeout is `effect_unknown`. A retry button next to it invites operating
plant twice, and Phase 4 established that repairing forward is a new, separately
authorized command.

## Remote text is text

A site name and a remote entity's attributes are authored somewhere this
installation does not control. They reach the DOM as text content, never
interpolated into markup — asserted structurally, and asserted to still reach the
reader.
