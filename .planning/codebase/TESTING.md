# Testing Patterns

**Analysis Date:** 2026-08-31

## Test Framework

**Runner:**
- Node.js built-in test runner (Node 22 in CI)
- Config: No separate config file; test discovery is defined by `package.json` scripts (`node --test test/*.test.mjs`).

**Assertion Library:**
- `node:assert/strict`, imported as `assert` in every file under `test/`.

**Run Commands:**
```bash
npm test              # Run all test/*.test.mjs files
npm run test:v1       # Run only test/v100-*.test.mjs
npm run check         # Syntax-check the generated dist/glt-flow-card.js
```

- Python has no unit-test runner configured. `.github/workflows/build-v1.yml` performs `python -m py_compile custom_components/glt_flow_card/*.py` as a syntax gate.
- Use `npm install --ignore-scripts` in the general validation workflow (`.github/workflows/validate.yml`) and `npm ci --ignore-scripts` in the v1 build workflow (`.github/workflows/build-v1.yml`).

## Test File Organization

**Location:**
- Keep all JavaScript tests in the separate top-level `test/` directory rather than co-locating them with implementation files.
- Group suites by shipped layer: generated runtime smoke coverage in `test/smoke.test.mjs`, v0.4 source-contract coverage in `test/v040.test.mjs`, v1 pure-core behavior in `test/v100-core.test.mjs`, and Companion source-contract coverage in `test/v100-backend.test.mjs`.

**Naming:**
- Use `<scope>.test.mjs` for general suites and `<release>-<scope>.test.mjs` for release-specific suites.
- Keep the `v100-` prefix for tests included by `npm run test:v1` and by the path filters in `.github/workflows/build-v1.yml`.

**Structure:**
```text
test/
├── smoke.test.mjs          # Generated browser bundle registration/feature tokens
├── v040.test.mjs           # Concatenated v0.4 extension source contract
├── v100-core.test.mjs      # Direct behavioral tests of pure ES modules
└── v100-backend.test.mjs   # Python Companion source contract/config-flow tokens
```

## Test Structure

**Suite Organization:**
```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { ensureV1, deriveOperationalState } from "../src/v100/core.mjs";

test("operational-state precedence puts faults before normal running", () => {
  const now = Date.now();
  const states = {
    "binary_sensor.run": {
      state: "on",
      last_updated: new Date(now).toISOString(),
      attributes: {},
    },
    "binary_sensor.fault": {
      state: "on",
      last_updated: new Date(now).toISOString(),
      attributes: {},
    },
  };
  const item = {
    state_entity: "binary_sensor.run",
    state_model: { fault: "binary_sensor.fault" },
  };
  assert.equal(deriveOperationalState(item, states, { now }).code, "fault");
});
```

This follows the direct-import, arrange/act/assert style used in `test/v100-core.test.mjs`.

**Patterns:**
- Define tests directly with `test(name, callback)`; there are no nested `describe` blocks or shared lifecycle hooks.
- Build compact fixtures inside each test so the requirement and inputs remain visible, as in the state maps and equipment arrays in `test/v100-core.test.mjs`.
- Assert exact scalar results with `assert.equal`, collection/condition invariants with `assert.ok`, and generated-source patterns with `assert.match`.
- For feature-presence contracts, iterate a list of required tokens and include the missing token in the assertion message, following `test/smoke.test.mjs`, `test/v040.test.mjs`, and `test/v100-backend.test.mjs`.
- Test meaningful domain invariants rather than implementation steps: fault precedence, entity scoring, orthogonal routing, scale at 2,000 objects, aggregation/deadband, nested diffs, and project-bundle round trips in `test/v100-core.test.mjs`.
- Keep tests deterministic by injecting `now` where age/precedence matters and by constructing timestamps from that value, as in `test/v100-core.test.mjs`.

## Mocking

**Framework:** Not used. No Sinon, Jest mocks, Node test mocks, or Home Assistant test harness is configured.

**Patterns:**
```javascript
const states = {
  "sensor.hp_flow_temp": {
    state: "42.1",
    attributes: {
      friendly_name: "Wärmepumpe Vorlauf",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
};

const result = autoMapEquipment(
  { name: "Wärmepumpe", profile: "heat_pump" },
  states,
);
assert.equal(result.suggestions.flow_temp[0].entity_id, "sensor.hp_flow_temp");
```

- Use plain objects as Home Assistant state doubles, following `test/v100-core.test.mjs`.
- Use temporary in-memory values and pure-module calls instead of mocking filesystem, browser, or network APIs whenever logic can be tested through `src/v100/core.mjs`.
- Source-contract tests read real repository artifacts with `node:fs/promises`; they do not stub file reads.

**What to Mock:**
- Mock Home Assistant state maps with minimal `{ state, last_updated, attributes }` objects when testing pure mapping, diagnostics, energy, or operational-state functions from `src/v100/core.mjs`.
- For future browser unit tests, stub only the narrow `hass` surface consumed by the code (`states`, `user`, `callWS`, `callService`) rather than constructing a full Home Assistant frontend.
- For future Python tests, use Home Assistant's pytest fixtures for `hass`, config entries, WebSocket clients, and storage instead of hand-rolled framework internals; no such harness exists in the repository yet.

**What NOT to Mock:**
- Do not mock pure functions in `src/v100/core.mjs`; import and exercise them directly.
- Do not mock generated artifacts in smoke tests. Read `dist/glt-flow-card.js` or `custom_components/glt_flow_card/www/glt-flow-card.js` so the test validates what users install.
- Do not mock catalog arrays when validating catalog size/profile behavior; import `SYMBOL_VARIANTS` and `COMPONENT_PROFILES` from `src/v100/catalog.mjs`.

## Fixtures and Factories

**Test Data:**
```javascript
const equipment = Array.from({ length: 2000 }, (_, i) => ({
  id: `eq_${i}`,
  name: `Equipment ${i}`,
  x: (i % 50) * 30,
  y: Math.floor(i / 50) * 30,
  entity: `sensor.eq_${i}`,
}));

const states = Object.fromEntries(equipment.map((item, i) => [
  item.entity,
  {
    state: String(i),
    last_updated: new Date().toISOString(),
    attributes: { unit_of_measurement: "°C" },
  },
]));
```

This programmatic fixture pattern comes from `test/v100-core.test.mjs` and avoids committing large static data files.

**Location:**
- No shared fixtures or factories directory exists.
- Keep one-off fixtures inline in their test. Extract a helper within the same test file when three or more cases repeat the same setup; create `test/fixtures/` only when real serialized project/YAML fixtures are needed across multiple suites.
- Example YAML configurations under `examples/` are documentation inputs, not currently test fixtures. If tests consume them, read them by repository-relative URL and state the contract explicitly.

## Coverage

**Requirements:** None enforced. No coverage provider, threshold, or report configuration is present in `package.json` or `.github/workflows/`.

**View Coverage:**
```bash
# Not configured. Add a Node-compatible coverage command before relying on a report.
```

- Current CI gates execution and syntax, not line/branch coverage: `.github/workflows/validate.yml` runs `npm run check` and `npm test`.
- When coverage is introduced, prioritize branch coverage for `src/v100/core.mjs` and handler/error paths in `custom_components/glt_flow_card/__init__.py`; generated bundles should not drive coverage targets.

## Test Types

**Unit Tests:**
- Direct unit coverage exists for pure engineering functions in `src/v100/core.mjs` through `test/v100-core.test.mjs`.
- Tests cover representative success paths and invariants for state derivation, auto-mapping, routing, diagnostics, aggregation, diffs, and serialization.
- Add edge and failure cases beside these tests when changing normalization, route collision, invalid bundle, unit conversion, or missing-state behavior.

**Integration Tests:**
- Lightweight build/source contract tests exist in `test/smoke.test.mjs`, `test/v040.test.mjs`, and `test/v100-backend.test.mjs`. They verify required registrations and feature strings but do not execute a browser or Home Assistant runtime.
- `.github/workflows/build-v1.yml` bundles `src/v100/entry.js`, runs generation tools, executes tests, compiles Python, and checks generated artifact tokens. This is the main cross-artifact integration gate.
- No executable tests currently exercise `GltStore`, WebSocket handlers, permissions, locks, alarm transitions, schedules, remote sites, or persistence in `custom_components/glt_flow_card/__init__.py`. Add Home Assistant integration tests before modifying those workflows substantially.

**E2E Tests:**
- No automated E2E test suite is run by `npm test` or CI.
- `tools/capture-screenshots.mjs` uses Playwright to open a served UI, switch themes, and capture screenshots, but Playwright is not declared in `package.json` and the script contains no assertions. Treat it as a manual visual-artifact tool, not an E2E gate.
- `.github/workflows/screenshots.yml` automates screenshot generation separately; visual correctness still requires inspection because image assertions are not present.

## Common Patterns

**Async Testing:**
```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("generated bundle contains its registration", async () => {
  const source = await readFile(
    new URL("../dist/glt-flow-card.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /customElements\.define\(CARD_TYPE, GltFlowCard\)/);
});
```

- Existing source-contract suites perform their top-level file reads before declaring tests (`test/smoke.test.mjs`, `test/v100-backend.test.mjs`). For new isolated I/O cases, prefer an async test callback so read failures are attributed to the specific test.
- Pure-core tests remain synchronous; do not make them async without an awaited operation.

**Error Testing:**
```javascript
test("invalid project bundles are rejected", () => {
  assert.throws(
    () => readProjectBundle("not-a-valid-bundle"),
    /invalid|project|bundle/i,
  );
});
```

- No explicit `assert.throws` or rejection tests exist yet. Use `assert.throws` for synchronous parsers and `assert.rejects` for async operations when adding failure-path coverage.
- Assert both the error class/shape and stable semantic text or error code. For the Python Companion, target protocol codes such as `revision_conflict`, permission failures, and invalid domains exposed by `custom_components/glt_flow_card/__init__.py`, not incidental full messages.
- For browser fallbacks, test the resulting safe state or UI message rather than asserting console output.

---

*Testing analysis: 2026-08-31*
