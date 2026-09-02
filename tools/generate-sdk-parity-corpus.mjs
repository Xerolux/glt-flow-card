/**
 * Record what JavaScript decides about each SDK manifest, for Python to check
 * against (SDK-01, T5-12).
 *
 * The Home Assistant lanes have no `node` binary, so the Companion validator
 * cannot be compared to the browser one by running both. It is compared to a
 * recording instead, and `test/sdk-parity-corpus.test.mjs` keeps the recording
 * honest by regenerating it in the Node suite — where a JavaScript change
 * belongs — and requiring the committed file to be exactly it.
 *
 * The corpus carries the manifests themselves, not just their verdicts. Python
 * reads the inputs from here and validates them itself; a corpus of verdicts
 * alone would need the cases mirrored in two languages, and two mirrored lists
 * are two lists that drift.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { MANIFEST_LIMITS, validateManifest } from "../src/v100/sdk-manifest.mjs";

export const SDK_CORPUS_PATH = resolve(
  import.meta.dirname,
  "../tests/components/glt_flow_card/fixtures/sdk-parity-corpus.json",
);

const symbol = (markup, overrides = {}) => ({
  namespace: "acme",
  version: "1.0.0",
  supports_schema_versions: [4],
  contributions: [{ id: "acme/pump-x", kind: "symbol", payload: { markup } }],
  ...overrides,
});

const nested = (depth) => {
  let markup = "<circle r='1'/>";
  for (let level = 0; level < depth; level += 1) markup = `<g>${markup}</g>`;
  return `<svg>${markup}</svg>`;
};

/**
 * Each case names the one thing it is about. A case that fails for two reasons
 * proves neither, so the accepted cases differ from the refused ones in exactly
 * the property under test.
 */
export const SDK_PARITY_CASES = Object.freeze([
  ["accepted_minimal", symbol("<svg><circle r='19'/></svg>")],
  ["accepted_full_drawing", symbol(
    "<svg viewBox=\"0 0 64 64\" role=\"img\"><title>Pump</title>"
    + "<defs><linearGradient id=\"g\"><stop offset=\"0\" stop-color=\"#fff\"/></linearGradient></defs>"
    + "<g transform=\"translate(2,2)\" data-part=\"body\"><circle cx=\"32\" cy=\"32\" r=\"19\" fill=\"url(#g)\"/>"
    + "<path d=\"M24 43 L24 21 L44 32 Z\" stroke-width=\"2\"/>"
    + "<text x=\"32\" y=\"36\" text-anchor=\"middle\" font-size=\"9\">P</text></g></svg>",
  )],
  ["accepted_every_kind", {
    namespace: "acme",
    version: "2.1.0",
    supports_schema_versions: [3, 4],
    contributions: [
      { id: "acme/a", kind: "symbol", payload: { markup: "<svg><rect width='4' height='4'/></svg>" } },
      { id: "acme/b", kind: "profile", payload: { equipment_type: "pump" } },
      { id: "acme/c", kind: "template", payload: { objects: [] } },
      { id: "acme/d", kind: "descriptor", payload: { renders: "bar" } },
      { id: "acme/e", kind: "translation", payload: { de: {}, en: {} } },
    ],
  }],
  ["accepted_no_contributions", symbol("<svg/>", { contributions: [] })],

  ["script_element", symbol("<svg><script>alert(1)</script></svg>")],
  ["script_element_uppercase", symbol("<svg><SCRIPT>alert(1)</SCRIPT></svg>")],
  ["event_handler_attribute", symbol('<svg><circle onload="alert(1)" r="1"/></svg>')],
  ["event_handler_mixed_case", symbol('<svg><circle OnLoad="alert(1)" r="1"/></svg>')],
  ["external_reference_href", symbol('<svg><image href="https://example.invalid/x.png"/></svg>')],
  ["external_reference_url_token", symbol('<svg><circle r="1" fill="url(https://example.invalid/g)"/></svg>')],
  ["external_reference_xlink", symbol('<svg><use xlink:href="https://example.invalid/#a"/></svg>')],
  ["fragment_reference_is_fine", symbol('<svg><circle r="1" fill="url(#local)"/></svg>')],
  ["foreign_object", symbol("<svg><foreignObject><div>x</div></foreignObject></svg>")],
  ["unknown_element", symbol("<svg><marquee>x</marquee></svg>")],
  ["unknown_attribute", symbol('<svg><circle r="1" style="fill:red"/></svg>')],
  ["javascript_url", symbol('<svg><a href="javascript:alert(1)"><circle r="1"/></a></svg>')],
  ["javascript_url_entity_encoded", symbol('<svg><a href="java&#115;cript:alert(1)"><circle r="1"/></a></svg>')],
  ["javascript_url_whitespace", symbol('<svg><a href="  java\tscript:alert(1)"><circle r="1"/></a></svg>')],
  ["data_url", symbol('<svg><image href="data:text/html;base64,PHNjcmlwdD4="/></svg>')],
  ["doctype_declaration", symbol('<!DOCTYPE svg [<!ENTITY a "b">]><svg><circle r="1"/></svg>')],
  ["malformed_markup", symbol("<svg></g></svg>")],

  ["markup_too_deep", symbol(nested(MANIFEST_LIMITS.max_markup_depth + 2))],
  ["markup_too_large", symbol(`<svg>${"<circle r='1'/>".repeat(3000)}</svg>`)],

  ["namespace_missing", symbol("<svg/>", { namespace: 42 })],
  ["namespace_malformed", symbol("<svg/>", { namespace: "Acme Corp" })],
  ["version_missing", symbol("<svg/>", { version: null })],
  ["schema_versions_missing", symbol("<svg/>", { supports_schema_versions: [] })],
  ["schema_versions_unsupported", symbol("<svg/>", { supports_schema_versions: [99] })],
  // `true` is an integer in Python and is not in JavaScript. Both runtimes must
  // refuse it, and only one of them would have done so by accident.
  ["schema_versions_boolean", symbol("<svg/>", { supports_schema_versions: [true] })],
  ["contributions_missing", symbol("<svg/>", { contributions: null })],
  ["contribution_outside_namespace", symbol("<svg/>", {
    contributions: [{ id: "other/pump", kind: "symbol", payload: { markup: "<svg/>" } }],
  })],
  ["contribution_namespace_prefix_only", symbol("<svg/>", {
    contributions: [{ id: "acme/", kind: "symbol", payload: { markup: "<svg/>" } }],
  })],
  ["contribution_kind_unknown", symbol("<svg/>", {
    contributions: [{ id: "acme/x", kind: "widget", payload: { markup: "<svg/>" } }],
  })],
  ["contribution_payload_missing", symbol("<svg/>", {
    contributions: [{ id: "acme/x", kind: "symbol" }],
  })],
  ["contribution_not_an_object", symbol("<svg/>", { contributions: ["acme/x"] })],
  ["too_many_contributions", symbol("<svg/>", {
    contributions: Array.from(
      { length: MANIFEST_LIMITS.max_contributions + 1 },
      (_, index) => ({ id: `acme/x${index}`, kind: "symbol", payload: { markup: "<svg/>" } }),
    ),
  })],

  ["manifest_not_an_object", ["not", "a", "manifest"]],
  ["manifest_not_json", "{ this is not json"],
  ["manifest_too_large", "x".repeat(MANIFEST_LIMITS.max_bytes + 1)],
]);

/** The recorded verdicts, as they must appear on disk. */
export function generateSdkParityCorpus() {
  const cases = SDK_PARITY_CASES.map(([name, manifest]) => {
    const verdict = validateManifest(manifest);
    return {
      case: name,
      manifest,
      valid: verdict.valid,
      // Codes only: the paths and details carry values a mirror is free to
      // phrase differently, and demanding they match would be demanding the
      // Python module be a transliteration rather than an implementation.
      codes: [...new Set(verdict.errors.map((error) => error.code))].sort(),
    };
  });
  return `${JSON.stringify({
    format: "glt-flow-card-sdk-parity-corpus",
    report_version: 1,
    limits: MANIFEST_LIMITS,
    cases,
  }, null, 2)}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const serialized = generateSdkParityCorpus();
  if (process.argv.includes("--check")) {
    const { readFile } = await import("node:fs/promises");
    let current = null;
    try {
      current = await readFile(SDK_CORPUS_PATH, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (current !== serialized) {
      process.stderr.write(
        "sdk parity corpus is stale; regenerate it with npm run generate:sdk:parity\n",
      );
      process.exit(1);
    }
    process.stdout.write("sdk parity corpus current\n");
  } else {
    await writeFile(SDK_CORPUS_PATH, serialized);
    process.stdout.write(`sdk parity corpus written: ${SDK_PARITY_CASES.length} cases\n`);
  }
}
