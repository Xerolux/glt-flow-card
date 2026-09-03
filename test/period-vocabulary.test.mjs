/**
 * The period vocabulary is closed, and it refuses rather than defaulting.
 *
 * The defect this replaces defaulted: `aggregateSeries` ends its ternary chain
 * in an unguarded else, so `aggregate: "p95"` silently computes a mean and
 * reports no error (D12). A vocabulary that accepts anything is not a
 * vocabulary, and the test that matters is the one for the unknown member.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";

import {
  AGGREGATES,
  FIRST_WEEKDAYS,
  LABELS,
  PERIOD_CONTRACTS,
  PERIOD_NAMES,
  REFUSAL_REASONS,
  VALUE_SOURCES,
  contractFor,
  isAggregate,
  isPeriodName,
  isValueSource,
  labelFor,
  vocabularyFingerprint,
} from "../src/v100/period-vocabulary.mjs";

test("an unknown period is refused, not defaulted", () => {
  assert.throws(() => contractFor("sometimes"), /unknown_period/);
  assert.throws(() => contractFor(undefined), /unknown_period/);
  assert.equal(isPeriodName("day"), true);
  assert.equal(isPeriodName("fortnight"), false);
});

test("an unknown aggregate is not a member", () => {
  // The exact value that silently became a mean.
  assert.equal(isAggregate("p95"), false);
  assert.equal(isAggregate("mean"), true);
});

test("sum is deliberately absent from the aggregate set", () => {
  // Summing instantaneous samples does not produce watt-hours; the result
  // depends on the sampling rate (D11). `change` is what a counter's
  // consumption is obtained with, and it is reset-aware in the Recorder.
  assert.equal(AGGREGATES.includes("sum"), false);
  assert.equal(AGGREGATES.includes("change"), true);
});

test("year is answered by the singular contract and month by the plural one", () => {
  // Measured in 07-RESEARCH: the plural command's period enum stops at month,
  // and only `recorder/statistic_during_period`'s calendar spec reaches a year.
  // Reading the plural command alone concludes, wrongly, that the product must
  // aggregate years itself.
  assert.equal(contractFor("year"), "statistic");
  assert.equal(contractFor("month"), "statistics");
  assert.equal(contractFor("day"), "statistics");
  assert.equal(contractFor("week"), "statistics");
});

test("every period names a contract", () => {
  for (const period of PERIOD_NAMES) {
    assert.ok(PERIOD_CONTRACTS[period], `period ${period} names no contract`);
  }
});

test("the sources keep no-data and did-not-ask apart", () => {
  assert.deepEqual([...VALUE_SOURCES], ["statistics", "raw", "unavailable"]);
  assert.equal(isValueSource("guess"), false);
});

test("every member has wording in both languages", () => {
  for (const [group, members] of [
    ["aggregate", AGGREGATES],
    ["period", PERIOD_NAMES],
    ["refusal", REFUSAL_REASONS],
    ["source", VALUE_SOURCES],
  ]) {
    for (const member of members) {
      for (const language of ["de", "en"]) {
        assert.ok(labelFor(group, member, language), `${group}/${member}/${language}`);
      }
    }
  }
});

test("nothing is labelled that is not a member", () => {
  // The other direction, which a loop over members alone cannot catch: a label
  // left behind after a member was removed is a set that quietly grew again.
  for (const [group, members] of [
    ["aggregate", AGGREGATES],
    ["period", PERIOD_NAMES],
    ["refusal", REFUSAL_REASONS],
    ["source", VALUE_SOURCES],
  ]) {
    for (const labelled of Object.keys(LABELS[group])) {
      assert.ok(members.includes(labelled), `${group} "${labelled}" is labelled but not a member`);
    }
  }
});

test("every refusal reason is distinct and says something specific", () => {
  assert.equal(new Set(REFUSAL_REASONS).size, REFUSAL_REASONS.length);
  for (const reason of REFUSAL_REASONS) {
    const german = labelFor("refusal", reason, "de");
    // A bare refusal tells an engineer the tool disagrees with them; a reason
    // tells them which of the two is wrong. A one-word reason does neither.
    assert.ok(german.length > 20, `refusal "${reason}" has no real wording`);
  }
});

test("the first weekdays match the calendar spec's spelling", () => {
  assert.deepEqual([...FIRST_WEEKDAYS], ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
});

test("the fingerprint sorts keys so insertion order cannot cause a divergence", () => {
  const fingerprint = vocabularyFingerprint();
  const keys = Object.keys(JSON.parse(fingerprint));
  assert.deepEqual(keys, [...keys].sort());
});

test("both runtimes emit identical vocabulary bytes", () => {
  // Mirroring rather than importing is deliberate, because an import would make
  // a silent divergence invisible. This byte comparison is what makes the
  // mirroring safe, and it lives here rather than in the Companion suite
  // because the Home Assistant lane workspace has neither `src/v100/` nor a
  // `node` binary.
  const script = [
    "from custom_components.glt_flow_card.period_vocabulary import vocabulary_fingerprint",
    "print(vocabulary_fingerprint())",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  const companion = execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  }).trim();
  assert.equal(vocabularyFingerprint(), companion);
});
