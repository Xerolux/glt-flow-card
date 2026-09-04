# Designer

The designer edits through **commands**. Every gesture produces a value with an
inverse, and the surface never mutates the project itself.

That is why undo is trustworthy here. An undo list could equally be bolted onto
direct mutation — it would just be unproven: checkable only against the click
paths somebody happened to think of, which is exactly the set that does not
contain the bug. As a value with an inverse, undo becomes a *property*,
`invert(apply(s, c), c) === s`, and that can be checked over generated
sequences.

## Operating without a pointing device

This is a requirement, not an accessibility footnote: the kiosk view has no
pointing device at all. An editor that can only be driven with a mouse is an
editor half the installations cannot use.

| Key | Effect |
|---|---|
| Arrow keys | Move focus |
| `Ctrl`+Arrow | Fine move |
| `Shift`+Arrow | Coarse move |
| `Alt`+Arrow | Resize |
| `Insert` | Add object |
| `Shift`+`Insert` | Set master instance |
| `Enter` | Select |
| `Shift`+`Enter` | Extend selection |
| `g` / `Shift`+`G` | Group / ungroup |
| `a` / `d` | Align / distribute |
| `r` | Bring to front |
| `c` / `x` | Connect / disconnect ports |
| `Del` | Delete |
| `Ctrl`+`Z` / `Ctrl`+`Y` | Undo / redo |

The table lives exactly once in the code and is shown as visible help: a
keyboard shortcut nobody can discover has nobody. A check at module load
requires every command kind to appear in the table — otherwise the card does
not start.

Plain arrows move the focus, modified arrows move the object. A mapping in
which the arrows do both leaves the operator unable to look at anything
without changing it.

The complete flow is verified as **one continuous traversal** over sixteen
steps, in both languages, against the shipped bytes — not as focusability of
individual elements. An editor whose parts are each reachable but whose flow is
not is still one the kiosk cannot operate.

## Connecting

Connecting is two-step: pick the source port, then the target. If the pair does
not fit, the status area announces the reason **in words** — with colour in
addition, not instead of the words. A silent no-op would leave the engineer
with a key that does nothing, which is the worst version of "the tool
disagrees with you".

## Confirmations

Destructive steps run through the phase-2 confirmation element, never through
`window.confirm`. A browser dialog is a browser-owned authorisation prompt:
the kiosk's key handling never reaches it, no stylesheet makes it readable in
forced colours, and the effect ledger that proves the card does nothing
unpermitted does not see it.

The same holds for `alert`: modal, unstyleable, invisible to the ledger. A
message that could have been a sentence next to the affected button became a
blocking interruption the operator must dismiss before looking at what went
wrong.

**Withdrawn yet still reachable:** the old operating path (`_tapEntity`,
`executeControl`) continues to exist and does nothing. Deleting it would move
the proof to where nothing checks it; this way the effect ledger can show that
no gesture produces a service call.

## Undo

The depth is bounded, and the bound forgets the beginning instead of rejecting
the newest edit. An editor that stops accepting work is the worse answer to
"you have edited a lot".

A rejected command leaves the drawing byte-for-byte unchanged. There is no
half-applying.

## Copying between projects

Pasting assigns fresh ids and rewrites **every** reference through the same
mapping: connection endpoints, group membership, master references, layer
assignment and group nesting. Before, a new id was built from `Date.now()` and
`Math.random()` and *nothing* was rewritten, so a pasted connection kept
pointing at the objects it was copied from — two drawings silently sharing the
same state.

The clock was why nobody noticed: the same paste was never reproducible.
Today paste is a pure function of payload and seed, so two people pasting the
same sub-plant get a merge with no content. Port ids stay untouched: they
belong to the profile, and the profile is not copied along.
