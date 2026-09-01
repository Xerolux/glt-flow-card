# Phase 02: Authoritative Policy, Controls & Collaboration - Pattern Map

**Mapped:** 2026-09-01  
**Files classified:** 25 file groups  
**Strong analog coverage:** 22 / 25  
**Safety boundary:** repository tests and controlled fake Home Assistant services only; no live service, remote-site, fieldbus, or plant writes

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `custom_components/glt_flow_card/policy.py` | service/policy | request-response | `__init__.py:807-845` command inventory/guard | role-match |
| `custom_components/glt_flow_card/project_access.py` | model/repository | CRUD | `project_repository.py:58-140,328-368` | exact |
| `custom_components/glt_flow_card/project_leases.py` | service/store | event-driven | `project_transactions.py:34-75,652-709` | role-match |
| `custom_components/glt_flow_card/configured_controls.py` | service | request-response/event-driven | `__init__.py:677-697` (replacement seam) | partial |
| `custom_components/glt_flow_card/trusted_evidence.py` | repository/service | append/query/pub-sub | `project_repository.py:391-513`, `project_transactions.py:734-765` | exact |
| `custom_components/glt_flow_card/project_transactions.py` | service | transactional CRUD | existing coordinator `:34-75,481-621` | exact modification |
| `custom_components/glt_flow_card/project_repository.py` | repository | CRUD | existing split stores `:58-140,328-368` | exact modification |
| `custom_components/glt_flow_card/__init__.py` | route/provider | request-response/event-driven | existing WS/lifecycle composition `:423-480,807-944` | exact modification |
| `custom_components/glt_flow_card/const.py` | config | transform | existing store/options constants | exact modification |
| `src/v100/project-authority.mjs` | store/reducer | event-driven/transform | state object and render loop in `project-safety.js:422-531` | role-match |
| `src/v100/project-collaboration.mjs` | service/reducer | transform | `project-safety.js:61-98,172-361` | role-match |
| `src/v100/configured-control.mjs` | service/reducer | request-response/transform | `project-safety.js:61-64,251-324` | role-match |
| `src/v100/project-safety.js` | component | event-driven/request-response | existing Project Safety dialog `:422-578` | exact modification |
| `src/v100/project-safety-i18n.mjs` | config/utility | transform | existing `COPY` and interpolation `:1-148` | exact modification |
| `src/v100/entry.js` | config/entry | event-driven | current ordered side-effect imports | exact modification |
| `tests/components/glt_flow_card/user_factory.py` | test utility | request-response | `conftest.py:58-75,78-162` | role-match |
| Phase-2 Python policy/access/lease tests | integration tests | CRUD/request-response/event-driven | `test_project_transactions.py:81-811` | exact |
| Phase-2 control/evidence tests | integration tests | event-driven/request-response | lifecycle effect fixture `conftest.py:78-162` | role-match |
| Phase-2 lifecycle/migration tests | integration tests | event-driven | existing `test_init.py` plus `conftest.py:78-173` | exact |
| `test/phase2-authority.test.mjs` | unit test | transform | `test/v100-*.test.mjs` direct ESM pattern | exact |
| `test/phase2-collaboration.test.mjs` | unit test | transform | `test/v100-diff.test.mjs` deterministic semantic operations | role-match |
| `test/e2e/fixtures/shared-authority.mjs` | E2E fixture | event-driven/pub-sub | `test/e2e/fixtures/fake-ha.mjs:10-239` | exact |
| `test/e2e/project-authority.spec.mjs` | E2E test | event-driven/request-response | `project-safety.spec.mjs:28-348` | exact |
| `package.json` | config | batch | scripts `:13-38` | exact modification |
| build/release workflows and Phase-2 gate | CI/config | batch | Phase-1 build/HA/release gates | exact modification |

## Pattern Assignments

### `policy.py` — one deny-by-default command policy boundary

**Analog:** `custom_components/glt_flow_card/__init__.py:807-845`

```python
_COMMAND_HANDLERS = (
    ws_projects_list, ws_projects_get, ws_projects_save, ws_projects_preview,
    # ...all component routes are enumerated once...
)

COMMANDS = tuple(_guard_command(command) for command in _COMMAND_HANDLERS)

def _register_commands_once(hass: HomeAssistant) -> None:
    """Register the immutable component command surface exactly once."""
```

Copy the complete-inventory idea, but make the manifest authoritative: every registered `glt_flow_card/*` route declares scope, capability, project-key source, enumeration policy, lease/revision requirement, and implementation state. Tests must compare the exact registered route set to `COMMAND_POLICIES`, reject duplicates, and reject an undeclared route. Keep handler functions thin: resolve actor from `connection.user`, call the policy coordinator, delegate, translate stable errors.

**Do not copy:** `_require_project_role` at `__init__.py:473-480` derives roles from caller-editable project content and treats HA admin as a content superuser. `projects/list/get`, alarm/work-order/report/audit list routes currently serialize before a central authorization/filter decision. These are replacement seams, not security analogs.

**Safe insertion:** construct the policy coordinator during entry setup after repositories/recovery succeed but before runtime publication/command availability; keep component-scope command registration immutable and runtime lookup guarded.

### `project_access.py` — server-owned ACL repository

**Analog:** `custom_components/glt_flow_card/project_repository.py:58-140,328-368`

```python
class ProjectRepository:
    """Own split project persistence and expose only defensive copies."""

    def get_head(self, project_id: str) -> dict[str, Any] | None:
        value = self._heads["projects"].get(project_id)
        return deepcopy(value) if value is not None else None

    async def write_head(self, project_id: str, head: Mapping[str, Any]) -> None:
        self._heads["projects"][project_id] = deepcopy(dict(head))
        await self._heads_store.async_save(deepcopy(self._heads))
```

Use a separate versioned HA `Store`, defensive copies, exact ACL revision, bounded role assignments, read-back verification, and copy-on-write/idempotent bootstrap. Store fixed role IDs only; capability lists never come from project JSON. A grant is valid only after intersecting the requested fixed role with the authenticated HA actor's authority ceiling. ACL changes are shared mutations and therefore require current access revision, content revision where applicable, and a valid engineering lease.

Legacy `config.permissions` may be inspected once for a conservative bootstrap but must never remain authoritative or elevate an imported creator. Preserve an evidence receipt for bootstrap without storing project bodies or secrets.

### `project_leases.py` — ephemeral connection-bound exclusive lease

**Analogs:** `project_transactions.py:34-75` for injected clocks/ID factories and a single asyncio lock; `__init__.py:423-466` for entry-scoped runtime ownership.

```python
class ProjectTransactionCoordinator:
    def __init__(self, repository, *, preview_ttl=300, clock=None,
                 id_factory=None, failure_hook=None):
        self._lock = asyncio.Lock()
        self._clock = clock or time.monotonic
        self._id_factory = id_factory or (lambda: secrets.token_urlsafe(24))
```

Copy injectable monotonic time, opaque `secrets` identity, one coordinator-owned lock, bounded maps, and explicit cleanup. Bind each lease to project ID, authenticated user ID, connection/session identity (`refresh_token_id` plus connection identity), purpose, access revision, issued/expiry time. Rotate token on renewal; compare secrets with `hmac.compare_digest`; never persist tokens. Acquire/renew/release/status all reauthorize. Expiry has no grace period. Disconnect/unload clears leases and pending renewals; reconnect must reacquire.

**Do not copy:** legacy `projects/lock` / `projects/unlock` at `__init__.py:617-640`; those stored user-only locks are not an atomic write guard and their 30–3600 range differs from the Phase-2 60–900 contract.

### `project_transactions.py` — guard inside the existing critical section

**Analog:** `custom_components/glt_flow_card/project_transactions.py:481-621`

```python
current_head = await self.repository.read_head(project_id)
if current_head is not None:
    if (int(current_head["revision"]) != int(expected_revision)
            or current_head["digest"] != old_digest):
        raise TransactionConflict(
            f"revision_conflict:{current_head['revision']}"
        )
# PREPARED journal -> verified immutable snapshot -> head -> AUDIT_PENDING
```

Extend `apply`, `rollback`, compatibility save, delete, import, project metadata, and ACL mutation so **inside the same coordinator lock immediately before PREPARED/commit** they recheck: actor/effective capability, connection-bound lease, exact content revision, exact access revision, current digest, preview/policy identity, and current project policy. Accept a narrow async/sync mutation-guard callback or coordinator dependency; never perform the decisive policy check only in the WebSocket handler.

Preserve Phase-1 PREPARED → snapshot → head → AUDIT_PENDING → COMMITTED recovery (`:559-621,652-709`) and its exactly-once audit repair. Extend journal metadata with stable policy/access/lease evidence identifiers, never lease tokens or candidate/project bodies. Remove `compatibility_save`'s optional-revision fallback at `:430-445`; absence must fail with a stable upgrade/validation code.

### `configured_controls.py` — resolve exact target from current head

**Replacement seam:** `custom_components/glt_flow_card/__init__.py:677-697`

Current code accepts `entity_id`, `domain`, `service`, and `service_data` from the caller, then inserts the target into caller data. Replace it completely. New preview/execute input contains only project route, opaque configured control ID, current revision/digest/preview identity, correlation evidence, and bounded schema-declared user fields.

Use this order:

1. Authorize actor and project capability.
2. Re-read/validate the current project head.
3. Resolve control ID and immutable domain/service/entity/device/area target from the head.
4. Reject unknown keys, nesting/templates/target overrides, oversize values, unsafe domains, and failed maintenance/simulation gates.
5. Check HA permissions for every resolved target.
6. Return a read-only normalized preview; immediately before execute recheck all evidence.
7. Call `hass.services.async_call(domain, service, service_data, target=target, blocking=True, context=Context(user_id=actor))` using separately normalized `service_data` and `target`.
8. Observe readback without automatically repeating dispatch.

Create explicit accepted, dispatched, readback-confirmed, timed-out/result-unknown, denied, cancelled-before-dispatch, failed-before-dispatch, and failed-after-dispatch evidence. An audit-store failure after dispatch must never retry the physical action.

### `trusted_evidence.py` — server event factory, separate telemetry

**Analog:** `project_transactions.py:734-765`

```python
return {
    "id": f"audit:{journal['id']}",
    "at": journal.get("prepared_at") or _utc(),
    "action": journal["action"],
    "user_id": journal["user_id"],
    "project_id": journal["project_id"],
    "transaction_id": journal["id"],
    "result": result,
}
```

Copy server-owned time/actor/correlation and metadata-only persistence. Only internal workflows may create trusted evidence; retire/fail closed `audit/add` at `__init__.py:794-799`. Client telemetry gets a distinct schema/store/API, explicit `trusted: false`/provenance label, byte/depth/key/count/rate bounds, and cannot select actor/time/result/security/control event types. Use authorized opaque cursor state bound to user, connection, project/filter and restart generation; page reads reauthorize, cap rows/bytes, and omit hidden counts.

Subscriptions follow HA's unsubscribe-callback pattern and reauthorize every emitted event. A role/access change must remove unauthorized cached rows client-side and terminate or narrow server output without revealing identities.

### `__init__.py` — thin adapters and complete lifecycle ownership

**Analogs:** `__init__.py:423-466,818-845,889-944`

```python
class CompanionRuntime:
    async def async_close(self) -> None:
        await self.manager.async_close()

def _guard_command(command):
    @wraps(command)
    def guarded(hass, connection, msg):
        if _runtime_for(hass) is None:
            connection.send_error(msg["id"], "not_loaded", ...)
            return None
        return command(hass, connection, msg)
```

Retain entry-scoped runtime, publish-after-initialize/recover, guarded `not_loaded`, register-once, and remove-visibility-before-close. Expand `CompanionRuntime` to own policy, ACL, leases, evidence, cursors/subscriptions, rate buckets, and control readback tasks. `async_close` must invalidate availability first, cancel/await tasks, call all unsubscribe callbacks, clear tokens/cursors/rate buckets, and be idempotent across unload/reload/setup failure.

Handlers should have a uniform stable translation table (`not_found_or_denied`, `capability_denied`, `authority_stale`, `lease_required`, `lease_expired`, `revision_conflict`, `invalid_input`, `effect_unknown`, `rate_limited`) with bounded non-sensitive detail. Avoid broad `except Exception` returning raw strings as at `:696-697,779-791`.

### Browser reducers — `project-authority.mjs`, `project-collaboration.mjs`, `configured-control.mjs`

**Analog:** `src/v100/project-safety.js:61-98,422-531`

```js
function projectAuthority(editor, type, payload) {
  if (!editor._hass?.callWS) {
    return Promise.reject(Object.assign(
      new Error("Companion unavailable"), { code: "unavailable" }
    ));
  }
  return editor._hass.callWS({ type: `glt_flow_card/projects/${type}`, ...payload });
}
```

Extract pure reducers from DOM rendering. `project-authority.mjs` owns capability snapshot version/sequence/freshness, role display, lease state/expiry, Companion status, and the single derived `sharedWritable` decision. Any absent/stale/rejected snapshot, sequence gap, disconnect, expiry, role loss, or incompatible version changes shared mode to read-only in the same render cycle. Tokens and dirty candidates remain memory-only and must never enter DOM, URL, localStorage, IndexedDB, diagnostics, telemetry, or logs.

`project-collaboration.mjs` preserves base/current/candidate evidence and supports refresh, server-authorized merge preview, fresh-lease retry, and explicit discard. Reuse Phase-1 semantic operation IDs/dependency closure; never provide overwrite/LWW or submit a raw client patch. Clear candidate only after authoritative committed receipt.

`configured-control.mjs` sends only control ID plus declared bounded input, renders server preview, and treats accepted/dispatched as pending rather than success. Timeout/result-unknown never retries.

### `project-safety.js` and i18n — accessible authority/collaboration surface

**Analog:** `project-safety.js:422-531` and `project-safety-i18n.mjs:1-148`

The existing native dialog has `aria-modal`, labelled tabs, Escape, Tab focus containment, trigger focus restoration, same-shell reflow, and DE/EN copy. Extend this surface with the persistent Authority State Bar, access management, lease lifecycle, conflict/merge, configured-control confirmation/results, and separate trusted-audit/telemetry views. Use semantic buttons, `aria-live` sparingly, 44px targets, visible focus, reduced-motion/forced-colors, 320px/200% layouts, and non-color icon+text states.

Keep all copy keys in the i18n module and interpolate only escaped text. Do not leak other lease-holder identity. Do not add another uncoordinated `_render` prototype wrapper: consolidate the existing wrapper at `project-safety.js:560-578` and keep original return/load order. Shared failures never fall back to `hass.callService`, local browser persistence, or Lovelace mutation. Standalone local mode stays explicitly separate and never receives the shared candidate automatically.

### Python behavioral tests and fixtures

**Analogs:** `tests/components/glt_flow_card/conftest.py:58-162`; `test_project_transactions.py:45-79,595-791`

```python
@dataclass
class LifecycleEffects:
    websocket_commands: list[str] = field(default_factory=list)
    active_listeners: dict[int, str] = field(default_factory=dict)
    service_attempts: list[dict[str, Any]] = field(default_factory=list)

async def reject_service(...):
    effects.service_attempts.append(attempt)
    raise AssertionError(f"live service attempt blocked: {domain}.{service}")
```

Extend the fixture rather than bypassing it. Add five principals (unassigned, Viewer, Operator, Engineer, Admin), HA-admin/non-admin ceilings, same-user distinct connections, second user, refresh-token/session identity, controlled service recorder, state/readback driver, deterministic clock, disconnect callbacks, subscription/cursor ledger, and mutation barriers.

Follow existing direct coordinator tests: arrange a real repository/coordinator, inject time/IDs/failures, assert returned stable DTOs plus persisted head/journal/evidence and exact zero-effect denial. Parameterize every registered route × principal and every mutation with missing/wrong/expired/cross-user/cross-connection/cross-project lease, stale content/access revision, changed digest/policy, disconnect, unload, and race barriers. Test failures before/after journal/snapshot/head/audit and before/after service dispatch.

### Node reducers and exact-dist two-browser tests

**Analog:** `test/e2e/fixtures/fake-ha.mjs:10-239`

```js
const effects = {
  network: [], localStorage: [], websocket: [], service: [],
  tasks: [], listeners: [], sessions: [{ kind: "fake-ha", id: "exact-dist" }],
};
const callWS = async (message) => {
  effects.websocket.push(structuredClone(message));
  return structuredClone(wsResults[message.type] ?? {});
};
const callService = async (...) => prohibited("service", effect);
```

Build `shared-authority.mjs` as one coordinator shared by two isolated Playwright browser contexts, while each context has distinct actor/session/memory. It must model capability sequence/revocation, one lease, deterministic clock/expiry, token rotation, current project head, two candidates, semantic conflict/merge, controlled service/evidence state, cursors, and disconnect. Keep the current non-loopback network block and localStorage/service effect ledgers; add IndexedDB, direct-target WS field, token/secret DOM/storage/log, active asset, repeated-dispatch, and listener/task cleanup assertions.

Exact-dist specs must mount the committed generated artifact and cover DE/EN, light/dark, keyboard/focus/live regions, 320px/200%/forced-colors/reduced-motion, all five roles, non-enumeration, ACL denial, lease lifecycle, two-session conflicts, second conflict, role loss, stale sequence, reconnect, control evidence states, pagination/revocation, and clean/dirty authority loss.

### Scripts, CI, generated artifacts, and release gate

Add `test:phase2:quick` and `test:phase2` without weakening Phase-1 scripts. The full Phase-2 gate consumes Phase-1 evidence plus route-policy inventory, Python matrix, Node reducers, exact-dist two-browser evidence, minimum/current immutable HA lanes, local HACS category validation, release verification, and release acceptance. Reuse the Phase-1 build-once manifest-hashed artifact flow; downstream jobs must test downloaded exact bytes and never rebuild after acceptance.

Authored changes live in `src/v100/`, Python modules, tests, tools, schemas/config, and workflows. `dist/glt-flow-card.js`, `custom_components/glt_flow_card/www/glt-flow-card.js`, generated editor region, manifests, HACS stages, ZIPs, and checksums are generated only by `tools/build.mjs`/staging. Never patch a generated copy alone.

## Shared Patterns

### Authorization and non-enumeration

- Actor is always `connection.user`; ignore caller IDs, roles, timestamps, ACLs, capabilities, ownership, and targets.
- Fixed role → capability matrix is server code/data, then intersected with HA authority/entity permission.
- Every request and every subscription event is reauthorized; default is deny.
- Collection/list/count/search/audit/filter results are filtered before serialization. Direct unauthorized and missing project access share one stable non-enumerating shape.

### Mutation transaction

```text
authenticate actor
  -> authorize capability
  -> enter coordinator lock
  -> re-read ACL/access revision + lease/session + head revision/digest + policy
  -> recompute candidate/diff/selection server-side
  -> PREPARED journal
  -> immutable verified snapshot
  -> verified head
  -> trusted evidence repair/finalization
```

All shared mutations, including rollback/import/delete/ACL/metadata, use this path. No optional revision, no lease grace, no last-writer-wins.

### Errors and evidence

- Stable public code plus bounded safe parameters; no raw exception, token, project body, hidden count, entity state payload, URL, credential, or service body.
- Server assigns actor, time, correlation, normalized target identity, and lifecycle result.
- Dispatch completion is not readback confirmation. After-dispatch uncertainty is recorded, never retried automatically.
- Trusted evidence and untrusted telemetry have separate stores, schemas, APIs, labels, retention, authorization, and pagination.

### Lifecycle

Runtime availability is published only after store bootstrap, migrations, transaction recovery, policy-manifest validation, and resource registration succeed. Unload hides runtime first, then invalidates leases/cursors/subscriptions, cancels and awaits tasks, unsubscribes, clears memory, and tolerates repetition.

### Testing

Every protected path needs allow + deny + zero-effect assertions. Token/grep tests may assist drift detection but cannot satisfy SEC-01/COLLAB-01. Use controlled fake services only; no live HA/remote/fieldbus/plant effect. Exact generated artifact and both supported HA lanes remain release requirements.

## Unsafe Legacy Seams to Replace, Not Copy

| Seam | Risk | Required treatment |
|---|---|---|
| `_project_role` / `_require_project_role` (`__init__.py:57-75,473-480`) | project JSON/self-grant + HA-admin shortcut | replace with server ACL + capability policy |
| `projects/list/get` (`:483-492`) | broad enumeration | filter/deny before serialization |
| optional legacy save revision (`:495-507`, transactions `:430-445`) | stale/unguarded write | exact revision + lease mandatory |
| legacy lock/unlock (`:617-640`) | persisted/user-only/non-atomic | retire; ephemeral connection-bound lease |
| caller-selected control (`:677-697`) | confused deputy, target override | configured control ID only; server resolution |
| broad list routes (`:700-804`) | alarms/work orders/reports/audit/remote leak | declare all routes and scope/filter centrally |
| remote state/control (`:767-791`) | under-scoped transport/control | policy-declare and fail closed until Phase 9 |
| `audit/add` (`:794-799`) | caller forges trusted history | remove/telemetry-only separate API |
| broad exception strings (`:696-697,779-791`) | secret/internal disclosure | stable bounded error translation |
| UI shared fallback | bypasses authority | same-render read-only; local mode explicit only |

## No Close Analog

| File/Concern | Why | Planner direction |
|---|---|---|
| Server-owned ACL and HA-ceiling intersection | current roles are embedded in project data | build new versioned repository using Phase-1 store conventions |
| Connection/session-bound lease manager | legacy locks are persistent and not commit guards | new in-memory bounded service using transaction clock/ID/lock patterns |
| Configured-control resolver with readback lifecycle | current route accepts raw target/service/data | new service; only reuse HA context/call boundary carefully |
| Shared two-browser coordinator | current fake HA is per-page/static | create a shared test coordinator with isolated principals/sessions |
| Opaque authorized cursor store | no current cursor/subscription authority model | bounded ephemeral server state with per-event reauthorization |

## Planner Insertion Checklist

1. Establish Wave-0 principals, effect ledgers, policy inventory, deterministic lease clock, and shared two-browser fixture first.
2. Add policy/ACL/lease/evidence modules before migrating handlers; prove complete route inventory continuously.
3. Put decisive guard inside the existing transaction lock before enabling any compatibility mutation.
4. Replace configured controls and audit append before exposing Phase-2 UI actions.
5. Extract/test pure browser reducers before expanding the existing Project Safety DOM integration.
6. Preserve one authored build path; regenerate exact artifacts and run both HA lanes only after behavior suites pass.
7. Phase completion requires the full SEC-01/COLLAB-01 matrix, zero-effect denials, two-session exact-dist evidence, lifecycle zero-ledger, HACS/release checks, and no unresolved high security findings.

## Metadata

**Search scope:** Phase-2 context/research/UI/validation; all Phase-1 summaries/patterns; `custom_components/glt_flow_card/`; `src/v100/`; `tests/components/glt_flow_card/`; `test/e2e/`; package/build/release tooling.  
**Primary analogs:** `project_repository.py`, `project_transactions.py`, `__init__.py`, `project-safety.js`, `project-safety-i18n.mjs`, Python lifecycle fixtures, exact-dist fake HA/effect ledger.  
**Generated boundary:** authored source and generators are primary; `dist`, Companion `www`, generated editor content, HACS stages, ZIPs, manifests, and checksums are derived.  
**Pattern extraction date:** 2026-09-01
