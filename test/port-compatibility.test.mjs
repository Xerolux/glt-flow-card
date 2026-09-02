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

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel proves the refusal exists. These prove it is neither vacuous
// nor over-eager, and that a malformed port is treated as a bug in the code
// rather than as a mistake in somebody's diagram.

const { checkCompatibility, REFUSAL_REASONS, endpointKey } =
  await import(MODULE_URL.href);

test("every declared reason is reachable, so none is decoration", () => {
  const reached = new Set();
  const cases = [
    [port("a"), port("a")],
    [port("a"), port("b", { direction: "in", kind: "power" })],
    [port("a"), port("b", { direction: "in", medium: "air" })],
    [port("a"), port("b", { direction: "out" })],
  ];
  for (const [source, target] of cases) {
    reached.add(checkCompatibility(source, target, []).reason);
  }
  reached.add(checkCompatibility(port("a"), port("b", { direction: "in" }),
    [{ from_port: "a", to_port: "b" }]).reason);
  reached.add(checkCompatibility(port("a", { multiplicity: "one" }),
    port("b", { direction: "in" }), [{ from_port: "a", to_port: "z" }]).reason);
  assert.deepEqual([...reached].sort(), [...REFUSAL_REASONS].sort());
});

test("the CAD corpus's refused pair is refused for the medium and nothing else", () => {
  // eq-chiller/p-out to eq-radiator/p-in: both process, pointing the right
  // way, geometrically trivial. A refusal naming anything but the medium has
  // found a different bug than the one it thinks it has found.
  const chiller = { id: "p-out", equipment: "eq-chiller", medium: "cooling_flow",
    direction: "out", side: "right", kind: "process", multiplicity: "one" };
  const radiator = { id: "p-in", equipment: "eq-radiator", medium: "heating_flow",
    direction: "in", side: "left", kind: "process", multiplicity: "one" };
  const result = checkCompatibility(chiller, radiator, []);
  assert.equal(result.compatible, false);
  assert.equal(result.reason, "medium_mismatch");
  assert.deepEqual(result.detail, { source: "cooling_flow", target: "heating_flow" });
});

test("an endpoint is the pair, so a shared profile does not collide", () => {
  // Two pumps share profile-source, so both carry a port called `p-out`.
  const first = { ...port("p-out"), equipment: "eq-source-a" };
  const second = { ...port("p-out"), equipment: "eq-source-b", direction: "in" };
  assert.notEqual(endpointKey(first), endpointKey(second));
  assert.equal(checkCompatibility(first, second, []).compatible, true);
  // Without the equipment they are the same endpoint, and joining a port to
  // itself is the refusal that says so.
  assert.equal(
    checkCompatibility(port("p-out"), port("p-out", { direction: "in" }), []).reason,
    "self_connection",
  );
});

test("a bidirectional port may give or receive, but not against the arrow", () => {
  const both = (extra) => port("x", { direction: "bidirectional", ...extra });
  assert.equal(checkCompatibility(both({ id: "a" }), port("b", { direction: "in" }), []).compatible, true);
  assert.equal(checkCompatibility(port("a"), both({ id: "b" }), []).compatible, true);
  assert.equal(checkCompatibility(both({ id: "a" }), both({ id: "b" }), []).compatible, true);
  assert.equal(
    checkCompatibility(port("a", { direction: "in" }), both({ id: "b" }), []).reason,
    "direction_conflict",
  );
});

test("a many port takes more connections; a one port takes exactly one", () => {
  const existing = [{ from_port: "a", to_port: "z" }, { from_port: "a", to_port: "y" }];
  assert.equal(checkCompatibility(port("a"), port("b", { direction: "in" }), existing).compatible, true);
  assert.equal(
    checkCompatibility(port("a"), port("b", { direction: "in", multiplicity: "one" }),
      [{ from_port: "q", to_port: "b" }]).detail.role,
    "target",
  );
});

test("a malformed port throws rather than being refused", () => {
  // A refusal is a statement about a diagram. An unknown kind is a statement
  // about the code, and dressing it as a refusal would send an engineer to
  // look for a mistake they did not make.
  for (const [broken, expected] of [
    [port("a", { kind: "plumbing" }), /unknown port kind/],
    [port("a", { multiplicity: "several" }), /unknown multiplicity/],
    [port("a", { direction: "sideways" }), /unknown direction/],
    [port("a", { side: "diagonal" }), /unknown side/],
    [{ medium: "hydronic", kind: "process", multiplicity: "one", direction: "out" }, /no id/],
  ]) {
    assert.throws(() => checkCompatibility(broken, port("b", { direction: "in" }), []), expected);
  }
});

test("a result is frozen, so a caller cannot rewrite a refusal into an approval", () => {
  const refusal = checkCompatibility(port("a"), port("b", { direction: "out" }), []);
  assert.throws(() => { refusal.compatible = true; }, TypeError);
  assert.equal(Object.isFrozen(refusal.detail), true);
});
