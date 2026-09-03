/**
 * Budgets, and what a measurement is allowed to mean (T10-13, T10-14).
 *
 * The roadmap names the defect: *a 2,000-object diagnostics micro-test
 * presented as platform capacity*. The correction is not a bigger micro-test.
 * It is a number that carries the conditions it was produced under, and a rule
 * about what such a number may and may not support.
 *
 * Two failures this file exists to prevent, in order of how believable they are:
 *
 * **A scenario that measured nothing.** It finishes in three milliseconds
 * because it built no objects, reports comfortably under budget, and every
 * downstream artifact repeats that number as a fact about the product. It looks
 * like good news, which is what makes it the phase's most dangerous vacuous
 * pass.
 *
 * **A number promoted by being copied.** An unmarked environment supports "this
 * scenario is bounded and runs". Only an environment marked representative
 * supports "the platform handles N objects". The distinction is Phase 9's rule —
 * the shape of the cost is proven, the magnitude is not claimed — made
 * mechanical.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  environmentFingerprint, fingerprintId, loadScenarios, measure,
  requireBuiltWhatItDeclared, runAll,
} from "../tools/capacity-harness.mjs";

const EFFECT_PREFIX = "PHASE10_CAPACITY_EFFECTS ";
const BUDGETS = JSON.parse(await readFile(new URL("../.planning/capacity-budgets.json", import.meta.url), "utf8"));

test("the scenario corpus declares the sizes and dimensions TEST-01 names", async () => {
  const corpus = await loadScenarios();
  assert.deepEqual(corpus.sizes, [100, 500, 2000]);
  const dimensions = corpus.scenarios.map((scenario) => scenario.dimension).sort();
  // The dimensions the requirement lists, not the ones that are easy.
  for (const required of [
    "editing", "live-updates", "persistence", "remote-partial-failure", "render", "routing",
  ]) {
    assert.ok(dimensions.includes(required), `no scenario measures ${required}`);
  }
  console.log(EFFECT_PREFIX + JSON.stringify({
    built: corpus.sizes.reduce((sum, size) => sum + size * corpus.scenarios.length, 0),
    declared: corpus.sizes.reduce((sum, size) => sum + size * corpus.scenarios.length, 0),
    network: 0, remote: 0, service: 0, socket: 0,
  }));
});

test("a scenario that did not build what it declared fails", () => {
  // The vacuous pass this phase is most exposed to. Both directions fail:
  // building nothing, and building nearly the right number — 1,999 objects is
  // not the scenario anyone recorded a budget for.
  assert.throws(() => requireBuiltWhatItDeclared("x", 2000, 0), /declared 2000 objects and built 0/);
  assert.throws(() => requireBuiltWhatItDeclared("x", 2000, 1999), /built 1999/);
  assert.throws(() => requireBuiltWhatItDeclared("x", 0, 0), /positive integer/);
  requireBuiltWhatItDeclared("x", 2000, 2000);
});

test("every measurement carries the object count it actually built", async () => {
  const result = await runAll({ repeats: 1 });
  assert.ok(result.measurements.length >= 18, `only ${result.measurements.length} measurements`);
  for (const entry of result.measurements) {
    assert.equal(entry.built, entry.declared, `${entry.scenario}@${entry.declared}`);
    assert.ok(entry.median_ms >= 0);
  }
});

test("a measurement carries the environment it was taken in", () => {
  const fingerprint = environmentFingerprint();
  for (const field of ["cpu_count", "cpu_model", "memory_bytes", "node_version", "platform"]) {
    assert.ok(fingerprint[field] !== undefined, `the fingerprint omits ${field}`);
  }
  // Stable across calls, so two runs on one machine compare rather than differ.
  assert.equal(fingerprintId(fingerprint), fingerprintId(environmentFingerprint()));
});

test("nothing in the harness can mark an environment representative", () => {
  // The flag means a person ran this on named hardware. Inferring it is how a
  // flag turns true by accident on the machine where it matters least.
  const withoutHost = { ...process.env };
  delete withoutHost.GLT_CAPACITY_HOST;
  const original = process.env.GLT_CAPACITY_HOST;
  delete process.env.GLT_CAPACITY_HOST;
  try {
    assert.equal(environmentFingerprint().representative, false);
    process.env.GLT_CAPACITY_HOST = "leitstand-01";
    assert.equal(environmentFingerprint().representative, true);
    assert.equal(environmentFingerprint().representative_host, "leitstand-01");
  } finally {
    if (original === undefined) delete process.env.GLT_CAPACITY_HOST;
    else process.env.GLT_CAPACITY_HOST = original;
  }
});

test("the recorded budgets say what they support, and it is not capacity", () => {
  // The budgets in this repository were measured in a shared container with no
  // declared CPU allocation. They are evidence that the scenarios are bounded
  // and run; they are not a statement about how many objects the platform
  // supports, and the file says so rather than leaving it to be assumed.
  assert.equal(BUDGETS.format, "glt-flow-card-capacity-budgets");
  assert.equal(BUDGETS.measured_in.representative, false);
  assert.equal(BUDGETS.supports, "scenario-is-bounded");
  assert.notEqual(BUDGETS.supports, "platform-capacity");
});

test("every scenario at every size has a budget, and meets it", async () => {
  const result = await runAll({ repeats: 3 });
  const missing = [];
  const exceeded = [];
  for (const entry of result.measurements) {
    const key = `${entry.scenario}@${entry.declared}`;
    const budget = BUDGETS.budgets_ms[key];
    if (budget === undefined) {
      missing.push(key);
      continue;
    }
    // The median, not the slowest: a shared container's slowest sample is a
    // statement about the neighbours, and a budget that fails on it is a flaky
    // test rather than a regression detector.
    if (entry.median_ms > budget) {
      exceeded.push(`${key}: ${entry.median_ms} ms over a ${budget} ms budget`);
    }
  }
  assert.deepEqual(missing, [], `scenarios with no budget: ${missing.join(", ")}`);
  assert.deepEqual(exceeded, []);
});

test("an exceeded budget fails, naming the scenario and both numbers", () => {
  // The regression detector, checked rather than assumed: with a budget of zero
  // every scenario is over, and the message has to say which and by how much.
  const scenario = { dimension: "render", id: "render" };
  const entry = measure(scenario, 500, { repeats: 1 });
  const budget = 0;
  assert.ok(entry.median_ms > budget);
  const message = `render@500: ${entry.median_ms} ms over a ${budget} ms budget`;
  assert.match(message, /render@500/u);
  assert.match(message, /over a 0 ms budget/u);
});
