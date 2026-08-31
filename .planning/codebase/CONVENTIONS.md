# Coding Conventions

**Analysis Date:** 2026-08-31

## Naming Patterns

**Files:**
- Use lowercase kebab-case for JavaScript feature modules and tools: `src/v100/online-extension.js`, `src/v100/v1-addons.js`, and `tools/build-site.mjs`.
- Use the `.mjs` extension for directly imported/tested ES modules containing reusable pure logic: `src/v100/core.mjs`, `src/v100/catalog.mjs`, and `test/v100-core.test.mjs`.
- Name Node test files `*.test.mjs` under `test/`, grouped by release or responsibility: `test/smoke.test.mjs`, `test/v040.test.mjs`, `test/v100-core.test.mjs`, and `test/v100-backend.test.mjs`.
- Follow Home Assistant integration naming for Python files: `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/config_flow.py`, and `custom_components/glt_flow_card/const.py`.
- Treat `dist/glt-flow-card.js`, `docs/editor/app.js`, and `custom_components/glt_flow_card/www/glt-flow-card.js` as generated artifacts. Put maintainable v1 source in `src/v100/` and regenerate through `tools/apply-v100.mjs`.

**Functions:**
- Use `camelCase` for JavaScript functions and exported APIs: `ensureV1`, `deriveOperationalState`, `autoMapEquipment`, and `smartRoute` in `src/v100/core.mjs`.
- Use short private helpers only when their scope is local and obvious: `arr`, `lower`, `slug`, and `clone` in `src/v100/core.mjs`.
- Prefix internal Python helpers with `_` and use `snake_case`: `_project_role`, `_safe_domains`, and `_state_active` in `custom_components/glt_flow_card/__init__.py`.
- Prefix Home Assistant coroutine entry points with `async_` and WebSocket handlers with `ws_`: `async_setup_entry`, `async_step_user`, and `ws_projects_save` in `custom_components/glt_flow_card/`.
- Name DOM event handlers and card/editor internals with a leading underscore when they are implementation details, following the card implementation in `src/v100/index.js` and the generated runtime in `custom_components/glt_flow_card/www/glt-flow-card.js`.

**Variables:**
- Use `camelCase` for JavaScript locals and parameters, such as `hassStates`, `slotSpec`, `entityId`, and `nowMs` in `src/v100/core.mjs`.
- Use `snake_case` for Python variables and parameters, such as `project_id`, `user_id`, `expected_revision`, and `previous_active` in `custom_components/glt_flow_card/__init__.py`.
- Use `UPPER_SNAKE_CASE` for module constants in both languages: `SCHEMA_VERSION` and `OPERATIONAL_STATES` in `src/v100/core.mjs`; `STORE_VERSION` and `SAFE_SERVICE_DOMAINS` in `custom_components/glt_flow_card/const.py`.
- Use domain-native snake_case for serialized Home Assistant/project fields (`schema_version`, `entity_id`, `server_enforced`) even inside JavaScript objects, as demonstrated in `src/v100/core.mjs`.

**Types:**
- Use `PascalCase` for JavaScript and Python classes: `GltFlowCardConfigFlow`, `GltFlowCardOptionsFlow`, and `GltStore` in `custom_components/glt_flow_card/`.
- Add Python type annotations to reusable helpers, state fields, and lifecycle methods, following `custom_components/glt_flow_card/__init__.py`; Home Assistant callback parameters may remain untyped where framework APIs supply the contract.
- JavaScript does not use TypeScript or JSDoc type declarations. Preserve runtime-safe optional chaining, default parameters, and explicit normalization in `src/v100/core.mjs` instead of introducing an isolated typing convention.

## Code Style

**Formatting:**
- No formatter configuration is present. Match the formatting of the file being edited rather than assuming Prettier, Black, or Biome.
- In maintainable JavaScript modules, use two-space indentation, double-quoted strings, semicolons, trailing commas in multiline literals, and braces around multi-statement blocks, as in `src/v100/core.mjs` and `test/v100-core.test.mjs`.
- Some scripts use single quotes (`tools/capture-screenshots.mjs`) and extension/generated code is intentionally compact (`src/v100/index.js`, `src/v040-extension.part00`). Keep local consistency; do not mechanically reformat generated or embedded-template files.
- Use four-space indentation and PEP 8-style spacing in Python, as in `custom_components/glt_flow_card/config_flow.py` and `custom_components/glt_flow_card/__init__.py`.
- Keep large HTML/CSS payloads in template strings only in generation tools such as `tools/build-site.mjs`; ordinary reusable computation belongs in focused modules such as `src/v100/core.mjs`.

**Linting:**
- No ESLint, Prettier, Biome, Ruff, Black, or Pyproject configuration is present.
- Validate JavaScript syntax with `npm run check`, which runs `node --check dist/glt-flow-card.js` from `package.json`.
- Validate Python syntax with `python -m py_compile custom_components/glt_flow_card/*.py`, matching `.github/workflows/build-v1.yml`.
- CI uses Node 22 in `.github/workflows/validate.yml`; write syntax supported by that runtime and the esbuild target `es2022` configured in `.github/workflows/build-v1.yml`.

## Import Organization

**Order:**
1. Put standard-library imports first: `node:test`, `node:assert/strict`, and `node:fs/promises` in `test/*.test.mjs`; `asyncio`, `copy`, and `datetime` in `custom_components/glt_flow_card/__init__.py`.
2. Put third-party imports next: `voluptuous` and `homeassistant.*` in `custom_components/glt_flow_card/__init__.py`; `marked` in `tools/build-site.mjs`.
3. Put repository-relative imports last: `./catalog.mjs` in `src/v100/core.mjs` and `.const` in `custom_components/glt_flow_card/__init__.py`.
4. Use side-effect imports first in browser entry modules, then named imports, as in `src/v100/entry.js` and `src/v100/index.js`.

**Path Aliases:**
- No path aliases are configured. Use explicit relative paths such as `../src/v100/core.mjs` in `test/v100-core.test.mjs` and `./catalog.mjs` in `src/v100/core.mjs`.
- Resolve file fixtures relative to `import.meta.url` in tests, using `new URL("../dist/glt-flow-card.js", import.meta.url)` as in `test/smoke.test.mjs`; this keeps tests independent of the invocation directory.

## Error Handling

**Patterns:**
- Validate and normalize boundary data before computation. `ensureV1` in `src/v100/core.mjs` supplies defaults, coerces arrays, and creates required nested objects before downstream code uses them.
- Return stable fallback values for absent or malformed display data: helpers in `src/v100/core.mjs` return `null`, `false`, empty arrays, or an `unknown` operational state rather than throwing on missing Home Assistant state.
- Throw typed built-in errors for server-side business failures: `ValueError` for invalid project input, `RuntimeError` for revision/lock conflicts, and `PermissionError` for authorization failures in `custom_components/glt_flow_card/__init__.py`.
- At Home Assistant WebSocket boundaries, catch expected exceptions and translate them to protocol errors with `connection.send_error(...)`, following handlers such as `ws_projects_save`, `ws_projects_lock`, and `ws_control_execute` in `custom_components/glt_flow_card/__init__.py`.
- Catch narrow conversion failures where possible (`TypeError`, `ValueError` in `_state_active`). Broad `Exception` catches are used only at resilience boundaries such as persisted timestamp cleanup in `GltStore._prune_locks`.
- In browser integration code, use `try`/`catch` around optional Home Assistant APIs or browser persistence and degrade gracefully; reserve `console.warn` for a missing required base card, as in `src/v100/index.js`.
- Escape untrusted strings before interpolating them into HTML. Reuse the `esc` helper pattern in `src/v100/index.js` for all user-, entity-, and project-derived markup.

## Logging

**Framework:** `console` in browser JavaScript; Home Assistant facilities are not currently wired to a Python logger.

**Patterns:**
- Use `console.info` for one-time component/version registration messages in the runtime, as seen in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Use `console.warn` when an optional extension cannot attach because its base custom elements are absent, following `src/v100/index.js`.
- Do not log entity state payloads, user input, remote credentials, or control request bodies. The server persists intentional operational events through `GltStore.add_audit` in `custom_components/glt_flow_card/__init__.py` instead of diagnostic console output.
- Add Python logging only through Home Assistant's standard `logging.getLogger(__name__)` pattern if operational diagnostics become necessary; no custom logger exists today.

## Comments

**When to Comment:**
- Use a short module-level comment when a file's role is not obvious, as in `src/v100/core.mjs` (pure engineering core) and `src/v100/catalog.mjs` (catalog source).
- Prefer descriptive names and explicit data shapes over inline narration. `deriveOperationalState` and `diagnoseConfig` in `src/v100/core.mjs` are mostly self-documenting.
- Document generated/source boundaries in build tools and workflow steps rather than editing generated artifacts by hand; `.github/workflows/build-v1.yml` names each generation and verification stage.

**JSDoc/TSDoc:**
- Not used in the JavaScript codebase. Do not introduce isolated JSDoc blocks unless a broader documentation/type-checking convention is added.
- Use Python docstrings for public framework-facing modules and substantial classes, following the module and `GltStore` docstrings in `custom_components/glt_flow_card/__init__.py` and `custom_components/glt_flow_card/config_flow.py`.

## Function Design

**Size:** Keep reusable algorithms small and pure in `src/v100/core.mjs`; split local helpers such as `stateObj`, `testSignal`, `rectFor`, and `pathHits` from exported orchestration functions. Browser composition in `src/v100/index.js` is denser, so extract independently testable new rules into `core.mjs` rather than enlarging DOM/template functions.

**Parameters:**
- Accept configuration/data objects plus an optional options object for extensible JavaScript APIs, as in `deriveOperationalState(item, states, options = {})` and `aggregateSeries(points, options = {})` in `src/v100/core.mjs`.
- Default collection-like inputs defensively (`hassStates = {}`, `raw = {}`) and normalize at the boundary.
- In Python, pass `HomeAssistant`, connection, and message objects in Home Assistant's conventional handler order, as in `ws_projects_get(hass, connection, msg)`.

**Return Values:**
- Return plain serializable objects and arrays from the pure JavaScript core; preserve explicit shapes such as `{ config, from, to, changed }` from `migrateProject` in `src/v100/core.mjs`.
- Return deep copies from persistent store methods in `custom_components/glt_flow_card/__init__.py` so callers cannot mutate stored state without `async_save`.
- Return booleans from Home Assistant setup/unload lifecycle methods and send WebSocket results explicitly from handlers.

## Module Design

**Exports:**
- Use named exports for reusable constants and pure functions from `src/v100/core.mjs` and `src/v100/catalog.mjs`.
- Keep browser patching and custom-element attachment as side-effect modules (`src/v100/index.js`, `src/v100/v1-addons.js`), assembled by the minimal entry point `src/v100/entry.js`.
- Keep Home Assistant integration exports framework-driven: setup functions live in `custom_components/glt_flow_card/__init__.py`, configuration flows in `custom_components/glt_flow_card/config_flow.py`, and shared constants in `custom_components/glt_flow_card/const.py`.

**Barrel Files:**
- No barrel modules are used. Import directly from the owning module (`src/v100/core.mjs` or `src/v100/catalog.mjs`) so dependencies remain visible.
- `src/v100/entry.js` is a bundler entry, not a public re-export barrel; do not import application APIs from it in tests.

---

*Convention analysis: 2026-08-31*
