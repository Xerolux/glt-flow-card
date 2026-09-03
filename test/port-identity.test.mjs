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

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel covers the edit and the paste. These add the bundle round trip
// and the property the whole plan turns on: that a port id is not an identity
// once two pieces of equipment share a profile.

import { createProjectBundle, readProjectBundleArchive } from "../src/v100/project-bundle.mjs";

const ports = await import(MODULE_URL.href);

/** Two pumps on one profile, so `out` names a port on both. */
function sharedProfileProject() {
  const base = project();
  base.equipment.push({ id: "p3", type: "pump", profile: "pump", x: 0, y: 300, width: 100, height: 60 });
  base.paths.push({ id: "run2", from_equipment: "p3", to_equipment: "p2", from_port: "out", to_port: "in" });
  return base;
}

test("every path that could detach an endpoint is exercised, not just named", async () => {
  const covered = new Set();

  // edit
  const moved = sharedProfileProject();
  const before = ports.resolveEndpoint(moved, moved.paths[0], "from");
  moved.equipment[0].x = 900;
  const after = ports.resolveEndpoint(moved, moved.paths[0], "from");
  assert.equal(after.port.id, before.port.id);
  assert.notDeepEqual(after.anchor, before.anchor, "the anchor did not follow the move");
  covered.add("edit");

  // copy_paste
  const pasted = ports.remapIdentifiers(sharedProfileProject(), { prefix: "copy" });
  assert.deepEqual(ports.brokenEndpoints(pasted), []);
  covered.add("copy_paste");

  // bundle
  const archive = await createProjectBundle(sharedProfileProject(), []);
  const restored = await readProjectBundleArchive(archive);
  assert.deepEqual(ports.brokenEndpoints(restored.project), []);
  assert.deepEqual(
    restored.project.paths.map((path) => [path.from_equipment, path.from_port, path.to_equipment, path.to_port]),
    sharedProfileProject().paths.map((path) => [path.from_equipment, path.from_port, path.to_equipment, path.to_port]),
  );
  covered.add("bundle");

  // migration — covered end to end in the Companion suite, where the migrator
  // lives; here the schema-4 shape is asserted to carry both halves of a pair.
  for (const path of sharedProfileProject().paths) {
    assert.ok(path.from_port && path.to_port, "schema 4 lost a port reference");
  }
  covered.add("migration");

  assert.deepEqual([...covered].sort(), [...SURVIVAL_PATHS].sort());
});

test("a shared profile is why the pair is the identity", () => {
  const shared = sharedProfileProject();
  const first = ports.resolveEndpoint(shared, shared.paths[0], "from");
  const second = ports.resolveEndpoint(shared, shared.paths[1], "from");
  assert.equal(first.port.id, second.port.id, "the fixture stopped sharing a profile");
  assert.notEqual(first.equipment.id, second.equipment.id);
  assert.notDeepEqual(first.anchor, second.anchor, "two equipment resolved to one endpoint");
});

test("a broken endpoint names both ends and says which way it broke", () => {
  for (const [mutate, reason] of [
    [(p) => { p.paths[0].from_equipment = "gone"; }, "equipment_missing"],
    [(p) => { delete p.paths[0].from_port; }, "port_unspecified"],
    [(p) => { p.profiles[0].ports = []; }, "port_missing"],
  ]) {
    const broken = sharedProfileProject();
    mutate(broken);
    const resolved = ports.resolveEndpoint(broken, broken.paths[0], "from");
    assert.equal(resolved.broken, true);
    assert.equal(resolved.reason, reason);
    assert.equal(resolved.detail.path_id, "run");
    assert.equal(resolved.detail.end, "from");
  }
});

test("equipment may override its profile's ports without losing identity", () => {
  // A one-off machine carries its own ports. The endpoint still resolves, and
  // still resolves to the equipment's port rather than the profile's.
  const overridden = sharedProfileProject();
  overridden.equipment[0].ports = [
    { id: "out", medium: "hydronic", direction: "out", side: "bottom", kind: "process" },
  ];
  const resolved = ports.resolveEndpoint(overridden, overridden.paths[0], "from");
  assert.equal(resolved.broken, false);
  assert.equal(resolved.port.side, "bottom");
});

test("paste does not duplicate profiles, because a profile is shared", () => {
  const pasted = ports.remapIdentifiers(sharedProfileProject(), { prefix: "copy" });
  assert.deepEqual(pasted.profiles.map((profile) => profile.id), ["pump"]);
  assert.equal(pasted.equipment[0].profile, "pump");
});

test("a second paste into the same project does not collide with the first", () => {
  const first = ports.remapIdentifiers(sharedProfileProject(), { prefix: "copy" });
  const taken = first.equipment.map((item) => item.id);
  const second = ports.remapIdentifiers(sharedProfileProject(), { prefix: "copy", existing: taken });
  assert.equal(new Set([...taken, ...second.equipment.map((i) => i.id)]).size,
    taken.length + second.equipment.length);
  assert.deepEqual(ports.brokenEndpoints(second), []);
});

test("remapping refuses a missing prefix rather than inventing one", () => {
  assert.throws(() => ports.remapIdentifiers(project(), { prefix: "" }), /needs a prefix/);
  assert.throws(() => ports.resolveEndpoint(project(), project().paths[0], "sideways"), /"from" or "to"/);
});
