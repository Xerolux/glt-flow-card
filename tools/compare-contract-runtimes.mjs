/* Compare isolated JavaScript and Python contract evidence over the shared corpus. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { generateContractFixtures } from "./generate-contract-fixtures.mjs";
import { pythonArgs, resolvePython } from "./python-launcher.mjs";

const ROOT = new URL("../", import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT);
const JS_MODULE_URL = new URL("src/v100/project-contract.mjs", ROOT).href;
const PYTHON_ADAPTER = fileURLToPath(new URL("custom_components/glt_flow_card/project_contract.py", ROOT));
const MAX_BUFFER = 64 * 1024 * 1024;

const JS_RUNNER = `
  import { readFileSync } from "node:fs";
  import { evaluateProjectContract } from ${JSON.stringify(JS_MODULE_URL)};
  const lines = readFileSync(0, "utf8").trim().split("\\n").filter(Boolean);
  for (const line of lines) {
    const request = JSON.parse(line);
    const raw = Buffer.from(request.raw_base64, "base64");
    process.stdout.write(JSON.stringify({ id: request.id, evidence: evaluateProjectContract(raw) }) + "\\n");
  }
`;

function parseJsonLines(output, runtime) {
  return output.trim().split("\n").filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${runtime} emitted invalid JSON line: ${line}`, { cause: error });
    }
  });
}

function run(command, args, input, runtime) {
  const completed = spawnSync(command, args, {
    cwd: ROOT_PATH,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    input,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
  if (completed.status !== 0) {
    throw new Error(`${runtime} contract process failed (${completed.status}): ${completed.stderr || completed.stdout}`);
  }
  return { output: completed.stdout, records: parseJsonLines(completed.stdout, runtime) };
}

export function compareRuntimeEvidence(javascript, python) {
  assert.equal(python.length, javascript.length, "runtime result counts differ");
  for (let index = 0; index < javascript.length; index += 1) {
    assert.equal(python[index].id, javascript[index].id, `fixture order differs at ${index}`);
    assert.deepEqual(python[index].evidence, javascript[index].evidence, `${javascript[index].id}: runtime evidence drift`);
  }
}

function verifyManifestExpectations(manifest, results) {
  const byId = new Map(results.map((entry) => [entry.id, entry.evidence]));
  const ownedClasses = new Set([
    "golden",
    "malformed",
    "raw_normalization_trap",
    "reference_integrity",
    "malicious_string",
    "json_limit_boundary",
    "scale_correctness",
  ]);
  for (const fixture of manifest.fixtures.filter((entry) => ownedClasses.has(entry.class))) {
    const evidence = byId.get(fixture.id);
    assert.ok(evidence, `${fixture.id}: missing evidence`);
    if (fixture.expected.outcome === "accept") assert.equal(evidence.valid, true, fixture.id);
    if (fixture.expected.canonical_sha256) assert.equal(evidence.digest, fixture.expected.canonical_sha256, fixture.id);
    if (fixture.expected.outcome === "reject") {
      assert.equal(evidence.valid, false, fixture.id);
      assert.ok(evidence.errors.some((error) => (
        error.code === fixture.expected.code && error.path === fixture.expected.path
      )), `${fixture.id}: missing expected ${fixture.expected.code} at ${fixture.expected.path}`);
    }
  }
}

async function main() {
  const corpus = await mkdtemp(join(tmpdir(), "glt-contract-parity-"));
  try {
    const manifest = await generateContractFixtures({ outputDir: corpus });
    const requests = await Promise.all(manifest.fixtures.map(async (fixture) => ({
      id: fixture.id,
      raw_base64: (await readFile(join(corpus, fixture.file))).toString("base64"),
    })));
    const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`;
    const javascript = run(process.execPath, ["--input-type=module", "--eval", JS_RUNNER], input, "JavaScript");
    const python = run(resolvePython().command, pythonArgs(PYTHON_ADAPTER, "--json-lines"), input, "Python");
    assert.equal(python.output, javascript.output, "runtime JSON-lines bytes differ");
    compareRuntimeEvidence(javascript.records, python.records);
    verifyManifestExpectations(manifest, javascript.records);
    console.log(`contract runtime parity passed for ${javascript.records.length} fixtures`);
  } finally {
    await rm(corpus, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
