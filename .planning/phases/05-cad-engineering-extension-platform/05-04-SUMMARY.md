# 05-04 — Schema 4, the 3→4 migration, and the CAD corpus

**Status:** complete
**Requirements:** ENG-01, SDK-01

## What shipped

**Schema 4.** Generated from schema 3 with every collection preserved.
`profile.ports` gained a closed shape — `id`, `medium`, `direction`, `side`,
`kind`, `multiplicity` — replacing a `$ref: openObject` that validated nothing,
and `contributions` arrived as a validated collection with a deny-default
contribution shape. `from_port`/`to_port` already existed on `path` and were
already consumed by `smartRoute`, so the path shape did not change.

Every index into the schema list is derived. The generators, the stager and the
fixture builder derive theirs from `PROJECT_SCHEMA_SPECS`; the staging and
release validators *discover* the schema directory instead, so an agreement
between them is evidence rather than a shared constant. `PROJECT_VALIDATORS`
became a derivation over the generated module rather than a literal array —
the literal was the source of one of the cascade failures below.

**The 3→4 migration.** `stepThreeToFour` and `_step_three_to_four` on the
existing sequential, receipted, dry-run-first machinery. Unknown port keys are
dropped; `kind` is defaulted only where the medium makes it unambiguous, and
left absent otherwise. An endpoint that cannot be derived is left absent and
reported rather than guessed — a guessed endpoint is exactly the silent
detachment ENG-01 exists to prevent.

**The CAD corpus** (`tests/components/glt_flow_card/cad_factory.py`). Five
situations, each adversarial by construction: a barrier squarely on the
sightline; two routes sharing the one gap between riser blocks; two diagonals in
a closed box that must cross; three routes terminating at one `many` port; and
one pair whose only defect is a medium mismatch. Ports live on profiles and
several equipment share a profile, so `p-out` is not an identity and only
`(equipment, port)` is — the corpus would be easier to write otherwise and would
then stop testing the thing ENG-01 fixes.

## Evidence

- Four of eleven paths defeat an elbow-through-the-midpoint router; the plan
  required three. `path-obstructed` runs into `eq-barrier`,
  `path-corridor-south` into both riser blocks, and both crossing routes into
  the structural core.
- The naive crossing does not cross: it lays 200 units of one route on top of
  the other. `collinear_overlap` measures it, so "a crossing is legible, an
  overlap is not" is a checked property.
- Every port kind, multiplicity, side and direction the schema admits appears
  on equipment the corpus actually routes between.
- The corpus validates against schema 4 and the semantic model.
- Full component suite: 234 passed. Re-run in an isolated HA lane containing
  only `custom_components/`, `tests/`, `config/` and `pytest.ini`, with no
  `node` on `PATH`: 234 passed.

## What this cost, and what it caught

Raising the schema version touched fourteen places across nine lists. Three were
real defects rather than bookkeeping:

- `PROJECT_VALIDATORS` was a literal array, so the migration target validated
  against schema 3 and reported the new project invalid.
- The bundle manifest's `schema_version.maximum` was a second bound on the same
  fact, and needed raising for the same reason Phase 3 raised it.
- `_empty_project` derived its version number but not its collections, so a
  synthesized rollback snapshot and a migrated one stopped being byte-identical.
  Migrating up from v0 is not available — v0 has a different shape — so the
  literal stayed, now guarded by a test that downgrades, migrates back and
  requires identical bytes.

The lane-portability guard added in Phase 4 earned its place again: nothing in
the corpus may reach outside the HA lane, and the isolated run proves it.
