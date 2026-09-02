/**
 * Record identity is content-derived and identical across both runtimes (T8-22).
 *
 * This closes a defect on its third occurrence: `paste_${Date.now()}` in Phase
 * 5, `report_${Date.now()}` in Phase 7, `wo_${Date.now()}` in Phase 8's audit.
 *
 * The corpus below deliberately contains **numbers**, and that is the whole
 * reason it is a corpus rather than one example. The first version of the
 * browser mirror stringified numbers where the Companion emits them as numbers,
 * so every id containing a number differed between runtimes — and a test using
 * only string payloads passed. An id that looks stable and is not would be
 * worse than the clock-derived ones this replaces.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";
import { ID_KINDS, ID_LENGTH, canonicalBytes, contentId } from "../src/v100/content-id.mjs";

const EFFECT_PREFIX = "PHASE8_CONTENT_ID_EFFECTS ";

/**
 * Payloads chosen for what they can break, not for coverage of shapes.
 *
 * Integral floats, nested objects with keys out of order, arrays, booleans and
 * a unicode string. Each is a place where "the same value" and "the same bytes"
 * have come apart in this codebase before.
 */
const CORPUS = [
  ["work_order", { asset_id: "pump-1", opened: "2027-06-01T00:00:00+02:00", title: "Service" }],
  ["work_order", { title: "Service", opened: "2027-06-01T00:00:00+02:00", asset_id: "pump-1" }],
  ["work_order_entry", { actor: "u1", at: "2027-06-01T08:00:00+02:00", status: "assigned" }],
  ["maintenance_plan", { asset_id: "pump-1", every: 6, model: "interval", period: "month" }],
  // Integral and non-integral floats: `0.0` against `0` is the pair that cost
  // this project a cycle in 07-02, and 4/7 is the one that needs no help.
  ["maintenance_plan", { asset_id: "pump-1", hours: 0.0, model: "operating_hours" }],
  ["maintenance_plan", { asset_id: "pump-1", hours: 2500.0, model: "operating_hours" }],
  ["commissioning_run", { coverage: 0.5714285714285714, findings: 3 }],
  ["scenario", { name: "Anfahren", steps: [{ from: 20, kind: "ramp", slot: "flow", ticks: 10, to: 65 }] }],
  ["attachment", { bytes: 1024, name: "Zählerstand.jpg", type: "image/jpeg" }],
  ["simulation_session", { actor: "u1", nested: { deep: { flag: true, n: 0 } } }],
];

function companionIds() {
  const script = [
    "import json",
    "from custom_components.glt_flow_card.content_id import content_id, canonical_bytes",
    `corpus = json.loads(${JSON.stringify(JSON.stringify(CORPUS))})`,
    "print(json.dumps([[content_id(k, p), canonical_bytes(p)] for k, p in corpus]))",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  return JSON.parse(execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }));
}

test("both runtimes derive identical ids and identical canonical bytes", async () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    cases: CORPUS.length, network: 0, notification: 0, remote: 0, service: 0,
  }));
  const companion = companionIds();
  const divergences = [];
  for (const [index, [kind, payload]] of CORPUS.entries()) {
    const [theirId, theirBytes] = companion[index];
    const mineId = await contentId(kind, payload);
    const mineBytes = canonicalBytes(payload);
    // Bytes first. Comparing ids alone would report a divergence without
    // saying where it came from, and the bytes are where it always comes from.
    if (mineBytes !== theirBytes) {
      divergences.push(`${kind}[${index}] bytes: browser ${mineBytes} != companion ${theirBytes}`);
    }
    if (mineId !== theirId) {
      divergences.push(`${kind}[${index}] id: browser ${mineId} != companion ${theirId}`);
    }
  }
  assert.deepEqual(divergences, [], divergences.join("\n"));
});

test("the same record re-derives the same id, whatever order its keys arrive in", async () => {
  // Re-derived rather than compared against a literal. A literal would freeze
  // today's digest and prove nothing about stability; re-deriving proves the
  // property the record actually needs.
  const [, first] = CORPUS[0];
  const [, reordered] = CORPUS[1];
  assert.equal(await contentId("work_order", first), await contentId("work_order", reordered));
});

test("two records differing only in a nested value get different ids", async () => {
  const base = { actor: "u1", nested: { deep: { flag: true, n: 0 } } };
  const changed = { actor: "u1", nested: { deep: { flag: true, n: 1 } } };
  assert.notEqual(
    await contentId("simulation_session", base),
    await contentId("simulation_session", changed),
    "a nested change did not reach the digest",
  );
});

test("ids created in the same millisecond differ when their content differs", async () => {
  // The second half of the defect. `Date.now()` gives the same id to everything
  // a loop creates, which is ordinary rather than exotic.
  const ids = await Promise.all(
    Array.from({ length: 50 }, (_, index) => contentId("work_order", { seq: index, title: "Service" })),
  );
  assert.equal(new Set(ids).size, 50, "content-derived ids collided");
});

test("an id says what it identifies, and an unknown kind is refused", async () => {
  for (const kind of ID_KINDS) {
    const id = await contentId(kind, { probe: 1 });
    assert.ok(id.startsWith(`${kind}-`), `${id} does not name its kind`);
    assert.equal(id.length, kind.length + 1 + ID_LENGTH);
  }
  await assert.rejects(() => contentId("banana", {}), /unknown_id_kind/);
});
