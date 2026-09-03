---
phase: 08-simulation-commissioning-assets
status: verified-except-T8-25
requirements: [SIM-01, DIAG-01, ASSET-01]
---

# Phase 08 Validation Map

The gate parses the table below. Six columns, and the threat cell carries every
threat the row's command proves, so coverage is checked against the register
without the two documents having to word anything identically.

## Requirement coverage

| Requirement | Threats | What is proven | Kind | Command | Status |
|---|---|---|---|---|---|
| SIM-01 | T8-03, T8-19 | Dispatch kinds, diagnoses and work-order transitions are closed sets mirrored in both runtimes, and schema 7 closes every field this phase reads with a sequential 6→7 migration | Dual-runtime contract | `node --test test/dispatch-vocabulary.test.mjs` | ✅ verified |
| SIM-01 | T8-07, T8-08 | A scenario is a pure function of definition and tick, reproducible byte for byte, evaluable with an empty state machine, and its values are validated against the profile before it is saved | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_scenarios.py -q -x` | ✅ verified |
| SIM-01 | T8-02, T8-06 | Simulation state is site runtime state the Companion owns, bounded by a TTL that is refused rather than capped, and it expires without intervention | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_simulation_session.py -q -x` | ✅ verified |
| SIM-01 | T8-01, T8-04, T8-05 | Every physical dispatch path refuses while a session is active, an unreadable state refuses with its own reason, and notification is marked rather than silenced | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_simulation_gate.py -q -x` | ✅ verified |
| SIM-01 | T8-03 | Every declared dispatch path is exercised and asserted, so a gate applied only where somebody remembered fails rather than passes | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_dispatch_enumeration.py -q -x` | ✅ verified |
| SIM-01 | T8-09, T8-23, T8-24 | Simulated values are marked as text and shape with colour removed, operator text reaches the DOM as text and still reaches the reader, and every workflow is keyboard-reachable | Browser artifact | `node tools/run-exact-dist-playwright.mjs --grep=phase-8-simulation` | ✅ verified |
| DIAG-01 | T8-10, T8-11, T8-13 | The diagnostic is computed by the Companion from the registries, references are collected from declared locations only, and the four registry/state combinations are four diagnoses | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| DIAG-01 | T8-12, T8-15, T8-16 | Services are checked alongside entities, unit and device-class mismatches name both sides, duplicate bindings are detected, and suggestions are bounded with the bound stated | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| DIAG-01 | T8-14, T8-17 | A full diagnostic run produces an empty dispatch ledger while having produced findings, and readiness is counts per diagnosis rather than an invented percentage | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_commissioning.py -q -x` | ✅ verified |
| ASSET-01 | T8-18, T8-19, T8-20 | Work-order entries are append-only with status derived from them, transitions are checked against a closed table before anything is stored, and attachments and history are bounded with limits stated | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_work_orders.py -q -x` | ✅ verified |
| ASSET-01 | T8-21 | Due and next-due are computed from a declared plan reusing Phase 7's period resolution, and an operating-hour plan states its coverage and refuses below a threshold | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_maintenance_plans.py -q -x` | ✅ verified |
| ASSET-01 | T8-22 | Record identity is derived from content through one shared helper, byte-identical across both runtimes, so two records made in the same millisecond differ and the same record re-derives | Dual-runtime contract | `node --test test/content-id.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_content_id.py -q -x` | ✅ verified |
| SIM-01 | T8-25 | Authored source, generated card, Companion copy, HACS stage and ZIP, HA lanes, docs and release evidence agree byte for byte, installed as the exact stage | Release evidence | `npm run test:phase8:release` | ⏳ planned |
