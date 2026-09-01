import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalizeJson } from "../src/v100/project-contract.mjs";

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
  const bundleSchema = await readJson("schemas/bundle-manifest.schema.json");
  assert.equal(bundleSchema.properties.assets.maxItems, limits.archive.max_entries - 2, "manifest and project consume two archive entries");
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

test("canonical authored schema paths stay singular alongside generated release copies", async () => {
  for (const path of CONTRACT_PATHS) assert.ok(await readJson(path), `${path} must exist and parse`);
  const files = await walk(ROOT_PATH);
  const authoredSchemas = files
    .map((path) => relative(ROOT_PATH, path).replaceAll("\\", "/"))
    .filter((path) => path.endsWith(".schema.json"))
    .filter((path) => !path.startsWith("dist/"))
    .filter((path) => !path.startsWith("custom_components/glt_flow_card/schemas/"))
    .filter((path) => !path.startsWith(
      "build/release/hacs-integration/custom_components/glt_flow_card/schemas/",
    ))
    .filter((path) => !path.includes("/www/") && !path.startsWith("test/fixtures/"))
    .sort();
  assert.deepEqual(authoredSchemas, [...SCHEMA_PATHS].sort());
});

async function directorySnapshot(directory) {
  const files = await walk(directory);
  const entries = await Promise.all(files.map(async (path) => {
    const bytes = await readFile(path);
    return [
      relative(directory, path).replaceAll("\\", "/"),
      { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") },
    ];
  }));
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

async function withFixtureTemp(run) {
  const root = await mkdtemp(join(tmpdir(), "glt-contract-fixtures-"));
  try {
    return await run(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function flattenLimits(limits) {
  return Object.fromEntries(Object.entries(limits)
    .filter(([key]) => key !== "policy_version")
    .flatMap(([section, values]) => Object.entries(values).map(([name, value]) => [`${section}.${name}`, value])));
}

test("fixture generator is deterministic across independent temporary runs", async () => {
  const { generateContractFixtures } = await import("../tools/generate-contract-fixtures.mjs");
  await withFixtureTemp(async (root) => {
    const first = join(root, "first");
    const second = join(root, "second");
    await generateContractFixtures({ outputDir: first });
    await generateContractFixtures({ outputDir: second });
    assert.deepEqual(await directorySnapshot(first), await directorySnapshot(second));
  });
});

test("fixture manifest covers stable outcomes, raw traps, hostile input, and every limit boundary", async () => {
  const { generateContractFixtures } = await import("../tools/generate-contract-fixtures.mjs");
  await withFixtureTemp(async (outputDir) => {
    await generateContractFixtures({ outputDir });
    const generated = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
    const committed = await readJson("test/fixtures/contracts/manifest.json");
    assert.deepEqual(generated, committed, "committed manifest must be an exact generator snapshot");

    assert.deepEqual(Object.keys(generated).sort(), [
      "evidence",
      "fixtures",
      "format_version",
      "policies",
      "provenance",
      "seeds",
      "stable_error_codes",
    ]);
    assert.equal(generated.evidence.phase, "01");
    assert.equal(generated.evidence.classification, "bounded_contract_correctness");
    assert.equal(generated.evidence.capacity_certification, false);
    assert.equal(generated.evidence.performance_certification, false);
    assert.doesNotMatch(JSON.stringify(generated), /validated capacity|capacity of|supports (?:at least )?\d+ objects|performance certified|benchmark result/i);

    const classes = new Set(generated.fixtures.map((fixture) => fixture.class));
    for (const fixtureClass of [
      "golden",
      "malformed",
      "raw_normalization_trap",
      "reference_integrity",
      "malicious_string",
      "malicious_path",
      "json_limit_boundary",
      "archive_limit_metadata",
      "scale_correctness",
    ]) assert.ok(classes.has(fixtureClass), `missing ${fixtureClass} fixture class`);

    const coveredCodes = new Set(generated.fixtures.map((fixture) => fixture.expected.code).filter(Boolean));
    assert.deepEqual([...coveredCodes].sort(), [...generated.stable_error_codes].sort());
    for (const fixture of generated.fixtures) {
      assert.match(fixture.sha256, /^[a-f0-9]{64}$/);
      assert.ok(Number.isSafeInteger(fixture.bytes) && fixture.bytes > 0);
      assert.equal(fixture.evidence_scope, "correctness_only");
      assert.match(fixture.expected.path, /^\/(?:[^~]|~[01])*$/);
    }

    const limits = flattenLimits(await readJson("schemas/limits.json"));
    for (const [policyPath, value] of Object.entries(limits)) {
      const fixtures = generated.fixtures.filter((fixture) => fixture.boundary?.policy_path === policyPath);
      assert.deepEqual(fixtures.map((fixture) => fixture.boundary.relation).sort(), ["above", "at", "below"], `${policyPath} boundary classes`);
      const byRelation = Object.fromEntries(fixtures.map((fixture) => [fixture.boundary.relation, fixture.boundary.value]));
      assert.equal(byRelation.at, value);
      assert.ok(byRelation.below < value);
      assert.ok(byRelation.above > value);
    }
  });
});

test("scale fixtures are fixed-seed correctness classes with expected digests, not capacity claims", async () => {
  const { generateContractFixtures } = await import("../tools/generate-contract-fixtures.mjs");
  await withFixtureTemp(async (outputDir) => {
    await generateContractFixtures({ outputDir });
    const manifest = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
    const scales = manifest.fixtures.filter((fixture) => fixture.class === "scale_correctness");
    assert.deepEqual(scales.map((fixture) => fixture.object_count), [100, 500, 2000]);
    assert.ok(scales.every((fixture) => fixture.seed === generatedScaleSeed(manifest, fixture.object_count)));
    assert.ok(scales.every((fixture) => fixture.expected.outcome === "accept"));
    for (const fixture of scales) {
      const document = JSON.parse(await readFile(join(outputDir, fixture.file), "utf8"));
      const canonicalDigest = createHash("sha256").update(canonicalizeJson(document), "utf8").digest("hex");
      assert.equal(fixture.expected.canonical_sha256, canonicalDigest);
    }
    assert.ok(scales.every((fixture) => !Object.hasOwn(fixture, "duration_ms") && !Object.hasOwn(fixture, "throughput")));
  });
});

function generatedScaleSeed(manifest, objectCount) {
  return `${manifest.seeds.scale_prefix}-${objectCount}`;
}

test("fixture bodies match manifest digests and bulky generated evidence is not committed", async () => {
  const { generateContractFixtures } = await import("../tools/generate-contract-fixtures.mjs");
  await withFixtureTemp(async (outputDir) => {
    await generateContractFixtures({ outputDir });
    const manifest = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
    const validators = await compiledProjectValidators();
    for (const fixture of manifest.fixtures) {
      const bytes = await readFile(join(outputDir, fixture.file));
      assert.equal(bytes.length, fixture.bytes, fixture.id);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.sha256, fixture.id);
      if (["golden", "scale_correctness"].includes(fixture.class)) {
        const document = JSON.parse(bytes);
        const version = document.schema_version ?? 0;
        assert.equal(validators[version](document), true, `${fixture.id}: ${JSON.stringify(validators[version].errors)}`);
      }
    }
    const exampleBytes = await readFile(new URL("examples/idm-neo2030.yaml", ROOT));
    assert.equal(manifest.provenance[0].sha256, createHash("sha256").update(exampleBytes).digest("hex"));
  });

  const committedEntries = await readdir(new URL("fixtures/contracts/", import.meta.url));
  assert.deepEqual(committedEntries.sort(), ["manifest.json"]);
});
