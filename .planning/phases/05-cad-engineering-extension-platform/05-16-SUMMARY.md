# 05-16 — The contribution format, and why it cannot express code

**Status:** Task 1 complete. Task 2 (the exact-artifact half) lands with 05-17.
**Requirements:** SDK-01 · **Threat:** T5-12 partially GREEN

## What shipped

`src/v100/sdk-manifest.mjs` and its Companion mirror
`custom_components/glt_flow_card/sdk_manifest.py`: the manifest shape
(namespace, version, supported project schema versions, contributions of kind
symbol / profile / template / descriptor / translation), `MANIFEST_LIMITS`,
`ALLOWED_ELEMENTS`, `ALLOWED_ATTRIBUTES`, a closed `MANIFEST_REFUSALS`, and
`validateManifest` / `validate_manifest` reaching identical verdicts over a
shared corpus of 39 cases.

## The decisions

**Not executing is necessary and not sufficient.** Option A — settled with the
user and recorded as F-01 — makes a contribution pure data. That alone does not
make a contribution safe: a declarative SVG can still carry `<script>`, an
`onload` attribute, an `href` to somewhere on the internet, or a
`<foreignObject>` full of arbitrary markup. So the format is policed by an
allowlist of elements and attributes. A denylist is a promise to have thought of
everything, and the list of things nobody thought of is exactly the list that
matters.

**Attributes are checked on elements that are already refused.** Telling a pack
author only that `a` is not allowed teaches them to reach for an element that
is, with the same URL still in it. `<a href="javascript:x" onload="y">` is
reported three times, once per thing wrong with it.

**A data URL is not a JavaScript URL.** Both are refused; they get different
codes, because a refusal calling a data URL a JavaScript URL sends a pack author
looking for script they did not write.

**Schemes are decoded before they are compared.** `java&#115;cript:` is the same
URL as `javascript:` by the time a browser reads it, so entities and control
characters are resolved first — a check that runs before that is checking a
string nobody will ever use.

**A doctype is refused outright.** An internal subset is where entity expansion
lives, and no contribution has ever needed one. Refusing it by name means the
billion-laughs class never reaches a parser.

**Bounds run before interpretation.** An oversized manifest is refused by its
length, never by the parser giving up part way through: a parser that has
already started is a parser that can be made to work. The test for this asserts
the size refusal is the *only* error, which is the proof nothing downstream ran.

**A contribution must live inside its own namespace.** A pack that can name a
contribution `other/pump` can shadow another pack's, and installation order
would decide which one wins.

**Refusing beats degrading on an unknown schema version.** A pack declaring a
project schema version this card does not have cannot be read safely by guessing
which parts still apply.

## Parity

`tests/components/glt_flow_card/fixtures/sdk-parity-corpus.json` carries the
manifests *and* the verdicts JavaScript reached — the inputs, not only the
answers, because a corpus of verdicts alone would need the cases written out in
both languages, and two mirrored lists are two lists that drift. The Node suite
regenerates it and requires the committed file to be exactly it; the Python
suite reads the same inputs and requires the same verdicts, in a lane with no
`node` binary.

One case exists purely because the two languages disagree by default:
`schema_versions_boolean`. `true` is an integer in Python and is not in
JavaScript, so `[true]` would have been accepted by one runtime and refused by
the other. It is now refused by both, explicitly.

## Evidence

- `node --test test/sdk-manifest.test.mjs` — 11 tests, all passing.
- `node --test test/sdk-parity-corpus.test.mjs` — 5 tests, all passing.
- `pytest tests/components/glt_flow_card/test_sdk_manifest.py` — 44 tests, all
  passing (39 parity cases plus five properties).
- Four accepted cases and thirty-five refused ones: a corpus of only refusals
  would prove a validator that refuses everything.
- The module's own source is asserted to contain no `eval`, `Function`, dynamic
  `import`, `fetch`, `innerHTML`, `insertAdjacentHTML`, `createElement` or
  `Worker` — the structural half of T5-12, so a contribution has nowhere to
  become code even if the validator were wrong.

## What is not done

Task 2 — installing a pack in the exact artifact and proving the effect ledger
stays empty — needs the manifest module bundled and an extension manager to
install through. Both arrive with 05-17, and the `phase-5-sdk` browser test
currently skips itself with that reason rather than passing vacuously.
