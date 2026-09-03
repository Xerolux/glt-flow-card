/**
 * Editing as values, so that undo is a consequence rather than a feature
 * (CAD-01, T5-09).
 *
 * The designer mutated `config` directly. An undo stack could have been bolted
 * onto that, and nothing would have proved the stack right: it could only ever
 * be checked against the click-paths somebody thought to write down, which is
 * exactly the set of click-paths that does not contain the bug.
 *
 * Modelling an operation as a value with `apply` and `invert` turns undo into a
 * property — `invert(apply(s, c), c) === s` — and a property can be checked
 * over generated sequences covering every kind. That is the whole reason the
 * operations are modelled at all.
 *
 * A command therefore carries both ends of the change it makes, not just the
 * new value. A `move` that recorded only its destination would need the state
 * to work out where the object came from, and by the time undo runs, that state
 * is the one the move already changed.
 */

/** Everything CAD-01 names as an operation. Closed. */
export const COMMAND_KINDS = Object.freeze([
  "move", "resize", "add", "delete", "reorder", "group", "ungroup",
  "layer_visibility", "layer_lock", "align", "distribute",
  "connect", "disconnect", "master_instantiate",
]);

/**
 * How far back undo reaches.
 *
 * A bound, not a capacity claim: history is retained state, and unbounded
 * retained state in a long editing session is a leak with a friendly name.
 */
export const UNDO_DEPTH_LIMIT = 200;

/** How far apart `distribute` and `align` may push things. */
const GRID = 20;

const KINDS = new Set(COMMAND_KINDS);

function fail(message) {
  throw new Error(message);
}

function requireCommand(command) {
  if (!command || typeof command !== "object") fail("a command must be an object");
  if (!KINDS.has(command.kind)) fail(`unknown command kind: ${String(command?.kind)}`);
  if (!command.payload || typeof command.payload !== "object") {
    fail(`the ${command.kind} command carries no payload`);
  }
  return command.payload;
}

function indexOfId(collection, id, what) {
  const index = collection.findIndex((entry) => entry.id === id);
  if (index < 0) fail(`no such ${what}: ${String(id)}`);
  return index;
}

/** Replace one member of a collection, keeping every other identity intact. */
function replaceAt(collection, index, value) {
  return collection.map((entry, position) => (position === index ? value : entry));
}

function insertAt(collection, index, value) {
  return [...collection.slice(0, index), value, ...collection.slice(index)];
}

function removeAt(collection, index) {
  return [...collection.slice(0, index), ...collection.slice(index + 1)];
}

/**
 * Write named fields onto an object without disturbing the order of the ones
 * already there. Key order is not cosmetic here: the inverse property is
 * checked by serializing the state, so a command that reordered keys would
 * "fail to invert" while having restored every value correctly.
 */
function withFields(entry, fields) {
  return { ...entry, ...fields };
}

function moveWithin(collection, from, to) {
  const without = removeAt(collection, from);
  return insertAt(without, to, collection[from]);
}

/**
 * Apply the geometry half of `align` and `distribute`, which differ only in how
 * they choose the destinations.
 */
function applyPlacements(state, placements, field) {
  let equipment = state.equipment;
  for (const placement of placements) {
    const index = indexOfId(equipment, placement.id, "equipment");
    equipment = replaceAt(equipment, index, withFields(equipment[index], placement[field]));
  }
  return { ...state, equipment };
}

const OPERATIONS = {
  move: {
    apply: (state, payload) => applyPlacements(state, [payload], "to"),
    invert: (state, payload) => applyPlacements(state, [payload], "from"),
  },
  resize: {
    apply: (state, payload) => applyPlacements(state, [payload], "to"),
    invert: (state, payload) => applyPlacements(state, [payload], "from"),
  },
  add: {
    apply: (state, payload) => {
      if (state.equipment.some((entry) => entry.id === payload.equipment.id)) {
        fail(`equipment already exists: ${payload.equipment.id}`);
      }
      return { ...state, equipment: insertAt(state.equipment, payload.index, payload.equipment) };
    },
    invert: (state, payload) => {
      const index = indexOfId(state.equipment, payload.equipment.id, "equipment");
      return { ...state, equipment: removeAt(state.equipment, index) };
    },
  },
  delete: {
    apply: (state, payload) => {
      const index = indexOfId(state.equipment, payload.equipment.id, "equipment");
      return { ...state, equipment: removeAt(state.equipment, index) };
    },
    // The index matters. Restoring a deleted object at the end of the list
    // would restore the object and lose the drawing order it had.
    invert: (state, payload) => (
      { ...state, equipment: insertAt(state.equipment, payload.index, payload.equipment) }
    ),
  },
  reorder: {
    apply: (state, payload) => (
      { ...state, equipment: moveWithin(state.equipment, payload.from, payload.to) }
    ),
    invert: (state, payload) => (
      { ...state, equipment: moveWithin(state.equipment, payload.to, payload.from) }
    ),
  },
  group: {
    apply: (state, payload) => {
      if (state.groups.some((entry) => entry.id === payload.group.id)) {
        fail(`group already exists: ${payload.group.id}`);
      }
      return { ...state, groups: insertAt(state.groups, payload.index, payload.group) };
    },
    invert: (state, payload) => {
      const index = indexOfId(state.groups, payload.group.id, "group");
      return { ...state, groups: removeAt(state.groups, index) };
    },
  },
  ungroup: {
    apply: (state, payload) => {
      const index = indexOfId(state.groups, payload.group.id, "group");
      return { ...state, groups: removeAt(state.groups, index) };
    },
    invert: (state, payload) => (
      { ...state, groups: insertAt(state.groups, payload.index, payload.group) }
    ),
  },
  layer_visibility: {
    apply: (state, payload) => setLayerField(state, payload, "visible", payload.to),
    invert: (state, payload) => setLayerField(state, payload, "visible", payload.from),
  },
  layer_lock: {
    apply: (state, payload) => setLayerField(state, payload, "locked", payload.to),
    invert: (state, payload) => setLayerField(state, payload, "locked", payload.from),
  },
  align: {
    apply: (state, payload) => applyPlacements(state, payload.items, "to"),
    invert: (state, payload) => applyPlacements(state, payload.items, "from"),
  },
  distribute: {
    apply: (state, payload) => applyPlacements(state, payload.items, "to"),
    invert: (state, payload) => applyPlacements(state, payload.items, "from"),
  },
  connect: {
    apply: (state, payload) => {
      if (state.paths.some((entry) => entry.id === payload.path.id)) {
        fail(`path already exists: ${payload.path.id}`);
      }
      return { ...state, paths: insertAt(state.paths, payload.index, payload.path) };
    },
    invert: (state, payload) => {
      const index = indexOfId(state.paths, payload.path.id, "path");
      return { ...state, paths: removeAt(state.paths, index) };
    },
  },
  disconnect: {
    apply: (state, payload) => {
      const index = indexOfId(state.paths, payload.path.id, "path");
      return { ...state, paths: removeAt(state.paths, index) };
    },
    invert: (state, payload) => (
      { ...state, paths: insertAt(state.paths, payload.index, payload.path) }
    ),
  },
  master_instantiate: {
    apply: (state, payload) => {
      if (state.equipment.some((entry) => entry.id === payload.equipment.id)) {
        fail(`equipment already exists: ${payload.equipment.id}`);
      }
      return { ...state, equipment: insertAt(state.equipment, payload.index, payload.equipment) };
    },
    invert: (state, payload) => {
      const index = indexOfId(state.equipment, payload.equipment.id, "equipment");
      return { ...state, equipment: removeAt(state.equipment, index) };
    },
  },
};

function setLayerField(state, payload, field, value) {
  const index = indexOfId(state.layers, payload.id, "layer");
  return { ...state, layers: replaceAt(state.layers, index, withFields(state.layers[index], { [field]: value })) };
}

/**
 * Run a command forward.
 *
 * `state` is never touched: a rejected command must leave the diagram exactly
 * as it was, and the cheapest way to guarantee that is to have nothing to undo.
 */
export function applyCommand(state, command) {
  const payload = requireCommand(command);
  return OPERATIONS[command.kind].apply(state, payload);
}

/** Run a command backward. */
export function invertCommand(state, command) {
  const payload = requireCommand(command);
  return OPERATIONS[command.kind].invert(state, payload);
}

// -- Corpus generation ------------------------------------------------------
// A command is sampled *from a state*, because a command carries both ends of
// its change and the "before" end can only come from the state it will be
// applied to. Returning null when a kind is not available in a given state is
// deliberate: it keeps generated sequences legal without inventing objects that
// the state does not contain.

function nextFreeId(collection, prefix) {
  let index = 0;
  const used = new Set(collection.map((entry) => entry.id));
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function unreferenced(state) {
  const referenced = new Set();
  for (const path of state.paths) {
    referenced.add(path.from_equipment);
    referenced.add(path.to_equipment);
  }
  for (const group of state.groups) for (const member of group.members ?? []) referenced.add(member);
  return state.equipment.filter((entry) => !referenced.has(entry.id));
}

/**
 * Build one legal command of `kind` for `state`, or null when the state cannot
 * support one.
 */
export function sampleCommand(kind, state) {
  if (!KINDS.has(kind)) fail(`unknown command kind: ${String(kind)}`);
  const equipment = state.equipment;
  const first = equipment[0];
  switch (kind) {
    case "move":
      if (!first) return null;
      return { kind, payload: { id: first.id,
        from: { x: first.x, y: first.y },
        to: { x: first.x + GRID, y: first.y + GRID } } };
    case "resize":
      if (!first) return null;
      return { kind, payload: { id: first.id,
        from: { width: first.width, height: first.height },
        to: { width: first.width + GRID, height: first.height + GRID } } };
    case "add": {
      const id = nextFreeId(equipment, "gen");
      return { kind, payload: { index: equipment.length, equipment: {
        id, x: GRID * equipment.length, y: 0, width: 80, height: 40,
        layer: state.layers[0]?.id ?? "l1", order: equipment.length } } };
    }
    case "delete": {
      const candidates = unreferenced(state);
      if (candidates.length === 0) return null;
      const victim = candidates[candidates.length - 1];
      return { kind, payload: { index: equipment.indexOf(victim), equipment: victim } };
    }
    case "reorder":
      if (equipment.length < 2) return null;
      return { kind, payload: { from: 0, to: equipment.length - 1 } };
    case "group": {
      if (equipment.length < 2) return null;
      const id = nextFreeId(state.groups, "grp");
      return { kind, payload: { index: state.groups.length,
        group: { id, members: [equipment[0].id, equipment[1].id] } } };
    }
    case "ungroup": {
      if (state.groups.length === 0) return null;
      const index = state.groups.length - 1;
      return { kind, payload: { index, group: state.groups[index] } };
    }
    case "layer_visibility": {
      const layer = state.layers[0];
      if (!layer) return null;
      return { kind, payload: { id: layer.id, from: layer.visible, to: !layer.visible } };
    }
    case "layer_lock": {
      const layer = state.layers[0];
      if (!layer) return null;
      return { kind, payload: { id: layer.id, from: layer.locked, to: !layer.locked } };
    }
    case "align": {
      if (equipment.length < 2) return null;
      const left = Math.min(...equipment.map((entry) => entry.x));
      return { kind, payload: { items: equipment.map((entry) => ({ id: entry.id,
        from: { x: entry.x }, to: { x: left } })) } };
    }
    case "distribute": {
      if (equipment.length < 3) return null;
      const ordered = [...equipment].sort((a, b) => (a.x - b.x) || (a.id < b.id ? -1 : 1));
      const start = ordered[0].x;
      const step = GRID * 5;
      return { kind, payload: { items: ordered.map((entry, position) => ({ id: entry.id,
        from: { x: entry.x }, to: { x: start + step * position } })) } };
    }
    case "connect": {
      if (equipment.length < 2) return null;
      const id = nextFreeId(state.paths, "conn");
      return { kind, payload: { index: state.paths.length, path: { id,
        from_equipment: equipment[0].id, from_port: "p-out",
        to_equipment: equipment[1].id, to_port: "p-in" } } };
    }
    case "disconnect": {
      if (state.paths.length === 0) return null;
      const index = state.paths.length - 1;
      return { kind, payload: { index, path: state.paths[index] } };
    }
    case "master_instantiate": {
      if (!first) return null;
      const id = nextFreeId(equipment, "inst");
      return { kind, payload: { index: equipment.length,
        equipment: { ...first, id, x: first.x + GRID * 3, order: equipment.length },
        master: first.id } };
    }
    default:
      return null;
  }
}

/**
 * A bounded undo history.
 *
 * The bound exists so that history cannot become the largest thing in an
 * editing session. Dropping the oldest entry is the only honest way to enforce
 * it: refusing the newest would make the editor stop accepting edits, which is
 * a worse answer to "you have edited a lot" than forgetting the beginning.
 */
export function createHistory(limit = UNDO_DEPTH_LIMIT) {
  if (!Number.isInteger(limit) || limit < 1) fail("an undo history needs a positive bound");
  const done = [];
  const undone = [];
  return {
    get depth() { return done.length; },
    get redoDepth() { return undone.length; },
    limit,
    push(state, command) {
      const next = applyCommand(state, command);
      done.push(command);
      if (done.length > limit) done.shift();
      undone.length = 0;
      return next;
    },
    undo(state) {
      const command = done.pop();
      if (!command) return state;
      undone.push(command);
      return invertCommand(state, command);
    },
    redo(state) {
      const command = undone.pop();
      if (!command) return state;
      done.push(command);
      return applyCommand(state, command);
    },
  };
}
