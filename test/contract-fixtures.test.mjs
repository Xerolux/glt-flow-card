import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = new URL("../", import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT);
const PROJECT_SCHEMA_PATHS = [
  "schemas/project/0.schema.json",
  "schemas/project/1.schema.json",
  "schemas/project/2.schema.json",
];
const SCHEMA_PATHS = [
  ...PROJECT_SCHEMA_PATHS,
  "schemas/bundle-manifest.schema.json",
];
const CONTRACT_PATHS = [
  ...SCHEMA_PATHS,
  "schemas/limits.json",
  "schemas/diff-policy.json",
];
const SCHEMA_ID_PREFIX = "https://schemas.glt-flow-card.invalid/";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", ".planning", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function visit(value, callback, pointer = "") {
  callback(value, pointer);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visit(child, callback, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  }
}

async function loadSchemas() {
  return Promise.all(SCHEMA_PATHS.map(readJson));
}

async function compiledProjectValidators() {
  const schemas = await loadSchemas();
  const ajv = new Ajv2020({ allErrors: false, strict: true });
  for (const schema of schemas) ajv.addSchema(schema);
  return PROJECT_SCHEMA_PATHS.map((_, version) => ajv.getSchema(`${SCHEMA_ID_PREFIX}project/${version}.schema.json`));
}

test("schema metadata uses Draft 2020-12 stable IDs and closes repository refs", async () => {
  const schemas = await loadSchemas();
  const ids = new Set(schemas.map((schema) => schema.$id));
  assert.equal(ids.size, schemas.length, "schema IDs must be unique");

  for (const schema of schemas) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.match(schema.$id, /^https:\/\/schemas\.glt-flow-card\.invalid\/[a-z0-9./-]+\.schema\.json$/);
    visit(schema, (value, pointer) => {
      if (!value || typeof value !== "object" || !("$ref" in value)) return;
      const [target] = value.$ref.split("#");
      assert.ok(!target || ids.has(target), `${schema.$id}${pointer} has non-canonical ref ${value.$ref}`);
    });
  }

  const validators = await compiledProjectValidators();
  assert.ok(validators.every((validator) => typeof validator === "function"), "all project schemas compile locally");
});

test("schemas describe raw v0, v1, and v2 documents before normalization", async () => {
  const [validateV0, validateV1, validateV2] = await compiledProjectValidators();
  const legacy = {
    type: "custom:glt-flow-card",
    title: "Legacy",
    equipment: [{ id: "pump-1", type: "pump", x: 10, y: 20 }],
    paths: [{ id: "supply", from_equipment: "pump-1", points: [[0, 0], [10, 0]] }],
  };
  const current = { ...legacy, schema_version: 1 };
  const next = {
    ...legacy,
    schema_version: 2,
    project: { id: "plant-1", name: "Plant 1", revision: 0 },
    profiles: [{ id: "profile-1", equipment_type: "pump", slots: [] }],
    assets: [{ id: "asset-1", path: "assets/pump.svg", media_type: "image/svg+xml" }],
    extensions: { vendor: { enabled: true } },
  };

  assert.equal(validateV0(legacy), true, JSON.stringify(validateV0.errors));
  assert.equal(validateV1(current), true, JSON.stringify(validateV1.errors));
  assert.equal(validateV2(next), true, JSON.stringify(validateV2.errors));
  assert.equal(validateV0(current), false, "v0 is represented by an absent schema_version");
  assert.equal(validateV1({ ...current, schema_version: "1" }), false, "raw versions are not coerced");
  assert.equal(validateV2({ ...next, project: undefined }), false, "v2 project metadata is required before defaults");
  assert.equal(validateV2({ ...next, equipment: [{ type: "pump" }] }), false, "identified objects require raw IDs");
  assert.equal(validateV2({ ...next, equipment: [{ id: "bad id", type: "pump" }] }), false, "IDs use the bounded safe syntax");
  assert.equal(validateV2({ ...next, paths: [{ id: "path-1", from_equipment: 42 }] }), false, "references are typed before resolution");

  for (const path of PROJECT_SCHEMA_PATHS) {
    const schema = await readJson(path);
    visit(schema, (value, pointer) => {
      if (value && typeof value === "object") {
        assert.ok(!Object.hasOwn(value, "default"), `${path}${pointer} must not normalize or default raw input`);
      }
    });
  }
});

test("limits encode the complete JSON and archive resource budgets", async () => {
  const limits = await readJson("schemas/limits.json");
  assert.deepEqual(limits, {
    policy_version: 1,
    json: {
      max_bytes: 5 * 1024 * 1024,
      max_depth: 64,
      max_nodes: 100_000,
      max_string_bytes: 256 * 1024,
      max_id_chars: 128,
      max_path_chars: 512,
      max_errors: 100,
    },
    archive: {
      max_compressed_bytes: 32 * 1024 * 1024,
      max_entries: 256,
      max_asset_bytes: 16 * 1024 * 1024,
      max_expanded_bytes: 128 * 1024 * 1024,
      max_compression_ratio: 100,
    },
  });
});

test("diff policy declares identities, five categories, order, dependencies, and impact", async () => {
  const policy = await readJson("schemas/diff-policy.json");
  assert.equal(policy.policy_version, 1);
  assert.deepEqual(policy.categories, ["add", "remove", "move", "binding", "config"]);
  assert.deepEqual(Object.keys(policy.category_labels).sort(), [...policy.categories].sort());
  assert.ok(Object.keys(policy.identity_fields).length >= 8);
  for (const [collection, field] of Object.entries(policy.identity_fields)) {
    assert.match(collection, /^[a-z][a-z0-9_]*$/);
    assert.equal(field, "id");
  }
  assert.ok(policy.order.identity_keyed_collections.length > 0);
  assert.ok(policy.order.semantic_arrays.includes("paths.*.points"));
  assert.ok(policy.order.relevant_fields.includes("order"));
  assert.ok(policy.dependencies.references.some((entry) => entry.from === "paths" && entry.to === "equipment"));
  assert.deepEqual(policy.impact.severities, ["info", "warning", "critical"]);
  assert.deepEqual(policy.impact.vocabulary, ["none", "visual", "binding", "operational", "referential", "security"]);
});

test("canonical paths are singular and no second authored schema tree exists", async () => {
  for (const path of CONTRACT_PATHS) assert.ok(await readJson(path), `${path} must exist and parse`);
  const files = await walk(ROOT_PATH);
  const authoredSchemas = files
    .map((path) => relative(ROOT_PATH, path).replaceAll("\\", "/"))
    .filter((path) => path.endsWith(".schema.json"))
    .filter((path) => !path.startsWith("dist/") && !path.includes("/www/") && !path.startsWith("test/fixtures/"))
    .sort();
  assert.deepEqual(authoredSchemas, [...SCHEMA_PATHS].sort());
});
