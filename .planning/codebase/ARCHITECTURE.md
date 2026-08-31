<!-- refreshed: 2026-08-31 -->
# Architecture

**Analysis Date:** 2026-08-31

## System Overview

```text
┌────────────────────────────────────────────────────────────┐
│                 Browser presentation layer                  │
├──────────────────┬──────────────────┬─────────────────────┐
│ HA Lovelace Card │ HA Visual Editor │ Standalone Designer │
│ `custom_components/│ `custom_components/│ `docs/editor/`       │
│ .../www/*.js`     │ .../www/*.js`     │                       │
└────────┬─────────┴─────────┬─────────┴─────────────────────┘
         │                  │
         │ HA state/service│ config-changed / localStorage
         ▼                  ▼
┌────────────────────────────────────────────────────────────┐
│        Shared configuration and engineering functions        │
│       `src/v100/core.mjs`, `src/v100/catalog.mjs`            │
└──────────────────────────────┬──────────────────────────────┘
                             │ optional HA WebSocket API
                             ▼
┌────────────────────────────────────────────────────────────┐
│                   Companion backend                         │
│ `custom_components/glt_flow_card/__init__.py`               │
├────────────────────────────┬───────────────────────────────┐
│ HA `Store` persistence     │ HA states, services, remote HA REST │
└────────────────────────────┴───────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Production card | Registers `glt-flow-card`, consumes Lovelace config and HA state, renders the diagram, invokes HA actions | `custom_components/glt_flow_card/www/glt-flow-card.js` |
| Production card editor | Registers `glt-flow-card-editor`, edits normalized config, emits `config-changed`, and previews the card | `custom_components/glt_flow_card/www/glt-flow-card.js` |
| v1 completion layer | Decorates the base card/editor prototypes with operations, alarms, CAD, diagnostics, projects, and SDK features | `src/v100/index.js` |
| v1 add-ons | Adds energy, report, and drill-down panels after the main v1 layer loads | `src/v100/v1-addons.js` |
| Domain core | Normalizes schema v1 and implements state derivation, mapping, routing, diagnostics, aggregation, and bundles | `src/v100/core.mjs` |
| Equipment catalog | Defines visual styles, equipment profiles, ports, slots, controls, and symbol variants | `src/v100/catalog.mjs` |
| Companion manager | Owns persistence, revisions, locks, alarm state, schedules, reports, work orders, and remote-site calls | `custom_components/glt_flow_card/__init__.py` |
| Config flow | Creates the single companion integration instance and exposes backend options | `custom_components/glt_flow_card/config_flow.py` |
| Standalone editor | Provides a browser-only design surface with YAML import/export and local project persistence | `docs/editor/app.js` |
| Build pipeline | Bundles authored v1 modules and copies the generated runtime into the HA integration | `.github/workflows/build-v1.yml` |
| Documentation generator | Renders Markdown wiki pages and copies the standalone editor/examples into `_site` | `tools/build-site.mjs` |

## Pattern Overview

**Overall:** Browser-first modular monolith with an optional Home Assistant companion service.

**Key Characteristics:**
- Treat the Lovelace configuration object as the central domain model; equipment, datapoints, paths, views, alarms, projects, permissions, assets, and reports travel together through `custom_components/glt_flow_card/www/glt-flow-card.js` and `src/v100/core.mjs`.
- Keep deterministic engineering logic in pure ES modules under `src/v100/`; `test/v100-core.test.mjs` imports these modules directly without a DOM or Home Assistant runtime.
- Extend the generated/base web components through guarded prototype decoration in `src/v100/index.js` and `src/v100/v1-addons.js`; load order is fixed by `src/v100/entry.js`.
- Use the Python integration only for authoritative multi-user and scheduled behavior. The card retains direct browser fallbacks for local HA service calls and local project storage in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Preserve a source/generated split: edit `src/v100/` and build scripts, then regenerate `dist/glt-flow-card.js` and `custom_components/glt_flow_card/www/glt-flow-card.js` through `.github/workflows/build-v1.yml`.

## Layers

**Home Assistant UI Layer:**
- Purpose: Render runtime plant views and the Lovelace visual editor.
- Location: `custom_components/glt_flow_card/www/glt-flow-card.js`
- Contains: Custom elements, Shadow DOM styles, event handlers, live entity display, service calls, and editor state.
- Depends on: Home Assistant's injected `hass` object, browser custom elements, and configuration data.
- Used by: Lovelace dashboards and the Lovelace card configuration dialog.

**v1 Feature Layer:**
- Purpose: Add platform-level panels and modify the existing card/editor without replacing their base implementation.
- Location: `src/v100/index.js`, `src/v100/v1-addons.js`, `src/v100/entry.js`
- Contains: Runtime panels, editor panels, permission checks, Companion calls, and `window.GLTFlowCardSDK` registration.
- Depends on: Registered `glt-flow-card` and `glt-flow-card-editor` elements plus `src/v100/core.mjs` and `src/v100/catalog.mjs`.
- Used by: The generated production bundle at `dist/glt-flow-card.js` and its copy at `custom_components/glt_flow_card/www/glt-flow-card.js`.

**Domain/Engineering Layer:**
- Purpose: Provide framework-free transformations and calculations.
- Location: `src/v100/core.mjs`, `src/v100/catalog.mjs`
- Contains: Schema defaults/migration, operational-state rules, entity scoring, automatic mapping, semantic paths, orthogonal routing, diagnostics, time-series aggregation, energy summaries, diffs, and project bundle encoding.
- Depends on: Plain JavaScript data only; `src/v100/core.mjs` imports the catalog.
- Used by: `src/v100/index.js` and `test/v100-core.test.mjs`.

**Companion Service Layer:**
- Purpose: Enforce roles and persist or schedule behavior that cannot be trusted to a browser-only card.
- Location: `custom_components/glt_flow_card/__init__.py`
- Contains: `GltStore`, WebSocket handlers, state-change processing, scheduled service execution, audit, remote-site REST access, reports, work orders, and locks.
- Depends on: Home Assistant WebSocket API, state machine, service registry, event helpers, `Store`, and aiohttp client session.
- Used by: Browser feature code via `hass.callWS({type: "glt_flow_card/..."})` in `src/v100/index.js` and the generated runtime.

**Static Site Layer:**
- Purpose: Supply documentation, public demonstrations, and a Home-Assistant-independent configuration designer.
- Location: `docs/site/`, `docs/wiki/`, `docs/editor/`
- Contains: Static HTML/CSS/JS, Markdown content, example YAML, and screenshot assets.
- Depends on: `tools/build-site.mjs`, `marked`, `js-yaml`, and the browser's `localStorage`.
- Used by: GitHub Pages via `.github/workflows/docs.yml`.

## Data Flow

### Primary Lovelace Render Path

1. Home Assistant loads `custom_components/glt_flow_card/www/glt-flow-card.js`, which registers `glt-flow-card` and `glt-flow-card-editor` (`custom_components/glt_flow_card/www/glt-flow-card.js:12`).
2. Lovelace calls `setConfig`, and the card normalizes/stores the configuration (`custom_components/glt_flow_card/www/glt-flow-card.js:271`).
3. Home Assistant assigns the live `hass` object; state changes trigger the card's render lifecycle (`custom_components/glt_flow_card/www/glt-flow-card.js:282`).
4. Base rendering creates equipment, datapoints, paths, and controls; v1 prototype wrappers add operational states and feature controls (`src/v100/index.js:1`).
5. User actions either call HA directly with `hass.callService` or use Companion WebSocket commands when `security.server_enforced` is enabled (`src/v100/index.js:1`).

### Visual Editor Configuration Path

1. Home Assistant requests `GltFlowCard.getConfigElement()` (`custom_components/glt_flow_card/www/glt-flow-card.js:245`).
2. `GltFlowCardEditor.setConfig()` normalizes the input and initializes view/editor state (`custom_components/glt_flow_card/www/glt-flow-card.js:1269`).
3. Drag, resize, inspector, and toolbar handlers mutate the in-memory config (`custom_components/glt_flow_card/www/glt-flow-card.js:1298`).
4. `_emit()` dispatches `config-changed` with a deep-cloned config for Lovelace persistence (`custom_components/glt_flow_card/www/glt-flow-card.js:1273`).
5. The preview child receives a cloned config and the current `hass` object (`custom_components/glt_flow_card/www/glt-flow-card.js:1295`).

### Companion Project and Control Path

1. Browser feature code calls `hass.callWS` with a `glt_flow_card/*` command (`src/v100/index.js:1`).
2. A decorated WebSocket handler validates the message schema and derives the current user's role (`custom_components/glt_flow_card/__init__.py:424`).
3. Project writes pass through `GltStore.save_project`, which checks optimistic revisions, retains versions, and updates schema/project metadata (`custom_components/glt_flow_card/__init__.py:124`).
4. `GltStore.async_save` persists the complete manager state through Home Assistant `Store` (`custom_components/glt_flow_card/__init__.py:119`).
5. Control commands enforce project role and safe service domains before calling the HA service registry (`custom_components/glt_flow_card/__init__.py:522`).

### Alarm and Schedule Flow

1. Integration setup registers state-change and minute-level schedule callbacks (`custom_components/glt_flow_card/__init__.py:663`).
2. State changes are matched against alarms in persisted project configurations (`custom_components/glt_flow_card/__init__.py:320`).
3. Conditions, hysteresis, and optional delay determine transitions; active/clear state and history are persisted (`custom_components/glt_flow_card/__init__.py:225`).
4. Every minute, enabled schedules matching weekday/time call only domains allowed by the project's effective allowlist (`custom_components/glt_flow_card/__init__.py:366`).

**State Management:**
- Runtime UI state lives on web-component instances (`_config`, `_hass`, selection, zoom, view, undo/redo) in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Lovelace configuration state is passed outward through `config-changed` events from `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Standalone designer drafts and projects live in browser `localStorage` under keys defined in `docs/editor/app.js`.
- Authoritative companion state lives in `GltStore.data` and Home Assistant `Store` in `custom_components/glt_flow_card/__init__.py`.
- `window.GLTFlowCardSDK` is a process-global registry for symbols, profiles, panels, migrations, and languages in `src/v100/index.js`.

## Key Abstractions

**Normalized Project Configuration:**
- Purpose: Provide one schema for render, editing, storage, diagnostics, imports, and exports.
- Examples: `ensureV1` in `src/v100/core.mjs`, the base normalizer in `custom_components/glt_flow_card/www/glt-flow-card.js`, and example documents in `examples/idm-neo2030.yaml`.
- Pattern: Mutable aggregate in UI code, deep-cloned at persistence/event boundaries.

**Equipment Profile and Symbol Variant:**
- Purpose: Map equipment types to compatible ports, live-value slots, controls, and style-specific symbols.
- Examples: `COMPONENT_PROFILES` and `SYMBOL_VARIANTS` in `src/v100/catalog.mjs`.
- Pattern: Data-driven catalog with lookup helpers; add new equipment behavior as profile data before adding UI conditionals.

**Operational State:**
- Purpose: Convert multiple HA signals into one severity-ranked state and quality label.
- Examples: `OPERATIONAL_STATES`, `testSignal`, and `deriveOperationalState` in `src/v100/core.mjs`.
- Pattern: Pure derivation from config plus HA state snapshots.

**GltStore:**
- Purpose: Centralize persistent companion data and server-side workflows.
- Examples: Project revisions, alarms, work orders, reports, locks, and schedule runs in `custom_components/glt_flow_card/__init__.py`.
- Pattern: Single integration-scoped manager stored at `hass.data[DOMAIN]["manager"]`.

**WebSocket Command:**
- Purpose: Expose narrow backend operations to the card/editor.
- Examples: `glt_flow_card/projects/save`, `glt_flow_card/control/execute`, and `glt_flow_card/alarms/ack` in `custom_components/glt_flow_card/__init__.py`.
- Pattern: Voluptuous schema decorator, async response wrapper, authorization, manager call, structured result/error.

## Entry Points

**Production Lovelace Asset:**
- Location: `custom_components/glt_flow_card/www/glt-flow-card.js`
- Triggers: Loading the JavaScript resource in Home Assistant.
- Responsibilities: Register both custom elements and expose the complete browser runtime.

**v1 Bundle Entry:**
- Location: `src/v100/entry.js`
- Triggers: esbuild in `.github/workflows/build-v1.yml`.
- Responsibilities: Import the main v1 completion layer before `src/v100/v1-addons.js`.

**Home Assistant Integration Setup:**
- Location: `custom_components/glt_flow_card/__init__.py`
- Triggers: YAML setup or config-entry setup through `async_setup` and `async_setup_entry`.
- Responsibilities: Initialize one `GltStore`, register WebSocket commands and event listeners, and apply options.

**Home Assistant Config Flow:**
- Location: `custom_components/glt_flow_card/config_flow.py`
- Triggers: Adding the integration in Home Assistant.
- Responsibilities: Enforce a single instance and collect backend safety/retention options.

**Standalone Designer:**
- Location: `docs/editor/index.html`, `docs/editor/app.js`
- Triggers: Browser navigation to the Pages editor route.
- Responsibilities: Design and serialize configs without a live Home Assistant connection.

**Static Site Build:**
- Location: `tools/build-site.mjs`
- Triggers: `.github/workflows/docs.yml` or a local Node invocation.
- Responsibilities: Build `_site`, render wiki Markdown, copy editor/assets/examples, and vendor js-yaml.

## Architectural Constraints

- **Threading:** Browser code runs on the single JavaScript event loop; backend operations run on Home Assistant's asyncio loop in `custom_components/glt_flow_card/__init__.py`. Delayed alarms use HA-created asyncio tasks.
- **Global state:** `window.GLTFlowCardSDK` in `src/v100/index.js` and browser `localStorage` in `docs/editor/app.js` are global per browser context. The backend manager is a singleton at `hass.data[DOMAIN]` in `custom_components/glt_flow_card/__init__.py`.
- **Load order:** `src/v100/index.js` requires the base card/editor to already be registered and returns early if they are absent; `src/v100/entry.js` preserves main-layer-before-add-ons ordering.
- **Generated artifacts:** `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, and the appended section of `docs/editor/app.js` are generated or rewritten by `tools/apply-v100.mjs`; do not make isolated fixes only in a generated copy.
- **Optional backend:** Browser features must tolerate missing Companion calls where fallback behavior is explicitly supported in `src/v100/index.js`; server-enforced operations require `custom_components/glt_flow_card/` to be installed and configured.
- **Security boundary:** Client-side role checks improve UX but are not authoritative. Keep authorization and service-domain enforcement in WebSocket handlers in `custom_components/glt_flow_card/__init__.py`.
- **Circular imports:** Not detected in authored ES modules; `src/v100/core.mjs` imports `src/v100/catalog.mjs`, while UI modules import both.

## Anti-Patterns

### Editing Generated Runtime Only

**What happens:** A change is made directly in `dist/glt-flow-card.js` or `custom_components/glt_flow_card/www/glt-flow-card.js` without an authored counterpart.
**Why it's wrong:** `tools/apply-v100.mjs` copies/rebuilds these artifacts, so a later build can replace the change or leave the two copies inconsistent.
**Do this instead:** Put deterministic logic in `src/v100/core.mjs`, catalog data in `src/v100/catalog.mjs`, and v1 UI integration in `src/v100/index.js` or `src/v100/v1-addons.js`; regenerate through `.github/workflows/build-v1.yml`.

### Adding More Uncoordinated Prototype Wrappers

**What happens:** Feature layers replace methods such as `_render`, `_renderEquipment`, or `_emit` by saving and wrapping prototype functions in `src/v100/index.js` and `src/v100/v1-addons.js`.
**Why it's wrong:** Wrapper ordering becomes part of behavior, private method names are a coupling point, and a missing base method or reordered bundle can break multiple features.
**Do this instead:** Reuse the existing wrapper chain and `window.GLTFlowCardSDK` registration point in `src/v100/index.js`; consolidate related behavior into one wrapper and preserve the original method's return value.

### Trusting Browser Authorization

**What happens:** The browser derives viewer/operator/designer roles and can directly call HA services in fallback mode in `src/v100/index.js`.
**Why it's wrong:** Client code and configuration are user-visible and cannot enforce a security boundary.
**Do this instead:** Route sensitive and shared operations through role-checked WebSocket handlers such as `ws_control_execute` in `custom_components/glt_flow_card/__init__.py`, with `security.server_enforced` enabled.

### Duplicating Domain Rules in UI Surfaces

**What happens:** The standalone editor in `docs/editor/app.js`, the base generated runtime, and `src/v100/core.mjs` each contain configuration or symbol-related behavior.
**Why it's wrong:** Schema defaults and behavior can diverge between online design, Lovelace design, and runtime rendering.
**Do this instead:** Place reusable, DOM-free rules in `src/v100/core.mjs` or `src/v100/catalog.mjs`, test them through `test/v100-core.test.mjs`, and keep UI files focused on interaction/rendering.

## Error Handling

**Strategy:** Validate at system boundaries, return explicit WebSocket errors from the Companion, and degrade optional browser enhancements without preventing the base card from rendering.

**Patterns:**
- Throw `Error`/`ValueError`/`PermissionError`/`RuntimeError` inside domain or manager code and translate expected backend failures with `connection.send_error` in `custom_components/glt_flow_card/__init__.py`.
- Guard optional Home Assistant APIs and Companion calls in `src/v100/index.js`; user-triggered failures surface through alerts while non-critical audit/metadata requests are caught.
- Validate WebSocket message shapes with `vol.Required`, `vol.Optional`, ranges, and primitive types in `custom_components/glt_flow_card/__init__.py`.
- Return early when the base custom elements are unavailable in `src/v100/index.js` and `src/v100/v1-addons.js`.

## Cross-Cutting Concerns

**Logging:** Browser startup compatibility issues use `console.warn` in `src/v100/index.js`; backend operational exceptions are generally converted to WebSocket errors or intentionally ignored for best-effort notifications in `custom_components/glt_flow_card/__init__.py`.
**Validation:** Configuration normalization occurs in `src/v100/core.mjs` and the base runtime; diagnostics are exposed by `diagnoseConfig` in `src/v100/core.mjs`; backend message validation uses Voluptuous in `custom_components/glt_flow_card/__init__.py`.
**Authentication:** Home Assistant supplies the WebSocket connection user; `_project_role` maps admins and configured project members to roles in `custom_components/glt_flow_card/__init__.py`. Remote HA calls use backend-held bearer tokens configured in manager memory, never the browser UI.

---

*Architecture analysis: 2026-08-31*
