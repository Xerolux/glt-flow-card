/* Execute and hash the complete Phase-7 behavioral evidence set.
 *
 * The gate answers one question: is every Phase-7 requirement, roadmap truth,
 * plan and threat bound, right now, to a command that actually ran, actually
 * passed, skipped nothing and asserted something? Anything less fails closed.
 *
 * It also proves its own shape. The command graph must be acyclic, the release
 * leaf must be reachable exactly once, and nothing reachable from that leaf may
 * call back into this orchestrator - otherwise the gate could pass by running
 * itself, which is the most convincing kind of nothing.
 *
 * Everything phase-specific is derived from PHASE, once. Phase 5's gate was
 * generated from Phase 4's and shipped three residual bugs -- both roadmap
 * slice bounds collapsed onto one heading, a plan regex still matching the
 * previous phase, and a threat count that disagreed with the register -- and
 * every one of those was a literal that should have been a derivation. The
 * mutation tests in test/phase8-gate.test.mjs check each derivation.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pythonCommand } from "./python-launcher.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The one place the phase number is written. Everything below derives from it. */
export const PHASE = 8;

/** Derived phase identifiers. No other literal names the phase. */
export const PHASE_SLUG = String(PHASE).padStart(2, "0");
export const THREAT_PREFIX = `T${PHASE}`;
export const PHASE_DIR = `.planning/phases/${PHASE_SLUG}-simulation-commissioning-assets`;
export const THREATS_FILE = `${PHASE_SLUG}-THREATS.md`;
export const VALIDATION_FILE = `${PHASE_SLUG}-VALIDATION.md`;
export const ROADMAP_SLICE_START = `### Phase ${PHASE}:`;
export const ROADMAP_SLICE_END = `### Phase ${PHASE + 1}:`;
export const THREAT_ROW_PATTERN = new RegExp(`^\\| ${THREAT_PREFIX}-\\d{2} \\|`);
export const THREAT_ID_PATTERN = new RegExp(`^${THREAT_PREFIX}-\\d{2}$`);
export const PLAN_LINE_PATTERN = new RegExp(
  `^- \\[[ x]\\] (${PHASE_SLUG}-\\d{2})-PLAN\\.md — (.+)$`,
  "gm",
);
export const OUTER_SCRIPT = `test:phase${PHASE}`;
export const ORCHESTRATOR_TOOL = `tools/verify-phase${PHASE}.mjs`;
export const LEAF_SCRIPT = `test:phase${PHASE}:release`;
const DEFAULT_OUTPUT = `.planning/tmp/phase${PHASE}-evidence.json`;

/** Commands that are not a threat owner but must still be current and green. */
const FOCUSED_COMMANDS = [
  [`F${PHASE}-01`, "Canonical build from authored modules", "npm run build"],
  [`F${PHASE}-02`, "Node regression suites", "npm test"],
  [`F${PHASE}-03`, "Companion suite", "npm run test:python"],
  [`F${PHASE}-04`, "Exact-dist browser suites", "npm run test:e2e"],
  [`F${PHASE}-05`, "Complete sources and deterministic documentation site", "node tools/verify-docs-site.mjs"],
  // The previous phase gate stays mandatory: a Phase-8 claim resting on Phase-7
  // guarantees nobody re-ran is resting on nothing.
  [`F${PHASE}-06`, `Phase-${PHASE - 1} gate`, `npm run test:phase${PHASE - 1}`],
].map(([id, name, command]) => ({ command, id, name, owner: false }));

/** Requirement -> the evidence that must be current for it to count as met. */
const REQUIREMENT_EVIDENCE = {
  "SIM-01": [
    "T8-01", "T8-02", "T8-03", "T8-04", "T8-05",
    "T8-06", "T8-07", "T8-08", "T8-09",
  ],
  "DIAG-01": ["T8-10", "T8-11", "T8-12", "T8-13", "T8-14", "T8-15", "T8-16", "T8-17"],
  "ASSET-01": ["T8-18", "T8-19", "T8-20", "T8-21", "T8-22"],
};

/** Roadmap success criteria for Phase 8, in the order the roadmap states them. */
const ROADMAP_EVIDENCE = {
  "RC8-1": ["T8-01", "T8-02", "T8-03", "T8-04", "T8-06", "T8-07", "T8-09"],
  "RC8-2": ["T8-10", "T8-11", "T8-12", "T8-13", "T8-14", "T8-15", "T8-16"],
  "RC8-3": ["T8-18", "T8-19", "T8-20", "T8-21", "T8-22"],
  "RC8-4": ["T8-05", "T8-08", "T8-09", "T8-17"],
  "RC8-5": ["T8-07", "T8-14", "T8-23", "T8-24", "T8-25"],
};

/** Every plan in the phase, bound to the evidence its work is proven by. */
const PLAN_EVIDENCE = {
  "08-01": [`F${PHASE}-02`, `F${PHASE}-03`],
  "08-02": ["T8-03", "T8-19"],
  "08-03": ["T8-22"],
  "08-04": ["T8-07", "T8-08"],
  "08-05": ["T8-02", "T8-06"],
  "08-06": ["T8-01", "T8-02", "T8-04"],
  "08-07": ["T8-03"],
  "08-08": ["T8-05"],
  "08-09": ["T8-10", "T8-11", "T8-13"],
  "08-10": ["T8-12", "T8-15", "T8-16"],
  "08-11": ["T8-14", "T8-17"],
  "08-12": ["T8-18", "T8-19"],
  "08-13": ["T8-20"],
  "08-14": ["T8-09", "T8-23", "T8-24"],
  "08-15": ["T8-21"],
  "08-16": ["T8-25", `F${PHASE}-01`, `F${PHASE}-06`],
};

/**
 * The resolved assumptions, each bound to evidence that exercises it.
 *
 * A resolved assumption that no command touches is a decision nobody is
 * checking, which is how a bound becomes a suggestion.
 */
const ASSUMPTION_EVIDENCE = {
  SIMULATION_BLOCKS_PHYSICAL_DISPATCH: ["T8-01"],
  THE_GATE_IS_NOT_PROJECT_DATA: ["T8-02"],
  NO_DISPATCH_PATH_ESCAPES: ["T8-03"],
  UNKNOWN_STATE_REFUSES: ["T8-04"],
  NOTIFICATION_IS_MARKED_NOT_SILENCED: ["T8-05"],
  SCENARIOS_ARE_PURE: ["T8-07"],
  REFERENCES_ARE_DECLARED: ["T8-11"],
  COMMISSIONING_WRITES_NOTHING: ["T8-14"],
  RECORDS_ARE_APPEND_ONLY: ["T8-18"],
  IDS_ARE_CONTENT_DERIVED: ["T8-22"],
};

const ASSUMPTION_TEXTS = {
  SIMULATION_BLOCKS_PHYSICAL_DISPATCH: "While a simulation session is active, every path that can reach a physical service refuses at the point of dispatch; the block is server-side and the interface's promise is true.",
  THE_GATE_IS_NOT_PROJECT_DATA: "Simulation state is site runtime state the Companion owns; a project document can neither enable, disable, nor exempt itself from it.",
  NO_DISPATCH_PATH_ESCAPES: "Dispatch kinds are a closed enumeration and every declared path is exercised, so a gate placed only where somebody remembered fails the test.",
  UNKNOWN_STATE_REFUSES: "An unreadable simulation state refuses every physical kind, with a reason distinct from an ordinary simulated refusal.",
  NOTIFICATION_IS_MARKED_NOT_SILENCED: "A notification during a rehearsal is delivered and states that the plant was simulated; silencing it would be a safety defect in the other direction.",
  SCENARIOS_ARE_PURE: "A scenario is a pure function of definition and tick, reproducible byte for byte and evaluable for entities that do not exist yet.",
  REFERENCES_ARE_DECLARED: "Commissioning collects references from declared locations only and never by pattern-matching values, so it cannot invent a finding.",
  COMMISSIONING_WRITES_NOTHING: "A full diagnostic run produces an empty dispatch ledger, proven by execution rather than by inspection, and having produced findings.",
  RECORDS_ARE_APPEND_ONLY: "A work order is a sequence of entries; a correction is a new entry naming what it corrects, and status is derived from the entries.",
  IDS_ARE_CONTENT_DERIVED: "Record identity is derived from content through one shared helper both runtimes use, so a record is reproducible and cannot collide within a millisecond.",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function canonicalJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Command graph
// ---------------------------------------------------------------------------

function withoutComments(text) {
  // A tool that documents its own CLI in a comment is not calling itself. The
  // `[^:]` guard keeps `https://` from truncating a line that also carries a
  // real command.
  return String(text ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");
}

/**
 * Extract the commands one text actually executes.
 *
 * `mode: "script"` treats the whole text as a shell command, which a package
 * script is. `mode: "source"` requires the reference to start a string literal,
 * because a tool that names a command inside a sentence - "run npm run x" in an
 * error message - is giving advice, not spawning a process.
 */
export function commandEdges(text, mode = "script") {
  const edges = [];
  const source = withoutComments(text);
  const script = mode === "source" ? /["'`]npm run ([A-Za-z0-9:_-]+)/g : /npm run ([A-Za-z0-9:_-]+)/g;
  const tool = mode === "source"
    ? /["'`]node\s+(tools\/[A-Za-z0-9._-]+\.mjs)/g
    : /node\s+(tools\/[A-Za-z0-9._-]+\.mjs)/g;
  for (const match of source.matchAll(script)) edges.push(`script:${match[1]}`);
  for (const match of source.matchAll(tool)) edges.push(`tool:${match[1]}`);
  return edges;
}

export function buildCommandGraph({ scripts, tools, declared }) {
  const graph = new Map();
  for (const [name, body] of Object.entries(scripts ?? {})) {
    graph.set(`script:${name}`, commandEdges(body, "script"));
  }
  for (const [name, source] of Object.entries(tools ?? {})) {
    graph.set(`tool:${name}`, commandEdges(source, "source"));
  }
  for (const [node, edges] of Object.entries(declared ?? {})) {
    graph.set(node, [...new Set([...(graph.get(node) ?? []), ...edges])]);
  }
  return graph;
}

function reachable(graph, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop();
    for (const next of graph.get(node) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen;
}

function countPaths(graph, from, to, visiting = new Set()) {
  if (from === to) return 1;
  if (visiting.has(from)) return 0;
  visiting.add(from);
  let total = 0;
  for (const next of graph.get(from) ?? []) total += countPaths(graph, next, to, visiting);
  visiting.delete(from);
  return total;
}

function findCycle(graph) {
  const state = new Map();
  const stack = [];
  const walk = (node) => {
    if (state.get(node) === "done") return null;
    if (state.get(node) === "open") return [...stack.slice(stack.indexOf(node)), node];
    state.set(node, "open");
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = walk(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, "done");
    return null;
  };
  for (const node of graph.keys()) {
    const cycle = walk(node);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Refuse any graph in which the gate could run itself.
 *
 * Four distinct failures, because they fail in four distinct ways: a cycle
 * loops forever, a missing leaf means the release row is unowned, more than one
 * path means the release lanes run twice and the second run is not evidence,
 * and a back-edge from the leaf means the gate is its own witness.
 */
export function assertCommandGraph(graph) {
  const cycle = findCycle(graph);
  if (cycle) throw new Error(`command graph is cyclic: ${cycle.join(" -> ")}`);

  const outer = `script:${OUTER_SCRIPT}`;
  const leaf = `script:${LEAF_SCRIPT}`;
  if (!graph.has(outer)) throw new Error(`the outer command ${OUTER_SCRIPT} is not defined`);
  if (!graph.has(leaf)) throw new Error(`the release leaf ${LEAF_SCRIPT} is not defined`);

  const paths = countPaths(graph, outer, leaf);
  if (paths !== 1) {
    throw new Error(`${OUTER_SCRIPT} must reach ${LEAF_SCRIPT} exactly once; found ${paths} paths`);
  }

  const forbidden = new Set([outer, leaf, `tool:${ORCHESTRATOR_TOOL}`]);
  for (const node of reachable(graph, leaf)) {
    if (forbidden.has(node)) {
      throw new Error(`${LEAF_SCRIPT} reaches ${node}, so the gate would be its own witness`);
    }
  }
  return { paths, verified: true };
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function tableRows(markdown) {
  return markdown.split(/\r?\n/).filter((line) => /^\|/.test(line)).map((line) => (
    line.split("|").slice(1, -1).map((cell) => cell.trim())
  ));
}

function evidenceMap(texts, mapping) {
  return Object.fromEntries(Object.entries(mapping).map(([id, evidence]) => [id, {
    evidence,
    text: texts[id],
  }]));
}

/**
 * Read the canonical threat rows and check the register's own shape.
 *
 * The count is derived from the register rather than written here, so the two
 * cannot disagree the way Phase 5's inherited literal did. What replaces the
 * literal is a stronger claim: the ids must be contiguous from 01, unique, and
 * every row must carry an owner command. A register missing T8-07 entirely
 * would satisfy a count check written as a number; it cannot satisfy this one.
 */
export function readThreatRows(threatsMarkdown) {
  const rows = threatsMarkdown.split(/\r?\n/)
    .filter((line) => THREAT_ROW_PATTERN.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const command = [...cells[4].matchAll(/`([^`]+)`/g)].at(-1)?.[1];
      return { command, id: cells[0], name: cells[2], owner: true };
    });
  if (rows.length === 0) throw new Error("the canonical threat owner table is empty");
  if (rows.some(({ command }) => !command)) {
    throw new Error("a canonical threat row carries no owner command");
  }
  if (rows.some(({ id }) => !THREAT_ID_PATTERN.test(id))) {
    throw new Error(`a threat id does not belong to phase ${PHASE}`);
  }
  const ids = rows.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error("a threat id is declared twice");
  const expected = ids.map((_, index) => `${THREAT_PREFIX}-${String(index + 1).padStart(2, "0")}`);
  if (ids.join(",") !== expected.join(",")) {
    throw new Error(`threat ids are not contiguous from ${THREAT_PREFIX}-01: ${ids.join(", ")}`);
  }
  return rows;
}

export async function loadPhase7Plan(options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  const [threatsMarkdown, validationMarkdown, roadmapMarkdown, packageJson] = await Promise.all([
    readFile(path.join(root, PHASE_DIR, THREATS_FILE), "utf8"),
    readFile(path.join(root, PHASE_DIR, VALIDATION_FILE), "utf8"),
    readFile(path.join(root, ".planning/ROADMAP.md"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);

  const threatRows = readThreatRows(threatsMarkdown);
  const leafOwners = threatRows.filter(({ command }) => command === `npm run ${LEAF_SCRIPT}`);
  if (leafOwners.length !== 1) {
    throw new Error(`${LEAF_SCRIPT} must be the owner command of exactly one threat`);
  }
  const leafThreat = leafOwners[0].id;

  const commands = [];
  for (const command of [...FOCUSED_COMMANDS, ...threatRows]) {
    if (!commands.some((entry) => entry.command === command.command)) commands.push(command);
  }
  for (const owner of threatRows) {
    if (commands.filter(({ command }) => command === owner.command).length !== 1) {
      throw new Error(`${owner.id} owner command is not unique`);
    }
  }

  // The validation map and the threat register must describe the same phase.
  //
  // A validation row may group threats under one narrower command, so the check
  // is coverage, not string equality: every threat is verified somewhere, no
  // row invents one, and the release threat is owned by the leaf in both
  // documents.
  const validationRows = tableRows(validationMarkdown)
    .filter((cells) => cells.length === 6 && THREAT_ID_PATTERN.test(cells[1].split(",")[0].trim()));
  if (validationRows.length === 0) throw new Error("the validation requirement map is empty");
  const validated = new Set();
  for (const cells of validationRows) {
    const command = [...cells[4].matchAll(/`([^`]+)`/g)].at(-1)?.[1];
    for (const threat of cells[1].split(",").map((value) => value.trim())) {
      if (!threatRows.some(({ id }) => id === threat)) {
        throw new Error(`validation row references unknown threat ${threat}`);
      }
      if (threat === leafThreat && command !== `npm run ${LEAF_SCRIPT}`) {
        throw new Error(`the validation map must own ${leafThreat} with npm run ${LEAF_SCRIPT}`);
      }
      validated.add(threat);
    }
  }
  for (const { id } of threatRows) {
    if (!validated.has(id)) throw new Error(`${id} has no row in the validation map`);
  }

  // Two distinct headings, derived from PHASE. Generating this file from the
  // previous phase's orchestrator collapses both bounds onto the same string,
  // which yields an empty block and a plan list of nothing -- a gate that binds
  // no plans and reports success.
  if (ROADMAP_SLICE_START === ROADMAP_SLICE_END) {
    throw new Error("the roadmap slice bounds are the same heading");
  }
  const sliceStart = roadmapMarkdown.indexOf(ROADMAP_SLICE_START);
  const sliceEnd = roadmapMarkdown.indexOf(ROADMAP_SLICE_END);
  if (sliceStart < 0) throw new Error(`the roadmap has no ${ROADMAP_SLICE_START} heading`);
  if (sliceEnd <= sliceStart) throw new Error(`the roadmap has no ${ROADMAP_SLICE_END} heading after ${ROADMAP_SLICE_START}`);
  const roadmapBlock = roadmapMarkdown.slice(sliceStart, sliceEnd);
  if (roadmapBlock.length === 0) throw new Error(`the Phase-${PHASE} roadmap slice is empty`);

  const roadmapTexts = Object.fromEntries([...roadmapBlock.matchAll(/^\s+(\d+)\. (.+)$/gm)].map((match) => [
    `RC${PHASE}-${match[1]}`,
    match[2],
  ]));
  const planTexts = Object.fromEntries([...roadmapBlock.matchAll(PLAN_LINE_PATTERN)]
    .map((match) => [match[1], match[2]]));
  if (Object.keys(planTexts).length === 0) {
    throw new Error(`the roadmap lists no ${PHASE_SLUG}- plans; the gate would bind no plan text`);
  }
  const threatTexts = Object.fromEntries(threatRows.map(({ id, name }) => [id, name]));

  const scripts = JSON.parse(packageJson).scripts ?? {};
  const toolDir = path.join(root, "tools");
  const toolNames = (await readdir(toolDir)).filter((name) => name.endsWith(".mjs"));
  const tools = Object.fromEntries(await Promise.all(toolNames.map(async (name) => [
    `tools/${name}`,
    await readFile(path.join(toolDir, name), "utf8"),
  ])));

  return {
    assumptions: evidenceMap(ASSUMPTION_TEXTS, ASSUMPTION_EVIDENCE),
    commands,
    graph: buildCommandGraph({
      scripts,
      tools,
      // The orchestrator's real outgoing edges are exactly the commands it is
      // about to run, which come from the threat register rather than its own
      // source. Declaring them keeps the graph honest.
      declared: {
        [`tool:${ORCHESTRATOR_TOOL}`]: commands.flatMap(({ command }) => commandEdges(command, "script")),
      },
    }),
    leaf_threat: leafThreat,
    owner_commands: threatRows,
    plans: evidenceMap(planTexts, PLAN_EVIDENCE),
    requirements: evidenceMap({
      "ALM-01": "One restart-safe backend alarm lifecycle with declared priority, suppression that suppresses, and bounded retention",
      "ALM-02": "Notification and escalation that reach only configured targets, record every attempt, and never hide a failed alarm",
      "SCH-01": "Schedules bound to supported Home Assistant capabilities, resolved to instants across DST, authorized and audited",
    }, REQUIREMENT_EVIDENCE),
    roadmap: evidenceMap(roadmapTexts, ROADMAP_EVIDENCE),
    threats: evidenceMap(threatTexts, Object.fromEntries(threatRows.map(({ id }) => [id, [id]]))),
  };
}

function referencedEvidence(plan) {
  return [plan.assumptions, plan.plans, plan.requirements, plan.roadmap, plan.threats]
    .flatMap((mapping) => Object.values(mapping).flatMap(({ evidence }) => evidence));
}

/** Fail closed on anything short of a current, complete, asserting run. */
export function validatePhase7Evidence(plan, results) {
  const commandIds = new Set(plan.commands.map(({ id }) => id));
  for (const command of plan.commands) {
    const result = results[command.id];
    if (!result) throw new Error(`missing command result: ${command.id}`);
    if (result.command !== command.command) throw new Error(`stale command result: ${command.id}`);
    if (result.skipped === true) throw new Error(`command evidence was skipped: ${command.id}`);
    if (result.exit_code !== 0 || result.passed !== true) throw new Error(`command failed: ${command.id}`);
    if (!Number.isInteger(result.test_count) || result.test_count < 1) {
      throw new Error(`zero tests recorded: ${command.id}`);
    }
    if (!/^[a-f0-9]{64}$/.test(result.output_sha256 ?? "")) {
      throw new Error(`command output hash missing: ${command.id}`);
    }
  }
  for (const [kind, mapping] of Object.entries({
    assumption: plan.assumptions,
    plan: plan.plans,
    requirement: plan.requirements,
    roadmap: plan.roadmap,
    threat: plan.threats,
  })) {
    for (const [id, item] of Object.entries(mapping)) {
      if (!item.text || !item.evidence?.length) throw new Error(`${id} ${kind} is unmapped`);
      for (const evidenceId of item.evidence) {
        if (!commandIds.has(evidenceId)) throw new Error(`${id} references missing evidence ${evidenceId}`);
      }
    }
  }
  const referenced = new Set(referencedEvidence(plan));
  for (const command of plan.commands) {
    if (!referenced.has(command.id)) throw new Error(`command evidence is unmapped: ${command.id}`);
  }
  return { verified: true };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

function countBehavioralChecks(output) {
  const counts = [];
  for (const pattern of [/(\d+)\s+passed\b/gi, /tests\s+(\d+)\b/gi, /(\d+)\s+tests?\b/gi]) {
    for (const match of output.matchAll(pattern)) counts.push(Number(match[1]));
  }
  const passLines = output.match(/^PASS\b/gm)?.length ?? 0;
  const verifiedLines = output.match(/^Verified\b/gm)?.length ?? 0;
  const builtLines = output.match(/^Built \d+ validated outputs/gm)?.length ?? 0;
  return Math.max(passLines + verifiedLines + builtLines, ...counts, 0);
}

function hasNonzeroSkip(output) {
  return /(?:skipped|skip)\s+[1-9]\d*\b/i.test(output) || /\b[1-9]\d*\s+skipped\b/i.test(output);
}

function portableCommand(text) {
  /* Keep the declared Python 3.13 pin while resolving the launcher per platform. */
  return text.replaceAll("py -3.13", pythonCommand());
}

function executeCommand(root, command) {
  const started = Date.now();
  const result = spawnSync(portableCommand(command.command), {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return {
    command: command.command,
    duration_ms: Date.now() - started,
    exit_code: result.status ?? 1,
    output_sha256: sha256(output),
    output_tail: output.trim().split(/\r?\n/).slice(-12),
    passed: result.status === 0,
    skipped: hasNonzeroSkip(output),
    test_count: countBehavioralChecks(output),
  };
}

async function artifactIdentities(root) {
  const files = [
    ".github/workflows/docs.yml",
    ".github/workflows/hacs.yml",
    ".github/workflows/release.yml",
    ".github/workflows/validate.yml",
    ".planning/REQUIREMENTS.md",
    ".planning/ROADMAP.md",
    `${PHASE_DIR}/${THREATS_FILE}`,
    `${PHASE_DIR}/${VALIDATION_FILE}`,
    "README.de.md",
    "README.md",
    "build/release/hacs-staging-manifest.json",
    "custom_components/glt_flow_card/build-manifest.json",
    "custom_components/glt_flow_card/www/glt-flow-card.js",
    "dist/glt-flow-card.js",
    "docs/wiki/Companion-Backend.md",
    "docs/wiki/Installation.md",
    "package.json",
    "schemas/vocabularies.json",
    `test/phase${PHASE}-gate.test.mjs`,
  ];
  return Object.fromEntries(await Promise.all(files.map(async (relativePath) => {
    const bytes = await readFile(path.join(root, relativePath));
    return [relativePath, { sha256: sha256(bytes), size: bytes.length }];
  })));
}

function parseArgs(argv) {
  let output = DEFAULT_OUTPUT;
  for (const argument of argv) {
    if (argument.startsWith("--output=")) output = argument.slice(9);
    else throw new Error(`unknown Phase-${PHASE} gate argument: ${argument}`);
  }
  return { output };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = await loadPhase7Plan({ root: ROOT });
  const graph = assertCommandGraph(plan.graph);
  console.log(`PASS acyclic command graph reaching ${LEAF_SCRIPT} exactly once`);

  const results = {};
  for (const command of plan.commands) {
    console.log(`RUN ${command.id} ${command.name}`);
    results[command.id] = executeCommand(ROOT, command);
    const outcome = results[command.id];
    console.log(`${outcome.passed ? "PASS" : "FAIL"} ${command.id} ${outcome.output_sha256}`);
    if (!outcome.passed || outcome.skipped || outcome.test_count < 1) break;
  }
  validatePhase7Evidence(plan, results);

  // The manifest is written only here, after every command has passed, so a
  // half-finished run leaves no artifact that could be mistaken for evidence.
  const report = canonical({
    artifacts: await artifactIdentities(ROOT),
    commands: results,
    format: `glt-flow-card-phase${PHASE}-evidence`,
    graph: { outer_to_leaf_paths: graph.paths },
    mappings: {
      assumptions: plan.assumptions,
      plans: plan.plans,
      requirements: plan.requirements,
      roadmap: plan.roadmap,
      threats: plan.threats,
    },
    report_version: 1,
    verified: true,
  });
  const outputPath = path.resolve(ROOT, options.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalJson(report));
  console.log(`PASS Phase-${PHASE} evidence ${path.relative(ROOT, outputPath)}`);
  console.log(
    `PASS ${Object.keys(results).length} unique commands including all ${plan.owner_commands.length} threat owners exactly once`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Phase-${PHASE} verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
