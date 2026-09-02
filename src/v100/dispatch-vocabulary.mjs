/**
 * Three closed vocabularies, mirrored from the Companion.
 *
 * Phase 6 shipped four independent alarm-severity vocabularies, and an alarm
 * created in the editor as `critical` was counted in none of them. The lesson
 * was not "be careful" — it was that a word shared between parts of a product
 * needs one declaration and a test that compares the copies.
 *
 * Mirrored rather than generated, so a change on one side has to be made on the
 * other, and `test/dispatch-vocabulary.test.mjs` catches the moment it is not.
 *
 * The browser holds these to *render* a decision the Companion made. It never
 * decides a dispatch itself: a browser that decided would be deciding from a
 * snapshot that can be minutes old, and the snapshot in question is whether the
 * plant may be moved.
 */

/** Every path through which an effect can leave the integration. */
export const DISPATCH_KINDS = Object.freeze([
  "control", "remote_control", "schedule_service",
  "notification", "audit", "report_delivery",
]);

/** What a dispatch decision can answer. */
export const DISPATCH_OUTCOMES = Object.freeze(["dispatch", "simulated", "refused"]);

/**
 * How each kind behaves while a simulation session is active.
 *
 * The split between refuse and mark is a safety decision in both directions.
 * Refusing a notification would make a rehearsal a window in which nobody is
 * told about a real fault. Marking a control would move plant.
 */
export const SIMULATION_BEHAVIOUR = Object.freeze({
  control: "refuse",
  remote_control: "refuse",
  schedule_service: "refuse",
  notification: "mark",
  report_delivery: "mark",
  audit: "allow",
});

/** Derived, not written twice, so the two cannot drift apart. */
export const PHYSICAL_KINDS = Object.freeze(
  DISPATCH_KINDS.filter((kind) => SIMULATION_BEHAVIOUR[kind] === "refuse"),
);

/** Why a dispatch was not performed. Each distinct because each needs a different response. */
export const DISPATCH_REASONS = Object.freeze([
  "simulation_active",
  "simulation_state_unavailable",
  "unknown_dispatch_kind",
]);

/** What a commissioning check can conclude about one reference. */
export const DIAGNOSES = Object.freeze([
  "present", "registered_not_loaded", "unregistered", "missing",
  "wrong_unit", "wrong_device_class", "duplicate_binding", "stale", "service_missing",
]);

/** Diagnoses that are not faults. `unregistered` is a normal way to run Home Assistant. */
export const INFORMATIONAL_DIAGNOSES = Object.freeze(["present", "unregistered"]);

/** The states a work order can be in. */
export const WORK_ORDER_STATES = Object.freeze([
  "open", "assigned", "in_progress", "blocked", "completed", "cancelled",
]);

/** The transitions that exist. `cancelled` is terminal. */
export const WORK_ORDER_TRANSITIONS = Object.freeze({
  open: Object.freeze(["assigned", "in_progress", "cancelled"]),
  assigned: Object.freeze(["in_progress", "open", "cancelled"]),
  in_progress: Object.freeze(["blocked", "completed", "cancelled"]),
  blocked: Object.freeze(["in_progress", "cancelled"]),
  completed: Object.freeze(["open"]),
  cancelled: Object.freeze([]),
});

/**
 * Transitions that must carry a reason, as `from -> to` pairs.
 *
 * Keyed on the pair rather than the target, because the same destination means
 * different things depending on where it came from: `assigned -> open` is
 * handing a job back, `completed -> open` is saying the work was not in fact
 * done. Only the second must justify itself.
 */
export const TRANSITIONS_REQUIRING_REASON = Object.freeze([
  ["completed", "open"],
  ["open", "cancelled"],
  ["assigned", "cancelled"],
  ["in_progress", "cancelled"],
  ["blocked", "cancelled"],
  ["in_progress", "blocked"],
]);

const membership = (members) => (value) => typeof value === "string" && members.includes(value);

export const isDispatchKind = membership(DISPATCH_KINDS);
export const isDispatchOutcome = membership(DISPATCH_OUTCOMES);
export const isDiagnosis = membership(DIAGNOSES);
export const isWorkOrderState = membership(WORK_ORDER_STATES);

/**
 * Return how a kind behaves during simulation, or refuse.
 *
 * Refuses an unknown kind rather than defaulting. A default of `allow` would
 * let a new dispatch path move plant during a rehearsal; a default of `refuse`
 * would look safe while silently disabling a path nobody meant to disable.
 * Neither is a decision this function is entitled to make.
 */
export function behaviourFor(kind) {
  if (!DISPATCH_KINDS.includes(kind)) {
    throw new Error(`unknown_dispatch_kind: ${JSON.stringify(kind)}`);
  }
  return SIMULATION_BEHAVIOUR[kind];
}

/** Return whether one work-order transition exists. */
export function transitionAllowed(current, target) {
  return (WORK_ORDER_TRANSITIONS[current] ?? []).includes(target);
}

/** Return whether this transition must carry a stated reason. */
export function transitionNeedsReason(current, target) {
  return TRANSITIONS_REQUIRING_REASON.some(([from, to]) => from === current && to === target);
}

/**
 * Return the canonical bytes both runtimes must agree on.
 *
 * Deep-sorted, because `JSON.stringify` preserves insertion order while
 * Python's `sort_keys=True` sorts every level. Comparing values and bytes later
 * is how this codebase lost three cycles.
 */
export function canonicalVocabulary() {
  const sortDeep = (value) => {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]),
      );
    }
    return value;
  };
  return JSON.stringify(sortDeep(vocabularyFingerprint()));
}

/** The bytes both runtimes must agree on. */
export function vocabularyFingerprint() {
  return {
    diagnoses: [...DIAGNOSES],
    dispatch_kinds: [...DISPATCH_KINDS],
    dispatch_outcomes: [...DISPATCH_OUTCOMES],
    dispatch_reasons: [...DISPATCH_REASONS],
    informational_diagnoses: [...INFORMATIONAL_DIAGNOSES],
    physical_kinds: [...PHYSICAL_KINDS],
    simulation_behaviour: { ...SIMULATION_BEHAVIOUR },
    transitions_requiring_reason: TRANSITIONS_REQUIRING_REASON.map((pair) => [...pair]),
    work_order_states: [...WORK_ORDER_STATES],
    work_order_transitions: Object.fromEntries(
      Object.entries(WORK_ORDER_TRANSITIONS).map(([k, v]) => [k, [...v]]),
    ),
  };
}
