# 06-03 Summary — schema 5

**Status:** complete. `npm test` 367/367, `npm run test:python` 350 passed.

## What closed

`alarm` and `schedule` are now closed shapes with `unevaluatedProperties: false`,
alongside `alarmCondition`, `notificationPolicy`, `escalationStage` and
`scheduleBinding`. `delay_seconds: "soon"` and `time: "tea"` are both rejected.

Schema 5 was **generated** from schema 4. Every version-bearing value was
derived from the source: the `$id`, the `schema_version` maximum, and the
envelope's `const`. The bundle manifest's own bound is derived from the project
schema, so the two cannot drift.

The collections to close were found by **walking** the definitions rather than
by naming them, which caught `profile.alarms` — the audit called it "equipment
level", and a hand-written list would have inherited that mistake.

## Three deliberate omissions

`severity`, `acknowledged`, `shelved_until` and `shelved_by` are not declared,
so `unevaluatedProperties` rejects them and the migration quarantines what it
finds. `severity` is replaced by `priority`: declaring both would let the two
vocabularies coexist forever, which is the defect. The other three are runtime
state the engine writes into `alarm_state`; blessing them in a project document
would make a design-time file a place to store what an operator did.

`label` is a union of a bounded string and an object, because real projects
carry both, and migrating `"Low flow"` into `{de, en}` would invent a
translation.

`state` **is** declared, with a note. It is the design-time field the engine
never writes — D4's fourth derivation — and plan 06-15 removes the reads in
`panels.py` and `navigation.py`. Declaring it keeps the Phase-4 fixtures that
prove those reads valid until then; a later schema drops it once nothing reads
it. Dropping it here would have been doing 06-15's work inside 06-03, and would
have broken the tests that prove the defect exists.

## Quarantine, not deletion, and never coercion

A rejected value moves into `legacy` and is reported. This differs deliberately
from the 3→4 port rule, which dropped unknown keys: a port carrying an unknown
key was a schema-2-era accident, while `delay_seconds: "soon"` is something a
person typed on purpose.

Nothing is coerced. Turning `"soon"` into `0` would convert a visible
misconfiguration into an alarm that fires instantly and looks correct.

## Found while doing it

**The migration's field list and the schema disagreed.** `state` was declared in
schema 5 and missing from `_ALARM_FIELDS`, so the migration quarantined it. The
symptom was not a validation error — it was the Phase-4 portfolio roll-up
silently counting nothing, because the count reads a field the migration had
moved into `legacy`.

Both lists now match, and a test in each runtime compares them against the
schema file. A mismatch of that shape is silent by nature, so it is asserted
rather than reviewed.

## Fixtures moved to the current version, and why that is not weakening

Fixtures pinning `schema_version: 4` now read `CURRENT_PROJECT_SCHEMA_VERSION`.
The transaction digest assertions are the clearest case: with a superseded
version pinned, a migration would run inside `preview()`, and
`assert preview["candidate_digest"] == digest(original)` would quietly stop
testing "the preview digests what the caller submitted" and start testing the
migration. The future-version tests derive `CURRENT + 1` for the same reason —
they keep testing the boundary instead of a version that has since shipped.
