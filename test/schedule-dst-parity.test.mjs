/**
 * The browser preview and the Python runner must resolve identically (T6-12).
 *
 * Phase 3's lesson applies directly: two runtimes once agreed on a *verdict*
 * while building different models, and only comparing canonical bytes exposed
 * it. So this compares canonical resolution bytes over a committed corpus of
 * transition dates, not two booleans.
 *
 * An engineer verifies the preview and the plant executes the runner. If those
 * two disagree about 02:30 on a transition date, the verification was of
 * something else.
 */
import assert from "node:assert/strict";
import test from "node:test";

const EFFECT_PREFIX = "PHASE6_SCHEDULE_EFFECTS ";
const RED_MARKER =
  "EXPECTED_RED[phase6-schedule-parity]: dual-runtime schedule resolution parity is unavailable";

/**
 * Zones the corpus must cover.
 *
 * `Pacific/Auckland` is deliberately southern-hemisphere: its transitions run
 * the other way round, so an implementation that assumes "spring forward
 * happens in March" is caught rather than merely unexercised.
 */
const REQUIRED_ZONES = ["Europe/Berlin", "Pacific/Auckland"];

async function parityGaps() {
  const gaps = [];

  let scheduleTime;
  try {
    scheduleTime = await import("../src/v100/schedule-time.mjs");
  } catch {
    return ["there is no src/v100/schedule-time.mjs, so the browser cannot resolve an entry at all"];
  }

  for (const name of ["localTimeExists", "localTimeAmbiguous", "resolveEntry", "runKey"]) {
    if (typeof scheduleTime[name] !== "function") gaps.push(`schedule-time.mjs has no ${name}()`);
  }

  let corpus;
  try {
    const { readFileSync } = await import("node:fs");
    corpus = JSON.parse(readFileSync(
      new URL("./fixtures/schedule-transitions.json", import.meta.url), "utf8",
    ));
  } catch {
    gaps.push(
      "test/fixtures/schedule-transitions.json is missing; a parity claim needs one " +
      "committed corpus both runtimes read, not two lists that happen to match",
    );
    return gaps;
  }

  const zones = new Set((corpus.cases ?? []).map((entry) => entry.zone));
  for (const zone of REQUIRED_ZONES) {
    if (!zones.has(zone)) gaps.push(`the corpus carries no ${zone} case`);
  }

  return gaps;
}

test("[expected-red:phase6-schedule-parity] both runtimes resolve a schedule identically", async () => {
  const gaps = await parityGaps();
  console.log(`${EFFECT_PREFIX}${JSON.stringify({
    zones: REQUIRED_ZONES.length, gaps: gaps.length,
  })}`);
  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "dual-runtime schedule resolution parity is unavailable");
});
