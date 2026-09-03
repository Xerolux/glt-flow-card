---
phase: 10-usability-release-evidence
reviewed: 2026-09-03
head: d0e8b49
depth: standard
reviewer: close-out review pass
method: read at head, plus adversarial probes of the overclaim guards and the i18n sweep
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
fixed_in_this_pass: 1
status: issues_found_and_fixed
---

# Phase 10: Code Review Report

**Scope.** `tools/claim-registry.mjs`, `.planning/claims.json`,
`tools/verify-i18n-coverage.mjs`, `tools/capacity-harness.mjs`,
`src/v100/catalog-lookup.mjs`, `catalog-de.mjs`, `catalog-en.mjs`,
`locale-format.mjs`, `status-colours.mjs`, `element-registry.mjs`, and the two
product a11y specs.

## Summary

The overclaim machinery — the phase's real product — holds under adversarial
probing. One critical finding: the i18n sweep printed PASS over eleven strings
it could not see.

## Critical

### CR-01: The i18n sweep had a blind spot, and I closed T10-03 on it — FIXED

**File:** `tools/verify-i18n-coverage.mjs`

`verify-i18n-coverage.mjs` reported PASS while eleven German labels sat in the
shipped artifact: `Projektname`, `Vorlagenname`, `Gruppenname`, `Layername`,
`Aufgabe`, `Reportname`, `Zeitraum: day / week / month / year`, `⚡ Energie`,
`▤ Reports`, and two z-order buttons.

The sweep's test for "does a person read this" was **linguistic**: `PROSE`
requires two whitespace-separated words and `GERMAN` requires an umlaut or a
stop word. A single German label with neither is invisible to it, and
`⚡ Energie` begins with a glyph so it does not read as two words either. No
amount of tuning that regex would have found them — the detector was asking the
wrong kind of question.

This is my own finding against my own work: T10-03 was reported met on this
sweep's PASS.

**Fixed.** A second, **structural** sweep runs beside the linguistic one and
asks where the literal *went* rather than what it looks like: any bare string
handed to `prompt`, `confirm`, `alert`, `.textContent` or `.innerText` reaches a
person whatever its shape. Its allowlist carries a higher bar than the first
sweep's — the string **is** displayed, so the reason must be that it reads the
same in both languages, not that it is not really UI.

Nine keys added and the sites rewritten. The two z-order buttons turned out to
have no accessible name at all — a screen reader announced "up arrow Z" — so
they keep the glyph and gain `title` and `aria-label` from the catalog, and the
glyph is allowlisted naming the key that speaks for it.

Mutation-checked against the exact blind spot: putting the single word
`Layername` back into a `textContent` turns the sweep red where the linguistic
sweep alone stays green.

## Probed and sound

**T10-10, conformance overclaim.** `validateClaim` was probed with four claims:

| Claim | Kind | Result |
|---|---|---|
| "The product is WCAG 2.2 AA conformant." | command | **refused** |
| "The product is compliant with the accessibility standard." | command | **refused** |
| "The product is WCAG 2.2 AA conformant." | manual | **refused** — a manual claim must record who performed it and when |
| "An automated rule engine reports no violations." | command | accepted |

The third row is the one that matters: conformance wording is not merely
redirected to the manual track, it still has to name a person and a date.

**T10-12, failed evidence published as failed.** The registry's own output ends
"2 claim(s) failed. They are published as failed, not omitted." — observed
during this pass on a transiently stale stage, and both passed again at a clean
head. Absence would have read as "not applicable"; a published failure cannot.

**T10-17, what was never exercised.** Four claims stand at `not-exercised` with
the reason each would need: the manual assistive-technology pass, capacity
measured on named hardware, installation on the pinned HA lanes, and dependency
provenance. Each says what would satisfy it rather than that it is blocked.

**T10-02, a missing translation.** `catalog-lookup.text()` **throws** for an
unknown language, an undeclared key or a key with no wording in that language —
there is no English fallback to hide behind. The one deliberate softening is the
SDK bridge in `glt-flow-card.base.js`, which falls back to the raw key, and the
comment states the reasoning: "a raw key on screen is visibly wrong, where a
German sentence in an English interface looks deliberate."

## Evidence

| Command | Result |
|---|---|
| `node tools/verify-i18n-coverage.mjs` | PASS, both sweeps |
| the same, with `Layername` reinserted into a `textContent` | FAIL, naming the sink |
| `node --test` over the six Phase-10 owner modules | 45 passed |
| `node tools/claim-registry.mjs` | 15 passed, 0 failed, 4 not exercised at a clean head |
| `node tools/run-exact-dist-playwright.mjs` | 92 passed |

## Verdict

**Issues found and fixed.** The finding is a good advertisement for the phase's
own thesis: a claim is worth what its evidence measures, and the evidence here
was measuring the wrong property confidently. T10-16's release leaf is unrun
here for the standing reason.
