---
phase: 02-authoritative-policy-controls-collaboration
plan: 04
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
red_sentinels: [phase2-configured-controls, phase2-control-evidence, phase2-migration-lifecycle]
---

# Plan 02-04 Summary — Control, Evidence and Lifecycle RED Contracts

## What was built

**Task 1 — configured-control normalization and bounds.**
`control_contract.py` states resolved A1 as constants: 4 KiB requests, depth 4,
64 nodes, 16 keys, 512-character strings, arrays of 32, 30 previews and 10
executes per minute with a burst of 3. It also names the only request fields a
browser may send and the twelve fields it may never influence — domain, service,
entity/device/area, target, service data, context, actor, time and result are
all resolved from the verified project head instead.
`test_configured_controls.py` proves resolved A4 (an Operator holds
`control.execute` but neither `lease.engineering` nor `project.write`), holds a
ten-case malicious-input table (unknown key, template, nested service call,
target and area override, oversized string and array, excess depth and keys, and
a non-object input), and proves the control tests' default posture is zero
service calls.

**Task 2 — control evidence and trusted/untrusted provenance.**
`test_control_evidence.py` fixes nine distinct lifecycle states with no
`succeeded` among them, separates the five post-dispatch states where a physical
action may already have happened, and names eight failure barriers on both sides
of dispatch. The sentinel requires a recorder that can record `accepted` durably
before dispatch, can inject every barrier, and exposes no retry or redispatch
entry point at all. `test_trusted_evidence.py` fixes the two separate stores'
bounds, proves the legacy client-authored `audit/add` route is retired, and
drives a forged telemetry payload that tries to claim `trusted: true`, another
user, a past timestamp, a control result and a security event kind.

**Task 3 — Phase-2 migration and runtime cleanup.**
`test_phase2_migration.py` maps legacy `permissions` onto fixed roles
deliberately downward (a legacy designer becomes an *engineer*, never an admin,
because the legacy block never expressed membership administration), requires
idempotent receipts, requires a malformed block to produce no assignments, and
forbids any bootstrap path from an imported candidate.
`test_phase2_lifecycle.py` fixes the release order — availability first, then
subscriptions, cursors, leases, control waits, rate buckets, tasks and listeners
— proves the resource ledger returns to zero across setup/unload/re-setup, and
proves a late callback is recorded without reviving the runtime.

## Verification

| Command | Result |
|---|---|
| `assert-red --expected=phase2-configured-controls -- pytest test_configured_controls.py` | CONTROLLED_RED accepted |
| `assert-red --expected=phase2-control-evidence -- pytest test_control_evidence.py test_trusted_evidence.py` | CONTROLLED_RED accepted |
| `assert-red --expected=phase2-migration-lifecycle -- pytest test_phase2_migration.py test_phase2_lifecycle.py` | CONTROLLED_RED accepted |
| `pytest tests/components/glt_flow_card -q` | 144 passed, 9 named sentinels failed, 0 skipped |

## Decisions

- The `controlled_service` fixture patches the `ServiceRegistry` class attribute
  with a `side_effect` rather than autospeccing it or patching the instance.
  `ServiceRegistry.async_call` is read-only on the instance, and an autospec
  patch collides with Home Assistant's own fixtures — either mistake surfaces as
  a fixture error, which the classifier correctly rejects as a broken harness
  rather than a controlled RED.
- `control_contract.py` is shared by the control and evidence tests so the
  resolved-A1 numbers exist in exactly one place and cannot drift apart.
