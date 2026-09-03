/**
 * The shipped card renders the backend's alarm state and derives none (T6-05).
 *
 * This reads `dist/glt-flow-card.js`, not `src/`. Phase 5 found retirements
 * that existed only in files nobody ships while the same defect ran live in the
 * artifact, and `test/shipped-dialogs.test.mjs` was written for exactly that
 * reason. The audit's D4 is the same shape and worse: four derivations of "is
 * this alarm active", disagreeing, with the authoritative one displayed
 * nowhere.
 *
 * Confirmed by grep at planning time: `alarms/ack` and `alarms/shelve` each
 * appear once in the artifact and `alarms/list` does not appear at all.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const EFFECT_PREFIX = "PHASE6_SHIPPED_EFFECTS ";
const RED_MARKER =
  "EXPECTED_RED[phase6-shipped-truth]: the shipped card still derives alarm state for itself";

const ARTIFACT = new URL("../dist/glt-flow-card.js", import.meta.url);

/** Return the body of a named function declaration, brace-balanced. */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return null;
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  return null;
}

function shippedGaps(source) {
  const gaps = [];

  // The authoritative state must actually be read. Today it is read nowhere.
  if (!source.includes("alarms/list")) {
    gaps.push(
      "the artifact never issues glt_flow_card/alarms/list, so the backend's " +
      "authoritative alarm state is displayed nowhere in the product",
    );
  }

  // Retired reachable and inert, the way Phase 5 retired the midpoint router:
  // the entry point stays so a test can prove the replacement, rather than
  // proving the absence of something nothing checks.
  const body = functionBody(source, "activeAlarm");
  if (body === null) {
    gaps.push(
      "activeAlarm is gone from the artifact; it must stay reachable and inert, " +
      "or there is nothing left to assert about",
    );
  } else {
    for (const [pattern, why] of [
      [/\bcallService\b/, "reaches callService, so acknowledgement bypasses the Companion"],
      [/[<>]=?/, "still compares a threshold"],
      [/hysteresis/i, "still reads hysteresis"],
      [/delay/i, "still reads a delay"],
    ]) {
      if (pattern.test(body)) gaps.push(`activeAlarm ${why}`);
    }
  }

  return gaps;
}

test("[expected-red:phase6-shipped-truth] the shipped card renders backend alarm state", () => {
  const source = readFileSync(ARTIFACT, "utf8");
  const gaps = shippedGaps(source);
  console.log(`${EFFECT_PREFIX}${JSON.stringify({
    bytes: source.length,
    issues_alarms_list: source.includes("alarms/list"),
    gaps: gaps.length,
  })}`);
  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "the shipped card still derives alarm state for itself");
});
