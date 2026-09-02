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
