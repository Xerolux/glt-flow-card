/* Execute and hash the complete Phase-1 behavioral evidence set. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHASE_DIR = ".planning/phases/01-trusted-contract-release-foundation";
const DEFAULT_OUTPUT = ".planning/tmp/phase1-evidence.json";

const FOCUSED_COMMANDS = [
  ["F-01", "Dependency provenance", "node --test test/provenance.test.mjs && node tools/verify-provenance.mjs --online"],
  ["F-02", "Canonical fixture corpus", "npm run test:fixtures"],
  ["F-03", "JavaScript and Python contract parity", "npm run test:contract:js && npm run test:contract:parity"],
  ["F-04", "Sequential migration parity", "npm run test:migrations && py -3.13 -m pytest tests/components/glt_flow_card/test_project_migrations.py -q"],
  ["F-05", "Semantic diff parity", "npm run test:diff && py -3.13 -m pytest tests/components/glt_flow_card/test_project_diff.py -q"],
  ["F-06", "Legacy core compatibility", "node --test test/v100-core.test.mjs test/v100-migrations.test.mjs test/v100-diff.test.mjs"],
  ["F-07", "Complete bundle parity", "npm run test:bundle && py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q"],
  ["F-08", "Canonical Companion suite", "npm run test:python"],
  ["F-09", "Deterministic release build", "npm run verify:release"],
  ["F-10", "Independent HACS category stages", "npm run stage:hacs && node tools/validate-hacs-staging.mjs"],
  ["F-11", "Immutable Home Assistant lane resolution", "node --test test/ha-lanes.test.mjs && npm run resolve:ha-minimum -- --max-candidates=12"],
  ["F-12", "Exact Home Assistant artifact lanes", "npm run test:ha-artifacts"],
].map(([id, name, command]) => ({ command, id, name, owner: false }));

const TASK_EVIDENCE = {
  "01-01-T1": ["F-01"], "01-01-T2": ["F-01"],
  "01-02-T1": ["F-01", "F-08"], "01-02-T2": ["T-05"], "01-02-T3": ["F-08"],
  "01-03-T1": ["F-02", "F-03"], "01-03-T2": ["F-02"],
  "01-04-T1": ["F-03"], "01-04-T2": ["T-03"],
  "01-05-T1": ["F-04"], "01-05-T2": ["F-05"], "01-05-T3": ["F-06"],
  "01-06-T1": ["T-04"], "01-06-T2": ["F-07"],
  "01-07-T1": ["F-08"], "01-07-T2": ["T-01", "T-02", "T-06"],
  "01-08-T1": ["F-08"], "01-08-T2": ["F-08"], "01-08-T3": ["T-07"],
  "01-09-T1": ["F-09"], "01-09-T2": ["F-09"],
  "01-10-T1": ["F-10"], "01-10-T2": ["F-10"],
  "01-11-T1": ["T-05"], "01-11-T2": ["T-01", "T-02", "T-05"], "01-11-T3": ["T-05"],
  "01-12-T1": ["F-11"], "01-12-T2": ["F-12"],
  "01-13-T1": ["T-08"], "01-13-T2": ["F-01", "F-02", "F-03", "F-04", "F-05", "F-06", "F-07", "F-08", "F-09", "F-10", "F-11", "F-12", "T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-08"],
};

const REQUIREMENT_EVIDENCE = {
  "SCHEMA-01": ["F-02", "F-03", "F-04", "F-07", "T-03", "T-04", "T-05", "T-06", "T-08"],
  "DIFF-01": ["F-05", "T-01", "T-02", "T-05", "T-06", "T-08"],
  "HACS-01": ["F-08", "F-09", "F-10", "F-11", "F-12", "T-07", "T-08"],
};

const ROADMAP_EVIDENCE = {
  "RC-1": ["F-02", "F-03", "T-03"],
  "RC-2": ["F-04", "F-05", "F-07", "T-01", "T-02", "T-04", "T-05", "T-06"],
  "RC-3": ["F-08", "F-10", "F-11", "F-12", "T-07"],
  "RC-4": ["F-09", "F-10", "T-05", "T-08"],
  "RC-5": ["F-03", "F-07", "F-08", "F-09", "F-10", "F-12", "T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-08"],
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

export async function loadPhase1Plan(options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  const [threatsMarkdown, validationMarkdown, roadmapMarkdown] = await Promise.all([
    readFile(path.join(root, PHASE_DIR, "01-THREATS.md"), "utf8"),
    readFile(path.join(root, PHASE_DIR, "01-VALIDATION.md"), "utf8"),
    readFile(path.join(root, ".planning/ROADMAP.md"), "utf8"),
  ]);
  const threatRows = threatsMarkdown.split(/\r?\n/).filter((line) => /^\| T-\d{2} \|/.test(line)).map((line) => {
    const identity = line.match(/^\| (T-\d{2}) \| ([^|]+) \|/);
    const commands = [...line.matchAll(/`([^`]+)`/g)];
    return [identity?.[1], identity?.[2]?.trim(), commands.at(-1)?.[1]];
  });
  const ownerCommands = threatRows.map(([id, name, command]) => ({
    command,
    id,
    name,
    owner: true,
  }));
  if (ownerCommands.length !== 8 || ownerCommands.some(({ command }) => !command)) {
    throw new Error("canonical threat owner table is incomplete");
  }
  const commands = [];
  for (const command of [...FOCUSED_COMMANDS, ...ownerCommands]) {
    if (!commands.some((entry) => entry.command === command.command)) commands.push(command);
  }
  for (const owner of ownerCommands) {
    if (commands.filter(({ command }) => command === owner.command).length !== 1) {
      throw new Error(`${owner.id} owner command is not unique`);
    }
  }
  const taskRows = tableRows(validationMarkdown).filter(([id]) => /^01-\d{2}-T\d+$/.test(id));
  const taskTexts = Object.fromEntries(taskRows.map(([id, text]) => [id, text]));
  const roadmapBlock = roadmapMarkdown.slice(
    roadmapMarkdown.indexOf("### Phase 1:"),
    roadmapMarkdown.indexOf("### Phase 2:"),
  );
  const roadmapTexts = Object.fromEntries([...roadmapBlock.matchAll(/^\s+(\d+)\. (.+)$/gm)].map((match) => [
    `RC-${match[1]}`,
    match[2],
  ]));
  const threatTexts = Object.fromEntries(threatRows.map(([id, text]) => [id, text]));
  return {
    commands,
    owner_commands: ownerCommands,
    requirements: evidenceMap({
      "SCHEMA-01": "Bounded schema, migrations, bundles and rollback",
      "DIFF-01": "Semantic diff, closure, conflict and selective apply",
      "HACS-01": "Companion lifecycle, packaging and exact HA lanes",
    }, REQUIREMENT_EVIDENCE),
    roadmap: evidenceMap(roadmapTexts, ROADMAP_EVIDENCE),
    tasks: evidenceMap(taskTexts, TASK_EVIDENCE),
    threats: evidenceMap(threatTexts, Object.fromEntries(ownerCommands.map(({ id }) => [id, [id]]))),
  };
}

function referencedEvidence(plan) {
  return [plan.requirements, plan.roadmap, plan.tasks, plan.threats].flatMap((mapping) => (
    Object.values(mapping).flatMap(({ evidence }) => evidence)
  ));
}

export function validatePhase1Evidence(plan, results) {
  const commandIds = new Set(plan.commands.map(({ id }) => id));
  for (const command of plan.commands) {
    const result = results[command.id];
    if (!result) throw new Error(`missing command result: ${command.id}`);
    if (result.command !== command.command) throw new Error(`stale command result: ${command.id}`);
    if (result.skipped === true) throw new Error(`command evidence was skipped: ${command.id}`);
    if (result.exit_code !== 0 || result.passed !== true) throw new Error(`command failed: ${command.id}`);
    if (!Number.isInteger(result.test_count) || result.test_count < 1) throw new Error(`zero tests recorded: ${command.id}`);
    if (!/^[a-f0-9]{64}$/.test(result.output_sha256 ?? "")) throw new Error(`command output hash missing: ${command.id}`);
  }
  for (const [kind, mapping] of Object.entries({
    requirement: plan.requirements,
    roadmap: plan.roadmap,
    task: plan.tasks,
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

function countBehavioralChecks(output) {
  const counts = [];
  for (const pattern of [/(\d+)\s+passed\b/gi, /tests\s+(\d+)\b/gi, /(\d+)\s+tests?\b/gi]) {
    for (const match of output.matchAll(pattern)) counts.push(Number(match[1]));
  }
  const passLines = output.match(/^PASS\b/gm)?.length ?? 0;
  const verifiedLines = output.match(/^Verified\b/gm)?.length ?? 0;
  return Math.max(passLines + verifiedLines, ...counts, 0);
}

function hasNonzeroSkip(output) {
  return /(?:skipped|skip)\s+[1-9]\d*\b/i.test(output) || /\b[1-9]\d*\s+skipped\b/i.test(output);
}

function executeCommand(root, command) {
  const started = Date.now();
  const result = spawnSync(command.command, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const lines = output.trim().split(/\r?\n/);
  return {
    command: command.command,
    duration_ms: Date.now() - started,
    exit_code: result.status ?? 1,
    output_sha256: sha256(output),
    output_tail: lines.slice(-12),
    passed: result.status === 0,
    skipped: hasNonzeroSkip(output),
    test_count: countBehavioralChecks(output),
  };
}

async function artifactIdentities(root) {
  const files = [
    ".github/workflows/release.yml",
    ".planning/REQUIREMENTS.md",
    ".planning/ROADMAP.md",
    `${PHASE_DIR}/01-THREATS.md`,
    `${PHASE_DIR}/01-VALIDATION.md`,
    "custom_components/glt_flow_card/build-manifest.json",
    "build/release/hacs-staging-manifest.json",
    "build/release/release-assets/glt-flow-card.js",
    "build/release/release-assets/glt-flow-card-companion.zip",
    "docs/wiki/Companion-Backend.md",
    "docs/wiki/Installation.md",
    "docs/wiki/YAML-Projects.md",
    ".planning/tmp/ha-lanes.json",
    ".planning/tmp/ha-artifact-results.json",
    "README.de.md",
    "README.md",
    "test/phase1-gate.test.mjs",
    "tools/verify-phase1.mjs",
    "tools/verify-release-acceptance.mjs",
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
    else throw new Error(`unknown Phase-1 gate argument: ${argument}`);
  }
  return { output };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = await loadPhase1Plan({ root: ROOT });
  const results = {};
  for (const command of plan.commands) {
    console.log(`RUN ${command.id} ${command.name}`);
    results[command.id] = executeCommand(ROOT, command);
    console.log(`${results[command.id].passed ? "PASS" : "FAIL"} ${command.id} ${results[command.id].output_sha256}`);
    if (!results[command.id].passed || results[command.id].skipped || results[command.id].test_count < 1) break;
  }
  validatePhase1Evidence(plan, results);
  const report = canonical({
    artifacts: await artifactIdentities(ROOT),
    commands: results,
    format: "glt-flow-card-phase1-evidence",
    mappings: {
      requirements: plan.requirements,
      roadmap: plan.roadmap,
      tasks: plan.tasks,
      threats: plan.threats,
    },
    report_version: 1,
    verified: true,
  });
  const outputPath = path.resolve(ROOT, options.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalJson(report));
  console.log(`PASS Phase-1 evidence ${path.relative(ROOT, outputPath)}`);
  console.log(`PASS ${Object.keys(results).length} unique commands including all eight threat owners exactly once`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Phase-1 verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
