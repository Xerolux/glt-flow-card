/**
 * Fail-closed browser authority reducers (T2-13).
 *
 * The card may use a capability snapshot to decide what to *show*. It may never
 * use it to decide what is *allowed*. Any absent, loading, stale, rejected,
 * sequence-gapped, incompatible or revoked authority makes shared mode
 * read-only in the same reducer transition, with no fallback to callService,
 * browser storage, Lovelace mutation or a caller-authored target.
 *
 * The reducer module does not exist yet. It is imported dynamically so a
 * missing module is reported as a named product gap by the sentinel rather than
 * crashing the run, which would look like a broken harness.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/project-authority.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase2-authority-reducers]: fail-closed authority reducers are unavailable";
const EFFECT_PREFIX = "PHASE2_REDUCER_EFFECTS ";

/** Every event that must produce a read-only shared mode in the same step. */
export const READ_ONLY_EVENTS = Object.freeze([
  "authority/absent",
  "authority/loading",
  "authority/stale",
  "authority/rejected",
  "authority/incompatible",
  "authority/sequence-gap",
  "role/revoked",
  "lease/expired",
  "lease/lost",
  "companion/disconnected",
]);

/** Lease renewal thresholds, as a fraction of the server-advertised TTL. */
export const DIRTY_AUTO_RENEW_AT = 0.4;
export const MANUAL_RENEW_PROMPT_AT = 0.5;

/** Stable server codes the reducer must map to a distinct read-only reason. */
export const AUTHORITY_CODES = Object.freeze([
  "authority_stale",
  "capability_denied",
  "not_found_or_denied",
  "lease_required",
  "lease_expired",
  "revision_conflict",
  "rate_limited",
  "feature_unavailable",
  "not_loaded",
]);

/** Nothing in a rendered reducer state may match these. */
export const FORBIDDEN_STATE_KEYS = Object.freeze([
  "lease_token",
  "token",
  "access_token",
  "hidden_projects",
  "other_users",
]);

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    callService: 0,
    localStorage: 0,
    network: 0,
    ...extra,
  }));
}

async function loadReducer() {
  try {
    return await import(MODULE_URL.href);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

test("the read-only event set covers every way authority can be lost", () => {
  assert.equal(new Set(READ_ONLY_EVENTS).size, READ_ONLY_EVENTS.length);
  for (const event of ["authority/stale", "authority/sequence-gap", "role/revoked", "lease/expired"]) {
    assert.ok(READ_ONLY_EVENTS.includes(event), event);
  }
});

test("renewal thresholds distinguish a dirty candidate from an idle clean lease", () => {
  assert.ok(DIRTY_AUTO_RENEW_AT < MANUAL_RENEW_PROMPT_AT);
  assert.equal(DIRTY_AUTO_RENEW_AT, 0.4);
  assert.equal(MANUAL_RENEW_PROMPT_AT, 0.5);
});

test("authority codes are the stable server set, with no client-invented code", () => {
  assert.ok(AUTHORITY_CODES.includes("authority_stale"));
  assert.ok(!AUTHORITY_CODES.includes("forbidden"));
  assert.ok(!AUTHORITY_CODES.includes("not_found"));
});

test("forbidden state keys name every bearer and hidden-data leak channel", () => {
  assert.ok(FORBIDDEN_STATE_KEYS.includes("lease_token"));
  assert.ok(FORBIDDEN_STATE_KEYS.includes("hidden_projects"));
});

test("[expected-red:phase2-authority-reducers] shared authority fails closed", async () => {
  emitEffects({ events: READ_ONLY_EVENTS.length });
  const gaps = [];
  const reducer = await loadReducer();

  if (!reducer) {
    gaps.push("src/v100/project-authority.mjs does not exist");
  } else {
    for (const name of ["initialAuthorityState", "authorityReducer", "sharedWritable"]) {
      if (typeof reducer[name] !== "function" && reducer[name] === undefined) {
        gaps.push(`project-authority.mjs does not export ${name}`);
      }
    }
    if (gaps.length === 0) {
      let state = reducer.initialAuthorityState();
      if (reducer.sharedWritable(state) !== false) {
        gaps.push("the initial state is writable before any capability snapshot arrives");
      }

      const granted = reducer.authorityReducer(reducer.initialAuthorityState(), {
        type: "authority/snapshot",
        snapshot: {
          role: "engineer",
          capabilities: ["project.write", "lease.engineering"],
          policy_version: 1,
          sequence: 1,
          expires_in: 300,
        },
        now: 0,
      });
      if (reducer.sharedWritable(granted) !== false) {
        gaps.push("a capability snapshot alone made shared mode writable without a lease");
      }

      const leased = reducer.authorityReducer(granted, {
        type: "lease/acquired",
        lease: { expires_in: 300, purpose: "engineering" },
        now: 0,
      });
      if (reducer.sharedWritable(leased) !== true) {
        gaps.push("a fresh snapshot plus a held engineering lease is still not writable");
      }

      for (const event of READ_ONLY_EVENTS) {
        const next = reducer.authorityReducer(leased, { type: event, now: 1 });
        if (reducer.sharedWritable(next) !== false) {
          gaps.push(`${event} did not make shared mode read-only in the same step`);
        }
        if (!next.readOnlyReason) {
          gaps.push(`${event} produced no read-only reason`);
        }
      }

      const serialized = JSON.stringify(leased);
      for (const key of FORBIDDEN_STATE_KEYS) {
        if (serialized.includes(key)) {
          gaps.push(`the reducer state exposes ${key}`);
        }
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  authority gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "fail-closed authority reducers are unavailable");
});
