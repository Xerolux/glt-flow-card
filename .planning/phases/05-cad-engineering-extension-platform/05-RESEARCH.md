# Phase 05 Research

**Conducted:** 2026-09-02
**Method:** Measured against the repository at `9a66f0a` and the vendored Home Assistant 2026.2.3. Every claim is marked with how it was established. The roadmap carries an explicit research flag for this phase; section 5 answers it.

---

## 1. What the catalog actually is

**Measured.** `BASE_SYMBOLS` is 56 entries; `VISUAL_STYLES` is 6;
`SYMBOL_VARIANTS` is their cross product, 336, with unique ids.

**Established from the source.** `symbolSvg(id, active)` receives the base id and
an active flag — never a style — and callers pass `item.symbol || item.type`. The
styles are card-level CSS themes (`ha-card.glt-style-<id>`) that redefine
background, text, accent, radius and font. The symbol SVG draws with
`currentColor` and `var(--glt-accent)`, so it *does* change with the style, but
identically for every symbol.

**Consequence.** The 336 is honest as a cross product and dishonest as a claim of
336 drawings. CAT-01 names styles as part of the required spread, so the cross
product is the intended reading — but the two axes must each be proven distinct,
or the product proves nothing. Hence per-base geometry digests and per-style
token digests rather than one flat count.

**Coverage gap, measured.** Categories are Heizung 9, Hydraulik 17, RLT 12,
Kälte 4, Energie 6, Sensorik 8. CAT-01 requires "fire/electrical representation";
the repository has one `fire_damper`, and `Energie` is generation and metering.
Multiplying an absent domain by six styles leaves it absent, so this is filled
with base symbols.

---

## 2. Why endpoints detach today

**Established from the source.** A path carries `from_equipment` and
`to_equipment`. `autoRoute` derives both endpoints from equipment *bounding
boxes*, choosing a side by comparing centre x.

So an endpoint is not an identity at all — it is recomputed geometry. Nothing can
survive an edit, because there is nothing to survive: the port a connection
"meant" was never recorded. ENG-01's "stable endpoint IDs across edits and
migration" therefore requires a schema change, not a bug fix.

**Decision.** A connection references `{equipment_id, port_id}`. The port id is
the identity; geometry is derived from it, never the reverse.

---

## 3. Why the current router cannot be made incremental

**Established from the source.** `reroute(config, viewId)` loops every path in the
view and overwrites `path.points` on each call. `autoRoute` consults only the two
endpoints' bounding boxes.

Two things follow. There is no obstacle model to make incremental — the router
has never looked at a third object. And there is no dependency information: since
every path is recomputed unconditionally, nothing records which paths a given
move could possibly have affected.

**Decision.** The router keeps a spatial index of obstacles and, for each route,
the set of obstacles its corridor touches. A move invalidates only the routes
whose obstacle set intersects the moved region. The bound asserted is *segments
recomputed per interaction*, not milliseconds, because a wall-clock assertion is a
capacity claim and Phase 10 owns those.

**Determinism is the precondition, not a nice-to-have.** A router that produces a
different path for the same input cannot be tested for obstacle avoidance,
junction stability or bounded change, because every assertion becomes flaky. The
existing router's one virtue — being a pure function — is kept.

---

## 4. Transactional editing

**Established from Phase 1 and Phase 2.** The project head already moves through
receipted, revision-checked transactions with immutable snapshots and forward-only
rollback. The *editor*, however, mutates `config` in place.

**Decision.** Editor operations become values with `apply`/`invert`. This is not
undo-stack plumbing; it is what makes undo provable: the property
`invert(apply(s, c), c) === s` can be checked over a generated corpus of operation
sequences, whereas an undo stack can only be checked over the click-paths someone
thought to write down.

The project-level transaction is unchanged — the editor composes a batch of
commands and commits it through the existing Phase-2 guarded mutation.

---

## 5. The SDK trust decision — the roadmap's research flag

**The flag, verbatim from the roadmap:** "Define trusted SDK installation,
review, distribution, and compatibility policy; same-realm JavaScript is not
treated as a sandbox."

**What the requirement already fixes.** SDK-01 asks for a *declarative* SDK with
"no arbitrary privileged project-script execution". Phase 1 already established
that bundle assets are opaque bytes authenticated by SHA-256, with active-content
canaries proving zero execution.

**The options, honestly stated.**

| Option | What it buys | What it costs |
|---|---|---|
| **A. Contributions are pure data** | No execution anywhere; the canary technique from Phase 1 transfers directly; nothing to sandbox, so nothing to escape | Third-party custom rendering logic is impossible; a novel widget needs a first-party interpreter for its descriptor kind |
| B. Contributed code in a Worker behind a message contract | Third parties can ship real behavior | A standing security commitment: message-contract validation, resource bounds, timeouts, and a review policy for what a Worker may ask for. A materially larger phase |
| C. Same-realm JavaScript with review | Cheapest to build | Explicitly rejected by the roadmap's own finding, and correctly: same-realm code has the page's full authority |

**Decision: option A.** A contribution is data. A symbol pack contributes
geometry declarations; a renderer, widget or panel contributes a declarative
descriptor that first-party code interprets. No contributed JavaScript is loaded,
evaluated or executed, in any realm. C is ruled out by the roadmap. B is
defensible engineering but neither the requirement nor the roadmap asks for it,
and adopting it silently would commit the product to a security surface nobody
chose.

**Settled with the user, 2026-09-02.** Option A stands. It forecloses
third-party rendering logic, and option B is recorded as F-01 in
`.planning/FUTURE-ROADMAP.md` — what it is, what it would cost, and what would
make it worth revisiting. The deferral is cheap: contributions are namespaced and
versioned, so a `worker` kind is additive later, whereas shipping B and later
restricting it would not be.

**What A still has to get right.** Not executing is necessary and not sufficient.
A declarative SVG contribution can still carry `<script>`, an `onload` attribute,
an `href` to a remote resource, or a `<foreignObject>` containing markup. The
manifest validator therefore allowlists elements and attributes rather than
denylisting the dangerous ones, and the effect ledger asserts zero network and
zero evaluation with a seeded violation proving it fails.

---

## 6. Namespacing, versions and conflicts

**Reasoned from the repository's own conventions.** Every closed set in this
product is deny-default, and every ambiguous input fails rather than resolving to
a guess.

**Decision.** A contribution id is `<namespace>/<local-id>`, the namespace comes
from the manifest, and two packs claiming one namespace is a refusal. A pack
declares the project schema versions it supports; an unsupported version refuses
installation rather than degrading. A conflict names **both** sides — an error
that says "conflict" without saying with what leaves the operator to guess.

Installation is all-or-nothing. A half-installed pack is the state from which
"why is this symbol missing" bugs are unfalsifiable.

---

## 7. Not researched, and why

- **Recorder, alarms, reports, simulation, remote sites.** Phases 6-9 own them.
- **Measured capacity.** Phase 10. This phase asserts structural bounds (segments
  recomputed, symbols per pack) and deliberately not wall-clock numbers.
- **Public pack distribution.** Requires an exact target and separate
  authorization; local installation only. Recorded as F-02 in
  `.planning/FUTURE-ROADMAP.md`.

---

## Open questions carried into planning

| # | Question | Resolution path |
|---|---|---|
| A1 | Does the catalog need a schema version bump? | Yes — ports gain `kind` and `multiplicity`, connections gain port endpoints, and contributions are a new collection. Schema 4, on the existing sequential machinery. Settled in 05-04. |
| A2 | Are style tokens per-symbol or per-card? | Per-card, as today. The evidence proves distinctness per style token set, not per rendered symbol pair. Settled in 05-05. |
| A3 | What is the routing bound expressed in? | Segments recomputed per interaction. A wall-clock bound is a capacity claim. Settled in 05-11. |
| A4 | Where does the editor transaction boundary sit? | The editor batches commands; the batch commits through the existing Phase-2 guarded mutation. No second mutation path. Settled in 05-12. |
| A5 | May a contribution add a *profile*? | Yes — a profile is data, and Phase 3 already validates it, including the deny-default control shape that cannot name a domain or service. Settled in 05-16. |
| A6 | What happens to an installed pack a project still references after removal? | Removal is refused while referenced, naming the referrers. Settled in 05-18. |
