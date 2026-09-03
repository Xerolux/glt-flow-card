/* Shared editing without lost updates: one candidate, one lease, no overwrite.
 *
 * A candidate an engineer typed is theirs until they say otherwise. Lease
 * expiry, a disconnect, a conflict, a role change and a failed merge all keep
 * it in memory; only an authoritative committed receipt or an explicit discard
 * may clear it. There is no last-writer-wins path and no client-side patch
 * replay: a conflict is resolved by looking at the server's own preview and
 * choosing, never by the browser deciding whose work survives.
 *
 * There is no bearer anywhere in this module. The engineering lease lives in
 * the authority client's closure and is handed straight to the server on each
 * request, so collaboration state cannot leak a token it never receives.
 */

/**
 * Recovery choices offered on a conflict, in the order they are presented.
 *
 * `overwrite` and `force` are deliberately absent. A user who is shown an
 * overwrite button will eventually press it, and the whole point of an exact
 * expected revision is that nobody has to.
 */
export const CONFLICT_CHOICES = Object.freeze([
  "refresh",
  "merge-preview",
  "retry-with-fresh-lease",
  "discard",
]);

/** Events after which a dirty candidate must still be in memory. */
const CANDIDATE_PRESERVING = Object.freeze(new Set([
  "lease/expired",
  "lease/lost",
  "companion/disconnected",
  "conflict/detected",
  "role/revoked",
  "merge/failed",
  "merge/blocked-overlap",
  "authority/stale",
  "authority/rejected",
  "authority/incompatible",
  "authority/sequence-gap",
]));

/** Merge outcomes the server may report. `overwrite` is not one of them. */
export const MERGE_STATES = Object.freeze([
  "idle",
  "requested",
  "ready",
  "blocked",
  "failed",
  "applied",
]);

function revision(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/** The initial state: no lease, no candidate, no conflict. */
export function initialCollaborationState() {
  return {
    lease: null,
    candidate: null,
    revisions: { base: null, current: null, candidate: null },
    conflict: null,
    merge: { state: "idle", preview: null, selected: [], locked: [], reason: null },
    receipt: null,
    error: null,
    announcement: null,
  };
}

/**
 * Resolve the dependency closure of a merge selection.
 *
 * The closure comes from the server's preview, never from a client-side reading
 * of the diff: an operation is locked because the server said it is required,
 * so a browser that misunderstands the schema cannot drop a dependency.
 */
export function mergeClosure(preview, requested) {
  const selected = new Set();
  const locked = new Set();
  for (const id of requested ?? []) {
    const closure = preview?.closures?.[id];
    for (const operation of closure?.selected ?? [id]) {
      selected.add(operation);
      if (operation !== id) locked.add(operation);
    }
  }
  return { selected: [...selected].sort(), locked: [...locked].sort() };
}

/** The recovery choices available for the current conflict. */
export function conflictChoices(state) {
  if (!state?.conflict) return [];
  // A merge preview is only offered once the server has one to show.
  return CONFLICT_CHOICES.filter(
    (choice) => choice !== "merge-preview" || state.merge.preview !== null || state.merge.state === "ready",
  );
}

/**
 * Apply one collaboration action.
 *
 * Unknown actions return the state unchanged, so an unrecognized server event
 * can never clear work the user has not agreed to lose.
 */
export function collaborationReducer(state, action) {
  const current = state ?? initialCollaborationState();
  const type = String(action?.type ?? "");
  const next = {
    ...current,
    revisions: { ...current.revisions },
    merge: { ...current.merge },
  };

  if (CANDIDATE_PRESERVING.has(type)) {
    if (next.candidate) next.candidate = { ...next.candidate, preserved: true };
    if (type === "conflict/detected") {
      next.conflict = {
        code: "revision_conflict",
        base: revision(action.base) ?? current.revisions.base,
        current: revision(action.current),
      };
      next.revisions.current = revision(action.current) ?? next.revisions.current;
    }
    if (type === "merge/failed" || type === "merge/blocked-overlap") {
      next.merge = {
        ...next.merge,
        state: type === "merge/failed" ? "failed" : "blocked",
        reason: type === "merge/failed" ? (action.code ?? "effect_unknown") : "overlap",
      };
    }
    if (type === "lease/expired" || type === "lease/lost") next.lease = null;
    next.announcement = { level: "assertive", code: type.replace("/", "_").replace("-", "_") };
    return next;
  }

  switch (type) {
    case "candidate/changed": {
      const base = revision(action.baseRevision) ?? current.revisions.current;
      next.candidate = {
        project: action.candidate ?? null,
        dirty: true,
        preserved: false,
        baseRevision: base,
      };
      next.revisions.base = base;
      next.revisions.candidate = revision(action.candidate?.project?.revision) ?? base;
      next.error = null;
      return next;
    }

    case "candidate/discarded": {
      // The one place a candidate disappears without a receipt, and only ever
      // because a person chose it.
      next.candidate = null;
      next.conflict = null;
      next.merge = { state: "idle", preview: null, selected: [], locked: [], reason: null };
      next.revisions = { ...next.revisions, base: null, candidate: null };
      next.announcement = { level: "polite", code: "candidate_discarded" };
      return next;
    }

    case "commit/confirmed": {
      const receipt = action.receipt ?? {};
      next.candidate = null;
      next.conflict = null;
      next.merge = { state: "applied", preview: null, selected: [], locked: [], reason: null };
      next.receipt = { revision: revision(receipt.revision), digest: receipt.digest ?? null };
      next.revisions = {
        base: revision(receipt.revision),
        current: revision(receipt.revision),
        candidate: null,
      };
      next.error = null;
      next.announcement = { level: "polite", code: "commit_confirmed" };
      return next;
    }

    case "merge/requested": {
      next.merge = { ...next.merge, state: "requested", reason: null };
      return next;
    }

    case "merge/preview": {
      next.merge = {
        state: "ready",
        preview: action.preview ?? null,
        selected: [],
        locked: [],
        reason: null,
      };
      next.announcement = { level: "polite", code: "merge_ready" };
      return next;
    }

    case "merge/selected": {
      const { selected, locked } = mergeClosure(next.merge.preview, action.ids);
      next.merge = { ...next.merge, selected, locked };
      return next;
    }

    case "lease/acquired":
    case "lease/renewed": {
      const ttl = Number.isFinite(action.lease?.expires_in) ? Math.floor(action.lease.expires_in) : null;
      if (ttl === null || ttl <= 0) {
        next.error = { code: "invalid_input" };
        return next;
      }
      const now = Number.isFinite(action.now) ? action.now : 0;
      next.lease = { state: "held-self", purpose: "engineering", ttlSeconds: ttl, expiresAt: now + ttl };
      next.announcement = { level: "polite", code: type === "lease/acquired" ? "lease_acquired" : "lease_renewed" };
      return next;
    }

    case "lease/released": {
      next.lease = null;
      next.announcement = { level: "polite", code: "lease_released" };
      return next;
    }

    case "lease/held-elsewhere": {
      // Anonymous by contract: who is editing is membership information.
      next.lease = { state: "held-other", purpose: "engineering" };
      next.error = { code: "lease_held" };
      return next;
    }

    case "revision/observed": {
      next.revisions.current = revision(action.revision) ?? next.revisions.current;
      return next;
    }

    case "conflict/resolved": {
      next.conflict = null;
      return next;
    }

    case "error/denied": {
      next.error = { code: action.code ?? "effect_unknown" };
      if (next.candidate) next.candidate = { ...next.candidate, preserved: true };
      return next;
    }

    default:
      return current;
  }
}

/** Fold a sequence of collaboration actions in order. */
export function reduceCollaboration(state, actions) {
  let current = state ?? initialCollaborationState();
  for (const action of actions ?? []) current = collaborationReducer(current, action);
  return current;
}

/**
 * Drive one shared editing session.
 *
 * `client` is the authority client from `project-authority.mjs`. It owns the
 * lease bearer; this controller never receives one, which is a stronger
 * guarantee than storing it carefully would be.
 */
export function createCollaborationController(options = {}) {
  const client = options.client ?? null;
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
  const clock = typeof options.clock === "function" ? options.clock : () => Date.now() / 1000;
  let state = initialCollaborationState();

  const dispatch = (action) => {
    state = collaborationReducer(state, { now: clock(), ...action });
    onChange(state);
    return state;
  };

  const denial = (error) => {
    const code = error?.code ?? "effect_unknown";
    if (code === "lease_expired" || code === "lease_required") return dispatch({ type: "lease/expired" });
    if (code === "lease_held") return dispatch({ type: "lease/held-elsewhere" });
    if (code === "authority_stale") return dispatch({ type: "authority/stale" });
    if (code === "not_loaded") return dispatch({ type: "companion/disconnected" });
    return dispatch({ type: "error/denied", code });
  };

  return {
    get state() {
      return state;
    },

    setCandidate(candidate, baseRevision) {
      return dispatch({ type: "candidate/changed", candidate, baseRevision });
    },

    discard() {
      return dispatch({ type: "candidate/discarded" });
    },

    async acquire(ttlSeconds = 300) {
      try {
        const authority = await client.acquireLease("engineering", ttlSeconds);
        return dispatch({ type: "lease/acquired", lease: { expires_in: authority.lease?.ttlSeconds ?? ttlSeconds } });
      } catch (error) {
        return denial(error);
      }
    },

    async renew(ttlSeconds = 300) {
      try {
        await client.renewLease(ttlSeconds);
        return dispatch({ type: "lease/renewed", lease: { expires_in: ttlSeconds } });
      } catch (error) {
        return denial(error);
      }
    },

    async release() {
      try {
        await client.releaseLease();
        return dispatch({ type: "lease/released" });
      } catch (error) {
        return denial(error);
      }
    },

    /**
     * Apply the current candidate at its exact expected revision.
     *
     * A revision conflict is a normal outcome, not an error to retry: it means
     * somebody else committed, and the user decides what happens next.
     */
    async apply() {
      const candidate = state.candidate;
      if (!candidate) return state;
      try {
        const result = await client.apply(candidate.project, state.revisions.base);
        return dispatch({
          type: "commit/confirmed",
          receipt: { revision: result?.revision ?? null, digest: result?.digest ?? null },
        });
      } catch (error) {
        if (error?.code === "revision_conflict") {
          return dispatch({
            type: "conflict/detected",
            base: state.revisions.base,
            current: client.state?.revision ?? null,
          });
        }
        return denial(error);
      }
    },

    /** Ask the server for a merge preview; the browser computes no diff. */
    async previewMerge() {
      dispatch({ type: "merge/requested" });
      try {
        const preview = await client.mergePreview(state.candidate?.project, state.revisions.base);
        if (preview?.overlap?.length) {
          return dispatch({ type: "merge/blocked-overlap", paths: preview.overlap });
        }
        return dispatch({ type: "merge/preview", preview });
      } catch (error) {
        return dispatch({ type: "merge/failed", code: error?.code ?? "effect_unknown" });
      }
    },

    select(ids) {
      return dispatch({ type: "merge/selected", ids });
    },

    /** Choose one recovery path. There is no overwrite branch to choose. */
    recover(choice) {
      if (!CONFLICT_CHOICES.includes(choice)) return state;
      if (choice === "discard") return dispatch({ type: "candidate/discarded" });
      if (choice === "merge-preview") return this.previewMerge();
      if (choice === "retry-with-fresh-lease") return this.acquire();
      return client.refresh().then(
        (authority) => dispatch({ type: "revision/observed", revision: authority?.revision }),
        (error) => denial(error),
      );
    },
  };
}
