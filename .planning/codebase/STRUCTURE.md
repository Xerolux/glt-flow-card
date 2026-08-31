# Codebase Structure

**Analysis Date:** 2026-08-31

## Directory Layout

```text
glt-flow-card/
├── .github/
│   ├── ISSUE_TEMPLATE/          # GitHub issue forms/templates
│   └── workflows/               # Validate, build, docs, screenshots, release automation
├── .planning/
│   └── codebase/                # Generated GSD codebase reference documents
├── custom_components/
│   └── glt_flow_card/           # Optional Home Assistant companion integration
│       ├── __init__.py           # Manager, WebSocket API, alarms, schedules, remote sites
│       ├── config_flow.py        # Config-entry and options flows
│       ├── const.py              # Backend constants and service allowlist
│       ├── manifest.json         # Home Assistant integration metadata
│       ├── strings.json          # Base config-flow strings
│       ├── translations/         # Localized config-flow strings
│       └── www/                  # HACS/HA-served generated card asset
├── dist/
│   └── glt-flow-card.js         # Generated release bundle
├── docs/
│   ├── editor/                   # Standalone browser designer
│   ├── images/                   # Screenshots and documentation illustrations
│   ├── site/                     # Static landing/platform page overlay
│   └── wiki/                     # Markdown documentation source
├── examples/                         # Importable Lovelace/project YAML examples
├── src/
│   ├── v040-extension.part00..06 # Historical split extension input used by v0.4 build
│   └── v100/                     # Authored v1 modules and bundle entry
├── test/                              # Node built-in test-runner suites
├── tools/                             # Build, mutation, screenshot, and README scripts
├── CHANGELOG.md                       # Release history
├── hacs.json                          # HACS repository metadata
├── package.json                       # Node metadata, scripts, dev dependencies
├── package-lock.json                  # Locked Node dependency graph
├── README.md                          # Primary English project documentation
└── README.de.md                       # German project documentation
```

## Directory Purposes

**`.github/workflows/`:**
- Purpose: Define CI, generation, documentation deployment, screenshot refresh, and release packaging.
- Contains: YAML workflows scoped by branch and changed paths.
- Key files: `.github/workflows/validate.yml`, `.github/workflows/build-v1.yml`, `.github/workflows/docs.yml`, `.github/workflows/release.yml`.

**`src/v100/`:**
- Purpose: Hold the authored JavaScript source for v1 domain logic and extension UI.
- Contains: ES modules for entry ordering, catalogs, pure domain logic, main UI augmentation, add-ons, and standalone-editor augmentation.
- Key files: `src/v100/entry.js`, `src/v100/core.mjs`, `src/v100/catalog.mjs`, `src/v100/index.js`, `src/v100/v1-addons.js`, `src/v100/online-extension.js`.

**`custom_components/glt_flow_card/`:**
- Purpose: Package the optional Home Assistant Companion and the browser asset served with it.
- Contains: Python integration code, manifest/config-flow localization, and generated JavaScript.
- Key files: `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/config_flow.py`, `custom_components/glt_flow_card/const.py`, `custom_components/glt_flow_card/manifest.json`, `custom_components/glt_flow_card/www/glt-flow-card.js`.

**`dist/`:**
- Purpose: Provide the standalone browser bundle attached to releases.
- Contains: The generated `dist/glt-flow-card.js` artifact.
- Key files: `dist/glt-flow-card.js`.

**`docs/editor/`:**
- Purpose: Provide a Pages-hosted designer that works without a Home Assistant runtime.
- Contains: A static entry page, one application module, and designer styles.
- Key files: `docs/editor/index.html`, `docs/editor/app.js`, `docs/editor/style.css`.

**`docs/wiki/`:**
- Purpose: Act as the canonical source for the generated Pages wiki and synchronized GitHub Wiki.
- Contains: Topic Markdown plus `_Sidebar.md` and `_Footer.md`.
- Key files: `docs/wiki/Home.md`, `docs/wiki/Configuration.md`, `docs/wiki/Companion-Backend.md`, `docs/wiki/Designer.md`.

**`docs/site/`:**
- Purpose: Supply the polished landing and platform pages overlaid onto the generated documentation site.
- Contains: Static HTML, shared CSS, and a small home-page script.
- Key files: `docs/site/index.html`, `docs/site/platform.html`, `docs/site/showcase.html`, `docs/site/site.css`, `docs/site/home.js`.

**`docs/images/`:**
- Purpose: Store committed live screenshots and vector documentation artwork.
- Contains: PNG screenshots, SVG diagrams, and image maintenance notes.
- Key files: `docs/images/README.md`, `docs/images/feature-overview.svg`, `docs/images/designer-dark-live.png`.

**`examples/`:**
- Purpose: Provide concrete YAML inputs for installation, demos, and manual validation.
- Contains: GLT configurations for IDM heat pumps and ventilation.
- Key files: `examples/idm-neo2030.yaml`, `examples/idm-alm6-15.yaml`, `examples/ventilation-glt.yaml`.

**`test/`:**
- Purpose: Verify generated artifact markers, core engineering behavior, scale behavior, and backend contract presence.
- Contains: Node `node:test` suites named `*.test.mjs`.
- Key files: `test/smoke.test.mjs`, `test/v040.test.mjs`, `test/v100-core.test.mjs`, `test/v100-backend.test.mjs`.

**`tools/`:**
- Purpose: Perform deterministic repository generation and documentation maintenance.
- Contains: Node scripts for applying versioned bundles, building Pages, screenshots, and README updates.
- Key files: `tools/apply-v100.mjs`, `tools/apply-v040.mjs`, `tools/build-site.mjs`, `tools/capture-screenshots.mjs`.

**`.planning/codebase/`:**
- Purpose: Store architecture, stack, quality, and concern maps consumed by GSD planning/execution.
- Contains: Uppercase Markdown reference documents.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `src/v100/entry.js`: esbuild entry that loads the v1 completion layer and add-ons in order.
- `custom_components/glt_flow_card/www/glt-flow-card.js`: production browser entry registered as a Lovelace resource.
- `custom_components/glt_flow_card/__init__.py`: Home Assistant integration setup and WebSocket registration entry.
- `custom_components/glt_flow_card/config_flow.py`: Home Assistant UI configuration entry.
- `docs/editor/index.html`: standalone designer page entry.
- `docs/site/index.html`: public landing-page entry.
- `tools/build-site.mjs`: static documentation site build entry.

**Configuration:**
- `package.json`: Node module mode, scripts, versions, and build/test dependencies.
- `package-lock.json`: reproducible Node dependency resolution.
- `custom_components/glt_flow_card/manifest.json`: Home Assistant domain/version/config-flow metadata.
- `custom_components/glt_flow_card/const.py`: persistence limits, lock TTL, store identifiers, and safe service domains.
- `hacs.json`: HACS distribution metadata.
- `.github/workflows/build-v1.yml`: v1 artifact-generation contract.
- `.github/workflows/docs.yml`: Pages and GitHub Wiki publishing contract.

**Core Logic:**
- `src/v100/core.mjs`: pure schema, state, routing, diagnostics, time-series, energy, diff, and bundle functions.
- `src/v100/catalog.mjs`: component profiles and symbol catalog.
- `src/v100/index.js`: v1 browser integration and SDK surface.
- `src/v100/v1-addons.js`: smaller runtime/editor feature additions.
- `custom_components/glt_flow_card/__init__.py`: server-side persistence and automation logic.

**Generated Runtime:**
- `dist/glt-flow-card.js`: release asset generated by versioned apply scripts.
- `custom_components/glt_flow_card/www/glt-flow-card.js`: generated/copied HA-served asset.
- `docs/editor/app.js`: standalone editor source plus an appended generated v1 extension section.

**Testing:**
- `test/v100-core.test.mjs`: direct behavioral tests for `src/v100/core.mjs` and `src/v100/catalog.mjs`.
- `test/v100-backend.test.mjs`: structural contract checks for the Python Companion.
- `test/smoke.test.mjs`: production bundle and package smoke checks.
- `test/v040.test.mjs`: generated v0.4 feature-marker checks.

**Documentation:**
- `README.md`: primary user-facing overview and installation path.
- `README.de.md`: German user-facing overview.
- `docs/wiki/`: long-form operational and configuration documentation.
- `CHANGELOG.md`: version-scoped feature record.

## Naming Conventions

**Files:**
- Use lowercase kebab-case for JavaScript tools and public assets: `tools/build-site.mjs`, `dist/glt-flow-card.js`.
- Use lowercase domain-oriented ES module names under the version directory: `src/v100/core.mjs`, `src/v100/catalog.mjs`.
- Use Python snake_case and Home Assistant-required names in the integration: `custom_components/glt_flow_card/config_flow.py`, `custom_components/glt_flow_card/__init__.py`.
- Use `*.test.mjs` for Node test files: `test/v100-core.test.mjs`.
- Use title-cased or topic-based Markdown names for wiki pages: `docs/wiki/Companion-Backend.md`, `docs/wiki/YAML-Projects.md`.
- Use semantic screenshot names with mode/theme/live qualifiers: `docs/images/neo2030-dark-live.png`.
- Keep version-specific source under explicit version directories or filenames: `src/v100/`, `src/v040-extension.part00`.

**Directories:**
- Use Home Assistant's required snake_case domain directory: `custom_components/glt_flow_card/`.
- Use short lowercase responsibility names for source and tooling: `src/`, `test/`, `tools/`, `docs/`.
- Group documentation by delivery surface: `docs/editor/`, `docs/site/`, `docs/wiki/`, `docs/images/`.
- Group authored current platform modules under `src/v100/`; do not add new current-version logic to `src/v040-extension.part*`.

**JavaScript Symbols:**
- Use `PascalCase` for custom-element classes such as `GltFlowCard` and `GltFlowCardEditor` in `custom_components/glt_flow_card/www/glt-flow-card.js`.
- Use `camelCase` for functions such as `deriveOperationalState` and `autoMapEquipment` in `src/v100/core.mjs`.
- Use uppercase snake case for exported constant datasets such as `SCHEMA_VERSION`, `OPERATIONAL_STATES`, and `COMPONENT_PROFILES` in `src/v100/`.
- Prefix internal element state/methods with `_` in custom elements, matching `_config`, `_render`, and `_emit` in `custom_components/glt_flow_card/www/glt-flow-card.js`.

**Python Symbols:**
- Use `snake_case` for functions and methods, including `async_setup_entry` and `save_project` in `custom_components/glt_flow_card/__init__.py`.
- Prefix module-private helpers with `_`, including `_project_role` and `_safe_domains` in `custom_components/glt_flow_card/__init__.py`.
- Prefix WebSocket handlers with `ws_`, such as `ws_projects_save` and `ws_control_execute` in `custom_components/glt_flow_card/__init__.py`.
- Use `PascalCase` for manager and flow classes: `GltStore` and `GltFlowCardConfigFlow` in `custom_components/glt_flow_card/`.

## Where to Add New Code

**New Framework-Free Engineering Feature:**
- Primary code: `src/v100/core.mjs`
- Catalog/profile data: `src/v100/catalog.mjs`
- Tests: `test/v100-core.test.mjs`
- Rule: Keep the code independent of DOM, `window`, and Home Assistant so the Node test suite can import it directly.

**New Lovelace Runtime Panel or Editor Tool:**
- Primary code: `src/v100/index.js`
- Small additive panel tied to existing v1 UI: `src/v100/v1-addons.js`
- Bundle order: `src/v100/entry.js`
- Tests: add focused pure logic to `test/v100-core.test.mjs` and artifact/contract assertions under `test/`.
- Rule: Extend the existing guarded prototype wrappers and SDK registry; do not patch only `dist/glt-flow-card.js`.

**New Equipment Type or Symbol:**
- Profile and port/control contract: `src/v100/catalog.mjs`
- Runtime rendering behavior, only if data-driven rendering is insufficient: `src/v100/index.js`
- Example configuration: `examples/`
- Tests: `test/v100-core.test.mjs`

**New Companion Backend Capability:**
- Manager/domain behavior: `custom_components/glt_flow_card/__init__.py`
- Constants/limits: `custom_components/glt_flow_card/const.py`
- User-configurable integration option: `custom_components/glt_flow_card/config_flow.py`
- Localization: `custom_components/glt_flow_card/strings.json`, `custom_components/glt_flow_card/translations/en.json`, `custom_components/glt_flow_card/translations/de.json`
- Contract test: `test/v100-backend.test.mjs`
- Rule: Add a narrow Voluptuous-validated `glt_flow_card/*` WebSocket command and enforce the required project role server-side.

**New Standalone Designer Feature:**
- Primary interaction code: `docs/editor/app.js`
- Presentation: `docs/editor/style.css`
- Markup shell: `docs/editor/index.html`
- Shared/generated v1 addition: `src/v100/online-extension.js`, applied through `tools/apply-v100.mjs`
- Rule: Put changes before/within the appropriate authored section so the apply script does not discard them at its marker.

**New Documentation Topic:**
- Long-form source: `docs/wiki/<Topic>.md`
- Navigation: update the wiki file list in `tools/build-site.mjs` and sidebar source in `docs/wiki/_Sidebar.md` where applicable.
- Images: `docs/images/`
- Example YAML: `examples/`

**New Public Landing Section:**
- Markup: `docs/site/index.html` or `docs/site/platform.html`
- Shared styling: `docs/site/site.css`
- Behavior: `docs/site/home.js`
- Visual verification: `tools/capture-screenshots.mjs`

**New Build/Maintenance Automation:**
- Reusable Node script: `tools/<verb>-<subject>.mjs`
- CI orchestration: `.github/workflows/<purpose>.yml`
- Rule: Keep generated file lists explicit, matching the artifact assertions in `.github/workflows/build-v1.yml`.

**Utilities:**
- Shared domain helpers: colocate in `src/v100/core.mjs` until a cohesive new domain module is warranted.
- Browser-only UI helpers: keep near their owning feature in `src/v100/index.js`, `src/v100/v1-addons.js`, or `docs/editor/app.js`.
- Backend-only helpers: keep private at module scope in `custom_components/glt_flow_card/__init__.py`; move stable constants to `custom_components/glt_flow_card/const.py`.

## Special Directories

**`dist/`:**
- Purpose: Release-ready card bundle.
- Generated: Yes, via `tools/apply-v040.mjs` and `tools/apply-v100.mjs` in CI.
- Committed: Yes.

**`custom_components/glt_flow_card/www/`:**
- Purpose: Home Assistant/HACS-served copy of the release bundle.
- Generated: Yes, copied from `dist/glt-flow-card.js` by `tools/apply-v100.mjs`.
- Committed: Yes.

**`src/v040-extension.part*`:**
- Purpose: Split source fragments concatenated by `.github/workflows/apply-v040.yml` for the base engineering workspace.
- Generated: No; authored fragments are build inputs.
- Committed: Yes.

**`docs/editor/`:**
- Purpose: Standalone online designer shipped with Pages.
- Generated: Partially; `docs/editor/app.js` contains an authored base and a v1 extension appended from `src/v100/online-extension.js` by `tools/apply-v100.mjs`.
- Committed: Yes.

**`_site/`:**
- Purpose: Temporary GitHub Pages output created by `tools/build-site.mjs`.
- Generated: Yes.
- Committed: No; absent from the repository tree and produced during `.github/workflows/docs.yml`.

**`docs/images/`:**
- Purpose: Versioned visual evidence and documentation artwork.
- Generated: Mixed; live PNGs are refreshed by `.github/workflows/screenshots.yml`, while SVGs and notes are maintained sources.
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: Machine-consumable codebase maps for planning and execution.
- Generated: Yes, by GSD mapping workflows.
- Committed: Repository-policy dependent; files are present in the working tree.

---

*Structure analysis: 2026-08-31*
