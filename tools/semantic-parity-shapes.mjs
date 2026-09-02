/**
 * The shared semantic-model shapes both runtimes must agree on.
 *
 * These builders used to be duplicated in the Node sentinel and in the Python
 * suite, and the two copies had silently diverged: the Node copy pushed a
 * literal 4096 wide nodes and named its duplicate "Duplicate", the Python copy
 * derived its width from BOUNDS and named it "Dup". The parity test compared
 * only error codes, so it never noticed it was validating two different models.
 *
 * One JavaScript construction now lives here, and the corpus records a
 * canonical digest per shape so the independent Python construction has to
 * produce the same bytes, not merely the same verdict.
 */
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

/** The corpus order: the valid base first, then every rejected shape. */
export const SHAPE_NAMES = Object.freeze(["valid", ...REJECTED_SHAPES]);

/**
 * The bounds these shapes are built to exceed.
 *
 * Declared here rather than imported from `semantic-model.mjs` on purpose: the
 * RED sentinel imports this module, and a static import of the module under
 * test would turn a missing module into a harness failure instead of the named
 * product gap the classifier expects. `generate-semantic-parity-corpus.mjs`
 * imports both and asserts these equal the real bounds, so the duplication
 * cannot drift.
 */
export const DECLARED_BOUNDS = Object.freeze({
  max_depth: 32,
  max_nodes: 20000,
  max_children: 2048,
});

/** Depth overshoot for `over_depth`; twice the bound leaves no doubt. */
const OVER_DEPTH_NODES = DECLARED_BOUNDS.max_depth * 2;

/** Breadth overshoot for `over_breadth`. */
const OVER_BREADTH_NODES = DECLARED_BOUNDS.max_children + 8;

/** A minimal valid model, used as the base every rejected shape mutates. */
export function validModel() {
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

export function mutate(shape) {
  if (shape === "valid") return validModel();
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
      for (let index = 0; index < OVER_DEPTH_NODES; index += 1) {
        model.nodes.push({
          id: `deep-${index}`, level: "subsystem",
          parent: index === 0 ? "sys-heat" : `deep-${index - 1}`, name: `Deep ${index}`,
        });
      }
      break;
    case "over_breadth":
      for (let index = 0; index < OVER_BREADTH_NODES; index += 1) {
        model.nodes.push({
          id: `wide-${index}`, level: "equipment", parent: "sub-primary", name: `Wide ${index}`,
        });
      }
      break;
    default: throw new Error(`unhandled shape ${shape}`);
  }
  return model;
}

/** The parameters the Python construction must mirror exactly. */
export const SHAPE_PARAMETERS = Object.freeze({
  over_depth_nodes: OVER_DEPTH_NODES,
  over_breadth_nodes: OVER_BREADTH_NODES,
});
