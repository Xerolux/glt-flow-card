# 05-18 — Nothing survives a reload, and nothing dangles

**Status:** complete
**Requirements:** SDK-01 · **Threat:** T5-15 GREEN

## Task 1 — lifecycle and referential safety

**Registries die with the runtime.** `async_invalidate` clears every registry
and empties the map. A pack surviving an unload would be one accepted under a
project schema version living on into an installation running another, and a
symbol resolvable from a dead generation is worse than a missing one — a
diagram would keep drawing something nobody validated.

**Availability disappears first**, as in Phase 2 and Phase 4, so nothing
admitted mid-teardown observes a half-released runtime. The test installs an
observer on `clear` and requires it to see `available == False`.

**Removal is refused while a project still draws with the pack.** A dangling
symbol reference is a diagram that has silently stopped meaning something, which
is worse than one that will not let you delete something. The refusal names the
referring projects and the exact contribution ids, so the owner knows what to
change before trying again.

`project_references` looks in every place a project can name a contribution —
`equipment[].symbol`, `.symbol_variant`, `.profile`, `profiles[].extends`, and
the `contributions` collection — and treats only namespaced ids as pack
references, so a first-party symbol like `heat_pump_neo` never keeps a pack
installed.

**The registry never goes looking for projects.** `remove` is handed the project
documents to check, and the handler offers only the one project the policy
decision approved. That is what keeps a refusal from naming a project the caller
cannot see: not a filter that could be forgotten, but an argument that was never
passed.

## Task 2 — three packaging lists

Already satisfied, one module at a time, as each landed: `ports.py`,
`sdk_manifest.py`, `sdk_registry.py` and `schemas/project/4.schema.json` are in
the stager, the independent validator and the staging drift guard. Each addition
was caught by the guard first — three separate failures, one per list — which is
the packaging gap Phase 3 found working as designed.

## Evidence

- `pytest tests/components/glt_flow_card/test_phase5_lifecycle.py` — 8 tests.
- Full component suite: 312 passed.
- `node --test test/hacs-staging.test.mjs` — passing, with all three lists in
  agreement.
