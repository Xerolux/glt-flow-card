# Domain Pitfalls

**Domain:** Home Assistant-based GLT/BMS/SCADA visualization and engineering platform  
**Project:** GLT Flow Card v1.1 Production-Ready GLT Platform  
**Researched:** 2026-08-31  
**Mode:** Brownfield production-hardening of all 30 capabilities  
**Overall confidence:** MEDIUM — repository-specific defects are HIGH confidence from the codebase audit; prevention guidance is cross-checked against current official sources, while deployment alarm policy and numeric performance budgets remain site- and hardware-specific.

## Executive Risk Position

The dominant risk is not missing UI breadth. It is **false authority**: a browser appears to enforce permissions, an accepted Home Assistant service call appears to prove equipment success, a shelved alarm still notifies, a current-value snapshot is called a report, a folder tree is called a semantic model, or a pure-function timing is called 2,000-object support. These failures are unusually dangerous in a BMS-like interface because operators act on what the interface implies.

Production hardening must therefore proceed in dependency order. First establish bounded schemas, lifecycle ownership, storage migration, reproducible artifacts, backend policy, revisions, and exact command targeting. Then add operational and engineering workflows through those boundaries. Keep every capability labelled experimental until its behavioral, failure, permission, restart, migration, and load tests pass. The product remains a Home Assistant visualization/engineering layer, not a certified safety system, industrial protocol driver, certified historian, CMMS, or energy-management-system certification.

The safest rollback pattern is usually **forward recovery**, not downgrade-in-place: retain the previous validated project and Store data, disable the affected command surface or site, restore the old snapshot as a new revision, and reinstall the last verified release only when its schema compatibility is proven. Never use a migration rollback that merely decrements a version field.

## Critical Pitfalls

Mistakes in this section can cause unauthorized control, missed or duplicate alarms, corrupted projects, secret disclosure, persistent Home Assistant faults, or release bytes that differ from reviewed source.

### Pitfall 1: Treating Browser Roles or Project ACL Fields as Authorization

**What goes wrong:** Hidden buttons and client-computed roles are mistaken for a security boundary. Caller-editable project JSON grants roles, read APIs enumerate projects/sites/alarms/audit records across tenants, or new projects let their creator assign arbitrary permissions. A direct WebSocket caller bypasses the UI.

**Why it happens:** Card-only operation and Companion-backed shared operation are blended; list/get/subscription endpoints receive less review than write endpoints; user identity, project ACL, entity permission, site, and configured-control binding are checked in different places.

**Consequences:** Unauthorized topology disclosure, cross-project data access, privilege creation, plant action, remote-site enumeration, or misleading audit records.

**Prevention:** Keep ownership/ACL in a server-owned store outside exported project content. Default deny. For **every** query, command, and subscription, intersect the authenticated `connection.user`, Home Assistant permission, project/site role, and resource binding. Filter collections rather than returning then hiding. Resolve a configured `control_id` server-side to one domain/action/target; overwrite any caller target and reject target-like fields in generic service data. The server owns actor, timestamp, event type, normalized target, result, and correlation ID. Home Assistant documents deriving WebSocket identity from `connection.user` and using `require_admin` for administrative APIs. [Home Assistant permissions](https://developers.home-assistant.io/docs/auth_permissions/), [WebSocket extension API](https://developers.home-assistant.io/docs/frontend/extending/websocket-api/), [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

**Detection:** Build an endpoint inventory with resource, action, required HA permission, required GLT role, server-owned fields, size limit, and audit effect. Flag any handler that returns shared data or invokes I/O without one centralized policy decision. Static searches for frontend role checks are hints, never proof.

**Tests:** Authenticated WebSocket tests with admin, owner/designer, operator, viewer, unrelated user, removed user, and cross-project/site access. Attempt direct calls, guessed IDs, list enumeration, caller-supplied ACLs, caller timestamps, arbitrary audit types, alternate `entity_id` in service data, and subscription after role removal. Assert denial causes no service call, Store mutation, event, or secret-bearing log.

**Rollback:** Disable server-enforced mutations and remote operations, leave validated projects read-only, revoke active subscriptions/leases, rotate any potentially exposed remote token, and restore the last server-owned ACL snapshot. Do not fall back from Companion control to direct browser service calls.

**Phase owner:** Phase 2 — Server policy, shared projects, secure controls, audit, revisions/leases. Reverified in Phases 4, 6, 8, and 9.

### Pitfall 2: Splitting Alarm Authority Between Browser and Backend

**What goes wrong:** The browser derives an alarm row while the backend owns a different lifecycle. Shelving records a timestamp but does not suppress presentation or notifications; acknowledgement clears an active condition; multiple delayed alarms capture the wrong delay; cleared/retriggered occurrences reuse an acknowledgement; restart duplicates notifications or loses pending timers; unavailable input becomes normal; alarm floods starve the loop.

**Why it happens:** Alarm state is represented as booleans and UI colors instead of a transition table with occurrence identity, orthogonal suppression state, timer ownership, persistence, and restart rules.

**Consequences:** Missed, late, duplicate, prematurely cleared, or unsuppressed alarms and operator overload. This product is explicitly not a certified safety system, but misleading alarm behavior is still an operational hazard.

**Prevention:** One Companion alarm service owns the state machine. Index alarms by entity. Give each occurrence a stable ID. Capture delay/hysteresis parameters per task, cancel tasks deterministically, distinguish active/acknowledged/returned/latched/shelved/suppressed/out-of-service, and persist enough state for restart reconciliation. Shelving is bounded, authorized, audited, and suppresses annunciation/notification while condition evaluation continues. Acknowledgement never changes the physical condition. Notification dedupe keys include occurrence and policy version. ISA-18 treats alarm management as a lifecycle; OPC UA Part 9 distinguishes active, shelving, suppression, out-of-service, latching, retention, and refresh. [ISA-18 series](https://www.isa.org/standards-and-publications/isa-standards/isa-18-series-of-standards), [OPC UA alarm model](https://reference.opcfoundation.org/specs/OPC-10000-9/4.8), [OPC alarm security guidance](https://reference.opcfoundation.org/specs/OPC-10000-2/6.9)

**Detection:** Compare backend and frontend state vocabularies; any second condition evaluator is a defect. Instrument pending-task count, transition latency, notification attempts, alarm rate, persistence failures, and restart reconciliation warnings. Detect shelved alarms that still emit operator notification and orphaned delay tasks after clear/unload.

**Tests:** Execute a transition matrix for normal → pending → active-unacked → active-acked → returned-unacked → clear, plus chatter/hysteresis, different delays on one entity, reactivation, latch/reset, shelving expiry, designed suppression, out-of-service, input unavailable/stale, notification failure/retry/dedupe, restart at every state, concurrent ack/clear, flood bursts, retention, and unload. Use controlled clocks, never sleeps.

**Rollback:** Disable notification delivery first if lifecycle correctness is uncertain, preserve raw transition history, cancel owned tasks, expose alarms as read-only/unverified, and restore the last known-good alarm definition revision. Never silently reinterpret stored acknowledgements or suppression flags.

**Phase owner:** Phase 6 — Authoritative alarms, notifications, and schedule bindings.

### Pitfall 3: Migrating or Importing Before Validation and Backup

**What goes wrong:** A normalizer silently stamps old data with the latest version, drops unknown fields, changes IDs, breaks references, trusts future schemas, or partially saves. A `.gltproject` ZIP escapes its extraction directory, overwrites files, expands into a decompression bomb, imports executable URLs, duplicates manifest entries, or transports tokens and ACLs.

**Why it happens:** Schema version, Store version, API version, and plugin-data versions are conflated. Import is treated as deserialization convenience rather than an untrusted boundary.

**Consequences:** Irreversible project loss, privilege corruption, unavailable Companion startup, filesystem compromise, or denial of service.

**Prevention:** Enforce byte/depth/string/list/object limits before normalization. Keep explicit independent versions. Run deterministic, idempotent, sequential `vN → vN+1` migrations on a copy; validate before and after in JavaScript and Python; present dry-run diff and warnings; take and verify a pre-migration snapshot; commit with revision/lease compare-and-swap. Preserve namespaced extension data. For archives, inspect before extraction: entry count, normalized resolved path, duplicates/case collisions, symlinks, type allowlist, compressed and expanded totals, ratio, hashes, and manifest. Project files reference separately installed plugins and never contain executable code or remote credentials. JSON Schema 2020-12 is the current published dialect; OWASP explicitly calls out path traversal and post-decompression limits. [JSON Schema 2020-12](https://json-schema.org/draft/2020-12), [OWASP file-upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [MITRE CWE-23 / Zip Slip](https://cwe.mitre.org/data/definitions/23.html)

**Detection:** Fixture inventory for every historical source shape; reject undocumented inputs. Compare object/reference counts and stable hashes before/after. Run import in a temporary directory and assert every resolved member remains inside it. Fail CI on migration output drift or frontend/backend validator disagreement.

**Tests:** Valid/invalid/boundary fixtures; every supported version; repeated migration; interrupted save; unsupported future version; malformed UTF-8/JSON/YAML; excessive nesting/counts/strings; traversal using `..`, absolute, drive/UNC, mixed separators and Unicode/case collisions; duplicate names; symlink; oversized expansion; corrupt hashes; missing plugin; secret/ACL leakage; round-trip and semantic diff equality.

**Rollback:** Keep the original immutable. Restore its snapshot as a **new** revision after the new stores reload and verify; keep old stores readable through the compatibility window. If a migration fails during setup, leave the entry not-ready with a repair message and no mutating API. Never decrement version fields or partially copy records back.

**Phase owner:** Phase 1 — Contract, schema, lifecycle, storage migration, canonical build. Bundle/diff depth continues in Phase 5.

### Pitfall 4: Returning Successful Unload While Runtime Work Survives

**What goes wrong:** Config-entry unload returns `True` but listeners, time callbacks, WebSocket registrations/subscriptions, alarm tasks, remote connections, HTTP sessions, leases, update listeners, or shared managers remain. Reload duplicates processing and notifications. Options appear in UI but never affect runtime.

**Why it happens:** Resources are registered globally without one lifecycle owner; cleanup callbacks are not stored; task cancellation is not awaited; partial setup paths assume fully initialized runtime state.

**Consequences:** Duplicate alarms/actions, memory and connection leaks, stale policy, errors after reload, and restart-only recovery.

**Prevention:** Store typed runtime ownership in `ConfigEntry.runtime_data`; collect idempotent cleanup callbacks at registration; cancel and await tasks; close sessions/connections; invalidate leases and indexes; unsubscribe events/subscriptions; make command registration safe across entries; test partial setup. Options that change enforcement, retention, or TTL must validate then reload or have an explicit atomic live-update path. Home Assistant lists runtime data and unloading as integration quality requirements. [Integration quality rules](https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/), [config-entry runtime data](https://developers.home-assistant.io/blog/2024/04/30/store-runtime-data-inside-config-entry/)

**Detection:** Runtime ownership registry and diagnostic counts before setup, after setup, after unload, after reload, and after failure. Log only state changes (unavailable/recovered), not secrets or noisy retries. Treat pending owned tasks, duplicate callbacks, or open sessions after unload as test failures.

**Tests:** Setup/unload/reload loops; unload during delay/report/remote request; cancellation; partial setup failure at every resource boundary; option update; Home Assistant stop; two entries if supported; no duplicate service/WebSocket registration; zero owned tasks/listeners/sessions afterward.

**Rollback:** Unload the entry and verify cleanup. If a prior version leaked global resources and cannot unload safely, disable its entry and restart Home Assistant before installing the repaired version. Preserve Store data; do not delete it as cleanup.

**Phase owner:** Phase 1, with release-install verification in Phase 10.

### Pitfall 5: Turning Multi-Site Into an SSRF and Secret-Exfiltration Proxy

**What goes wrong:** Any authenticated caller supplies or edits a URL; the backend follows redirects to loopback/private/link-local/metadata endpoints; DNS changes after validation; alternate schemes, embedded credentials, IPv6 forms, or userinfo bypass checks; remote tokens appear in project YAML, browser responses, logs, diagnostics, errors, bundles, audit payloads, or screenshots. Serial per-entity calls create minutes of head-of-line blocking.

**Why it happens:** Remote HA is modeled as a generic HTTP proxy instead of a server-owned site gateway with a fixed origin, bounded API vocabulary, and policy mediation.

**Consequences:** Internal network access, token theft, cross-site unauthorized control, leaked topology, event-loop exhaustion, and one site freezing the portfolio.

**Prevention:** Only admins configure a site through config entry/subentry data. Map opaque `site_id` to a server-owned HTTPS origin and backend-only least-privilege token. Reject user-supplied URLs and credentials in operational requests. Canonicalize and allowlist scheme/host/port, resolve and validate all addresses, reject disallowed loopback/link-local/multicast/metadata/internal destinations according to deployment policy, disable redirects, and revalidate connections defensively. Bind every remote entity/action/history request to authorized project/site resources. Use one bounded connection/subscription per site, explicit total deadlines, bounded concurrency, backoff/circuit breaker, partial results, freshness, cancellation, and per-site health. OWASP recommends allowlists for identified destinations and disabling redirects to prevent validation bypass. [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

**Detection:** Secret scanner over repo, release ZIP, generated docs, logs, diagnostics, bundles, and browser payloads. Instrument per-site connection state, last success, latency, request/queue counts, deadline/circuit state, and redacted error category. Alert on redirect attempt, origin mismatch, resolution change into denied ranges, unexpected endpoint, or token reuse after rotation.

**Tests:** URL corpus covering schemes, userinfo, Unicode/punycode, IPv4 variants, IPv6, loopback/link-local/private/metadata, DNS rebinding simulation, redirects, certificate failure, oversized responses, slow body, cancellation, token redaction, cross-user/site enumeration, exact remote target audit, one failed site among healthy sites, and 200+ entities under a total deadline. Never target real infrastructure in CI.

**Rollback:** Disable the affected site gateway, cancel subscriptions/requests, purge caches, revoke/rotate the token, keep the portfolio partial with explicit unavailable/freshness status, and preserve redacted audit evidence. Do not expose the token for manual browser fallback.

**Phase owner:** Phase 9 — True multi-site supervision and remote control/history; policy foundations in Phase 2.

### Pitfall 6: Shipping Bytes That Were Not the Reviewed Source

**What goes wrong:** `dist/glt-flow-card.js`, Companion `www`, and standalone designer contain different code; CI patches a pre-existing bundle or commits generated changes after review; movable action tags or ad hoc `npx` installs alter the toolchain; tag/package/manifest/bundle versions disagree; release ZIP includes caches, tests, secrets, or stale assets; HACS installs a different surface than was tested.

**Why it happens:** Generated artifacts are treated as authored source, and plugin plus integration packaging are assumed to be one implicit HACS product.

**Consequences:** Users execute stale or unreviewed code, frontend/backend contracts mismatch, migrations fail only after upgrade, and rollback provenance is unknown.

**Prevention:** One clean build from one authored entry graph and lockfile. Use `npm ci --ignore-scripts` and the lockfile-installed tools. Generate all runtime copies and a manifest with source commit, lock/tool/input hashes and artifact SHA-256. Fail on dirty regeneration and byte inequality. Build ZIP from an allowlist with deterministic metadata. Pin Actions to full SHAs, least privilege, separate read-only PR from release jobs, align versions, run HACS plus Hassfest, attest and checksum artifacts, and install the exact release into representative Home Assistant. npm documents that `npm ci` is frozen and fails on lock mismatch; GitHub calls a full commit SHA the immutable Action reference and notes attestations prove provenance, not safety. [npm `ci`](https://docs.npmjs.com/cli/commands/npm-ci/), [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations), [HACS publisher validation](https://hacs.xyz/docs/publish/action/)

**Detection:** Clean-checkout rebuild; `git diff --exit-code`; byte/hash comparisons; ZIP content allowlist; version parity script; attestation verification; HACS/Hassfest; release-install asset hash and custom-element boot check.

**Tests:** Two clean builds compare; both shipped JS copies equal; tampered artifact fails manifest; missing/stale generated file fails; version mismatch fails; ZIP excludes forbidden files; minimum/current HA install/upgrade/unload/reload; card/Companion capability handshake; HACS plugin and integration category validation against the actual published artifacts.

**Rollback:** Retain the last verified release and its checksums, compatibility range, and pre-upgrade Store snapshot. Withdraw the bad artifact, reinstall only a schema-compatible prior release or publish a forward-fix, and never restore an older binary against migrated stores without an explicit compatibility test.

**Phase owner:** Phase 1 establishes canonical build; Phase 10 closes release evidence.

### Pitfall 7: Publishing Capacity From Token Checks or Pure Functions

**What goes wrong:** A 2,000-item diagnostic loop passes while the actual card clones the project, rebuilds large HTML/SVG trees, scans all objects on each state, leaks observers/listeners after detach, serializes autosaves, routes synchronously, or serially fans out remote requests. The UI freezes despite a green unit test.

**Why it happens:** Object count is treated as the workload. Visibility, DOM/SVG nodes, bindings, update rate, routes, panels, history points, clients, sites, Store size, and browser/host hardware are omitted.

**Consequences:** Main-thread stalls, stale alarms, lost edits, memory growth, Home Assistant loop starvation, timeouts, and misleading product claims.

**Prevention:** Define representative scenarios and budgets before claiming support. Index entity/object/alarm bindings, batch updates per frame, virtualize panels, cull inactive views/layers, reroute only affected edges, offload bounded CPU work when measured, paginate/query bounded history, split Stores, coalesce safe writes, and use bounded remote concurrency/subscriptions. W3C Long Tasks exposes UI-thread tasks of 50 ms or more, but project-specific pass/fail budgets require repeated measurement. [W3C Long Tasks](https://www.w3.org/TR/longtasks-1/), [Playwright tracing](https://playwright.dev/docs/api/class-tracing)

**Detection:** Record first render, state-update latency, pointer/keyboard interaction, route time, save/validation time, backend event processing, Store save/reload, remote total latency, DOM/SVG counts, long tasks, heap, owned listeners/tasks, and dropped/stale updates at 100/500/2,000 objects.

**Tests:** Load the **released** bundle in a real browser; exercise active/inactive views, realistic updates, alarms, routes, trends, editing, save, attach/detach, project switching, two clients, slow remote site, and minimum/current HA hardware classes. Preserve JSON metrics and traces. Functional correctness at all scales blocks immediately; tighten numeric regression budgets only after variance is characterized.

**Rollback:** Remove unsupported numeric claims, cap import/render/query size server-side, disable or virtualize expensive panels, reduce subscription scope, and keep oversized projects read-only with actionable diagnostics instead of crashing or truncating silently.

**Phase owner:** Phase 10, with indexed/event-driven design enforced in every earlier phase.

### Pitfall 8: Confusing Recorder Data, Snapshots, and Reproducible Reports

**What goes wrong:** Current KPIs are labelled a period report; in-memory arrays are called a historian; Recorder exclusions/purges appear as zero; missing samples are interpolated across gaps; totals, measurements, units, counter resets, DST, tariffs, and aggregation types are mixed; generated CSV disagrees with the screen; a Recorder API change silently drops columns.

**Why it happens:** Data coverage and calculation provenance are not first-class. Home Assistant's evolving Recorder/statistics contracts are called directly from multiple panels.

**Consequences:** False energy, maintenance, alarm, and performance conclusions; non-reproducible reports; large database/browser loads.

**Prevention:** One version-tested Recorder gateway. Authorize and bound site/entity/range/point count. Preserve timestamp, unit, source, quality, coverage, raw-versus-aggregate, algorithm, bucket, and timezone. Treat missing omitted columns as null, never zero. Normalize compatible units before aggregation, handle counter reset/rollover and irregular sampling, and persist report definition/version/period/input coverage/warnings/actor—not duplicate raw HA history. Home Assistant statistics depend on sensor `state_class`, and the metadata contract continues to evolve, including 2026.11 removal of `has_mean`. [Home Assistant sensor statistics](https://developers.home-assistant.io/docs/core/entity/sensor/), [Recorder statistics API changes](https://developers.home-assistant.io/blog/2025/10/16/recorder-statistics-api-changes/)

**Detection:** Every chart/report shows available interval and coverage warnings. Reconcile screen, CSV, and report model from one dataset. Compatibility tests fail on unknown metadata. Compare energy parent/submeter totals and flag gaps/overlap rather than forcing reconciliation.

**Tests:** Recorder excluded/purged range, missing/out-of-order data, timezone/DST, unit changes, `MEASUREMENT`/`TOTAL`/`TOTAL_INCREASING`, reset/rollover, incomplete buckets, large bounded range, cancellation, remote partial history, CSV equality, rerun same definition, and API fixtures for minimum/current HA.

**Rollback:** Disable scheduled report publication while retaining definitions; mark affected runs invalid/partial rather than overwrite; fall back to bounded raw-history display where compatible; preserve previous report renderer/gateway until new output reconciles.

**Phase owner:** Phase 7 — Recorder-backed historian, energy, and reports.

### Pitfall 9: Letting Simulation or Commissioning Reach Live Plant Writes

**What goes wrong:** Simulation overrides share the live `hass`/remote action adapter; leaving simulation retains fake state; a commissioning “test” invokes a service by default; readback automation touches physical bus equipment without separate approval.

**Why it happens:** Simulation is implemented as flags inside the live provider, and diagnostics mix observation with remediation.

**Consequences:** Unintended plant commands, false operational display, contaminated audit/history, and unsafe field behavior.

**Prevention:** Separate `StateProvider` and null/blocked `ActionGateway`; a persistent banner/watermark; distinct audit namespace; simulated quality/provenance; hard deny local and remote writes below the UI. Commissioning is read-only by default and compares a captured evidence snapshot against intent. Any live test requires separate explicit approval, bounded targets, preconditions, rollback, and observation. DOE defines commissioning as verifying installed operation against design/engineering criteria. [U.S. DOE HVAC commissioning](https://www.energy.gov/cmei/buildings/hvac-commissioning)

**Detection:** Trace every command through a single action gateway and assert simulation mode cannot construct one. Show provider and source in diagnostics. Flag any commissioning rule with a service/action dependency.

**Tests:** Attempt every control/schedule/alarm/remote path in simulation; deep-link and reload while simulated; exit/reset restores live projection; import malicious scenario with actions; commissioning fixtures remain read-only; fake-service tests cover an explicitly approved round trip without hardware.

**Rollback:** Immediately switch to read-only, cancel pending actions, exit simulation by discarding its provider state, refresh authoritative HA state/project snapshot, and audit any attempted boundary violation. Live hardware recovery is deployment-specific and cannot be automated by repository rollback.

**Phase owner:** Phase 8 — Simulation, commissioning diagnostics, assets/work orders.

### Pitfall 10: Advisory Locks With Last-Write-Wins Saves

**What goes wrong:** A lock is displayed but saves do not require its token; `expected_revision` is optional; lock renewal failure is ignored; restart preserves a stale lock or loses coordination; copied IDs collide; conflicts overwrite the other user's work.

**Why it happens:** Lock UI and project persistence are separate features rather than one atomic write precondition.

**Consequences:** Silent lost updates and corrupted references despite a “collaboration” claim.

**Prevention:** Require durable expected revision for every update and a short server-issued lease token when editing policy is enabled. Atomically check ACL, lease owner/token/expiry, and revision in the same save operation. Leases are runtime-only and invalid on restart; revisions remain durable. Return current revision plus semantic diff and recovery options. Admin break and every lease action are audited.

**Detection:** Storage API must have no update path lacking revision. Monitor lease-renewal failures and conflicts. Treat “save succeeded after lease loss” as a release blocker.

**Tests:** Two browsers acquire/save; stale revision; wrong/expired token; disconnect; renewal race; clock skew; restart; admin break; copy/merge recovery; unload; autosave; semantic diff; no partial save.

**Rollback:** Stop autosave, retain the unsaved draft locally, fetch the current server revision, offer copy/export/semantic merge, and restore an older version only as a new revision. Never renew or self-assert a lease client-side after an ambiguous error.

**Phase owner:** Phase 2, with CAD/autosave E2E verification in Phase 5.

## Moderate Pitfalls

### Treating Names and Folders as Semantics

**What goes wrong:** Auto-mapping binds by name, physical/logical/control relationships collapse into one tree, IDs change on rename, collections imply control, or protocol type is inferred from an entity name/domain.  
**Prevention:** Stable IDs, explicit typed relationships, profile slot constraints, registry-derived provenance, scored/explained candidates, explicit acceptance and undo. Brick explicitly warns that collection membership does not replace physical, ownership, hosting, or control relations. [Brick automation collections](https://docs.brickschema.org/modeling/point-collections.html), [Project Haystack model](https://project-haystack.org/doc/docHaystack/Intro)  
**Early detection/test:** Referential/cycle/cardinality checks; ambiguous candidate fixtures; registry rename/move; rerun preserves overrides; no protocol inference from names.  
**Rollback:** Revert accepted mapping as a semantic diff, keep manual binding, quarantine invalid relationships.  
**Phase owner:** Phase 3.

### Building Symbol Count Instead of a Supported Catalog

**What goes wrong:** Aliases, orientation, color, or minor styling inflate “300+”; variants lack ports, accessible names, profile compatibility, or state/quality/alarm overlays.  
**Prevention:** Generated unique catalog with stable IDs, semantics, provenance, compatible profiles, ports, states, themes and sizes.  
**Early detection/test:** Duplicate hashes/IDs; render every catalog entry; visual matrix; representative semantic overlay tests; missing accessible names fail.  
**Rollback:** Deprecate/quarantine unsupported variants while preserving project placeholders and migration mapping.  
**Phase owner:** Phase 5.

### CAD Mutations Outside a Command/Undo Transaction

**What goes wrong:** Move/resize/routing changes only part of a graph; locked/hidden layers mutate; copy/paste keeps IDs; undo reverses geometry but not bindings; autosave captures an intermediate state.  
**Prevention:** Every mutation is one validated command with inverse, stable IDs/reference remapping, affected-route set, and transaction boundary; save only committed draft states.  
**Early detection/test:** Command round-trip property tests and real pointer/keyboard E2E for group/copy/route/undo/reload.  
**Rollback:** Undo the transaction or reload last server revision while retaining draft export; never patch serialized YAML piecemeal.  
**Phase owner:** Phase 5.

### Same-Realm Plugins Presented as Sandboxed

**What goes wrong:** Project bundles load script URLs, plugins monkey-patch private Home Assistant/card prototypes, duplicate namespaces overwrite core behavior, unload leaves hooks, or a frontend plugin bypasses control policy.  
**Prevention:** Treat executable plugins as trusted installed code. Projects contain declarative namespaced data only. Version/capability negotiation, manifest/schema validation, deterministic register/unregister, error boundaries, frozen public API, and privileged behavior only through separately reviewed Companion code.  
**Early detection/test:** Compatibility fixtures, duplicate/incompatible namespace denial, plugin exception isolation, unload/reload, missing-plugin data preservation, no raw token/action adapter.  
**Rollback:** Disable the plugin, render explicit placeholders, preserve its data, and block destructive re-save if data loss would result.  
**Phase owner:** Phase 5.

### Adding Accessibility at the Final Audit

**What goes wrong:** SVG/canvas is pointer-only, status uses color alone, dialogs leak focus, custom grids have hundreds of Tab stops, kiosk hides alarms/user/exit, sticky panels obscure focus, mobile requires two-dimensional scrolling, and responsive CSS is mistaken for accessibility.  
**Prevention:** Native controls first; keyboard/numeric alternatives to dragging; explicit composite-widget focus model; accessible names and live status; non-color state; visible/unobscured focus; reflow/zoom; adequate targets; reduced motion; critical kiosk recovery affordances. ARIA does not add keyboard behavior, and modal dialogs must manage focus and outside inertness. [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI-ARIA keyboard practice](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)  
**Early detection/test:** Keyboard test per feature PR, ARIA snapshots/axe in opened states, 200%/400% zoom, 320 CSS px reflow, forced colors, reduced motion, touch, screen-reader smoke, orientation and kiosk escape.  
**Rollback:** Preserve the prior accessible interaction path, disable the inaccessible custom widget, and offer table/form/numeric alternatives rather than shipping a pointer-only critical workflow.  
**Phase owner:** Built into Phases 4-9; closure in Phase 10.

### Internationalizing Labels but Not Behavior

**What goes wrong:** Missing keys fall back to IDs; concatenated fragments break grammar; decimal comma parses incorrectly; IDs are localized; dates ignore site timezone; RTL breaks geometry/toolbars; backend and frontend catalogs drift.  
**Prevention:** Stable machine IDs, complete catalog/key/placeholder validation, `Intl` formatting, IANA timezone, logical CSS, long-string and RTL pseudo-locales, localized errors without making human text the API contract.  
**Early detection/test:** Missing/orphan/placeholder CI checks, de-DE numbers, 12/24-hour time, DST, Unicode, plurals, long labels and RTL visual/keyboard tests.  
**Rollback:** Deterministic English fallback while preserving machine values; never rewrite stored data merely to change locale.  
**Phase owner:** Phase 10, with string extraction enforced earlier.

## Capability-by-Capability Failure Matrix

This matrix is the roadmap coverage check. “Rollback” means the safe product response after a defect is detected, not permission to downgrade incompatible data.

| # | Capability | Common failure mode | Detect early | Prevent / executable test | Rollback | Phase |
|---:|---|---|---|---|---|---:|
| 1 | Operational states | Mode, command, actual state, alarm, quality and communication collapse into one optimistic color; stale/unavailable looks live. | Enumerate conflicting-source precedence and every missing/poor-quality branch. | Pure state matrix plus browser fixtures; show timestamp/source/quality reason; never persist derived state as field truth. | Mark projection unknown/stale and show raw HA values read-only. | 3-4 |
| 2 | Object controls | Caller changes target; accepted service call is displayed as physical success; poor-quality/out-of-range target still acts. | Compare configured control binding, normalized action, audit target, and readback target. | Server resolves `control_id`; exact fake-service assertion; denial/bounds/timeout/readback mismatch tests. | Disable control, keep state display, reconcile HA readback; no direct-browser fallback. | 2, 4 |
| 3 | Server roles | UI hides controls while direct API reads/writes; editable ACL grants power. | Endpoint/role/resource matrix and cross-user probe. | Central default-deny policy on list/get/write/control/subscribe; multi-user HA tests. | Read-only Companion mode, restore ACL snapshot, revoke subscriptions. | 2 |
| 4 | Alarm lifecycle | Wrong delay, chatter, ack clears condition, shelving ineffective, restart loses/duplicates occurrences. | Transition-table and pending-task instrumentation. | One indexed backend state machine; controlled-clock transition/flood/restart tests. | Disable notification, preserve history, expose lifecycle unverified/read-only. | 6 |
| 5 | Notifications/escalation | Duplicate on restart, generic notifier, retry storm, notification while shelved, “sent” confused with delivered. | Stable occurrence/dedupe ID and attempt/result metrics. | Priority/site/schedule policy, explicit notify entity, bounded retry, ack/clear stopping rules, failure fixtures. | Pause policy delivery; keep alarms visible and attempts auditable. | 6 |
| 6 | Schedules/calendars | DST/overlap/exception precedence wrong; missed execution swallowed; duplicate minute loop competes with HA. | Preview effective value/next transition across timezone boundaries. | Prefer public HA schedule/calendar/script bindings; controlled time tests for DST, leap, overnight, restart, unavailable target. | Disable GLT execution but keep schedule visualization; retain prior definition. | 6 |
| 7 | Semantic model | Folder membership implies physical/control relation; cycles/orphans/duplicate IDs; rename breaks links. | Schema plus semantic invariant graph validation. | Stable IDs and typed relationships; cycle/cardinality/orphan/rename fixtures. | Quarantine invalid nodes/edges and restore last valid semantic revision. | 3 |
| 8 | Auto-mapping | Name-only silent binding controls wrong entity; rerun overwrites manual choices. | Show ranked candidates, reasons, conflicts and mapping diff before apply. | Profile/domain/unit/device/area/provenance scoring, explicit acceptance, override persistence, undo tests. | Revert mapping transaction; retain manual binding and evidence. | 3 |
| 9 | Parametric profiles | Upgrade changes defaults/slots and silently breaks all instances; units incompatible. | Validate each instance against profile ID/version and required slots. | Namespaced versioned profiles, preview migration, minimum/complete/invalid/migrated fixtures. | Pin prior profile; restore instances as new revision; placeholder missing plugin profile. | 3, 5 |
| 10 | Symbol catalog | “300+” counts aliases; variants lack semantics, ports, states, themes or accessible names. | Generated catalog uniqueness/completeness report. | Render/visual-test every unique ID; representative state/quality/alarm semantics and theme/size matrix. | Deprecate unsupported IDs with explicit placeholder/migration alias. | 5 |
| 11 | Typed ports | Nearest geometry connects incompatible media/direction; resize/rotate detaches transient coordinate. | Port compatibility and attachment invariant validator. | Stable port IDs, typed/multiplicity rules, move/resize/rotate/copy/profile-migration tests. | Mark connection invalid/disconnected without inventing a new port. | 5 |
| 12 | Routing | Impossible route silently crosses objects; reroute destroys locked waypoints; whole graph recomputes. | Collision/detachment check and affected-edge count. | Deterministic obstacle routing, explicit failure, locked segment preservation, incremental 100/500/2,000 fixtures. | Preserve last valid/manual route and show unresolved diagnostic. | 5 |
| 13 | CAD designer | Mutations bypass undo, locked layers change, paste collides IDs, autosave stores partial command; keyboard absent. | Command log/inverse and lock/reference validator. | Transactional command model; pointer + keyboard E2E; reload/YAML/bundle round trip; revision/lease save. | Undo or reload server revision while retaining draft export/copy. | 5 |
| 14 | Drill-down | Breadcrumb loses time/filter; roll-up leaks unauthorized child counts; unknown children counted healthy. | Reconcile visible children, aggregate inputs, permission filter, URL state. | Documented worst-state precedence, partial/stale counts, deep-link/back/time-context tests. | Fall back to authorized flat list with explicit incomplete aggregate. | 4 |
| 15 | Historian/trends/replay | Recorder gaps become zero/interpolation; unit/state-class/API mismatch; huge uncancelled queries. | Coverage/source/unit metadata and query point/range counters. | Bounded compatibility gateway; gap/reset/DST/out-of-order/export tests; cancel stale requests. | Mark range partial; use bounded compatible raw history or disable aggregate. | 7 |
| 16 | Simulation | Simulation can call local/remote service or fake state persists into live view. | Action-gateway invocation assertion and persistent provider indicator. | Separate provider + blocked action gateway; test every control path, reset/exit/reload, scenario import. | Discard simulation provider, refresh HA state, audit attempted violation. | 8 |
| 17 | Commissioning diagnostics | Scan mutates plant, snapshot time/source absent, findings duplicate or confuse comms/config fault. | Declare each rule read/write, input snapshot and evidence link. | Read-only default; deterministic faulty HA fixtures; finding lifecycle/waiver/retest; separate approval for any live write. | Stop scan, preserve evidence, invalidate affected findings; no automated hardware reversal. | 8 |
| 18 | Energy management | Power/energy dimensional mix, resets ignored, missing=zero, tariffs/CO2 not time-versioned, double-counted submeters. | Unit/dimension/coverage and meter-tree reconciliation. | Irregular-sampling/reset/import-export/virtual-meter/baseline tests; provenance for estimated/factor data. | Mark calculation invalid/incomplete and preserve raw series/definition. | 7 |
| 19 | Assets/work orders | Asset rename loses history; due logic trusts bad meter/time; invalid status transitions; attachments leak/overflow. | Stable asset IDs, state-machine and due-input validation, metadata bounds. | Authorized transition tests; rename/move continuity; bounded safe references; alarm/diagnostic links. | Freeze affected work orders, retain history, revert definition as new revision. | 8 |
| 20 | Reports | Current KPI snapshot called period report; wrong scope/timezone/coverage; screen/CSV differ; unbounded run. | Persist run definition/input/version/coverage/warnings and compare output models. | Historical alarm/maintenance/energy inputs, bounded pagination, partial/failure states, reproducibility/export equality tests. | Stop publication/schedule, mark run invalid/partial, retain definition for rerun. | 7 |
| 21 | Multi-site | SSRF/secret leak; serial fan-out; one site blocks all; remote target not bound/audited. | Origin/IP/redirect checks, secret scanning, per-site deadline/health metrics. | Server-owned allowlisted origins, backend tokens, bounded connections/subscriptions, policy parity, partial-failure tests. | Disable site, cancel connections, rotate token, show explicit partial portfolio. | 9 |
| 22 | Plugin SDK | Project imports code; same-realm plugin claimed sandboxed; private HA prototype dependency; unload leak. | Manifest/capability/version/namespace inventory and lifecycle count. | Trusted installed declarative contributions, frozen public surface, error isolation, compatibility/unload/missing-plugin tests. | Disable plugin, preserve namespaced data, placeholder and safe-edit block. | 5 |
| 23 | Provenance | Protocol guessed from name/domain; registry change leaves stale source; sensitive IDs exposed; calculated looks measured. | Compare displayed chain against current entity/device/area/config-entry registries. | Site+entity binding, dynamic registry resolution, explicit unknown/simulated/calculated/remote labels, role redaction tests. | Show entity-only/unknown provenance; never retain inferred protocol as fact. | 3 |
| 24 | Schema/migrations | Arbitrary dictionaries accepted; latest version stamped; unknown fields lost; partial Store conversion. | Shared parity fixtures and historical-format inventory. | Bounded JSON Schema + semantic invariants; sequential pure migration, dry-run, snapshot, idempotence/interruption tests. | Keep old store; restore snapshot as new revision; entry not-ready on failure. | 1 |
| 25 | Bundles/diffs | Zip Slip/bomb/duplicate paths; tokens included; executable plugin; textual diff misses moves. | Pre-extraction manifest/path/size/hash scan and secret scan. | Deterministic allowlisted archive, resolved-path containment, semantic stable-ID diff, malicious corpus/round-trip tests. | Reject without mutation; preserve source file and last valid project. | 1, 5 |
| 26 | Locks/revisions | Lock not enforced; revision optional; lost renewal treated as success; restart stale lock. | Inspect every write precondition and conflict telemetry. | Atomic expected revision + active lease token; two-client/disconnect/expiry/restart/merge tests. | Stop autosave, keep local draft, refetch/diff/copy; old version restored only as new revision. | 2 |
| 27 | HACS Companion | Options ignored; setup/unload incomplete; minimum HA untested; card/Companion contracts mismatch; wrong HACS artifact. | Capability handshake, runtime ownership counts, version/package validation. | Two HA compatibility lanes, Config/Options Flow tests, unload/reload, HACS/Hassfest, exact release install/upgrade. | Degraded read-only card; unload/disable entry; last compatible release plus Store snapshot. | 1, 10 |
| 28 | Internationalization | Hardcoded strings, key drift, localized IDs, decimal/time/RTL failures. | Catalog completeness/placeholders and pseudo-locale CI. | `Intl`, stable IDs, IANA timezone, logical CSS; de-DE/long/RTL/DST/Unicode tests. | Deterministic English fallback without rewriting stored values. | 10 |
| 29 | Accessibility/kiosk/mobile | Pointer-only canvas, focus trap/loss, color-only alarm, tiny targets, kiosk hides recovery, mobile obscures focus. | Keyboard walkthrough and automated scans in every interaction state, not static page only. | Native semantics, focus contracts, drag alternatives, reflow/zoom/forced-colors/reduced-motion/screen-reader/mobile tests. | Use accessible table/form fallback; disable inaccessible critical widget, retain alarms/user/exit. | 4-10 |
| 30 | Behavioral/load/release gates | Source tokens pass while browser/backend/security/migration/artifacts fail; unsupported 2,000-object claim. | Acceptance matrix maps every claim to executable evidence and artifact hash. | Node domain + HA pytest + multi-user WS + Playwright/axe/visual + 100/500/2,000 + clean release/install gates. | Withdraw claim/release, enforce safe limits/read-only mode, reinstall last verified compatible artifact. | 1, 10 |

## Minor Pitfalls

### Logging Everything to Compensate for Weak State

**What goes wrong:** High-volume state values, full project payloads, service bodies, URLs, tokens, comments, or personal data flood logs while the useful correlation/transition fields are absent.  
**Prevention:** Structured event categories, correlation/operation/occurrence IDs, normalized redacted targets, actor/result/error class and synchronized timestamps; never credentials or whole arbitrary payloads. Rate-limit repetitive health logs and preserve authoritative audit separately from client telemetry.  
**Detection/test:** Secret/PII patterns over logs and diagnostics, flood fixture, redaction snapshots, clock-skew fixture.  
**Rollback:** Reduce to safe structured fields, rotate any logged secret, preserve incident evidence under access control.  
**Phase owner:** Phase 2 and every operational phase.

### Swallowing Dependency Failures

**What goes wrong:** Notification, schedule, persistence, Recorder, registry or remote exceptions return empty success/normal states.  
**Prevention:** Stable error codes, health transitions, partial results, retry bounds, and repair guidance; distinguish dependency unavailable from validation/permission failure.  
**Detection/test:** Fault injection for every adapter and assertion that failure is visible, auditable, bounded, and non-mutating.  
**Rollback:** Disable the dependent feature and retain last valid snapshot with explicit staleness; do not fabricate normal/zero.  
**Phase owner:** All phases.

### Over-Claiming Standards and Product Categories

**What goes wrong:** Haystack/Brick-like tags become a conformance claim; HA provenance becomes native protocol support; charts become historian; work orders become CMMS; reports become audit-grade; responsive CSS becomes accessibility; artifact attestation becomes security proof.  
**Prevention:** A claim registry links every README/site/wiki statement to bounded acceptance evidence, version, limitations, and owner. HACS itself warns against misrepresentation in default-repository submission, and GitHub states attestations do not guarantee safety. [HACS inclusion requirements](https://hacs.xyz/docs/publish/include/), [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)  
**Detection/test:** Documentation diff gate checks removed/changed evidence IDs and numeric claims; release review installs the exact artifacts.  
**Rollback:** Correct public claims immediately, label incomplete features experimental, and retain evidence explaining the scope change.  
**Phase owner:** Phase 10, seeded in Phase 1.

## Phase-Specific Warnings

| Phase | Topic | Likely pitfall | Mandatory mitigation / exit evidence |
|---:|---|---|---|
| 1 | Contract, lifecycle, migration, build | Corrupting the only Store while refactoring and producing new artifacts from stale generated code. | Historical fixtures, pre-migration snapshot/hash, split-store reload verification, unload ownership audit, clean-build byte equality, exact release manifest. |
| 2 | Policy, controls, collaboration | Closing write authorization but leaving reads/subscriptions/audit/creation open; target/audit mismatch; advisory locks. | Endpoint matrix, multi-user default-deny tests, exact fake service target/data/context, server-owned audit, atomic revision+lease tests. |
| 3 | Inventory, semantics, profiles, mapping | Inferring semantics/protocol from names and silently auto-binding unsafe controls. | Registry-derived provenance, typed graph invariants, explainable candidates, explicit acceptance/undo, profile migration preview. |
| 4 | Runtime operations and drill-down | Browser projection invents authority; optimistic action success; inaccessible controls and leaking roll-ups. | Snapshot/event reconciliation, pending/readback states, permission-filtered aggregates, keyboard/dialog/mobile E2E. |
| 5 | Catalog, ports, routing, CAD, SDK | Symbol-count theater, broken references/undo, synchronous full reroute, executable project plugins. | Generated catalog evidence, transaction round trips, incremental route benchmarks, declarative plugin manifests and unload/error isolation. |
| 6 | Alarms, notifications, schedules | Alarm/schedule dual engines, broken shelving/delay/restart, retry storms, DST errors. | Authoritative transition matrix with controlled time, restart/flood/dedupe tests, bounded notifications, supported HA schedule/calendar binding research. |
| 7 | Recorder, energy, reports | Snapshot-as-historian, missing-as-zero, wrong units/state class, irreproducible reports, API drift. | Compatibility adapter lanes, coverage/provenance in every output, reset/DST/gap tests, report screen/CSV equality and rerun metadata. |
| 8 | Simulation, commissioning, assets | Simulation/diagnostics reach physical writes; CMMS claims exceed lifecycle data. | Hard-blocked action gateway, read-only fault fixtures, stable asset/work-order states, explicit separate live-test approval boundary. |
| 9 | Multi-site | SSRF, token leakage, cross-site policy bypass, serial fan-out and false global health. | Site-origin allowlist and redirect denial, secret redaction/rotation tests, bounded subscriptions/deadlines/circuit breaker, partial result semantics. |
| 10 | i18n, a11y, capacity, release | Treating cross-cutting quality as a last-week overlay and preserving unsupported claims to meet a date. | Full workflow locale/a11y/manual review, released-bundle 100/500/2,000 evidence, minimum/current HA install/upgrade/unload, claim registry and verified artifacts. |

## Rollback and Recovery Rules

1. **Security defect:** fail closed for the affected query/command/subscription; retain authorized read-only rendering; rotate exposed credentials; never bypass Companion enforcement.
2. **Alarm defect:** preserve condition/history, stop notification/escalation if trust is lost, cancel owned tasks, and visibly degrade rather than report normal.
3. **Migration defect:** never mutate the original; restore a verified snapshot as a new revision; keep old Store data until reload/count/hash checks pass.
4. **Frontend defect:** load the last verified artifact only if its Companion/schema range matches; otherwise keep the project read-only and issue a forward fix.
5. **Remote-site defect:** isolate one site, cancel its work, rotate token if needed, and return partial portfolio data with explicit freshness/health.
6. **Performance defect:** apply server-side bounds, subscription reduction, culling/virtualization or read-only handling; never silently truncate or continue claiming the unsupported scale.
7. **Live-operation defect:** repository rollback does not imply plant rollback. Show authoritative HA state, stop further commands, and require deployment-specific operator procedure; physical writes remain separately authorized and bounded.

## Warning Signs That a Phase Is Not Done

- Acceptance is a source-token/string assertion, screenshot, or manual happy path only.
- A list/get/subscription endpoint lacks the same policy scrutiny as mutation endpoints.
- A server event can be authored or timestamped by the browser.
- A service response is labelled equipment success without readback.
- An alarm transition is derived in both JavaScript and Python.
- Timers, listeners, sessions, subscriptions, or leases have no explicit lifecycle owner.
- A migration has no historical fixture, dry run, backup verification, or idempotence test.
- A remote request accepts a URL or target from the operational caller.
- A secret appears anywhere outside config-entry secret data and transient backend memory.
- A report lacks time window, timezone, inputs, coverage, warnings, definition version, and actor.
- A custom interactive widget has no keyboard/focus model and drag alternative.
- A capacity claim does not load the released bundle and measure actual browser/backend workflows.
- Generated copies are not byte-equal and traceable to one reviewed commit.
- Documentation uses “certified,” “safety,” “historian,” “CMMS,” “true multi-site,” “audit-grade,” “accessible,” or numeric scale without linked passing evidence and limitations.

## Research Gaps and Phase Flags

- **Alarm philosophy:** priority classes, response times, shelving limits, escalation recipients, acknowledgement/return rules, retention and flood targets are deployment policy; ISA/OPC provide models, not this site's decisions.
- **Schedule authoring:** verify the public API available in the chosen minimum HA version. Until proven, bind existing schedule/calendar/script entities rather than write another integration's storage.
- **Recorder gateway:** pin exact minimum/current HA interfaces; 2026.11 statistics metadata changes require explicit compatibility fixtures.
- **Remote authentication:** prototype reconnect, token renewal/revocation, per-entity permission and partial-failure behavior before finalizing long-lived remote subscriptions.
- **SSRF deployment policy:** determine which private-address destinations are legitimate HA sites and enforce a server-owned allowlist; a generic “block all private IPs” rule would break intended local sites, while accepting arbitrary private URLs would create a proxy.
- **Plugin trust:** define install/review/distribution policy. Same-realm browser JavaScript cannot be honestly described as sandboxed by the SDK.
- **Audit retention:** benchmark split Home Assistant `Store` repositories. If required volume exceeds bounded Store behavior, research a supported export/persistence path rather than adding an unmanaged database.
- **Capacity budgets:** 100/500/2,000 functional scenarios are clear, but numeric latency/heap/Store thresholds must be measured repeatedly on representative browsers and Home Assistant hardware before becoming release gates.
- **HACS distribution:** validate whether the desired one-click experience needs distinct plugin and integration entries/artifacts; do not infer category behavior from repository layout alone.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Current repository defects | HIGH | Direct codebase mapping identifies ineffective shelving, delay capture, unenforced locks, unload leaks, broad reads, target/audit mismatch, serial remote reads, incomplete reports and artifact duplication. |
| Home Assistant authorization/lifecycle/Recorder boundaries | MEDIUM | Current official documentation cross-checked; exact supported-version APIs still require minimum/current HA executable tests. |
| Alarm lifecycle and suppression risks | MEDIUM | Strong ISA/OPC primary model; site alarm philosophy and safety classification remain deployment-specific. |
| SSRF, secret, archive and supply-chain controls | MEDIUM | Current OWASP, MITRE, npm, GitHub and HACS guidance; valid local/private remote-site allowlist is a deployment decision. |
| Accessibility criteria | MEDIUM | Current WCAG 2.2 and WAI-ARIA APG are authoritative; conformance requires human testing in the implemented workflows. |
| Performance/capacity risks | MEDIUM | Failure mechanisms are evident; project-specific budgets and supported hardware require measurement. |
| Roadmap phase assignment | HIGH | Derived from explicit architecture dependencies and the all-30-capabilities milestone constraint. |

## Sources

Primary and official sources used for the changing contracts and domain guidance:

- [Home Assistant permissions](https://developers.home-assistant.io/docs/auth_permissions/)
- [Home Assistant WebSocket extension API](https://developers.home-assistant.io/docs/frontend/extending/websocket-api/)
- [Home Assistant integration quality rules](https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/)
- [Home Assistant config flow and migration](https://developers.home-assistant.io/docs/core/integration/config_flow/)
- [Home Assistant sensor statistics](https://developers.home-assistant.io/docs/core/entity/sensor/)
- [Home Assistant Recorder statistics API changes](https://developers.home-assistant.io/blog/2025/10/16/recorder-statistics-api-changes/)
- [ISA-18 alarm-management standards](https://www.isa.org/standards-and-publications/isa-standards/isa-18-series-of-standards)
- [OPC UA Part 9 alarm model](https://reference.opcfoundation.org/specs/OPC-10000-9/4.8)
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP file upload/archive safety](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [npm clean install](https://docs.npmjs.com/cli/commands/npm-ci/)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [HACS publisher validation](https://hacs.xyz/docs/publish/action/)
- [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots)
- [W3C Long Tasks API](https://www.w3.org/TR/longtasks-1/)
- [Brick automation collections](https://docs.brickschema.org/modeling/point-collections.html)
- [Project Haystack introduction](https://project-haystack.org/doc/docHaystack/Intro)
- [U.S. DOE HVAC commissioning](https://www.energy.gov/cmei/buildings/hvac-commissioning)
- [ISO 50001 energy management](https://www.iso.org/standard/69426.html)
- [ISO 55001 asset management](https://www.iso.org/standard/83054.html)

---

*Pitfalls research for roadmap planning; no live plant or physical-bus action was performed or authorized.*
