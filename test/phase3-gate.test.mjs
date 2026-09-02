/**
 * The Phase-3 gate must fail closed.
 *
 * These tests seed the orchestrator's pure functions with evidence and command
 * graphs that are wrong in one specific way each, and require it to say so. A
 * gate that only passes when everything is right is untested; the useful
 * property is that it refuses everything else.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  LEAF_SCRIPT,
  ORCHESTRATOR_TOOL,
  OUTER_SCRIPT,
  assertCommandGraph,
  buildCommandGraph,
  commandEdges,
  loadPhase3Plan,
  validatePhase3Evidence,
} from "../tools/verify-phase3.mjs";

/** The shape a healthy graph has: outer -> orchestrator -> leaf -> helpers. */
const HEALTHY_SCRIPTS = {
  [OUTER_SCRIPT]: `node ${ORCHESTRATOR_TOOL}`,
  [LEAF_SCRIPT]: "npm run validate:hacs-staging && npm run test:ha-artifacts && npm run verify:release && npm run test:release-acceptance",
  "validate:hacs-staging": "npm run stage:hacs && node tools/validate-hacs-staging.mjs",
  "stage:hacs": "node tools/stage-hacs-packages.mjs",
  "test:ha-artifacts": "node tools/test-ha-artifacts.mjs",
  "verify:release": "node tools/verify-release.mjs",
  "test:release-acceptance": "node tools/verify-release-acceptance.mjs",
};

const HEALTHY_TOOLS = { [ORCHESTRATOR_TOOL]: "" };

function graphOf(scripts, tools = HEALTHY_TOOLS, declared = undefined) {
  return buildCommandGraph({
    scripts,
    tools,
    declared: declared ?? { [`tool:${ORCHESTRATOR_TOOL}`]: [`script:${LEAF_SCRIPT}`] },
  });
}

function healthyPlan() {
  const commands = [
    { command: "npm test", id: "F2-02", name: "Node regression suites", owner: false },
    { command: "npm run test:phase3:release", id: "T3-14", name: "Exact artifacts", owner: true },
  ];
  const mapping = (evidence) => ({ evidence, text: "seeded" });
  return {
    assumptions: { A1: mapping(["T3-14"]) },
    commands,
    plans: { "02-17": mapping(["T3-14"]) },
    requirements: { "SEC-01": mapping(["F2-02", "T3-14"]) },
    roadmap: { "RC2-1": mapping(["F2-02"]) },
    threats: { "T3-14": mapping(["T3-14"]) },
  };
}

function healthyResults() {
  return {
    "F2-02": {
      command: "npm test",
      exit_code: 0,
      output_sha256: "a".repeat(64),
      passed: true,
      skipped: false,
      test_count: 125,
    },
    "T3-14": {
      command: "npm run test:phase3:release",
      exit_code: 0,
      output_sha256: "b".repeat(64),
      passed: true,
      skipped: false,
      test_count: 4,
    },
  };
}

// ---------------------------------------------------------------------------
// Command graph
// ---------------------------------------------------------------------------

test("a healthy graph reaches the T3-14 leaf exactly once", () => {
  assert.deepEqual(assertCommandGraph(graphOf(HEALTHY_SCRIPTS)), { paths: 1, verified: true });
});

test("a command named in prose is advice, not an edge", () => {
  assert.deepEqual(commandEdges('throw new Error("stale; run npm run build")', "source"), []);
  assert.deepEqual(commandEdges('const command = "npm run build";', "source"), ["script:build"]);
  // A package script is a shell command all the way through, so position in it
  // carries no meaning and every reference counts.
  assert.deepEqual(commandEdges("echo x && npm run build", "script"), ["script:build"]);
});

test("a comment documenting a CLI is not a self-call", () => {
  assert.deepEqual(commandEdges('/* CLI: node tools/x.mjs <args> */', "source"), []);
  assert.deepEqual(commandEdges('// see "npm run build"\nconst a = 1;', "source"), []);
});

test("the outer command calling itself is refused", () => {
  const graph = graphOf({ ...HEALTHY_SCRIPTS, [OUTER_SCRIPT]: `node ${ORCHESTRATOR_TOOL} && npm run ${OUTER_SCRIPT}` });
  assert.throws(() => assertCommandGraph(graph), /cyclic/);
});

test("the leaf calling the outer command is refused", () => {
  const graph = graphOf({
    ...HEALTHY_SCRIPTS,
    [LEAF_SCRIPT]: `${HEALTHY_SCRIPTS[LEAF_SCRIPT]} && npm run ${OUTER_SCRIPT}`,
  });
  assert.throws(() => assertCommandGraph(graph), /cyclic/);
});

test("a helper reachable from the leaf calling back is refused", () => {
  const graph = graphOf({
    ...HEALTHY_SCRIPTS,
    "test:release-acceptance": `node tools/verify-release-acceptance.mjs && npm run ${LEAF_SCRIPT}`,
  });
  assert.throws(() => assertCommandGraph(graph), /cyclic/);
});

test("a helper reachable from the leaf running the orchestrator tool is refused", () => {
  const graph = buildCommandGraph({
    scripts: { ...HEALTHY_SCRIPTS, "verify:release": `node tools/verify-release.mjs && node ${ORCHESTRATOR_TOOL}` },
    tools: HEALTHY_TOOLS,
    declared: { [`tool:${ORCHESTRATOR_TOOL}`]: [`script:${LEAF_SCRIPT}`] },
  });
  assert.throws(() => assertCommandGraph(graph), /cyclic|its own witness/);
});

test("two outer-to-leaf paths are refused", () => {
  // The release lanes would run twice, and the second run is not evidence of
  // anything the first did not already establish.
  const graph = graphOf({
    ...HEALTHY_SCRIPTS,
    [OUTER_SCRIPT]: `node ${ORCHESTRATOR_TOOL} && npm run ${LEAF_SCRIPT}`,
  });
  assert.throws(() => assertCommandGraph(graph), /exactly once; found 2 paths/);
});

test("a missing leaf leaves T3-14 unowned", () => {
  const scripts = { ...HEALTHY_SCRIPTS };
  delete scripts[LEAF_SCRIPT];
  assert.throws(() => assertCommandGraph(graphOf(scripts)), /is not defined|found 0 paths/);
});

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

test("complete current evidence verifies", () => {
  assert.deepEqual(validatePhase3Evidence(healthyPlan(), healthyResults()), { verified: true });
});

test("missing evidence fails closed", () => {
  const results = healthyResults();
  delete results["T3-14"];
  assert.throws(() => validatePhase3Evidence(healthyPlan(), results), /missing command result: T3-14/);
});

test("a failed command fails closed", () => {
  const results = healthyResults();
  results["T3-14"] = { ...results["T3-14"], exit_code: 1, passed: false };
  assert.throws(() => validatePhase3Evidence(healthyPlan(), results), /command failed: T3-14/);
});

test("a skipped command fails closed", () => {
  const results = healthyResults();
  results["F2-02"] = { ...results["F2-02"], skipped: true };
  assert.throws(() => validatePhase3Evidence(healthyPlan(), results), /skipped: F2-02/);
});

test("a run that asserted nothing fails closed", () => {
  const results = healthyResults();
  results["F2-02"] = { ...results["F2-02"], test_count: 0 };
  assert.throws(() => validatePhase3Evidence(healthyPlan(), results), /zero tests recorded: F2-02/);
});

test("evidence recorded for a different command is stale", () => {
  const results = healthyResults();
  results["F2-02"] = { ...results["F2-02"], command: "npm test -- --only=fast" };
  assert.throws(() => validatePhase3Evidence(healthyPlan(), results), /stale command result: F2-02/);
});

test("evidence with no output hash fails closed", () => {
  const results = healthyResults();
  results["F2-02"] = { ...results["F2-02"], output_sha256: "not-a-hash" };
  assert.throws(() => validatePhase3Evidence(healthyPlan(), results), /output hash missing: F2-02/);
});

test("a mapping that points at evidence nobody runs fails closed", () => {
  const plan = healthyPlan();
  plan.requirements["SEC-01"].evidence = ["F2-02", "T2-99"];
  assert.throws(() => validatePhase3Evidence(plan, healthyResults()), /references missing evidence T2-99/);
});

test("an unmapped requirement, plan, roadmap truth or assumption fails closed", () => {
  for (const kind of ["assumptions", "plans", "requirements", "roadmap"]) {
    const plan = healthyPlan();
    const [id] = Object.keys(plan[kind]);
    plan[kind][id].evidence = [];
    assert.throws(() => validatePhase3Evidence(plan, healthyResults()), new RegExp(`${id} .* is unmapped`), kind);
  }
});

test("a command nothing maps to fails closed", () => {
  // An orphan command is evidence for nothing, and a gate that runs it anyway
  // is spending time to prove a claim nobody made.
  const plan = healthyPlan();
  plan.commands.push({ command: "npm run lint", id: "F2-99", name: "Orphan", owner: false });
  const results = { ...healthyResults(), "F2-99": {
    command: "npm run lint",
    exit_code: 0,
    output_sha256: "c".repeat(64),
    passed: true,
    skipped: false,
    test_count: 1,
  } };
  assert.throws(() => validatePhase3Evidence(plan, results), /command evidence is unmapped: F2-99/);
});

// ---------------------------------------------------------------------------
// The real repository
// ---------------------------------------------------------------------------

test("the repository plan binds every threat, plan, requirement and assumption", async () => {
  const plan = await loadPhase3Plan({});
  assert.equal(plan.owner_commands.length, 14);
  assert.equal(Object.keys(plan.threats).length, 14);
  assert.equal(Object.keys(plan.plans).length, 17);
  assert.deepEqual(Object.keys(plan.requirements).sort(), ["MAP-01", "OPS-01", "PROF-01", "PROTO-01", "SEM-01"]);
  assert.equal(Object.keys(plan.roadmap).length, 5);
  assert.deepEqual(Object.keys(plan.assumptions).sort(),
    ["HIERARCHY", "NO_AUTO_BIND", "NO_NAME_INFERENCE", "NO_PROFILE_EFFECT", "TRUST_OVER_ACTIVITY", "VOCABULARY"]);
  for (const item of Object.values(plan.roadmap)) assert.ok(item.text, "a roadmap truth has no text");
  for (const item of Object.values(plan.plans)) assert.ok(item.text, "a plan has no text");
});

test("the repository command graph is acyclic and reaches the leaf once", async () => {
  const plan = await loadPhase3Plan({});
  assert.deepEqual(assertCommandGraph(plan.graph), { paths: 1, verified: true });
});

test("every command in the repository plan is unique", async () => {
  const plan = await loadPhase3Plan({});
  const commands = plan.commands.map(({ command }) => command);
  assert.equal(new Set(commands).size, commands.length);
});
