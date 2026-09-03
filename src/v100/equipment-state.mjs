/* One deterministic operational state per equipment.
 *
 * Sixteen conditions can be true at once. Resolving them with nested
 * conditionals produces a function nobody can verify, so the precedence is a
 * frozen table and the resolver's whole job is to find the first entry that
 * applies. A test can then enumerate the table; a person can read it.
 *
 * Trust outranks activity. A datapoint with a communication error is never
 * reported as running, however recently it said so, because the card does not
 * know that it is. That single rule is why the first three entries sit above
 * everything else.
 */

import { pair as catalogPair } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";
/** The precedence, highest first. Order is the contract. */
export const STATE_PRECEDENCE = Object.freeze([
  "communication_error",
  "invalid",
  "stale",
  "fault",
  "interlock",
  "locked",
  "maintenance",
  "local",
  "manual",
  "command_failed",
  "command_pending",
  "warning",
  "running",
  "standby",
  "off",
]);

/**
 * Qualifiers that describe a running plant rather than replacing its state.
 *
 * An operator needs to read "running · remote", not lose one of the two, so
 * these are reported alongside the state instead of competing with it.
 */
export const MODE_QUALIFIERS = Object.freeze(["auto", "remote"]);

/** German and English labels. Every state has both before the phase closes. */
const LABELS = Object.freeze({
  communication_error: catalogPair("equipment.communication_error"),
  invalid: catalogPair("equipment.invalid"),
  stale: catalogPair("equipment.stale"),
  fault: catalogPair("equipment.fault"),
  interlock: catalogPair("equipment.interlock"),
  locked: catalogPair("equipment.locked"),
  maintenance: catalogPair("equipment.maintenance"),
  local: catalogPair("equipment.local"),
  manual: catalogPair("equipment.manual"),
  command_failed: catalogPair("equipment.command_failed"),
  command_pending: catalogPair("equipment.command_pending"),
  warning: catalogPair("equipment.warning"),
  running: catalogPair("equipment.running"),
  standby: catalogPair("equipment.standby"),
  off: catalogPair("equipment.off"),
  unknown: catalogPair("equipment.unknown"),
});

/**
 * A distinct glyph per state group, so colour is never the only carrier.
 *
 * Groups rather than fifteen glyphs: a shape vocabulary nobody can tell apart
 * is the same failure as colour-only, one step further along.
 */
const SYMBOLS = Object.freeze({
  communication_error: "link-broken",
  invalid: "question",
  stale: "clock",
  fault: "triangle-alert",
  interlock: "lock-chain",
  locked: "lock",
  maintenance: "wrench",
  local: "hand",
  manual: "hand",
  command_failed: "cross",
  command_pending: "hourglass",
  warning: "triangle",
  running: "play",
  standby: "pause",
  off: "circle",
  unknown: "question",
});

const TONES = Object.freeze({
  communication_error: "critical",
  invalid: "critical",
  stale: "caution",
  fault: "critical",
  interlock: "caution",
  locked: "caution",
  maintenance: "info",
  local: "info",
  manual: "info",
  command_failed: "critical",
  command_pending: "info",
  warning: "caution",
  running: "positive",
  standby: "neutral",
  off: "neutral",
  unknown: "neutral",
});

/** Quality values, ordered from most to least trustworthy. */
export const QUALITY_VALUES = Object.freeze(["good", "uncertain", "bad", "unknown"]);

function freshnessOf({ observedAt, freshnessSeconds, now }) {
  if (!Number.isFinite(observedAt) || !Number.isFinite(now)) {
    return { known: false, ageSeconds: null, budgetSeconds: freshnessSeconds ?? null, stale: false };
  }
  const budget = Number.isFinite(freshnessSeconds) ? freshnessSeconds : null;
  const age = Math.max(0, now - observedAt);
  return {
    known: true,
    ageSeconds: age,
    budgetSeconds: budget,
    stale: budget !== null && age > budget,
  };
}

/**
 * Resolve one equipment state.
 *
 * Pure: freshness is decided from the carried `observedAt`, `freshnessSeconds`
 * and `now`, never from a clock this module reads for itself, which is what
 * makes the decision reproducible in a test and in a review.
 */
export function resolveEquipmentState(input = {}) {
  const signals = { ...(input.signals ?? {}) };
  const freshness = freshnessOf(input);
  if (freshness.stale) signals.stale = true;

  const evidence = STATE_PRECEDENCE.filter((state) => Boolean(signals[state]));
  const state = evidence[0] ?? "unknown";
  const modes = MODE_QUALIFIERS.filter((mode) => Boolean(input.modes?.[mode]));
  const quality = QUALITY_VALUES.includes(input.quality) ? input.quality : "unknown";

  return {
    state,
    rank: STATE_PRECEDENCE.indexOf(state),
    quality,
    freshness,
    modes,
    labels: LABELS[state] ?? LABELS.unknown,
    // Everything that was true, in precedence order, so a drill-down can show
    // why this state won rather than merely asserting that it did.
    evidence: evidence.map((code) => ({ code, rank: STATE_PRECEDENCE.indexOf(code) })),
  };
}

/**
 * Project one resolved state into what a surface renders.
 *
 * Symbol, tone, label and drill-down all come from the same resolved value, so
 * they cannot disagree - which is the property OPS-01 asks to be proven.
 */
export function stateProjection(resolved, locale = "en") {
  const state = resolved?.state ?? "unknown";
  const labels = resolved?.labels ?? LABELS.unknown;
  return {
    state,
    symbol: SYMBOLS[state] ?? SYMBOLS.unknown,
    tone: TONES[state] ?? TONES.unknown,
    label: locale === "de" ? labels.de : labels.en,
    modes: [...(resolved?.modes ?? [])],
    quality: resolved?.quality ?? "unknown",
    freshness: resolved?.freshness ?? null,
    evidence: [...(resolved?.evidence ?? [])],
  };
}
