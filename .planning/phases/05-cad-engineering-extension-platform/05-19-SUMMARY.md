# 05-19 — Documentation that matches the product

**Status:** complete
**Requirements:** CAT-01, ENG-01, ENG-02, CAD-01, SDK-01

## What shipped

- `docs/wiki/Symbols-Routing.md` — rewritten. The old page listed symbols by
  name and described auto-routing as "the route is recalculated when equipment
  moves", which was the full-sweep reroute this phase retired.
- `docs/wiki/Designer.md` — rewritten. The old page documented five keyboard
  shortcuts, none of which reach an editing command.
- `docs/wiki/Extensions.md` — new.
- `docs/wiki/_Sidebar.md` — the new page linked.
- `README.md` and `README.de.md` — the catalog, ports, routing and extension
  sections replaced in both.

## The decisions

**Every number is bound to the evidence.** 456 variants, 76 base symbols, 6
styles. A test reads the README, the German README and the wiki page, extracts
every stated count, and requires each to equal `catalog-evidence.json`.
Documentation drifts silently; this makes a symbol added without regenerating
fail in the Node suite rather than ship a README that overstates.

**The SDK section states the foreclosure, not only the guarantee.** "No
contributed code executes" reads as a feature. What an integrator needs is what
it costs them: no contribution whose appearance is *computed* rather than
described — a level indicator on a vendor's characteristic curve, a widget
combining entities under a rule the card does not implement, a renderer that
draws differently depending on values. A test requires that sentence to exist in
all three documents, because it is the one a reader plans around.

**The defects are named, not smoothed over.** The catalog page says plainly that
three base symbols drew nothing and nine shared another's drawing. The routing
page says the old router returned a path *through* the obstacle. The designer
page says the old paste minted an id and rewrote nothing. A document that
describes only the fixed state teaches nobody why the check exists.

**The limitation is documented.** The two diagonals that no lane offset can
separate have their own section, with the reason and what would fix it.

**A guard against three specific stale claims** — the full-sweep reroute
sentence, and the "more than 50 components" figure in both languages.

**Language follows the page.** The wiki is German, as it has been for every page
but one; the READMEs carry English and German, and a test requires the
foreclosure sentence in both.

## Evidence

- `node tools/verify-docs-site.mjs` — 21 sources present and non-empty, 41
  generated site files byte-identical across two builds.
- `node --test test/catalog-evidence.test.mjs` — 11 tests, including the three
  new documentation bindings.
- Full Node suite: 301 passed.
