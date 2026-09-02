/**
 * Derive a record's identity from what it is.
 *
 * This closes a defect on its **third** occurrence. Phase 5 found
 * `paste_${Date.now()}`, Phase 7 found `report_${Date.now()}`, and Phase 8's
 * audit found `wo_${Date.now()}`. Fixing it a third time in a third place would
 * have guaranteed a fourth.
 *
 * Two independent reasons a clock-derived id is wrong: it is not reproducible,
 * so nothing downstream can say whether two records are the same thing; and it
 * collides, because `Date.now()` has millisecond resolution and a loop creates
 * several records inside one.
 *
 * Mirrored against `custom_components/glt_flow_card/content_id.py` and compared
 * byte for byte, because an id that differs between runtimes is worse than a
 * clock-derived one: it looks stable and is not.
 */

/**
 * How many hex characters of the digest an id carries.
 *
 * 64 bits. At this product's scale the collision probability is negligible, and
 * a shorter id is one a human can read out over a telephone — which is a real
 * thing that happens with a work-order number.
 */
export const ID_LENGTH = 16;

/**
 * The separator between the kind and the payload bytes.
 *
 * Printable on purpose. A control character would be invisible in a diff, a log
 * line and a code review, and this string is part of an identity that must be
 * reproducible across two runtimes for years.
 */
export const KIND_SEPARATOR = ":";

/** Kinds that may be identified. Closed: the prefix is part of the id. */
export const ID_KINDS = Object.freeze([
  "work_order",
  "work_order_entry",
  "attachment",
  "scenario",
  "maintenance_plan",
  "commissioning_run",
  "simulation_session",
]);

/**
 * Render a number the way the Companion's `canonical_number` does.
 *
 * Which is: as a number. `canonical_number` exists to stop Python emitting
 * `0.0` where JavaScript emits `0`, so it coerces an integral float back to an
 * int and returns a *number*. JavaScript has one number type and already emits
 * the shortest round-tripping form, so the mirror of that function here is the
 * identity.
 *
 * Stringifying instead — which this first did — produces `"0"` against `0` and
 * makes every id containing a number differ between runtimes. That is worse
 * than the clock-derived ids this module replaces, because it looks stable and
 * is not, and no test using only string payloads would notice.
 */
function canonicalNumber(value) {
  if (!Number.isFinite(value)) throw new Error(`non_finite_number: ${value}`);
  return value;
}

function canonicalize(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return canonicalNumber(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

/** Return the exact bytes both runtimes hash. */
export function canonicalBytes(payload) {
  return JSON.stringify(canonicalize(payload));
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Return a stable, content-derived id, or refuse an unknown kind.
 *
 * The kind is a prefix rather than only a hash input, so an id says what it
 * identifies when it appears in a log or a URL.
 */
export async function contentId(kind, payload) {
  if (!ID_KINDS.includes(kind)) throw new Error(`unknown_id_kind: ${JSON.stringify(kind)}`);
  const digest = await sha256Hex(`${kind}${KIND_SEPARATOR}${canonicalBytes(payload)}`);
  return `${kind}-${digest.slice(0, ID_LENGTH)}`;
}
