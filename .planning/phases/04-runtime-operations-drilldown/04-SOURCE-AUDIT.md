# Phase 04 Source Audit

**Audited:** 2026-09-02 at `b69cd67`
**Purpose:** Record exactly what Phase 4 inherits, what it must reuse, and what it must retire.

## Reused unchanged

| Source | What Phase 4 takes from it |
|---|---|
| `custom_components/glt_flow_card/policy.py` | `COMMAND_POLICIES`, `RoutePolicy`, `Actor`, `Decision`, `capabilities_for`, the closed `CAPABILITIES` set and the stable non-enumerating error codes. Every Phase-4 route is declared here or it does not exist. |
| `custom_components/glt_flow_card/policy_sessions.py` | `SubscriptionRegistry` with its monotonic `sequence()`, per-emission re-authorization, `MAX_SUBSCRIPTIONS_PER_CONNECTION = 8`, generation binding and `REVOCATION_EVENT`. Phase 4 adds the client half, not a second registry. |
| `custom_components/glt_flow_card/provenance.py` | `ProvenanceService.async_describe` and the `disabled → unavailable → stale → live` health order, for the panel's quality/freshness region. |
| `custom_components/glt_flow_card/equipment_profiles.py` | `validate_profile`, `instantiate_profile`, `FORBIDDEN_CONTROL_FIELDS`. The panel's region list comes from the instantiated profile. |
| `custom_components/glt_flow_card/configured_controls.py` | Server-side control resolution from the verified head. Phase 4 adds no control resolution of its own. |
| `src/v100/equipment-state.mjs` | `STATE_PRECEDENCE`, `resolveEquipmentState`, `stateProjection`, the DE/EN `LABELS` and the per-state `SYMBOLS`. The panel and every navigation node badge render from these. |
| `src/v100/semantic-model.mjs` | `semanticPath` and `SEMANTIC_LEVELS` for breadcrumb ordering and address validation. |
| `src/v100/configured-control.mjs` | `CONTROL_RESULT_STATES` (nine), `CONTROL_SUCCESS_STATES` (`readback_confirmed` alone), `CONTROL_TERMINAL_STATES`, `CONTROL_UNKNOWN_STATES`. Phase 4 surfaces these; it must not add a tenth state or widen success. |
| `src/v100/project-authority.mjs` | The fail-closed authority reducer and its ten read-only reasons, including `authority/sequence-gap` — already the exact signal Phase 4's resync path needs. |
| `src/v100/project-safety-i18n.mjs` | The DE/EN string mechanism. Phase-4 strings extend it rather than starting a second catalog. |

## Extended

| Source | Extension |
|---|---|
| `custom_components/glt_flow_card/policy.py` | Three new declared routes: `panels/get`, `navigation/resolve` and `views/subscribe`. Route count goes 38 → 41. All three are project-scoped and carry `project.read`, so an unassigned caller gets the same opaque denial a hidden project gives. |
| `custom_components/glt_flow_card/__init__.py` | Three handlers, their cache invalidation in `async_invalidate`, and their entries in the lifecycle resource ledger. |
| `src/v100/entry.js` | One new module import for the operations surfaces. |
| `tools/stage-hacs-packages.mjs`, `tools/validate-hacs-staging.mjs`, `test/hacs-staging.test.mjs` | Every new Companion module, in all three lists. Phase 3 learned what happens when only two are updated. |

## Retired

| Source | Why | How |
|---|---|---|
| `src/v040-extension.part06:85` `canOperate(card)` | A browser-invented permission: it reads `card._config.permissions` and `hass.user.is_admin`, and **returns `true` when no permission lists are configured at all**. It is the defect the roadmap names first. | Retired with the tap path below; the panel's control list comes from the server or is absent. |
| `src/v040-extension.part06:120` `runTap` `call-service` / `perform-action` branch | A direct privileged fallback: it splits a caller-supplied `service` string and passes caller-supplied `data` and `target.entity_id` straight to `hass.callService`. Phase 2 retired the equivalent server route (`glt_flow_card/control/execute`); the browser twin survived. | Declared retired, failing closed with zero effects, proven by an effect-ledger test that no `callService` is reachable through any tap action. |
| `src/v040-extension.part02:10` `canOperate(config, hass)` | The same browser-side role check, against a `designer` role that Phase 2 already removed from the fixed role set. | Retired with `_tapEntity`'s guard; the surviving path is the server-composed panel. |
| `src/v040-extension.part06:88` `confirmControl` | A `window.confirm()` standing in for authorization, skippable by config (`confirm_controls === false`). | Replaced by Phase 2's `glt-flow-card-control-confirm`, which confirms an already-authorized server-resolved control. |

## Present but deliberately untouched

| Source | Decision |
|---|---|
| `src/generated-bases/glt-flow-card.base.js:455` direct `hass.callApi("GET", "history/period/...")` | Unbounded, unfiltered, browser-authored Recorder access. HIST-01 in Phase 7 owns replacing it. Phase 4 must **not** extend it into the new panel; the panel's trend region renders a declared `history_unavailable` state until Phase 7. Leaving a known-weak path in place for one phase is a deliberate scope call, recorded here so it is not mistaken for an oversight. |
| `glt_flow_card/alarms/*`, `work_orders/*`, `reports/*` | Declared and capability-gated already. Phase 4 links to them and renders their counts; Phases 6, 7 and 8 own their behavior. |
| `glt_flow_card/remote/*` | `state="deferred"` until Phase 9. Navigation must not offer a remote address, and `navigation/resolve` must answer a remote target with the same opaque denial. |

## Counts at audit time

- Declared WebSocket routes: 38 — 31 active, 3 deferred (the Phase-9 remote routes), 4 retired. Retired and deferred routes stay declared so the registration oracle can prove they fail closed.
- Custom elements in the generated artifact: 10 — six from `project-safety.js` and four from `project-semantics.js`.
- Node unit tests: 180. Python tests: 195. Exact-dist Playwright tests: 30.
