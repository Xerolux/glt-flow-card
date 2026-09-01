import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_OUTPUTS = [
  "custom_components/glt_flow_card/build-manifest.json",
  "custom_components/glt_flow_card/schemas/bundle-manifest.schema.json",
  "custom_components/glt_flow_card/schemas/diff-policy.json",
  "custom_components/glt_flow_card/schemas/limits.json",
  "custom_components/glt_flow_card/schemas/project/0.schema.json",
  "custom_components/glt_flow_card/schemas/project/1.schema.json",
  "custom_components/glt_flow_card/schemas/project/2.schema.json",
  "custom_components/glt_flow_card/www/glt-flow-card.js",
  "dist/glt-flow-card.js",
  "dist/schemas/bundle-manifest.schema.json",
  "dist/schemas/diff-policy.json",
  "dist/schemas/limits.json",
  "dist/schemas/project/0.schema.json",
  "dist/schemas/project/1.schema.json",
  "dist/schemas/project/2.schema.json",
  "docs/editor/app.js",
];
const SCHEMA_OUTPUTS = [
  ["schemas/bundle-manifest.schema.json", "dist/schemas/bundle-manifest.schema.json"],
  ["schemas/diff-policy.json", "dist/schemas/diff-policy.json"],
  ["schemas/limits.json", "dist/schemas/limits.json"],
  ["schemas/project/0.schema.json", "dist/schemas/project/0.schema.json"],
  ["schemas/project/1.schema.json", "dist/schemas/project/1.schema.json"],
  ["schemas/project/2.schema.json", "dist/schemas/project/2.schema.json"],
];

let tempRoot;
let outputRoot;
let verifierResult;

function runBuild(root, extraArgs = []) {
  return spawnSync(
    process.execPath,
    ["tools/build.mjs", "--output-root", root, ...extraArgs],
    { cwd: ROOT, encoding: "utf8" },
  );
}

function runReleaseVerifier() {
  verifierResult ??= spawnSync(process.execPath, ["tools/verify-release.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return verifierResult;
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "glt-release-build-test-"));
  outputRoot = path.join(tempRoot, "output");
  const result = runBuild(outputRoot);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

after(async () => {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
});

test("single build stages the complete declared output set", async () => {
  for (const relativePath of BUILD_OUTPUTS) {
    const bytes = await readFile(path.join(outputRoot, relativePath));
    assert.ok(bytes.length > 0, `${relativePath} must be non-empty`);
  }
});

test("manifest is canonical, deterministic and non-circular", async () => {
  const manifestPath = path.join(
    outputRoot,
    "custom_components/glt_flow_card/build-manifest.json",
  );
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  assert.equal(raw, `${JSON.stringify(sorted(manifest), null, 2)}\n`);
  assert.equal(manifest.format, "glt-flow-card-build-manifest");
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.versions.package, "1.0.0");
  assert.equal(manifest.versions.companion, "1.0.0");
  assert.equal(manifest.versions.card, "1.0.0");
  assert.deepEqual(manifest.versions.project_schema, [0, 1, 2]);
  assert.match(manifest.build.commit, /^(?:[a-f0-9]{40}|WORKTREE)$/);
  assert.equal(typeof manifest.build.dirty, "boolean");
  assert.equal(manifest.tools.node, "22");
  assert.match(manifest.tools.esbuild, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.tools.ajv, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(
    manifest.artifacts.map(({ path: artifactPath }) => artifactPath),
    BUILD_OUTPUTS.filter((artifactPath) => !artifactPath.endsWith("build-manifest.json")),
  );
  assert.ok(!manifest.artifacts.some(({ path: artifactPath }) => artifactPath === path.relative(ROOT, manifestPath)));
  assert.ok(!raw.includes(ROOT));
  assert.ok(!/timestamp|generated_at|created_at/i.test(raw));
});

test("schema copies are byte-identical to canonical authored contracts", async () => {
  for (const [sourcePath, distPath] of SCHEMA_OUTPUTS) {
    const canonical = await readFile(path.join(ROOT, sourcePath));
    const dist = await readFile(path.join(outputRoot, distPath));
    const companion = await readFile(path.join(
      outputRoot,
      distPath.replace(/^dist\//, "custom_components/glt_flow_card/"),
    ));
    assert.deepEqual(dist, canonical, distPath);
    assert.deepEqual(companion, canonical, sourcePath);
  }
});

test("dist www bytes come from one assembled card image", async () => {
  const dist = await readFile(path.join(outputRoot, "dist/glt-flow-card.js"));
  const companion = await readFile(path.join(
    outputRoot,
    "custom_components/glt_flow_card/www/glt-flow-card.js",
  ));
  assert.deepEqual(companion, dist);
  const text = dist.toString("utf8");
  assert.match(text, /const VERSION = "1\.0\.0";/);
  assert.doesNotMatch(text, /^(\s*\/\/ )(?!node_modules\/).*?node_modules\//gmu);
});

test("double build produces identical path sets, bytes and manifests", () => {
  const result = runReleaseVerifier();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS double-build byte equality/);
  assert.match(result.stdout, /PASS checked-in generated outputs/);
});

test("drift mutations fail with artifact-specific evidence", () => {
  const result = runReleaseVerifier();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const evidence of [
    "one-byte: artifact hash mismatch: dist/glt-flow-card.js",
    "version: card/package version disagreement",
    "generated-source: canonical schema drift: dist/schemas/project/2.schema.json",
    "missing-output: missing generated output: docs/editor/app.js",
  ]) {
    assert.match(result.stdout, new RegExp(`PASS ${evidence.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
  }
});
