# Phase 2: Authoritative Policy, Controls & Collaboration - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Smart discuss recommendations auto-accepted by the user's non-interactive full-delivery instruction

<domain>
## Phase Boundary

This phase makes the Companion the sole authority for every shared project read, list/count, subscription, mutation, control, remote action, and audit query. It implements server-owned role assignments, exact configured control targets, trusted audit events, mandatory optimistic revisions, exclusive renewable engineering leases, conflict-safe retry/merge evidence, and fail-closed browser behavior when authority is unavailable. It does not yet build the semantic equipment model, profile-driven operational panel, or multi-site transport; later phases consume the policy and collaboration contracts established here.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `custom_components/glt_flow_card/project_repository.py` already supplies split authoritative stores, immutable snapshots/journals/audit events, bounded retention, and recoverable transactions.
- `custom_components/glt_flow_card/project_transactions.py` already implements expected-revision preview/apply/rollback, opaque user-bound preview identities, recovery, and exactly-once audit projection.
- `custom_components/glt_flow_card/__init__.py` contains the legacy WebSocket surface, role/control/remote/audit paths, lifecycle registration, and Home Assistant connection identity needed for a compatibility migration.
- `src/v100/project-safety.js` and the exact-dist fake Home Assistant harness provide an accessible Projects-adjacent UI and realistic WebSocket behavior that can be extended for capabilities, leases, conflicts, and read-only authority loss.

### Established Patterns
- Server-controlled security evidence uses stable codes, canonical bounded documents, server identity/time, deep copies at persistence boundaries, and tests that prove denial as well as success.
- Shared mutations are server-side transactions with verified read-back and forward-only recovery; browser configuration is never a security authority.
- Authored JS/Python modules are primary; `dist/`, Companion `www/`, build manifests, HACS stages, and release artifacts are regenerated and checked for exact equality.
- Tests run as pure Node/Python suites, exact-distribution Playwright, and immutable minimum/current Home Assistant container lanes with zero unintended service attempts.

### Integration Points
- Every registered `glt_flow_card/*` WebSocket command in `custom_components/glt_flow_card/__init__.py` must route through one policy boundary; legacy broad reads and caller-selected control/audit inputs must be removed or fail closed.
- Project repository/transaction APIs must carry actor, capability, expected revision, and lease evidence without trusting fields from the browser payload.
- `src/v100/project-safety.js` and existing project store wrappers must consume server capabilities/lease responses and disable all shared fallback paths.
- Python HA fixtures need multiple authenticated users/connections; Playwright needs two browser sessions backed by a shared authoritative fake/real test coordinator.

</code_context>

<specifics>
## Specific Ideas

- Treat authorization, audit, and collaboration as one coherent server contract rather than separate browser features.
- Preserve standalone local design, but label it unmistakably and never let it inherit shared-project privileges.
- Prefer explicit failure/result states over optimistic success; no project or plant operation should appear successful before authoritative evidence exists.
- No live Home Assistant, remote-site, fieldbus, or plant writes are needed; service execution tests use controlled fake services and assert exact normalized payloads.

</specifics>

<deferred>
## Deferred Ideas

- Semantic hierarchy/profile-driven capabilities and protocol provenance are Phase 3.
- Rich operational control presentation and contextual navigation are Phase 4.
- Declarative SDK permission namespaces are Phase 5.
- Full remote-site authentication/transport and failure isolation are Phase 9; Phase 2 supplies reusable policy enforcement only.

</deferred>
