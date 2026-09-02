/**
 * Mutation tests for the controlled-RED classifier.
 *
 * Each case spawns a deterministic fake command whose stdout, stderr and exit
 * code are fully controlled, so the classifier is proven against the exact
 * output shapes pytest, the Node test runner and Playwright produce - without
 * running any real suite.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { EXPECTED_RED, classify, collectFailures } from "../tools/assert-red.mjs";

const CLASSIFIER = fileURLToPath(new URL("../tools/assert-red.mjs", import.meta.url));
const EMITTER = fileURLToPath(new URL("./fixtures/red-emitter.mjs", import.meta.url));

const PYTHON_KEY = "phase2-policy-matrix";
const NODE_KEY = "phase2-authority-reducers";

function pytestRed(key, { marker, evidence, identity } = {}) {
  const entry = EXPECTED_RED[key];
  return [
    "============================= test session starts =============================",
    "collected 4 items",
    "",
    `${evidence ?? entry.evidence}{"services": 0, "stores": 0}`,
    `${marker ?? entry.marker}`,
    "",
    "=========================== short test summary info ============================",
    `FAILED ${identity ?? entry.identity}`,
    "1 failed, 3 passed in 0.42s",
  ].join("\n");
}

function nodeRed(key, { marker, evidence, identity } = {}) {
  const entry = EXPECTED_RED[key];
  return [
    "TAP version 13",
    `# ${evidence ?? entry.evidence}{"service": 0, "network": 0}`,
    `# ${marker ?? entry.marker}`,
    `not ok 1 - ${identity ?? entry.identity} fail-closed authority reducers`,
    "1..3",
    "# tests 3",
    "# pass 2",
    "# fail 1",
    "# skipped 0",
  ].join("\n");
}

function runClassifier(expected, { stdout = "", stderr = "", code = 1, signal = "" } = {}) {
  const args = [
    CLASSIFIER,
    `--expected=${expected}`,
    "--",
    process.execPath,
    EMITTER,
    `--code=${code}`,
    `--signal=${signal}`,
    `--stdout=${Buffer.from(stdout, "utf8").toString("base64")}`,
    `--stderr=${Buffer.from(stderr, "utf8").toString("base64")}`,
  ];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { ...result, combined: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

test("registry binds one marker, evidence prefix and naming-rule identity per key", () => {
  for (const [key, entry] of Object.entries(EXPECTED_RED)) {
    assert.ok(entry.marker.startsWith(`EXPECTED_RED[${key}]: `), `${key} marker`);
    assert.ok(entry.evidence.endsWith(" "), `${key} evidence prefix keeps its separator`);
    // The identity rule applies to every generated phase entry. It was scoped
    // to phase2- when only Phase 2 used the helpers; Phases 3 and 4 use the
    // same ones, so an entry that quietly stopped conforming would have gone
    // unnoticed.
    if (!/^phase[234]-/.test(key)) continue;
    if (entry.runtime === "python") {
      assert.ok(
        entry.identity.endsWith(`::test_expected_red_${key.replaceAll("-", "_")}`),
        `${key} pytest sentinel identity`,
      );
    } else {
      assert.equal(entry.identity, `[expected-red:${key}]`, `${key} node sentinel identity`);
    }
  }
  const markers = Object.values(EXPECTED_RED).map((entry) => entry.marker);
  assert.equal(new Set(markers).size, markers.length, "markers are unique");
  const countFor = (prefix) => Object.keys(EXPECTED_RED).filter((key) => key.startsWith(prefix)).length;
  assert.equal(countFor("phase2-"), 12, "all twelve Phase-2 registry entries exist");
  assert.equal(countFor("phase3-"), 7, "all seven Phase-3 registry entries exist");
  assert.equal(countFor("phase4-"), 10, "all ten Phase-4 registry entries exist");
});

test("accepts the exact named sentinel with its effect-ledger evidence", () => {
  const python = runClassifier(PYTHON_KEY, { stdout: pytestRed(PYTHON_KEY) });
  assert.equal(python.status, 0, python.combined);
  assert.match(python.combined, new RegExp(`CONTROLLED_RED\\[${PYTHON_KEY}\\]`));

  const node = runClassifier(NODE_KEY, { stdout: nodeRed(NODE_KEY) });
  assert.equal(node.status, 0, node.combined);
  assert.match(node.combined, new RegExp(`CONTROLLED_RED\\[${NODE_KEY}\\]`));
});

const REJECTIONS = [
  ["a passing command", { stdout: pytestRed(PYTHON_KEY), code: 0 }, /unexpectedly passed/],
  ["a non-assertion exit code", { stdout: pytestRed(PYTHON_KEY), code: 2 }, /exited 2/],
  ["a missing marker", { stdout: pytestRed(PYTHON_KEY, { marker: "EXPECTED_RED[other]: nope" }) }, /missing named RED marker/],
  ["a missing effect ledger", { stdout: pytestRed(PYTHON_KEY, { evidence: "UNRELATED_EFFECTS " }) }, /missing required RED evidence/],
  ["a different registry marker", {
    stdout: `${pytestRed(PYTHON_KEY)}\n${EXPECTED_RED["phase2-leases"].marker}`,
  }, /different RED marker/],
  ["an unrelated failing test", {
    stdout: pytestRed(PYTHON_KEY).replace(
      `FAILED ${EXPECTED_RED[PYTHON_KEY].identity}`,
      `FAILED ${EXPECTED_RED[PYTHON_KEY].identity}\nFAILED tests/components/glt_flow_card/test_init.py::test_other`,
    ),
  }, /unrelated failing test/],
  ["a wrong sentinel identity", {
    stdout: pytestRed(PYTHON_KEY, {
      identity: "tests/components/glt_flow_card/test_policy.py::test_expected_red_phase2_leases",
    }),
  }, /unrelated failing test/],
  ["a collection error", {
    stdout: `${pytestRed(PYTHON_KEY)}\nModuleNotFoundError: No module named 'policy'`,
  }, /harness failure/],
  ["a syntax error", { stdout: `${pytestRed(PYTHON_KEY)}\nSyntaxError: invalid syntax` }, /harness failure/],
  ["a browser launch failure", {
    stdout: `${nodeRed(NODE_KEY)}\nbrowserType.launch: Executable doesn't exist`,
  }, /harness failure/, NODE_KEY],
  ["a test timeout", { stdout: `${nodeRed(NODE_KEY)}\nTest timeout of 30000ms exceeded.` }, /harness failure/, NODE_KEY],
  ["a prohibited effect", {
    stdout: `${nodeRed(NODE_KEY)}\nPROHIBITED_EFFECT[service]: {"domain":"light"}`,
  }, /harness failure/, NODE_KEY],
  ["a setup error", { stdout: `${pytestRed(PYTHON_KEY)}\nERROR at setup of test_thing` }, /harness failure/],
  ["a zero-test run", {
    stdout: pytestRed(PYTHON_KEY).replace("collected 4 items", "collected 0 items"),
  }, /zero-test run/],
  ["a skipped test", {
    stdout: pytestRed(PYTHON_KEY).replace("1 failed, 3 passed", "1 failed, 2 passed, 1 skipped"),
  }, /skipped test/],
  ["a terminating signal", { stdout: pytestRed(PYTHON_KEY), signal: "SIGTERM", code: 1 }, /signal/],
];

for (const [name, options, pattern, key = PYTHON_KEY] of REJECTIONS) {
  test(`rejects ${name}`, () => {
    const result = runClassifier(key, options);
    assert.equal(result.status, 1, result.combined);
    assert.match(result.combined, /RED_CLASSIFICATION_FAILED\[/);
    assert.match(result.combined, pattern);
  });
}

test("rejects an unknown registry key before running anything", () => {
  const result = spawnSync(
    process.execPath,
    [CLASSIFIER, "--expected=not-a-registry-key", "--", process.execPath, "-e", "0"],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}`, /unknown expected RED name/);
});

test("collects failing identities from pytest, TAP and Playwright output shapes", () => {
  assert.deepEqual(collectFailures("FAILED tests/x.py::test_a\n"), ["tests/x.py::test_a"]);
  assert.deepEqual(collectFailures("not ok 3 - [expected-red:phase2-ui] title\n"), [
    "[expected-red:phase2-ui] title",
  ]);
  assert.deepEqual(
    collectFailures("  1) project-authority.spec.mjs:9:3 › [expected-red:phase2-ui] renders\n"),
    ["project-authority.spec.mjs:9:3 › [expected-red:phase2-ui] renders"],
  );
});

test("classify() is a pure function over a captured result", () => {
  const entry = EXPECTED_RED[NODE_KEY];
  assert.equal(classify(NODE_KEY, { code: 1, signal: null, output: nodeRed(NODE_KEY) }), null);
  assert.match(
    classify(NODE_KEY, { code: 1, signal: null, output: entry.marker }),
    /missing required RED evidence/,
  );
});
