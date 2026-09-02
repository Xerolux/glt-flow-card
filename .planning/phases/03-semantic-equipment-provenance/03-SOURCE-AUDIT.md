---
phase: 03-semantic-equipment-provenance
audited: 2026-09-02
---

# Phase 03 Source Audit

What exists today, what Phase 3 must change, and what it must not disturb.

## Canonical sources this phase edits

| Path | Today | Phase-3 change |
|---|---|---|
| `schemas/project/2.schema.json` | Current head schema | Frozen. Never edited again; schema 3 is a new file. |
| `schemas/project/3.schema.json` | Absent | New: hierarchy, vocabularies, datapoint semantics, versioned profiles. |
| `tools/generate-project-validators.mjs` | Compiles schemas 0-2 plus the bundle manifest | Add `project3`; both runtimes regenerate from it. |
| `src/v100/project-migrations.mjs` | `CURRENT_PROJECT_SCHEMA_VERSION = 2`, steps 0→1 and 1→2 | Add step 2→3 and bump the current version. |
| `src/v100/project-contract.mjs` | Raw-first validation, reference edges, id collections | Extend `REFERENCE_EDGES` and `ID_COLLECTIONS` for the hierarchy; add cycle detection. |
| `custom_components/glt_flow_card/project_contract.py` (generated) | Mirrors the JS validators | Regenerated; parity suite must cover schema 3. |
| `src/v100/semantic-model.mjs` | Absent | New: containment tree, path derivation, vocabulary checks. |
| `src/v100/equipment-state.mjs` | Absent | New: the deterministic state precedence table and resolver. |
| `src/v100/entity-mapping.mjs` | Absent | New: pure candidate ranking and confidence reasons. |
| `custom_components/glt_flow_card/provenance.py` | Absent | New: registry-derived provenance and communication health. |
| `custom_components/glt_flow_card/equipment_profiles.py` | Absent | New: profile version resolution and override-preserving instantiation. |

## Contracts this phase must not weaken

- **Phase-2 policy boundary.** Every new route declares a capability in
  `policy.py` and in `tests/.../policy_contract.py`, and the registration oracle
  keeps the two sets exactly equal. The route count moves again; the lifecycle
  ledger's exact number moves with it.
- **Configured controls.** A profile-defined control is still resolved server-side
  from the verified head. A profile must not become a way to name a domain, a
  service or a target.
- **Non-enumeration.** A provenance or mapping query about an entity in a project
  the caller cannot see answers exactly as a missing project does.
- **No live writes.** Reading registries is a read. Nothing in this phase dispatches
  a service, opens a socket, or contacts a remote site or fieldbus.
- **Exact artifacts.** `dist/`, the Companion `www` copy and the editor bundle stay
  byte-identical to a fresh canonical build, and the HACS stages keep their exact
  allowlists — a new Python module must be added to all three packaging lists, which
  the drift guard added in Phase 2 now enforces.

## Fixtures and corpora

- `test/contract-fixtures.test.mjs` and the shared corpus drive dual-runtime parity;
  schema 3 needs valid, boundary and invalid fixtures in the same corpus.
- The 100/500/2,000-object correctness fixtures must round-trip through the 2→3
  migration without loss, and remain correctness classes rather than capacity claims.
- MAP-01 requires realistic iDM profile fixtures. They are authored as test data in
  the repository; no vendor system is contacted.

## Known drift traps

- Adding a Python module without updating `tools/stage-hacs-packages.mjs`,
  `tools/validate-hacs-staging.mjs` and `test/hacs-staging.test.mjs` breaks the HACS
  lanes. Phase 2 added a guard that fails when an authored module is not staged.
- The build manifest records the last commit touching a canonical source, so a
  Python or schema change must be committed before the rebuild that regenerates it.
- Registering a websocket route without declaring it in both policy tables fails the
  registration oracle, and the exact route count in `test_init.py` must move with it.
