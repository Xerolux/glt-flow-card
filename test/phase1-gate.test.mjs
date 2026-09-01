import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP_EVIDENCE = ".planning/tmp";

let acceptance;
let tempRoot;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function copyFile(relativePath, destinationRoot) {
  const destination = path.join(destinationRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(ROOT, relativePath), destination);
}

async function createAcceptanceFixture() {
  const fixtureRoot = path.join(tempRoot, `acceptance-${Date.now()}-${Math.random()}`);
  const buildManifest = JSON.parse(await readFile(
    path.join(ROOT, "custom_components/glt_flow_card/build-manifest.json"),
    "utf8",
  ));
  const required = new Set([
    "package.json",
    "package-lock.json",
    "tools/provenance-allowlist.json",
    "custom_components/glt_flow_card/manifest.json",
    "custom_components/glt_flow_card/build-manifest.json",
    ...buildManifest.sources.map(({ path: sourcePath }) => sourcePath),
    ...buildManifest.artifacts.map(({ path: artifactPath }) => artifactPath),
  ]);
  for (const relativePath of required) await copyFile(relativePath, fixtureRoot);
  await cp(path.join(ROOT, "build/release"), path.join(fixtureRoot, "build/release"), {
    recursive: true,
  });
  await mkdir(path.join(fixtureRoot, TMP_EVIDENCE), { recursive: true });
  for (const evidence of [
    "phase01-provenance.json",
    "ha-lanes.json",
    "ha-artifact-results.json",
  ]) {
    await copyFile(`${TMP_EVIDENCE}/${evidence}`, fixtureRoot);
  }

  const card = await readFile(path.join(fixtureRoot, "dist/glt-flow-card.js"));
  const stageManifest = await readFile(path.join(
    fixtureRoot,
    "build/release/hacs-staging-manifest.json",
  ));
  const evidenceRoot = path.join(fixtureRoot, TMP_EVIDENCE);
  await writeFile(path.join(evidenceRoot, "release-build-verification.json"), `${JSON.stringify({
    format: "glt-flow-card-release-build-verification",
    report_version: 1,
    source_commit: buildManifest.build.commit,
    build_manifest_sha256: sha256(await readFile(path.join(
      fixtureRoot,
      "custom_components/glt_flow_card/build-manifest.json",
    ))),
    verified: true,
    double_build: { passed: true },
    checked_in_outputs: { passed: true },
  }, null, 2)}\n`);
  await writeFile(path.join(evidenceRoot, "exact-dist-results.json"), `${JSON.stringify({
    format: "glt-flow-card-exact-dist-results",
    report_version: 1,
    card_sha256: sha256(card),
    passed: true,
    skipped: false,
  }, null, 2)}\n`);

  const haResultsPath = path.join(evidenceRoot, "ha-artifact-results.json");
  const haResults = JSON.parse(await readFile(haResultsPath, "utf8"));
  for (const lane of haResults.evidence) {
    lane.staging_manifest_sha256 = sha256(stageManifest);
  }
  await writeFile(haResultsPath, `${JSON.stringify(haResults, null, 2)}\n`);
  return fixtureRoot;
}

before(async () => {
  acceptance = await import("../tools/verify-release-acceptance.mjs");
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "glt-phase1-gate-"));
});

after(async () => {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
});

test("release acceptance joins source build stage browser HA and release identities", async () => {
  const fixtureRoot = await createAcceptanceFixture();
  const report = await acceptance.verifyReleaseAcceptance({
    root: fixtureRoot,
    runBrowser: false,
    tag: "v1.0.0",
  });
  assert.equal(report.verified, true);
  assert.equal(report.release.version, "1.0.0");
  assert.equal(report.artifacts.card.sha256, report.browser.card_sha256);
  assert.equal(report.artifacts.card.sha256, report.home_assistant.card_sha256);
  assert.equal(report.artifacts.companion_zip.sha256, report.home_assistant.zip_sha256);
});

test("release acceptance fails closed on mutated skipped or stale evidence", async () => {
  const mutations = [
    {
      name: "mutated-stage-card",
      expected: /plugin artifact hash mismatch/,
      mutate: async (root) => writeFile(
        path.join(root, "build/release/hacs-plugin/glt-flow-card.js"),
        "mutated\n",
      ),
    },
    {
      name: "skipped-browser",
      expected: /exact-dist evidence.*skipped/i,
      mutate: async (root) => {
        const evidencePath = path.join(root, TMP_EVIDENCE, "exact-dist-results.json");
        const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
        evidence.skipped = true;
        await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      },
    },
    {
      name: "stale-ha-card",
      expected: /Home Assistant card hash mismatch/,
      mutate: async (root) => {
        const evidencePath = path.join(root, TMP_EVIDENCE, "ha-artifact-results.json");
        const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
        evidence.evidence[0].card_sha256 = "0".repeat(64);
        await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      },
    },
    {
      name: "missing-double-build",
      expected: /double-build evidence.*missing/i,
      mutate: async (root) => {
        const evidencePath = path.join(root, TMP_EVIDENCE, "release-build-verification.json");
        const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
        delete evidence.double_build;
        await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      },
    },
  ];

  for (const mutation of mutations) {
    const fixtureRoot = await createAcceptanceFixture();
    await mutation.mutate(fixtureRoot);
    await assert.rejects(
      acceptance.verifyReleaseAcceptance({ root: fixtureRoot, runBrowser: false }),
      mutation.expected,
      mutation.name,
    );
  }
});

test("release workflow publishes downloaded exact assets without rebuild or mirror", async () => {
  const workflow = await readFile(path.join(ROOT, ".github/workflows/release.yml"), "utf8");
  const publishJob = workflow.slice(workflow.indexOf("  release:"));
  assert.match(workflow, /^permissions:\s*\n\s+contents: read/m);
  assert.match(workflow, /actions\/download-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /attest(?:-build-provenance)?@[a-f0-9]{40}/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /attestations: write/);
  assert.doesNotMatch(publishJob, /npm (?:run )?build|npm install|npm ci/);
  assert.doesNotMatch(workflow, /mirror|companion[_-](?:repo|token)|repository_dispatch/i);
});

test("Phase-1 plan executes every canonical threat owner exactly once without recursion", async () => {
  const phase1 = await import("../tools/verify-phase1.mjs");
  const plan = await phase1.loadPhase1Plan({ root: ROOT });
  assert.deepEqual(plan.owner_commands.map(({ id }) => id), [
    "T-01",
    "T-02",
    "T-03",
    "T-04",
    "T-05",
    "T-06",
    "T-07",
    "T-08",
  ]);
  assert.equal(new Set(plan.owner_commands.map(({ command }) => command)).size, 8);
  for (const owner of plan.owner_commands) {
    assert.equal(plan.commands.filter(({ command }) => command === owner.command).length, 1, owner.id);
  }
  assert.ok(plan.commands.every(({ command }) => !command.includes("test:phase1")));
  assert.deepEqual(Object.keys(plan.requirements), ["SCHEMA-01", "DIFF-01", "HACS-01"]);
  assert.equal(Object.keys(plan.roadmap).length, 5);
  assert.equal(Object.keys(plan.threats).length, 8);
  assert.equal(Object.keys(plan.tasks).length, 30);
});

test("Phase-1 evidence refuses missing skipped zero-test stale and unmapped results", async () => {
  const phase1 = await import("../tools/verify-phase1.mjs");
  const plan = await phase1.loadPhase1Plan({ root: ROOT });
  const results = Object.fromEntries(plan.commands.map(({ id, command }) => [id, {
    command,
    duration_ms: 1,
    exit_code: 0,
    output_sha256: "a".repeat(64),
    passed: true,
    skipped: false,
    test_count: 1,
  }]));
  const valid = phase1.validatePhase1Evidence(plan, results);
  assert.equal(valid.verified, true);

  const cases = [
    ["missing", (copy) => { delete copy[plan.commands[0].id]; }, /missing command result/i],
    ["skipped", (copy) => { copy[plan.commands[0].id].skipped = true; }, /skipped/i],
    ["zero-test", (copy) => { copy[plan.commands[0].id].test_count = 0; }, /zero tests/i],
    ["stale", (copy) => { copy[plan.commands[0].id].command = "stale"; }, /stale command/i],
  ];
  for (const [name, mutate, expected] of cases) {
    const copy = structuredClone(results);
    mutate(copy);
    assert.throws(() => phase1.validatePhase1Evidence(plan, copy), expected, name);
  }
  const unmapped = structuredClone(plan);
  unmapped.requirements["SCHEMA-01"].evidence = [];
  assert.throws(() => phase1.validatePhase1Evidence(unmapped, results), /SCHEMA-01.*unmapped/i);
});

test("Phase-1 documentation states tested boundaries without public or capacity overclaim", async () => {
  const files = await Promise.all([
    "README.md",
    "README.de.md",
    "docs/wiki/Installation.md",
    "docs/wiki/YAML-Projects.md",
    "docs/wiki/Companion-Backend.md",
  ].map((relativePath) => readFile(path.join(ROOT, relativePath), "utf8")));
  const joined = files.join("\n");
  for (const expected of [
    /raw (?:validation )?errors/i,
    /migration/i,
    /rollback|restore/i,
    /diff/i,
    /conflict/i,
    /bundle/i,
    /standalone/i,
    /local integration-category stage/i,
    /no physical plant write/i,
    /not a capacity certification/i,
  ]) assert.match(joined, expected);
  assert.doesNotMatch(joined, /Companion (?:is|now) (?:public|available) (?:in|through) HACS/i);
});
