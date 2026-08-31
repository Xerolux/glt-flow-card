import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ALLOWLIST_URL = new URL("../tools/provenance-allowlist.json", import.meta.url);

const EXPECTED_IDENTITIES = new Map([
  ["@playwright/test", { ecosystem: "npm", version: "1.62.1", owner: "microsoft", repository: "playwright", lifecycle_scripts: {} }],
  ["@zip.js/zip.js", { ecosystem: "npm", version: "2.8.30", owner: "gildas-lormeau", repository: "zip.js", lifecycle_scripts: {} }],
  ["ajv", { ecosystem: "npm", version: "8.20.0", owner: "ajv-validator", repository: "ajv", lifecycle_scripts: { prepublish: "npm run build" } }],
  ["jsonschema", { ecosystem: "pypi", version: "4.26.0", owner: "python-jsonschema", repository: "jsonschema", lifecycle_scripts: {} }],
  ["pytest-homeassistant-custom-component", { ecosystem: "pypi", version: "0.13.316", owner: "MatthewFlamm", repository: "pytest-homeassistant-custom-component", lifecycle_scripts: {} }],
]);

const TOP_LEVEL_KEYS = ["packages", "policy_version"];
const PACKAGE_KEYS = ["artifacts", "ecosystem", "hash_policy", "lifecycle_scripts", "name", "registry_url", "source", "version"];
const SOURCE_KEYS = ["api_url", "owner", "repository"];
const ARTIFACT_KEYS = ["algorithm", "digest", "filename", "url"];

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function assertExactKeys(value, expected, label) {
  assert.deepEqual(sortedKeys(value), expected, `${label} contains missing or unknown fields`);
}

function assertAllowlist(policy) {
  assert.equal(Object.getPrototypeOf(policy), Object.prototype);
  assertExactKeys(policy, TOP_LEVEL_KEYS, "allowlist");
  assert.equal(policy.policy_version, 1);
  assert.ok(Array.isArray(policy.packages));
  assert.equal(policy.packages.length, EXPECTED_IDENTITIES.size);

  const names = policy.packages.map((entry) => entry.name);
  assert.deepEqual(names, [...names].sort(), "packages must be sorted by exact name");
  assert.equal(new Set(names).size, names.length, "package names must be unique");

  for (const entry of policy.packages) {
    assertExactKeys(entry, PACKAGE_KEYS, `package ${entry.name}`);
    const expected = EXPECTED_IDENTITIES.get(entry.name);
    assert.ok(expected, `unexpected package ${entry.name}`);
    assert.equal(entry.ecosystem, expected.ecosystem);
    assert.equal(entry.version, expected.version);
    assert.match(entry.version, /^\d+\.\d+\.\d+(?:[a-z0-9.-]+)?$/i, "versions must be immutable, not ranges or tags");
    assert.match(entry.registry_url, /^https:\/\/(?:registry\.npmjs\.org|pypi\.org)\//);
    assert.equal(entry.hash_policy, "exact-set");
    assertExactKeys(entry.source, SOURCE_KEYS, `source for ${entry.name}`);
    assert.equal(entry.source.owner, expected.owner);
    assert.equal(entry.source.repository, expected.repository);
    assert.equal(entry.source.api_url, `https://api.github.com/repos/${expected.owner}/${expected.repository}`);
    assert.deepEqual(entry.lifecycle_scripts, expected.lifecycle_scripts);
    assert.ok(Array.isArray(entry.artifacts) && entry.artifacts.length > 0, `${entry.name} requires artifact hashes`);

    const filenames = entry.artifacts.map((artifact) => artifact.filename);
    assert.equal(new Set(filenames).size, filenames.length, `${entry.name} artifact filenames must be unique`);
    for (const artifact of entry.artifacts) {
      assertExactKeys(artifact, ARTIFACT_KEYS, `artifact for ${entry.name}`);
      assert.match(artifact.url, /^https:\/\/(?:registry\.npmjs\.org|files\.pythonhosted\.org)\//);
      if (entry.ecosystem === "npm") {
        assert.equal(artifact.algorithm, "sha512");
        assert.match(artifact.digest, /^[A-Za-z0-9+/]+={0,2}$/);
      } else {
        assert.equal(artifact.algorithm, "sha256");
        assert.match(artifact.digest, /^[a-f0-9]{64}$/);
      }
    }
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readAllowlist() {
  return JSON.parse(await readFile(ALLOWLIST_URL, "utf8"));
}

test("allowlist contains exactly the five immutable approved identities", async () => {
  assertAllowlist(await readAllowlist());
});

test("allowlist rejects duplicate names, ranges, mutable labels, and missing hashes", async () => {
  const policy = await readAllowlist();
  const duplicate = clone(policy);
  duplicate.packages[1].name = duplicate.packages[0].name;
  assert.throws(() => assertAllowlist(duplicate));

  for (const version of ["^8.20.0", ">=8", "latest"]) {
    const mutable = clone(policy);
    mutable.packages.find((entry) => entry.name === "ajv").version = version;
    assert.throws(() => assertAllowlist(mutable));
  }

  const noHashes = clone(policy);
  noHashes.packages[0].artifacts = [];
  assert.throws(() => assertAllowlist(noHashes));
});

test("allowlist rejects missing owners, source-owner drift, and unknown fields", async () => {
  const policy = await readAllowlist();
  const missingOwner = clone(policy);
  delete missingOwner.packages[0].source.owner;
  assert.throws(() => assertAllowlist(missingOwner));

  const drift = clone(policy);
  drift.packages[0].source.owner = "lookalike-owner";
  assert.throws(() => assertAllowlist(drift));

  const unknown = clone(policy);
  unknown.packages[0].trusted = true;
  assert.throws(() => assertAllowlist(unknown));
});

test("allowlist rejects lifecycle-script additions", async () => {
  const policy = await readAllowlist();
  const tampered = clone(policy);
  tampered.packages.find((entry) => entry.name === "@zip.js/zip.js").lifecycle_scripts.postinstall = "node install.js";
  assert.throws(() => assertAllowlist(tampered));
});
