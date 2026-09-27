// Pure overlay-label layout for the schematic canvas: keeps pipe value labels
// and datapoint chips clear of equipment boxes and of each other. No DOM here —
// the card measures rendered boxes, calls these helpers, and applies the result.

export function rectsOverlap(a, b, margin = 0) {
  return a.x - margin < b.x + b.w
    && b.x - margin < a.x + a.w
    && a.y - margin < b.y + b.h
    && b.y - margin < a.y + a.h;
}

const DEFAULT_MAX_LABEL_SCALE = 1.15;

/**
 * How much overlay labels (pipe values, datapoint chips) grow to compensate
 * the canvas zoom, so text stays readable when the whole plant is scaled down.
 * "auto" counter-scales capped at 1.6; false/"fixed" keeps 1; a number is
 * honoured but clamped to the same cap.
 */
export function labelScaleFactor(zoom, mode = "auto", options = {}) {
  const max = Number.isFinite(options.max) && options.max > 0 ? options.max : DEFAULT_MAX_LABEL_SCALE;
  if (mode === false || mode === "fixed") return 1;
  if (typeof mode === "number" && Number.isFinite(mode)) return Math.min(max, Math.max(1, mode));
  const factor = Number(zoom) > 0 ? 1 / Number(zoom) : 1;
  return Math.min(max, Math.max(1, factor));
}

function shiftCandidates(step, maxShift) {
  const units = Math.max(1, Math.floor(maxShift / step));
  const list = [];
  for (let dy = -units; dy <= units; dy += 1) {
    for (let dx = -units; dx <= units; dx += 1) {
      list.push({ dx, dy });
    }
  }
  // Nearest first, upward shifts before downward at equal distance: label
  // placement should read as "lifted off the collision", not "wandered".
  list.sort((a, b) => (a.dx * a.dx + a.dy * a.dy) - (b.dx * b.dx + b.dy * b.dy)
    || a.dy - b.dy
    || a.dx - b.dx);
  return list;
}

const overlapsAny = (rect, others, margin) => others.some((other) => rectsOverlap(rect, other, margin));

/**
 * Place movable overlay labels (pipe value tags, datapoint chips) so they do
 * not intersect immovable obstacles (equipment boxes, value slots) or each
 * other. Labels are processed in order; each already-placed label becomes an
 * obstacle for the next. A label with no free candidate within `maxShift`
 * keeps its anchor — a slightly overlapping label is honest, a vanished or
 * far-away one is not.
 *
 * @param {object} input
 * @param {Array<{id: string, x: number, y: number, w: number, h: number}>} input.labels
 *   Movable boxes in canvas coordinates; x/y are the anchor (current) top-left.
 * @param {Array<{x: number, y: number, w: number, h: number}>} input.obstacles
 * @param {number} [input.step=18] Candidate grid in canvas pixels.
 * @param {number} [input.margin=6] Required clearance around every box.
 * @param {number} [input.maxShift=72] Maximum shift per axis in canvas pixels.
 * @returns {Array<{id: string, x: number, y: number, w: number, h: number, moved: boolean}>}
 */
export function resolveOverlayLayout({ labels = [], obstacles = [], step = 18, margin = 6, maxShift = 72 } = {}) {
  const candidates = shiftCandidates(step, maxShift);
  const placed = [];
  for (const label of labels) {
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) {
      placed.push({ id: label.id, x: label.x, y: label.y, w: label.w, h: label.h, moved: false });
      continue;
    }
    let chosen = null;
    for (const { dx, dy } of candidates) {
      const rect = { x: label.x + dx * step, y: label.y + dy * step, w: label.w, h: label.h };
      if (!overlapsAny(rect, obstacles, margin) && !overlapsAny(rect, placed, margin)) {
        chosen = rect;
        break;
      }
    }
    const settled = chosen || { x: label.x, y: label.y, w: label.w, h: label.h };
    placed.push({ id: label.id, x: settled.x, y: settled.y, w: settled.w, h: settled.h, moved: Boolean(chosen) && (chosen.x !== label.x || chosen.y !== label.y) });
  }
  return placed;
}
