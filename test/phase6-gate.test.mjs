/**
 * The Phase-6 gate must fail closed.
 *
 * These tests seed the orchestrator's pure functions with evidence, registers
 * and command graphs that are wrong in one specific way each, and require it to
 * say so. A gate that only passes when everything is right is untested; the
 * useful property is that it refuses everything else.
 *
 * Three of these exist because Phase 5's gate was generated from Phase 4's and
 * shipped exactly those three bugs -- both roadmap slice bounds collapsed onto
 * one heading, a plan regex still matching the previous phase, and a threat
 * count that disagreed with the register. Each was a literal that should have
 * been a derivation, so each derivation is mutated here.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  LEAF_SCRIPT,
  ORCHESTRATOR_TOOL,
  OUTER_SCRIPT,
  PHASE,
  PHASE_DIR,
  PHASE_SLUG,
  PLAN_LINE_PATTERN,
  ROADMAP_SLICE_END,
  ROADMAP_SLICE_START,
  THREAT_PREFIX,
  assertCommandGraph,
  buildCommandGraph,
  commandEdges,
  loadPhase6Plan,
  readThreatRows,
  validatePhase6Evidence,
} from "../tools/verify-phase6.mjs";

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
    { command: "npm test", id: "F6-02", name: "Node regression suites", owner: false },
    { command: `npm run ${LEAF_SCRIPT}`, id: "T6-21", name: "Exact artifacts", owner: true },
  ];
  const mapping = (evidence) => ({ evidence, text: "seeded" });
  return {
    assumptions: { ONE_EVALUATOR: mapping(["T6-21"]) },
    commands,
    plans: { "06-20": mapping(["T6-21"]) },
    requirements: { "ALM-01": mapping(["F6-02", "T6-21"]) },
    roadmap: { "RC6-1": mapping(["F6-02"]) },
    threats: { "T6-21": mapping(["T6-21"]) },
  };
}

function healthyResults() {
  return {
    "F6-02": {
      command: "npm test",
      exit_code: 0,
      output_sha256: "a".repeat(64),
      passed: true,
      skipped: false,
      test_count: 125,
    },
    "T6-21": {
      command: `npm run ${LEAF_SCRIPT}`,
      exit_code: 0,
      output_sha256: "b".repeat(64),
      passed: true,
      skipped: false,
      test_count: 4,
    },
  };
}

/** A minimal well-formed register: n contiguous rows, the last owning the leaf. */
function registerOf(count, { renumber = null, command = null } = {}) {
  const header = "| ID | STRIDE | Abuse case | Owner plan | Blocking evidence | Status |\n|---|---|---|---|---|---|\n";
  const rows = [];
  for (let index = 1; index <= count; index += 1) {
    const id = renumber?.(index) ?? `${THREAT_PREFIX}-${String(index).padStart(2, "0")}`;
    const owner = index === count
      ? `npm run ${LEAF_SCRIPT}`
      : (command?.(index) ?? `node --test test/seeded-${index}.test.mjs`);
    rows.push(`| ${id} | Tampering | seeded abuse case ${index} | ${PHASE_SLUG}-01 | \`${owner}\` | ⏳ planned |`);
  }
  return header + rows.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Command graph
// ---------------------------------------------------------------------------

test("a healthy graph reaches the release leaf exactly once", () => {
  assert.deepEqual(assertCommandGraph(graphOf(HEALTHY_SCRIPTS)), { paths: 1, verified: true });
});

test("a command named in prose is advice, not an edge", () => {
  assert.deepEqual(commandEdges('throw new Error("stale; run npm run build")', "source"), []);
  assert.deepEqual(commandEdges('const command = "npm run build";', "source"), ["script:build"]);
  assert.deepEqual(commandEdges("echo x && npm run build", "script"), ["script:build"]);
});

test("a comment documenting a CLI is not a self-call", () => {
  assert.deepEqual(commandEdges("/* CLI: node tools/x.mjs <args> */", "source"), []);
  assert.deepEqual(commandEdges('// see "npm run build"\nconst a = 1;', "source"), []);
});

test("the outer command calling itself is refused", () => {
  const graph = graphOf({
    ...HEALTHY_SCRIPTS,
    [OUTER_SCRIPT]: `node ${ORCHESTRATOR_TOOL} && npm run ${OUTER_SCRIPT}`,
  });
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
    scripts: {
      ...HEALTHY_SCRIPTS,
      "verify:release": `node tools/verify-release.mjs && node ${ORCHESTRATOR_TOOL}`,
    },
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

test("a missing leaf leaves the release threat unowned", () => {
  const scripts = { ...HEALTHY_SCRIPTS };
  delete scripts[LEAF_SCRIPT];
  assert.throws(() => assertCommandGraph(graphOf(scripts)), /is not defined|found 0 paths/);
});

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

test("complete current evidence verifies", () => {
  assert.deepEqual(validatePhase6Evidence(healthyPlan(), healthyResults()), { verified: true });
});

test("missing evidence fails closed", () => {
  const results = healthyResults();
  delete results["T6-21"];
  assert.throws(() => validatePhase6Evidence(healthyPlan(), results), /missing command result: T6-21/);
});

test("a failed command fails closed", () => {
  const results = healthyResults();
  results["T6-21"] = { ...results["T6-21"], exit_code: 1, passed: false };
  assert.throws(() => validatePhase6Evidence(healthyPlan(), results), /command failed: T6-21/);
});

test("a skipped command fails closed", () => {
  const results = healthyResults();
  results["F6-02"] = { ...results["F6-02"], skipped: true };
  assert.throws(() => validatePhase6Evidence(healthyPlan(), results), /skipped: F6-02/);
});

test("a run that asserted nothing fails closed", () => {
  const results = healthyResults();
  results["F6-02"] = { ...results["F6-02"], test_count: 0 };
  assert.throws(() => validatePhase6Evidence(healthyPlan(), results), /zero tests recorded: F6-02/);
});

test("evidence recorded for a different command is stale", () => {
  const results = healthyResults();
  results["F6-02"] = { ...results["F6-02"], command: "npm test -- --only=fast" };
  assert.throws(() => validatePhase6Evidence(healthyPlan(), results), /stale command result: F6-02/);
});

test("evidence with no output hash fails closed", () => {
  const results = healthyResults();
  results["F6-02"] = { ...results["F6-02"], output_sha256: "not-a-hash" };
  assert.throws(() => validatePhase6Evidence(healthyPlan(), results), /output hash missing: F6-02/);
});

test("a mapping that points at evidence nobody runs fails closed", () => {
  const plan = healthyPlan();
  plan.requirements["ALM-01"].evidence = ["F6-02", "T6-99"];
  assert.throws(() => validatePhase6Evidence(plan, healthyResults()), /references missing evidence T6-99/);
});

test("an unmapped requirement, plan, roadmap truth or assumption fails closed", () => {
  for (const kind of ["assumptions", "plans", "requirements", "roadmap"]) {
    const plan = healthyPlan();
    const [id] = Object.keys(plan[kind]);
    plan[kind][id].evidence = [];
    assert.throws(() => validatePhase6Evidence(plan, healthyResults()), new RegExp(`${id} .* is unmapped`), kind);
  }
});

test("a command nothing maps to fails closed", () => {
  // An orphan command is evidence for nothing, and a gate that runs it anyway
  // is spending time to prove a claim nobody made.
  const plan = healthyPlan();
  plan.commands.push({ command: "npm run lint", id: "F6-99", name: "Orphan", owner: false });
  const results = { ...healthyResults(), "F6-99": {
    command: "npm run lint",
    exit_code: 0,
    output_sha256: "c".repeat(64),
    passed: true,
    skipped: false,
    test_count: 1,
  } };
  assert.throws(() => validatePhase6Evidence(plan, results), /command evidence is unmapped: F6-99/);
});

// ---------------------------------------------------------------------------
// The three derivations Phase 5 got wrong by inheriting a literal
// ---------------------------------------------------------------------------

test("the roadmap slice bounds are two distinct headings derived from the phase", () => {
  assert.equal(ROADMAP_SLICE_START, `### Phase ${PHASE}:`);
  assert.equal(ROADMAP_SLICE_END, `### Phase ${PHASE + 1}:`);
  assert.notEqual(ROADMAP_SLICE_START, ROADMAP_SLICE_END);
});

test("the plan regex matches this phase's plans and no other phase's", () => {
  const matching = `- [ ] ${PHASE_SLUG}-07-PLAN.md — seeded plan text`;
  const previous = `- [ ] ${String(PHASE - 1).padStart(2, "0")}-07-PLAN.md — seeded plan text`;
  const next = `- [ ] ${String(PHASE + 1).padStart(2, "0")}-07-PLAN.md — seeded plan text`;
  const matches = (line) => [...line.matchAll(new RegExp(PLAN_LINE_PATTERN.source, "gm"))];
  assert.equal(matches(matching).length, 1);
  assert.equal(matches(matching)[0][1], `${PHASE_SLUG}-07`);
  assert.equal(matches(previous).length, 0, "the previous phase's plans must not match");
  assert.equal(matches(next).length, 0, "the next phase's plans must not match");
});

test("the phase directory and threat prefix are derived, not written twice", () => {
  assert.ok(PHASE_DIR.startsWith(`.planning/phases/${PHASE_SLUG}-`));
  assert.equal(THREAT_PREFIX, `T${PHASE}`);
});

test("the threat count comes from the register, so any size is accepted", () => {
  // Phase 5 inherited `!== 16` from Phase 4 and had to be corrected. A literal
  // is not replaced by a different literal here: the register's own shape is
  // what is checked, so a register of any honest size loads.
  for (const count of [1, 5, 21, 40]) {
    assert.equal(readThreatRows(registerOf(count)).length, count, `count ${count}`);
  }
});

test("a gap in the threat numbering is refused", () => {
  // This is what replaces the count literal, and it is strictly stronger: a
  // register missing T6-07 entirely still has a plausible number of rows.
  const register = registerOf(5, {
    renumber: (index) => `${THREAT_PREFIX}-${String(index >= 3 ? index + 1 : index).padStart(2, "0")}`,
  });
  assert.throws(() => readThreatRows(register), /not contiguous/);
});

test("a duplicated threat id is refused", () => {
  const register = registerOf(4, { renumber: (index) => `${THREAT_PREFIX}-0${Math.min(index, 3)}` });
  assert.throws(() => readThreatRows(register), /declared twice|not contiguous/);
});

test("a threat row with no owner command is refused", () => {
  const register = registerOf(3).replace("`node --test test/seeded-1.test.mjs`", "none yet");
  assert.throws(() => readThreatRows(register), /carries no owner command/);
});

test("an empty register is refused rather than trivially satisfied", () => {
  assert.throws(() => readThreatRows("no table here\n"), /empty/);
});

// ---------------------------------------------------------------------------
// The real repository
// ---------------------------------------------------------------------------

test("the repository plan binds every threat, plan, requirement and assumption", async () => {
  const plan = await loadPhase6Plan({});
  assert.equal(Object.keys(plan.threats).length, plan.owner_commands.length);
  assert.equal(Object.keys(plan.plans).length, 20);
  assert.deepEqual(Object.keys(plan.requirements).sort(), ["ALM-01", "ALM-02", "SCH-01"]);
  assert.equal(Object.keys(plan.roadmap).length, 5);
  assert.deepEqual(Object.keys(plan.assumptions).sort(), [
    "DEFAULTS_REACH_NOBODY", "DELAY_IS_ANCHORED", "FAILURE_IS_RECORDED",
    "INSTANTS_NOT_WALL_CLOCK", "ONE_EVALUATOR", "RETENTION_IS_BOUNDED",
    "SUPPRESSION_IS_CONSULTED",
  ]);
  // The two bugs generating this gate from the previous phase's introduces,
  // checked rather than trusted: a roadmap slice whose bounds collapse onto one
  // heading yields an empty block, and a plan regex still matching the previous
  // phase yields no plans. Both would leave a gate that binds nothing and
  // passes.
  assert.match(plan.roadmap["RC6-1"].text, /hysteresis/);
  assert.match(plan.plans[`${PHASE_SLUG}-20`].text, /gate/);
  for (const item of Object.values(plan.roadmap)) assert.ok(item.text, "a roadmap truth has no text");
  for (const item of Object.values(plan.plans)) assert.ok(item.text, "a plan has no text");
  for (const item of Object.values(plan.threats)) assert.ok(item.text, "a threat has no text");
});

test("the release leaf owns exactly one threat, in both documents", async () => {
  const plan = await loadPhase6Plan({});
  const owners = plan.owner_commands.filter(({ command }) => command === `npm run ${LEAF_SCRIPT}`);
  assert.equal(owners.length, 1);
  assert.equal(owners[0].id, plan.leaf_threat);
});

test("the repository command graph is acyclic and reaches the leaf once", async () => {
  const plan = await loadPhase6Plan({});
  assert.deepEqual(assertCommandGraph(plan.graph), { paths: 1, verified: true });
});

test("every command in the repository plan is unique", async () => {
  const plan = await loadPhase6Plan({});
  const commands = plan.commands.map(({ command }) => command);
  assert.equal(new Set(commands).size, commands.length);
});
