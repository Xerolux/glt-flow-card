/**
 * The Phase-10 effect ledger, and the one thing this phase can get wrong while
 * passing.
 *
 * Each phase's ledger answers the question that phase can get wrong *while its
 * suite stays green*:
 *
 * - Phase 7: a query that exceeded its declared bound.
 * - Phase 8: an effect that reached the plant during a rehearsal.
 * - Phase 9: a real socket opened while proving a bound.
 * - **Phase 10: a measurement that measured nothing.**
 *
 * The Phase-10 version is the most believable of the four, because it looks
 * like good news. A capacity scenario that finishes in three milliseconds
 * because it built no objects reports a comfortable number under its budget,
 * and every downstream artifact — the budget file, the claim registry, the
 * release evidence — repeats that number as a fact about the product.
 *
 * So a measurement here carries the object count it **actually built**, and a
 * scenario that declares 2,000 and builds 0 fails naming both numbers. A count
 * that merely differs from the declaration also fails: a scenario that built
 * 1,999 objects is not the scenario anyone recorded a budget for.
 */

/** The effect names every Phase-10 test declares, all zero unless named. */
export const EFFECT_KEYS = Object.freeze(["network", "remote", "service", "socket"]);

/**
 * Emit one `PHASE10_<AREA>_EFFECTS` line.
 *
 * `built` and `declared` are required for a measurement and refused for
 * anything else, so a capacity scenario cannot omit the one field that makes
 * its number mean something, and a catalog test cannot pretend to be one.
 */
export function emitEffects(area, effects = {}) {
  if (typeof area !== "string" || !/^[A-Z][A-Z_]*$/u.test(area)) {
    throw new Error(`phase-10 effects: area must be an upper-case name, got ${JSON.stringify(area)}`);
  }
  const line = {};
  for (const key of EFFECT_KEYS) line[key] = Number(effects[key] ?? 0);
  for (const key of EFFECT_KEYS) {
    if (!Number.isFinite(line[key]) || line[key] < 0) {
      throw new Error(`phase-10 effects: ${key} must be a non-negative number`);
    }
  }
  const measured = effects.declared !== undefined || effects.built !== undefined;
  if (measured) {
    requireBuiltWhatItDeclared(area, effects.declared, effects.built);
    line.declared = effects.declared;
    line.built = effects.built;
  }
  console.log(`PHASE10_${area}_EFFECTS ${JSON.stringify(line, Object.keys(line).sort())}`);
  return line;
}

/**
 * Refuse a measurement that did not build what it declared.
 *
 * Exported separately so a harness can call it at the moment the objects exist,
 * rather than only when the line is printed — by then the timing has already
 * been recorded and the wrong number is the one in hand.
 */
export function requireBuiltWhatItDeclared(area, declared, built) {
  if (!Number.isInteger(declared) || declared <= 0) {
    throw new Error(
      `phase-10 measurement ${area}: declared must be a positive integer, got ${JSON.stringify(declared)}`,
    );
  }
  if (!Number.isInteger(built) || built < 0) {
    throw new Error(
      `phase-10 measurement ${area}: built must be a non-negative integer, got ${JSON.stringify(built)}`,
    );
  }
  if (built !== declared) {
    throw new Error(
      `phase-10 measurement ${area}: declared ${declared} objects and built ${built}. `
      + "A scenario that did not build what it declared has not measured what its budget describes.",
    );
  }
}
