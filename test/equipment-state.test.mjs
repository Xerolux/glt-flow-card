/**
 * One deterministic operational state per equipment (T3-11).
 *
 * Sixteen conditions can be true at once. Resolving them with nested
 * conditionals produces a function nobody can verify, so the precedence is a
 * table and this suite enumerates it: for every ordered pair, the higher-ranked
 * condition must win.
 *
 * The property that matters most is that trust outranks activity. A datapoint
 * with a communication error is never `running`, however recently it said so,
 * because the card does not know that it is.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/equipment-state.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase3-equipment-state]: the deterministic operational state is unavailable";
const EFFECT_PREFIX = "PHASE3_STATE_EFFECTS ";

/** The precedence, highest first. This is the contract, not a sample of it. */
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

/** Qualifiers that describe a running plant rather than replacing its state. */
export const MODE_QUALIFIERS = Object.freeze(["auto", "remote"]);

/** States that must never be reported when the reading cannot be trusted. */
const ACTIVITY_STATES = Object.freeze(["running", "standby", "off"]);
const UNTRUSTWORTHY = Object.freeze(["communication_error", "invalid", "stale"]);

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({ network: 0, callService: 0, ...extra }));
}

async function loadState() {
  try {
    return await import(MODULE_URL.href);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

test("the precedence puts trust above activity", () => {
  const rank = (state) => STATE_PRECEDENCE.indexOf(state);
  for (const untrusted of UNTRUSTWORTHY) {
    for (const activity of ACTIVITY_STATES) {
      assert.ok(rank(untrusted) < rank(activity), `${untrusted} must outrank ${activity}`);
    }
  }
});

test("the precedence is a total order over distinct states", () => {
  assert.equal(new Set(STATE_PRECEDENCE).size, STATE_PRECEDENCE.length);
  assert.equal(STATE_PRECEDENCE[0], "communication_error");
  assert.equal(STATE_PRECEDENCE.at(-1), "off");
});

test("modes qualify a state rather than replacing it", () => {
  for (const qualifier of MODE_QUALIFIERS) {
    assert.ok(!STATE_PRECEDENCE.includes(qualifier), `${qualifier} must not be a state`);
  }
});

test("[expected-red:phase3-equipment-state] one state wins, and it is the honest one", async () => {
  emitEffects({ states: STATE_PRECEDENCE.length });
  const gaps = [];
  const module = await loadState();

  if (!module) {
    gaps.push("src/v100/equipment-state.mjs does not exist");
  } else {
    for (const name of ["STATE_PRECEDENCE", "MODE_QUALIFIERS", "resolveEquipmentState", "stateProjection"]) {
      if (module[name] === undefined) gaps.push(`equipment-state.mjs does not export ${name}`);
    }

    if (gaps.length === 0) {
      if (JSON.stringify([...module.STATE_PRECEDENCE]) !== JSON.stringify([...STATE_PRECEDENCE])) {
        gaps.push("the shipped precedence does not match the contract");
      }

      // Every ordered pair, generated from the table, so adding a state cannot
      // be forgotten.
      for (const [highIndex, high] of STATE_PRECEDENCE.entries()) {
        for (const low of STATE_PRECEDENCE.slice(highIndex + 1)) {
          const resolved = module.resolveEquipmentState({ signals: { [low]: true, [high]: true } });
          if (resolved.state !== high) {
            gaps.push(`${high} did not beat ${low}, got ${resolved.state}`);
          }
        }
      }

      for (const untrusted of UNTRUSTWORTHY) {
        for (const activity of ACTIVITY_STATES) {
          const resolved = module.resolveEquipmentState({
            signals: { [untrusted]: true, [activity]: true },
          });
          if (ACTIVITY_STATES.includes(resolved.state)) {
            gaps.push(`${untrusted} with ${activity} resolved to activity ${resolved.state}`);
          }
        }
      }

      const running = module.resolveEquipmentState({
        signals: { running: true }, modes: { remote: true }, quality: "good",
        observedAt: 100, freshnessSeconds: 60, now: 130,
      });
      if (running.state !== "running") gaps.push(`a plain running plant resolved to ${running.state}`);
      if (!running.modes?.includes("remote")) gaps.push("a mode qualifier was lost");
      for (const field of ["state", "rank", "quality", "freshness", "labels", "evidence"]) {
        if (running[field] === undefined) gaps.push(`the resolved value has no ${field}`);
      }
      if (!running.labels?.en || !running.labels?.de) {
        gaps.push("the resolved state has no German and English label");
      }

      // Freshness is a decision about carried numbers, never a clock the module
      // reads for itself.
      const aged = module.resolveEquipmentState({
        signals: { running: true }, observedAt: 0, freshnessSeconds: 60, now: 600,
      });
      if (aged.state !== "stale") gaps.push(`a value past its budget resolved to ${aged.state}`);

      // Symbol, colour, label and drill-down are projections of one value, so
      // they cannot disagree.
      const projection = module.stateProjection(running);
      for (const field of ["symbol", "tone", "label", "evidence"]) {
        if (projection[field] === undefined) gaps.push(`the projection has no ${field}`);
      }
      if (projection.label !== running.labels.en) {
        gaps.push("the projected label is not the resolved label");
      }
      const tones = new Set(STATE_PRECEDENCE.map((state) =>
        module.stateProjection(module.resolveEquipmentState({ signals: { [state]: true } })).symbol));
      if (tones.size < 4) {
        gaps.push("states are not distinguishable without colour: too few distinct symbols");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps.slice(0, 20)) console.log(`  state gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "the deterministic operational state is unavailable");
});
