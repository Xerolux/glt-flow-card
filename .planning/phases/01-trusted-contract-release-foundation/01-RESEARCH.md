# Phase 1: Trusted Contract & Release Foundation - Research

**Researched:** 2026-08-31  
**Domain:** JSON Schema contracts, migration/diff safety, Home Assistant lifecycle, deterministic HACS release engineering  
**Confidence:** MEDIUM-HIGH — repository findings are directly verified; external behavior is cited from current official documentation; three product choices remain explicit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Canonical Contract and Validation
- JSON Schema Draft 2020-12 is the serialization contract; authored schema and fixtures live in a dedicated source directory and are packaged for both browser and Companion use.
- Validate raw input before defaulting or migration, with explicit depth, size, string, collection, ID, path, and archive-entry bounds.
- JavaScript and Python validators run the same valid, invalid, boundary, and historical fixture corpus; parity failures block the build.
- Validation errors use stable codes plus JSON-pointer-like paths and localized human messages; raw validator internals are not the public contract.

### Migration, Diff, and Bundle Safety
- Migrations are pure, sequential, copy-on-write steps; source input is immutable and every applied step records from/to version and semantic changes.
- Dry-run produces validation plus semantic diff without persistence; apply requires an expected revision and creates a verified rollback snapshot.
- `.gltproject` import rejects absolute paths, traversal, duplicate logical entries, unsupported compression/encryption, oversized files, excessive entry counts, and manifest/project mismatches before extraction.
- Selective diff application reuses the same schema, migration, reference-integrity, and revision pipeline as full saves; no separate unsafe patch path is introduced.

### Companion Lifecycle and Storage
- Home Assistant identity and Config Entry lifecycle remain authoritative; setup and unload are idempotent and track every listener, task, WebSocket registration, and manager resource for deterministic cleanup.
- Config Flow options must alter the running manager or trigger a safe reload; unused options are removed or wired rather than documented aspirationally.
- Introduce versioned domain stores behind repository interfaces, with one migration from the current shared store and a retained rollback backup; do not delete old data until verification passes.
- Test a declared minimum and current Home Assistant lane using supported public APIs; if the advertised 2024.8 floor cannot pass, raise the minimum explicitly rather than carrying an unproven claim.

### Canonical Build and Packaging
- One local Node build command generates the browser bundle once and stages byte-identical copies for `dist/`, Companion `www/`, and standalone/editor consumption where applicable.
- Generated files contain a machine-readable build manifest with version, schema version, source commit, tool versions, and SHA-256; CI regenerates from a clean checkout and fails on drift.
- HACS dashboard and Companion integration are packaged as their correct categories/artifacts with a documented install/upgrade relationship; a one-repo convenience claim is accepted only after actual HACS validation.
- Release checks install the produced artifacts, not source directories, and cover clean install, upgrade from historical storage, reload, unload, and re-setup.

### Testing and User Experience
- Replace Phase-1 token checks with executable core, Python/Home Assistant, and real-browser behavior; token checks may remain only as non-authoritative smoke hints.
- Schema/migration/diff tools expose preview, actionable validation errors, progress/failure states, and rollback confirmation in German and English.
- Keyboard/focus and responsive behavior are included for every new dialog/panel now; Phase 10 closes product-wide evidence rather than retrofitting inaccessible Phase-1 UI.
- No live Home Assistant or plant writes are required for Phase 1; lifecycle tests use isolated fixtures and test instances.

### the agent's Discretion
- Exact source module names, schema compiler integration, repository class boundaries, fixture serialization, and supported current HA patch versions may follow repo conventions and official tooling compatibility.
- The implementation may keep the existing ZIP store encoder for compatibility only if the bounded archive contract and tests are met; otherwise replace it behind the same public project-bundle API.

### Deferred Ideas (OUT OF SCOPE)
- Server-owned ACLs, exact control authorization, and collaboration leases belong to Phase 2.
- Semantic graph/profile redesign belongs to Phase 3.
- Product-wide final accessibility, localization, and 100/500/2,000-object evidence closure belongs to Phase 10, while each phase still implements its own usable states.
</user_constraints>

The constraints above are copied verbatim from the phase decision record. [VERIFIED: `.planning/phases/01-trusted-contract-release-foundation/01-CONTEXT.md`]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | One bounded JSON Schema 2020-12 contract validates projects, profiles, extensions, and `.gltproject` bundles before normalization; sequential frontend/backend-parity migrations support dry-run, backups, rollback, understandable path errors, safe archive extraction, custom assets, and historical fixtures. | Canonical schema layout, shared limits/fixtures, Ajv/Python parity adapter, migration registry, transaction journal, and hostile archive preflight below. [VERIFIED: `.planning/REQUIREMENTS.md`] |
| DIFF-01 | Project comparison reports semantic additions/removals/moves/binding/config changes with stable IDs, ignores irrelevant ordering noise, previews impact, and lets an engineer selectively apply or roll back changes through the same validation/revision path. | Semantic operation model, reference closure, UI state machine, and single apply/rollback pipeline below. [VERIFIED: `.planning/REQUIREMENTS.md`] |
| HACS-01 | The Companion is a correctly packaged HACS Home Assistant integration with manifest, Config Flow/options, translations, diagnostics, explicit supported HA versions, setup/unload/reload cleanup, migration-safe storage, release ZIP/install/upgrade verification, while the dashboard plugin remains correctly distributed as a frontend artifact. | Config Entry lifecycle, split stores, two HACS-category validation targets, deterministic build manifest, and artifact-install matrix below. [VERIFIED: `.planning/REQUIREMENTS.md`] |
</phase_requirements>

## Summary

Phase 1 should refactor three existing seams, not create a walking skeleton: `src/v100/core.mjs` already normalizes, migrates, diffs, and encodes bundles; `src/v100/index.js` and the v0.4 project layer already expose project UI and local/Companion persistence; and `custom_components/glt_flow_card/__init__.py` already owns revisions, locks, storage, WebSocket commands, listeners, and services. Today those seams are permissive: `ensureV1` defaults before validation, `migrateProject` is a one-step normalization wrapper, `projectDiff` is structural rather than semantic, the ZIP reader walks local headers without archive hardening, and the Companion accepts arbitrary dictionaries into one mixed store. [VERIFIED: codebase inspection of `src/v100/core.mjs`, `src/v100/index.js`, `src/v040-extension.part00`, and `custom_components/glt_flow_card/__init__.py`]

The implementation-ready shape is one authored Draft 2020-12 contract plus limits and golden fixtures, compiled for the browser and loaded through Python `jsonschema`; a pure sequential migration/diff engine; and a Companion transaction coordinator that archives, writes, re-reads, verifies, and can recover an interrupted apply. JSON Schema 2020-12 supplies `$defs`, dynamic references, and `unevaluatedProperties`; Ajv supports Draft 2020-12 and standalone generated validators; Python `jsonschema` exposes `Draft202012Validator`, schema checking, iterable errors, and registry-based reference resolution. [CITED: https://json-schema.org/draft/2020-12] [CITED: https://ajv.js.org/json-schema.html] [CITED: https://ajv.js.org/standalone.html] [CITED: https://python-jsonschema.readthedocs.io/en/stable/validate/] [CITED: https://python-jsonschema.readthedocs.io/en/stable/referencing/]

Release integrity must become an executable product path: one local `npm run build` produces a canonical bundle once, byte-copies distribution targets, emits a non-circular manifest of versions/commit/toolchain/hashes, builds a deterministic Companion ZIP and a local release-only Home Assistant integration-category staging tree, and then tests the exact staged files. CI must regenerate in a clean checkout, compare two builds, fail on committed drift, exercise verified immutable minimum/current Home Assistant lanes, and validate plugin and integration-category packages separately. Phase 1 does not create or publish a second public repository; any later mirror upload is conditional, disabled by default, and requires a separately authorized exact target and token. [CITED: https://hacs.xyz/docs/publish/plugin/] [CITED: https://hacs.xyz/docs/publish/integration/] [CITED: https://hacs.xyz/docs/publish/action/]

**Primary recommendation:** implement contract, migration/diff, backend transaction, UI preview, and release verification as one vertical safety pipeline—`raw bytes → bounded parse/archive preflight → schema → sequential migration → semantic diff → expected-revision apply → verified snapshot → re-read verification → evidence receipt`—and do not allow any alternate save/import/rollback route to bypass it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Raw size/depth/schema validation | Shared domain contract | Browser and API adapters | Authored JSON files/fixtures are canonical; each runtime only adapts errors and execution. [VERIFIED: `01-CONTEXT.md`] |
| Sequential migration and semantic diff | Shared pure domain layer | Browser preview, API re-execution | Deterministic logic belongs in `src/v100`-style pure modules; the server repeats authoritative checks. [VERIFIED: `AGENTS.md`, `.planning/codebase/ARCHITECTURE.md`] |
| Revision, backup, atomic apply, rollback, audit | API / Backend | Home Assistant storage | These are shared mutations and must be enforced by the Companion, never browser role checks. [VERIFIED: `AGENTS.md`] |
| Project-safety workflow | Browser / Client | Companion capability API | The browser owns focus, progress, localization, preview selection, and status; it cannot authorize persistence. [VERIFIED: `01-UI-SPEC.md`] |
| Archive entry inspection | Shared domain layer | Browser memory / backend controlled storage | Entry names, sizes, methods, duplication, and hashes must be checked before extraction or rendering. [VERIFIED: `01-CONTEXT.md`] |
| Config Entry lifecycle and diagnostics | API / Backend | Home Assistant host | Home Assistant owns identity, setup/unload, options, diagnostics, and integration runtime. [CITED: https://developers.home-assistant.io/docs/config_entries_index/] |
| Bundle generation and artifact staging | Build tooling | CI/release workflow | One deterministic producer must feed all deployment copies and release assets. [VERIFIED: `01-CONTEXT.md`] |
| HACS plugin/integration distribution | Release infrastructure | GitHub Releases | HACS category/repository rules and release filenames determine installability. [CITED: https://hacs.xyz/docs/publish/start/] |

## Project Constraints (from AGENTS.md)

- Home Assistant remains the runtime, identity/state source, service broker, Recorder, notification, and fieldbus layer. [VERIFIED: `AGENTS.md`]
- Browser roles are UX only; shared reads/writes, rollback, controls, remote calls, and audit require server-side enforcement. [VERIFIED: `AGENTS.md`]
- Preserve safe standalone-card operation, but explicitly disable privileged shared operations when Companion enforcement is unavailable. [VERIFIED: `AGENTS.md`]
- Edit authored modules and generators; an isolated edit to `dist/glt-flow-card.js`, the Companion `www` copy, or generated `docs/editor/app.js` is incomplete. [VERIFIED: `AGENTS.md`]
- Bounded schema/migration work must preserve existing Lovelace/YAML projects. [VERIFIED: `AGENTS.md`]
- Behavioral tests are authoritative; source-token assertions cannot satisfy a phase requirement. [VERIFIED: `AGENTS.md`]
- No live Home Assistant, physical bus, plant, or heat-pump write is authorized by this phase. [VERIFIED: `AGENTS.md`, `01-CONTEXT.md`]
- Match the existing native Web Components/Shadow DOM, ES2022, pure `.mjs` modules, Node test runner, Python/Home Assistant, two-space JS, and four-space typed Python conventions; do not introduce a frontend framework or TypeScript island. [VERIFIED: `AGENTS.md`]
- Use Node 22 and `npm ci --ignore-scripts` to match CI; validate browser syntax/tests and Python behavior, not only `py_compile`. [VERIFIED: `AGENTS.md`, `.github/workflows/build-v1.yml`]
- Escape user/project-derived HTML, do not log project contents, entity state payloads, control bodies, or credentials, and translate expected backend failures to stable WebSocket errors. [VERIFIED: `AGENTS.md`]

## Current-State Gap Map

| Existing seam | Exact current behavior | Phase-1 change |
|---------------|------------------------|----------------|
| `ensureV1`, `migrateProject` in `src/v100/core.mjs` | Deep-clones, fills defaults, forces schema v1; migration only reports `from/to/changed`. [VERIFIED: codebase inspection] | Split raw validation from normalization; add contiguous pure migrations and receipts. |
| `projectDiff` in `src/v100/core.mjs` | Recursive object diff; ID-keyed arrays; only added/removed/changed paths. [VERIFIED: codebase inspection] | Stable semantic operation model with five locked categories, impact, dependencies, and selective application. |
| `makeProjectBundle`, `readProjectBundle` in `src/v100/core.mjs` | Minimal STORE ZIP; reads local headers; no central-directory, CRC, duplicate/path/hash/size checks. [VERIFIED: codebase inspection] | Use a maintained ZIP implementation plus explicit preflight limits and manifest/hash verification. |
| Project UI in `src/v100/index.js` | Existing project modal immediately imports a decoded bundle; generic overlay lacks dialog/focus contract; prompt-based JSON diff. [VERIFIED: codebase inspection] | Add one Project safety toolbar action and the five-tab, preview-first state machine from UI-SPEC. |
| v0.4 `ProjectStore` | Companion failures silently fall back to `localStorage`; saves can omit `expected_revision`; restore directly replaces config. [VERIFIED: codebase inspection] | Distinguish standalone-local operations from failed shared operations; no fallback for authoritative apply/rollback; expected revision mandatory. |
| `GltStore` and project WebSockets | One Home Assistant `Store` mixes projects, versions, locks, audit, schedules, alarms, reports, and work orders; project payload is arbitrary `dict`. [VERIFIED: codebase inspection] | Versioned repositories, legacy copy-on-write importer, contract adapter, transaction journal, verified snapshots. |
| Setup/unload/options | Manager and WebSocket commands are registered through shared setup; unload returns true while retaining the shared manager; four Config Flow options are not consumed. [VERIFIED: codebase inspection] | Global command registration once; entry-scoped manager/resources with deterministic close; wire options through reload/update listener and expose effective values. |
| Build/release workflows | CI runs ad hoc `npx esbuild`, mutating apply scripts, token greps, and can commit generated files; release tests committed `dist` then zips source. [VERIFIED: `.github/workflows/build-v1.yml`, `validate.yml`, `release.yml`, `tools/apply-v100.mjs`] | Pure local build, double-build reproducibility, drift/equality/version/hash checks, exact-artifact install/upgrade tests, immutable publish. |
| Test suite | Node pure tests exist, but backend/smoke tests mostly search source text; no Python HA behavior or Project-safety browser suite. [VERIFIED: `test/*.test.mjs`] | Shared fixture parity, HA harness, real browser, hostile archives, failure injection, and release artifact tests. |

## Standard Stack

### Core

| Library/tool | Pinned version | Purpose | Why standard here |
|--------------|----------------|---------|-------------------|
| JSON Schema | Draft 2020-12 | Canonical serialized-data contract | Locked decision; official current meta-schema/vocabulary model. [CITED: https://json-schema.org/draft/2020-12] |
| `ajv` | 8.20.0 | Build-time browser validator and standalone code generation | Official Ajv docs support Draft 2020-12 and standalone validation code, avoiding a runtime compiler/CSP dependency. [VERIFIED: npm registry] [CITED: https://ajv.js.org/standalone.html] |
| Python `jsonschema` | 4.26.0 | Companion Draft 2020-12 validation | Official API provides `Draft202012Validator.check_schema`, `iter_errors`, and registry integration. [CITED: https://python-jsonschema.readthedocs.io/en/stable/validate/] |
| `@zip.js/zip.js` | 2.8.30 exact pin, automated provenance required | Bounded browser ZIP read/write behind the existing project-bundle API | Mature maintained ZIP primitives and strict-mode hardening are safer than extending the handwritten local-header parser. The exact historical pin is admitted only by the committed read-only registry/source/integrity allowlist. [CITED: https://github.com/gildas-lormeau/zip.js] |
| Existing `esbuild` | 0.25.12 lockfile pin | Single canonical ES2022 bundle | Already the repository bundler; keep one producer rather than add another bundler. [VERIFIED: `package-lock.json`] |
| Node built-in test runner | Node 22 | Fast pure contract/migration/diff/build tests | Existing repo convention and CI runtime. [VERIFIED: `package.json`, `AGENTS.md`] |

### Supporting

| Library/tool | Pinned version | Purpose | When to use |
|--------------|----------------|---------|-------------|
| `@playwright/test` | 1.62.1 | Real Chromium workflow/accessibility/interaction tests | Test the exact staged bundle, both locales, keyboard/focus, mobile reflow, and absence of HA service calls. [VERIFIED: npm registry] [CITED: https://playwright.dev/docs/intro] |
| `pytest-homeassistant-custom-component` | 0.13.316 exact pin, automated provenance required | Home Assistant custom-integration fixture harness | Admit only after read-only registry/source/integrity verification, then use the supported harness with verified HA lanes. |
| SHA-256 from Web Crypto / Node `crypto` / Python `hashlib` | Host-provided | Content and evidence integrity | Hash canonical UTF-8 project bytes, staged artifacts, schema files, and ZIP entries; do not add a crypto package. [VERIFIED: host standard libraries] |
| HACS action and hassfest | current action pinned to reviewed commit SHA | Category/package validation | Run plugin and integration validation independently against produced release artifacts. [CITED: https://hacs.xyz/docs/publish/action/] |

### Alternatives Considered

| Instead of | Could use | Tradeoff / decision |
|------------|-----------|---------------------|
| Standalone Ajv output | Bundle full Ajv compiler in the card | Larger/runtime dynamic-code surface and CSP concerns; compile at build time. [CITED: https://ajv.js.org/standalone.html] |
| Python `jsonschema` | Duplicate contract with Voluptuous | Voluptuous remains appropriate for WebSocket envelopes, but it is not the locked Draft 2020-12 project contract. [VERIFIED: current backend usage; `01-CONTEXT.md`] |
| Maintained ZIP library | Extend current ZIP parser | ZIP path/central-directory/CRC/duplicate/compression edge cases are security-sensitive; do not expand the handwritten parser. [VERIFIED: current parser inspection] |
| Two HACS package categories | Claim one installed package covers both | Validate the dashboard plugin and a local release-only Companion integration staging tree independently; do not claim public integration-category availability without an explicitly authorized endpoint. [CITED: https://hacs.xyz/docs/publish/plugin/] [CITED: https://hacs.xyz/docs/publish/integration/] |

**Planned installation after automated provenance verification:**

```powershell
npm install --save-dev --save-exact ajv@8.20.0 @playwright/test@1.62.1
npm install --save-exact @zip.js/zip.js@2.8.30
# Companion runtime requirement in manifest.json after minimum/current HA compatibility proof:
# jsonschema==4.26.0
```

Use `npm ci --ignore-scripts` thereafter. ZIP, Python validator, and Home Assistant test-harness installs require the committed automated provenance verifier described below. [VERIFIED: `AGENTS.md`; package-legitimacy seam results]

## Package Legitimacy Audit

| Package | Registry | Publish/usage signal | Source repository | Verdict | Disposition |
|---------|----------|----------------------|-------------------|---------|-------------|
| `ajv` 8.20.0 | npm | Current version published 2026-04-24; approximately 377M weekly downloads at check time. [VERIFIED: npm registry] | `ajv-validator/ajv` linked by official docs. [CITED: https://ajv.js.org/] | OK | Approved; no postinstall script returned. |
| `@playwright/test` 1.62.1 | npm | Established official Microsoft package. [VERIFIED: npm registry] | `microsoft/playwright` from official docs. [CITED: https://playwright.dev/docs/intro] | OK | Approved; no postinstall script returned. |
| `@zip.js/zip.js` 2.8.30 | npm | Exact historical version is registry-addressable with integrity and source metadata. [VERIFIED: npm registry] | `gildas-lormeau/zip.js`. [CITED: https://github.com/gildas-lormeau/zip.js] | OK | Accept only through the automated read-only provenance allowlist/verifier; lock exact integrity and reject lifecycle-script/source drift. |
| `jsonschema` 4.26.0 | PyPI | Exact version and file hashes are registry-addressable. [VERIFIED: PyPI registry] | `python-jsonschema/jsonschema` linked by official docs. [CITED: https://python-jsonschema.readthedocs.io/] | OK | Accept only through the committed read-only provenance allowlist/verifier and both verified HA lanes. |
| `pytest-homeassistant-custom-component` 0.13.316 | PyPI | Exact version and file hashes are registry-addressable. [VERIFIED: PyPI registry] | Upstream source identity is checked automatically against the committed allowlist and supported HA testing practice. | OK | Accept only through automated provenance and canonical `tests/components/glt_flow_card/` harness use. |

**Packages removed due to SLOP verdict:** none.  
**Packages requiring automated provenance enforcement:** all five exact candidates; Plan 01-01 verifies official registry/source/integrity/lifecycle-script metadata read-only before installation. No human package checkpoint remains.

## Architecture Patterns

### System Architecture Diagram

```text
project JSON / YAML / .gltproject / historical Companion Store
                              │
                              ▼
                 RAW PREFLIGHT (bytes, depth, nodes,
                 strings, IDs, archive entries/paths)
                              │ reject → localized issues
                              ▼
                    DRAFT 2020-12 VALIDATION
                ┌─────────────┴──────────────┐
                │ browser standalone Ajv      │ Companion jsonschema
                └─────────────┬──────────────┘
                              ▼
                 SEQUENTIAL COPY-ON-WRITE MIGRATIONS
                   step validate + reference validate
                              ▼
                     SEMANTIC DIFF / IMPACT GRAPH
                    select + dependency closure
                              │ dry-run → browser preview
                              ▼ apply/rollback request
           HOME ASSISTANT AUTH + EXPECTED REVISION + DIGEST CHECK
                              ▼
              PREPARED JOURNAL → VERIFIED SNAPSHOT → SAVE
                              ▼
                 RE-READ + HASH/SCHEMA VERIFY
                    │ pass             │ injected/real fail
                    ▼                  ▼
              COMMIT + receipt      RESTORE SNAPSHOT + receipt

authored source + schemas + package version + lockfile
                              │ npm run build (once)
                              ▼
       canonical bundle + schemas + Companion ZIP + build manifest
          │ byte-copy/equality │ double-build │ versions/hashes
          ▼                    ▼              ▼
       HACS plugin         HA min/current   local integration-category stage
```

This keeps preview computations portable but makes every shared mutation server-authoritative. [VERIFIED: `AGENTS.md`, `01-CONTEXT.md`]

### Recommended Project Structure

```text
schemas/                                      # canonical authored contract
├── project-v0.schema.json                    # unversioned/legacy input envelope
├── project-v1.schema.json                    # historical v1
├── project-v2.schema.json                    # recommended current strict version
├── profile.schema.json
├── extension.schema.json
├── bundle-manifest.schema.json
├── limits.json                               # shared non-schema raw/archive budgets
└── diff-policy.json                          # identity collections, fields, references
src/v100/
├── contract.mjs                              # public validation/error adapter
├── migrations.mjs                            # registry + receipts
├── semantic-diff.mjs                         # semantic operations/dependency closure
├── project-bundle.mjs                        # bounded ZIP API
└── generated/contract-validators.mjs         # deterministic Ajv standalone output
custom_components/glt_flow_card/
├── project_contract.py                       # jsonschema adapter + stable errors
├── project_migrations.py                     # paired/declarative migration executor
├── project_repository.py                     # versioned stores + legacy importer
├── project_transactions.py                   # journal/snapshot/apply/recovery
├── diagnostics.py
└── schemas/                                  # byte-copied canonical schemas/limits
test/fixtures/contracts/                      # one cross-runtime corpus + expectations
tests/components/glt_flow_card/               # Python HA behavioral tests
test/e2e/project-safety.spec.mjs              # exact-bundle browser workflow
tools/build.mjs                               # sole deterministic producer/stager
tools/verify-release.mjs                      # artifact/version/hash/install checks
```

Names follow existing `.mjs`, kebab-case tool, and Home Assistant Python conventions; exact boundaries are at agent discretion. [VERIFIED: `AGENTS.md`, `01-CONTEXT.md`]

### Pattern 1: Canonical Contract With Runtime Adapters

Authored schemas, limits, fixtures, and expected stable errors are the source of truth. The JavaScript adapter imports generated standalone validation functions; Python loads the packaged identical schema bytes into an in-memory registry. Neither runtime fetches remote `$ref` targets or exposes raw library error text. [CITED: https://ajv.js.org/standalone.html] [CITED: https://python-jsonschema.readthedocs.io/en/stable/referencing/]

Use absolute stable `$id` values, `$defs`, explicit `type`, `required`, `maxLength`, `maxItems`, and `unevaluatedProperties`. Register every supported historical schema locally and call `check_schema` in build/setup tests. Draft 2020-12 changed tuple keywords and contains/unevaluated behavior, so fixtures must cover those semantics. [CITED: https://json-schema.org/draft/2020-12/release-notes] [CITED: https://python-jsonschema.readthedocs.io/en/stable/validate/]

Raw preflight precedes JSON Schema because schema validators do not impose document-byte, nesting, aggregate-node, archive-ratio, or validation-time budgets. Ajv warns that untrusted schemas/data can create resource-exhaustion risks and that `allErrors` can increase work; use only repository-owned schemas, safe regexes, hard preflight limits, and a capped issue list. [CITED: https://ajv.js.org/security.html]

Recommended initial budgets are: project input 5 MiB; bundle compressed 32 MiB; 256 entries; 16 MiB per asset; 128 MiB total expanded; ratio 100:1; nesting 64; 100,000 nodes; individual string 256 KiB; ID 128 characters; archive path 512 characters; and at most 100 displayed errors. These are provisional product budgets, not standards, and must be confirmed against representative largest legacy projects before locking. [ASSUMED]

Normalize both validators into:

```js
{
  code: "contract.required",
  path: "/equipment/3/id",
  message_key: "validation.required",
  args: { property: "id" },
  severity: "error"
}
```

The path is RFC 6901-style; normalize Ajv `instancePath` and Python `absolute_path`, escape `~`/`/`, relocate required/additional-property errors to the offending property, sort deterministically by path/code, and compare the complete stable DTO in parity fixtures. Python errors expose absolute paths and nested context, while Ajv exposes instance paths. [CITED: https://python-jsonschema.readthedocs.io/en/stable/errors/] [CITED: https://ajv.js.org/api.html]

### Pattern 2: Pure Sequential Migrations

Recommend `CURRENT_SCHEMA_VERSION = 2`: retain v1 as a historical schema, treat absent/legacy as v0, and prove `0→1→2` rather than merely renaming the existing v1 normalizer. [ASSUMED] A migration registry must be contiguous and reject missing, backward, future, or cyclic versions:

```js
const MIGRATIONS = new Map([
  [0, { id: "project-0-to-1", from: 0, to: 1, migrate: migrate0To1 }],
  [1, { id: "project-1-to-2", from: 1, to: 2, migrate: migrate1To2 }],
]);
```

For every step: deep-copy input, hash source, execute, prove source hash unchanged, validate target schema, validate references, compute semantic operations, and append `{id, from, to, input_hash, output_hash, changes}`. Mechanical transformations should be declared as data and interpreted in both runtimes; unavoidable coded transforms require paired JS/Python implementations and byte-equivalent canonical golden output. [VERIFIED: `01-CONTEXT.md`]

Dry-run returns validation, steps, diff, reference impact, candidate digest, and expected revision; it never persists. Shared apply sends identifiers/selection plus the preview digest, not a client-authoritative migrated blob; the backend reloads the current revision and repeats raw/schema/migration/reference/diff validation. [VERIFIED: `01-CONTEXT.md`, `AGENTS.md`]

### Pattern 3: Journaled Copy-on-Write Apply and Rollback

Home Assistant `Store` writes are atomic per store, but a snapshot store plus project store is not one multi-store transaction; add a small metadata journal. [VERIFIED: current single-store design; architectural inference] The state machine is:

1. Re-read project; require exact `expected_revision` and preview digest.
2. Write `PREPARED` journal with current revision/hash, candidate hash, actor, operation IDs.
3. Persist snapshot containing immutable prior canonical bytes, schema/version/hash, reason, actor, and transaction ID; re-read and verify its hash.
4. Save candidate as `revision + 1`; never mutate caller/current objects.
5. Re-read project, revalidate contract/references/hash, then mark `COMMITTED` and emit server receipt/audit.
6. On any failure after prepare, restore the verified snapshot as a new recovery write, verify, mark `ROLLED_BACK`/`FAILED`, and retain both evidence records.
7. At setup, recover every non-terminal journal before accepting writes.

Rollback is forward history, not revision rewind: require current expected revision, a verified snapshot, an authorized HA user, and typed project-name confirmation in the UI; then create a new revision and receipt. Full validation and reference checks run again. [VERIFIED: `01-UI-SPEC.md`]

Split persistence behind repository interfaces: project heads, immutable snapshots, audit/evidence, and transaction metadata. The one-time importer reads legacy `glt_flow_card.projects`, writes new stores copy-on-write, verifies project/version counts and canonical hashes, records completion, and retains the old store/backup untouched through this phase. [VERIFIED: `01-CONTEXT.md`; current `GltStore` inspection]

### Pattern 4: Semantic Diff and Selective Apply

Replace the internal implementation of the existing `projectDiff` export to preserve callers, but return stable semantic operations:

```js
{
  operation_id: "equipment:pump-1:binding:/entity_id",
  category: "Binding", // Added | Removed | Moved | Binding | Configuration
  object_type: "equipment",
  object_id: "pump-1",
  path: "/equipment/by-id/pump-1/entity_id",
  before: "sensor.old",
  after: "sensor.new",
  impact: { severity: "warning", references: ["path:flow-2"] },
  dependencies: ["equipment:pump-1:configuration:/type"],
}
```

`diff-policy.json` declares ID-keyed collections, semantic order fields, movement fields (`x`, `y`, view/layer/container coordinates), binding fields (`entity`, `entity_id`, `bindings`, slot/field bindings), and reference edges. Array order is ignored only for identity-keyed collections; explicit `order`, z-order, route points, sequences, and other semantic arrays remain meaningful. The display groups exactly Added, Removed, Moved, Binding, and Configuration, and exposes ordering-only noise separately as “ignored ordering noise.” [VERIFIED: `01-UI-SPEC.md`]

Selective apply operates on a cloned current canonical project using server-recomputed semantic operations—not an unrestricted JSON Patch. Every selection change recomputes dependency closure and reference integrity; required dependencies are locked with a reason. The final candidate re-enters the same full-save pipeline. [VERIFIED: `01-CONTEXT.md`, `01-UI-SPEC.md`]

### Pattern 5: Project-Safety UI State Machine

Preserve the current designer and add one toolbar action `Project safety` / `Projektsicherheit` adjacent to Projects. Use a real dialog with five tabs in the locked order: Overview, Validate, Migrate & compare, Bundles, Evidence. The workflow state is `idle → inspecting → preview-ready → backing-up → applying → verifying → success|failed|conflict`; rollback has the same guarded states. [VERIFIED: `01-UI-SPEC.md`]

Apply remains disabled until validation, archive safety, expected revision, backup readiness, and selection dependency closure are green. A revision conflict must reload and recompare; it must not offer overwrite. Editor changes immediately mark the displayed evidence/status stale. Standalone mode can validate, dry-run, compare, export, and import locally but shows an explicit read-only/shared-operations-disabled banner when the Companion/capability version is absent—never a silent `localStorage` fallback after a failed shared call. [VERIFIED: `01-UI-SPEC.md`, `AGENTS.md`]

Use native dialog semantics, labelled tabs, focus trap and focus restoration, visible focus, keyboard-operable selection, `role=status` progress and `role=alert` failures. Escape/backdrop close is disabled during apply/rollback. The same component must reflow to full-screen mobile and 200% zoom; German/English strings include errors, state, confirmations, and receipts. [VERIFIED: `01-UI-SPEC.md`]

### Pattern 6: Safe `.gltproject` Preflight

Preserve the public `makeProjectBundle`/`readProjectBundle` API while replacing internals. Read the central directory first and reject before extraction: absolute POSIX paths, drive/UNC paths, NUL/control bytes, `.`/`..`, backslash aliases, symlinks/special entries, encrypted entries, unsupported methods, duplicates after separator/Unicode normalization, case-colliding logical paths, overlap/ambiguity, count/size/ratio excess, CRC/hash mismatch, and entries absent from the manifest. [VERIFIED: `01-CONTEXT.md`; threat-model inference]

The manifest must declare bundle format version, project path/hash/schema version, every asset path/hash/size/media type, and allowed compression method. Reject manifest/project ID or schema mismatch and dangling asset references. Keep data in memory for browser preflight; Companion extraction, if needed, resolves only into a controlled transaction directory and verifies the resolved path remains inside it. Do not render SVG, HTML, scripts, or custom assets during preflight. [VERIFIED: `01-UI-SPEC.md`]

### Pattern 7: Home Assistant Lifecycle Ownership

Register WebSocket command types once in integration `async_setup`, because the documented registration API does not return an unregister callback; handlers resolve the loaded Config Entry runtime and return a stable `integration_not_loaded` error when absent. Do not manipulate Home Assistant private WebSocket registries. [CITED: https://developers.home-assistant.io/docs/frontend/extending/websocket-api] Entry-scoped listeners/tasks/managers belong to `async_setup_entry`; store the manager in `ConfigEntry.runtime_data`, register every unsub/update listener with `entry.async_on_unload`, and make `manager.async_close()` cancel/await tasks and clear resources idempotently. [CITED: https://developers.home-assistant.io/docs/config_entries_index/] [CITED: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/]

Keep the existing basic Options Flow plus one entry update listener that reloads the entry; this works across the declared old lane and current lane. Do not combine an OptionsFlowWithReload-style reload with another update-listener reload, which current Home Assistant deprecates as double reload. [CITED: https://developers.home-assistant.io/docs/core/integration/options_flow/] [CITED: https://developers.home-assistant.io/blog/2026/05/07/config-entry-listener-together-with-reloading-methods/]

Wire `server_enforced`, `default_lock_ttl`, `max_versions`, and `max_audit` into the active manager or remove them. Add a capability endpoint returning integration/card/schema/bundle versions, build hash, capabilities, store-migration state, and effective options. Add `diagnostics.py` with only allowlisted/redacted lifecycle/build state—never project documents, remote tokens, entity state, or plant/control payloads. [VERIFIED: current Config Flow inspection] [CITED: https://developers.home-assistant.io/docs/core/integration/diagnostics/]

### Pattern 8: Single-Source Build and Two-Category Distribution

Add `npm run build` calling one pure `tools/build.mjs`. It compiles standalone validators, bundles browser source exactly once into a temporary staging path, byte-copies that file to `dist/glt-flow-card.js` and `custom_components/glt_flow_card/www/glt-flow-card.js`, and produces the standalone editor variant from explicit authored inputs only where it legitimately differs. The current apply scripts must become pure helpers or retire; they must not patch package files, changelogs, tests, or previously generated output. [VERIFIED: current build inspection; `01-CONTEXT.md`]

Use `package.json` as the release-version source and generate/verify the Companion manifest, runtime registration constant, release names, and build metadata from it. Stage schemas byte-identically into the Companion. An external `build-manifest.json` records final SHA-256 for every file and equality group; an embedded build descriptor records version/schema/source commit/tool versions/build ID but not the bundle’s own final hash, avoiding a circular self-hash. [VERIFIED: `01-CONTEXT.md`; cryptographic construction inference]

Build twice in isolated directories with stable ordering, normalized ZIP permissions/timestamps, explicit source commit and tool versions, and no wall-clock/random data; compare bytes and manifests. Then compare committed generated files with staged output. CI should fail drift, not push bot commits. Package the Companion ZIP from the staged tree with sorted entries and no cache/source detritus, then inspect the ZIP layout and hashes. [VERIFIED: current workflow gap; deterministic-build inference]

The main repository remains the HACS plugin distribution for `glt-flow-card.js`. From the same source build, stage the Companion as a local release-only integration-category tree with its own `hacs.json`, manifest, ZIP, and validation evidence; do not create or publish another repository in Phase 1. Run plugin and local integration-category validation independently, plus hassfest and exact-artifact clean-install/upgrade/reload/unload/re-setup tests. A future mirror upload may exist only as a disabled conditional requiring a separately authorized exact target and scoped token, and is excluded from Phase-1 success criteria. [CITED: https://hacs.xyz/docs/publish/plugin/] [CITED: https://hacs.xyz/docs/publish/integration/] [CITED: https://hacs.xyz/docs/publish/action/]

Release consumes the artifacts and manifest produced by the already-green build job, verifies checksums, generates provenance/attestation, and publishes immutable release assets; it must not rebuild from a different dependency state. Pin third-party actions to reviewed full commit SHAs, keep default permissions read-only, grant `contents: write` only to publish, and separate any `id-token`/attestation permission. [CITED: https://docs.github.com/en/actions/reference/security/secure-use] [CITED: https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts] [CITED: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations] [CITED: https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Draft 2020-12 evaluation | Parallel ad hoc JS/Python validators | Authored schemas + Ajv standalone + Python `jsonschema` | Vocabulary, reference, and unevaluated-property semantics are subtle and parity must be executable. [CITED: https://json-schema.org/draft/2020-12/json-schema-core] |
| ZIP parsing | More local-header byte walking | Reviewed `@zip.js/zip.js` primitives plus project-specific bounds/policy | CRC, central directory, duplicate/overlap, method, encoding, and ZIP-bomb cases are security-sensitive. [VERIFIED: current parser gap] |
| Patch authorization | Arbitrary client JSON Patch | Server-recomputed semantic operations through full-save transaction | Prevents paths outside the preview, stale revisions, and bypassed reference checks. [VERIFIED: `01-CONTEXT.md`] |
| Multi-store “atomicity” | Hope sequential `Store` saves all succeed | Explicit journal + verified immutable snapshot + recovery | Home Assistant stores do not create an application-level multi-store transaction. [VERIFIED: architectural inference from current storage] |
| Crypto | Custom digest/canonical-byte algorithm | Standard SHA-256 APIs plus one documented canonical JSON serializer | Cross-runtime evidence must be deterministic and reviewable. [VERIFIED: host standard libraries] |
| Focus/tabs/dialog behavior | Another clickable `<div>` overlay | Native `<dialog>`/ARIA tab pattern and Playwright behavior tests | The current overlay does not meet the locked keyboard/focus contract. [VERIFIED: `src/v100/index.js`, `01-UI-SPEC.md`] |
| Release provenance | Grep tokens or trust filenames | Hash manifest, double build, exact-artifact install, attestation | A named release asset does not prove source/version/bytes/install integrity. [CITED: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity] |

## Runtime State Inventory

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | Existing Home Assistant `glt_flow_card.projects` Store mixes project heads, version arrays, audit, alarms, locks, schedules, reports, and work orders; standalone projects/drafts live in browser `localStorage`. [VERIFIED: `custom_components/glt_flow_card/__init__.py`, `docs/editor/app.js`] | Copy-on-write backend importer with verified hashes/counts and retained legacy backup; browser data is migrated only when explicitly inspected/imported, never silently rewritten. |
| Live service config | Config Entry options exist in Home Assistant storage but are not applied by the current manager; optional YAML remote-site config can exist outside the Config Entry. [VERIFIED: `config_flow.py`, `__init__.py`] | Read effective options at setup/reload; preserve YAML compatibility without creating a second manager; test option changes. |
| OS-registered state | None—this custom card/integration registers no Windows service, scheduled task, systemd unit, or global package. Verified by repository entry points; live hosts are out of scope. [VERIFIED: codebase inspection] | None. |
| Secrets/env vars | No repository `.env`; remote tokens may be Home Assistant `!secret` values. [VERIFIED: `AGENTS.md`, codebase map] | Do not migrate, serialize, log, diagnose, or bundle resolved secrets. |
| Build artifacts / installed packages | `dist/glt-flow-card.js`, Companion `www` copy, `docs/editor/app.js`, release ZIP, HACS-installed frontend resources, and old browser caches can retain prior bytes. [VERIFIED: `AGENTS.md`, workflows] | Regenerate/stage from one build; verify equality/hash/version and test upgrade/cache-busting from produced artifacts. |

## Common Pitfalls

### Validating after `ensureV1`

**What goes wrong:** invalid or ambiguous raw data is defaulted/coerced into an apparently valid project, losing the evidence needed for a safe migration. **Avoidance:** preflight and validate the untouched parsed document against its declared/historical schema before defaults or migration; keep raw/candidate immutable hashes in the receipt. [VERIFIED: current `ensureV1`; `01-CONTEXT.md`]

### Treating equal validator verdicts as parity

**What goes wrong:** JS and Python both reject but produce different paths/codes, or differ only on boundaries/references. **Avoidance:** one manifest-driven fixture corpus compares verdict, normalized stable issue DTOs, migration steps, canonical candidate hash, and semantic diff—not library messages. [VERIFIED: `01-CONTEXT.md`]

### Using `allErrors` without budgets

**What goes wrong:** large/deep input and pathological patterns amplify CPU/memory and UI output. **Avoidance:** repository-owned schemas, safe regexes, raw limits first, capped/sorted errors, and performance fixtures. [CITED: https://ajv.js.org/security.html]

### Assuming save-plus-backup is atomic

**What goes wrong:** crash/failure between stores leaves a candidate without a usable rollback or a journal that appears complete. **Avoidance:** PREPARED journal, verified snapshot, save, re-read verification, terminal state, setup recovery, and injected failure at every transition. [VERIFIED: architectural inference]

### Silently falling back to local persistence

**What goes wrong:** a failed authoritative shared save becomes a divergent browser-only copy. **Avoidance:** fallback is a declared standalone capability only; when a Companion request fails, keep preview state and show a retryable error. [VERIFIED: current `ProjectStore`; `AGENTS.md`]

### Calling unload “complete” while global/entry resources remain

**What goes wrong:** duplicate listeners/tasks/commands after reload and operations against stale managers. **Avoidance:** commands register globally once; entry resources are counted, closed, and tested across setup→reload→unload→setup. The command handlers remain registered but become inert when the entry is unloaded. [CITED: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/]

### Circular bundle self-hashes

**What goes wrong:** embedding the final bundle hash changes the bundle and therefore its hash. **Avoidance:** embedded descriptor excludes its own final hash; external manifest hashes final bytes and is separately checksummed/attested. [VERIFIED: cryptographic construction inference]

### Testing source, publishing different bytes

**What goes wrong:** release workflow tests committed `dist`, rebuilds/zips later, and publishes untested drift. **Avoidance:** build once; artifact job transfers immutable staged files; every later job verifies the manifest before installing/publishing. [CITED: https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts]

### Assuming one HACS repository is two categories

**What goes wrong:** dashboard plugin validates while Companion integration is not installable through HACS, or vice versa. **Avoidance:** independent category endpoints/action runs and exact ZIP install; block the convenience claim until HACS proves it. [CITED: https://hacs.xyz/docs/publish/action/]

## Code Examples

### Build-Time Ajv Draft 2020-12 Standalone Compilation

```js
// Sources: https://ajv.js.org/json-schema.html and https://ajv.js.org/standalone.html
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  code: { source: true, esm: true },
});
for (const schema of schemas) ajv.addSchema(schema);
const moduleSource = standaloneCode(ajv, exportNameToSchemaId);
// tools/build.mjs writes this deterministic generated source, then bundles it.
```

Preflight/capped input makes `allErrors` acceptable for actionable UI; do not compile user-provided schemas. [CITED: https://ajv.js.org/security.html]

### Python Draft 2020-12 Validator With Local Registry

```python
# Sources: https://python-jsonschema.readthedocs.io/en/stable/validate/
# and https://python-jsonschema.readthedocs.io/en/stable/referencing/
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

Draft202012Validator.check_schema(project_schema)
registry = Registry().with_resources(
    (schema["$id"], Resource.from_contents(schema)) for schema in schemas
)
validator = Draft202012Validator(project_schema, registry=registry)
errors = sorted(validator.iter_errors(raw_project), key=lambda e: list(e.absolute_path))
```

Package all referenced schemas locally and prohibit network resolution. Normalize `errors` immediately into the shared stable DTO. [CITED: https://python-jsonschema.readthedocs.io/en/stable/referencing/]

### Copy-on-Write Migration Runner

```js
// Project-specific pattern derived from locked 01-CONTEXT.md decisions.
export function migrateSequential(raw, targetVersion, adapters) {
  let candidate = structuredClone(raw);
  const steps = [];
  while (candidate.schema_version < targetVersion) {
    const step = MIGRATIONS.get(candidate.schema_version);
    if (!step || step.to !== step.from + 1) throw new Error("migration.missing_step");
    const source = structuredClone(candidate);
    candidate = step.migrate(source);
    adapters.assertSourceUnchanged(raw, source);
    adapters.validateForVersion(candidate, step.to);
    adapters.validateReferences(candidate);
    steps.push(adapters.receipt(step, source, candidate));
  }
  return { candidate, steps };
}
```

Both runtimes must produce the same canonical candidate and receipt fixture; the backend re-executes the operation at apply time. [VERIFIED: `01-CONTEXT.md`]

## State of the Art

| Old/current repository approach | Phase-1 approach | Impact |
|---------------------------------|------------------|--------|
| Normalize/default as “schema” | Raw bounded Draft 2020-12 validation, then migration/normalization | Invalid legacy input remains diagnosable and recoverable. [VERIFIED: current core gap] |
| Structural recursive diff | Identity/reference-aware semantic operations | Meets engineering meaning, ordering-noise, selection, and impact requirements. [VERIFIED: `01-UI-SPEC.md`] |
| Local-header STORE ZIP parser | Central-directory-aware library plus strict project policy | Makes hostile archives testable and reject-before-extract. [VERIFIED: current core gap] |
| Shared mixed Store | Versioned repositories plus journal/snapshots | Enables migration-safe storage and crash recovery. [VERIFIED: current backend gap] |
| `hass.data` shared manager left on unload | Config Entry `runtime_data`, tracked callbacks/tasks, idempotent close | Matches current Home Assistant lifecycle direction. [CITED: https://developers.home-assistant.io/docs/config_entries_index/] |
| CI token grep and bot-generated drift commits | Behavior, clean double build, exact-artifact verification | Prevents green builds with stale or different release bytes. [VERIFIED: workflow inspection] |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Current schema should advance to v2, with absent legacy as v0 and existing v1 retained. | Architecture Pattern 2 | Migration files/fixtures and advertised schema version change; planner should confirm before implementation. |
| A2 | Initial raw/archive limits (5 MiB JSON, 32 MiB compressed, 256 entries, etc.) fit real user projects. | Architecture Pattern 1 | Too low rejects valid legacy projects; too high weakens DoS protection. Confirm with representative largest projects and boundary benchmarks. |
| A3 | A local release-only Companion integration-category staging artifact is sufficient for Phase-1 build/install/validation evidence. | Architecture Pattern 8 | Public HACS discoverability remains unclaimed until a future endpoint is explicitly authorized. |

## Resolved Planning Decisions

1. **Companion distribution is local staging in Phase 1 — RESOLVED.**
   - The current root remains the dashboard/plugin distribution. The build creates a local release-only Home Assistant integration-category staging tree and deterministic Companion ZIP, and validates both category shapes independently. No public Companion repository is invented, created, or published. Any future mirror upload is disabled by default, requires a separately authorized exact target/token, and is not required for Phase-1 success.
2. **Home Assistant compatibility lanes are verified and immutable — RESOLVED.**
   - At execution, a read-only preflight queries official Home Assistant release/container metadata, proves tag existence, records immutable digest and available architecture, and rejects prerelease/mutable-only candidates. The minimum lane starts from the advertised floor and must pass the supported pytest Home Assistant harness or container bootstrap; if it cannot, execution raises `hacs.json`'s minimum to the first verified passing release and records the incompatibility. The current lane is discovered from official stable releases at execution and pinned by digest; no unverifiable future tag or external Config Entry endpoint is assumed.
3. **Bounded fixtures derive from the contract limits — RESOLVED.**
   - Commit deterministic boundary/malicious fixtures immediately below, at, and above byte/depth/node/string/collection/archive limits. Generate representative 100-, 500-, and 2,000-object contract/diff fixture classes to exercise correctness and bounded behavior, but label their results Phase-1 fixture evidence only. They do not establish or publish Phase-10 capacity/performance claims, which still require the later dedicated measurement protocol and representative real projects.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build/Node tests | Yes, but not CI lane | 25.9.0 locally | Use Node 22 toolchain/container/CI. [VERIFIED: local probe; `AGENTS.md`] |
| npm | locked installs/build | Yes | 11.12.1 | Node 22 bundled npm in CI. [VERIFIED: local probe] |
| Python | Companion tests | Yes, lanes incomplete | default 3.11.5; `py -3.13` 3.13.13 | Resolve official HA lanes first, then use each digest-pinned release's supported Python/runtime architecture. [VERIFIED: local probe] |
| Current HA runtime | current HA lane | Not preselected locally | — | Discover official stable at execution, verify tag/digest/architecture, and use its supported container/test runtime; never infer a future version. [CITED: https://github.com/home-assistant/core/blob/dev/pyproject.toml] |
| Docker | isolated HA lanes/install tests | Yes | 29.6.2 | GitHub Actions service/container jobs. [VERIFIED: local probe] |
| Git / GitHub CLI | source/release checks | Yes | Git 2.52; gh 2.83 | GitHub-hosted runner. [VERIFIED: local probe] |
| Playwright browser | E2E | Not yet project-installed | — | Install the pinned browser in CI after automated package provenance verification. [VERIFIED: `package.json`] |

**Missing dependencies with no fallback:** none for Phase 1; public Companion mirror ownership is deliberately outside the required path.  
**Missing dependencies with fallback:** Node 22, the verified Home Assistant/Python lane runtimes, and Playwright browser are supplied by pinned containers/CI after read-only availability/digest/architecture preflight.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Fast JS framework | Node 22 built-in `node:test`; existing `package.json`/`test/*.test.mjs`. [VERIFIED: codebase] |
| Python framework | `pytest` with pinned HA custom-component/core fixture harness; Wave 0 setup required. [CITED: https://developers.home-assistant.io/docs/development_testing/] |
| Browser framework | `@playwright/test` 1.62.1 against exact staged `dist`; Wave 0 config/browser required. [VERIFIED: npm registry] |
| Quick run | `npm run test:contract` (target under 30 seconds) |
| Full phase suite | `npm run test:phase1` orchestrating Node, Python lanes/container calls, build verification, and Playwright |

### Fixture Contract

Create `test/fixtures/contracts/{valid,invalid,boundary,historical,bundles}/` with raw input plus an expectation manifest containing schema version, valid flag, normalized stable issues, migration steps, candidate canonical hash, semantic operations, and archive outcome. The identical corpus is parameterized by Node and Python; neither suite owns private copies. [VERIFIED: `01-CONTEXT.md`]

Include: empty/minimal/full projects; every equipment/profile/extension union; absent-v0 and committed v1; unknown future versions; just-under/at/over every limit; duplicate IDs; dangling references; Unicode/escaped JSON pointers; deep nesting; additional properties; schema ambiguity; all five diff categories; stable-ID reorder noise; semantic order; selective dependency closure; and malicious archives (absolute, drive, UNC, traversal, backslash, duplicate normalized/case path, encrypted, unsupported method, bad CRC/hash, overlap, entry/expanded/ratio bomb, manifest mismatch, unreferenced/missing assets). [VERIFIED: `01-UI-SPEC.md`; threat-model derivation]

### Phase Requirements → Test Map

| Req ID | Behavior | Test type and fast command | File exists? |
|--------|----------|----------------------------|--------------|
| SCHEMA-01 | Raw-before-normalize validation; JS/Python parity; sequential immutable migrations; safe bundle/assets; verified backup/rollback | `npm run test:contract`; `py -3.12 -m pytest tests/components/glt_flow_card/test_contract.py tests/components/glt_flow_card/test_project_transactions.py -q` | ❌ Wave 0 |
| DIFF-01 | Five semantic categories; reorder noise; impact/dependency selection; revision conflict; same-path apply/rollback; accessible preview | `node --test test/v100-diff.test.mjs`; `npm run test:e2e -- --grep "project safety"`; targeted Python WebSocket transaction tests | ❌ semantic/browser/Python files Wave 0; generic diff test exists |
| HACS-01 | Config/options/diagnostics/lifecycle; legacy store upgrade; exact versions/bytes/hashes/ZIP; clean/upgrade/reload/unload/re-setup; two HACS categories | `pytest tests/components/glt_flow_card -q`; `npm run verify:release`; HACS action plugin+integration and hassfest jobs | ❌ Wave 0 |

### Concrete Test Layers

1. **Pure Node:** `test/v100-contract.test.mjs`, `v100-migrations.test.mjs`, `v100-diff.test.mjs`, `v100-bundle.test.mjs`; import authored pure modules and shared fixtures. No DOM. [VERIFIED: existing pure-test convention]
2. **Python contract/unit:** `tests/components/glt_flow_card/test_contract.py` runs the same fixture manifest and canonical serializer; fail on any error-code/path/hash/step divergence. [CITED: https://developers.home-assistant.io/docs/development_testing/]
3. **Home Assistant integration:** `test_init.py`, `test_websocket.py`, `test_project_repository.py`, `test_project_transactions.py`, `test_options.py`, `test_diagnostics.py`; assert auth, expected revision, listener/task/command counts, effective options, legacy import, recovery, redaction, and receipts. Inject failure after snapshot, during project save, after save, during verify, and during restore. [VERIFIED: roadmap success criteria]
4. **Real browser:** `test/e2e/project-safety.spec.mjs` loads the exact built bundle with a fake `hass` WebSocket adapter; covers DE/EN, dark/light, desktop/mobile/200% zoom, keyboard/focus/Escape, progress/error/conflict, selection dependencies, rollback confirmation, and asserts zero `callService`/plant calls. [VERIFIED: `01-UI-SPEC.md`]
5. **Build/release:** build twice in clean temp dirs; compare canonical bundle/copies/schemas/manifest/ZIP; check tag/package/manifest/runtime/HACS versions; inspect archive layout/hashes; install produced ZIP/card into isolated HA fixtures; upgrade from historical storage. [VERIFIED: roadmap success criteria]
6. **Distribution gates:** HACS plugin validation plus local integration-category staging validation, hassfest, checksum/attestation verification, and exact staged assets rechecked; no public Companion endpoint is required. [CITED: https://hacs.xyz/docs/publish/action/]

### Sampling Rate and Commands

- **Per task:** `npm run test:contract` plus the directly affected Node or Python file.
- **Per migration/diff/store task:** `node --test test/v100-contract.test.mjs test/v100-migrations.test.mjs test/v100-diff.test.mjs test/v100-bundle.test.mjs` and targeted Python parity/transaction tests.
- **Per wave:** `npm test`, both HA Python lanes, `npm run build && npm run verify:generated`, and Project-safety Playwright.
- **Phase gate:** clean checkout → `npm ci --ignore-scripts` → full `npm run test:phase1` → double build/drift check → min/current exact-artifact install/upgrade/lifecycle → two HACS category validations → release manifest/checksum/attestation. All must be green before `$gsd-verify-work`. [VERIFIED: `01-CONTEXT.md`]

### Wave 0 Gaps

- [ ] Canonical `schemas/`, `limits.json`, `diff-policy.json`, cross-runtime fixtures, and canonical JSON/hash helper.
- [ ] Ajv standalone compiler in `tools/build.mjs` and deterministic generated-validator check.
- [ ] Python pytest configuration and immutable HA harness/container matrix resolved from the advertised floor and official current stable with verified digests/architectures.
- [ ] Playwright config, pinned package, browser install, fake-HA fixture, and exact-dist test server.
- [ ] Deterministic build/release manifest verifier and adversarial ZIP fixture generator.
- [ ] Local release-only Companion integration-category staging plus independent plugin/staging validation jobs.
- [ ] Replace `v100-backend.test.mjs` and smoke token assertions as requirement gates; they may remain non-authoritative hints only.

## Security Domain

Security enforcement is enabled at ASVS L1. [VERIFIED: `.planning/config.json`]

### Applicable ASVS Categories

| ASVS category | Applies | Phase-1 control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Use Home Assistant authenticated connection/user identity; no custom credentials. [VERIFIED: `AGENTS.md`] |
| V3 Session Management | Host-owned | Do not store/copy session tokens; rely on Home Assistant WebSocket session. [VERIFIED: host architecture] |
| V4 Access Control | Yes | Backend authorizes shared preview/apply/rollback, rechecks user and expected revision; browser controls are UX only. Exact ACL redesign remains Phase 2. [VERIFIED: `AGENTS.md`, `01-CONTEXT.md`] |
| V5 Validation, Sanitization, Encoding | Yes | Raw budgets, Draft 2020-12, reference integrity, stable escaped paths/messages, HTML escaping, archive policy. [VERIFIED: locked decisions] |
| V6 Stored Cryptography | Integrity only | Standard SHA-256 for bytes/evidence; never treat an unkeyed hash as authorization. [VERIFIED: design] |
| V8 Data Protection | Yes | Redacted diagnostics/evidence; no project contents, tokens, plant state, or control payload logs. [VERIFIED: `AGENTS.md`] |
| V12 Files and Resources | Yes | Reject traversal/absolute/symlink/duplicate/encrypted/bomb entries before extraction; controlled paths only. [VERIFIED: locked decisions] |

### Threat Model

| ID | Threat | STRIDE | Required mitigation/test |
|----|--------|--------|--------------------------|
| T-01 | Client alters candidate/selection after preview | Tampering/Elevation | Preview digest + expected revision; server recomputes operations/dependencies/candidate and revalidates. |
| T-02 | User invokes rollback with browser-forged receipt | Spoofing/Repudiation | Server-owned snapshot IDs/hashes, HA identity, typed confirmation, server audit/evidence receipt. |
| T-03 | Oversized/deep/regex-hostile JSON | Denial of service | Byte/depth/node/string/collection budgets before validator, repository schemas only, safe patterns, error cap. [CITED: https://ajv.js.org/security.html] |
| T-04 | ZIP traversal, alias, collision, overlap, bomb | Tampering/DoS | Normalize separator+Unicode; reject absolute, drive, UNC, NUL, `..`, backslash aliases, symlinks, duplicates/case collisions, overlap, unsupported/encrypted methods, CRC/hash/size/ratio violations before extraction. |
| T-05 | SVG/HTML/script asset executes during inspection | Elevation/Information disclosure | Treat all custom assets as opaque bytes during preflight; media allowlist and sanitization/render policy remain separate. [VERIFIED: `01-UI-SPEC.md`] |
| T-06 | Interrupted apply corrupts head/history | Tampering/DoS | Journal, immutable verified snapshot, re-read verification, startup recovery, failure-injection tests. |
| T-07 | Diagnostics or bundle leaks remote tokens/state | Information disclosure | Explicit allowlists/redaction; never serialize resolved `!secret`, tokens, entity states, or audit bodies. |
| T-08 | Generated/release artifact differs from reviewed source | Tampering/Supply chain | `npm ci --ignore-scripts`, lockfile, reviewed action SHAs, double build, equality/hash/version manifest, exact-artifact tests, checksums/attestation, immutable release. [CITED: https://docs.github.com/en/actions/reference/security/secure-use] |

Path handling must normalize to forward-slash logical names, NFC-normalize Unicode, reject empty/`.`/`..` segments, leading slash, drive/UNC syntax, NUL/control characters and backslashes, and detect duplicates after normalization. Backend extraction must resolve against a newly created controlled transaction directory and prove the final path remains inside it; never compose shell commands from entry names. [VERIFIED: threat-model derivation]

Release workflow permissions default read-only. Build/test jobs have no release write token; the current-repository publish job verifies downloaded artifact hashes before narrow `contents: write`; attestation identity permission is isolated. Dependencies come only from the lockfile/official registries after automated provenance verification, and third-party actions are full-SHA pinned. [CITED: https://docs.github.com/en/actions/reference/security/secure-use]

## Sources

### Primary Repository Evidence (HIGH confidence)

- `AGENTS.md`, `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, phase `01-CONTEXT.md`, `01-UI-SPEC.md`, and `.planning/research/SUMMARY.md` — locked scope, safety, UI, and release outcomes. [VERIFIED: codebase inspection]
- `src/v100/core.mjs`, `index.js`, `v1-addons.js`, v0.4 extension parts, `custom_components/glt_flow_card/*.py`, manifests, `hacs.json`, build tools/workflows, and tests — exact brownfield seams/gaps. [VERIFIED: codebase inspection]

### Official Documentation (MEDIUM confidence)

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12), [core](https://json-schema.org/draft/2020-12/json-schema-core), and [release notes](https://json-schema.org/draft/2020-12/release-notes) — vocabulary/reference/current keyword behavior.
- [Ajv JSON Schema](https://ajv.js.org/json-schema.html), [standalone code](https://ajv.js.org/standalone.html), [options](https://ajv.js.org/options), and [security](https://ajv.js.org/security.html) — Draft 2020-12, generated validators, and untrusted-data cautions.
- Python `jsonschema` [validation](https://python-jsonschema.readthedocs.io/en/stable/validate/), [referencing](https://python-jsonschema.readthedocs.io/en/stable/referencing/), and [errors](https://python-jsonschema.readthedocs.io/en/stable/errors/) — schema checking, local registry, paths/context.
- Home Assistant [Config Entries](https://developers.home-assistant.io/docs/config_entries_index/), [Options Flow](https://developers.home-assistant.io/docs/core/integration/options_flow/), [unloading](https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/), [WebSocket API](https://developers.home-assistant.io/docs/frontend/extending/websocket-api), [diagnostics](https://developers.home-assistant.io/docs/core/integration/diagnostics/), and [testing](https://developers.home-assistant.io/docs/development_testing/) — supported lifecycle/test patterns.
- HACS [publishing](https://hacs.xyz/docs/publish/start/), [integration](https://hacs.xyz/docs/publish/integration/), [plugin](https://hacs.xyz/docs/publish/plugin/), and [action](https://hacs.xyz/docs/publish/action/) — category and release validation.
- GitHub [secure use](https://docs.github.com/en/actions/reference/security/secure-use), [workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts), [artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations), and [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases) — supply-chain controls.
- [zip.js repository/releases](https://github.com/gildas-lormeau/zip.js) and [Playwright installation](https://playwright.dev/docs/intro) — maintained archive/browser tooling.

### Tertiary (LOW confidence)

- None used as authoritative guidance. Product assumptions are isolated in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH — official docs and registries checked; all exact candidates are enforced by an automated read-only provenance audit.
- Architecture: HIGH for repository seams and locked behavior; MEDIUM for recommended schema-v2 numbering, exact limits, and local integration-category staging.
- Validation: HIGH for required layers/behaviors; MEDIUM for uninstalled HA/Playwright harness versions.
- Security/pitfalls: MEDIUM-HIGH — directly tied to code paths, locked threat concerns, and official security guidance.

**Research date:** 2026-08-31  
**Valid until:** 2026-09-30 for stable schema/architecture guidance; re-check Home Assistant/HACS/action/package versions immediately before implementation/release.
