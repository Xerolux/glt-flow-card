---
phase: 05-cad-engineering-extension-platform
reviewed: 2026-09-03
head: 0eed520
depth: standard
reviewer: close-out review pass
method: read at head, mechanical comparison of the two runtimes' declarations, probes
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
fixed_in_this_pass: 2
status: issues_found_and_fixed
---

# Phase 05: Code Review Report

**Scope.** `sdk_manifest.py`, `sdk_registry.py`, `src/v100/sdk-manifest.mjs`,
the parity corpus and its generator, `src/v100/v1-addons.js`, `index.js`,
`src/generated-bases/*`, the `v040-extension.part0*` authored source, and the
catalog/router/designer evidence this phase produced.

## Summary

The phase's central guarantee — **a contribution is data and cannot become
code** — is enforced by an allowlist in both runtimes, not a denylist, with
entity-decoding so `java&#115;cript:` is refused as the `javascript:` it is. The
two implementations were compared mechanically at head: `CONTRIBUTION_KINDS`
(5), `ALLOWED_ELEMENTS` (17), `ALLOWED_ATTRIBUTES` (47) and `MANIFEST_LIMITS`
all match exactly.

The phase's own account of itself is the most honest in the project: it opens by
saying that most of what mattered was finding four existing claims false, and it
records what it did not finish. Both warnings below are in that spirit — things
the phase named in prose and did not make checkable.

## Warning

### WR-01: "Deliberately absent" was a comment, not a test — FIXED

**Files:** `src/v100/sdk-manifest.mjs`, `custom_components/glt_flow_card/sdk_manifest.py`,
`tools/generate-sdk-parity-corpus.mjs`

Both modules carried a comment naming the twelve elements kept out of the
allowlist — `use`, `image`, `script`, `style`, `foreignObject`, `iframe`,
`animate`, `set`, `a`, `filter`, `marker`, `pattern` — and the parity corpus
exercised **four**. The other eight were refused only because the list is an
allowlist. That is true today and would remain true if one runtime quietly grew
an entry: no case would notice, and the Home Assistant lanes have no `node` and
can only read the recording.

**Fixed.** The comment is now `ELEMENTS_DELIBERATELY_ABSENT` in both runtimes,
with a stated reason per element. The corpus derives one case per entry, so all
twelve are proven refused by both. Three guards: an element in both lists fails;
an element declared absent with no corpus case fails, naming the regenerate
command; and the two mirrors must name the same elements. Mutation-checked by
dropping `pattern` from the Python mirror — the suite goes red naming the
disagreement.

### WR-02: The authored v040 source did not parse — FIXED

**Files:** `src/v040-extension.part06`, `test/v040.test.mjs`

`05-SUMMARY.md` records that parts 05 and 06 never reach the artifact and that
re-bundling is a build decision. The situation was worse than recorded: the
seven parts **joined do not parse as JavaScript**. `part06` carried

    function state(card,id){return id&&card?._hass?.states?.[id]||null:null;}

whose `?` is read as optional chaining, leaving a stray `:`. The manual workflow
that is supposed to bundle these parts could never have run.

Nobody noticed because `test/v040.test.mjs` asserts that each module is
*mentioned* — it reads the parts as text and greps for tokens. It never asked
node to read the result.

**Fixed.** The ternary is written out, and the test now runs `node --check` over
the joined source. A parse is a low bar; it is also the bar this source spent
five phases below.

## Info

### IN-01: Three plans closed without summaries

`05-01`, `05-02` and `05-03` — the whole wave-0 and RED-specification wave — had
no per-plan record. Written in this pass with the standard reconstruction
disclaimer.

## What this pass did not re-derive

The phase's four headline findings — the catalog count measured as an array
length, the router returning `candidates[0]` through obstacles, paste aliasing by
`Date.now()`, and Phase 4's control retirements never shipping — were verified by
the phase itself with evidence that runs in the suite. This pass took them as
established rather than re-running the archaeology.

Two recorded limitations still hold at head, unchanged: two diagonals in a closed
box that a lane offset cannot separate, and the v040 parts 05/06 still absent
from the artifact. The five `prompt()` naming paths are now **catalogued**
(see the T10-03 correction), though still `prompt()` rather than inline inputs.

## Evidence

| Command | Result |
|---|---|
| mechanical comparison of both runtimes' declarations | kinds 5/5, elements 17/17, attributes 47/47, limits identical |
| `node --test test/sdk-manifest.test.mjs test/sdk-parity-corpus.test.mjs` | 20 passed |
| `pytest tests/components/glt_flow_card/test_sdk_manifest.py -q` | 58 passed |
| `node --test test/v040.test.mjs` | 2 passed, including the new parse check |
| `node tools/run-unit-tests.mjs` | 526 passed |
| `node tools/run-exact-dist-playwright.mjs` | 92 passed |

## Verdict

**Issues found and fixed.** Neither warning was a security defect — both were
claims the phase stated in prose and left uncheckable, which is the failure mode
a close-out review exists to catch. T5-16 stays `planned` for the recorded
reason: its release leaf needs a Docker engine this container does not have.
