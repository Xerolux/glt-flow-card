/**
 * A contribution is data, and cannot become code (T5-12).
 *
 * The decision behind this file, settled with the user and recorded as F-01 in
 * FUTURE-ROADMAP.md: contributions are pure data interpreted by first-party
 * code. Same-realm JavaScript is not a sandbox, and a Worker behind a message
 * contract is a larger phase than this one.
 *
 * Not executing is necessary and not sufficient. A declarative SVG contribution
 * can still carry `<script>`, an `onload` attribute, an `href` to a remote
 * resource, or a `<foreignObject>` full of markup. So the validator allowlists
 * elements and attributes rather than denylisting the dangerous ones: a
 * denylist is a promise to have thought of everything.
 */
import assert from "node:assert/strict";
import test from "node:test";

const MODULE_URL = new URL("../src/v100/sdk-manifest.mjs", import.meta.url);

const RED_MARKER = "EXPECTED_RED[phase5-sdk]: the data-only contribution format is unavailable";
const EFFECT_PREFIX = "PHASE5_SDK_EFFECTS ";

/** Payloads that must be refused, each with its own reason. */
const HOSTILE = [
  ["script_element", "<svg><script>alert(1)</script></svg>"],
  ["event_handler_attribute", '<svg><circle onload="alert(1)" r="1"/></svg>'],
  ["external_reference", '<svg><image href="https://example.invalid/x.png"/></svg>'],
  ["foreign_object", "<svg><foreignObject><div>x</div></foreignObject></svg>"],
  ["unknown_element", "<svg><marquee>x</marquee></svg>"],
  ["javascript_url", '<svg><a href="javascript:alert(1)"><circle r="1"/></a></svg>'],
];

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, localStorage: 0, callService: 0, evaluation: 0, ...extra,
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

const manifest = (overrides = {}) => ({
  namespace: "acme",
  version: "1.0.0",
  supports_schema_versions: [4],
  contributions: [{
    id: "acme/pump-x", kind: "symbol", payload: { markup: "<svg><circle r='19'/></svg>" },
  }],
  ...overrides,
});

test("every hostile payload names a distinct refusal", () => {
  const reasons = HOSTILE.map(([reason]) => reason);
  assert.equal(new Set(reasons).size, reasons.length);
});

test("[expected-red:phase5-sdk] a contribution cannot carry executable content", async () => {
  emitEffects({ hostile: HOSTILE.length });
  const gaps = [];
  const model = await loadModel();

  if (!model) {
    gaps.push("src/v100/sdk-manifest.mjs does not exist");
  } else {
    const { validateManifest, ALLOWED_ELEMENTS, ALLOWED_ATTRIBUTES, MANIFEST_LIMITS } = model;

    for (const [name, value] of [["ALLOWED_ELEMENTS", ALLOWED_ELEMENTS],
      ["ALLOWED_ATTRIBUTES", ALLOWED_ATTRIBUTES]]) {
      if (!Array.isArray(value) || value.length === 0) {
        gaps.push(`${name} is not an exported allowlist`);
      }
    }
    if (Array.isArray(ALLOWED_ELEMENTS)) {
      for (const forbidden of ["script", "foreignObject", "iframe", "use"]) {
        if (ALLOWED_ELEMENTS.includes(forbidden)) {
          gaps.push(`${forbidden} is on the element allowlist`);
        }
      }
    }

    if (typeof validateManifest !== "function") {
      gaps.push("validateManifest is not exported");
    } else {
      const valid = validateManifest(manifest());
      if (valid?.valid !== true) {
        gaps.push(`a well-formed manifest was refused ("${valid?.errors?.[0]?.code}")`);
      }

      for (const [reason, markup] of HOSTILE) {
        const result = validateManifest(manifest({
          contributions: [{ id: "acme/x", kind: "symbol", payload: { markup } }],
        }));
        if (result?.valid !== false) {
          gaps.push(`${reason} was accepted`);
        } else if (!result.errors?.some((error) => error.code === reason)) {
          gaps.push(`${reason} was refused as "${result.errors?.[0]?.code}"`);
        }
      }

      // An unsupported project schema version refuses rather than degrading.
      const future = validateManifest(manifest({ supports_schema_versions: [99] }));
      if (future?.valid !== false) gaps.push("a manifest for an unsupported schema version was accepted");

      // A namespaced id must actually carry its namespace.
      const stray = validateManifest(manifest({
        contributions: [{ id: "other/pump", kind: "symbol", payload: { markup: "<svg/>" } }],
      }));
      if (stray?.valid !== false) gaps.push("a contribution id outside its own namespace was accepted");

      if (!MANIFEST_LIMITS || typeof MANIFEST_LIMITS.max_bytes !== "number") {
        gaps.push("no manifest size bound is declared");
      } else {
        const huge = validateManifest("x".repeat(MANIFEST_LIMITS.max_bytes + 1));
        if (huge?.valid !== false) gaps.push("an oversized manifest was parsed before being bounded");
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  sdk gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "the data-only contribution format is unavailable");
});
