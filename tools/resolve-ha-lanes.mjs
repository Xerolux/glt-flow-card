/* Resolve official Home Assistant releases to immutable architecture-specific images. */
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME_ASSISTANT_PYPI = "https://pypi.org/pypi/homeassistant";
const HARNESS_PYPI = "https://pypi.org/pypi/pytest-homeassistant-custom-component";
const IMAGE_SOURCE = "ghcr.io/home-assistant/home-assistant";
const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export const minimumDeclarationFiles = [
  "hacs.json",
  "packaging/hacs-plugin/hacs.json",
  "packaging/hacs-integration/hacs.json",
  "packaging/hacs-integration/README.md",
  "README.md",
  "README.de.md",
  "docs/wiki/Installation.md",
];

function compareVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return 0;
}

export function parseHaVersion(value) {
  const match = /^(20\d{2})\.(0?[1-9]|1[0-2])\.(\d+)$/u.exec(String(value));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    version: String(value),
  };
}

export function enumerateCandidates(versions, floor, maxCandidates = 12) {
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 12) {
    throw new Error("Home Assistant probing is bounded to at most 12 candidates");
  }
  const parsedFloor = parseHaVersion(floor);
  if (!parsedFloor) throw new Error(`invalid advertised floor: ${floor}`);
  const stable = [...new Set(versions)]
    .map(parseHaVersion)
    .filter(Boolean)
    .sort(compareVersions);
  if (!stable.some(({ version }) => version === floor)) {
    throw new Error(`advertised floor does not exist in official stable releases: ${floor}`);
  }
  return stable
    .filter((candidate) => compareVersions(candidate, parsedFloor) >= 0)
    .slice(0, maxCandidates)
    .map(({ version }) => version);
}

async function checkedJson(url, { fetchImpl = fetch, headers = {}, label = url } = {}) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "glt-flow-card-ha-lane-resolver/1",
      ...headers,
    },
  });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return { body: await response.json(), response };
}

function runnerArchitecture() {
  if (process.arch === "x64") return "amd64";
  if (process.arch === "arm64") return "arm64";
  throw new Error(`unsupported runner architecture: ${process.arch}`);
}

export async function resolveOfficialImage(version, options = {}) {
  if (!parseHaVersion(version)) throw new Error(`refusing non-stable Home Assistant tag: ${version}`);
  const architecture = options.architecture ?? runnerArchitecture();
  const fetchImpl = options.fetchImpl ?? fetch;
  const tokenUrl = "https://ghcr.io/token?service=ghcr.io&scope=repository%3Ahome-assistant%2Fhome-assistant%3Apull";
  const { body: tokenBody } = await checkedJson(tokenUrl, {
    fetchImpl,
    label: "official GHCR read token",
  });
  if (typeof tokenBody.token !== "string" || !tokenBody.token) {
    throw new Error("official GHCR read token response was invalid");
  }
  const manifestUrl = `https://ghcr.io/v2/home-assistant/home-assistant/manifests/${version}`;
  const response = await fetchImpl(manifestUrl, {
    headers: {
      Accept: MANIFEST_ACCEPT,
      Authorization: `Bearer ${tokenBody.token}`,
      "User-Agent": "glt-flow-card-ha-lane-resolver/1",
    },
  });
  if (!response.ok) throw new Error(`official Home Assistant image ${version} returned HTTP ${response.status}`);
  const indexDigest = response.headers.get("docker-content-digest");
  if (!DIGEST_PATTERN.test(indexDigest ?? "")) {
    throw new Error(`official Home Assistant image ${version} exposed mutable-only metadata`);
  }
  const manifest = await response.json();
  if (!Array.isArray(manifest.manifests)) {
    throw new Error(`official Home Assistant image ${version} did not expose a multi-architecture index`);
  }
  const selected = manifest.manifests.find(({ platform }) => (
    platform?.os === "linux" && platform?.architecture === architecture && !platform?.variant
  )) ?? manifest.manifests.find(({ platform }) => (
    platform?.os === "linux" && platform?.architecture === architecture
  ));
  if (!selected || !DIGEST_PATTERN.test(selected.digest ?? "")) {
    throw new Error(`official Home Assistant image ${version} has no immutable linux/${architecture} architecture`);
  }
  return {
    architecture,
    digest: selected.digest,
    image: `${IMAGE_SOURCE}@${selected.digest}`,
    index_digest: indexDigest,
    os: "linux",
    source: IMAGE_SOURCE,
    tag: version,
  };
}

export async function resolveHarnessVersion(haVersion, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const [{ body: haMetadata }, { body: harnessMetadata }] = await Promise.all([
    checkedJson(`${HOME_ASSISTANT_PYPI}/${haVersion}/json`, { fetchImpl, label: `Home Assistant ${haVersion}` }),
    checkedJson(`${HARNESS_PYPI}/json`, { fetchImpl, label: "pytest Home Assistant harness" }),
  ]);
  const uploaded = new Date(haMetadata.urls?.[0]?.upload_time_iso_8601 ?? "");
  if (Number.isNaN(uploaded.getTime())) throw new Error(`Home Assistant ${haVersion} upload provenance is missing`);
  const candidates = Object.entries(harnessMetadata.releases ?? {})
    .map(([version, files]) => ({ version, uploaded: new Date(files?.[0]?.upload_time_iso_8601 ?? "") }))
    .filter(({ uploaded: candidate }) => (
      !Number.isNaN(candidate.getTime()) && Math.abs(candidate - uploaded) <= 31 * 86_400_000
    ))
    .sort((left, right) => left.uploaded - right.uploaded);
  for (const candidate of candidates) {
    const { body } = await checkedJson(`${HARNESS_PYPI}/${candidate.version}/json`, {
      fetchImpl,
      label: `pytest Home Assistant harness ${candidate.version}`,
    });
    if ((body.info?.requires_dist ?? []).some((requirement) => (
      new RegExp(`^homeassistant==${haVersion.replaceAll(".", "\\.")}(?:;|$)`, "u").test(requirement)
    ))) {
      return candidate.version;
    }
  }
  throw new Error(`no supported pytest Home Assistant harness pins homeassistant==${haVersion}`);
}

async function officialCatalog(fetchImpl) {
  const { body } = await checkedJson(`${HOME_ASSISTANT_PYPI}/json`, {
    fetchImpl,
    label: "official Home Assistant release catalog",
  });
  const current = body.info?.version;
  if (!parseHaVersion(current)) throw new Error(`official latest Home Assistant release is not stable: ${current}`);
  const versions = Object.entries(body.releases ?? {})
    .filter(([, files]) => files?.some((file) => file.yanked !== true))
    .map(([version]) => version);
  return { current, versions };
}

async function officialLane(version, { architecture, fetchImpl }) {
  const [image, harness] = await Promise.all([
    resolveOfficialImage(version, { architecture, fetchImpl }),
    resolveHarnessVersion(version, { fetchImpl }),
  ]);
  return { ...image, harness };
}

export async function resolveLanePlan(options) {
  const floor = options.floor;
  const maxCandidates = options.maxCandidates ?? 12;
  const fetchImpl = options.fetchImpl ?? fetch;
  const architecture = options.architecture ?? runnerArchitecture();
  const probe = options.probe;
  if (typeof probe !== "function") throw new Error("minimum lane probe is required");
  const catalog = await officialCatalog(fetchImpl);
  const candidates = enumerateCandidates(catalog.versions, floor, maxCandidates);
  const attempts = [];
  let minimum = null;
  for (const version of candidates) {
    const lane = await officialLane(version, { architecture, fetchImpl });
    const result = await probe(lane);
    attempts.push({
      architecture: lane.architecture,
      digest: lane.digest,
      harness: lane.harness,
      passed: result?.passed === true,
      reason: result?.reason ?? null,
      tag: lane.tag,
    });
    if (result?.passed === true) {
      minimum = lane;
      break;
    }
  }
  if (!minimum) {
    throw new Error(`no supported Home Assistant lane passed within ${candidates.length} bounded candidates`);
  }
  const current = minimum.tag === catalog.current
    ? minimum
    : await officialLane(catalog.current, { architecture, fetchImpl });
  return {
    attempts,
    current,
    floor,
    generated_at: new Date().toISOString(),
    minimum,
    minimum_raised: minimum.tag !== floor,
    resolver: {
      candidate_limit: maxCandidates,
      release_source: HOME_ASSISTANT_PYPI,
      image_source: IMAGE_SOURCE,
    },
  };
}

export function replaceMinimumVersion(source, from, to, relativePath) {
  if (!source.includes(from)) throw new Error(`${relativePath} does not declare Home Assistant ${from}`);
  const replaced = source.replaceAll(from, to);
  if (replaced.includes(from) || !replaced.includes(to)) {
    throw new Error(`${relativePath} minimum-version replacement was incomplete`);
  }
  return replaced;
}

async function readFloor() {
  const metadata = JSON.parse(await readFile(path.join(ROOT, "hacs.json"), "utf8"));
  if (!parseHaVersion(metadata.homeassistant)) {
    throw new Error(`root hacs.json has invalid Home Assistant floor: ${metadata.homeassistant}`);
  }
  return metadata.homeassistant;
}

function runNpm(script) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
  const args = npmCli ? [npmCli, "run", script] : ["run", script];
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: !npmCli && process.platform === "win32",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm run ${script} failed with status ${result.status}`);
}

async function replaceOwnedMinimum(from, to) {
  const originals = new Map();
  for (const relativePath of minimumDeclarationFiles) {
    const absolutePath = path.join(ROOT, relativePath);
    const source = await readFile(absolutePath, "utf8");
    originals.set(absolutePath, source);
  }
  try {
    for (const relativePath of minimumDeclarationFiles) {
      const absolutePath = path.join(ROOT, relativePath);
      await writeFile(
        absolutePath,
        replaceMinimumVersion(originals.get(absolutePath), from, to, relativePath),
        "utf8",
      );
    }
  } catch (error) {
    await Promise.all([...originals].map(([absolutePath, source]) => writeFile(absolutePath, source, "utf8")));
    throw error;
  }
  return async () => Promise.all(
    [...originals].map(([absolutePath, source]) => writeFile(absolutePath, source, "utf8")),
  );
}

function parseArgs(argv) {
  const options = { maxCandidates: 12, preflightOnly: false };
  for (const argument of argv) {
    if (argument.startsWith("--max-candidates=")) options.maxCandidates = Number(argument.split("=")[1]);
    else if (argument.startsWith("--architecture=")) options.architecture = argument.split("=")[1];
    else if (argument.startsWith("--evidence=")) options.evidence = path.resolve(argument.split("=")[1]);
    else if (argument === "--preflight-only") options.preflightOnly = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.maxCandidates) || options.maxCandidates < 1 || options.maxCandidates > 12) {
    throw new Error("--max-candidates must be an integer from 1 through 12");
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const floor = await readFloor();
  const runner = await import(pathToFileURL(path.join(ROOT, "tools/test-ha-artifacts.mjs")));
  const plan = await resolveLanePlan({
    architecture: options.architecture,
    floor,
    maxCandidates: options.maxCandidates,
    probe: runner.probeLane,
  });
  const evidencePath = options.evidence ?? path.join(ROOT, ".planning/tmp/ha-lanes.json");
  await mkdir(path.dirname(evidencePath), { recursive: true });
  if (options.preflightOnly) {
    await writeFile(evidencePath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    console.log(`PASS immutable Home Assistant lane preflight: ${evidencePath}`);
    return;
  }

  let restore = null;
  try {
    if (plan.minimum_raised) restore = await replaceOwnedMinimum(floor, plan.minimum.tag);
    runNpm("build");
    runNpm("stage:hacs");
    runNpm("validate:hacs-staging");
    await runner.testHaArtifacts({ lanes: [plan.minimum, plan.current] });
    await writeFile(evidencePath, `${JSON.stringify({ ...plan, verified: true }, null, 2)}\n`, "utf8");
  } catch (error) {
    if (restore) {
      await restore();
      runNpm("build");
      runNpm("stage:hacs");
    }
    throw error;
  }
  console.log(`PASS Home Assistant minimum=${plan.minimum.tag} current=${plan.current.tag}`);
  console.log(`PASS immutable lane evidence: ${evidencePath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
