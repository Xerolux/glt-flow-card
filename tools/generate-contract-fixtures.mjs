/* Deterministic Phase-1 contract corpus generator; generated bodies stay disposable. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { load as loadYaml } from "js-yaml";

const ROOT = new URL("../", import.meta.url);
const LIMITS_URL = new URL("schemas/limits.json", ROOT);
const DIFF_POLICY_URL = new URL("schemas/diff-policy.json", ROOT);
const EXAMPLE_URL = new URL("examples/idm-neo2030.yaml", ROOT);
const SCHEMA_URLS = [0, 1, 2].map((version) => new URL(`schemas/project/${version}.schema.json`, ROOT));
const BUNDLE_SCHEMA_URL = new URL("schemas/bundle-manifest.schema.json", ROOT);

const STABLE_ERROR_CODES = [
  "bundle.asset_bytes",
  "bundle.asset_missing",
  "bundle.asset_unreferenced",
  "bundle.case_collision",
  "bundle.compressed_bytes",
  "bundle.compression_method",
  "bundle.compression_ratio",
  "bundle.crc",
  "bundle.encrypted",
  "bundle.entry_count",
  "bundle.entry_overlap",
  "bundle.expanded_bytes",
  "bundle.hash",
  "bundle.manifest_mismatch",
  "bundle.path_absolute",
  "bundle.path_backslash",
  "bundle.path_control",
  "bundle.path_duplicate",
  "bundle.path_traversal",
  "contract.dangling_reference",
  "contract.depth",
  "contract.duplicate_id",
  "contract.error_limit",
  "contract.id_length",
  "contract.id_pattern",
  "contract.json_bytes",
  "contract.nodes",
  "contract.path_length",
  "contract.required",
  "contract.schema_version",
  "contract.string_bytes",
  "contract.type",
];

const SCALE_PREFIX = "glt-scale-v1";
const FIXTURE_SEED = "glt-contract-corpus-v1";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function oneLineJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function expected(outcome, stage, path, code = undefined) {
  return { outcome, stage, ...(code ? { code } : {}), path };
}

function baseV2(overrides = {}) {
  return {
    type: "custom:glt-flow-card",
    schema_version: 2,
    project: { id: "fixture-project", name: "Fixture Project", revision: 0 },
    views: [{ id: "schematic", name: "Schematic" }],
    equipment: [],
    paths: [],
    datapoints: [],
    assets: [],
    profiles: [],
    ...overrides,
  };
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function scaleProject(objectCount) {
  const seed = `${SCALE_PREFIX}-${objectCount}`;
  const random = seededRandom(seed);
  const equipment = Array.from({ length: objectCount }, (_, index) => ({
    id: `eq_${String(index).padStart(4, "0")}`,
    type: ["pump", "valve", "sensor", "tank"][Math.floor(random() * 4)],
    x: Math.floor(random() * 1600),
    y: Math.floor(random() * 900),
  }));
  return { seed, project: baseV2({ equipment }) };
}

function nestedArray(depth) {
  let value = null;
  for (let index = 1; index < depth; index += 1) value = [value];
  return value;
}

function nodeTree(nodes) {
  return Array.from({ length: Math.max(0, nodes - 1) }, () => null);
}

function safePath(length) {
  return `a${"b".repeat(Math.max(0, length - 1))}`;
}

function archiveMetadata(field, value) {
  return { archive_fixture: true, [field]: value };
}

function relationValues(limit) {
  return { below: limit - 1, at: limit, above: limit + 1 };
}

async function fileHash(url) {
  return sha256(await readFile(url));
}

export async function generateContractFixtures({ outputDir }) {
  if (!outputDir) throw new TypeError("outputDir is required");
  const absoluteOutput = resolve(outputDir);
  const bodyDir = resolve(absoluteOutput, "bodies");
  await mkdir(bodyDir, { recursive: true });

  const limits = JSON.parse(await readFile(LIMITS_URL, "utf8"));
  const exampleBytes = await readFile(EXAMPLE_URL);
  const example = loadYaml(exampleBytes.toString("utf8"));
  const fixtures = [];

  async function addFixture(metadata, bytes, { canonicalDigest = false } = {}) {
    const digest = sha256(bytes);
    const fixture = {
      id: metadata.id,
      class: metadata.class,
      file: `bodies/${metadata.id}.json`,
      bytes: bytes.length,
      sha256: digest,
      evidence_scope: "correctness_only",
      ...metadata.details,
      expected: {
        ...metadata.expected,
        ...(canonicalDigest ? { canonical_sha256: digest } : {}),
      },
    };
    await writeFile(resolve(absoluteOutput, fixture.file), bytes);
    fixtures.push(fixture);
  }

  async function addJson(metadata, value, options = {}) {
    await addFixture(metadata, options.compact ? oneLineJsonBytes(value) : jsonBytes(value), options);
  }

  await addJson({
    id: "golden-v0-idm-example",
    class: "golden",
    details: { source: "examples/idm-neo2030.yaml", schema_version: 0 },
    expected: expected("accept", "contract", "/"),
  }, example, { canonicalDigest: true });
  await addJson({
    id: "golden-v1-current",
    class: "golden",
    details: { schema_version: 1 },
    expected: expected("accept", "contract", "/"),
  }, { ...example, schema_version: 1 }, { canonicalDigest: true });
  await addJson({
    id: "golden-v2-profile-asset",
    class: "golden",
    details: { schema_version: 2 },
    expected: expected("accept", "contract", "/"),
  }, baseV2({
    equipment: [{ id: "pump-1", type: "pump", profile: "profile-1", asset_id: "asset-1" }],
    profiles: [{ id: "profile-1", equipment_type: "pump", slots: [] }],
    assets: [{ id: "asset-1", path: "assets/pump.svg", media_type: "image/svg+xml" }],
    extensions: { fixture: { enabled: true } },
  }), { canonicalDigest: true });

  await addJson({
    id: "malformed-root-type",
    class: "malformed",
    expected: expected("reject", "schema", "/", "contract.type"),
  }, []);
  await addJson({
    id: "malformed-equipment-required-id",
    class: "malformed",
    expected: expected("reject", "schema", "/equipment/0/id", "contract.required"),
  }, baseV2({ equipment: [{ type: "pump" }] }));
  await addJson({
    id: "malformed-future-version",
    class: "malformed",
    expected: expected("reject", "version", "/schema_version", "contract.schema_version"),
  }, { ...baseV2(), schema_version: 3 });
  await addJson({
    id: "raw-trap-missing-type",
    class: "raw_normalization_trap",
    details: { normalization_would_supply: ["type"] },
    expected: expected("reject", "schema", "/type", "contract.required"),
  }, { schema_version: 1, equipment: [] });
  await addJson({
    id: "raw-trap-string-version",
    class: "raw_normalization_trap",
    details: { normalization_would_coerce: ["schema_version"] },
    expected: expected("reject", "schema", "/schema_version", "contract.type"),
  }, { ...baseV2(), schema_version: "2" });
  await addJson({
    id: "duplicate-equipment-id",
    class: "reference_integrity",
    expected: expected("reject", "references", "/equipment/1/id", "contract.duplicate_id"),
  }, baseV2({ equipment: [{ id: "pump-1", type: "pump" }, { id: "pump-1", type: "pump" }] }));
  await addJson({
    id: "dangling-path-equipment",
    class: "reference_integrity",
    expected: expected("reject", "references", "/paths/0/to_equipment", "contract.dangling_reference"),
  }, baseV2({
    equipment: [{ id: "pump-1", type: "pump" }],
    paths: [{ id: "supply", from_equipment: "pump-1", to_equipment: "missing" }],
  }));
  await addJson({
    id: "malicious-regex-hostile-id",
    class: "malicious_string",
    expected: expected("reject", "schema", "/equipment/0/id", "contract.id_pattern"),
  }, baseV2({ equipment: [{ id: `${"a".repeat(127)}!`, type: "pump" }] }));
  await addJson({
    id: "malicious-embedded-control-path",
    class: "malicious_path",
    expected: expected("reject", "archive_preflight", "/entries/0/path", "bundle.path_control"),
  }, archiveMetadata("entries", [{ path: "assets/control\u0000.svg" }]));

  const jsonBoundaryBuilders = {
    max_bytes: (value) => Buffer.from(JSON.stringify("x".repeat(Math.max(0, value - 2))), "utf8"),
    max_depth: (value) => oneLineJsonBytes(nestedArray(value)),
    max_nodes: (value) => oneLineJsonBytes(nodeTree(value)),
    max_string_bytes: (value) => oneLineJsonBytes(baseV2({ title: "x".repeat(value) })),
    max_id_chars: (value) => oneLineJsonBytes(baseV2({ equipment: [{ id: "a".repeat(value), type: "pump" }] })),
    max_path_chars: (value) => oneLineJsonBytes(baseV2({ assets: [{ id: "asset-1", path: safePath(value) }] })),
    max_errors: (value) => oneLineJsonBytes(baseV2({ equipment: Array.from({ length: value }, () => ({ type: "pump" })) })),
  };
  const jsonAboveCodes = {
    max_bytes: "contract.json_bytes",
    max_depth: "contract.depth",
    max_nodes: "contract.nodes",
    max_string_bytes: "contract.string_bytes",
    max_id_chars: "contract.id_length",
    max_path_chars: "contract.path_length",
    max_errors: "contract.error_limit",
  };
  const jsonPointers = {
    max_bytes: "/",
    max_depth: "/",
    max_nodes: "/",
    max_string_bytes: "/title",
    max_id_chars: "/equipment/0/id",
    max_path_chars: "/assets/0/path",
    max_errors: "/errors",
  };

  for (const [name, limit] of Object.entries(limits.json)) {
    for (const [relation, value] of Object.entries(relationValues(limit))) {
      const above = relation === "above";
      const errorCap = name === "max_errors";
      await addFixture({
        id: `limit-json-${name.replaceAll("_", "-")}-${relation}`,
        class: "json_limit_boundary",
        details: { boundary: { policy_path: `json.${name}`, relation, value } },
        expected: expected(
          above ? "reject" : errorCap ? "reject_with_bounded_errors" : "accept_preflight",
          errorCap ? "error_normalization" : "json_preflight",
          jsonPointers[name],
          above ? jsonAboveCodes[name] : errorCap ? "contract.required" : undefined,
        ),
      }, jsonBoundaryBuilders[name](value));
    }
  }

  const archiveFieldNames = {
    max_compressed_bytes: "compressed_bytes",
    max_entries: "entry_count",
    max_asset_bytes: "asset_bytes",
    max_expanded_bytes: "expanded_bytes",
    max_compression_ratio: "compression_ratio",
  };
  const archiveAboveCodes = {
    max_compressed_bytes: "bundle.compressed_bytes",
    max_entries: "bundle.entry_count",
    max_asset_bytes: "bundle.asset_bytes",
    max_expanded_bytes: "bundle.expanded_bytes",
    max_compression_ratio: "bundle.compression_ratio",
  };
  for (const [name, limit] of Object.entries(limits.archive)) {
    for (const [relation, value] of Object.entries(relationValues(limit))) {
      const above = relation === "above";
      const field = archiveFieldNames[name];
      await addJson({
        id: `limit-archive-${name.replaceAll("_", "-")}-${relation}`,
        class: "archive_limit_metadata",
        details: { boundary: { policy_path: `archive.${name}`, relation, value } },
        expected: expected(above ? "reject" : "accept_preflight", "archive_preflight", `/archive/${field}`, above ? archiveAboveCodes[name] : undefined),
      }, archiveMetadata(field, value), { compact: true });
    }
  }

  const archiveHostile = [
    ["absolute", "bundle.path_absolute", "/entries/0/path", { path: "/etc/passwd" }],
    ["traversal", "bundle.path_traversal", "/entries/0/path", { path: "assets/../project.json" }],
    ["backslash", "bundle.path_backslash", "/entries/0/path", { path: "assets\\pump.svg" }],
    ["duplicate", "bundle.path_duplicate", "/entries/1/path", { paths: ["assets/a.svg", "assets/a.svg"] }],
    ["case-collision", "bundle.case_collision", "/entries/1/path", { paths: ["assets/A.svg", "assets/a.svg"] }],
    ["encrypted", "bundle.encrypted", "/entries/0/encrypted", { encrypted: true }],
    ["method", "bundle.compression_method", "/entries/0/compression", { compression: "bzip2" }],
    ["crc", "bundle.crc", "/entries/0/crc32", { crc32: "00000000", actual_crc32: "ffffffff" }],
    ["hash", "bundle.hash", "/entries/0/sha256", { sha256: "0".repeat(64), actual_sha256: "f".repeat(64) }],
    ["overlap", "bundle.entry_overlap", "/entries/1/offset", { ranges: [[0, 100], [50, 150]] }],
    ["manifest-mismatch", "bundle.manifest_mismatch", "/manifest/project/id", { manifest_project_id: "a", project_id: "b" }],
    ["asset-missing", "bundle.asset_missing", "/manifest/assets/0/path", { declared: ["assets/a.svg"], entries: [] }],
    ["asset-unreferenced", "bundle.asset_unreferenced", "/entries/1/path", { declared: [], entries: ["assets/a.svg"] }],
  ];
  for (const [name, code, path, seed] of archiveHostile) {
    await addJson({
      id: `archive-hostile-${name}`,
      class: "malicious_path",
      details: { future_owner: "01-06", metadata_only: true },
      expected: expected("reject", "archive_preflight", path, code),
    }, archiveMetadata("seed", seed), { compact: true });
  }

  for (const objectCount of [100, 500, 2000]) {
    const { seed, project } = scaleProject(objectCount);
    await addJson({
      id: `scale-correctness-${objectCount}`,
      class: "scale_correctness",
      details: { object_count: objectCount, seed },
      expected: expected("accept", "contract_and_diff", "/"),
    }, project, { canonicalDigest: true, compact: true });
  }

  const coveredCodes = new Set(fixtures.map((fixture) => fixture.expected.code).filter(Boolean));
  const missingCodes = STABLE_ERROR_CODES.filter((code) => !coveredCodes.has(code));
  const unknownCodes = [...coveredCodes].filter((code) => !STABLE_ERROR_CODES.includes(code));
  if (missingCodes.length || unknownCodes.length) {
    throw new Error(`stable error coverage mismatch: missing=${missingCodes.join(",")} unknown=${unknownCodes.join(",")}`);
  }

  const schemaHashes = {};
  for (let version = 0; version < SCHEMA_URLS.length; version += 1) {
    schemaHashes[String(version)] = await fileHash(SCHEMA_URLS[version]);
  }
  const manifest = {
    format_version: 1,
    evidence: {
      phase: "01",
      classification: "bounded_contract_correctness",
      capacity_certification: false,
      performance_certification: false,
      scope_note: "Correctness-only inputs; Phase 10 owns measured scale evidence.",
    },
    seeds: {
      fixture: FIXTURE_SEED,
      scale_prefix: SCALE_PREFIX,
    },
    policies: {
      limits_sha256: await fileHash(LIMITS_URL),
      diff_policy_sha256: await fileHash(DIFF_POLICY_URL),
      bundle_schema_sha256: await fileHash(BUNDLE_SCHEMA_URL),
      project_schema_sha256: schemaHashes,
    },
    provenance: [{
      source: "examples/idm-neo2030.yaml",
      role: "documented_legacy_golden",
      sha256: sha256(exampleBytes),
    }],
    stable_error_codes: STABLE_ERROR_CODES,
    fixtures,
  };
  await writeFile(resolve(absoluteOutput, "manifest.json"), jsonBytes(manifest));
  return manifest;
}

async function main(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex < 0 || !argv[outputIndex + 1]) {
    throw new Error("usage: node tools/generate-contract-fixtures.mjs --output <directory>");
  }
  await generateContractFixtures({ outputDir: argv[outputIndex + 1] });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
