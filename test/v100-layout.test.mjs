import test from "node:test";
import assert from "node:assert/strict";
import { rectsOverlap, resolveOverlayLayout, labelScaleFactor } from "../src/v100/label-layout.mjs";
import { ensureV1 } from "../src/v100/core.mjs";

const box = (x, y, w, h) => ({ x, y, w, h });

test("rectsOverlap detects plain intersection and honours margin", () => {
  assert.equal(rectsOverlap(box(0, 0, 100, 50), box(50, 0, 100, 50)), true);
  assert.equal(rectsOverlap(box(0, 0, 100, 50), box(100, 0, 100, 50)), false);
  assert.equal(rectsOverlap(box(0, 0, 100, 50), box(100, 0, 100, 50), 1), true);
  assert.equal(rectsOverlap(box(0, 0, 100, 50), box(0, 200, 100, 50)), false);
});

test("a pipe label colliding with an equipment box is relocated, not dropped", () => {
  const placed = resolveOverlayLayout({
    labels: [{ id: "wp_vl", ...box(430, 245, 116, 34) }],
    obstacles: [box(420, 235, 90, 60)],
    step: 18,
    margin: 6,
    maxShift: 72,
  });
  assert.equal(placed.length, 1);
  assert.equal(placed[0].moved, true);
  for (const obstacle of [box(420, 235, 90, 60)]) {
    assert.equal(
      rectsOverlap(box(placed[0].x, placed[0].y, 116, 34), obstacle, 6),
      false,
      "relocated label must clear the obstacle",
    );
  }
  const shift = Math.abs(placed[0].x - 430) + Math.abs(placed[0].y - 245);
  assert.ok(shift <= 72 + 72, "label stays near its path");
});

test("a label that already fits keeps its exact position", () => {
  const placed = resolveOverlayLayout({
    labels: [{ id: "free", ...box(500, 500, 116, 34) }],
    obstacles: [box(0, 0, 100, 100)],
    step: 18,
    margin: 6,
    maxShift: 72,
  });
  assert.deepEqual(placed[0], { id: "free", x: 500, y: 500, w: 116, h: 34, moved: false });
});

test("stacked labels resolve without colliding with each other", () => {
  // Live regression shape: pipe value label squeezed between two datapoint
  // chips that sit 33 px apart vertically, exactly as measured on the
  // iDM Heizzentrale dashboard.
  const placed = resolveOverlayLayout({
    labels: [
      { id: "pipe", ...box(456, 283, 116, 34) },
      { id: "chip_a", ...box(430, 245, 102, 50) },
      { id: "chip_b", ...box(420, 305, 102, 50) },
    ],
    obstacles: [],
    step: 18,
    margin: 6,
    maxShift: 72,
  });
  const rects = placed.map((entry) => box(entry.x, entry.y, entry.w, entry.h));
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      assert.equal(rectsOverlap(rects[i], rects[j], 6), false, `labels ${i} and ${j} still overlap`);
    }
  }
});

test("an unsolvable label keeps its anchor instead of wandering off", () => {
  const placed = resolveOverlayLayout({
    labels: [{ id: "trapped", ...box(400, 400, 116, 34) }],
    obstacles: [box(300, 300, 340, 200)],
    step: 18,
    margin: 6,
    maxShift: 36,
  });
  assert.equal(placed[0].moved, false, "no free candidate within maxShift must keep the anchor");
});

test("layout is deterministic for identical input", () => {
  const input = () => ({
    labels: [
      { id: "a", ...box(100, 100, 116, 34) },
      { id: "b", ...box(110, 110, 116, 34) },
    ],
    obstacles: [box(80, 80, 60, 200)],
    step: 18,
    margin: 6,
    maxShift: 72,
  });
  assert.deepEqual(resolveOverlayLayout(input()), resolveOverlayLayout(input()));
});

test("labelScaleFactor keeps on-screen label size readable when zoomed out", () => {
  assert.equal(labelScaleFactor(0.56, "auto"), 1 / 0.56 > 1.15 ? 1.15 : 1 / 0.56);
  assert.equal(labelScaleFactor(0.25, "auto"), 1.15);
  assert.equal(labelScaleFactor(1.4, "auto"), 1);
  assert.equal(labelScaleFactor(0.56, false), 1);
  assert.equal(labelScaleFactor(0.56, "fixed"), 1);
  assert.equal(labelScaleFactor(0.56, 1.1), 1.1);
  assert.equal(labelScaleFactor(0.56, 9), 1.15);
});

test("ensureV1 ships canvas clarity defaults for overlap handling", () => {
  const config = ensureV1({ title: "Layout" });
  assert.equal(config.ui.collision_avoidance, true);
  assert.equal(config.ui.label_scale, "auto");
  assert.equal(config.ui.auto_height, true);
  // Explicit user choices survive normalisation.
  const kept = ensureV1({ ui: { collision_avoidance: false, label_scale: 1.2, auto_height: false } });
  assert.equal(kept.ui.collision_avoidance, false);
  assert.equal(kept.ui.label_scale, 1.2);
  assert.equal(kept.ui.auto_height, false);
});
