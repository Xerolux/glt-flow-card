/**
 * Resolve a named period to a start and an end, for display only.
 *
 * The authoritative resolution is the Companion's. This module exists so the
 * axis label and the period picker can show the boundaries *before* a query
 * runs, and it is deliberately incapable of issuing one: it takes a moment and
 * a timezone and returns strings.
 *
 * That split is Phase 6's schedule-preview rule, for the same reason. Resolving
 * in the browser answers for the browser's timezone, and a browser in a
 * different zone from the plant is normal — so the browser may *render* a
 * period and must never *decide* one.
 *
 * `test/period-parity.test.mjs` compares this against the Companion byte for
 * byte over the committed corpus, so a divergence fails rather than drifts.
 */

/** The corpus spec names, mapped to what each asks for. Mirrored, not derived. */
export const SPECS = Object.freeze({
  "day": { kind: "calendar", offset: 0, period: "day" },
  "day-previous": { kind: "calendar", offset: -1, period: "day" },
  "week-mon": { firstWeekday: "mon", kind: "calendar", offset: 0, period: "week" },
  "week-sun": { firstWeekday: "sun", kind: "calendar", offset: 0, period: "week" },
  "month": { kind: "calendar", offset: 0, period: "month" },
  "month-previous": { kind: "calendar", offset: -1, period: "month" },
  "year": { kind: "calendar", offset: 0, period: "year" },
  "year-previous": { kind: "calendar", offset: -1, period: "year" },
  "rolling-24h": { hours: 24, kind: "rolling" },
});

const WEEKDAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/**
 * Return a zone's UTC offset in minutes at an instant.
 *
 * `Intl.DateTimeFormat` with `timeZoneName: "longOffset"` is the only way to
 * ask a browser this without shipping a timezone database. It is asked *at an
 * instant*, which is the whole point: the offset is not a property of a zone,
 * it is a property of a zone at a moment, and every defect in this area comes
 * from treating it as the former.
 */
function offsetMinutesAt(instantMs, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const part = formatter.formatToParts(new Date(instantMs))
    .find(({ type }) => type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Return the UTC instant of a local wall-clock time in a zone.
 *
 * Resolved twice: the first guess uses the offset in force at the naive
 * instant, which is the wrong side of a transition for wall-clock times near
 * one, and the second uses the offset at the instant the first guess produced.
 * Without the second pass a local midnight on a transition day lands an hour
 * out, and a day comes back 24 hours long when the calendar says 23.
 */
function instantOfLocal(parts, timeZone) {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const first = naive - offsetMinutesAt(naive, timeZone) * 60_000;
  return naive - offsetMinutesAt(first, timeZone) * 60_000;
}

/** Return the local calendar date at an instant, in a zone. */
function localDate(instantMs, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const [year, month, day] = formatter.format(new Date(instantMs)).split("-").map(Number);
  return { day, month, year };
}

/** Return the weekday index (Monday = 0) of a local date in a zone. */
function localWeekday(instantMs, timeZone) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
    .format(new Date(instantMs)).toLowerCase();
  return WEEKDAY_INDEX[name] ?? 0;
}

function addDays(date, days) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
}

function addMonths(date, months) {
  const total = date.year * 12 + (date.month - 1) + months;
  return { day: 1, month: (total % 12) + 1, year: Math.floor(total / 12) };
}

function calendarBounds(shape, nowMs, timeZone) {
  const today = localDate(nowMs, timeZone);
  const offset = shape.offset ?? 0;

  if (shape.period === "day") {
    const first = addDays(today, offset);
    return [instantOfLocal(first, timeZone), instantOfLocal(addDays(first, 1), timeZone)];
  }
  if (shape.period === "week") {
    const delta = (localWeekday(nowMs, timeZone) - WEEKDAY_INDEX[shape.firstWeekday ?? "mon"] + 7) % 7;
    const first = addDays(today, -delta + offset * 7);
    return [instantOfLocal(first, timeZone), instantOfLocal(addDays(first, 7), timeZone)];
  }
  if (shape.period === "month") {
    const first = addMonths({ ...today, day: 1 }, offset);
    return [instantOfLocal(first, timeZone), instantOfLocal(addMonths(first, 1), timeZone)];
  }
  if (shape.period === "year") {
    const first = { day: 1, month: 1, year: today.year + offset };
    return [
      instantOfLocal(first, timeZone),
      instantOfLocal({ day: 1, month: 1, year: first.year + 1 }, timeZone),
    ];
  }
  throw new Error(`unknown_period: ${JSON.stringify(shape.period)}`);
}

/**
 * Render an instant the way both runtimes must agree on it.
 *
 * Seconds precision with an explicit offset, built from the zone's own parts
 * rather than from `toISOString()`. Phase 6 lost a cycle to `toISOString()`
 * writing milliseconds where Python omits them at zero; building the string
 * deliberately is what stops that recurring.
 */
export function canonicalInstant(instantMs, timeZone) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const local = formatter.format(new Date(instantMs)).replace(" ", "T");
  const minutes = offsetMinutesAt(instantMs, timeZone);
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  const hh = String(Math.floor(absolute / 60)).padStart(2, "0");
  const mm = String(absolute % 60).padStart(2, "0");
  return `${local}${sign}${hh}:${mm}`;
}

/** Resolve one named period against a moment, in the site timezone. */
export function resolve(spec, { now, timezone }) {
  const shape = SPECS[spec];
  if (!shape) throw new Error(`unknown_period: ${JSON.stringify(spec)}`);
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) throw new Error(`unparseable moment: ${JSON.stringify(now)}`);

  let startMs;
  let endMs;
  if (shape.kind === "rolling") {
    // A duration, measured in absolute time. Every wall-clock form of this is
    // wrong by an hour twice a year.
    endMs = nowMs;
    startMs = nowMs - shape.hours * 3_600_000;
  } else {
    [startMs, endMs] = calendarBounds(shape, nowMs, timezone);
  }

  return {
    end: canonicalInstant(endMs, timezone),
    spec,
    span_hours: Math.round(((endMs - startMs) / 3_600_000) * 10_000) / 10_000,
    start: canonicalInstant(startMs, timezone),
    timezone,
  };
}

/** Return the canonical bytes both runtimes must agree on. */
export function canonical(resolved) {
  const sorted = Object.fromEntries(Object.keys(resolved).sort().map((key) => [key, resolved[key]]));
  return JSON.stringify(sorted);
}
