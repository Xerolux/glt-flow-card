/**
 * The measured value: a number and the evidence for it, travelling together.
 *
 * Phase 7's audit found six defects that are one defect in six costumes — D1,
 * D6, D7, D10, D16 and D18 — and each of them turns *absent* into a number:
 *
 *   - an empty Recorder response sets a full range over an empty map, so the
 *     chart draws a plot inside an axis that claims data;
 *   - a non-numeric sample is dropped and the line closes over the hole, so a
 *     six-hour outage renders as a steady plant;
 *   - a binary sample that could not be read becomes `0`, so "I could not read
 *     the fault contact" is recorded as "the fault contact is healthy";
 *   - an empty period produces no bucket, and the chart joins across it;
 *   - an unavailable meter is skipped, so a month with half the meters offline
 *     reports a smaller, confident cost;
 *   - integration runs straight through a gap, inventing plausible energy.
 *
 * None of those produces a value that an ordinary assertion would flinch at.
 * That is why coverage is a **field** and not a convention: a consumer that
 * ignores it has to ignore it deliberately, and a test can assert on what the
 * product says about its own answer rather than only on the answer.
 *
 * `value: null` with `coverage: 0` is a complete, valid answer. Zero is not a
 * substitute for it, and neither is the nearest neighbour.
 */
import { isPeriodName, isValueSource } from "./period-vocabulary.mjs";

/** The fields every measured value carries. Closed. */
export const MEASURED_FIELDS = Object.freeze([
  "coverage",
  "gaps",
  "period",
  "resolved_at",
  "source",
  "unit",
  "value",
]);

function assertCoverage(coverage) {
  if (typeof coverage !== "number" || Number.isNaN(coverage)) {
    throw new Error("a measured value needs a coverage fraction");
  }
  if (coverage < 0 || coverage > 1) {
    throw new Error(`coverage must be a fraction between 0 and 1, got ${coverage}`);
  }
}

function assertGaps(gaps) {
  if (!Array.isArray(gaps)) throw new Error("gaps must be a list, empty when there are none");
  for (const gap of gaps) {
    if (typeof gap?.start !== "string" || typeof gap?.end !== "string") {
      throw new Error("every gap names a start and an end");
    }
  }
}

/**
 * Build a measured value.
 *
 * Refuses to build one without coverage. That refusal is the whole point of the
 * constructor: the alternative is a default, and a default coverage of 1 would
 * reintroduce every defect above in a single line.
 */
export function measured({ value, unit, coverage, gaps = [], source, period, resolvedAt }) {
  assertCoverage(coverage);
  assertGaps(gaps);
  if (!isValueSource(source)) throw new Error(`unknown_source: ${JSON.stringify(source)}`);
  if (period !== null && period !== undefined && !isPeriodName(period)) {
    throw new Error(`unknown_period: ${JSON.stringify(period)}`);
  }
  if (value !== null && typeof value !== "number") {
    throw new Error("a measured value is a number or null, never a string or a placeholder");
  }
  if (value !== null && coverage === 0) {
    // The contradiction worth catching early: a number that covers nothing came
    // from somewhere it should not have.
    throw new Error("a value with zero coverage is not a value");
  }
  return Object.freeze({
    coverage,
    gaps: Object.freeze(gaps.map((gap) => Object.freeze({ end: gap.end, start: gap.start }))),
    period: period ?? null,
    resolved_at: resolvedAt ?? null,
    source,
    unit: unit ?? null,
    value,
  });
}

/**
 * Build the answer for "we asked and there is nothing there".
 *
 * A named constructor rather than a convention, because this is the case the
 * product currently cannot express, and every one of the six defects above is
 * what happens when it has to be expressed as something else.
 */
export function absent({ unit = null, source, period = null, gaps = [], resolvedAt = null }) {
  return measured({ coverage: 0, gaps, period, resolvedAt, source, unit, value: null });
}

/** Whether this value carries a number at all. */
export function hasValue(entry) {
  return entry?.value !== null && entry?.value !== undefined;
}

/** Whether every expected bucket was answered. */
export function isComplete(entry) {
  return entry?.coverage === 1 && (entry?.gaps?.length ?? 0) === 0;
}

/**
 * Compute coverage from what was expected against what came back.
 *
 * The research established that the Recorder omits empty periods rather than
 * emitting them, so the returned list being shorter is the only signal that data
 * is missing. Materialising the expected buckets and comparing is therefore the
 * only place coverage can honestly come from.
 */
export function coverageOf(expectedBuckets, returnedBuckets) {
  if (!Number.isInteger(expectedBuckets) || expectedBuckets < 0) {
    throw new Error("expected bucket count must be a non-negative integer");
  }
  if (expectedBuckets === 0) return 0;
  const returned = Math.max(0, Math.min(returnedBuckets, expectedBuckets));
  return returned / expectedBuckets;
}

/** The canonical bytes both runtimes must agree on for one measured value. */
export function canonicalMeasured(entry) {
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]),
    );
  };
  return JSON.stringify(sortKeys(entry));
}
