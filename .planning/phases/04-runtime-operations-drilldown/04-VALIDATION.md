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

| Requirement | Clause | Evidence | Status |
|---|---|---|---|
| OPS-02 | A profile-driven object panel opens for every supported equipment type without a hand-designed popup | `py -3.13 -m pytest tests/components/glt_flow_card/test_panels.py -q -x` — one composed model per profile in the corpus, asserted region-by-region | planned |
| OPS-02 | Standard values, alarms, hours/starts and quality/freshness appear | `py -3.13 -m pytest tests/components/glt_flow_card/test_panels.py -q -x` | planned |
| OPS-02 | Only permitted controls appear | `py -3.13 -m pytest tests/components/glt_flow_card/test_panels.py tests/components/glt_flow_card/test_panel_enumeration.py -q -x` — seven principals, absence asserted not disablement | planned |
| OPS-02 | Accepted, readback-confirmed, timed-out and failed are separate outcomes | `node --test test/command-outcome.test.mjs` | planned |
| OPS-02 | Displayed target and result match the authoritative audit record | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-outcome` | planned |
| NAV-01 | Portfolio → site → plant → subsystem → equipment → datapoint → alarm → trend navigation | `node --test test/navigation.test.mjs` and `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation.py -q -x` | planned |
| NAV-01 | Permission-filtered links and breadcrumbs | `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation.py -q -x` | planned |
| NAV-01 | Breadcrumbs preserve time and alarm context | `node --test test/navigation.test.mjs` — round-trip corpus | planned |
| NAV-01 | Browser history and deep links | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-navigation` | planned |
| NAV-01 | No unauthorized aggregate count leaks | `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation_counts.py -q -x` | planned |

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
