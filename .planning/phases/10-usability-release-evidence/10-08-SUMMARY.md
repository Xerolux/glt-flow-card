# 10-08 — The assertions, in the exact artifact

**Status:** complete. Closes T10-07 and T10-08.

Against the shipped bundle, not the source — the rule every UI phase has
followed since Phase 7 shipped a surface whose source grep passed while the
screen rendered a confident zero.

**Three real defects, each fixed in the product:** the report designer's three
inputs had no labels at all, so a screen reader announced three "edit text"
stops with nothing to tell them apart; the trend table is focusable and had no
name, though it *is* the accessible form of the chart; and the designer
minimap's focusable box had none either, because the enclosing region's label
does not carry to a descendant a keyboard user lands on directly.

**The test's own first version was wrong, and that is recorded rather than
quietly fixed.** It checked `aria-label`, `aria-labelledby` and `label[for]`
only, and reported six correctly labelled inputs — five wrapped in a `<label>`,
one associated by id — as unnamed. A check that reports work already done is a
check people learn to ignore. Name resolution now follows the specification's
order of precedence, scoped to the surface rather than the document, because
several surfaces mount at once and ids repeat.

`title` is deliberately outside that order and reported separately.

The vacuity guard matters more here than usual: a sweep over zero elements
passes every rule, so the test asserts a floor on how many it examined.
