/**
 * Replaying a past instant shows that instant, never the present.
 *
 * D8: `_stateAt` returns the *live* state when an entity has no series
 * (`if (!series || !series.length) return live`). So replaying last Tuesday
 * shows today's value for everything the Recorder did not keep, mixed into the
 * same view as entities that do have history, with nothing distinguishing them.
 *
 * It is the most misleading possible wrong answer, and worth being precise about
 * why: it is not a corrupt value, or a stale one, or an obviously missing one.
 * It is the **correct current value of the right entity**, presented as the
 * value at a time it was never measured. Nothing about it looks wrong.
 *
 * This is Phase 6's `indeterminate` decision applied to history. A vanished
 * entity has not returned to normal, and an entity with no recorded history was
 * not in its present state last Tuesday. The honest answer to both is a stated
 * unknown.
 */

import { pair as catalogPair } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";
/** Where a replayed value came from. Closed. */
export const REPLAY_SOURCES = Object.freeze(["recorded", "unknown"]);

/** Why a replayed value could not be resolved. Closed, and each distinct. */
export const REPLAY_REASONS = Object.freeze([
  "no_recorded_history",
  "before_first_sample",
  "outside_loaded_window",
]);

const REASON_LABELS = Object.freeze({
  before_first_sample: catalogPair("replay.before_first_sample"),
  no_recorded_history: catalogPair("replay.no_recorded_history"),
  outside_loaded_window: catalogPair("replay.outside_loaded_window"),
});

for (const reason of REPLAY_REASONS) {
  for (const language of ["de", "en"]) {
    if (!REASON_LABELS[reason]?.[language]) {
      throw new Error(`replay reason "${reason}" has no ${language} wording`);
    }
  }
}

function sampleTime(sample) {
  if (typeof sample?.time === "number") return sample.time;
  const parsed = Date.parse(sample?.last_updated ?? sample?.last_changed ?? "");
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Return what was recorded for an entity at an instant.
 *
 * Never falls back to `live`. The parameter is accepted so a caller can pass the
 * value it has without having to decide whether to, and so the function can be
 * dropped in where `_stateAt` was — but it is used only to answer questions
 * about the *present*, which is the one thing this function is not asked.
 */
export function stateAt({ entityId, instant, live, series }) {
  const samples = Array.isArray(series) ? series : [];
  if (samples.length === 0) {
    return {
      entity_id: entityId ?? null,
      reason: "no_recorded_history",
      source: "unknown",
      state: null,
    };
  }

  const target = instant instanceof Date ? instant.getTime() : Number(instant);
  let candidate = null;
  let candidateTime = null;
  for (const sample of samples) {
    const at = sampleTime(sample);
    if (at === null || at > target) continue;
    if (candidateTime === null || at > candidateTime) {
      candidate = sample;
      candidateTime = at;
    }
  }

  if (candidate === null) {
    // Samples exist, but all of them are later than the instant asked about.
    // Reporting the earliest one would be the nearest-neighbour defect from
    // the export path (D22) wearing a different hat: a value from after the
    // question, presented as the answer to it.
    return {
      entity_id: entityId ?? null,
      reason: "before_first_sample",
      source: "unknown",
      state: null,
    };
  }

  void live;
  return {
    at: candidateTime,
    entity_id: entityId ?? null,
    reason: null,
    source: "recorded",
    state: candidate.state ?? null,
  };
}

/** Return the wording for one unresolvable reason. */
export function reasonLabel(reason, language = "de") {
  const wording = REASON_LABELS[reason];
  if (!wording) throw new Error(`unknown replay reason: ${JSON.stringify(reason)}`);
  return wording[language] ?? wording.en;
}

/**
 * Return whether a replayed answer may be drawn as a value.
 *
 * A single call site for the question every surface has to ask, so that a
 * surface cannot forget to and quietly render `null` as a blank that looks like
 * a reading of zero.
 */
export function isResolved(answer) {
  return answer?.source === "recorded" && answer?.state !== null;
}
