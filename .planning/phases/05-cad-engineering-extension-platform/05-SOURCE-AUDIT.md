# Phase 05 Source Audit

**Audited:** 2026-09-02 at `9a66f0a`
**Purpose:** Establish what Phase 5 actually inherits, measured rather than assumed.

Phase 5 is the first phase where a large amount of the feature already exists.
Some of it survives contact with its requirement and some does not, so this audit
records numbers and signatures rather than impressions.

**Corrected on 2026-09-02, during execution of 05-01.** The first version audited
`src/v040-extension.*` and treated it as the whole product. It is not:
`src/v100/core.mjs` carries an obstacle-aware router and already consumes port
endpoints. Corrected sections are marked. The claim that three of five
requirements were "essentially greenfield" was an overstatement and is withdrawn.

## CAT-01 — the catalog

| Measured | Value |
|---|---|
| `BASE_SYMBOLS` | 56 |
| `VISUAL_STYLES` | 6 |
| `SYMBOL_VARIANTS` (cross product) | 336 |
| Variant ids unique | yes |
| Base symbols by category | Heizung 9, Hydraulik 17, RLT 12, Kälte 4, Energie 6, Sensorik 8 |

**A style is a card theme, not a symbol.** `ha-card.glt-style-<id>` in
`src/v040-extension.part06` redefines background, text, accent, border radius and
font family for the whole card. The symbol SVG uses `currentColor` and
`var(--glt-accent)`, so it does change appearance with the style — but every
symbol changes identically, and `symbolSvg(id, active)` never receives the style
at all. Callers pass `item.symbol || item.type`, which is the *base* id.

**So the count is real, and the requirement intends it.** CAT-01 asks for
variants "across HVAC, hydraulics, refrigeration, air handling, fire/electrical
representation, DIN/P&ID, and Neo-2030 styles" — styles are named as part of the
spread, so the cross product is the reading, and 336 ≥ 300.

`core.mjs:symbolCatalogStats()` already reports `{base_symbols, variants,
profiles}` — but it counts array entries, which is exactly the unproven claim.

**What is missing is the evidence, not the count.** The roadmap names "unproven
catalog-count claims" as a defect this phase closes, and success criterion 1
requires "catalog evidence plus state/contrast visual tests". Neither exists
today: no test asserts the published count, no test renders a symbol, and no test
checks contrast in any style.

**One coverage gap is real.** "Fire/electrical representation" is served by a
single `fire_damper`, and the `Energie` category is generation and metering (PV,
inverter, battery, grid, meter, wallbox) rather than electrical distribution or
fire safety. That is a genuine hole in the required domain spread.

## ENG-01 — typed ports

**Corrected 2026-09-02, during execution.** The first version of this section said
a connection names equipment rather than ports. That was measured from the legacy
extension and is wrong about the repository as a whole.

`from_port` and `to_port` **already exist** in the schema-3 `path` definition, and
`src/v100/core.mjs:256` already consumes them: it selects a port by id, falling
back to a medium match, then to a default side. The endpoint reference exists and
is honoured.

| ENG-01 asks for | Present |
|---|---|
| medium, direction, preferred side | yes, in `COMPONENT_PROFILES` |
| a connection that names ports | **yes** — `from_port` / `to_port`, consumed by `smartRoute` |
| signal vs power (`kind`) | no |
| multiplicity | no |
| a validated port shape | **no** — `profile.ports` items are `$ref: openObject`, so a port is entirely unvalidated |
| incompatible connections blocked with an explanation | **no** — a grep for `compatib\|canConnect\|multiplicity` across `src/` returns only Phase-2 authority states |
| endpoint identity across edits, copy/paste, bundles, migrations | **partly** — the field survives, but nothing preserves or repairs it, and paste does not remap it |

ENG-01 is therefore narrower than first stated. The schema change is to give
`profile.ports` a validated closed shape, not to introduce endpoints at all. The
missing work is `kind`, `multiplicity`, validation, the compatibility function,
and identity preservation.

## ENG-02 — routing

**Corrected 2026-09-02, during execution.** The first version described routing as
an eight-line Z-shape blind to obstacles. That describes the *legacy* router and
misses the one that ships.

There are two:

- `src/v040-extension.part02:36 autoRoute` — the eight-line Z through the
  midpoint, no obstacles. Legacy.
- `src/v100/core.mjs:249 smartRoute` — **obstacle-aware**. It builds obstacle
  rectangles from every other equipment item with a configurable padding,
  generates about 34 candidate paths (two direct, then eight offsets in four
  directions), and returns the first that does not intersect an obstacle, tested
  by `pathHits`/`segHitsRect`. It honours `from_port`/`to_port`.

`smartRoute` is exported on `window.GLTFlowCardSDK` and driven from the CAD
dialog's "recalculate all auto-routes".

| ENG-02 asks for | Present in `smartRoute` |
|---|---|
| deterministic | yes — pure, with a fixed candidate order |
| orthogonal | yes |
| avoids equipment | **partly, and this is the defect**: when no candidate is clean it returns `candidates[0]`, a path that *does* cross an obstacle, with no signal that it failed |
| honours port direction | no — only `side` is used; `direction` is ignored |
| honours medium | partly — medium selects a port, but an incompatible pair is still routed |
| stable junctions and T-pieces | no |
| clear crossings | no |
| parallel spacing | no |
| incremental reroute | no — the CAD action loops every path with `from_equipment && to_equipment` |

The routing work is therefore not "write a router". It is: make failure explicit
instead of silently returning a crossing path, honour direction, add junctions,
crossings and spacing, and make rerouting incremental. Candidate-and-test may be
replaced, but it is a real starting point rather than nothing.

## CAD-01 — the designer

**Corrected 2026-09-02.** More exists than first credited. The designer lives in
`src/v040-extension.part03`/`part04` and in `src/v100/index.js:showCAD`.

- `core.mjs:alignObjects` implements align left/right/top/bottom, centre on both
  axes, and distribute horizontally and vertically.
- `showCAD` offers layers, a full reroute, and copy/paste.
- Destructive operations use `confirm()` and `alert()` (`part03:26`, `part03:76`,
  `part03:98`, `part04:4`). Phase 4 deliberately left these for this phase.

The paste path is T5-10 in the wild:

```
o.id = `${o.id || c.kind}_${Date.now().toString(36)}_${Math.random()...}`
```

It regenerates an id but rewrites **no** reference to the old one, so a pasted
connection still points at the source objects — and it uses `Date.now()` and
`Math.random()`, so the same paste is not reproducible.

Absent entirely: layer locking, z-order commands, guides and snapping, lasso
multi-select, minimap, nested groups, reusable masters, undo/redo, and any
transaction boundary. Edits mutate `config` directly.

## SDK-01 — extensions

`src/v100/online-extension.js` is 15 lines and loads nothing external. There is
no manifest format, no namespace, no version negotiation, no conflict handling
and no installation path. SDK-01 starts from nothing, which is the safest place
for it to start from.

## Reused unchanged

| Source | What Phase 5 takes |
|---|---|
| `custom_components/glt_flow_card/policy.py` | The declared-route boundary. Every new route is declared or it does not exist. |
| `src/v100/project-contract.mjs`, `schemas/project/3.schema.json` | Canonical JSON, digests, and the schema the new collections extend. |
| `src/v100/project-bundle.mjs` | Deterministic bundles; symbol packs and masters travel through the existing ZIP32 trust boundary, not a new one. |
| Phase-4 `navigation.mjs`, `panel-model.mjs` | The address model and region rendering the designer navigates within. |
| `tools/assert-red.mjs`, `tools/exact-dist-effect-ledger` | Controlled RED and the browser effect ledger, extended with the Phase-5 prohibitions. |

## Counts at audit time

- Declared WebSocket routes: 42.
- Custom elements in the generated artifact: 17 — the card and editor plus the fifteen Phase-2/3/4 surfaces.
- Node unit tests 214, Python 224, exact-dist 38, all with zero skips.
