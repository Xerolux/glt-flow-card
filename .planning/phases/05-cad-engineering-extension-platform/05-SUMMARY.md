# Phase 5 — CAD Engineering & Extension Platform

**Status:** complete. 20 of 20 plans implemented. 15 of 16 threats verified;
T5-16 blocked by an environment limit, recorded below.
**Requirements:** CAT-01, ENG-01, ENG-02, CAD-01, SDK-01

## What the phase found

This phase was scoped to build things. Most of what mattered was finding that
four claims already in the product were false.

**The catalog count was an overclaim, twice over.** `symbolCatalogStats()`
measured array lengths. Three base symbols — `ahu`, `wallbox`, `room_sensor` —
had no branch in the shipped renderer and drew nothing at all; the catalog
counted them anyway, so eighteen advertised variants were blank. Nine more
shared another symbol's drawing. A cross product of two axes is a set of
distinct variants only if both axes are distinct, and neither was.

**The router returned paths through obstacles.** When no candidate was clean it
returned `candidates[0]`. A drawing that quietly runs a pipe through a chiller
is worse than one that refuses, because it reads as engineering truth.

**Paste aliased instead of copying.** It minted an id from `Date.now()` and
`Math.random()` and rewrote nothing that referred to the old one, so a pasted
connection still pointed at the objects it came from — two diagrams silently
sharing state. The clock is why nobody noticed: the same paste was never
reproducible.

**Phase 4's control retirements were never shipped.** They live in
`src/v040-extension.part05` and `part06`, which are not build inputs — the
authored form of an extension a manual workflow bundles, and it was never run.
Worse, the same defect was live in the v100 layer, which does ship, and nobody
had retired it there at all: `executeControl` made a browser-side role check
(any Home Assistant administrator became a "designer"), stood a `window.confirm`
in for an authorization prompt, and — when `security.server_enforced` was false
— called `hass.callService` directly behind a domain allowlist the browser also
checked itself. Its server-enforced branch called a route the policy contract
has carried as `retired` since Phase 2.

## What shipped

| Area | Result |
|---|---|
| Catalog | 456 variants, 76 base symbols, 6 styles, 8 domains — every geometry and token digest proven distinct |
| Ports | Typed ports, six closed refusal reasons, endpoints that survive edit, paste, bundle and migration |
| Routing | Deterministic, obstacle-aware, explicit failure, one segment per pixel of nudge, bounded local reroute |
| Designer | Commands with proven inverses, id-remapping paste, four surfaces, the whole workflow on the keyboard |
| SDK | Data-only contributions in two runtimes, atomic namespaced installation, referential-safe removal |

Schema 4 adds a closed `port` shape and a `contributions` collection, with a
sequential receipted 3→4 migration in both runtimes.

## The decisions worth carrying forward

**Evidence beats arithmetic.** The catalog count is produced by rendering every
variant and digesting the result, and the generator refuses to write the file
when a symbol draws nothing or two things draw the same. The documented number
is bound to it by a test.

**A property beats a preference.** The bounded-nudge requirement was first
attempted as a cost that penalised turning off the drawing grid. A cost is a
preference and it lost to the turn penalty on exactly the paths that mattered.
What shipped is a snap pass that can tidy a route and cannot break one.

**Refuse, do not degrade.** An unresolvable endpoint is reported with both ends
named rather than reattached. An unroutable pair returns a reason and no points.
A pack for an unknown schema version is refused rather than partially read.

**Reachable and inert beats deleted.** Both retired control paths still exist
and do nothing, so the effect ledger can prove no gesture produces a service
call. Deleting them would move the proof somewhere nothing checks.

**A guard belongs where the defect would be.** `test/shipped-dialogs.test.mjs`
reads `dist/glt-flow-card.js`, not the sources, because a test over the authored
sources is exactly what kept passing while the shipped bytes carried the defect.

## Limitations, stated

**T5-16 is `planned`.** Its owner is the composed `test:phase5:release` leaf,
which installs the exact stage on digest-pinned Home Assistant images and needs
a Docker engine this container does not have. `validate:hacs-staging` passes at
head and `test:ha-artifacts` then cannot resolve a lane at all, because each of
its twelve bounded candidates probes `docker info`. The row would be unmarked
even if every leg passed separately: a composed leaf verified from its parts is
a leaf nobody composed. T2-16, T3-14 and T4-14 stand unmarked for the same reason.

**Two diagonal routes in a closed box cannot be separated by a lane offset.**
Each owns the near end of one row and the far end of the other, so no ordering
of the turn columns clears both. Resolving it needs a jog rather than an offset.
The pair keeps its geometry and is reported in `spacing_violations`.

**Five `prompt()` calls remain** on editor naming paths — not destructive, and
replacing them with inline inputs is its own change.

**The v040 extension parts 05 and 06 are still not in the artifact.** The two
paths that mattered are fixed directly; the mechanism is not. Part 06's symbol
renderer is still missing from what ships, and re-bundling all seven parts is a
decision about the build — the workflow that does it also resets the package
version to 0.4.0 — so it is raised rather than taken.

## Evidence at head

- Node suite: 323 passed.
- Companion suite: 312 passed.
- Exact-dist browser suite: 47 passed.
- Documentation: 21 sources present, 41 generated files byte-identical twice.
- Phase-5 gate: graph proven acyclic with one path to the leaf; F5-01 to F5-05
  pass. F5-06 chains to the earlier gates and reaches Phase 1's
  `verify:provenance --online`, which this container's egress proxy answers
  with HTTP 403 — the same recorded limit, failing closed rather than skipping.
