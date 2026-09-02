/**
 * Rerouting is incremental and bounded (T5-08).
 *
 * Today `reroute` walks every path in the view on every call, and the CAD
 * dialog's "recalculate all auto-routes" does the same. On a diagram of any
 * size that is the freeze the roadmap names.
 *
 * The bound is expressed in segments recomputed per interaction, not in
 * milliseconds. A wall-clock assertion is a capacity claim, Phase 10 owns
 * those, and a millisecond budget measured on a CI runner tells you about the
 * runner.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/routing.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase5-routing-incremental]: bounded incremental rerouting is unavailable";
const EFFECT_PREFIX = "PHASE5_INCREMENTAL_EFFECTS ";

/** Routes in the scene, and the most that may be recomputed for one move. */
const ROUTE_COUNT = 40;
const MAX_RECOMPUTED_PER_MOVE = 6;

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

function bigScene() {
  const routes = [];
  const obstacles = [];
  for (let index = 0; index < ROUTE_COUNT; index += 1) {
    const y = index * 200;
    routes.push({
      id: `r${index}`,
      source: { x: 0, y, width: 100, height: 60, side: "right" },
      target: { x: 900, y, width: 100, height: 60, side: "left" },
    });
    obstacles.push({ id: `o${index}`, x: 400, y: y + 10, width: 100, height: 100 });
  }
  return { routes, obstacles, options: { clearance: 20, spacing: 12 } };
}

test("the scene is large enough that a full sweep would be obvious", () => {
  assert.ok(ROUTE_COUNT > MAX_RECOMPUTED_PER_MOVE * 4);
});

test("[expected-red:phase5-routing-incremental] one move reroutes only its neighbours", async () => {
  emitEffects({ routes: ROUTE_COUNT, bound: MAX_RECOMPUTED_PER_MOVE });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/routing.mjs does not exist");
  } else {
    const { createRouter } = model;
    if (typeof createRouter !== "function") {
      gaps.push("createRouter is not exported, so there is nothing to be incremental");
    } else {
      const router = createRouter(bigScene());
      const initial = router.routeAll();
      if (!initial || Object.keys(initial.routes ?? {}).length !== ROUTE_COUNT) {
        gaps.push("the initial pass did not route every route");
      }

      const moved = router.moveObstacle("o0", { x: 420, y: 20 });
      const recomputed = moved?.recomputed ?? [];
      if (recomputed.length === 0) {
        gaps.push("moving an obstacle recomputed nothing, so the route is now wrong");
      } else if (recomputed.length > MAX_RECOMPUTED_PER_MOVE) {
        gaps.push(`one move recomputed ${recomputed.length} routes, over the bound of ${MAX_RECOMPUTED_PER_MOVE}`);
      }

      // Cheap is worthless if it is wrong: the incremental result must equal a
      // full recompute of the same scene.
      const fresh = createRouter({ ...bigScene(),
        obstacles: bigScene().obstacles.map((o) => (o.id === "o0" ? { ...o, x: 420, y: 20 } : o)) });
      const full = fresh.routeAll();
      if (JSON.stringify(moved?.routes) !== JSON.stringify(full?.routes)) {
        gaps.push("the incremental result differs from a full recompute");
      }

      // A move far from everything must be nearly free.
      const distant = router.moveObstacle("o39", { x: 420, y: 39 * 200 + 12 });
      if ((distant?.recomputed ?? []).length > MAX_RECOMPUTED_PER_MOVE) {
        gaps.push("a distant move still recomputed a large share of the diagram");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  incremental gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "bounded incremental rerouting is unavailable");
});
