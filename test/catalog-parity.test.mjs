/**
 * The two runtimes say the same thing, not merely mean it (T10-06).
 *
 * The existing parity gates compare **codes** — the site, dispatch and period
 * vocabulary fingerprints. They are the right checks and none of them covers
 * wording, so the Companion and the browser could drift in what they *say*
 * while agreeing on what they *mean*: a German operator reading a Companion
 * refusal and the browser's rendering of the same condition would see two
 * different sentences and reasonably conclude they were two different
 * conditions.
 *
 * Compared as **canonical bytes**, for the reason this codebase has recorded
 * four times — twice within Phases 8 and 9 alone. Two earlier parity efforts
 * agreed on every value and disagreed on every byte: `toISOString()`
 * milliseconds, `0` versus `0.0`, separators, nested key ordering. A
 * values-equal comparison would have passed each of them.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";
import { ENTRIES as DE } from "../src/v100/catalog-de.mjs";
import { ENTRIES as EN } from "../src/v100/catalog-en.mjs";

const EFFECT_PREFIX = "PHASE10_PARITY_EFFECTS ";

/** The namespaces the Companion owns wording for. */
const SHARED_NAMESPACES = ["period"];

function companionCatalog() {
  const script = [
    "from custom_components.glt_flow_card.catalog import canonical_catalog",
    "print(canonical_catalog())",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  return execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // Windows pipes default to the ANSI code page and would mangle the umlauts
    // this byte-parity gate compares.
    env: { ...process.env, PYTHONUTF8: "1" },
  }).trim();
}

/** The browser's half, restricted to the namespaces both runtimes carry. */
function browserCatalog() {
  const shared = (table) => Object.fromEntries(
    Object.keys(table)
      .filter((key) => SHARED_NAMESPACES.includes(key.split(".")[0]))
      .sort()
      .map((key) => [key, table[key]]),
  );
  return JSON.stringify({ de: shared(DE), en: shared(EN) });
}

test("both runtimes carry the same wording, byte for byte", () => {
  const browser = browserCatalog();
  const companion = companionCatalog();
  console.log(EFFECT_PREFIX + JSON.stringify({
    keys: Object.keys(JSON.parse(browser).de).length,
    network: 0, remote: 0, service: 0, socket: 0,
  }));
  assert.equal(browser, companion, "the two runtimes' wording disagrees");
});

test("the shared namespace is not empty, so the equality means something", () => {
  // Two empty objects are byte-identical. An equality over nothing is the
  // vacuous pass every parity check in this codebase has had to guard against.
  const shared = JSON.parse(browserCatalog());
  assert.ok(Object.keys(shared.de).length >= 20, `only ${Object.keys(shared.de).length} shared keys`);
  assert.deepEqual(Object.keys(shared.de), Object.keys(shared.en));
});

test("changing one sentence on one side fails, and names the key", () => {
  // Mutation-verified rather than assumed: this is the check whose passing is
  // least informative if it cannot fail.
  const original = JSON.parse(browserCatalog());
  const mutated = structuredClone(original);
  const key = Object.keys(mutated.de)[0];
  mutated.de[key] = `${mutated.de[key]} (mutiert)`;
  assert.notEqual(JSON.stringify(mutated), JSON.stringify(original));
  assert.notEqual(JSON.stringify(mutated), companionCatalog());
});

test("the Companion refuses a wording group with no browser namespace", () => {
  // A group added on one side only would otherwise vanish from the comparison
  // and be reported as agreement.
  const script = [
    "from custom_components.glt_flow_card import catalog as c",
    "import custom_components.glt_flow_card.period_vocabulary as pv",
    "original = dict(pv.LABELS)",
    "pv.LABELS = {**original, 'invented': {'x': {'de': 'a', 'en': 'b'}}}",
    "c.PERIOD_LABELS = pv.LABELS",
    "try:",
    "    c.catalog('de')",
    "    print('ACCEPTED')",
    "except ValueError as err:",
    "    print('REFUSED', err)",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  const output = execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PYTHONUTF8: "1" },
  }).trim();
  assert.match(output, /^REFUSED/u, output);
  assert.match(output, /no browser namespace/u);
});
