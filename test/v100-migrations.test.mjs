import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load as loadYaml } from "js-yaml";

import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  SCHEMA_MIRRORED_FIELDS,
  migrateProjectDocument,
} from "../src/v100/project-migrations.mjs";
import { evaluateProjectContract } from "../src/v100/project-contract.mjs";
import { ensureV1, migrateProject } from "../src/v100/core.mjs";
import { pythonArgs, resolvePython } from "../tools/python-launcher.mjs";

const legacyProject = () => ({
  type: "custom:glt-flow-card",
  title: "Werk Süd",
  equipment: [{ id: "pump-1", type: "pump", vendor_data: { channel: 7 } }],
  extensions: { vendor_alpha: { retained: true } },
  unknown_top_level: { retained: "yes" },
});

const versionOneProject = () => ({
  ...legacyProject(),
  schema_version: 1,
});

const versionTwoProject = () => ({
  ...versionOneProject(),
  schema_version: 2,
  project: { id: "werk-sud", name: "Werk Süd", revision: 0 },
});

const currentProject = () => ({
  ...versionTwoProject(),
  schema_version: CURRENT_PROJECT_SCHEMA_VERSION,
  contributions: [],
  semantic_model: { nodes: [] },
});

test("migration executes exact 0→1→2→3→4→5→6→7 copy-on-write steps with receipted evidence", () => {
  const source = legacyProject();
  const before = JSON.stringify(source);
  const result = migrateProjectDocument(source, { dryRun: true });

  assert.equal(CURRENT_PROJECT_SCHEMA_VERSION, 7);
  assert.equal(JSON.stringify(source), before);
  assert.notStrictEqual(result.candidate, source);
  assert.deepEqual(result.receipt.steps.map(({ from, to }) => [from, to]), [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]);
  assert.equal(result.receipt.source_schema_version, 0);
  assert.equal(result.receipt.candidate_schema_version, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.match(result.receipt.source_digest, /^[a-f0-9]{64}$/);
  assert.match(result.receipt.candidate_digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.receipt.warnings, []);
  assert.deepEqual(result.receipt.loss, { dropped: [], preserved: [] });
  assert.equal(result.candidate.project.name, "Werk Süd");
  assert.equal(result.candidate.project.id, "werk-sud");
  assert.deepEqual(result.candidate.extensions.vendor_alpha, { retained: true });
  assert.deepEqual(result.candidate.unknown_top_level, { retained: "yes" });
  assert.deepEqual(result.candidate.equipment[0].vendor_data, { channel: 7 });
});

test("dry-run and apply modes are pure and return identical candidate and receipt", () => {
  const source = versionOneProject();
  const dryRun = migrateProjectDocument(source, { dryRun: true });
  const apply = migrateProjectDocument(source, { dryRun: false });

  assert.deepEqual(apply, dryRun);
  assert.deepEqual(dryRun.receipt.steps.map(({ from, to }) => [from, to]), [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]);
  assert.equal(source.schema_version, 1);
  assert.equal("project" in source, false);
});

test("current projects are idempotent and future or invalid inputs fail closed", () => {
  const current = currentProject();
  const result = migrateProjectDocument(current);

  assert.deepEqual(result.candidate, current);
  assert.deepEqual(result.receipt.steps, []);
  assert.equal(result.receipt.source_digest, result.receipt.candidate_digest);
  // One past the current version, derived, so this keeps testing the future
  // boundary instead of testing a version that has since shipped.
  const future = CURRENT_PROJECT_SCHEMA_VERSION + 1;
  assert.throws(
    () => migrateProjectDocument({ ...current, schema_version: future }),
    new RegExp(`unsupported project schema version ${future}`, "i"),
  );
  assert.throws(
    () => migrateProjectDocument({ schema_version: 1, title: "missing card type" }),
    /source project contract is invalid/i,
  );
});

test("Python migration result is byte-equivalent to JavaScript", () => {
  const requests = [legacyProject(), versionOneProject(), currentProject()].map((document, index) => ({
    id: `migration-${index}`,
    document,
    options: { dry_run: index % 2 === 0 },
  }));
  const expected = requests.map((request) => JSON.stringify({
    id: request.id,
    result: migrateProjectDocument(request.document, { dryRun: request.options.dry_run }),
  })).join("\n") + "\n";
  const python = spawnSync(
    resolvePython().command,
    pythonArgs("-m", "custom_components.glt_flow_card.project_migrations", "--json-lines"),
    { input: requests.map((request) => JSON.stringify(request)).join("\n") + "\n", encoding: "utf8" },
  );

  assert.equal(python.status, 0, python.stderr);
  assert.equal(python.stdout, expected);
});

test("public migration shape stays compatible while exposing hardened evidence", () => {
  const source = legacyProject();
  const result = migrateProject(source);

  assert.equal(result.from, 0);
  assert.equal(result.to, 1);
  assert.equal(result.changed, true);
  assert.equal(result.config.schema_version, 1);
  assert.equal(result.candidate.schema_version, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.equal(result.receipt.source_digest, migrateProjectDocument(source).receipt.source_digest);
  assert.throws(
    () => migrateProject({ schema_version: 1, title: "silently repairable before hardening" }),
    /source project contract is invalid/i,
  );
});

test("existing YAML examples retain identities and references through ensureV1", () => {
  const names = [
    "idm-alm6-15.yaml",
    "idm-engineering-workspace.yaml",
    "idm-neo2030.yaml",
    "ventilation-glt.yaml",
  ];
  for (const name of names) {
    const raw = loadYaml(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"));
    const before = JSON.stringify(raw);
    const normalized = ensureV1(raw);
    assert.equal(JSON.stringify(raw), before, `${name} source mutated`);
    assert.deepEqual(normalized.equipment.map(({ id }) => id), (raw.equipment || []).map(({ id }) => id), name);
    assert.deepEqual(normalized.paths.map(({ id }) => id), (raw.paths || []).map(({ id }) => id), name);
  }
});

test("the migration's field lists and schema 6 declare the same fields", () => {
  // Two lists that must agree. They disagreed once during development --
  // `state` was declared in the schema and missing from the migration's list --
  // and the symptom was not a validation error but a Phase-4 roll-up counting
  // nothing, because the migration quarantined a field the schema kept. A
  // mismatch is silent by nature, so it is asserted rather than reviewed.
  const schema = JSON.parse(readFileSync(
    new URL("../schemas/project/7.schema.json", import.meta.url), "utf8",
  ));
  for (const [shape, fields] of Object.entries(SCHEMA_MIRRORED_FIELDS)) {
    const declared = Object.keys(schema.$defs[shape].properties).sort();
    assert.deepEqual([...fields].sort(), declared, shape);
  }
});

test("schema 6 closes the shapes that were open objects, and refuses what they used to accept", () => {
  // T7-21. Before schema 6, `trend`, `energy`, `historian`, `reports` and
  // `replay` were all `openObject`, so every field the series code, the energy
  // code and the report code read was undeclared. `period: "sometimes"` and
  // `deadband: "a bit"` were schema-valid and failed inside a computed figure,
  // which is the worst place for a validation error to surface.
  const base = {
    project: { id: "p1", name: "P", revision: 1 },
    schema_version: 6,
    title: "T",
    type: "custom:glt-flow-card",
  };
  const accepted = evaluateProjectContract({
    ...base,
    energy: { meters: [{ id: "m1", model: "counter", unit: "kWh" }] },
    trend: { aggregate: "mean", deadband: 0.5, enabled: true },
  });
  assert.equal(accepted.valid, true, JSON.stringify(accepted.errors));

  for (const [label, patch] of [
    ["an undeclared aggregate", { trend: { aggregate: "p95" } }],
    ["a non-numeric deadband", { trend: { deadband: "a bit" } }],
    ["an undeclared trend field", { trend: { sometimes: true } }],
    ["a meter with no model", { energy: { meters: [{ id: "m1", unit: "kWh" }] } }],
    ["a meter with an unknown model", { energy: { meters: [{ id: "m1", model: "guess" }] } }],
    ["an undeclared period name", { energy: { period: { name: "sometimes" } } }],
    ["a report format nobody renders", { reports: { definitions: [{ formats: ["fax"], id: "r1" }] } }],
  ]) {
    const evidence = evaluateProjectContract({ ...base, ...patch });
    assert.equal(evidence.valid, false, `schema 6 accepted ${label}`);
  }
});

test("the 5→6 migration reports what it cannot decide rather than guessing", () => {
  // A meter's model cannot be read off every unit, and guessing either way
  // produces a plausible number: `counter` makes a power sensor's lifetime
  // reading a cost, `rate` integrates something that was never a rate.
  const migrated = migrateProjectDocument({
    energy: {
      meters: [
        { entity: "sensor.a", id: "known", unit: "kWh" },
        { entity: "sensor.b", id: "unknown", unit: "BTU/h" },
      ],
    },
    project: { id: "p1", name: "P", revision: 1 },
    schema_version: 5,
    title: "T",
    type: "custom:glt-flow-card",
  }, { dryRun: true });

  const [known, unknown] = migrated.candidate.energy.meters;
  assert.equal(known.model, "counter", "kWh is a counter and needs no guess");
  // The undecidable one still gets a model, because the schema requires one,
  // but the unit it could not be read from is quarantined so the receipt says
  // an operator has to choose.
  assert.ok(unknown.legacy?.model !== undefined, "an undecidable model was guessed silently");
});

test("the 5→6 migration refuses to call 43 200 minutes a month", () => {
  // A month is 720, 743 or 745 hours depending on where the transition falls.
  // Mapping a fixed bucket onto it would carry D9 forward under a new name.
  const migrated = migrateProjectDocument({
    historian: { bucket_minutes: 43_200 },
    project: { id: "p1", name: "P", revision: 1 },
    schema_version: 5,
    title: "T",
    type: "custom:glt-flow-card",
  }, { dryRun: true });

  assert.equal(migrated.candidate.historian.bucket_minutes, undefined);
  assert.equal(migrated.candidate.historian.legacy.bucket_minutes, 43_200);
  // A bucket that *does* name a period is kept as-is.
  const daily = migrateProjectDocument({
    historian: { bucket_minutes: 1440 },
    project: { id: "p1", name: "P", revision: 1 },
    schema_version: 5,
    title: "T",
    type: "custom:glt-flow-card",
  }, { dryRun: true });
  assert.equal(daily.candidate.historian.bucket_minutes, 1440);
});
