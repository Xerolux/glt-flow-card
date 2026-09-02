/**
 * An impossible connection is refused, and the refusal says why (T5-04).
 *
 * Today nothing checks compatibility at all, so every impossible connection is
 * drawn. A boolean would fix half of that: it tells an engineer the tool
 * disagrees with them, but not which of the two is wrong.
 *
 * Note the deliberate asymmetry with Phase 2. A *policy* denial is opaque,
 * because the caller must not learn what exists. An *engineering* refusal is
 * explanatory, because the caller already has the diagram in front of them and
 * hiding the reason protects nothing.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/ports.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase5-ports]: typed ports with explained refusal are unavailable";
const EFFECT_PREFIX = "PHASE5_PORT_EFFECTS ";

/** Every way a connection can be impossible. Each needs its own reason code. */
export const REFUSALS = Object.freeze([
  "medium_mismatch",
  "direction_conflict",
  "kind_mismatch",
  "multiplicity_exceeded",
  "self_connection",
  "duplicate_connection",
]);

const port = (id, extra = {}) => ({
  id, medium: "hydronic", direction: "out", side: "right", kind: "process",
  multiplicity: "many", ...extra,
});

/** Pairs that must be refused, and the reason each must give. */
const IMPOSSIBLE = [
  ["medium_mismatch", port("a"), port("b", { medium: "air", direction: "in" })],
  ["direction_conflict", port("a"), port("b", { direction: "out" })],
  ["kind_mismatch", port("a"), port("b", { direction: "in", kind: "signal" })],
  ["self_connection", port("a"), port("a")],
];

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

test("the refusal reasons are a closed set covering every impossibility", () => {
  assert.equal(new Set(REFUSALS).size, REFUSALS.length);
  for (const [reason] of IMPOSSIBLE) assert.ok(REFUSALS.includes(reason), reason);
});

test("[expected-red:phase5-ports] an impossible connection is refused with a reason", async () => {
  emitEffects({ cases: IMPOSSIBLE.length + 3 });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/ports.mjs does not exist");
  } else {
    const { checkCompatibility, PORT_KINDS, REFUSAL_REASONS, MULTIPLICITY } = model;
    for (const [name, value] of [["PORT_KINDS", PORT_KINDS], ["MULTIPLICITY", MULTIPLICITY],
      ["REFUSAL_REASONS", REFUSAL_REASONS]]) {
      if (!Array.isArray(value) || value.length === 0) gaps.push(`${name} is not an exported closed set`);
    }
    if (Array.isArray(REFUSAL_REASONS)) {
      const missing = REFUSALS.filter((reason) => !REFUSAL_REASONS.includes(reason));
      if (missing.length > 0) gaps.push(`reason codes not declared: ${missing.join(", ")}`);
    }

    if (typeof checkCompatibility !== "function") {
      gaps.push("checkCompatibility is not exported");
    } else {
      for (const [reason, source, target] of IMPOSSIBLE) {
        let result;
        try {
          result = checkCompatibility(source, target, []);
        } catch (error) {
          gaps.push(`checkCompatibility threw for ${reason}: ${error.message}`);
          continue;
        }
        if (result?.compatible !== false) gaps.push(`${reason} was accepted`);
        else if (result.reason !== reason) {
          gaps.push(`${reason} was refused as "${result.reason}"`);
        }
      }

      // A check that refuses everything is not a check.
      const ok = checkCompatibility(port("a"), port("b", { direction: "in" }), []);
      if (ok?.compatible !== true) {
        gaps.push(`a valid pair was refused as "${ok?.reason}"`);
      }

      // Multiplicity is about existing connections, so it needs them.
      const single = port("a", { multiplicity: "one" });
      const taken = checkCompatibility(single, port("b", { direction: "in" }),
        [{ from_port: "a", to_port: "z" }]);
      if (taken?.reason !== "multiplicity_exceeded") {
        gaps.push(`a full one-multiplicity port accepted a second connection ("${taken?.reason}")`);
      }

      const again = checkCompatibility(port("a"), port("b", { direction: "in" }),
        [{ from_port: "a", to_port: "b" }]);
      if (again?.reason !== "duplicate_connection") {
        gaps.push(`an existing connection was not detected as duplicate ("${again?.reason}")`);
      }

      // A bare boolean anywhere means the reason was lost.
      const shapes = [ok, taken, again].filter((entry) => typeof entry !== "object" || entry === null);
      if (shapes.length > 0) gaps.push("checkCompatibility returned a bare value instead of a result");
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  port gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "typed ports with explained refusal are unavailable");
});
