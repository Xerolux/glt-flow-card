/**
 * Present Phase 2's nine control states as distinct operator outcomes (OPS-02).
 *
 * Phase 2 decided the hard part: only `readback_confirmed` is success.
 * `accepted` means the server wrote it down, `dispatched` means Home Assistant
 * was asked; neither means the plant moved, and calling either a success is the
 * exact lie that list exists to prevent.
 *
 * No state offers a retry. Phase 2 settled that there is no retry entry point:
 * repairing forward is a new, separately authorized command, and a retry button
 * next to "effect unknown" invites an operator to run a command twice on plant
 * that may already have moved.
 */
import { CONTROL_RESULT_STATES, CONTROL_UNKNOWN_STATES } from "./configured-control.mjs";

/** Affordance names. `audit` opens the trusted record; `state` the live value. */
export const AFFORDANCES = Object.freeze(["cancel", "dismiss", "state", "audit"]);

/**
 * Per state: the label key, the tone, and what the operator may do next.
 *
 * Every label is distinct, so no two states differ by styling alone -- the
 * kiosk layout must stay legible in forced colours, where tone carries nothing.
 */
const PRESENTATION = Object.freeze({
  accepted: {
    label: "outcome_accepted", tone: "neutral", affordances: ["cancel"],
  },
  dispatched: {
    label: "outcome_dispatched", tone: "neutral", affordances: [], elapsed: true,
  },
  readback_confirmed: {
    label: "outcome_confirmed", tone: "success", affordances: ["dismiss"],
  },
  timed_out: {
    label: "outcome_timed_out", tone: "warning", affordances: ["state", "audit"],
  },
  result_unknown: {
    label: "outcome_result_unknown", tone: "warning", affordances: ["state", "audit"],
  },
  failed_after_dispatch: {
    label: "outcome_failed_after_dispatch", tone: "warning", affordances: ["state", "audit"],
  },
  failed_before_dispatch: {
    label: "outcome_failed_before_dispatch", tone: "error", affordances: [],
  },
  cancelled_before_dispatch: {
    label: "outcome_cancelled", tone: "neutral", affordances: [],
  },
  denied: {
    label: "outcome_denied", tone: "error", affordances: [],
  },
});

// A state Phase 2 adds and this table forgets must fail loudly at import rather
// than render as nothing at runtime.
for (const state of CONTROL_RESULT_STATES) {
  if (!(state in PRESENTATION)) {
    throw new Error(`command-outcome has no presentation for ${state}`);
  }
}

/** Present one command outcome. Throws on a state nobody declared. */
export function presentOutcome({ state, correlation_id: correlationId, elapsedSeconds } = {}) {
  const presentation = PRESENTATION[state];
  if (!presentation) throw new Error(`unknown control result state: ${state}`);
  return {
    state,
    label: presentation.label,
    tone: presentation.tone,
    affordances: [...presentation.affordances],
    // Carried on every row so the exact-dist evidence can compare what is
    // displayed against the authoritative audit record for the same command.
    correlationId: correlationId ?? null,
    elapsedSeconds: presentation.elapsed ? (elapsedSeconds ?? null) : null,
    effectUnknown: CONTROL_UNKNOWN_STATES.includes(state),
  };
}

/** Whether this outcome may be rendered with success styling. Exactly one is. */
export function isSuccess(outcome) {
  return outcome?.tone === "success";
}
