/**
 * The Phase-7 corpora carry what the phase needs to be proven against.
 *
 * A corpus is only evidence if it contains the cases that would fail a wrong
 * implementation. This asserts that both corpora do, rather than trusting that
 * whoever generated them remembered.
 *
 * The period corpus is regenerated from the vendored Home Assistant, which is
 * the authority on where a period starts and ends. The Recorder corpus is
 * authored, because no Recorder produces a failure on request.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const periods = JSON.parse(
  readFileSync(new URL("../tests/components/glt_flow_card/fixtures/period_corpus.json", import.meta.url), "utf8"),
);
const recorder = JSON.parse(
  readFileSync(new URL("../tests/components/glt_flow_card/fixtures/recorder_corpus.json", import.meta.url), "utf8"),
);

function span(probe, spec) {
  const entry = periods.entries.find((e) => e.probe === probe && e.spec === spec);
  assert.ok(entry, `no corpus entry for ${probe}/${spec}`);
  return entry.span_hours;
}

test("the period corpus carries both transition directions and an ordinary control", () => {
  const probes = new Set(periods.entries.map((entry) => entry.probe));
  assert.ok(probes.has("spring-forward"));
  assert.ok(probes.has("fall-back"));
  // Without an ordinary day the corpus cannot distinguish a resolver that is
  // correct from one that is wrong every day of the year.
  assert.ok(probes.has("ordinary-summer"));
});

test("the period corpus records the spans the research measured", () => {
  assert.equal(span("spring-forward", "day"), 23);
  assert.equal(span("fall-back", "day"), 25);
  assert.equal(span("ordinary-summer", "day"), 24);
  assert.equal(span("spring-forward", "month"), 743);
  assert.equal(span("fall-back", "month"), 745);
  assert.equal(span("fall-back", "week-mon"), 169);
  assert.equal(span("spring-forward", "week-mon"), 167);
});

test("the period corpus reaches year, which only the calendar spec can answer", () => {
  // The plural statistics command's period enum stops at month. A corpus with
  // no year entry would let an implementation that cannot answer one pass.
  const years = periods.entries.filter((entry) => entry.spec.startsWith("year"));
  assert.ok(years.length >= 2, "the corpus must carry a year and a previous year");
  for (const entry of years) assert.ok(entry.span_hours >= 8760);
});

test("every period corpus instant is canonical to the second, with an offset", () => {
  // Phase 6's parity work agreed on every value and disagreed on every byte,
  // because one runtime writes milliseconds and the other omits them at zero.
  // Fixing the representation in the corpus makes that impossible here.
  const canonical = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
  for (const entry of periods.entries) {
    assert.match(entry.start, canonical, `non-canonical start: ${entry.start}`);
    assert.match(entry.end, canonical, `non-canonical end: ${entry.end}`);
  }
});

test("the period corpus generator is described, not declared as an edge", () => {
  // Phase 5 established the wording and Phase 6 hit the trap anyway: a bare
  // command name in a metadata field was read by the gate as a real graph edge
  // and produced a self-cycle.
  assert.match(periods.note, /^regenerate with /);
});

test("the Recorder corpus carries every fixture class criterion 4 names", () => {
  const classes = new Set(recorder.cases.map((entry) => entry.class));
  for (const required of ["missing", "partial", "stale", "incompatible", "recorder_failure"]) {
    assert.ok(classes.has(required), `the corpus has no ${required} case`);
  }
});

test("the Recorder corpus carries a complete case", () => {
  // A corpus of only failures cannot tell a correct implementation from one
  // that refuses everything.
  const complete = recorder.cases.find((entry) => entry.class === "complete");
  assert.ok(complete);
  assert.equal(complete.expect.coverage, 1);
  assert.equal(complete.expect.gaps, 0);
});

test("the Recorder corpus carries the traps the research found", () => {
  const traps = new Set(recorder.cases.filter((e) => e.class === "trap").map((e) => e.name));
  assert.ok(traps.has("trap-window-precedes-statistic"));
  assert.ok(traps.has("trap-null-sum"));
  assert.ok(traps.has("trap-circular-mean"));
});

test("a Recorder failure expects a stated outcome, not an empty one", () => {
  // The trap this corpus exists to close: a test that feeds a Recorder failure
  // and asserts the series is empty has confirmed the defect rather than
  // caught it, because a correct implementation and a broken one both produce
  // an empty series. Only `source` tells them apart.
  const failure = recorder.cases.find((entry) => entry.class === "recorder_failure");
  assert.equal(failure.expect.source, "unavailable");
  assert.equal(failure.expect.value, null);
});

test("every Recorder corpus case says which defect it exists to catch", () => {
  for (const entry of recorder.cases) {
    assert.ok(entry.why && entry.why.length > 40, `case ${entry.name} does not say why it exists`);
  }
});
