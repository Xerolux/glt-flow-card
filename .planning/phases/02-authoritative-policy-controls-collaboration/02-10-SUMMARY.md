---
phase: 02-authoritative-policy-controls-collaboration
plan: 10
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-09]
---

# Plan 02-10 Summary — Trusted Evidence and Bounded Telemetry (GREEN)

## What was built

**Task 1 — two stores that can never merge.** `trusted_evidence.py` holds
`TrustedEvidenceStore` and `TelemetryStore` behind separate Home Assistant store
keys, versions and schemas. Trusted events are authored only by server
workflows: the server assigns the id, time, actor, result and correlation, and
every stored detail passes through a sanitizer that strips carriage returns and
newlines — an audit line that can contain them is an audit line that can forge a
second one. Events are capped at 8 KiB each and the store at 32 MiB with
oldest-first pruning.

`TelemetryStore` keeps browser rows permanently labelled `trusted: false` and
*discards* every field a payload might use to impersonate history — `trusted`,
`user_id`, `at`, `action`, `result`, `correlation_id` and `kind` are stripped
before storage and replaced with what the server itself observed. Rows are
capped at 4 KiB each, 30 per user per minute with a burst of 10, and 1,000 rows
or 4 MiB overall. `ControlEvidenceRecorder` records `accepted` durably *before*
dispatch and exposes eight injectable failure barriers, and deliberately has no
retry or redispatch entry point at all: a control that may already have moved a
physical thing is repaired forward by a person, never by code.

**Task 2 — policy-scoped reads.** `evidence/list` pages trusted rows through the
`EvidenceCursorRegistry` with the project resolved from the authorized decision;
`telemetry/list` and `telemetry/add` are separate routes with a separate result
shape and an explicit `provenance` label. The legacy `audit/list` keeps its name
so an older card still works, but its broad read is gone: rows are filtered to
the caller's authorized projects before serialization.

## Verification

| Command | Result |
|---|---|
| `pytest test_trusted_evidence.py -q -x` | 4 passed, including the live forgery attempt |
| `pytest test_trusted_evidence.py test_evidence_pagination.py test_policy_enumeration.py -q -x` | passed |
| `pytest tests/components/glt_flow_card -q` | 161 passed, 1 named sentinel RED |
| `npm test` | 0 failed |

## Decisions

- **Telemetry fields are stripped, not rejected.** A browser that sends
  `trusted: true` is far more likely to be a careless client than an attacker,
  and rejecting the whole row would lose real diagnostic signal. Dropping the
  claimed fields keeps the row useful and makes the forgery impossible.
- **`audit/list` keeps its name.** Renaming it would break older cards for no
  security gain; removing the broad read is what mattered.
- **The cursor registry receives evidence rows through a callable.** The paging
  contract was already provable in 02-07 without a row source, and the store now
  supplies one without either module depending on the other's internals.
