# Architecture Patterns

**Project:** GLT Flow Card v1.1 Production-Ready GLT Platform  
**Domain:** Home Assistant browser-first GLT/BMS/SCADA visualization and engineering platform  
**Researched:** 2026-08-31  
**Confidence:** MEDIUM overall (HIGH for current-repository findings; MEDIUM for ecosystem recommendations because the research seam classifies verified web research as MEDIUM)

## Recommended Architecture

Adopt a **modular monolith with hexagonal boundaries**, not microservices and not a larger prototype-decorated bundle. Keep one deployable custom card and one optional Home Assistant Companion, but split each into explicit domain services, adapters, and view modules. Home Assistant remains the platform of record; the Companion is an authoritative GLT policy/lifecycle extension; the browser is a rendering and engineering client.

```text
┌──────────────────────────────── Browser ────────────────────────────────┐
│ Lovelace card       Visual designer       Standalone designer           │
│ runtime views       draft/edit tools      local-only engineering        │
│        └───────────────┬──────────────────────────┘                      │
│                        ▼                                                 │
│ UI state/reducers ─ Domain core ─ Plugin registry                       │
│ (ephemeral)         (pure JS)      (trusted declarative capabilities)   │
│                        │                                                 │
│        HaFrontendAdapter / CompanionClient (only I/O boundaries)        │
└───────────────┬──────────────────────────────┬───────────────────────────┘
                │ hass states/services/WS      │ glt_flow_card/v1/* WS
                ▼                              ▼
┌──────────────────────────── Home Assistant ─────────────────────────────┐
│ HA authoritative services                                               │
│ auth + permissions │ states + registries │ service bus │ Recorder │ notify│
│ fieldbus/device integrations │ schedule/calendar/script integrations    │
│                                    ▲                                     │
│                                    │ gateways                            │
│                     GLT Flow Card Companion                              │
│ WS API → policy → application services → repositories/event publisher   │
│           projects │ alarms │ collaboration │ reports │ remote sites    │
│                                    │                                     │
│                split versioned Store documents + runtime indexes         │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ bounded authenticated WS connections
                                     ▼
                           Remote Home Assistant sites
```

This preserves the existing deployment model while eliminating the two current architectural failure modes: browser-side decisions that are mistaken for security, and one large mutable backend document that mixes configuration, operational state, credentials, locks, and history.

Home Assistant's current frontend architecture uses unidirectional data flow: the backend changes, the root `hass` data changes, and components render the new projection. Components may use WebSocket subscriptions for data outside core state. GLT should follow that direction rather than maintaining a second browser-authoritative operational model. [Home Assistant frontend architecture](https://developers.home-assistant.io/docs/frontend/architecture/), [frontend data contract](https://developers.home-assistant.io/docs/frontend/data/)

### Component Boundaries

| Component | Responsibility | Owns | Communicates With |
|---|---|---|---|
| Pure domain core | Schema parsing, deterministic migrations, operational-state derivation, semantic paths, entity scoring, port/routing algorithms, diagnostics, aggregation math, diffs | No I/O or mutable global state | UI reducers, backend schema parity tests |
| Runtime card | Render project + HA state + Companion operational overlay; accessible controls; drill-down, trends, kiosk/leitstand views | Ephemeral selection, viewport, panel state | `HaFrontendAdapter`, `CompanionClient` |
| Visual editor | Edit a draft project through commands; undo/redo; validation; CAD operations; plugin-provided catalog entries | Unsaved draft and undo stack only | Domain core, project API |
| Standalone designer | Safe offline/local engineering and import/export | Explicitly local drafts in `localStorage` | Domain core only; no privileged operations |
| Frontend HA adapter | Normalize `hass.states`, registries, formatting, Recorder queries, and Home Assistant actions into typed app-facing interfaces | Short-lived caches keyed by HA object identity | Home Assistant `hass` APIs |
| Companion client | Versioned command/query/subscription transport; reconnect and snapshot reconciliation | Connection/subscription state | Companion WebSocket API |
| Plugin registry | Validate and register trusted symbol/profile/panel/language contributions by namespace and version | Loaded contribution metadata | Domain core and UI composition root |
| Companion WebSocket API | Validate bounded input, derive server identity, authorize, translate errors, paginate, register subscriptions | No business state | Policy and application services |
| Policy service | Intersect Home Assistant permissions, project ACL, project entity/control bindings, and integration options | Project ACL/ownership rules | HA user permissions, project repository |
| Project service | Validate, migrate, diff, revise, version, and save engineering documents | Revisioned GLT project definitions | Project/ACL repositories, event publisher |
| Control service | Normalize a configured control into one exact HA target/action, authorize, execute, and audit result | Idempotency record and audit event, not device state | HA service gateway |
| Alarm service | Entity-indexed alarm state machine, delay/hysteresis, acknowledgement, shelving, escalation policy | GLT alarm instances/history | HA state events, notify gateway, event publisher |
| Schedule binding service | Validate project schedule bindings and audit scheduled operations; prefer HA schedule/calendar/script primitives | Binding metadata and GLT audit | HA schedule/calendar state and service gateway |
| Asset/work-order service | Asset references and work-order lifecycle | GLT maintenance records | Project/inventory gateway |
| History/report service | Query authoritative history/statistics, combine with GLT alarm/work-order records, return bounded report models | Report definitions, run metadata, not raw HA samples | Recorder gateway, repositories |
| Inventory/provenance gateway | Resolve entity/device/area/floor/config-entry metadata and source integration | Runtime cache only | HA registries |
| Remote-site gateway | Keep credentials server-side, multiplex bounded remote subscriptions/queries, expose health and partial results | Config-entry/subentry secrets and connection health | Remote HA WebSocket/REST APIs |
| Repositories | Versioned, separated persistence with migrations and retention | Only GLT-specific durable data | Home Assistant `Store` |

Home Assistant custom WebSocket commands are expected to declare a message schema and use async handlers for I/O; the current permission guidance derives the user from `connection.user` and provides `require_admin` for administrative endpoints. Every GLT endpoint must therefore authorize on the server, including reads and subscriptions—not merely controls. [Extending the WebSocket API](https://developers.home-assistant.io/docs/frontend/extending/websocket-api/), [Home Assistant permissions](https://developers.home-assistant.io/docs/auth_permissions/)

## Authoritative Data Ownership

| Data | Authority | Persisted Where | Explicit Non-Owner |
|---|---|---|---|
| Entity state, availability, attributes, command confirmation | Home Assistant state machine and source integration | Home Assistant/Recorder per host configuration | Browser and Companion may cache/project only |
| Physical device identity, entity identity, areas/floors, source integration | HA entity/device/area/floor/config-entry registries | Home Assistant registries | Project stores references and optional provenance snapshots, never substitutes identities |
| Fieldbus/protocol communication | Existing HA KNX/Modbus/BACnet/etc. integrations | Owned by those integrations | GLT displays provenance/health only; no native drivers |
| Authentication and base entity permissions | Home Assistant | Home Assistant auth | Project roles can only restrict further, never grant beyond HA |
| Project ownership and GLT ACL | Companion policy store | Separate server-owned ACL Store | Never inside editable/exported project config |
| Diagram, semantic model, profiles, alarm definitions, report definitions, bindings | Revisioned GLT project document | Companion project Store or Lovelace/local draft in standalone mode | Live operational state is excluded |
| Alarm active/clear/ack/shelve/escalation state | Companion alarm service when Companion mode is active | Per-project operations Store | Browser derives display only; no competing alarm lifecycle |
| Service action execution | Home Assistant service bus | HA context/logbook as available; GLT audit stores normalized result | Browser never bypasses Companion when enforcement is enabled |
| Notification delivery | Home Assistant notify entities/integrations | Provider/HA owned | GLT owns policy, dedupe, message content, and delivery-attempt audit only |
| Raw history and long-term statistics | Home Assistant Recorder/statistics | Recorder database | GLT never persists a parallel sample series |
| Report definition and run metadata | GLT project/report service | Project + operations Store | Generated CSV/print model is ephemeral/exported by user |
| Collaboration leases | Companion runtime | Memory only, invalidated on restart; revision remains durable | Browser cannot self-assert a lock |
| Remote-site token | Companion config entry/subentry secret data | Home Assistant config entry storage | Never project YAML, bundles, browser, logs, or API responses |
| UI selection, zoom, open panel, in-progress simulation | Browser instance | Memory; local draft only when explicitly chosen | Backend ignores it |

Home Assistant's entity registry supplies stable IDs for registered entities, while the device registry now scopes a device to one config entry and is adding child-device serialization in the 2026.8/2026.9 line. Store bindings by `site_id + entity_id`, resolve device/provenance dynamically, and tolerate additive registry fields; do not infer a physical protocol from names. [Entity registry](https://developers.home-assistant.io/docs/entity_registry_index/), [device registry](https://developers.home-assistant.io/docs/device_registry_index/), [2026 device-registry WebSocket changes](https://developers.home-assistant.io/blog/2026/08/19/device-registry-websocket-api-changes/), [area/floor linkage](https://developers.home-assistant.io/docs/area_registry_index/)

### Standalone Versus Companion Modes

Keep standalone rendering and engineering, but make the mode boundary explicit:

- **Standalone/local:** read HA states and use Lovelace actions only where the user's HA permissions already permit them; local projects are unshared and carry no trustworthy ACL, audit, lock, alarm, schedule, or remote-site guarantees.
- **Companion/project:** shared reads/writes, controls, alarms, schedules, work orders, reports, locks, and remote sites require the Companion. `server_enforced` is an integration policy returned by the backend capabilities endpoint, not an editable project flag.
- **Degraded mode:** if a Companion-backed project loses its Companion connection, continue read-only rendering from the last valid project snapshot and current local HA state. Disable privileged mutations; never silently fall back to direct service calls.

## Frontend/Backend Contract

Use a versioned namespace such as `glt_flow_card/v1/*` and publish a machine-readable contract fixture used by JavaScript and Python tests. Do not expose raw repository dictionaries.

### Command and Query Rules

1. `capabilities/get` returns contract version, project schema versions, server-enforcement policy, enabled features, limits, and minimum client compatibility.
2. Query responses use `{data, revision, schema_version, permissions, server_time}`. Collections use bounded `limit` and opaque `cursor`.
3. Mutations require `project_id`, `expected_revision`, a client-generated `operation_id`, and—while editing—a server-issued `lease_token`. Omission is an error, not last-write-wins.
4. Errors have stable codes (`unauthorized`, `forbidden`, `validation_failed`, `revision_conflict`, `lease_required`, `not_found`, `rate_limited`, `dependency_unavailable`) plus field paths and a correlation ID; human text is not the contract.
5. The server owns IDs, timestamps, user identity, ACL fields, normalized targets, audit types, and result status. Client-supplied values for those fields are ignored or rejected.
6. Control requests identify a configured `control_id`, not an arbitrary domain/service/body. The server resolves that ID to an allowed action and overwrites the target using a separate Home Assistant `target` object.
7. Large reports and project bundles are bounded. WebSocket returns structured report models or metadata; exports are assembled from validated data rather than accepting executable content.

### Subscription Rules

Provide a project-scoped subscription command with topics such as `project`, `alarms`, `work_orders`, `audit_tail`, `remote_health`, and `report_runs`.

```json
{
  "type": "glt_flow_card/v1/subscribe",
  "project_id": "plant-a",
  "topics": ["project", "alarms", "work_orders"],
  "after_sequence": 418
}
```

The server sends an authorized initial snapshot followed by events containing a monotonic `sequence`, `project_revision`, `topic`, `event_type`, and bounded payload. The client reducer applies events only in order; on a gap or reconnect it requests a fresh snapshot. Home Assistant's JavaScript WebSocket client supports subscriptions that return an unsubscribe function and resubscribe after reconnect, which fits this model. [Home Assistant JS WebSocket subscription contract](https://github.com/home-assistant/home-assistant-js-websocket/blob/master/lib/connection.ts), [WebSocket API](https://developers.home-assistant.io/docs/api/websocket/)

## Data and Event Flows

### Runtime Render

```text
project snapshot ─┐
HA state update ──┼─> normalized selectors ─> view model ─> incremental render
alarm/work-order ─┤
remote overlay ───┘
```

The project snapshot is immutable per revision. HA state updates do not clone or renormalize the whole project. Index bindings once (`entity_id → object references`) and update only affected view models. Simulation is another state-provider adapter and is visibly marked; it never writes into HA state or an authoritative project revision unless the user explicitly saves simulation configuration.

### Secure Control

```text
UI control_id
  → Companion command schema/size validation
  → connection.user + HA entity permission check
  → project role + configured control/entity binding check
  → normalize exact HA action/target/data
  → HA service call with connection-derived Context
  → success/failure audit (server timestamp and normalized payload)
  → command result event
  → later HA state update confirms actual plant state
```

The command result is not the equipment state. Show `pending` until Home Assistant reports the expected state or a configured timeout produces `command_failed`. This prevents optimistic UI from becoming a false operational claim.

### Alarm Lifecycle

```text
HA state_changed
  → entity-to-alarm index
  → deterministic condition + quality evaluation
  → cancellable per-alarm delay task
  → authoritative state machine
  → persist transition and publish event
  → apply shelving/dedup/escalation policy
  → call Home Assistant notify target
  → record delivery attempt/result
```

Model states and orthogonal flags explicitly (for example `NORMAL`, `PENDING_ACTIVE`, `ACTIVE_UNACKED`, `ACTIVE_ACKED`, `RETURNED_UNACKED`, `SHELVED`) and define restart recovery. Acknowledgement does not clear an active condition; shelving suppresses presentation/notification according to policy but does not erase process state. One transition table must be executed in Python and represented in shared fixtures; the browser must not run a competing lifecycle.

Home Assistant offers notify entities and the `notify.send_message` action. GLT should call those interfaces rather than implement email, SMS, or push providers. [Notify entity](https://developers.home-assistant.io/docs/core/entity/notify/)

### Schedules

Prefer bindings to Home Assistant `schedule`/`calendar` entities and scripts/actions over a general GLT minute-loop automation engine. The GLT project stores display/edit metadata and the project-bound action reference; HA remains the time and action runtime. Where a requested editor workflow cannot be expressed through a supported public Home Assistant API, begin with binding existing HA schedule/calendar entities and flag authoring for phase-specific research rather than writing directly into another integration's storage. Calendar entities already expose a subscribed event model through Home Assistant. [Calendar entity and event subscription](https://developers.home-assistant.io/docs/core/entity/calendar/)

### Historian, Energy, and Reports

```text
trend/report request
  → validate project/entity/time-range authorization and limits
  → local or remote RecorderGateway
  → history / long-term-statistics query
  → pure aggregation, unit, tariff and CO2 transforms
  → combine GLT alarm/work-order events
  → bounded report view model
  → browser table/chart/CSV/print
```

Use Recorder long-term statistics when an entity's `state_class` supports them and raw history otherwise. Persist neither raw samples nor a second long-term-statistics database in GLT. Current HA sensor contracts explicitly use `MEASUREMENT`, `TOTAL`, and `TOTAL_INCREASING` to opt into statistics, and the Recorder statistics API continues to evolve, so isolate it behind one adapter and compatibility tests. [Sensor long-term statistics](https://developers.home-assistant.io/docs/core/entity/sensor/), [Recorder statistics API changes](https://developers.home-assistant.io/blog/2025/10/16/recorder-statistics-api-changes/)

### Multi-Site

Represent every binding as `{site_id, entity_id}` with `local` as a real site ID. A `RemoteHaGateway` owns one bounded connection per configured remote site, subscribes only to project-referenced entities, batches changes, applies per-site deadlines/circuit breakers, and publishes explicit health plus partial results. Tokens live in config entry/subentry data. Remote reads and controls pass through the same project authorization and audit services as local operations. Remote history queries the remote Recorder endpoint on demand; it is not copied into the local Store.

## Storage Separation

Replace the current single `glt_flow_card.projects` document with repository-specific versioned stores. A practical first split is:

| Store | Contents | Write Pattern | Retention |
|---|---|---|---|
| `glt_flow_card.project_index` | project ID, name, revision, schema, update metadata | Small atomic save on project CRUD | All projects |
| `glt_flow_card.project.<safe_id>` | one validated engineering document and bounded revision snapshots | Infrequent explicit save; autosave debounced | Configurable versions |
| `glt_flow_card.access` | owner and project ACL separate from project document | Admin/designer mutation only | Current + audit event |
| `glt_flow_card.operations.<safe_id>` | alarm instances, bounded alarm history, work orders, schedule binding markers, report-run metadata | Debounced/coalesced except critical transitions | Per-domain configurable bounds |
| `glt_flow_card.audit.<safe_id>` | server-authored security/operation audit tail | Append in memory + delayed Store save; immediate save for critical actions | Bounded and paginated |
| Config entry/subentries | enforcement options and remote-site credentials | Home Assistant config flow/reconfigure/options | Home Assistant owned |
| Runtime only | alarm indexes/tasks, subscriptions, leases, remote connection pools, idempotency cache | Never serialized as authority | Rebuilt/invalidated at setup |

Home Assistant's `Store` supports version/minor-version migration and delayed saves; large stores can serialize outside the event loop. Use those mechanisms, but keep each document bounded and do not treat `Store` as a time-series database. [Home Assistant Store implementation](https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/storage.py)

## Module Plan: New Versus Modified

Stop adding current behavior to versioned prototype patches. Introduce non-versioned authored modules and retain v1 compatibility shims only during migration.

### New Modules

| Path | Purpose |
|---|---|
| `src/entry.js` | Single canonical production entry/composition root |
| `src/domain/schema/` | JSON Schema 2020-12 documents, validators, sequential migrators, compatibility fixtures |
| `src/domain/model/` | Operational state, semantics, bindings, project diff, alarm display model |
| `src/domain/engineering/` | Profiles, ports, routing, CAD commands, diagnostics, simulation transforms |
| `src/domain/analytics/` | Aggregation, energy, tariff/CO2 and report-model transforms |
| `src/adapters/home-assistant.js` | All frontend `hass` state/registry/action/history access |
| `src/adapters/companion-client.js` | Versioned WebSocket commands, subscriptions, reconnect reconciliation |
| `src/state/` | Immutable reducers/selectors/indexes for project, HA, operations, UI |
| `src/card/` and `src/editor/` | Explicit runtime/editor custom elements and feature panels |
| `src/plugins/` | Manifest validation, capability registry, compatibility SDK facade |
| `custom_components/glt_flow_card/runtime.py` | Typed config-entry runtime data and lifecycle-owned cleanup |
| `custom_components/glt_flow_card/schema.py` | Bounded Voluptuous API schemas and project validation bridge |
| `custom_components/glt_flow_card/policy.py` | HA permission + server-owned project ACL decisions |
| `custom_components/glt_flow_card/repositories/` | Split Store repositories and storage migration |
| `custom_components/glt_flow_card/services/` | Projects, control, alarms, schedules, assets, reports, remote-site application services |
| `custom_components/glt_flow_card/gateways/` | HA inventory, Recorder, notify, service and remote-HA adapters |
| `custom_components/glt_flow_card/api/` | Domain-grouped WebSocket handlers and subscriptions |
| `test/contract/`, `test/browser/`, `tests/components/glt_flow_card/` | Shared contract, real browser, and Home Assistant Python behavior tests |
| `tools/build.mjs` and `tools/verify-artifacts.mjs` | Canonical clean build, manifest/hash creation, byte-equality checks |

### Modified Existing Modules

| Path | Change |
|---|---|
| `src/v100/core.mjs` | Temporarily re-export new pure modules; remove duplicate normalizers after migrated imports |
| `src/v100/catalog.mjs` | Temporarily re-export new catalog/profile registry |
| `src/v100/index.js`, `src/v100/v1-addons.js` | Reduce to compatibility registration; delete prototype decoration feature-by-feature |
| `src/v100/entry.js` | Forward to `src/entry.js`, then retire after one compatibility window |
| `custom_components/glt_flow_card/__init__.py` | Lifecycle/composition only: register API once, construct `runtime_data`, load repositories, subscribe, and unload cleanly |
| `custom_components/glt_flow_card/config_flow.py` | Use options/reconfigure/subentry flows; make options affect runtime and reload safely |
| `custom_components/glt_flow_card/const.py` | Contract/store versions and hard limits only; no unused shadow configuration |
| `custom_components/glt_flow_card/manifest.json` | Declare correct integration metadata/optional dependencies and supported compatibility policy |
| `docs/editor/app.js` | Consume shared editor modules/build output; stop appended-source mutation |
| `tools/apply-v100.mjs` | Retire once canonical build owns generation |
| `.github/workflows/build-v1.yml`, `validate.yml`, `release.yml` | Clean reproducible build, behavior gates, artifact equality, checksums and provenance; no bot-generated source commits |

Do not edit `dist/glt-flow-card.js` or the Companion `www` copy as source. HACS expects a dashboard JavaScript artifact in `dist` or the repository root and downloads release content; one canonical build can satisfy that packaging contract without maintaining two authored copies. [HACS dashboard/plugin publishing](https://hacs.xyz/docs/publish/plugin/)

## Plugin Boundary

Treat all executable plugins as **trusted installed code**, because JavaScript loaded into the same browser realm is not a security sandbox.

- A plugin has a manifest with immutable `id`, namespace, semantic version, supported GLT contract range, contribution types, and optional project-data schema/migrators.
- Project files contain only plugin IDs, versions, declarative configuration, and namespaced data under `extensions.<plugin_id>`. They never contain or download executable URLs/code.
- Contributions are registered through typed capabilities (`symbols`, `profiles`, `panels`, `languages`, `validators`). Duplicate IDs and incompatible versions fail closed.
- Plugins receive a narrow context: selectors, formatting, navigation, and the Companion command gateway. Do not hand them raw remote tokens or backend credentials. A frontend plugin still has the privileges of the loaded page, so documentation must not claim isolation.
- `window.GLTFlowCardSDK` becomes a backward-compatible facade over an instance-owned `PluginRegistry`; freeze registration after startup and remove prototype mutation hooks.
- A plugin cannot add fieldbus drivers or bypass control policy. Backend extensions are out of scope unless packaged and reviewed as Companion code.
- Missing plugins preserve namespaced data, render an explicit placeholder, and block destructive re-save only when loss would occur.

JSON Schema Draft 2020-12 is the current JSON Schema dialect and supports schema identification, validation, and compound schema documents. Use it for project/bundle/plugin manifests while keeping executable migration functions version-controlled in this repository. [JSON Schema 2020-12](https://json-schema.org/draft/2020-12), [core specification](https://json-schema.org/draft/2020-12/json-schema-core)

## Migration Flow

1. **Discover without mutation:** detect inline Lovelace config, local standalone project, v1 Companion store, YAML/JSON, or `.gltproject` bundle.
2. **Parse defensively:** enforce byte/depth/list/string limits before expanding archives; reject path traversal, duplicate manifest entries, executable content, and unsupported future schemas.
3. **Identify independently:** track `project_schema_version`, `storage_version`, `api_contract_version`, and each `plugin_data_version`; never overload one version field.
4. **Sequential pure migrations:** execute `vN → vN+1` functions, each deterministic and idempotent. Preserve the original; never normalize by blindly setting the latest version.
5. **Validate both sides:** validate migrated output in JavaScript and Companion fixtures against the same canonical schema and semantic invariants (unique IDs, valid references, control bindings, bounded sizes).
6. **Dry-run:** return warnings, removed/quarantined paths, plugin gaps, and a structural diff before save.
7. **Server backup:** on accepted migration, write a pre-migration version snapshot, then compare-and-swap using the old revision and active lease.
8. **Storage migration:** migrate the old monolithic Store once into split stores, verify counts/hashes, then mark completion. Keep old data readable for rollback until the new stores pass reload verification.
9. **Compatibility window:** legacy inline/Lovelace projects render and edit locally; promotion to shared Companion mode is explicit. Never silently move ACL-like fields from editable project content into authority without administrator review.
10. **Rollback:** restore a version snapshot as a new revision; do not decrement schema/storage versions in place.

## Patterns to Follow

### Pattern 1: Ports and Adapters Around Home Assistant

**What:** Pure GLT logic depends on small interfaces (`StateProvider`, `InventoryGateway`, `ActionGateway`, `HistoryGateway`, `NotificationGateway`) rather than `hass`, `window`, or Home Assistant internals.  
**When:** Every state, registry, service, Recorder, notify, or remote-site integration point.  
**Why:** Home Assistant APIs and registry serialization change; a single adapter contains compatibility work and makes simulation/test providers realistic.

### Pattern 2: Server-Authoritative Command/Query/Event Model

**What:** Queries return snapshots, commands request mutations, subscriptions publish committed events. Reducers never invent authoritative state.  
**When:** Projects, alarms, work orders, locks, reports, audit, and remote health.  
**Why:** Supports reconnect, multiple users, optimistic revision conflicts, and executable authorization tests.

### Pattern 3: Revision Plus Lease

**What:** Durable compare-and-swap revisions prevent stale writes; short server-issued renewable leases improve collaborative editing UX.  
**When:** Shared project mutation.  
**Why:** A lock alone can be lost; a revision alone detects but does not coordinate. Require both while an editor session is active.

### Pattern 4: Indexed Event Processing

**What:** Build indexes (`entity_ref → alarms/objects`, `semantic_parent → children`, `object_id → geometry`) on project revision change, not on every HA state event.  
**When:** Alarm evaluation, incremental render, auto-mapping, diagnostics, and multi-site subscriptions.  
**Why:** Makes the 100/500/2,000-object requirements measurable without full scans and full DOM replacement.

### Pattern 5: Native-First Accessible Components

**What:** Use semantic HTML buttons, inputs, dialogs, tables, and lists where possible; custom canvas/tree/grid widgets implement explicit keyboard/focus/accessible-name contracts.  
**When:** Runtime controls, CAD canvas, inspectors, alarm tables, dialogs, and toolbars.  
**Why:** ARIA does not supply keyboard behavior automatically. W3C guidance requires custom GUI controls to implement predictable keyboard operation and visible focus. [W3C keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [accessible names](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)

## Anti-Patterns to Avoid

### Frontend Authorization

**What:** Hiding buttons or calculating roles from editable project JSON.  
**Why bad:** Any authenticated client can call APIs directly or alter config.  
**Instead:** Use browser checks only for UX; enforce HA permission + server ACL + resource binding on every command/query/subscription.

### One Giant Manager and Store

**What:** One Python class and one JSON document for projects, alarms, audit, locks, reports, work orders, schedules, and remotes.  
**Why bad:** Unrelated writes rewrite everything; lifecycle and tests become inseparable.  
**Instead:** Application services plus bounded repositories and runtime indexes.

### Dual Alarm/Schedule Engines

**What:** Browser and backend independently derive lifecycle or a GLT minute loop duplicates HA schedule/automation behavior.  
**Why bad:** Restart, shelving, permissions, and transitions diverge.  
**Instead:** One Companion alarm state machine; bind schedule/calendar/script primitives through HA wherever supported.

### Snapshot-as-Historian

**What:** Persisting periodic KPI snapshots or raw entity arrays as GLT history.  
**Why bad:** Duplicates Recorder, loses HA statistics semantics, and scales poorly in `Store`.  
**Instead:** Query Recorder and persist only GLT lifecycle records/report metadata.

### Executable Project Plugins

**What:** Importing script URLs or code embedded in `.gltproject`.  
**Why bad:** A project import becomes arbitrary code execution in the authenticated HA page.  
**Instead:** Declarative bundles referencing separately installed trusted plugins.

### Generated Artifacts as Source

**What:** Patching checked-in `dist` or having CI silently commit regenerated source/output.  
**Why bad:** Reviewed source, release bytes, and Companion bytes can diverge.  
**Instead:** One clean build, byte equality, fail-on-diff, release checksums and provenance.

## Build Provenance and Release Boundary

1. Pin the supported Node and Python/Home Assistant test versions. Use `npm ci --ignore-scripts`; it fails rather than rewriting a lockfile mismatch and performs a frozen install. [npm `ci`](https://docs.npmjs.com/cli/commands/npm-ci/)
2. Invoke the lockfile-installed `esbuild` binary, not an unpinned `npx` fetch. Start from a clean checkout and one `src/entry.js` graph.
3. Generate into a temporary staging directory, then produce `dist/glt-flow-card.js`, the Companion `www` copy, standalone-editor assets, and a Companion ZIP from exactly that output.
4. Create `build-manifest.json` containing product/schema/contract versions, source commit, lockfile hash, tool versions, input graph hash, and SHA-256 for every shipped artifact.
5. Fail CI if `dist/glt-flow-card.js` and `custom_components/.../www/glt-flow-card.js` differ byte-for-byte or if regeneration dirties committed generated files.
6. Pin third-party GitHub Actions to full commit SHAs; GitHub describes a full SHA as the immutable action reference. [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
7. Release only from a version tag whose JavaScript version, Python manifest version, package version, schema range, changelog, and artifact manifest agree.
8. Publish SHA-256 checksums and a GitHub artifact attestation for the JavaScript and Companion ZIP. Attestations bind artifacts to the workflow, repository, commit, and trigger; they prove provenance, not software safety. [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
9. Install the release into a representative Home Assistant test instance and verify resource loading, config-entry setup/unload/reload, storage migration, browser interaction, and artifact hashes before declaring release-ready.

## Scalability Considerations

| Concern | 100 objects | 500 objects | 2,000 objects |
|---|---|---|---|
| Rendering | Full view is acceptable but still incremental | Render active view/layers only | View/layer culling, panel virtualization, no full HTML-string rerender |
| HA updates | Entity-binding index | Batch per animation frame | Selector-level updates, visible-object invalidation, measured memory budget |
| Routing/CAD | Synchronous pure operations | Cache geometry/spatial index | Worker for routing/diagnostics, cancellable jobs, progress feedback |
| Project save | Validate all | Debounced draft validation | Incremental editor validation plus full worker/server validation at save |
| Alarms | Entity index | Entity index + coalesced persistence | Same; no all-project scan on `state_changed` |
| Multi-site | Direct bounded subscription | Per-site batching | Subscription budget, partial results, circuit breaker, visible site health |
| Histories | Bounded range | Downsample/statistics | Recorder aggregates, point budgets, cancel stale requests; no browser-wide raw fetch |
| Collaboration | Revision conflict tests | Revision + lease | Same plus payload limits and measured Store reload/write latency |

Capacity is a release contract, not an algorithm-only claim. Measure first render, update latency, editor drag/routing latency, heap, backend event processing, Store migration/reload, and remote timeout behavior at all three sizes in a real browser and a Home Assistant integration harness.

## Vertical Implementation Order

Build vertical slices that cross schema, frontend, Companion, tests, docs, and generated artifacts. Do not finish all frontend refactoring before exercising the backend contract.

| Order | Vertical slice | Capability coverage | Dependency rationale |
|---:|---|---|---|
| 1 | Contract, schema, lifecycle, storage migration, canonical build | 24–27 and stability foundations of 30 | Every later slice needs safe project data, real Companion setup/unload, executable tests, and reproducible artifacts |
| 2 | Server policy, shared projects, secure controls, audit, revisions/leases | 2–3, 24–27 | Closes current security/collaboration defects before adding privileged workflows |
| 3 | HA inventory, provenance, semantic model, profiles, auto-mapping | 1, 7–9, 23 | Establishes stable entity/site/object bindings used by operations, engineering, diagnostics, and multi-site |
| 4 | Runtime operational projection, object controls, drill-down, leitstand shell | 1–3, 14, 29 | Proves end-to-end state/action/subscription flow and accessible UI composition |
| 5 | Catalog, ports, routing, CAD commands, diff, trusted plugin registry | 10–13, 22, 25 | Builds engineering features on validated schema, bindings, and explicit extension boundaries |
| 6 | Authoritative alarms, notifications, and schedule bindings | 4–6 | Depends on policy, entity indexes, subscriptions, lifecycle cleanup, and HA service/notify adapters |
| 7 | Recorder-backed historian, energy, and reports | 15, 18, 20 | Depends on stable bindings and adapter boundary; avoids locking report design to a fake snapshot historian |
| 8 | Simulation, commissioning diagnostics, assets/work orders | 16–17, 19 | Reuses state-provider abstraction, semantic model, alarms, history, and inventory metadata |
| 9 | True multi-site supervision and remote control/history | 21 plus multi-site parts of 29 | Reuses the exact local policy/action/history contracts, adding only a remote gateway and site health |
| 10 | i18n, accessibility closure, 100/500/2,000 load gates, migration/release evidence | 28–30 | Cross-cutting verification becomes meaningful after all workflows exist; accessibility is built into earlier slices and audited here |

### Phase-Specific Research Flags

- **Schedule authoring:** verify the supported public Home Assistant API for creating/editing schedule or calendar definitions at the chosen minimum HA version. Until verified, bind existing entities rather than mutate HA storage.
- **Recorder backend gateway:** pin and test the exact Python/WS APIs against the supported HA version matrix, especially the 2026.11 statistics metadata change.
- **Remote subscriptions:** prototype authentication renewal, reconnect, per-entity permission behavior, and partial failure before committing to a long-lived remote WebSocket design.
- **Plugin panels:** define trust/install/distribution policy and compatibility rules; same-realm plugins cannot be sandboxed by an SDK wrapper.
- **Large audit retention:** benchmark split `Store` repositories. If operational audit volume exceeds bounded `Store` behavior, research a Home Assistant-supported persistence/export mechanism rather than importing an unmanaged database.

## Sources

Primary and official sources used for current platform contracts:

- [Home Assistant custom card contract](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/)
- [Home Assistant frontend data and `hass` APIs](https://developers.home-assistant.io/docs/frontend/data/)
- [Home Assistant WebSocket extension API](https://developers.home-assistant.io/docs/frontend/extending/websocket-api/)
- [Home Assistant permissions](https://developers.home-assistant.io/docs/auth_permissions/)
- [Config entries and migration](https://developers.home-assistant.io/docs/config_entries_index/)
- [Config-entry unload requirements](https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/)
- [Config-entry runtime data](https://developers.home-assistant.io/blog/2024/04/30/store-runtime-data-inside-config-entry/)
- [Options reload/update contract](https://developers.home-assistant.io/docs/core/integration/options_flow/)
- [Home Assistant integration manifest](https://developers.home-assistant.io/docs/creating_integration_manifest/)
- [Home Assistant architecture for devices/services](https://developers.home-assistant.io/docs/architecture/devices-and-services/)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [W3C ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [HACS dashboard/plugin publishing](https://hacs.xyz/docs/publish/plugin/)

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Current component/storage/security boundaries | HIGH | Directly evidenced by the supplied codebase maps and current source |
| HA frontend, WebSocket, auth, lifecycle, registry boundaries | MEDIUM | Current official Home Assistant docs, cross-checked across multiple pages; research seam tier is MEDIUM |
| Recorder/notify ownership recommendation | MEDIUM | Strong official contracts; exact supported HA version and Python APIs still need phase-specific tests |
| Modular-monolith/component split | HIGH | Direct response to measured local coupling; no external runtime required |
| Plugin trust boundary | MEDIUM | Same-realm JavaScript constraint is fundamental; exact distribution/compatibility policy remains a product decision |
| Storage split and capacity | MEDIUM | Correct separation is clear; retention/write thresholds require measurement at project scale |
| Vertical order | HIGH | Derived from explicit data/security dependencies and the milestone's no-scope-reduction constraint |

---

*Architecture research for roadmap planning; no implementation or release claim is implied.*
