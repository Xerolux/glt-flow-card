/**
 * Routing determinism, the precondition for every other routing claim (T5-06).
 *
 * `smartRoute` is already pure and already obstacle-aware. This is not a fresh
 * start; it is the property that has to hold before obstacle avoidance, junction
 * stability or bounded rerouting can be tested at all. A router that answers
 * differently for the same input turns every one of those assertions into a
 * flake, and a flaky assertion about geometry is worse than none: it gets
 * disabled, and then nothing is checked.
 *
 * Two properties, and the second is the one that bites in practice. Byte
 * equality across runs is easy. Bounded change under a one-pixel move is what
 * stops the whole diagram from twitching every time somebody nudges a pump.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/routing.mjs", import.meta.url);

const RED_MARKER = "EXPECTED_RED[phase5-routing-determinism]: deterministic routing is unavailable";
const EFFECT_PREFIX = "PHASE5_ROUTING_EFFECTS ";

/** A one-pixel move may not rewrite more of the path than this. */
const MAX_SEGMENTS_CHANGED_BY_A_NUDGE = 2;

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

function scene(offset = 0) {
  return {
    source: { x: 0, y: 0, width: 100, height: 60, side: "right" },
    target: { x: 600 + offset, y: 300, width: 100, height: 60, side: "left" },
    obstacles: [
      { x: 300, y: 250, width: 120, height: 120 },
      { x: 300, y: 40, width: 120, height: 120 },
    ],
    options: { clearance: 20 },
  };
}

function segments(points) {
  return points.slice(1).map((point, index) => `${points[index]}->${point}`);
}

test("the nudge bound is a number, so a regression is measurable", () => {
  assert.equal(typeof MAX_SEGMENTS_CHANGED_BY_A_NUDGE, "number");
  assert.ok(MAX_SEGMENTS_CHANGED_BY_A_NUDGE >= 1);
});

test("[expected-red:phase5-routing-determinism] the same diagram routes the same way", async () => {
  emitEffects({ nudgeBound: MAX_SEGMENTS_CHANGED_BY_A_NUDGE });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/routing.mjs does not exist");
  } else {
    const { routePath } = model;
    if (typeof routePath !== "function") {
      gaps.push("routePath is not exported");
    } else {
      const first = routePath(scene());
      const second = routePath(scene());
      if (JSON.stringify(first) !== JSON.stringify(second)) {
        gaps.push("two runs over the same scene produced different routes");
      }

      // Order must not decide anything. A router that iterates an unordered
      // collection is deterministic only until the collection changes shape.
      const reordered = scene();
      reordered.obstacles = [...reordered.obstacles].reverse();
      const flipped = routePath(reordered);
      if (JSON.stringify(flipped) !== JSON.stringify(first)) {
        gaps.push("reordering the obstacle list changed the route");
      }

      const nudged = routePath(scene(1));
      const before = segments(first?.points ?? []);
      const after = segments(nudged?.points ?? []);
      const changed = after.filter((segment) => !before.includes(segment)).length;
      if (changed > MAX_SEGMENTS_CHANGED_BY_A_NUDGE) {
        gaps.push(`a one-pixel move rewrote ${changed} segments, over the bound of ${MAX_SEGMENTS_CHANGED_BY_A_NUDGE}`);
      }

      if (!Array.isArray(first?.points) || first.points.length < 2) {
        gaps.push("routePath returned no usable path");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  determinism gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "deterministic routing is unavailable");
});
