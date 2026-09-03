# 05-10 — Routes that go around plant instead of through it

**Status:** complete, with one limitation recorded below
**Requirements:** ENG-02 · **Threat:** T5-07 GREEN

## The defect this closes

The previous router was obstacle-aware and had one flaw that outweighed
everything it got right: when no candidate path was clean it returned
`candidates[0]` — a path crossing an obstacle, handed back silently as though
it were a route. A drawing that quietly runs a pipe through a chiller is worse
than one that refuses, because it reads as engineering truth and somebody
builds it.

## What shipped

**A grid search over the cleared obstacle edges.** Turns happen on the port
stubs and on each obstacle's cleared edges, which is enough — a shortest
orthogonal path around axis-aligned rectangles always exists on exactly those
lines — and restricting turns to them is what makes two runs agree.

**Explicit failure.** `routePath` returns `{routable: false, reason}` with a
reason from a closed set: `obstructed`, `detour_exceeded`, `scene_too_complex`,
`degenerate_endpoints`. A refusal carries no points at all, so a caller cannot
draw one by accident.

**A detour bound.** A route four times longer than the direct distance has not
found a way round; it has found a way through the rest of the building, and
drawing it would be less useful than saying no.

**Declared sides, honoured in the drawing.** The first segment is perpendicular
to the box edge, so a reader can see which side a connection is on without
measuring. Two bugs were found making this true:

- The straightening pass collapsed any three collinear points into one segment,
  which silently deleted the stub whenever the route doubled back over it. A
  collinear vertex that doubles back is a *spur*, not a redundant vertex.
  Straightening now requires the middle point to lie between the other two.
- Nothing stopped the search's first move from reversing straight back through
  the stub, spending it for nothing. The first move out of a port and the last
  move into one are now direction-constrained.

**Junctions and crossings as separate collections**, both derived from the
routed geometry rather than declared alongside it. A junction and a crossing
look identical on paper unless the drawing distinguishes them, and a reader who
cannot tell them apart cannot read the diagram.

**Trunk detection.** Two connections into one header legitimately share their
approach; drawing that twice would be the mistake. `sharedTrunk` walks both
polylines backwards from their common end, stepping by the shorter next vertex
and stopping when the directions diverge. Overlap inside the trunk is a trunk;
overlap outside it is two routes hiding inside each other.

**Lane separation**, which moves whichever route can be moved cleanly — the
later one by preference so the drawing is a function of the network rather than
of who was routed first, the earlier one when the later has nowhere to go — and
accepts an offset only if it strictly reduces the number of overlaps. That last
condition was added after a shift traded a vertical overlap for a horizontal
one and called it progress.

## The limitation, stated plainly

One pair in the corpus cannot be separated by any lane offset: the two
diagonals in the closed box. Both have a port at y=30 and a port at y=230, so
whichever turns first owns the near end of one row and the far end of the
other; no ordering of the two turn columns clears both rows. Resolving it needs
a **jog** — an extra pair of turns — rather than an offset, and that is not
implemented.

What ships instead: the pair keeps its geometry and is **reported** in
`spacing_violations`, naming both routes, the axis, the extent and the required
spacing. Reporting leaves the engineer a diagram they can act on. Drawing one
run inside the other, or pushing a route into a wall to avoid reporting it,
would both be worse. The routing test asserts this specific pair is the only
unresolved one and that the corridor pair — the fixture the spacing rule was
written for — is separated cleanly.

## Evidence

`node --test test/routing-geometry.test.mjs` — 8 tests, passing.

- Every one of the eleven CAD corpus scenes routes without entering any of the
  other twenty-two pieces of equipment, including the four that defeat an
  elbow-through-the-midpoint router.
- Every route leaves and enters on the side its port declares, checked as a
  direction against the outward normal rather than by eye.
- Every scene routed with its obstacle list reversed produces identical output.
- Three routes into one header make a junction, and adding an unrelated route
  does not move it.
- An unroutable pair returns a declared reason and no points.
