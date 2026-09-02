/* Execute and hash the complete Phase-10 behavioral evidence set.
 *
 * The gate answers one question: is every Phase-10 requirement, roadmap truth,
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
 * mutation tests in test/phase10-gate.test.mjs check each derivation.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pythonCommand } from "./python-launcher.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The one place the phase number is written. Everything below derives from it. */
export const PHASE = 10;

/** Derived phase identifiers. No other literal names the phase. */
export const PHASE_SLUG = String(PHASE).padStart(2, "0");
export const THREAT_PREFIX = `T${PHASE}`;
export const PHASE_DIR = `.planning/phases/${PHASE_SLUG}-usability-release-evidence`;
export const THREATS_FILE = `${PHASE_SLUG}-THREATS.md`;
export const VALIDATION_FILE = `${PHASE_SLUG}-VALIDATION.md`;
export const ROADMAP_SLICE_START = `### Phase ${PHASE}:`;
/**
 * Where this phase's roadmap slice ends.
 *
 * Every earlier gate wrote `### Phase ${PHASE + 1}:` and that is wrong for the
 * last phase, which has no successor heading. The slice ends at the next
 * phase heading if one exists and at the next top-level section otherwise, so
 * the same derivation holds at both ends of the roadmap. Writing a literal
 * here for Phase 10 would be exactly the class of bug this file's own
 * docstring records three of.
 */
export const ROADMAP_SLICE_ENDS = [`### Phase ${PHASE + 1}:`, "## Requirement Coverage"];
export const ROADMAP_SLICE_END = ROADMAP_SLICE_ENDS[0];
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
  // The previous phase gate stays mandatory: a Phase-9 claim resting on Phase-8
  // guarantees nobody re-ran is resting on nothing.
  [`F${PHASE}-06`, `Phase-${PHASE - 1} gate`, `npm run test:phase${PHASE - 1}`],
].map(([id, name, command]) => ({ command, id, name, owner: false }));

/** Requirement -> the evidence that must be current for it to count as met. */
const REQUIREMENT_EVIDENCE = {
  "I18N-01": ["T10-01", "T10-02", "T10-03", "T10-04", "T10-05", "T10-06"],
  "A11Y-01": ["T10-07", "T10-08", "T10-09", "T10-10"],
  "TEST-01": [
    "T10-11", "T10-12", "T10-13", "T10-14", "T10-15", "T10-16", "T10-17",
  ],
};

/** Roadmap success criteria for Phase 10, in the order the roadmap states them. */
const ROADMAP_EVIDENCE = {
  "RC10-1": ["T10-01", "T10-02", "T10-03", "T10-04", "T10-05", "T10-06"],
  "RC10-2": ["T10-07", "T10-08", "T10-09"],
  "RC10-3": ["T10-15", "T10-16"],
  "RC10-4": ["T10-13", "T10-14"],
  "RC10-5": ["T10-10", "T10-11", "T10-12", "T10-17"],
};

/** Every plan in the phase, bound to the evidence its work is proven by. */
const PLAN_EVIDENCE = {
  "10-01": [`F${PHASE}-02`, `F${PHASE}-03`],
  "10-02": ["T10-01"],
  "10-03": ["T10-02"],
  "10-04": ["T10-03"],
  "10-05": ["T10-04", "T10-05"],
  "10-06": ["T10-06"],
  "10-07": ["T10-07", "T10-08"],
  "10-08": ["T10-07", "T10-08"],
  "10-09": ["T10-09", "T10-15"],
  "10-10": ["T10-13", "T10-14"],
  "10-11": ["T10-10", "T10-11", "T10-12"],
  "10-12": ["T10-17"],
  "10-13": ["T10-13", "T10-14"],
  "10-14": [`F${PHASE}-05`],
  "10-15": ["T10-16", `F${PHASE}-01`, `F${PHASE}-06`],
};

/**
 * The resolved assumptions, each bound to evidence that exercises it.
 *
 * A resolved assumption that no command touches is a decision nobody is
 * checking, which is how a bound becomes a suggestion.
 */
const ASSUMPTION_EVIDENCE = {
  COMPLETENESS_IS_COMPUTED: ["T10-01"],
  A_MISSING_KEY_IS_VISIBLE: ["T10-02"],
  NO_STRING_ESCAPES_THE_CATALOG: ["T10-03"],
  FORMATTING_REFUSES_RATHER_THAN_GUESSES: ["T10-04"],
  BOTH_RUNTIMES_SAY_THE_SAME_THING: ["T10-06"],
  EVERY_CONTROL_HAS_A_NAME_AND_A_ROLE: ["T10-07"],
  AN_UNSWEPT_SURFACE_FAILS: ["T10-09"],
  AUTOMATED_IS_NOT_CONFORMANCE: ["T10-10"],
  A_CLAIM_WITHOUT_EVIDENCE_FAILS_THE_BUILD: ["T10-11"],
  A_FAILED_CLAIM_IS_PUBLISHED_AS_FAILED: ["T10-12"],
  A_MEASUREMENT_CARRIES_ITS_ENVIRONMENT: ["T10-13"],
  WHAT_WAS_NEVER_EXERCISED_IS_NAMED: ["T10-17"],
};

const ASSUMPTION_TEXTS = {
  COMPLETENESS_IS_COMPUTED: "There is one enumerable catalog per language, and whether they are complete is computed from the catalogs rather than asserted about them.",
  A_MISSING_KEY_IS_VISIBLE: "A missing translation fails at load rather than resolving to the English string or the raw key, and a pseudo-locale run proves that failure is reachable.",
  NO_STRING_ESCAPES_THE_CATALOG: "Every user-facing string in the shipped artifact comes from a catalog, and the sweep fails with the list of any that do not rather than with a count.",
  FORMATTING_REFUSES_RATHER_THAN_GUESSES: "Date, time, number and unit formatting resolves from configuration or refuses; it never silently falls back to the viewer's locale, so one screen never carries two date formats.",
  BOTH_RUNTIMES_SAY_THE_SAME_THING: "The Companion's wording and the browser's are compared as canonical bytes, not only their codes, so the two cannot drift in what they say while agreeing on what they mean.",
  EVERY_CONTROL_HAS_A_NAME_AND_A_ROLE: "Every interactive element in the exact artifact has a role from the element itself where possible and an accessible name from the catalog; a title attribute is not a name.",
  AN_UNSWEPT_SURFACE_FAILS: "The automated sweep covers every registered surface in the exact artifact, and a surface it does not cover fails rather than being skipped.",
  AUTOMATED_IS_NOT_CONFORMANCE: "An automated pass and a recorded manual pass are separate claims with separate evidence, and the registry has no schema in which they combine into a conformance statement.",
  A_CLAIM_WITHOUT_EVIDENCE_FAILS_THE_BUILD: "Every published claim cites a command and that command's result, and a claim nothing supports fails the build rather than warning.",
  A_FAILED_CLAIM_IS_PUBLISHED_AS_FAILED: "A claim whose evidence failed appears in the registry as failed and is never omitted, because an omission reads as not applicable.",
  A_MEASUREMENT_CARRIES_ITS_ENVIRONMENT: "Every capacity measurement carries the environment it was taken in, and only an environment marked representative supports a platform-capacity claim.",
  WHAT_WAS_NEVER_EXERCISED_IS_NAMED: "Every capability never exercised in this environment is named in the registry with its reason, so a reader cannot assume it was.",
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
 * every row must carry an owner command. A register missing T9-07 entirely
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
  if (sliceStart < 0) throw new Error(`the roadmap has no ${ROADMAP_SLICE_START} heading`);
  const sliceEnd = ROADMAP_SLICE_ENDS
    .map((marker) => roadmapMarkdown.indexOf(marker, sliceStart + 1))
    .filter((index) => index > sliceStart)
    .sort((a, b) => a - b)[0] ?? -1;
  if (sliceEnd <= sliceStart) {
    throw new Error(
      `the roadmap has none of ${ROADMAP_SLICE_ENDS.join(", ")} after ${ROADMAP_SLICE_START}`,
    );
  }
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
