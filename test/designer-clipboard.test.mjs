/**
 * Cross-project paste remaps ids and rewrites every reference (T5-10).
 *
 * This is not hypothetical. The existing paste does:
 *
 *   o.id = `${o.id || c.kind}_${Date.now().toString(36)}_${Math.random()...}`
 *
 * It mints a new id and rewrites nothing, so a pasted connection still points
 * at the objects it was copied from -- two diagrams silently sharing state. And
 * it seeds from the clock and a random number, so the same paste is not
 * reproducible, which makes the bug hard to even demonstrate twice.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/designer-clipboard.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase5-clipboard]: id-remapping cross-project paste is unavailable";
const EFFECT_PREFIX = "PHASE5_CLIPBOARD_EFFECTS ";

/** Every reference that must follow the remap, not just the object ids. */
export const REFERENCES = Object.freeze([
  "connection endpoints", "group membership", "master references", "layer assignment",
]);

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

function selection() {
  return {
    equipment: [
      { id: "pump-1", x: 0, y: 0, width: 100, height: 60, layer: "l1", master: "m1" },
      { id: "pump-2", x: 200, y: 0, width: 100, height: 60, layer: "l1" },
    ],
    paths: [{ id: "run-1", from_equipment: "pump-1", to_equipment: "pump-2",
      from_port: "out", to_port: "in" }],
    groups: [{ id: "g1", members: ["pump-1", "pump-2"] }],
    layers: [{ id: "l1", visible: true, locked: false }],
    masters: [{ id: "m1", name: "Standard pump" }],
  };
}

test("every reference kind that can dangle is named", () => {
  assert.equal(new Set(REFERENCES).size, REFERENCES.length);
  assert.ok(REFERENCES.includes("connection endpoints"));
});

test("[expected-red:phase5-clipboard] paste remaps ids and every reference", async () => {
  emitEffects({ references: REFERENCES.length });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/designer-clipboard.mjs does not exist");
  } else {
    const { serializeSelection, pasteSelection, CLIPBOARD_MAX_BYTES } = model;

    if (typeof serializeSelection !== "function" || typeof pasteSelection !== "function") {
      gaps.push("serializeSelection and pasteSelection are not both exported");
    } else {
      const payload = serializeSelection(selection());
      const pasted = pasteSelection({ equipment: [], paths: [], groups: [], layers: [], masters: [] },
        payload, { seed: "paste-1" });

      const ids = (pasted?.equipment ?? []).map((item) => item.id);
      if (ids.includes("pump-1") || ids.includes("pump-2")) {
        gaps.push("a pasted object kept its source id");
      }

      const path = (pasted?.paths ?? [])[0];
      if (!path) {
        gaps.push("paste dropped the connection");
      } else if (!ids.includes(path.from_equipment) || !ids.includes(path.to_equipment)) {
        gaps.push("a pasted connection still points at the source equipment");
      }

      const group = (pasted?.groups ?? [])[0];
      if (!group) {
        gaps.push("paste dropped the group");
      } else if (!group.members.every((member) => ids.includes(member))) {
        gaps.push("group membership was not rewritten with the new ids");
      }

      const layers = new Set((pasted?.layers ?? []).map((entry) => entry.id));
      if (!(pasted?.equipment ?? []).every((item) => layers.has(item.layer))) {
        gaps.push("layer assignment was not rewritten with the new ids");
      }

      const masters = new Set((pasted?.masters ?? []).map((entry) => entry.id));
      const withMaster = (pasted?.equipment ?? []).find((item) => item.master);
      if (withMaster && !masters.has(withMaster.master)) {
        gaps.push("a master reference was not rewritten with the new ids");
      }

      // Deterministic: the same payload and seed must paste identically.
      const again = pasteSelection({ equipment: [], paths: [], groups: [], layers: [], masters: [] },
        payload, { seed: "paste-1" });
      if (JSON.stringify(again) !== JSON.stringify(pasted)) {
        gaps.push("paste is not reproducible, so it is seeded from the clock or randomness");
      }

      // Pasting into the source project must copy, not alias.
      const intoSource = pasteSelection(selection(), payload, { seed: "paste-2" });
      const sourceIds = (intoSource?.equipment ?? []).map((item) => item.id);
      if (new Set(sourceIds).size !== sourceIds.length) {
        gaps.push("pasting into the source project produced colliding ids");
      }

      if (typeof CLIPBOARD_MAX_BYTES !== "number") {
        gaps.push("no clipboard payload bound is declared");
      } else {
        let refused = false;
        try {
          pasteSelection({ equipment: [] }, "x".repeat(CLIPBOARD_MAX_BYTES + 1), { seed: "s" });
        } catch {
          refused = true;
        }
        if (!refused) gaps.push("an oversized clipboard payload was interpreted");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  clipboard gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "id-remapping cross-project paste is unavailable");
});

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel checks each reference kind once. These check that nothing
// dangles at all, that pasting into the source really copies rather than
// aliases, and that the payload's own shape is validated before it is read.

const clipboard = await import(MODULE_URL.href);

const empty = () => ({ equipment: [], paths: [], groups: [], layers: [], masters: [] });

test("nothing dangles after a paste, by enumeration rather than by sampling", () => {
  const payload = clipboard.serializeSelection(selection());
  const pasted = clipboard.pasteSelection(empty(), payload, { seed: "paste-1" });
  assert.deepEqual(clipboard.danglingReferences(pasted), []);
  assert.deepEqual(REFERENCES.length, 4);
});

test("pasting into the source copies it, and the copy is independent", () => {
  const source = selection();
  const payload = clipboard.serializeSelection(source);
  const merged = clipboard.pasteSelection(source, payload, { seed: "paste-2" });

  assert.equal(merged.equipment.length, source.equipment.length * 2);
  const ids = merged.equipment.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "the paste aliased instead of copying");
  assert.deepEqual(clipboard.danglingReferences(merged), []);

  // The copied connection joins the copies, not the originals.
  const copied = merged.paths.find((path) => path.id !== "run-1");
  assert.ok(!["pump-1", "pump-2"].includes(copied.from_equipment));
  assert.ok(!["pump-1", "pump-2"].includes(copied.to_equipment));
  // And the original is untouched.
  assert.deepEqual(source.equipment.map((item) => item.id), ["pump-1", "pump-2"]);
});

test("port ids survive the paste, because the profile did not come with it", () => {
  const payload = clipboard.serializeSelection(selection());
  const pasted = clipboard.pasteSelection(empty(), payload, { seed: "paste-1" });
  assert.equal(pasted.paths[0].from_port, "out");
  assert.equal(pasted.paths[0].to_port, "in");
});

test("two seeds give two copies; one seed gives the same copy everywhere", () => {
  const payload = clipboard.serializeSelection(selection());
  const first = clipboard.pasteSelection(empty(), payload, { seed: "a" });
  const second = clipboard.pasteSelection(empty(), payload, { seed: "b" });
  assert.notDeepEqual(first.equipment.map((i) => i.id), second.equipment.map((i) => i.id));
  assert.deepEqual(
    clipboard.pasteSelection(empty(), payload, { seed: "a" }),
    first,
    "the same seed produced a different paste",
  );
});

test("a paste with no seed is refused rather than defaulted", () => {
  // A default seed would be one more place for a clock to get in, and the
  // caller is the only one who knows what makes this paste distinct.
  const payload = clipboard.serializeSelection(selection());
  assert.throws(() => clipboard.pasteSelection(empty(), payload), /needs a seed/);
  assert.throws(() => clipboard.pasteSelection(empty(), payload, { seed: "" }), /needs a seed/);
});

test("a payload that is not this clipboard's is refused before it is read", () => {
  for (const [payload, expected] of [
    ["not json at all", /not JSON/],
    [JSON.stringify({ format: "something-else", version: 1 }), /unknown clipboard format/],
    [JSON.stringify({ format: clipboard.CLIPBOARD_FORMAT, version: 99 }), /unsupported clipboard version/],
    [JSON.stringify([1, 2, 3]), /not a selection/],
  ]) {
    assert.throws(() => clipboard.pasteSelection(empty(), payload, { seed: "s" }), expected);
  }
});

test("the bound is checked on the bytes, before the parser sees them", () => {
  const oversized = "x".repeat(clipboard.CLIPBOARD_MAX_BYTES + 1);
  assert.throws(() => clipboard.pasteSelection(empty(), oversized, { seed: "s" }), RangeError);
  // Copying is bounded at the same place, so a selection that cannot be pasted
  // cannot be produced either.
  const count = Math.ceil(clipboard.CLIPBOARD_MAX_BYTES / 16) + 1000;
  const huge = { equipment: Array.from({ length: count }, (_, index) => ({ id: `e${index}` })) };
  assert.throws(() => clipboard.serializeSelection(huge), /cannot be copied/);
});

test("danglingReferences finds what a broken paste would leave behind", () => {
  // The check has to be able to fail, or its passing means nothing.
  const broken = clipboard.pasteSelection(empty(), clipboard.serializeSelection(selection()),
    { seed: "s" });
  broken.paths[0].from_equipment = "pump-1";
  broken.groups[0].members[0] = "pump-1";
  assert.deepEqual(clipboard.danglingReferences(broken).map((entry) => entry.field).sort(),
    ["from_equipment", "members"]);
});
