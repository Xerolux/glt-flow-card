/* Ranked, explained entity mapping candidates.
 *
 * A ranking you cannot argue with is a ranking you have to trust blindly, which
 * is exactly what this phase exists to prevent. Every candidate therefore
 * carries the reason codes and weights that produced its score, and nothing here
 * binds anything: ranking suggests, a person accepts.
 *
 * Name similarity is the last signal and never sufficient on its own. Plants are
 * full of entities whose names almost match the wrong thing - a setpoint beside
 * its measurement, a decommissioned boiler beside the new heat pump - and a
 * ranker that trusts names confidently binds the wrong one.
 */
import { UNITS } from "./semantic-model.mjs";

/** Every reason a candidate can carry, in descending weight. */
export const REASON_CODES = Object.freeze([
  "manual_override",
  "claimed_by_another_slot",
  "device_membership",
  "slot_expectation",
  "area_agreement",
  "integration_agreement",
  "unit_compatible",
  "name_similarity",
]);

const WEIGHTS = Object.freeze({
  device_membership: 0.35,
  slot_expectation: 0.25,
  area_agreement: 0.15,
  integration_agreement: 0.1,
  unit_compatible: 0.1,
  name_similarity: 0.05,
});

/**
 * Tokens that name a semantic role. A candidate carrying one the slot does not
 * declare is describing something else - a setpoint is not its measurement -
 * so it is penalized rather than rewarded for the resemblance.
 */
const ROLE_TOKENS = Object.freeze([
  "setpoint", "target", "command", "alarm", "fault", "min", "max", "average",
]);

function tokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^[a-z_]+\./u, "")
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function dimensionOf(unit) {
  return UNITS[unit]?.dimension ?? null;
}

/**
 * Whether a candidate can hold this slot at all.
 *
 * A unit of the wrong dimension is not a weak match, it is a different
 * quantity: binding kW to a kWh slot produces a number that is wrong by a unit
 * of time and looks entirely plausible.
 */
function declaredRoles(slot) {
  return new Set([...tokens(slot.id), ...(slot.semantic_tags ?? [])]);
}

function eligible(slot, candidate) {
  // A role token the slot does not declare means the candidate describes a
  // different quantity that merely shares vocabulary. A setpoint is not its
  // measurement, and no amount of shared device, area or unit makes it one.
  const roles = declaredRoles(slot);
  if (tokens(candidate.entity_id).some((token) => ROLE_TOKENS.includes(token) && !roles.has(token))) {
    return false;
  }
  const slotDimension = dimensionOf(slot.unit);
  const candidateDimension = dimensionOf(candidate.unit);
  if (slot.unit === null || slot.unit === undefined) return true;
  if (candidate.unit === null || candidate.unit === undefined) return false;
  return slotDimension !== null && slotDimension === candidateDimension;
}

function nameScore(slot, candidate) {
  const slotTokens = new Set(tokens(slot.id));
  const candidateTokens = tokens(candidate.entity_id);
  const matched = candidateTokens.filter((token) => slotTokens.has(token)).length;
  if (matched === 0 || slotTokens.size === 0) return 0;
  const coverage = matched / slotTokens.size;
  // A role token the slot does not declare means the candidate describes a
  // different thing that merely shares vocabulary.
  return coverage;
}

/**
 * Rank the candidates for one slot, highest first.
 *
 * Pure: the same inputs produce the same order and the same scores, so a
 * ranking reviewed in a browser is the ranking the Companion applies.
 */
export function rankCandidates({ slot, slots = [], candidates = [], device = null, siblings = [] } = {}) {
  if (!slot) return [];
  // Mapping is an assignment, not a set of independent rankings. An entity
  // whose name plainly answers a different slot is not a weak answer to this
  // one, it is the other slot's answer, and no per-slot signal can see that.
  const otherSlots = slots.filter((entry) => entry?.id && entry.id !== slot.id);
  const siblingIntegrations = new Set(siblings.map((entry) => entry.integration).filter(Boolean));
  const ranked = [];

  for (const candidate of candidates) {
    if (!eligible(slot, candidate)) continue;
    const claimed = otherSlots.find(
      (other) => nameScore(other, candidate) === 1 && nameScore(slot, candidate) < 1,
    );
    if (claimed) continue;
    const reasons = [];

    if (device && candidate.device && candidate.device === device.id) {
      reasons.push({ code: "device_membership", weight: WEIGHTS.device_membership });
    }
    if (slot.device_class && candidate.device_class === slot.device_class) {
      reasons.push({
        code: "slot_expectation", weight: WEIGHTS.slot_expectation,
        detail: slot.device_class,
      });
    }
    if (device?.area && candidate.area && candidate.area === device.area) {
      reasons.push({ code: "area_agreement", weight: WEIGHTS.area_agreement, detail: candidate.area });
    }
    if (candidate.integration && siblingIntegrations.has(candidate.integration)) {
      reasons.push({
        code: "integration_agreement", weight: WEIGHTS.integration_agreement,
        detail: candidate.integration,
      });
    }
    if (slot.unit && candidate.unit && dimensionOf(slot.unit) === dimensionOf(candidate.unit)) {
      reasons.push({ code: "unit_compatible", weight: WEIGHTS.unit_compatible, detail: candidate.unit });
    }
    const similarity = nameScore(slot, candidate);
    if (similarity > 0) {
      reasons.push({
        code: "name_similarity",
        weight: Number((WEIGHTS.name_similarity * similarity).toFixed(4)),
        detail: Number(similarity.toFixed(4)),
      });
    }
    if (reasons.length === 0) continue;

    const score = Number(reasons.reduce((total, reason) => total + reason.weight, 0).toFixed(4));
    const onlyName = reasons.every((reason) => reason.code === "name_similarity");
    ranked.push({
      entity_id: candidate.entity_id,
      score,
      reasons,
      // A candidate resting only on a name is never enough to act on, and says
      // so rather than leaving a reader to notice.
      sufficient: !onlyName,
      override: false,
    });
  }

  // Ties break on entity id so two runtimes never disagree about order.
  ranked.sort((left, right) => right.score - left.score || left.entity_id.localeCompare(right.entity_id));
  return ranked;
}

/**
 * Record a person's decision.
 *
 * The override is stored as a decision rather than a score, so a later re-rank
 * cannot quietly overrule an engineer who already looked at this.
 */
export function applyOverride(ranked, override) {
  if (!override?.entity_id) return [...ranked];
  const rest = ranked.filter((candidate) => candidate.entity_id !== override.entity_id);
  const existing = ranked.find((candidate) => candidate.entity_id === override.entity_id);
  return [
    {
      entity_id: override.entity_id,
      score: existing?.score ?? 0,
      reasons: [
        { code: "manual_override", weight: 1, detail: override.by ?? null },
        ...(existing?.reasons ?? []),
      ],
      sufficient: true,
      override: true,
    },
    ...rest,
  ];
}
