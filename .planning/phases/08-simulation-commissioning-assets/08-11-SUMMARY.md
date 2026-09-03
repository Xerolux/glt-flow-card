# 08-11 — Read-only by execution, and counts instead of a score

**Status:** complete. Closes T8-14 and T8-17.

"Read-only by construction" is a claim by inspection, and inspection is what
missed the browser-side diagnostic in the first place. So a full run over a
project referencing controls, alarms and meters asserts an empty dispatch ledger
— **and** asserts that findings were produced, because an empty ledger from an
empty run is the vacuous pass this suite corrected in Phase 4 and again in
Phase 7.

**The readiness score is gone rather than improved.**
`100 - issues.length / refs.size * 100` counted issues rather than entities, so
two findings on one entity subtracted twice and thirty findings on ten gave a
negative clamped to zero — presented as a readiness percentage.

Replacing it with a better-computed percentage would be the same defect with a
nicer formula. The honest answer to "how ready is this?" is a list of what is
wrong, so the summary is counts per diagnosis plus a count of *affected
entities*, where two findings on one entity is one affected entity.

The exact-dist test asserts the rendered table contains no `\d+\s?%` at all, so
reintroducing a score under a nicer formula fails rather than passes.
