import { test } from "node:test";
import assert from "node:assert/strict";
import { saveSharedProject, sharedProjectDocument } from "../src/v100/project-save.mjs";

test("runtime entity bindings roundtrip without losing formatting or attributes", () => {
  const project = {config:{datapoints:[{entity:{entity:"sensor.a",decimals:1,attribute:"temperature"}}],equipment:[{fields:[{entity:{entity:"sensor.b",decimals:2}}]}]}};
  const encoded = sharedProjectDocument(project);
  assert.equal(encoded.config.datapoints[0].entity, "sensor.a");
  assert.equal(encoded.config.equipment[0].fields[0].entity, "sensor.b");
  assert.deepEqual(sharedProjectDocument(encoded, true), project);
  assert.equal(project.config.datapoints[0].entity.decimals, 1);
  assert.equal(sharedProjectDocument({ revision: 2, config: { project: { revision: 1 } } }, true).config.project.revision, 2);
});

test("shared save uses the edited revision and releases its lease after a conflict", async () => {
  const calls = [];
  const hass = { async callWS(message) {
    calls.push(message);
    if (message.type.endsWith("acquire")) return { lease_token: "test-lease" };
    if (message.type.endsWith("save")) throw new Error("revision_conflict");
  } };
  await assert.rejects(saveSharedProject(hass, { id: "plant", config: { project: { revision: 4 } } }), /revision_conflict/);
  assert.equal(calls[1].expected_revision, 4);
  assert.equal(calls[1].lease_token, "test-lease");
  assert.equal(calls[2].type, "glt_flow_card/leases/release");
});

test("new project uses the server bootstrap route without granting browser roles", async () => {
  const calls = [];
  await saveSharedProject({ callWS: async message => { calls.push(message); return { revision: 1 }; } }, { id: "new" }, { create: true });
  assert.deepEqual(calls, [{ type: "glt_flow_card/projects/create", project: { id: "new" } }]);
});
