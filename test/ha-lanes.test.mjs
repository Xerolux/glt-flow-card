/* Immutable Home Assistant lane and exact-artifact execution contracts. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESOLVER = path.join(ROOT, "tools/resolve-ha-lanes.mjs");
const RUNNER = path.join(ROOT, "tools/test-ha-artifacts.mjs");
const FLOOR = "2024.8.0";

async function loadResolver() {
  assert.equal(existsSync(RESOLVER), true, "resolve-ha-lanes.mjs must implement immutable lane resolution");
  return import(pathToFileURL(RESOLVER));
}

function response(body, { status = 200, headers = {} } = {}) {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalized.get(name.toLowerCase()) ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function registryFetch(fixtures = {}) {
  const digest = (character) => `sha256:${character.repeat(64)}`;
  const versions = fixtures.versions ?? ["2024.8.0", "2024.8.1", "2024.9.0b1", "2026.8.3"];
  return async (url, options = {}) => {
    const target = String(url);
    if (target === "https://pypi.org/pypi/homeassistant/json") {
      return response({
        info: { version: fixtures.current ?? "2026.8.3" },
        releases: Object.fromEntries(versions.map((version, index) => [version, [{
          upload_time_iso_8601: new Date(Date.UTC(2024 + index, 7, 7)).toISOString(),
          yanked: false,
        }]])),
      });
    }
    if (/pypi\.org\/pypi\/homeassistant\/[^/]+\/json$/u.test(target)) {
      const version = target.split("/").at(-2);
      return response({ info: { version }, urls: [{ upload_time_iso_8601: "2024-08-07T00:00:00Z" }] });
    }
    if (target === "https://pypi.org/pypi/pytest-homeassistant-custom-component/json") {
      return response({ releases: {
        "0.13.151": [{ upload_time_iso_8601: "2024-08-07T00:00:00Z" }],
        "0.13.152": [{ upload_time_iso_8601: "2024-08-08T00:00:00Z" }],
      } });
    }
    if (target.endsWith("pytest-homeassistant-custom-component/0.13.151/json")) {
      return response({ info: { requires_dist: ["homeassistant==2024.7.4"] } });
    }
    if (target.endsWith("pytest-homeassistant-custom-component/0.13.152/json")) {
      return response({ info: { requires_dist: ["homeassistant==2024.8.0"] } });
    }
    if (target.startsWith("https://ghcr.io/token?")) return response({ token: "read-only-token" });
    if (target.includes("/manifests/")) {
      assert.match(options.headers?.Accept ?? options.headers?.accept ?? "", /manifest/u);
      const reference = target.split("/").at(-1);
      return response({
        manifests: [
          { digest: digest("b"), platform: { architecture: "amd64", os: "linux" } },
          { digest: digest("c"), platform: { architecture: "arm64", os: "linux" } },
        ],
        schemaVersion: 2,
      }, {
        headers: {
          "content-type": "application/vnd.docker.distribution.manifest.list.v2+json",
          "docker-content-digest": reference.startsWith("sha256:") ? reference : digest("a"),
        },
      });
    }
    throw new Error(`unexpected fixture request: ${target}`);
  };
}

test("stable official candidates start at the advertised floor and stay bounded", async () => {
  const { enumerateCandidates, parseHaVersion } = await loadResolver();
  assert.deepEqual(parseHaVersion("2024.8.0"), { major: 2024, minor: 8, patch: 0, version: "2024.8.0" });
  assert.equal(parseHaVersion("2026.9.0b4"), null);
  assert.deepEqual(
    enumerateCandidates(
      ["2026.8.3", "2024.9.0b1", "2024.8.2", "2024.8.1", "2024.8.0", "2024.7.4"],
      FLOOR,
      2,
    ),
    ["2024.8.0", "2024.8.1"],
  );
  assert.throws(() => enumerateCandidates(["2024.8.1"], FLOOR, 12), /advertised floor/u);
  assert.throws(() => enumerateCandidates([FLOOR], FLOOR, 13), /at most 12/u);
});

test("official GHCR evidence pins the runner architecture and immutable image digest", async () => {
  const { resolveOfficialImage } = await loadResolver();
  const lane = await resolveOfficialImage(FLOOR, {
    architecture: "amd64",
    fetchImpl: registryFetch(),
  });
  assert.deepEqual(lane, {
    architecture: "amd64",
    digest: `sha256:${"b".repeat(64)}`,
    image: `ghcr.io/home-assistant/home-assistant@sha256:${"b".repeat(64)}`,
    index_digest: `sha256:${"a".repeat(64)}`,
    os: "linux",
    source: "ghcr.io/home-assistant/home-assistant",
    tag: FLOOR,
  });
  await assert.rejects(
    resolveOfficialImage(FLOOR, { architecture: "ppc64le", fetchImpl: registryFetch() }),
    /architecture/u,
  );
});

test("pytest harness version is discovered from exact official dependency metadata", async () => {
  const { resolveHarnessVersion } = await loadResolver();
  assert.equal(await resolveHarnessVersion(FLOOR, { fetchImpl: registryFetch() }), "0.13.152");
});

test("minimum resolution selects the first passing official lane and current independently", async () => {
  const { resolveLanePlan } = await loadResolver();
  const attempts = [];
  const plan = await resolveLanePlan({
    architecture: "amd64",
    fetchImpl: registryFetch({ versions: [FLOOR, "2024.8.1", "2026.8.3"] }),
    floor: FLOOR,
    maxCandidates: 12,
    probe: async (lane) => {
      attempts.push(lane.tag);
      return { passed: lane.tag !== FLOOR, reason: lane.tag === FLOOR ? "fixture failure" : null };
    },
  });
  assert.deepEqual(attempts, [FLOOR, "2024.8.1"]);
  assert.equal(plan.minimum.tag, "2024.8.1");
  assert.equal(plan.current.tag, "2026.8.3");
  assert.equal(plan.minimum_raised, true);
  assert.equal(plan.attempts[0].passed, false);
  assert.match(plan.minimum.digest, /^sha256:[a-f0-9]{64}$/u);
  assert.match(plan.current.digest, /^sha256:[a-f0-9]{64}$/u);
});

test("all owned minimum declarations contain one replaceable advertised floor", async () => {
  const { minimumDeclarationFiles, replaceMinimumVersion } = await loadResolver();
  assert.deepEqual(minimumDeclarationFiles, [
    "hacs.json",
    "packaging/hacs-plugin/hacs.json",
    "packaging/hacs-integration/hacs.json",
    "packaging/hacs-integration/README.md",
    "README.md",
    "README.de.md",
    "docs/wiki/Installation.md",
  ]);
  for (const relativePath of minimumDeclarationFiles) {
    const source = await readFile(path.join(ROOT, relativePath), "utf8");
    const replaced = replaceMinimumVersion(source, FLOOR, "2024.8.1", relativePath);
    assert.notEqual(replaced, source, `${relativePath} must own the advertised HA floor`);
    assert.equal(replaced.includes(FLOOR), false, `${relativePath} retained the old floor`);
    assert.equal(replaced.includes("2024.8.1"), true);
  }
});

test("package scripts expose bounded minimum resolution and exact-artifact lanes", async () => {
  assert.equal(existsSync(RUNNER), true, "test-ha-artifacts.mjs must execute staged HA artifacts");
  const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["resolve:ha-minimum"], "node tools/resolve-ha-lanes.mjs");
  assert.equal(packageJson.scripts["test:ha-artifacts"], "node tools/test-ha-artifacts.mjs");
});
