/**
 * One lookup for every user-facing string, in every language.
 *
 * Before this, wording lived in at least fourteen modules across two runtimes,
 * in three different shapes, with three different spellings of the same silent
 * fallback:
 *
 * ```js
 * return table[key] ?? COPY.en[key] ?? key;
 * const entry = TEXT[key]?.[language] ?? TEXT[key]?.en;
 * const value = COPY[locale]?.[key] ?? COPY.en[key] ?? key;
 * ```
 *
 * Two consequences, and the second is the worse one.
 *
 * **A German operator saw an English sentence** where a translation was
 * missing, indistinguishable from a term deliberately left in English. One
 * fallback further and they saw the raw key rendered as UI text. Neither is
 * visible from the outside, which is why this lookup **refuses** instead:
 * a missing key or a missing language throws, and the pseudo-locale run proves
 * that the refusal is reachable.
 *
 * **A third locale was a code edit.** Strings written as `{ de, en }` pairs
 * inside modules mean adding French means editing every module. Catalogs are
 * therefore data, registered per language, and a new language is a new catalog
 * — no module changes, which is what I18N-01 actually asks for.
 *
 * ## Templates, not functions
 *
 * Wording that takes values used to be a function per language:
 *
 * ```js
 * de: (seconds) => `Stand vor ${seconds} s`,
 * ```
 *
 * A function cannot be supplied as data, so this shape is what made a third
 * locale a code edit even where the wording was already bilingual. Templates
 * name their placeholders instead — `"Stand vor {seconds} s"` — and a
 * placeholder with no value throws rather than rendering the word `undefined`
 * into a control-room screen.
 *
 * Named rather than positional, because `(answered, total)` and
 * `(total, answered)` are the same call and a different sentence, and a
 * translator working from the German string cannot see the order.
 */

/** Registered catalogs, keyed by language tag. */
const CATALOGS = new Map();

/** Every key some catalog declares. The union, so completeness is computable. */
const DECLARED_KEYS = new Set();

const KEY_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
// Underscores are allowed because the shipped wording already uses them
// (`{backup_id}`, `{schema_version}`). Narrowing the pattern to camelCase left
// those braces in the rendered sentence, which is a placeholder failing
// silently — the exact defect this module exists to remove.
const PLACEHOLDER_PATTERN = /\{([a-z][a-zA-Z0-9_]*)\}/gu;

/**
 * Register one language's catalog.
 *
 * Keys are `namespace.name`, enforced rather than conventional: a flat key
 * space is where two surfaces silently share a string and one of them then
 * changes it.
 */
export function registerCatalog(language, entries) {
  if (typeof language !== "string" || language.length === 0) {
    throw new Error(`catalog: language must be a non-empty string, got ${JSON.stringify(language)}`);
  }
  if (CATALOGS.has(language)) {
    throw new Error(`catalog: ${language} is already registered`);
  }
  const table = new Map();
  for (const [key, value] of Object.entries(entries)) {
    if (!KEY_PATTERN.test(key)) {
      throw new Error(`catalog ${language}: "${key}" is not a namespace.name key`);
    }
    if (typeof value !== "string") {
      throw new Error(`catalog ${language}: "${key}" must be a string, got ${typeof value}`);
    }
    table.set(key, value);
    DECLARED_KEYS.add(key);
  }
  CATALOGS.set(language, table);
  return table;
}

/** The languages that have a catalog, sorted so the order is not registration order. */
export function languages() {
  return [...CATALOGS.keys()].sort();
}

/** Every key any catalog declares. The union is what completeness is measured against. */
export function declaredKeys() {
  return [...DECLARED_KEYS].sort();
}

/**
 * Which keys each language is missing.
 *
 * Completeness is **computed** from the catalogs rather than asserted about
 * them, which is the whole reason there is one catalog per language instead of
 * fourteen tables: nothing could previously enumerate what "complete" meant.
 */
export function missingKeys() {
  const report = {};
  for (const [language, table] of CATALOGS) {
    report[language] = [...DECLARED_KEYS].filter((key) => !table.has(key)).sort();
  }
  return report;
}

/** Fill `{name}` placeholders, refusing any that has no value. */
export function fill(template, values, context) {
  return template.replace(PLACEHOLDER_PATTERN, (_match, name) => {
    if (!Object.hasOwn(values ?? {}, name)) {
      throw new Error(`catalog ${context}: no value for placeholder {${name}}`);
    }
    const value = values[name];
    if (value === null || value === undefined) {
      throw new Error(`catalog ${context}: placeholder {${name}} is ${String(value)}`);
    }
    return String(value);
  });
}

/**
 * Resolve one string.
 *
 * **There is no fallback.** An unknown key and a key with no wording in the
 * requested language both throw, naming what is missing, because the fallback
 * they replace is invisible to everyone except the operator it fails.
 */
export function text(key, language, values = {}) {
  const table = CATALOGS.get(language);
  if (!table) {
    throw new Error(`catalog: no catalog registered for ${JSON.stringify(language)}`);
  }
  if (!DECLARED_KEYS.has(key)) {
    throw new Error(`catalog: no such key ${JSON.stringify(key)}`);
  }
  const template = table.get(key);
  if (template === undefined) {
    throw new Error(`catalog: ${JSON.stringify(key)} has no ${language} wording`);
  }
  return fill(template, values, `${language}/${key}`);
}

/**
 * One key's raw wording, placeholders unfilled.
 *
 * For code that wants the wording itself rather than a rendered sentence — a
 * parity comparison, a sweep, or a module re-exporting its own table. Filling
 * eagerly would throw on every templated key, since there are no values yet.
 */
export function template(key, language) {
  const table = CATALOGS.get(language);
  if (!table) throw new Error(`catalog: no catalog registered for ${JSON.stringify(language)}`);
  const value = table.get(key);
  if (value === undefined) throw new Error(`catalog: ${JSON.stringify(key)} has no ${language} wording`);
  return value;
}

/** Whether a key exists at all. For tests and sweeps, never as a fallback guard. */
export function hasKey(key) {
  return DECLARED_KEYS.has(key);
}

/**
 * Whether one key has wording in one language.
 *
 * For a module's own load-time guard — that the names *it* renders resolve.
 * Never for choosing what to render: a caller that asks before rendering is one
 * `else` away from reintroducing the silent fallback this module removed.
 */
export function hasWording(key, language) {
  return CATALOGS.get(language)?.has(key) ?? false;
}

/** The placeholders one key's wording uses, per language. For parity checks. */
export function placeholdersOf(key) {
  const report = {};
  for (const [language, table] of CATALOGS) {
    const template = table.get(key);
    if (template === undefined) continue;
    report[language] = [...new Set([...template.matchAll(PLACEHOLDER_PATTERN)].map((m) => m[1]))].sort();
  }
  return report;
}

/** Reset. Test-only: a module-load-time registry cannot be re-registered otherwise. */
export function resetCatalogs() {
  CATALOGS.clear();
  DECLARED_KEYS.clear();
}
