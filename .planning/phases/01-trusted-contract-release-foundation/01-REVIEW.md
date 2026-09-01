---
phase: 01-trusted-contract-release-foundation
reviewed: 2026-09-01T15:30:41Z
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
  critical: 5
  warning: 2
  info: 0
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-01T15:30:41Z
**Depth:** standard
**Files Reviewed:** 95
**Status:** issues_found

## Summary

The release and contract foundation has five shipping blockers. The Python canonicalizer disagrees with JavaScript for valid large JSON numbers, selected array operations can persist the wrong array, removal dependencies are reversed and can select extra destructive removals, the UI's advertised backup restore targets the newly applied snapshot, and dry-run previews retain attacker-controlled documents without any bound or expiry. Two further boundary/UI defects make valid hostile Unicode crash the Python contract path and leave a consumed preview actionable after a successful apply.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Python and JavaScript produce different canonical bytes for valid large numbers — BLOCKER

**File:** `custom_components/glt_flow_card/project_contract.py:125-143`

**Issue:** `_canonical_number` converts every integral float below `1e21` with `str(int(value))`. That prints the exact binary-float integer, while JavaScript `JSON.stringify` prints the shortest decimal that round-trips to the same Number. For example, Python canonicalizes `1.0000000000000002e20` as `100000000000000016384`, while the browser canonicalizes the same Number as `100000000000000020000`. `_parse_integer` deliberately converts JSON integers above `2^53-1` to float, so this mismatch is reachable from ordinary raw JSON as well. Consequently client/server digests diverge and a browser-created canonical `.gltproject` can be rejected by the Companion despite representing the same valid project.

**Fix:** Use an ECMAScript-compatible Number-to-String implementation in Python (or one shared, vetted canonicalization implementation) instead of `int(value)`. Add parity fixtures around `2^53`, integral floats in `[1e16, 1e21)`, subnormal values, and exponent thresholds; assert byte equality for both direct objects and raw JSON.

### CR-02: Applying multiple array deletions persists the wrong project — BLOCKER

**File:** `custom_components/glt_flow_card/project_transactions.py:277-305`

**Issue:** Diff operations are applied in sorted path order. `_copy_path` mutates list indices immediately, so earlier removals shift later indices. Removing all entries from `tags: ["a", "b", "c"]` produces operations for indices `0`, `1`, and `2`; applying them in that order leaves `tags: ["b"]`. The final contract check still passes because the residual array is structurally valid, so the incorrect content is committed and snapshotted. This affects the compatibility/full-save path, not only unusual partial selection.

**Fix:** Materialize array changes atomically from the candidate, or group operations by array parent and apply removals in descending index order before replacements/additions. Add transaction tests for shrinking arrays by two or more elements, mixed replacement/removal, nested arrays, and full compatibility saves, asserting exact equality with the candidate.

### CR-03: Removal dependency closure is reversed and can delete unselected objects — BLOCKER

**File:** `custom_components/glt_flow_card/project_diff.py:167-199`

**Issue:** For both additions and removals, `_add_dependencies` attaches referenced target operations to the referencing source operation. This is correct for additions, but backwards for removals. If a candidate removes path `p1` and equipment `e1`, selecting only `remove:/paths/p1` automatically selects `remove:/equipment/e1`. Conversely, selecting only the equipment removal does not include the path removal and later fails contract validation. A user selecting a harmless edge deletion can therefore commit an unrequested equipment deletion.

**Fix:** Keep source-to-target closure for additions. For removals, invert each reference: removal of a target must require removal of every referencing source that would otherwise dangle. Add JS and Python tests for selecting each removal independently and verify that selecting a path never expands to equipment, while selecting referenced equipment expands to its paths.

### CR-04: “Restore verified backup” rolls back to the post-apply snapshot — BLOCKER

**File:** `src/v100/project-safety.js:281-310`

**Issue:** After apply, the UI sends `state.applied.snapshot_id` to rollback. `_commit` creates that snapshot from `next_config` and returns it as the new head, so it is the configuration that was just applied, not the pre-change backup. The typed-confirmation workflow therefore creates another revision with the same post-change content and reports “backup restored,” providing no recovery from the change. New-project applies have no pre-change snapshot at all.

**Fix:** Preserve or synthesize a verified snapshot of the base configuration before committing, return an explicit `rollback_snapshot_id` (distinct from the new head snapshot), and have the UI use only that field. Add an end-to-end test using the real coordinator response that changes project content, invokes the UI rollback, and asserts the restored content equals the pre-apply base.

### CR-05: Unbounded dry-run previews allow persistent Home Assistant memory exhaustion — BLOCKER

**File:** `custom_components/glt_flow_card/project_transactions.py:113-131`

**Issue:** Every preview stores a deep copy of the user-controlled candidate in `_previews`. Candidates may be roughly 5 MiB, previews have no TTL, global/per-user limit, or replacement policy, and entries are removed only after a successful apply or integration unload. The normal “fresh dry run” UI already abandons the prior server preview. Repeated requests from any designer/admin can therefore grow the Home Assistant process without bound and eventually exhaust memory.

**Fix:** Store previews in a bounded TTL cache, cap both global and per-user/project entries and total retained bytes, invalidate the previous preview when issuing a fresh one, and remove previews on terminal conflicts/failures. Add tests with a deterministic clock that prove expiry, eviction, per-user isolation, and bounded retained bytes.

## Warnings

### WR-01: Escaped lone surrogates crash Python validation instead of failing closed — WARNING

**File:** `custom_components/glt_flow_card/project_contract.py:286-295`

**Issue:** `json.loads` accepts a JSON escape such as `"\\ud800"`, but the string metric immediately calls `value.encode("utf-8")` without handling `UnicodeEncodeError`. A validly framed hostile project thus raises out of `evaluate_project_contract` rather than returning stable contract evidence. The JavaScript runtime takes a different path, compounding parity drift.

**Fix:** Catch invalid Unicode scalar sequences during string preflight and return a stable `contract.type`/Unicode-specific issue in both runtimes, or define and implement identical escaping semantics. Add raw-byte parity fixtures for lone high/low surrogates and valid surrogate pairs.

### WR-02: The UI keeps offering a consumed preview after apply/rollback — WARNING

**File:** `src/v100/project-safety.js:349-358`

**Issue:** The apply button is shown whenever a preview exists except for three failure phases. A successful apply does not clear `state.preview` or `state.requested`, while the server has already removed that preview. The same dead action remains after rollback. Clicking it starts a second confirmation and predictably fails with `unknown preview id`, turning a successful workflow into a misleading error state.

**Fix:** Clear preview/selection state after apply and rollback, or restrict the apply action to `preview-ready`. Add an exact-dist assertion that no apply action remains after the preview is consumed and that a fresh dry run is required for another change.

---

_Reviewed: 2026-09-01T15:30:41Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
