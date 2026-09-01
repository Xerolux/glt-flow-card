# Phase 2: Authoritative Policy, Controls & Collaboration - Research

**Researched:** 2026-09-01  
**Domain:** Home Assistant server authorization, configured controls, trusted operational evidence, optimistic concurrency, and exclusive collaborative editing  
**Confidence:** HIGH for repository findings and HA 2024.8.0/2026.8.3 API compatibility; MEDIUM for OWASP-derived security design; LOW only for the explicitly identified quantitative policy defaults

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Identity, Roles, and Default-Deny Authorization
- Home Assistant's authenticated connection identity is the actor; client-supplied user IDs, roles, timestamps, ACLs, capabilities, project IDs outside the request route, and audit ownership are never trusted.
- Viewer, Operator, Engineer, and Admin are server-owned project roles with an explicit capability matrix. Every command, query, subscription, list/count, remote proxy, and audit read declares a required capability and fails closed when no assignment exists.
- Home Assistant administrators may administer project membership, but grants are capped by their Home Assistant authority and by the fixed role matrix. Project data cannot self-grant permissions, and creating/importing a project cannot select an elevated role.
- Authorization errors use stable non-enumerating codes. Unauthorized projects and aggregate counts are omitted rather than returned with redacted details, while direct access returns the same not-found/denied shape where enumeration would leak existence.

### Configured Controls and Trusted Evidence
- A browser control request names only a server-known project control ID plus bounded user input allowed by that control. The Companion reconstructs the exact domain, service, entity/device/area target, and immutable fields from the verified project head.
- Control definitions use strict allowlisted schemas, payload byte/depth/count limits, explicit domain/service policy, and simulation/maintenance gates. Unknown keys, target overrides, templates, nested service calls, and unsafe domains fail before any Home Assistant service call.
- The backend records separate accepted, dispatched, readback-confirmed, timed-out, denied, and failed evidence with server time, actor, normalized target, request correlation, and bounded error detail. Phase 4 presents these states, but Phase 2 owns their authoritative contract and tests.
- Authoritative audit events and bounded client telemetry are separate stores/contracts. Only server workflows create authoritative events; telemetry is labeled untrusted, rate/size bounded, and cannot impersonate security or control history.

### Revisions, Leases, and Conflict Recovery
- Every shared mutation requires both an exact expected revision and an opaque server-issued lease token bound to project, user, connection/session identity, purpose, and expiry. Neither is optional, including rollback, import, ACL, and project metadata changes.
- A project has one exclusive engineering lease while reads/subscriptions remain concurrent. Leases have bounded TTL, explicit renewal, deterministic expiry, owner-safe release, disconnect handling, and no silent grace period that permits expired writes.
- Saving is an atomic server transaction: re-check role, lease, revision, project digest, and policy immediately before commit. Reconnect never resurrects an old token; the client reacquires and rebases against the current head.
- Conflicts return bounded base/current/candidate revision and semantic-diff evidence without leaking unauthorized content. The UI preserves the user's candidate and supports discard, retry after refresh, or explicit non-destructive merge preview; automatic last-writer-wins is forbidden.

### Browser UX and Authority Loss
- The browser fetches a server capability snapshot for navigation and affordances, but every action is still re-authorized server-side. Disabled actions explain the missing role, lease, revision, or Companion state without exposing hidden projects.
- Shared projects become visibly read-only as soon as Companion authority is absent, stale, or rejects capability refresh. No shared operation falls back to `hass.callService`, localStorage, Lovelace config mutation, or caller-authored WebSocket targets.
- Standalone local engineering remains a separate, explicitly labeled mode with local-only projects and no claim of shared authorization, audit, remote control, or collaboration.
- Two-session browser tests cover lease acquisition/renewal/expiry/reconnect, role changes, concurrent edits, stale revisions, candidate preservation, merge preview, denial, and recovery using the exact generated artifact in German and English.

### the agent's Discretion
- Exact module/class names, fixed capability identifiers, lease duration within a safe bounded option range, audit pagination cursor encoding, and UI placement may follow existing project repository and Project Safety patterns.
- A dedicated policy service may wrap the Phase-1 repository/transaction coordinator or those modules may be extended, provided authorization remains centralized, testable, and impossible to bypass through legacy WebSocket commands.

### Deferred Ideas (OUT OF SCOPE)
- Semantic hierarchy/profile-driven capabilities and protocol provenance are Phase 3.
- Rich operational control presentation and contextual navigation are Phase 4.
- Declarative SDK permission namespaces are Phase 5.
- Full remote-site authentication/transport and failure isolation are Phase 9; Phase 2 supplies reusable policy enforcement only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Viewer, Operator, Engineer, and Admin permissions are enforced by the Companion for every project-scoped query, command, subscription, remote action, and audit read; ACLs are server-owned, default-deny, cannot grant more authority than Home Assistant, and are proven with multi-user denial tests. | Central command-policy registry, fixed role matrix plus HA ceilings, separate versioned ACL repository, non-enumerating query rules, per-event subscription reauthorization, exact configured-control normalization, trusted-audit separation, migration rules, and five-principal HA tests. |
| COLLAB-01 | Shared engineering enforces expected revision plus server lease/lock token atomically, supports renewal/expiry/reconnect, prevents unauthorized or unlocked saves, detects two-client conflicts, and offers non-destructive merge/retry/recovery without lost updates. | In-memory connection-bound opaque lease manager, one atomic mutation coordinator, revision/digest/policy recheck, token rotation and disconnect cleanup, bounded three-way merge preview, failure injection, and exact-dist two-browser tests. |
</phase_requirements>

## Summary

Phase 1 already supplies the difficult persistence foundation: split authoritative project stores, immutable snapshots and journals, exact-revision preview/apply/rollback, opaque user-bound preview identities, forward recovery, and an exact-artifact test/release harness. Phase 2 should not create a second persistence path. It should place one mandatory policy-and-collaboration coordinator in front of the existing repository and transaction coordinator, then make command registration prove that every `glt_flow_card/*` handler has an explicit policy declaration. The current legacy paths are not a safe base by themselves: project reads and aggregate lists are broadly exposed, roles come from caller-editable project JSON, `expected_revision` is optional on a legacy save, stored locks are user-only and are not checked by writes, controls accept caller-selected service targets, and `audit/add` lets the browser create audit-looking rows. [VERIFIED: repository inspection]

Home Assistant's WebSocket connection is the authoritative actor boundary. In both supported repository lanes, 2024.8.0 and 2026.8.3, `ActiveConnection` exposes the authenticated `user`, `refresh_token_id`, per-connection `subscriptions`, contextual message creation, and disconnect cleanup; command handlers can be registered with `websocket_command`, `async_response`, and `async_register_command`. The official permission contract requires authorization with the correct user context, and HA's own WebSocket handlers re-check entity permissions while forwarding subscription events. [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/connection.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/connection.py] [CITED: https://developers.home-assistant.io/docs/auth_permissions/]

The required design is therefore a deny-by-default capability registry, a separate server-owned ACL store with its own exact revision, ephemeral connection/session-bound engineering leases, and a single critical section that rechecks policy, lease, content/access revision, and digest immediately before commit. Browser capability snapshots and subscriptions are availability/UX hints only. Shared mode must enter read-only immediately on stale or missing authority and must never fall back to direct services or browser persistence. Configured controls must be reconstructed from the current verified project head and executed through HA with separately normalized `service_data` and `target`, a server context, explicit HA entity-permission checks, and lifecycle evidence that never equates dispatch with readback confirmation. [VERIFIED: Phase 2 CONTEXT.md, UI-SPEC.md, and repository inspection] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]

**Primary recommendation:** Add a centralized `PolicyCoordinator` that owns role/capability decisions, ACL revisions, lease validation, cursors/subscriptions, configured-control policy, and trusted evidence; require every current and new WebSocket command to register through it; integrate its mutation guard inside the Phase-1 transaction lock; then prove the result through multi-user HA fixtures, two exact-dist browser sessions, failure injection, and artifact/release equality. [VERIFIED: architecture synthesis from locked context and inspected Phase-1 seams]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Actor identity and HA authority ceiling | API / Backend | Home Assistant auth/permissions | `connection.user`, HA admin state, and entity permissions are server-owned and cannot be derived in the browser. [CITED: https://developers.home-assistant.io/docs/auth_permissions/] |
| Project role assignments and capability matrix | API / Backend | Database / Storage | Decisions are computed server-side; assignments and their revision persist outside project JSON. [VERIFIED: Phase 2 CONTEXT.md] |
| Non-enumerating project/list/count behavior | API / Backend | Browser / Client | The backend filters before serialization; the browser removes stale rows and never reconstructs hidden counts. [VERIFIED: Phase 2 CONTEXT.md and UI-SPEC.md] |
| Exclusive engineering lease | API / Backend | Browser / Client | The server owns token, binding, expiry, and atomic validation; the browser keeps only the current opaque bearer in memory. [VERIFIED: Phase 2 CONTEXT.md and UI-SPEC.md] |
| Project commits and merge apply | API / Backend | Database / Storage | Phase-1 journaling/snapshots remain authoritative; policy/lease checks join the same critical section. [VERIFIED: repository inspection] |
| Candidate preservation and conflict choices | Browser / Client | API / Backend | The unsaved candidate stays in session memory; the backend returns bounded authorized base/current/candidate evidence and validates the chosen merge. [VERIFIED: Phase 2 UI-SPEC.md] |
| Configured control resolution and dispatch | API / Backend | Home Assistant services/state | The server resolves control ID from the current head, validates policy, creates exact target/data/context, dispatches, and checks readback. [VERIFIED: Phase 2 CONTEXT.md] |
| Capability/role/lease event subscriptions | API / Backend | Browser / Client | The backend reauthorizes each event and maintains sequence; the browser fails read-only on gaps/expiry/revocation. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py] |
| Trusted operational evidence | API / Backend | Database / Storage | Only server workflows author it; pagination/filtering are policy-scoped and bounded. [VERIFIED: Phase 2 CONTEXT.md] |
| Client telemetry | API / Backend | Database / Storage | The browser may submit bounded untrusted observations; the server labels and stores them separately and rate limits them. [VERIFIED: Phase 2 CONTEXT.md] |
| Authority state and accessible recovery UI | Browser / Client | API / Backend | `AuthorityStateBar` renders server evidence and immediate read-only/recovery state without becoming an authority. [VERIFIED: Phase 2 UI-SPEC.md] |
| Remote transport | API / Backend | External Home Assistant site | Phase 2 only supplies capability enforcement; the current broad remote paths must fail closed until Phase 9 owns transport/authentication. [VERIFIED: Phase 2 deferred decisions and repository inspection] |

## Project Constraints (from AGENTS.md)

- Home Assistant remains runtime, state source, service broker, authentication system, Recorder, notification system, and fieldbus integration layer. Browser role checks are UX only; all shared reads/writes/controls/remote calls/authoritative audit events require server-side enforcement. [VERIFIED: AGENTS.md]
- Preserve standalone card operation only where safe; privileged shared operations must visibly disable when Companion enforcement is unavailable. [VERIFIED: AGENTS.md]
- Edit authored modules and generators, never only `dist/glt-flow-card.js` or the Companion `www` copy. Regenerate and compare `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, and `docs/editor/app.js`. [VERIFIED: AGENTS.md]
- Preserve existing Lovelace/YAML projects through bounded validation and migration. Publish performance/capacity claims only after repeatable 100/500/2,000-object browser/backend measurements. [VERIFIED: AGENTS.md]
- Executable behavioral tests are required; source-token assertions alone do not satisfy SEC-01 or COLLAB-01. No live bus/plant write is authorized; control tests use controlled HA services only. [VERIFIED: AGENTS.md]
- Use Node.js 22 and npm lockfile v3 in parity with CI (`npm ci --ignore-scripts`), Python 3.13 for Companion tests/syntax, the Node built-in runner, existing pytest HA harness, and existing exact-dist Playwright workflow. [VERIFIED: AGENTS.md and repository inspection]
- Keep pure deterministic logic in focused modules, use Home Assistant WebSocket conventions in Python, deep-copy persistence results, translate expected failures to stable protocol errors, escape untrusted browser text, and never log entity payloads, user input, credentials, control bodies, or lease tokens. [VERIFIED: AGENTS.md]
- Match local formatting; do not introduce React, TypeScript, ESLint, formatter, or another frontend framework. Maintain browser/asyncio lifecycle cleanup and generated-source boundaries. [VERIFIED: AGENTS.md and Phase 2 UI-SPEC.md]

## Standard Stack

### Core

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Home Assistant custom integration APIs | 2024.8.0 minimum; exact current lane 2026.8.3 | Authenticated WebSocket commands, user permissions, services, state listeners, config-entry lifecycle, storage | Host-provided authority and runtime; the required connection/command APIs were checked in both exact lanes. [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/decorators.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/decorators.py] |
| Existing project repository/transaction modules | Repository HEAD, Phase-1 implementation | Heads, snapshots, journals, recovery, preview/apply/rollback, audit projection | Already release-verified and avoids a competing write path. [VERIFIED: repository inspection and Phase-1 summaries] |
| Python standard library | Python 3.13 test lane | `secrets`, `hashlib`, `hmac.compare_digest`, `time.monotonic`, `asyncio`, bounded collections | Sufficient for opaque leases, monotonic expiry, locks, and constant-time digest comparison; no security package is required. [CITED: https://docs.python.org/3/library/secrets.html] |
| Native Web Components and HA frontend APIs | HA 2024.8.0+ browser runtime | Project Safety UI, `hass.callWS`, `connection.subscribeMessage`, accessible state transitions | Existing card architecture and official HA frontend data path. [CITED: https://developers.home-assistant.io/docs/frontend/data/] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-homeassistant-custom-component | 0.13.316 locked in repository tooling | Real HA setup, authenticated WebSocket clients, stores, services, lifecycle tests | All server policy, lease, control, subscription, migration, and unload behaviors. [VERIFIED: repository lock/tooling inspection] |
| @playwright/test | 1.62.1 locked | Two isolated browser contexts using exact generated card and a shared fake coordinator | All two-session, authority-loss, DE/EN, keyboard, responsive, effect-ledger, and token-leak E2E. [VERIFIED: package.json and node_modules inspection] |
| Node.js built-in test runner | Node 22 CI | Pure capability maps, browser state reducers, i18n/catalog and generated-contract tests | Fast per-task checks without adding a framework. [VERIFIED: package.json and AGENTS.md] |
| Existing JSON Schema/AJV and Python contract validator | JSON Schema 2020-12; AJV 8.20.0 | Current project-head validation and bounded project/control definition loading | Validate the full project before resolving controls; add a narrow control-input schema rather than accepting arbitrary service data. [VERIFIED: repository inspection] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate server-owned ACL repository | Keep `config.permissions` authoritative | Rejected: imported/caller-edited project data can self-grant and immutable historical snapshots would mix content with authority. [VERIFIED: repository inspection and locked context] |
| In-memory connection-bound lease | Persist legacy locks in HA Store | Rejected: persisted user-only locks can survive restart/reconnect without a valid connection/session binding and are not write guards. [VERIFIED: repository inspection] |
| One central command-policy registry | Scattered `_require_project_role` calls | Rejected: current read/list/audit/remote paths demonstrate omission risk; a registry can fail tests/startup when a handler lacks a declaration. [VERIFIED: repository inspection] |
| Server-owned control IDs | Browser-selected domain/service/target | Rejected: it creates a confused-deputy path and audit/target mismatch. [VERIFIED: repository inspection and locked context] |
| Server-state opaque cursors | Caller-controlled offset/limit or a hand-rolled signed cursor | Opaque server state is simpler, connection/user/project bound, and invalidates safely at restart; it avoids exposing/tampering with offsets and avoids custom key management. [VERIFIED: architecture synthesis from locked context] |
| Existing pure semantic diff plus explicit merge selections | Generic JSON merge or last-writer-wins | Generic merge loses domain dependency semantics; LWW is explicitly forbidden. [VERIFIED: Phase 2 CONTEXT.md and existing project_diff implementation] |

**Installation:** no new package is needed. Use the locked environment:

```bash
npm ci --ignore-scripts
py -3.13 -m pip install -r requirements-test.txt
```

[VERIFIED: package.json, package-lock.json, requirements_test.txt, and AGENTS.md]

## Package Legitimacy Audit

No external package is introduced by this phase, so the package-legitimacy gate is not applicable. The implementation must use the already locked/tested repository dependencies and Python/Home Assistant APIs. [VERIFIED: recommended stack above]

## Architecture Patterns

### System Architecture Diagram

```text
HA-authenticated WebSocket connection
          |
          v
Command registration manifest (every glt_flow_card/* route declared)
          |
          v
PolicyCoordinator ----------------------------------------------------+
  actor = connection.user                                             |
  fixed role -> effective capabilities intersect HA ceiling           |
  route/project non-enumeration                                       |
  subscription/cursor/rate bounds                                     |
          | authorized                                                 |
          +----------------------+----------------------+---------------+
          |                      |                      |
          v                      v                      v
ProjectAccessRepository      LeaseManager         ControlPolicy
(server ACL + revision)      (memory only)         (current head)
          |                      |                      |
          +----------+-----------+                      |
                     v                                  v
             MutationCoordinator                normalized HA call
             role + lease + revision            accepted -> dispatched
             + digest + policy recheck          -> confirmed/timeout/fail
                     |                                  |
                     v                                  v
        Phase-1 ProjectTransactionCoordinator     TrustedEvidenceStore
        journal -> immutable snapshot -> head             |
                     |                                     v
                     +------------------------------> authorized cursor /
                                                       subscription output

Browser exact generated artifact
  capability snapshot/subscription -> AuthorityStateBar
  token + candidate in memory only -> lease/conflict/merge UI
  stale/gap/disconnect -> immediate shared read-only, never fallback
```

The entry path, processing stages, decision boundaries, stores, HA service boundary, and browser recovery path are all explicit; no project or service side effect is reachable without the policy coordinator. [VERIFIED: recommended architecture from locked context]

### Recommended Project Structure

```text
custom_components/glt_flow_card/
├── policy.py                    # capability IDs, role matrix, decisions, command manifest
├── project_access.py            # server-owned ACL store, revision, legacy bootstrap
├── project_leases.py            # ephemeral opaque connection/session-bound leases
├── configured_controls.py       # control resolution, input schema, exact HA normalization
├── trusted_evidence.py          # server event factory, telemetry separation, cursors
├── project_transactions.py      # existing coordinator; accept in-lock mutation guard
├── project_repository.py        # existing authoritative project stores
└── __init__.py                  # thin handlers, lifecycle registration, no policy logic
src/v100/
├── project-authority.mjs        # capability/lease/revision state reducer, pure
├── project-collaboration.mjs    # candidate/conflict/merge orchestration, pure boundaries
├── configured-control.mjs       # control preview/confirmation/result state, no target input
├── project-safety.js            # Project Safety UI integration
└── project-safety-i18n.mjs      # all DE/EN strings and state labels
tests/components/glt_flow_card/
├── test_policy.py
├── test_project_access.py
├── test_project_leases.py
├── test_configured_controls.py
├── test_trusted_evidence.py
├── test_collaboration.py
└── test_phase2_lifecycle.py
test/e2e/
├── fixtures/shared-authority.mjs
└── project-authority.spec.mjs
```

Names are discretionary, but the separation is important: route handlers stay adapters; deterministic rules stay unit-testable; persistence, ephemeral leases, plant dispatch, and browser state are distinct failure domains. [VERIFIED: Phase 2 discretion plus project conventions]

### Pattern 1: Capability Registry as a Registration-Time Completeness Gate

Define fixed capability identifiers and an immutable role matrix in one module. Define a `COMMAND_POLICIES` manifest keyed by every WebSocket type; entries declare scope (`global`, `project-item`, `project-collection`), capability, route project field, non-enumeration behavior, lease/revision requirement, and whether the feature is implemented in this phase. Registration must reject duplicate commands and fail tests/startup when the registered command set differs from the manifest. This converts “remember to authorize” into an executable invariant. OWASP recommends deny-by-default and permission validation on every request; object-level tests are required for every read and mutation surface. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html]

Recommended fixed effective-capability matrix:

| Capability family | Viewer | Operator | Engineer | Admin | Additional HA ceiling |
|-------------------|:------:|:--------:|:--------:|:-----:|-----------------------|
| `project.list/read/subscribe` | ✓ | ✓ | ✓ | ✓ | Active authenticated user; entity-derived fields still require HA read permission. |
| `control.preview` | — | ✓ | ✓ | ✓ | All target entities/devices must be permitted; maintenance/simulation gate. |
| `control.execute` | — | ✓ | ✓ | ✓ | `POLICY_CONTROL` for every resolved entity plus exact service allowlist. |
| `alarm.read/ack/shelve`, `work_order.read/write`, `report.read/run` | read | ✓ | ✓ | ✓ | Capability remains explicit per route; later phases may narrow domain rules. |
| `project.preview/validate/diff` | — | — | ✓ | ✓ | Current authorized project head only. |
| `lease.acquire/renew/release` | — | — | ✓ | ✓ | One active engineering lease per project; role checked each time. |
| `project.apply/import/rollback/metadata` | — | — | ✓ | ✓ | Exact content revision + valid lease + digest/policy recheck. |
| `project.delete` | — | — | — | ✓ | Valid lease, exact content revision, destructive confirmation evidence. |
| `members.read/manage` | — | — | — | ✓ | Effective only when `connection.user.is_admin`; eligible users come from HA server-side lookup. |
| `audit.read` | ✓ | ✓ | ✓ | ✓ | Project-filtered authorized events only; no totals for hidden projects. |
| `audit.export`, `telemetry.read` | — | — | — | ✓ | Export/read explicitly authorized and provenance-separated. |
| `telemetry.append` | ✓ | ✓ | ✓ | ✓ | Bounded/rate-limited; never creates trusted evidence. |
| `remote.read/control` | — | explicit | explicit | explicit | Policy surface exists, but transport/action returns fail-closed “not available” until Phase 9. |

The table is a recommended fixed matrix within the agent's locked discretion; the important security rule is that the browser receives effective capabilities, never derives them from role names, and that `members.manage` and entity control remain capped by HA authority. [VERIFIED: Phase 2 CONTEXT.md and UI-SPEC.md]

Existing/new command coverage must be explicit:

| Current/new WebSocket surface | Policy treatment |
|--------------------------------|------------------|
| `projects/list` | Filter heads before serialization; return only authorized rows and authorized counts. HA admins may receive membership-administration summaries without gaining project content. [VERIFIED: locked non-enumeration rule] |
| `projects/get` | `project.read`; missing and unauthorized share one stable shape/code. [VERIFIED: locked non-enumeration rule] |
| Legacy `projects/save` | Remove optional/broad semantics; compatibility path must require policy + lease + exact revision or return a stable contract-upgrade error with zero write. [VERIFIED: repository inspection] |
| `projects/preview`, `projects/apply`, `projects/rollback` | Preview requires Engineer; apply/rollback require Engineer, exact revision, valid lease, current policy/digest; preview identity remains opaque and user/project bound. [VERIFIED: Phase-1 and Phase-2 contracts] |
| `projects/delete` | Admin + lease + exact revision; transaction/tombstone path, no direct unjournaled delete. [VERIFIED: architecture recommendation] |
| Legacy `projects/lock`, `projects/unlock` | Retire; do not translate stored/user-only locks into valid leases. Expose new `leases/acquire|renew|release|status`. [VERIFIED: repository inspection and locked lease contract] |
| `templates/list`, `templates/save`, `templates/delete` | Declare global/template capabilities; mutations require an explicit revision/lease model if templates are shared, otherwise keep read-only until that model exists. No unclassified global handler. [VERIFIED: deny-default design] |
| Legacy `control/execute` | Replace schema with `controls/preview` and `controls/execute` accepting project route, opaque control ID, expected project revision/digest, preview/correlation evidence, and bounded declared input only. [VERIFIED: locked control contract] |
| `alarms/list`, `alarms/ack`, `alarms/shelve`, `work_orders/list`, `work_orders/save`, `reports/run`, `reports/list` | Each route declares project capability now, even though lifecycle depth lands in Phase 6. Shared mutations require the same revision+lease contract or fail closed until migrated. [VERIFIED: SEC-01 scope and roadmap boundaries] |
| `remote/list`, `remote/states`, `remote/control` | Require a routed project and explicit remote capability; do not expose configured sites/counts or dispatch while Phase 9 transport is deferred. [ASSUMED] |
| Legacy `audit/add` | Remove as trusted path. Migrate to `telemetry/append`, with a separate untrusted schema/store/rate limiter. [VERIFIED: locked audit separation] |
| `audit/list` | `audit.read`, mandatory project route, fixed page size 50, opaque bound cursor, no unauthorized total. [VERIFIED: Phase 2 UI-SPEC.md] |
| New `policy/snapshot|subscribe`, `members/list|eligible|update`, `merge/preview|apply` | Each has its own policy declaration; subscription events reauthorize before each send, membership updates use exact access revision + lease, merge apply uses normal project mutation guard. [VERIFIED: Phase 2 UI-SPEC.md and design synthesis] |

### Pattern 2: Server-Owned ACL Store and HA Privilege Intersection

Store membership outside project configuration in a versioned `glt_flow_card.project_access` Store keyed by project ID. Each record contains a monotonic `access_revision`, role assignments, server timestamps, and migration version; it never stores arbitrary capability lists. The fixed role matrix lives in code. Effective capabilities are `fixed_role_capabilities ∩ HA_authority_ceiling ∩ current_policy_gates`. Project JSON `permissions`, imported ACL fields, URL/local storage fields, and client-submitted role/capability claims are ignored for authorization. [VERIFIED: locked context and repository schema inspection]

Only HA administrators with the effective Admin membership capability may mutate membership. A HA administrator who is not assigned a content role may receive the minimal membership-administration project summary needed to bootstrap/manage access but does not automatically receive project content/control/audit capabilities. [ASSUMED] Eligible-member rows come from `await hass.auth.async_get_users()` after `members.manage` authorization and are reduced to safe server-supplied display identity; arbitrary submitted user IDs must match that current eligible set. Exact HA source in both lanes provides the auth manager list API and admin-only reference command behavior. [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/config/auth.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/config/auth.py]

Use an ACL-specific exact revision (`expected_access_revision`) for membership changes and the existing project content revision (`expected_revision`) for content mutations. Both satisfy the “exact expected revision” requirement without creating content snapshots for a role-only change. A single engineering lease still serializes all shared project mutations, including ACL changes. Role assignment changes increment `access_revision`, invalidate capability snapshots/cursors, publish a monotonic authority event, and immediately reauthorize active subscriptions. [ASSUMED]

Do not allow the last effective HA-admin-backed project Admin assignment to be removed or demoted. Do not let a caller modify their own assignment in the same request unless the resulting postcondition still leaves a different effective administrator; the safer Phase-2 UI/API rule is to reject self-grant and last-admin changes explicitly. [VERIFIED: Phase 2 UI-SPEC.md acceptance contract]

### Pattern 3: Non-Enumerating Collection, Item, Count, Cursor, and Subscription Semantics

Collection authorization differs from item authorization. `projects/list`, search, badges, audit pages, control counts, and remote-site counts must query only the caller's authorized project IDs before calculating rows or totals. Never fetch all, calculate a global count, then redact rows. Direct item access must collapse missing and unauthorized into one stable `project_unavailable` result without project name, other-user identity, hidden count, or different timing-dependent detail. [VERIFIED: locked context] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html]

Use opaque, random, server-state cursors. Bind cursor state to user ID, `id(connection)`, `refresh_token_id`, project, capability, filters, policy/access revision, and expiry. A cursor becomes invalid on restart, connection change, role/policy change, expiry, or project revocation; the client restarts the authorized query. [ASSUMED] The Evidence UI's page size is exactly 50. Cursor responses must not expose total counts unless a separately declared capability authorizes that aggregate. [VERIFIED: Phase 2 UI-SPEC.md]

`policy/subscribe` sends an initial capability snapshot and monotonic sequence. Place its unsubscribe callback in `connection.subscriptions[msg["id"]]`; HA calls all such callbacks on disconnect in both supported lanes. Before every subsequent event, recompute visibility and capabilities. On revocation, emit only a minimal `authority_changed`/`revoked` event for the current known route and stop sending protected details; remove cached rows from the browser. Sequence gaps, expiry, incompatible policy version, or subscription loss force immediate read-only until a full snapshot succeeds. HA's own entity subscription implementation rechecks user permissions per forwarded event, which is the correct model to follow. [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/connection.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]

### Pattern 4: Ephemeral Opaque Lease, Bound to Connection and Session

Replace the persisted legacy lock with an in-memory `LeaseManager`; restart invalidates all leases safely. Generate a high-entropy opaque token with `secrets.token_urlsafe(32)`, keep only its digest in server memory, and compare a submitted token digest with `hmac.compare_digest`. Bind the record to project ID, user ID, connection object identity, `refresh_token_id`, purpose `engineering`, access revision/policy version, and monotonic expiry. Python's `secrets` module is intended for cryptographically strong security tokens and recommends 32 random bytes as sufficient for its stated 2015-era threat model. [CITED: https://docs.python.org/3/library/secrets.html]

The token is a session capability, not a UI identifier. It stays in browser memory only and is excluded from DOM text/attributes, URLs, localStorage/IndexedDB, diagnostics, exceptions, logs, telemetry, audit, screenshots, exports, and fake-HA effect ledgers. OWASP likewise advises opaque high-entropy session identifiers and prohibits exposure in URLs/logs/client persistence. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html]

Acquisition, renewal, release, expiry, and mutation guard all run under the same project-scoped asyncio lock. Default TTL is 300 seconds and accepted config range is 60–900 seconds. Renewal rotates the token atomically and invalidates the old token immediately; it never merely extends a browser clock. Expiry uses `time.monotonic()` for enforcement and server UTC only for presentation. There is no grace period. “Held elsewhere” responses expose no owner name, connection ID, or activity. [VERIFIED: Phase 2 UI-SPEC.md]

On acquisition, install a connection cleanup callback so disconnect releases the lease and publishes a minimal state change. Also prune lazily on every lease/mutation request and run one tracked periodic expiry task so subscribed browsers receive deterministic expiry. Unload cancels the task, removes callbacks/subscriptions, clears cursors/previews/leases, and makes the integration runtime unavailable before objects are closed. [VERIFIED: HA lifecycle synthesis and Phase 2 UI-SPEC.md] [CITED: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/]

The browser follows the locked lease schedule: manual renewal is offered at 50% remaining; one dirty-visible-document renewal is sent at 40% remaining; clean idle leases do not auto-renew. Reconnect always discards the old in-memory token, reloads capability and head, reacquires, and compares. [VERIFIED: Phase 2 UI-SPEC.md]

### Pattern 5: One Atomic Mutation Guard Inside the Existing Transaction Lock

Do not authorize, validate a lease, and check the revision outside the Phase-1 transaction critical section; that leaves a time-of-check/time-of-use race. Refactor the existing `ProjectTransactionCoordinator` to accept a server-created mutation guard callback or a guarded transaction context. Inside its existing project lock, immediately before journal/head mutation, the guard must re-read and validate: actor active state; capability; project visibility; exact content or access revision; lease token/binding/expiry/purpose; policy/access revision; current head digest; preview/merge candidate digest; and operation-specific gate. Only then write journal/snapshot/head/audit. [VERIFIED: Phase 2 locked atomicity and existing transaction locking]

Every shared mutation uses this path: normal apply, rollback, import, merge apply, metadata, ACL update, delete, and any currently shared alarms/work orders/reports mutation that remains exposed. Preview/read operations may run concurrently but their opaque preview is invalidated by policy/head/access change. A denied/stale/unlocked/expired request must have zero project-store, audit, service, local-storage, and network side effects. [VERIFIED: Phase 2 CONTEXT.md and UI-SPEC.md]

### Pattern 6: Three-Way, Non-Destructive Conflict Recovery

Keep the unsaved candidate in browser session memory. On `revision_conflict`, return only authorized, bounded metadata: stable code, base/current/candidate revision and digest, semantic operation summary, and safe next actions. If access was revoked, return no current project content/diff; the browser may retain its local candidate but cannot request protected comparison. [VERIFIED: Phase 2 UI-SPEC.md]

Merge preview is three-way: base snapshot versus current head versus candidate. Reuse the Phase-1 stable-ID semantic diff vocabulary (add/remove/move/binding/config). Operations changed only by one side can be proposed; overlapping paths/stable objects become explicit choices; dependency-locked operations cannot be partially selected. Reconstruct a complete candidate, run the same bounded schema/migration/diff validators, then create a normal server preview. Merge apply is not a patch replay: it must reacquire/validate the lease and current revision and call the same guarded transaction path. A second concurrent change returns a second conflict and leaves the candidate intact. [VERIFIED: Phase 1 diff implementation and Phase 2 UI-SPEC.md]

### Pattern 7: Configured Control Resolution and Exact HA Service Normalization

Control configuration belongs to the verified current project head, not to the browser request or static equipment catalog defaults. Add a bounded server control schema with an opaque stable control ID, localized presentation key, exact `domain`/`service`, exactly one normalized target selector (`entity_id`, `device_id`, or `area_id`), immutable service data, declared user-input fields and constraints, simulation/maintenance gates, and optional readback rule/deadline. The schema must reject templates, nested service requests, ambiguous/multiple targets unless explicitly designed, unknown keys, and service pairs outside an exact allowlist. A domain-only allowlist such as current `SAFE_SERVICE_DOMAINS` is insufficient. [VERIFIED: repository inspection and locked context]

`controls/preview` accepts project route, control ID, expected project revision, and declared input only. It resolves the head, checks capability/gates and HA permissions, normalizes target/data, and returns an opaque short-lived preview with safe target summary and digest. `controls/execute` accepts that preview identity/control ID and declared input, then resolves and validates everything again; changed policy, access, revision, target digest, simulation/maintenance state, or input invalidates it. Operational control does not require the engineering lease because it does not mutate project content, but it does require a fresh expected project revision/digest and per-action authorization. [ASSUMED]

Keep HA `target` and `service_data` separate and ensure their key sets cannot override one another. Reject any client field named `entity_id`, `device_id`, `area_id`, `domain`, `service`, `target`, or template/nested call marker unless it is merely a declared scalar input with a different safe semantic name. For every resolved entity, call `connection.user.permissions.check_entity(entity_id, POLICY_CONTROL)`; apply equivalent safe checks for device/area targets by resolving their entities or prohibit those target kinds until the authorization proof is complete. Dispatch with `await hass.services.async_call(domain, service, service_data=normalized_data, target=normalized_target, blocking=True, context=connection.context(msg))`. HA core uses separate target/data and connection context in both exact lanes. [CITED: https://developers.home-assistant.io/docs/auth_permissions/] [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/commands.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]

`blocking=True` proves that the HA service handler completed, not that field equipment reached the requested state. Record accepted after policy/validation, dispatched immediately before/at the service attempt, and readback-confirmed only when the declared authoritative state/attribute predicate is observed by the deadline. A timeout or post-dispatch exception is result-unknown and must never auto-repeat. No live plant call is needed for tests: register a controlled fake HA service, capture exact `ServiceCall.data`, target/context, and drive a fake state readback. [VERIFIED: Phase 2 UI-SPEC.md and HA service semantics]

### Pattern 8: Trusted Server Evidence and Separate Untrusted Telemetry

Create trusted events only inside server workflows through one event factory. Required bounded fields are server event ID, server UTC timestamp, authenticated actor ID/display label, project/control/operation code, normalized target summary, lifecycle result, correlation ID, policy/content/access revision, and sanitized bounded detail. Never accept actor, authoritative timestamp, result, target, or trusted event type from the browser. Never record raw lease tokens, service bodies, candidates, secrets, or full exception strings. OWASP recommends consistent when/where/who/what fields, interaction identifiers, input sanitization, and exclusion of session identifiers/tokens. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html]

Preserve Phase-1 transaction audit as server-authored project evidence, but unify it through the new trusted event projection or a compatible reader. Do not claim tamper-evident, compliance-grade, or immutable audit: the repository has bounded mutable HA stores and the project scope explicitly excludes audit-grade non-repudiation. Call it “trusted server-authored operational evidence.” [VERIFIED: repository inspection and PROJECT.md out-of-scope]

Replace `audit/add` with `telemetry/append`. Telemetry has a distinct schema/store/retention/rate limiter and permanent `untrusted` provenance. Server receipt time is authoritative; any client occurrence time, actor, category, or outcome remains a claimed field and can never appear in trusted filters/rows/counts/exports. A telemetry rejection cannot write trusted evidence. [VERIFIED: locked context and UI-SPEC.md]

Trusted control dispatch has a critical failure rule: if the required accepted event cannot be durably recorded before dispatch, fail closed and do not call the service. If dispatch occurred but a later evidence write fails, never retry the plant action; return `dispatch_result_unknown` with the correlation ID, retain a recovery journal/pending projection, and repair evidence later. This mirrors Phase-1 forward-only recovery rather than rolling back an external side effect. [VERIFIED: architecture synthesis from Phase-1 transaction recovery]

### Pattern 9: Browser Authority Reducer and No-Companion Fail-Closed State

Add a pure browser state reducer for capability freshness, policy version, role, lease, content/access revision, sequence, candidate, and current operation. Open shared projects read-only, refresh snapshots at 50% lifetime/visibility/reconnect/role event/gap/before mutation confirmation, and disable all shared effects in the same render cycle on stale/rejected/incompatible authority. `AuthorityStateBar` is always visible across the five existing tabs. [VERIFIED: Phase 2 UI-SPEC.md]

Centralize shared effects behind one `SharedProjectAuthority` adapter. It is the only path allowed to call `glt_flow_card/*` shared commands. On missing Companion, it returns a typed read-only result; it must not call `hass.callService`, mutate Lovelace configuration, select caller-authored WS targets, or invoke old local `ProjectStore`/localStorage fallback. Standalone local mode uses a separate adapter and visibly distinct state; it never receives the shared candidate automatically. [VERIFIED: locked context and current browser integration inspection]

Candidate and lease token are memory-only. Candidate clearing occurs only after an authoritative saved receipt or explicit destructive discard; token clearing occurs on release/expiry/revocation/disconnect/reconnect. Tests must scan DOM/attributes, URL, browser storage, console, diagnostics, telemetry, screenshot text, and effect logs for both token and protected current content after revocation. [VERIFIED: Phase 2 UI-SPEC.md]

### Anti-Patterns to Avoid

- **Authorize only mutations:** reads, list/counts, subscriptions, audit, remote, member eligibility, previews, and export leak security-relevant data too. Declare them all. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html]
- **Trust role/capabilities from project JSON:** imported content can self-grant. Migrate to separate ACL storage and ignore content ACL for live decisions. [VERIFIED: repository inspection]
- **Check policy before acquiring the transaction lock:** a role/lease/revision can change between check and commit. Recheck inside one critical section. [VERIFIED: locked context]
- **Persist or resurrect leases:** a stored lock cannot prove a current browser connection/session. Leases are ephemeral and reacquired after restart/reconnect. [VERIFIED: locked context]
- **Reveal lock owner or unauthorized counts:** “held elsewhere” and non-enumerating results stay anonymous/minimal. [VERIFIED: UI-SPEC.md]
- **Use a domain-only control allowlist:** exact domain+service+target+immutable data are required; caller `service_data.entity_id` must never diverge from audited target. [VERIFIED: current code inspection]
- **Treat service-handler completion as plant confirmation:** only configured readback evidence supports “confirmed.” [VERIFIED: Phase 2 control state contract]
- **Let browser telemetry share an audit event factory/table:** it lets claimed actor/time/outcome acquire false trust. [VERIFIED: locked context]
- **Cache authorization in a subscription callback:** reauthorize on every event and stop/remove data on revocation. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]
- **Retry after unknown dispatch:** it can duplicate a physical action. Require current-state/audit inspection and a new user-authorized request. [VERIFIED: UI-SPEC.md]
- **Patch generated bundles only:** authored sources, build manifests, exact copies, HACS stage, and release artifacts must all be regenerated and compared. [VERIFIED: AGENTS.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User/session identity | Client user IDs, cookies, or browser roles | `connection.user`, `refresh_token_id`, `connection.context(msg)` | HA already authenticates the WebSocket connection and associates service context. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/connection.py] |
| Entity authorization | Project-only entity allowlist | HA permission `check_entity(..., POLICY_READ/POLICY_CONTROL)` plus project capability | Prevents the integration becoming a confused deputy beyond the user's HA authority. [CITED: https://developers.home-assistant.io/docs/auth_permissions/] |
| Capability flexibility | Per-project arbitrary capability checkboxes | Fixed code-owned role matrix plus HA ceiling | Prevents unreviewed/self-granted privilege combinations. [VERIFIED: locked context/UI-SPEC.md] |
| Service execution transport | Browser `hass.callService` fallback or raw target WS | `hass.services.async_call` with normalized data/target and connection context | Keeps authoritative target/policy/evidence server-side. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py] |
| Project consistency | Direct store writes or JSON patch replay | Existing Phase-1 transaction coordinator/journal/snapshot/recovery | Existing crash recovery and exact revision guarantees already solve persistence. [VERIFIED: repository inspection] |
| Semantic merge | Generic deep merge/LWW | Existing semantic diff vocabulary plus explicit three-way choices and full validation | Protects stable IDs/dependencies and preserves both writers. [VERIFIED: Phase-1/Phase-2 contracts] |
| Subscription lifecycle | Free-floating tasks/listeners | `connection.subscriptions` + manager-scoped tracked cleanup + config-entry unload | HA already invokes disconnect unsubscribers; integration unload must release all resources. [CITED: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/] |
| Opaque security token generation | Timestamps, UUID-like counters, reversible IDs | Python `secrets` and server-side token state | Security tokens require CSPRNG entropy and no embedded meaning. [CITED: https://docs.python.org/3/library/secrets.html] |
| Audit log sanitization | Raw exception/payload dumps | Fixed event schema, stable codes, bounded sanitized fields | Reduces injection, token/data exposure, and false evidence. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html] |
| Cursor integrity | Caller offset/total or custom cryptographic envelope | Opaque random server cursor bound to actor/scope/revision/expiry | Avoids enumeration/tampering and custom key lifecycle. [VERIFIED: design within locked cursor discretion] |

**Key insight:** the hard part is not producing more endpoints; it is guaranteeing that identity, object scope, policy, revision, lease, configured target, side-effect evidence, and lifecycle cleanup are evaluated together at the authoritative boundary. Existing HA and Phase-1 primitives should be composed, not replaced. [VERIFIED: research synthesis]

## Resource and Input Budgets

The existing full-project contract already enforces 5 MiB JSON, depth 64, 100,000 nodes, 256 KiB maximum string, 128-character IDs, 512-character paths, and at most 100 returned validation errors. The existing Phase-1 preview cache is capped at 32 entries and 20 MiB. Keep those canonical limits for complete project/candidate validation rather than adding a second set. [VERIFIED: schemas/limits.json and project_transactions.py]

Narrow operational messages need much smaller budgets so a permitted user cannot consume project-scale resources for a control, telemetry row, or cursor. The following are implementation defaults recommended under the agent's discretion; they are intentionally tagged as assumptions because the exact numbers are not supplied by an external authoritative standard:

| Resource | Recommended hard bound | Enforcement point |
|----------|------------------------|-------------------|
| IDs (`project_id`, `control_id`, correlation/event IDs) | Existing 128 Unicode-code-point ID contract; validate canonical form before lookup. [VERIFIED: schemas/limits.json] | Voluptuous schema and canonical parser |
| One configured-control input | 4 KiB canonical JSON, depth 4, 64 nodes, 16 keys, 512 UTF-8 bytes/string, arrays max 32. [ASSUMED] | Pre-dispatch bounded parser plus per-field control schema |
| One trusted event | 8 KiB canonical JSON, detail depth 4, 64 nodes, strings 1 KiB; stable code/error fields only. [ASSUMED] | Trusted event factory before durable append |
| One telemetry submission | 4 KiB canonical JSON, depth 4, 64 nodes, strings 512 bytes; category allowlist. [ASSUMED] | `telemetry/append` before storage/rate debit result |
| Telemetry rate | 30 accepted events/user/minute, burst 10; stable `rate_limited` response. [ASSUMED] | Monotonic token bucket keyed by user + connection |
| Control rate | Preview 30/user/project/minute; execute 10/user/project/minute, burst 3; never queue/replay a rejected command. [ASSUMED] | Policy coordinator before preview/dispatch |
| Lease endpoints | 30 requests/user/project/minute; acquisition remains one active lease/project. [ASSUMED] | Lease manager under project lock |
| Capability subscriptions | At most 8 integration subscriptions/connection; one per open project/purpose. [ASSUMED] | Registration manifest and connection state |
| Opaque cursors | 32/connection, 256/integration, five-minute idle TTL, page exactly 50. Page size is locked; cache limits/TTL are assumed. [VERIFIED: Phase 2 UI-SPEC.md] [ASSUMED] | Cursor registry and periodic/lazy prune |
| Trusted evidence retention | Existing `max_audit` entry policy plus 32 MiB byte ceiling; oldest complete events evicted, never partial rows. [ASSUMED] | Evidence repository append |
| Telemetry retention | 1,000 rows and 4 MiB, whichever comes first. [ASSUMED] | Separate telemetry repository append |
| Membership | At most 512 assignments/project and only current HA users; no arbitrary capability vectors. [ASSUMED] | Access repository update |
| Conflict/merge response | At most 100 semantic operations and 256 KiB canonical evidence; return truncation metadata, never partial apply selection. [ASSUMED] | Merge preview serializer |

OWASP's WebSocket and input-validation guidance supports explicit message-size, structure, rate, and resource limits, but it does not define project-specific numeric values; the values above must be locked as policy constants and tested at below/equal/above boundaries. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html]

## Runtime State Inventory

This is a migration/refactor phase, so file grep is not enough. The inventory answers what remains after source files are changed.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Active project heads/snapshots and the legacy backup may contain `config.permissions.designers/operators`; the monolithic HA Store contains `locks` and client-authored `audit`; the split project audit contains Phase-1 server transaction events; browsers may hold standalone/local project libraries in localStorage. [VERIFIED: repository inspection] | Create a versioned ACL store and one-time idempotent bootstrap from active-head legacy permissions only (`designers → Engineer`, `operators → Operator`), never from imported candidates. Ignore ACL fields in project content after bootstrap and preserve historical snapshots/legacy backup unchanged. Invalidate/clear legacy locks with a server migration event; never issue a lease from them. Move/mark legacy monolithic audit as `legacy_untrusted` telemetry/quarantine; retain known Phase-1 transaction events as server-authored trusted evidence. Shared browser mode must not import/use localStorage projects silently. |
| Live service config | Config-entry option `default_lock_ttl` currently allows 30–3600; Phase-2 UI contract allows 60–900 and default 300. YAML remote-site definitions/tokens may exist outside git. [VERIFIED: const.py, config_flow.py, UI-SPEC.md] | Normalize/migrate options to 60–900 without mutating the config entry directly; keep the existing compatibility-safe update listener/reload lifecycle. Do not read/display/migrate remote credentials; gate legacy remote commands and leave transport migration to Phase 9. |
| OS-registered state | No Task Scheduler, systemd, service registry, browser extension, or other OS registration is part of this repository/runtime. [VERIFIED: repository structure and AGENTS.md] | None. Verify install/unload through HA/HACS rather than an OS service migration. |
| Secrets/env vars | No application `.env` contract exists. Remote-site bearer tokens may live in HA secrets/YAML and must never enter policy/audit/diagnostics. Lease tokens do not yet exist. [VERIFIED: AGENTS.md and repository maps] | Leave existing secret keys untouched. New lease/cursor/preview tokens are ephemeral memory-only and excluded from diagnostics/logging/export. Do not persist a token-hash mapping across restart. |
| Build artifacts / installed packages | `dist/glt-flow-card.js`, Companion `www/glt-flow-card.js`, `docs/editor/app.js`, `build-manifest.json`, HACS plugin/integration stages, Companion ZIP, and already-served browser caches may contain legacy roles/locks/control/audit/fallback behavior. [VERIFIED: repository build/release inspection] | Edit authored JS/Python and generators, rebuild all generated copies, update manifest hashes, verify byte equality/staging/ZIP, bump compatible version/cache identity, and test clean install plus upgrade from the Phase-1 artifact. An old browser bundle paired with the new Companion must negotiate policy-version incompatibility and remain read-only. |

The canonical post-migration invariant is: no persisted legacy permission, lock, audit row, browser cache, or generated artifact can authorize a shared operation. [VERIFIED: migration design from locked authority rule]

## Common Pitfalls

### Pitfall 1: A Complete Role Matrix With Incomplete Route Coverage
**What goes wrong:** mutations are protected but a list, audit page, search count, subscription, member picker, remote endpoint, preview, or old compatibility handler bypasses policy.  
**Why it happens:** authorization is embedded in individual handlers and tests cover only happy-path UI actions.  
**How to avoid:** registration manifest equality, default-deny wrapper, per-command required-capability table, and deny tests for all principals on every registered command.  
**Warning signs:** any handler calls repository/manager directly before a `PolicyDecision`; command count differs from manifest; raw list length is calculated before filtering. [VERIFIED: current route audit] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html]

### Pitfall 2: HA Admin Becomes Implicit Project Superuser
**What goes wrong:** HA administration authority silently grants plant/project content or controls.  
**Why it happens:** current `_project_role` maps every HA admin to `designer`.  
**How to avoid:** HA admin is a ceiling/eligibility condition, not automatic content membership; permit minimal membership administration separately and require assigned project role for content/control.  
**Warning signs:** `if user.is_admin: return Admin` in content authorization; admin list response includes project bodies. [VERIFIED: current `_project_role` inspection and locked privilege-cap rule]

### Pitfall 3: ACL Revision and Content Revision Are Conflated
**What goes wrong:** role changes either do not invalidate snapshots or produce meaningless content snapshots/revisions.  
**Why it happens:** ACL is embedded in project JSON today.  
**How to avoid:** separate `access_revision` and `content_revision`; bind snapshots/cursors/previews to both; use the exact relevant revision on each mutation.  
**Warning signs:** a membership change can reuse an old capability snapshot; imported content changes roles. [VERIFIED: architecture synthesis]

### Pitfall 4: Lease Check Races With Commit
**What goes wrong:** a token expires/revokes or another revision commits after the check but before the write.  
**Why it happens:** policy/lease wrappers run outside `ProjectTransactionCoordinator`'s lock.  
**How to avoid:** perform the final complete guard inside the same project critical section as journal/head commit.  
**Warning signs:** an `await` occurs between final guard and journal prepare without holding the project lock; two lock managers use inconsistent order. [VERIFIED: locked atomicity]

### Pitfall 5: Reconnect Reuses a Plausible Token
**What goes wrong:** a new WebSocket connection replays an old unexpired lease.  
**Why it happens:** token binding uses only user/project/expiry.  
**How to avoid:** bind connection object identity and HA `refresh_token_id`; clear token on disconnect/reconnect; rotate on renew; never persist.  
**Warning signs:** a token works from a second `hass_ws_client` using the same user access token. [VERIFIED: HA ActiveConnection API and UI contract]

### Pitfall 6: Subscription Revocation Leaks Subsequent Events
**What goes wrong:** a removed user continues to receive project/audit/control updates.  
**Why it happens:** authorization is checked only at subscribe time.  
**How to avoid:** reauthorize each emission, bind sequence/cursor to access revision, remove protected DOM rows on revocation, and unsubscribe on disconnect/unload.  
**Warning signs:** callback closes over a previously computed `allowed=True`; role-change tests still receive a detailed event. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]

### Pitfall 7: Exact Target Is Audited but a Different Target Is Called
**What goes wrong:** top-level `entity_id` is audited while caller `service_data.entity_id` controls another entity.  
**Why it happens:** current handler uses `setdefault`, and target/data are not separated.  
**How to avoid:** accept only control ID + declared scalar inputs, server-resolve target, use disjoint immutable/user key sets, pass HA `target` separately, inspect exact fake service call.  
**Warning signs:** request schema contains domain/service/entity/service_data; audit target is built before final normalization. [VERIFIED: current `ws_control_execute` inspection]

### Pitfall 8: “Dispatched” or `async_call` Completion Is Labeled “Confirmed”
**What goes wrong:** UI/audit claims equipment success without readback.  
**Why it happens:** service completion is mistaken for state confirmation.  
**How to avoid:** separate lifecycle events and require a configured readback predicate/deadline for confirmation; otherwise stop at dispatched/result unknown.  
**Warning signs:** after-state is read immediately once and treated as confirmation; timeout auto-retries. [VERIFIED: locked control state contract]

### Pitfall 9: Audit Failure Repeats a Physical Effect
**What goes wrong:** a post-dispatch persistence retry executes the service again.  
**Why it happens:** action and evidence are treated like a rollbackable database transaction.  
**How to avoid:** durable accepted event before dispatch; after dispatch, forward-only evidence repair keyed by correlation ID and no automatic service retry.  
**Warning signs:** retry method wraps both service call and audit append; correlation IDs change across repair. [VERIFIED: Phase-1 recovery pattern and control safety synthesis]

### Pitfall 10: Browser Fail-Closed Is Only a Disabled Button
**What goes wrong:** hidden legacy calls, keyboard paths, old project store, or direct `hass.callService` still mutate.  
**Why it happens:** visual affordance state is not coupled to the single effect adapter.  
**How to avoid:** one shared authority adapter; effect-ledger assertions across DOM, keyboard, reconnect, stale snapshot, and old bundle/new Companion negotiation.  
**Warning signs:** project-safety components call `hass.callWS` independently; shared candidate appears in localStorage. [VERIFIED: current browser architecture and UI acceptance contract]

### Pitfall 11: Unbounded “Small” Metadata Accumulates
**What goes wrong:** cursors, subscriptions, telemetry, rate buckets, audit details, and expired leases consume memory even though projects are bounded.  
**Why it happens:** only project body limits are tested.  
**How to avoid:** explicit entry+byte+TTL bounds, below/equal/above tests, lazy and scheduled prune, unload zero-resource ledger.  
**Warning signs:** dictionaries keyed by random IDs have no eviction; option `max_audit` caps count but not bytes. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html]

### Pitfall 12: Updating Config-Entry Reload Mechanics Breaks the Minimum Lane
**What goes wrong:** adopting a 2026-only options reload helper breaks HA 2024.8.0, or mixing old listener and new reload APIs causes duplicate reloads.  
**Why it happens:** HA introduced deprecation behavior in 2026.6 and plans an error in 2026.12.  
**How to avoid:** preserve the currently tested explicit update-listener/unload path across both exact lanes for this phase; do not mix mechanisms. Revisit only when the minimum HA version moves.  
**Warning signs:** Phase-2 code subclasses a new-only reload base or registers two option reload triggers. [CITED: https://developers.home-assistant.io/blog/2026/05/07/config-entry-listener-together-with-reloading-methods/]

## Code Examples

These are implementation patterns synthesized for this repository; they are not verbatim copies of external source.

### Thin WebSocket Handler With Central Policy

```python
@websocket_api.websocket_command(
    {
        vol.Required("type"): "glt_flow_card/projects/get",
        vol.Required("project_id"): bounded_id,
    }
)
@websocket_api.async_response
async def ws_projects_get(hass, connection, msg):
    runtime = _runtime(hass)
    decision = await runtime.policy.authorize_command(connection, msg)
    if not decision.allowed:
        connection.send_error(msg["id"], decision.public_code, decision.public_message)
        return
    result = await runtime.repository.get_project(decision.project_id)
    connection.send_result(msg["id"], decision.filter_project(result))
```

The schema, async response decorator, connection result/error channel, and server connection actor match official HA WebSocket extension patterns. [CITED: https://developers.home-assistant.io/docs/frontend/extending/websocket-api/]

### Guard Executed Inside the Existing Transaction Critical Section

```python
async with self._project_lock(project_id):
    head = await self.repository.get_head(project_id)
    await mutation_guard.assert_current(
        head=head,
        expected_revision=expected_revision,
        expected_digest=expected_digest,
        lease_token=lease_token,
    )
    journal = await self._prepare_journal(head, candidate, actor)
    await self._commit_snapshot_and_head(journal)
```

The important property is adjacency: no unguarded await or separate policy lock exists between the final recheck and the journaled write. [VERIFIED: synthesis from existing transaction coordinator and locked atomicity]

### Exact Service Data and Target Separation

```python
context = connection.context(msg)
await hass.services.async_call(
    control.domain,
    control.service,
    service_data=normalized_data,
    target=normalized_target,
    blocking=True,
    context=context,
)
```

HA core uses `connection.context(msg)` and separate `service_data`/`target` arguments for authenticated WebSocket service calls in both supported lanes. [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/commands.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]

### Per-Event Reauthorization and Disconnect Cleanup

```python
@callback
def forward_authority_event(event):
    decision = runtime.policy.authorize_subscription_now(connection, scope)
    if not decision.allowed:
        connection.send_event(msg["id"], decision.revocation_event())
        unsubscribe()
        connection.subscriptions.pop(msg["id"], None)
        return
    connection.send_event(msg["id"], decision.filter_event(event))

unsubscribe = runtime.authority_bus.subscribe(scope, forward_authority_event)
connection.subscriptions[msg["id"]] = unsubscribe
```

HA's `ActiveConnection` calls registered subscription cleanup during disconnect, and HA's own state subscriptions recheck current permissions before forwarding. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/connection.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]

### Multi-User HA Test Shape

```python
viewer = await make_project_user("viewer")
operator = await make_project_user("operator")
engineer = await make_project_user("engineer")
admin = await make_project_user("admin", ha_admin=True)
unassigned = await make_project_user("unassigned")

viewer_ws = await hass_ws_client(hass, viewer.access_token)
engineer_a = await hass_ws_client(hass, engineer.access_token)
engineer_b = await hass_ws_client(hass, engineer.access_token)
```

The repository harness already uses `hass_ws_client(hass, access_token)`; exact HA core fixtures in 2024.8.0 and 2026.8.3 provide MockUser/access-token patterns, so Phase 2 should add a local factory for five users and multiple connections per user. [VERIFIED: tests/components/glt_flow_card/test_websocket.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/tests/conftest.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/tests/conftest.py]

## State of the Art

| Old / current repository approach | Required Phase-2 approach | When / evidence | Impact |
|-----------------------------------|---------------------------|-----------------|--------|
| Role derived from `config.permissions`; HA admin becomes designer | Separate versioned ACL store, fixed four-role matrix, effective caps intersected with HA authority | Phase-2 locked decision; current code audit 2026-09-01. [VERIFIED: repository inspection and CONTEXT.md] | Import/project editing cannot self-grant; admin authority is explicit and testable. |
| Some mutations call `_require_project_role`; reads/lists/audit/remote are uneven | One registration-time command-policy manifest and deny-default coordinator | OWASP per-request authorization guidance and SEC-01. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html] | A missing policy declaration becomes a build/test failure. |
| Persisted user-only locks, not enforced by writes | Opaque, connection/session-bound, rotating, ephemeral engineering leases; atomic in-lock guard | COLLAB-01 and UI contract. [VERIFIED: Phase 2 CONTEXT.md/UI-SPEC.md] | Restart/reconnect cannot resurrect write authority; one editor/no lost update. |
| Optional expected revision on legacy save | Exact content/access revision plus lease on every shared project/ACL mutation | Phase-2 locked decision. [VERIFIED: CONTEXT.md] | No unlocked or last-writer-wins compatibility escape. |
| Caller supplies domain/service/entity/service data | Control ID + bounded declared input; server resolves current-head definition and exact HA target/data | SEC-01 control contract. [VERIFIED: CONTEXT.md] | Removes caller-selected confused-deputy target and aligns audit with effect. |
| Browser-authored `audit/add` shares trusted-looking storage | Server-only trusted evidence and separate bounded untrusted telemetry | Phase-2 locked decision; OWASP logging guidance. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html] | Client actor/time/outcome can no longer impersonate operational evidence. |
| Limit/offset-style broad audit list, no subscription policy | Project-filtered page-50 opaque cursors and per-event reauthorization | UI contract and HA core subscription pattern. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py] | Revocation stops future leakage; counts/cursors do not enumerate hidden projects. |
| Browser local/direct fallbacks remain broadly available | Shared/local authority adapters are disjoint; stale Companion means immediate shared read-only | Phase-2 locked decision. [VERIFIED: CONTEXT.md/UI-SPEC.md] | Availability loss cannot downgrade security. |
| HA config-entry explicit update listener | Keep current compatibility path while minimum remains 2024.8.0; do not mix with new reload helpers | HA 2026.6 introduced deprecation and 2026.12 error for mixed patterns. [CITED: https://developers.home-assistant.io/blog/2026/05/07/config-entry-listener-together-with-reloading-methods/] | Prevents duplicate reload/current-lane warnings without breaking minimum lane. |

**Deprecated/outdated for this phase:**

- `config.permissions` as live authority, `_project_role`, user-only persisted `locks`, optional-revision `projects/save`, caller-authored `control/execute`, trusted-looking `audit/add`, broad `audit/list`, and any shared local/direct-service fallback must not remain callable as compatibility back doors. [VERIFIED: repository inspection and locked decisions]
- A domain-only `SAFE_SERVICE_DOMAINS` check is insufficient; retain it only as an outer deny list while exact service-pair/control schema policy becomes authoritative. [VERIFIED: current implementation and locked control contract]
- `accepted`, `dispatched`, `readback-confirmed`, `timed-out`, `denied`, and `failed` are distinct states; generic success/exception handling is obsolete for configured controls. [VERIFIED: UI-SPEC.md]

## Assumptions Log

| # | Claim / proposed decision | Section | Risk if Wrong |
|---|---------------------------|---------|---------------|
| A1 | The exact operational input, rate, cursor, memory, and byte defaults in Resource and Input Budgets are the recommended safe starting values. | Resource and Input Budgets | Too low impairs legitimate use; too high permits resource exhaustion. Lock constants before implementation and test equal/above boundaries. |
| A2 | HA admin status permits minimal membership administration but does not automatically grant project content/control/audit access without a project role assignment. | ACL pattern / role matrix | A product expectation of automatic HA-admin content access would change list/non-enumeration behavior and tests; least privilege favors the recommendation. |
| A3 | ACL changes use a separate exact `access_revision`, while project content uses the existing exact `revision`; both share one engineering lease. | ACL and atomic mutation patterns | A single combined revision would require journaling role-only content revisions and alter conflict/UI contracts. |
| A4 | Operational controls require fresh capability, project revision/digest, configured-control preview, and HA target permission, but not an engineering lease; the lease is for shared engineering/project mutations. | Configured controls | Requiring a lease would prevent the Operator role from using controls or would conflate operational and engineering exclusivity. |
| A5 | Opaque pagination cursors are short-lived server-state tokens rather than signed self-contained payloads. | Non-enumeration/cursor pattern | Server restart invalidates pagination and requires reload, which is safe but less convenient. |
| A6 | Full remote paths remain policy-declared but return fail-closed unavailable until Phase 9, rather than preserving the legacy remote calls. | Command coverage | Any promised Phase-2 remote behavior would need a separately scoped secure transport design, currently deferred. |

The locked context gives the agent discretion over identifiers, lease duration within bounds, cursor encoding, and module shape. A1–A6 are implementation recommendations that the planner should make explicit in PLAN.md acceptance criteria rather than leaving implicit. [VERIFIED: CONTEXT.md discretion]

## Open Questions

1. **Should HA administrators automatically read project content?**
   - What we know: HA admins may administer membership, but grants are capped and project data cannot self-grant. [VERIFIED: CONTEXT.md]
   - What's unclear: the locked context does not explicitly say that HA admin implies content membership.
   - Recommendation: no implicit content/control access; expose only minimal membership administration until the admin assigns a fixed project role. This is A2 and is the least-privilege/non-enumerating interpretation.

2. **Does “shared mutation” include plant controls?**
   - What we know: rollback/import/ACL/metadata explicitly require leases; Operator must be able to use configured controls, while engineering lease acquisition is exposed to Engineer/Admin in the UI. [VERIFIED: CONTEXT.md/UI-SPEC.md]
   - What's unclear: the phrase could be read broadly.
   - Recommendation: define it as shared project/authority mutation, not plant operation. Controls use separate capability, fresh revision/digest/preview, HA entity permission, safety gates, and evidence. This is A4.

3. **What exact resource budgets are operationally appropriate?**
   - What we know: OWASP requires explicit bounds; complete project limits already exist; page size and lease TTL are locked. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html]
   - What's unclear: no measured telemetry/control traffic baseline exists.
   - Recommendation: lock A1 defaults, test at boundaries and at 100/500/2,000 objects, then adjust only from recorded measurements without relaxing structural limits.

None of these blocks planning; each has a prescriptive default and a testable acceptance rule. [VERIFIED: research assessment]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build, unit, exact-dist E2E, release | ✓, local version differs from CI | 25.9.0 local; CI contract Node 22 | Run Node 22 in CI/container for release evidence; local Node 25 is only a developer precheck. [VERIFIED: local probe and workflows] |
| npm | Locked install and scripts | ✓ | 11.12.1 | CI's Node 22 npm environment with `npm ci --ignore-scripts`. [VERIFIED: local probe] |
| Python | Companion HA tests | ✓ | 3.13.13 | Exact HA Docker harness. [VERIFIED: local probe] |
| Docker Linux engine | Exact HA 2024.8.0/current artifact lanes | ✓ | 29.6.2 | GitHub Actions runner if local Docker is unavailable. [VERIFIED: local probe and test-ha-artifacts tool] |
| pytest HA harness | Multi-user WebSocket, stores, lifecycle, controlled services | ✓ | 0.13.316 repository lock | Digest-pinned lane-specific container harness. [VERIFIED: repository tooling] |
| Playwright Chromium | Two-browser exact artifact | ✓ | @playwright/test 1.62.1 | Existing CI Playwright install/workflow. [VERIFIED: package/node_modules inspection] |
| Live Home Assistant / plant / remote site | Not required for Phase-2 verification | intentionally not used | — | Controlled pytest HA instance and fake services/states; zero live bus writes. [VERIFIED: locked context and AGENTS.md] |

**Missing dependencies with no fallback:** none. [VERIFIED: environment audit]

**Missing dependencies with fallback:** exact local Node 22 is not active; CI/container supplies parity. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Python integration framework | `pytest` + `pytest-homeassistant-custom-component` 0.13.316, Python 3.13 [VERIFIED: repository tooling] |
| Browser/unit framework | Node 22 built-in test runner; @playwright/test 1.62.1 exact-dist runner [VERIFIED: package.json] |
| Config files | `pytest.ini`, `tests/components/glt_flow_card/conftest.py`, `playwright.config.mjs`, `tools/run-exact-dist-playwright.mjs` [VERIFIED: repository inspection] |
| Python quick command | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy.py tests/components/glt_flow_card/test_project_leases.py -q -x` |
| Browser quick command | `node --test test/phase2-authority.test.mjs` |
| E2E focused command | `node tools/run-exact-dist-playwright.mjs --grep=authority` |
| Full local suite | `npm run build && npm test && npm run test:python && npm run test:e2e` |
| Release/HA suite | `npm run validate:hacs-staging && npm run test:ha-artifacts && npm run verify:release && npm run test:release-acceptance` |

New `test:phase2` should orchestrate the fast Node/Python/E2E contract in one command, parallel to `test:phase1`; the release gate should call both rather than replacing Phase-1 coverage. [VERIFIED: existing package script pattern]

### Required Test Harness Extensions

1. **Five-principal HA fixture:** create Viewer, Operator, Engineer, Admin, and unassigned HA users with real access tokens. Include a non-HA-admin project Admin and an HA-admin user to prove the effective ceiling. Create two simultaneous WebSocket connections for the same Engineer and one for a second Engineer. The official HA fixtures support token-specific `hass_ws_client` in both exact lanes. [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/tests/conftest.py] [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/tests/conftest.py]
2. **Command-policy inventory oracle:** capture the exact registered command names (the existing lifecycle fixture already does this) and assert equality with `COMMAND_POLICIES`; for each command generate allowed/denied/missing-object cases. No source-token match is sufficient. [VERIFIED: tests/components/glt_flow_card/conftest.py]
3. **Controlled HA service fixture:** register a fake allowed service, record `ServiceCall` domain/service/data/target/context, optionally mutate a fake state after a controllable delay, and expose pre-dispatch failure/post-dispatch failure/readback timeout. The global “reject live service” fixture remains the default and only the named test service is allowed. [VERIFIED: existing lifecycle effect ledger and locked no-live-write constraint]
4. **Clock and randomness seams:** inject monotonic/UTC clock and token factory into lease/cursor/control preview managers. Tests advance time deterministically, assert rotation/replay rejection, and use known redaction sentinels without weakening production CSPRNG. [VERIFIED: testability design]
5. **Persistence fault injector:** reuse Phase-1 store failure injection and add ACL/evidence/telemetry store failures before/after each durable boundary. Capture store/audit/service/listener/task/session effects. [VERIFIED: Phase-1 testing pattern]
6. **Shared two-browser fake coordinator:** replace per-page independent `wsResults` for Phase-2 scenarios with one Node-side authoritative model shared by two isolated Playwright browser contexts. It owns users, roles, revisions, lease/token bindings, event sequences, audit pages, controlled service results, and injected disconnects. Pages receive different HA identities while loading the same exact `dist/glt-flow-card.js`. [VERIFIED: existing exact-dist harness seam and UI requirement]
7. **Leak/effect detector:** retain network/service/localStorage ledgers and add IndexedDB, sessionStorage, URL/history, DOM/attribute/text, console, clipboard, diagnostics/export, and WS request-body checks. Seed distinctive token/current-project/other-user values and assert their absence after every denial/revocation/close. [VERIFIED: UI-SPEC.md acceptance contract]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Registered WebSocket set exactly equals policy-manifest set; no handler has implicit allow | Python integration/contract | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy.py -q -x` | ❌ Wave 0 |
| SEC-01 | Viewer/Operator/Engineer/Admin/unassigned allow+deny matrix over every command, list, count, preview, remote, audit and subscription | Parameterized multi-user HA integration | same | ❌ Wave 0 |
| SEC-01 | Missing and unauthorized project responses are indistinguishable; lists/search/counts/audit/control/remote omit hidden projects | Multi-user integration + E2E | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy_enumeration.py -q -x` | ❌ Wave 0 |
| SEC-01 | Project/import ACL fields cannot self-grant; role choices fixed; HA ceiling, eligible-user set, self-grant/last-admin/above-ceiling rejected | Store/WS integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_access.py -q -x` | ❌ Wave 0 |
| SEC-01 | Subscription initially authorizes, reauthorizes every event, sequences changes, stops/removes detail on revocation/disconnect | Async HA integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy_subscriptions.py -q -x` | ❌ Wave 0 |
| SEC-01 | Cursor bound to user/connection/project/filter/policy; page=50; expiry/replay/cross-user/tamper/role-change rejected without totals | Integration/boundary | `py -3.13 -m pytest tests/components/glt_flow_card/test_evidence_pagination.py -q -x` | ❌ Wave 0 |
| SEC-01 | Control request accepts only control ID + declared input; exact head resolves exact domain/service/target/data/context; HA entity permission enforced | Controlled-service integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_configured_controls.py -q -x` | ❌ Wave 0 |
| SEC-01 | Unknown/override/template/nested/unsafe/below/equal/above bounds and rate reject before zero service calls | Property/boundary + integration | same | ❌ Wave 0 |
| SEC-01 | Accepted/dispatched/confirmed/timeout/denied/failure-before/failure-after evidence is correct; no automatic retry | Failure-injection integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_control_evidence.py -q -x` | ❌ Wave 0 |
| SEC-01 | Client telemetry cannot create trusted actor/time/result; separate store/cursor/export/labels; byte/rate/retention bounds | Integration + browser | `py -3.13 -m pytest tests/components/glt_flow_card/test_trusted_evidence.py -q -x` | ❌ Wave 0 |
| SEC-01 | Missing/stale/rejected/incompatible Companion makes shared mode immediately read-only with no service/storage/target/network fallback | Pure reducer + exact-dist E2E | `node --test test/phase2-authority.test.mjs && node tools/run-exact-dist-playwright.mjs --grep=authority-loss` | ❌ Wave 0 |
| COLLAB-01 | One exclusive lease/project; reads concurrent; token opaque/bound/rotated; TTL 60/300/900, expiry, owner release | Async HA integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_leases.py -q -x` | ❌ Wave 0 |
| COLLAB-01 | Same-user second connection, different-user connection, reconnect, role loss, access revision change, old token replay all fail | Multi-connection HA integration | same | ❌ Wave 0 |
| COLLAB-01 | Every shared mutation rejects missing/wrong/expired lease and missing/stale exact revision with zero side effects | Parameterized integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_collaboration.py -q -x` | ❌ Wave 0 |
| COLLAB-01 | Role/lease/revision/digest/policy rechecked atomically inside transaction lock under deterministic race barriers | Concurrency/failure injection | same | ❌ Wave 0 |
| COLLAB-01 | Base/current/candidate evidence bounded; nonoverlap/overlap/dependency/invalid/second conflict; no LWW; candidate survives | Python semantic integration + JS reducer | `py -3.13 -m pytest tests/components/glt_flow_card/test_merge.py -q -x && node --test test/phase2-collaboration.test.mjs` | ❌ Wave 0 |
| COLLAB-01 | Two exact-dist browsers acquire/renew/expire/reconnect, edit concurrently, preserve candidate, merge/retry/discard, and never lose update | Playwright two-context E2E | `node tools/run-exact-dist-playwright.mjs --grep=two-session` | ❌ Wave 0 |
| SEC-01 / COLLAB-01 | German/English, dark/light, 320px/200%, keyboard/focus/live regions/reduced-motion/forced-colors and no secret DOM exposure | Playwright accessibility/visual behavior | `node tools/run-exact-dist-playwright.mjs --grep=phase-2-ui` | ❌ Wave 0 |
| SEC-01 / COLLAB-01 | Legacy permissions/locks/audit/options migration idempotent; old generated card/new Companion is incompatible-read-only | Migration + upgrade artifact | `py -3.13 -m pytest tests/components/glt_flow_card/test_phase2_migration.py -q -x` | ❌ Wave 0 |
| SEC-01 / COLLAB-01 | Setup/reload/unload clears subscriptions/tasks/cursors/previews/leases/rate buckets and rejects ghost commands/effects | Lifecycle integration | `py -3.13 -m pytest tests/components/glt_flow_card/test_phase2_lifecycle.py -q -x` | ❌ Wave 0 |
| SEC-01 / COLLAB-01 | Exact authored/generated bytes, HACS stage/ZIP/install/upgrade, HA 2024.8.0/current lanes | Release/artifact | `npm run validate:hacs-staging && npm run test:ha-artifacts && npm run verify:release` | ✅ infrastructure; ❌ Phase-2 assertions |

### Mandatory Negative and Failure-Injection Matrix

| Injection point | Required invariant |
|-----------------|--------------------|
| ACL bootstrap before/after save, repeated migration, malformed legacy ACL | No partial/elevated membership; restart is idempotent; project remains inaccessible until safe ACL exists. |
| Capability snapshot/store/subscription failure, sequence gap, role change mid-view | Browser same-render-cycle read-only; protected rows removed; candidate retained; no fallback. |
| Lease acquire/renew/release just before expiry, disconnect during renewal, two simultaneous acquisitions | Exactly one owner; old/losing token invalid; no grace; no owner identity leak; candidate not saved. |
| Mutation barriers before guard, after guard, before journal, after snapshot, after head | Guard is immediately precommit; Phase-1 forward recovery applies; no unauthorized commit or duplicate audit. |
| Access/content revision changes between preview and apply | Stable conflict; no overwrite; bounded authorized evidence only. |
| Merge second writer after preview | Second conflict; selected patch not replayed; candidate preserved. |
| Trusted accepted-event append fails | Control is not dispatched. |
| Service throws before handler starts / during dispatch / after state change | Correct before-dispatch vs result-unknown state; one service attempt maximum. |
| Readback missing, late, wrong attribute/value, permission revoked during wait | Timeout/denied result; never “confirmed”; no automatic retry; listener cleaned. |
| Post-dispatch evidence append fails, restart before repair | No repeat dispatch; correlation-stable pending projection repaired forward. |
| Telemetry over size/depth/nodes/rate/retention | Stable untrusted rejection/eviction; no trusted event or memory growth beyond bound. |
| Cursor cross-user/connection/project/filter replay, expiry, access revision change | Same safe invalid-cursor result; no data/count leakage. |
| Config-entry reload/unload during active lease/subscription/control wait | Runtime unavailable first; all resources close; no ghost event/service; reconnect starts fresh. |

### Exact-Dist Two-Browser Scenarios

The exact generated card, not source modules alone, must run in two isolated browser contexts against one shared coordinator. At minimum: (1) Engineer A obtains lease while Engineer B and same-user second session remain anonymous read-only; (2) dirty candidate auto-renews once at 40%, manual renew at 50%, token rotates and never appears in observable surfaces; (3) disconnect invalidates and reconnect does not retry the token; (4) two candidates diverge, A saves, B receives bounded conflict, previews non-overlap and overlap, hits a second conflict, then succeeds after reacquire/rebase; (5) role revocation while focused in merge/access/audit removes unauthorized actions/rows and restores focus safely; (6) configured control preview changes before dispatch and yields zero service calls; (7) accepted/dispatched/readback states and trusted audit correlate exactly; and (8) Companion loss at every protected operation produces no service/local/shared-storage/network effect. Run each core state in German and English; theme/responsive/a11y coverage may use a pairwise matrix while all security state transitions remain language-independent. [VERIFIED: UI-SPEC.md acceptance evidence]

### Sampling Rate

- **Per task commit:** run the narrow Python/Node command for the changed policy/lease/control/evidence/reducer module; target under 30 seconds. [VERIFIED: Nyquist strategy]
- **Per wave merge:** `npm run build && npm test && npm run test:python`; add focused exact-dist E2E for waves touching UI/state. [VERIFIED: existing workflow commands]
- **Security boundary wave:** run the entire generated command/principal deny matrix and controlled-service zero-effect suite. [VERIFIED: SEC-01 requirement]
- **Phase gate:** full local suite, exact-dist two-browser UI, staged HACS/ZIP, both exact HA lanes, release verification, and effect-ledger zero unintended effects. [VERIFIED: AGENTS.md and Phase-1 release architecture]

### Wave 0 Gaps

- [ ] `tests/components/glt_flow_card/user_factory.py` — five users, HA admin/non-admin, access tokens, multiple connections.
- [ ] `tests/components/glt_flow_card/test_policy.py` and `test_policy_enumeration.py` — manifest/role/command/non-enumeration matrix.
- [ ] `tests/components/glt_flow_card/test_project_access.py` — ACL revision, HA ceiling, migration, membership invariants.
- [ ] `tests/components/glt_flow_card/test_policy_subscriptions.py` and `test_evidence_pagination.py` — sequence/revocation/cursor scope.
- [ ] `tests/components/glt_flow_card/test_project_leases.py` and `test_collaboration.py` — token lifecycle and atomic guards.
- [ ] `tests/components/glt_flow_card/test_merge.py` — three-way conflict selection/revalidation/second conflict.
- [ ] `tests/components/glt_flow_card/test_configured_controls.py` and `test_control_evidence.py` — exact payload/readback/failure injection.
- [ ] `tests/components/glt_flow_card/test_trusted_evidence.py` — trusted/untrusted split, bounds, pagination, repair.
- [ ] `tests/components/glt_flow_card/test_phase2_migration.py` and `test_phase2_lifecycle.py` — runtime inventory migration and zero-resource unload.
- [ ] `test/phase2-authority.test.mjs` and `test/phase2-collaboration.test.mjs` — pure browser reducers/state machines.
- [ ] `test/e2e/fixtures/shared-authority.mjs` and `test/e2e/project-authority.spec.mjs` — shared coordinator/two-context exact-dist scenarios.
- [ ] Extend `LifecycleEffects` and browser effect ledgers for leases/cursors/subscriptions/IndexedDB/sessionStorage/DOM/token leakage.
- [ ] Add `test:phase2` and make release verification require it without weakening `test:phase1`.

### Phase Gate Definition

SEC-01 and COLLAB-01 pass only when every registered route has executable allow/deny evidence for every relevant principal; all denied/stale/unlocked/oversized/rate-limited paths prove zero unintended side effects; every configured control has exact normalized service evidence; every collaborative race proves no lost update; exact-dist two-session DE/EN behavior passes; unload is resource-zero; and the same staged artifact passes HA 2024.8.0 and 2026.8.3. Source-token assertions, screenshots, or unit-only mocks cannot substitute for those behaviors. [VERIFIED: AGENTS.md, REQUIREMENTS.md, and UI-SPEC.md]

## Security Domain

`.planning/config.json` enables `security_enforcement` and sets ASVS Level 1, so a security section and executable threat coverage are mandatory. The OWASP ASVS project lists 5.0.0 as the latest stable release; use the repository workflow's V2–V6 labels as its configured mapping and pin the actual checklist/version in generated security evidence. [VERIFIED: .planning/config.json] [CITED: https://owasp.org/www-project-application-security-verification-standard/]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes, delegated | HA authenticates the WebSocket connection; accept actor only from `connection.user`; reject inactive/missing/system-only contexts as policy dictates; do not implement project credentials. [CITED: https://developers.home-assistant.io/docs/auth_permissions/] |
| V3 Session Management | yes | HA owns login/session; project lease is an additional opaque, high-entropy, connection/refresh-token-bound, expiring in-memory capability, rotated on renewal and invalid after reconnect. [CITED: https://docs.python.org/3/library/secrets.html] |
| V4 Access Control | yes, central | Deny-default command manifest, fixed role matrix, HA ceiling, object-scope filtering, same missing/unauthorized response, per-event reauthorization, multi-user negative tests. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html] |
| V5 Input Validation | yes | Voluptuous route schema plus bounded canonical parser and exact allowlist for project/control/telemetry/cursor inputs; reject unknown keys and target/service override before effects. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html] |
| V6 Cryptography | yes, narrowly | Use Python CSPRNG for tokens and standard digest/constant-time comparison; do not design encryption, signed cursors, or custom crypto. [CITED: https://docs.python.org/3/library/secrets.html] |

### Threat Model Candidates

| Threat / abuse case | STRIDE | Boundary / asset | Standard mitigation | Required proof |
|---------------------|--------|------------------|---------------------|----------------|
| Client claims another actor/role/capability/time | Spoofing | Browser → Companion | Ignore all identity/authority claims; use authenticated `connection.user` and server clock. | Payload mutation tests produce same actor/time and no elevated result. |
| Imported project or project editor changes `permissions` | Elevation of privilege / Tampering | Project content → policy | Separate ACL store; fixed matrix; content ACL ignored after one-time bootstrap. | Import self-grant and rollback-to-old-ACL remain denied. |
| Legacy WebSocket command bypasses policy | Elevation of privilege | Command registration → repository/services | Manifest equality and thin policy wrapper; unimplemented compatibility routes fail closed. | Registered set equals policy set; every route has unassigned deny. |
| HA admin authority becomes automatic plant/project authority | Elevation of privilege | HA identity → project role | HA admin is ceiling/membership-admin condition, not implicit content role (A2). | Unassigned HA admin can manage minimal membership but cannot read/control content. |
| Unauthorized project/list/count/audit/control/remote enumeration | Information disclosure | Repository → WS output | Filter at query source, same missing/denied shape, no hidden totals, bound cursor to scope. | Timing/content/count/search/badge/cursor cross-user tests. |
| Subscription continues after role revoke | Information disclosure | Event bus → open WS | Reauthorize every event, access-revision sequence, revoke/unsubscribe/remove DOM. | Role change mid-stream yields minimal revocation and no next protected event. |
| Lease replay from another tab/session/reconnect | Spoofing / Tampering | Browser token → mutation | Opaque CSPRNG token digest bound to user+connection+refresh token+project+purpose+expiry; rotate; no persistence. | Same-user two-connection and reconnect replay tests. |
| TOCTOU between policy/lease/revision and commit | Tampering / Elevation | Policy → transaction store | One project critical section with immediate precommit recheck and lock-order tests. | Deterministic barrier races yield one commit, one conflict, zero lost updates. |
| Caller overrides service/target/immutable data | Elevation / Tampering | Control request → HA service | Control ID only; exact current-head definition; disjoint normalized data/target; HA entity permission; exact service-pair policy. | Malicious extra/duplicate/nested/template payload yields zero service attempts. |
| Control dispatch is repudiated or falsely confirmed | Repudiation | HA service/state → evidence | Server correlation, actor/time, accepted/dispatched/readback lifecycle; no client trusted rows; no “confirmed” without predicate. | Service/readback failure matrix and audit correlation equality. |
| Audit/telemetry injection or log forging | Repudiation / Tampering | Browser/errors → evidence store | Separate stores/contracts, stable codes, escaped/sanitized bounded fields, no raw CR/LF/token/payload. | Claimed actor/time/outcome remain untrusted and cannot appear in trusted export/filter. |
| Oversized messages, cursor/subscription/rate-state exhaustion | Denial of service | WS → memory/CPU/store | Byte/depth/node/key/rate/TTL/count caps; monotonic eviction; unload cleanup. | Below/equal/above and sustained-abuse memory/resource ledger. |
| Post-dispatch retry duplicates physical action | Tampering / Safety | Evidence failure → service | Durable accepted event before dispatch; after dispatch only forward evidence repair, never repeat service automatically. | Inject evidence failure after one captured service attempt and restart repair. |
| Token/project data leaks through diagnostics/UI/storage/logs | Information disclosure | Backend/browser observability | Redaction by construction; token memory only; candidate memory only; no secrets in diagnostics/events/URLs/DOM. | Sentinel scan across DOM, URL, storage, console, diagnostics, telemetry, screenshots, exports. |
| Unload/reload leaves ghost subscription/lease/control task | Denial / Elevation | Config-entry lifecycle | Runtime unavailable first, cancel/unsubscribe/clear, reject late callbacks, fresh generation on setup. | Resource ledger is zero and late events cause no output/effect. |

OWASP WebSocket guidance specifically calls for authorization on every message, message validation, size/rate controls, session-expiration handling, safe logging, and cleanup; those controls apply even though HA owns the transport authentication. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html]

### Stable Public Error Contract

Use localized UI copy mapped from stable server codes; do not expose raw exception messages or differentiate unauthorized from missing objects. Recommended codes are `project_unavailable`, `authority_stale`, `policy_incompatible`, `capability_required`, `lease_required`, `lease_invalid`, `lease_expired`, `lease_held`, `revision_conflict`, `access_revision_conflict`, `preview_invalid`, `cursor_invalid`, `input_invalid`, `rate_limited`, `control_denied`, `dispatch_failed`, and `dispatch_result_unknown`. Only a user already authorized to see the project receives safe missing-capability/lease/revision detail; unknown project responses stay generic. [VERIFIED: UI-SPEC.md error contract plus implementation recommendation]

## Sources

### Primary (HIGH confidence: repository and locked project evidence)

- `AGENTS.md` — runtime/security/source/test/release constraints and project conventions. [VERIFIED: repository inspection]
- `.planning/phases/02-authoritative-policy-controls-collaboration/02-CONTEXT.md` — locked server authority, controls, evidence, lease, conflict, and no-fallback decisions. [VERIFIED: repository inspection]
- `.planning/phases/02-authoritative-policy-controls-collaboration/02-UI-SPEC.md` — exact capability refresh, lease TTL/renewal, cursor page, two-session, DE/EN, accessibility, and effect-ledger contracts. [VERIFIED: repository inspection]
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json` — SEC-01/COLLAB-01, phase state, Nyquist/security configuration. [VERIFIED: repository inspection]
- Phase-1 context/research/summaries and current `project_repository.py`, `project_transactions.py`, `__init__.py`, `const.py`, `config_flow.py`, authored JS, Python tests, exact-dist fake HA, schemas, and release tools — existing seams and gaps. [VERIFIED: repository inspection]

### Secondary (MEDIUM confidence: authoritative official sources fetched through the research seam)

- [Home Assistant WebSocket extension documentation](https://developers.home-assistant.io/docs/frontend/extending/websocket-api/) — command schema, async response, registration, frontend calls; last updated 2026-06-19. [CITED: https://developers.home-assistant.io/docs/frontend/extending/websocket-api/]
- [Home Assistant permissions documentation](https://developers.home-assistant.io/docs/auth_permissions/) — correct user context, `Unauthorized`, entity read/control permission checks. [CITED: https://developers.home-assistant.io/docs/auth_permissions/]
- [HA 2024.8.0 WebSocket decorators](https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/decorators.py) and [HA 2026.8.3 decorators](https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/decorators.py) — exact supported-lane decorators. [CITED: https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/decorators.py]
- [HA 2024.8.0 ActiveConnection](https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/connection.py) and [HA 2026.8.3 ActiveConnection](https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/connection.py) — user/session/context/subscriptions/disconnect cleanup. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/connection.py]
- [HA 2024.8.0 WebSocket commands](https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/websocket_api/commands.py) and [HA 2026.8.3 commands](https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py) — per-event permission filtering and exact service call data/target/context. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/commands.py]
- [HA 2024.8.0 auth command source](https://raw.githubusercontent.com/home-assistant/core/2024.8.0/homeassistant/components/config/auth.py) and [HA 2026.8.3 auth command source](https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/config/auth.py) — server-side user enumeration API/format after admin authorization. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/config/auth.py]
- [HA config entry docs](https://developers.home-assistant.io/docs/config_entries_index/), [options flow docs](https://developers.home-assistant.io/docs/core/integration/options_flow/), [unload quality rule](https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/), and [2026 reload deprecation](https://developers.home-assistant.io/blog/2026/05/07/config-entry-listener-together-with-reloading-methods/) — lifecycle and compatibility. [CITED: https://developers.home-assistant.io/docs/core/integration-quality-scale/rules/config-entry-unloading/]
- [HA 2024.8.0 test fixtures](https://raw.githubusercontent.com/home-assistant/core/2024.8.0/tests/conftest.py) and [HA 2026.8.3 test fixtures](https://raw.githubusercontent.com/home-assistant/core/2026.8.3/tests/conftest.py) — MockUser/access-token/authenticated WebSocket test patterns. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/tests/conftest.py]
- [HA frontend data docs](https://developers.home-assistant.io/docs/frontend/data/) and [frontend fake hass source](https://github.com/home-assistant/frontend/blob/dev/src/fake_data/provide_hass.ts) — `callWS` and subscription frontend APIs. [CITED: https://developers.home-assistant.io/docs/frontend/data/]
- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [IDOR](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html), [WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html), [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), and [Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) — deny-default, object authorization, per-message checks, opaque tokens, bounded inputs/rates, and safe evidence. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html]
- [Python `secrets`](https://docs.python.org/3/library/secrets.html) — CSPRNG token generation and constant-time comparison. [CITED: https://docs.python.org/3/library/secrets.html]
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) — current stable security-verification project/release. [CITED: https://owasp.org/www-project-application-security-verification-standard/]

### Tertiary (LOW confidence)

- The A1–A6 design defaults in the Assumptions Log. No community/blog/package source is used for implementation decisions. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; exact repository versions and both HA compatibility lanes inspected. [VERIFIED: repository inspection]
- Architecture: HIGH — locked Phase-2 decisions align with existing Phase-1 repository/transaction seams; route/runtime gaps were inspected directly. [VERIFIED: repository inspection]
- HA API compatibility: MEDIUM — authoritative exact-tag source and official docs were fetched via the research seam; 2024.8.0/2026.8.3 behavior is directly compared. [CITED: https://raw.githubusercontent.com/home-assistant/core/2026.8.3/homeassistant/components/websocket_api/connection.py]
- Security/pitfalls: MEDIUM — derived from official OWASP/HA guidance and verified against repository code; exact project-specific budget numbers remain assumed. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html]
- Validation architecture: HIGH — extends working Phase-1 pytest, exact-dist Playwright, lifecycle effect-ledger, HACS staging, and exact HA lane infrastructure. [VERIFIED: repository inspection]

**Research date:** 2026-09-01  
**Valid until:** 2026-09-08 for “current HA lane/latest API” claims; pinned HA 2024.8.0 and 2026.8.3 source comparisons remain valid for those exact versions. [VERIFIED: research freshness assessment]
