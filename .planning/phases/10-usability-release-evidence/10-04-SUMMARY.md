# 10-04 — The strings, in four parts, and the part that is not done

**Status:** **incomplete.** T10-03 is `not met`.

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

**What was done:** 272 → 132. Fifty inline `{de, en}` pairs from four vocabulary
modules, all 143 labels of the symbol catalog, and the 65 of the legacy card's
separate symbol library — whose English half existed nowhere in the product, so
moving them was also authoring them.

**What is not done, and is published as failed:** 132 strings in the legacy
card's two generated bases, the entry module and a handful of validator and
diagnostic messages.

The allowlist carries a reason per entry, and "not UI" is not a reason — say
what the string *is*, so a later reader can check the claim rather than inherit
it. An allowlist extendable with a shrug ends up holding the strings someone did
not want to move.
