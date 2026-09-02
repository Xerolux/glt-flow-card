/**
 * Formatting that resolves from configuration or refuses (T10-04, T10-05).
 *
 * The shipped card did this:
 *
 * ```js
 * function formatDateTime(value, locale = "de-DE") {
 *   try { return new Intl.DateTimeFormat(locale, {…}).format(new Date(value)); }
 *   catch (_err) { return new Date(value).toLocaleString(); }
 * }
 * ```
 *
 * On any error the timestamp is formatted in the **browser's** locale while the
 * rest of the screen uses the configured one. `03/09` and `09/03` are the same
 * instant written two ways, and nothing on the screen says which is which — an
 * ambiguity defect on a control-room display, not a cosmetic one. The hardcoded
 * `"de-DE"` default has the same shape: a locale the installation never chose.
 *
 * **A formatter that cannot format refuses.** It returns the marked-unreadable
 * sentinel Phase 7 already established for a point it cannot read, rather than
 * inventing a second behaviour for the same situation — the drift this codebase
 * keeps closing.
 *
 * ## Plurals are data
 *
 * `gaps === 1 ? "Lücke" : "Lücken"` is correct for German and English, a code
 * edit for every other locale, and wrong outright for any language with more
 * than two forms. `pluralCategory` returns a CLDR category name, so a locale
 * supplies `_one` / `_few` / `_many` / `_other` catalog entries as data and
 * needs no code.
 */

/**
 * What separates a value from its unit.
 *
 * A no-break space (U+00A0), so the pair never wraps apart at a column edge.
 * Named and escaped rather than typed inline, because an invisible character
 * that matters is one nobody can review in a diff — this one arrived by
 * accident and was nearly kept by accident too.
 */
export const UNIT_SEPARATOR = "\u00a0";

/** What a formatter returns when it cannot format. Phase 7's sentinel, reused. */
export const UNREADABLE = Symbol.for("glt.unreadable");

/** The CLDR plural categories, in the order the specification lists them. */
export const PLURAL_CATEGORIES = Object.freeze([
  "zero", "one", "two", "few", "many", "other",
]);

/**
 * Resolve the locale to format in.
 *
 * From configuration, never from the browser. `navigator.language` is what the
 * *reader's* machine is set to, which on a shared control-room workstation is
 * whoever installed it — and mixing it with the configured language is how one
 * screen ends up carrying two date formats.
 */
export function resolveLocale(configured) {
  if (typeof configured !== "string" || configured.trim() === "") return null;
  try {
    return new Intl.Locale(configured).toString();
  } catch {
    return null;
  }
}

/** Format an instant, or refuse. */
export function formatDateTime(value, configured, timeZone = undefined) {
  const locale = resolveLocale(configured);
  if (!locale) return UNREADABLE;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return UNREADABLE;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit", hour: "2-digit", minute: "2-digit",
      month: "2-digit", timeZone, year: "numeric",
    }).format(instant);
  } catch {
    // A refusal, not the viewer's locale. The caller renders the sentinel.
    return UNREADABLE;
  }
}

/** Format a number, or refuse. */
export function formatNumber(value, configured, { decimals = undefined } = {}) {
  const locale = resolveLocale(configured);
  if (!locale) return UNREADABLE;
  const number = Number(value);
  if (!Number.isFinite(number)) return UNREADABLE;
  try {
    return new Intl.NumberFormat(locale, decimals === undefined ? {} : {
      maximumFractionDigits: decimals, minimumFractionDigits: decimals,
    }).format(number);
  } catch {
    return UNREADABLE;
  }
}

/**
 * Format a measured value with its unit.
 *
 * The unit is appended rather than passed to `Intl.NumberFormat`'s `unit`
 * style, because plant units — bar, kWh/m², ppm, °Kh — are mostly not in the
 * sanctioned CLDR unit list, and a formatter that silently drops an unknown
 * unit produces a number with no unit, which Phase 7 spent a whole phase
 * refusing to display.
 *
 * The separator is a **no-break space**, deliberately. A number that wraps away
 * from its unit at a column edge is a number with no unit on the line the
 * reader is looking at — the same defect by layout instead of by code.
 */
export function formatMeasurement(value, unit, configured, options = {}) {
  const number = formatNumber(value, configured, options);
  if (number === UNREADABLE) return UNREADABLE;
  return unit ? `${number}${UNIT_SEPARATOR}${unit}` : number;
}

/**
 * Which plural form a count takes in one locale.
 *
 * Returns a CLDR category, so the catalog can carry `_one` and `_other` for
 * German and `_one`, `_few`, `_many`, `_other` for a locale that needs them —
 * without a line of code changing.
 */
export function pluralCategory(count, configured, type = "cardinal") {
  const locale = resolveLocale(configured);
  if (!locale) return "other";
  const number = Number(count);
  if (!Number.isFinite(number)) return "other";
  try {
    return new Intl.PluralRules(locale, { type }).select(number);
  } catch {
    return "other";
  }
}

/** The plural forms a locale actually uses. For a catalog completeness check. */
export function pluralCategoriesOf(configured, type = "cardinal") {
  const locale = resolveLocale(configured);
  if (!locale) return ["other"];
  try {
    const rules = new Intl.PluralRules(locale, { type });
    const used = new Set(["other"]);
    for (const sample of [0, 1, 2, 3, 5, 11, 21, 101, 1.5]) used.add(rules.select(sample));
    return PLURAL_CATEGORIES.filter((category) => used.has(category));
  } catch {
    return ["other"];
  }
}
