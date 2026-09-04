import test from "node:test";
import assert from "node:assert/strict";

import { ensureV1 } from "../src/v100/core.mjs";
import { entityExportPayload, normalizeEntityImport } from "../src/v100/core.mjs";
import { FACTORY_TEMPLATES, factoryTemplates } from "../src/v100/templates.mjs";

test("fifteen factory templates ship, each with a unique identity", () => {
  assert.equal(FACTORY_TEMPLATES.length, 20);
  const ids = new Set(FACTORY_TEMPLATES.map((tp) => tp.id));
  assert.equal(ids.size, FACTORY_TEMPLATES.length, "template ids must be unique");
});

test("every template survives normalisation with its structure intact", () => {
  for (const tp of FACTORY_TEMPLATES) {
    const normalized = ensureV1(JSON.parse(JSON.stringify(tp.config)));
    assert.equal(normalized.title, tp.config.title, `${tp.id}: title lost`);
    assert.equal(normalized.equipment.length, tp.config.equipment.length, `${tp.id}: equipment lost`);
    assert.equal(normalized.paths.length, tp.config.paths.length, `${tp.id}: paths lost`);
    const equipmentIds = normalized.equipment.map((eq) => eq.id);
    assert.deepEqual(equipmentIds, tp.config.equipment.map((eq) => eq.id), `${tp.id}: equipment identities changed`);
    assert.ok(normalized.equipment.length >= 2, `${tp.id}: fewer than two pieces of equipment`);
    assert.ok(normalized.paths.length >= 1, `${tp.id}: no paths`);
    for (const path of normalized.paths) {
      assert.ok(Array.isArray(path.points) && path.points.length >= 2, `${tp.id}: path ${path.id} has no segments`);
    }
  }
});

test("templates bind no entities — structure travels, never a claim about a plant", () => {
  for (const tp of FACTORY_TEMPLATES) {
    const serialized = JSON.stringify(tp.config);
    assert.doesNotMatch(serialized, /[a-z_]+\.[a-z0-9_]+",\s*$/, `${tp.id}: template carries entity bindings`);
    for (const eq of tp.config.equipment) {
      for (const field of eq.fields || []) {
        assert.equal(field.entity, "", `${tp.id}/${eq.id}: field ${field.label} is bound`);
      }
    }
  }
});

test("factoryTemplates returns detached copies", () => {
  const first = factoryTemplates();
  first[0].config.title = "manipuliert";
  first[0].config.equipment[0].name = "manipuliert";
  const second = factoryTemplates();
  assert.notEqual(second[0].config.title, "manipuliert");
  assert.notEqual(second[0].config.equipment[0].name, "manipuliert");
});

test("entity export carries identity and metadata, never state values", () => {
  const states = {
    ok: { entity_id: "sensor.vorlauf", state: "45.2", attributes: { friendly_name: "Vorlauf", unit_of_measurement: "°C" } },
    no_name: { entity_id: "light.bad", state: "on", attributes: {} },
    broken: { entity_id: "kein-punkt", state: "x", attributes: {} },
    empty: null,
  };
  const payload = entityExportPayload(states);
  assert.equal(payload.format, "glt-flow-card-entities");
  assert.equal(payload.version, 1);
  assert.equal(payload.count, 2);
  assert.deepEqual(payload.entities.map((e) => e.entity_id), ["light.bad", "sensor.vorlauf"]);
  assert.equal(payload.entities[1].name, "Vorlauf");
  assert.equal(payload.entities[1].unit, "°C");
  assert.equal(payload.entities[1].domain, "sensor");
  assert.ok(!("state" in payload.entities[0]), "state values must not travel with an export");
});

test("entity import round-trips an export and rejects what it cannot trust", () => {
  const states = {
    a: { entity_id: "sensor.vorlauf", attributes: { friendly_name: "Vorlauf", unit_of_measurement: "°C" } },
    b: { entity_id: "binary_sensor.pumpe", attributes: { friendly_name: "Pumpe" } },
  };
  const roundTrip = normalizeEntityImport(entityExportPayload(states));
  assert.equal(roundTrip.count, 2);
  assert.equal(roundTrip.rejected, 0);
  assert.deepEqual(roundTrip.entities.map((e) => e.entity_id), ["binary_sensor.pumpe", "sensor.vorlauf"]);

  const messy = normalizeEntityImport({ entities: [
    ...roundTrip.entities,
    { entity_id: "sensor.vorlauf", name: "Duplikat" },
    { entity_id: "ungültig!" },
    { entity_id: "" },
    { name: "nur name" },
    null,
  ] });
  assert.equal(messy.count, 2, "duplicates and malformed ids must not pass");
  assert.equal(messy.rejected, 5);
  assert.equal(messy.entities[1].name, "Vorlauf");

  assert.equal(normalizeEntityImport(null).count, 0);
  assert.equal(normalizeEntityImport({ entities: "kein array" }).count, 0);
  const fallbackName = normalizeEntityImport([{ entity_id: "sensor.ohne_namen" }]);
  assert.equal(fallbackName.entities[0].name, "sensor.ohne_namen");
});

test("entity import caps untrusted bulk instead of exhausting storage", () => {
  const bulk = Array.from({ length: 30 }, (_, i) => ({ entity_id: `sensor.s${i}` }));
  const capped = normalizeEntityImport(bulk, { limit: 10 });
  assert.equal(capped.count, 10);
  assert.equal(capped.entities[9].entity_id, "sensor.s9");
});
