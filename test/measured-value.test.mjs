/**
 * The measured value makes the absent case expressible, and refuses to hide it.
 *
 * Six of the audit's defects are one defect: each turns *absent* into a number,
 * and none produces a value an ordinary assertion would flinch at. These tests
 * assert on what the shape says about its own answer, which is the only place
 * that distinction lives.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";

import {
  MEASURED_FIELDS,
  absent,
  canonicalMeasured,
  coverageOf,
  hasValue,
  isComplete,
  measured,
} from "../src/v100/measured-value.mjs";

const complete = { coverage: 1, period: "day", source: "statistics", unit: "kWh", value: 79 };

test("a measured value cannot be built without coverage", () => {
  // The alternative to refusing is defaulting, and a default coverage of 1
  // reintroduces every defect this shape exists to prevent, in one line.
  assert.throws(
    () => measured({ period: "day", source: "statistics", unit: "kWh", value: 1 }),
    /needs a coverage fraction/,
  );
});

test("coverage outside zero to one is refused", () => {
  for (const coverage of [-0.1, 1.1, Number.NaN]) {
    assert.throws(() => measured({ ...complete, coverage }), /coverage/);
  }
});

test("a value with zero coverage is a contradiction and is refused", () => {
  assert.throws(() => measured({ ...complete, coverage: 0, value: 0 }), /not a value/);
});

test("absent is a complete answer, and it is not zero", () => {
  const nothing = absent({ period: "day", source: "unavailable" });
  assert.equal(nothing.value, null);
  assert.equal(nothing.coverage, 0);
  assert.equal(hasValue(nothing), false);
  assert.equal(isComplete(nothing), false);
  // The distinction the whole phase turns on: null is not zero, and a consumer
  // that treats them alike has to do so deliberately.
  assert.notEqual(nothing.value, 0);
});

test("a value is a number or null, never a placeholder", () => {
  for (const value of ["", "n/a", "—", undefined]) {
    assert.throws(() => measured({ ...complete, value }), /number or null/);
  }
});

test("an unknown source or period is refused rather than defaulted", () => {
  assert.throws(() => measured({ ...complete, source: "guess" }), /unknown_source/);
  assert.throws(() => measured({ ...complete, period: "sometimes" }), /unknown_period/);
});

test("the three sources keep no-data and did-not-ask apart", () => {
  const noData = absent({ period: "day", source: "statistics" });
  const notAsked = absent({ period: "day", source: "unavailable" });
  // Same value, same coverage, different meaning. Only `source` carries it.
  assert.equal(noData.value, notAsked.value);
  assert.equal(noData.coverage, notAsked.coverage);
  assert.notEqual(noData.source, notAsked.source);
});

test("every gap names a start and an end", () => {
  assert.throws(() => measured({ ...complete, gaps: [{ start: "x" }] }), /start and an end/);
  const withGap = measured({
    ...complete,
    coverage: 0.5,
    gaps: [{ end: "2027-06-06T00:00:00+02:00", start: "2027-06-03T00:00:00+02:00" }],
  });
  assert.equal(withGap.gaps.length, 1);
  assert.equal(isComplete(withGap), false);
});

test("complete means coverage one and no gaps, and says so at one hundred percent", () => {
  const whole = measured(complete);
  assert.equal(isComplete(whole), true);
  // Stated rather than implied by absence: a chart at 100 % must be able to say
  // so, or the missing badge starts meaning "we forgot to check".
  assert.equal(whole.coverage, 1);
});

test("coverage is computed from expected buckets against returned ones", () => {
  // The Recorder omits empty periods rather than emitting them, so a shorter
  // returned list is the only signal that data is missing.
  assert.equal(coverageOf(7, 7), 1);
  assert.equal(coverageOf(7, 0), 0);
  assert.equal(coverageOf(7, 4), 4 / 7);
  // More returned than expected cannot raise coverage above one.
  assert.equal(coverageOf(7, 99), 1);
  assert.equal(coverageOf(0, 0), 0);
  assert.throws(() => coverageOf(-1, 0), /non-negative integer/);
});

test("the field set is closed and every field is present", () => {
  const entry = measured(complete);
  assert.deepEqual(Object.keys(entry).sort(), [...MEASURED_FIELDS].sort());
});

test("a measured value is frozen, so a consumer cannot quietly drop its coverage", () => {
  const entry = measured(complete);
  assert.throws(() => {
    "use strict";
    entry.coverage = 1;
  });
});

test("canonical bytes sort keys and emit integral numbers without a decimal point", () => {
  // JavaScript has one number type; Python does not. A coverage of exactly zero
  // or one produced identical values and different bytes until both runtimes
  // agreed to emit the integral form.
  assert.equal(
    canonicalMeasured(absent({ period: "day", source: "unavailable" })),
    '{"coverage":0,"gaps":[],"period":"day","resolved_at":null,"source":"unavailable","unit":null,"value":null}',
  );
  assert.equal(
    canonicalMeasured(measured(complete)),
    '{"coverage":1,"gaps":[],"period":"day","resolved_at":null,"source":"statistics","unit":"kWh","value":79}',
  );
});

test("both runtimes emit identical measured bytes", () => {
  // Bytes, not values. Phase 6's parity work agreed on every value and
  // disagreed on every byte, and this shape hit the same rock within the hour:
  // JavaScript has one number type, so a coverage of exactly zero is `0` here
  // and was `0.0` in Python until both agreed to emit the integral form.
  //
  // This assertion lives on the Node side, not in the Companion suite, because
  // the Home Assistant lane workspace contains neither `src/v100/` nor a `node`
  // binary. Node can reach Python; the lane cannot reach Node.
  // `test_lane_portability.py` caught the first attempt at writing it the other
  // way round.
  const cases = [
    { coverage: 0, period: "day", source: "unavailable", unit: null, value: null },
    { coverage: 1, period: "day", source: "statistics", unit: "kWh", value: 79 },
    { coverage: 0.5, period: "month", source: "raw", unit: "m\u00b3", value: 12.5 },
  ];
  const script = [
    "import json",
    "from custom_components.glt_flow_card.measured_value import canonical_measured, measured",
    `cases = json.loads(${JSON.stringify(JSON.stringify(cases))})`,
    "print(json.dumps([canonical_measured(measured(**case)) for case in cases]))",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  const companion = JSON.parse(execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  }));
  const browser = cases.map((entry) => canonicalMeasured(measured(entry)));
  assert.deepEqual(browser, companion);
});
