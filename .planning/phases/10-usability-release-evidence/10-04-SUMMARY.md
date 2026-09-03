# 10-04 — The strings, in four parts, and the part that is not done

**Status:** complete. Closes T10-03.

`tools/verify-i18n-coverage.mjs` reads the shipped artifact and **fails with the
list, never a count** — a count lets the number creep up unnoticed and gives
nobody a work queue.

Scope is decided by provenance rather than by shape: esbuild labels each inlined
module, so js-yaml's parser diagnostics and ajv's schema text are excluded
because of where they came from. The first version swept them too and produced
444 findings, burying the ones that mattered. Thrown `Error` messages are
excluded on the same principle — they are addressed to whoever reads a stack
trace, and translating them would put a German sentence in front of the person
debugging the failure.

**272 → 0**, in seven passes. Fifty inline `{de, en}` pairs from four vocabulary
modules; all 143 labels of the symbol catalog; the 65 of the legacy card's
separate symbol library; fourteen sentences for the contract validation codes;
fifty more from the legacy layers; and the last inline `de:{…} en:{…}` table.
768 keys, and the English half of most of them existed nowhere in the product —
so moving them was also authoring them.

**Two defects the passes found in themselves**, both worth recording. The
extractor did not strip comments, so an apostrophe in "One symbol's label"
opened a string and produced a finding that was a fragment of a doc comment —
a sweep reporting work nobody has to do is one people learn to ignore. And a
replacement pass injected `${…}` into a double-quoted string on the theory it
was inside a template literal; only a complete quoted literal is safe to swap
mechanically, and the rest were done by hand.

The allowlist carries a reason per entry, and "not UI" is not a reason — say
what the string *is*, so a later reader can check the claim rather than inherit
it. An allowlist extendable with a shrug ends up holding the strings someone did
not want to move.
