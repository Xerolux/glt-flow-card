---
phase: 10-usability-release-evidence
requirements: [I18N-01, A11Y-01, TEST-01]
---

# Phase 10 Research

Three questions had to be answered before planning, because each one changes
what the phase can honestly deliver.

## 1. Can an automated checker prove WCAG 2.2 AA?

**No, and the phase must say so in the artifact rather than in a footnote.**

Automated rule engines evaluate a subset of success criteria that can be decided
from the DOM and computed styles. Everything requiring judgement — whether an
accessible name is *meaningful*, whether focus order matches reading order,
whether an error message tells a person what to do — is outside what any engine
can decide. Published estimates for the automatable share cluster around a third
of WCAG failures, and the exact figure matters less than the direction: a clean
automated run is consistent with an unusable product.

**Decision:** run an automated sweep *and* refuse to let its result be published
as an AA claim. The claim registry will carry "automated checks pass" and
"manual pass recorded on <date> by <role>" as **separate** claims with separate
evidence, because merging them is the token-only defect this phase exists to
close.

`axe-core` 4.13.0 is reachable from the registry and is the right engine: it
runs in-page, needs no service, and its rule metadata names the criterion each
violation maps to — which is what a registry entry needs to cite.

## 2. Where do capacity numbers come from?

**Not from this container, and that has to be stated in the number itself.**

A budget measured on an unnamed machine is worse than no budget: it cannot be
compared to a later run and it invites a reader to plan a plant around it. The
requirement is 100/500/2,000-object scenarios against *recorded numeric budgets
on representative browser/HA hardware*, and this environment is a shared cloud
container with no declared CPU allocation.

**Decision:** build the harness and the scenario corpus, record measurements
**with the environment fingerprint attached to every number**, and have the
registry treat a measurement whose environment is not marked representative as
evidence for "the scenario runs and is bounded" — never for "the platform
supports N objects". The second claim stays unmade until someone runs the
harness on named hardware, and the registry says so in the artifact rather than
omitting the claim.

This mirrors what Phase 9 did with its bounds: the shape of the cost is proven,
the magnitude is not claimed.

## 3. What does a pseudo-locale actually catch?

Three distinct defects, which is why it is worth more than a key-count check:

- **A missing key**, because the pseudo string is absent and the fallback shows
  through in a way a test can see.
- **A hardcoded string**, because everything localized changes shape and
  anything that does not is not going through the catalog. This is the one that
  matters here: it is how D1's hundred strings get *enumerated* rather than
  estimated.
- **A layout that assumes German length.** German is already long; a
  pseudo-locale that expands further finds the containers that only just fit.

The standard technique is accent-and-pad — `Ëxämplé Téxt » ` — which stays
readable while being unmistakably not the source string. Round-trip safety
matters: the pseudo-locale must be generated from the catalog, never checked in,
so it cannot drift from what it is testing.

**Decision:** generate the pseudo-locale at test time from the catalogs, and
make the hardcoded-string sweep an *enumeration* that fails with the list of
strings it found. A count alone lets the number creep up unnoticed.

## What was deliberately not researched

**A translation-management service, a string-extraction toolchain, or a
locale-negotiation library.** The product needs two locales to be complete and a
third to be addable by data. That is a catalog and a completeness check, not a
platform, and adding a dependency to solve it would enlarge the supply chain the
release evidence has to account for.

**Screen-reader automation.** Driving NVDA or VoiceOver is not possible here and
its absence must be recorded rather than simulated. A test asserting that an
element "would be announced correctly" is asserting a belief.
