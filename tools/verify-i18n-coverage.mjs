/* Enumerate every user-facing string in the shipped artifact that does not come
 * from a catalog (T10-03).
 *
 * **It fails with the list, never with a count.** A count lets the number creep
 * up unnoticed and gives nobody a work queue; a list shrinks visibly and each
 * line is one thing to move.
 *
 * The sweep reads `dist/glt-flow-card.js` rather than the authored modules,
 * because the shipped artifact is what an operator reads — the same rule every
 * UI phase has followed since Phase 7 shipped a surface whose source grep
 * passed while the screen showed a confident zero.
 *
 * ## What counts as user-facing
 *
 * Text that reaches a person: element text content, and the attributes that are
 * read aloud or displayed — `title`, `placeholder`, `aria-label`, `alt`. Not
 * CSS values, entity domains, format patterns or DOM API strings, which look
 * like text and are not.
 *
 * Distinguishing them from a bundle is not possible in general, so the
 * allowlist below carries a **reason per entry**, and "not UI" is not a reason.
 * An allowlist that can be extended with a shrug is an allowlist that ends up
 * containing the strings someone did not want to move.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = path.join(ROOT, "dist/glt-flow-card.js");

/**
 * Words that make a Latin-script string look like prose rather than an
 * identifier. A string with a space and a lower-case letter after a capital is
 * a sentence; `data-site-state` is not.
 */
const PROSE = /[A-Za-zÄÖÜäöüß][a-zäöüß]+(?:\s+[A-Za-zÄÖÜäöüß0-9][\wäöüß]*){1,}/u;

/** German-specific letters and words, which no identifier in this codebase uses. */
const GERMAN = /[äöüßÄÖÜ]|\b(?:der|die|das|und|nicht|wird|wurde|kann|für|über|Sie|Ihre)\b/u;

/**
 * Literals that are not user-facing, each with the reason it is not.
 *
 * A reason of "not UI" is not a reason: say what the string *is*, so a later
 * reader can check the claim rather than inherit it.
 */
const ALLOWED = new Map(Object.entries({
  "text/css": "a MIME type passed to a Blob constructor",
  "text/plain": "a MIME type passed to a Blob constructor",
  "application/json": "a MIME type passed to a Blob constructor",
  "image/svg+xml": "a MIME type passed to a Blob constructor",
  "font-family": "a CSS property name",
  "box-sizing": "a CSS property name",
  "accent coil": "an SVG class name on a symbol path, set by the `pa` drawing helper",
  "accent rotor": "an SVG class name on a symbol path, set by the `pa` drawing helper",
  "alarm txt": "an SVG class name pair on a symbol's alarm text node",
  "use strict": "the ECMAScript strict-mode directive, emitted by the bundler",
  "false schema": "an ajv diagnostic fragment reaching this region through a generated validator",
  "not active": "a quoted phrase inside a source comment the bundler preserved",
}));

/**
 * The regions of the bundle that are this product's own code.
 *
 * esbuild labels each module it inlines with a `// <path>` banner, so a
 * dependency's own strings — js-yaml's parser diagnostics, ajv's schema error
 * text, zip.js's constants — can be excluded by provenance rather than by
 * guessing from their shape. Sweeping them would produce four hundred findings
 * nobody can act on and bury the hundred that matter.
 *
 * A dependency's user-facing text is a real concern and a different one: it is
 * not translatable by moving a string, and it is 10-09's supply-chain question.
 */
function ownRegions(source) {
  const banners = [...source.matchAll(/^\s*\/\/ ((?:node_modules|src|dist|tools)\/\S+)$/gmu)];
  const regions = [];
  banners.forEach((banner, index) => {
    const from = banner.index;
    const to = index + 1 < banners.length ? banners[index + 1].index : source.length;
    if (!banner[1].startsWith("node_modules/")) regions.push([from, to]);
  });
  // Everything before the first banner is the bundle's own preamble.
  if (banners.length > 0) regions.unshift([0, banners[0].index]);
  return regions;
}

/**
 * Offsets of literals that are a thrown diagnostic rather than screen text.
 *
 * `throw new Error("asset bytes must be a Uint8Array or ArrayBuffer")` is
 * addressed to whoever is reading a stack trace, not to a plant operator.
 * Translating it would be work with no reader, and — worse — it would put a
 * German sentence in front of the person debugging the failure.
 *
 * The distinction is structural rather than a matter of taste: the string is
 * the argument of an `Error` constructor. Anything a person actually reads
 * reaches the DOM through a catalog lookup, and the surfaces this codebase
 * ships already prove that separately: an error a *user* sees is a closed set
 * of reason codes, which Phase 9 made a security property.
 */
function diagnosticRanges(source) {
  const ranges = [];
  for (const match of source.matchAll(/(?:new\s+)?Error\s*\(/gu)) {
    // The literal, if any, starts within the next few characters and the
    // message is the first argument; a generous window covers a template with
    // interpolation without swallowing the following statement.
    ranges.push([match.index, match.index + match[0].length + 400]);
  }
  return ranges;
}

/** Extract quoted literals from the bundle, with their offsets. */
function literals(source) {
  const found = [];
  const pattern = /(["'])((?:\\.|(?!\1)[^\\\n])*)\1/gu;
  for (const match of source.matchAll(pattern)) {
    found.push({ index: match.index, raw: match[2] });
  }
  return found;
}

/** Decode a JS string literal body far enough to judge whether it is prose. */
function decode(raw) {
  try {
    return JSON.parse(`"${raw.replace(/\\'/gu, "'").replace(/"/gu, '\\"')}"`);
  } catch {
    return raw;
  }
}

/**
 * Whether a string is one a person reads.
 *
 * Deliberately conservative in one direction only: a false positive costs an
 * allowlist entry with a reason, and a false negative is a string that never
 * gets translated. The second is the expensive one.
 */
export function looksUserFacing(value) {
  if (value.length < 4 || value.length > 400) return false;
  if (ALLOWED.has(value)) return false;
  if (/^[a-z0-9_-]+$/u.test(value)) return false;          // an identifier or a key
  if (/^[A-Za-z-]+\/[A-Za-z0-9.+-]+$/u.test(value)) return false; // a MIME type or a path
  if (/^[a-z]+\.[a-z_]+$/u.test(value)) return false;      // a catalog key itself
  if (/^https?:/u.test(value)) return false;
  if (/^[\s\p{P}\p{S}\d]+$/u.test(value)) return false;    // punctuation, digits, glyphs
  if (/^--?[a-z]/u.test(value)) return false;              // a CSS custom property or flag
  if (/[{}<>]/u.test(value) && !GERMAN.test(value)) return false; // markup or a template
  // An inline CSS declaration block: `color:#0f766e;background:#ccfbf1;…`. Two
  // or more `property:value` pairs is a shape no sentence has, and excluding it
  // structurally beats an allowlist entry per colour scheme.
  if (/^(?:[a-z-]+\s*:\s*[^;:]+;?\s*){2,}$/u.test(value)) return false;
  // A class-name list: `glt4-btn glt4-danger`. Every token is a lower-case
  // identifier, which prose is not — a sentence has a capital, a digit with a
  // unit, or punctuation somewhere.
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\s+[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/u.test(value)) return false;
  return GERMAN.test(value) || PROSE.test(value);
}

/** The strings in the artifact that a person reads and a catalog does not own. */
export async function findUncatalogued(artifactPath = ARTIFACT) {
  const source = await readFile(artifactPath, "utf8");

  // Everything between the catalog registrations is catalog data by definition.
  const catalogRanges = [];
  for (const match of source.matchAll(/registerCatalog\(\s*"[a-z-]+"/gu)) {
    // The catalog object precedes its registration; take the enclosing frozen
    // literal by walking back to the nearest `Object.freeze({`.
    const before = source.lastIndexOf("Object.freeze({", match.index);
    if (before >= 0) catalogRanges.push([before, match.index]);
  }
  const inCatalog = (index) => catalogRanges.some(([from, to]) => index >= from && index <= to);

  const regions = ownRegions(source);
  const isOurs = (index) => regions.some(([from, to]) => index >= from && index < to);
  const diagnostics = diagnosticRanges(source);
  const isDiagnostic = (index) => diagnostics.some(([from, to]) => index >= from && index <= to);

  const seen = new Map();
  for (const { index, raw } of literals(source)) {
    if (inCatalog(index) || !isOurs(index) || isDiagnostic(index)) continue;
    const value = decode(raw);
    if (!looksUserFacing(value)) continue;
    if (!seen.has(value)) seen.set(value, 0);
    seen.set(value, seen.get(value) + 1);
  }
  return [...seen.entries()]
    .map(([value, occurrences]) => ({ occurrences, value }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

async function main() {
  const uncatalogued = await findUncatalogued();
  if (uncatalogued.length === 0) {
    console.log("PASS every user-facing string in the artifact comes from a catalog");
    return;
  }
  console.log(`FAIL ${uncatalogued.length} user-facing strings do not come from a catalog:\n`);
  for (const { occurrences, value } of uncatalogued) {
    console.log(`  ${JSON.stringify(value)}${occurrences > 1 ? ` (×${occurrences})` : ""}`);
  }
  console.log("\nMove each into `catalog-de.mjs` and `catalog-en.mjs`, or add it to the");
  console.log("allowlist in this file with the reason it is not user-facing.");
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
