/**
 * Orthogonal routing that is deterministic, obstacle-aware, and honest when it
 * fails (ENG-02, T5-06, T5-07, T5-08).
 *
 * The router this replaces was already pure and already obstacle-aware. It had
 * one defect that mattered more than everything it got right: when no candidate
 * path was clean it returned `candidates[0]` — a path crossing an obstacle,
 * returned silently as though it were a route. A drawing that quietly runs a
 * pipe through a chiller is worse than one that refuses, because it reads as
 * engineering truth and somebody builds it.
 *
 * Three properties, in the order they depend on each other:
 *
 * 1. **Determinism.** The same scene routes to the same bytes. Without this,
 *    every assertion about geometry is a flake, and a flaky assertion about
 *    geometry gets disabled — after which nothing is checked. Nothing here
 *    iterates an unordered collection, reads a clock, or breaks a tie by
 *    anything but a declared rule.
 * 2. **Correct geometry.** No route enters an obstacle; a pair that cannot be
 *    routed says so; a route leaves on the side its port declares.
 * 3. **Bounded work.** A move recomputes the routes near it and no others, and
 *    the cheap answer is proven equal to the expensive one.
 *
 * The bounds here are stated in segments and routes, never in milliseconds. A
 * wall-clock assertion is a capacity claim; Phase 10 owns those, and a
 * millisecond budget measured on a CI runner tells you about the runner.
 */

/** How much a route must keep clear of plant, unless the scene says otherwise. */
export const DEFAULT_CLEARANCE = 20;

/** How far parallel runs are held apart. */
export const DEFAULT_SPACING = 12;

/**
 * How much longer than the direct distance a route may be before it is refused.
 *
 * A route that wanders four times the direct distance has not found a way
 * round; it has found a way through the rest of the building, and drawing it
 * would be less useful than saying no.
 */
export const DEFAULT_MAX_DETOUR = 4;

/** A turn costs this much, so a route with fewer corners wins a near tie. */
const TURN_PENALTY = 10;

/** Refuse rather than search forever: the grid is the search, so bound it. */
export const MAX_GRID_NODES = 4096;

/** How many times relevance may expand before the scene is called too complex. */
const MAX_RELEVANCE_ROUNDS = 8;

/** Every way a pair can fail to route. Closed. */
export const ROUTING_FAILURES = Object.freeze([
  "obstructed", "detour_exceeded", "scene_too_complex", "degenerate_endpoints",
]);

function option(options, name, fallback) {
  const value = options?.[name];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Where a port sits on its box, from the side it declares. */
export function anchorOf(box) {
  const x = Number(box?.x ?? 0);
  const y = Number(box?.y ?? 0);
  const width = Number(box?.width ?? 0);
  const height = Number(box?.height ?? 0);
  switch (box?.side) {
    case "left": return [x, y + height / 2];
    case "right": return [x + width, y + height / 2];
    case "top": return [x + width / 2, y];
    case "bottom": return [x + width / 2, y + height];
    default: return [x + width / 2, y + height / 2];
  }
}

/**
 * One step straight out from the port, before any turn.
 *
 * This is what makes "leaves on the declared side" true of the drawing rather
 * than of the data: the first segment is perpendicular to the box edge, so a
 * reader can see which side the connection is on without measuring.
 */
function stubOf(box, clearance) {
  const [x, y] = anchorOf(box);
  switch (box?.side) {
    case "left": return [x - clearance, y];
    case "right": return [x + clearance, y];
    case "top": return [x, y - clearance];
    case "bottom": return [x, y + clearance];
    default: return [x, y];
  }
}

function inflate(obstacle, clearance) {
  return {
    id: obstacle?.id ?? null,
    left: Number(obstacle?.x ?? 0) - clearance,
    top: Number(obstacle?.y ?? 0) - clearance,
    right: Number(obstacle?.x ?? 0) + Number(obstacle?.width ?? 0) + clearance,
    bottom: Number(obstacle?.y ?? 0) + Number(obstacle?.height ?? 0) + clearance,
  };
}

function boxesOverlap(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * The obstacles that can affect this route, and nothing else.
 *
 * This is what makes rerouting incremental *and* equal to a full recompute. A
 * route is computed against the obstacles near it, found by growing a region
 * until it stops picking up new ones. Moving a pump forty metres away then
 * cannot change a route here — not because the router chose to skip it, but
 * because it was never an input.
 */
export function relevantObstacles(region, obstacles, clearance) {
  const inflated = obstacles.map((obstacle) => inflate(obstacle, clearance));
  let box = { ...region };
  const chosen = new Set();
  for (let round = 0; round < MAX_RELEVANCE_ROUNDS; round += 1) {
    let grew = false;
    for (let index = 0; index < inflated.length; index += 1) {
      if (chosen.has(index)) continue;
      if (!boxesOverlap(box, inflated[index])) continue;
      chosen.add(index);
      grew = true;
      box = {
        left: Math.min(box.left, inflated[index].left),
        top: Math.min(box.top, inflated[index].top),
        right: Math.max(box.right, inflated[index].right),
        bottom: Math.max(box.bottom, inflated[index].bottom),
      };
    }
    if (!grew) break;
  }
  // Index order, not insertion order: the caller's array order must not reach
  // any decision, and a sorted index list is the cheapest way to say so.
  return [...chosen].sort((a, b) => a - b).map((index) => inflated[index]);
}

/** Whether a straight segment passes through a box's interior. */
function enters(ax, ay, bx, by, box) {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  return maxX > box.left && minX < box.right && maxY > box.top && minY < box.bottom;
}

function blocked(ax, ay, bx, by, boxes) {
  for (const box of boxes) if (enters(ax, ay, bx, by, box)) return true;
  return false;
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function refusal(reason, detail = null) {
  return Object.freeze({ routable: false, reason, detail, points: [], length: 0, turns: 0 });
}

function manhattan([ax, ay], [bx, by]) {
  return Math.abs(bx - ax) + Math.abs(by - ay);
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += manhattan(points[index - 1], points[index]);
  return total;
}

function turnsIn(points) {
  let turns = 0;
  for (let index = 2; index < points.length; index += 1) {
    const horizontalBefore = points[index - 1][1] === points[index - 2][1];
    const horizontalAfter = points[index][1] === points[index - 1][1];
    if (horizontalBefore !== horizontalAfter) turns += 1;
  }
  return turns;
}

function dedupe(points) {
  const out = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  // Collapse a vertex that turns through nothing: three collinear points are
  // one segment, and leaving the middle one in makes two routes that draw the
  // same line compare unequal.
  //
  // Only when the middle point lies *between* the other two. A collinear
  // vertex that doubles back is a spur, not a redundant vertex, and collapsing
  // one silently deleted the stub that makes a route leave on the side its
  // port declares.
  const straightened = [];
  for (const point of out) {
    const count = straightened.length;
    if (count >= 2) {
      const [ax, ay] = straightened[count - 2];
      const [bx, by] = straightened[count - 1];
      const between = (a, b, c) => (b >= Math.min(a, c) && b <= Math.max(a, c));
      const sameRow = ay === by && by === point[1] && between(ax, bx, point[0]);
      const sameColumn = ax === bx && bx === point[0] && between(ay, by, point[1]);
      if (sameRow || sameColumn) {
        straightened[count - 1] = point;
        continue;
      }
    }
    straightened.push(point);
  }
  return straightened;
}

/** A path's comparison key: cheapest, then straightest, then lexicographic. */
function pathKey(points) {
  return points.map(([x, y]) => `${x},${y}`).join("|");
}

function better(candidate, incumbent) {
  if (!incumbent) return true;
  if (candidate.cost !== incumbent.cost) return candidate.cost < incumbent.cost;
  if (candidate.turns !== incumbent.turns) return candidate.turns < incumbent.turns;
  // The last tie-break is a declared rule rather than whichever arrived first,
  // because "whichever arrived first" is the collection order in disguise.
  return pathKey(candidate.points) < pathKey(incumbent.points);
}

/**
 * Search an orthogonal grid built from the endpoints and the obstacle bounds.
 *
 * The grid lines are the only places a route may turn, and they are the port
 * stubs plus each obstacle's cleared edges. That is enough: a shortest
 * orthogonal path around axis-aligned rectangles always exists on exactly those
 * lines, and restricting turns to them is what makes two runs agree.
 */
function search(start, goal, boxes, limits) {
  // The stub exists so the first segment points away from the port. A search
  // that immediately turns back through it has spent the stub for nothing, and
  // the drawing no longer shows which side the connection is on.
  const forbiddenFirst = limits.leaving ? [-limits.leaving[0], -limits.leaving[1]] : null;
  const forbiddenLast = limits.entering ?? null;
  const xs = unique([start[0], goal[0], ...boxes.flatMap((box) => [box.left, box.right])]);
  const ys = unique([start[1], goal[1], ...boxes.flatMap((box) => [box.top, box.bottom])]);
  if (xs.length * ys.length > MAX_GRID_NODES) return { failure: "scene_too_complex" };


  const xIndex = new Map(xs.map((value, index) => [value, index]));
  const yIndex = new Map(ys.map((value, index) => [value, index]));
  const startNode = [xIndex.get(start[0]), yIndex.get(start[1])];
  const goalNode = [xIndex.get(goal[0]), yIndex.get(goal[1])];

  const key = (cx, cy) => `${cx}:${cy}`;
  const best = new Map();
  let frontier = [{
    x: startNode[0], y: startNode[1], cost: 0, turns: 0, points: [[start[0], start[1]]],
  }];
  best.set(key(startNode[0], startNode[1]), frontier[0]);
  let goalState = null;

  // A plain relaxation sweep rather than a priority queue: the grid is at most
  // MAX_GRID_NODES nodes, and a queue would need its own tie-break to stay
  // deterministic, which is one more place for order to decide something.
  for (let round = 0; round < xs.length * ys.length + 2 && frontier.length > 0; round += 1) {
    const next = [];
    for (const state of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = state.x + dx;
        const ny = state.y + dy;
        if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
        const from = [xs[state.x], ys[state.y]];
        const to = [xs[nx], ys[ny]];
        if (blocked(from[0], from[1], to[0], to[1], boxes)) continue;
        const heading = [Math.sign(to[0] - from[0]), Math.sign(to[1] - from[1])];
        if (state.points.length === 1 && forbiddenFirst
          && heading[0] === forbiddenFirst[0] && heading[1] === forbiddenFirst[1]) continue;
        if (nx === goalNode[0] && ny === goalNode[1] && forbiddenLast
          && heading[0] === forbiddenLast[0] && heading[1] === forbiddenLast[1]) continue;
        const points = [...state.points, to];
        const turns = turnsIn(points);
        const candidate = {
          x: nx, y: ny,
          cost: state.cost + manhattan(from, to) + (turns - state.turns) * TURN_PENALTY,
          turns,
          points,
        };
        if (candidate.cost > limits.maxCost) continue;
        const at = key(nx, ny);
        if (!better(candidate, best.get(at))) continue;
        best.set(at, candidate);
        next.push(candidate);
      }
    }
    frontier = next;
    const arrived = best.get(key(goalNode[0], goalNode[1]));
    if (arrived && better(arrived, goalState)) goalState = arrived;
  }

  if (!goalState) return { failure: "obstructed" };
  return { points: goalState.points };
}

/** Whether a polyline is still orthogonal and still clear of everything. */
function clean(points, boxes) {
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    if (ax !== bx && ay !== by) return false;
    if (blocked(ax, ay, bx, by, boxes)) return false;
  }
  return true;
}

/**
 * Pull the interior turns onto the drawing grid, leaving the ports where they
 * are.
 *
 * This is the rule every drawing office already follows, and it is here for a
 * reason beyond tidiness. Without it the cheapest route turns wherever a port
 * happens to sit, so nudging a pump by one pixel drags the whole run across
 * with it and the diff to the drawing is the size of the drawing. With it, a
 * nudge moves the last segment and nothing else — which is the difference
 * between a diagram somebody can review and one they cannot.
 *
 * A column is snapped only if the whole path stays orthogonal and stays clear
 * afterwards, so this can tidy a route and can never break one.
 */
function snapInterior(points, boxes, grid) {
  if (points.length < 3 || !(grid > 0)) return points;
  const originals = points.map((point) => [...point]);
  let current = points.map((point) => [...point]);
  for (const axis of [0, 1]) {
    const values = unique(originals.slice(1, -1).map((point) => point[axis]));
    for (const value of values) {
      const snapped = Math.round(value / grid) * grid;
      if (snapped === value) continue;
      const candidate = current.map((point, index) => {
        if (index === 0 || index === current.length - 1) return point;
        if (originals[index][axis] !== value) return point;
        return axis === 0 ? [snapped, point[1]] : [point[0], snapped];
      });
      if (clean(candidate, boxes)) current = candidate;
    }
  }
  return current;
}

/**
 * Route one connection.
 *
 * Returns a refusal rather than a path when there is no clean way through, or
 * when the only way through is long enough that drawing it would mislead.
 */
export function routePath({ source, target, obstacles = [], options = {} } = {}) {
  const clearance = option(options, "clearance", DEFAULT_CLEARANCE);
  const maxDetour = option(options, "maxDetour", DEFAULT_MAX_DETOUR);

  const startAnchor = anchorOf(source);
  const goalAnchor = anchorOf(target);
  const startStub = stubOf(source, clearance);
  const goalStub = stubOf(target, clearance);
  if (!Number.isFinite(startAnchor[0]) || !Number.isFinite(goalAnchor[0])) {
    return refusal("degenerate_endpoints");
  }

  const region = {
    left: Math.min(startStub[0], goalStub[0]),
    right: Math.max(startStub[0], goalStub[0]),
    top: Math.min(startStub[1], goalStub[1]),
    bottom: Math.max(startStub[1], goalStub[1]),
  };
  const boxes = relevantObstacles(region, obstacles, clearance);

  const direct = manhattan(startAnchor, goalAnchor);
  const grid = option(options, "grid", clearance);
  const outward = {
    left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1],
  };
  const limits = {
    grid: grid > 0 ? grid : 1,
    leaving: outward[source?.side] ?? null,
    entering: outward[target?.side] ?? null,
    maxCost: (direct + clearance * 4) * (1 + maxDetour) + TURN_PENALTY * 64,
  };
  const found = search(startStub, goalStub, boxes, limits);
  if (found.failure) return refusal(found.failure);

  const points = dedupe(
    snapInterior(dedupe([startAnchor, ...found.points, goalAnchor]), boxes, grid),
  );
  const length = pathLength(points);
  if (length > direct * (1 + maxDetour) + clearance * 4) {
    // Honest refusal beats a drawn detour: a route this long has not found a
    // way round, it has found a way through the rest of the building.
    return refusal("detour_exceeded", { length, direct, limit: direct * (1 + maxDetour) });
  }
  return Object.freeze({
    routable: true, reason: null, detail: null,
    points, length, turns: turnsIn(points),
  });
}

/* -------------------------------------------------------------------------
 * Networks: junctions, crossings and parallel spacing.
 * ---------------------------------------------------------------------- */

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * How far two routes run together at their shared end.
 *
 * Two connections into one header legitimately share their approach — that is a
 * trunk, and drawing it twice would be the mistake. Everything else that
 * overlaps is two routes hiding inside each other, which is what `spacing`
 * exists to prevent. Telling the two apart is the whole job here.
 */
function sharedTrunk(first, second) {
  const a = [...first].reverse();
  const b = [...second].reverse();
  if (a.length === 0 || b.length === 0 || !samePoint(a[0], b[0])) return [];
  const trunk = [a[0]];
  let ai = 0;
  let bi = 0;
  let cursorA = a[0];
  let cursorB = b[0];
  while (ai + 1 < a.length && bi + 1 < b.length) {
    const nextA = a[ai + 1];
    const nextB = b[bi + 1];
    const dirA = [Math.sign(nextA[0] - cursorA[0]), Math.sign(nextA[1] - cursorA[1])];
    const dirB = [Math.sign(nextB[0] - cursorB[0]), Math.sign(nextB[1] - cursorB[1])];
    if (dirA[0] !== dirB[0] || dirA[1] !== dirB[1]) break;
    const stepA = manhattan(cursorA, nextA);
    const stepB = manhattan(cursorB, nextB);
    const step = Math.min(stepA, stepB);
    const advanced = [cursorA[0] + dirA[0] * step, cursorA[1] + dirA[1] * step];
    trunk.push(advanced);
    cursorA = advanced;
    cursorB = advanced;
    if (step === stepA) ai += 1;
    if (step === stepB) bi += 1;
  }
  return trunk.reverse();
}

function segmentsOf(points) {
  const out = [];
  for (let index = 1; index < points.length; index += 1) {
    out.push([points[index - 1], points[index]]);
  }
  return out;
}

function overlapSpan(first, second) {
  const [[ax0, ay0], [ax1, ay1]] = first;
  const [[bx0, by0], [bx1, by1]] = second;
  if (ay0 === ay1 && by0 === by1 && ay0 === by0) {
    const low = Math.max(Math.min(ax0, ax1), Math.min(bx0, bx1));
    const high = Math.min(Math.max(ax0, ax1), Math.max(bx0, bx1));
    return high > low ? { axis: "y", at: ay0, from: low, to: high } : null;
  }
  if (ax0 === ax1 && bx0 === bx1 && ax0 === bx0) {
    const low = Math.max(Math.min(ay0, ay1), Math.min(by0, by1));
    const high = Math.min(Math.max(ay0, ay1), Math.max(by0, by1));
    return high > low ? { axis: "x", at: ax0, from: low, to: high } : null;
  }
  return null;
}

function withinTrunk(span, trunk) {
  for (const [start, end] of segmentsOf(trunk)) {
    if (span.axis === "y" && start[1] === span.at && end[1] === span.at) {
      const low = Math.min(start[0], end[0]);
      const high = Math.max(start[0], end[0]);
      if (span.from >= low && span.to <= high) return true;
    }
    if (span.axis === "x" && start[0] === span.at && end[0] === span.at) {
      const low = Math.min(start[1], end[1]);
      const high = Math.max(start[1], end[1]);
      if (span.from >= low && span.to <= high) return true;
    }
  }
  return false;
}

function crossingPoint(first, second) {
  const [[ax0, ay0], [ax1, ay1]] = first;
  const [[bx0, by0], [bx1, by1]] = second;
  const aHorizontal = ay0 === ay1;
  const bHorizontal = by0 === by1;
  if (aHorizontal === bHorizontal) return null;
  const [h, v] = aHorizontal ? [first, second] : [second, first];
  const y = h[0][1];
  const x = v[0][0];
  const withinH = x > Math.min(h[0][0], h[1][0]) && x < Math.max(h[0][0], h[1][0]);
  const withinV = y > Math.min(v[0][1], v[1][1]) && y < Math.max(v[0][1], v[1][1]);
  return withinH && withinV ? [x, y] : null;
}

/** The first non-trunk overlap in the network, scanned in route-id order. */
function firstOverlap(routed, drawn) {
  for (let index = 1; index < drawn.length; index += 1) {
    const mine = routed[drawn[index].id].points;
    for (let other = 0; other < index; other += 1) {
      const theirs = routed[drawn[other].id].points;
      const trunk = sharedTrunk(mine, theirs);
      for (const a of segmentsOf(mine)) {
        for (const b of segmentsOf(theirs)) {
          const span = overlapSpan(a, b);
          if (span && !withinTrunk(span, trunk)) {
            return { later: drawn[index].id, earlier: drawn[other].id, span };
          }
        }
      }
    }
  }
  return null;
}

/**
 * The lanes a run could be shifted into, keeping its ports where they are.
 *
 * Both directions, in a declared order, and only those that stay orthogonal and
 * stay clear: a route is never pushed into an obstacle to tidy a drawing. The
 * caller chooses between them by whether the move actually helps, because a
 * shift that merely trades a vertical overlap for a horizontal one has moved a
 * problem rather than solved it — which is exactly what happened to the two
 * diagonals in the corpus before this returned candidates instead of a verdict.
 */
function laneCandidates(points, span, spacing, boxes) {
  const axis = span.axis === "x" ? 0 : 1;
  const candidates = [];
  for (const direction of [1, -1]) {
    const target = span.at + spacing * direction;
    const candidate = points.map((point, index) => {
      if (index === 0 || index === points.length - 1) return point;
      if (point[axis] !== span.at) return point;
      return axis === 0 ? [target, point[1]] : [point[0], target];
    });
    if (candidate.some((point, index) => point !== points[index]) && clean(candidate, boxes)) {
      candidates.push(dedupe(candidate));
    }
  }
  return candidates;
}

/**
 * Displace only the overlapping stretch of a run, and bring it back.
 *
 * `laneCandidates` shifts a whole lane, which moves both of a run's ends
 * together. That is enough whenever one route has somewhere to go, and it is
 * not enough for the pair Phase 5 recorded as unresolvable: two diagonals in a
 * closed box, each owning the near end of one row and the far end of the other,
 * so whichever lane you shift you fix one end and break the other. No ordering
 * of turn columns clears both — the phase's own note says the resolution needs
 * a jog rather than an offset. This is that jog.
 *
 * It replaces the overlapping segment with five: run to the start of the
 * overlap, step across by the required spacing, run parallel through it, step
 * back, continue. Both endpoints stay exactly where they were, which is the
 * whole point — an endpoint is a port, and a router that moves ports is drawing
 * a different plant.
 *
 * Two extra bends per jog is the cost, so it is tried *after* a plain lane
 * shift rather than instead of one: a route that can be moved cleanly should
 * be, because the reader counts corners.
 */
function jogCandidates(points, span, spacing, boxes) {
  const axis = span.axis === "x" ? 0 : 1;
  const other = axis === 0 ? 1 : 0;
  const candidates = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    // The segment carrying the overlap: on the lane, and running along it.
    if (start[axis] !== span.at || end[axis] !== span.at) continue;
    const lo = Math.min(start[other], end[other]);
    const hi = Math.max(start[other], end[other]);
    if (span.from < lo || span.to > hi) continue;

    // The two corners, in the order this segment is travelled.
    const descending = start[other] > end[other];
    const first = descending ? span.to : span.from;
    const second = descending ? span.from : span.to;

    for (const direction of [1, -1]) {
      const shifted = span.at + spacing * direction;
      const at = (along, lane) => (axis === 0 ? [lane, along] : [along, lane]);
      const candidate = [
        ...points.slice(0, index + 1),
        at(first, span.at),
        at(first, shifted),
        at(second, shifted),
        at(second, span.at),
        ...points.slice(index + 1),
      ];
      if (clean(candidate, boxes)) candidates.push(dedupe(candidate));
    }
  }
  return candidates;
}

/**
 * What the network still gets wrong, as a pair a move can be judged against.
 *
 * A count alone is not enough. A jog can trade one long overlap for one short
 * one -- two diagonals running together for two hundred units become two
 * diagonals sharing twelve where they turn -- and by count that is a draw, so a
 * resolver comparing counts declines a move that visibly improves the drawing.
 *
 * Length is the tie-break, and it is the right one: a reader sees the *extent*
 * of two runs drawn on top of each other, not how many segment pairs the
 * geometry decomposes into. Comparing the pair lexicographically keeps count
 * primary, so a move is never accepted for shortening one overlap while
 * creating another.
 */
function overlapCost(routed, drawn) {
  let count = 0;
  let length = 0;
  for (let index = 1; index < drawn.length; index += 1) {
    const mine = routed[drawn[index].id].points;
    for (let other = 0; other < index; other += 1) {
      const theirs = routed[drawn[other].id].points;
      const trunk = sharedTrunk(mine, theirs);
      for (const a of segmentsOf(mine)) {
        for (const b of segmentsOf(theirs)) {
          const span = overlapSpan(a, b);
          if (span && !withinTrunk(span, trunk)) {
            count += 1;
            length += Math.abs(span.to - span.from);
          }
        }
      }
    }
  }
  return { count, length };
}

/** True when `next` is a strictly better drawing than `before`. */
function improves(next, before) {
  if (next.count !== before.count) return next.count < before.count;
  return next.length < before.length;
}

/**
 * Route a whole network, and say where routes meet and where they merely cross.
 *
 * A junction and a crossing look identical on paper unless the drawing
 * distinguishes them, and a reader who cannot tell them apart cannot read the
 * diagram. So they are separate collections, both derived from the routed
 * geometry rather than declared alongside it.
 */
export function routeNetwork({ routes = [], obstacles = [], options = {} } = {}) {
  const spacing = option(options, "spacing", DEFAULT_SPACING);
  // Sorted by id, so the caller's array order reaches no decision. Two networks
  // holding the same routes in different order must produce the same drawing.
  const ordered = [...routes].sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));

  const clearance = option(options, "clearance", DEFAULT_CLEARANCE);
  const routed = {};
  const failures = [];
  for (const route of ordered) {
    // A route's own equipment is not an obstacle to it. Without this a network
    // routed from one shared list refuses every route in it, for the reason
    // that each one starts inside something.
    const excluded = new Set(route.exclude ?? []);
    const result = routePath({
      source: route.source,
      target: route.target,
      obstacles: obstacles.filter((obstacle) => !excluded.has(obstacle.id)),
      options,
    });
    routed[route.id] = result;
    if (!result.routable) failures.push({ id: route.id, reason: result.reason });
  }

  const drawn = ordered.filter((route) => routed[route.id].routable);

  // Separate parallel runs. Whichever route can be moved cleanly is moved --
  // the later one by preference, so the drawing is a function of the network
  // rather than of who happened to be routed first, but the earlier one when
  // the later one has nowhere to go. Trying only the later route left two
  // diagonals overlapping for twelve units at the one place neither could move.
  //
  // A pair that cannot be separated keeps its geometry and is reported below.
  // Overlapping silently is the failure this exists to prevent; pushing a route
  // into a wall to avoid reporting it would be a worse one.
  const boxesFor = new Map(drawn.map((route) => {
    const excluded = new Set(route.exclude ?? []);
    const points = routed[route.id].points;
    return [route.id, relevantObstacles(
      {
        left: Math.min(...points.map((point) => point[0])),
        right: Math.max(...points.map((point) => point[0])),
        top: Math.min(...points.map((point) => point[1])),
        bottom: Math.max(...points.map((point) => point[1])),
      },
      obstacles.filter((obstacle) => !excluded.has(obstacle.id)),
      clearance,
    )];
  }));

  for (let attempt = 0; attempt < drawn.length * 4; attempt += 1) {
    const conflict = firstOverlap(routed, drawn);
    if (!conflict) break;
    const before = overlapCost(routed, drawn);
    let resolved = false;
    for (const id of [conflict.later, conflict.earlier]) {
      // A plain lane shift first, a jog only when no shift helps. A jog costs
      // two bends, and a drawing with fewer corners is one an engineer reads
      // faster; paying for them where a shift would have done is a bad trade.
      const moves = [
        ...laneCandidates(routed[id].points, conflict.span, spacing, boxesFor.get(id)),
        ...jogCandidates(routed[id].points, conflict.span, spacing, boxesFor.get(id)),
      ];
      for (const moved of moves) {
        const original = routed[id];
        routed[id] = { ...original, points: moved, length: pathLength(moved) };
        if (improves(overlapCost(routed, drawn), before)) {
          resolved = true;
          break;
        }
        routed[id] = original;
      }
      if (resolved) break;
    }
    if (!resolved) break;
  }

  const vertexCounts = new Map();
  for (const route of drawn) {
    for (const point of routed[route.id].points) {
      const at = `${point[0]},${point[1]}`;
      if (!vertexCounts.has(at)) vertexCounts.set(at, new Set());
      vertexCounts.get(at).add(String(route.id));
    }
  }
  const junctions = [...vertexCounts.entries()]
    .filter(([, ids]) => ids.size >= 3)
    .map(([at, ids]) => ({ at: at.split(",").map(Number), routes: [...ids].sort() }))
    .sort((a, b) => (a.at[0] - b.at[0]) || (a.at[1] - b.at[1]));

  const crossings = [];
  const spacingViolations = [];
  for (let i = 0; i < drawn.length; i += 1) {
    for (let j = i + 1; j < drawn.length; j += 1) {
      const first = routed[drawn[i].id].points;
      const second = routed[drawn[j].id].points;
      const trunk = sharedTrunk(first, second);
      for (const a of segmentsOf(first)) {
        for (const b of segmentsOf(second)) {
          const span = overlapSpan(a, b);
          if (span) {
            if (!withinTrunk(span, trunk)) {
              spacingViolations.push({
                routes: [String(drawn[i].id), String(drawn[j].id)].sort(),
                axis: span.axis, at: span.at, from: span.from, to: span.to,
                required_spacing: spacing,
              });
            }
            continue;
          }
          const crossing = crossingPoint(a, b);
          if (crossing) {
            crossings.push({
              at: crossing,
              routes: [String(drawn[i].id), String(drawn[j].id)].sort(),
            });
          }
        }
      }
    }
  }
  crossings.sort((a, b) => (a.at[0] - b.at[0]) || (a.at[1] - b.at[1])
    || (a.routes[0] < b.routes[0] ? -1 : 1));
  spacingViolations.sort((a, b) => (a.at - b.at) || (a.from - b.from)
    || (a.routes[0] < b.routes[0] ? -1 : 1));

  return Object.freeze({
    routes: routed,
    junctions,
    crossings,
    spacing_violations: spacingViolations,
    failures,
  });
}

/* -------------------------------------------------------------------------
 * Incremental rerouting (T5-08).
 * ---------------------------------------------------------------------- */

/**
 * A router that keeps its scene and recomputes only what a change reached.
 *
 * The full-sweep reroute this replaces walked every path in the view on every
 * call, and the CAD dialog's "recalculate all auto-routes" did the same. On a
 * diagram of any size that is the freeze the roadmap names.
 *
 * The incremental result is not an approximation of the full one. A route is
 * computed against the obstacles relevant to it, and a move that does not
 * change any route's relevant set cannot change that route — so recomputing
 * only the reached routes gives the same answer as recomputing all of them, by
 * construction rather than by luck. The test proves it anyway.
 */
export function createRouter({ routes = [], obstacles = [], options = {} } = {}) {
  const clearance = option(options, "clearance", DEFAULT_CLEARANCE);
  const scene = {
    routes: [...routes].sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1)),
    obstacles: obstacles.map((obstacle) => ({ ...obstacle })),
  };
  const computed = new Map();

  const regionOf = (route) => {
    const start = stubOf(route.source, clearance);
    const goal = stubOf(route.target, clearance);
    return {
      left: Math.min(start[0], goal[0]), right: Math.max(start[0], goal[0]),
      top: Math.min(start[1], goal[1]), bottom: Math.max(start[1], goal[1]),
    };
  };

  const routeOne = (route) => routePath({
    source: route.source, target: route.target, obstacles: scene.obstacles, options,
  });

  const snapshot = () => Object.fromEntries(
    scene.routes.map((route) => [route.id, computed.get(route.id)]),
  );

  /** Whether a given obstacle rectangle is an input to a given route. */
  const reaches = (route, rectangles) => {
    const relevant = relevantObstacles(regionOf(route), scene.obstacles, clearance);
    const region = {
      left: Math.min(regionOf(route).left, ...relevant.map((box) => box.left)),
      right: Math.max(regionOf(route).right, ...relevant.map((box) => box.right)),
      top: Math.min(regionOf(route).top, ...relevant.map((box) => box.top)),
      bottom: Math.max(regionOf(route).bottom, ...relevant.map((box) => box.bottom)),
    };
    return rectangles.some((rectangle) => boxesOverlap(region, rectangle));
  };

  return {
    get obstacles() { return scene.obstacles.map((obstacle) => ({ ...obstacle })); },

    routeAll() {
      for (const route of scene.routes) computed.set(route.id, routeOne(route));
      return { routes: snapshot(), recomputed: scene.routes.map((route) => route.id) };
    },

    /**
     * Move one obstacle and recompute the routes it reached, before or after.
     *
     * Both positions matter: a route the obstacle has just left is as wrong as
     * one it has just arrived in, and recomputing only the destination is the
     * bug that leaves a stale detour around nothing.
     */
    moveObstacle(id, position) {
      const index = scene.obstacles.findIndex((obstacle) => obstacle.id === id);
      if (index < 0) throw new Error(`no such obstacle: ${String(id)}`);
      const before = inflate(scene.obstacles[index], clearance);
      scene.obstacles[index] = { ...scene.obstacles[index], ...position };
      const after = inflate(scene.obstacles[index], clearance);

      const recomputed = [];
      for (const route of scene.routes) {
        if (!computed.has(route.id)) {
          computed.set(route.id, routeOne(route));
          recomputed.push(route.id);
          continue;
        }
        if (!reaches(route, [before, after])) continue;
        computed.set(route.id, routeOne(route));
        recomputed.push(route.id);
      }
      return { routes: snapshot(), recomputed };
    },
  };
}
