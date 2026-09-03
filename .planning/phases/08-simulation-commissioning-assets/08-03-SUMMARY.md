# 08-03 — Content-derived ids

**Status:** complete. Closes T8-22.

A defect closed on its **third** occurrence: `paste_${Date.now()}` (Phase 5),
`report_${Date.now()}` (Phase 7), `wo_${Date.now()}` (here). Fixing it a third
time in a third place would have guaranteed a fourth, so it is one shared helper
both runtimes use.

Two independent reasons it was wrong: a clock-derived id is not reproducible, so
nothing downstream can say whether two records are the same thing; and it
collides, because `Date.now()` has millisecond resolution and a loop creates
several records inside one.

**The browser mirror stringified numbers.** `canonical_number` returns a
*number* — JavaScript has one number type and already emits the shortest
round-tripping form, so the mirror of that function is the identity. Stringifying
produced `"0"` against `0`, so every id containing a number differed between
runtimes, and a corpus of string-only payloads passed. That would have been worse
than the clock-derived ids being replaced: it looks stable and is not.

The corpus now carries integral floats, non-integral floats and nested numbers,
and catches the divergence on four cases.
