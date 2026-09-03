/* Execute and hash the complete Phase-5 behavioral evidence set.
 *
 * The gate answers one question: is every Phase-5 requirement, roadmap truth,
 * plan and threat bound, right now, to a command that actually ran, actually
 * passed, skipped nothing and asserted something? Anything less fails closed.
 *
 * It also proves its own shape. The command graph must be acyclic, the T5-14
 * leaf must be reachable exactly once, and nothing reachable from that leaf may
 * call back into this orchestrator - otherwise the gate could pass by running
 * itself, which is the most convincing kind of nothing.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pythonCommand } from "./python-launcher.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHASE_DIR = ".planning/phases/05-cad-engineering-extension-platform";
const DEFAULT_OUTPUT = ".planning/tmp/phase5-evidence.json";

/** The only outer entry point, its tool, and the one T5-16 leaf. */
export const OUTER_SCRIPT = "test:phase5";
export const ORCHESTRATOR_TOOL = "tools/verify-phase5.mjs";
export const LEAF_SCRIPT = "test:phase5:release";

/** Commands that are not a threat owner but must still be current and green. */
const FOCUSED_COMMANDS = [
  ["F5-01", "Canonical build from authored modules", "npm run build"],
  ["F5-02", "Node regression suites", "npm test"],
  ["F5-03", "Companion suite", "npm run test:python"],
  ["F5-04", "Exact-dist browser suites", "npm run test:e2e"],
  ["F5-05", "Complete sources and deterministic documentation site", "node tools/verify-docs-site.mjs"],
  // The previous phase gate stays mandatory: a Phase-5 claim resting on Phase-4
  // guarantees nobody re-ran is resting on nothing.
  ["F5-06", "Phase-4 gate", "npm run test:phase4"],
].map(([id, name, command]) => ({ command, id, name, owner: false }));

/** Requirement -> the evidence that must be current for it to count as met. */
const REQUIREMENT_EVIDENCE = {
  "CAT-01": ["T5-01", "T5-02", "T5-03"],
  "ENG-01": ["T5-04", "T5-05"],
  "ENG-02": ["T5-06", "T5-07", "T5-08"],
  "CAD-01": ["T5-09", "T5-10", "T5-11"],
  "SDK-01": ["T5-12", "T5-13", "T5-14", "T5-15", "T5-16"],
};

/** Roadmap success criteria for Phase 5, in the order the roadmap states them. */
const ROADMAP_EVIDENCE = {
  "RC5-1": ["T5-01", "T5-02", "T5-03"],
  "RC5-2": ["T5-04", "T5-05"],
  "RC5-3": ["T5-06", "T5-07", "T5-08"],
  "RC5-4": ["T5-09", "T5-10", "T5-11"],
  "RC5-5": ["T5-12", "T5-13", "T5-14", "T5-15"],
};

/** Every plan in the phase, bound to the evidence its work is proven by. */
const PLAN_EVIDENCE = {
  "05-01": ["F5-02", "F5-04"],
  "05-02": ["T5-01", "T5-04"],
  "05-03": ["T5-06", "T5-09", "T5-12"],
  "05-04": ["F5-03", "T5-05"],
  "05-05": ["T5-01", "T5-02"],
  "05-06": ["T5-03"],
  "05-07": ["T5-04"],
  "05-08": ["T5-05"],
  "05-09": ["T5-06"],
  "05-10": ["T5-07"],
  "05-11": ["T5-08"],
  "05-12": ["T5-09"],
  "05-13": ["T5-10"],
  "05-14": ["F5-01", "T5-11"],
  "05-15": ["T5-11"],
  "05-16": ["T5-12"],
  "05-17": ["T5-13", "T5-14"],
  "05-18": ["T5-15"],
  "05-19": ["F5-05"],
  "05-20": ["T5-16", "F5-06"],
};

/**
 * The resolved assumptions, each bound to evidence that exercises it.
 *
 * A resolved assumption that no command touches is a decision nobody is
 * checking, which is how a bound becomes a suggestion.
 */
const ASSUMPTION_EVIDENCE = {
  COUNT_BY_RENDERING: ["T5-01"],
  BOTH_AXES_DISTINCT: ["T5-02"],
  REFUSAL_IS_EXPLAINED: ["T5-04"],
  ENDPOINT_IS_A_PAIR: ["T5-05"],
  FAILURE_IS_EXPLICIT: ["T5-07"],
  CONTRIBUTIONS_ARE_DATA: ["T5-12"],
};

const ASSUMPTION_TEXTS = {
  COUNT_BY_RENDERING: "The published catalog count is the number of variants that actually rendered, never an array length.",
  BOTH_AXES_DISTINCT: "Base geometry and style tokens are each proven distinct by digest, so the cross product does not overstate.",
  REFUSAL_IS_EXPLAINED: "An impossible connection is refused with a reason from a closed set, never a bare boolean.",
  ENDPOINT_IS_A_PAIR: "An endpoint is equipment and port together; geometry is derived from the resolved port and never stored on the path.",
  FAILURE_IS_EXPLICIT: "An unroutable pair returns a declared reason and no points; no route is drawn through an obstacle.",
  CONTRIBUTIONS_ARE_DATA: "No contributed JavaScript is loaded, evaluated or executed in any realm, and contributed markup is allowlisted.",
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

/**
 * Extract the commands one shell string actually executes.
 *
 * Only executed forms count: `npm run x` and `node tools/y.mjs`. A bare path in
 * a string literal - an artifact list, a comment, an error message - is not an
 * edge, and treating it as one would report a cycle in every tool that names
 * itself.
 */
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

/**
 * Build the whole package/tool subprocess graph.
 *
 * `declared` carries edges a tool takes from data rather than from its own
 * source - this orchestrator runs the commands the threat register names, and
 * those are invisible to any static read of the file.
 */
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
 * loops forever, a missing leaf means T5-14 is unowned, more than one path
 * means the release lanes run twice and the second run is not evidence, and a
 * back-edge from the leaf means the gate is its own witness.
 */
export function assertCommandGraph(graph) {
  const cycle = findCycle(graph);
  if (cycle) throw new Error(`command graph is cyclic: ${cycle.join(" -> ")}`);

  const outer = `script:${OUTER_SCRIPT}`;
  const leaf = `script:${LEAF_SCRIPT}`;
  if (!graph.has(outer)) throw new Error(`the outer command ${OUTER_SCRIPT} is not defined`);
  if (!graph.has(leaf)) throw new Error(`the T5-16 leaf ${LEAF_SCRIPT} is not defined`);

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

export async function loadPhase5Plan(options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  const [threatsMarkdown, validationMarkdown, roadmapMarkdown, packageJson] = await Promise.all([
    readFile(path.join(root, PHASE_DIR, "05-THREATS.md"), "utf8"),
    readFile(path.join(root, PHASE_DIR, "05-VALIDATION.md"), "utf8"),
    readFile(path.join(root, ".planning/ROADMAP.md"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);

  const threatRows = threatsMarkdown.split(/\r?\n/)
    .filter((line) => /^\| T5-\d{2} \|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const command = [...cells[4].matchAll(/`([^`]+)`/g)].at(-1)?.[1];
      return { command, id: cells[0], name: cells[2], owner: true };
    });
  if (threatRows.length !== 16 || threatRows.some(({ command }) => !command)) {
    throw new Error("canonical threat owner table is incomplete");
  }
  const leafOwners = threatRows.filter(({ command }) => command === `npm run ${LEAF_SCRIPT}`);
  if (leafOwners.length !== 1 || leafOwners[0].id !== "T5-16") {
    throw new Error(`${LEAF_SCRIPT} must be the owner command of T5-14 alone`);
  }

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
  // A validation row may group threats under one narrower command - T2-02's
  // owner adds the ACL suite that the shared policy row does not name - so the
  // check is coverage, not string equality: every threat is verified somewhere,
  // no row invents one, and T5-14 is owned by the leaf in both documents.
  const validationRows = tableRows(validationMarkdown)
    .filter((cells) => cells.length === 6 && /^T5-\d{2}/.test(cells[1]));
  if (validationRows.length === 0) throw new Error("the validation requirement map is empty");
  const validated = new Set();
  for (const cells of validationRows) {
    const command = [...cells[4].matchAll(/`([^`]+)`/g)].at(-1)?.[1];
    for (const threat of cells[1].split(",").map((value) => value.trim())) {
      if (!threatRows.some(({ id }) => id === threat)) {
        throw new Error(`validation row references unknown threat ${threat}`);
      }
      if (threat === "T5-16" && command !== `npm run ${LEAF_SCRIPT}`) {
        throw new Error(`the validation map must own T5-16 with npm run ${LEAF_SCRIPT}`);
      }
      validated.add(threat);
    }
  }
  for (const { id } of threatRows) {
    if (!validated.has(id)) throw new Error(`${id} has no row in the validation map`);
  }

  // Two distinct headings. Generating this file from the Phase-4 orchestrator
  // collapses both bounds onto the same string, which yields an empty block and
  // a plan list of nothing -- a gate that binds no plans and reports success.
  const roadmapBlock = roadmapMarkdown.slice(
    roadmapMarkdown.indexOf("### Phase 5:"),
    roadmapMarkdown.indexOf("### Phase 6:"),
  );
  if (roadmapBlock.length === 0) throw new Error("the Phase-5 roadmap slice is empty");
  const roadmapTexts = Object.fromEntries([...roadmapBlock.matchAll(/^\s+(\d+)\. (.+)$/gm)].map((match) => [
    `RC5-${match[1]}`,
    match[2],
  ]));
  const planTexts = Object.fromEntries([...roadmapBlock.matchAll(/^- \[[ x]\] (05-\d{2})-PLAN\.md — (.+)$/gm)]
    .map((match) => [match[1], match[2]]));
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
    owner_commands: threatRows,
    plans: evidenceMap(planTexts, PLAN_EVIDENCE),
    requirements: evidenceMap({
      "CAT-01": "A generated, proven catalog of unique symbol variants across the required domains and styles",
      "ENG-01": "Typed ports that refuse an impossible connection with a reason, and endpoints that survive being worked on",
      "ENG-02": "Deterministic, obstacle-aware routing with bounded incremental rerouting",
      "CAD-01": "Transactional editing, id-remapping paste, and a complete non-pointer workflow",
      "SDK-01": "Namespaced data-only contributions that install atomically and cannot execute",
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
export function validatePhase5Evidence(plan, results) {
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
    `${PHASE_DIR}/05-THREATS.md`,
    `${PHASE_DIR}/05-VALIDATION.md`,
    "README.de.md",
    "README.md",
    "build/release/hacs-staging-manifest.json",
    "custom_components/glt_flow_card/build-manifest.json",
        "custom_components/glt_flow_card/www/glt-flow-card.js",
    "dist/glt-flow-card.js",
    "docs/wiki/Companion-Backend.md",
    "docs/wiki/Installation.md",
    "docs/wiki/YAML-Projects.md",
    "package.json",
    "src/v100/entity-mapping.mjs",
    "src/v100/equipment-state.mjs",
    "src/v100/semantic-model.mjs",
    "schemas/project/3.schema.json",
    "schemas/vocabularies.json",
    "custom_components/glt_flow_card/provenance.py",
    "custom_components/glt_flow_card/equipment_profiles.py",
    "test/phase5-gate.test.mjs",
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
    else throw new Error(`unknown Phase-5 gate argument: ${argument}`);
  }
  return { output };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = await loadPhase5Plan({ root: ROOT });
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
  validatePhase5Evidence(plan, results);

  // The manifest is written only here, after every command has passed, so a
  // half-finished run leaves no artifact that could be mistaken for evidence.
  const report = canonical({
    artifacts: await artifactIdentities(ROOT),
    commands: results,
    format: "glt-flow-card-phase5-evidence",
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
  console.log(`PASS Phase-5 evidence ${path.relative(ROOT, outputPath)}`);
  console.log(`PASS ${Object.keys(results).length} unique commands including all fourteen threat owners exactly once`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Phase-5 verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
