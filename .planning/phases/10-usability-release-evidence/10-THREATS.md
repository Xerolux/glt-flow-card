---
phase: 10-usability-release-evidence
status: closed
asvs_level: 1
asvs_version: 5.0.0
requirements: [I18N-01, A11Y-01, TEST-01]
---

# Phase 10 Threat Register

Phase 7's threats concerned numbers wrong in a plausible direction, Phase 8's
beliefs that are comforting and false, Phase 9's answers that are incomplete and
do not say so.

**Phase 10's concern a claim about the product that nothing behind it
supports** — and the most dangerous instance is a claim this phase itself would
make: an automated sweep published as a WCAG conformance statement, or a number
measured in a shared container published as platform capacity.

No test may contact a live Home Assistant, Recorder, remote site, fieldbus,
plant target or notification recipient. Capacity scenarios run against fixtures.

## ASVS L1 Mapping

| ASVS L1 area | Phase-10 rows |
|---|---|
| V1 Architecture | T10-01, T10-14 |
| V5 Validation | T10-02, T10-03 |
| V7 Error handling and logging | T10-04, T10-05 |
| V11 Business logic | T10-09, T10-10, T10-11, T10-12, T10-13 |
| V14 Configuration / supply chain | T10-15, T10-16, T10-17 |

## Canonical Threats

| ID | Category | Threat and the guarantee that closes it | Plan | Owner command | Status |
|---|---|---|---|---|---|
| T10-01 | Integrity | Wording lives in fourteen modules across two runtimes, so "complete German and English catalogs" cannot be checked for completeness. One enumerable catalog per runtime, and completeness is a computation rather than a claim. | 10-02 | `node --test test/catalog-completeness.test.mjs` | ✅ verified |
| T10-02 | Integrity | A missing translation renders the English string or the raw key, indistinguishable from a deliberate choice. A missing key fails at load, and the pseudo-locale run proves the failure is reachable. | 10-03 | `node --test test/pseudo-locale.test.mjs` | ✅ verified |
| T10-03 | Integrity | Roughly one hundred hardcoded German strings in `glt-flow-card.base.js` mean a third locale is a code edit. The sweep enumerates every string that does not go through a catalog and fails with the list. | 10-04 | `node tools/verify-i18n-coverage.mjs` | ❌ not met |
| T10-04 | Integrity | `formatDateTime` falls back to the viewer's locale on error, so one screen shows two date formats and neither says which. Formatting resolves from configuration or refuses; it never silently changes locale. | 10-05 | `node --test test/locale-formatting.test.mjs` | ✅ verified |
| T10-05 | Integrity | Plurals are inline conditionals, correct for two languages and a code edit for every other. Plural selection is data, and a locale with more than two forms is expressible without code. | 10-05 | `node --test test/locale-formatting.test.mjs` | ✅ verified |
| T10-06 | Integrity | The Companion and the browser hold separate wording and only their *codes* are compared, so the two runtimes drift in what they say while agreeing on what they mean. Wording parity is compared as canonical bytes. | 10-06 | `node --test test/catalog-parity.test.mjs` | ✅ verified |
| T10-07 | Accessibility | The shipped runtime contains no accessible names, so controls are announced by their markup or not at all. Every interactive element has a name, a role and a reachable focus, asserted in the exact artifact. | 10-08 | `node tools/run-exact-dist-playwright.mjs --grep=phase-10-a11y` | ✅ verified |
| T10-08 | Accessibility | The Phase-8 and Phase-9 surfaces have no roles at all — this work's own gap. Structures that carry meaning carry a role, and lists of absent sites and assets are announced as lists. | 10-08 | `node tools/run-exact-dist-playwright.mjs --grep=phase-10-a11y` | ✅ verified |
| T10-09 | Accessibility | No automated accessibility check exists. A sweep runs over every shipped surface in the exact artifact, and a new surface that is not swept fails rather than being skipped. | 10-09 | `node tools/run-exact-dist-playwright.mjs --grep=phase-10-axe` | ✅ verified |
| T10-10 | Safety / Overclaim | **An automated sweep is published as WCAG 2.2 AA conformance.** Automated rules decide a minority of criteria by construction. "Automated checks pass" and "manual pass recorded" are separate claims with separate evidence, and the registry refuses to merge them. | 10-11 | `node --test test/claim-registry.test.mjs` | ✅ verified |
| T10-11 | Safety / Overclaim | A claim in the READMEs or wiki has no evidence behind it, and stays true-sounding after it stops being true. Every published claim cites a command and its result; a claim with no evidence fails the build. | 10-11 | `node --test test/claim-registry.test.mjs` | ✅ verified |
| T10-12 | Safety / Overclaim | A claim whose evidence failed is omitted rather than published as failed, so its absence reads as "not applicable". Failed claims are published as failed. | 10-11 | `node --test test/claim-registry.test.mjs` | ✅ verified |
| T10-13 | Safety / Overclaim | **A number measured in an unnamed container is quoted as platform capacity.** Every measurement carries its environment fingerprint, and only an environment marked representative supports a capacity claim. | 10-13 | `node --test test/capacity-budgets.test.mjs` | ✅ verified |
| T10-14 | Denial | The capacity scenarios have no budgets, so a regression that doubles render time passes. 100/500/2,000-object scenarios run against recorded budgets and fail when a budget is exceeded. | 10-13 | `node --test test/capacity-budgets.test.mjs` | ✅ verified |
| T10-15 | Tampering / Supply chain | A new dependency enlarges the supply chain the release evidence must account for, unpinned or unrecorded. Every dependency is pinned exactly and appears in the release evidence. | 10-09 | `npm run verify:release` | ✅ verified |
| T10-16 | Tampering / Supply chain | Authored source, generated card, Companion copy, HACS stage/ZIP, HA lanes, docs or release evidence diverge; or a test reaches a live socket or exceeds a declared bound. Build once, compare exact bytes, install the exact stage, fail on any unintended effect. | 10-15 | `npm run test:phase10:release` | ⏳ planned |
| T10-17 | Repudiation | The release evidence does not state which capabilities were never exercised in this environment, so a reader assumes they were. The registry names every unexercised capability and why. | 10-14 | `node --test test/claim-registry.test.mjs` | ✅ verified |

## Evidence Status

Every row begins `planned`. No row may be marked `verified` from planning alone,
nor from its parts passing separately, nor from a sibling row naming the same
command.

**A row is marked from its own owner command, run at head.** Where rows share a
command, the command is run for each row.

**An artifact grep is not evidence that a surface works.** Any row whose evidence
is a grep needs a second assertion that renders the surface and reads the value.

T10-16 is expected to stay `planned` for the same reason T9-20, T8-25, T7-23,
T6-21, T5-16, T4-14, T3-14 and T2-16 did: its owner is the composed release
leaf, which needs a Docker engine this container does not have.

## Closure Record

Closed 2026-09-02 at head. Every marked row was marked from **its own** run of
its own owner command; where four rows name `test/claim-registry.test.mjs`, that
command was run four times.

| Command | Rows | Result |
|---|---|---|
| `test/catalog-completeness.test.mjs` | T10-01 | 8 passed |
| `test/pseudo-locale.test.mjs` | T10-02 | 7 passed |
| `tools/verify-i18n-coverage.mjs` | T10-03 | **FAIL, 132 strings named** |
| `test/locale-formatting.test.mjs` | T10-04, T10-05 | 8 passed (×2) |
| `test/catalog-parity.test.mjs` | T10-06 | 4 passed |
| `--grep=phase-10-a11y` | T10-07, T10-08 | 8 passed (×2) |
| `--grep=phase-10-axe` | T10-09 | 3 passed |
| `test/claim-registry.test.mjs` | T10-10, T10-11, T10-12, T10-17 | 10 passed (×4) |
| `test/capacity-budgets.test.mjs` | T10-13, T10-14 | 8 passed (×2) |
| `npm run verify:release` | T10-15 | passed |
| `npm run test:phase10:release` | T10-16 | **blocked** |

### T10-03 is `not met`, not `planned`

This is the phase's own discipline applied to itself. The row is not marked
verified, and it is not quietly left `planned` either — `planned` reads as work
not started, and this work started and did not finish.

132 user-facing strings in the shipped artifact still do not come from a
catalog: the two generated bases of the legacy card and the entry module. The
sweep names each one, and the claim registry publishes the corresponding claim
**as failed** rather than omitting it.

What was completed: 683 catalog keys across eight surface modules, four
vocabulary modules, the whole symbol catalog and the legacy card's separate
symbol library — including the English half of 208 labels that existed nowhere
in the product before.

### T10-16 stays `planned`, with its exact failure

```
failed to connect to the docker API at unix:///var/run/docker.sock; check if the
path is correct and if the daemon is running: dial unix /var/run/docker.sock:
connect: no such file or directory
FAIL minimum probe HA 2024.10.0: docker info --format
{{.ServerVersion}}/{{.OSType}}/{{.Architecture}} failed with status 1
...
Error: no supported Home Assistant lane passed within 12 bounded candidates
    at resolveLanePlan (tools/resolve-ha-lanes.mjs:210:11)
```

The same limitation recorded for T9-20, T8-25, T7-23, T6-21, T5-16, T4-14,
T3-14 and T2-16. Raised rather than taken: not marked from its parts passing
separately.

### Limitations of this closure

- **No manual accessibility evidence exists.** No assistive technology can be
  driven here, so T10-07 through T10-09 cover only what a machine can decide.
  The registry publishes the manual half as *not performed*, and no conformance
  statement is supportable regardless of what the automated sweep reports.
- **The capacity numbers are not capacity.** They were measured in a shared
  container with no declared CPU allocation, and the budget file records that
  they support "scenario-is-bounded" rather than "platform-capacity".
- **Release provenance (F-01) is blocked** for this session, which blocks the
  Phase-1 gate and every gate recursing into it — so no phase gate from 2 upward
  has ever completed its recursion in this environment.
- **T10-03 is unfinished**, stated above rather than rounded off.

## The rows this phase must be most suspicious of

T10-10 and T10-13 are the phase auditing itself. Both describe a claim this
phase is in a position to make and would be believed about. They are the reason
the registry is a build step rather than a document: a document is edited by
whoever wants the claim.

## Blocking Rule

A published claim with no evidence, a failed claim published as passing, an
automated sweep presented as conformance, a capacity number without its
environment, an unpinned dependency, or a non-zero unintended effect blocks
release.
