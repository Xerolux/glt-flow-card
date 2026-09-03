---
phase: 10-usability-release-evidence
requirements: [I18N-01, A11Y-01, TEST-01]
---

# Phase 10 Source Audit

Sixteen locatable defects across localization, accessibility and release
evidence. Every count below was produced by a command at head, not estimated.

## Localization

**D1 — the largest shipped file is untranslatable.**
`src/generated-bases/glt-flow-card.base.js` is **5,561 lines** and carries about
**one hundred distinct hardcoded German UI strings**:

```
>Aktion<  >Alarme<  >Alle Standorte<  >Betriebsstunden<  >Duplizieren<
>Löschen<  >Orthogonale Verbindung erstellen<  >Quittieren<  >Rechte<  …
```

It contains **zero** catalog lookups. I18N-01 requires that "more locales can be
added without code edits"; for this file, every locale is a code edit. This is
the phase's headline, and it is a volume problem rather than a design problem —
the newer `src/v100/` surfaces already do it correctly.

**D2 — a missing translation renders silently, in three different spellings.**

```js
return table[key] ?? COPY.en[key] ?? key;          // project-alarms, -catalog, -designer, -operations
const entry = TEXT[key]?.[language] ?? TEXT[key]?.en;  // project-assets, -sites, -trends
const value = COPY[locale]?.[key] ?? COPY.en[key] ?? key;  // project-safety-i18n
```

Nine modules. A German operator gets an English sentence, indistinguishable from
a term deliberately kept in English; one fallback further and they get the raw
key rendered as UI text. Neither is detectable from the outside, which is
precisely why a pseudo-locale run is the only honest check.

**D3 — `formatDateTime` falls back to the viewer's locale.**

```js
function formatDateTime(value, locale = "de-DE") {
  try { return new Intl.DateTimeFormat(locale, {...}).format(new Date(value)); }
  catch (_err) { return new Date(value).toLocaleString(); }
}
```

On any error the timestamp is formatted in the **browser's** locale while the
rest of the screen uses the configured one. Two date formats on one control-room
screen is an ambiguity defect: `03/09` and `09/03` are the same instant written
two ways, and nothing marks which is which. The default `"de-DE"` is also
hardcoded rather than derived from configuration.

**D4 — plurals are inline conditionals.**

```js
`Abdeckung ${percent} % · ${gaps} ${gaps === 1 ? "Lücke" : "Lücken"}`
```

Correct for German and English, a code edit for every other locale, and wrong
for any language with more than two plural forms.

**D5 — wording exists twice with no parity check.** The Companion holds German
and English wording in `period_vocabulary.py`, `dispatch_gate.py` and others;
the browser holds its own tables. The existing parity gates compare **codes**
(`site_vocabulary`, `dispatch_vocabulary`, `period_vocabulary` fingerprints) and
never the human-readable text, so the two runtimes can and do drift in what they
*say* while agreeing on what they *mean*.

**D6 — there is no catalog.** Wording lives in at least fourteen modules across
two runtimes. "Complete German and English catalogs" cannot be verified as
complete because nothing enumerates what the complete set is.

**D7 — no pseudo-locale, no missing-key test, no RTL readiness check** exists
anywhere in the suite.

## Accessibility

**D8 — zero `aria-label` in the shipped legacy runtime.** A grep over
`glt-flow-card.base.js` returns 0 for `aria-label` against 5 `placeholder=` and
3 `title=` attributes. A `title` is not an accessible name for a control, and a
`placeholder` disappears on input.

**D9 — the two newest surfaces have no roles at all.** `project-assets.js`
(Phase 8) and `project-sites.js` (Phase 9) render `span` and `ul` elements with
`data-*` attributes and no `role`, no `aria-*`, and no accessible names. This is
this work's own gap, not inherited: the tests those phases wrote check colour
independence and text content, which is necessary and not sufficient.

**D10 — no automated accessibility check exists.** No `axe-core`, no `pa11y`, no
`lighthouse` in `node_modules` or `package.json`. Some phase suites assert
keyboard reachability for their own surfaces; nothing sweeps the product.

**D11 — no recorded manual pass.** A11Y-01 asks for "manual plus automated
assistive-technology evidence". Nothing recorded exists in either half.

**D12 — contrast is unproven.** Several phases assert that state is conveyed
*without* colour, which is the harder and more important property, and none
computes a contrast ratio from resolved styles.

## Release evidence

**D13 — there is no claim registry.** Nothing links a statement in the READMEs
or wiki to the evidence that supports it. The failure mode is already present:
`README.md` says "`test/` – lightweight validation tests" while the suite is 476
Node, 691 Python and 81 browser tests. A stale claim in the harmless direction
today is a stale claim in the harmful direction tomorrow.

**D14 — no capacity harness and no recorded budgets.** No tool in `tools/`
measures render, update, routing, editing, persistence, remote partial failure,
memory or latency, and no budget file exists. The roadmap's own "known defect"
for this phase names the shape: a 2,000-object diagnostics micro-test presented
as platform capacity.

**D15 — package checksums exist and are the exception.** `stage-hacs-packages`
and `validate-hacs-staging` already compute per-member and per-ZIP SHA-256 and
compare them, and `verify-release` checks artifact, source, schema and validator
hashes. This half of TEST-01 is largely built; the audit records it so the phase
does not rebuild what it has.

**D16 — the release leaf has never run in this environment.** Eight phases carry
a `planned` row for the same reason: `test:ha-artifacts` probes `docker info`
across twelve bounded lane candidates and there is no Docker engine here. Phase
10 owns the honest statement of what that means for a release claim; it cannot
own making Docker appear.

## What is already right

The `src/v100/` surfaces built in Phases 3 through 9 declare wording in both
languages and **throw at module load** when a key lacks a language:

```js
if (TEXT[key][language] === undefined) {
  throw new Error(`site surfaces: "${key}" has no ${language} wording`);
}
```

That is the pattern the rest of the product needs, and it means the phase's
localization work is mostly *extension of an existing pattern to the legacy
base*, not invention.
