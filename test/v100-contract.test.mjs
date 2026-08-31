import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  canonicalizeJson,
  evaluateProjectContract,
} from "../src/v100/project-contract.mjs";
import { schemaFingerprints } from "../src/v100/generated/project-validators.mjs";
import { generateContractFixtures } from "../tools/generate-contract-fixtures.mjs";

const ROOT = new URL("../", import.meta.url);
const MANIFEST = JSON.parse(await readFile(new URL("fixtures/contracts/manifest.json", import.meta.url), "utf8"));
const LIMITS = JSON.parse(await readFile(new URL("schemas/limits.json", ROOT), "utf8"));
let corpusRoot;

before(async () => {
  corpusRoot = await mkdtemp(join(tmpdir(), "glt-project-contract-js-"));
  await generateContractFixtures({ outputDir: corpusRoot });
});

after(async () => {
  await rm(corpusRoot, { recursive: true, force: true });
});

async function fixtureBody(fixture) {
  return readFile(join(corpusRoot, fixture.file));
}

function fixture(id) {
  const found = MANIFEST.fixtures.find((entry) => entry.id === id);
  assert.ok(found, `missing fixture ${id}`);
  return found;
}

function primaryError(result) {
  assert.ok(result.errors.length, "expected at least one stable error");
  return result.errors[0];
}

test("canonical JSON sorts object keys, preserves array order, and leaves input unchanged", () => {
  const input = {
    z: 1,
    nested: { y: "ü", x: -0 },
    ordered: [{ b: true, a: false }, 2],
  };
  const snapshot = structuredClone(input);
  const canonical = canonicalizeJson(input);

  assert.equal(canonical, '{"nested":{"x":0,"y":"ü"},"ordered":[{"a":false,"b":true},2],"z":1}');
  assert.deepEqual(input, snapshot);
  assert.equal(
    createHash("sha256").update(canonical, "utf8").digest("hex"),
    evaluateProjectContract(input).digest,
  );
});

test("shared golden and scale documents emit their specified canonical evidence", async () => {
  const accepted = MANIFEST.fixtures.filter((entry) => ["golden", "scale_correctness"].includes(entry.class));
  for (const entry of accepted) {
    const result = evaluateProjectContract(await fixtureBody(entry));
    assert.equal(result.valid, true, `${entry.id}: ${JSON.stringify(result.errors)}`);
    assert.equal(result.errors.length, 0, entry.id);
    assert.equal(result.schema_version, entry.schema_version ?? 2, entry.id);
    assert.equal(result.digest, entry.expected.canonical_sha256, entry.id);
    assert.equal(createHash("sha256").update(result.canonical, "utf8").digest("hex"), result.digest, entry.id);
  }
});

test("schema and reference fixtures map to stable codes and RFC 6901 paths", async () => {
  const rejected = MANIFEST.fixtures.filter((entry) => [
    "malformed",
    "raw_normalization_trap",
    "reference_integrity",
    "malicious_string",
  ].includes(entry.class));

  for (const entry of rejected) {
    const result = evaluateProjectContract(await fixtureBody(entry));
    assert.equal(result.valid, false, entry.id);
    assert.deepEqual(
      { code: primaryError(result).code, path: primaryError(result).path },
      { code: entry.expected.code, path: entry.expected.path },
      entry.id,
    );
    assert.ok(result.errors.every((error) => /^contract\.[a-z_]+$/.test(error.code)), entry.id);
    assert.ok(result.errors.every((error) => /^\/(?:[^~]|~[01])*$/.test(error.path)), entry.id);
  }
});

test("rejects raw oversized and deeply nested documents before schema validation", async () => {
  for (const id of ["limit-json-max-bytes-above", "limit-json-max-depth-above"]) {
    const entry = fixture(id);
    const result = evaluateProjectContract(await fixtureBody(entry));
    assert.equal(result.valid, false, id);
    assert.deepEqual(result.errors, [{
      code: entry.expected.code,
      path: entry.expected.path,
      params: {
        actual: entry.boundary.value,
        limit: LIMITS.json[entry.boundary.policy_path.slice("json.".length)],
      },
    }], id);
    assert.equal(result.schema_version, null, id);
    assert.equal(result.canonical, null, id);
    assert.equal(result.digest, null, id);
  }
});

test("every raw limit boundary is enforced before schema validation", async () => {
  const boundaries = MANIFEST.fixtures.filter((entry) => entry.class === "json_limit_boundary");
  for (const entry of boundaries) {
    const result = evaluateProjectContract(await fixtureBody(entry));
    const policyName = entry.boundary.policy_path.slice("json.".length);
    const limitCode = entry.expected.code;
    if (entry.boundary.relation === "above" && policyName !== "max_errors") {
      assert.equal(primaryError(result).code, limitCode, entry.id);
      assert.equal(primaryError(result).path, entry.expected.path, entry.id);
    } else if (policyName !== "max_errors") {
      assert.ok(!result.errors.some((error) => error.code === limitCode), entry.id);
    }
    assert.ok(result.errors.length <= LIMITS.json.max_errors, entry.id);
  }
});

test("stable errors are deterministically sorted and capped with an explicit sentinel", async () => {
  for (const relation of ["below", "at", "above"]) {
    const entry = fixture(`limit-json-max-errors-${relation}`);
    const result = evaluateProjectContract(await fixtureBody(entry));
    const expectedCount = relation === "above" ? LIMITS.json.max_errors : entry.boundary.value;
    assert.equal(result.errors.length, expectedCount, entry.id);
    assert.deepEqual([...result.errors].sort((left, right) => (
      left.path.localeCompare(right.path)
      || left.code.localeCompare(right.code)
      || JSON.stringify(left.params).localeCompare(JSON.stringify(right.params))
    )), result.errors, entry.id);
    assert.equal(result.errors.some((error) => error.code === "contract.error_limit"), relation === "above", entry.id);
  }
});

test("validation rejects non-JSON values and never mutates object input", () => {
  const input = {
    type: "custom:glt-flow-card",
    schema_version: 2,
    project: { id: "immutable", name: "Immutable", revision: 0 },
    equipment: [{ id: "pump-1", type: "pump" }],
  };
  const snapshot = structuredClone(input);
  assert.equal(evaluateProjectContract(input).valid, true);
  assert.deepEqual(input, snapshot);

  for (const invalid of [undefined, 1n, Number.NaN, new Date(0), { value: undefined }]) {
    const result = evaluateProjectContract(invalid);
    assert.equal(result.valid, false);
    assert.equal(primaryError(result).code, "contract.type");
  }
});

test("generated validators expose canonical schema fingerprints and pass drift check", () => {
  assert.deepEqual(schemaFingerprints, {
    bundle: MANIFEST.policies.bundle_schema_sha256,
    project: MANIFEST.policies.project_schema_sha256,
  });
  const checked = spawnSync(process.execPath, ["tools/generate-project-validators.mjs", "--check"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(checked.status, 0, `${checked.stdout}${checked.stderr}`);
});
