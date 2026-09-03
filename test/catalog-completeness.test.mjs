/**
 * Completeness is computed from the catalogs, not asserted about them (T10-01).
 *
 * Before this, wording lived in at least fourteen modules across two runtimes in
 * three different shapes. "Complete German and English catalogs" could not be
 * *checked* for the plainest reason: nothing enumerated what complete meant.
 *
 * Two vacuity guards, because either would let this file pass while proving
 * nothing:
 *
 * - **An empty catalog must fail.** Two empty tables have identical key sets and
 *   satisfy every equality below.
 * - **A catalog with no reachable keys must fail.** A catalog nothing renders is
 *   complete and useless, which is the same defect one level out.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { ENTRIES as DE } from "../src/v100/catalog-de.mjs";
import { ENTRIES as EN } from "../src/v100/catalog-en.mjs";
import { declaredKeys, languages, missingKeys, placeholdersOf, text } from "../src/v100/catalog-lookup.mjs";

const EFFECT_PREFIX = "PHASE10_CATALOG_EFFECTS ";

/** Below this, an "identical key sets" assertion is not evidence of anything. */
const MINIMUM_KEYS = 300;

test("both catalogs are registered and non-trivial", () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    keys: declaredKeys().length, languages: languages().length,
    network: 0, remote: 0, service: 0, socket: 0,
  }));
  assert.deepEqual(languages(), ["de", "en"]);
  assert.ok(
    declaredKeys().length >= MINIMUM_KEYS,
    `only ${declaredKeys().length} keys; an equality over a near-empty catalog proves nothing`,
  );
});

test("neither catalog is missing a key the other declares", () => {
  const missing = missingKeys();
  assert.deepEqual(missing.de, [], `German is missing: ${missing.de.join(", ")}`);
  assert.deepEqual(missing.en, [], `English is missing: ${missing.en.join(", ")}`);
});

test("the two catalogs declare exactly the same keys", () => {
  assert.deepEqual(Object.keys(DE).sort(), Object.keys(EN).sort());
});

test("a template's placeholders are the same in both languages", () => {
  // `{answered} von {total}` and `{total} of {answered}` are the same call and a
  // different sentence, and a translator working from one string cannot see the
  // other's order. A placeholder present in one language and absent in the other
  // is a value that silently never renders.
  const disagreements = [];
  for (const key of declaredKeys()) {
    const placeholders = placeholdersOf(key);
    if (JSON.stringify(placeholders.de) !== JSON.stringify(placeholders.en)) {
      disagreements.push(`${key}: de=${placeholders.de} en=${placeholders.en}`);
    }
  }
  assert.deepEqual(disagreements, []);
});

test("no catalog value is blank", () => {
  // A blank string is a missing translation that passes every key-set check.
  const blank = declaredKeys().filter((key) => DE[key].trim() === "" || EN[key].trim() === "");
  assert.deepEqual(blank, []);
});

test("the lookup refuses rather than falling back", () => {
  // The whole point. The three spellings this replaces resolved a missing key to
  // the English string or to the raw key, and neither is visible to anyone
  // except the operator it fails.
  assert.throws(() => text("sites.site_unreachable", "fr"), /no catalog registered/);
  assert.throws(() => text("nothing.here", "de"), /no such key/);
});

test("a placeholder with no value throws instead of rendering undefined", () => {
  const withPlaceholder = declaredKeys().find((key) => /\{[a-z]/u.test(DE[key]));
  assert.ok(withPlaceholder, "no templated key exists to test");
  assert.throws(() => text(withPlaceholder, "de", {}), /no value for placeholder/);
});

test("every namespace is reachable from a module that renders it", async () => {
  // A catalog nothing renders is complete and useless. Namespaces are checked
  // rather than keys, because a key can legitimately be reached through a
  // computed name.
  const namespaces = [...new Set(declaredKeys().map((key) => key.split(".")[0]))].sort();
  const directory = new URL("../src/v100/", import.meta.url);
  const sources = await Promise.all(
    (await readdir(directory))
      .filter((name) => name.endsWith(".js") || name.endsWith(".mjs"))
      .filter((name) => !name.startsWith("catalog-"))
      .map((name) => readFile(new URL(name, directory), "utf8")),
  );
  const combined = sources.join("\n");
  const unreachable = namespaces.filter((namespace) => !combined.includes(`${namespace}.`));
  assert.deepEqual(unreachable, [], `namespaces nothing renders: ${unreachable.join(", ")}`);
});
