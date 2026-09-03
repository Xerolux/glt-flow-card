/**
 * Every editor operation has a proven inverse (T5-09).
 *
 * The designer mutates `config` directly today. An undo stack could be bolted
 * onto that, but nothing would prove the stack is right -- it could only be
 * checked against the click-paths somebody thought to write down.
 *
 * Modelling operations as values with `apply` and `invert` turns undo into a
 * property: `invert(apply(s, c), c) === s`, checkable over generated sequences
 * covering every command kind. That is why the operations are modelled at all.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/designer-commands.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase5-designer]: transactional designer commands are unavailable";
const EFFECT_PREFIX = "PHASE5_DESIGNER_EFFECTS ";

/** Everything CAD-01 names as an operation. Each needs an inverse. */
export const COMMANDS = Object.freeze([
  "move", "resize", "add", "delete", "reorder", "group", "ungroup",
  "layer_visibility", "layer_lock", "align", "distribute",
  "connect", "disconnect", "master_instantiate",
]);

const UNDO_DEPTH = 100;

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

/** A tiny deterministic generator: the corpus must be the same every run. */
function sequences(kinds, length, count) {
  const out = [];
  let seed = 1;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (let index = 0; index < count; index += 1) {
    out.push(Array.from({ length }, () => kinds[next() % kinds.length]));
  }
  return out;
}

function baseState() {
  return {
    equipment: [
      { id: "a", x: 0, y: 0, width: 100, height: 60, layer: "l1", order: 0 },
      { id: "b", x: 200, y: 0, width: 100, height: 60, layer: "l1", order: 1 },
    ],
    paths: [], layers: [{ id: "l1", visible: true, locked: false }], groups: [],
  };
}

test("the command list covers what CAD-01 names, with no duplicates", () => {
  assert.equal(new Set(COMMANDS).size, COMMANDS.length);
  for (const kind of ["move", "group", "layer_lock", "connect", "master_instantiate"]) {
    assert.ok(COMMANDS.includes(kind), kind);
  }
});

test("[expected-red:phase5-designer] every command inverts exactly", async () => {
  emitEffects({ commands: COMMANDS.length });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/designer-commands.mjs does not exist");
  } else {
    const { COMMAND_KINDS, applyCommand, invertCommand, sampleCommand } = model;

    if (!Array.isArray(COMMAND_KINDS)) {
      gaps.push("COMMAND_KINDS is not an exported closed set");
    } else {
      const missing = COMMANDS.filter((kind) => !COMMAND_KINDS.includes(kind));
      if (missing.length > 0) gaps.push(`command kinds not implemented: ${missing.join(", ")}`);
    }

    if (typeof applyCommand !== "function" || typeof invertCommand !== "function") {
      gaps.push("applyCommand and invertCommand are not both exported");
    } else if (typeof sampleCommand !== "function") {
      gaps.push("sampleCommand is not exported, so no corpus can be generated");
    } else {
      for (const sequence of sequences(COMMANDS, 6, 12)) {
        let state = baseState();
        const trail = [];
        let failed = false;
        for (const kind of sequence) {
          const command = sampleCommand(kind, state);
          if (!command) continue;
          const before = JSON.stringify(state);
          let next;
          try {
            next = applyCommand(state, command);
          } catch (error) {
            gaps.push(`${kind} threw: ${error.message}`);
            failed = true;
            break;
          }
          trail.push({ command, before });
          state = next;
        }
        if (failed) break;
        // Unwind, checking each step restores exactly what it changed.
        for (const { command, before } of trail.reverse()) {
          state = invertCommand(state, command);
          if (JSON.stringify(state) !== before) {
            gaps.push(`${command.kind} did not invert to the state before it`);
            break;
          }
        }
      }

      // A rejected command must leave the state byte-identical.
      const state = baseState();
      const snapshot = JSON.stringify(state);
      try {
        applyCommand(state, { kind: "move", payload: { id: "does-not-exist", dx: 1, dy: 1 } });
      } catch { /* refusing is fine; mutating is not */ }
      if (JSON.stringify(state) !== snapshot) {
        gaps.push("a rejected command mutated the state it was given");
      }

      let rejected = false;
      try {
        applyCommand(baseState(), { kind: "not_a_command", payload: {} });
      } catch {
        rejected = true;
      }
      if (!rejected) gaps.push("an unknown command kind was accepted");

      if (model.UNDO_DEPTH_LIMIT === undefined) {
        gaps.push("no undo depth bound is declared");
      } else if (model.UNDO_DEPTH_LIMIT > UNDO_DEPTH * 10) {
        gaps.push(`the undo depth bound is ${model.UNDO_DEPTH_LIMIT}, which is not a bound`);
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  designer gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "transactional designer commands are unavailable");
});

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel runs generated sequences, and a generated sequence proves
// nothing about a kind it happened not to reach. These pin every kind
// individually, and make the undo bound a thing that runs rather than a number
// that is exported.

const designer = await import(MODULE_URL.href);

/** Rich enough that no kind has to be skipped for want of material. */
function richState() {
  return {
    equipment: [
      { id: "a", x: 0, y: 0, width: 100, height: 60, layer: "l1", order: 0 },
      { id: "b", x: 200, y: 0, width: 100, height: 60, layer: "l1", order: 1 },
      { id: "c", x: 500, y: 0, width: 100, height: 60, layer: "l2", order: 2 },
    ],
    paths: [{ id: "p1", from_equipment: "a", from_port: "p-out",
      to_equipment: "b", to_port: "p-in" }],
    layers: [{ id: "l1", visible: true, locked: false },
      { id: "l2", visible: false, locked: true }],
    groups: [{ id: "g1", members: ["a", "b"] }],
  };
}

test("every command kind is exercised, and every one inverts exactly", () => {
  const unreachable = [];
  for (const kind of designer.COMMAND_KINDS) {
    const state = richState();
    const before = JSON.stringify(state);
    const command = designer.sampleCommand(kind, state);
    if (!command) {
      unreachable.push(kind);
      continue;
    }
    const after = designer.applyCommand(state, command);
    assert.notEqual(JSON.stringify(after), before, `${kind} changed nothing`);
    assert.equal(JSON.stringify(state), before, `${kind} mutated the state it was given`);
    assert.equal(JSON.stringify(designer.invertCommand(after, command)), before,
      `${kind} did not invert`);
  }
  assert.deepEqual(unreachable, [], "a command kind could not be sampled from a full state");
});

test("a command carries both ends, so undo does not have to reconstruct one", () => {
  // The point of the shape: after the move, nothing in the state remembers
  // where the object was, and the command still does.
  const state = richState();
  const command = designer.sampleCommand("move", state);
  assert.deepEqual(command.payload.from, { x: 0, y: 0 });
  const moved = designer.applyCommand(state, command);
  assert.deepEqual(designer.invertCommand(moved, command).equipment[0],
    { id: "a", x: 0, y: 0, width: 100, height: 60, layer: "l1", order: 0 });
});

test("a delete restores at its old index, not at the end", () => {
  const state = richState();
  // `c` is the only equipment no path or group refers to.
  const command = designer.sampleCommand("delete", state);
  assert.equal(command.payload.equipment.id, "c");
  const reordered = { ...state, equipment: [state.equipment[2], state.equipment[0], state.equipment[1]] };
  const removed = designer.applyCommand(reordered, { ...command, payload: { ...command.payload, index: 0 } });
  assert.deepEqual(removed.equipment.map((entry) => entry.id), ["a", "b"]);
  const restored = designer.invertCommand(removed, { ...command, payload: { ...command.payload, index: 0 } });
  assert.deepEqual(restored.equipment.map((entry) => entry.id), ["c", "a", "b"]);
});

test("a rejected command changes nothing, and says which object it could not find", () => {
  const state = richState();
  const snapshot = JSON.stringify(state);
  assert.throws(
    () => designer.applyCommand(state, { kind: "move", payload: { id: "nope", from: {}, to: {} } }),
    /no such equipment: nope/,
  );
  assert.throws(
    () => designer.applyCommand(state, { kind: "disconnect", payload: { index: 0, path: { id: "nope" } } }),
    /no such path: nope/,
  );
  assert.equal(JSON.stringify(state), snapshot);
});

test("an unknown kind is an error at every entry point, never a no-op", () => {
  for (const call of [
    () => designer.applyCommand(richState(), { kind: "explode", payload: {} }),
    () => designer.invertCommand(richState(), { kind: "explode", payload: {} }),
    () => designer.sampleCommand("explode", richState()),
  ]) {
    assert.throws(call, /unknown command kind: explode/);
  }
  assert.throws(
    () => designer.applyCommand(richState(), { kind: "move" }),
    /the move command carries no payload/,
  );
});

test("the undo bound is enforced by the history, not only exported", () => {
  const history = designer.createHistory(3);
  let state = richState();
  for (let index = 0; index < 10; index += 1) {
    state = history.push(state, designer.sampleCommand("add", state));
  }
  assert.equal(history.depth, 3, "history grew past its bound");
  assert.equal(state.equipment.length, 13);

  // Forgetting the beginning, not refusing the newest: an editor that stops
  // accepting edits is a worse answer to "you have edited a lot".
  for (let index = 0; index < 3; index += 1) state = history.undo(state);
  assert.equal(state.equipment.length, 10);
  assert.equal(history.undo(state), state, "undo past the bound invented a step");

  assert.throws(() => designer.createHistory(0), /positive bound/);
  assert.ok(designer.UNDO_DEPTH_LIMIT >= 1);
});

test("redo replays exactly what undo took back, until a new edit lands", () => {
  const history = designer.createHistory();
  let state = richState();
  const before = JSON.stringify(state);
  state = history.push(state, designer.sampleCommand("move", state));
  const moved = JSON.stringify(state);
  state = history.undo(state);
  assert.equal(JSON.stringify(state), before);
  state = history.redo(state);
  assert.equal(JSON.stringify(state), moved);

  state = history.undo(state);
  state = history.push(state, designer.sampleCommand("resize", state));
  assert.equal(history.redoDepth, 0, "a new edit left a redo branch behind");
});
