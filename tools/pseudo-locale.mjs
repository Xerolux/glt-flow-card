/* Generate a pseudo-locale from the catalogs, at test time, never checked in.
 *
 * A checked-in pseudo-locale drifts from the catalog it is testing and then
 * tests nothing — the same failure as a fixture that stops matching the code it
 * covers, which this codebase has corrected twice. It is derived here instead,
 * deterministically, from `catalog-en.mjs`.
 *
 * Accent-and-pad: `Ëxämplé Téxt » ` stays readable while being unmistakably not
 * the source string. It catches three distinct defects, which is why it is
 * worth more than counting keys:
 *
 * **A missing key**, because the fallback shows through as un-accented text.
 *
 * **A hardcoded string**, because everything localized changes shape and
 * anything that does not is not going through the catalog. This is how the
 * legacy base's hundred strings get *enumerated* rather than estimated.
 *
 * **A layout that assumes German length**, because the padding expands further
 * than German already does — and German is already the long one.
 *
 * Placeholders are left intact. Accenting `{seconds}` would make the value fail
 * to interpolate, and a test that breaks the thing it is measuring measures the
 * break.
 */

/** Latin letters that have an unambiguous accented form, and their mapping. */
const ACCENTS = new Map(Object.entries({
  A: "Ä", C: "Ç", E: "Ë", I: "Ï", N: "Ñ", O: "Ö", S: "Š", U: "Ü", Y: "Ÿ", Z: "Ž",
  a: "ä", c: "ç", e: "ë", i: "ï", n: "ñ", o: "ö", s: "š", u: "ü", y: "ÿ", z: "ž",
}));

/** Marks a pseudo string at both ends, so a truncated one is visible as truncated. */
export const PSEUDO_PREFIX = "»";
export const PSEUDO_SUFFIX = "«";

/** How much longer a pseudo string is, as a fraction. German is already long. */
export const PSEUDO_PADDING = 0.3;

/** The tag this locale registers under. Not a real language, and it looks it. */
export const PSEUDO_LANGUAGE = "zz-pseudo";

const PLACEHOLDER = /\{[a-z][a-zA-Z0-9_]*\}/gu;

/**
 * Turn one source string into its pseudo form.
 *
 * Deterministic, because a pseudo-locale that differs between runs makes a
 * failing assertion unreproducible.
 */
export function pseudoString(source) {
  const segments = [];
  let last = 0;
  for (const match of String(source).matchAll(PLACEHOLDER)) {
    segments.push(accent(String(source).slice(last, match.index)));
    segments.push(match[0]); // Placeholders survive untouched.
    last = match.index + match[0].length;
  }
  segments.push(accent(String(source).slice(last)));
  const body = segments.join("");
  const padding = "·".repeat(Math.ceil(body.length * PSEUDO_PADDING));
  return `${PSEUDO_PREFIX}${body}${padding}${PSEUDO_SUFFIX}`;
}

function accent(text) {
  return [...text].map((character) => ACCENTS.get(character) ?? character).join("");
}

/** Whether one rendered string went through the pseudo-locale. */
export function isPseudo(value) {
  const text = String(value ?? "");
  return text.startsWith(PSEUDO_PREFIX) && text.endsWith(PSEUDO_SUFFIX);
}

/** Build the whole pseudo catalog from a source catalog. */
export function pseudoCatalog(entries) {
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, pseudoString(value)]),
  );
}
