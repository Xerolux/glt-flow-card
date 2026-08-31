/* Raw-first, runtime-neutral project validation and canonical evidence. */
import { createHash } from "node:crypto";
import {
  contractLimits,
  project0,
  project1,
  project2,
} from "./generated/project-validators.mjs";

const PROJECT_VALIDATORS = [project0, project1, project2];
const ID_COLLECTIONS = [
  "alarms",
  "assets",
  "datapoints",
  "equipment",
  "groups",
  "layers",
  "paths",
  "plugins",
  "profiles",
  "remote_sites",
  "schedules",
  "sites",
  "views",
  "work_orders",
];
const REFERENCE_EDGES = [
  ["paths", ["from_equipment", "to_equipment"], "equipment"],
  ["equipment", ["profile"], "profiles"],
  ["equipment", ["asset_id"], "assets"],
  ["datapoints", ["layer"], "layers"],
];
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function escapePointer(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPointer(path, key) {
  return `${path}/${escapePointer(key)}`;
}

function stableParams(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function issue(code, path, params = {}) {
  return { code, path: path || "/", params: stableParams(params) };
}

function compareIssues(left, right) {
  return left.path.localeCompare(right.path)
    || left.code.localeCompare(right.code)
    || JSON.stringify(left.params).localeCompare(JSON.stringify(right.params));
}

function boundedIssues(errors) {
  const sorted = errors.sort(compareIssues);
  const limit = contractLimits.json.max_errors;
  if (sorted.length <= limit) return sorted;
  const sentinel = issue("contract.error_limit", "/errors", { actual: sorted.length, limit });
  return [...sorted.slice(0, limit - 1), sentinel].sort(compareIssues);
}

function nonJsonError(params = { expected: "json" }) {
  return issue("contract.type", "/", params);
}

function canonicalNumber(value) {
  if (!Number.isFinite(value)) throw new TypeError("non-finite numbers are not JSON values");
  return Object.is(value, -0) ? "0" : JSON.stringify(value);
}

function canonicalValue(value, active) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return canonicalNumber(value);
  if (typeof value !== "object") throw new TypeError("value is not JSON-compatible");
  if (active.has(value)) throw new TypeError("cyclic values are not JSON-compatible");
  active.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalValue(entry, active)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("value is not a plain JSON object");
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== "string")) {
      throw new TypeError("symbol keys are not JSON-compatible");
    }
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalValue(value[key], active)}`
    )).join(",")}}`;
  } finally {
    active.delete(value);
  }
}

export function canonicalizeJson(value) {
  return canonicalValue(value, new Set());
}

export function digestCanonicalJson(value) {
  const canonical = canonicalizeJson(value);
  return {
    canonical,
    digest: createHash("sha256").update(canonical, "utf8").digest("hex"),
  };
}

function rawDocument(rawInput) {
  if (typeof rawInput === "string" || rawInput instanceof Uint8Array) {
    const bytes = typeof rawInput === "string" ? Buffer.from(rawInput, "utf8") : Buffer.from(rawInput);
    if (bytes.length > contractLimits.json.max_bytes) {
      return {
        error: issue("contract.json_bytes", "/", {
          actual: bytes.length,
          limit: contractLimits.json.max_bytes,
        }),
        metrics: { bytes: bytes.length, depth: null, nodes: null, max_collection_size: null, max_string_bytes: null },
      };
    }
    try {
      return { bytes: bytes.length, document: JSON.parse(textDecoder.decode(bytes)) };
    } catch {
      return {
        error: nonJsonError(),
        metrics: { bytes: bytes.length, depth: null, nodes: null, max_collection_size: null, max_string_bytes: null },
      };
    }
  }
  return { bytes: null, document: rawInput };
}

function preflightDocument(document, rawBytes) {
  const maximum = contractLimits.json;
  const metrics = {
    bytes: rawBytes,
    depth: 0,
    nodes: 0,
    max_collection_size: 0,
    max_string_bytes: 0,
  };
  const active = new Set();
  const stack = [{ depth: 1, path: "", value: document }];

  while (stack.length) {
    const entry = stack.pop();
    if (entry.exit) {
      active.delete(entry.value);
      continue;
    }
    const { depth, path, value } = entry;
    metrics.nodes += 1;
    metrics.depth = Math.max(metrics.depth, depth);
    if (metrics.nodes > maximum.max_nodes) {
      return { error: issue("contract.nodes", "/", { actual: metrics.nodes, limit: maximum.max_nodes }), metrics };
    }
    if (depth > maximum.max_depth) {
      return { error: issue("contract.depth", "/", { actual: depth, limit: maximum.max_depth }), metrics };
    }
    if (typeof value === "string") {
      const stringBytes = Buffer.byteLength(value, "utf8");
      metrics.max_string_bytes = Math.max(metrics.max_string_bytes, stringBytes);
      if (stringBytes > maximum.max_string_bytes) {
        return { error: issue("contract.string_bytes", path || "/", { actual: stringBytes, limit: maximum.max_string_bytes }), metrics };
      }
      const key = path.split("/").at(-1);
      if (key === "id" && value.length > maximum.max_id_chars) {
        return { error: issue("contract.id_length", path, { actual: value.length, limit: maximum.max_id_chars }), metrics };
      }
      if (key === "path" && value.length > maximum.max_path_chars) {
        return { error: issue("contract.path_length", path, { actual: value.length, limit: maximum.max_path_chars }), metrics };
      }
      continue;
    }
    if (value === null || typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return { error: nonJsonError({ expected: "finite_number" }), metrics };
      continue;
    }
    if (typeof value !== "object") return { error: nonJsonError(), metrics };
    if (!Array.isArray(value)) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return { error: nonJsonError(), metrics };
      if (Reflect.ownKeys(value).some((key) => typeof key !== "string")) return { error: nonJsonError(), metrics };
    }
    if (active.has(value)) return { error: nonJsonError({ expected: "acyclic_json" }), metrics };
    active.add(value);
    stack.push({ exit: true, value });
    const entries = Array.isArray(value) ? [...value.entries()] : Object.entries(value);
    metrics.max_collection_size = Math.max(metrics.max_collection_size, entries.length);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, child] = entries[index];
      stack.push({ depth: depth + 1, path: childPointer(path, key), value: child });
    }
  }

  try {
    const canonical = canonicalizeJson(document);
    const bytes = Buffer.byteLength(canonical, "utf8");
    metrics.bytes ??= bytes;
    if (metrics.bytes > maximum.max_bytes) {
      return { error: issue("contract.json_bytes", "/", { actual: metrics.bytes, limit: maximum.max_bytes }), metrics };
    }
    return { canonical, metrics };
  } catch {
    return { error: nonJsonError(), metrics };
  }
}

function declaredVersion(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) return { version: 0 };
  if (!Object.hasOwn(document, "schema_version")) return { version: 0 };
  if (typeof document.schema_version !== "number" || !Number.isInteger(document.schema_version)) {
    return { error: issue("contract.type", "/schema_version", { expected: "integer" }) };
  }
  if (document.schema_version < 0 || document.schema_version >= PROJECT_VALIDATORS.length) {
    return {
      error: issue("contract.schema_version", "/schema_version", {
        actual: document.schema_version,
        allowed: [0, 1, 2],
      }),
    };
  }
  return { version: document.schema_version };
}

function mapAjvError(error) {
  let path = error.instancePath || "/";
  if (error.keyword === "required") path = childPointer(error.instancePath, error.params.missingProperty);
  const schemaPath = error.schemaPath || "";
  if (error.keyword === "required") return issue("contract.required", path, { property: error.params.missingProperty });
  if (error.keyword === "type") return issue("contract.type", path, { expected: error.params.type });
  if (error.keyword === "const") {
    const code = path === "/schema_version" ? "contract.schema_version" : "contract.type";
    return issue(code, path, { expected: error.params.allowedValue });
  }
  if (error.keyword === "pattern") {
    const code = schemaPath.includes("/$defs/id/") ? "contract.id_pattern" : "contract.type";
    return issue(code, path, { pattern: error.params.pattern });
  }
  if (error.keyword === "maxLength") {
    const code = schemaPath.includes("/$defs/id/") ? "contract.id_length"
      : schemaPath.includes("/$defs/assetPath/") ? "contract.path_length"
        : "contract.string_bytes";
    return issue(code, path, { limit: error.params.limit });
  }
  return issue("contract.type", path, { keyword: error.keyword });
}

function referenceIssues(document) {
  const errors = [];
  const identities = new Map();
  for (const collection of ID_COLLECTIONS) {
    const entries = Array.isArray(document?.[collection]) ? document[collection] : [];
    const known = new Set();
    identities.set(collection, known);
    for (let index = 0; index < entries.length; index += 1) {
      const id = entries[index]?.id;
      if (typeof id !== "string") continue;
      if (known.has(id)) {
        errors.push(issue("contract.duplicate_id", `/${collection}/${index}/id`, { collection, id }));
      } else {
        known.add(id);
      }
    }
  }
  for (const [collection, fields, target] of REFERENCE_EDGES) {
    const entries = Array.isArray(document?.[collection]) ? document[collection] : [];
    const targets = identities.get(target) || new Set();
    for (let index = 0; index < entries.length; index += 1) {
      for (const field of fields) {
        const id = entries[index]?.[field];
        if (typeof id === "string" && !targets.has(id)) {
          errors.push(issue("contract.dangling_reference", `/${collection}/${index}/${field}`, {
            collection: target,
            id,
          }));
        }
      }
    }
  }
  return errors;
}

function result({ canonical = null, errors = [], limits, schemaVersion = null }) {
  const normalized = boundedIssues(errors);
  return {
    valid: normalized.length === 0,
    errors: normalized,
    schema_version: schemaVersion,
    canonical,
    digest: canonical === null ? null : createHash("sha256").update(canonical, "utf8").digest("hex"),
    limits,
  };
}

export function evaluateProjectContract(rawInput) {
  const raw = rawDocument(rawInput);
  if (raw.error) return result({ errors: [raw.error], limits: raw.metrics });
  const preflight = preflightDocument(raw.document, raw.bytes);
  if (preflight.error) return result({ errors: [preflight.error], limits: preflight.metrics });
  const version = declaredVersion(raw.document);
  if (version.error) {
    return result({ canonical: preflight.canonical, errors: [version.error], limits: preflight.metrics });
  }
  const validator = PROJECT_VALIDATORS[version.version];
  const validSchema = validator(raw.document);
  const errors = validSchema ? referenceIssues(raw.document) : (validator.errors || []).map(mapAjvError);
  return result({
    canonical: preflight.canonical,
    errors,
    limits: preflight.metrics,
    schemaVersion: version.version,
  });
}
