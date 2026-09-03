/**
 * The closed alarm vocabularies, and the migration from the four that disagree.
 *
 * Phase 6's source audit found four independent severity vocabularies in the
 * product, none of them declared:
 *
 *   - the shipped editor writes `critical | warning | info`
 *     (`glt-flow-card.base.js`, labelled Störung / Warnung / Hinweis);
 *   - `navigation.py` counts `("fault", "warning")`;
 *   - `project-operations.js` branches on `"fault"`;
 *   - `alarm_transition` defaults to `"warning"`.
 *
 * So an alarm an engineer marked `critical` is counted in no roll-up anywhere.
 * That is a bug, not a preference, and one closed vocabulary is the whole fix.
 *
 * **The invariant, and what it is not.** The defect was four components
 * disagreeing about what a word means. The fix is that there is exactly *one*
 * declared vocabulary and both runtimes read it. That says nothing about how
 * many members it has, and Phase 6 conflated the two: it argued the set must not
 * be configurable because "a configurable vocabulary would make the four
 * disagreeing sets five". That is only true of a vocabulary each component
 * decides for itself. A scale declared **once, in the project, and resolved from
 * that one place by both runtimes** is still one vocabulary — it is simply one
 * the site chose.
 *
 * **So a site declares its own scale** (2026-09-03). Plants genuinely differ:
 * three tiers is right for a small heating plant and wrong for one with a
 * separate safety-shutdown class above its faults, and a site that needs four
 * was previously told to record two different things under one word.
 *
 * What stays fixed is everything that made three work: the scale is ordered and
 * rank is position; it is declared in one place and mirrored byte-for-byte by
 * `custom_components/glt_flow_card/alarm_vocabulary.py`; every stored severity
 * maps to a declared member and a project naming an undeclared priority is
 * refused rather than silently re-tiered; and the default is unchanged, so a
 * site that declares nothing behaves exactly as before.
 *
 * **`critical` and `fault` remain one tier in the default scale.** They are the
 * same tier under two names in the data that exists: the editor's `critical` is
 * labelled Störung, `navigation.py` treats `fault` as its top counted severity,
 * and `project-operations.js` renders `fault` with the severe mark. Inventing a
 * distinction there would still re-tier stored projects. A site that genuinely
 * runs both declares both, and then says which stored strings mean which.
 */

/**
 * The default scale, ordered from most to least severe. Order is a fact here.
 *
 * A site that declares nothing gets exactly this, so every project written
 * before scales existed behaves as it always did.
 */
export const ALARM_PRIORITIES = Object.freeze(["critical", "warning", "info"]);

/**
 * How many tiers a site may declare.
 *
 * Two is the floor because a one-member scale cannot express severity at all.
 * Six is the ceiling because a scale an operator cannot hold in their head at
 * three in the morning is not a scale; ISA-18.2 puts the practical number at
 * three or four and this leaves room either side rather than legislating.
 */
export const MIN_PRIORITY_TIERS = 2;
export const MAX_PRIORITY_TIERS = 6;

/** A tier name a person types and a machine stores. */
const IDENTIFIER = /^[a-z][a-z0-9_]{0,31}$/u;

/** Lifecycle states an alarm can be in. */
export const ALARM_STATES = Object.freeze([
  "active",
  "returned",
  "acknowledged",
  "indeterminate",
]);

/**
 * Why an alarm did not annunciate.
 *
 * A suppressed decision must be able to say which suppression applied. "Quiet"
 * without a reason is exactly the defect shelving shipped: a field that
 * reported success and did nothing.
 */
export const SUPPRESSION_REASONS = Object.freeze([
  "shelved",
  "maintenance",
  "acknowledged",
]);

/** What happened to one notification attempt. */
export const NOTIFICATION_OUTCOMES = Object.freeze([
  "delivered",
  "failed",
  "timeout",
  "refused",
  "no_target_configured",
]);

/** The kinds of escalation stage a policy may declare. */
export const ESCALATION_STAGE_KINDS = Object.freeze(["immediate", "delayed", "repeat"]);

/**
 * How a schedule entry binds to Home Assistant.
 *
 * `operating_period` is an *interval* (a `schedule.*` entity, from/to per
 * weekday); the rest are dated. The distinction is load-bearing and is never
 * converted away: an HA schedule says the plant is in day mode between these
 * hours, and our runner says call this service at this minute.
 */
export const SCHEDULE_BINDING_KINDS = Object.freeze([
  "operating_period",
  "holiday",
  "exception",
  "vacation",
  "special_day",
]);

/**
 * Every stored severity string the four sources produce, mapped to one member.
 *
 * Data, not a branch: the same table is read by the Python mirror, so the two
 * runtimes cannot drift into disagreeing about a migration.
 */
export const SEVERITY_MIGRATION = Object.freeze({
  critical: "critical",
  fault: "critical",
  error: "critical",
  alarm: "critical",
  warning: "warning",
  warn: "warning",
  info: "info",
  information: "info",
  hint: "info",
  notice: "info",
});

/** The answer for a stored string nobody declared. */
export const UNKNOWN_SEVERITY_FALLBACK = ALARM_PRIORITIES[0];

/** A declared priority scale was refused, before anything used it. */
export class AlarmScaleRejected extends Error {
  constructor(code, detail = {}) {
    super(code);
    this.name = "AlarmScaleRejected";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Return the priority scale one project runs on, and how to read its data.
 *
 * Resolved from **site options**, not from a project document, for the reason
 * `notify_allowlist` is: a project document is operator input, and one project
 * must not be able to change how another project's alarms are tiered.
 *
 * A site that declares nothing resolves to the default, so this is
 * backwards-compatible by construction rather than by a migration.
 */
export function resolvePriorityScale(settings) {
  const options = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings
    : {};
  const declared = options.alarm_priorities;

  if (declared === undefined || declared === null) {
    return {
      priorities: Object.freeze([...ALARM_PRIORITIES]),
      migration: Object.freeze({ ...SEVERITY_MIGRATION }),
      fallback: UNKNOWN_SEVERITY_FALLBACK,
      declared: false,
    };
  }

  if (!Array.isArray(declared) || declared.length === 0) {
    throw new AlarmScaleRejected("priorities_not_a_list");
  }
  if (declared.length < MIN_PRIORITY_TIERS || declared.length > MAX_PRIORITY_TIERS) {
    throw new AlarmScaleRejected("priority_count_out_of_range", {
      declared: declared.length, min: MIN_PRIORITY_TIERS, max: MAX_PRIORITY_TIERS,
    });
  }

  const priorities = [];
  for (const entry of declared) {
    if (typeof entry !== "string" || !IDENTIFIER.test(entry)) {
      throw new AlarmScaleRejected("priority_not_an_identifier", { entry });
    }
    if (priorities.includes(entry)) {
      throw new AlarmScaleRejected("priority_declared_twice", { entry });
    }
    priorities.push(entry);
  }

  // Where stored strings land. A site that renames its tiers must say what its
  // existing data means, or the rename silently re-tiers every stored alarm —
  // the failure the closed vocabulary was built to prevent, and it does not stop
  // being that failure because the site asked for it.
  const migration = {};
  const mappingDeclared = options.alarm_severity_mapping;
  if (mappingDeclared !== undefined && mappingDeclared !== null) {
    if (typeof mappingDeclared !== "object" || Array.isArray(mappingDeclared)) {
      throw new AlarmScaleRejected("severity_mapping_not_an_object");
    }
    for (const [stored, target] of Object.entries(mappingDeclared)) {
      if (typeof stored !== "string" || stored.trim() === "") {
        throw new AlarmScaleRejected("severity_mapping_key_empty", { stored });
      }
      if (!priorities.includes(target)) {
        throw new AlarmScaleRejected("severity_mapping_target_undeclared", {
          stored, target, declared: [...priorities],
        });
      }
      migration[stored.trim().toLowerCase()] = target;
    }
  }

  // The default mapping carries forward for every tier the site kept, so a site
  // adding one class above `critical` need not restate that `fault` still means
  // `critical`.
  for (const [stored, target] of Object.entries(SEVERITY_MIGRATION)) {
    if (!Object.prototype.hasOwnProperty.call(migration, stored) && priorities.includes(target)) {
      migration[stored] = target;
    }
  }
  for (const priority of priorities) {
    if (!Object.prototype.hasOwnProperty.call(migration, priority)) migration[priority] = priority;
  }

  const fallbackDeclared = options.alarm_unknown_severity;
  let fallback;
  if (fallbackDeclared === undefined || fallbackDeclared === null) {
    fallback = priorities[0];
  } else if (priorities.includes(fallbackDeclared)) {
    fallback = fallbackDeclared;
  } else {
    throw new AlarmScaleRejected("unknown_severity_undeclared", {
      declared: [...priorities], fallback: fallbackDeclared,
    });
  }

  return {
    priorities: Object.freeze(priorities),
    migration: Object.freeze(migration),
    fallback,
    declared: true,
  };
}

/** The ordered tiers of a resolved scale, or the default. */
function prioritiesOf(scale) {
  if (scale === undefined || scale === null) return ALARM_PRIORITIES;
  if (Array.isArray(scale)) return scale;
  return scale.priorities ?? ALARM_PRIORITIES;
}

function frozenMembership(members) {
  const set = new Set(members);
  return (value) => set.has(value);
}

export const isPriority = frozenMembership(ALARM_PRIORITIES);
export const isAlarmState = frozenMembership(ALARM_STATES);
export const isSuppressionReason = frozenMembership(SUPPRESSION_REASONS);
export const isNotificationOutcome = frozenMembership(NOTIFICATION_OUTCOMES);
export const isEscalationStageKind = frozenMembership(ESCALATION_STAGE_KINDS);
export const isScheduleBindingKind = frozenMembership(SCHEDULE_BINDING_KINDS);

/**
 * Return how severe a priority is, lower being more severe.
 *
 * Throws for an unknown member rather than returning a sentinel, because a
 * comparison against a sentinel silently orders an unknown priority somewhere.
 */
export function priorityRank(priority, scale) {
  const priorities = prioritiesOf(scale);
  const rank = priorities.indexOf(priority);
  if (rank < 0) {
    throw new RangeError(
      `unknown alarm priority: ${String(priority)} (declared: ${[...priorities].join(", ")})`,
    );
  }
  return rank;
}

/** Return whether `a` is at least as severe as `b`. */
export function atLeastAsSevere(a, b, scale) {
  return priorityRank(a, scale) <= priorityRank(b, scale);
}

/**
 * Map one stored severity string to a declared priority.
 *
 * An unrecognised string maps to the *most severe* interpretation and is
 * reported. A site whose alarm was already miscounted must not have it
 * miscounted quieter: the failure mode of guessing low is an unnoticed
 * shutdown, and of guessing high is an annoyed operator.
 */
export function migrateSeverity(stored, scale) {
  const resolved = scale && typeof scale === "object" && !Array.isArray(scale) ? scale : null;
  const migration = resolved?.migration ?? SEVERITY_MIGRATION;
  const fallback = resolved?.fallback ?? UNKNOWN_SEVERITY_FALLBACK;
  const raw = String(stored ?? "").trim().toLowerCase();
  if (raw === "") {
    return { priority: fallback, recognised: false, stored: stored ?? null };
  }
  const mapped = Object.prototype.hasOwnProperty.call(migration, raw) ? migration[raw] : null;
  if (mapped === null) {
    return { priority: fallback, recognised: false, stored };
  }
  return { priority: mapped, recognised: true, stored };
}

/**
 * Count alarms by declared priority.
 *
 * This is what the navigation roll-up and the panel badges call, so an alarm
 * authored as `critical` is counted by whatever counts criticals -- which is
 * the defect this module closes.
 */
export function countByPriority(alarms, scale) {
  const counts = Object.fromEntries([...prioritiesOf(scale)].map((priority) => [priority, 0]));
  const unrecognised = [];
  for (const alarm of alarms ?? []) {
    const result = migrateSeverity(alarm?.priority ?? alarm?.severity, scale);
    counts[result.priority] = (counts[result.priority] ?? 0) + 1;
    if (!result.recognised) unrecognised.push(result.stored);
  }
  return { counts, unrecognised };
}
