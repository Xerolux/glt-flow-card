---
phase: 01-trusted-contract-release-foundation
reviewed: 2026-09-01T17:03:30Z
depth: standard
files_reviewed: 95
files_reviewed_list:
  - .github/workflows/build-v1.yml
  - .github/workflows/hacs.yml
  - .github/workflows/release.yml
  - .github/workflows/validate.yml
  - .gitignore
  - custom_components/glt_flow_card/__init__.py
  - custom_components/glt_flow_card/build-manifest.json
  - custom_components/glt_flow_card/config_flow.py
  - custom_components/glt_flow_card/const.py
  - custom_components/glt_flow_card/diagnostics.py
  - custom_components/glt_flow_card/manifest.json
  - custom_components/glt_flow_card/project_bundle.py
  - custom_components/glt_flow_card/project_contract.py
  - custom_components/glt_flow_card/project_diff.py
  - custom_components/glt_flow_card/project_migrations.py
  - custom_components/glt_flow_card/project_repository.py
  - custom_components/glt_flow_card/project_transactions.py
  - custom_components/glt_flow_card/strings.json
  - custom_components/glt_flow_card/translations/de.json
  - custom_components/glt_flow_card/translations/en.json
  - custom_components/glt_flow_card/www/glt-flow-card.js
  - dist/glt-flow-card.js
  - docs/wiki/Companion-Backend.md
  - docs/wiki/Installation.md
  - docs/wiki/YAML-Projects.md
  - package.json
  - packaging/hacs-integration/hacs.json
  - packaging/hacs-integration/README.md
  - packaging/hacs-plugin/hacs.json
  - playwright.config.mjs
  - pytest.ini
  - README.de.md
  - README.md
  - requirements-test.txt
  - schemas/bundle-manifest.schema.json
  - schemas/diff-policy.json
  - schemas/limits.json
  - schemas/project/0.schema.json
  - schemas/project/1.schema.json
  - schemas/project/2.schema.json
  - src/generated-bases/editor-app.base.js
  - src/generated-bases/glt-flow-card.base.js
  - src/v040-extension.part01
  - src/v100/core.mjs
  - src/v100/entry.js
  - src/v100/generated/project-validators.mjs
  - src/v100/index.js
  - src/v100/project-bundle.mjs
  - src/v100/project-contract.mjs
  - src/v100/project-diff.mjs
  - src/v100/project-migrations.mjs
  - src/v100/project-safety-i18n.mjs
  - src/v100/project-safety.js
  - test/contract-fixtures.test.mjs
  - test/e2e/fixtures/fake-ha.mjs
  - test/e2e/project-safety.spec.mjs
  - test/fixtures/contracts/manifest.json
  - test/ha-lanes.test.mjs
  - test/hacs-staging.test.mjs
  - test/phase1-gate.test.mjs
  - test/provenance.test.mjs
  - test/release-build.test.mjs
  - test/v100-backend.test.mjs
  - test/v100-bundle.test.mjs
  - test/v100-contract.test.mjs
  - test/v100-core.test.mjs
  - test/v100-diff.test.mjs
  - test/v100-migrations.test.mjs
  - tests/components/glt_flow_card/conftest.py
  - tests/components/glt_flow_card/test_diagnostics.py
  - tests/components/glt_flow_card/test_init.py
  - tests/components/glt_flow_card/test_options.py
  - tests/components/glt_flow_card/test_project_bundle.py
  - tests/components/glt_flow_card/test_project_contract.py
  - tests/components/glt_flow_card/test_project_diff.py
  - tests/components/glt_flow_card/test_project_migrations.py
  - tests/components/glt_flow_card/test_project_repository.py
  - tests/components/glt_flow_card/test_project_transactions.py
  - tests/components/glt_flow_card/test_websocket.py
  - tools/apply-v100.mjs
  - tools/assert-red.mjs
  - tools/build.mjs
  - tools/compare-contract-runtimes.mjs
  - tools/generate-contract-fixtures.mjs
  - tools/generate-project-validators.mjs
  - tools/provenance-allowlist.json
  - tools/resolve-ha-lanes.mjs
  - tools/run-exact-dist-playwright.mjs
  - tools/stage-hacs-packages.mjs
  - tools/test-ha-artifacts.mjs
  - tools/validate-hacs-staging.mjs
  - tools/verify-phase1.mjs
  - tools/verify-provenance.mjs
  - tools/verify-release-acceptance.mjs
  - tools/verify-release.mjs
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-01T17:03:30Z
**Depth:** standard
**Files Reviewed:** 95
**Status:** issues_found

## Summary

The final review of HEAD `76af1b2` confirms that all 13 findings from the three prior review/fix rounds are corrected in their reported cases. In particular, randomized full-selection checks preserved exact candidates across 300 mixed array shapes, the committed transaction tests cover double-digit and nested growth, dependency closure and rollback identity pass, equal-clock preview eviction retains the newest authority, cross-runtime contract parity passes for 73 fixtures, the exact-distribution Project Safety suite passes 18/18, the Python Companion suite passes 87/87, the default Node suite passes 93/93 from a clean clone without ignored release or planning evidence, and the tracked-export build/stage/test gate passes.

The integrated tree is still not shippable because transaction completion is acknowledged internally before its authoritative audit projection is durable. An audit-store failure after the head and COMMITTED journal are persisted returns an error to the client even though the project mutation succeeded, and startup recovery will not repair the missing audit event.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Audit persistence failure reports a failed apply after committing the project — BLOCKER

**Files:** `custom_components/glt_flow_card/project_transactions.py:598-604`, `custom_components/glt_flow_card/project_transactions.py:635-680`, `custom_components/glt_flow_card/project_repository.py:448-451`

**Issue:** `_commit` persists and verifies the new snapshot and head, changes the journal to `COMMITTED`, and only then awaits `_audit`. If the independent audit store fails, the exception escapes from `apply`/`rollback` after the authoritative mutation has already committed. A direct failure injection reproduces `OSError: audit store unavailable` at the client boundary while the head has advanced from revision 1 to 2 and the journal is `COMMITTED`. No new audit event is durable. `async_recover` scans only `PREPARED` journals, so a restart cannot reconstruct that missing authoritative event. This creates a false failure response that can trigger unsafe retries and permanently loses the server-owned audit record required for a shared mutation.

**Fix:** Make audit completion part of the recoverable transaction protocol. Keep the journal recoverable until an idempotent audit event keyed by transaction ID is durably persisted, then mark it `COMMITTED`; alternatively introduce an explicit audit-pending state and repair it during startup before availability. Repository audit insertion must de-duplicate by deterministic event ID so replay is safe. Add failure-injection tests immediately before/during audit persistence and after restart, asserting exactly one audit event, a consistent client result, and a verified final head.

---

_Reviewed: 2026-09-01T17:03:30Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
