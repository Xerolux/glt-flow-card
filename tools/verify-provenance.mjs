// Read-only dependency provenance verification for the exact Phase-1 allowlist.
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ALLOWLIST_URL = new URL("./provenance-allowlist.json", import.meta.url);
const EXPECTED_IDENTITIES = new Map([
  ["@playwright/test", { ecosystem: "npm", version: "1.62.1", owner: "microsoft", repository: "playwright", lifecycle_scripts: {} }],
  ["@zip.js/zip.js", { ecosystem: "npm", version: "2.8.30", owner: "gildas-lormeau", repository: "zip.js", lifecycle_scripts: {} }],
  ["ajv", { ecosystem: "npm", version: "8.20.0", owner: "ajv-validator", repository: "ajv", lifecycle_scripts: { prepublish: "npm run build" } }],
  ["jsonschema", { ecosystem: "pypi", version: "4.26.0", owner: "python-jsonschema", repository: "jsonschema", lifecycle_scripts: {} }],
  ["pytest-homeassistant-custom-component", { ecosystem: "pypi", version: "0.13.316", owner: "MatthewFlamm", repository: "pytest-homeassistant-custom-component", lifecycle_scripts: {} }],
]);
const TOP_LEVEL_KEYS = ["packages", "policy_version"];
const PACKAGE_KEYS = ["artifacts", "ecosystem", "hash_policy", "lifecycle_scripts", "name", "registry_url", "source", "version"];
const SOURCE_KEYS = ["api_url", "owner", "repository"];
const ARTIFACT_KEYS = ["algorithm", "digest", "filename", "url"];
const AUTOMATIC_NPM_SCRIPTS = new Set([
  "dependencies",
  "install",
  "postinstall",
  "postpack",
  "postprepare",
  "preinstall",
  "prepack",
  "prepare",
  "preprepare",
  "prepublish",
]);

function fail(message) {
  throw new Error(`Provenance verification failed: ${message}`);
}

function exactKeys(value, expected, label) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} contains missing or unknown fields`);
  }
}

function exactObject(actual, expected, label) {
  const actualJson = canonicalJson(actual);
  const expectedJson = canonicalJson(expected);
  if (actualJson !== expectedJson) {
    fail(`${label} drift (${actualJson} != ${expectedJson})`);
  }
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function expectedRegistryUrl(entry) {
  if (entry.ecosystem === "npm") {
    return `https://registry.npmjs.org/${encodeURIComponent(entry.name)}/${entry.version}`;
  }
  return `https://pypi.org/pypi/${entry.name}/${entry.version}/json`;
}

function assertSafeArtifact(artifact, ecosystem, name) {
  exactKeys(artifact, ARTIFACT_KEYS, `artifact for ${name}`);
  if (basename(artifact.filename) !== artifact.filename || artifact.filename.includes("\\")) {
    fail(`unsafe artifact filename for ${name}`);
  }
  const url = new URL(artifact.url);
  const expectedHost = ecosystem === "npm" ? "registry.npmjs.org" : "files.pythonhosted.org";
  if (url.protocol !== "https:" || url.hostname !== expectedHost) {
    fail(`non-canonical artifact URL for ${name}`);
  }
  if (ecosystem === "npm") {
    if (artifact.algorithm !== "sha512" || !/^[A-Za-z0-9+/]+={0,2}$/.test(artifact.digest)) {
      fail(`invalid npm integrity for ${name}`);
    }
  } else if (artifact.algorithm !== "sha256" || !/^[a-f0-9]{64}$/.test(artifact.digest)) {
    fail(`invalid PyPI hash for ${name}`);
  }
}

export function validateAllowlist(policy) {
  exactKeys(policy, TOP_LEVEL_KEYS, "allowlist");
  if (policy.policy_version !== 1 || !Array.isArray(policy.packages)) {
    fail("unsupported policy version or package collection");
  }
  if (policy.packages.length !== EXPECTED_IDENTITIES.size) {
    fail("allowlist must contain exactly five packages");
  }

  const names = policy.packages.map((entry) => entry?.name);
  if (JSON.stringify(names) !== JSON.stringify([...names].sort())) {
    fail("allowlist packages must be sorted by name");
  }
  if (new Set(names).size !== names.length) fail("duplicate package name");

  for (const entry of policy.packages) {
    exactKeys(entry, PACKAGE_KEYS, `package ${entry?.name ?? "<unknown>"}`);
    const expected = EXPECTED_IDENTITIES.get(entry.name);
    if (!expected) fail(`unlisted package request ${entry.name}`);
    if (entry.ecosystem !== expected.ecosystem || entry.version !== expected.version) {
      fail(`identity drift for ${entry.name}`);
    }
    if (entry.registry_url !== expectedRegistryUrl(entry)) {
      fail(`registry URL drift for ${entry.name}`);
    }
    if (entry.hash_policy !== "exact-set") fail(`hash policy drift for ${entry.name}`);
    exactKeys(entry.source, SOURCE_KEYS, `source for ${entry.name}`);
    if (entry.source.owner !== expected.owner || entry.source.repository !== expected.repository) {
      fail(`source owner drift for ${entry.name}`);
    }
    const expectedApi = `https://api.github.com/repos/${expected.owner}/${expected.repository}`;
    if (entry.source.api_url !== expectedApi) fail(`source API URL drift for ${entry.name}`);
    exactObject(entry.lifecycle_scripts, expected.lifecycle_scripts, `lifecycle scripts for ${entry.name}`);
    if (!Array.isArray(entry.artifacts) || entry.artifacts.length === 0) {
      fail(`missing artifact hashes for ${entry.name}`);
    }
    const filenames = entry.artifacts.map((artifact) => artifact.filename);
    if (new Set(filenames).size !== filenames.length) fail(`duplicate artifact filename for ${entry.name}`);
    for (const artifact of entry.artifacts) assertSafeArtifact(artifact, entry.ecosystem, entry.name);
  }
  return policy;
}

function githubIdentity(value) {
  const match = String(value ?? "").match(/github\.com[/:]([^/]+)\/([^/#]+?)(?:\.git)?(?:[#/].*)?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

function npmLifecycleScripts(metadata) {
  return Object.fromEntries(
    Object.entries(metadata.scripts ?? {})
      .filter(([name]) => AUTOMATIC_NPM_SCRIPTS.has(name))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function artifactTuple(artifact) {
  return `${artifact.filename}\u0000${artifact.url}\u0000${artifact.algorithm}\u0000${artifact.digest}`;
}

function exactArtifactSet(actual, expected, name, label = "artifact set") {
  const actualSet = actual.map(artifactTuple).sort();
  const expectedSet = expected.map(artifactTuple).sort();
  if (JSON.stringify(actualSet) !== JSON.stringify(expectedSet)) {
    fail(`${label} drift for ${name}`);
  }
}

async function checkedFetch(url, fetchImpl, label) {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": "glt-flow-card-provenance-verifier" },
    redirect: "follow",
  });
  if (!response?.ok) fail(`${label} request returned HTTP ${response?.status ?? "unknown"}`);
  return response;
}

async function readJson(url, fetchImpl, label) {
  const response = await checkedFetch(url, fetchImpl, label);
  try {
    return await response.json();
  } catch (error) {
    fail(`${label} returned invalid JSON: ${error.message}`);
  }
}

function verifyNpmMetadata(entry, metadata) {
  if (metadata.name !== entry.name || metadata.version !== entry.version) {
    fail(`identity drift for ${entry.name}`);
  }
  const repository = typeof metadata.repository === "string" ? metadata.repository : metadata.repository?.url;
  const expectedSource = `${entry.source.owner}/${entry.source.repository}`;
  if (githubIdentity(repository) !== expectedSource) fail(`source drift for ${entry.name}`);
  exactObject(npmLifecycleScripts(metadata), entry.lifecycle_scripts, `lifecycle scripts for ${entry.name}`);

  const integrity = String(metadata.dist?.integrity ?? "");
  const separator = integrity.indexOf("-");
  if (separator < 1 || !metadata.dist?.tarball) fail(`registry integrity missing for ${entry.name}`);
  exactArtifactSet([{
    algorithm: integrity.slice(0, separator),
    digest: integrity.slice(separator + 1),
    filename: basename(new URL(metadata.dist.tarball).pathname),
    url: metadata.dist.tarball,
  }], entry.artifacts, entry.name, "registry integrity");
}

function verifyPypiMetadata(entry, metadata) {
  if (metadata.info?.name !== entry.name || metadata.info?.version !== entry.version) {
    fail(`identity drift for ${entry.name}`);
  }
  const expectedSource = `${entry.source.owner}/${entry.source.repository}`;
  const sourceUrls = Object.values(metadata.info?.project_urls ?? {});
  if (!sourceUrls.some((url) => githubIdentity(url) === expectedSource)) {
    fail(`source drift for ${entry.name}`);
  }
  if (Object.keys(entry.lifecycle_scripts).length !== 0) fail(`lifecycle scripts unsupported for ${entry.name}`);

  const registryArtifacts = (metadata.urls ?? []).map((artifact) => ({
    algorithm: "sha256",
    digest: artifact.digests?.sha256,
    filename: artifact.filename,
    url: artifact.url,
  }));
  if ((metadata.urls ?? []).some((artifact) => artifact.yanked)) fail(`yanked artifact for ${entry.name}`);
  exactArtifactSet(registryArtifacts, entry.artifacts, entry.name);
}

async function verifySource(entry, fetchImpl) {
  const metadata = await readJson(entry.source.api_url, fetchImpl, `source metadata for ${entry.name}`);
  const expected = `${entry.source.owner}/${entry.source.repository}`;
  if (metadata.full_name !== expected || githubIdentity(metadata.html_url) !== expected) {
    fail(`source drift for ${entry.name}`);
  }
  if (metadata.disabled === true) fail(`source repository disabled for ${entry.name}`);
  return { host: "github.com", owner: entry.source.owner, repository: entry.source.repository };
}

async function downloadAndVerify(entry, directory, fetchImpl) {
  const results = [];
  for (const artifact of entry.artifacts) {
    const response = await checkedFetch(artifact.url, fetchImpl, `artifact ${artifact.filename}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const target = join(directory, artifact.filename);
    await writeFile(target, bytes, { flag: "wx" });
    const persisted = await readFile(target);
    const encoding = artifact.algorithm === "sha256" ? "hex" : "base64";
    const digest = createHash(artifact.algorithm).update(persisted).digest(encoding);
    if (digest !== artifact.digest) fail(`downloaded integrity mismatch for ${entry.name}/${artifact.filename}`);
    results.push({
      algorithm: artifact.algorithm,
      digest,
      filename: artifact.filename,
      verified: true,
    });
  }
  return results;
}

export async function verifyPackage(entry, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("fetch is unavailable");
  const parent = options.tempRoot ?? tmpdir();
  const directory = await mkdtemp(join(parent, "glt-provenance-"));
  try {
    const registry = await readJson(entry.registry_url, fetchImpl, `registry metadata for ${entry.name}`);
    if (entry.ecosystem === "npm") verifyNpmMetadata(entry, registry);
    else if (entry.ecosystem === "pypi") verifyPypiMetadata(entry, registry);
    else fail(`unsupported ecosystem ${entry.ecosystem}`);
    const source = await verifySource(entry, fetchImpl);
    const artifacts = await downloadAndVerify(entry, directory, fetchImpl);
    return {
      artifacts,
      identity: `${entry.ecosystem}:${entry.name}@${entry.version}`,
      lifecycle_scripts: entry.lifecycle_scripts,
      source,
    };
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

export function createFixtureFetch(fixtures) {
  return async (url) => {
    const fixture = fixtures[String(url)];
    if (!fixture) throw new Error(`Unrecorded fixture URL: ${url}`);
    const status = fixture.status ?? 200;
    const body = fixture.json !== undefined
      ? JSON.stringify(fixture.json)
      : Buffer.from(fixture.body_base64 ?? "", "base64");
    const headers = fixture.json !== undefined ? { "content-type": "application/json" } : {};
    return new Response(body, { headers, status });
  };
}

export async function verifyProvenance(policy, options = {}) {
  validateAllowlist(policy);
  const packages = [];
  for (const entry of policy.packages) {
    packages.push(await verifyPackage(entry, options));
  }
  return {
    mode: options.mode ?? "online",
    packages,
    policy_sha256: createHash("sha256").update(`${canonicalJson(policy)}\n`).digest("hex"),
    report_version: 1,
    verified: true,
  };
}

function parseArguments(args) {
  const options = { fixtures: null, online: false, output: ".planning/tmp/phase01-provenance.json" };
  for (const argument of args) {
    if (argument === "--online") options.online = true;
    else if (argument.startsWith("--fixtures=")) options.fixtures = argument.slice("--fixtures=".length);
    else if (argument.startsWith("--output=")) options.output = argument.slice("--output=".length);
    else fail(`unknown or unlisted request ${argument}`);
  }
  if (options.online === Boolean(options.fixtures)) fail("select exactly one of --online or --fixtures");
  return options;
}

function resolveEvidencePath(value) {
  const evidenceRoot = resolve(process.cwd(), ".planning", "tmp");
  const target = resolve(process.cwd(), value);
  const fromRoot = relative(evidenceRoot, target);
  if (fromRoot === "" || (!fromRoot.startsWith("..") && !resolve(fromRoot).startsWith(".."))) return target;
  fail("output must be inside .planning/tmp");
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const policy = JSON.parse(await readFile(DEFAULT_ALLOWLIST_URL, "utf8"));
  let fetchImpl = globalThis.fetch;
  let mode = "online";
  if (args.fixtures) {
    const fixtureDocument = JSON.parse(await readFile(resolve(process.cwd(), args.fixtures), "utf8"));
    exactKeys(fixtureDocument, ["responses"], "fixture document");
    fetchImpl = createFixtureFetch(fixtureDocument.responses);
    mode = "fixture";
  }
  const report = await verifyProvenance(policy, { fetchImpl, mode });
  const output = resolveEvidencePath(args.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "w" });
  process.stdout.write(`Verified ${report.packages.length} package provenance records (${mode}).\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
