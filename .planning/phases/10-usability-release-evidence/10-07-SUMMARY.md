# 10-07 — Names and roles, on elements rather than on attributes

**Status:** complete. Groundwork for T10-07 and T10-08.

The shipped runtime had **zero** `aria-label` attributes against five
`placeholder=` and three `title=`. Neither is an accessible name for a control:
a `title` is not announced by every reader and never on touch, and a
`placeholder` disappears the moment someone types — which is exactly when
someone needs to know which field they are in.

The Phase-8 and Phase-9 surfaces had **no roles at all**. That is this work's
own gap, listed here rather than quietly fixed: those phases asserted colour
independence and text content, which is necessary and not sufficient, and I took
it for enough.

Three shapes changed:

- **Badges and values became named groups.** Five loose spans read as five
  fragments with no relationship; a simulated value now names its provenance in
  its own name, because a reader hearing "62.5 degrees" without it has produced
  exactly the reading Phase 8 exists to prevent.
- **The absent-site list became a list**, so a reader learns how many sites are
  missing without counting the items.
- **Decorative glyphs are hidden from the accessibility tree.** Each sits beside
  the word it repeats; announcing both reads the state twice. The glyph stays
  visible — that is the colour-independence rule.
