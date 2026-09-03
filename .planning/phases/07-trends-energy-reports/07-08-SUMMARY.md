# 07-08 — History gets its own boundary

**Status:** complete. Both tasks verified at head. T7-01's sentinel is green.

## What was built

Four routes — `history/series`, `history/statistics`, `history/coverage`,
`history/export` — declared in `policy.py` and in the test-owned
`policy_contract.py`, registered as websocket commands, and audited. Two new
capabilities, `history.read` and `history.export`.

The handler bodies are deliberately thin: they enforce the boundary and answer
with `source: "unavailable"`, `coverage: 0` until 07-09 and 07-10 fill in bounds
and coverage. **An empty, honestly-sourced result rather than a fabricated one**
— which is the phase's rule applied to its own unfinished state.

## Where the capabilities sit, and why

`history.read` is the **viewer's**. Whoever may see the plant's current state may
see how it reached it, and the boundary this creates is about bounds and audit
rather than about hiding history from someone who can already read every entity
the card references.

`history.export` is the **operator's**, and is rate-limited like a mutation
although it writes nothing. An export leaves the building; what it costs is the
reason for the rate class, not what it changes. This mirrors `report.run`, which
is kept out of the viewer's set for the same reason.

## What the work found

**My own sentinel guessed at an implementation shape.** It asserted
`policy.POLICY_TABLE` exists — a name I invented. The real mapping is
`COMMAND_POLICIES`, and the sentinel now asserts against *that*, because it is
the mapping the guard itself consults. Asserting against the thing that decides
is stronger than asserting against a table that might merely describe it.

This is the third time this phase that the warning in `07-PATTERNS.md` has been
violated by me while writing the file that quotes it. The pattern holds: naming
an outcome is harder than naming a module, and the easy version is always
available.

**The narrower mirror did its job by refusing.** Passing `rate_class="mutation"`
into the contract table raised a `TypeError`, because `policy_contract.py`
deliberately models only the authorization-relevant fields. That is the
duplication working: the contract asserts what it is for, and refuses to grow
into a copy of the shipped table.

**The lifecycle ledger counts commands exactly.** Adding four routes moved it
from 49 to 53, and it failed until declared. An exact count catches both a route
that appears without being declared and one that survives an unload.

## A refinement to the manifest ordering rule

I flagged the manifest as stale after this commit, because the last commit
touching *a Python module* was newer than `build.commit`. It was not stale.
`build.commit` records the last commit touching a **canonical build source**, and
the Companion's Python modules are not build inputs — the build bundles
`src/v100/` into the card. Rebuilding was idempotent and both the double-build
test and `validate:hacs-staging` passed.

Worth recording precisely, because the failure and the false alarm look
identical from the outside: *a Python-only change does not invalidate the
manifest; a change to `src/v100/`, `schemas/` or `package.json` does.*

## Evidence at head

- `py -3.13 -m pytest tests/.../test_history_routes.py` — passes.
- `npm run test:python` — 499 passed, 9 deselected.
- `npm test` — 448 passed, 0 failed.
- `node tools/phase7-red-gate.mjs` — 8 controlled RED, 3 implemented, 0 broken.
- `npm run validate:hacs-staging` — passes with the new module staged.
