# 10-09 — The automated sweep, and what it is not

**Status:** complete. Closes T10-09 and T10-15.

`axe-core` pinned exactly. Zero violations with **no rule disabled** — a
silenced rule is a claim with no evidence, which is this phase's whole subject.

**Five real defects it found:**

- The status palette measured 1.87 to 3.24 against white where AA asks 4.5 —
  colours designed for a dark ground and used on both. On a bright control-room
  screen an operator read "live" and "stale" as the same pale smudge, in the
  surfaces built to tell them apart. One palette now, light and dark value per
  tone with the measured ratio recorded beside each.
- The staleness strip dimmed itself to 60 % opacity, taking a 6.39:1 colour to
  2.73:1: the line saying "this view is not live" was the least legible thing on
  the screen.
- `<ul role="grid">` announced its empty state as a row.
- Two tables had blank column headers, so every cell beneath was announced with
  no context.
- The muted colour was 2.99:1 — used for empty states, the strings a reader most
  needs when a screen looks blank.

**A test defect it uncovered**: Phase 5's contrast floor read
`getComputedStyle(document.body).backgroundColor`, got `rgba(0,0,0,0)`, and
parsed transparent as black, so every state colour had been measured against a
ground the page never paints.

axe loads as an init script *before* the fixture, because the fake Home
Assistant's script-insertion guard correctly rejects `addScriptTag`. Relaxing
that guard for the convenience of this test would weaken a check every UI phase
relies on.

**This is not a conformance claim**, and 10-11 is where that stays enforced.
