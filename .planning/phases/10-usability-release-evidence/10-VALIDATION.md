---
phase: 10-usability-release-evidence
requirements: [I18N-01, A11Y-01, TEST-01]
---

# Phase 10 Validation

## What must be true at the end

1. One enumerable catalog per runtime, complete in German and English, with
   completeness computed rather than claimed. A missing key fails at load.
2. A pseudo-locale run enumerates every string that does not go through a
   catalog, and fails with the list rather than a count.
3. Date, time, number and unit formatting resolves from configuration or
   refuses. It never silently changes locale.
4. Plural selection is data. A locale with more than two plural forms is
   expressible without a code edit.
5. The two runtimes' wording is compared as canonical bytes, not only their
   codes.
6. Every interactive element in the exact artifact has a role, an accessible
   name and reachable, visible focus.
7. An automated sweep runs over every shipped surface, and a surface that is not
   swept fails rather than being skipped.
8. Every published claim cites a command and its result. A claim with no
   evidence fails the build; a claim whose evidence failed is published as
   failed.
9. "Automated checks pass" and "manual pass recorded" are separate claims and
   cannot be merged into a conformance statement.
10. Capacity scenarios at 100, 500 and 2,000 objects run against recorded
    budgets, and every number carries the environment it was measured in.
11. The registry names every capability that was never exercised here, and why.

## How each is checked

| Claim | Check | Vacuity guard |
|---|---|---|
| Catalog completeness | `test/catalog-completeness.test.mjs` | Removing one wording must fail the test, named. A catalog with zero keys must fail, not pass. |
| Missing key visible | `test/pseudo-locale.test.mjs` | Reintroducing a silent `?? COPY.en[key]` fallback must fail. |
| Hardcoded enumeration | `tools/verify-i18n-coverage.mjs` | Adding one hardcoded string must fail with that string in the output. |
| Locale formatting | `test/locale-formatting.test.mjs` | Restoring the `toLocaleString()` fallback must fail. |
| Wording parity | `test/catalog-parity.test.mjs` | Changing one German sentence in one runtime must fail. Compared as bytes. |
| Names, roles, focus | `phase-10-a11y` exact-dist group | A surface stripped of its role must fail. A name that is only a `title` must fail. |
| Automated sweep | `phase-10-axe` exact-dist group | A new surface not registered must fail the sweep's own coverage check. |
| Claim registry | `test/claim-registry.test.mjs` | A claim with no evidence must fail the build. A failed claim must appear as failed, not vanish. |
| Capacity budgets | `test/capacity-budgets.test.mjs` | A budget exceeded must fail. A number with no environment must be refused. |

## Effect ledger obligation

Every Phase-10 test emits a `PHASE10_*_EFFECTS` line carrying `socket`,
`service`, `remote` and `network`, all zero unless the test names them. The
capacity scenarios additionally emit the object count they actually built — a
capacity test that builds nothing and finishes quickly is the vacuous pass this
phase is most exposed to.

## What this phase will not be able to prove here

Stated now rather than discovered at the end:

- **Screen-reader behaviour.** No assistive technology can be driven in this
  environment. A test asserting that something "would be announced correctly" is
  asserting a belief, and none will be written. The registry records the manual
  half as *not performed* rather than as passing.
- **Representative capacity.** This is a shared cloud container with no declared
  CPU allocation. Numbers will be recorded with that fingerprint, and the
  registry will refuse to let them support a platform-capacity claim.
- **The composed release leaf.** No Docker engine. T10-16 stays `planned` with
  its exact failure, like every phase before it.
- **Release provenance (F-01).** All five third-party repository endpoints
  answer 403 for this session. Attaching five third-party repositories with
  credentials to satisfy a provenance check would be a disproportionate
  permission change.

Each of these becomes a *published* entry in the claim registry rather than an
omission — that is the whole point of the registry, and this phase is its first
subject.
