---
phase: 04-runtime-operations-drilldown
status: planned
requirements: [OPS-02, NAV-01]
---

# Phase 04 Validation Map

Each row binds one success criterion or requirement clause to the behavioral evidence
that proves it. A row is `verified` only after its command has actually run and
passed at the current head.

## Requirement coverage

The gate parses this table. Six columns, and the threat cell carries every
threat the row's command proves, so coverage can be checked against the register
without the two documents having to word anything identically.

| Requirement | Threats | What is proven | Kind | Command | Status |
|---|---|---|---|---|---|
| OPS-02 | T4-01 | The server composes the panel; a forbidden control is absent, not disabled | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_panels.py -q -x` | ✅ verified |
| OPS-02 | T4-02 | No panel leaks an object, alarm or dispatch target across the project boundary | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_panel_enumeration.py -q -x` | ✅ verified |
| NAV-01 | T4-03, T4-05 | Every level resolves, every denial is opaque, every address is bounded before the walk | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation.py -q -x` | ✅ verified |
| NAV-01 | T4-04 | Roll-ups are summed after the project filter, and an authorized zero is absent | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation_counts.py -q -x` | ✅ verified |
| NAV-01 | T4-06 | The address is the state; back re-resolves rather than replaying a cached view | Browser reducer | `node --test test/navigation.test.mjs` | ✅ verified |
| OPS-02 | T4-07 | All nine result states render distinctly; only readback_confirmed is success; no retry | Browser reducer | `node --test test/command-outcome.test.mjs` | ✅ verified |
| OPS-02 | T4-08 | The displayed target and result match the authoritative audit record | Exact artifact | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-outcome` | ✅ verified |
| OPS-02 | T4-09 | A gap marks the view stale in one transition and nothing is interpolated | Dual-runtime stream | `node --test test/view-resync.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_view_stream.py -q -x` | ✅ verified |
| OPS-02 | T4-10 | Snapshot concurrency and resync rate are bounded, and exceeding them answers rate_limited | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_view_stream.py -q -x` | ✅ verified |
| OPS-02 | T4-11 | No tap action reaches a service call and no dialog stands in for authorization | Exact artifact | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-legacy-retired` | ✅ verified |
| OPS-02 | T4-12 | Unload leaves no view budget, subscription or in-flight resync behind | Lifecycle | `py -3.13 -m pytest tests/components/glt_flow_card/test_phase4_lifecycle.py -q -x` | ✅ verified |
| NAV-01 | T4-13 | The workflow is usable by keyboard in both languages across four layouts | Exact artifact | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-ui` | ✅ verified |
| OPS-02 | T4-14 | Authored source, generated card, stage, lanes and release evidence agree | Release | `npm run test:phase4:release` | ⏳ planned |

## Success-criterion coverage

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Consistent profile-driven panel, permitted controls only | `test_panels.py`, `test_panel_enumeration.py` | planned |
| 2 | Four separated outcomes matching the audit record | `test/command-outcome.test.mjs`, exact-dist `phase-4-outcome` | planned |
| 3 | Deep links, history, breadcrumbs, no unauthorized resolution or counts | `test_navigation.py`, `test_navigation_counts.py`, `test/navigation.test.mjs`, exact-dist `phase-4-navigation` | planned |
| 4 | Reconnect and sequence-gap resync without stale-as-live or page reload | `test/view-resync.test.mjs`, `test_view_stream.py`, exact-dist `phase-4-resync` | planned |
| 5 | Keyboard and assistive DE/EN across four layouts, no direct-service fallback | exact-dist `phase-4-ui`, `phase-4-legacy-retired` | planned |

## Exact-dist matrix

Criterion 5 is the largest single block of evidence in the phase, so it is enumerated
here rather than discovered while writing tests. Every cell runs against the exact
generated artifact.

| Layout | Viewport | Languages | Scenarios |
|---|---|---|---|
| Mobile | 320 × 640 | DE, EN | panel open, control confirm, drill-down, breadcrumb back |
| Tablet | 768 × 1024 | DE, EN | panel open, outcome states, deep link |
| Widescreen | 1920 × 1080 | DE, EN | full navigation, counts, resync |
| Kiosk / leitstand | 1920 × 1080, no pointer | DE, EN | keyboard-only traversal of the complete workflow |

Cross-cutting assertions applied to every cell: visible focus on every interactive
element; every state distinguishable without color (symbol plus text, from the
Phase-3 `SYMBOLS` table); 200% zoom with no loss of function; forced-colors mode
readable; a live region announcing outcome and staleness transitions; and a zero
`callService` / zero `callApi` effect ledger.

## Bounds asserted

| Bound | Value | Where |
|---|---|---|
| Address depth | the Phase-3 `max_depth` of 32 | `navigation/resolve` |
| Address serialized length | bounded before parse | `navigation.mjs`, `test_navigation.py` |
| Panel regions per model | bounded | `panels/get` |
| Datapoints per panel | bounded | `panels/get` |
| Concurrent snapshot requests per connection | bounded | `views/subscribe` |
| Resync rate per connection | bounded | `views/subscribe` |
| Subscriptions per connection | 8, inherited from `MAX_SUBSCRIPTIONS_PER_CONNECTION` | `policy_sessions.py` |

## Not proven here

- Recorder-backed trend content, coverage and provenance. HIST-01 in Phase 7 owns it;
  Phase 4 proves only that the region renders its declared `history_unavailable`
  state and requests nothing.
- Alarm lifecycle semantics (Phase 6), report generation (Phase 7), simulation
  (Phase 8) and remote sites (Phase 9). Phase 4 proves the navigation and permission
  behavior of the links to them, not their behavior.
- Measured capacity at 100/500/2,000 objects. Phase 10 owns it; Phase 4's fixtures are
  correctness-only.
