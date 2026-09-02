---
phase: 10-usability-release-evidence
requirements: [I18N-01, A11Y-01, TEST-01]
---

# Phase 10 Patterns

Patterns this phase inherits, and the two it adds.

## Inherited, and load-bearing here

**Declare wording in both languages and throw at module load.** The `src/v100/`
surfaces already do this:

```js
for (const key of Object.keys(TEXT)) {
  for (const language of LANGUAGES) {
    if (TEXT[key][language] === undefined) {
      throw new Error(`site surfaces: "${key}" has no ${language} wording`);
    }
  }
}
```

A missing wording fails at load rather than rendering a fallback. The phase's
localization work is largely *extending this to the legacy base*, not inventing
a mechanism.

**Compare canonical bytes, never verdicts.** Four byte-parity traps in this
codebase, two of them inside Phases 8 and 9. The catalog parity check compares
serialized catalogs, not "both have the same keys".

**A limit is stated in the artifact, not in a commit message.** Every phase
summary since Phase 6 ends with what it does not prove. The claim registry is
that discipline turned into a build step.

**Filter, then limit.** Phase 9's counting-oracle rule. It reappears here: a
claim registry that omits failed claims lets their absence be read as "not
applicable" rather than "failed".

**Vacuous passes are the recurring failure.** Corrected in Phase 4 (a test
querying a card the harness never mounted), Phase 7 (an upper bound satisfied by
zero fetches) and guarded since. Every check this phase adds must be
mutation-verified: break the thing, watch the check fail, name the failure.

## Added by this phase

### Pattern A — evidence is cited, not asserted

A claim carries the command that supports it and the result of running that
command. Not "accessibility: pass" but:

```
claim:     the shipped surfaces expose accessible names
evidence:  npm run test:a11y
result:    pass, 2026-09-02, 41 surfaces swept
covers:    WCAG 2.2 4.1.2 (partial — automated subset only)
```

Three properties make it worth building rather than writing by hand:

1. **A claim with no evidence fails the build.** Not a warning: a claim nobody
   can support is exactly what the phase exists to prevent shipping.
2. **A claim whose evidence failed is published as failed**, never omitted.
   Omission reads as "not applicable" and is the counting-oracle shape one level
   up.
3. **Partial coverage is stated in the claim**, because "automated subset only"
   is the difference between this registry and a badge.

### Pattern B — a measurement carries its environment

Every recorded number carries the fingerprint of where it was measured, and the
registry decides what a number may be used for from that fingerprint:

- an unmarked environment supports "this scenario is bounded and runs";
- only an environment marked representative supports "the platform handles N".

The number is never quietly promoted by being copied into a summary. This is
Phase 9's rule — the shape of the cost is proven, the magnitude is not claimed —
made mechanical.

## Anti-patterns, named so they are refused rather than debated

**Adding `aria-label` until a checker is quiet.** A name on an element with no
role is not a name. The checker going quiet is not a person being able to use
the product, and a suppressed rule is a claim with no evidence.

**A pseudo-locale that is checked in.** It drifts from the catalog it is testing
and then tests nothing. Generate it at test time from the catalogs themselves.

**A capacity number measured here and quoted anywhere.** See Pattern B.

**Counting hardcoded strings instead of listing them.** A count lets the number
creep. The sweep fails with the strings it found, so the failure is the work
list.

**Merging "automated checks pass" with "WCAG AA".** The phase's own
characteristic defect, committed by the phase. Named here so that a reviewer can
point at this line.
