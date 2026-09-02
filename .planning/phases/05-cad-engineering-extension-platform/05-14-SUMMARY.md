# 05-14 — The designer surfaces

**Status:** complete. Task 2 found a defect in shipped bytes; see below.
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

## Task 2 — the dialogs, and what looking for them found

**Status: complete**, and it found more than it went looking for.

### The drift

Phase 4 retired the legacy control paths in `src/v040-extension.part05` and
`part06`. Those files are **not build inputs**. They are the authored form of an
extension that a manual workflow (`apply-v040.yml`) bundles with esbuild and
splices into the artifact, and that workflow was never run after Phase 4. So
every one of those retirements existed only in a file nobody ships, and
`dist/glt-flow-card.js` still carried the original override: a browser-side role
check, a `window.confirm`, and a call through to a `_tapEntity` that reached
`hass.callService` directly.

Part 06's content — the detailed symbol renderer among it — is absent from the
shipped artifact entirely, for the same reason.

### The worse one

The same defect was live in the **v100 layer**, which does ship, and nobody had
retired it there at all. `executeControl` in `src/v100/index.js` was three
defects stacked:

1. a role check the browser made — `currentRole` returned "designer" for any
   Home Assistant administrator;
2. a `window.confirm` standing in for an authorization prompt;
3. and, whenever `security.server_enforced` was false, a **direct
   `hass.callService`** behind a domain allowlist the browser also checked
   itself.

None of that is authority. Every one of those checks runs on a machine the
operator controls, and the service call at the end was the only thing that
mattered. Its server-enforced branch was no better: it called
`glt_flow_card/control/execute`, which the policy contract has carried as
`state: "retired"` since Phase 2.

### What shipped

Both legacy paths are inert, and both stay reachable, so the effect ledger can
prove no command produces a service call. Deleting them would move the proof
somewhere nothing checks. The surviving operate path is the server-composed
panel from Phase 4.

Ten `alert` calls and two `confirm` calls are gone, replaced by an inline status
strip in both layers. `alert` is modal, unstyleable, invisible to the effect
ledger and unreachable by the kiosk's key handling: a message that could have
been a sentence next to the thing it is about became a blocking interruption the
operator had to dismiss before they could look at what went wrong.

The destructive editor path — deleting a project — now goes through the Phase-2
`glt-flow-card-control-confirm`, in the generated base and in the authored parts
alike.

### The guard

`test/shipped-dialogs.test.mjs` reads `dist/glt-flow-card.js`, not the sources.
That is the whole point: a test over the authored sources is exactly what kept
passing while the shipped bytes carried the defect. It asserts zero bare
`alert`/`confirm` calls, that both retired entry points still exist and neither
reaches `callService` or the original tap, and that no `if (!canOperate(...))`
gates anything.

## What is still open

**Five `prompt()` calls** remain, all naming dialogs on editor paths. They are
not destructive and not what this plan names; replacing them with inline inputs
is its own change, recorded here rather than done quietly.

**The v040 extension parts 05 and 06 are still not in the artifact.** Fixing the
two paths that mattered does not fix the mechanism: the parts and the generated
base can drift again, and part 06's symbol renderer is still missing from what
ships. Re-bundling all seven parts and re-splicing them is what
`apply-v040.yml` exists to do, and it also bumps the package version to 0.4.0,
which this repository is long past. That is a decision about the build, not a
Phase-5 task, and it is raised rather than taken.
