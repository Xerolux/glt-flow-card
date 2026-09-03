# Phase 05 UI Contract

Written before implementation so the exact-dist tests assert a specification
rather than describing whatever got built.

## Custom elements

| Element | Responsibility |
|---|---|
| `glt-flow-card-symbol-browser` | Search and filter the catalog by category, domain, style and text. Renders variants from the generated manifest. |
| `glt-flow-card-port-inspector` | Shows a port's medium, direction, kind, multiplicity and preferred side, and why a proposed connection was refused. |
| `glt-flow-card-layer-panel` | Layer visibility, locking and z-order, as transactional commands. |
| `glt-flow-card-designer-canvas` | Selection, guides, snapping, alignment, distribution, lasso, groups and masters. Emits commands; mutates nothing. |
| `glt-flow-card-minimap` | The whole diagram with the current viewport, keyboard-pannable. |
| `glt-flow-card-extension-manager` | Installed packs, their namespaces and versions, conflicts, and what each contributes. |

Phase-2/3/4 elements are reused unchanged.

## The symbol browser

- Every variant shows its base label, its style label and its category as text.
  A grid of pictures with no words is unusable by search and unreadable by a
  screen reader.
- The published count is displayed from the generated manifest, never computed in
  the browser. The number the user sees is the number the evidence proved.
- Filtering is by category, domain, style and free text, and an empty result says
  so rather than rendering an empty grid.

## Port and connection feedback

- A refused connection shows the reason in words, next to the two ports:
  "Medium mismatch: heating flow cannot connect to a signal port." Not a red
  outline alone, and never a silent no-op.
- A port renders its direction as a shape (arrow in / arrow out / bar for
  bidirectional) and its kind as a distinct glyph, so `process`, `signal` and
  `power` differ without colour.
- Multiplicity is shown when a port is at its limit, with the count.

## Routing presentation

- A crossing is drawn with an explicit hop or break so two lines that cross are
  distinguishable from two lines that join.
- A junction is drawn as a filled node, distinct from a crossing, and it stays in
  the same place across reroutes of unrelated paths.
- Parallel runs keep a declared spacing; two routes sharing a corridor never
  overlap into one apparent line.
- While a reroute is in flight the affected segments are marked, and unaffected
  segments do not move — a diagram where everything twitches on every drag is one
  nobody trusts.

## Designer transactions

- Every operation is undoable and redoable, including multi-object operations,
  and the undo entry names the operation ("Move 3 objects", "Delete layer").
- Destructive operations are confirmed through the Phase-2
  `glt-flow-card-control-confirm` element, not `window.confirm`. The legacy
  editor dialogs in `part03`/`part04` are replaced here — Phase 4 deliberately
  left them for this phase.
- A failed operation leaves the diagram exactly as it was. There is no partial
  apply.

## Non-pointer operation

This is a requirement, not an accessibility footnote: the kiosk layout Phase 4
established has no pointer at all.

- Every canvas gesture has a keyboard equivalent: select, extend selection,
  nudge, resize, group, align, distribute, reorder, connect, route, delete.
- Nudge has a coarse and a fine step, and both are discoverable.
- The minimap is pannable by keyboard.
- Connection is a two-step keyboard flow — choose source port, choose target port
  — with the refusal reason announced if the pair is incompatible.
- The complete workflow is asserted as one continuous keyboard scenario, not as
  per-element focusability.

## Extension manager

- Each pack shows its namespace, version, supported schema versions and the count
  of each contribution kind.
- A conflict names both packs and the contested id.
- Removal while referenced is refused, naming the referring projects.
- Nothing in this surface renders contributed markup as markup. Contributed text
  is text.

## Accessibility and localization

- German and English complete; a missing key is a build failure.
- Every state is symbol plus text, never colour alone.
- Visible focus survives forced-colors mode.
- 320px and 200% zoom lose no function; wide content scrolls in its own
  container, never the page.

## Forbidden in the generated artifact

- Any evaluation of contributed content: no `eval`, no `Function`, no dynamic
  `import()` of a contributed path, no `<script>` from a pack.
- Any network fetch initiated by a contribution.
- Any contributed SVG element or attribute outside the allowlist.
- Any `hass.callService` or `hass.callApi` from a Phase-5 surface.
- Any `window.confirm` or `alert` on a destructive editor path.

Each is asserted by the exact-dist effect ledger with a seeded violation proving
the assertion fails when it should, not by source inspection.
