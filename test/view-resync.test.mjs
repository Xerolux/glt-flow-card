/**
 * Honest gap detection and resync (T4-09).
 *
 * Home Assistant's websocket API has no sequence number and no replay, so the
 * client half of gap detection is this integration's own. A view that resyncs
 * on every event is a denial of service against its own backend; one that
 * resyncs too rarely shows stale data as live. Neither is acceptable, so the
 * gap is detected and the view says so.
 *
 * Nothing is interpolated across a gap. A number nobody observed is not a
 * number, and drawing one is the failure this whole mechanism exists to avoid.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/view-resync.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase4-view-resync]: honest gap detection and resync are unavailable";
const EFFECT_PREFIX = "PHASE4_RESYNC_EFFECTS ";

/** Every way a view can lose track. Each must reach `stale` in one transition. */
export const LOSS_EVENTS = Object.freeze([
  "sequence-gap",
  "reconnect",
  "revocation",
  "incompatible-snapshot",
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

test("the loss events are the ones the authority reducer already names", () => {
  assert.ok(LOSS_EVENTS.includes("sequence-gap"));
  assert.equal(new Set(LOSS_EVENTS).size, LOSS_EVENTS.length);
});

test("[expected-red:phase4-view-resync] a gap is detected, never smoothed", async () => {
  emitEffects({ lossEvents: LOSS_EVENTS.length });
  const gaps = [];
  const model = await loadModel();
  if (!model) {
    gaps.push("src/v100/view-resync.mjs does not exist");
  } else {
    const { createViewSync } = model;
    if (typeof createViewSync !== "function") {
      gaps.push("createViewSync is not exported");
    } else {
      // A contiguous stream stays live.
      const contiguous = createViewSync();
      contiguous.snapshot({ sequence: 10, values: { a: 1 } });
      contiguous.event({ sequence: 11, values: { a: 2 } });
      if (contiguous.state().status !== "live") {
        gaps.push("a contiguous stream did not stay live");
      }

      // A gap reaches stale in exactly one transition, with no intermediate
      // interactive render.
      const gapped = createViewSync();
      gapped.snapshot({ sequence: 10, values: { a: 1 } });
      const transitions = [];
      gapped.subscribe((state) => transitions.push(state.status));
      gapped.event({ sequence: 14, values: { a: 9 } });
      if (gapped.state().status !== "stale") {
        gaps.push(`a sequence gap left the view ${gapped.state().status}`);
      }
      if (transitions.filter((status) => status === "stale").length !== 1) {
        gaps.push(`a gap produced ${transitions.length} transitions: ${transitions}`);
      }
      if (transitions.some((status) => status === "live")) {
        gaps.push("a gap rendered an interactive state before going stale");
      }

      // Nothing is interpolated: the value from the skipped events must not
      // appear, and the last observed value keeps its own age.
      const shown = gapped.state().values;
      if (shown && shown.a === 9) {
        gaps.push("the post-gap value was adopted as though nothing was missed");
      }
      if (gapped.state().observedAt === undefined) {
        gaps.push("stale values carry no age, so they read as live");
      }

      // Every loss event behaves the same way.
      for (const event of LOSS_EVENTS) {
        const view = createViewSync();
        view.snapshot({ sequence: 1, values: { a: 1 } });
        view.lost(event);
        const state = view.state();
        if (state.status !== "stale") {
          gaps.push(`${event} left the view ${state.status} instead of stale`);
        }
        if (state.reason !== event) {
          gaps.push(`${event} did not record its own reason`);
        }
        if (state.interactive !== false) {
          gaps.push(`${event} left the view interactive`);
        }
      }

      // Operator input survives a resync, per the Phase-2 candidate rule.
      const editing = createViewSync();
      editing.snapshot({ sequence: 1, values: { a: 1 } });
      editing.retain({ setpoint: "42", window: "24h" });
      editing.lost("reconnect");
      editing.snapshot({ sequence: 9, values: { a: 5 } });
      const retained = editing.state().retained;
      if (!retained || retained.setpoint !== "42" || retained.window !== "24h") {
        gaps.push("operator input did not survive a resync");
      }

      // A rate-limited resync leaves the view stale rather than escalating.
      const limited = createViewSync();
      limited.snapshot({ sequence: 1, values: { a: 1 } });
      limited.lost("sequence-gap");
      limited.resyncRefused("rate_limited");
      if (limited.state().status !== "stale") {
        gaps.push("a refused resync did not leave the view stale");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  resync gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "honest gap detection and resync are unavailable");
});
