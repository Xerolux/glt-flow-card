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
