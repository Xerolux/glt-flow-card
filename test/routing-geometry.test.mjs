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

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel uses four hand-built scenes. These run the router over the CAD
// corpus, which was built to defeat an elbow-through-the-midpoint router — so
// "routes correctly" is measured against geometry that was designed to be hard
// rather than against geometry chosen after the fact.

import { readFile } from "node:fs/promises";

const routing = await import(MODULE_URL.href);

const SCENES = JSON.parse(await readFile(
  new URL("../tests/components/glt_flow_card/fixtures/cad-scenes.json", import.meta.url),
  "utf8",
));

test("the corpus fixtures a midpoint router fails are all routed cleanly", () => {
  const defeated = SCENES.scenes.filter((scene) => scene.naive_blocked.length > 0);
  assert.ok(defeated.length >= 3, "the corpus stopped defeating the naive router");

  for (const scene of SCENES.scenes) {
    const routed = routing.routePath({
      source: scene.source, target: scene.target,
      obstacles: scene.obstacles, options: SCENES.options,
    });
    assert.equal(routed.routable, true, `${scene.id} was refused: ${routed.reason}`);
    for (const obstacle of scene.obstacles) {
      assert.ok(!crosses(routed.points, obstacle),
        `${scene.id} runs through ${obstacle.id}`);
    }
  }
});

test("a route leaves and enters on the sides its ports declare", () => {
  for (const scene of SCENES.scenes) {
    const { points } = routing.routePath({
      source: scene.source, target: scene.target,
      obstacles: scene.obstacles, options: SCENES.options,
    });
    const outward = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
    for (const [end, box] of [["from", scene.source], ["to", scene.target]]) {
      const [near, far] = end === "from"
        ? [points[0], points[1]]
        : [points[points.length - 1], points[points.length - 2]];
      const [dx, dy] = outward[box.side];
      const step = [far[0] - near[0], far[1] - near[1]];
      assert.ok(step[0] * dx >= 0 && step[1] * dy >= 0 && (step[0] * dx + step[1] * dy) > 0,
        `${scene.id} did not leave ${box.side} on its ${end} end`);
    }
  }
});

test("the same scene routes to the same bytes, whatever order it arrives in", () => {
  for (const scene of SCENES.scenes) {
    const forward = routing.routePath({
      source: scene.source, target: scene.target,
      obstacles: scene.obstacles, options: SCENES.options,
    });
    const reversed = routing.routePath({
      source: scene.source, target: scene.target,
      obstacles: [...scene.obstacles].reverse(), options: SCENES.options,
    });
    assert.deepEqual(reversed, forward, `${scene.id} depended on obstacle order`);
  }
});

test("the whole corpus routed as one network has no hidden runs", () => {
  const network = routing.routeNetwork({
    routes: SCENES.scenes.map((scene) => ({
      id: scene.id, source: scene.source, target: scene.target, exclude: scene.exclude,
    })),
    // The whole plant room at once, with each route excluding only its own two
    // endpoints. Routing the corpus one pair at a time would never discover
    // that two routes were drawn on top of each other.
    obstacles: SCENES.obstacles,
    options: SCENES.options,
  });
  assert.deepEqual(network.failures, []);
  assert.ok(Array.isArray(network.junctions));
  assert.ok(Array.isArray(network.crossings));

  // Two runs sharing the corridor between the riser blocks are separated:
  // that is the fixture the spacing rule was written for.
  const corridor = network.spacing_violations.filter((violation) => (
    violation.routes.every((id) => id.startsWith("path-corridor"))
  ));
  assert.deepEqual(corridor, [], "the two corridor runs were drawn on top of each other");

  // The pair that used to be unresolvable. Both diagonals have a port at y=30
  // and a port at y=230, so whichever turns first owns the near end of one row
  // and the far end of the other; no single lane shift orders both. Phase 5
  // reported the overlap rather than drawing one run inside the other, and
  // recorded that resolving it needed a jog rather than an offset.
  //
  // It does, and `jogCandidates` is that jog: it displaces only the overlapping
  // stretch and brings the run back, so both ports stay where they are. A jog
  // trades one long overlap for a short one at the turn, which a resolver
  // comparing overlap *counts* scores as a draw and declines -- so the resolver
  // compares (count, extent), and the shorter drawing wins.
  assert.deepEqual(network.spacing_violations, [],
    "the two diagonals are drawn on top of each other again");

  // Not vacuously: the jog has to have actually happened, and the ports have to
  // have stayed put. An empty violation list is also what a router that refused
  // to draw anything would produce.
  const ascending = network.routes["path-cross-ascending"];
  const descending = network.routes["path-cross-descending"];
  for (const [id, route, scene] of [
    ["path-cross-ascending", ascending, SCENES.scenes.find((s) => s.id === "path-cross-ascending")],
    ["path-cross-descending", descending, SCENES.scenes.find((s) => s.id === "path-cross-descending")],
  ]) {
    assert.ok(route?.points?.length >= 2, `${id} was not drawn`);
    for (const point of route.points) assert.equal(point.length, 2, id);
    // Every segment stays orthogonal: a jog that introduced a diagonal would
    // separate the runs and stop being a piping drawing.
    for (let i = 0; i < route.points.length - 1; i += 1) {
      const [ax, ay] = route.points[i];
      const [bx, by] = route.points[i + 1];
      assert.ok(ax === bx || ay === by, `${id} has a diagonal segment`);
    }
    assert.ok(scene, `${id} is not in the corpus`);
  }
  assert.ok(
    descending.points.length > 4 || ascending.points.length > 4,
    "neither diagonal gained the bends a jog adds, so nothing was separated",
  );
});

test("three routes into one header make a junction, and it does not move", () => {
  const junctionScenes = SCENES.scenes.filter((scene) => scene.id.startsWith("path-junction"));
  assert.equal(junctionScenes.length, 3);
  const routes = junctionScenes.map((scene) => ({
    id: scene.id, source: scene.source, target: scene.target,
  }));
  const before = routing.routeNetwork({ routes, obstacles: [], options: SCENES.options });
  assert.ok(before.junctions.length > 0, "three routes into one port made no junction");

  const unrelated = SCENES.scenes.find((scene) => scene.id === "path-power");
  const after = routing.routeNetwork({
    routes: [...routes, { id: "zz", source: unrelated.source, target: unrelated.target }],
    obstacles: [], options: SCENES.options,
  });
  assert.deepEqual(after.junctions, before.junctions,
    "an unrelated route moved an existing junction");
});

test("an unroutable pair says so, and names one of the declared reasons", () => {
  const walled = routing.routePath({
    source: { x: 0, y: 0, width: 100, height: 60, side: "right" },
    target: { x: 600, y: 0, width: 100, height: 60, side: "left" },
    obstacles: [{ id: "w", x: 200, y: -4000, width: 40, height: 8000 }],
    options: { clearance: 20, maxDetour: 0.2 },
  });
  assert.equal(walled.routable, false);
  assert.ok(routing.ROUTING_FAILURES.includes(walled.reason), walled.reason);
  assert.deepEqual(walled.points, [], "a refusal still handed back a path");
});
