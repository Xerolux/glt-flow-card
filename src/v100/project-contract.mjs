/* Raw-first, runtime-neutral project validation and canonical evidence. */
import * as generated from "./generated/project-validators.mjs";

const { contractLimits } = generated;

// Derived from the generated module rather than listed by hand. The Python side
// already derives its schema list; this was the last place where adding a
// project schema version meant remembering to edit an array, and forgetting
// would have shown up as "migration target N contract is invalid" -- an error
// that points at the migration rather than at the list that was not updated.
const PROJECT_VALIDATORS = Object.keys(generated)
  .filter((name) => /^project\d+$/.test(name))
  .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
  .map((name) => generated[name]);
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
const textEncoder = new TextEncoder();
const SHA256_ROUND_CONSTANTS = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Hex(text) {
  const source = textEncoder.encode(text);
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  const view = new DataView(bytes.buffer);
  const bitLength = source.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const hash = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + (index * 4), false);
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return [...hash].map((value) => value.toString(16).padStart(8, "0")).join("");
}

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

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareIssues(left, right) {
  return compareText(left.path, right.path)
    || compareText(left.code, right.code)
    || compareText(JSON.stringify(left.params), JSON.stringify(right.params));
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

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
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
    digest: sha256Hex(canonical),
  };
}

function rawDocument(rawInput) {
  if (typeof rawInput === "string" || rawInput instanceof Uint8Array) {
    const bytes = typeof rawInput === "string" ? textEncoder.encode(rawInput) : rawInput;
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
      if (hasLoneSurrogate(value)) {
        return { error: issue("contract.type", path || "/", { expected: "unicode_scalar_sequence" }), metrics };
      }
      const stringBytes = textEncoder.encode(value).byteLength;
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
      if (Object.keys(value).some(hasLoneSurrogate)) {
        return { error: nonJsonError({ expected: "unicode_scalar_sequence" }), metrics };
      }
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
    const bytes = textEncoder.encode(canonical).byteLength;
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
    digest: canonical === null ? null : sha256Hex(canonical),
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
