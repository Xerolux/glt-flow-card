# Phase 1: Trusted Contract & Release Foundation - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning
**Mode:** Smart discuss recommendations auto-accepted by the user's non-interactive "all 1-30" instruction

<domain>
## Phase Boundary

This phase establishes the trustworthy project contract and release foundation required by all later work: bounded schema validation, sequential migrations and rollback, semantic project diff/application, safe `.gltproject` archives, clean Companion setup/options/unload/reload, declared Home Assistant support lanes, split-store bootstrap, and one reproducible browser build copied identically to every shipped location. It does not implement later operational, semantic, alarm, analytics, or multi-site features beyond the compatibility scaffolding those phases need.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/v100/core.mjs` already contains `ensureV1`, `migrateProject`, `projectDiff`, `makeProjectBundle`, and `readProjectBundle`, providing compatibility entry points for hardened implementations.
- `tools/apply-v100.mjs` already assembles the v1 output and can become the canonical local build rather than duplicating GitHub Actions steps.
- `custom_components/glt_flow_card/config_flow.py`, `manifest.json`, translations, and existing WebSocket setup provide the Companion packaging/lifecycle base.
- Existing examples and pure-core tests supply initial valid and historical fixture material.

### Established Patterns
- Deterministic engineering logic belongs in pure named ES-module exports under `src/v100/`; generated bundle copies are never primary edit targets.
- Serialized project fields use snake_case in both languages; frontend modules use two-space JS while Home Assistant code uses typed Python/PEP 8 style.
- Home Assistant boundary errors are translated to stable WebSocket errors; optional browser APIs degrade without breaking the base card.

### Integration Points
- `src/v100/entry.js` and `tools/apply-v100.mjs` define browser extension load order and generated-copy staging.
- `custom_components/glt_flow_card/__init__.py` owns current `GltStore`, listeners, tasks, setup/unload, and storage migration entry points.
- `.github/workflows/build-v1.yml`, `validate.yml`, `release.yml`, and `hacs.json` are release gates and packaging surfaces.
- `test/v100-core.test.mjs` and `test/v100-backend.test.mjs` must be supplemented by executable Python and browser suites rather than expanded as string-token tests.

</code_context>

<specifics>
## Specific Ideas

- Preserve current Lovelace/YAML projects and custom assets; migration must be lossless and reversible.
- Treat the current Platform 1.0 feature wording as unproven until the exact packaged artifacts pass executable evidence.
- Maintain standalone local engineering, but shared/authoritative features must fail read-only when the Companion is unavailable.

</specifics>

<deferred>
## Deferred Ideas

- Server-owned ACLs, exact control authorization, and collaboration leases belong to Phase 2.
- Semantic graph/profile redesign belongs to Phase 3.
- Product-wide final accessibility, localization, and 100/500/2,000-object evidence closure belongs to Phase 10, while each phase still implements its own usable states.

</deferred>
