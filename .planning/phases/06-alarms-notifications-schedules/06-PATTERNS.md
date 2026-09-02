# Phase 06 Patterns

Every pattern here is already load-bearing somewhere in the repository. Phase 6
introduces two new ideas — the **decision record** and the **resolved instant** —
and reuses the rest.

## One evaluator, and the surfaces render it

Established by Phase 2 for authority, Phase 4 for control lists, Phase 5 for
routing. The Companion decides; the browser draws what it decided. D4 is the
counter-example that motivates the whole phase: four independent derivations of
"is this alarm active", disagreeing, with the authoritative one displayed
nowhere.

The rule is not "the backend is right". It is that a browser reasoning from a
snapshot cannot be right about something time-dependent, because the snapshot is
older than the question.

## Retire, do not delete

Established in Phase 4 for controls and Phase 5 for the midpoint router. The
shipped card's `activeAlarm` becomes **reachable and inert**: the entry point
still exists, and a test asserts the shipped bytes reach neither a threshold
comparison nor a `callService`. Deleting it would leave nothing to test, and
"the string is absent" is a weaker claim than "the function is present and does
nothing".

Phase 5's specific lesson applies with force here: a retirement authored in
`src/` that never reached `dist/glt-flow-card.js` is not a retirement. The
assertion reads the generated artifact.

## Decision record

**New.** Every suppression, notification and schedule execution produces a value
that says what happened *and why*:

```
{outcome, reason, suppressed_by?, service?, target?, error?, at}
```

Not a boolean, and not a log line. D1 is a feature that reports success and does
nothing; D6 is a failure that is discarded twice. Both are the same defect —
an effect whose outcome has nowhere to live — and a record with a mandatory
reason is the fix for both.

This is Phase 5's "a refusal carries a reason" applied to effects rather than to
validation, and it inherits the same asymmetry: an *engineering* reason is
explanatory ("shelved until 2026-09-09 by anna"), a *policy* denial stays opaque.

## Resolved instant, not wall-clock string

**New.** A schedule entry is resolved to a UTC instant using the site timezone
and `fold` before anything compares it, and the deduplication key carries that
instant. Section 4 of the research shows why: comparing `%H:%M` skips the lost
hour outright, and the only thing preventing a double-fire in the ambiguous hour
today is a dedupe key that happens to be fold-blind — correctness resting on a
cache, which D8 will remove the moment the prune is fixed.

The two predicates needed — "does this local time exist on this date" and "is it
ambiguous" — are implemented in both runtimes and proven identical against a
committed corpus of transition dates. That is Phase 3's dual-runtime parity
instrument, unchanged.

## Deny-default closed sets

`CAPABILITIES`, `CONTROL_RESULT_STATES`, the Phase-3 vocabularies, Phase-5 port
kinds. Phase 6 adds the alarm priority vocabulary, suppression reasons,
notification outcomes, escalation stage kinds and schedule binding kinds. Each is
a frozen export with a membership test.

The priority vocabulary is the reason D12 exists: four vocabularies, none
declared, none closed, and an alarm marked `critical` counted by no roll-up. A
closed set plus a declared migration for stored strings is the whole fix.

## Allowlist at the call site

Established by `SAFE_SERVICE_DOMAINS` for controls and `_safe_domains(project)`
for schedules. `_notify_alarm` is the one outward-facing call with no guard
(D11), and it takes its domain from the project document — which is operator
input. The allowlist is per-site configuration, checked immediately before the
call, and an unlisted target is a recorded refusal rather than a silent skip.

## Bounded before interpreted

Phase-1 byte and depth budgets; Phase-3 node bounds; Phase-5 manifest limits.
Phase 6 adds bounds to `alarm_history` (D9 — `ack_alarm` inserts with no cap
while `alarm_transition` caps at `MAX_AUDIT`) and to `schedule_runs` (D8 — the
prune's comparison is broken so nothing is ever dropped). "Bounded, oldest
dropped" is a configured number, not an unwritten hope.

## An index is rebuilt from one place, and the rebuild is asserted

D3's fix is an entity→alarm index. A cache that misses a rebuild is a worse
defect than the scan it replaces — it is wrong silently, where the scan was only
slow. So there is exactly one function that builds it, every mutation path calls
that function, and a test mutates through each path and compares the index
against a full rescan.

## Close the schema before relying on the field

Phase 5's schema 4 closed the `port` shape because geometry that nothing declared
could not be relied on. Alarms and schedules are the next two: today
`delay_seconds` may be `"soon"` and a schedule `time` may be `"tea"`, and both
validate. Schema 5 closes both, with the migration written as data the way every
prior schema step was.

## Controlled RED, sentinel per file

`tools/assert-red.mjs` accepts a failing run only when exactly one *named*
sentinel fails with a literal `EXPECTED_RED[...]` marker plus the task's
effect-ledger prefix. Unchanged.

## Commit source, build, commit manifest

The ordering rule that cost Phase 5 several cycles: commit the authored change,
`npm run build`, `npm run stage:hacs`, then commit the manifest, then re-run the
gates. `build.commit` records the last commit touching a canonical source, so a
manifest committed alongside its source is always stale.
