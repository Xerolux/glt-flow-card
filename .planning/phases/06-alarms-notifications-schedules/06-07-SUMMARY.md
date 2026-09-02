# 06-07 Summary — suppression

**Status:** complete. 12 suppression tests.

**D1 closed.** `shelved_until` was written twice, cleared once and read
**nowhere**. Every test here asserts what shelving *did*; not one asserts the
field is set, because that would pass against the defect.

Precedence is asserted rather than left to dict order: maintenance is the
plant's state and outranks an individual's shelf; a shelf outranks an
acknowledgement, because a shelf was chosen with an expiry and an
acknowledgement only says "seen". A malformed expiry does not suppress — that is
the failure mode that would keep an alarm quiet indefinitely.

**The clamp became a refusal.** `min(int(minutes), 10080)` silently turned a
ninety-day request into seven days. The operator walked away believing the alarm
was quiet for three months. Now `invalid_input` with a declared code, and the
bound is site configuration.

**D13 closed.** Shelving writes an audit row, through the same `MAX_AUDIT` bound
acknowledgement already used.
