# 07-13 — Units checked, exclusions stated, circular means

**Status:** complete. Closes T7-11, T7-12, T7-13 (D15, D16, D17).

All four defects produce a **number rather than an error**, which is why every
assertion here is about what the answer says of itself.

An unavailable meter is named in an exclusion list with a reason rather than
silently skipped, and the total carries the coverage saying how much of the site
it actually describes. **"No meters configured" and "no meters readable" are
different results**, because they call for different actions: one is a setup
task, the other a fault.

A CO₂ figure names the media it excludes. Today it exists only for electricity,
so gas and district heat vanish from a number presented as the site's.

An arithmetic mean of 350° and 10° is 180° — due south, when the wind was
blowing very nearly due north. The **declared** mean type is read rather than the
unit guessed at, and exactly opposed directions refuse rather than invent a
bearing.

## A contract of mine, corrected

The RED sentinel demanded that Wh against a price in EUR/kWh be refused, which
conflated two different questions wearing the same name:

- **An entity reporting Wh while the meter declares kWh** is a disagreement about
  what the meter *is*. Refused — converting would paper over a misconfiguration
  the site should fix.
- **A declared unit against a price unit** is arithmetic with an exact answer. Wh
  and kWh are the same quantity at a factor of 1000, and refusing that is
  pedantry rather than safety.

`07-CONTEXT` says "not converted on a guess", and a factor between two units of
one group is not a guess — `07-PATTERNS` already said so explicitly. The sentinel
had been written from the audit's framing without the distinction. Both checks
now exist and the sentinel tests each, including the genuinely incompatible case
of a volume against a price per kWh.

---

*Written retrospectively during 07-20 from the plan's commits (f954cb1); the summary was missed when the plan landed. Nothing here is recalled — every claim is taken from the committed message and the code at head.*
