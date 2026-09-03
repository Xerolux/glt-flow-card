/**
 * What a site can be, and why it did not answer. Mirrored from the Companion.
 *
 * The browser holds these to *render* what the Companion decided. It never
 * decides a site's health itself: a browser deciding would be deciding from a
 * snapshot, and the question is whether a plant is currently being watched.
 */

/**
 * What a site can be.
 *
 * `unreachable` and `circuit_open` are the pair that matters. The first means
 * asked and did not answer; the second means **not asked**, because it has been
 * failing. Rendering them identically hides how long the problem has existed —
 * the difference between "check the network" and "that plant has been off since
 * Tuesday".
 */
export const SITE_STATES = Object.freeze(["healthy", "slow", "unreachable", "circuit_open"]);

/** Which site states count as an answer. */
export const ANSWERING_STATES = Object.freeze(["healthy", "slow"]);

/**
 * Why a remote read or call produced nothing.
 *
 * Closed, and that is the point: the Companion previously returned `str(err)`,
 * and connection errors carry the host and port they failed to reach.
 */
export const REMOTE_FAILURES = Object.freeze([
  "timeout",
  "connection_refused",
  "unauthorized",
  "malformed_response",
  "unreachable",
  "circuit_open",
  "deadline_reached",
  "not_permitted",
]);

/** The four command outcomes, reused from Phase 4 rather than redefined. */
export const REMOTE_OUTCOMES = Object.freeze([
  "accepted", "sent", "confirmed", "effect_unknown", "failed",
]);

/** Failures that mean the effect may nonetheless have happened. */
export const UNKNOWN_EFFECT_FAILURES = Object.freeze(["timeout", "deadline_reached"]);

export const isSiteState = (value) => typeof value === "string" && SITE_STATES.includes(value);
export const isRemoteFailure = (value) => typeof value === "string" && REMOTE_FAILURES.includes(value);

/** Return whether a site state counts as having answered. */
export function answered(state) {
  return ANSWERING_STATES.includes(state);
}

/**
 * Return the command outcome one failure reason implies.
 *
 * A timeout is `effect_unknown`, never `failed`. One home for the rule, because
 * written out at four call sites one of them eventually says `failed` — and a
 * retry offered after an unknown is how plant gets operated twice.
 */
export function outcomeForFailure(reason) {
  if (UNKNOWN_EFFECT_FAILURES.includes(reason)) return "effect_unknown";
  if (!REMOTE_FAILURES.includes(reason)) {
    throw new Error(`unknown_remote_failure: ${JSON.stringify(reason)}`);
  }
  return "failed";
}

export function vocabularyFingerprint() {
  return {
    answering_states: [...ANSWERING_STATES],
    remote_failures: [...REMOTE_FAILURES],
    remote_outcomes: [...REMOTE_OUTCOMES],
    site_states: [...SITE_STATES],
    unknown_effect_failures: [...UNKNOWN_EFFECT_FAILURES],
  };
}

/** Return the canonical bytes both runtimes must agree on. */
export function canonicalVocabulary() {
  const sortDeep = (value) => {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortDeep(value[k])]));
    }
    return value;
  };
  return JSON.stringify(sortDeep(vocabularyFingerprint()));
}
