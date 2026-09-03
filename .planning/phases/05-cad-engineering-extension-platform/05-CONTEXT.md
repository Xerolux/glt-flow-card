# Phase 5: CAD Engineering & Extension Platform - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning
**Mode:** Continuing the non-interactive full-delivery instruction that carried Phases 1-4

<domain>
## Phase Boundary

This phase makes the diagram itself engineerable. It proves the symbol catalog
rather than asserting it, gives ports enough type information to refuse a
connection that cannot exist, replaces an eight-line Z-shape with a real router,
turns the designer into something that edits transactionally and can be driven
without a pointer, and defines an extension format that adds content without
adding execution.

It does **not** revisit authority (Phase 2), the semantic model (Phase 3) or the
runtime panel (Phase 4). It consumes all three. It does not implement Recorder
history, alarms, reports or remote sites.

</domain>

<decisions>
## Implementation Decisions

### The catalog is proven by rendering, not by counting rows
- 336 catalog rows exist today and their ids are unique, but no test renders any
  of them. A count computed from an array length proves the array's length.
- Therefore catalog evidence is *generated*: every variant is rendered, hashed,
  and the manifest records the count, the per-base geometry digest and the
  per-style token set. The published number is whatever that evidence says.
- Uniqueness is asserted at the level that is actually true: **base geometry**
  must be distinct per base symbol, and **style tokens** must be distinct per
  style. A cross product of two proven-distinct axes is a proven distinct set;
  claiming 336 hand-drawn symbols would be the overclaim the roadmap names.
- The one real coverage hole is fire and electrical representation — one
  `fire_damper` and a generation-oriented `Energie` category. That is filled with
  new base symbols rather than by widening the style axis, because multiplying a
  missing domain by six styles still leaves it missing.

### A port carries enough type to refuse a connection
- Ports gain `kind` (`process` | `signal` | `power`) and `multiplicity`
  (`one` | `many`) alongside the existing medium, direction and preferred side.
- Compatibility is a pure function with an explaining result: it returns a reason
  code, not a boolean. "Blocked" without a reason is indistinguishable from a bug
  to the engineer who hit it.
- A connection references **ports**, not equipment. Today a path names
  `from_equipment`/`to_equipment`, which is why an endpoint cannot survive an
  edit that changes which port is meant. Endpoint identity is the port id, and it
  is preserved across edits, copy/paste, bundles and migration.

### The router is deterministic, obstacle-aware, and incremental
- Determinism first: the same inputs give the same path, byte for byte, or none
  of the rest can be tested. The existing router has this one property and it is
  kept.
- Obstacles, port direction and medium are inputs. A path leaves a port on the
  side the port declares, not on the side arithmetic prefers.
- Rerouting is incremental and bounded. `reroute` currently rewrites every path
  in the view on every call; a diagram of any size makes that a freeze, which is
  the defect the roadmap names. Only segments whose obstacle set changed are
  recomputed, and the work per interaction is bounded.
- Crossings, junctions and parallel spacing are geometry decisions with stable
  outputs, so two runs over the same diagram produce the same junctions.

### The designer edits transactionally
- Every editor operation is a transaction with an inverse. Undo is not a special
  case bolted on at the end; it is the reason the operations are modelled as
  commands at all.
- Cross-project copy/paste remaps ids. Pasting a symbol that keeps its source id
  silently joins two objects that were never the same object.
- Every pointer gesture has a non-pointer equivalent. The kiosk layout Phase 4
  established has no pointer, and an editor reachable only by mouse is an editor
  half the installations cannot use.

### Extensions add content, never execution
- **This is the phase's research flag, and the decision is the conservative
  reading.** SDK-01 requires a *declarative* SDK with "no arbitrary privileged
  project-script execution", and the roadmap records that same-realm JavaScript
  is not a sandbox. Both are satisfied by one rule: **a contribution is data.**
- A symbol pack contributes geometry declarations. A renderer, widget or panel
  contributes a declarative descriptor that first-party code interprets. No
  contributed JavaScript is loaded, evaluated, or executed, in any realm.
- **Settled with the user on 2026-09-02.** This forecloses third-party custom
  rendering logic, and that is accepted. The executable alternative — contributed
  code in a Worker behind a message contract — is recorded as F-01 in
  `.planning/FUTURE-ROADMAP.md` with its full cost, so the decision stays visible
  rather than being rediscovered as a gap. Deferring is cheap because
  contributions are namespaced and versioned: a `worker` kind can be added later
  without breaking a pack written against this format.
- Contributions are namespaced, versioned, and conflict-checked. Installing two
  packs that both claim `pump_inline` must fail with both names, not silently
  pick one.

</decisions>

<constraints>
## Constraints Carried Forward

- No live Home Assistant writes, remote-site writes, physical-bus writes, plant
  or equipment service calls, or credential handling.
- No release is authorized. No public HACS repository, GitHub release or Pages
  deployment without an exact target and explicit authorization.
- Browser role checks are UX only; the Companion enforces.
- Edit authored modules and generators; an isolated change to `dist/` or the
  Companion `www` copy is never complete.
- A component test may not reach outside `custom_components/` and `tests/`, nor
  shell out to a host binary: `test_lane_portability.py` enforces it.
- A Companion module imported at module scope goes in all three packaging lists.
- Commit source, then build, then commit the manifest — and re-run the gates
  *after* the commit. A green run from before the commit does not count.
- Controlled RED needs a named sentinel, a literal marker and a matching ledger.

</constraints>

<risks>
## Known Risks

- **This is the largest phase by requirement count**, and three of the five
  requirements are essentially greenfield. Sequencing matters more than usual:
  ports must be typed before the router can honour them, and the router must be
  deterministic before the designer can be transactional over it.
- **Routing is where a plausible implementation is easy and a correct one is
  not.** Obstacle avoidance with stable output under small moves is the hard
  part; a router that reroutes differently after a one-pixel nudge is worse than
  the Z-shape it replaced, because it looks correct.
- **The catalog evidence could contradict the published number.** If rendering
  shows two base symbols producing identical geometry, the honest count drops.
  The plan must be willing to report a smaller number and add symbols, rather
  than adjust the test.
- **An extension format is a compatibility commitment.** Whatever manifest ships
  is one that later versions must keep reading. It is worth over-specifying now.
- **Editor accessibility is not a late pass.** Retro-fitting non-pointer
  alternatives onto gesture-first tools is how the pointer-only gap the roadmap
  names happened in the first place.

</risks>
