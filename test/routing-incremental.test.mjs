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

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel proves one move stays under the bound. These prove *why* it
// does — a route is computed against the obstacles near it, so a distant one
// was never an input — and that the router refuses rather than guesses.

const router = await import(MODULE_URL.href);

test("relevance is a property of the scene, not a decision the router makes", () => {
  // The bound holds because a distant obstacle is not an input to this route.
  // If it were merely skipped, the incremental answer could differ from the
  // full one, and every claim in this file would be about an optimisation
  // rather than about the geometry.
  const region = { left: 0, top: 0, right: 500, bottom: 100 };
  const near = { id: "near", x: 200, y: 20, width: 60, height: 60 };
  const far = { id: "far", x: 200, y: 4000, width: 60, height: 60 };
  const chosen = router.relevantObstacles(region, [far, near], 20).map((box) => box.id);
  assert.deepEqual(chosen, ["near"]);
  // Order in, same answer out.
  assert.deepEqual(
    router.relevantObstacles(region, [near, far], 20).map((box) => box.id),
    chosen,
  );
});

test("relevance grows transitively, so a chain of obstacles is not cut in half", () => {
  // A route squeezing past one obstacle may be pushed into the next. The second
  // is relevant even though it never touched the direct region.
  const region = { left: 0, top: 0, right: 300, bottom: 40 };
  const first = { id: "a", x: 100, y: 10, width: 60, height: 200 };
  const second = { id: "b", x: 100, y: 220, width: 60, height: 60 };
  assert.deepEqual(
    router.relevantObstacles(region, [first, second], 20).map((box) => box.id),
    ["a", "b"],
  );
});

test("a move recomputes the routes it reached and reports exactly those", () => {
  const scene = bigScene();
  const instance = router.createRouter(scene);
  instance.routeAll();
  const moved = instance.moveObstacle("o5", { x: 420, y: 5 * 200 + 20 });
  assert.deepEqual(moved.recomputed, ["r5"]);
});

test("a move away from a route is as much a change as a move towards one", () => {
  // Recomputing only the destination leaves a stale detour around nothing.
  const instance = router.createRouter(bigScene());
  instance.routeAll();
  const away = instance.moveObstacle("o3", { x: 400, y: 3 * 200 - 400 });
  assert.ok(away.recomputed.includes("r3"),
    "the route the obstacle left was not recomputed");
});

test("moving an obstacle that is not in the scene is an error, not a no-op", () => {
  const instance = router.createRouter(bigScene());
  instance.routeAll();
  assert.throws(() => instance.moveObstacle("nope", { x: 0, y: 0 }), /no such obstacle: nope/);
});

test("the router hands back copies, so a caller cannot edit the scene behind it", () => {
  const instance = router.createRouter(bigScene());
  const obstacles = instance.obstacles;
  obstacles[0].x = -9999;
  assert.notEqual(instance.obstacles[0].x, -9999);
});
