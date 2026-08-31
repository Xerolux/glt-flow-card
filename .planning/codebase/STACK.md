# Technology Stack

**Analysis Date:** 2026-08-31

## Languages

**Primary:**
- JavaScript (ECMAScript modules authored for ES2022) - Browser card, visual designer, platform extensions, documentation generator, build scripts, and Node tests in `src/v100/`, `dist/glt-flow-card.js`, `docs/editor/app.js`, `tools/`, and `test/`.
- Python 3 (validated with 3.13 in CI) - Optional Home Assistant companion integration in `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/config_flow.py`, and `custom_components/glt_flow_card/const.py`.

**Secondary:**
- HTML5 and CSS3 - Static documentation, showcase, and standalone online designer in `docs/site/` and `docs/editor/`.
- YAML - Home Assistant example configurations in `examples/` and GitHub Actions workflows in `.github/workflows/`.
- JSON - npm, HACS, Home Assistant, translation, and UI metadata in `package.json`, `package-lock.json`, `hacs.json`, and `custom_components/glt_flow_card/*.json`.
- Markdown - End-user documentation and generated-site sources in `README.md`, `README.de.md`, and `docs/wiki/`.

## Runtime

**Environment:**
- Node.js 22 in CI - Build, test, documentation, and release automation in `.github/workflows/build-v1.yml`, `.github/workflows/docs.yml`, `.github/workflows/release.yml`, `.github/workflows/screenshots.yml`, and `.github/workflows/validate.yml`.
- Node.js >=18 is the effective local minimum imposed by `esbuild` and `marked`; use Node.js 22 to match CI. Exact dependency engine metadata is locked in `package-lock.json`.
- Modern browser with Custom Elements, Shadow DOM, SVG, Fetch-compatible Home Assistant APIs, and ES2022 support - Production runtime is the Home Assistant Lovelace frontend bundle `dist/glt-flow-card.js` (also copied to `custom_components/glt_flow_card/www/glt-flow-card.js`).
- Home Assistant 2024.8.0 or newer - Minimum dashboard-card version declared in `hacs.json`; the optional companion runs in Home Assistant's Python environment through `custom_components/glt_flow_card/manifest.json`.
- Python 3.13 is used for companion syntax validation in `.github/workflows/build-v1.yml`; production Python version follows the installed Home Assistant release.

**Package Manager:**
- npm with lockfile version 3 - Package metadata and scripts are in `package.json`; exact dependency resolution is in `package-lock.json`.
- Lockfile: present at `package-lock.json`; use `npm ci --ignore-scripts` for reproducible CI-style installs.

## Frameworks

**Core:**
- Home Assistant Lovelace custom-card API - `dist/glt-flow-card.js` registers `glt-flow-card` and `glt-flow-card-editor`, consumes the injected `hass` object, and uses native HA entity, service, REST, and WebSocket interfaces.
- Home Assistant custom integration framework - `custom_components/glt_flow_card/__init__.py` registers WebSocket commands, event/time listeners, service calls, HTTP clients, and native storage; `custom_components/glt_flow_card/config_flow.py` provides a single-instance UI config flow.
- Native Web Components/DOM APIs - No frontend component framework is used; custom elements, Shadow DOM, CSS, SVG, Blob/download APIs, and browser storage are implemented directly in `dist/glt-flow-card.js` and sources under `src/v100/`.

**Testing:**
- Node.js built-in test runner - `node --test test/*.test.mjs` is configured in `package.json`; assertions use `node:assert/strict` in `test/smoke.test.mjs`, `test/v040.test.mjs`, `test/v100-core.test.mjs`, and `test/v100-backend.test.mjs`.
- Python bytecode compilation - `python -m py_compile custom_components/glt_flow_card/*.py` is the companion validation gate in `.github/workflows/build-v1.yml`; no Python unit-test framework is declared.
- Playwright Chromium, installed ad hoc in CI - Screenshot regression/artifact capture uses `tools/capture-screenshots.mjs` and `.github/workflows/screenshots.yml`; Playwright is intentionally not persisted in `package.json`.

**Build/Dev:**
- esbuild 0.25.12 - Bundles `src/v100/entry.js` and concatenated v0.4 sources as browser IIFEs targeting ES2022 in `.github/workflows/build-v1.yml` and `.github/workflows/apply-v040.yml`.
- js-yaml 4.3.2 - Provides YAML parsing in the online designer; `tools/build-site.mjs` copies `node_modules/js-yaml/dist/js-yaml.mjs` into the generated site.
- marked 15.0.12 - Converts `docs/wiki/*.md` to static HTML in `tools/build-site.mjs`.
- Custom Node generators - `tools/apply-v100.mjs` assembles production and companion card artifacts, `tools/apply-v040.mjs` applies legacy extension parts, and `tools/build-site.mjs` generates `_site/`.

## Key Dependencies

**Critical:**
- Home Assistant frontend runtime (host-provided, no npm package) - Supplies live entity state, service calls, REST history access, WebSocket calls, themes, dialogs, and entity registry access consumed by `dist/glt-flow-card.js` and `src/v100/index.js`.
- Home Assistant Python APIs (host-provided, no Python requirements file) - Supplies `websocket_api`, `ConfigEntry`, `Store`, the shared aiohttp client, event listeners, and service execution in `custom_components/glt_flow_card/__init__.py`.
- voluptuous (host-provided by Home Assistant) - Validates config-flow options and WebSocket messages in `custom_components/glt_flow_card/config_flow.py` and `custom_components/glt_flow_card/__init__.py`.
- esbuild ^0.25.12 (locked 0.25.12) - Produces the extension IIFEs consumed by generated runtime artifacts; declared in `package.json` and pinned by `package-lock.json`.
- js-yaml ^4.3.2 (locked 4.3.2) - Supports YAML import/export tooling in the generated online editor; declared in `package.json` and pinned by `package-lock.json`.
- marked ^15.0.12 (locked 15.0.12) - Renders Markdown wiki sources into the GitHub Pages site; declared in `package.json` and pinned by `package-lock.json`.

**Infrastructure:**
- HACS dashboard distribution metadata - `hacs.json` identifies `glt-flow-card.js` and minimum Home Assistant 2024.8.0; the published asset is `dist/glt-flow-card.js`.
- GitHub Actions - Validation, generated-artifact updates, Pages deployment, Wiki synchronization, screenshots, and releases live in `.github/workflows/`.
- GitHub Pages - Static documentation and the online designer are generated by `tools/build-site.mjs` and deployed from `_site/` by `.github/workflows/docs.yml`.
- GitHub Releases - Tag builds publish `dist/glt-flow-card.js` and an optional companion ZIP via `.github/workflows/release.yml`.

## Configuration

**Environment:**
- No `.env` files or environment-variable-based application configuration are present. Home Assistant card configuration is Lovelace YAML, with examples under `examples/` and schema usage documented in `README.md` and `docs/wiki/Configuration.md`.
- Optional companion setup is a single-instance Config Entry managed by `custom_components/glt_flow_card/config_flow.py`; options include server enforcement, lock TTL, version retention, and audit retention.
- Optional remote Home Assistant sites are configured under `glt_flow_card.remote_sites` in Home Assistant YAML; documentation requires tokens to be referenced through `!secret` in `docs/wiki/Companion-Backend.md` and `docs/wiki/Installation.md`.
- HACS packaging is configured by `hacs.json`; Home Assistant companion metadata is configured by `custom_components/glt_flow_card/manifest.json`.

**Build:**
- npm scripts are limited to syntax checking and Node tests in `package.json`; bundling is encoded explicitly in `.github/workflows/build-v1.yml` and `.github/workflows/apply-v040.yml` rather than a standalone esbuild config.
- The v1 source entry is `src/v100/entry.js`; generated bundles are assembled into `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, and `docs/editor/app.js` by `tools/apply-v100.mjs`.
- Static documentation build inputs are `docs/wiki/`, `docs/site/`, `docs/editor/`, and `examples/`; `tools/build-site.mjs` emits `_site/`, which is a generated CI artifact and not a committed source directory.
- No TypeScript, ESLint, Prettier, Babel, Vite, Webpack, or Python packaging configuration is detected in the repository root.

## Platform Requirements

**Development:**
- Use Node.js 22 and npm to match all workflows in `.github/workflows/`; run `npm ci --ignore-scripts`, `npm run check`, and `npm test` from `package.json`.
- Use Python 3.13 for the repository's declared companion syntax gate in `.github/workflows/build-v1.yml`; full runtime verification requires a compatible Home Assistant installation because Python dependencies are host-provided.
- Use a Chromium-capable Playwright installation only when regenerating screenshots through `tools/capture-screenshots.mjs` and `.github/workflows/screenshots.yml`.
- Treat `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, and `docs/editor/app.js` as generated artifacts governed by `tools/apply-v100.mjs`.

**Production:**
- Primary deployment target: Home Assistant Lovelace via HACS or a manual `/local/glt-flow-card.js` module, as defined by `hacs.json` and `README.md`.
- Optional backend target: Home Assistant `custom_components/glt_flow_card/`, packaged as `glt-flow-card-companion.zip` by `.github/workflows/release.yml`.
- Documentation target: GitHub Pages from `_site/`, deployed by `.github/workflows/docs.yml`; wiki Markdown is also synchronized to the repository's GitHub Wiki.

---

*Stack analysis: 2026-08-31*
