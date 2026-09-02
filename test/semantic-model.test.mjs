/**
 * The validated semantic hierarchy (T3-01, T3-02, T3-12).
 *
 * A hierarchy that accepts a cycle is a hierarchy nothing can safely walk:
 * navigation loops, permission inheritance never terminates and a roll-up sums
 * a node into itself. A vocabulary that accepts an unknown unit defers the
 * failure to whoever first tries to convert it.
 *
 * The module does not exist yet. It is imported dynamically so a missing module
 * is reported as a named product gap rather than crashing the run, which would
 * look like a broken harness.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/semantic-model.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase3-semantic-model]: the validated semantic hierarchy is unavailable";
const EFFECT_PREFIX = "PHASE3_SEMANTIC_EFFECTS ";

/** The containment order. A node may only contain a level below its own. */
export const SEMANTIC_LEVELS = Object.freeze([
  "site", "building", "floor", "system", "subsystem", "equipment", "datapoint",
]);

/** Every way a hierarchy can be malformed, each of which must be rejected. */
export const REJECTED_SHAPES = Object.freeze([
  "self_cycle",
  "two_node_cycle",
  "long_cycle",
  "dangling_parent",
  "inverted_level",
  "multiple_parents",
  "over_depth",
  "over_breadth",
]);

/** Vocabulary positions that must refuse an unknown member. */
export const VOCABULARY_POSITIONS = Object.freeze([
  "unit", "medium", "direction", "semantic_tag",
]);

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, localStorage: 0, callService: 0, ...extra,
  }));
}

async function loadModel() {
  try {
    return await import(MODULE_URL.href);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

/** A minimal valid model, used as the base every rejected shape mutates. */
function validModel() {
  return {
    nodes: [
      { id: "site-a", level: "site", parent: null, name: "Site A" },
      { id: "bldg-1", level: "building", parent: "site-a", name: "Building 1" },
      { id: "floor-1", level: "floor", parent: "bldg-1", name: "Floor 1" },
      { id: "sys-heat", level: "system", parent: "floor-1", name: "Heating" },
      { id: "sub-primary", level: "subsystem", parent: "sys-heat", name: "Primary" },
      { id: "eq-hp", level: "equipment", parent: "sub-primary", name: "Heat pump" },
      { id: "dp-flow", level: "datapoint", parent: "eq-hp", name: "Flow", unit: "degC",
        medium: "heating_flow", direction: "input", semantic_tags: ["measurement"] },
    ],
  };
}

function mutate(shape) {
  const model = validModel();
  const byId = Object.fromEntries(model.nodes.map((node) => [node.id, node]));
  switch (shape) {
    case "self_cycle": byId["bldg-1"].parent = "bldg-1"; break;
    case "two_node_cycle": byId["bldg-1"].parent = "floor-1"; break;
    case "long_cycle": byId["site-a"].parent = "eq-hp"; break;
    case "dangling_parent": byId["floor-1"].parent = "does-not-exist"; break;
    case "inverted_level": byId["bldg-1"].parent = "eq-hp"; break;
    case "multiple_parents":
      model.nodes.push({ id: "floor-1", level: "floor", parent: "site-a", name: "Duplicate" });
      break;
    case "over_depth":
      for (let index = 0; index < 64; index += 1) {
        model.nodes.push({
          id: `deep-${index}`, level: "subsystem",
          parent: index === 0 ? "sys-heat" : `deep-${index - 1}`, name: `Deep ${index}`,
        });
      }
      break;
    case "over_breadth":
      for (let index = 0; index < 4096; index += 1) {
        model.nodes.push({
          id: `wide-${index}`, level: "equipment", parent: "sub-primary", name: `Wide ${index}`,
        });
      }
      break;
    default: throw new Error(`unhandled shape ${shape}`);
  }
  return model;
}

test("the level order is a containment order, not an alphabetical one", () => {
  assert.equal(SEMANTIC_LEVELS[0], "site");
  assert.equal(SEMANTIC_LEVELS.at(-1), "datapoint");
  assert.equal(new Set(SEMANTIC_LEVELS).size, SEMANTIC_LEVELS.length);
});

test("every way a hierarchy can be malformed is named", () => {
  for (const shape of ["self_cycle", "two_node_cycle", "long_cycle", "dangling_parent"]) {
    assert.ok(REJECTED_SHAPES.includes(shape), shape);
  }
  assert.ok(REJECTED_SHAPES.includes("multiple_parents"));
});

test("the mutation helper really produces each malformed shape", () => {
  // A rejection test proves nothing if the fixture was valid all along.
  assert.equal(mutate("self_cycle").nodes.find((n) => n.id === "bldg-1").parent, "bldg-1");
  assert.equal(mutate("dangling_parent").nodes.find((n) => n.id === "floor-1").parent, "does-not-exist");
  assert.ok(mutate("over_breadth").nodes.length > 4000);
});

test("[expected-red:phase3-semantic-model] the hierarchy and its vocabularies are validated", async () => {
  emitEffects({ shapes: REJECTED_SHAPES.length });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/semantic-model.mjs does not exist");
  } else {
    for (const name of [
      "SEMANTIC_LEVELS", "UNITS", "MEDIA", "DIRECTIONS", "SEMANTIC_TAGS",
      "BOUNDS", "validateSemanticModel", "semanticPath",
    ]) {
      if (model[name] === undefined) gaps.push(`semantic-model.mjs does not export ${name}`);
    }

    if (gaps.length === 0) {
      if (JSON.stringify([...model.SEMANTIC_LEVELS]) !== JSON.stringify([...SEMANTIC_LEVELS])) {
        gaps.push("the shipped level order does not match the containment order");
      }

      const valid = model.validateSemanticModel(validModel());
      if (valid.length !== 0) {
        gaps.push(`a valid model produced ${valid.length} errors: ${valid.map((e) => e.code).join(", ")}`);
      }

      for (const shape of REJECTED_SHAPES) {
        const errors = model.validateSemanticModel(mutate(shape));
        if (errors.length === 0) {
          gaps.push(`${shape} was accepted`);
          continue;
        }
        if (!errors.every((error) => typeof error.code === "string" && typeof error.path === "string")) {
          gaps.push(`${shape} produced an error without a stable code and path`);
        }
      }

      // A unit outside the vocabulary is a contract error, not a passthrough.
      for (const position of VOCABULARY_POSITIONS) {
        const document = validModel();
        const datapoint = document.nodes.find((node) => node.id === "dp-flow");
        if (position === "semantic_tag") datapoint.semantic_tags = ["not-a-declared-tag"];
        else datapoint[position] = "not-a-declared-member";
        if (model.validateSemanticModel(document).length === 0) {
          gaps.push(`an unknown ${position} was accepted`);
        }
      }

      // A path is derived from parents; nothing may read a stored one.
      const path = model.semanticPath(validModel(), "dp-flow");
      if (!Array.isArray(path) || path.join("/") !== "site-a/bldg-1/floor-1/sys-heat/sub-primary/eq-hp/dp-flow") {
        gaps.push(`semanticPath did not derive the containment path, got ${JSON.stringify(path)}`);
      }

      // Units carry dimensions, or kW and kWh look interchangeable.
      const degrees = model.UNITS?.degC;
      const kilowattHours = model.UNITS?.kWh;
      const kilowatts = model.UNITS?.kW;
      if (!degrees?.dimension || !kilowattHours?.dimension || !kilowatts?.dimension) {
        gaps.push("units do not declare dimensions");
      } else if (kilowattHours.dimension === kilowatts.dimension) {
        gaps.push("energy and power share a dimension, so a prefix match could bind either");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  semantic gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "the validated semantic hierarchy is unavailable");
});
