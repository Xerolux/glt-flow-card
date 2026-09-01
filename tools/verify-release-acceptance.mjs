/* Join already-produced Phase-1 evidence and stage exact release assets without rebuilding. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_MANIFEST_PATH = "custom_components/glt_flow_card/build-manifest.json";
const DEFAULT_STAGE = "build/release";
const DEFAULT_EVIDENCE = ".planning/tmp";
const DEFAULT_RELEASE = "build/release/release-assets";

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

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath, label) {
  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`${label} missing: ${filePath}`);
    throw error;
  }
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  return { bytes, value };
}

async function requireDescriptor(root, descriptor, label) {
  requireCondition(descriptor && typeof descriptor.path === "string", `${label} descriptor missing`);
  requireCondition(!path.isAbsolute(descriptor.path) && !descriptor.path.includes(".."), `${label} path is unsafe`);
  const bytes = await readFile(path.join(root, descriptor.path));
  requireCondition(descriptor.sha256 === sha256(bytes), `${label} hash mismatch: ${descriptor.path}`);
  requireCondition(descriptor.size === bytes.length, `${label} size mismatch: ${descriptor.path}`);
  return bytes;
}

function requireEvidence(value, format, label) {
  requireCondition(value?.format === format && value.report_version === 1, `${label} format/version disagreement`);
  requireCondition(value.skipped !== true, `${label} was skipped`);
  requireCondition(value.verified === true || value.passed === true, `${label} did not pass`);
}

function runChecked(root, args, label) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${label} failed:\n${result.stdout}\n${result.stderr}`);
}

function parseArgs(argv) {
  const options = { root: ROOT, runBrowser: true, tag: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-browser") options.runBrowser = false;
    else if (argument.startsWith("--root=")) options.root = path.resolve(argument.slice(7));
    else if (argument.startsWith("--tag=")) options.tag = argument.slice(6);
    else throw new Error(`unknown release acceptance argument: ${argument}`);
  }
  return options;
}

async function verifyBuildAuthorities(root, buildManifest, buildManifestBytes, buildEvidence) {
  requireCondition(
    buildManifest.format === "glt-flow-card-build-manifest" && buildManifest.manifest_version === 1,
    "build manifest format/version disagreement",
  );
  requireCondition(buildManifestBytes.toString("utf8") === canonicalJson(buildManifest), "build manifest is not canonical JSON");
  requireEvidence(buildEvidence, "glt-flow-card-release-build-verification", "release build evidence");
  requireCondition(buildEvidence.double_build?.passed === true, "double-build evidence is missing or failed");
  requireCondition(buildEvidence.checked_in_outputs?.passed === true, "checked-in output evidence is missing or failed");
  requireCondition(buildEvidence.build_manifest_sha256 === sha256(buildManifestBytes), "release build evidence manifest hash mismatch");
  requireCondition(buildEvidence.source_commit === buildManifest.build.commit, "release build evidence source commit mismatch");
  for (const source of buildManifest.sources ?? []) await requireDescriptor(root, source, "build source");
  for (const artifact of buildManifest.artifacts ?? []) await requireDescriptor(root, artifact, "build artifact");
}

async function verifyProvenance(root, provenance) {
  requireCondition(provenance?.report_version === 1 && provenance.verified === true, "provenance evidence missing or failed");
  requireCondition(provenance.mode === "online", "provenance evidence must come from online official sources");
  requireCondition(provenance.packages?.length === 5, "provenance exact package set disagreement");
  requireCondition(provenance.packages.every((entry) => entry.artifacts?.length && entry.artifacts.every((artifact) => artifact.verified === true)), "provenance artifact verification missing");
  const allowlist = JSON.parse(await readFile(path.join(root, "tools/provenance-allowlist.json"), "utf8"));
  const policyHash = sha256(Buffer.from(`${JSON.stringify(canonical(allowlist))}\n`));
  requireCondition(provenance.policy_sha256 === policyHash, "provenance policy hash mismatch");
}

async function verifyStage(root, stageRoot, buildManifest, buildManifestBytes) {
  const { bytes: stagingBytes, value: staging } = await readJson(
    path.join(stageRoot, "hacs-staging-manifest.json"),
    "HACS staging manifest",
  );
  requireCondition(staging.format === "glt-flow-card-hacs-staging-manifest" && staging.manifest_version === 1, "HACS staging manifest format/version disagreement");
  requireCondition(staging.build_manifest.sha256 === sha256(buildManifestBytes), "staged build manifest identity disagreement");
  const cardBytes = await readFile(path.join(stageRoot, "hacs-plugin/glt-flow-card.js"));
  const cardDescriptor = staging.packages?.plugin?.files?.find(({ path: filePath }) => filePath === "glt-flow-card.js");
  requireCondition(cardDescriptor?.sha256 === sha256(cardBytes) && cardDescriptor.size === cardBytes.length, "plugin artifact hash mismatch");
  const distDescriptor = buildManifest.artifacts.find(({ path: artifactPath }) => artifactPath === "dist/glt-flow-card.js");
  requireCondition(distDescriptor?.sha256 === sha256(cardBytes) && distDescriptor.size === cardBytes.length, "plugin/build card identity mismatch");
  const wwwBytes = await readFile(path.join(root, "custom_components/glt_flow_card/www/glt-flow-card.js"));
  requireCondition(cardBytes.equals(wwwBytes), "source dist and Companion www identity mismatch");
  const zipBytes = await readFile(path.join(stageRoot, "glt-flow-card-companion.zip"));
  const zipDescriptor = staging.packages?.integration?.zip;
  requireCondition(zipDescriptor?.sha256 === sha256(zipBytes) && zipDescriptor.size === zipBytes.length, "Companion ZIP hash mismatch");
  const stagedManifestBytes = await readFile(path.join(stageRoot, "hacs-integration", BUILD_MANIFEST_PATH));
  requireCondition(stagedManifestBytes.equals(buildManifestBytes), "staged Companion build manifest mismatch");
  return { cardBytes, staging, stagingBytes, zipBytes };
}

function verifyHomeAssistant(lock, results, hashes) {
  requireCondition(lock?.verified === true && results?.verified === true, "Home Assistant lane evidence missing or failed");
  const laneNames = ["minimum", "current"];
  requireCondition(results.evidence?.length === laneNames.length, "Home Assistant exact lane count disagreement");
  for (const laneName of laneNames) {
    const locked = lock[laneName];
    const resultLane = results.lanes?.[laneName];
    requireCondition(locked?.digest?.startsWith("sha256:") && locked.architecture, `Home Assistant ${laneName} immutable lock missing`);
    requireCondition(resultLane?.digest === locked.digest && resultLane.architecture === locked.architecture && resultLane.tag === locked.tag, `Home Assistant ${laneName} lane identity mismatch`);
    const evidence = results.evidence.find(({ digest, architecture }) => digest === locked.digest && architecture === locked.architecture);
    requireCondition(evidence?.passed === true, `Home Assistant ${laneName} lane did not pass`);
    requireCondition(evidence.card_sha256 === hashes.card, "Home Assistant card hash mismatch");
    requireCondition(evidence.zip_sha256 === hashes.zip, "Home Assistant Companion ZIP hash mismatch");
    requireCondition(evidence.staging_manifest_sha256 === hashes.staging, "Home Assistant staging manifest hash mismatch");
  }
  return {
    card_sha256: hashes.card,
    lanes: laneNames.map((laneName) => ({
      architecture: lock[laneName].architecture,
      digest: lock[laneName].digest,
      tag: lock[laneName].tag,
    })),
    zip_sha256: hashes.zip,
  };
}

async function writeReleaseAssets(outputRoot, report, cardBytes, zipBytes) {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const cardName = "glt-flow-card.js";
  const zipName = "glt-flow-card-companion.zip";
  const provenanceName = "release-provenance.json";
  const provenanceBytes = Buffer.from(canonicalJson(report));
  await writeFile(path.join(outputRoot, cardName), cardBytes);
  await writeFile(path.join(outputRoot, zipName), zipBytes);
  await writeFile(path.join(outputRoot, provenanceName), provenanceBytes);
  const checksums = [
    `${sha256(cardBytes)}  ${cardName}`,
    `${sha256(zipBytes)}  ${zipName}`,
    `${sha256(provenanceBytes)}  ${provenanceName}`,
  ].join("\n");
  await writeFile(path.join(outputRoot, "SHA256SUMS"), `${checksums}\n`);
}

export async function verifyReleaseAcceptance(options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  const stageRoot = path.resolve(root, options.stageRoot ?? DEFAULT_STAGE);
  const evidenceRoot = path.resolve(root, options.evidenceRoot ?? DEFAULT_EVIDENCE);
  const outputRoot = path.resolve(root, options.outputRoot ?? DEFAULT_RELEASE);
  const { bytes: buildManifestBytes, value: buildManifest } = await readJson(
    path.join(root, BUILD_MANIFEST_PATH),
    "build manifest",
  );
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const companionManifest = JSON.parse(await readFile(path.join(root, "custom_components/glt_flow_card/manifest.json"), "utf8"));
  requireCondition(buildManifest.versions?.package === packageJson.version, "package/build version mismatch");
  requireCondition(buildManifest.versions?.companion === packageJson.version && companionManifest.version === packageJson.version, "Companion/package version mismatch");
  requireCondition((options.tag ?? `v${packageJson.version}`) === `v${packageJson.version}`, "release tag/version mismatch");

  const provenance = (await readJson(path.join(evidenceRoot, "phase01-provenance.json"), "provenance evidence")).value;
  const buildEvidence = (await readJson(path.join(evidenceRoot, "release-build-verification.json"), "release build evidence")).value;
  await verifyProvenance(root, provenance);
  await verifyBuildAuthorities(root, buildManifest, buildManifestBytes, buildEvidence);

  if (options.runBrowser !== false) {
    runChecked(root, ["tools/validate-hacs-staging.mjs", "--output-root", stageRoot], "independent HACS category validation");
    runChecked(root, ["tools/run-exact-dist-playwright.mjs"], "exact-dist browser verification");
  }
  const browser = (await readJson(path.join(evidenceRoot, "exact-dist-results.json"), "exact-dist evidence")).value;
  requireEvidence(browser, "glt-flow-card-exact-dist-results", "exact-dist evidence");

  const staged = await verifyStage(root, stageRoot, buildManifest, buildManifestBytes);
  const cardHash = sha256(staged.cardBytes);
  const zipHash = sha256(staged.zipBytes);
  const stagingHash = sha256(staged.stagingBytes);
  requireCondition(browser.card_sha256 === cardHash, "exact-dist card hash mismatch");
  const lock = (await readJson(path.join(evidenceRoot, "ha-lanes.json"), "Home Assistant lane lock")).value;
  const haResults = (await readJson(path.join(evidenceRoot, "ha-artifact-results.json"), "Home Assistant artifact results")).value;
  const homeAssistant = verifyHomeAssistant(lock, haResults, {
    card: cardHash,
    staging: stagingHash,
    zip: zipHash,
  });

  const report = canonical({
    artifacts: {
      card: { name: "glt-flow-card.js", sha256: cardHash, size: staged.cardBytes.length },
      companion_zip: { name: "glt-flow-card-companion.zip", sha256: zipHash, size: staged.zipBytes.length },
      staging_manifest: { sha256: stagingHash, size: staged.stagingBytes.length },
    },
    browser,
    build: {
      manifest_sha256: sha256(buildManifestBytes),
      source_commit: buildManifest.build.commit,
    },
    format: "glt-flow-card-release-acceptance",
    home_assistant: homeAssistant,
    provenance: {
      policy_sha256: provenance.policy_sha256,
      report_sha256: sha256(await readFile(path.join(evidenceRoot, "phase01-provenance.json"))),
    },
    release: { tag: options.tag ?? `v${packageJson.version}`, version: packageJson.version },
    report_version: 1,
    verified: true,
  });
  await writeReleaseAssets(outputRoot, report, staged.cardBytes, staged.zipBytes);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyReleaseAcceptance(parseArgs(process.argv.slice(2))).then((report) => {
    console.log(`PASS release acceptance ${report.release.tag}`);
    console.log(`PASS exact card ${report.artifacts.card.sha256}`);
    console.log(`PASS exact Companion ZIP ${report.artifacts.companion_zip.sha256}`);
    console.log("PASS no rebuild or Companion mirror publication");
  }).catch((error) => {
    console.error(`release acceptance failed: ${error.message}`);
    process.exitCode = 1;
  });
}
