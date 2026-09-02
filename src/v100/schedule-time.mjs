/**
 * Resolve a schedule entry to instants, in the site's timezone.
 *
 * Measured against Home Assistant 2026.2.3 for `Europe/Berlin` and recorded in
 * `06-RESEARCH.md` section 4:
 *
 * **Spring forward, 2027-03-28.** Consecutive minute ticks run
 * `01:59+01:00` then `03:00+02:00`. The wall-clock minutes 02:00-02:59 are
 * never delivered, so a 02:30 night setback -- an ordinary time on a German
 * heating plant -- is silently skipped, with no run recorded and nothing
 * surfaced.
 *
 * **Fall back, 2027-10-31.** Every ambiguous minute is delivered *twice*, with
 * different offsets, and both produce the identical `run_key` because
 * `%Y-%m-%dT%H:%M` discards the offset. The second execution is therefore
 * suppressed by the deduplication cache, not by the schedule logic. That is
 * luck, and D8 removes it: `schedule_runs` was never pruned only because its
 * cutoff comparison was broken.
 *
 * So the runner compares *instants*, and the dedupe key carries the resolved
 * instant. Correctness stops resting on a cache.
 *
 * Home Assistant's own `_datetime_exists` and `_datetime_ambiguous` are the
 * right semantics, and they are underscore-prefixed -- free to vanish in a
 * minor release. They are four lines each, so they are implemented here and the
 * Python mirror asserts agreement with Home Assistant's for every corpus date.
 */

/** Statuses a resolution can report. Closed, like every Phase-6 set. */
export const RESOLUTION_STATUSES = Object.freeze(["normal", "nonexistent", "ambiguous"]);

/**
 * What to do when a configured local time does not exist on a date.
 *
 * `skip` is the conservative default and it is a *site* decision: a night
 * setback that silently does not run is bad, and one that runs an hour early
 * without anybody asking is worse. Whichever a site picks, the preview says so
 * in words.
 */
export const NONEXISTENT_POLICIES = Object.freeze(["skip", "after", "before"]);

/** Which occurrence of an ambiguous local time to run. */
export const AMBIGUOUS_POLICIES = Object.freeze(["first", "second", "both"]);

export const DEFAULT_NONEXISTENT_POLICY = "skip";
export const DEFAULT_AMBIGUOUS_POLICY = "first";

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Render one instant in the single canonical spelling both runtimes use.
 *
 * `Date.toISOString()` always writes milliseconds and Python's
 * `datetime.isoformat()` omits them when they are zero, so the two agreed on
 * every *value* and disagreed on every *byte*. Parity is asserted on canonical
 * bytes, so the spelling has to be settled in one place rather than at each
 * comparison -- and settling it here means the run key is stable too.
 */
function canonicalInstant(value) {
  const instant = value instanceof Date ? value : new Date(value);
  return instant.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parts(date, time) {
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(time).split(":").map(Number);
  return { year, month, day, hour, minute };
}

/**
 * Return the offset, in minutes, that `zone` is ahead of UTC at `instant`.
 *
 * `Intl.DateTimeFormat` with a `timeZone` is the only zone database a browser
 * is guaranteed to have, so the offset is *measured* rather than looked up: ask
 * the zone what local time an instant is, and take the difference. This is
 * correct for the half-hour and three-quarter-hour zones too, because nothing
 * here assumes the offset is a whole number of hours.
 */
function offsetMinutes(instant, zone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const read = Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  const asUtc = Date.UTC(
    Number(read.year), Number(read.month) - 1, Number(read.day),
    Number(read.hour) % 24, Number(read.minute), Number(read.second),
  );
  return (asUtc - instant.getTime()) / 60000;
}

/**
 * Return every distinct UTC instant whose local time in `zone` is the target.
 *
 * Zero for a time in the lost hour, two for an ambiguous one, one otherwise.
 * The probes span the day either side so both offsets around a transition are
 * tried; an offset that does not round-trip is not a real occurrence.
 */
export function candidateInstants(date, time, zone) {
  if (!TIME_PATTERN.test(String(time))) {
    throw new RangeError(`not a wall-clock time: ${String(time)}`);
  }
  const { year, month, day, hour, minute } = parts(date, time);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const found = [];
  for (const probe of [naive - 86400000, naive, naive + 86400000]) {
    const offset = offsetMinutes(new Date(probe), zone);
    const instant = new Date(naive - offset * 60000);
    if (offsetMinutes(instant, zone) !== offset) continue;
    const iso = instant.toISOString();
    if (!found.some((entry) => entry.toISOString() === iso)) found.push(instant);
  }
  return found.sort((a, b) => a - b);
}

/** Return whether this local time exists on this date in this zone. */
export function localTimeExists(date, time, zone) {
  return candidateInstants(date, time, zone).length > 0;
}

/** Return whether this local time occurs twice on this date in this zone. */
export function localTimeAmbiguous(date, time, zone) {
  return candidateInstants(date, time, zone).length > 1;
}

/**
 * Resolve one entry on one date to the instants it should run at.
 *
 * Returns a declared `status` in every case. A nonexistent time returns a
 * status and an empty instant list -- never a silent empty result that reads as
 * "nothing scheduled", which is exactly how the defect hid for as long as it
 * did.
 */
export function resolveEntry(entry, date, zone, options = {}) {
  const nonexistent = options.nonexistent ?? DEFAULT_NONEXISTENT_POLICY;
  const ambiguous = options.ambiguous ?? DEFAULT_AMBIGUOUS_POLICY;
  if (!NONEXISTENT_POLICIES.includes(nonexistent)) {
    throw new RangeError(`unknown nonexistent policy: ${nonexistent}`);
  }
  if (!AMBIGUOUS_POLICIES.includes(ambiguous)) {
    throw new RangeError(`unknown ambiguous policy: ${ambiguous}`);
  }

  const time = entry?.time ?? entry?.from;
  if (!time || !TIME_PATTERN.test(String(time))) {
    return { status: "normal", instants: [], candidates: [], reason: "no_time" };
  }

  const candidates = candidateInstants(date, time, zone).map(canonicalInstant);

  if (candidates.length === 0) {
    // The lost hour. `after` and `before` walk the **wall clock** minute by
    // minute to the nearest time that does exist -- not the UTC instant, which
    // is already on the far side of the gap and lands an hour past the answer.
    // Walking rather than shifting by a hard-coded hour matters because not
    // every transition is an hour: Lord Howe's is thirty minutes.
    let instants = [];
    if (nonexistent !== "skip") {
      const { hour, minute } = parts(date, time);
      const configured = hour * 60 + minute;
      for (let step = 1; step <= 240 && instants.length === 0; step += 1) {
        const walked = configured + (nonexistent === "after" ? step : -step);
        if (walked < 0 || walked > 24 * 60 - 1) break;
        const probe = `${String(Math.floor(walked / 60)).padStart(2, "0")}:${
          String(walked % 60).padStart(2, "0")}`;
        const resolved = candidateInstants(date, probe, zone);
        if (resolved.length > 0) {
          // `before` wants the last instant before the gap, `after` the first
          // one past it.
          instants = [canonicalInstant(nonexistent === "before"
            ? resolved[resolved.length - 1]
            : resolved[0])];
        }
      }
    }
    return { status: "nonexistent", instants, candidates: [], policy: nonexistent };
  }

  if (candidates.length > 1) {
    const chosen = ambiguous === "both"
      ? candidates
      : [ambiguous === "second" ? candidates[candidates.length - 1] : candidates[0]];
    return { status: "ambiguous", instants: chosen, candidates, policy: ambiguous };
  }

  return { status: "normal", instants: candidates, candidates };
}

/**
 * Return the deduplication key for one resolved run.
 *
 * Keyed on the **resolved instant**, not on local wall-clock text. The previous
 * key was `{project}:{schedule}:{local %Y-%m-%dT%H:%M}`, which collapsed the two
 * fall-back occurrences into one entry -- and that collapse was the only thing
 * preventing a double fire. Moving the offset into the key is what lets the
 * prune be fixed without reintroducing one.
 *
 * The separator is a space rather than a colon because the previous key's
 * segments were split on a colon that also appears inside a timestamp, which is
 * how D8's prune came to read the *minute* as a date.
 */
export function runKey(projectId, scheduleId, instant) {
  return `${projectId} ${scheduleId} ${canonicalInstant(instant)}`;
}
