# 06-02 Summary — one closed alarm vocabulary

**Status:** complete. `node --test test/alarm-vocabulary.test.mjs` 12/12,
`pytest test_alarm_vocabulary.py` 11/11, `npm test` 366/366,
`npm run test:python` 349 passed.

## What was closed

Six frozen sets, mirrored in both runtimes: `ALARM_PRIORITIES` (ordered),
`ALARM_STATES`, `SUPPRESSION_REASONS`, `NOTIFICATION_OUTCOMES`,
`ESCALATION_STAGE_KINDS`, `SCHEDULE_BINDING_KINDS`. Parity is proven by
comparing canonical JSON, not field by field — Phase 3's lesson, that two
runtimes can agree on a verdict while building different models.

`ALARM_STATES` gains `indeterminate`, which plan 06-08 needs: an entity that
went `unavailable` has not returned to normal, and "cleared" is the one answer
that is certainly wrong.

## Three members, not four

`critical` and `fault` are the same tier under two names in the data that
exists. The editor's `critical` is labelled Störung; `navigation.py` treated
`fault` as its top counted severity; `project-operations.js` renders `fault`
with the severe mark and everything else with the mild one. Declaring them
distinct would invent a distinction the data does not have and silently re-tier
every stored project.

**Limitation, recorded rather than hidden.** A site whose alarm philosophy uses
four or five priority classes cannot express that today; extending the set is a
schema change, not a setting. The research says sites differ on *how many*
classes they use, and this ships three. Which of them escalate, and at what
delay, remains configuration — so the constraint is on the vocabulary's size,
not on the philosophy built from it.

> **Closed 2026-09-03.** The limitation rested on a conflation. The invariant
> the closed vocabulary established is *exactly one declared vocabulary, read by
> both runtimes* — it never required exactly three members. A site now declares
> its own ordered scale of two to six tiers in site **options** (not project
> documents, for the reason `notify_allowlist` is not project data), both
> runtimes resolve it from that one place, and the parity corpus compares every
> acceptance **and every refusal** across fourteen scales. A stored priority the
> site does not declare is reported, never silently re-tiered. A site that
> declares nothing is byte-identical to before, asserted rather than assumed.


## The counting defect, closed and proven

The test that matters reproduces `navigation.py`'s old rule beside the new one
and shows them disagreeing: two authored alarms, one `critical` and one
`warning`, counted 1 by the old rule and 2 by the new. So the fix cannot be
mistaken for a refactor.

`navigation.py` now **migrates rather than matches**, which is the other half:
a stored string nobody declared lands in the most severe bucket and is reported,
instead of vanishing from the total the way `critical` did.

## Touched a Phase-4 test, and why that is not a weakening

`test_navigation_counts.py` asserted `totals(...).get("fault")`. The corpus
still stores `fault`; it now migrates to `critical`, so the key moved. The
claim under test — counts are computed *after* the project filter, so a
restricted project's alarm never reaches a non-member's total — is unchanged and
just as strong. The test now derives the key from `migrate_severity("fault")`
rather than writing `critical`, so if the vocabulary moves again it follows
instead of silently passing against a key nobody reports.

## Packaging

`alarm_vocabulary.py` was added to all three independent HACS lists
(`stage-hacs-packages.mjs`, `validate-hacs-staging.mjs`, `hacs-staging.test.mjs`).
The duplication is deliberate and at three different trust boundaries.
