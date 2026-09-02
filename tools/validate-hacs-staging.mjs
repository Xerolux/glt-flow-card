/* Independently validate local HACS plugin/integration stages and release ZIP. */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
} from "@zip.js/zip.js/index-native.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_ROOT = path.join(ROOT, "build/release");
const COMPONENT_ROOT = "custom_components/glt_flow_card";

// Discovered from the authored schema directory, never imported from the
// stager. Independent verification must not trust the staging implementation or
// its metadata -- but it also must not carry a hand-written list that silently
// stops covering a version somebody added.
const PROJECT_SCHEMA_FILES = (await readdir(path.join(ROOT, "schemas/project")))
  .filter((name) => /^\d+\.schema\.json$/.test(name))
  .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
  .map((name) => `schemas/project/${name}`);
const BUILD_MANIFEST_PATH = `${COMPONENT_ROOT}/build-manifest.json`;
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
  "panels.py",
  "provenance.py",
  "sdk_manifest.py",
  "semantic_model.py",
  "view_stream.py",
  "trusted_evidence.py",
  "schemas/bundle-manifest.schema.json",
  "schemas/diff-policy.json",
  "schemas/limits.json",
  "schemas/vocabularies.json",
  ...PROJECT_SCHEMA_FILES,
  "strings.json",
  "translations/de.json",
  "translations/en.json",
  "www/glt-flow-card.js",
];
const PLUGIN_FILES = ["README.md", "glt-flow-card.js", "hacs.json"];
const INTEGRATION_FILES = [
  "README.md",
  "hacs.json",
  ...COMPONENT_FILES.map((relativePath) => `${COMPONENT_ROOT}/${relativePath}`),
];
const BUILD_ARTIFACT_PATHS = new Map([
  ["www/glt-flow-card.js", `${COMPONENT_ROOT}/www/glt-flow-card.js`],
  ["schemas/bundle-manifest.schema.json", `${COMPONENT_ROOT}/schemas/bundle-manifest.schema.json`],
  ["schemas/diff-policy.json", `${COMPONENT_ROOT}/schemas/diff-policy.json`],
  ["schemas/limits.json", `${COMPONENT_ROOT}/schemas/limits.json`],
  ["schemas/vocabularies.json", `${COMPONENT_ROOT}/schemas/vocabularies.json`],
  ...PROJECT_SCHEMA_FILES.map((file) => [file, `${COMPONENT_ROOT}/${file}`]),
]);
const FIXED_ZIP_TIME = new Date("1980-01-01T00:00:00.000Z").getTime();

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

function parseArgs() {
  let outputRoot = DEFAULT_OUTPUT_ROOT;
  let category = "all";
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === "--output-root") {
      outputRoot = path.resolve(process.argv[++index] || "");
    } else if (argument === "--category") {
      category = process.argv[++index] || "";
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!outputRoot || outputRoot === path.parse(outputRoot).root) {
    throw new Error("invalid HACS staging output root");
  }
  if (!["all", "plugin", "integration"].includes(category)) {
    throw new Error(`unsupported HACS category: ${category}`);
  }
  return { category, outputRoot };
}

async function walkFiles(root, relativeRoot = "") {
  const result = [];
  const entries = await readdir(path.join(root, relativeRoot), { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.posix.join(relativeRoot.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) {
      result.push(...await walkFiles(root, relativePath));
    } else if (entry.isFile()) {
      result.push(relativePath);
    } else {
      throw new Error(`unsafe staged filesystem member: ${relativePath}`);
    }
  }
  return result;
}

function requireFileSet(actual, expected, label) {
  const extras = actual.filter((relativePath) => !expected.includes(relativePath));
  if (extras.length) throw new Error(`unexpected ${label} file: ${extras[0]}`);
  const missing = expected.filter((relativePath) => !actual.includes(relativePath));
  if (missing.length) throw new Error(`missing ${label} file: ${missing[0]}`);
}

async function descriptors(root, relativePaths) {
  return Promise.all(relativePaths.map(async (relativePath) => {
    const bytes = await readFile(path.join(root, relativePath));
    return { path: relativePath, sha256: sha256(bytes), size: bytes.length };
  }));
}

async function loadAuthorities(outputRoot) {
  const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  const buildManifestBytes = await readFile(path.join(ROOT, BUILD_MANIFEST_PATH));
  const buildManifest = JSON.parse(buildManifestBytes);
  const stagingManifestBytes = await readFile(path.join(outputRoot, "hacs-staging-manifest.json"));
  const stagingManifest = JSON.parse(stagingManifestBytes);
  if (buildManifestBytes.toString("utf8") !== canonicalJson(buildManifest)) {
    throw new Error("build manifest is not canonical JSON");
  }
  if (stagingManifestBytes.toString("utf8") !== canonicalJson(stagingManifest)) {
    throw new Error("staging manifest is not canonical JSON");
  }
  if (buildManifest.format !== "glt-flow-card-build-manifest" || buildManifest.manifest_version !== 1) {
    throw new Error("build manifest format/version disagreement");
  }
  if (
    stagingManifest.format !== "glt-flow-card-hacs-staging-manifest"
    || stagingManifest.manifest_version !== 1
  ) {
    throw new Error("staging manifest format/version disagreement");
  }
  if (
    stagingManifest.version !== packageJson.version
    || buildManifest.versions.package !== packageJson.version
    || buildManifest.versions.card !== packageJson.version
    || buildManifest.versions.companion !== packageJson.version
  ) {
    throw new Error("package/build/staging version disagreement");
  }
  if (
    stagingManifest.build_manifest.path !== BUILD_MANIFEST_PATH
    || stagingManifest.build_manifest.sha256 !== sha256(buildManifestBytes)
    || stagingManifest.build_manifest.size !== buildManifestBytes.length
  ) {
    throw new Error("staged build manifest identity disagreement");
  }
  return { buildManifest, packageJson, stagingManifest };
}

function requireMetadata(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} HACS metadata disagreement`);
  }
}

function requireStageDescriptors(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} staging descriptor disagreement`);
  }
}

function requireBuildArtifact(buildManifest, artifactPath, bytes) {
  const expected = buildManifest.artifacts.find(({ path: candidate }) => candidate === artifactPath);
  if (!expected || expected.sha256 !== sha256(bytes) || expected.size !== bytes.length) {
    throw new Error(`build artifact hash mismatch: ${artifactPath}`);
  }
}

async function validatePlugin(outputRoot, authorities) {
  const pluginRoot = path.join(outputRoot, "hacs-plugin");
  const actualFiles = await walkFiles(pluginRoot);
  requireFileSet(actualFiles, PLUGIN_FILES, "plugin stage");
  if (authorities.stagingManifest.packages.plugin.category !== "plugin") {
    throw new Error("plugin category disagreement");
  }

  const authoredHacs = JSON.parse(await readFile(path.join(ROOT, "packaging/hacs-plugin/hacs.json"), "utf8"));
  const stagedHacs = JSON.parse(await readFile(path.join(pluginRoot, "hacs.json"), "utf8"));
  requireMetadata(stagedHacs, authoredHacs, "plugin");
  requireMetadata(stagedHacs, {
    filename: "glt-flow-card.js",
    homeassistant: "2024.8.0",
    name: "GLT Flow Card",
    render_readme: true,
  }, "plugin category");

  const stagedCard = await readFile(path.join(pluginRoot, "glt-flow-card.js"));
  const distCard = await readFile(path.join(ROOT, "dist/glt-flow-card.js"));
  if (!stagedCard.equals(distCard)) throw new Error("plugin artifact hash mismatch");
  requireBuildArtifact(authorities.buildManifest, "dist/glt-flow-card.js", stagedCard);
  if (!stagedCard.toString("utf8").includes(`const VERSION = "${authorities.packageJson.version}";`)) {
    throw new Error("plugin runtime version disagreement");
  }
  requireStageDescriptors(
    authorities.stagingManifest.packages.plugin.files,
    await descriptors(pluginRoot, PLUGIN_FILES),
    "plugin",
  );
  if (authorities.stagingManifest.packages.plugin.install_target !== (
    "/config/www/community/glt-flow-card/glt-flow-card.js"
  )) {
    throw new Error("plugin install target disagreement");
  }
  console.log("PASS HACS plugin category");
}

function requireSafeZipMember(filename) {
  if (
    !filename
    || filename.startsWith("/")
    || /^[A-Za-z]:/.test(filename)
    || filename.includes("\\")
    || /[\0-\x1f\x7f]/.test(filename)
    || filename.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    || path.posix.normalize(filename) !== filename
  ) {
    throw new Error(`unsafe ZIP member: ${filename}`);
  }
}

async function validateCompanionZip(outputRoot, componentRoot, authorities) {
  const zipPath = path.join(outputRoot, "glt-flow-card-companion.zip");
  const zipBytes = await readFile(zipPath);
  const reader = new ZipReader(new Uint8ArrayReader(zipBytes), {
    strictness: "strict",
    useWebWorkers: false,
  });
  try {
    const entries = await reader.getEntries({ strictness: "strict" });
    for (const entry of entries) requireSafeZipMember(entry.filename);
    const filenames = entries.map(({ filename }) => filename);
    if (canonicalJson(filenames) !== canonicalJson(COMPONENT_FILES)) {
      throw new Error("ZIP member set disagreement");
    }
    const memberDescriptors = [];
    for (const entry of entries) {
      if (entry.directory || entry.encrypted || entry.compressionMethod !== 0) {
        throw new Error(`unsafe ZIP entry metadata: ${entry.filename}`);
      }
      if (entry.lastModDate.getTime() !== FIXED_ZIP_TIME || (entry.unixMode & 0o777) !== 0o644) {
        throw new Error(`non-deterministic ZIP metadata: ${entry.filename}`);
      }
      const bytes = Buffer.from(await entry.getData(new Uint8ArrayWriter(), {
        checkSignature: true,
        useWebWorkers: false,
      }));
      const staged = await readFile(path.join(componentRoot, entry.filename));
      if (!bytes.equals(staged)) throw new Error(`ZIP/stage byte disagreement: ${entry.filename}`);
      memberDescriptors.push({ path: entry.filename, sha256: sha256(bytes), size: bytes.length });
    }
    const zipManifest = authorities.stagingManifest.packages.integration.zip;
    if (
      zipManifest.install_target !== "/config/custom_components/glt_flow_card"
      || zipManifest.member_root !== "."
      || zipManifest.path !== "glt-flow-card-companion.zip"
    ) {
      throw new Error("Companion ZIP install relationship disagreement");
    }
    if (canonicalJson(zipManifest.members) !== canonicalJson(memberDescriptors)) {
      throw new Error("Companion ZIP member descriptor disagreement");
    }
    if (zipManifest.sha256 !== sha256(zipBytes) || zipManifest.size !== zipBytes.length) {
      throw new Error("Companion ZIP hash mismatch");
    }
  } finally {
    await reader.close();
  }
  console.log("PASS Companion ZIP install layout");
}

function validateHomeAssistantManifest(manifest, version) {
  const required = ["domain", "documentation", "issue_tracker", "codeowners", "name", "version"];
  for (const key of required) {
    if (!Object.hasOwn(manifest, key)) throw new Error(`Companion manifest key missing: ${key}`);
  }
  if (manifest.domain !== "glt_flow_card") throw new Error("Companion domain disagreement");
  if (manifest.version !== version) throw new Error("Companion version disagreement");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error("Companion version is not semantic");
  if (
    typeof manifest.documentation !== "string"
    || !manifest.documentation.startsWith("https://")
    || typeof manifest.issue_tracker !== "string"
    || !manifest.issue_tracker.startsWith("https://")
  ) {
    throw new Error("Companion documentation/issue tracker must use HTTPS");
  }
  if (!Array.isArray(manifest.codeowners) || !manifest.codeowners.length) {
    throw new Error("Companion codeowners missing");
  }
  if (manifest.config_flow !== true || manifest.integration_type !== "service" || manifest.iot_class !== "local_push") {
    throw new Error("Companion Home Assistant manifest classification disagreement");
  }
}

async function validateIntegration(outputRoot, authorities) {
  const integrationRoot = path.join(outputRoot, "hacs-integration");
  const componentRoot = path.join(integrationRoot, COMPONENT_ROOT);
  const actualFiles = await walkFiles(integrationRoot);
  requireFileSet(actualFiles, INTEGRATION_FILES, "integration stage");
  if (authorities.stagingManifest.packages.integration.category !== "integration") {
    throw new Error("integration category disagreement");
  }
  if (authorities.stagingManifest.packages.integration.component_root !== COMPONENT_ROOT) {
    throw new Error("integration component root disagreement");
  }

  const authoredHacs = JSON.parse(await readFile(path.join(ROOT, "packaging/hacs-integration/hacs.json"), "utf8"));
  const stagedHacs = JSON.parse(await readFile(path.join(integrationRoot, "hacs.json"), "utf8"));
  requireMetadata(stagedHacs, authoredHacs, "integration");
  requireMetadata(stagedHacs, {
    filename: "glt-flow-card-companion.zip",
    homeassistant: "2024.8.0",
    name: "GLT Flow Card Companion",
    render_readme: true,
    zip_release: true,
  }, "integration category");
  if (Object.hasOwn(stagedHacs, "repository") || Object.hasOwn(stagedHacs, "user_setup")) {
    throw new Error("publication-only integration metadata is forbidden");
  }

  const componentManifest = JSON.parse(await readFile(path.join(componentRoot, "manifest.json"), "utf8"));
  validateHomeAssistantManifest(componentManifest, authorities.packageJson.version);
  for (const relativePath of [
    "config_flow.py",
    "strings.json",
    "translations/en.json",
    "translations/de.json",
  ]) {
    const bytes = await readFile(path.join(componentRoot, relativePath));
    if (!bytes.length) throw new Error(`hassfest-compatible file is empty: ${relativePath}`);
    if (relativePath.endsWith(".json")) JSON.parse(bytes);
  }

  const sourceDescriptors = [];
  for (const relativePath of COMPONENT_FILES) {
    const staged = await readFile(path.join(componentRoot, relativePath));
    const source = await readFile(path.join(ROOT, COMPONENT_ROOT, relativePath));
    if (!staged.equals(source)) throw new Error(`staged Companion file drift: ${relativePath}`);
    const artifactPath = BUILD_ARTIFACT_PATHS.get(relativePath);
    if (artifactPath) requireBuildArtifact(authorities.buildManifest, artifactPath, staged);
    sourceDescriptors.push({
      build_artifact: BUILD_ARTIFACT_PATHS.has(relativePath) || relativePath === "build-manifest.json",
      path: relativePath,
      sha256: sha256(staged),
      size: staged.length,
    });
  }
  requireStageDescriptors(
    authorities.stagingManifest.packages.integration.files,
    await descriptors(integrationRoot, INTEGRATION_FILES),
    "integration",
  );
  requireStageDescriptors(
    authorities.stagingManifest.packages.integration.source_files,
    sourceDescriptors,
    "integration source",
  );

  await validateCompanionZip(outputRoot, componentRoot, authorities);
  const scripts = Object.values(authorities.packageJson.scripts || {});
  if (scripts.some((command) => /publish|upload|mirror|token/i.test(command))) {
    throw new Error("publication command is forbidden in local staging validation");
  }
  console.log("PASS no publication credentials required");
  console.log("PASS HACS integration category");
}

async function main() {
  const { category, outputRoot } = parseArgs();
  const authorities = await loadAuthorities(outputRoot);
  if (category === "all" || category === "plugin") await validatePlugin(outputRoot, authorities);
  if (category === "all" || category === "integration") await validateIntegration(outputRoot, authorities);
}

await main();
