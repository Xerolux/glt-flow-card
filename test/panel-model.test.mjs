/**
 * The panel render model (T4-01).
 *
 * The browser renders the regions it is given, in the order it is given them.
 * It derives no role, no capability and no control list: a capability snapshot
 * can be five minutes stale, and a control it invented is a control the server
 * would refuse.
 *
 * The module does not exist yet. It is imported dynamically so a missing module
 * is reported as a named product gap rather than crashing the run, which would
 * look like a broken harness.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/panel-model.mjs", import.meta.url);

const RED_MARKER = "EXPECTED_RED[phase4-panel-model]: the panel render model is unavailable";
const EFFECT_PREFIX = "PHASE4_PANEL_MODEL_EFFECTS ";

/** The ordered region kinds, from 04-UI-SPEC. */
export const REGION_KINDS = Object.freeze([
  "identity", "state", "values", "runtime", "quality", "alarms", "controls", "trend",
]);

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, localStorage: 0, callService: 0, callApi: 0, ...extra,
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

/** A minimal server-composed response, the only input the reducer may trust. */
function response(overrides = {}) {
  return {
    object_id: "eq-hp-primary",
    regions: [
      { kind: "identity", name: "Heat pump 1", path: ["site-north", "eq-hp-primary"] },
      { kind: "state", state: "running", symbol: "▶", label: "Running" },
      { kind: "values", values: [{ id: "dp-hp1-flow", label: "Flow", value: 42, unit: "degC" }] },
      { kind: "runtime", values: [{ id: "dp-hp1-hours", label: "Operating hours", value: 10 }] },
      { kind: "quality", health: "live", source: "modbus" },
      { kind: "alarms", alarms: [] },
      { kind: "controls", controls: [{ control_id: "enable", label: "Enable" }] },
      { kind: "trend", state: "history_unavailable" },
    ],
    ...overrides,
  };
}

test("the region kinds are the closed set the UI contract declares", () => {
  assert.equal(new Set(REGION_KINDS).size, REGION_KINDS.length);
  assert.ok(REGION_KINDS.includes("trend"));
});

test("[expected-red:phase4-panel-model] the panel renders exactly what the server composed", async () => {
  emitEffects({ regions: REGION_KINDS.length });
  const gaps = [];
  const model = await loadModel();
  if (!model) {
    gaps.push("src/v100/panel-model.mjs does not exist");
  } else {
    const { reducePanel } = model;
    if (typeof reducePanel !== "function") {
      gaps.push("reducePanel is not exported");
    } else {
      const rendered = reducePanel(response());
      const order = rendered.regions.map((region) => region.kind);
      const expected = response().regions.map((region) => region.kind);
      if (JSON.stringify(order) !== JSON.stringify(expected)) {
        gaps.push(`region order was not preserved: ${order}`);
      }

      // An unknown kind is an error, not a passthrough.
      let rejected = false;
      try {
        reducePanel(response({
          regions: [{ kind: "not-a-region", body: "x" }],
        }));
      } catch {
        rejected = true;
      }
      if (!rejected) gaps.push("an unknown region kind was accepted");

      // An absent region and an empty region are different renders, and both
      // are declared. A region the server did not send is never synthesized.
      const withoutControls = reducePanel(response({
        regions: response().regions.filter((region) => region.kind !== "controls"),
      }));
      if (withoutControls.regions.some((region) => region.kind === "controls")) {
        gaps.push("a region the server did not send was synthesized");
      }
      const emptyControls = reducePanel(response({
        regions: response().regions.map((region) =>
          region.kind === "controls" ? { kind: "controls", controls: [] } : region),
      }));
      const emptyRegion = emptyControls.regions.find((region) => region.kind === "controls");
      if (!emptyRegion || !emptyRegion.emptyText) {
        gaps.push("an empty region carries no declared empty text");
      }

      // The reducer must not be able to produce a control the response lacked.
      const noControls = reducePanel(response({
        regions: response().regions.map((region) =>
          region.kind === "controls" ? { kind: "controls", controls: [] } : region),
      }));
      const produced = noControls.regions
        .filter((region) => region.kind === "controls")
        .flatMap((region) => region.controls ?? []);
      if (produced.length > 0) gaps.push("the reducer produced a control the server did not send");
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  panel model gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "the panel render model is unavailable");
});
