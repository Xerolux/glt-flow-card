---
phase: 02-authoritative-policy-controls-collaboration
reviewed: 2026-09-03
head: c487f0b
depth: standard
reviewer: close-out review pass
method: read at head, then probed against a running Companion
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
fixed_in_this_pass: 3
status: issues_found_and_fixed
---

# Phase 02: Code Review Report

**Scope.** The authorization boundary and everything that depends on it:
`policy.py`, `project_access.py`, `project_leases.py`, `policy_sessions.py`,
`trusted_evidence.py`, `dispatch_gate.py`, every `ws_*` route handler in
`__init__.py`, and the Phase-2 policy contract and matrix tests.

## Summary

The boundary itself is sound and unusually well argued. Authority comes from
exactly two places — a server-owned ACL role and the caller's own Home Assistant
authority — and the effective set is their intersection, so a project cannot
grant past Home Assistant and a Home Assistant administrator inherits no project
content. Every route is declared once in `COMMAND_POLICIES`; a route registered
but not declared, or declared but not registered, is a policy hole the tests
refuse. `authorize` runs in the synchronous WebSocket callback rather than in a
scheduled coroutine, so an unauthorized request never reaches a handler and can
have no effect to undo. Retired routes stay declared and answer
`feature_unavailable`, which is what makes retirement provable rather than
merely unreferenced.

One finding is critical, and it is a **class** the phase closed at one instance
and left open at three others.

## Critical

### CR-01: Three filtered routes returned rows of projects the caller cannot read — FIXED

**Files:** `custom_components/glt_flow_card/__init__.py` (`ws_work_orders_list`,
`ws_reports_list`, `ws_evidence_list`, and the `EvidenceCursorRegistry` wiring)

**Issue.** A route declared `enumeration="filter"` is deliberately *admitted* by
the policy guard even when the caller holds nothing, because refusing would
itself tell them rows exist. Filtering is therefore the handler's job. These
three handlers did none: they read `msg["project_id"]` (or, for evidence, took
`decision.project_id` and filtered by project alone) and returned every matching
row.

Probed against a running Companion with a principal holding **no membership
anywhere**, naming a project id directly:

| Route | What came back |
|---|---|
| `work_orders/list` | the project's work orders |
| `reports/list` | its report history, including what each report found |
| `evidence/list` | its **trusted audit trail** — who operated which entity, with what result |

`evidence/list` is the worst of the three. The repository's own constraint is
that authoritative audit events require server-side enforcement; this route
handed them to anyone authenticated to Home Assistant.

**Why it was invisible.** `test_policy_enumeration.py` is a thorough
route × principal matrix, but it asserts response *codes*. For a filtered route,
success **is** the correct code — however many rows arrive with it. The matrix
could not have caught this, and its own docstring says the row filtering "is
checked separately". For these three routes, it was not checked anywhere.

**Why three at once.** This is `9f53bcb` — the `alarms/list` leak found during
Phase 6 — repeated. That fix was applied to the instance. Every filtered route
written before the rule existed still had the defect; the ones written after it
(`schedules/list`, `history/series`, `history/statistics`, `remote/list`) cite
`9f53bcb` in their docstrings and filter correctly.

**Fix applied.** Each handler now resolves the project from the decision and
asks `policy.visible_projects` for **its own** capability
(`work_order.read`, `report.read`, `evidence.read`) — the pattern the
correctly-written routes already use. `evidence/list` is additionally authorized
at the source: the cursor's row provider re-checks `evidence.read` for the
scope's user, so a page redeemed after a revocation cannot carry rows its holder
may no longer read.

**Guard against the fourth instance.**
`tests/components/glt_flow_card/test_filtered_route_authority.py` derives its
route list from `COMMAND_POLICY_CONTRACT` and asserts the **rows**, not the code.
A project-scoped filtered route declared later must appear in `SEEDED` or in
`NOT_EXERCISED` **with a reason**, or the suite fails — so the next such route is
covered the day it is declared. It carries a vacuity guard (an authorized
principal must actually see each seeded row, or the hidden-caller assertion
would be passing over an empty store) and was mutation-checked: removing the
`work_orders` fix turns it red with the route named.

## Warning

### WR-01: The correct pattern is documented in prose, not enforced by shape — FIXED

**Files:** `custom_components/glt_flow_card/policy.py`, route handlers

A filtered route is correct only if its handler remembers to filter. Nothing in
the type of a `RoutePolicy`, the decorator, or the handler signature makes the
omission impossible — the rule lives in docstrings and in reviewers' memory,
which is precisely why it was forgotten four times.

**Fixed 2026-09-03, and the estimate above was wrong.** It read as a refactor of
eight handlers because the *result shapes* differ. They do — but the shapes are
data, and there was already one place every command passes through.

`RoutePolicy` now carries `empty_result`: what the route answers a caller who
may not read the project, as JSON, since the dataclass is frozen and a dict
default would be shared mutable state. `__post_init__` **refuses to construct**
an active project-scoped filtered route without one, so such a route cannot be
declared until somebody says what its empty answer looks like. `_guard_command`
then sends that answer itself when the capability is absent, and the handler is
never invoked — it cannot forget a filter it is never asked to perform.

`test_the_boundary_filters_without_the_handlers` proves the handlers are no
longer load-bearing: it puts a deliberately unfiltered handler behind the guard
— the original defect, exactly — and requires the answer to stay empty.
Confirmed the other way too: with the `work_orders`, `reports` and `alarms`
in-handler checks deleted, every assertion still passes. Those checks stay as
defence in depth.

The finding stands as written. It shipped, and the estimate that deferred it was
mine.

## Info

### IN-01: The phase has no phase-level summary

Every other phase from 3 onward has `NN-SUMMARY.md`. Phase 2 has 17 per-plan
summaries and no phase summary, so its threat closure and its findings live only
in the plan files. Written in this pass as `02-SUMMARY.md`.

## Evidence

| Command | Result |
|---|---|
| `node tools/python-launcher.mjs -m pytest tests/components/glt_flow_card -q` | 702 passed, 1 deselected |
| `node tools/run-unit-tests.mjs` | 521 passed, 0 failed |
| `node --test test/release-build.test.mjs` | 6 passed |
| `pytest test_filtered_route_authority.py` with the `work_orders` fix removed | 1 failed, naming the route — the guard is not vacuous |

## Verdict

**Issues found and fixed.** The boundary's design held under review; what failed
was the assumption that a fix applied once to one route had closed the class.
Both the critical finding and WR-01 are fixed and guarded; WR-01 was closed on
2026-09-03, after the estimate that deferred it turned out to be wrong.
