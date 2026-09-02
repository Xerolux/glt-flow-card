# 05-12 — Editing as values, so undo is a consequence

**Status:** complete
**Requirements:** CAD-01 · **Threat:** T5-09 GREEN

## What shipped

`src/v100/designer-commands.mjs`: a frozen `COMMAND_KINDS` of fourteen
operations, `applyCommand`, `invertCommand`, `sampleCommand`, a
`UNDO_DEPTH_LIMIT` of 200, and `createHistory()` that enforces it.

## The decision this plan is actually about

The designer mutated `config` directly. An undo stack could have been bolted
onto that, and nothing would have proved the stack right: it could only ever be
checked against the click-paths somebody thought to write down — which is
exactly the set of click-paths that does not contain the bug.

Modelling an operation as a value with an inverse turns undo into a *property*,
`invert(apply(s, c), c) === s`, and a property can be checked over generated
sequences. That is the whole reason the operations are modelled at all.

**A command carries both ends of its change.** A `move` recording only its
destination would need the state to work out where the object came from, and by
the time undo runs, that state is the one the move already changed. So
`sampleCommand` reads the "from" out of the state it is sampled against, and the
command owns it from then on.

**Key order is not cosmetic.** The inverse property is checked by serializing
the state, so a command that restored every value but reordered the keys would
read as a failure to invert. Every update is a spread over the existing object,
which keeps an existing key in its existing position.

**A delete restores at its index.** Putting a deleted object back at the end of
the list restores the object and loses the drawing order it had — a different
diagram that happens to contain the same equipment.

**The undo bound drops the oldest, not the newest.** Refusing the newest edit
would make the editor stop accepting work, which is a worse answer to "you have
edited a lot" than forgetting the beginning. The bound exists because history is
retained state, and unbounded retained state in a long editing session is a leak
with a friendly name.

## Evidence

`node --test test/designer-transactions.test.mjs` — 9 tests, all passing.

- The sentinel's twelve generated six-command sequences apply and unwind, each
  step restoring the exact bytes that preceded it.
- Every one of the fourteen kinds is additionally exercised on its own against a
  state rich enough that none has to be skipped — a generated sequence proves
  nothing about a kind it happened not to reach.
- Each kind is checked three ways: it changes something, it does not mutate the
  state it was given, and it inverts to the original bytes.
- A rejected command changes nothing and names the object it could not find.
- An unknown kind raises at all three entry points, and a command with no
  payload raises rather than being treated as an empty one.
- The bound is enforced by a running history — ten pushes against a limit of
  three leave depth three, and undoing past the bound returns the same state
  rather than inventing a step. Redo replays exactly what undo took back, and a
  new edit discards the redo branch.
