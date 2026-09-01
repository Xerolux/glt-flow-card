---
phase: 01-trusted-contract-release-foundation
plan: 11
subsystem: project-safety-ui
tags: [web-components, playwright, accessibility, i18n, semantic-diff, rollback, exact-dist, xss]

requires:
  - phase: 01-07
    provides: Authoritative preview/apply/rollback transactions with opaque identities, revision guards, verified snapshots, and recovery
  - phase: 01-09
    provides: Canonical manifest-bound build with byte-identical dist and Companion www artifacts
provides:
  - Native bilingual Project safety workflow with one Projects-adjacent entry and five accessible tabs
  - Preview-first semantic migration, dependency-locked selection, authoritative apply, conflict recovery, and typed rollback
  - Exact-dist browser evidence for keyboard, reflow, themes/media preferences, failure states, and opaque asset safety
affects: [01-12-ha-artifacts, 01-13-release-acceptance, SCHEMA-01, DIFF-01, HACS-01, T-05]

tech-stack:
  added: []
  patterns: [native modal focus containment, server-opaque mutation authority, metadata-only asset inspection, pre-browser artifact identity]

key-files:
  created:
    - src/v100/project-safety.js
    - src/v100/project-safety-i18n.mjs
  modified:
    - src/v100/entry.js
    - src/v040-extension.part01
    - src/generated-bases/glt-flow-card.base.js
    - test/e2e/fixtures/fake-ha.mjs
    - test/e2e/project-safety.spec.mjs
    - tools/run-exact-dist-playwright.mjs
    - dist/glt-flow-card.js
    - custom_components/glt_flow_card/www/glt-flow-card.js
    - custom_components/glt_flow_card/build-manifest.json

key-decisions:
  - "Keep Project safety as one native action immediately after Projects and expose validation, migration, bundles, and evidence through five tabs rather than permanent toolbar proliferation."
  - "Use local pure contract/bundle functions only for read-only inspection; every shared mutation goes through Companion preview/apply/rollback with expected revision, opaque preview or snapshot identity, stable IDs, and server-required confirmation."
  - "Render custom assets as text-only allowlisted metadata and prove no HTML, SVG, script, remote URL, Home Assistant service, or localStorage effect occurs."
  - "Fail v0.4 shared project operations closed when a present Companion rejects; retain browser-local behavior only when no WebSocket authority exists."

patterns-established:
  - "Authoritative UI mutation: preview candidate once, then apply only opaque preview ID, expected revision, project ID, and selected stable operation IDs."
  - "Exact-dist browser gate: verify build-manifest hash and dist/www byte equality before starting Chromium."
  - "Opaque inspection: untrusted project and asset values enter the DOM through textContent and active asset content is never rendered or fetched."

requirements-completed: [SCHEMA-01, DIFF-01, HACS-01]

duration: 33min
completed: 2026-09-01
---

# Phase 01 Plan 11: Project Safety UI Summary

**Bilingual five-tab Project safety workflow with raw-contract validation, authoritative preview/apply/rollback, exact-dist accessibility evidence, and metadata-only active-content handling**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-01T02:09:45Z
- **Completed:** 2026-09-01T02:42:15Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added exactly one Project safety / Projektsicherheit action adjacent to Projects, opening the approved Overview, Validate, Migrate & compare, Bundles, and Evidence tabs in a native Web Component dialog/full-screen mobile surface.
- Added raw-before-normalization validation evidence, five-category semantic diff presentation, server-declared dependency locks, preview-first selective apply, revision conflict recovery, verified receipt display, and typed-name rollback.
- Removed silent local success from the shared v0.4 ProjectStore seam while preserving explicit standalone behavior when no Companion WebSocket authority exists.
- Added pre-Chromium artifact identity checks and 18 exact-dist scenarios covering English/German, light/dark media context, mobile/200% reflow, forced colors, reduced motion, keyboard/focus, failure/conflict/rollback, and zero prohibited effects.
- Closed T-05 with opaque SVG/HTML/script/remote-URL canaries that remain inert metadata and cause no DOM injection, network request, localStorage write, Home Assistant service call, physical-bus access, or plant command.

## Task Commits

All three tasks followed RED/GREEN TDD with one post-commit provenance correction:

1. **Task 1 RED: Specify accessible Project safety shell** - `ba63e15` (test)
2. **Task 1 GREEN: Add accessible Project safety shell** - `69f2a79` (feat)
3. **Task 2 RED: Specify authoritative Project safety workflow** - `bebf98a` (test)
4. **Task 2 GREEN: Enforce preview-first project mutations** - `64babb5` (feat)
5. **Task 3 RED: Specify exact-dist UI and T-05 evidence** - `6dc5314` (test)
6. **Task 3 GREEN: Prove exact-dist Project safety states** - `9ccc194` (test)
7. **Task 3 provenance: Record clean Project safety build identity** - `75374d0` (chore)

## Files Created/Modified

- `src/v100/project-safety.js` - Native dialog, five-tab rendering, local read-only inspection, authoritative workflow state machine, focus containment, and responsive/accessibility styles.
- `src/v100/project-safety-i18n.mjs` - Approved English/German Project safety, validation, apply, conflict, and rollback copy.
- `src/v100/entry.js` - Loads Project safety after the v1 base extension and before add-ons.
- `src/v040-extension.part01` - Prevents a rejected shared ProjectStore request from silently becoming local success.
- `src/generated-bases/glt-flow-card.base.js` - Keeps the canonical authored pre-v1 base aligned with the hardened v0.4 compatibility seam.
- `test/e2e/fixtures/fake-ha.mjs` - Deterministic Companion responses, error injection, locale selection, and effect ledger.
- `test/e2e/project-safety.spec.mjs` - Eighteen exact-dist workflow, locale, keyboard, responsive, failure, rollback, and T-05 scenarios.
- `tools/run-exact-dist-playwright.mjs` - Verifies manifest/dist/www identity before Chromium and exposes immutable test evidence.
- `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js` - Canonically regenerated byte-identical runtime artifacts.
- `custom_components/glt_flow_card/build-manifest.json` - Clean committed source and artifact identities for the regenerated runtime.

## Decisions Made

- Browser validation and bundle inspection are explicitly read-only local functions. Shared persistence never uses `callService`, direct plant controls, or a localStorage rescue path.
- Server-returned closures may guide checkbox locks, but the apply request remains minimal and the Companion recomputes closure and candidate authority; no client candidate is sent after preview.
- Rollback uses the server-returned snapshot ID and current applied revision, requires the project name in the UI, and sends the backend contract's `ROLLBACK <project_id>` confirmation.
- The exact-dist runner fails before launching Chromium if the manifest does not identify the exact dist bytes or if dist and Companion www differ.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Matched the existing German Projects action structurally**
- **Found during:** Task 1 GREEN
- **Issue:** The existing v0.4 toolbar action is authored as `Projekte`, so a test looking for an English `Projects` accessible name could never prove adjacency in the current designer.
- **Fix:** Locate the established `data-g4="projects"` action and assert Project safety is its immediate next sibling while preserving exact bilingual Project safety labels.
- **Files modified:** `test/e2e/project-safety.spec.mjs`
- **Verification:** Task 1 exact-dist shell/locale suite passes 6/6.
- **Committed in:** `69f2a79`

**2. [Rule 2 - Missing Critical] Kept the canonical authored base aligned with the v0.4 no-fallback seam**
- **Found during:** Task 2 GREEN
- **Issue:** Plan 01-09 made `src/generated-bases/glt-flow-card.base.js` the canonical build input; changing only the historical v0.4 part would not harden released dist bytes.
- **Fix:** Apply the same fail-closed shared-read/write behavior to the canonical authored base, then regenerate both release copies.
- **Files modified:** `src/generated-bases/glt-flow-card.base.js`, generated card outputs
- **Verification:** Shared rejection test records no localStorage or service effect; exact-dist mutation suite passes 6/6.
- **Committed in:** `64babb5`

**3. [Rule 1 - Provenance Drift] Rebuilt the manifest after Task 3 commit**
- **Found during:** Task 3 post-commit check
- **Issue:** The pre-commit build correctly recorded a transient dirty source identity rather than the just-created Task 3 commit.
- **Fix:** Re-run the canonical build from a clean tree and commit the resulting clean source identity without changing card bytes.
- **Files modified:** `custom_components/glt_flow_card/build-manifest.json`
- **Verification:** Manifest records commit `9ccc194baa1c609b2b07f8fe0e1c9405af7c16aa` with `dirty: false`; independent release verification passes.
- **Committed in:** `75374d0`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 correctness/provenance fixes, 1 Rule 2 missing critical source alignment)
**Impact on plan:** All fixes were required to test the existing designer accurately, harden the actual canonical release source, or preserve exact provenance. No UI scope, backend architecture, dependency, endpoint, authentication path, plant surface, physical-bus operation, or live Home Assistant access was added.

## Issues Encountered

- Playwright's shadow-DOM locator initially searched for the dialog inside itself during the responsive assertion; the bounded failure identified the exact selector and the test was corrected without changing product behavior.
- PowerShell does not expand Python wildcards for `py_compile`; the equivalent repository-wide `py -3.13 -m compileall -q custom_components/glt_flow_card` gate passed.

## Verification

- `npm run build && npm run test:e2e -- --grep="shell|validate|bundles|evidence|keyboard|locale"` - Task 1 exact-dist behavior passed 6/6.
- `npm run build && npm run test:e2e -- --grep="migrate|diff|selective apply|conflict|rollback|no fallback|no service"` - Task 2 exact-dist behavior passed 6/6.
- `npm run build && npm run test:e2e -- --grep="opaque asset|xss|network|no service" && npm run test:e2e` - T-05 owner slice passed 2/2 and the complete exact-dist suite passed 18/18.
- `npm run verify:release` - independent double-build, checked-in output, one-byte drift, version drift, generated-schema drift, and missing-output checks passed.
- `npm test` - complete Node suite passed 74/74.
- `py -3.13 -m compileall -q custom_components/glt_flow_card` - Companion Python sources compiled.
- `npm run check` - generated browser runtime syntax passed.
- `git diff --check` - no whitespace errors.

## TDD Gate Compliance

- Task 1 RED `ba63e15` failed because the Projects-adjacent Project safety action did not exist; GREEN `69f2a79` passed shell, validation, metadata, evidence, keyboard, and locale behavior.
- Task 2 RED `bebf98a` failed because no dry-run/apply/rollback UI existed; GREEN `64babb5` passed preview ordering, categories, dependency locks, minimal authority payloads, conflicts, rollback, and no-fallback behavior.
- Task 3 RED `6dc5314` failed because the runner exposed no pre-Chromium manifest identity; GREEN `9ccc194` passed the full exact-dist state/accessibility/T-05 matrix.
- No refactor-only commit was necessary.

## Known Stubs

None. The scan found only intentional initialized state/effect collections and compatibility defaults; no TODO, FIXME, coming-soon text, empty UI data source, or goal-blocking placeholder was introduced.

## Threat Flags

None. The new browser file reads are the planned exact-dist gate and the UI WebSocket operations are the planned T-01/T-02 supporting surface. No unplanned network endpoint, auth path, file extraction, schema boundary, service call, remote action, fieldbus access, or plant write was introduced.

## Authentication Gates

None.

## User Setup Required

None - the exact-dist runner and fake Companion are hermetic and require no live Home Assistant, credentials, browser session, physical bus, or plant access.

## Next Phase Readiness

- Plan 01-12 can execute isolated Home Assistant artifact/lifecycle tests against manifest-identified Project safety bytes and the authoritative Companion transaction APIs.
- Plan 01-13 can consume the exact-dist T-05 evidence, clean build identity, HACS stages, and release verifier without rebuilding a different UI artifact.

## Self-Check: PASSED

- Both created modules and all declared exact-dist/generated artifacts exist.
- All seven Task 1/Task 2/Task 3 RED, GREEN, and provenance commits resolve in git history.
- Canonical build, T-05 owner slice, complete 18-test exact-dist suite, independent release verification, complete 74-test Node suite, Companion compilation, syntax, and whitespace gates passed.
- Stub and threat-surface scans found no goal-blocking stub or unplanned trust boundary.
- Working tree was clean immediately before summary creation.

---
*Phase: 01-trusted-contract-release-foundation*
*Completed: 2026-09-01*
