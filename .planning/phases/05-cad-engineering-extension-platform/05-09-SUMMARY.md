# 05-09 — Deterministic routing

**Status:** complete
**Requirements:** ENG-02 · **Threat:** T5-06 GREEN

## Why this comes first

Determinism is not a nicety here; it is the precondition for every other
routing claim. A router that answers differently for the same input turns
obstacle avoidance, junction stability and bounded rerouting into flaky
assertions — and a flaky assertion about geometry gets disabled, after which
nothing is checked at all.

## What shipped

`src/v100/routing.mjs`, restating the router as a pure function of
`{source, target, obstacles, options}`. No clock, no randomness, and nothing
that iterates an unordered collection into a decision.

Three tie-breaks, in order and declared: cheapest, then straightest, then the
lexicographically smallest point sequence. The last one exists because
"whichever the search reached first" is collection order wearing a disguise.

Obstacle relevance returns a **sorted index list**, so the caller's array order
cannot reach any decision. The determinism test reverses the obstacle array and
requires byte-identical output.

## The bounded-nudge property, and what it cost

Byte equality across runs is easy. The property that bites is bounded change
under a one-pixel move: without it, nudging a pump drags the whole run across
with it and the diff to the drawing is the size of the drawing.

The first implementation failed it — a nudge rewrote three segments — because
the cheapest route turns wherever a port happens to sit, and a port that moves
takes its turn column with it.

The first attempt at a fix was a cost: penalise turning off the drawing grid.
That was wrong in an instructive way. A cost is a *preference*, and it lost to
the turn penalty on exactly the paths that mattered; worse, whether it applied
depended on which turns fell inside the search and which fell in the appended
stub, which is not something a rule should depend on.

What shipped instead is a property: after the search, interior turns are
snapped onto the drawing grid, ports keep their exact positions, and a column
is snapped only if the whole path stays orthogonal and stays clear. It can tidy
a route and cannot break one. A nudge now rewrites **one** segment.

## Evidence

`node --test test/routing-determinism.test.mjs` — 2 tests, passing.
Also exercised by the geometry suite over the whole CAD corpus: every scene
routed with the obstacle list reversed produces byte-identical output.
