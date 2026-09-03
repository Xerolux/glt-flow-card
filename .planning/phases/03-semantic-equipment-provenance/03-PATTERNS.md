---
phase: 03-semantic-equipment-provenance
status: complete
---

# Phase 03 Patterns

The conventions Phase-3 code follows, and the reasons they exist.

## Derived, never stored twice

A semantic path, a severity rank and a confidence score are all *functions* of data
the project already holds. None of them is persisted. A stored derivation is a second
source of truth that starts agreeing with the first and stops without telling anyone.

```js
// yes
export function semanticPath(model, nodeId) { /* walk parents */ }

// no
{ "id": "eq-1", "parent": "floor-2", "path": "site-a/bldg-1/floor-2" }
```

## Precedence as data

Ordered rules are tables, not conditionals. A table can be enumerated by a test,
printed in a document and reviewed by a person who does not read JavaScript.

```js
export const STATE_PRECEDENCE = Object.freeze([
  "communication_error", "invalid", "stale", "fault", "interlock",
  "locked", "maintenance", "local", "manual", "command_failed",
  "command_pending", "warning", "running", "standby", "off",
]);
```

The resolver's job is then to find the first applicable entry, and the test's job is
to prove every pair resolves the way the table says.

## Evidence travels with the answer

A ranking returns its reasons. A resolved state returns what produced it. A
provenance record returns which registry each field came from. An answer that cannot
explain itself has to be trusted, and this phase exists to remove blind trust.

```js
{ entity_id: "sensor.x", score: 0.82, reasons: [
  { code: "device_membership", weight: 0.4 },
  { code: "unit_match", weight: 0.25, detail: "°C" },
]}
```

## Unknown is a value

Where Home Assistant does not tell us something, the answer is `unknown` — never a
guess, never an empty string, never a plausible default. `unknown` is honest and
renderable; a guess is neither.

## Closed vocabularies validate at the contract

A unit, medium, direction or semantic tag outside its declared set is a contract
error with a stable path, raised before normalization, in both runtimes. Passthrough
strings defer the failure to the moment someone tries to convert them.

## Registry reads are shared reads

Provenance goes through the same Phase-2 policy boundary as every other project read,
with the same non-enumerating denial. A registry lookup is not a side channel around
project authority.

## Profiles never gain authority

A profile control names a control id, its bounded input schema and its gates. Domain,
service and target stay server-resolved from the verified head. If a profile could
name an effect, Phase 2's boundary would have a second door.

## Overrides are decisions, not scores

A manual mapping override records that a person chose it. It survives re-ranking
because it is not a score to be beaten. Storing overrides as weights would let a
model update quietly overrule an engineer.

## Migration steps are pure and receipted

`2 → 3` is a pure function with a canonical receipt and per-step digests, dry-run
before it is ever applied, exactly like `0 → 1` and `1 → 2`. Nothing about the new
step is special-cased.

## Both runtimes or neither

A contract rule that exists only in JavaScript is a rule the Companion does not
enforce. Every schema-3 rule ships as a generated validator in both runtimes and is
proven identical against the shared fixture corpus.
