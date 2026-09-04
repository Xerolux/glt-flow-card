# Symbol catalogue and routing

What the catalogue contains, what the router guarantees, and where every number
on this page comes from.

## The published catalogue

**600 variants** from **100 base symbols** in **6 styles**, across 8 trades. Every symbol belongs to a main group (trade) and a subgroup (e.g. Heating → Heat pumps, Air handling → Heat recovery); the designer's symbol browser shows and searches both levels.

That number is not a claim, it is a measured quantity. `catalog-evidence.json`
is produced by actually drawing every variant and hashing the result; the
generator refuses to write the file at all if a symbol draws nothing, two base
symbols produce identical geometry, or two styles carry identical tokens. A test
requires the number in this documentation and the number in the evidence to be
the same number.

A cross product of two axes is only a set of distinct variants if both axes are
distinct. That is exactly what is checked — and exactly what used to be wrong:
three base symbols (`ahu`, `wallbox`, `room_sensor`) drew nothing at all and
were still counted, and nine more shared another symbol's drawing.

| Trade | Base symbols | Variants |
|---|---:|---:|
| Heating | 15 | 90 |
| Hydraulics | 21 | 126 |
| Air handling | 16 | 96 |
| Refrigeration | 8 | 48 |
| Energy | 9 | 54 |
| Instrumentation | 10 | 60 |
| Electrical | 11 | 66 |
| Fire safety | 10 | 60 |

Electrical covers distribution, protection and isolation (low-voltage
switchgear, busbar, sub-distribution board, transformer, UPS, generator set,
circuit breaker, RCD, surge arrester, isolator switch). Fire safety covers
detection, suppression and compartmentation (fire alarm panel, smoke and heat
detectors, manual call point, aspirating detector, sprinkler head, sprinkler
valve station, extinguishing system, fire barrier, fire door).

## Typed ports

A port carries `medium`, `direction`, `side`, `kind` (`process`, `signal`,
`power`) and `multiplicity` (`one`, `many`). Until version 1.1 **nothing**
checked compatibility, so every impossible connection was drawn.

A rejected connection names its reason from a closed set:

| Reason | Meaning |
|---|---|
| `kind_mismatch` | Process, signal and power cannot be mixed |
| `medium_mismatch` | The two ports carry different media |
| `direction_conflict` | Both ports point the same way |
| `multiplicity_exceeded` | The port already has the one connection it allows |
| `self_connection` | A port cannot connect to itself |
| `duplicate_connection` | These two ports are already connected |

The order of the checks is deliberate: the coarsest deviation is reported
first. Someone attaching a busbar to a heating flow learns that the *kinds*
differ — not that they should compare media that could never have matched
anyway.

Unlike a permission denial, a technical rejection is **explanatory**. A
permission denial is deliberately silent, because the caller must not learn what
exists. Here the drawing sits in front of the engineer, and withholding the
reason protects nothing — it only costs the afternoon they spend guessing.

A medium is compared, never looked up. A plant may name a medium this card has
never heard of; that is a naming decision of the plant, not an error.

## Endpoint identity

A connection means a pair of component **and** port. A port ID alone is not an
identity: several components share a profile, so `p-out` names a port on every
pump in the plant.

Geometry is derived from the resolved port, not stored on the path. Moving a
component therefore moves the endpoint and can never change *which* port is
meant.

An endpoint that no longer resolves is **reported** — with path, end, component
and the port that was searched for — and never silently re-attached to the
nearest port. A silently re-attached endpoint turns a drawing someone must
correct into a drawing that is quietly wrong, and the quietly wrong one is the
one people build from.

Endpoints survive four paths that could break them, and all four are tested:
an edit, copy/paste, a bundle round-trip and a migration.

## Routing

**Deterministic.** The same drawing routes into the same bytes. No randomness,
no clock, no iteration over an unordered collection. Three declared tie-breaks:
the cheapest path, then the straightest, then the lexicographically smallest
point sequence.

**One pixel moves one segment.** Interior corners snap to the drawing grid,
ports keep their exact positions. Without this rule the cheapest route bends
wherever a port happens to sit — and moving a pump by one pixel drags the whole
run along, until the difference from the drawing is as large as the drawing.

**No route runs through plant equipment.** Previously, when a path was blocked,
`candidates[0]` was returned — a path *through* the obstacle, silently issued as
a route. A drawing that runs a pipe through a chiller is worse than one that
refuses: it reads like technical truth.

**An impossible connection says so.** `obstructed`, `detour_exceeded`,
`scene_too_complex` or `degenerate_endpoints` — and a rejection carries no path,
so nobody can accidentally draw it.

**A route leaves on the side its port declares.** The first segment stands
perpendicular to the component edge, so a reader sees the side without
measuring.

**Branching and crossing are distinguishable.** Both look identical on paper
unless the drawing separates them, and someone who cannot tell them apart
cannot read the drawing. Two connections into one collector legitimately share
their feed — that is one run, not a defect.

**Re-routing is local.** Moving a component recomputes the routes near it and
no others. That is not an optimisation but the construction: a route is
computed against the obstacles *near it*, found transitively, so a distant
obstacle was never an input. Across 40 routes a move recomputes exactly one,
and a test compares the result byte for byte against a full recomputation.

The limits are stated in segments and routes, never in milliseconds. A
millisecond figure is a capacity claim; those belong in phase 10, and a budget
measured on a CI runner says something about the runner.

### What does not work yet

Two diagonal routes in a closed box cannot be separated by any lane offset:
each owns the near end of one row and the far end of the other, and no
arrangement of the two turning columns clears both rows. Resolving this needs
an offset *with* additional corners, and that is not implemented. The pair
keeps its geometry and is **reported** in `spacing_violations` — with both
routes, the axis, the extent and the required distance. A report leaves the
engineer with a drawing they can act on.
