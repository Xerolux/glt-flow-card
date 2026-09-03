/**
 * Honest gap detection and resync (T4-09).
 *
 * The server stamps every emission with a monotonic sequence and returns a
 * snapshot with the sequence it was read at. This holds the other end: the next
 * sequence it expects. Anything else is a gap.
 *
 * Nothing is interpolated across a gap. A number nobody observed is not a
 * number, and drawing one is the failure this whole mechanism exists to avoid.
 * The view goes stale in one transition -- there is no intermediate render
 * where the old data is still interactive -- and says so, with the age of what
 * it is still showing.
 */

/** Every way a view can lose track. Closed. */
export const LOSS_REASONS = Object.freeze([
  "sequence-gap", "reconnect", "revocation", "incompatible-snapshot",
]);

/** The statuses a view reports. `unavailable` is authority loss, not staleness. */
export const VIEW_STATUSES = Object.freeze(["live", "resyncing", "stale", "unavailable"]);

export function createViewSync({ now = () => Date.now() } = {}) {
  let status = "stale";
  let reason = null;
  let expected = null;
  let values = null;
  let observedAt = null;
  let retained = null;
  const listeners = new Set();

  function emit() {
    const snapshot = current();
    for (const listener of listeners) listener(snapshot);
  }

  function current() {
    return {
      status,
      reason,
      values,
      observedAt,
      retained,
      expectedSequence: expected,
      // Nothing is interactive unless the view is live. A stale view that still
      // accepted a command would be acting on numbers it has told the operator
      // not to trust.
      interactive: status === "live",
    };
  }

  function lose(nextReason) {
    if (!LOSS_REASONS.includes(nextReason)) {
      throw new Error(`unknown loss reason: ${nextReason}`);
    }
    // One transition. The previous values stay on screen, but they keep their
    // own observedAt and the view is no longer interactive, so they read as
    // what they are: the last thing anybody actually saw.
    status = "stale";
    reason = nextReason;
    expected = null;
    emit();
  }

  return {
    snapshot({ sequence, values: body }) {
      values = body ?? null;
      observedAt = now();
      expected = Number.isInteger(sequence) ? sequence + 1 : null;
      status = "live";
      reason = null;
      emit();
      return current();
    },

    event({ sequence, values: body }) {
      if (status !== "live") return current();
      if (expected !== null && sequence !== expected) {
        // The skipped values are not adopted. Taking them would silently paper
        // over however many events went missing in between.
        lose("sequence-gap");
        return current();
      }
      values = body ?? values;
      observedAt = now();
      expected = sequence + 1;
      emit();
      return current();
    },

    /** Report a loss the transport noticed rather than the sequence. */
    lost(nextReason) {
      lose(nextReason);
      return current();
    },

    /** Mark a snapshot request in flight. */
    resyncing() {
      if (status === "stale") {
        status = "resyncing";
        emit();
      }
      return current();
    },

    /**
     * A refused resync leaves the view stale rather than escalating. Staying
     * visibly stale is the honest failure, and a bounded one.
     */
    resyncRefused(code) {
      status = "stale";
      reason = reason ?? code ?? "resync-refused";
      emit();
      return current();
    },

    /** Authority loss, from the Phase-2 reducer's reason set. */
    unavailable(readOnlyReason) {
      status = "unavailable";
      reason = readOnlyReason ?? null;
      expected = null;
      emit();
      return current();
    },

    /**
     * Hold operator input across a resync, per the Phase-2 candidate rule: a
     * user who typed a setpoint and hit a reconnect must not lose it.
     */
    retain(input) {
      retained = input ? { ...input } : null;
      emit();
      return current();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    state() {
      return current();
    },
  };
}
