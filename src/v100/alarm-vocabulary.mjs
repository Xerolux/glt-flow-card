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
 * **Why this one set is not configurable.** The rest of the Phase-6 alarm
 * philosophy is site configuration with conservative defaults, decided with the
 * user on 2026-09-02: shelving limits, escalation stages, targets, retention.
 * Sites legitimately differ on which classes they use and what they escalate,
 * and both of those remain configuration. They do not legitimately differ on
 * whether the editor's word and the roll-up's word are the same word, and a
 * configurable vocabulary would make the four disagreeing sets five.
 *
 * **Why three members and not four.** `critical` and `fault` are the same tier
 * under two names in the data that exists: the editor's `critical` is labelled
 * Störung, `navigation.py` treats `fault` as its top counted severity, and
 * `project-operations.js` renders `fault` with the severe mark and everything
 * else with the mild one. Declaring them distinct would invent a distinction
 * the data does not have and silently re-tier every stored project. Extending
 * the set is therefore a schema change rather than a setting; that limitation
 * is recorded in the phase summary.
 */

/** Alarm priorities, ordered from most to least severe. Order is a fact here. */
export const ALARM_PRIORITIES = Object.freeze(["critical", "warning", "info"]);

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
export function priorityRank(priority) {
  const rank = ALARM_PRIORITIES.indexOf(priority);
  if (rank < 0) throw new RangeError(`unknown alarm priority: ${String(priority)}`);
  return rank;
}

/** Return whether `a` is at least as severe as `b`. */
export function atLeastAsSevere(a, b) {
  return priorityRank(a) <= priorityRank(b);
}

/**
 * Map one stored severity string to a declared priority.
 *
 * An unrecognised string maps to the *most severe* interpretation and is
 * reported. A site whose alarm was already miscounted must not have it
 * miscounted quieter: the failure mode of guessing low is an unnoticed
 * shutdown, and of guessing high is an annoyed operator.
 */
export function migrateSeverity(stored) {
  const raw = String(stored ?? "").trim().toLowerCase();
  if (raw === "") {
    return { priority: UNKNOWN_SEVERITY_FALLBACK, recognised: false, stored: stored ?? null };
  }
  const mapped = Object.prototype.hasOwnProperty.call(SEVERITY_MIGRATION, raw)
    ? SEVERITY_MIGRATION[raw]
    : null;
  if (mapped === null) {
    return { priority: UNKNOWN_SEVERITY_FALLBACK, recognised: false, stored };
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
export function countByPriority(alarms) {
  const counts = Object.fromEntries(ALARM_PRIORITIES.map((priority) => [priority, 0]));
  const unrecognised = [];
  for (const alarm of alarms ?? []) {
    const result = migrateSeverity(alarm?.priority ?? alarm?.severity);
    counts[result.priority] += 1;
    if (!result.recognised) unrecognised.push(result.stored);
  }
  return { counts, unrecognised };
}
