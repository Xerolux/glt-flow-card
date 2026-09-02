---
phase: 04-runtime-operations-drilldown
status: planned
asvs_level: 1
asvs_version: 5.0.0
requirements: [OPS-02, NAV-01]
---

# Phase 04 Threat Register

Every Phase-4 threat is a release blocker until its owner command passes against
behavioral tests and, where applicable, the exact generated artifacts. Phase 4 adds
no authority: it renders authority Phase 2 owns over the model Phase 3 settled. Its
threats are therefore mostly about *presentation that outruns evidence* — a panel
that shows a control the server would refuse, a count that reveals a subtree, a
badge that calls a dispatched command done, a view that keeps rendering after its
authority is gone. No test may contact a live Home Assistant, remote site, fieldbus
or plant target.

## ASVS L1 Mapping

| ASVS area | Phase-4 control |
|---|---|
| V3 Session Management | Snapshots and event streams are bound to the connection, the runtime generation and a monotonic sequence; a gap invalidates the view rather than being smoothed. |
| V4 Access Control | Panel regions, control lists, navigation targets, breadcrumbs and aggregate counts are all filtered server-side before serialization. |
| V5 Validation | Deep-link addresses are validated against the Phase-3 hierarchy and bounded in depth and length before resolution. |
| V7 Error Handling | An unauthorized address, a missing node and a deferred route all answer with the one opaque `not_found_or_denied` shape. |
| V14 Configuration | The retired legacy tap path stays declared and provably inert rather than deleted and forgotten. |

## Canonical Threats

| ID | STRIDE | Abuse case / invariant | Owner plan | Blocking evidence | Status |
|---|---|---|---|---|---|
| T4-01 | Elevation | The browser composes a panel's control list from a profile plus a capability snapshot, offering a control the server would refuse. The control list must arrive already filtered; a forbidden control is absent, never present-and-disabled. | 04-05 | `py -3.13 -m pytest tests/components/glt_flow_card/test_panels.py -q -x` | planned |
| T4-02 | Information disclosure | A panel model leaks a datapoint, provenance row, alarm or child node outside the caller's authorized scope, or leaks `domain`/`service`/`target` for a control. Filter before serialization; the panel carries no dispatch target at all. | 04-05 | `py -3.13 -m pytest tests/components/glt_flow_card/test_panels.py tests/components/glt_flow_card/test_panel_enumeration.py -q -x` | planned |
| T4-03 | Elevation / Information disclosure | A deep link resolves for a principal who may not open it, or distinguishes "not permitted" from "does not exist". Every resolve re-authorizes from scratch and both answer `not_found_or_denied` byte-identically. | 04-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation.py -q -x` | planned |
| T4-04 | Information disclosure | An aggregate count, badge or roll-up over a subtree reveals that unauthorized objects exist there. Counts are computed over the authorized scope only, and an empty authorized scope is indistinguishable from an absent one. | 04-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation_counts.py -q -x` | planned |
| T4-05 | Denial / Validation | A crafted address exhausts the server through depth, length, breadth or repetition; or an unbounded ancestry walk is triggered by a cyclic reference. Addresses are bounded before resolution and the Phase-3 depth bound is re-asserted here. | 04-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_navigation.py -q -x` | planned |
| T4-06 | Tampering / Spoofing | A view keeps rendering after its authority changed, or replays a cached snapshot on browser Back instead of re-resolving. Back and forward re-resolve through the server; an authority change invalidates the view in the same render cycle. | 04-09 | `node --test test/navigation.test.mjs` | planned |
| T4-07 | Repudiation / Safety | A command that only reached `accepted` or `dispatched` is presented as done. Only `readback_confirmed` may render as success; `timed_out`, `result_unknown` and `failed_after_dispatch` direct the user to current state and trusted audit, never to a retry button. | 04-11 | `node --test test/command-outcome.test.mjs` | planned |
| T4-08 | Repudiation | The displayed target or result disagrees with the Companion's authoritative audit record for the same command id. Exact-dist evidence must compare the rendered outcome against the audit row. | 04-11 | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-outcome` | planned |
| T4-09 | Tampering | A sequence gap, reconnect or snapshot/event interleave is smoothed over, presenting stale data as live, or is repaired by interpolation. A gap marks the view stale and requests a fresh snapshot; nothing is interpolated. | 04-12 | `node --test test/view-resync.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_view_stream.py -q -x` | planned |
| T4-10 | Denial | Resync storms: a view that refetches on every event, or an unbounded number of concurrent snapshot requests per connection, becomes a denial of service against its own backend. The resync rate and concurrency are bounded and the bound is tested. | 04-12 | `py -3.13 -m pytest tests/components/glt_flow_card/test_view_stream.py -q -x` | planned |
| T4-11 | Elevation | The retired legacy tap path still reaches `hass.callService`, or `canOperate` still admits an operator because no permission list is configured. Both must fail closed with a zero-effect ledger. | 04-13 | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-legacy-retired` | planned |
| T4-12 | Denial / Elevation | Reload, unload or late callbacks leave ghost view subscriptions, panel caches or in-flight resync tasks, or a stale generation's snapshot is served after a restart. Runtime becomes unavailable first and the resource ledger reaches zero. | 04-14 | `py -3.13 -m pytest tests/components/glt_flow_card/test_phase4_lifecycle.py -q -x` | planned |
| T4-13 | Information disclosure / Tampering | The runtime workflow is unusable or misleading by keyboard, at 320px, at 200% zoom, in forced colors, on the pointerless kiosk layout, or in either language; or a state is distinguished by color alone. Exact-dist DE/EN evidence across four layouts is mandatory. | 04-15 | `node tools/run-exact-dist-playwright.mjs --grep=phase-4-ui` | planned |
| T4-14 | Tampering / Supply chain | Authored source, generated card, Companion copy, HACS stage/ZIP, HA lanes, docs or release evidence diverge; or a test causes a service effect. Build once, compare exact bytes, install the exact stage, fail on any unintended effect. | 04-17 | `npm run test:phase4:release` | planned |

## Evidence Status

Every row begins `planned`. This register is written before execution and no row may
be marked `verified` from planning alone.

T4-14 is expected to stay `planned` in the current execution environment for the same
reason T2-16 and T3-14 did: its owner installs the exact stage on digest-pinned Home
Assistant images and needs a Docker engine this container does not have. It is
exercised by the `ha-artifacts` CI job and by the release workflow.

## Blocking Rule

Phase closure may change a row to `verified` only when the listed owner command
passes, emits non-skipped behavioral evidence, and the Phase-4 evidence manifest
binds the command output to the exact generated artifacts. Any HIGH finding, missing
owner, skipped test, zero-test run, unbounded path, live target or non-zero
unintended service effect blocks release.

T4-14 has one canonical non-recursive owner: `npm run test:phase4:release`. That leaf
runs exact HACS validation, both immutable HA artifact lanes, release verification,
no-rebuild release acceptance and their zero-effect ledger checks. The outer
`npm run test:phase4` / `tools/verify-phase4.mjs` chain may invoke this leaf exactly
once. Neither the leaf nor anything reachable from it may invoke `test:phase4`,
`tools/verify-phase4.mjs` or `test:phase4:release`.
