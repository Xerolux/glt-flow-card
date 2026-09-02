/* Stage local plugin and integration-category HACS packages from verified outputs. */
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from "@zip.js/zip.js/index-native.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_ROOT = path.join(ROOT, "build/release");
const BUILD_MANIFEST_PATH = "custom_components/glt_flow_card/build-manifest.json";
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
  "project_access.py",
  "project_bundle.py",
  "project_contract.py",
  "project_diff.py",
  "project_leases.py",
  "project_merge.py",
  "project_migrations.py",
  "project_repository.py",
  "project_transactions.py",
  "provenance.py",
  "trusted_evidence.py",
  "schemas/bundle-manifest.schema.json",
  "schemas/diff-policy.json",
  "schemas/limits.json",
  "schemas/vocabularies.json",
  "schemas/project/0.schema.json",
  "schemas/project/1.schema.json",
  "schemas/project/2.schema.json",
  "schemas/project/3.schema.json",
  "strings.json",
  "translations/de.json",
  "translations/en.json",
  "www/glt-flow-card.js",
];
const GENERATED_COMPONENT_ARTIFACTS = new Set([
  "build-manifest.json",
  "schemas/bundle-manifest.schema.json",
  "schemas/diff-policy.json",
  "schemas/limits.json",
  "schemas/vocabularies.json",
  "schemas/project/0.schema.json",
  "schemas/project/1.schema.json",
  "schemas/project/2.schema.json",
  "schemas/project/3.schema.json",
  "www/glt-flow-card.js",
]);
const FIXED_ZIP_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

function canonicalJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

function parseOutputRoot() {
  const index = process.argv.indexOf("--output-root");
  if (index === -1) return DEFAULT_OUTPUT_ROOT;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    throw new Error("--output-root requires a path");
  }
  const outputRoot = path.resolve(process.argv[index + 1]);
  if (outputRoot === ROOT || outputRoot === path.parse(outputRoot).root) {
    throw new Error("refusing unsafe HACS staging output root");
  }
  return outputRoot;
}

async function descriptor(root, relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return { path: relativePath.replaceAll("\\", "/"), sha256: sha256(bytes), size: bytes.length };
}

async function copyRelative(sourceRoot, targetRoot, relativePath) {
  const target = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(sourceRoot, relativePath), target);
}

async function verifyBuildManifest(buildManifest, buildManifestBytes, packageJson, componentManifest) {
  if (buildManifest.format !== "glt-flow-card-build-manifest" || buildManifest.manifest_version !== 1) {
    throw new Error("invalid canonical build manifest format/version");
  }
  for (const authority of [
    buildManifest.versions.package,
    buildManifest.versions.card,
    buildManifest.versions.companion,
    componentManifest.version,
  ]) {
    if (authority !== packageJson.version) throw new Error("build/package version disagreement");
  }
  if (buildManifestBytes.toString("utf8") !== canonicalJson(buildManifest)) {
    throw new Error("build manifest is not canonical JSON");
  }
  for (const source of buildManifest.sources) {
    const bytes = await readFile(path.join(ROOT, source.path));
    if (sha256(bytes) !== source.sha256 || bytes.length !== source.size) {
      throw new Error(`canonical build source drift: ${source.path}`);
    }
  }

  const requiredArtifacts = [
    "dist/glt-flow-card.js",
    `${COMPONENT_ROOT}/www/glt-flow-card.js`,
    `${COMPONENT_ROOT}/schemas/bundle-manifest.schema.json`,
    `${COMPONENT_ROOT}/schemas/project/0.schema.json`,
    `${COMPONENT_ROOT}/schemas/project/1.schema.json`,
    `${COMPONENT_ROOT}/schemas/project/2.schema.json`,
  ];
  for (const relativePath of requiredArtifacts) {
    const expected = buildManifest.artifacts.find(({ path: artifactPath }) => artifactPath === relativePath);
    if (!expected) throw new Error(`build manifest artifact missing: ${relativePath}`);
    const bytes = await readFile(path.join(ROOT, relativePath));
    if (sha256(bytes) !== expected.sha256 || bytes.length !== expected.size) {
      throw new Error(`verified build artifact drift: ${relativePath}`);
    }
  }
  const dist = await readFile(path.join(ROOT, "dist/glt-flow-card.js"));
  const companion = await readFile(path.join(ROOT, COMPONENT_ROOT, "www/glt-flow-card.js"));
  if (!dist.equals(companion)) throw new Error("dist and Companion card artifacts differ");
}

async function makeCompanionZip() {
  const output = new Uint8ArrayWriter();
  const writer = new ZipWriter(output, {
    bufferedWrite: true,
    dataDescriptor: false,
    extendedTimestamp: false,
    keepOrder: true,
    level: 0,
    useCompressionStream: false,
    useUnicodeFileNames: true,
    useWebWorkers: false,
    zip64: false,
  });
  const fixed = {
    bufferedWrite: true,
    dataDescriptor: false,
    extendedTimestamp: false,
    lastModDate: FIXED_ZIP_DATE,
    level: 0,
    unixMode: 0o100644,
    useCompressionStream: false,
    useWebWorkers: false,
    versionMadeBy: 20,
  };
  try {
    for (const relativePath of COMPONENT_FILES) {
      const bytes = await readFile(path.join(ROOT, COMPONENT_ROOT, relativePath));
      await writer.add(relativePath, new Uint8ArrayReader(bytes), fixed);
    }
    return Buffer.from(await writer.close(new Uint8Array(), { zip64: false }));
  } catch (error) {
    await writer.close().catch(() => undefined);
    throw error;
  }
}

async function stagePackages(outputRoot) {
  const outputParent = path.dirname(outputRoot);
  await mkdir(outputParent, { recursive: true });
  const tempRoot = await mkdtemp(path.join(outputParent, ".glt-hacs-stage-"));
  try {
    const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
    const componentManifest = JSON.parse(await readFile(
      path.join(ROOT, COMPONENT_ROOT, "manifest.json"),
      "utf8",
    ));
    const buildManifestBytes = await readFile(path.join(ROOT, BUILD_MANIFEST_PATH));
    const buildManifest = JSON.parse(buildManifestBytes);
    await verifyBuildManifest(buildManifest, buildManifestBytes, packageJson, componentManifest);

    const pluginRoot = path.join(tempRoot, "hacs-plugin");
    await copyRelative(ROOT, pluginRoot, "dist/glt-flow-card.js");
    await rename(
      path.join(pluginRoot, "dist/glt-flow-card.js"),
      path.join(pluginRoot, "glt-flow-card.js"),
    );
    await rm(path.join(pluginRoot, "dist"), { recursive: true, force: true });
    await copyFile(path.join(ROOT, "packaging/hacs-plugin/hacs.json"), path.join(pluginRoot, "hacs.json"));
    await copyFile(path.join(ROOT, "README.md"), path.join(pluginRoot, "README.md"));

    const integrationRoot = path.join(tempRoot, "hacs-integration");
    await mkdir(integrationRoot, { recursive: true });
    await copyFile(
      path.join(ROOT, "packaging/hacs-integration/hacs.json"),
      path.join(integrationRoot, "hacs.json"),
    );
    await copyFile(
      path.join(ROOT, "packaging/hacs-integration/README.md"),
      path.join(integrationRoot, "README.md"),
    );
    for (const relativePath of COMPONENT_FILES) {
      await copyRelative(ROOT, integrationRoot, `${COMPONENT_ROOT}/${relativePath}`);
    }

    const zipBytes = await makeCompanionZip();
    await writeFile(path.join(tempRoot, "glt-flow-card-companion.zip"), zipBytes);

    const pluginFiles = ["README.md", "glt-flow-card.js", "hacs.json"];
    const integrationFiles = [
      "README.md",
      "hacs.json",
      ...COMPONENT_FILES.map((relativePath) => `${COMPONENT_ROOT}/${relativePath}`),
    ];
    const sourceFiles = await Promise.all(COMPONENT_FILES.map(async (relativePath) => ({
      ...await descriptor(path.join(ROOT, COMPONENT_ROOT), relativePath),
      build_artifact: GENERATED_COMPONENT_ARTIFACTS.has(relativePath),
    })));
    const stagingManifest = {
      build_manifest: {
        path: BUILD_MANIFEST_PATH,
        sha256: sha256(buildManifestBytes),
        size: buildManifestBytes.length,
      },
      format: "glt-flow-card-hacs-staging-manifest",
      manifest_version: 1,
      packages: {
        integration: {
          category: "integration",
          component_root: COMPONENT_ROOT,
          files: await Promise.all(integrationFiles.map((relativePath) => descriptor(integrationRoot, relativePath))),
          source_files: sourceFiles,
          zip: {
            install_target: "/config/custom_components/glt_flow_card",
            member_root: ".",
            members: sourceFiles.map(({ path: relativePath, sha256: hash, size }) => ({
              path: relativePath,
              sha256: hash,
              size,
            })),
            path: "glt-flow-card-companion.zip",
            sha256: sha256(zipBytes),
            size: zipBytes.length,
          },
        },
        plugin: {
          category: "plugin",
          files: await Promise.all(pluginFiles.map((relativePath) => descriptor(pluginRoot, relativePath))),
          install_target: "/config/www/community/glt-flow-card/glt-flow-card.js",
        },
      },
      version: packageJson.version,
    };
    await writeFile(
      path.join(tempRoot, "hacs-staging-manifest.json"),
      canonicalJson(stagingManifest),
    );

    await mkdir(outputRoot, { recursive: true });
    for (const relativePath of [
      "hacs-plugin",
      "hacs-integration",
      "glt-flow-card-companion.zip",
      "hacs-staging-manifest.json",
    ]) {
      const target = path.join(outputRoot, relativePath);
      await rm(target, { recursive: true, force: true });
      await rename(path.join(tempRoot, relativePath), target);
    }
    console.log(`Staged HACS plugin and integration packages in ${path.relative(ROOT, outputRoot) || "."}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await stagePackages(parseOutputRoot());
