# Technology Stack

**Project:** GLT Flow Card — v1.1 Production-Ready GLT Platform  
**Research scope:** Stack additions and controls needed to harden the existing 30-capability platform  
**Researched:** 2026-08-31  
**Overall confidence:** MEDIUM — recommendations are cross-checked against current official/primary documentation, but Home Assistant version support and performance budgets still require repository-specific decisions and measurements.

## Recommendation Summary

Keep the existing browser-first JavaScript architecture, Node 22, esbuild, native Web Components, and optional Home Assistant Companion. Do not rewrite the card in a frontend framework or TypeScript, and do not add a database, message broker, historian, authentication service, notification service, or industrial protocol stack. Home Assistant remains the device gateway, state/service broker, authentication source, Recorder, and notification platform.

Add four focused layers:

1. A canonical JSON Schema Draft 2020-12 project contract, compiled into a standalone JavaScript validator with Ajv and enforced independently by the Companion with Python `jsonschema`.
2. Playwright Test for real-browser behavioral, visual, accessibility, and capacity tests while retaining `node:test` for pure engineering logic.
3. `pytest-homeassistant-custom-component` for executable Companion tests through Home Assistant's public setup, storage, service, time, auth, and WebSocket interfaces.
4. Non-mutating, reproducible CI/release controls: one build entrypoint, generated-artifact equality, HACS/hassfest validation, compatibility lanes, artifact hashes/attestations, pinned Actions, dependency review, and CodeQL.

The stack should make authored modules and schemas the source of truth. Generated copies (`dist/glt-flow-card.js`, the Companion `www` asset, and the designer extension) are release outputs that must be rebuilt and compared in CI, not edited or committed by a bot after merge.

## Recommended Stack

### Existing Core to Retain

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.x | Build scripts, pure JavaScript tests, schema compilation, documentation generation | Matches current CI and supports the existing ES2022 code and built-in test runner. Keep one declared Node line across local development and CI. |
| esbuild | 0.25.12, lockfile-pinned | Bundle authored browser modules into the card artifacts | Already integrated and adequate. Centralize its invocation in one repository build script; do not introduce Vite/Webpack solely for testing. |
| Native Web Components + ES2022 | Existing | Lovelace card, editor, and standalone designer UI | Preserves the current deployment shape and avoids a framework migration unrelated to production hardening. |
| Home Assistant Lovelace + Companion APIs | Supported-version matrix | States, services, users, WebSocket commands, storage, scheduling, Recorder/history, notifications | These are the host boundaries. Production-grade behavior means exercising and enforcing them, not replacing them. |
| Node built-in `node:test` / `node:assert` | Node 22 | Pure domain, migration, route, diagnostic, aggregation, and serialization tests | Existing tests already use it. It now supports mocks/timers and V8 coverage collection, so changing unit runners adds little value. |
| js-yaml / marked | 4.3.2 / 15.0.12, lockfile-pinned | YAML exchange and documentation build | Retain, but validate parsed project data before normalization and rendering. |

### Schema and Boundary Validation

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| JSON Schema | Draft 2020-12 | Canonical serialized project/bundle contract | Validate every import, bundle restore, Companion project save/load, migration result, plugin contribution, and example fixture. Use explicit bounds for array sizes, string lengths, nesting, and numeric ranges. |
| Ajv | 8.20.0 | Build-time schema checks and standalone JavaScript validator generation | Add as a dev dependency. Compile the canonical schema during the build and ship only generated validator code, avoiding schema compilation and `eval`-like code generation in the Home Assistant browser at runtime. Ajv supports Draft 2020-12 and standalone output. |
| `ajv-formats` | 3.0.1, only if needed | Standards-based `date-time`, URI, duration, and related formats | Add only when the schema actually uses these formats. Mirror every enabled format in Python and cover parity fixtures; do not use custom formats for security rules. |
| Python `jsonschema` | 4.26.0, host-compatibility pinned | Companion-side Draft 2020-12 validation | Declare as a Companion requirement only after it passes every supported Home Assistant lane. Use `Draft202012Validator.check_schema` at development/test time and a preconstructed validator at runtime. Continue using Voluptuous for WebSocket message envelopes. |

**Prescribed schema shape:** keep one authored schema such as `schema/project.schema.json`, one explicit `schema_version`, and sequential pure migrations (`v1 -> v2`, never arbitrary `old -> latest`). Generate the browser validator during `npm run build`; load the same JSON schema in Companion tests and runtime. Maintain shared valid, invalid, boundary, and historical migration fixtures. Both Ajv and Python `jsonschema` must return the same accept/reject result for every fixture.

Do not make schema validation silently mutate inputs. Validate the serialized input, migrate a deep copy, validate the migration output, then normalize runtime defaults. Unknown top-level/plugin extension data must be governed by an explicit extension namespace rather than unrestricted `additionalProperties` throughout the core model.

### Browser and Accessibility Test Harness

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `@playwright/test` | 1.62.1, exact lock | Real-browser card/editor/designer behavior, cross-browser checks, visual snapshots, traces, and capacity tests | Add as the only browser test runner. Use Chromium for every PR; run critical flows on Chromium, Firefox, and WebKit before release and on schedule. Playwright officially supports isolated fixtures, multi-browser projects, visual comparison, reports, and failure traces. |
| `@axe-core/playwright` | 4.13.0, exact lock | Automated accessibility rule checks in rendered interaction states | Run after opening dialogs/panels, selecting equipment, editing controls, and switching themes. Pair with keyboard/focus/role/name assertions and manual screen-reader/zoom review; automated tools cannot establish complete accessibility. |
| Deterministic test host page | Repository-owned fixture, no framework | Loads the shipped bundle, registers the custom elements, and injects a bounded fake `hass` surface | Use for most browser tests. It should model `states`, `user`, `callWS`, `callService`, themes, locale, and controlled failures without copying Home Assistant frontend internals. |
| Pinned Home Assistant smoke environment | Minimum and current supported HA lanes | Proves Companion setup, static asset delivery, WebSocket registration, and one representative card-to-Companion round trip | Run on scheduled/release builds, not for every UI assertion. It is a compatibility smoke, not a plant test and must not perform physical service writes. |

Playwright should replace the ad hoc `npm install --no-save playwright` screenshot workflow. Declare and lock it in `package.json`, install browser binaries explicitly, and use the same configuration for assertions and approved documentation screenshots. Store visual baselines only for deterministic Chromium/Linux rendering; Playwright warns that screenshot baselines depend on the OS and browser version.

Required browser suites:

- Bundle boot: both custom elements register and render from the exact released asset.
- Operator flows: drill-down, alarm transitions/acknowledge/shelve, schedule editing, safe control confirmation, trends, reports, and permission-denied states.
- Engineering flows: drag/resize/connect, undo/redo, routing, auto-mapping, YAML/project exchange, migrations, plugin registration, and concurrent lock/revision conflict UX.
- Accessibility: keyboard-only traversal, visible focus, dialog focus containment/return, accessible names and roles, reduced motion, forced colors/high contrast, 200% zoom, and axe scans in each major state.
- Resilience: malformed and oversized projects, unavailable entities, rejected WebSocket calls, slow history/remote responses, reconnect, teardown/re-attach, and missing Companion fallback boundaries.
- Visual: dark/light themes and a small representative set of GLT/P&ID views; do not snapshot all 300+ symbols as a substitute for semantic tests.

### Home Assistant Companion Test Harness

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `pytest-homeassistant-custom-component` | 0.13.361 for the current 2026-08 lane; pin the matching historical release per HA lane | Extracts Home Assistant's pytest fixtures for third-party custom components | Use for all Companion behavior. The current package is generated against current HA releases and requires Python 3.14; it cannot by itself prove the declared HA 2024.8 floor. |
| pytest | 9.1.1 in the current lane, resolved with the HA harness | Async functional and integration tests | Let the HA harness/constraints determine compatible pytest and transitive versions rather than independently floating them. |
| pytest-cov | 7.1.0 in the current lane | Branch/line coverage for authored Companion code | Report and gate high-risk authorization, validation, alarm, schedule, persistence, and cleanup paths. Do not count generated browser bundles toward coverage. |
| Ruff | 0.16.5 | Python linting and formatting checks | Configure in `pyproject.toml`; run `ruff check` and `ruff format --check` on the Companion and Python tests. Begin with stable correctness/import/async rules and avoid an `ALL` ruleset that changes whenever Ruff updates. |

The Companion suite must set up the integration through `async_setup_component` or config entries, then exercise Home Assistant's public state machine, service registry, storage, time helpers, and WebSocket client. Home Assistant's official guidance explicitly favors these core interfaces over integration internals.

Minimum backend fixtures and scenarios:

- `hass`, `MockConfigEntry`, `enable_custom_integrations`, and storage fixtures for setup/load/unload/reload and persistence/migration behavior.
- Authenticated WebSocket clients for owner/admin, operator/designer members, viewer/read-only users, removed users, and anonymous/invalid access where applicable.
- Controlled time advancement for alarm delay/hysteresis/shelving, schedule firing, lock TTL, report periods, and retention cleanup; no real sleeps.
- Registered fake services to assert exact domain/service/target/data calls, denied-domain behavior, confirmation rules, and authoritative audit records without touching real devices.
- Mocked aiohttp endpoints for remote-site success, partial failure, timeout, bounded concurrency, cancellation, and token non-disclosure.
- Shutdown/unload assertions for listeners, delayed tasks, scheduled callbacks, HTTP sessions, and pending tasks.
- Fuzzed/boundary WebSocket inputs and project sizes to prove server-side limits before persistence or fan-out.

Create two explicit compatibility lanes until the support policy is decided:

1. **Declared minimum lane:** Home Assistant 2024.8 with its compatible Python and historical test-harness pin.
2. **Current lane:** current stable Home Assistant with Python 3.14 and the current harness pin.

If the minimum lane cannot be made green without unsupported dependencies or extensive compatibility branches, raise `hacs.json.homeassistant` deliberately and document the migration. Do not continue advertising 2024.8 based only on syntax compilation. A scheduled beta/pre-release lane may warn rather than block releases, but minimum and current stable lanes must block.

### JavaScript Static Analysis

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| ESLint | 10.9.1 | Error-focused static checks for authored ESM, browser code, Node tools, and tests | Use flat `eslint.config.js`, scoped globals for browser/Home Assistant and Node files, and separate rules per directory. Exclude generated `dist`, Companion `www`, and generated designer sections. |
| `@eslint/js` + `globals` | ESLint 10 line / 17.11.0 | Recommended base rules and explicit runtime globals | Use with ESLint flat config; report unused disables and avoid formatting-only rule churn. |

Do not migrate the application to TypeScript during this production-hardening milestone. First isolate stable domain/service boundaries, add JSDoc to those boundaries, and make ESLint clean. A later scoped `checkJs` experiment can be evaluated for `src/v100/core.mjs` and schema-generated types, but a whole-card conversion would mix platform hardening with a large rewrite.

### Performance and Capacity Tooling

Use built-in measurement APIs instead of adding a load-testing platform initially:

| Layer | Tool | Required measurements |
|-------|------|-----------------------|
| Pure JavaScript algorithms | `node:perf_hooks`, deterministic generated fixtures | Schema validation/migration, operational-state derivation, auto-mapping, route calculation, aggregation, diff, and bundle round trip at 100, 500, and 2,000 objects. Record median and tail samples after warm-up. |
| Browser render/interaction | Playwright `page.evaluate`, User Timing `performance.mark/measure`, `PerformanceObserver` long-task entries | Initial render, state-only update, pan/zoom, selection, editor mutation, panel open, and route redraw; count DOM/SVG nodes and long tasks. The Long Tasks API surfaces main-thread tasks of 50 ms or more. |
| Browser lifecycle/memory | Playwright `page.requestGC`, repeated attach/detach and project switching | Prove listeners, observers, timers, object graphs, and custom elements are released; keep diagnostic traces when a budget fails. |
| Companion async behavior | pytest with controlled clock, fake services, fake aiohttp, duration reports | WebSocket latency, alarm state fan-out, schedule pass, persistence batch, report generation, remote timeout, bounded parallelism, cancellation, and unload. Assert the event loop is not blocked by CPU/file work. |

Keep checked-in performance scenarios, not checked-in machine-specific timing truth. Establish baselines on the fixed CI image, publish JSON results and Playwright traces as artifacts, and set broad regression gates only after repeated measurements. Functional capacity at 100/500/2,000 objects should block immediately; tight millisecond thresholds should block only after noise and variance are characterized.

Do not use Lighthouse as the primary performance gate: this is an embedded interactive custom element, so page-load scores do not measure the important update, editing, SVG, or WebSocket paths. Use Chrome/Playwright traces for diagnosis. Do not add k6, Locust, or a distributed load platform until there is a defined multi-client server-load requirement that the in-process HA harness cannot represent.

### Build and Release Controls

| Control | Recommendation | Why |
|---------|----------------|-----|
| Single build entrypoint | Add `npm run build` backed by one Node script that bundles v1, generates schema validators, updates every runtime copy, builds the designer integration, and emits a manifest of paths/hashes. All workflows call it. | Current build logic is duplicated between workflow YAML and generator scripts. One entrypoint makes local, PR, and tag builds equivalent. |
| Reproducible install | Use `npm ci --ignore-scripts` everywhere, then explicitly run only required trusted install steps such as Playwright browser installation. Use pinned Python test constraint files per HA lane. | Current validation/release workflows use `npm install`, and the screenshot job installs untracked Playwright bytes. |
| Non-mutating PR gate | Build from a clean checkout, then fail on `git diff --exit-code` for generated tracked artifacts. Do not let build/screenshot workflows commit or push to `main`. | A CI bot that changes source after merge means the reviewed commit is not the released source state and can race with other workflows. |
| Artifact equality | Require byte equality between `dist/glt-flow-card.js` and `custom_components/glt_flow_card/www/glt-flow-card.js`; verify the designer's generated section and schema validator hash come from the same build. | Users can install different copies today. Token checks are not proof of equality. |
| Version parity | Compare tag, `package.json`, Companion manifest, bundle banner/API version, schema version policy, release filenames, and documentation metadata. | Prevents releases whose UI, Companion, and metadata report different versions. Schema version may advance independently only under an explicit migration policy. |
| Package-content tests | Build the Companion ZIP from an allowlisted file manifest with deterministic order/timestamps; reject caches, tests, secrets, and source-only files. Unzip it in CI and run manifest/import/asset checks. | `zip -r custom_components/...` can include accidental files and is not reproducible. |
| HACS + hassfest | Run `hacs/action` for the dashboard/plugin repository and Home Assistant hassfest for the optional integration on PRs and scheduled builds. | HACS documents its validation action and recommends hassfest for integrations. Both packaging surfaces need validation. |
| Compatibility matrix | Block on Node 22, declared-minimum HA, and current stable HA. Run current HA beta/pre-release on schedule as an early warning. | Proves advertised compatibility instead of compiling Python on one unrelated version. |
| Release provenance | Release only from a verified tag whose commit passed required gates. Generate SHA-256 checksums and GitHub artifact attestations for both the card JS and Companion ZIP; attach test/compatibility evidence. | GitHub attestations bind an artifact to repository, workflow, commit, and trigger provenance. |
| Workflow hardening | Set least-privilege permissions per job and pin all third-party Actions to full commit SHAs, with Dependabot updates. Separate read-only PR validation from write-capable tag release jobs. | GitHub states that a full commit SHA is the immutable way to pin an Action. Current workflows use movable major tags and several broad `contents: write` jobs. |
| Supply-chain checks | Enable dependency review on PRs, Dependabot for npm/Actions/Python pins, and CodeQL default setup for JavaScript and Python. | Blocks newly introduced vulnerable dependencies and scans both authored language surfaces without adding runtime code. |

Recommended CI lanes:

| Lane | Trigger | Blocking work |
|------|---------|---------------|
| Fast authored checks | Every PR | Schema/meta-schema tests, migrations/fixtures, `node:test`, ESLint, Ruff, Companion unit/integration tests affected by the change, generated-artifact equality. |
| Browser behavior | Every PR touching UI/schema/examples | Chromium functional flows, axe checks, deterministic visual subset, 100-object capacity; retain trace/report on failure. |
| Full compatibility | Scheduled and release candidate; required before tag | Firefox/WebKit critical flows, declared-minimum/current HA lanes, 500/2,000-object capacity, unload/leak checks, HACS, hassfest. |
| Security/supply chain | PR/default branch/schedule | Dependency review, CodeQL, Dependabot, action-pin policy. |
| Release | Verified tag only | Clean rebuild, all artifact-equality/version/package tests, checksums, attestations, immutable release upload. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Pure JS unit runner | Keep `node:test` | Jest or Vitest | Existing direct ESM tests already work; another runner would duplicate assertions/mocks without supplying the real browser or HA runtime that is missing. |
| Browser tests | Playwright Test | jsdom/happy-dom | Simulated DOMs do not prove SVG layout, Shadow DOM focus, Custom Elements lifecycle, pointer interactions, visual rendering, or browser accessibility behavior. |
| Browser tests | Playwright Test | Cypress | Playwright covers Chromium, Firefox, and WebKit, traces, visual assertions, fixtures, and the existing screenshot use case in one locked tool. Adding both is unnecessary. |
| Component workbench | Small repository-owned host page | Storybook | A dedicated story system adds a second build/configuration surface. The project needs a deterministic HA-shaped fixture page and test scenarios, not a separate component product. |
| Project contract | JSON Schema 2020-12 + Ajv/Python validator parity | Pydantic-only or Voluptuous-only model | Either language-specific model would leave the other runtime and standalone designer without the same serialized contract. Keep Voluptuous for HA WebSocket envelopes. |
| Frontend language | Existing ESM + JSDoc/ESLint | Full TypeScript migration | High churn across generated/prototype-decorated code and no direct proof of runtime HA, security, accessibility, or migration behavior. |
| Frontend framework | Native Web Components | React, Vue, Lit rewrite | Rewriting the rendering/editor stack is outside the milestone and risks every existing integration point. Lit may be reconsidered only for a future isolated component boundary. |
| Python QA | Ruff + HA pytest harness + hassfest | A broad collection of Black/isort/Flake8/Pylint/mypy from day one | Duplicates tools and creates migration noise. Add deeper typing only after the Companion is split into stable typed modules. |
| Performance | Built-in Node/browser timing + Playwright/pytest fixtures | Lighthouse, k6, Locust, Benchmark.js, or a telemetry backend | The first production need is deterministic embedded-card and async-manager capacity. Add service-load infrastructure only after a measured gap and explicit load model exist. |
| Persistence | Home Assistant `Store` and Recorder | PostgreSQL, TimescaleDB, IndexedDB synchronization, Redis | Duplicates host responsibilities and creates migration/backup/authorization burdens. Store only Companion-owned configuration/state; query Recorder/history through HA. |
| Messaging/notifications | HA event bus, services, and notification integrations | MQTT broker, Web Push server, email/SMS SDKs | Home Assistant already supplies these platform services and credentials. GLT Flow Card should route and audit, not become another notification platform. |
| Protocol support | HA entity/integration provenance | Native BACnet/Modbus/KNX/OPC UA/SNMP drivers | Explicitly out of scope and would turn a visualization/engineering card into a fieldbus gateway. |
| Authentication/roles | HA authenticated users plus Companion server enforcement | Separate identity provider/JWT/session system | Duplicates HA auth and risks divergent identities. Browser role checks remain UX only. |

## Installation

Exact versions below reflect the 2026-08-31 research snapshot. Commit the npm lockfile and Python lane constraints; update through reviewed dependency PRs.

```bash
# Existing build dependencies remain.
# New JavaScript build/test/static-analysis dependencies:
npm install --save-dev \
  ajv@8.20.0 ajv-formats@3.0.1 \
  @playwright/test@1.62.1 @axe-core/playwright@4.13.0 \
  eslint@10.9.1 @eslint/js@10.9.1 globals@17.11.0

# CI after npm ci; install only the browsers used in that lane.
npm exec playwright install --with-deps chromium
# Release/scheduled compatibility lane:
npm exec playwright install --with-deps chromium firefox webkit

# Current Home Assistant/Python lane. Keep this in a pinned constraints file;
# use a separate matching historical harness for the declared minimum HA lane.
python -m pip install \
  pytest-homeassistant-custom-component==0.13.361 \
  pytest-cov==7.1.0 \
  ruff==0.16.5
```

For Companion runtime validation, add `jsonschema==4.26.0` to `manifest.json` requirements only after the minimum/current HA matrix proves that exact pin is compatible. If Home Assistant's constraints require a different compatible release, use the host-compatible pin and keep Draft 2020-12 parity fixtures as the behavioral contract.

## Explicitly Do Not Add

- No React/Vue/Lit rewrite, TypeScript migration, Vite/Webpack, Jest/Vitest, Cypress, Storybook, or jsdom layer for this milestone.
- No new database, historian, cache, queue, broker, identity provider, notification transport, or analytics/telemetry service by default.
- No native BACnet, Modbus, KNX, OPC UA, SNMP, or other fieldbus SDK.
- No browser-held remote-site credentials or authorization logic treated as a security boundary.
- No unbounded schema keywords, plugin execution, object counts, message sizes, history queries, remote fan-out, or report generation.
- No live plant/service-write tests in CI; all control tests use fake HA services. Hardware tests remain a separately authorized, bounded activity.
- No CI workflow that installs untracked packages, edits generated artifacts after merge, pushes bot commits to `main`, or releases a tag without rebuilding and comparing artifacts.

## Sources

Primary sources were current at research time. Confidence for the stack is MEDIUM because the websearch provider is MEDIUM only after cross-verification and the repository-specific HA/version/performance policies still require implementation evidence.

- [Home Assistant: Testing your code](https://developers.home-assistant.io/docs/development_testing/) — current official pytest, coverage, lint, public-interface, and snapshot guidance.
- [Home Assistant: Integration test file structure](https://developers.home-assistant.io/docs/creating_integration_tests_file_structure/) — official test organization.
- [`pytest-homeassistant-custom-component` package](https://pypi.org/project/pytest-homeassistant-custom-component/) — current version, Python requirement, fixture usage, and HA-release tracking.
- [HACS validation Action](https://hacs.xyz/docs/publish/action/) — official repository validation and hassfest recommendation.
- [Playwright Test package](https://www.npmjs.com/package/@playwright/test) and [Playwright fixtures](https://playwright.dev/docs/test-fixtures) — current version, isolated browser fixtures, and browser projects.
- [Playwright visual comparison/best practices](https://playwright.dev/docs/best-practices), [trace viewer](https://playwright.dev/docs/trace-viewer-intro), and [page API](https://playwright.dev/docs/api/class-page) — deterministic screenshots, diagnostics, evaluation, and lifecycle tools.
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) and [W3C accessibility evaluation](https://www.w3.org/WAI/test-evaluate/) — axe integration and the requirement for human evaluation.
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12), [Ajv package](https://www.npmjs.com/package/ajv), and [Ajv standalone validation](https://ajv.js.org/standalone.html) — canonical schema draft and build-time standalone validator generation.
- [Python `jsonschema`](https://pypi.org/project/jsonschema/) — Draft 2020-12 support and current release.
- [Node 22 test runner](https://nodejs.org/download/release/latest-v22.x/docs/api/test.html) and [Node 22 performance hooks](https://nodejs.org/download/release/latest-v22.x/docs/api/perf_hooks.html) — Node 22 coverage/mocking and measurement APIs.
- [W3C Long Tasks API](https://www.w3.org/TR/longtasks-1/) and [User Timing](https://www.w3.org/TR/user-timing-3/) — browser performance instrumentation.
- [ESLint flat configuration](https://eslint.org/docs/latest/use/configure/configuration-files) and [Ruff configuration](https://docs.astral.sh/ruff/configuration/) — current static-analysis configuration models.
- [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), [dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review), [CodeQL default setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configure-code-scanning), and [artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) — immutable action pins, supply-chain gates, scanning, and release provenance.

---
*Stack research: 2026-08-31*
