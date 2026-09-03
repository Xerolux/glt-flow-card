# 05-05 — The catalog count becomes evidence

**Status:** complete
**Requirements:** CAT-01 · **Threats:** T5-01, T5-02 GREEN

## What this found

`symbolCatalogStats()` reported the catalog size by measuring array lengths.
That proves the array's length. Two things were wrong underneath it, and both
would have reported the same confident number:

- **Three base symbols drew nothing at all.** `ahu`, `wallbox` and `room_sensor`
  had no branch in the shipped renderer. The catalog counted them anyway, so
  eighteen of the advertised variants were blank.
- **Nine base symbols shared another symbol's drawing.** `chiller` was drawn
  with the heat pump's geometry, `cooling_buffer` with the buffer's,
  `air_filter` with the water filter's, `shutoff_valve` with the two-way
  valve's, `heat_recovery_plate` with the plate exchanger's, `pump_dhw` with the
  inline pump's, `dirt_separator` with the filter's, `fan_extract` with
  `fan_supply`, `heat_pump_compact` with `heat_pump_neo`.

A cross product of two axes is a set of distinct variants only if both axes are
distinct. Neither was, so the published figure was an overclaim regardless of
how the arithmetic was done.

## What shipped

**Geometry as data.** `SYMBOL_GEOMETRY` in `src/v100/catalog.mjs` holds one
primitive list per base symbol — lines, rects, circles, paths and text — and
`renderVariant(base, style)` turns a pair into SVG. Every symbol that shared a
drawing was given its own; every symbol that drew nothing was drawn.

**Style tokens as values.** `STYLE_TOKENS` holds what a style actually changes:
background, surface, stroke, muted, accent, hot, cold, power, alarm, corner
radius, stroke width, line cap, grid. Values rather than a stylesheet, so a
style can be digested, compared and — in 05-06 — contrast-checked.

**Domains as stable ids.** The categories are German because that is what an
operator reads. `DOMAINS` maps each to a language-independent id, because a
requirement naming "fire" must not depend on how the label is spelled this
release.

**Fire and electrical.** Twenty new base symbols: distribution, protection and
isolation on the electrical side (switchgear, busbar, sub-distribution board,
transformer, UPS, generator set, circuit breaker, RCD, surge arrester, isolator);
detection, suppression and rated separation on the fire side (panel, smoke and
heat detectors, manual call point, aspirating detector, sprinkler head, wet
alarm valve station, extinguishing system, fire barrier, fire door). Multiplying
an absent domain by six styles leaves it absent, so these had to be base
geometry rather than another style.

**The generator.** `tools/generate-catalog-evidence.mjs` renders all 456
variants, digests each base's geometry and each style's tokens, records the
per-domain breakdown, and refuses to write at all when a symbol draws nothing,
two bases draw the same thing, or two styles carry the same tokens. `--check`
compares against the committed file.

## Evidence

`catalog-evidence.json`: **456 variants** from **76 base symbols** in **6
styles**, over 8 domains, all base geometry digests distinct, all style token
digests distinct, all 456 rendered digests distinct, zero empty renders.

`node --test test/catalog-evidence.test.mjs` — 8 tests, all passing.

- The committed evidence is regenerated in-process and compared byte for byte.
- A seeded stale manifest is written to disk, `--check` is run as a subprocess
  and required to exit non-zero naming staleness, then the file is restored and
  `--check` required to pass. The check can fail, which is the only reason to
  believe it passing means anything.
- `symbolCatalogStats()` now counts what rendered, and the test requires the
  card's number and the evidence's number to be the same number.
- The three symbols that used to draw nothing are named individually, so a
  regression is legible rather than arithmetic.
- Each required domain carries base symbols of its own, and its variant count is
  exactly its base count times the style count; fire and electrical each carry
  at least ten.
