# 06-16 Summary — the alarm surface

**Status:** complete. Covered by the exact-dist `phase-6-alarms` group.

Priority is a word *and* a shape — distinct glyphs, not distinct fills, so the
difference survives a monochrome kiosk, forced colours and a screen reader.

A suppressed row says the reason, who set it and until when. A failed delivery
appears on the row and the alarm is not sorted below the successful ones.

An installation with no configured targets says so, so the conservative default
is legible rather than discovered during an incident.

Module-load checks: every declared priority needs a shape and a label in both
languages, every suppression reason needs wording in both. A priority the
surface cannot draw is a priority an operator cannot see.

**Test-scope correction, and it mattered.** The injection check searched
`innerHTML` for `onerror=` — but escaped text still contains that substring, as
`&lt;img src=x onerror=...&gt;`, so it failed a correct implementation. It
asserts structure now, and gained the other half: escaping must not mean
discarding.
