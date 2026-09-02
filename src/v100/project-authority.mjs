/* Fail-closed browser authority: what the server permits now, and nothing more.
 *
 * The card may use a capability snapshot to decide what to *show*. It may never
 * use one to decide what is *allowed*. Every shared mutation is re-authorized by
 * the Companion, and every way authority can be lost - absent, loading, stale,
 * rejected, sequence-gapped, incompatible, revoked, expired, disconnected -
 * makes shared mode read-only in the same reducer transition.
 *
 * The reducer is pure and synchronous on purpose. "Read-only in the same render
 * cycle" is only provable if the decision is a function of state, so nothing
 * here awaits, times out, or schedules. Expiry is decided by the `now` carried
 * on each action, never by a clock this module reads for itself.
 */

/** The only policy version this build understands. */
export const SUPPORTED_POLICY_VERSION = 1;

/** Server-owned roles, in ascending order of authority. Closed set. */
export const ROLES = Object.freeze(["viewer", "operator", "engineer", "admin"]);

/** Companion authority states, as shown by the authority state bar. */
export const AUTHORITY_STATES = Object.freeze([
  "absent",
  "loading",
  "current",
  "stale",
  "rejected",
  "incompatible",
  "unavailable",
]);

/**
 * Stable server error codes. The browser never invents a code: an unrecognized
 * failure becomes `effect_unknown`, which is honest, rather than a guess that
 * would read as authoritative.
 */
export const STABLE_ERROR_CODES = Object.freeze([
  "not_found_or_denied",
  "capability_denied",
  "authority_stale",
  "lease_required",
  "lease_expired",
  "lease_held",
  "revision_conflict",
  "invalid_input",
  "effect_unknown",
  "rate_limited",
  "feature_unavailable",
  "not_loaded",
]);

/**
 * Lease renewal thresholds, as fractions of the server-advertised TTL still
 * *remaining*. At half the TTL left the user is asked whether to renew; if they
 * do not answer and a dirty candidate is at stake, renewal happens by itself at
 * 40% left. A clean idle lease is never auto-renewed - it is allowed to lapse so
 * one browser cannot hold the only editing lease indefinitely by being open.
 */
export const DIRTY_AUTO_RENEW_AT = 0.4;
export const MANUAL_RENEW_PROMPT_AT = 0.5;

/** Refresh the capability snapshot at half of its advertised lifetime. */
export const SNAPSHOT_REFRESH_AT = 0.5;

/**
 * Every event that must produce a read-only shared mode, mapped to the distinct
 * reason the UI shows. A reason is never a raw exception and never names another
 * user, another session, a hidden project or a bearer.
 */
const READ_ONLY_REASONS = Object.freeze({
  "authority/absent": "authority_absent",
  "authority/loading": "authority_loading",
  "authority/stale": "authority_stale",
  "authority/rejected": "authority_rejected",
  "authority/incompatible": "authority_incompatible",
  "authority/sequence-gap": "authority_sequence_gap",
  "role/revoked": "role_revoked",
  "lease/expired": "lease_expired",
  "lease/lost": "lease_lost",
  "companion/disconnected": "companion_disconnected",
});

/** The authority state each read-only event leaves behind. */
const READ_ONLY_AUTHORITY = Object.freeze({
  "authority/absent": "absent",
  "authority/loading": "loading",
  "authority/stale": "stale",
  "authority/rejected": "rejected",
  "authority/incompatible": "incompatible",
  "authority/sequence-gap": "stale",
  "role/revoked": "current",
  "lease/expired": "current",
  "lease/lost": "current",
  "companion/disconnected": "unavailable",
});

/**
 * Events after which previously loaded rows may no longer be shown. Losing a
 * lease does not revoke read access, so it does not clear rows; losing or
 * doubting authority does, because the rows were authorized under it.
 */
const CLEARS_AUTHORIZED_ROWS = Object.freeze(new Set([
  "authority/absent",
  "authority/stale",
  "authority/rejected",
  "authority/incompatible",
  "authority/sequence-gap",
  "role/revoked",
  "companion/disconnected",
]));

function toCode(value) {
  const code = typeof value === "string" ? value : "";
  return STABLE_ERROR_CODES.includes(code) ? code : "effect_unknown";
}

function toRole(value) {
  return ROLES.includes(value) ? value : null;
}

function toCapabilities(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Set();
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0 && entry.length <= 64) unique.add(entry);
  }
  return [...unique].sort();
}

function toRevision(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function toSeconds(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function at(action, state) {
  return Number.isFinite(action?.now) ? action.now : state.observedAt;
}

/** The initial state: shared mode, no authority, nothing writable. */
export function initialAuthorityState(options = {}) {
  return {
    mode: options.mode === "local" ? "local" : "shared",
    authority: "absent",
    role: null,
    capabilities: [],
    policyVersion: null,
    policyCompatible: false,
    accessRevision: null,
    revision: null,
    expectedRevision: null,
    sequence: 0,
    generation: null,
    observedAt: 0,
    snapshotAt: null,
    snapshotExpiresAt: null,
    snapshotRefreshAt: null,
    lease: null,
    candidate: { dirty: false, preserved: false },
    projects: [],
    evidence: { rows: [], cursor: null, hasMore: false, stale: false, error: null },
    telemetry: { rows: [], cursor: null, hasMore: false, stale: false, error: null },
    readOnlyReason: "authority_absent",
    error: null,
    announcement: null,
  };
}

/**
 * Drop a lease that the carried `now` has already passed.
 *
 * `sharedWritable` is pure over state and cannot consult a clock, so an expired
 * lease must never survive a transition. Normalizing here is what lets the
 * predicate stay a simple, auditable function.
 */
function normalize(state, now) {
  const next = state;
  if (next.lease && Number.isFinite(now) && now >= next.lease.expiresAt) {
    next.lease = { ...next.lease, state: "expired", holder: "none" };
    next.readOnlyReason = next.readOnlyReason ?? "lease_expired";
  }
  next.observedAt = Number.isFinite(now) ? now : next.observedAt;
  return next;
}

function clearAuthorizedRows(state) {
  state.projects = [];
  state.evidence = { ...state.evidence, rows: [], cursor: null, hasMore: false, stale: true };
  state.telemetry = { ...state.telemetry, rows: [], cursor: null, hasMore: false, stale: true };
}

/**
 * Apply one authority action.
 *
 * Unknown actions return the state unchanged: an unrecognized server event must
 * never widen what the browser believes it may do.
 */
export function authorityReducer(state, action) {
  const current = state ?? initialAuthorityState();
  const type = String(action?.type ?? "");
  const now = at(action, current);
  const next = {
    ...current,
    candidate: { ...current.candidate },
    evidence: { ...current.evidence },
    telemetry: { ...current.telemetry },
  };

  if (type in READ_ONLY_REASONS) {
    next.authority = READ_ONLY_AUTHORITY[type];
    next.readOnlyReason = READ_ONLY_REASONS[type];
    next.announcement = { level: "assertive", code: READ_ONLY_REASONS[type] };
    if (type === "role/revoked") {
      next.role = null;
      next.capabilities = [];
    }
    if (type === "lease/expired" || type === "lease/lost" || type === "companion/disconnected") {
      next.lease = next.lease
        ? { ...next.lease, state: type === "lease/expired" ? "expired" : "lost", holder: "none" }
        : null;
    }
    if (CLEARS_AUTHORIZED_ROWS.has(type)) clearAuthorizedRows(next);
    // A candidate is never discarded by authority loss; it is kept in memory so
    // the user can retry once authority returns.
    if (next.candidate.dirty) next.candidate.preserved = true;
    return normalize(next, now);
  }

  switch (type) {
    case "authority/snapshot": {
      const snapshot = action.snapshot ?? {};
      const policyVersion = Number.isInteger(snapshot.policy_version) ? snapshot.policy_version : null;
      const sequence = Number.isInteger(snapshot.sequence) ? snapshot.sequence : null;
      if (policyVersion !== SUPPORTED_POLICY_VERSION) {
        next.authority = "incompatible";
        next.policyVersion = policyVersion;
        next.policyCompatible = false;
        next.readOnlyReason = "authority_incompatible";
        next.announcement = { level: "assertive", code: "authority_incompatible" };
        clearAuthorizedRows(next);
        return normalize(next, now);
      }
      if (sequence !== null && sequence < current.sequence) {
        // An older snapshot than one already applied is evidence of a gap, not
        // a reason to downgrade what the newer one established.
        next.authority = "stale";
        next.readOnlyReason = "authority_sequence_gap";
        next.announcement = { level: "assertive", code: "authority_sequence_gap" };
        clearAuthorizedRows(next);
        return normalize(next, now);
      }
      const lifetime = toSeconds(snapshot.expires_in);
      next.authority = "current";
      next.policyVersion = policyVersion;
      next.policyCompatible = true;
      next.role = toRole(snapshot.role);
      next.capabilities = toCapabilities(snapshot.capabilities);
      next.accessRevision = toRevision(snapshot.access_revision);
      next.generation = toRevision(snapshot.generation);
      next.sequence = sequence ?? current.sequence;
      next.snapshotAt = now;
      next.snapshotExpiresAt = lifetime === null ? null : now + lifetime;
      next.snapshotRefreshAt = lifetime === null ? null : now + lifetime * SNAPSHOT_REFRESH_AT;
      next.readOnlyReason = next.role === null ? "role_missing" : null;
      next.error = null;
      next.announcement = { level: "polite", code: "authority_current" };
      if (next.role === null) next.capabilities = [];
      return normalize(next, now);
    }

    case "lease/acquired":
    case "lease/renewed": {
      const lease = action.lease ?? {};
      const ttl = toSeconds(lease.expires_in);
      if (ttl === null) {
        next.error = { code: "invalid_input" };
        return normalize(next, now);
      }
      next.lease = {
        state: "held-self",
        holder: "this-session",
        purpose: lease.purpose === "administration" ? "administration" : "engineering",
        acquiredAt: now,
        ttlSeconds: ttl,
        expiresAt: now + ttl,
        autoRenewAt: now + ttl * (1 - DIRTY_AUTO_RENEW_AT),
        promptRenewAt: now + ttl * (1 - MANUAL_RENEW_PROMPT_AT),
      };
      next.readOnlyReason = current.authority === "current" && next.role !== null ? null : current.readOnlyReason;
      next.error = null;
      next.announcement = { level: "polite", code: type === "lease/acquired" ? "lease_acquired" : "lease_renewed" };
      return normalize(next, now);
    }

    case "lease/released": {
      next.lease = null;
      next.announcement = { level: "polite", code: "lease_released" };
      return normalize(next, now);
    }

    case "lease/held-elsewhere": {
      // Deliberately anonymous: who holds it is not the asking user's business.
      next.lease = { state: "held-other", holder: "another-session", purpose: "engineering" };
      next.error = { code: "lease_held" };
      next.announcement = { level: "polite", code: "lease_held" };
      return normalize(next, now);
    }

    case "revision/observed": {
      next.revision = toRevision(action.revision) ?? next.revision;
      return normalize(next, now);
    }

    case "candidate/changed": {
      next.candidate = { dirty: Boolean(action.dirty), preserved: false };
      next.expectedRevision = toRevision(action.expectedRevision) ?? next.revision;
      return normalize(next, now);
    }

    case "candidate/discarded": {
      next.candidate = { dirty: false, preserved: false };
      next.expectedRevision = null;
      return normalize(next, now);
    }

    case "projects/listed": {
      // The server returned exactly the projects this user may see. The browser
      // adds nothing, counts nothing else, and shows no redacted placeholder.
      next.projects = Array.isArray(action.projects)
        ? action.projects
            .filter((entry) => entry && typeof entry.id === "string")
            .map((entry) => ({ id: entry.id, revision: toRevision(entry.revision) }))
        : [];
      return normalize(next, now);
    }

    case "evidence/page":
    case "telemetry/page": {
      const key = type === "evidence/page" ? "evidence" : "telemetry";
      const trusted = key === "evidence";
      next[key] = {
        rows: [
          ...(action.append ? current[key].rows : []),
          ...(Array.isArray(action.rows) ? action.rows.map((row) => ({ ...row, trusted })) : []),
        ],
        cursor: typeof action.cursor === "string" ? action.cursor : null,
        hasMore: Boolean(action.hasMore),
        stale: false,
        error: null,
      };
      return normalize(next, now);
    }

    case "evidence/page-failed":
    case "telemetry/page-failed": {
      const key = type === "evidence/page-failed" ? "evidence" : "telemetry";
      // Rows already on screen stay, marked stale: silently dropping them would
      // hide history the user was authorized to see.
      next[key] = { ...current[key], stale: true, error: { code: toCode(action.code) } };
      next.announcement = { level: "polite", code: "evidence_page_failed" };
      return normalize(next, now);
    }

    case "error/denied": {
      const code = toCode(action.code);
      next.error = { code };
      if (code === "revision_conflict") {
        next.revision = toRevision(action.currentRevision) ?? next.revision;
        next.candidate = { ...next.candidate, preserved: true };
      }
      if (code === "authority_stale" || code === "not_loaded") {
        next.authority = code === "not_loaded" ? "unavailable" : "stale";
        next.readOnlyReason = code === "not_loaded" ? "companion_disconnected" : "authority_stale";
      }
      if (code === "lease_expired" || code === "lease_required") {
        next.lease = null;
        next.readOnlyReason = "lease_expired";
      }
      next.announcement = { level: "assertive", code };
      return normalize(next, now);
    }

    case "clock/tick":
      return normalize(next, now);

    default:
      return current;
  }
}

/** Fold a sequence of authority actions in order, for a batch of server events. */
export function reduceProjectAuthority(state, actions) {
  let current = state ?? initialAuthorityState();
  for (const action of actions ?? []) current = authorityReducer(current, action);
  return current;
}

/**
 * Whether a shared mutation may currently be *offered*.
 *
 * The server decides again on every request; this only decides what to show.
 * It is deliberately a conjunction of the whole authority chain, so adding a
 * new loss event cannot accidentally leave an affordance enabled.
 */
export function sharedWritable(state) {
  if (!state || state.mode !== "shared") return false;
  if (state.authority !== "current") return false;
  if (state.readOnlyReason) return false;
  if (!state.policyCompatible) return false;
  if (!state.role) return false;
  if (!state.capabilities.includes("project.write")) return false;
  const lease = state.lease;
  return Boolean(lease && lease.state === "held-self" && lease.purpose === "engineering");
}

/** Whether the browser holds an administration lease for an access change. */
export function accessWritable(state) {
  if (!state || state.mode !== "shared") return false;
  if (state.authority !== "current" || state.readOnlyReason) return false;
  if (!state.capabilities.includes("project.access.write")) return false;
  return Boolean(state.lease && state.lease.state === "held-self" && state.lease.purpose === "administration");
}

/**
 * What the UI may render as available, with the safe reason for anything that
 * is not. An affordance whose mere presence would reveal authority is absent
 * from this map rather than present and disabled.
 */
export function authorityAffordances(state) {
  const current = state ?? initialAuthorityState();
  const may = (capability) => current.authority === "current"
    && !current.readOnlyReason
    && current.capabilities.includes(capability);
  const writable = sharedWritable(current);
  const holdsLease = current.lease?.state === "held-self";
  return {
    readOnly: !writable,
    readOnlyReason: writable ? null : (current.readOnlyReason ?? "lease_required"),
    canReadProject: may("project.read"),
    canReadEvidence: may("evidence.read"),
    canWriteTelemetry: may("evidence.telemetry.write"),
    canExecuteControl: may("control.execute"),
    canAcquireLease: may("lease.engineering") && !holdsLease && current.lease?.state !== "held-other",
    canRenewLease: holdsLease,
    canReleaseLease: holdsLease,
    canApply: writable,
    canManageAccess: may("project.access.write"),
    canReadAccess: may("project.access.read"),
  };
}

/**
 * Whether and why the held lease should be renewed now.
 *
 * The prompt comes first; automatic renewal is the later fallback that only a
 * dirty candidate earns. Returning a decision rather than performing one keeps
 * the policy testable without a timer.
 */
export function leaseRenewal(state, now) {
  const lease = state?.lease;
  if (!lease || lease.state !== "held-self") return "none";
  const moment = Number.isFinite(now) ? now : state.observedAt;
  if (moment >= lease.expiresAt) return "expired";
  if (state.candidate?.dirty && moment >= lease.autoRenewAt) return "auto-renew";
  if (moment >= lease.promptRenewAt) return "prompt";
  return "idle";
}

/** Whether the capability snapshot is due for a refresh. */
export function snapshotDue(state, now) {
  if (!state || state.snapshotRefreshAt === null) return state?.authority !== "current";
  const moment = Number.isFinite(now) ? now : state.observedAt;
  return moment >= state.snapshotRefreshAt;
}

/**
 * Reduce any thrown Companion failure to one stable code.
 *
 * The raw message never reaches state: it can carry a project name, a user, or
 * a stack, and an unknown project must be indistinguishable from a denied one.
 */
export function authorityError(error) {
  return { code: toCode(error?.code) };
}

/**
 * Adapter over the Home Assistant WebSocket connection.
 *
 * It calls `hass.callWS` and `hass.connection.subscribeMessage` and nothing
 * else. There is no `callService`, no storage, no direct target, and no
 * fallback path: if the Companion cannot answer, shared mode goes read-only.
 */
export function createProjectAuthorityClient(options = {}) {
  const hass = options.hass ?? null;
  const projectId = options.projectId ?? null;
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
  const clock = typeof options.clock === "function" ? options.clock : () => Date.now() / 1000;
  let state = initialAuthorityState({ mode: options.mode });
  let unsubscribe = null;
  // Held in a closure and never written to state, so it cannot be serialized,
  // exported, logged, or rendered.
  let bearer = null;

  const dispatch = (action) => {
    state = authorityReducer(state, { now: clock(), ...action });
    onChange(state);
    return state;
  };

  const call = async (type, payload = {}) => {
    if (!hass?.callWS) {
      dispatch({ type: "companion/disconnected" });
      throw Object.assign(new Error("not_loaded"), { code: "not_loaded" });
    }
    try {
      return await hass.callWS({ type, project_id: projectId, ...payload });
    } catch (error) {
      const { code } = authorityError(error);
      dispatch({ type: "error/denied", code, currentRevision: error?.current_revision });
      throw Object.assign(new Error(code), { code });
    }
  };

  return {
    get state() {
      return state;
    },

    /** Fetch and apply the server capability snapshot. */
    async refresh() {
      dispatch({ type: "authority/loading" });
      const snapshot = await call("glt_flow_card/capabilities/get");
      return dispatch({ type: "authority/snapshot", snapshot });
    },

    /** Subscribe to server-pushed access changes; a gap forces a refresh. */
    async watch() {
      if (!hass?.connection?.subscribeMessage) return null;
      unsubscribe = await hass.connection.subscribeMessage(
        (event) => {
          if (event?.type === "access_revoked") dispatch({ type: "role/revoked" });
          else if (event?.type === "sequence_gap") dispatch({ type: "authority/sequence-gap" });
          else if (Number.isInteger(event?.sequence) && event.sequence !== state.sequence + 1) {
            dispatch({ type: "authority/sequence-gap" });
          }
        },
        { type: "glt_flow_card/access/subscribe", project_id: projectId },
      );
      return unsubscribe;
    },

    async acquireLease(purpose = "engineering", ttlSeconds = 300) {
      const lease = await call("glt_flow_card/leases/acquire", {
        purpose,
        ttl_seconds: ttlSeconds,
      });
      bearer = lease?.lease_token ?? null;
      // Only the two non-secret fields are handed to the reducer, so the bearer
      // cannot reach state through a spread that grows a field later.
      return dispatch({
        type: "lease/acquired",
        lease: { expires_in: lease?.expires_in, purpose: lease?.purpose },
      });
    },

    async renewLease(ttlSeconds = 300) {
      const lease = await call("glt_flow_card/leases/renew", {
        lease_token: bearer,
        ttl_seconds: ttlSeconds,
      });
      bearer = lease?.lease_token ?? bearer;
      return dispatch({
        type: "lease/renewed",
        lease: { expires_in: lease?.expires_in, purpose: lease?.purpose ?? state.lease?.purpose },
      });
    },

    async releaseLease() {
      try {
        await call("glt_flow_card/leases/release", { lease_token: bearer });
      } finally {
        bearer = null;
      }
      return dispatch({ type: "lease/released" });
    },

    /** Apply a candidate. The bearer travels in the request and nowhere else. */
    async apply(candidate, expectedRevision) {
      const result = await call("glt_flow_card/projects/apply", {
        lease_token: bearer,
        expected_revision: expectedRevision,
        candidate,
      });
      dispatch({ type: "revision/observed", revision: result?.revision });
      return dispatch({ type: "candidate/discarded" });
    },

    /** Load one evidence page through the server's opaque cursor. */
    async evidencePage({ cursor = null, append = false } = {}) {
      try {
        const page = await call("glt_flow_card/evidence/list", cursor ? { cursor } : {});
        return dispatch({
          type: "evidence/page",
          rows: page?.rows ?? [],
          cursor: page?.cursor ?? null,
          hasMore: Boolean(page?.has_more),
          append,
        });
      } catch (error) {
        return dispatch({ type: "evidence/page-failed", code: error?.code });
      }
    },

    async telemetryPage({ cursor = null, append = false } = {}) {
      try {
        const page = await call("glt_flow_card/telemetry/list", cursor ? { cursor } : {});
        return dispatch({
          type: "telemetry/page",
          rows: page?.rows ?? [],
          cursor: page?.cursor ?? null,
          hasMore: Boolean(page?.has_more),
          append,
        });
      } catch (error) {
        return dispatch({ type: "telemetry/page-failed", code: error?.code });
      }
    },

    /** Release every browser-held resource; the bearer dies with the client. */
    destroy() {
      bearer = null;
      if (typeof unsubscribe === "function") unsubscribe();
      unsubscribe = null;
      dispatch({ type: "companion/disconnected" });
    },
  };
}
