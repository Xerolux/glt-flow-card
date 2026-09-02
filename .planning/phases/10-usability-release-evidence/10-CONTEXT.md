---
phase: 10-usability-release-evidence
requirements: [I18N-01, A11Y-01, TEST-01]
---

# Phase 10 Context

## What this phase is about

Each phase has had a characteristic way of being wrong:

- Phase 6: an effect that fails silently.
- Phase 7: a number wrong in a plausible direction.
- Phase 8: a belief about the plant that is comforting and false.
- Phase 9: an answer that is incomplete and does not say so.
- **Phase 10: a claim about the product that nothing behind it supports.**

The three requirements look unrelated — localization, accessibility, release
evidence — and they are the same defect seen from three angles:

- *"The product is localized"*, when 5,561 lines of the shipped card hardcode
  German and a third locale needs code edits.
- *"The product is accessible"*, when the shipped runtime contains zero
  `aria-label` attributes and no automated check has ever run.
- *"The product handles 2,000 objects"*, when the number came from a diagnostics
  micro-test and no budget was ever recorded.

Every earlier phase produced its evidence and stated its limits. **This phase's
job is to make the claims and the evidence one artifact**, so that a capability
whose evidence failed cannot be presented as production-ready — not because
someone remembers to check, but because the claim registry refuses to build.

## Why this phase is last, and what that costs it

Nine phases deferred measured numbers here **by name**. Phase 9's bounds are
"shapes, not measurements" and say so; Phase 7 deferred report capacity; Phase 5
deferred routing capacity. Those deferrals are now due, and the honest reading
is that this phase cannot produce all of them: measured capacity requires
representative hardware, and this container is not representative of a Home
Assistant host.

That is a limit to state up front rather than to discover at the end. The
deliverable is **a budget harness with recorded numbers from a named
environment**, plus a registry that refuses to present a number measured
nowhere as a platform capacity claim. Producing a number is easy; producing a
number that says where it came from is the requirement.

## Three defects decide the shape

**D1: the bulk of the shipped card is untranslatable without code edits.**
`src/generated-bases/glt-flow-card.base.js` is 5,561 lines carrying roughly one
hundred distinct hardcoded German UI strings and zero catalog lookups. I18N-01
says *"more locales can be added without code edits"*. That is currently false,
and it is false in the largest file the product ships.

**D2: a missing translation renders silently.** Nine modules, in three different
spellings, resolve a missing key as `?? COPY.en[key] ?? key`. A German operator
sees an English sentence — indistinguishable from a term deliberately left in
English — or, one fallback later, the raw key as UI text. A missing translation
is a defect that must be *visible in a test* and invisible to nobody.

**D3: there is no accessibility evidence of any kind.** No axe, no pa11y, no
lighthouse, no automated sweep, and no recorded manual pass. The phase surfaces
built in Phases 8 and 9 use `data-*` attributes and bare `span`s, with no roles
and no accessible names — the author of those surfaces (this work) tested colour
independence and keyboard reachability by hand for some and not for others.

## What this phase must not do

**It must not turn an automated sweep into a WCAG claim.** axe-core catches a
minority of WCAG failures by construction. An "axe passes" badge presented as
"WCAG 2.2 AA" is exactly the token-only claim this phase exists to close, and
building it would be the phase committing its own characteristic defect.

**It must not measure capacity in this container and call it capacity.** A
number from an unnamed environment is worse than no number, because it cannot be
compared to anything and it invites the reader to plan around it.

**It must not retrofit accessibility by adding attributes until a checker is
quiet.** `aria-label` on an element with no role is not a name; a checker that
stops complaining is not a person who can use the product.
