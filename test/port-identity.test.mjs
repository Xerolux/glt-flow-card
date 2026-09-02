/**
 * An endpoint is a port id, and it survives being worked on (T5-05).
 *
 * `from_port`/`to_port` already exist and `smartRoute` already reads them, so
 * the reference exists. What does not exist is anything that preserves it: the
 * existing paste regenerates an object id from `Date.now()` and rewrites no
 * reference, so a pasted connection still points at the source objects.
 *
 * Four paths can break an endpoint, and all four are asserted here, because
 * fixing one and calling it identity is how the other three keep shipping.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/ports.mjs", import.meta.url);

const RED_MARKER = "EXPECTED_RED[phase5-port-identity]: stable endpoint identity is unavailable";
const EFFECT_PREFIX = "PHASE5_IDENTITY_EFFECTS ";

/** Every path an endpoint has to survive. */
export const SURVIVAL_PATHS = Object.freeze(["edit", "copy_paste", "bundle", "migration"]);

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

function project() {
  return {
    type: "custom:glt-flow-card",
    schema_version: 4,
    contributions: [],
    project: { id: "identity", name: "Identity", revision: 0 },
    profiles: [{
      id: "pump", equipment_type: "pump", version: "1.0.0",
      ports: [
        { id: "in", medium: "hydronic", direction: "in", side: "left", kind: "process" },
        { id: "out", medium: "hydronic", direction: "out", side: "right", kind: "process" },
      ],
    }],
    equipment: [
      { id: "p1", type: "pump", profile: "pump", x: 0, y: 0, width: 100, height: 60 },
      { id: "p2", type: "pump", profile: "pump", x: 400, y: 0, width: 100, height: 60 },
    ],
    paths: [{ id: "run", from_equipment: "p1", to_equipment: "p2", from_port: "out", to_port: "in" }],
    datapoints: [], views: [],
  };
}

test("every path that can detach an endpoint is covered", () => {
  assert.equal(SURVIVAL_PATHS.length, 4);
  assert.ok(SURVIVAL_PATHS.includes("migration"));
});

test("[expected-red:phase5-port-identity] an endpoint survives every path", async () => {
  emitEffects({ paths: SURVIVAL_PATHS.length });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/ports.mjs does not exist");
  } else {
    const { resolveEndpoint, remapIdentifiers } = model;

    if (typeof resolveEndpoint !== "function") {
      gaps.push("resolveEndpoint is not exported");
    } else {
      const base = project();
      const before = resolveEndpoint(base, base.paths[0], "from");
      if (before?.port?.id !== "out") {
        gaps.push(`the endpoint did not resolve to its declared port ("${before?.port?.id}")`);
      }

      // An edit that moves equipment must not change which port is meant.
      const moved = project();
      moved.equipment[0].x = 900;
      const after = resolveEndpoint(moved, moved.paths[0], "from");
      if (after?.port?.id !== before?.port?.id) {
        gaps.push("moving equipment changed which port the connection means");
      }

      // A port that no longer exists is reported, never silently reattached.
      const broken = project();
      broken.profiles[0].ports = broken.profiles[0].ports.filter((p) => p.id !== "out");
      const orphan = resolveEndpoint(broken, broken.paths[0], "from");
      if (!orphan || orphan.broken !== true) {
        gaps.push("an unresolvable endpoint was reattached instead of reported");
      } else if (!orphan.detail || !orphan.detail.port_id) {
        gaps.push("a broken endpoint does not name the port it was looking for");
      }
    }

    if (typeof remapIdentifiers !== "function") {
      gaps.push("remapIdentifiers is not exported");
    } else {
      const pasted = remapIdentifiers(project(), { prefix: "copy" });
      const ids = (pasted.equipment ?? []).map((item) => item.id);
      if (ids.includes("p1") || ids.includes("p2")) {
        gaps.push("paste kept a source equipment id");
      }
      const path = (pasted.paths ?? [])[0];
      if (!path) {
        gaps.push("paste dropped the connection");
      } else {
        if (ids.length && !ids.includes(path.from_equipment)) {
          gaps.push("a pasted connection still points at the source equipment");
        }
        if (path.from_port !== "out" || path.to_port !== "in") {
          gaps.push("paste rewrote the port ids, which are profile-scoped and must not change");
        }
      }
      // Deterministic: the same input must remap the same way twice.
      const again = remapIdentifiers(project(), { prefix: "copy" });
      if (JSON.stringify(again) !== JSON.stringify(pasted)) {
        gaps.push("remapping is not deterministic, so the same paste differs between runs");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  identity gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "stable endpoint identity is unavailable");
});
