# 08-15 — Maintenance plans

**Status:** complete. Closes T8-21.

`due` was a date string somebody typed, with no interval plan, no operating-hour
plan, no next-due calculation and no reminder — four of ASSET-01's named
capabilities absent behind a field that looked like it had them.

**Two models, never converted into each other.** Converting would mean deciding
how many hours a month is, and a month is not a number of hours: 720, 743 or 745
depending on where the transition falls, and **zero** running hours for a pump
that stayed off. Same rule as Phase 7's counters and rates, and Phase 6's
intervals and instants.

Interval plans use calendar arithmetic rather than multiplication, so six months
from 31 January is 31 July rather than 30 July, 31 August plus a month clamps to
30 September rather than overflowing to 1 October, a yearly plan set on 29
February falls back to the 28th, and a plan due at 09:00 stays at 09:00 across a
clock change.

A plan **never completed is due now**, not never: it is the most likely thing in
the building to need attention.

**Operating hours carry Phase 7's coverage** and decline to decide below the
threshold — reporting the measured number but withholding the *decision*. The
reason is directional: under-reporting running hours makes an overdue service
look current, and that direction ends with a failed bearing.
