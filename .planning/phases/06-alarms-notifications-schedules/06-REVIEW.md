---
phase: 06-alarms-notifications-schedules
reviewed: 2026-09-03
head: 0eed520
depth: standard
reviewer: close-out review pass
method: read at head, plus a mechanical sweep of every effect call site
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: no_defects_found
---

# Phase 06: Code Review Report

**Scope.** `alarm_engine.py`, `alarm_vocabulary.py`, `notifications.py`,
`schedules` routes, `dispatch_gate.py`, `escalation`, and the alarm and schedule
surfaces in the shipped artifact.

## Summary

No defect found. The pass concentrated on **T6-08** — `_notify_alarm` calling any
domain and service named in the project document, with no allowlist — because
that is the phase's elevation threat and the class it belongs to (an ungated
path to a Home Assistant service) is the one this product has had to close
repeatedly.

Every call in the Companion that can cause an effect outside the integration was
enumerated mechanically. There are **five**, and every one consults a decision
before it acts:

| Site | Gate |
|---|---|
| `__init__.py:1129` (schedule action) | domain allowlist, then `decide_dispatch("schedule")` |
| `__init__.py:1574` (configured control) | `decide_dispatch`, refusal audited |
| `__init__.py:2241` (retired `control/execute`) | domain allowlist raising `PermissionError`, then `decide_dispatch` |
| `notifications.py:211` (alarm notification) | `is_allowed(domain, service, allowlist)`, then `decide_dispatch("notification")` |
| `manager.remote_control` | `decide_dispatch("remote_control")` and `_may_reach_site` |

**The class is already guarded, and not by this phase.**
`tests/components/glt_flow_card/test_dispatch_enumeration.py` (Phase 8, T8-03)
parses the Companion with `ast`, finds every `async_call` and `remote_control`
call site, and requires `decide_dispatch` above it in the same function. Its
exemption list is **empty**, and its comment records that it was written
expecting two entries and that both turned out to be wrong reasoning. A sixth
effect call added without a gate fails that test. This is the structural answer
the Phase-2 pass had to build by hand for filtered routes; here it already
existed.

**The simulation decision is the right way round.** A notification during a
rehearsal is *marked*, not silenced. The comment in `notifications.py` states
why: suppressing alarms during a commissioning test creates a window in which
nobody is told about a real fault, which is a worse safety defect than the one
being closed. The marker travels on the audit record as well as in the message,
so rehearsal traffic can be separated afterwards without parsing German prose.

**A refused notification is recorded, not skipped.** An operator who configured
a target the site does not permit sees the refusal rather than believing the
page went out.

## Info

### IN-01: One plan closed without a summary

`06-20`, the phase gate. Written in this pass with the standard reconstruction
disclaimer. Its three obligations are worth having on the record, because each
is a way a gate can lie: keyword-presence assertions deleted rather than left
passing beside the behavioural ones; every threat row marked from its **own**
owner command; and a row whose owner could not run left `planned` with the
reason named exactly, because "blocked" without the reason is how a row that
could have run gets excused along with one that could not.

## Evidence

| Command | Result |
|---|---|
| `pytest` over the nine Phase-6 owner modules | 86 passed |
| `pytest test_dispatch_enumeration.py` | included above — the AST sweep, exemption list empty |
| `node tools/run-exact-dist-playwright.mjs` | 92 passed, including the T6-20 markup-injection specs |

## Verdict

**No defects found.** T6-21 stays `planned` for the recorded reason. The two
recorded limitations still hold: a site cannot express four or five alarm
priority classes without a schema change, and measured capacity at thousands of
alarms belongs to Phase 10.
