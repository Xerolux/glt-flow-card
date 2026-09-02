---
phase: 03-semantic-equipment-provenance
status: approved
nyquist_compliant: true
requirements: [OPS-01, SEM-01, MAP-01, PROF-01, PROTO-01]
---

# Phase 03 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | pytest + pytest-homeassistant-custom-component 0.13.316; Node 22 test runner; Playwright 1.62.1 |
| **Config files** | `pytest.ini`, `playwright.config.mjs`, `tests/components/glt_flow_card/conftest.py` |
| **Quick run command** | `npm run test:phase3:quick` |
| **Full local command** | `npm run build && npm test && npm run test:python && npm run test:e2e` |
| **Release/HA leaf command** | `npm run test:phase3:release` |
| **Max task feedback latency** | 30 seconds for focused tests; full gates after every wave |

## Sampling Rate

Every implementation wave is followed by its owner command. No three consecutive
implementation tasks may pass without a behavioral suite executing against them.

## Requirement Verification Map

| Requirement | Threat Refs | Secure Behavior | Test Type | Automated Command | Status |
|-------------|-------------|-----------------|-----------|-------------------|--------|
| SEM-01 | T3-01, T3-12 | Typed containment, one parent, level order, cycle and depth/breadth rejection, derived paths | Dual-runtime contract | `py -3.13 -m pytest tests/components/glt_flow_card/test_semantic_model.py -q -x && node --test test/semantic-model.test.mjs` | ⬜ pending |
| SEM-01 | T3-02 | Closed unit, medium, direction and semantic-tag vocabularies reject unknown members | Contract | `node --test test/semantic-model.test.mjs` | ⬜ pending |
| SEM-01 | T3-03 | The 2→3 migration is sequential, receipted, lossless over the corpus and idempotent | Dual-runtime migration | `node --test test/v100-migrations.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q -x` | ⬜ pending |
| PROTO-01 | T3-04, T3-06 | Provenance and health come from registries and config entries; unknown stays unknown; names never infer a protocol | HA integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_provenance.py -q -x` | ⬜ pending |
| PROTO-01 | T3-05 | Provenance reads authorize per project and answer hidden and missing identically | Multi-user HA | `py -3.13 -m pytest tests/components/glt_flow_card/test_provenance_policy.py -q -x` | ⬜ pending |
| PROF-01 | T3-07, T3-08 | Versioned profiles instantiate identically, preserve overrides across upgrades, report what they cannot carry, and name no effect | Store/WS integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_equipment_profiles.py -q -x` | ⬜ pending |
| MAP-01 | T3-09 | Ranking explains itself, binds nothing without acceptance, preserves overrides and supports undo | Node reducer | `node --test test/entity-mapping.test.mjs` | ⬜ pending |
| MAP-01 | T3-10 | Browser and Companion ranking agree exactly on the shared corpus, including the iDM fixtures | Dual-runtime parity | `node --test test/entity-mapping.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_entity_mapping.py -q -x` | ⬜ pending |
| OPS-01 | T3-11 | One severity-ranked state per equipment; trust outranks activity; symbol, quality, freshness, DE/EN label and drill-down agree | Node exhaustive | `node --test test/equipment-state.test.mjs` | ⬜ pending |
| OPS-01 / SEM-01 | T3-13 | The exact card shows state and provenance with non-colour cues, keyboard access and no unauthorized data, in German and English | Exact-dist Playwright | `node tools/run-exact-dist-playwright.mjs --grep=phase-3-ui` | ⬜ pending |
| All | T3-14 | Schema 3, generated validators, packaged modules and exact artifacts agree across runtimes and with the checked-in bytes | Release/HA artifact | `npm run test:phase3:release` | ⬜ pending |

## Wave 0 Requirements

- [ ] `test/semantic-model.test.mjs`, `test/entity-mapping.test.mjs`,
      `test/equipment-state.test.mjs` — browser-side RED sentinels.
- [ ] `tests/components/glt_flow_card/test_semantic_model.py`,
      `test_provenance.py`, `test_provenance_policy.py`,
      `test_equipment_profiles.py`, `test_entity_mapping.py` — Companion sentinels.
- [ ] `tests/components/glt_flow_card/registry_factory.py` — entity, device, area and
      config-entry registry fixtures covering core, custom and absent integrations.
- [ ] `test/fixtures/idm/*.json` — realistic iDM profile and mapping fixtures.
- [ ] `tools/assert-red.mjs` — the Phase-3 sentinel keys registered alongside Phase 2's.
- [ ] `package.json` — `test:phase3:quick`, outer `test:phase3`, non-recursive leaf
      `test:phase3:release`.

## Mandatory Failure Injection

- Containment cycles of length 1, 2 and n; a parent pointing at a deeper level; a
  node with two parents; a tree at and beyond the depth and breadth bounds.
- Unknown unit, medium, direction and semantic tag at every position that accepts one.
- Migration interrupted between steps; a schema-2 document that is already invalid;
  the whole 100/500/2,000-object corpus round-tripped.
- An entity absent from the registry, present but disabled, present but unavailable,
  owned by a config entry in a failed state, and owned by an integration the card has
  never heard of.
- A registry lookup for an entity inside an unauthorized project, and for one that
  does not exist.
- A profile upgrade whose new version removes a slot an override addresses.
- Re-ranking after a manual override; undo after acceptance; an acceptance whose
  dependency closure has grown since the preview.
- Every pair of the sixteen state inputs, asserted against the precedence table.

## Manual-Only Verifications

None. No live Home Assistant, remote site, fieldbus or plant write is required or
authorized.

## Validation Sign-Off

- [x] Every requirement surface has an automated command or an explicit Wave-0 dependency.
- [x] Sampling continuity prevents three consecutive unverified implementation tasks.
- [x] Failure injection covers every new trust boundary.
- [x] No watch-mode flags or live control targets are used.
- [x] Exact generated artifacts, not source modules alone, are required at the phase gate.

**Approval:** approved 2026-09-02; execution evidence pending.
