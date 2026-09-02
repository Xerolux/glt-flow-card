/**
 * Cross-project copy and paste, safe by construction (CAD-01, T5-10).
 *
 * The paste this replaces did:
 *
 *     o.id = `${o.id || c.kind}_${Date.now().toString(36)}_${Math.random()...}`
 *
 * Two things are wrong with that line, and the second is why the first was
 * hard to notice. It mints a new id and rewrites nothing that referred to the
 * old one, so a pasted connection still points at the objects it was copied
 * from — two diagrams silently sharing state. And it seeds from the clock and a
 * random number, so the same paste is not reproducible, which makes the bug
 * hard to demonstrate twice and impossible to diff.
 *
 * So a paste here is a pure function of the payload and a seed. The same
 * selection pasted with the same seed produces the same bytes on every machine,
 * which is what lets two people paste the same subsystem and get a merge with
 * nothing in it.
 */

/**
 * How large a clipboard payload may be before it is interpreted.
 *
 * A refusal, not a capacity claim. A clipboard is an input from outside — a
 * person can paste anything a person can copy, from anywhere.
 */
export const CLIPBOARD_MAX_BYTES = 1048576;

/** The clipboard's own format, so a stale payload is refused rather than read. */
export const CLIPBOARD_FORMAT = "glt-flow-card-selection";
export const CLIPBOARD_VERSION = 1;

/**
 * The collections a selection carries, and the fields inside each that point at
 * something else in it.
 *
 * Every one of these is a way a reference can dangle after a paste, and each
 * was a separate bug in the version that rewrote only ids.
 */
const COLLECTIONS = Object.freeze(["layers", "masters", "equipment", "paths", "groups"]);

const REFERENCE_FIELDS = Object.freeze({
  equipment: ["layer", "master"],
  paths: ["from_equipment", "to_equipment", "layer"],
  groups: ["layer", "parent"],
});

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

/**
 * A short, stable hash of a string.
 *
 * FNV-1a, chosen because it is a handful of lines and needs no dependency. It
 * is not a security primitive and nothing here treats it as one: the only
 * property required is that the same seed and id produce the same suffix
 * everywhere, so that two people pasting the same selection agree.
 */
function digest(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

/** Serialize a selection into a bounded, self-describing payload. */
export function serializeSelection(selection) {
  const payload = { format: CLIPBOARD_FORMAT, version: CLIPBOARD_VERSION };
  for (const collection of COLLECTIONS) {
    payload[collection] = Array.isArray(selection?.[collection])
      ? selection[collection].map((item) => ({ ...item }))
      : [];
  }
  const serialized = JSON.stringify(payload);
  if (byteLength(serialized) > CLIPBOARD_MAX_BYTES) {
    throw new RangeError(`a selection over ${CLIPBOARD_MAX_BYTES} bytes cannot be copied`);
  }
  return serialized;
}

function parsePayload(payload) {
  if (typeof payload === "string") {
    // The bound is checked on the bytes, before the parser sees them: a parser
    // that has already started is a parser that can be made to work.
    if (byteLength(payload) > CLIPBOARD_MAX_BYTES) {
      throw new RangeError(`a clipboard payload over ${CLIPBOARD_MAX_BYTES} bytes is refused`);
    }
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      throw new SyntaxError(`the clipboard payload is not JSON: ${error.message}`);
    }
    return parsePayload(parsed);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("the clipboard payload is not a selection");
  }
  if (payload.format !== CLIPBOARD_FORMAT) {
    throw new TypeError(`unknown clipboard format: ${String(payload.format)}`);
  }
  if (payload.version !== CLIPBOARD_VERSION) {
    throw new RangeError(`unsupported clipboard version: ${String(payload.version)}`);
  }
  return payload;
}

function freshIds(payload, seed, taken) {
  const mapping = new Map();
  for (const collection of COLLECTIONS) {
    for (const item of payload[collection] ?? []) {
      if (typeof item?.id !== "string" || mapping.has(item.id)) continue;
      const base = `${item.id}-${digest(`${seed}:${item.id}`)}`;
      let candidate = base;
      let suffix = 2;
      // A collision is resolved by counting, not by re-seeding: re-seeding with
      // anything the environment supplies would put the clock back in.
      while (taken.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }
      taken.add(candidate);
      mapping.set(item.id, candidate);
    }
  }
  return mapping;
}

/**
 * Paste a serialized selection into a project, minting fresh ids and rewriting
 * every reference with the same map.
 *
 * `project` is not mutated: a paste that half-applied would leave a diagram
 * nobody can undo back to what it was.
 */
export function pasteSelection(project, payload, { seed } = {}) {
  if (typeof seed !== "string" || seed.length === 0) {
    // Refusing beats defaulting. A default seed would be one more place for a
    // clock to get in, and the caller is the only one who knows what makes this
    // paste distinct from the last one.
    throw new TypeError("pasting needs a seed, so that the same paste is reproducible");
  }
  const selection = parsePayload(payload);

  const taken = new Set();
  for (const collection of COLLECTIONS) {
    for (const item of project?.[collection] ?? []) {
      if (typeof item?.id === "string") taken.add(item.id);
    }
  }

  const mapping = freshIds(selection, seed, taken);
  const rewrite = (value) => (
    typeof value === "string" && mapping.has(value) ? mapping.get(value) : value
  );

  const result = { ...project };
  for (const collection of COLLECTIONS) {
    const existing = Array.isArray(project?.[collection]) ? project[collection] : [];
    const added = (selection[collection] ?? []).map((item) => {
      const copy = { ...item, id: rewrite(item.id) };
      for (const field of REFERENCE_FIELDS[collection] ?? []) {
        if (field in copy) copy[field] = rewrite(copy[field]);
      }
      // Port ids are scoped to a profile, and the profile is not being copied.
      // Rewriting them would break the endpoint the paste is preserving.
      if (Array.isArray(item.members)) copy.members = item.members.map(rewrite);
      return copy;
    });
    result[collection] = [...existing, ...added];
  }
  return result;
}

/**
 * Every reference in a pasted project that points at nothing.
 *
 * Exported because "paste worked" is not something to eyeball: the check is
 * cheap, and the failure it catches is the one that shipped.
 */
export function danglingReferences(project) {
  const known = new Set();
  for (const collection of COLLECTIONS) {
    for (const item of project?.[collection] ?? []) {
      if (typeof item?.id === "string") known.add(item.id);
    }
  }
  const dangling = [];
  for (const collection of COLLECTIONS) {
    for (const item of project?.[collection] ?? []) {
      for (const field of REFERENCE_FIELDS[collection] ?? []) {
        const value = item?.[field];
        if (typeof value === "string" && !known.has(value)) {
          dangling.push({ collection, id: item.id, field, value });
        }
      }
      for (const member of item?.members ?? []) {
        if (typeof member === "string" && !known.has(member)) {
          dangling.push({ collection, id: item.id, field: "members", value: member });
        }
      }
    }
  }
  return dangling;
}
