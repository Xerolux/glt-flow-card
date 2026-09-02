/**
 * Routes go around plant, not through it (T5-07).
 *
 * The existing router is obstacle-aware but has one defect that matters more
 * than everything it gets right: when no candidate path is clean it returns
 * `candidates[0]` -- a path that crosses an obstacle, returned silently as
 * though it were a route.
 *
 * A drawing that quietly runs a pipe through a chiller is worse than one that
 * refuses, because it reads as engineering truth. Failure has to be explicit.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/routing.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase5-routing-geometry]: obstacle-aware routing geometry is unavailable";
const EFFECT_PREFIX = "PHASE5_GEOMETRY_EFFECTS ";

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

const box = (x, y, width = 100, height = 60, side = "right") => ({ x, y, width, height, side });

function crosses(points, rect) {
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
    const minY = Math.min(ay, by), maxY = Math.max(ay, by);
    if (maxX > rect.x && minX < rect.x + rect.width
      && maxY > rect.y && minY < rect.y + rect.height) return true;
  }
  return false;
}

test("the crossing helper actually detects a crossing", () => {
  const rect = { x: 10, y: 0, width: 10, height: 10 };
  assert.ok(crosses([[0, 5], [30, 5]], rect));
  assert.ok(!crosses([[0, 50], [30, 50]], rect));
});

test("[expected-red:phase5-routing-geometry] geometry is correct and explicit", async () => {
  emitEffects({ cases: 5 });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/routing.mjs does not exist");
  } else {
    const { routePath, routeNetwork } = model;
    if (typeof routePath !== "function") {
      gaps.push("routePath is not exported");
    } else {
      // An obstacle squarely between two ports: a straight line is wrong.
      const blocked = {
        source: box(0, 0), target: { ...box(600, 0), side: "left" },
        obstacles: [{ x: 280, y: -60, width: 120, height: 200 }],
        options: { clearance: 20 },
      };
      const routed = routePath(blocked);
      if (routed?.points && crosses(routed.points, blocked.obstacles[0])) {
        gaps.push("the route crosses an obstacle");
      }

      // Boxed in on every side: there is no clean path, and saying so is the
      // only honest answer.
      const walled = {
        source: box(0, 0), target: { ...box(600, 0), side: "left" },
        obstacles: [
          { x: 200, y: -400, width: 40, height: 1000 },
          { x: 300, y: -400, width: 40, height: 1000 },
          { x: 400, y: -400, width: 40, height: 1000 },
        ],
        options: { clearance: 20, maxDetour: 1 },
      };
      const impossible = routePath(walled);
      if (impossible?.routable !== false) {
        gaps.push("an unroutable pair returned a path instead of an explicit failure");
      } else if (!impossible.reason) {
        gaps.push("an unroutable pair gave no reason");
      }

      // The declared side is honoured, not chosen by comparing centres.
      const sided = {
        source: box(0, 0, 100, 60, "top"),
        target: { ...box(600, 0), side: "bottom" },
        obstacles: [], options: { clearance: 20 },
      };
      const leaving = routePath(sided);
      const [start] = leaving?.points ?? [[]];
      if (start && start[1] > sided.source.y) {
        gaps.push("the route did not leave on the side the port declares");
      }
    }

    if (typeof routeNetwork !== "function") {
      gaps.push("routeNetwork is not exported, so junctions and spacing have no owner");
    } else {
      const network = routeNetwork({
        routes: [
          { id: "a", source: box(0, 0), target: { ...box(600, 0), side: "left" } },
          { id: "b", source: box(0, 100), target: { ...box(600, 0), side: "left" } },
          { id: "c", source: box(0, 200), target: { ...box(600, 0), side: "left" } },
        ],
        obstacles: [], options: { clearance: 20, spacing: 12 },
      });
      if (!Array.isArray(network?.junctions)) {
        gaps.push("no junctions were produced where three routes meet");
      }
      if (!Array.isArray(network?.crossings)) {
        gaps.push("crossings are not represented, so a crossing looks like a junction");
      }
      if (network?.spacing_violations?.length) {
        gaps.push(`${network.spacing_violations.length} parallel runs overlap`);
      }

      // A junction must not move because an unrelated route was recomputed.
      const again = routeNetwork({
        routes: [
          { id: "a", source: box(0, 0), target: { ...box(600, 0), side: "left" } },
          { id: "b", source: box(0, 100), target: { ...box(600, 0), side: "left" } },
          { id: "c", source: box(0, 200), target: { ...box(600, 0), side: "left" } },
          { id: "d", source: box(0, 900), target: { ...box(600, 900), side: "left" } },
        ],
        obstacles: [], options: { clearance: 20, spacing: 12 },
      });
      if (JSON.stringify(network?.junctions) !== JSON.stringify(again?.junctions)) {
        gaps.push("adding an unrelated route moved an existing junction");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  geometry gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "obstacle-aware routing geometry is unavailable");
});
