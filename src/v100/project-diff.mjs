/* Policy-driven semantic project diff and dependency closure. */
import DIFF_POLICY from "../../schemas/diff-policy.json" with { type: "json" };

import {
  digestCanonicalJson,
  evaluateProjectContract,
} from "./project-contract.mjs";

const clone = (value) => JSON.parse(digestCanonicalJson(value).canonical);
const pointerPart = (value) => String(value).replace(/~/g, "~0").replace(/\//g, "~1");
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const identityCollections = new Set(DIFF_POLICY.order.identity_keyed_collections);
const moveFields = new Set(DIFF_POLICY.category_rules.move_fields);

function validDocument(rawInput, label) {
  const evidence = evaluateProjectContract(rawInput);
  if (!evidence.valid) {
    const details = evidence.errors.map((error) => `${error.code}@${error.path}`).join(", ");
    throw new Error(`${label} project contract is invalid: ${details}`);
  }
  return { document: JSON.parse(evidence.canonical), evidence };
}

function valueHash(value, present) {
  return present ? digestCanonicalJson(value).digest : null;
}

function categoryFor(parts) {
  const last = parts.at(-1) || "";
  if (parts.some((part) => moveFields.has(part))) return "move";
  if (
    ["entity", "entity_id", "state_entity"].includes(last)
    || parts[0] === "bindings"
    || (parts[0] === "fields" && parts.length >= 3 && last === "entity")
    || (parts[0] === "slots" && parts.length >= 3 && last === "entity_id")
  ) return "binding";
  return DIFF_POLICY.category_rules.fallback_category;
}

function impactFor(category, path) {
  if (/^\/(security|permissions|plugins)(\/|$)/.test(path)) {
    return { severity: "critical", areas: ["security"] };
  }
  const areas = {
    add: ["none"],
    remove: ["operational", "referential"],
    move: ["visual"],
    binding: ["binding", "operational"],
    config: ["operational"],
  }[category];
  return {
    severity: DIFF_POLICY.impact.default_by_category[category],
    areas,
  };
}

function operation(category, path, collection, objectId, relativeParts, before, beforePresent, after, afterPresent) {
  return {
    id: `${category}:${path}`,
    category,
    path,
    collection,
    object_id: objectId,
    field: relativeParts.length ? `/${relativeParts.map(pointerPart).join("/")}` : "",
    before_hash: valueHash(before, beforePresent),
    after_hash: valueHash(after, afterPresent),
    before: beforePresent ? clone(before) : null,
    after: afterPresent ? clone(after) : null,
    impact: impactFor(category, path),
    requires: [],
  };
}

function compareValue(operations, before, beforePresent, after, afterPresent, context) {
  if (beforePresent && afterPresent && Object.is(before, after)) return;
  if (!beforePresent || !afterPresent) {
    const category = context.relativeParts.length === 0
      ? (beforePresent ? "remove" : "add")
      : categoryFor(context.relativeParts);
    operations.push(operation(
      category,
      context.path,
      context.collection,
      context.objectId,
      context.relativeParts,
      before,
      beforePresent,
      after,
      afterPresent,
    ));
    return;
  }
  const beforeArray = Array.isArray(before);
  const afterArray = Array.isArray(after);
  const beforeObject = before !== null && typeof before === "object";
  const afterObject = after !== null && typeof after === "object";
  if (beforeArray !== afterArray || beforeObject !== afterObject || !beforeObject || before === null || after === null) {
    operations.push(operation(
      categoryFor(context.relativeParts),
      context.path,
      context.collection,
      context.objectId,
      context.relativeParts,
      before,
      true,
      after,
      true,
    ));
    return;
  }
  if (beforeArray) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      compareValue(operations, before[index], index < before.length, after[index], index < after.length, {
        ...context,
        path: `${context.path}/${index}`,
        relativeParts: [...context.relativeParts, String(index)],
      });
    }
    return;
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    compareValue(
      operations,
      before[key],
      Object.hasOwn(before, key),
      after[key],
      Object.hasOwn(after, key),
      {
        ...context,
        path: `${context.path}/${pointerPart(key)}`,
        relativeParts: [...context.relativeParts, key],
      },
    );
  }
}

function identityMap(document, collection) {
  return new Map((document[collection] || []).map((entry) => [entry[DIFF_POLICY.identity_fields[collection]], entry]));
}

function addDependencies(operations, before, after) {
  const operationIds = new Set(operations.map(({ id }) => id));
  const beforeMaps = new Map();
  const afterMaps = new Map();
  for (const collection of Object.keys(DIFF_POLICY.identity_fields)) {
    beforeMaps.set(collection, identityMap(before, collection));
    afterMaps.set(collection, identityMap(after, collection));
  }
  for (const current of operations) {
    if (!current.collection || !current.object_id) continue;
    const references = DIFF_POLICY.dependencies.references.filter(({ from }) => from === current.collection);
    const sourceMap = current.category === "remove" ? beforeMaps : afterMaps;
    const source = sourceMap.get(current.collection)?.get(current.object_id);
    if (!source) continue;
    const requirements = new Map();
    for (const reference of references) {
      for (const field of reference.fields) {
        const targetId = source[field];
        if (typeof targetId !== "string") continue;
        const targetPath = `/${reference.to}/${pointerPart(targetId)}`;
        const targetOperation = current.category === "remove" ? `remove:${targetPath}` : `add:${targetPath}`;
        if (operationIds.has(targetOperation)) {
          requirements.set(targetOperation, {
            operation_id: targetOperation,
            reason: `reference:${reference.from}.${field}->${reference.to}`,
          });
        }
      }
    }
    current.requires = [...requirements.values()].sort((left, right) => compareText(left.operation_id, right.operation_id));
  }
}

export function computeProjectDiff(beforeInput, afterInput) {
  const beforeResult = validDocument(beforeInput, "source");
  const afterResult = validDocument(afterInput, "candidate");
  const before = beforeResult.document;
  const after = afterResult.document;
  const operations = [];
  const orderingNoise = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    if (identityCollections.has(key) && Array.isArray(before[key]) && Array.isArray(after[key])) {
      const beforeMap = identityMap(before, key);
      const afterMap = identityMap(after, key);
      const beforeIds = [...beforeMap.keys()];
      const afterIds = [...afterMap.keys()];
      if (beforeIds.length === afterIds.length
        && beforeIds.every((id) => afterMap.has(id))
        && beforeIds.some((id, index) => id !== afterIds[index])) {
        orderingNoise.push(`/${pointerPart(key)}`);
      }
      const ids = [...new Set([...beforeIds, ...afterIds])].sort();
      for (const id of ids) {
        compareValue(
          operations,
          beforeMap.get(id),
          beforeMap.has(id),
          afterMap.get(id),
          afterMap.has(id),
          { path: `/${pointerPart(key)}/${pointerPart(id)}`, collection: key, objectId: id, relativeParts: [] },
        );
      }
      continue;
    }
    compareValue(
      operations,
      before[key],
      Object.hasOwn(before, key),
      after[key],
      Object.hasOwn(after, key),
      { path: `/${pointerPart(key)}`, collection: null, objectId: null, relativeParts: [key] },
    );
  }
  operations.sort((left, right) => compareText(left.id, right.id));
  addDependencies(operations, before, after);
  return {
    policy_version: DIFF_POLICY.policy_version,
    source_digest: beforeResult.evidence.digest,
    candidate_digest: afterResult.evidence.digest,
    operations,
    ordering_noise: orderingNoise.sort(),
  };
}

export function expandDiffSelection(diffResult, selectedOperationIds) {
  const operations = new Map((diffResult?.operations || []).map((operationValue) => [operationValue.id, operationValue]));
  const requested = [...new Set(selectedOperationIds || [])].sort();
  for (const operationId of requested) {
    if (!operations.has(operationId)) throw new Error(`unknown selected operation ${operationId}`);
  }
  const state = new Map();
  const included = new Set();
  const added = new Map();
  const visit = (operationId, requiredBy = null, reason = null, chain = []) => {
    if (!operations.has(operationId)) throw new Error(`missing dependency operation ${operationId}`);
    if (state.get(operationId) === "visiting") {
      throw new Error(`cyclic diff dependency: ${[...chain, operationId].join(" -> ")}`);
    }
    if (state.get(operationId) === "done") return;
    state.set(operationId, "visiting");
    if (requiredBy !== null && !requested.includes(operationId) && !added.has(operationId)) {
      added.set(operationId, { operation_id: operationId, required_by: requiredBy, reason });
    }
    const requirements = [...(operations.get(operationId).requires || [])]
      .sort((left, right) => compareText(left.operation_id, right.operation_id));
    for (const requirement of requirements) {
      visit(requirement.operation_id, operationId, requirement.reason, [...chain, operationId]);
    }
    state.set(operationId, "done");
    included.add(operationId);
  };
  for (const operationId of requested) visit(operationId);
  return {
    selected: [...included].sort(),
    requested,
    added: [...added.values()].sort((left, right) => compareText(left.operation_id, right.operation_id)),
  };
}
