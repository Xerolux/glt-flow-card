# Codebase Concerns

**Analysis Date:** 2026-08-31

## Tech Debt

**Platform 1.0 breadth exceeds production depth:**
- Issue: The product describes a 30-point GLT/BMS/SCADA platform, but many capabilities are thin UI panels, configuration fields, synchronous snapshots, or string-presence assertions rather than complete operational subsystems. The broad claims are concentrated in `README.md`, `docs/site/platform.html`, and `docs/wiki/Platform-v1.md`; implementation is concentrated in one 348-line pure core, one large frontend extension, and one 693-line companion module at `src/v100/core.mjs`, `src/v100/index.js`, and `custom_components/glt_flow_card/__init__.py`.
- Files: `README.md`, `docs/site/platform.html`, `docs/wiki/Platform-v1.md`, `src/v100/core.mjs`, `src/v100/index.js`, `custom_components/glt_flow_card/__init__.py`, `test/v100-backend.test.mjs`, `test/v100-core.test.mjs`
- Impact: “Platform 1.0” can be mistaken for production-grade alarm management, historian, reporting, collaboration, remote-site management, and security. The automated suite passes, but it does not establish those guarantees.
- Fix approach: Convert each Platform 1.0 claim into an acceptance matrix with production behavior, failure handling, persistence, authorization, concurrency, and integration tests. Label incomplete capabilities experimental until those criteria pass.

**Generated bundle and source-of-truth duplication:**
- Issue: The shipped card exists in both `dist/glt-flow-card.js` and `custom_components/glt_flow_card/www/glt-flow-card.js`, while feature source is split across `src/v040-extension.part00` through `src/v040-extension.part06` and `src/v100/*.js`. Build mutation scripts patch a pre-existing bundle rather than a single reproducible source graph.
- Files: `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `src/v040-extension.part00`, `src/v040-extension.part06`, `src/v100/entry.js`, `tools/apply-v040.mjs`, `tools/apply-v100.mjs`, `package.json`
- Impact: Source, distribution, and Home Assistant copies can drift. `package.json` has no canonical build script that regenerates both shipped artifacts from a clean checkout.
- Fix approach: Define one build entry, generate both published copies from it, add a clean-build reproducibility check, and fail CI when committed artifacts differ.

**Configuration options are disconnected from runtime behavior:**
- Issue: The options flow exposes `server_enforced`, `default_lock_ttl`, `max_versions`, and `max_audit`, but `async_setup_entry` ignores `entry.options`; the store continues to use constants from `custom_components/glt_flow_card/const.py`. Frontend `security.server_enforced` is project configuration and is not reconciled with the integration option.
- Files: `custom_components/glt_flow_card/config_flow.py`, `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/const.py`, `src/v100/core.mjs`, `src/v100/index.js`
- Impact: Administrators can change settings in Home Assistant that have no effect, including a setting presented as server-side enforcement.
- Fix approach: Load and validate `entry.options` into `GltStore`, make server enforcement an authoritative backend policy, and add reload/update listeners plus tests proving every option changes behavior.

**Locks are advisory and not enforced on writes:**
- Issue: Lock/unlock APIs maintain `data["locks"]`, but `save_project` and `ws_projects_save` never consult the lock. Revision checks are optional because clients may omit `expected_revision`.
- Files: `custom_components/glt_flow_card/__init__.py`, `src/v100/index.js`, `docs/wiki/Platform-v1.md`
- Impact: A second designer can overwrite a locked project; callers can bypass optimistic concurrency. The “locks and revisions” collaboration claim is not a reliable concurrency boundary.
- Fix approach: Require a valid lock owner/token for writes when locking is enabled, require `expected_revision` for updates, and integration-test concurrent clients, expiration, renewal, and conflict recovery.

**Coarse monolithic modules:**
- Issue: Runtime, editor augmentation, panels, SDK registration, operations, alarms, diagnostics, reports, and project tools are combined in `src/v100/index.js`; persistence, alarms, schedules, reports, remote HTTP, authorization, and all WebSocket handlers are combined in `custom_components/glt_flow_card/__init__.py`.
- Files: `src/v100/index.js`, `custom_components/glt_flow_card/__init__.py`, `src/v040-extension.part00`, `src/v040-extension.part06`
- Impact: Changes have broad regression scope and make isolated testing difficult. Prototype patching in `src/v100/index.js` and `src/v040-extension.part04` creates implicit ordering dependencies on an already-registered base card/editor.
- Fix approach: Split backend services and WebSocket schemas by domain; split frontend panels and decorators into explicit modules with stable interfaces; test extension initialization order.

## Known Bugs

**Shelved alarms are not actually suppressed:**
- Symptoms: `shelve_alarm` records `shelved_until`, but state processing and notification delivery never check it. A shelved alarm can still transition and notify.
- Files: `custom_components/glt_flow_card/__init__.py`, `docs/wiki/Platform-v1.md`, `docs/wiki/Alarms-Controls.md`
- Trigger: Shelve an alarm through `glt_flow_card/alarms/shelve`, then cause its entity to transition active.
- Workaround: Disable the alarm or notification in project configuration; shelving alone is not an operational suppression control.

**Alarm delay tasks can use the wrong delay:**
- Symptoms: The nested `delayed` coroutine closes over the loop-local `delay` without capturing it as a default argument. Multiple matching alarm definitions processed in one state event can cause scheduled tasks to observe the last assigned delay.
- Files: `custom_components/glt_flow_card/__init__.py`
- Trigger: Configure multiple alarms on the same entity with different `delay_seconds` and activate the entity.
- Workaround: Avoid multiple delayed alarms on the same entity until the coroutine captures `delay` per task.

**Project lock does not prevent saving:**
- Symptoms: A client can acquire a lock, while another authorized client saves the same project successfully, especially when omitting `expected_revision`.
- Files: `custom_components/glt_flow_card/__init__.py`, `src/v100/index.js`
- Trigger: Lock a project through `glt_flow_card/projects/lock`, then save from another designer session.
- Workaround: Coordinate edits manually and always send the current revision; this still does not enforce lock ownership.

**Integration unload reports success without unloading:**
- Symptoms: `async_unload_entry` returns `True` but leaves WebSocket registrations, state/time listeners, alarm tasks, and the shared manager active.
- Files: `custom_components/glt_flow_card/__init__.py`
- Trigger: Unload or reload the config entry from Home Assistant.
- Workaround: Restart Home Assistant to guarantee cleanup.

**Report output does not match documented report contents:**
- Symptoms: Server report snapshots contain only current KPI states. Documented alarm and maintenance information is not included, and no historical aggregation is performed.
- Files: `custom_components/glt_flow_card/__init__.py`, `docs/wiki/Trends-Reports.md`, `docs/wiki/Platform-v1.md`
- Trigger: Run `glt_flow_card/reports/run` for any report definition.
- Workaround: Export/assemble alarm and maintenance data separately.

## Security Considerations

**Service target can diverge from the audited entity:**
- Risk: `ws_control_execute` copies caller-controlled `service_data` and uses `setdefault("entity_id", entity_id)`. A supplied `service_data.entity_id` is therefore preserved, while authorization context and audit fields use the separate top-level `entity_id`. An operator can invoke an allowed-domain service on a different target than the audit record claims.
- Files: `custom_components/glt_flow_card/__init__.py`, `src/v100/index.js`
- Current mitigation: The backend restricts service domains and requires operator role for the named project.
- Recommendations: Overwrite—not default—the target entity, validate that the entity belongs to the project/control definition, constrain allowed services per domain, reject unexpected service-data targets, and audit the exact normalized call payload.

**Read APIs expose all platform data to any authenticated Home Assistant user:**
- Risk: Project list/get, alarms, work orders, reports, audit log, remote-site metadata, and remote state proxy handlers do not perform project-role checks. This can expose topology, entity IDs, user activity, comments, operational state, and remote-site URLs to viewers outside the project.
- Files: `custom_components/glt_flow_card/__init__.py`
- Current mitigation: Home Assistant WebSocket access requires an authenticated connection; remote tokens are removed from `remote/list` responses.
- Recommendations: Apply project-scoped read authorization to every handler, filter list results by role, require admin permission for remote-site enumeration/proxying, and add cross-user access tests.

**Audit log accepts arbitrary client-authored events:**
- Risk: Any authenticated client can call `glt_flow_card/audit/add` with an arbitrary event body and timestamp. Entries are not tamper-evident, and trusted server events are indistinguishable from client assertions.
- Files: `custom_components/glt_flow_card/__init__.py`, `src/v100/index.js`, `docs/wiki/Permissions-Audit.md`
- Current mitigation: The backend overwrites `user_id` and `user_name` from the connection.
- Recommendations: Whitelist client event types and schemas, assign server timestamps unconditionally, distinguish client telemetry from security audit events, and use append-only integrity controls if the audit is presented as authoritative.

**New-project creation permits self-selected permissions:**
- Risk: Existing projects require designer role for save, but any authenticated user can create a new project containing arbitrary designer/operator lists. Project IDs also define the shared storage namespace.
- Files: `custom_components/glt_flow_card/__init__.py`, `src/v100/core.mjs`
- Current mitigation: Existing project updates check the existing project role; Home Assistant admins always map to designer.
- Recommendations: Restrict creation to admins/designers under a global policy, set the creator/owner server-side, validate IDs and configuration size, and ignore caller-supplied initial privilege assignments unless authorized.

**Remote control is under-validated and under-audited:**
- Risk: Remote calls accept arbitrary service names and service data for an allowed domain. They do not bind calls to configured project entities, do not use project-specific allowed domains, and do not add success/failure audit events.
- Files: `custom_components/glt_flow_card/__init__.py`, `docs/wiki/Companion-Backend.md`, `docs/wiki/Platform-v1.md`
- Current mitigation: Tokens stay in backend memory, domain names are restricted by `SAFE_SERVICE_DOMAINS`, and project operator role is required.
- Recommendations: Enforce project/site/entity bindings, service allowlists, normalized targets, request size limits, explicit audit records, and defensive remote URL configuration.

**Stored input is weakly bounded:**
- Risk: Project, template, work-order, audit-event, alarm-comment, and report data accept largely unrestricted dictionaries/strings. Read endpoints for several collections have no bounded limit, while `alarms/list` accepts an unconstrained integer.
- Files: `custom_components/glt_flow_card/__init__.py`
- Current mitigation: Audit/history/version collections have fixed retention counts in parts of the implementation.
- Recommendations: Add Voluptuous schemas, maximum string/object/list sizes, bounded pagination, server-owned fields, and rejection tests for oversized or malformed payloads.

## Performance Bottlenecks

**Every state change scans every stored alarm:**
- Problem: `process_state_change` iterates all projects and every alarm for every Home Assistant `state_changed` event.
- Files: `custom_components/glt_flow_card/__init__.py`
- Cause: There is no entity-to-alarm index.
- Improvement path: Build and refresh an index on project save/delete, then process only alarms subscribed to the changed entity.

**Remote state reads are sequential:**
- Problem: `remote_states` performs up to 200 HTTP GET requests one after another, each with a 15-second timeout.
- Files: `custom_components/glt_flow_card/__init__.py`
- Cause: Per-entity REST calls are awaited serially.
- Improvement path: Use bounded concurrency, a bulk endpoint/remote WebSocket subscription where available, caching, and a total request deadline.

**Persistence rewrites one large shared store:**
- Problem: Audit additions, alarm transitions, acknowledgements, shelving, work orders, reports, locks, and project saves call `Store.async_save` on the full shared data object.
- Files: `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/const.py`
- Cause: All operational and engineering records share one Home Assistant storage document.
- Improvement path: Separate stores by domain/project, debounce safe writes, and use bounded/indexed persistence for high-frequency histories.

**The 2,000-object claim is not a rendering/load test:**
- Problem: The only 2,000-object test times `diagnoseConfig` over synthetic in-memory states; it does not instantiate the card, render SVG/DOM, drag, route, serialize, autosave, or process live Home Assistant updates.
- Files: `test/v100-core.test.mjs`, `src/v100/core.mjs`, `src/v100/index.js`, `docs/site/platform.html`
- Cause: The suite uses pure Node tests without a DOM, browser benchmark, Home Assistant frontend, or backend integration harness.
- Improvement path: Add repeatable browser performance tests with 2,000 visible objects and realistic entity updates; set budgets for render, interaction latency, memory, autosave, and routing.

## Fragile Areas

**Prototype patching and registration order:**
- Files: `src/v100/index.js`, `src/v040-extension.part00`, `src/v040-extension.part04`, `src/v040-extension.part06`, `tools/apply-v100.mjs`
- Why fragile: Extensions obtain already-registered custom elements and overwrite prototype methods. Missing base classes cause an early return, and private-method name changes silently break augmentation.
- Safe modification: Preserve load order, add explicit compatibility/version checks, guard every patched method, and run a real browser registration/render test after base-card changes.
- Test coverage: `test/v040.test.mjs` and `test/smoke.test.mjs` assert token presence but do not execute prototype interactions.

**Alarm lifecycle state machine:**
- Files: `custom_components/glt_flow_card/__init__.py`, `src/v100/index.js`, `docs/wiki/Alarms-Controls.md`
- Why fragile: Delay tasks, hysteresis, acknowledgement, clearing, shelving, notification, persistence, and frontend-derived status are split across backend and browser implementations. The runtime panel derives current activity locally instead of reading the persisted backend lifecycle.
- Safe modification: Define one explicit state machine, make backend state authoritative when enabled, cancel/clean tasks deterministically, and test transition tables across restart and concurrent events.
- Test coverage: `test/v100-backend.test.mjs` checks only that source tokens such as `hysteresis` and `alarms/ack` exist; no Python behavior is executed.

**Authorization model:**
- Files: `custom_components/glt_flow_card/__init__.py`, `src/v100/core.mjs`, `src/v100/index.js`, `docs/wiki/Permissions-Audit.md`
- Why fragile: Roles are embedded inside editable project config, frontend and backend calculate roles separately, admins are implicitly designers, read endpoints are mostly unguarded, and the options-level enforcement switch is unused.
- Safe modification: Centralize policy server-side, separate ownership/ACLs from project content, authorize every endpoint, and make the frontend display—not decide—effective permissions.
- Test coverage: No multi-user behavioral authorization tests exist; `test/v100-backend.test.mjs` is string matching.

**Large checked-in distribution artifacts:**
- Files: `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `tools/apply-v040.mjs`, `tools/apply-v100.mjs`
- Why fragile: Manual or partial regeneration can publish code that differs from reviewed modular sources. Failures may appear only in one installation path.
- Safe modification: Generate artifacts in CI from a clean checkout and compare byte-for-byte; never patch committed bundles as the primary development workflow.
- Test coverage: `test/smoke.test.mjs` reads only `dist/glt-flow-card.js`; it does not assert equality with the Home Assistant `www` copy.

## Scaling Limits

**Single Home Assistant storage document:**
- Current capacity: Retention is hard-coded to 5,000 audit entries, 5,000 alarm-history entries, 1,000 report snapshots, and 60 versions per project in `custom_components/glt_flow_card/const.py` and `custom_components/glt_flow_card/__init__.py`.
- Limit: Growth multiplies serialized store size and write cost; project count, work orders, templates, and active alarm state have no explicit total capacity or pagination.
- Scaling path: Use separate paginated stores or a database-backed model, configure retention from working options, and measure write/reload time at documented limits.

**Remote site fan-out:**
- Current capacity: One remote-state request is truncated to 200 entity IDs in `custom_components/glt_flow_card/__init__.py`.
- Limit: Serial calls and a 15-second per-call timeout make multi-site dashboards vulnerable to extreme latency and head-of-line blocking.
- Scaling path: Subscribe/cachе remote states, bound concurrency, apply per-site circuit breakers, and expose partial-result/health semantics.

**Browser-wide object model:**
- Current capacity: A synthetic diagnostics unit test covers 2,000 configuration references in `test/v100-core.test.mjs`.
- Limit: `src/v100/index.js` repeatedly clones/normalizes configs, scans arrays, and builds HTML strings; no measured production capacity exists for rendered equipment, history points, multi-site updates, or editor operations.
- Scaling path: Establish realistic browser benchmarks, virtualize panels, index objects by ID, incrementally update DOM/state, and document supported limits only after testing.

## Dependencies at Risk

**Unpinned frontend build behavior:**
- Risk: Dev dependencies use caret ranges, and no CI workflow in the repository demonstrates clean build/test compatibility across Node versions.
- Impact: Regenerated artifacts can change with dependency resolution or runtime upgrades despite stable source.
- Migration plan: Pin the supported Node version, rely on `package-lock.json` with `npm ci`, add a clean build command, and verify reproducible output in CI.

**Home Assistant API compatibility is not declared or tested:**
- Risk: The custom integration imports internal Home Assistant helpers and WebSocket APIs but `custom_components/glt_flow_card/manifest.json` declares no minimum Home Assistant version and there are no Home Assistant pytest fixtures.
- Impact: API changes can break setup, unload, storage, service calls, or command registration without the Node suite detecting it.
- Migration plan: Add a supported Home Assistant version policy, integration tests against pinned/current HA releases, and release-gate validation.

## Missing Critical Features

**Production-grade backend verification:**
- Problem: The backend is never imported or executed by tests. `test/v100-backend.test.mjs` reads Python as text and asserts feature words exist.
- Blocks: Reliable claims for server-enforced permissions, alarm lifecycle, scheduling, persistence, remote operation, reports, unload/reload, and concurrency.

**Authoritative schema validation and migration:**
- Problem: `ensureV1` normalizes defaults in `src/v100/core.mjs`, while backend saves arbitrary project dictionaries with only a project ID and default schema fields in `custom_components/glt_flow_card/__init__.py`.
- Blocks: Safe upgrades, consistent frontend/backend interpretation, payload bounds, and trustworthy project bundles.

**Operational observability and recovery:**
- Problem: Notification, scheduling, and alarm processing commonly swallow exceptions without structured logs or health state; remote failures are returned only to the caller.
- Blocks: Diagnosing missed schedules, failed notifications, persistence trouble, remote outages, and lifecycle task failures in production.

**True report/historian implementation:**
- Problem: `aggregateSeries` and `integrateEnergy` are in-memory utilities in `src/v100/core.mjs`; backend reports capture current KPI values only in `custom_components/glt_flow_card/__init__.py`.
- Blocks: Durable historian claims, scheduled/period reports, alarm/maintenance reports, reproducible aggregations, and audit-grade exports described in `docs/wiki/Trends-Reports.md`.

## Test Coverage Gaps

**Companion backend behavior:**
- What's not tested: Python import/setup, storage migration, WebSocket schemas, authentication/authorization, control target normalization, locks, revisions, alarms, schedules, reports, remote HTTP, cleanup, and restart recovery.
- Files: `custom_components/glt_flow_card/__init__.py`, `custom_components/glt_flow_card/config_flow.py`, `test/v100-backend.test.mjs`
- Risk: Security and lifecycle regressions pass because tests assert source strings only.
- Priority: High

**Real frontend behavior:**
- What's not tested: Custom-element registration in a browser, rendering, Shadow DOM, dialogs, editor interactions, drag/drop, YAML import, live entity updates, backend calls, accessibility, and visual regressions.
- Files: `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `src/v100/index.js`, `test/smoke.test.mjs`, `test/v040.test.mjs`
- Risk: A bundle can contain expected tokens while being functionally broken.
- Priority: High

**Security boundaries:**
- What's not tested: Cross-user project reads, self-created ACLs, arbitrary audit events, `service_data.entity_id` mismatch, remote proxy access, malformed/oversized input, and unauthorized enumeration.
- Files: `custom_components/glt_flow_card/__init__.py`, `test/v100-backend.test.mjs`
- Risk: Unauthorized disclosure or control can remain undetected.
- Priority: High

**Alarm state-machine edge cases:**
- What's not tested: Different delays on one entity, task cancellation, restart during delay, shelving suppression, acknowledgement across clear/reactivation, unavailable states, notification failure, history retention, and simultaneous changes.
- Files: `custom_components/glt_flow_card/__init__.py`, `test/v100-backend.test.mjs`
- Risk: Missed, duplicate, early, or unsuppressed operational alarms.
- Priority: High

**Platform-scale claims:**
- What's not tested: 2,000-object browser rendering and interaction, multi-site latency, large project persistence, long audit/history collections, concurrent designers, or memory usage.
- Files: `docs/site/platform.html`, `test/v100-core.test.mjs`, `src/v100/index.js`, `custom_components/glt_flow_card/__init__.py`
- Risk: Published capacity and stability claims are unsupported under realistic load.
- Priority: High

**Build and release consistency:**
- What's not tested: Clean regeneration, equality between distribution copies, minified bundle provenance, installation in Home Assistant, HACS packaging, and upgrade from prior stored data.
- Files: `package.json`, `package-lock.json`, `tools/apply-v040.mjs`, `tools/apply-v100.mjs`, `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, `hacs.json`
- Risk: Releases can ship stale or mismatched code even while `npm test` passes.
- Priority: Medium

---

*Concerns audit: 2026-08-31*
