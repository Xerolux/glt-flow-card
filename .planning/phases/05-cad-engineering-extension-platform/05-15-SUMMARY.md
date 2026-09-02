# 05-15 — The whole workflow on the keyboard alone

**Status:** complete
**Requirements:** CAD-01 · **Threat:** T5-11 GREEN

## Why this is a requirement and not an accessibility note

The kiosk layout Phase 4 established has no pointer at all. An editor you can
only mouse is an editor half the installations cannot use.

## What is asserted

One continuous traversal in `test/e2e/project-cad.spec.mjs`, in **both**
languages, against the shipped bytes: select, move focus, extend selection,
nudge coarse, nudge fine, resize, group, align, distribute, reorder, connect
(source), connect (target), disconnect, undo, redo, delete. Sixteen steps, and
the test requires all sixteen to have found somewhere to land.

That last part is the difference between this and a focusability check. A
repaint replaces the grid cells, so focus has to be re-established from the live
DOM before each step — which is exactly what an operator experiences, and
exactly what the first version of this test got wrong: it pressed against
`document.activeElement` after a repaint had moved focus to `body`, and every
editing command silently went nowhere. The test failed, correctly, on the first
run.

Also asserted, in both languages:

- The canvas declares its keyboard operation and shows more than ten shortcuts.
- Every editing command reaches the command model: move, resize, group, align,
  distribute, reorder, plus undo and redo.
- Delete asks for confirmation, and the confirmation has a focusable control —
  a confirmation nobody can answer by keyboard is a dead end, not a safeguard.
- `window.confirm` was not used.
- The live region says something.

A second test drives a refused connection: a process outlet offered to a power
inlet. The first key press announces what to do next; the second announces the
refusal by reason code in the live region, with a tone *as well as* the words,
not instead of them.

## Evidence

`node tools/run-exact-dist-playwright.mjs` — 44 tests, all passing. The ledger
across the designer scenario is empty for service calls, API calls, dialogs,
script insertion, storage and network.
