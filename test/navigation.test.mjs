/**
 * Address-as-state navigation (T4-06, NAV-01).
 *
 * Everything needed to reconstruct a view lives in the URL: state kept only in
 * a component cannot be deep linked, and state kept in both drifts.
 *
 * Back and forward re-resolve through the server rather than replaying a cached
 * view. That costs a round trip per Back press and is the only way Back can be
 * correct after a revocation: the state object a page pushed was serialized by
 * a page that may have held a different authority.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/navigation.mjs", import.meta.url);

const RED_MARKER =
  "EXPECTED_RED[phase4-navigation-reducer]: address-as-state navigation is unavailable";
const EFFECT_PREFIX = "PHASE4_NAV_REDUCER_EFFECTS ";

const WINDOW = Object.freeze({
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-01-02T00:00:00.000Z",
});

/** Addresses that must survive a serialize/parse round trip unchanged. */
export const ROUND_TRIP = Object.freeze([
  { node: ["site-north"], window: null, alarm: null },
  { node: ["site-north", "bldg-north-1", "floor-north-1"], window: null, alarm: null },
  { node: ["site-north", "eq-hp-primary"], window: WINDOW, alarm: null },
  { node: ["site-north", "eq-hp-primary"], window: null, alarm: "alm-hp1-lowflow" },
  { node: ["site-north", "eq-hp-primary"], window: WINDOW, alarm: "alm-hp1-lowflow" },
]);

/** Inputs a parser must refuse rather than partially accept. */
export const HOSTILE = Object.freeze([
  "",
  "/",
  "..",
  "../../etc/passwd",
  "site-north//floor",
  "site-north/%2e%2e/other",
  // A control character smuggled into a path segment.
  `site-north/${String.fromCharCode(10)}segment`,
  `site-north/${String.fromCharCode(0)}segment`,
  `site-north/${"x".repeat(100000)}`,
  Array.from({ length: 64 }, (_, index) => `n${index}`).join("/"),
]);

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

test("the round-trip corpus covers time and alarm context, not only the node", () => {
  assert.ok(ROUND_TRIP.some((address) => address.window));
  assert.ok(ROUND_TRIP.some((address) => address.alarm));
  assert.ok(ROUND_TRIP.some((address) => address.window && address.alarm));
});

test("[expected-red:phase4-navigation-reducer] the address is the state", async () => {
  emitEffects({ addresses: ROUND_TRIP.length, hostile: HOSTILE.length });
  const gaps = [];
  const model = await loadModel();
  if (!model) {
    gaps.push("src/v100/navigation.mjs does not exist");
  } else {
    const { serializeAddress, parseAddress, createNavigation } = model;
    if (typeof serializeAddress !== "function" || typeof parseAddress !== "function") {
      gaps.push("serializeAddress and parseAddress are not both exported");
    } else {
      for (const address of ROUND_TRIP) {
        let parsed = null;
        try {
          parsed = parseAddress(serializeAddress(address));
        } catch (error) {
          gaps.push(`round trip threw for ${JSON.stringify(address)}: ${error.message}`);
          continue;
        }
        if (JSON.stringify(parsed) !== JSON.stringify(address)) {
          gaps.push(`round trip changed ${JSON.stringify(address)} into ${JSON.stringify(parsed)}`);
        }
      }
      for (const hostile of HOSTILE) {
        let accepted = true;
        try {
          parseAddress(hostile);
        } catch {
          accepted = false;
        }
        if (accepted) gaps.push(`a hostile address was accepted: ${hostile.slice(0, 40)}`);
      }
    }

    if (typeof createNavigation !== "function") {
      gaps.push("createNavigation is not exported");
    } else {
      // Back must re-resolve through the server, not replay a cached view.
      const resolved = [];
      const navigation = createNavigation({
        resolve: async (address) => {
          resolved.push(address);
          return { ok: true, address };
        },
      });
      await navigation.go({ node: ["site-north"], window: null, alarm: null });
      await navigation.go({ node: ["site-north", "eq-hp-primary"], window: null, alarm: null });
      const beforeBack = resolved.length;
      await navigation.back();
      if (resolved.length !== beforeBack + 1) {
        gaps.push("back replayed a cached view instead of re-resolving");
      }

      // A self-initiated push must produce exactly one resolve, not two: the
      // reducer must not react to its own pushState.
      const beforeGo = resolved.length;
      await navigation.go({ node: ["site-south"], window: null, alarm: null });
      if (resolved.length !== beforeGo + 1) {
        gaps.push(`one navigation produced ${resolved.length - beforeGo} resolves`);
      }

      // Breadcrumbs come from the server-returned ancestry only.
      if (typeof navigation.breadcrumbs !== "function") {
        gaps.push("breadcrumbs are not exposed");
      } else if (navigation.breadcrumbs({ ancestry: [] }).length !== 0) {
        gaps.push("breadcrumbs were built without a server-returned ancestry");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  navigation gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "address-as-state navigation is unavailable");
});
