/**
 * Formatting refuses rather than guessing, and plurals are data (T10-04, T10-05).
 *
 * The defect this replaces put two date formats on one control-room screen:
 * `formatDateTime` fell back to `new Date(value).toLocaleString()`, the
 * *viewer's* locale, on any error. `03/09` and `09/03` are the same instant
 * written two ways, and nothing said which was which.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  PLURAL_CATEGORIES, UNIT_SEPARATOR, UNREADABLE, formatDateTime, formatMeasurement, formatNumber,
  pluralCategoriesOf, pluralCategory, resolveLocale,
} from "../src/v100/locale-format.mjs";

const EFFECT_PREFIX = "PHASE10_LOCALE_EFFECTS ";
const INSTANT = "2026-03-09T07:05:00Z";

test("a locale comes from configuration or is refused", () => {
  console.log(EFFECT_PREFIX + JSON.stringify({ network: 0, remote: 0, service: 0, socket: 0 }));
  assert.equal(resolveLocale("de-DE"), "de-DE");
  assert.equal(resolveLocale("en-GB"), "en-GB");
  // Not the browser's, not a hardcoded default: nothing.
  assert.equal(resolveLocale(""), null);
  assert.equal(resolveLocale(undefined), null);
  assert.equal(resolveLocale("nonsense locale"), null);
});

test("a formatter that cannot format refuses instead of changing locale", () => {
  // The behaviour under test. If any of these returns a string, the screen can
  // carry a timestamp in a locale nobody chose.
  assert.equal(formatDateTime(INSTANT, undefined), UNREADABLE);
  assert.equal(formatDateTime(INSTANT, "nonsense locale"), UNREADABLE);
  assert.equal(formatDateTime("not a date", "de-DE"), UNREADABLE);
  assert.equal(formatNumber(1234.5, undefined), UNREADABLE);
  assert.equal(formatNumber(Number.NaN, "de-DE"), UNREADABLE);
  assert.equal(formatNumber(Number.POSITIVE_INFINITY, "de-DE"), UNREADABLE);
});

test("the same instant formats differently per locale, and both are the configured one", () => {
  const german = formatDateTime(INSTANT, "de-DE", "UTC");
  const british = formatDateTime(INSTANT, "en-GB", "UTC");
  const american = formatDateTime(INSTANT, "en-US", "UTC");
  for (const rendered of [german, british, american]) {
    assert.notEqual(rendered, UNREADABLE);
    assert.match(rendered, /2026/u);
  }
  // 09/03 and 03/09 are the same instant written two ways. That is exactly why
  // the fallback was dangerous, and why this test asserts they differ.
  assert.notEqual(german, american);
});

test("a number carries its locale's separators", () => {
  assert.equal(formatNumber(1234.5, "de-DE", { decimals: 1 }), "1.234,5");
  assert.equal(formatNumber(1234.5, "en-GB", { decimals: 1 }), "1,234.5");
});

test("a unit is appended with a no-break space, never dropped", () => {
  // Plant units are mostly outside CLDR's sanctioned list, and a formatter that
  // silently drops an unknown one produces a number with no unit — which Phase 7
  // spent a phase refusing to display.
  assert.equal(formatMeasurement(62.5, "°Kh", "de-DE", { decimals: 1 }), `62,5${UNIT_SEPARATOR}°Kh`);
  assert.equal(formatMeasurement(3, "kWh/m²", "en-GB"), `3${UNIT_SEPARATOR}kWh/m²`);
  // The separator is a no-break space on purpose: a number that wraps away from
  // its unit is a number with no unit on the line the reader is looking at.
  assert.equal(UNIT_SEPARATOR, "\u00a0");
  assert.ok(!formatMeasurement(1, "bar", "de-DE").includes(" "), "an ordinary space would allow a wrap");
  assert.equal(formatMeasurement(1, "", "de-DE"), "1");
  assert.equal(formatMeasurement(Number.NaN, "bar", "de-DE"), UNREADABLE);
});

test("plural selection is a CLDR category, not a conditional", () => {
  assert.equal(pluralCategory(1, "de-DE"), "one");
  assert.equal(pluralCategory(0, "de-DE"), "other");
  assert.equal(pluralCategory(2, "de-DE"), "other");
  for (const category of PLURAL_CATEGORIES) {
    assert.ok(typeof category === "string" && category.length > 0);
  }
});

test("a locale with more than two plural forms needs no code change", () => {
  // The point of the whole plan. Polish has one/few/many/other; Arabic has all
  // six. If either came back with two forms, the catalog could not express them
  // and adding that locale would be a code edit after all.
  const polish = pluralCategoriesOf("pl-PL");
  assert.ok(polish.length > 2, `Polish reported ${polish.join(", ")}`);
  assert.ok(polish.includes("few") && polish.includes("many"));

  const arabic = pluralCategoriesOf("ar-EG");
  assert.ok(arabic.length > polish.length, `Arabic reported ${arabic.join(", ")}`);
  assert.ok(arabic.includes("zero") && arabic.includes("two"));

  // German and English are the easy pair that made the conditional look fine.
  assert.deepEqual(pluralCategoriesOf("de-DE"), ["one", "other"]);
  assert.deepEqual(pluralCategoriesOf("en-GB"), ["one", "other"]);
});

test("an unresolvable locale still yields a usable plural category", () => {
  // Refusing here would mean a sentence with no noun. `other` is the CLDR
  // fallback every locale defines, so the sentence stays grammatical in the one
  // form that always exists.
  assert.equal(pluralCategory(3, undefined), "other");
  assert.deepEqual(pluralCategoriesOf("nonsense locale"), ["other"]);
});
