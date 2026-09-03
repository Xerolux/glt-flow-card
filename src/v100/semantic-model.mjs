/* The validated semantic containment model.
 *
 * A hierarchy that accepts a cycle is a hierarchy nothing can safely walk:
 * navigation loops, permission inheritance never terminates, and a roll-up sums
 * a node into itself. Reference checking alone cannot catch that — it proves a
 * parent exists, not that the graph has a bottom — so the graph rules live here
 * and run in both runtimes.
 *
 * The vocabularies come from the schema that enforces them, so the module and
 * the contract cannot hold two different opinions about what a unit is.
 */
import { contractVocabularies } from "./generated/project-validators.mjs";

/** Containment order, outermost first. */
export const SEMANTIC_LEVELS = Object.freeze([...contractVocabularies.levels]);

/** Unit symbol -> its dimension. Two units of different dimensions never mix. */
export const UNITS = Object.freeze(contractVocabularies.units);
export const MEDIA = Object.freeze([...contractVocabularies.media]);
export const DIRECTIONS = Object.freeze([...contractVocabularies.directions]);
export const SEMANTIC_TAGS = Object.freeze([...contractVocabularies.semantic_tags]);

/** Structural bounds. A hostile document must not make validation unbounded. */
export const BOUNDS = Object.freeze({ ...contractVocabularies.bounds });

const LEVEL_INDEX = Object.freeze(Object.fromEntries(
  SEMANTIC_LEVELS.map((level, index) => [level, index]),
));

function error(code, path, detail) {
  return detail === undefined ? { code, path } : { code, path, detail };
}

function nodesOf(model) {
  const nodes = model?.nodes;
  return Array.isArray(nodes) ? nodes : [];
}

/**
 * Validate one semantic model and return every problem found.
 *
 * Errors accumulate rather than short-circuiting: an engineer fixing a model
 * wants the whole list, not one problem per round trip. Every error carries a
 * stable code and the path of the node that caused it.
 */
export function validateSemanticModel(model) {
  const nodes = nodesOf(model);
  const errors = [];

  if (nodes.length > BOUNDS.max_nodes) {
    errors.push(error("semantic_model_too_large", "/semantic_model/nodes",
      { nodes: nodes.length, max: BOUNDS.max_nodes }));
    return errors;
  }

  const byId = new Map();
  const children = new Map();
  nodes.forEach((node, index) => {
    const path = `/semantic_model/nodes/${index}`;
    const id = node?.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(error("semantic_node_id_missing", path));
      return;
    }
    if (byId.has(id)) {
      // Two nodes with one id is how a second parent gets in.
      errors.push(error("semantic_node_duplicate_id", path, { id }));
      return;
    }
    byId.set(id, { node, path });
  });

  for (const [id, { node, path }] of byId) {
    if (!Object.hasOwn(LEVEL_INDEX, node.level)) {
      errors.push(error("semantic_level_unknown", path, { level: node.level ?? null }));
    }
    for (const [field, vocabulary] of [
      ["unit", UNITS], ["medium", MEDIA], ["direction", DIRECTIONS],
    ]) {
      const value = node[field];
      if (value === undefined || value === null) continue;
      const known = Array.isArray(vocabulary) ? vocabulary.includes(value) : Object.hasOwn(vocabulary, value);
      if (!known) errors.push(error(`semantic_${field}_unknown`, `${path}/${field}`, { value }));
    }
    if (Array.isArray(node.semantic_tags)) {
      node.semantic_tags.forEach((tag, tagIndex) => {
        if (!SEMANTIC_TAGS.includes(tag)) {
          errors.push(error("semantic_tag_unknown", `${path}/semantic_tags/${tagIndex}`, { tag }));
        }
      });
    }

    const parent = node.parent;
    if (parent === undefined || parent === null) continue;
    const target = byId.get(parent);
    if (target === undefined) {
      errors.push(error("semantic_parent_missing", `${path}/parent`, { parent }));
      continue;
    }
    children.set(parent, (children.get(parent) ?? 0) + 1);
    // A child may sit at its parent's level or deeper — a subsystem inside a
    // subsystem is ordinary plant — but never above it, and nothing lives
    // inside a datapoint.
    const parentLevel = LEVEL_INDEX[target.node.level];
    const nodeLevel = LEVEL_INDEX[node.level];
    if (parentLevel !== undefined && nodeLevel !== undefined) {
      if (nodeLevel < parentLevel) {
        errors.push(error("semantic_level_inverted", `${path}/parent`,
          { level: node.level, parent_level: target.node.level }));
      } else if (target.node.level === "datapoint") {
        errors.push(error("semantic_datapoint_has_child", `${path}/parent`, { parent }));
      }
    }
    void id;
  }

  for (const [parent, count] of children) {
    if (count > BOUNDS.max_children) {
      errors.push(error("semantic_children_exceeded",
        `${byId.get(parent)?.path ?? "/semantic_model/nodes"}`,
        { children: count, max: BOUNDS.max_children }));
    }
  }

  for (const [id, { path }] of byId) {
    const seen = new Set([id]);
    let current = byId.get(id).node.parent;
    let depth = 1;
    while (current !== undefined && current !== null) {
      if (seen.has(current)) {
        errors.push(error("semantic_cycle", `${path}/parent`, { closes_at: current }));
        break;
      }
      seen.add(current);
      const next = byId.get(current);
      if (next === undefined) break;
      depth += 1;
      if (depth > BOUNDS.max_depth) {
        errors.push(error("semantic_depth_exceeded", path, { depth, max: BOUNDS.max_depth }));
        break;
      }
      current = next.node.parent;
    }
  }

  return errors;
}

/**
 * Derive a node's containment path, root first.
 *
 * The path is never stored. A stored path is a second source of truth that
 * starts agreeing with its parents and stops without telling anyone.
 */
export function semanticPath(model, nodeId) {
  const byId = new Map(nodesOf(model).map((node) => [node?.id, node]));
  const path = [];
  const seen = new Set();
  let current = nodeId;
  while (current !== undefined && current !== null && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    path.unshift(current);
    current = byId.get(current).parent;
  }
  return path;
}

/** Whether two units can be compared or summed at all. */
export function sameDimension(left, right) {
  const a = UNITS[left];
  const b = UNITS[right];
  return Boolean(a && b && a.dimension === b.dimension);
}
