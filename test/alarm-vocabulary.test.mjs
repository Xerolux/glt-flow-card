/**
 * One closed alarm vocabulary, in both runtimes, with a declared migration.
 *
 * The defect this closes is not subtle once it is named: four undeclared
 * severity vocabularies disagree, and an alarm an engineer marked `critical` is
 * counted by no roll-up in the product. The tests therefore assert *counting*,
 * not membership -- membership was never the thing that was broken.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  ALARM_PRIORITIES,
  ALARM_STATES,
  ESCALATION_STAGE_KINDS,
  NOTIFICATION_OUTCOMES,
  SCHEDULE_BINDING_KINDS,
  SEVERITY_MIGRATION,
  SUPPRESSION_REASONS,
  UNKNOWN_SEVERITY_FALLBACK,
  atLeastAsSevere,
  countByPriority,
  isAlarmState,
  isEscalationStageKind,
  isNotificationOutcome,
  isPriority,
  isScheduleBindingKind,
  isSuppressionReason,
  migrateSeverity,
  priorityRank,
} from "../src/v100/alarm-vocabulary.mjs";
import { pythonCommand } from "../tools/python-launcher.mjs";

const EFFECT_PREFIX = "PHASE6_VOCABULARY_EFFECTS ";

/** The stored strings the four disagreeing sources produce today. */
const STORED_TODAY = ["critical", "warning", "info", "fault"];

const SETS = {
  ALARM_PRIORITIES,
  ALARM_STATES,
  SUPPRESSION_REASONS,
  NOTIFICATION_OUTCOMES,
  ESCALATION_STAGE_KINDS,
  SCHEDULE_BINDING_KINDS,
};

test("every vocabulary is frozen and rejects an unknown member", () => {
  for (const [name, members] of Object.entries(SETS)) {
    assert.ok(Object.isFrozen(members), `${name} is not frozen`);
    assert.throws(() => { members.push("smuggled"); }, `${name} accepted a push`);
  }
  for (const [check, name] of [
    [isPriority, "priority"],
    [isAlarmState, "state"],
    [isSuppressionReason, "suppression"],
    [isNotificationOutcome, "outcome"],
    [isEscalationStageKind, "stage"],
    [isScheduleBindingKind, "binding"],
  ]) {
    assert.equal(check("definitely-not-a-member"), false, name);
    assert.equal(check(undefined), false, name);
  }
});

test("priorities are ordered, and the order is asserted rather than assumed", () => {
  assert.deepEqual(ALARM_PRIORITIES, ["critical", "warning", "info"]);
  assert.equal(priorityRank("critical"), 0);
  assert.ok(atLeastAsSevere("critical", "warning"));
  assert.ok(atLeastAsSevere("warning", "warning"));
  assert.ok(!atLeastAsSevere("info", "warning"));
});

test("an unknown priority raises rather than sorting somewhere", () => {
  // A sentinel rank would order an unknown priority silently, which is how a
  // typo becomes a severity.
  assert.throws(() => priorityRank("kaputt"), /unknown alarm priority/);
  assert.throws(() => atLeastAsSevere("kaputt", "info"), /unknown alarm priority/);
});

test("every string the four sources store maps to a declared member", () => {
  for (const stored of STORED_TODAY) {
    const result = migrateSeverity(stored);
    assert.ok(result.recognised, `${stored} is unmapped`);
    assert.ok(isPriority(result.priority), `${stored} mapped outside the set`);
  }
  // `fault` and `critical` are the same tier under two names in the data that
  // exists; declaring them distinct would re-tier every stored project.
  assert.equal(migrateSeverity("fault").priority, migrateSeverity("critical").priority);
});

test("an unknown stored string maps to the most severe interpretation, and says so", () => {
  const result = migrateSeverity("stufe-rot");
  assert.equal(result.recognised, false);
  assert.equal(result.priority, UNKNOWN_SEVERITY_FALLBACK);
  assert.equal(result.priority, ALARM_PRIORITIES[0]);
  assert.equal(result.stored, "stufe-rot");
  // Guessing low hides a shutdown; guessing high annoys an operator.
  assert.equal(migrateSeverity("").priority, ALARM_PRIORITIES[0]);
  assert.equal(migrateSeverity(null).priority, ALARM_PRIORITIES[0]);
});

test("the migration is case and whitespace tolerant without being a guess", () => {
  assert.deepEqual(migrateSeverity("  CRITICAL "), {
    priority: "critical", recognised: true, stored: "  CRITICAL ",
  });
  // Tolerance is normalisation, not fuzzy matching: a near-miss is unrecognised.
  assert.equal(migrateSeverity("criticals").recognised, false);
});

test("a critical alarm authored in the editor is counted", () => {
  // The whole defect in one assertion. The editor offers exactly these three
  // (`base.js`: Störung / Warnung / Hinweis), and today `navigation.py` counts
  // only ("fault", "warning") -- so the `critical` row is counted by nothing.
  const authored = [
    { severity: "critical" }, { severity: "warning" }, { severity: "info" },
  ];
  const { counts, unrecognised } = countByPriority(authored);
  assert.deepEqual(counts, { critical: 1, warning: 1, info: 1 });
  assert.deepEqual(unrecognised, []);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), authored.length);
});

test("the legacy counting rule would have missed the critical row", () => {
  // Named explicitly so the fix cannot be mistaken for a refactor: the old rule
  // is reproduced here and shown to disagree.
  const legacyCounted = ["fault", "warning"];
  const authored = [{ severity: "critical" }, { severity: "warning" }];
  const legacyTotal = authored.filter((a) => legacyCounted.includes(a.severity)).length;
  const { counts } = countByPriority(authored);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(legacyTotal, 1);
  assert.equal(total, 2);
});

test("no alarm falls out of the count, whatever it stored", () => {
  const alarms = [...STORED_TODAY, "zzz", "", null].map((severity) => ({ severity }));
  const { counts, unrecognised } = countByPriority(alarms);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), alarms.length);
  assert.equal(unrecognised.length, 3);
});

test("priority wins over a legacy severity on the same alarm", () => {
  // During the migration an alarm can carry both. The declared field decides,
  // or the migration would be undone by every read.
  const { counts } = countByPriority([{ priority: "info", severity: "fault" }]);
  assert.deepEqual(counts, { critical: 0, warning: 0, info: 1 });
});

test("[expected-red:phase6-vocabulary] both runtimes export identical vocabularies", () => {
  const script = [
    "import json",
    "from custom_components.glt_flow_card import alarm_vocabulary as v",
    "print(json.dumps({",
    "  'ALARM_PRIORITIES': list(v.ALARM_PRIORITIES),",
    "  'ALARM_STATES': list(v.ALARM_STATES),",
    "  'SUPPRESSION_REASONS': list(v.SUPPRESSION_REASONS),",
    "  'NOTIFICATION_OUTCOMES': list(v.NOTIFICATION_OUTCOMES),",
    "  'ESCALATION_STAGE_KINDS': list(v.ESCALATION_STAGE_KINDS),",
    "  'SCHEDULE_BINDING_KINDS': list(v.SCHEDULE_BINDING_KINDS),",
    "  'SEVERITY_MIGRATION': v.SEVERITY_MIGRATION,",
    "  'UNKNOWN_SEVERITY_FALLBACK': v.UNKNOWN_SEVERITY_FALLBACK,",
    "}, sort_keys=True))",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  const raw = execFileSync(command, [...args, "-c", script], { encoding: "utf8" });
  const python = JSON.parse(raw);
  const javascript = {
    ...Object.fromEntries(Object.entries(SETS).map(([name, members]) => [name, [...members]])),
    SEVERITY_MIGRATION: { ...SEVERITY_MIGRATION },
    UNKNOWN_SEVERITY_FALLBACK,
  };
  // Compared as canonical JSON, not field by field: Phase 3 found two runtimes
  // agreeing on a verdict while building different models, and only comparing
  // canonical bytes exposed it.
  const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
  console.log(`${EFFECT_PREFIX}${JSON.stringify({
    sets: Object.keys(SETS).length,
    priorities: ALARM_PRIORITIES.length,
    migrated: Object.keys(SEVERITY_MIGRATION).length,
  }, null, 0)}`);
  assert.equal(canonical(javascript), canonical(python));
  for (const name of Object.keys(SETS)) {
    assert.deepEqual(javascript[name], python[name], name);
  }
});

test("the migration table covers every value it maps to", () => {
  // A table whose right-hand side leaves the set is a migration to nowhere.
  for (const [stored, mapped] of Object.entries(SEVERITY_MIGRATION)) {
    assert.ok(isPriority(mapped), `${stored} maps to the undeclared ${mapped}`);
  }
  // And every declared priority is reachable, or one of them is unwritable.
  const reachable = new Set(Object.values(SEVERITY_MIGRATION));
  for (const priority of ALARM_PRIORITIES) {
    assert.ok(reachable.has(priority), `no stored string maps to ${priority}`);
  }
});
