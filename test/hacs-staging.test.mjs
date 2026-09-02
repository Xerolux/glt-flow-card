import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js/index-native.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENT_ROOT = "custom_components/glt_flow_card";
const COMPONENT_FILES = [
  "__init__.py",
  "build-manifest.json",
  "config_flow.py",
  "configured_controls.py",
  "equipment_profiles.py",
  "const.py",
  "diagnostics.py",
  "manifest.json",
  "policy.py",
  "policy_sessions.py",
  "ports.py",
  "project_access.py",
  "project_bundle.py",
  "project_contract.py",
  "project_diff.py",
  "project_leases.py",
  "project_merge.py",
  "project_migrations.py",
  "project_repository.py",
  "project_transactions.py",
  "navigation.py",
  "alarm_vocabulary.py",
  "alarm_engine.py",
  "notifications.py",
  "panels.py",
  "provenance.py",
  "sdk_manifest.py",
  "sdk_registry.py",
  "semantic_model.py",
  "view_stream.py",
  "trusted_evidence.py",
  "schemas/bundle-manifest.schema.json",
  "schemas/diff-policy.json",
  "schemas/limits.json",
  "schemas/vocabularies.json",
  "schemas/project/0.schema.json",
  "schemas/project/1.schema.json",
  "schemas/project/2.schema.json",
  "schemas/project/3.schema.json",
  "schemas/project/4.schema.json",
  "schemas/project/5.schema.json",
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

function runValidator(outputRoot, category) {
  const args = ["tools/validate-hacs-staging.mjs", "--output-root", outputRoot];
  if (category) args.push("--category", category);
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

function canonicalJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
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

async function rewriteZip(zipPath, additions) {
  const original = await readZip(zipPath);
  const output = new Uint8ArrayWriter();
  const writer = new ZipWriter(output, {
    bufferedWrite: true,
    dataDescriptor: false,
    extendedTimestamp: false,
    keepOrder: true,
    level: 0,
    useCompressionStream: false,
    useWebWorkers: false,
    zip64: false,
  });
  const fixed = {
    bufferedWrite: true,
    dataDescriptor: false,
    extendedTimestamp: false,
    lastModDate: new Date(FIXED_ZIP_TIME),
    level: 0,
    unixMode: 0o100644,
    useCompressionStream: false,
    useWebWorkers: false,
    versionMadeBy: 20,
  };
  try {
    for (const [filename, bytes] of [...original.contents, ...additions]) {
      await writer.add(filename, new Uint8ArrayReader(bytes), fixed);
    }
    await writeFile(zipPath, Buffer.from(await writer.close(new Uint8Array(), { zip64: false })));
  } catch (error) {
    await writer.close().catch(() => undefined);
    throw error;
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
  assert.deepEqual(
    (await readdir(tempRoot)).filter((entry) => entry.startsWith(".glt-hacs-stage-")),
    [],
  );
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

test("plugin and integration category validators run independently without credentials", () => {
  const plugin = runValidator(firstRoot, "plugin");
  assert.equal(plugin.status, 0, `${plugin.stdout}\n${plugin.stderr}`);
  assert.match(plugin.stdout, /PASS HACS plugin category/);

  const integration = runValidator(firstRoot, "integration");
  assert.equal(integration.status, 0, `${integration.stdout}\n${integration.stderr}`);
  assert.match(integration.stdout, /PASS HACS integration category/);
  assert.match(integration.stdout, /PASS Companion ZIP install layout/);
  assert.match(integration.stdout, /PASS no publication credentials required/);
});

test("category layout version hash and archive mutations are rejected", async () => {
  const cases = [
    {
      name: "category-confusion",
      expected: "plugin category disagreement",
      mutate: async (root) => {
        const manifestPath = path.join(root, "hacs-staging-manifest.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        manifest.packages.plugin.category = "integration";
        await writeFile(manifestPath, canonicalJson(manifest));
      },
    },
    {
      name: "extra-integration-root",
      expected: "unexpected integration stage file",
      mutate: async (root) => {
        const extra = path.join(root, "hacs-integration/custom_components/other/manifest.json");
        await mkdir(path.dirname(extra), { recursive: true });
        await writeFile(extra, "{}\n");
      },
    },
    {
      name: "version-drift",
      expected: "Companion version disagreement",
      mutate: async (root) => {
        const manifestPath = path.join(root, "hacs-integration", COMPONENT_ROOT, "manifest.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        manifest.version = "9.9.9";
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      },
    },
    {
      name: "plugin-hash",
      expected: "plugin artifact hash mismatch",
      mutate: async (root) => {
        const cardPath = path.join(root, "hacs-plugin/glt-flow-card.js");
        await writeFile(cardPath, Buffer.concat([await readFile(cardPath), Buffer.from("\n// drift\n")]));
      },
    },
    {
      name: "unsafe-zip-root",
      expected: "unsafe ZIP member",
      mutate: (root) => rewriteZip(
        path.join(root, "glt-flow-card-companion.zip"),
        [["../escape.py", Buffer.from("unsafe\n")]],
      ),
    },
    {
      name: "extra-zip-member",
      expected: "ZIP member set disagreement",
      mutate: (root) => rewriteZip(
        path.join(root, "glt-flow-card-companion.zip"),
        [["unexpected.txt", Buffer.from("extra\n")]],
      ),
    },
    {
      name: "stale-www-copy",
      expected: "staged Companion file drift: www/glt-flow-card.js",
      mutate: async (root) => {
        const cardPath = path.join(root, "hacs-integration", COMPONENT_ROOT, "www/glt-flow-card.js");
        await writeFile(cardPath, Buffer.concat([await readFile(cardPath), Buffer.from("\n// stale\n")]));
      },
    },
    {
      name: "stale-schema-copy",
      expected: "staged Companion file drift: schemas/project/2.schema.json",
      mutate: async (root) => {
        const schemaPath = path.join(
          root,
          "hacs-integration",
          COMPONENT_ROOT,
          "schemas/project/2.schema.json",
        );
        await writeFile(schemaPath, Buffer.concat([await readFile(schemaPath), Buffer.from(" ")]));
      },
    },
  ];

  for (const mutation of cases) {
    const mutationRoot = path.join(tempRoot, `mutation-${mutation.name}`);
    await cp(firstRoot, mutationRoot, { recursive: true });
    await mutation.mutate(mutationRoot);
    const result = runValidator(mutationRoot);
    assert.notEqual(result.status, 0, `${mutation.name} unexpectedly passed`);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(mutation.expected), mutation.name);
  }
});

test("every generated Companion schema is packaged for HACS", async () => {
  // The Python module guard below did not cover schemas, and that gap shipped:
  // schema 3 and the vocabulary file reached the repository and the build but
  // not the HACS stage, so `project_contract.py` raised FileNotFoundError at
  // import inside the Home Assistant lanes - after every local gate had passed,
  // because the stager and the validator shared the same incomplete list.
  const schemaRoot = path.join(ROOT, "custom_components/glt_flow_card/schemas");
  const authored = [];
  const walk = async (directory, prefix) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else if (entry.name.endsWith(".json")) authored.push(`schemas/${relative}`);
    }
  };
  await walk(schemaRoot, "");
  assert.ok(authored.length >= 6, "the component ships no schemas, which cannot be right");

  // Checked against the staged output rather than against the stager's source
  // text. The original version grepped both tools for a literal path, which
  // worked only while the lists were literal -- deriving them from the schema
  // directory made the guard blind to exactly the files it exists to protect.
  // Asserting on the stage is also the stronger claim: the file is packaged,
  // not merely mentioned.
  // The stage the `before` hook already produced, read from disk.
  const stagedSchemaRoot = path.join(
    firstRoot, "hacs-integration/custom_components/glt_flow_card/schemas",
  );
  const stagedIntegration = new Set();
  const walkStaged = async (directory, prefix) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walkStaged(path.join(directory, entry.name), relative);
      else if (entry.name.endsWith(".json")) stagedIntegration.add(`schemas/${relative}`);
    }
  };
  await walkStaged(stagedSchemaRoot, "");
  for (const schemaPath of authored.sort()) {
    assert.ok(
      stagedIntegration.has(schemaPath),
      `${schemaPath} is not in the HACS integration stage`,
    );
  }
});

test("every authored Companion Python module is packaged for HACS", async () => {
  // A module that exists in the repository but not in the package is a silent
  // shipping bug: the integration imports it and dies at load time inside a
  // real Home Assistant, long after every local gate has passed. Deriving the
  // expectation from the directory means adding a module cannot forget this.
  const componentRoot = path.join(ROOT, "custom_components/glt_flow_card");
  const authored = (await readdir(componentRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".py"))
    .map((entry) => entry.name)
    .sort();

  const stagerSource = await readFile(path.join(ROOT, "tools/stage-hacs-packages.mjs"), "utf8");
  const validatorSource = await readFile(path.join(ROOT, "tools/validate-hacs-staging.mjs"), "utf8");

  for (const moduleName of authored) {
    assert.ok(
      stagerSource.includes(`"${moduleName}"`),
      `${moduleName} is not staged by tools/stage-hacs-packages.mjs`,
    );
    assert.ok(
      validatorSource.includes(`"${moduleName}"`),
      `${moduleName} is not expected by tools/validate-hacs-staging.mjs`,
    );
  }
});
