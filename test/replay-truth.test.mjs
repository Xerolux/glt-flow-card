/**
 * Replaying a past instant shows that instant, not the present (T7-06).
 *
 * D8: `_stateAt` returns the *live* state when an entity has no series. So
 * replaying last Tuesday shows today's value for everything the Recorder did
 * not keep, mixed into the same view as entities that do have history, with
 * nothing distinguishing them.
 *
 * It is the most misleading possible wrong answer: the correct current value of
 * the right entity, presented as the value at a time it was never measured.
 */
import assert from "node:assert/strict";
import test from "node:test";

const RED_MARKER =
  "EXPECTED_RED[phase7-replay-truth]: replay that reads the record rather than the present is unavailable";
const EFFECT_PREFIX = "PHASE7_REPLAY_EFFECTS ";

test("[expected-red:phase7-replay-truth] replay reads the record, not the present", async () => {
  console.log(EFFECT_PREFIX + JSON.stringify({ network: 0, queries: 0, service: 0 }));
  const gaps = [];

  let replay = null;
  try {
    replay = await import("../src/v100/replay-truth.mjs");
  } catch {
    gaps.push("src/v100/replay-truth.mjs does not exist");
  }

  if (replay) {
    const at = replay.stateAt;
    if (typeof at !== "function") {
      gaps.push("replay-truth exposes no stateAt");
    } else {
      // An entity with history reads from it.
      const recorded = at({
        entityId: "sensor.a",
        instant: Date.parse("2027-06-01T12:00:00Z"),
        live: { state: "99" },
        series: [
          { state: "21", time: Date.parse("2027-06-01T11:00:00Z") },
          { state: "22", time: Date.parse("2027-06-01T13:00:00Z") },
        ],
      });
      if (recorded?.state !== "21") gaps.push("a replayed instant did not read the record");
      if (recorded?.source !== "recorded") gaps.push("a replayed value does not say it was recorded");

      // An entity without history is unknown at that instant, never live.
      const absent = at({
        entityId: "sensor.b",
        instant: Date.parse("2027-06-01T12:00:00Z"),
        live: { state: "99" },
        series: [],
      });
      if (absent?.state === "99") {
        gaps.push(
          "an entity with no history fell back to its live state, so a replay of " +
          "last Tuesday shows today's value with nothing marking it",
        );
      }
      if (absent?.source !== "unknown") {
        gaps.push("an unresolvable replayed value does not say it is unknown");
      }
      if (!absent?.reason) gaps.push("an unresolvable replayed value carries no reason");
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "replay that reads the record is unavailable");
});
