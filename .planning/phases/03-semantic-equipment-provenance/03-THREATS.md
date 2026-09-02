---
phase: 03-semantic-equipment-provenance
status: planned
asvs_level: 1
asvs_version: 5.0.0
requirements: [OPS-01, SEM-01, MAP-01, PROF-01, PROTO-01]
---

# Phase 03 Threat Register

Phase 3 adds read surfaces and a richer contract. Its risks are less about privilege
than about *false confidence*: a state, a provenance claim or a mapping that looks
authoritative and is not. Every threat below is a release blocker until its owner
command passes. No test may contact a live Home Assistant, remote site, fieldbus or
plant target.

## ASVS L1 Mapping

| ASVS area | Phase-3 control |
|---|---|
| V4 Access Control | Registry, provenance and mapping reads authorize through the Phase-2 boundary and never enumerate hidden projects or entities. |
| V5 Validation | Closed vocabularies, bounded hierarchy depth and breadth, cycle rejection, and identical rules in both runtimes. |
| V8 Data Protection | Registry data is exposed only for entities inside a project the caller may read; device identifiers and connections are bounded and not echoed wholesale. |
| V11 Business Logic | One deterministic operational state; nothing binds a mapping without human acceptance. |

## Canonical Threats

| ID | STRIDE | Abuse case / invariant | Owner plan | Blocking evidence | Status |
|---|---|---|---|---|---|
| T3-01 | Tampering | A containment cycle, a dangling parent, a level inversion or an over-deep tree is accepted, so navigation, permissions and roll-ups walk a graph that has no bottom. | 03-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_semantic_model.py -q -x && node --test test/semantic-model.test.mjs` | planned |
| T3-02 | Tampering | A unit, medium, direction or semantic tag outside its declared vocabulary passes validation and reaches a conversion or a roll-up. | 03-06 | `node --test test/semantic-model.test.mjs` | planned |
| T3-03 | Tampering | The 2→3 migration drops, reorders or invents project content, or is not idempotent across a dry run and an apply. | 03-05 | `node --test test/v100-migrations.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q -x` | planned |
| T3-04 | Spoofing | A protocol or integration is inferred from an entity id or a friendly name, so a datapoint claims a provenance no registry supports. | 03-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_provenance.py -q -x` | planned |
| T3-05 | Information disclosure | A provenance or mapping query reveals entities, devices, areas or config entries outside the caller's authorized projects, or answers a hidden project differently from a missing one. | 03-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_provenance_policy.py -q -x` | planned |
| T3-06 | Repudiation / Safety | Communication health reports healthy for an unavailable, disabled or stale entity, so an operator acts on a value that is not live. | 03-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_provenance.py -q -x` | planned |
| T3-07 | Elevation | A profile names a domain, a service or a target, reintroducing the caller-authored control path Phase 2 removed. | 03-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_equipment_profiles.py -q -x` | planned |
| T3-08 | Tampering | A profile upgrade silently drops an engineer's override, or two instantiations of one profile version differ. | 03-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_equipment_profiles.py -q -x` | planned |
| T3-09 | Tampering | A mapping binds without human acceptance, a re-rank overrules a manual override, or an acceptance cannot be undone. | 03-12 | `node --test test/entity-mapping.test.mjs` | planned |
| T3-10 | Spoofing | Ranking disagrees between the browser and the Companion, so the mapping a person reviewed is not the mapping that is applied. | 03-12 | `node --test test/entity-mapping.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_entity_mapping.py -q -x` | planned |
| T3-11 | Repudiation / Safety | An equipment with a communication error, an invalid value or a stale reading is presented as running, or two of symbol, colour, label and drill-down disagree. | 03-14 | `node --test test/equipment-state.test.mjs` | planned |
| T3-12 | Denial | A hostile or accidental project — deep trees, huge fan-out, thousands of candidates — makes validation, ranking or state resolution unbounded. | 03-06 | `node --test test/semantic-model.test.mjs` | planned |
| T3-13 | Information disclosure / Tampering | The exact generated card leaks entity, device or area data the viewer may not see, or presents state without a non-colour cue in German or English. | 03-15 | `node tools/run-exact-dist-playwright.mjs --grep=phase-3-ui` | planned |
| T3-14 | Tampering / Supply chain | Schema 3, its generated validators, the packaged Companion modules or the exact artifacts diverge between runtimes or from the checked-in bytes. | 03-17 | `npm run test:phase3:release` | planned |

## Blocking Rule

Every row begins `planned` and may become `verified` only when its owner command
passes with non-skipped behavioral counts and the Phase-3 evidence manifest binds
that output to the exact generated artifacts. Any HIGH finding, missing owner,
skipped test, zero-test run, unbounded path, live target or unintended service
effect blocks release.

T3-14 has one canonical non-recursive owner, `npm run test:phase3:release`, following
the same rule Phase 2 established: the outer gate invokes that leaf exactly once, and
nothing reachable from the leaf may invoke the outer gate.
