/**
 * A missing translation is visible, and a silent fallback cannot come back
 * (T10-02).
 *
 * The three spellings this phase removed resolved a missing German string to
 * the English one — indistinguishable from a term deliberately left in English
 * — or to the raw key rendered as UI text. Neither is visible from the outside,
 * which is why a key-count check is not evidence: two catalogs can have
 * identical key sets and one of them can still be rendering the other's words.
 *
 * A pseudo-locale is the check that can see it. Everything localized changes
 * shape; anything that does not is not going through the catalog.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ENTRIES as DE } from "../src/v100/catalog-de.mjs";
import { ENTRIES as EN } from "../src/v100/catalog-en.mjs";
import {
  declaredKeys, hasWording, registerCatalog, text,
} from "../src/v100/catalog-lookup.mjs";
import {
  PSEUDO_LANGUAGE, isPseudo, pseudoCatalog, pseudoString,
} from "../tools/pseudo-locale.mjs";

const EFFECT_PREFIX = "PHASE10_PSEUDO_EFFECTS ";

registerCatalog(PSEUDO_LANGUAGE, pseudoCatalog(EN));

test("the pseudo-locale is generated from the catalog, and covers all of it", () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    keys: declaredKeys().length, network: 0, remote: 0, service: 0, socket: 0,
  }));
  // Derived, not checked in: a checked-in pseudo-locale drifts from the catalog
  // it is testing and then tests nothing.
  const uncovered = declaredKeys().filter((key) => !hasWording(key, PSEUDO_LANGUAGE));
  assert.deepEqual(uncovered, []);
});

test("every pseudo string is visibly not the source string", () => {
  const unmarked = declaredKeys().filter((key) => !isPseudo(text(key, PSEUDO_LANGUAGE, sampleValues(key))));
  assert.deepEqual(unmarked, []);
});

test("placeholders survive the pseudo-locale intact", () => {
  // Accenting `{seconds}` would break interpolation, and a test that breaks the
  // thing it measures measures the break.
  const withPlaceholders = declaredKeys().filter((key) => /\{[a-z]/u.test(EN[key]));
  assert.ok(withPlaceholders.length > 0, "no templated key exists to test");
  for (const key of withPlaceholders) {
    const rendered = text(key, PSEUDO_LANGUAGE, sampleValues(key));
    assert.ok(!/\{[a-z]/u.test(rendered), `${key}: a placeholder survived unfilled`);
    assert.ok(rendered.includes("VALUE"), `${key}: the value did not reach the sentence`);
  }
});

test("a missing key is a throw, not an English sentence", () => {
  // The behaviour under test. If this ever returns a string, the fallback is
  // back and everything above still passes.
  assert.throws(() => text("nothing.here", PSEUDO_LANGUAGE), /no such key/);
  assert.throws(() => text(declaredKeys()[0], "fr"), /no catalog registered/);
});

test("the German catalog is German, not the English one copied", () => {
  // The defect the fallback used to produce, now checkable: if a German entry
  // is byte-identical to its English sibling for most of the catalog, German is
  // not translated — it is English wearing a language tag.
  const identical = declaredKeys().filter((key) => DE[key] === EN[key]);
  const share = identical.length / declaredKeys().length;
  assert.ok(
    share < 0.35,
    `${identical.length} of ${declaredKeys().length} German entries are byte-identical to English`,
  );
});

test("no catalog value still contains a source-code template expression", () => {
  // `${...}` in a value means a function body was captured as a string rather
  // than converted to a named template, which renders the expression literally.
  const leaked = declaredKeys().filter((key) => DE[key].includes("${") || EN[key].includes("${"));
  assert.deepEqual(leaked, []);
});

/** Supply every placeholder a key names, marked so the test can see it arrive. */
function sampleValues(key) {
  const names = [...String(EN[key]).matchAll(/\{([a-z][a-zA-Z0-9_]*)\}/gu)].map((match) => match[1]);
  return Object.fromEntries(names.map((name) => [name, `VALUE_${name}`]));
}

test("pseudoString is deterministic", () => {
  // A pseudo-locale that differs between runs makes a failing assertion
  // unreproducible, which is worse than not having one.
  assert.equal(pseudoString("Coverage {percent} %"), pseudoString("Coverage {percent} %"));
});
