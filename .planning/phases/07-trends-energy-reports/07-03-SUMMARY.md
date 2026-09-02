# 07-03 — Schema 6 and the sequential 5→6 migration

**Status:** complete. Two tasks, both verified at head, in both runtimes.

## What was built

`schemas/project/6.schema.json` closes the five shapes schema 5 left as
`openObject`: `trend`, `energy`, `historian`, `reports` and `replay`. Seven new
`$defs` — `period`, `trendSettings`, `energySettings`, `historianSettings`,
`replaySettings`, `meter`, `reportDefinition`, `reportSettings` — plus closed
enums for period names, aggregates, sources, weekdays, meter models, media and
report formats.

The sequential receipted 5→6 migration in both runtimes, with the field lists
mirrored and asserted against the schema.

## What the work found

**A meter that does not declare its model is the whole defect, in one field.**
A rate is integrated over a period and a counter is differenced across one, and
the shipped code multiplies a cumulative reading by a price because nothing ever
said which it was. `model` is therefore *required*, and the migration reads it
off the unit only where the unit decides it. For `BTU/h`, or an empty unit, the
unit is quarantined and reported rather than guessed — guessing `counter` makes a
power sensor's lifetime reading a cost, guessing `rate` integrates something that
was never a rate, and **both produce a plausible number**, which is the failure
this phase exists to stop.

**One word, two closed sets, two meanings.** The shipped `historian.aggregate`
default is `"raw"`, meaning "every sample, no bucketing". But this phase already
uses `raw` in the source vocabulary, where it means "answered from raw states
rather than long-term statistics". Two adjacent closed sets sharing a member name
with different meanings is how the four disagreeing alarm vocabularies started,
so the identity aggregate is named `none` and the migration renames it.
`aggregateSeries` still honours `raw` for a project that has not migrated yet.

This was not noticed by review. It surfaced as `contract.type@/historian/aggregate`
when the contract rejected the default that `ensureV1` writes into every project.

**Quarantine needs somewhere to go.** The five settings shapes rejected their own
migration output, because quarantine writes into `legacy` and none of them
declared one. The contract caught it immediately — `contract.type@/historian` —
which is the right place for it to fail, but it is worth recording that a closed
shape which quarantines needs `legacy` in the same commit, not the next one.

**Adding a schema version is a nine-place change.** Every one was found by a
failing assertion rather than by remembering:

| Place | How it failed |
|---|---|
| `tools/generate-project-validators.mjs` | no `project6` export |
| `test/contract-fixtures.test.mjs` path list | generator and expectation disagree |
| `custom_components/.../project_contract.py` schema tuple | version 6 rejected |
| `schemas/bundle-manifest.schema.json` maximum | `bundle.manifest_mismatch` |
| migration chain assertions, both runtimes | step list and version literal |
| `test/fixtures/contracts/manifest.json` | digests and the future-version fixture |
| `test/release-build.test.mjs` versions | `[0,1,2,3,4,5]` |
| `test/release-build.test.mjs` artifact paths | both copies of the schema |
| `test/hacs-staging.test.mjs` component files | staged file list |

The duplication is deliberate — each list sits at a different trust boundary —
so nine is a feature rather than an accident. What is worth carrying forward is
that **the count is only tolerable because every one of them fails loudly.**

**The `allOf` const is the trap in copying a schema.** Schema 6 was derived from
5 and inherited `"schema_version": {"const": 5}`. It fails as
`contract.schema_version ... expected: 5`, which names the value rather than the
copy, and reads like the *document* is wrong rather than the schema.

**`npm run build` does not write the checked-in validators.** It generates them
into the bundle; `npm run generate:contract:validators` writes
`src/v100/generated/project-validators.mjs`. Building and then wondering why
`project6` was missing cost a cycle. The file's timestamp is what settled it.

## Limitation recorded

`max_points` is declared rather than quarantined, because `ensureV1` writes it
into every project and quarantining would churn every legacy block. **Nothing
reads it.** It is a bound that does nothing, which is the exact shape this phase
objects to elsewhere — 07-09 is what makes the bounds real, and until then this
one is declared and inert.

## Evidence at head

- `node --test test/v100-migrations.test.mjs` — 10 passed, including the three
  new closure assertions.
- `py -3.13 -m pytest tests/.../test_project_migrations.py` — 6 passed.
- `npm test` — 447 passed, 0 failed, 0 skipped.
- `npm run test:python` — 499 passed.
- `npm run test:e2e` — 49 passed.
- `npm run validate:hacs-staging` and `node tools/verify-docs-site.mjs` — pass.
