# 05-07 — Typed ports and an explained refusal

**Status:** complete
**Requirements:** ENG-01 · **Threat:** T5-04 GREEN

## What shipped

`src/v100/ports.mjs`: four frozen vocabularies (`PORT_KINDS`, `MULTIPLICITY`,
`PORT_DIRECTIONS`, `PORT_SIDES`), a frozen `REFUSAL_REASONS`, `endpointKey`, and
`checkCompatibility(source, target, existing)` returning
`{compatible, reason, detail}` — frozen, so a caller cannot rewrite a refusal
into an approval.

Before this, nothing checked compatibility at all, so every impossible
connection was drawn.

## The decisions worth recording

**Explanatory, not opaque.** Phase 2's denials tell the caller nothing, because
the caller must not learn what exists. An engineering refusal is the opposite:
the engineer already has the diagram open, and withholding the reason protects
nothing — it only costs them the afternoon they spend guessing. So every
refusal carries a code from a closed set plus a `detail` naming the two values
that disagree.

**Check order is a decision, not an accident.** Self-connection comes first: a
port joined to itself also fails the direction check, and "your two ports point
the same way" is not the useful answer. Kind before medium, so connecting a
busbar to a heating flow is answered with "these are different kinds" rather
than sending the engineer to compare media that were never going to matter.
Duplicate before multiplicity, because a second identical connection to a
`one` port is better described as a duplicate than as a capacity problem.

**Media are compared, never looked up.** A site may name a medium this card has
never heard of. That is a naming decision belonging to the site, and two ports
naming the same unknown medium are exactly as compatible as two naming a known
one. Validating media against a vocabulary here would have turned a local
naming choice into an engineering error.

**A malformed port throws.** A refusal is a statement about a diagram; an
unknown port kind is a statement about the code. Returning it as
`{compatible: false}` would let a validator bug reach an engineer disguised as a
mistake they did not make — so `checkCompatibility` raises for an unknown kind,
multiplicity, direction or side, and for a port with no id.

**An endpoint is the pair.** Several equipment share a profile, so `p-out` names
a port on every pump in the plant. `endpointKey` joins equipment and port, and
degrades to the port id alone when there is no equipment — a port reasoned about
on its own, in a profile editor. 05-08 carries this through bundles, paste and
migration.

## Evidence

`node --test test/port-compatibility.test.mjs` — 9 tests, all passing.

- Every one of the six declared reasons is reachable, asserted by set equality
  against `REFUSAL_REASONS`, so none is decoration.
- The CAD corpus's refused pair (`eq-chiller/p-out` → `eq-radiator/p-in`) is
  refused as `medium_mismatch` with both media named, and for nothing else.
- Two equipment sharing a profile do not collide; dropping the equipment makes
  them the same endpoint, and the refusal says `self_connection`.
- A valid pair is accepted, so the check is not vacuously strict.
- Five malformed port shapes throw rather than being refused.
