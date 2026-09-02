# Phase 05 Source Audit

**Audited:** 2026-09-02 at `9a66f0a`
**Purpose:** Establish what Phase 5 actually inherits, measured rather than assumed.

Phase 5 is the first phase where a large amount of the feature already appears to
exist. Most of it does not survive contact with its requirement, so this audit
records numbers and signatures rather than impressions.

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

Ports exist in `COMPONENT_PROFILES` as `{id, medium, side, direction}` (13 port
declarations). Against the requirement:

| ENG-01 asks for | Present |
|---|---|
| medium | yes |
| direction | yes (`in` / `out` / `bidirectional`) |
| preferred side | yes (`side`) |
| signal vs power | **no** |
| multiplicity | **no** |
| incompatible connections blocked with an explanation | **no — nothing checks compatibility anywhere** |
| stable endpoint ids across edits, copy/paste, bundles, migrations | **no — a connection names `from_equipment`/`to_equipment`, not a port** |

A grep for `compatib|incompatible|canConnect|multiplicity` across `src/` returns
only Phase-2 authority states. The core guarantee of ENG-01 does not exist.

## ENG-02 — routing

`autoRoute` (`src/v040-extension.part02:36`) is eight lines. It computes a fixed
four-point Z: leave horizontally, run to the midpoint x, run vertically, arrive.

```
const leftToRight = a.x + a.width / 2 <= b.x + b.width / 2;
```

Against the requirement:

| ENG-02 asks for | Present |
|---|---|
| deterministic | yes — a pure function of two positions |
| orthogonal | yes |
| avoids equipment | **no — obstacles are never consulted** |
| honours port direction and medium | **no — the side is chosen from relative x alone** |
| stable junctions and T-pieces | **no** |
| clear crossings | **no** |
| parallel spacing | **no** |
| incremental reroute of affected segments | **no — `reroute` rewrites every path in the view on every call** |

Both defects the roadmap names for routing — "unstable/detached routes" and
"synchronous full reroutes" — are present and directly demonstrable.

## CAD-01 — the designer

The designer lives in `src/v040-extension.part03` and `part04`. It has selection,
templates and deletion, and it uses `confirm()` and `alert()` for destructive
operations (`part03:26`, `part03:76`, `part03:98`, `part04:4`). Phase 4
deliberately left these alone as Phase 5's, because they are editor affordances
rather than authorization stand-ins.

Against CAD-01, the following are absent: layers with visibility and locking,
z-order commands, guides and snapping, alignment and distribution, lasso
multi-select, cross-project copy/paste with id remapping, minimap, nested groups,
reusable masters, and undo/redo. There is no transaction boundary of any kind in
the editor: edits mutate config directly.

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
