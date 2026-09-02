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
import { readFile } from "node:fs/promises";
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

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel proves the six hostile shapes it names are refused. These prove
// the allowlist is an allowlist — that a harmless element outside it is refused
// too — and that the bounds run before anything is interpreted.

const sdk = await import(MODULE_URL.href);

test("an element outside the allowlist is refused even when it is harmless", () => {
  // The point of an allowlist is that it does not need to have heard of the
  // thing it refuses. `feGaussianBlur` draws nothing dangerous; it is refused
  // because nobody decided it was safe, which is the whole mechanism.
  for (const element of ["feGaussianBlur", "animate", "set", "style", "use", "marker"]) {
    const errors = sdk.validateMarkup(`<svg><${element}/></svg>`);
    assert.ok(errors.some((error) => error.code === "unknown_element"), element);
  }
  assert.deepEqual(sdk.validateMarkup("<svg><circle r='1'/></svg>"), []);
});

test("an attribute outside the allowlist is refused on an allowed element", () => {
  const errors = sdk.validateMarkup('<svg><circle r="1" style="fill:red" tabindex="0"/></svg>');
  const refused = errors.filter((error) => error.code === "unknown_attribute")
    .map((error) => error.detail.attribute);
  assert.deepEqual(refused.sort(), ["style", "tabindex"]);
});

test("data- attributes pass, because a pack must be able to label its own parts", () => {
  assert.deepEqual(sdk.validateMarkup('<svg><g data-part="rotor"><circle r="1"/></g></svg>'), []);
});

test("bounds are enforced before parse, not after", () => {
  // Each of these refuses on a measurement of the input, and the proof is that
  // the refusal is the only error: nothing downstream ran to add a second one.
  const oversized = sdk.validateManifest("x".repeat(sdk.MANIFEST_LIMITS.max_bytes + 1));
  assert.deepEqual(oversized.errors.map((error) => error.code), ["manifest_too_large"]);

  const wide = sdk.validateMarkup(`<svg>${"<circle r='1'/>".repeat(4000)}</svg>`);
  assert.deepEqual(wide.map((error) => error.code), ["markup_too_large"]);

  let deep = "<circle r='1'/>";
  for (let level = 0; level < sdk.MANIFEST_LIMITS.max_markup_depth + 2; level += 1) {
    deep = `<g>${deep}</g>`;
  }
  assert.ok(sdk.validateMarkup(`<svg>${deep}</svg>`).some((e) => e.code === "markup_too_deep"));
});

test("a doctype is refused outright, so entity expansion never starts", () => {
  const errors = sdk.validateMarkup('<!DOCTYPE svg [<!ENTITY lol "ha">]><svg><circle r="1"/></svg>');
  assert.deepEqual(errors.map((error) => error.code), ["doctype_declaration"]);
});

test("a scheme hidden behind entities or whitespace is still that scheme", () => {
  for (const value of [
    "javascript:alert(1)", "java&#115;cript:alert(1)", "  java\tscript:alert(1)",
    "JaVaScRiPt:alert(1)", "vbscript:msgbox(1)",
  ]) {
    const errors = sdk.validateMarkup(`<svg><a href="${value}"><circle r="1"/></a></svg>`);
    assert.ok(errors.some((error) => error.code === "javascript_url"), value);
  }
  // A data URL is not a JavaScript URL, and saying so would send a pack author
  // looking for script they did not write.
  const data = sdk.validateMarkup('<svg><image href="data:text/html,x"/></svg>');
  assert.ok(data.some((error) => error.code === "data_url"));
});

test("a fragment reference is the one reference that reaches nothing", () => {
  assert.deepEqual(
    sdk.validateMarkup('<svg><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>'
      + '<circle r="1" fill="url(#g)"/></svg>'),
    [],
  );
  assert.ok(sdk.validateMarkup('<svg><circle r="1" fill="url(//evil.invalid/g)"/></svg>')
    .some((error) => error.code === "external_reference"));
});

test("attributes are checked even on an element that is already refused", () => {
  // Telling a pack author only that `a` is not allowed teaches them to reach
  // for an element that is, with the same URL still in it.
  const errors = sdk.validateMarkup('<svg><a href="javascript:x" onload="y"><circle r="1"/></a></svg>');
  const codes = new Set(errors.map((error) => error.code));
  assert.ok(codes.has("unknown_element"));
  assert.ok(codes.has("javascript_url"));
  assert.ok(codes.has("event_handler_attribute"));
});

test("nothing in this module executes, imports, or fetches anything", async () => {
  // The structural half of T5-12: the source cannot reach an evaluator, so a
  // contribution has nowhere to become code even if the validator were wrong.
  const source = await readFile(new URL("../src/v100/sdk-manifest.mjs", import.meta.url), "utf8");
  for (const forbidden of [
    /\beval\s*\(/, /new\s+Function\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/,
    /innerHTML/, /insertAdjacentHTML/, /createElement\s*\(/, /new\s+Worker\s*\(/,
  ]) {
    assert.ok(!forbidden.test(source), `sdk-manifest.mjs reaches ${forbidden}`);
  }
});
