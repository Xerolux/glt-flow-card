import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
} from "@zip.js/zip.js/index-native.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENT_ROOT = "custom_components/glt_flow_card";
const COMPONENT_FILES = [
  "__init__.py",
  "build-manifest.json",
  "config_flow.py",
  "const.py",
  "diagnostics.py",
  "manifest.json",
  "project_bundle.py",
  "project_contract.py",
  "project_diff.py",
  "project_migrations.py",
  "project_repository.py",
  "project_transactions.py",
  "schemas/bundle-manifest.schema.json",
  "schemas/project/0.schema.json",
  "schemas/project/1.schema.json",
  "schemas/project/2.schema.json",
  "strings.json",
  "translations/de.json",
  "translations/en.json",
  "www/glt-flow-card.js",
];
const FIXED_ZIP_TIME = new Date("1980-01-01T00:00:00.000Z").getTime();

let tempRoot;
let firstRoot;
let secondRoot;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runStage(outputRoot) {
  return spawnSync(
    process.execPath,
    ["tools/stage-hacs-packages.mjs", "--output-root", outputRoot],
    { cwd: ROOT, encoding: "utf8" },
  );
}

async function readZip(zipPath) {
  const bytes = await readFile(zipPath);
  const reader = new ZipReader(new Uint8ArrayReader(bytes), {
    strictness: "strict",
    useWebWorkers: false,
  });
  try {
    const entries = await reader.getEntries({ strictness: "strict" });
    const contents = new Map();
    for (const entry of entries) {
      assert.equal(entry.directory, false, `${entry.filename} must be a file entry`);
      contents.set(
        entry.filename,
        Buffer.from(await entry.getData(new Uint8ArrayWriter(), {
          checkSignature: true,
          useWebWorkers: false,
        })),
      );
    }
    return { bytes, entries, contents };
  } finally {
    await reader.close();
  }
}

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "glt-hacs-stage-test-"));
  firstRoot = path.join(tempRoot, "first");
  secondRoot = path.join(tempRoot, "second");
  for (const outputRoot of [firstRoot, secondRoot]) {
    const result = runStage(outputRoot);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
});

after(async () => {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
});

test("stage contains exact plugin and integration category packages", async () => {
  const buildManifest = JSON.parse(await readFile(
    path.join(ROOT, COMPONENT_ROOT, "build-manifest.json"),
    "utf8",
  ));
  const stagingManifest = JSON.parse(await readFile(
    path.join(firstRoot, "hacs-staging-manifest.json"),
    "utf8",
  ));
  const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));

  assert.equal(stagingManifest.format, "glt-flow-card-hacs-staging-manifest");
  assert.equal(stagingManifest.manifest_version, 1);
  assert.equal(stagingManifest.version, packageJson.version);
  assert.equal(stagingManifest.build_manifest.sha256, sha256(await readFile(
    path.join(ROOT, COMPONENT_ROOT, "build-manifest.json"),
  )));
  assert.equal(stagingManifest.packages.plugin.category, "plugin");
  assert.equal(stagingManifest.packages.integration.category, "integration");

  const stagedCard = await readFile(path.join(firstRoot, "hacs-plugin/glt-flow-card.js"));
  const distCard = await readFile(path.join(ROOT, "dist/glt-flow-card.js"));
  assert.deepEqual(stagedCard, distCard);
  assert.equal(
    sha256(stagedCard),
    buildManifest.artifacts.find(({ path: artifactPath }) => (
      artifactPath === "dist/glt-flow-card.js"
    )).sha256,
  );

  const integrationHacs = JSON.parse(await readFile(
    path.join(firstRoot, "hacs-integration/hacs.json"),
    "utf8",
  ));
  assert.deepEqual(integrationHacs, {
    filename: "glt-flow-card-companion.zip",
    homeassistant: "2024.8.0",
    name: "GLT Flow Card Companion",
    render_readme: true,
    zip_release: true,
  });

  for (const relativePath of COMPONENT_FILES) {
    const source = await readFile(path.join(ROOT, COMPONENT_ROOT, relativePath));
    const staged = await readFile(path.join(
      firstRoot,
      "hacs-integration",
      COMPONENT_ROOT,
      relativePath,
    ));
    assert.deepEqual(staged, source, relativePath);
  }
});

test("zip is deterministic and extracts into the HACS integration install target", async () => {
  const first = await readZip(path.join(firstRoot, "glt-flow-card-companion.zip"));
  const second = await readZip(path.join(secondRoot, "glt-flow-card-companion.zip"));
  assert.deepEqual(first.bytes, second.bytes);
  assert.deepEqual(first.entries.map(({ filename }) => filename), COMPONENT_FILES);

  for (const entry of first.entries) {
    assert.equal(entry.lastModDate.getTime(), FIXED_ZIP_TIME, entry.filename);
    assert.equal(entry.unixMode & 0o777, 0o644, entry.filename);
    assert.ok(!entry.filename.startsWith("custom_components/"), entry.filename);
    assert.ok(!entry.filename.includes(".."), entry.filename);
    assert.ok(!entry.filename.includes("\\"), entry.filename);
  }

  for (const relativePath of COMPONENT_FILES) {
    const staged = await readFile(path.join(
      firstRoot,
      "hacs-integration",
      COMPONENT_ROOT,
      relativePath,
    ));
    assert.deepEqual(first.contents.get(relativePath), staged, relativePath);
  }
  const componentManifest = JSON.parse(first.contents.get("manifest.json").toString("utf8"));
  const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(componentManifest.domain, "glt_flow_card");
  assert.equal(componentManifest.version, packageJson.version);
});

test("no publication target credential or upload path is required", async () => {
  const stageSource = await readFile(path.join(ROOT, "tools/stage-hacs-packages.mjs"), "utf8");
  const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  const integrationHacs = JSON.parse(await readFile(
    path.join(ROOT, "packaging/hacs-integration/hacs.json"),
    "utf8",
  ));

  assert.doesNotMatch(stageSource, /process\.env|fetch\s*\(|node:https|node:http|child_process/);
  assert.ok(!Object.hasOwn(integrationHacs, "repository"));
  assert.ok(!Object.hasOwn(integrationHacs, "user_setup"));
  assert.ok(!Object.keys(packageJson.scripts).some((name) => /publish|upload|mirror/i.test(name)));
  assert.ok(!Object.values(packageJson.scripts).some((command) => /publish|upload|mirror|token/i.test(command)));
});
