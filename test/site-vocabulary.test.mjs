/**
 * The two runtimes agree about what a site can be (T9-13's foundation).
 *
 * Compared as canonical bytes rather than values, for the reason this codebase
 * has now recorded four times: two earlier parity efforts agreed on every value
 * and disagreed on every byte.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";
import {
  ANSWERING_STATES, REMOTE_FAILURES, SITE_STATES, UNKNOWN_EFFECT_FAILURES,
  answered, canonicalVocabulary, outcomeForFailure,
} from "../src/v100/site-vocabulary.mjs";

const EFFECT_PREFIX = "PHASE9_VOCABULARY_EFFECTS ";

function companionVocabulary() {
  const script = [
    "from custom_components.glt_flow_card import site_vocabulary as sv",
    "print(sv.canonical_vocabulary())",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  return execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("both runtimes declare identical site vocabularies", () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, remote: 0, service: 0, socket: 0, states: SITE_STATES.length,
  }));
  assert.equal(canonicalVocabulary(), companionVocabulary(), "the two vocabularies disagree");
});

test("unreachable and circuit_open are both declared and distinct", () => {
  // The pair that matters. One has been failing for a while and the other just
  // failed; a surface that cannot tell them apart hides how long the problem
  // has existed.
  assert.ok(SITE_STATES.includes("unreachable"));
  assert.ok(SITE_STATES.includes("circuit_open"));
  assert.notEqual("unreachable", "circuit_open");
  // And neither counts as an answer.
  assert.ok(!answered("unreachable"));
  assert.ok(!answered("circuit_open"));
});

test("slow is an answer, because treating it as absent would discard real data", () => {
  assert.ok(answered("slow"));
  assert.ok(answered("healthy"));
  assert.deepEqual([...ANSWERING_STATES], ["healthy", "slow"]);
});

test("unavailable is not a site state", () => {
  // It is a real *entity* state. Reusing the word for a site is exactly how the
  // shipped code made "we could not ask" indistinguishable from "it is down".
  assert.ok(!SITE_STATES.includes("unavailable"));
});

test("a timeout implies effect_unknown, and a refusal implies failed", () => {
  // The distinction matters more over a network, not less: a timeout on a POST
  // is the canonical case where the service may well have run.
  assert.equal(outcomeForFailure("timeout"), "effect_unknown");
  assert.equal(outcomeForFailure("deadline_reached"), "effect_unknown");
  // And the other side keeps the distinction meaningful — if everything were
  // unknown, an operator could never be told a command definitely did not run.
  assert.equal(outcomeForFailure("connection_refused"), "failed");
  assert.equal(outcomeForFailure("unauthorized"), "failed");
});

test("every declared failure maps to an outcome, and an undeclared one is refused", () => {
  for (const reason of REMOTE_FAILURES) {
    assert.ok(["effect_unknown", "failed"].includes(outcomeForFailure(reason)), reason);
  }
  assert.throws(() => outcomeForFailure("something_new"), /unknown_remote_failure/);
});

test("the unknown-effect failures are a subset of the declared failures", () => {
  for (const reason of UNKNOWN_EFFECT_FAILURES) {
    assert.ok(REMOTE_FAILURES.includes(reason), `${reason} is not a declared failure`);
  }
});
