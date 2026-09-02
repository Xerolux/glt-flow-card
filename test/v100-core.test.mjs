import test from "node:test";
import assert from "node:assert/strict";
import { SYMBOL_VARIANTS, COMPONENT_PROFILES } from "../src/v100/catalog.mjs";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "../src/v100/project-migrations.mjs";
import { ensureV1, deriveOperationalState, autoMapEquipment, smartRoute, diagnoseConfig, aggregateSeries, projectDiff, makeProjectBundle, readProjectBundle } from "../src/v100/core.mjs";

test("Platform 1.0 exposes a professional symbol/profile catalog", () => {
  assert.ok(SYMBOL_VARIANTS.length >= 300, `expected >=300 symbol variants, got ${SYMBOL_VARIANTS.length}`);
  assert.ok(COMPONENT_PROFILES.length >= 10);
});

test("operational-state precedence puts faults before normal running", () => {
  const now = Date.now();
  const states = {
    "binary_sensor.run": { state: "on", last_updated: new Date(now).toISOString(), attributes: {} },
    "binary_sensor.fault": { state: "on", last_updated: new Date(now).toISOString(), attributes: {} },
  };
  const item = { state_entity: "binary_sensor.run", state_model: { fault: "binary_sensor.fault" } };
  assert.equal(deriveOperationalState(item, states, { now }).code, "fault");
});

test("auto mapping prefers correct domain, name and unit", () => {
  const states = {
    "sensor.hp_flow_temp": { state: "42.1", attributes: { friendly_name: "Wärmepumpe Vorlauf", unit_of_measurement: "°C", device_class: "temperature" } },
    "sensor.outdoor": { state: "8.0", attributes: { friendly_name: "Außen", unit_of_measurement: "°C", device_class: "temperature" } },
  };
  const result = autoMapEquipment({ name: "Wärmepumpe", profile: "heat_pump" }, states);
  assert.equal(result.suggestions.flow_temp[0].entity_id, "sensor.hp_flow_temp");
});

test("smart routing returns orthogonal path and avoids central obstacle where possible", () => {
  const cfg = ensureV1({ equipment: [
    { id:"a", x:0, y:100, width:100, height:80, profile:"pump" },
    { id:"block", x:180, y:60, width:160, height:160, profile:"generic" },
    { id:"b", x:420, y:100, width:100, height:80, profile:"pump" },
  ], routing:{padding:20} });
  const pts = smartRoute(cfg, { from_equipment:"a", to_equipment:"b", medium:"heating_supply" });
  assert.ok(pts.length >= 4);
  for (let i=1;i<pts.length;i++) assert.ok(pts[i][0]===pts[i-1][0] || pts[i][1]===pts[i-1][1], "route must remain orthogonal");
});

test("diagnostics handles 2000 engineered objects", () => {
  const equipment = Array.from({length:2000},(_,i)=>({id:`eq_${i}`,name:`Equipment ${i}`,x:(i%50)*30,y:Math.floor(i/50)*30,entity:`sensor.eq_${i}`}));
  const states = Object.fromEntries(equipment.map((e,i)=>[e.entity,{state:String(i),last_updated:new Date().toISOString(),attributes:{unit_of_measurement:"°C"}}]));
  const result = diagnoseConfig({equipment}, states);
  assert.equal(result.issues.length, 0);
  assert.ok(result.referenced.length >= 2000);
});

test("historian aggregation and deadband work", () => {
  const pts = [{x:0,y:1},{x:1000,y:1.01},{x:2000,y:2},{x:3000,y:3}];
  const reduced = aggregateSeries(pts,{deadband:.1});
  assert.equal(reduced.length, 3);
  const avg = aggregateSeries(pts,{aggregate:"average",bucket_ms:2000});
  assert.equal(avg.length, 2);
});

test("project diff identifies nested changes", () => {
  const diff = projectDiff({equipment:[{id:"a",x:1}]},{equipment:[{id:"a",x:2},{id:"b",x:3}]});
  assert.ok(diff.some(x=>x.path.includes("equipment[a].x") && x.type==="changed"));
  assert.ok(diff.some(x=>x.path.includes("equipment[b]") && x.type==="added"));
});

test(".gltproject bundle migrates and round trips through the safe async API", async () => {
  const cfg = ensureV1({title:"Test",equipment:[{id:"p1",type:"pump",x:10,y:20}]});
  const bundle = await makeProjectBundle(cfg);
  assert.ok(bundle.length > 100);
  const restored = await readProjectBundle(bundle);
  assert.equal(restored.schema_version, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.equal(restored.equipment[0].id, "p1");
});
