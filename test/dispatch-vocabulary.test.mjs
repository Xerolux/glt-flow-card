/**
 * The two runtimes declare the same words (T8-03's foundation, T8-19).
 *
 * Phase 6 shipped four independent alarm-severity vocabularies and an alarm
 * created as `critical` was counted in none of them. This is the test that was
 * missing then.
 *
 * It compares canonical bytes rather than values, for the reason
 * `period-parity.test.mjs` records: two earlier parity efforts in this codebase
 * agreed on every value and disagreed on every byte.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";
import {
  DISPATCH_KINDS, PHYSICAL_KINDS, SIMULATION_BEHAVIOUR, WORK_ORDER_STATES,
  WORK_ORDER_TRANSITIONS, behaviourFor, transitionAllowed, transitionNeedsReason,
  canonicalVocabulary, vocabularyFingerprint,
} from "../src/v100/dispatch-vocabulary.mjs";

const EFFECT_PREFIX = "PHASE8_VOCABULARY_EFFECTS ";

function companionFingerprint() {
  const script = [
    "import json",
    "from custom_components.glt_flow_card import dispatch_vocabulary as dv",
    "print(dv.canonical_vocabulary())",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  return execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("both runtimes declare identical vocabularies", () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    kinds: DISPATCH_KINDS.length, network: 0, notification: 0, remote: 0, service: 0,
  }));
  assert.equal(
    canonicalVocabulary(), companionFingerprint().trim(), "the two vocabularies disagree",
  );
});

test("the physical kinds are derived from the behaviour table, not listed twice", () => {
  // Written twice, these drift: someone adds a kind to one list and not the
  // other, and the gate then either misses a path or blocks one nobody meant
  // to block. Deriving makes that impossible rather than unlikely.
  assert.deepEqual(
    [...PHYSICAL_KINDS],
    DISPATCH_KINDS.filter((kind) => SIMULATION_BEHAVIOUR[kind] === "refuse"),
  );
  assert.ok(PHYSICAL_KINDS.includes("control"));
  assert.ok(PHYSICAL_KINDS.includes("remote_control"));
  assert.ok(PHYSICAL_KINDS.includes("schedule_service"));
  // The safety decision in the other direction: silencing an alarm during a
  // rehearsal would make the test a window in which nobody is told about a
  // real fault.
  assert.ok(!PHYSICAL_KINDS.includes("notification"), "notification must be marked, not blocked");
});

test("every dispatch kind has a behaviour, and an unknown kind is refused", () => {
  for (const kind of DISPATCH_KINDS) {
    assert.ok(["refuse", "mark", "allow"].includes(behaviourFor(kind)), kind);
  }
  // Not defaulted either way. `allow` would move plant during a rehearsal;
  // `refuse` would silently disable a path nobody meant to disable.
  assert.throws(() => behaviourFor("banana"), /unknown_dispatch_kind/);
});

test("every transition target is a declared state", () => {
  for (const [from, targets] of Object.entries(WORK_ORDER_TRANSITIONS)) {
    assert.ok(WORK_ORDER_STATES.includes(from), `${from} is not a declared state`);
    for (const to of targets) {
      assert.ok(WORK_ORDER_STATES.includes(to), `${from} -> ${to} lands nowhere`);
    }
  }
});

test("reopening is allowed but must justify itself", () => {
  // A completed order that can silently return to open makes a completion
  // indistinguishable from a rewrite, which is the whole point of T8-18.
  assert.ok(transitionAllowed("completed", "open"));
  assert.ok(transitionNeedsReason("completed", "open"));
  // Handing a job back is the same destination and a different act.
  assert.ok(transitionAllowed("assigned", "open"));
  assert.ok(!transitionNeedsReason("assigned", "open"));
  // Cancelled is terminal.
  assert.deepEqual([...WORK_ORDER_TRANSITIONS.cancelled], []);
});

test("the test fixture's kind list matches the shipped vocabulary", () => {
  // `dispatch_factory.py` mirrors the kinds so a test cannot record an
  // undeclared one. Mirrored lists need comparing or they are just two lists.
  const source = readFileSync(
    new URL("../tests/components/glt_flow_card/dispatch_factory.py", import.meta.url), "utf8",
  );
  for (const kind of DISPATCH_KINDS) {
    assert.ok(source.includes(`"${kind}"`), `the dispatch ledger does not know about ${kind}`);
  }
});
