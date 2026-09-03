---
phase: 02-authoritative-policy-controls-collaboration
plan: 11
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-06, T2-07, T2-08]
---

# Plan 02-11 Summary — Configured Controls (GREEN)

## What was built

**Task 1 — current-head resolution.** `configured_controls.py` resolves a
control's whole effect from the verified project head. A request may carry only
the control id, the revision it believes it is acting on, and the bounded input
the control's own schema declares. `normalize_input` checks the resolved-A1
bounds *before* the schema — 4 KiB, depth 4, 64 nodes, 16 keys, 512-character
strings, arrays of 32 — then refuses server-owned field names, templates,
unknown keys and non-scalar values. `resolve_control` refuses an unknown
control, a closed maintenance or simulation gate, an unsafe domain, and
immutable data that tries to smuggle a target past the target field.

**Task 2 — one attempt, honest evidence.** `controls/execute` records `accepted`
durably before dispatching, so a failure there means nothing was dispatched and
nothing needs repair. It then makes exactly one `hass.services.async_call` with
the resolved target and an authenticated context, records `dispatched`, and only
a matching readback may become `readback_confirmed`. A dispatch that raises is
recorded as `result_unknown` — the Companion cannot tell whether the plant
moved, so it says so and never tries again on its own.

**Task 3 — the legacy adapter is gone.** `control/execute` stays registered as a
retired stub returning `feature_unavailable`, and the three `remote/*` routes
stay declared and deferred until Phase 9.

## Verification

| Command | Result |
|---|---|
| `pytest test_configured_controls.py -q -x` | 7 passed |
| `pytest test_control_evidence.py -q -x` | 9 passed, including the live one-attempt dispatch |
| `pytest tests/components/glt_flow_card -q` | **165 passed, 0 failed** |
| `npm test` | 0 failed |
| `npm run test:phase2` | 3 controlled RED, **9 implemented**, 0 broken |

## Decisions

- **A rejected request still consumes the execute budget.** Otherwise a
  malformed payload is a free retry, and an attacker gets unlimited attempts.
  The live malicious-input test accepts either `invalid_input` or
  `rate_limited` and asserts the thing that matters: zero service calls.
- **The test asserts the merged call data, not `ServiceCall.target`.** Home
  Assistant merges the target into the call data, so `data["entity_id"]` is the
  exact entity the plant was asked to act on — the security-relevant fact.

## A bug this plan found

`ControlEvidenceRecorder` used `evidence or TrustedEvidenceStore(hass)`. That
class defines `__len__`, so an *empty* store is falsy: the recorder silently
built a second store and wrote every control event into it, while reads came
from the runtime's. The live test caught it — the evidence assertions saw an
empty list. Fixed to `is not None`, with a comment naming the trap. The two
fixtures that both patch `ServiceRegistry.async_call` had the same shape of
problem: `controlled_service` captured "the current implementation", which was
the other fixture's blocker, so an explicitly permitted call was still refused.
`conftest.py` now captures the pristine implementation at import.
