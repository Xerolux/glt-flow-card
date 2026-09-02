# 05-14 — The designer surfaces

**Status:** Task 1 complete. Task 2 (retiring the legacy editor dialogs) is
still open and is described below.
**Requirements:** CAD-01

## Task 1 — the surfaces

`src/v100/project-designer.js`: `glt-flow-card-designer-canvas`,
`glt-flow-card-layer-panel`, `glt-flow-card-minimap` and
`glt-flow-card-extension-manager`, wired into `entry.js` and shipping in
`dist/glt-flow-card.js`.

**No surface mutates a project.** Every gesture produces a command value and
dispatches it; the host applies it through `designer-commands.mjs`, where undo
is a proven property. A surface that edited the document directly would put a
mutation outside the model that makes undo true, and the undo stack would then
be wrong in exactly the cases nobody clicked.

**Objects are grid cells, not positioned boxes with pointer handlers.** That is
what makes the whole editor reachable by keyboard without a parallel
"accessible mode": there is one traversal, and a pointer, where there is one,
drives the same cells.

**Plain arrows move focus; modified arrows move the object.** A grid where the
arrows do both gives the operator no way to look without editing.

**One keyboard table, which is also the help text.** A shortcut nobody can
discover is a shortcut nobody has, so `DESIGNER_KEYS` renders as visible `kbd`
rows. A module-load check requires every command kind in `COMMAND_KINDS` to
appear in it — the two layer commands excepted, since the layer panel's own
buttons are keyboard-operable like any button.

That check earned its place immediately: the first version of the table had no
key for `add`, the module threw at load, and none of the four elements
registered. The guard turned a gesture that would have been pointer-only into a
build that would not start.

**Destructive steps go through the Phase-2 `glt-flow-card-control-confirm`.**
Its contract is Phase 2's, unchanged. Reusing it rather than writing a second
confirmation is the point: one element means one place where the safe choice
takes focus, and it already does that.

**A refused connection is announced in the live region, in words**, and a
`glt-connection-refused` event carries the structured verdict. A silent no-op
would leave the engineer holding a key that does nothing, which is the worst
version of "the tool disagrees with you".

## Task 2 — not done, and what remains

`src/generated-bases/glt-flow-card.base.js` still contains four browser dialogs
on legacy editor paths: one `confirm` on project delete and three `alert` calls
on "nothing selected" refusals, mirrored in `src/v040-extension.part03` and
`.part04`. There are also `prompt` calls for naming, which the plan does not
name.

They are not reached by any Phase-5 surface — the exact-dist ledger reports zero
dialogs across all 44 e2e tests — but they are still in the shipped bytes, so
the plan's acceptance criterion is not met and this summary does not claim it
is. The work is a separate commit: a shared confirm helper and an inline notice
in place of `alert`, applied to the generated base *and* the authored parts
together, since the base is the canonical build source and the parts are the
authored form.
