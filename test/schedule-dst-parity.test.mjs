/**
 * The browser preview and the Python runner must resolve identically (T6-12).
 *
 * Phase 3's lesson applies directly: two runtimes once agreed on a *verdict*
 * while building different models, and only comparing canonical bytes exposed
 * it. So this compares canonical resolution bytes over a committed corpus of
 * transition dates, not two booleans.
 *
 * An engineer verifies the preview and the plant executes the runner. If those
 * two disagree about 02:30 on a transition date, the verification was of
 * something else.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AMBIGUOUS_POLICIES,
  NONEXISTENT_POLICIES,
  RESOLUTION_STATUSES,
  candidateInstants,
  localTimeAmbiguous,
  localTimeExists,
  resolveEntry,
  runKey,
} from "../src/v100/schedule-time.mjs";
import { buildCorpus, CORPUS_PATH } from "../tools/generate-schedule-parity-corpus.mjs";
import { pythonCommand } from "../tools/python-launcher.mjs";

const EFFECT_PREFIX = "PHASE6_SCHEDULE_EFFECTS ";

/**
 * Zones the corpus must cover.
 *
 * `Pacific/Auckland` is southern-hemisphere, so an implementation assuming the
 * clocks go forward in March is caught. `Australia/Lord_Howe` transitions by
 * thirty minutes, so a lost *hour* assumed anywhere in the arithmetic is wrong
 * there.
 */
const REQUIRED_ZONES = ["Europe/Berlin", "Pacific/Auckland", "Australia/Lord_Howe"];

const corpus = JSON.parse(readFileSync(new URL(`../${CORPUS_PATH}`, import.meta.url), "utf8"));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

test("the committed corpus is what the generator currently produces", () => {
  const built = `${JSON.stringify(canonical(buildCorpus()), null, 2)}\n`;
  const committed = readFileSync(new URL(`../${CORPUS_PATH}`, import.meta.url), "utf8");
  assert.equal(built, committed);
});

test("the corpus exercises every status and every zone that matters", () => {
  const statuses = new Set(corpus.cases.map((entry) => entry.status));
  for (const status of RESOLUTION_STATUSES) {
    assert.ok(statuses.has(status), `the corpus has no ${status} case`);
  }
  for (const zone of REQUIRED_ZONES) {
    assert.ok(corpus.zones.includes(zone), `the corpus has no ${zone} case`);
  }
  assert.ok(corpus.cases.length > 500, "the corpus is too small to be a corpus");
});

test("[expected-red:phase6-schedule-parity] both runtimes resolve identically", () => {
  const script = [
    "import json",
    "from custom_components.glt_flow_card import schedule_time as st",
    "cases = json.load(open('" + CORPUS_PATH + "'))['cases']",
    "out = []",
    "for case in cases:",
    "    resolution = st.resolve_entry(",
    "        {'time': case['time']}, case['date'], case['zone'],",
    "        nonexistent=case['nonexistent'], ambiguous=case['ambiguous'],",
    "    )",
    "    out.append({",
    "        'zone': case['zone'], 'date': case['date'], 'time': case['time'],",
    "        'nonexistent': case['nonexistent'], 'ambiguous': case['ambiguous'],",
    "        'status': resolution['status'],",
    "        'instants': resolution['instants'],",
    "        'candidates': resolution['candidates'],",
    "        'keys': [st.run_key('p', 's', i) for i in resolution['instants']],",
    "    })",
    "print(json.dumps(out, sort_keys=True))",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  const python = JSON.parse(execFileSync(command, [...args, "-c", script], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  }));

  const javascript = corpus.cases.map((entry) => {
    const resolution = resolveEntry({ time: entry.time }, entry.date, entry.zone, {
      nonexistent: entry.nonexistent, ambiguous: entry.ambiguous,
    });
    return {
      zone: entry.zone, date: entry.date, time: entry.time,
      nonexistent: entry.nonexistent, ambiguous: entry.ambiguous,
      status: resolution.status,
      instants: resolution.instants,
      candidates: resolution.candidates,
      keys: resolution.instants.map((instant) => runKey("p", "s", instant)),
    };
  });

  console.log(`${EFFECT_PREFIX}${JSON.stringify({
    cases: javascript.length, zones: corpus.zones.length,
  })}`);

  // Canonical bytes, not a field-by-field walk: a comparison that stops at the
  // first difference reports one disagreement per run, and a comparison of
  // verdicts alone is what Phase 3 found insufficient.
  const left = JSON.stringify(canonical(javascript));
  const right = JSON.stringify(canonical(python));
  if (left !== right) {
    const first = javascript.find((entry, index) => (
      JSON.stringify(canonical(entry)) !== JSON.stringify(canonical(python[index]))
    ));
    assert.fail(`the runtimes disagree, first at ${JSON.stringify(first)}`);
  }
  assert.equal(left, right);
});

test("the two DST predicates agree with Home Assistant's own", () => {
  // Home Assistant's `_datetime_exists` and `_datetime_ambiguous` are the right
  // semantics but underscore-prefixed and free to vanish in a minor release.
  // This is the check that says so when they change, rather than a dependency
  // on a private name.
  const script = [
    "import json",
    "from datetime import datetime",
    "from zoneinfo import ZoneInfo",
    "from homeassistant.util import dt as ha",
    "cases = json.load(open('" + CORPUS_PATH + "'))['cases']",
    "seen, out = set(), []",
    "for case in cases:",
    "    key = (case['zone'], case['date'], case['time'])",
    "    if key in seen:",
    "        continue",
    "    seen.add(key)",
    "    y, m, d = (int(p) for p in case['date'].split('-'))",
    "    hh, mm = (int(p) for p in case['time'].split(':'))",
    "    moment = datetime(y, m, d, hh, mm, tzinfo=ZoneInfo(case['zone']))",
    "    out.append({",
    "        'zone': case['zone'], 'date': case['date'], 'time': case['time'],",
    "        'exists': ha._datetime_exists(moment),",
    "        'ambiguous': ha._datetime_ambiguous(moment),",
    "    })",
    "print(json.dumps(out, sort_keys=True))",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  const reference = JSON.parse(execFileSync(command, [...args, "-c", script], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  }));

  for (const entry of reference) {
    assert.equal(
      localTimeExists(entry.date, entry.time, entry.zone), entry.exists,
      `exists disagrees for ${entry.zone} ${entry.date} ${entry.time}`,
    );
    assert.equal(
      localTimeAmbiguous(entry.date, entry.time, entry.zone), entry.ambiguous,
      `ambiguous disagrees for ${entry.zone} ${entry.date} ${entry.time}`,
    );
  }
  // And the reference itself must contain both edge cases, or this test is
  // agreeing with Home Assistant about nothing interesting.
  assert.ok(reference.some((entry) => !entry.exists), "no nonexistent reference case");
  assert.ok(reference.some((entry) => entry.ambiguous), "no ambiguous reference case");
});

test("a nonexistent time returns a status, never a silent empty result", () => {
  const resolution = resolveEntry({ time: "02:30" }, "2027-03-28", "Europe/Berlin");
  assert.equal(resolution.status, "nonexistent");
  assert.deepEqual(resolution.instants, []);
  // An empty list with `status: "normal"` is what let the defect hide: it reads
  // as "nothing scheduled" rather than "this cannot run".
  assert.notEqual(resolution.status, "normal");
});

test("the two fall-back occurrences produce different run keys", () => {
  // This is what moves correctness out of the dedupe cache. The previous key
  // collapsed them, and that collapse was the only thing preventing a double
  // fire -- so fixing D8's prune would have reintroduced one.
  const resolution = resolveEntry(
    { time: "02:30" }, "2027-10-31", "Europe/Berlin", { ambiguous: "both" },
  );
  assert.equal(resolution.candidates.length, 2);
  const keys = resolution.instants.map((instant) => runKey("p", "s", instant));
  assert.equal(new Set(keys).size, 2);
});

test("a run key is stable however the instant is spelled", () => {
  const iso = "2027-10-31T00:30:00.000Z";
  assert.equal(runKey("p", "s", iso), runKey("p", "s", new Date(iso)));
  assert.equal(runKey("p", "s", iso), runKey("p", "s", "2027-10-31T02:30:00+02:00"));
});

test("an undeclared policy raises rather than silently choosing one", () => {
  assert.throws(
    () => resolveEntry({ time: "02:30" }, "2027-03-28", "Europe/Berlin", { nonexistent: "guess" }),
    /unknown nonexistent policy/,
  );
  assert.throws(
    () => resolveEntry({ time: "02:30" }, "2027-10-31", "Europe/Berlin", { ambiguous: "either" }),
    /unknown ambiguous policy/,
  );
  for (const policy of NONEXISTENT_POLICIES) {
    assert.doesNotThrow(() => resolveEntry(
      { time: "02:30" }, "2027-03-28", "Europe/Berlin", { nonexistent: policy },
    ));
  }
  for (const policy of AMBIGUOUS_POLICIES) {
    assert.doesNotThrow(() => resolveEntry(
      { time: "02:30" }, "2027-10-31", "Europe/Berlin", { ambiguous: policy },
    ));
  }
});

test("a malformed wall-clock time is refused, not coerced", () => {
  for (const time of ["tea", "25:00", "2:30", "02:60", ""]) {
    assert.throws(() => candidateInstants("2027-06-15", time, "Europe/Berlin"), RangeError, time);
  }
});
