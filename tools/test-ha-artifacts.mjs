/* Exercise manifest-hashed staged artifacts inside digest-pinned Home Assistant lanes. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
} from "@zip.js/zip.js/index-native.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGE_ROOT = path.join(ROOT, "build/release");
const STAGING_MANIFEST = path.join(STAGE_ROOT, "hacs-staging-manifest.json");
const COMPONENT_ROOT = "custom_components/glt_flow_card";
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.capture ? "pipe" : "inherit",
    timeout: options.timeout ?? 30 * 60 * 1000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}${output ? `\n${output}` : ""}`);
  }
  return String(result.stdout ?? "").trim();
}

function docker(args, options = {}) {
  return run("docker", args, options);
}

function assertDescriptor(bytes, descriptor, label) {
  if (!descriptor || descriptor.size !== bytes.length || descriptor.sha256 !== sha256(bytes)) {
    throw new Error(`${label} manifest hash mismatch`);
  }
}

export async function verifyStagedArtifacts(stageRoot = STAGE_ROOT) {
  const manifestBytes = await readFile(path.join(stageRoot, "hacs-staging-manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.format !== "glt-flow-card-hacs-staging-manifest" || manifest.manifest_version !== 1) {
    throw new Error("invalid HACS staging manifest");
  }
  const integration = manifest.packages?.integration;
  const plugin = manifest.packages?.plugin;
  if (integration?.category !== "integration" || plugin?.category !== "plugin") {
    throw new Error("staged HACS categories are incomplete");
  }
  const zipBytes = await readFile(path.join(stageRoot, integration.zip.path));
  assertDescriptor(zipBytes, integration.zip, "Companion ZIP");
  const cardDescriptor = plugin.files.find(({ path: relativePath }) => relativePath === "glt-flow-card.js");
  const cardPath = path.join(stageRoot, "hacs-plugin/glt-flow-card.js");
  const cardBytes = await readFile(cardPath);
  assertDescriptor(cardBytes, cardDescriptor, "dashboard card");
  const componentCard = await readFile(path.join(stageRoot, "hacs-integration", COMPONENT_ROOT, "www/glt-flow-card.js"));
  if (!componentCard.equals(cardBytes)) throw new Error("plugin and Companion card stage bytes differ");
  return {
    card: { bytes: cardBytes, path: cardPath, sha256: sha256(cardBytes), size: cardBytes.length },
    manifest,
    manifest_sha256: sha256(manifestBytes),
    stageRoot,
    zip: { bytes: zipBytes, sha256: sha256(zipBytes), size: zipBytes.length },
  };
}

async function extractVerifiedZip(stage, target) {
  const expected = new Map(stage.manifest.packages.integration.zip.members.map((member) => [member.path, member]));
  const reader = new ZipReader(new Uint8ArrayReader(stage.zip.bytes), {
    useWebWorkers: false,
    checkSignature: true,
  });
  try {
    const entries = await reader.getEntries();
    const files = entries.filter((entry) => !entry.directory);
    if (files.length !== expected.size) throw new Error("Companion ZIP member count mismatch");
    for (const entry of files) {
      const descriptor = expected.get(entry.filename);
      if (!descriptor || !entry.getData) throw new Error(`unexpected Companion ZIP member: ${entry.filename}`);
      if (path.posix.isAbsolute(entry.filename) || entry.filename.split("/").includes("..")) {
        throw new Error(`unsafe Companion ZIP member: ${entry.filename}`);
      }
      const bytes = Buffer.from(await entry.getData(new Uint8ArrayWriter(), { checkSignature: true }));
      assertDescriptor(bytes, descriptor, `Companion ZIP member ${entry.filename}`);
      const destination = path.join(target, ...entry.filename.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
  } finally {
    await reader.close();
  }
}

function artifactIdentityTest() {
  return `"""Exact staged artifact identity inside the supported HA pytest harness."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_exact_staged_zip_card_and_build_identity() -> None:
    evidence = json.loads((ROOT / "artifact-evidence.json").read_text(encoding="utf-8"))
    component = ROOT / "custom_components" / "glt_flow_card"
    card = ROOT / "config" / "www" / "community" / "glt-flow-card" / "glt-flow-card.js"
    assert _sha256(card) == evidence["card_sha256"]
    assert _sha256(component / "www" / "glt-flow-card.js") == evidence["card_sha256"]
    assert evidence["zip_sha256"] == os.environ["GLT_ZIP_SHA256"]
    assert importlib.metadata.version("homeassistant") == os.environ["GLT_HA_VERSION"]
    manifest = json.loads((component / "manifest.json").read_text(encoding="utf-8"))
    build = json.loads((component / "build-manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == evidence["integration_version"]
    assert build["versions"]["companion"] == evidence["integration_version"]
    assert build["artifacts"]
`;
}

async function prepareWorkspace(stage) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "glt-ha-artifacts-"));
  const component = path.join(workspace, COMPONENT_ROOT);
  await mkdir(path.join(workspace, "custom_components"), { recursive: true });
  await writeFile(path.join(workspace, "custom_components/__init__.py"), "", "utf8");
  await extractVerifiedZip(stage, component);
  await cp(path.join(ROOT, "tests"), path.join(workspace, "tests"), { recursive: true });
  const conftestPath = path.join(workspace, "tests/components/glt_flow_card/conftest.py");
  const conftest = await readFile(conftestPath, "utf8");
  const normalizedConftest = conftest.replace(
    'pytest_plugins = "pytest_homeassistant_custom_component.plugins"\n',
    "# The pinned harness image auto-loads its supported pytest plugin entry point.\n",
  );
  if (normalizedConftest === conftest) throw new Error("supported pytest plugin declaration was not found");
  await writeFile(conftestPath, normalizedConftest, "utf8");
  await writeFile(
    path.join(workspace, "tests/components/glt_flow_card/test_artifact_identity.py"),
    artifactIdentityTest(),
    "utf8",
  );
  const cardTarget = path.join(workspace, "config/www/community/glt-flow-card/glt-flow-card.js");
  await mkdir(path.dirname(cardTarget), { recursive: true });
  await copyFile(stage.card.path, cardTarget);
  const integrationManifest = JSON.parse(await readFile(path.join(component, "manifest.json"), "utf8"));
  await writeFile(path.join(workspace, "artifact-evidence.json"), `${JSON.stringify({
    card_sha256: stage.card.sha256,
    integration_version: integrationManifest.version,
    staging_manifest_sha256: stage.manifest_sha256,
    zip_sha256: stage.zip.sha256,
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(workspace, "pytest.ini"), "[pytest]\nasyncio_mode = auto\n", "utf8");
  return workspace;
}

function harnessImageName(lane) {
  return `glt-flow-card-ha-harness:${lane.tag.replaceAll(".", "-")}-${lane.digest.slice(7, 19)}`;
}

function assertLane(lane) {
  if (!lane || !/^20\d{2}\.\d{1,2}\.\d+$/u.test(lane.tag ?? "")) throw new Error("invalid stable HA lane tag");
  if (!DIGEST_PATTERN.test(lane.digest ?? "") || lane.image !== `${lane.source}@${lane.digest}`) {
    throw new Error(`lane ${lane.tag} is not pinned to its architecture digest`);
  }
  if (lane.os !== "linux" || !["amd64", "arm64"].includes(lane.architecture)) {
    throw new Error(`lane ${lane.tag} has unsupported runner platform`);
  }
  if (!/^0\.13\.\d+$/u.test(lane.harness ?? "")) throw new Error(`lane ${lane.tag} has no exact pytest harness`);
}

function ensureDocker() {
  const info = docker(["info", "--format", "{{.ServerVersion}}/{{.OSType}}/{{.Architecture}}"], { capture: true });
  if (!/^[^/]+\/linux\/(?:x86_64|aarch64)$/u.test(info)) {
    throw new Error(`Docker must provide a Linux engine, got: ${info}`);
  }
  return info;
}

async function prepareHarnessImage(lane) {
  assertLane(lane);
  docker(["pull", "--platform", `${lane.os}/${lane.architecture}`, lane.image]);
  const actualArchitecture = docker(["image", "inspect", lane.image, "--format", "{{.Architecture}}"], { capture: true });
  if (actualArchitecture !== lane.architecture) {
    throw new Error(`pulled lane architecture mismatch: expected ${lane.architecture}, got ${actualArchitecture}`);
  }
  docker([
    "run", "--rm", "--network", "none", "--platform", `${lane.os}/${lane.architecture}`,
    lane.image,
    "python", "-c",
    `import importlib.metadata as m; assert m.version('homeassistant') == '${lane.tag}'`,
  ]);
  const image = harnessImageName(lane);
  try {
    docker(["image", "inspect", image], { capture: true });
    return image;
  } catch {
    // The exact PyPI harness release is resolved read-only before this isolated build.
  }
  const context = path.join(os.tmpdir(), `glt-ha-harness-${process.pid}-${lane.tag.replaceAll(".", "-")}`);
  await mkdir(context, { recursive: true });
  const dockerfile = [
    `FROM ${lane.image}`,
    `RUN python -m pip install --disable-pip-version-check --no-cache-dir --no-input pytest-homeassistant-custom-component==${lane.harness}`,
    `RUN python -c "import importlib.metadata as m; assert m.version('homeassistant') == '${lane.tag}'"`,
    "",
  ].join("\n");
  await writeFile(path.join(context, "Dockerfile"), dockerfile, "utf8");
  try {
    docker(["build", "--platform", `${lane.os}/${lane.architecture}`, "--tag", image, context]);
  } finally {
    rm(context, { recursive: true, force: true }).catch(() => undefined);
  }
  return image;
}

function workspaceMount(workspace) {
  return `type=bind,source=${workspace},target=/workspace`;
}

async function executePytest(lane, selectors) {
  const stage = await verifyStagedArtifacts();
  const workspace = await prepareWorkspace(stage);
  try {
    const image = await prepareHarnessImage(lane);
    docker([
      "run", "--rm", "--network", "none", "--platform", `${lane.os}/${lane.architecture}`,
      "--mount", workspaceMount(workspace),
      "--workdir", "/workspace",
      "--env", `GLT_HA_VERSION=${lane.tag}`,
      "--env", `GLT_ZIP_SHA256=${stage.zip.sha256}`,
      image,
      "python", "-m", "pytest", ...selectors,
      "-q", "-s", "--disable-warnings", "--maxfail=1",
    ]);
    return {
      architecture: lane.architecture,
      card_sha256: stage.card.sha256,
      digest: lane.digest,
      passed: true,
      staging_manifest_sha256: stage.manifest_sha256,
      tag: lane.tag,
      zip_sha256: stage.zip.sha256,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function probeLane(lane) {
  try {
    ensureDocker();
    const evidence = await executePytest(lane, ["tests/components/glt_flow_card"]);
    console.log(`PASS minimum probe HA ${lane.tag} ${lane.digest} linux/${lane.architecture}`);
    return { passed: true, evidence };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (/docker (?:build|pull)|pip install|Plugin already registered|Docker must provide/iu.test(reason)) {
      throw new Error(`Home Assistant harness infrastructure failed closed: ${reason}`);
    }
    console.error(`FAIL minimum probe HA ${lane.tag}: ${reason}`);
    return { passed: false, reason };
  }
}

export async function testHaArtifacts({ lanes }) {
  ensureDocker();
  const unique = [...new Map(lanes.map((lane) => [`${lane.tag}@${lane.digest}`, lane])).values()];
  if (!unique.length || unique.length > 2) throw new Error("exact-artifact validation requires minimum/current lanes");
  const evidence = [];
  for (const lane of unique) {
    evidence.push(await executePytest(lane, ["tests/components/glt_flow_card"]));
    console.log(`PASS exact staged artifacts on HA ${lane.tag} ${lane.digest} linux/${lane.architecture}`);
  }
  return evidence;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--lanes-file") options.lanesFile = path.resolve(argv[++index] ?? "");
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let plan;
  if (options.lanesFile) {
    plan = JSON.parse(await readFile(options.lanesFile, "utf8"));
  } else {
    const floor = JSON.parse(await readFile(path.join(ROOT, "hacs.json"), "utf8")).homeassistant;
    const { resolveLanePlan } = await import("./resolve-ha-lanes.mjs");
    plan = await resolveLanePlan({ floor, maxCandidates: 12, probe: probeLane });
  }
  const evidence = await testHaArtifacts({ lanes: [plan.minimum, plan.current] });
  const evidencePath = path.join(ROOT, ".planning/tmp/ha-artifact-results.json");
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify({ evidence, lanes: {
    current: plan.current,
    minimum: plan.minimum,
  }, verified: true }, null, 2)}\n`, "utf8");
  console.log(`PASS exact-artifact evidence: ${evidencePath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
