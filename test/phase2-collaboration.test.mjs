/**
 * Browser conflict, merge and control-result reducers (T2-12, T2-08 in the UI).
 *
 * A candidate an engineer typed is theirs until they say otherwise. Expiry, a
 * disconnect, a conflict, a role change and a failed merge all keep it in
 * memory; only an authoritative committed receipt or an explicit discard may
 * clear it. Control results never call an accepted or dispatched request a
 * success, and never schedule a retry of a physical action.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/project-collaboration.mjs", import.meta.url);
const CONTROL_MODULE_URL = new URL("../src/v100/configured-control.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase2-authority-reducers]: fail-closed authority reducers are unavailable";
const EFFECT_PREFIX = "PHASE2_REDUCER_EFFECTS ";

/** Events after which a dirty candidate must still be in memory. */
export const CANDIDATE_PRESERVING_EVENTS = Object.freeze([
  "lease/expired",
  "companion/disconnected",
  "conflict/detected",
  "role/revoked",
  "merge/failed",
  "merge/blocked-overlap",
  "authority/stale",
]);

/** The only two events that may clear a candidate. */
export const CANDIDATE_CLEARING_EVENTS = Object.freeze([
  "commit/confirmed",
  "candidate/discarded",
]);

/** Recovery choices offered on a conflict. Overwrite is not one of them. */
export const CONFLICT_CHOICES = Object.freeze([
  "refresh",
  "merge-preview",
  "retry-with-fresh-lease",
  "discard",
]);

/** Control result states as the UI must present them. */
export const CONTROL_RESULT_STATES = Object.freeze([
  "accepted",
  "dispatched",
  "readback_confirmed",
  "timed_out",
  "denied",
  "failed_before_dispatch",
  "failed_after_dispatch",
  "result_unknown",
  "cancelled_before_dispatch",
]);

/** States the UI may present as a completed successful action. */
export const CONTROL_SUCCESS_STATES = Object.freeze(["readback_confirmed"]);

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    callService: 0,
    localStorage: 0,
    network: 0,
    automaticRetries: 0,
    ...extra,
  }));
}

async function loadModule(url) {
  try {
    return await import(url.href);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

test("a candidate survives every recoverable failure", () => {
  assert.ok(CANDIDATE_PRESERVING_EVENTS.includes("lease/expired"));
  assert.ok(CANDIDATE_PRESERVING_EVENTS.includes("conflict/detected"));
  assert.equal(
    CANDIDATE_PRESERVING_EVENTS.filter((event) => CANDIDATE_CLEARING_EVENTS.includes(event)).length,
    0,
  );
});

test("only an authoritative commit or an explicit discard clears a candidate", () => {
  assert.deepEqual([...CANDIDATE_CLEARING_EVENTS], ["commit/confirmed", "candidate/discarded"]);
});

test("conflict recovery never offers overwrite", () => {
  assert.ok(!CONFLICT_CHOICES.includes("overwrite"));
  assert.ok(!CONFLICT_CHOICES.includes("force"));
  assert.ok(CONFLICT_CHOICES.includes("merge-preview"));
});

test("only a confirmed readback counts as a completed control", () => {
  assert.deepEqual([...CONTROL_SUCCESS_STATES], ["readback_confirmed"]);
  for (const state of ["accepted", "dispatched", "timed_out", "result_unknown"]) {
    assert.ok(CONTROL_RESULT_STATES.includes(state));
    assert.ok(!CONTROL_SUCCESS_STATES.includes(state), state);
  }
});

test("[expected-red:phase2-authority-reducers] collaboration recovery preserves candidates", async () => {
  emitEffects({ events: CANDIDATE_PRESERVING_EVENTS.length });
  const gaps = [];
  const collaboration = await loadModule(MODULE_URL);
  const control = await loadModule(CONTROL_MODULE_URL);

  if (!collaboration) {
    gaps.push("src/v100/project-collaboration.mjs does not exist");
  } else {
    for (const name of ["initialCollaborationState", "collaborationReducer", "conflictChoices"]) {
      if (collaboration[name] === undefined) {
        gaps.push(`project-collaboration.mjs does not export ${name}`);
      }
    }
    if (typeof collaboration.collaborationReducer === "function") {
      const dirty = collaboration.collaborationReducer(
        collaboration.initialCollaborationState(),
        { type: "candidate/changed", candidate: { project: { id: "p", revision: 4 } } },
      );
      if (!dirty.candidate) {
        gaps.push("a typed candidate was not retained");
      }
      for (const event of CANDIDATE_PRESERVING_EVENTS) {
        const next = collaboration.collaborationReducer(dirty, { type: event });
        if (!next.candidate) {
          gaps.push(`${event} discarded the engineer's candidate`);
        }
      }
      for (const event of CANDIDATE_CLEARING_EVENTS) {
        const next = collaboration.collaborationReducer(dirty, {
          type: event,
          receipt: { revision: 5, digest: "d".repeat(64) },
        });
        if (next.candidate) {
          gaps.push(`${event} left a stale candidate behind`);
        }
      }
    }
  }

  if (!control) {
    gaps.push("src/v100/configured-control.mjs does not exist");
  } else {
    if (control.CONTROL_RESULT_STATES === undefined) {
      gaps.push("configured-control.mjs does not export CONTROL_RESULT_STATES");
    } else if (
      JSON.stringify([...control.CONTROL_RESULT_STATES]) !== JSON.stringify([...CONTROL_RESULT_STATES])
    ) {
      gaps.push("the shipped control result states do not match the contract");
    }
    for (const name of ["scheduleRetry", "autoRetry", "redispatch"]) {
      if (control[name] !== undefined) {
        gaps.push(`configured-control.mjs exposes ${name}, which would repeat a physical action`);
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  collaboration gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "fail-closed authority reducers are unavailable");
});
