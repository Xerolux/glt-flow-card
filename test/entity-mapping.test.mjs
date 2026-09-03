/**
 * Explained entity mapping (T3-09, T3-10).
 *
 * A ranking you cannot argue with is a ranking you have to trust blindly, which
 * is the thing this requirement exists to prevent. Every candidate therefore
 * carries the reasons that produced its score, and name similarity is the last
 * signal and never sufficient on its own.
 *
 * The iDM corpus carries four traps a naive ranker fails: a setpoint whose name
 * is a superstring of the measurement slot, a same-named sensor on a different
 * device and integration, a pressure reading on the right device with no slot
 * to hold it, and kW against a kWh slot.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const MODULE_URL = new URL("../src/v100/entity-mapping.mjs", import.meta.url);
const PROFILE_URL = new URL("./fixtures/idm/heat-pump.profile.json", import.meta.url);
const ENTITIES_URL = new URL("./fixtures/idm/heat-pump.entities.json", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase3-mapping]: explained dual-runtime entity mapping is unavailable";
const EFFECT_PREFIX = "PHASE3_MAPPING_EFFECTS ";

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({ network: 0, autoBinds: 0, ...extra }));
}

async function loadMapping() {
  try {
    return await import(MODULE_URL.href);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

async function corpus() {
  const [profile, entities] = await Promise.all([
    readFile(PROFILE_URL, "utf8").then(JSON.parse),
    readFile(ENTITIES_URL, "utf8").then(JSON.parse),
  ]);
  return { profile, entities };
}

test("the corpus really contains traps a name-only ranker would fail", async () => {
  const { entities } = await corpus();
  const traps = entities.entities.filter((entity) => entity.trap);
  assert.ok(traps.length >= 4, `expected at least four traps, found ${traps.length}`);
  assert.ok(traps.some((entity) => entity.trap === "name"));
  assert.ok(traps.some((entity) => entity.trap === "dimension"));
  for (const trap of traps) {
    assert.equal(trap.expected_slot, null, `${trap.entity_id} must not be a correct answer`);
    assert.ok(trap.why, `${trap.entity_id} does not say why it is a trap`);
  }
});

test("[expected-red:phase3-mapping] ranking explains itself and beats the traps", async () => {
  const { profile, entities } = await corpus();
  emitEffects({ candidates: entities.entities.length, slots: profile.slots.length });
  const gaps = [];
  const mapping = await loadMapping();

  if (!mapping) {
    gaps.push("src/v100/entity-mapping.mjs does not exist");
  } else {
    for (const name of ["rankCandidates", "REASON_CODES", "applyOverride"]) {
      if (mapping[name] === undefined) gaps.push(`entity-mapping.mjs does not export ${name}`);
    }

    if (gaps.length === 0) {
      const expected = new Map(
        entities.entities.filter((entity) => entity.expected_slot)
          .map((entity) => [entity.expected_slot, entity.entity_id]),
      );

      for (const slot of profile.slots) {
        const ranked = mapping.rankCandidates({
          slot, slots: profile.slots, candidates: entities.entities, device: entities.device,
        });
        if (!Array.isArray(ranked)) {
          gaps.push(`ranking slot ${slot.id} did not return a list`);
          continue;
        }
        for (const candidate of ranked) {
          if (!Array.isArray(candidate.reasons) || candidate.reasons.length === 0) {
            gaps.push(`${candidate.entity_id} scored for ${slot.id} without reasons`);
          }
        }
        const winner = ranked[0];
        const shouldWin = expected.get(slot.id);
        if (shouldWin && winner?.entity_id !== shouldWin) {
          gaps.push(`slot ${slot.id} ranked ${winner?.entity_id ?? "nothing"} first, expected ${shouldWin}`);
        }
        const trapFirst = entities.entities.find(
          (entity) => entity.trap && entity.entity_id === winner?.entity_id,
        );
        if (trapFirst) {
          gaps.push(`slot ${slot.id} was won by the ${trapFirst.trap} trap ${trapFirst.entity_id}`);
        }
      }

      // Name similarity alone must never be enough.
      const nameOnly = mapping.rankCandidates({
        slot: profile.slots[0],
        candidates: [{ entity_id: "sensor.flow_temperature", integration: "other", device: null, area: "Elsewhere" }],
        device: entities.device,
      });
      if (nameOnly[0] && nameOnly[0].reasons.every((reason) => reason.code === "name_similarity")) {
        if (nameOnly[0].sufficient !== false) {
          gaps.push("a candidate resting only on name similarity was not marked insufficient");
        }
      }

      // A manual override is a decision, not a score, so re-ranking cannot
      // overrule it.
      const slot = profile.slots[0];
      const overridden = mapping.applyOverride(
        mapping.rankCandidates({ slot, slots: profile.slots, candidates: entities.entities, device: entities.device }),
        { entity_id: "sensor.weather_station_outdoor_temperature", by: "engineer-a" },
      );
      if (overridden[0]?.entity_id !== "sensor.weather_station_outdoor_temperature") {
        gaps.push("a manual override did not sort first");
      }
      if (overridden[0]?.override !== true) {
        gaps.push("a manual override is not marked as a decision");
      }
      const reranked = mapping.applyOverride(
        mapping.rankCandidates({ slot, slots: profile.slots, candidates: entities.entities, device: entities.device }),
        { entity_id: "sensor.weather_station_outdoor_temperature", by: "engineer-a" },
      );
      if (reranked[0]?.entity_id !== overridden[0]?.entity_id) {
        gaps.push("re-ranking overruled a manual override");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps.slice(0, 20)) console.log(`  mapping gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "explained dual-runtime entity mapping is unavailable");
});
