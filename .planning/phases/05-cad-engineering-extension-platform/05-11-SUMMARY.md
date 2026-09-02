# 05-11 — Rerouting that is incremental because it cannot be otherwise

**Status:** Task 1 complete. Task 2 (retiring the legacy entry points) is
deferred to 05-14, where the designer surfaces that replace them land.
**Requirements:** ENG-02 · **Threat:** T5-08 partially GREEN

## What shipped

`createRouter(scene)` with `routeAll()` and `moveObstacle(id, position)`,
returning the routes and the ids it recomputed.

## The decision that makes this true rather than fast

The obvious way to make rerouting incremental is to skip routes that look far
away. That produces an optimisation whose correctness has to be argued, and the
argument is usually wrong at the edges.

What ships instead makes it structural. A route is computed against the
obstacles **relevant** to it — found by growing a region from its endpoints
until it stops picking up new obstacles, transitively, so a chain of obstacles
is not cut in half. A move that does not change any route's relevant set cannot
change that route, because the moved obstacle was never an input to it. So
recomputing only the reached routes gives the same answer as recomputing all of
them by construction, not by luck.

The test proves it anyway: after a move, the incremental result is compared
byte for byte against a fresh router built on the modified scene.

**Both positions matter.** A route the obstacle has just *left* is as wrong as
one it has just arrived in. Recomputing only the destination is the bug that
leaves a stale detour around nothing, and there is a test for it.

## Bounds

Stated in routes recomputed, never in milliseconds. A wall-clock assertion is a
capacity claim, Phase 10 owns those, and a millisecond budget measured on a CI
runner tells you about the runner. Over forty routes, one move recomputes one.

## Evidence

`node --test test/routing-incremental.test.mjs` — 8 tests, passing.

- Forty routes, one obstacle moved, one route recomputed, and the result equal
  to a full recompute of the same scene.
- A distant move recomputes only its own neighbour.
- Relevance is order-independent and grows transitively.
- Moving an obstacle that is not in the scene raises rather than silently doing
  nothing.
- The router hands back copies of its scene, so a caller cannot edit it from
  underneath.

## What is not done

Task 2 — replacing the legacy `autoRoute`/`reroute` in `part02` and the
full-sweep loop in `showCAD`, keeping the old entry points reachable so a test
proves supersession rather than deletion — belongs with the designer surfaces
in 05-14. Retiring an entry point before its replacement ships would leave the
editor with neither.
