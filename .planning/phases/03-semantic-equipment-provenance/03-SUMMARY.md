---
phase: 03-semantic-equipment-provenance
status: complete
completed: 2026-09-02
requirements: [OPS-01, SEM-01, MAP-01, PROF-01, PROTO-01]
threats_green: [T3-01, T3-02, T3-03, T3-04, T3-05, T3-06, T3-07, T3-08, T3-09, T3-10, T3-11, T3-12, T3-13]
threats_pending: [T3-14]
---

# Phase 3 Summary — Semantic Equipment & Provenance

All seventeen plans are implemented. The Phase-3 sentinel gate reports **seven
implemented, zero controlled RED, zero broken**.

## What was built

**Schema 3 and the hierarchy** (03-05, 03-06, 03-07). Schema 2 could not express
the model — `semantic_model` was an unvalidated open object, `sites` carried only
an id — so schema 3 was generated from schema 2 with a sequential 2→3 migration
on the existing receipted machinery. The graph rules the JSON Schema cannot
express live in `semantic-model.mjs` and its Python mirror: cycles of any length
report the node that closes the loop, level inversion and duplicate ids are
rejected, depth and breadth are bounded, and the containment path is derived
rather than stored. Vocabularies are closed and units carry dimensions.

**Provenance** (03-08, 03-09). Integration, config entry, device, area and
communication health come from Home Assistant's registries and state machine.
Nothing is inferred from a name. Health resolves disabled → unavailable → stale.
The route is project-scoped and describes only entities the project references,
so it cannot become a registry search; a hidden project answers byte-identically
to a missing one. The cache is generation-stamped and joins the lifecycle ledger.

**Profiles** (03-10, 03-11). Versioned and parametric. Two instantiations of one
version are byte-identical; an upgrade carries every still-addressable override
and reports what it cannot. A profile control is deny-default, so it cannot name
a domain, service or target.

**Mapping** (03-12, 03-13). Ranked with reasons, binding nothing without
acceptance, with manual overrides stored as decisions.

**Operational state** (03-14). A frozen precedence table with pairwise proof
generated from the table itself. Trust outranks activity.

**Surfaces, docs and gate** (03-15, 03-16, 03-17). Four custom elements in the
generated artifact, bilingual documentation, and `tools/verify-phase3.mjs` on the
Phase-2 orchestrator pattern with 22 gate mutation tests.

## What the work taught

Three findings came out of the corpus and the code rather than the plan:

1. **Mapping is an assignment, not a per-slot ranking.** `outdoor_temperature`
   ranked alone went to the domestic-hot-water sensor: right device, right area,
   right device class — every structural signal agreed and it was still wrong.
2. **An undeclared role token is an eligibility rule, not a penalty.** Scoring a
   setpoint at zero on name left it floating on device and area points until it
   won some other slot.
3. **Four latent index bugs.** `project_contract.py` split its schema list at
   literal index 3 and `project_bundle.py` selected the bundle manifest as
   `_ALL_SCHEMAS[3]`; adding schema 3 shifted both onto the project contract, so
   bundle manifests were being validated against it. Both now derive.

## The packaging gap this phase exposed

`ha-artifacts` went red with `FileNotFoundError` because the staged Companion had
no schema 3 and no vocabulary file — and every local gate passed anyway, because
the stager and the validator each keep their own list and both were incomplete.
The Phase-2 drift guard would have caught it but only walks `*.py`. It now walks
the schema directory too.

## Verification

| Command | Result |
|---|---|
| `node tools/phase3-red-gate.mjs` | 7 implemented, 0 controlled RED, 0 broken |
| `node --test test/phase3-gate.test.mjs` | 22 passed |
| `node tools/run-unit-tests.mjs` | 180 passed, 0 failed, 0 skipped |
| `pytest tests/components/glt_flow_card -q` | 195 passed |
| `node tools/run-exact-dist-playwright.mjs` | 30 passed |
| `npm run validate:hacs-staging` | 4 PASS |
| Owner commands T3-01 … T3-13 | all pass |
| `npm run test:phase3` | graph verified; fails closed at F3-06 (no Docker, provenance endpoints blocked) |

T3-14 stays `planned`: its owner needs a Docker engine this environment does not
have. It runs in CI.

## Constraints honoured

No live Home Assistant write, no service call, no remote or physical-bus write,
no credential handling. No release is authorized.
