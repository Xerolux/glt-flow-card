import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  computeProjectDiff,
  expandDiffSelection,
} from "../src/v100/project-diff.mjs";

const project = (overrides = {}) => ({
  type: "custom:glt-flow-card",
  schema_version: 2,
  project: { id: "diff-fixture", name: "Diff Fixture", revision: 0 },
  profiles: [{ id: "profile-1", equipment_type: "pump" }],
  assets: [{ id: "asset-1", path: "assets/pump.svg" }],
  layers: [{ id: "default", name: "Default" }],
  equipment: [{
    id: "pump-1",
    type: "pump",
    name: "Pump One",
    profile: "profile-1",
    asset_id: "asset-1",
    x: 10,
    y: 20,
    entity: "sensor.pump_old",
  }],
  paths: [{ id: "path-1", from_equipment: "pump-1", to_equipment: "pump-1" }],
  datapoints: [{ id: "dp-1", entity: "sensor.dp", layer: "default" }],
  ...overrides,
});

const candidateProject = () => project({
  profiles: [
    { id: "profile-1", equipment_type: "pump" },
    { id: "profile-2", equipment_type: "pump" },
  ],
  assets: [
    { id: "asset-1", path: "assets/pump.svg" },
    { id: "asset-2", path: "assets/pump-2.svg" },
  ],
  equipment: [
    {
      entity: "sensor.pump_new",
      y: 20,
      x: 40,
      asset_id: "asset-1",
      profile: "profile-1",
      name: "Primary Pump",
      type: "pump",
      id: "pump-1",
    },
    {
      id: "pump-2",
      type: "pump",
      profile: "profile-2",
      asset_id: "asset-2",
      x: 80,
      y: 20,
    },
  ],
  paths: [
    { id: "path-2", from_equipment: "pump-2", to_equipment: "pump-1" },
    { id: "path-1", from_equipment: "pump-1", to_equipment: "pump-1" },
  ],
  datapoints: [],
});

test("semantic diff emits deterministic five-category operations and impact", () => {
  const result = computeProjectDiff(project(), candidateProject());
  const categories = new Set(result.operations.map((operation) => operation.category));

  assert.deepEqual([...categories].sort(), ["add", "binding", "config", "move", "remove"]);
  assert.deepEqual(result.operations.map((operation) => operation.id), [...result.operations.map((operation) => operation.id)].sort());
  assert.ok(result.operations.every((operation) => operation.path.startsWith("/")));
  assert.ok(result.operations.every((operation) => operation.before_hash === null || /^[a-f0-9]{64}$/.test(operation.before_hash)));
  assert.ok(result.operations.every((operation) => operation.after_hash === null || /^[a-f0-9]{64}$/.test(operation.after_hash)));
  assert.equal(result.operations.find((operation) => operation.path === "/equipment/pump-1/x").category, "move");
  assert.equal(result.operations.find((operation) => operation.path === "/equipment/pump-1/entity").category, "binding");
  assert.equal(result.operations.find((operation) => operation.path === "/equipment/pump-1/name").category, "config");
  assert.equal(result.operations.find((operation) => operation.path === "/datapoints/dp-1").category, "remove");
  assert.deepEqual(
    result.operations.find((operation) => operation.path === "/equipment/pump-1/entity").impact,
    { severity: "warning", areas: ["binding", "operational"] },
  );
});

test("identity collection order and object key order are ignored only by policy", () => {
  const before = project({
    paths: [],
    equipment: [
      { id: "a", type: "pump", tags: ["one", "two"] },
      { id: "b", type: "pump" },
    ],
  });
  const reordered = project({
    paths: [],
    equipment: [
      { type: "pump", id: "b" },
      { tags: ["one", "two"], type: "pump", id: "a" },
    ],
  });
  const semanticOrderChanged = project({
    paths: [],
    equipment: [
      { id: "a", type: "pump", tags: ["two", "one"] },
      { id: "b", type: "pump" },
    ],
  });

  const noise = computeProjectDiff(before, reordered);
  assert.deepEqual(noise.operations, []);
  assert.deepEqual(noise.ordering_noise, ["/equipment"]);
  assert.ok(computeProjectDiff(before, semanticOrderChanged).operations.some(
    (operation) => operation.category === "config" && operation.path === "/equipment/a/tags/0",
  ));
});

test("selection expands transitively through policy dependencies", () => {
  const diff = computeProjectDiff(project(), candidateProject());
  const selected = diff.operations.find((operation) => operation.path === "/paths/path-2");
  const closure = expandDiffSelection(diff, [selected.id]);

  assert.deepEqual(closure.selected, [
    "add:/assets/asset-2",
    "add:/equipment/pump-2",
    "add:/paths/path-2",
    "add:/profiles/profile-2",
  ]);
  assert.deepEqual(closure.added.map((entry) => entry.operation_id), [
    "add:/assets/asset-2",
    "add:/equipment/pump-2",
    "add:/profiles/profile-2",
  ]);
  assert.ok(closure.added.every((entry) => entry.reason.startsWith("reference:")));
});

test("closure rejects missing selections, missing dependencies, and cycles deterministically", () => {
  const diff = computeProjectDiff(project(), candidateProject());
  assert.throws(() => expandDiffSelection(diff, ["add:/missing/item"]), /unknown selected operation/i);

  const missing = structuredClone(diff);
  missing.operations.find((operation) => operation.path === "/paths/path-2").requires = [
    { operation_id: "add:/equipment/missing", reason: "reference:paths.from_equipment->equipment" },
  ];
  assert.throws(
    () => expandDiffSelection(missing, ["add:/paths/path-2"]),
    /missing dependency operation add:\/equipment\/missing/i,
  );

  const cyclic = structuredClone(diff);
  const path = cyclic.operations.find((operation) => operation.path === "/paths/path-2");
  const equipment = cyclic.operations.find((operation) => operation.path === "/equipment/pump-2");
  path.requires = [{ operation_id: equipment.id, reason: "cycle-a" }];
  equipment.requires = [{ operation_id: path.id, reason: "cycle-b" }];
  assert.throws(() => expandDiffSelection(cyclic, [path.id]), /cyclic diff dependency/i);
});

test("security changes receive critical policy impact and Python bytes match", () => {
  const before = project({ security: { server_enforced: false } });
  const after = project({ security: { server_enforced: true } });
  const result = computeProjectDiff(before, after);
  assert.deepEqual(result.operations[0].impact, { severity: "critical", areas: ["security"] });

  const requests = [{ id: "full", before: project(), after: candidateProject() }, { id: "security", before, after }];
  const expected = requests.map((request) => JSON.stringify({
    id: request.id,
    result: computeProjectDiff(request.before, request.after),
  })).join("\n") + "\n";
  const python = spawnSync(
    "py",
    ["-3.13", "-m", "custom_components.glt_flow_card.project_diff", "--json-lines"],
    { input: requests.map((request) => JSON.stringify(request)).join("\n") + "\n", encoding: "utf8" },
  );

  assert.equal(python.status, 0, python.stderr);
  assert.equal(python.stdout, expected);
});
