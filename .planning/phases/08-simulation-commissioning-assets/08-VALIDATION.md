---
phase: 08-simulation-commissioning-assets
---

# Phase 8 Validation Map

| Requirement | Success criterion | Proven by | Threat rows |
|---|---|---|---|
| SIM-01 | Repeatable virtual-time scenarios before entities exist | `test_scenarios.py` — same definition and tick yields byte-identical state, evaluated with an empty state machine | T8-07, T8-08 |
| SIM-01 | Physical gateways hard-blocked under direct, reconnect and failure-injection attempts | `test_simulation_gate.py` + `test_dispatch_enumeration.py` — every declared dispatch kind, including an unreadable-state injection | T8-01, T8-02, T8-03, T8-04 |
| SIM-01 | Simulated values visibly marked | `project-assets.spec.mjs` grep `phase-8-simulation` — marked as text and shape, provider stated | T8-09 |
| DIAG-01 | Every referenced entity and service classified with provenance | `test_commissioning.py` — the four registry/state combinations, unit and device-class mismatch, duplicates, missing services | T8-10, T8-11, T8-13, T8-15, T8-16 |
| DIAG-01 | Read-only, with evidence and remediation links that do not write | `test_commissioning.py` — a full run produces an empty service ledger | T8-14, T8-17 |
| DIAG-01 | Bounded suggestions | `test_commissioning.py` — the bound is applied and stated | T8-12 |
| ASSET-01 | Interval and operating-hour plans, due and next-due | `test_maintenance_plans.py` — computed from a declared plan, coverage stated | T8-21 |
| ASSET-01 | Valid transitions and immutable completion history | `test_work_orders.py` — closed transition table, append-only entries | T8-18, T8-19 |
| ASSET-01 | Bounded attachments and storage | `test_work_orders.py` — refused rather than truncated, limits stated | T8-20 |
| ASSET-01 | Reproducible identity | `test_content_id.py` + `test/content-id.test.mjs` — byte-identical across runtimes | T8-22 |
| All | German and English accessible workflows against the exact artifact | `project-assets.spec.mjs` | T8-23, T8-24 |
| All | Exact packaged artifacts | `npm run test:phase8:release` | T8-25 |

## What would falsify this phase

- A dispatch path exists that `decide_dispatch` never sees. The enumeration test
  is the guard, and if it can be satisfied by a path that does not actually call
  the decision, the test is decoration.
- A scenario that is repeatable only because nothing varies. The corpus must
  contain a scenario whose value changes per tick, or "reproducible" is proven
  on a constant.
- A commissioning finding that is correct but unlocatable. `reference` must name
  the declaring site, not just the entity.
- A work-order history that is append-only in the store but rendered as a single
  mutable row, which would preserve the record and hide it.
