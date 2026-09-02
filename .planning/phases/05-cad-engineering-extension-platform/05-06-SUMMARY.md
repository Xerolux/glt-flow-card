# 05-06 — The symbol browser, and legibility as evidence

**Status:** complete
**Requirements:** CAT-01 · **Threat:** T5-03 GREEN

## What shipped

`src/v100/project-catalog.js`: `glt-flow-card-symbol-browser` and
`glt-flow-card-port-inspector`, both bilingual, both in the generated artifact.

**Every variant carries words.** Label, style and category are text, not only a
picture. A grid of pictures is unusable by search, unreadable by a screen
reader, and — in forced colours — indistinguishable from a grid that failed to
load. The exact-dist test requires every rendered variant to carry non-empty
text.

**An empty filter result says so.** An empty grid and a catalog that failed to
load look the same; a sentence does not.

**The count is the one the evidence proved.** It comes from
`symbolCatalogStats()`, which counts variants that actually rendered — the same
computation `catalog-evidence.json` records — and the Node suite requires the
two numbers to be equal. It is not an array length and not a literal copied out
of the documentation. It is computed once at module load, because recomputing
456 renders per keystroke would make a filter change re-answer a question whose
answer never changes.

**Nothing assigns a string to `innerHTML`.** The generated symbol markup is
first-party, so parsing it is not a sanitising step — it is a habit. With no
exception in the card, the effect ledger's "zero script insertions" assertion
has nothing to carve out and no future contributor has an example to copy.

**Direction and kind are shapes.** `→|`, `|→`, `↔` for direction; `◇`, `∿`, `⚡`
for process, signal and power. Two ports differ without colour, which is the
requirement forced colours makes concrete.

**A refusal is words, next to the ports.** Rendered from the reason code the
port model returned — which is why that model's codes are a closed set. A
module-load check requires every declared `REFUSAL_REASONS` entry to have
wording in both languages, so a new reason cannot reach an engineer as a code.

## Evidence

`node tools/run-exact-dist-playwright.mjs --grep=phase-5` — 6 tests, passing,
against the shipped bytes:

- Both languages render the published count and label every variant.
- A refused connection shows an explanation in both languages.
- Every operational state — running, fault, stale, off, communication_error —
  keeps text *and* a non-colour symbol with `forced-colors: active` emulated.
- The ledger is empty for service calls, API calls, dialogs, script insertion,
  storage and network.
