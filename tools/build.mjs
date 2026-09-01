/* Build every committed browser/schema artifact from canonical authored inputs. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build as esbuild, version as esbuildVersion } from "esbuild";
import {
  generateProjectValidatorSource,
  PROJECT_SCHEMA_SPECS,
} from "./generate-project-validators.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CARD_MARKER = "/*! GLT Flow Card v1 generated extension */";
const EDITOR_MARKER = "/*! GLT Online Designer v1 Engineering extensions */";
const EDITOR_END_MARKER = "/*! END GLT Online Designer v1 Engineering extensions */";
const MANIFEST_PATH = "custom_components/glt_flow_card/build-manifest.json";
const SCHEMA_COPIES = [
  ["schemas/bundle-manifest.schema.json", "dist/schemas/bundle-manifest.schema.json"],
  ["schemas/diff-policy.json", "dist/schemas/diff-policy.json"],
  ["schemas/limits.json", "dist/schemas/limits.json"],
  ["schemas/project/0.schema.json", "dist/schemas/project/0.schema.json"],
  ["schemas/project/1.schema.json", "dist/schemas/project/1.schema.json"],
  ["schemas/project/2.schema.json", "dist/schemas/project/2.schema.json"],
];
const ARTIFACT_PATHS = [
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function canonicalJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeStage(stageRoot, relativePath, bytes) {
  const destination = path.join(stageRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}

async function filesUnder(relativeDirectory) {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) paths.push(...await filesUnder(relativePath));
    if (entry.isFile()) paths.push(relativePath);
  }
  return paths;
}

async function canonicalSourcePaths() {
  const v1Sources = (await filesUnder("src/v100"))
    .filter((sourcePath) => sourcePath !== "src/v100/generated/project-validators.mjs");
  return [
    "custom_components/glt_flow_card/manifest.json",
    "package-lock.json",
    "package.json",
    "schemas/bundle-manifest.schema.json",
    "schemas/diff-policy.json",
    "schemas/limits.json",
    "schemas/project/0.schema.json",
    "schemas/project/1.schema.json",
    "schemas/project/2.schema.json",
    "src/generated-bases/editor-app.base.js",
    "src/generated-bases/glt-flow-card.base.js",
    "tools/apply-v100.mjs",
    "tools/build.mjs",
    "tools/generate-project-validators.mjs",
    ...v1Sources,
  ].sort();
}

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function buildIdentity(sourcePaths) {
  const commit = git(["log", "-1", "--format=%H", "--", ...sourcePaths]) || "WORKTREE";
  const dirty = Boolean(git(["status", "--porcelain=v1", "--untracked-files=all", "--", ...sourcePaths]));
  return { commit, dirty };
}

async function descriptors(root, relativePaths) {
  return Promise.all(relativePaths.map(async (relativePath) => {
    const bytes = await readFile(path.join(root, relativePath));
    return { path: relativePath, sha256: sha256(bytes), size: bytes.length };
  }));
}

async function bundleV1(compilerRoot, validatorSource) {
  const sourceRoot = path.join(compilerRoot, "src", "v100");
  await cp(path.join(ROOT, "src", "v100"), sourceRoot, { recursive: true });
  await mkdir(path.join(compilerRoot, "schemas"), { recursive: true });
  await copyFile(
    path.join(ROOT, "schemas", "diff-policy.json"),
    path.join(compilerRoot, "schemas", "diff-policy.json"),
  );
  await writeStage(
    compilerRoot,
    "src/v100/generated/project-validators.mjs",
    validatorSource,
  );
  const result = await esbuild({
    absWorkingDir: compilerRoot,
    bundle: true,
    charset: "utf8",
    entryPoints: ["src/v100/entry.js"],
    format: "iife",
    legalComments: "inline",
    nodePaths: [path.join(ROOT, "node_modules")],
    outfile: path.join(compilerRoot, "glt-v100.js"),
    platform: "browser",
    target: "es2022",
    write: false,
  });
  if (result.outputFiles.length !== 1) {
    throw new Error(`expected one browser bundle, received ${result.outputFiles.length}`);
  }
  return result.outputFiles[0].text;
}

async function validateStage(stageRoot, manifest, validatorSource) {
  const dist = await readFile(path.join(stageRoot, "dist/glt-flow-card.js"));
  const companion = await readFile(path.join(
    stageRoot,
    "custom_components/glt_flow_card/www/glt-flow-card.js",
  ));
  if (!dist.equals(companion)) throw new Error("staged dist/www card bytes differ");
  const cardText = dist.toString("utf8");
  if (cardText.split(CARD_MARKER).length !== 2) throw new Error("staged card marker count is not one");

  const editor = await readFile(path.join(stageRoot, "docs/editor/app.js"), "utf8");
  if (editor.split(EDITOR_MARKER).length !== 2 || editor.split(EDITOR_END_MARKER).length !== 2) {
    throw new Error("staged editor generated region markers are invalid");
  }
  for (const [sourcePath, distPath] of SCHEMA_COPIES) {
    const canonicalBytes = await readFile(path.join(ROOT, sourcePath));
    JSON.parse(canonicalBytes);
    const distBytes = await readFile(path.join(stageRoot, distPath));
    const companionBytes = await readFile(path.join(
      stageRoot,
      distPath.replace(/^dist\//, "custom_components/glt_flow_card/"),
    ));
    if (!canonicalBytes.equals(distBytes) || !canonicalBytes.equals(companionBytes)) {
      throw new Error(`staged schema copy differs from ${sourcePath}`);
    }
  }
  const actualArtifacts = await descriptors(stageRoot, ARTIFACT_PATHS);
  if (canonicalJson(actualArtifacts) !== canonicalJson(manifest.artifacts)) {
    throw new Error("staged artifact descriptors differ from manifest");
  }
  if (sha256(Buffer.from(validatorSource)) !== manifest.validator.sha256) {
    throw new Error("staged validator fingerprint differs from manifest");
  }
  for (const relativePath of ["dist/glt-flow-card.js", "docs/editor/app.js"]) {
    const checked = spawnSync(process.execPath, ["--check", path.join(stageRoot, relativePath)], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (checked.status !== 0) throw new Error(`${relativePath} syntax check failed: ${checked.stderr}`);
  }
}

async function replaceFile(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  const nonce = `${process.pid}-${Math.random().toString(16).slice(2)}`;
  const candidate = `${destination}.glt-build-${nonce}.tmp`;
  const backup = `${destination}.glt-build-${nonce}.bak`;
  await copyFile(source, candidate);
  try {
    await rename(candidate, destination);
    return;
  } catch (error) {
    if (!await exists(destination) || !["EEXIST", "EPERM", "ENOTEMPTY"].includes(error.code)) {
      await rm(candidate, { force: true });
      throw error;
    }
  }
  await rename(destination, backup);
  try {
    await rename(candidate, destination);
    await rm(backup, { force: true });
  } catch (error) {
    if (await exists(backup) && !await exists(destination)) await rename(backup, destination);
    await rm(candidate, { force: true });
    throw error;
  }
}

function parseOutputRoot() {
  const index = process.argv.indexOf("--output-root");
  if (index === -1) return ROOT;
  if (!process.argv[index + 1]) throw new Error("--output-root requires a path");
  return path.resolve(ROOT, process.argv[index + 1]);
}

async function main() {
  const outputRoot = parseOutputRoot();
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "glt-flow-card-build-"));
  const stageRoot = path.join(temporaryRoot, "stage");
  const compilerRoot = path.join(temporaryRoot, "compiler");
  try {
    const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
    const companionManifest = JSON.parse(await readFile(
      path.join(ROOT, "custom_components/glt_flow_card/manifest.json"),
      "utf8",
    ));
    if (packageJson.version !== companionManifest.version) {
      throw new Error(`package/Companion version disagreement: ${packageJson.version} != ${companionManifest.version}`);
    }
    const cardBase = await readFile(
      path.join(ROOT, "src/generated-bases/glt-flow-card.base.js"),
      "utf8",
    );
    const cardVersion = cardBase.match(/const VERSION = "([^"]+)";/)?.[1];
    if (cardVersion !== packageJson.version) {
      throw new Error(`card/package version disagreement: ${cardVersion ?? "missing"} != ${packageJson.version}`);
    }

    const validatorSource = await generateProjectValidatorSource();
    const v1Bundle = await bundleV1(compilerRoot, validatorSource);
    const card = `${cardBase.trimEnd()}\n\n${CARD_MARKER}\n${v1Bundle.trim()}\n`;
    await writeStage(stageRoot, "dist/glt-flow-card.js", card);
    await writeStage(stageRoot, "custom_components/glt_flow_card/www/glt-flow-card.js", card);

    const editorBase = await readFile(
      path.join(ROOT, "src/generated-bases/editor-app.base.js"),
      "utf8",
    );
    const editorExtension = await readFile(path.join(ROOT, "src/v100/online-extension.js"), "utf8");
    if (!editorExtension.trimStart().startsWith(EDITOR_MARKER)) {
      throw new Error("online editor extension is missing its generated-region marker");
    }
    const editor = `${editorBase.trimEnd()}\n\n${editorExtension.trim()}\n${EDITOR_END_MARKER}\n`;
    await writeStage(stageRoot, "docs/editor/app.js", editor);

    for (const [sourcePath, distPath] of SCHEMA_COPIES) {
      const bytes = await readFile(path.join(ROOT, sourcePath));
      await writeStage(stageRoot, distPath, bytes);
      await writeStage(
        stageRoot,
        distPath.replace(/^dist\//, "custom_components/glt_flow_card/"),
        bytes,
      );
    }

    const sourcePaths = await canonicalSourcePaths();
    const schemaFingerprints = Object.fromEntries(await Promise.all(
      [
        ...PROJECT_SCHEMA_SPECS,
        ["diffPolicy", "schemas/diff-policy.json"],
        ["limits", "schemas/limits.json"],
      ].map(async ([name, sourcePath]) => [
        name,
        sha256(await readFile(path.join(ROOT, sourcePath))),
      ]),
    ));
    const manifest = {
      artifacts: await descriptors(stageRoot, ARTIFACT_PATHS),
      build: buildIdentity(sourcePaths),
      format: "glt-flow-card-build-manifest",
      manifest_version: 1,
      schemas: schemaFingerprints,
      sources: await descriptors(ROOT, sourcePaths),
      tools: {
        ajv: require("ajv/package.json").version,
        esbuild: esbuildVersion,
        node: "22",
      },
      validator: {
        sha256: sha256(Buffer.from(validatorSource)),
        size: Buffer.byteLength(validatorSource),
      },
      versions: {
        card: cardVersion,
        companion: companionManifest.version,
        package: packageJson.version,
        project_schema: [0, 1, 2],
      },
    };
    await writeStage(stageRoot, MANIFEST_PATH, canonicalJson(manifest));
    await validateStage(stageRoot, manifest, validatorSource);

    for (const relativePath of [...ARTIFACT_PATHS, MANIFEST_PATH].sort()) {
      await replaceFile(path.join(stageRoot, relativePath), path.join(outputRoot, relativePath));
    }
    console.log(`Built ${ARTIFACT_PATHS.length + 1} validated outputs in ${path.relative(ROOT, outputRoot) || "."}`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`release build failed: ${error.message}`);
  process.exitCode = 1;
});
