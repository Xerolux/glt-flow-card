# Phase 1: Trusted Contract & Release Foundation - Pattern Map

**Mapped:** 2026-08-31  
**Scope:** SCHEMA-01, DIFF-01, HACS-01  
**Authored targets mapped:** 38 file groups; generated `dist/`, Companion `www/`, and the appended `docs/editor/app.js` section remain outputs.

## File Classification

| New/modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `schemas/project-v0.schema.json`, `schemas/project-v1.schema.json`, shared `$defs` | config/model | transform | serialized shape normalized by `src/v100/core.mjs:33-61`; catalog unions in `src/v100/catalog.mjs` | data-shape |
| `schemas/limits.json`, `schemas/diff-policy.json` | config | transform | constants/defaults in `src/v100/core.mjs:4-26`; backend limits in `custom_components/glt_flow_card/const.py:1-10` | convention |
| `test/fixtures/contracts/**` + expectation manifest | test fixture | batch | inline fixtures in `test/v100-core.test.mjs:11-70`; examples under `examples/` | role-match |
| `src/v100/contract.mjs` | utility/model | transform | `src/v100/core.mjs:28-68,279-299` | exact role |
| `src/v100/generated/project-validators.mjs` | generated utility | transform | bundled-source input/output pattern in `tools/apply-v100.mjs:3-17` | build-match |
| `custom_components/glt_flow_card/contract.py` | adapter/utility | transform | typed boundary helpers in `custom_components/glt_flow_card/__init__.py:33-107` | role-match |
| `src/v100/canonical-json.mjs` and Python equivalent | utility | transform | defensive `clone` and plain serializable returns in `src/v100/core.mjs:28-31` | convention |
| `src/v100/migrations/*.mjs` | utility/model | transform | `migrateProject` in `src/v100/core.mjs:64-68` | replacement seam |
| `src/v100/project-diff.mjs` | service/utility | transform | `projectDiff` in `src/v100/core.mjs:331-348` | exact role, insufficient behavior |
| `src/v100/project-bundle.mjs` | service/utility | file-I/O | `makeProjectBundle` / `readProjectBundle` in `src/v100/core.mjs:350-366` | exact role, unsafe baseline |
| `custom_components/glt_flow_card/project_repository.py` | repository | CRUD | `GltStore.projects/project/save_project` in `__init__.py:149-186` | exact role |
| `custom_components/glt_flow_card/project_transactions.py` | service | transactional CRUD/file-I/O | revision/version handling in `__init__.py:158-186`; audit at `138-147` | partial |
| split repository/store modules (`projects`, `history`, `audit`, `runtime`, `journal`) | repository/model | CRUD | `GltStore` data/default/load/save at `__init__.py:109-136` | extraction seam |
| `custom_components/glt_flow_card/diagnostics.py` | provider | request-response | explicit safe response DTOs in WebSocket handlers; no current diagnostics module | partial |
| `custom_components/glt_flow_card/__init__.py` | provider/lifecycle | event-driven | `_ensure_manager`, setup, entry setup/unload at `662-695` | exact modification seam |
| `custom_components/glt_flow_card/config_flow.py` | config/provider | request-response | current single-instance flow/options at `11-41` | exact |
| `src/v100/project-safety.js` (or focused UI module imported by `entry.js`) | component/provider | request-response | guarded component decoration and helpers in `src/v100/index.js:1-18`; modal helper in `v1-addons.js:4-8` | role-match |
| `src/v100/entry.js`, `src/v100/index.js` | route/entry + component integration | event-driven | current ordered side-effect imports and guarded prototype seam | exact modification seam |
| `tools/build.mjs` | build utility | file-I/O/batch | `tools/apply-v100.mjs:1-35`; explicit esbuild command in `build-v1.yml:34-40` | role-match |
| `tools/verify-release.mjs` | verification utility | file-I/O/batch | generated token checks in `build-v1.yml:45-53`; release packaging in `release.yml:19-29` | replacement seam |
| release manifest/checksum files | config/evidence | batch | package/manifest versions in `package.json:2-3`, integration manifest `:1-9`, runtime version check in build workflow | data-shape |
| `test/v100-contract.test.mjs`, `v100-migrations.test.mjs`, `v100-diff.test.mjs`, `v100-bundle.test.mjs` | test | transform/file-I/O | direct `node:test` imports in `test/v100-core.test.mjs:1-5` | exact |
| `tests/components/glt_flow_card/conftest.py`, `test_contract.py` | test | transform | no executable Python analog; replace token test `test/v100-backend.test.mjs` | no analog |
| `test_init.py`, `test_websocket.py`, `test_project_repository.py`, `test_project_transactions.py`, `test_options.py`, `test_diagnostics.py` | integration test | request-response/CRUD/event-driven | protocol seams in `__init__.py:424-652`; current source-token test is non-authoritative | behavior analog only |
| `playwright.config.mjs`, `test/e2e/fixtures/fake-ha.mjs`, `project-safety.spec.mjs` | E2E test | request-response/event-driven | browser boot/theme mechanics in `tools/capture-screenshots.mjs:1-46`; narrow `hass` usage in `src/v100/index.js` | partial |
| `package.json`, lockfile | config | batch | current scripts/dependencies at `package.json:13-22` | exact |
| `.github/workflows/validate.yml`, `build-v1.yml`, `release.yml` | CI config | batch | existing Node/build/release jobs | exact modification seams |
| HACS plugin/integration validation workflows and Companion distribution metadata | CI/config | batch | `hacs.json:1-6`, `manifest.json:1-9`, current release ZIP | partial; separate category endpoint required |

## Pattern Assignments

### Canonical schemas, limits, policy, and fixtures

**Copy from:** `src/v100/core.mjs:33-61` for the existing serialized field names and defaults; `src/v100/catalog.mjs` for equipment/profile/style enumerations; `test/v100-core.test.mjs:11-70` for compact deterministic examples.

Preserve domain-native `snake_case` (`schema_version`, `server_enforced`, `allowed_service_domains`, `from_equipment`) even in JavaScript. Schemas are the authority; `ensureV1` becomes post-validation normalization only. Put raw byte/depth/node/string/collection/error caps in `limits.json`, and stable-ID arrays, ordered arrays, five diff categories, dependency edges, and impact rules in `diff-policy.json`. Fixtures must be one shared corpus consumed unchanged by Node and Python, not parallel language-owned copies.

The expectation manifest should record stable issue `{code, path, params}`, validity, source/target schema version, ordered migration receipts, canonical candidate hash, semantic operations/dependencies, and archive outcome. Include valid, invalid, boundary, historical, and adversarial bundle directories named in `01-VALIDATION.md`.

**Do not copy literally:** `ensureV1` overwrites `schema_version` and supplies defaults before any validation (`core.mjs:33-61`), which destroys raw-input evidence.

### JavaScript contract and generated validator

**Analog:** pure named exports in `src/v100/core.mjs`; direct relative imports in `test/v100-core.test.mjs:3-4`.

```js
// src/v100/core.mjs:28-34 — retain defensive clone/plain-data convention
const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
export function ensureV1(raw = {}) {
  const c = clone(raw) || {};
```

`contract.mjs` should orchestrate, in order: raw budget check → declared/historical schema selection → generated validator → stable issue normalization/sort/cap → reference integrity → migration → target validation → normalization. Keep it DOM-free and deterministic. Generated Ajv standalone code belongs under an explicit generated directory and is rebuilt by `tools/build.mjs`; never import Ajv into the browser runtime at execution time.

Keep canonical JSON/hash helpers shared by validation, preview receipts, transactions, bundle manifests, and release verification. They must sort object keys, preserve semantic array order, encode UTF-8 consistently, and return SHA-256 hex. Do not use the lossy JSON clone as a canonicalizer.

### Python contract adapter

**Analog:** typed helpers and typed `GltStore` fields in `custom_components/glt_flow_card/__init__.py:33-107,109-123`.

The adapter loads the same repository schemas and fixtures, uses only local schema references, emits the identical stable issue DTO/path escaping as JavaScript, and exposes typed functions for raw validation, canonical serialization/hash, migration receipts, and reference checks. Library-native error prose is never part of the cross-runtime contract. Keep public reusable helpers annotated and internal helpers `_snake_case`.

### Sequential immutable migrations

**Replacement seam:** `src/v100/core.mjs:64-68`.

```js
export function migrateProject(config) {
  const from = Number(config?.schema_version || 0);
  const out = ensureV1(config);
  return { config: out, from, to: SCHEMA_VERSION, changed: from !== SCHEMA_VERSION };
}
```

Retain the plain receipt shape, but replace the one-hop normalizer with a registry of exactly `N -> N+1` pure steps. Clone the untouched source, reject missing/unknown-future steps, validate after every step, prove source immutability, and return hashes plus ordered steps. Keep old schema and migration adapters forever once released. No migration may mutate Home Assistant storage or browser state directly.

### Semantic diff and selective dependency closure

**Analog:** stable-ID matching in `src/v100/core.mjs:331-348`.

```js
const keyable = [...a, ...b].every((x) => x && typeof x === "object" && "id" in x);
const am = new Map(a.map((x) => [x.id, x]));
const bm = new Map(b.map((x) => [x.id, x]));
```

Reuse stable-ID matching and recursive plain-object traversal, but move the feature to `project-diff.mjs` and drive it from `diff-policy.json`. Output exactly the five locked categories, stable JSON Pointer paths, before/after values, impact, dependencies, and deterministic order. Ignore reorder noise only for policy-declared ID sets; preserve order where semantic. Selective apply computes transitive dependency closure and produces a full candidate document, which re-enters the same validation and transaction path as full apply.

Do not expose the current generic `added/removed/changed` output as DIFF-01, and do not apply client-submitted patch paths on the server.

### Bundle safety

**Replacement seam:** `src/v100/core.mjs:350-366`.

Reuse the public `Uint8Array` in/out API and explicit `manifest.json` + `project.json` concept, but not the parser. The existing loop trusts local headers, ignores CRC/central directory/duplicate names/size ratios/assets, and immediately migrates parsed JSON. New preflight must normalize logical names to NFC forward-slash paths and reject absolute/drive/UNC/backslash/NUL/control/`.`/`..`, symlink, duplicate/case-collision, overlap, encryption, unsupported method, CRC/hash/declared-size mismatch, missing/unreferenced assets, and entry/expanded/ratio bombs before extraction. Treat assets as opaque bytes in Phase 1.

Bundle descriptor hashes entries but excludes its own final archive hash; the external build manifest hashes final archive bytes. Parsing returns a preflight result/candidate and never silently saves or normalizes.

### Project repository, split stores, transactions, and recovery

**Analog:** `GltStore` deep-copy boundaries and optimistic revision check in `custom_components/glt_flow_card/__init__.py:149-186`.

```py
if expected_revision is not None and int(expected_revision) != old_revision:
    raise RuntimeError(f"revision_conflict:{old_revision}")
entry = deepcopy(project)
entry["revision"] = old_revision + 1
await self.async_save()
return deepcopy(entry)
```

Extract repository classes rather than expanding the 695-line `__init__.py`. Preserve typed HA `Store[...]`, deep copies on reads/writes, UTC timestamps, `snake_case` persistence, bounded retention, and optimistic revisions. Split project heads/history, audit, runtime alarm/schedule state, immutable snapshots, and transaction journal into versioned stores with explicit legacy import.

The transaction coordinator owns PREPARED journal → immutable verified snapshot → candidate save → re-read/hash verification → COMMITTED receipt. On any failure it restores through the same repository path and records terminal rollback/failure state. Setup recovery resolves incomplete journals before commands become available. Never claim multi-store atomicity; test failure injection after every transition.

### WebSocket preview/apply/rollback boundary

**Analog:** Voluptuous command + HA user/role + typed error translation in `__init__.py:414-454`.

```py
@websocket_api.websocket_command({...})
@websocket_api.async_response
async def ws_projects_save(hass, connection, msg):
    try:
        # authorize and delegate
        connection.send_result(msg["id"], result)
    except PermissionError as err:
        connection.send_error(msg["id"], "forbidden", str(err))
```

Add narrow preview/apply/rollback commands to the command registry. Preview accepts raw candidate plus expected revision, validates and recomputes server-side diff/dependencies/digest. Apply accepts preview digest/selection/expected revision, then the server recomputes everything and uses the transaction coordinator. Rollback accepts only a server-owned snapshot/receipt plus explicit confirmation. Preserve HA connection identity and designer authorization; browser roles remain UX only. Audit only IDs, revisions, hashes, status, and actor—not project bodies, entity states, tokens, or control payloads.

### Lifecycle, options, diagnostics, and cleanup

**Modification seams:** `_ensure_manager` and setup functions at `__init__.py:662-695`; options flow at `config_flow.py:11-41`.

The existing `_unsubs` list (`__init__.py:121-122`) and callback registration (`671-675`) are useful ownership patterns. Replace the unload no-op at `693-695` with idempotent manager `async_close`: cancel/await every `_alarm_tasks` task, call and clear every unsubscribe, release HTTP/resources, unregister or centrally guard commands, remove runtime data, and tolerate setup/unload/re-setup. Prefer Config Entry `runtime_data` where supported, with a deliberate compatibility adapter for minimum HA.

Options keep Voluptuous ranges and current defaults but must actually update effective manager/repository settings via an update listener and reload path. Add standard HA diagnostics returning only versions, counts, effective non-secret options, journal health, and artifact hashes; redact remote tokens, projects, plant states, and audit details.

### Project-safety UI

**Analog:** guarded native Web Component integration in `src/v100/index.js:4-18`, escaped strings at `index.js:10`, Companion calls elsewhere in the same module, and current dark/light design tokens. Import the focused module through `src/v100/entry.js` after its pure dependencies.

Use a real native `<dialog>` (or equivalent fully tested dialog semantics), ARIA tabs, semantic buttons/checkboxes, visible focus, focus trap/restore, Escape, live progress, and responsive single-column reflow. Show Summary/Details, five categories, impact, dependency auto-selection/explanation, conflict/retry state, and typed rollback confirmation. Preserve existing Neo 2030 and Operations Light themes rather than inventing another visual system. Escape all issue paths/messages before HTML interpolation.

The UI calls only preview/apply/rollback WebSockets for shared changes. A failed Companion apply must remain a retryable preview; never fall back to local save. E2E must assert zero `callService` and zero plant/fieldbus writes.

Avoid adding another broad prototype `_render` wrapper. Attach one focused project-safety entry point or consolidate with the existing project panel, and preserve original method returns/load order.

### Build, generated artifacts, manifest, and release verification

**Analog:** `tools/apply-v100.mjs:3-24` establishes authored input → generated/copy output; `build-v1.yml:34-53` shows current build sequence.

Replace scattered workflow shell build logic with `tools/build.mjs`: compile standalone validators, bundle `src/v100/entry.js` for ES2022, assemble `dist/glt-flow-card.js`, copy byte-identically to Companion `www`, update the online generated extension through its marker, stage schemas, create deterministic Companion ZIP, and emit a canonical manifest containing versions, sizes, and SHA-256 hashes. Avoid timestamps or normalize archive metadata for repeatability.

`tools/verify-release.mjs` independently checks package/integration/runtime/tag versions, byte equality, schema/generated-validator drift, manifest hashes, archive layout, checksums, and a clean double-build. It must verify the exact staged artifacts later installed/published, not rebuild after tests. Keep `apply-v100.mjs` only as a compatibility wrapper or retire its version/changelog mutation; a build must not rewrite authored package metadata opportunistically.

### Node, Python, browser, and CI tests

**Node analog:** `test/v100-core.test.mjs:1-5`—`node:test`, `node:assert/strict`, direct authored-module imports, explicit fixtures, deterministic inputs. Add `assert.throws`/`assert.rejects` for stable codes. Token tests in `smoke.test.mjs` and `v100-backend.test.mjs` may remain smoke hints but cannot gate requirements.

**Python:** no repository analog exists. Use Home Assistant pytest fixtures for Config Entries, storage, WebSocket clients, and lifecycle. Parameterize the same contract fixture manifest. Test min/current supported HA lanes, clean install, legacy split-store upgrade, reload/unload/re-setup, auth/errors, diagnostics redaction, journal recovery, and injected transaction failures.

**Browser analog:** reuse Chromium launch/page/theme concepts from `tools/capture-screenshots.mjs:1-46`, but pin Playwright in the lockfile and add assertions. Serve the exact staged `dist` with a narrow fake `hass` (`states`, `user`, `callWS`, `callService`). Cover DE/EN, both existing themes, desktop/mobile/200% zoom, keyboard/focus/Escape, all progress/error/conflict/rollback states, and no service calls.

**CI analog:** keep Node 22, `npm ci --ignore-scripts`, read-only permissions by default, concurrency, and timeouts. Split jobs into contract/Node, Python minimum/current HA, exact build+manifest, Playwright, hassfest, HACS plugin, HACS integration, and narrow publish. Pin third-party actions to full SHAs. Upload one immutable staged artifact from build; downstream jobs download and verify its manifest. Publish alone receives `contents: write`; attestation permission is isolated.

The plugin and Companion integration require two independently valid HACS category endpoints. One repository metadata file cannot represent both categories; keep one authored source/build and generate a release-only Companion distribution/mirror once its repository URL/ownership checkpoint is resolved.

## Shared Patterns

### Serialization and boundary order

Apply everywhere: untouched raw bytes/document → limits → versioned schema → stable issues → references → immutable sequential migrations → target validation → normalization → semantic diff → authoritative transaction. Serialized fields stay `snake_case`; UI-only locals/functions stay `camelCase`.

### Authorization and errors

Use `_user`, `_project_role`, `_role_at_least`, and `_require_project_role` (`__init__.py:37-75,414-421`). Internal domain failures use `ValueError`, `RuntimeError`, and `PermissionError`; WebSocket handlers translate them into stable protocol codes. Contract errors use stable code/path/params, never dependency-native messages.

### Persistence and audit

Copy before returning or storing. Require expected revision on apply/rollback. Persist bounded, server-owned evidence receipts. Never log or diagnose project bodies, remote credentials, resolved secrets, live states, or control request data.

### Source/generated boundary

Authored: `src/v100/`, `schemas/`, Python modules, `tools/`, tests, workflows, manifests. Generated: validators, `dist/glt-flow-card.js`, Companion `www` copy, marked online-editor extension, build manifest, ZIP/checksum artifacts. Changes are complete only after deterministic regeneration and equality verification.

## Anti-Patterns to Block in Plans

- Editing `dist/`, Companion `www`, or only the generated section of `docs/editor/app.js`.
- Validating the result of `ensureV1` instead of untouched raw input.
- Keeping JavaScript and Python schemas, fixtures, error maps, or migration logic as independent copies.
- Treating the current three-type recursive diff as the five-category semantic contract.
- Applying client-provided paths/patches without recomputation, revision, digest, dependency closure, and full validation.
- Extracting a ZIP before normalized-name, collision, method, CRC/hash, size, and ratio preflight.
- Calling several HA `Store.async_save()` operations “atomic” without journal, snapshot, verification, recovery, and injected-failure tests.
- Leaving listeners/tasks/manager/commands alive on unload or registering duplicates on re-setup.
- Browser-only authorization, local-save fallback after authoritative failure, or any live HA service/plant write in Phase-1 tests.
- Another uncoordinated prototype render wrapper or unescaped dynamic HTML.
- Token/grep assertions, screenshots without assertions, or `py_compile` as requirement proof.
- Building or zipping again after testing, mutable dependency installs, broad workflow write permissions, unpinned actions, or publishing artifacts whose hashes were not reverified.

## No Close Analog

| File/group | Reason / planner direction |
|---|---|
| Draft 2020-12 schemas and generated validators | Current “schema” is a normalizer; follow `01-RESEARCH.md` contract architecture. |
| Transaction journal/snapshot/recovery | Current monolithic store has no crash-safe transaction; implement explicit state machine. |
| Python executable HA tests | Repository only compiles Python and token-scans source; establish official HA pytest harness. |
| HA diagnostics module | No current diagnostics endpoint; use standard HA diagnostics API plus explicit allowlist/redaction. |
| Accessible project-safety dialog | Current modal helper is visual only; implement locked UI spec and Playwright behavior. |
| Deterministic release verifier/attestation | Current workflows grep and zip; create independent verifier and immutable artifact flow. |
| Dual HACS category distribution | Current `hacs.json` is plugin-oriented; Companion needs a distinct integration endpoint/mirror decision. |

## Integration Checklist for Planner

1. `core.mjs` may re-export compatibility names, but contract/migration/diff/bundle implementations move to focused pure modules.
2. `index.js` consumes those authored modules; `entry.js` preserves base-before-add-on ordering and imports one focused safety UI integration.
3. `__init__.py` becomes lifecycle/registration composition; repository, contract, transaction, and diagnostics logic live in typed modules.
4. Existing `projects/save` compatibility must delegate to the same validated transaction path or be explicitly deprecated—no bypass.
5. `tools/build.mjs` becomes the only artifact producer; `verify-release.mjs` is independent and read-only.
6. Package scripts expose `test:contract`, targeted Node tests, Python lanes, `test:e2e`, `build`, `verify:generated`, `verify:release`, and `test:phase1`.
7. CI tests the immutable staged bytes on minimum/current HA and both HACS categories before narrow publish.

## Metadata

**Search scope:** `.planning` phase/context/research/validation and codebase maps; `src/v100/`; `custom_components/glt_flow_card/`; `tools/`; `test/`; `.github/workflows/`; package and HACS manifests.  
**Primary analogs:** `core.mjs`, `index.js`, `GltStore` and WebSocket handlers, config flow, `apply-v100.mjs`, existing Node tests, screenshot harness, build/release workflows.  
**Safety boundary:** repository tests and tooling only; no Home Assistant service calls, fieldbus calls, or live plant writes.
