/**
 * The closed Phase-7 vocabularies: periods, aggregates, sources and refusals.
 *
 * Phase 6 closed the alarm vocabulary because four undeclared sets disagreed and
 * an alarm authored as `critical` was counted in no roll-up. Phase 7 closes
 * these before the same thing can happen to a number, and one of the audit's
 * defects is already that shape: `aggregateSeries` ends its ternary chain in an
 * unguarded else, so `aggregate: "p95"` silently computes a mean and reports no
 * error (D12). A vocabulary that accepts anything is not a vocabulary.
 *
 * **Which contract answers which period.** Measured against the vendored Home
 * Assistant and recorded in `07-RESEARCH.md`:
 *
 *   - `day`, `week` and `month` are answered by
 *     `recorder/statistics_during_period`, whose `period` enum is
 *     `5minute | hour | day | week | month`;
 *   - `year` is answered only by `recorder/statistic_during_period`, whose
 *     `CalendarStatisticPeriod` accepts `hour | day | week | month | year` plus
 *     an integer `offset` and a `first_weekday`;
 *   - `custom` is a caller-supplied range, answered by either.
 *
 * Reading the plural command alone concludes, wrongly, that the product must
 * aggregate years itself. Recording the mapping here means nothing downstream
 * has to rediscover it.
 *
 * **Why `change` is in the aggregate set.** It is the Recorder's own reset-aware
 * difference over its reset-corrected running sum, and it is how a counter's
 * consumption for a period is obtained. Treating it as an aggregate alongside
 * `min`, `max` and `mean` keeps the caller from reaching for `sum`, which over
 * instantaneous samples is dimensionally meaningless (D11).
 */

/** The period names a caller may ask for. Closed. */
export const PERIOD_NAMES = Object.freeze(["day", "week", "month", "year", "custom"]);

/** Which Recorder contract answers each period name. Load-bearing. */
export const PERIOD_CONTRACTS = Object.freeze({
  custom: "either",
  day: "statistics",
  month: "statistics",
  week: "statistics",
  year: "statistic",
});

/** The aggregates a series or a total may be computed with. Closed. */
export const AGGREGATES = Object.freeze(["min", "max", "mean", "change", "state"]);

/**
 * Where an answer came from. Closed, and three members rather than two on
 * purpose: "we have no data" and "we did not ask" are different answers, and a
 * series that is empty for the second reason is not evidence about the plant.
 */
export const VALUE_SOURCES = Object.freeze(["statistics", "raw", "unavailable"]);

/** The first day of a week, as Home Assistant's calendar spec spells it. */
export const FIRST_WEEKDAYS = Object.freeze(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

/** Why a request or a computation was refused. Closed, each distinct. */
export const REFUSAL_REASONS = Object.freeze([
  "unknown_period",
  "unknown_aggregate",
  "unknown_source",
  "incompatible_unit",
  "undeclared_meter_model",
  "window_exceeds_limit",
  "entities_exceed_limit",
  "circular_mean_required",
  "outside_statistic_coverage",
]);

/**
 * German and English wording for every member, written out rather than
 * assembled. Phase 6 established the rule: a sentence built from fragments
 * reads like a machine wrote it in whichever language it was not designed in.
 */
export const LABELS = Object.freeze({
  aggregate: {
    change: { de: "Verbrauch", en: "Consumption" },
    max: { de: "Maximum", en: "Maximum" },
    mean: { de: "Mittelwert", en: "Mean" },
    min: { de: "Minimum", en: "Minimum" },
    state: { de: "Zählerstand", en: "Meter reading" },
  },
  period: {
    custom: { de: "Freier Zeitraum", en: "Custom range" },
    day: { de: "Tag", en: "Day" },
    month: { de: "Monat", en: "Month" },
    week: { de: "Woche", en: "Week" },
    year: { de: "Jahr", en: "Year" },
  },
  refusal: {
    circular_mean_required: {
      de: "Diese Größe ist eine Richtung — ein arithmetischer Mittelwert wäre falsch.",
      en: "This quantity is a direction — an arithmetic mean would be wrong.",
    },
    entities_exceed_limit: {
      de: "Die Abfrage nennt mehr Entitäten, als der Standort erlaubt.",
      en: "The query names more entities than the site permits.",
    },
    incompatible_unit: {
      de: "Einheit und Preis passen nicht zusammen — nicht verrechenbar.",
      en: "The unit and the price do not match — they cannot be combined.",
    },
    outside_statistic_coverage: {
      de: "Dieser Zeitraum liegt vor dem ersten aufgezeichneten Wert.",
      en: "This period lies before the first recorded value.",
    },
    undeclared_meter_model: {
      de: "Für diesen Zähler ist nicht festgelegt, ob er zählt oder misst.",
      en: "This meter does not declare whether it counts or measures.",
    },
    unknown_aggregate: {
      de: "Diese Auswertung ist nicht bekannt.",
      en: "That aggregate is not known.",
    },
    unknown_period: {
      de: "Dieser Zeitraum ist nicht bekannt.",
      en: "That period is not known.",
    },
    unknown_source: {
      de: "Diese Quelle ist nicht bekannt.",
      en: "That source is not known.",
    },
    window_exceeds_limit: {
      de: "Der Zeitraum ist länger, als für Rohwerte erlaubt ist.",
      en: "The window is longer than raw values permit.",
    },
  },
  source: {
    raw: { de: "aus Rohwerten", en: "from raw values" },
    statistics: { de: "aus Langzeitstatistik", en: "from long-term statistics" },
    unavailable: { de: "nicht abrufbar", en: "unavailable" },
  },
});

const LANGUAGES = Object.freeze(["de", "en"]);

/**
 * Every member has wording in both languages, checked when the module loads.
 *
 * At load rather than in a test, because a missing label is a defect the moment
 * the module exists, and the surface that would have rendered it is the last
 * place anyone wants to discover it.
 */
for (const [group, members] of [
  ["aggregate", AGGREGATES],
  ["period", PERIOD_NAMES],
  ["refusal", REFUSAL_REASONS],
  ["source", VALUE_SOURCES],
]) {
  for (const member of members) {
    const wording = LABELS[group]?.[member];
    for (const language of LANGUAGES) {
      if (typeof wording?.[language] !== "string" || wording[language].length === 0) {
        throw new Error(`period vocabulary: ${group} "${member}" has no ${language} wording`);
      }
    }
  }
  for (const member of Object.keys(LABELS[group] ?? {})) {
    if (!members.includes(member)) {
      throw new Error(`period vocabulary: ${group} "${member}" is labelled but not a member`);
    }
  }
}

for (const name of PERIOD_NAMES) {
  if (!PERIOD_CONTRACTS[name]) {
    throw new Error(`period vocabulary: period "${name}" names no Recorder contract`);
  }
}

function membership(frozen) {
  const members = new Set(frozen);
  return (value) => typeof value === "string" && members.has(value);
}

export const isPeriodName = membership(PERIOD_NAMES);
export const isAggregate = membership(AGGREGATES);
export const isValueSource = membership(VALUE_SOURCES);
export const isFirstWeekday = membership(FIRST_WEEKDAYS);
export const isRefusalReason = membership(REFUSAL_REASONS);

/**
 * Return the contract that answers a period name, or refuse.
 *
 * Refuses rather than defaulting, because the defect this replaces defaulted:
 * an unrecognised aggregate silently became the mean, and an unrecognised period
 * would silently become whatever the last branch computed.
 */
export function contractFor(period) {
  if (!isPeriodName(period)) {
    throw new Error(`unknown_period: ${JSON.stringify(period)}`);
  }
  return PERIOD_CONTRACTS[period];
}

/** Return the wording for one member in one language. */
export function labelFor(group, member, language = "de") {
  const wording = LABELS[group]?.[member];
  if (!wording) throw new Error(`no wording for ${group} "${member}"`);
  const text = wording[language] ?? wording.en;
  if (!text) throw new Error(`no ${language} wording for ${group} "${member}"`);
  return text;
}

/**
 * The canonical bytes both runtimes must agree on for this vocabulary.
 *
 * Keys are sorted explicitly rather than relying on the order they happen to be
 * written in. `JSON.stringify` preserves insertion order and Python's
 * `sort_keys=True` does not, so an object literal that is alphabetical today
 * would diverge the moment someone inserts a key in the natural place. That is
 * Phase 6's parity lesson in miniature: the two runtimes agreed on every value
 * and disagreed on every byte, and the cause was serialisation both times.
 */
export function vocabularyFingerprint() {
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]),
    );
  };
  return JSON.stringify(sortKeys({
    aggregates: [...AGGREGATES],
    first_weekdays: [...FIRST_WEEKDAYS],
    period_contracts: PERIOD_CONTRACTS,
    periods: [...PERIOD_NAMES],
    refusals: [...REFUSAL_REASONS],
    sources: [...VALUE_SOURCES],
  }));
}
