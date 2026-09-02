/**
 * Separated command outcomes (T4-07, OPS-02).
 *
 * Phase 2 already decided the hard part: nine result states, and only
 * `readback_confirmed` counts as success. `accepted` means the server wrote it
 * down and `dispatched` means Home Assistant was asked; neither means the plant
 * moved, and calling either a success is the exact lie that list exists to
 * prevent.
 *
 * Phase 4 surfaces those states. It must not collapse them, add a tenth, widen
 * success, or offer a retry — Phase 2 settled that there is no retry entry
 * point, because repairing forward is a new, separately authorized command.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROL_RESULT_STATES,
  CONTROL_SUCCESS_STATES,
  CONTROL_UNKNOWN_STATES,
} from "../src/v100/configured-control.mjs";

const MODULE_URL = new URL("../src/v100/command-outcome.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase4-command-outcome]: separated command outcome presentation is unavailable";
const EFFECT_PREFIX = "PHASE4_OUTCOME_EFFECTS ";

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, localStorage: 0, callService: 0, callApi: 0, ...extra,
  }));
}

async function loadModel() {
  try {
    return await import(MODULE_URL.href);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

test("Phase 2 still owns the state list, and success is still one state", () => {
  assert.equal(CONTROL_RESULT_STATES.length, 9);
  assert.deepEqual([...CONTROL_SUCCESS_STATES], ["readback_confirmed"]);
});

test("[expected-red:phase4-command-outcome] every outcome is presented distinctly", async () => {
  emitEffects({ states: CONTROL_RESULT_STATES.length });
  const gaps = [];
  const model = await loadModel();
  if (!model) {
    gaps.push("src/v100/command-outcome.mjs does not exist");
  } else {
    const { presentOutcome } = model;
    if (typeof presentOutcome !== "function") {
      gaps.push("presentOutcome is not exported");
    } else {
      const presented = new Map();
      for (const state of CONTROL_RESULT_STATES) {
        let outcome = null;
        try {
          outcome = presentOutcome({ state, correlation_id: "cmd-1" });
        } catch (error) {
          gaps.push(`presentOutcome threw for ${state}: ${error.message}`);
          continue;
        }
        presented.set(state, outcome);

        if (!outcome || typeof outcome.label !== "string" || outcome.label.length === 0) {
          gaps.push(`${state} has no label`);
        }
        if (outcome && outcome.correlationId !== "cmd-1") {
          gaps.push(`${state} does not carry the command correlation id`);
        }
        // No state may offer a retry. Repairing forward is a new command.
        const affordances = (outcome?.affordances ?? []).map((entry) => String(entry).toLowerCase());
        if (affordances.some((entry) => entry.includes("retry"))) {
          gaps.push(`${state} offers a retry affordance`);
        }
      }

      // All nine covered: adding a state in Phase 2 without covering it here
      // must fail, not silently render as nothing.
      const missing = CONTROL_RESULT_STATES.filter((state) => !presented.has(state));
      if (missing.length > 0) gaps.push(`states not presented: ${missing.join(", ")}`);

      // Exactly one success styling, and it is readback_confirmed.
      const successes = [...presented.entries()]
        .filter(([, outcome]) => outcome?.tone === "success")
        .map(([state]) => state);
      if (JSON.stringify(successes) !== JSON.stringify(["readback_confirmed"])) {
        gaps.push(`success styling applies to ${JSON.stringify(successes)}`);
      }

      // The unknown-effect states point at current state and trusted audit.
      for (const state of CONTROL_UNKNOWN_STATES) {
        const outcome = presented.get(state);
        const affordances = (outcome?.affordances ?? []).map((entry) => String(entry).toLowerCase());
        if (!affordances.some((entry) => entry.includes("audit"))) {
          gaps.push(`${state} does not direct the operator to the trusted audit`);
        }
      }

      // Distinguishable without colour: every state needs its own label.
      const labels = [...presented.values()].map((outcome) => outcome?.label);
      if (new Set(labels).size !== labels.length) {
        gaps.push("two outcome states share a label, so they differ only by styling");
      }

      // An unknown state is an error, not a blank render.
      let rejected = false;
      try {
        presentOutcome({ state: "definitely_not_a_state", correlation_id: "cmd-1" });
      } catch {
        rejected = true;
      }
      if (!rejected) gaps.push("an unknown outcome state was accepted");
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  outcome gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "separated command outcome presentation is unavailable");
});
