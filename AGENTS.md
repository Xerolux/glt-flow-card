<!-- GSD:project-start source:PROJECT.md -->

## Project

**GLT Flow Card**

GLT Flow Card is a Home-Assistant-based GLT/BMS/SCADA visualization and engineering platform for operators, engineers, facility managers, and advanced Home Assistant users. It combines live plant diagrams, a visual designer, secure Companion-backed operations, alarms, trends, schedules, semantic equipment models, diagnostics, energy, maintenance, reporting, and multi-site supervision.

The repository already contains a broad Platform 1.0 implementation. This project cycle turns those feature claims into production-depth behavior with authoritative backend rules, coherent data models, realistic tests, measurable performance, and release-ready packaging.

**Core Value:** Operators and engineers can safely understand, operate, engineer, and diagnose a real building plant from one trustworthy Home Assistant interface.

### Constraints

- **Host platform:** Home Assistant remains the runtime, state source, service broker, authentication system, Recorder, notification system, and fieldbus integration layer.
- **Security:** Browser role checks are UX only; all shared reads, writes, controls, remote calls, and authoritative audit events require server-side enforcement.
- **Compatibility:** Preserve standalone card operation where safe, while clearly disabling privileged shared operations when Companion enforcement is required.
- **Source of truth:** Edit authored modules and generators; never treat an isolated change to `dist/glt-flow-card.js` or the Companion `www` copy as complete.
- **Project data:** Introduce bounded schema validation and migration without losing existing Lovelace/YAML projects.
- **Performance:** Publish capacity claims only after repeatable browser/backend measurements at 100, 500, and 2,000 objects.
- **Quality:** Use executable behavioral tests; source-token assertions alone cannot satisfy a requirement.
- **Hardware safety:** No physical bus or plant write is implied by repository development or test scaffolding; live control tests require a separate, explicit approval and bounded targets.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ECMAScript modules authored for ES2022) - Browser card, visual designer, platform extensions, documentation generator, build scripts, and Node tests in `src/v100/`, `dist/glt-flow-card.js`, `docs/editor/app.js`, `tools/`, and `test/`.
- Python 3 (validated with 3.13 in CI) - Optional Home Assistant companion integration in `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/config_flow.py`, and `custom_components/glt_flow_card/const.py`.
- HTML5 and CSS3 - Static documentation, showcase, and standalone online designer in `docs/site/` and `docs/editor/`.
- YAML - Home Assistant example configurations in `examples/` and GitHub Actions workflows in `.github/workflows/`.
- JSON - npm, HACS, Home Assistant, translation, and UI metadata in `package.json`, `package-lock.json`, `hacs.json`, and `custom_components/glt_flow_card/*.json`.
- Markdown - End-user documentation and generated-site sources in `README.md`, `README.de.md`, and `docs/wiki/`.

## Runtime

- Node.js 22 in CI - Build, test, documentation, and release automation in `.github/workflows/build-v1.yml`, `.github/workflows/docs.yml`, `.github/workflows/release.yml`, `.github/workflows/screenshots.yml`, and `.github/workflows/validate.yml`.
- Node.js >=18 is the effective local minimum imposed by `esbuild` and `marked`; use Node.js 22 to match CI. Exact dependency engine metadata is locked in `package-lock.json`.
- Modern browser with Custom Elements, Shadow DOM, SVG, Fetch-compatible Home Assistant APIs, and ES2022 support - Production runtime is the Home Assistant Lovelace frontend bundle `dist/glt-flow-card.js` (also copied to `custom_components/glt_flow_card/www/glt-flow-card.js`).
- Home Assistant 2024.8.0 or newer - Minimum dashboard-card version declared in `hacs.json`; the optional companion runs in Home Assistant's Python environment through `custom_components/glt_flow_card/manifest.json`.
- Python 3.13 is used for companion syntax validation in `.github/workflows/build-v1.yml`; production Python version follows the installed Home Assistant release.
- npm with lockfile version 3 - Package metadata and scripts are in `package.json`; exact dependency resolution is in `package-lock.json`.
- Lockfile: present at `package-lock.json`; use `npm ci --ignore-scripts` for reproducible CI-style installs.

## Frameworks

- Home Assistant Lovelace custom-card API - `dist/glt-flow-card.js` registers `glt-flow-card` and `glt-flow-card-editor`, consumes the injected `hass` object, and uses native HA entity, service, REST, and WebSocket interfaces.
- Home Assistant custom integration framework - `custom_components/glt_flow_card/__init__.py` registers WebSocket commands, event/time listeners, service calls, HTTP clients, and native storage; `custom_components/glt_flow_card/config_flow.py` provides a single-instance UI config flow.
- Native Web Components/DOM APIs - No frontend component framework is used; custom elements, Shadow DOM, CSS, SVG, Blob/download APIs, and browser storage are implemented directly in `dist/glt-flow-card.js` and sources under `src/v100/`.
- Node.js built-in test runner - `node --test test/*.test.mjs` is configured in `package.json`; assertions use `node:assert/strict` in `test/smoke.test.mjs`, `test/v040.test.mjs`, `test/v100-core.test.mjs`, and `test/v100-backend.test.mjs`.
- Python bytecode compilation - `python -m py_compile custom_components/glt_flow_card/*.py` is the companion validation gate in `.github/workflows/build-v1.yml`; no Python unit-test framework is declared.
- Playwright Chromium, installed ad hoc in CI - Screenshot regression/artifact capture uses `tools/capture-screenshots.mjs` and `.github/workflows/screenshots.yml`; Playwright is intentionally not persisted in `package.json`.
- esbuild 0.25.12 - Bundles `src/v100/entry.js` and concatenated v0.4 sources as browser IIFEs targeting ES2022 in `.github/workflows/build-v1.yml` and `.github/workflows/apply-v040.yml`.
- js-yaml 4.3.2 - Provides YAML parsing in the online designer; `tools/build-site.mjs` copies `node_modules/js-yaml/dist/js-yaml.mjs` into the generated site.
- marked 15.0.12 - Converts `docs/wiki/*.md` to static HTML in `tools/build-site.mjs`.
- Custom Node generators - `tools/apply-v100.mjs` assembles production and companion card artifacts, `tools/apply-v040.mjs` applies legacy extension parts, and `tools/build-site.mjs` generates `_site/`.

## Key Dependencies

- Home Assistant frontend runtime (host-provided, no npm package) - Supplies live entity state, service calls, REST history access, WebSocket calls, themes, dialogs, and entity registry access consumed by `dist/glt-flow-card.js` and `src/v100/index.js`.
- Home Assistant Python APIs (host-provided, no Python requirements file) - Supplies `websocket_api`, `ConfigEntry`, `Store`, the shared aiohttp client, event listeners, and service execution in `custom_components/glt_flow_card/__init__.py`.
- voluptuous (host-provided by Home Assistant) - Validates config-flow options and WebSocket messages in `custom_components/glt_flow_card/config_flow.py` and `custom_components/glt_flow_card/__init__.py`.
- esbuild ^0.25.12 (locked 0.25.12) - Produces the extension IIFEs consumed by generated runtime artifacts; declared in `package.json` and pinned by `package-lock.json`.
- js-yaml ^4.3.2 (locked 4.3.2) - Supports YAML import/export tooling in the generated online editor; declared in `package.json` and pinned by `package-lock.json`.
- marked ^15.0.12 (locked 15.0.12) - Renders Markdown wiki sources into the GitHub Pages site; declared in `package.json` and pinned by `package-lock.json`.
- HACS dashboard distribution metadata - `hacs.json` identifies `glt-flow-card.js` and minimum Home Assistant 2024.8.0; the published asset is `dist/glt-flow-card.js`.
- GitHub Actions - Validation, generated-artifact updates, Pages deployment, Wiki synchronization, screenshots, and releases live in `.github/workflows/`.
- GitHub Pages - Static documentation and the online designer are generated by `tools/build-site.mjs` and deployed from `_site/` by `.github/workflows/docs.yml`.
- GitHub Releases - Tag builds publish `dist/glt-flow-card.js` and an optional companion ZIP via `.github/workflows/release.yml`.

## Configuration

- No `.env` files or environment-variable-based application configuration are present. Home Assistant card configuration is Lovelace YAML, with examples under `examples/` and schema usage documented in `README.md` and `docs/wiki/Configuration.md`.
- Optional companion setup is a single-instance Config Entry managed by `custom_components/glt_flow_card/config_flow.py`; options include server enforcement, lock TTL, version retention, and audit retention.
- Optional remote Home Assistant sites are configured under `glt_flow_card.remote_sites` in Home Assistant YAML; documentation requires tokens to be referenced through `!secret` in `docs/wiki/Companion-Backend.md` and `docs/wiki/Installation.md`.
- HACS packaging is configured by `hacs.json`; Home Assistant companion metadata is configured by `custom_components/glt_flow_card/manifest.json`.
- npm scripts are limited to syntax checking and Node tests in `package.json`; bundling is encoded explicitly in `.github/workflows/build-v1.yml` and `.github/workflows/apply-v040.yml` rather than a standalone esbuild config.
- The v1 source entry is `src/v100/entry.js`; generated bundles are assembled into `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, and `docs/editor/app.js` by `tools/apply-v100.mjs`.
- Static documentation build inputs are `docs/wiki/`, `docs/site/`, `docs/editor/`, and `examples/`; `tools/build-site.mjs` emits `_site/`, which is a generated CI artifact and not a committed source directory.
- No TypeScript, ESLint, Prettier, Babel, Vite, Webpack, or Python packaging configuration is detected in the repository root.

## Platform Requirements

- Use Node.js 22 and npm to match all workflows in `.github/workflows/`; run `npm ci --ignore-scripts`, `npm run check`, and `npm test` from `package.json`.
- Use Python 3.13 for the repository's declared companion syntax gate in `.github/workflows/build-v1.yml`; full runtime verification requires a compatible Home Assistant installation because Python dependencies are host-provided.
- Use a Chromium-capable Playwright installation only when regenerating screenshots through `tools/capture-screenshots.mjs` and `.github/workflows/screenshots.yml`.
- Treat `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, and `docs/editor/app.js` as generated artifacts governed by `tools/apply-v100.mjs`.
- Primary deployment target: Home Assistant Lovelace via HACS or a manual `/local/glt-flow-card.js` module, as defined by `hacs.json` and `README.md`.
- Optional backend target: Home Assistant `custom_components/glt_flow_card/`, packaged as `glt-flow-card-companion.zip` by `.github/workflows/release.yml`.
- Documentation target: GitHub Pages from `_site/`, deployed by `.github/workflows/docs.yml`; wiki Markdown is also synchronized to the repository's GitHub Wiki.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Use lowercase kebab-case for JavaScript feature modules and tools: `src/v100/online-extension.js`, `src/v100/v1-addons.js`, and `tools/build-site.mjs`.
- Use the `.mjs` extension for directly imported/tested ES modules containing reusable pure logic: `src/v100/core.mjs`, `src/v100/catalog.mjs`, and `test/v100-core.test.mjs`.
- Name Node test files `*.test.mjs` under `test/`, grouped by release or responsibility: `test/smoke.test.mjs`, `test/v040.test.mjs`, `test/v100-core.test.mjs`, and `test/v100-backend.test.mjs`.
- Follow Home Assistant integration naming for Python files: `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/config_flow.py`, and `custom_components/glt_flow_card/const.py`.
- Treat `dist/glt-flow-card.js`, `docs/editor/app.js`, and `custom_components/glt_flow_card/www/glt-flow-card.js` as generated artifacts. Put maintainable v1 source in `src/v100/` and regenerate through `tools/apply-v100.mjs`.
- Use `camelCase` for JavaScript functions and exported APIs: `ensureV1`, `deriveOperationalState`, `autoMapEquipment`, and `smartRoute` in `src/v100/core.mjs`.
- Use short private helpers only when their scope is local and obvious: `arr`, `lower`, `slug`, and `clone` in `src/v100/core.mjs`.
- Prefix internal Python helpers with `_` and use `snake_case`: `_project_role`, `_safe_domains`, and `_state_active` in `custom_components/glt_flow_card/__init__.py`.
- Prefix Home Assistant coroutine entry points with `async_` and WebSocket handlers with `ws_`: `async_setup_entry`, `async_step_user`, and `ws_projects_save` in `custom_components/glt_flow_card/`.
- Name DOM event handlers and card/editor internals with a leading underscore when they are implementation details, following the card implementation in `src/v100/index.js` and the generated runtime in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Use `camelCase` for JavaScript locals and parameters, such as `hassStates`, `slotSpec`, `entityId`, and `nowMs` in `src/v100/core.mjs`.
- Use `snake_case` for Python variables and parameters, such as `project_id`, `user_id`, `expected_revision`, and `previous_active` in `custom_components/glt_flow_card/__init__.py`.
- Use `UPPER_SNAKE_CASE` for module constants in both languages: `SCHEMA_VERSION` and `OPERATIONAL_STATES` in `src/v100/core.mjs`; `STORE_VERSION` and `SAFE_SERVICE_DOMAINS` in `custom_components/glt_flow_card/const.py`.
- Use domain-native snake_case for serialized Home Assistant/project fields (`schema_version`, `entity_id`, `server_enforced`) even inside JavaScript objects, as demonstrated in `src/v100/core.mjs`.
- Use `PascalCase` for JavaScript and Python classes: `GltFlowCardConfigFlow`, `GltFlowCardOptionsFlow`, and `GltStore` in `custom_components/glt_flow_card/`.
- Add Python type annotations to reusable helpers, state fields, and lifecycle methods, following `custom_components/glt_flow_card/__init__.py`; Home Assistant callback parameters may remain untyped where framework APIs supply the contract.
- JavaScript does not use TypeScript or JSDoc type declarations. Preserve runtime-safe optional chaining, default parameters, and explicit normalization in `src/v100/core.mjs` instead of introducing an isolated typing convention.

## Code Style

- No formatter configuration is present. Match the formatting of the file being edited rather than assuming Prettier, Black, or Biome.
- In maintainable JavaScript modules, use two-space indentation, double-quoted strings, semicolons, trailing commas in multiline literals, and braces around multi-statement blocks, as in `src/v100/core.mjs` and `test/v100-core.test.mjs`.
- Some scripts use single quotes (`tools/capture-screenshots.mjs`) and extension/generated code is intentionally compact (`src/v100/index.js`, `src/v040-extension.part00`). Keep local consistency; do not mechanically reformat generated or embedded-template files.
- Use four-space indentation and PEP 8-style spacing in Python, as in `custom_components/glt_flow_card/config_flow.py` and `custom_components/glt_flow_card/__init__.py`.
- Keep large HTML/CSS payloads in template strings only in generation tools such as `tools/build-site.mjs`; ordinary reusable computation belongs in focused modules such as `src/v100/core.mjs`.
- No ESLint, Prettier, Biome, Ruff, Black, or Pyproject configuration is present.
- Validate JavaScript syntax with `npm run check`, which runs `node --check dist/glt-flow-card.js` from `package.json`.
- Validate Python syntax with `python -m py_compile custom_components/glt_flow_card/*.py`, matching `.github/workflows/build-v1.yml`.
- CI uses Node 22 in `.github/workflows/validate.yml`; write syntax supported by that runtime and the esbuild target `es2022` configured in `.github/workflows/build-v1.yml`.

## Import Organization

- No path aliases are configured. Use explicit relative paths such as `../src/v100/core.mjs` in `test/v100-core.test.mjs` and `./catalog.mjs` in `src/v100/core.mjs`.
- Resolve file fixtures relative to `import.meta.url` in tests, using `new URL("../dist/glt-flow-card.js", import.meta.url)` as in `test/smoke.test.mjs`; this keeps tests independent of the invocation directory.

## Error Handling

- Validate and normalize boundary data before computation. `ensureV1` in `src/v100/core.mjs` supplies defaults, coerces arrays, and creates required nested objects before downstream code uses them.
- Return stable fallback values for absent or malformed display data: helpers in `src/v100/core.mjs` return `null`, `false`, empty arrays, or an `unknown` operational state rather than throwing on missing Home Assistant state.
- Throw typed built-in errors for server-side business failures: `ValueError` for invalid project input, `RuntimeError` for revision/lock conflicts, and `PermissionError` for authorization failures in `custom_components/glt_flow_card/__init__.py`.
- At Home Assistant WebSocket boundaries, catch expected exceptions and translate them to protocol errors with `connection.send_error(...)`, following handlers such as `ws_projects_save`, `ws_projects_lock`, and `ws_control_execute` in `custom_components/glt_flow_card/__init__.py`.
- Catch narrow conversion failures where possible (`TypeError`, `ValueError` in `_state_active`). Broad `Exception` catches are used only at resilience boundaries such as persisted timestamp cleanup in `GltStore._prune_locks`.
- In browser integration code, use `try`/`catch` around optional Home Assistant APIs or browser persistence and degrade gracefully; reserve `console.warn` for a missing required base card, as in `src/v100/index.js`.
- Escape untrusted strings before interpolating them into HTML. Reuse the `esc` helper pattern in `src/v100/index.js` for all user-, entity-, and project-derived markup.

## Logging

- Use `console.info` for one-time component/version registration messages in the runtime, as seen in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Use `console.warn` when an optional extension cannot attach because its base custom elements are absent, following `src/v100/index.js`.
- Do not log entity state payloads, user input, remote credentials, or control request bodies. The server persists intentional operational events through `GltStore.add_audit` in `custom_components/glt_flow_card/__init__.py` instead of diagnostic console output.
- Add Python logging only through Home Assistant's standard `logging.getLogger(__name__)` pattern if operational diagnostics become necessary; no custom logger exists today.

## Comments

- Use a short module-level comment when a file's role is not obvious, as in `src/v100/core.mjs` (pure engineering core) and `src/v100/catalog.mjs` (catalog source).
- Prefer descriptive names and explicit data shapes over inline narration. `deriveOperationalState` and `diagnoseConfig` in `src/v100/core.mjs` are mostly self-documenting.
- Document generated/source boundaries in build tools and workflow steps rather than editing generated artifacts by hand; `.github/workflows/build-v1.yml` names each generation and verification stage.
- Not used in the JavaScript codebase. Do not introduce isolated JSDoc blocks unless a broader documentation/type-checking convention is added.
- Use Python docstrings for public framework-facing modules and substantial classes, following the module and `GltStore` docstrings in `custom_components/glt_flow_card/__init__.py` and `custom_components/glt_flow_card/config_flow.py`.

## Function Design

- Accept configuration/data objects plus an optional options object for extensible JavaScript APIs, as in `deriveOperationalState(item, states, options = {})` and `aggregateSeries(points, options = {})` in `src/v100/core.mjs`.
- Default collection-like inputs defensively (`hassStates = {}`, `raw = {}`) and normalize at the boundary.
- In Python, pass `HomeAssistant`, connection, and message objects in Home Assistant's conventional handler order, as in `ws_projects_get(hass, connection, msg)`.
- Return plain serializable objects and arrays from the pure JavaScript core; preserve explicit shapes such as `{ config, from, to, changed }` from `migrateProject` in `src/v100/core.mjs`.
- Return deep copies from persistent store methods in `custom_components/glt_flow_card/__init__.py` so callers cannot mutate stored state without `async_save`.
- Return booleans from Home Assistant setup/unload lifecycle methods and send WebSocket results explicitly from handlers.

## Module Design

- Use named exports for reusable constants and pure functions from `src/v100/core.mjs` and `src/v100/catalog.mjs`.
- Keep browser patching and custom-element attachment as side-effect modules (`src/v100/index.js`, `src/v100/v1-addons.js`), assembled by the minimal entry point `src/v100/entry.js`.
- Keep Home Assistant integration exports framework-driven: setup functions live in `custom_components/glt_flow_card/__init__.py`, configuration flows in `custom_components/glt_flow_card/config_flow.py`, and shared constants in `custom_components/glt_flow_card/const.py`.
- No barrel modules are used. Import directly from the owning module (`src/v100/core.mjs` or `src/v100/catalog.mjs`) so dependencies remain visible.
- `src/v100/entry.js` is a bundler entry, not a public re-export barrel; do not import application APIs from it in tests.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- Treat the Lovelace configuration object as the central domain model; equipment, datapoints, paths, views, alarms, projects, permissions, assets, and reports travel together through `custom_components/glt_flow_card/www/glt-flow-card.js` and `src/v100/core.mjs`.
- Keep deterministic engineering logic in pure ES modules under `src/v100/`; `test/v100-core.test.mjs` imports these modules directly without a DOM or Home Assistant runtime.
- Extend the generated/base web components through guarded prototype decoration in `src/v100/index.js` and `src/v100/v1-addons.js`; load order is fixed by `src/v100/entry.js`.
- Use the Python integration only for authoritative multi-user and scheduled behavior. The card retains direct browser fallbacks for local HA service calls and local project storage in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Preserve a source/generated split: edit `src/v100/` and build scripts, then regenerate `dist/glt-flow-card.js` and `custom_components/glt_flow_card/www/glt-flow-card.js` through `.github/workflows/build-v1.yml`.

## Layers

- Purpose: Render runtime plant views and the Lovelace visual editor.
- Location: `custom_components/glt_flow_card/www/glt-flow-card.js`
- Contains: Custom elements, Shadow DOM styles, event handlers, live entity display, service calls, and editor state.
- Depends on: Home Assistant's injected `hass` object, browser custom elements, and configuration data.
- Used by: Lovelace dashboards and the Lovelace card configuration dialog.
- Purpose: Add platform-level panels and modify the existing card/editor without replacing their base implementation.
- Location: `src/v100/index.js`, `src/v100/v1-addons.js`, `src/v100/entry.js`
- Contains: Runtime panels, editor panels, permission checks, Companion calls, and `window.GLTFlowCardSDK` registration.
- Depends on: Registered `glt-flow-card` and `glt-flow-card-editor` elements plus `src/v100/core.mjs` and `src/v100/catalog.mjs`.
- Used by: The generated production bundle at `dist/glt-flow-card.js` and its copy at `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Purpose: Provide framework-free transformations and calculations.
- Location: `src/v100/core.mjs`, `src/v100/catalog.mjs`
- Contains: Schema defaults/migration, operational-state rules, entity scoring, automatic mapping, semantic paths, orthogonal routing, diagnostics, time-series aggregation, energy summaries, diffs, and project bundle encoding.
- Depends on: Plain JavaScript data only; `src/v100/core.mjs` imports the catalog.
- Used by: `src/v100/index.js` and `test/v100-core.test.mjs`.
- Purpose: Enforce roles and persist or schedule behavior that cannot be trusted to a browser-only card.
- Location: `custom_components/glt_flow_card/__init__.py`
- Contains: `GltStore`, WebSocket handlers, state-change processing, scheduled service execution, audit, remote-site REST access, reports, work orders, and locks.
- Depends on: Home Assistant WebSocket API, state machine, service registry, event helpers, `Store`, and aiohttp client session.
- Used by: Browser feature code via `hass.callWS({type: "glt_flow_card/..."})` in `src/v100/index.js` and the generated runtime.
- Purpose: Supply documentation, public demonstrations, and a Home-Assistant-independent configuration designer.
- Location: `docs/site/`, `docs/wiki/`, `docs/editor/`
- Contains: Static HTML/CSS/JS, Markdown content, example YAML, and screenshot assets.
- Depends on: `tools/build-site.mjs`, `marked`, `js-yaml`, and the browser's `localStorage`.
- Used by: GitHub Pages via `.github/workflows/docs.yml`.

## Data Flow

### Primary Lovelace Render Path

### Visual Editor Configuration Path

### Companion Project and Control Path

### Alarm and Schedule Flow

- Runtime UI state lives on web-component instances (`_config`, `_hass`, selection, zoom, view, undo/redo) in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Lovelace configuration state is passed outward through `config-changed` events from `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Standalone designer drafts and projects live in browser `localStorage` under keys defined in `docs/editor/app.js`.
- Authoritative companion state lives in `GltStore.data` and Home Assistant `Store` in `custom_components/glt_flow_card/__init__.py`.
- `window.GLTFlowCardSDK` is a process-global registry for symbols, profiles, panels, migrations, and languages in `src/v100/index.js`.

## Key Abstractions

- Purpose: Provide one schema for render, editing, storage, diagnostics, imports, and exports.
- Examples: `ensureV1` in `src/v100/core.mjs`, the base normalizer in `custom_components/glt_flow_card/www/glt-flow-card.js`, and example documents in `examples/idm-neo2030.yaml`.
- Pattern: Mutable aggregate in UI code, deep-cloned at persistence/event boundaries.
- Purpose: Map equipment types to compatible ports, live-value slots, controls, and style-specific symbols.
- Examples: `COMPONENT_PROFILES` and `SYMBOL_VARIANTS` in `src/v100/catalog.mjs`.
- Pattern: Data-driven catalog with lookup helpers; add new equipment behavior as profile data before adding UI conditionals.
- Purpose: Convert multiple HA signals into one severity-ranked state and quality label.
- Examples: `OPERATIONAL_STATES`, `testSignal`, and `deriveOperationalState` in `src/v100/core.mjs`.
- Pattern: Pure derivation from config plus HA state snapshots.
- Purpose: Centralize persistent companion data and server-side workflows.
- Examples: Project revisions, alarms, work orders, reports, locks, and schedule runs in `custom_components/glt_flow_card/__init__.py`.
- Pattern: Single integration-scoped manager stored at `hass.data[DOMAIN]["manager"]`.
- Purpose: Expose narrow backend operations to the card/editor.
- Examples: `glt_flow_card/projects/save`, `glt_flow_card/control/execute`, and `glt_flow_card/alarms/ack` in `custom_components/glt_flow_card/__init__.py`.
- Pattern: Voluptuous schema decorator, async response wrapper, authorization, manager call, structured result/error.

## Entry Points

- Location: `custom_components/glt_flow_card/www/glt-flow-card.js`
- Triggers: Loading the JavaScript resource in Home Assistant.
- Responsibilities: Register both custom elements and expose the complete browser runtime.
- Location: `src/v100/entry.js`
- Triggers: esbuild in `.github/workflows/build-v1.yml`.
- Responsibilities: Import the main v1 completion layer before `src/v100/v1-addons.js`.
- Location: `custom_components/glt_flow_card/__init__.py`
- Triggers: YAML setup or config-entry setup through `async_setup` and `async_setup_entry`.
- Responsibilities: Initialize one `GltStore`, register WebSocket commands and event listeners, and apply options.
- Location: `custom_components/glt_flow_card/config_flow.py`
- Triggers: Adding the integration in Home Assistant.
- Responsibilities: Enforce a single instance and collect backend safety/retention options.
- Location: `docs/editor/index.html`, `docs/editor/app.js`
- Triggers: Browser navigation to the Pages editor route.
- Responsibilities: Design and serialize configs without a live Home Assistant connection.
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

### Adding More Uncoordinated Prototype Wrappers

### Trusting Browser Authorization

### Duplicating Domain Rules in UI Surfaces

## Error Handling

- Throw `Error`/`ValueError`/`PermissionError`/`RuntimeError` inside domain or manager code and translate expected backend failures with `connection.send_error` in `custom_components/glt_flow_card/__init__.py`.
- Guard optional Home Assistant APIs and Companion calls in `src/v100/index.js`; user-triggered failures surface through alerts while non-critical audit/metadata requests are caught.
- Validate WebSocket message shapes with `vol.Required`, `vol.Optional`, ranges, and primitive types in `custom_components/glt_flow_card/__init__.py`.
- Return early when the base custom elements are unavailable in `src/v100/index.js` and `src/v100/v1-addons.js`.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
