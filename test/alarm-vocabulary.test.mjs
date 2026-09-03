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
  AlarmScaleRejected,
  MAX_PRIORITY_TIERS,
  MIN_PRIORITY_TIERS,
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
  resolvePriorityScale,
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

// Compared as canonical JSON with sorted keys, not field by field: Phase 3
// found two runtimes agreeing on every value and disagreeing on the bytes, and
// only a canonical comparison exposed it.
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());

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
  // `canonical` is defined at module scope; see the note beside it.
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


/**
 * A site-declared scale, resolved identically by both runtimes (2026-09-03).
 *
 * Phase 6 closed the vocabulary because four components disagreed about what a
 * word meant. That invariant is "exactly one declared vocabulary, read by both
 * runtimes" -- it never required exactly three members, and the phase conflated
 * the two. A site now declares its own scale.
 *
 * The comparison covers **refusals as well as acceptances**, because a scale one
 * runtime rejects and the other accepts is the same class of defect as two
 * runtimes counting differently: the browser would draw a badge row the
 * Companion refuses to serve.
 */
const SCALE_CASES = Object.freeze([
  {},
  { alarm_priorities: undefined },
  { alarm_priorities: ["safety", "critical", "warning", "info"] },
  { alarm_priorities: ["a", "b", "c", "d", "e"], alarm_unknown_severity: "c" },
  { alarm_priorities: ["safety", "critical", "warning", "info"],
    alarm_severity_mapping: { shutdown: "safety", trip: "safety" } },
  { alarm_priorities: ["hoch", "mittel", "niedrig"] },
  { alarm_priorities: ["only"] },
  { alarm_priorities: ["a", "b", "c", "d", "e", "f", "g"] },
  { alarm_priorities: ["a", "a"] },
  { alarm_priorities: ["a", "B"] },
  { alarm_priorities: "nope" },
  { alarm_priorities: ["a", "b"], alarm_severity_mapping: { x: "zz" } },
  { alarm_priorities: ["a", "b"], alarm_unknown_severity: "zz" },
  { alarm_priorities: ["a", "b"], alarm_severity_mapping: [] },
]);

const SCALE_ALARMS = Object.freeze([
  { priority: "shutdown" }, { priority: "fault" }, { severity: "warn" },
  { priority: "nonsense" }, { severity: "" }, {},
]);

function resolveInJavaScript() {
  return SCALE_CASES.map((config) => {
    try {
      const scale = resolvePriorityScale(config);
      const counted = countByPriority(SCALE_ALARMS, scale);
      return {
        ok: true,
        priorities: [...scale.priorities],
        fallback: scale.fallback,
        declared: scale.declared,
        migration: Object.fromEntries(Object.entries(scale.migration).sort()),
        counts: counted.counts,
        unrecognised: counted.unrecognised.map((value) => value ?? null),
      };
    } catch (error) {
      return { ok: false, code: error.code ?? String(error) };
    }
  });
}

test("a site may declare four or five priority tiers", () => {
  const four = resolvePriorityScale({
    alarm_priorities: ["safety", "critical", "warning", "info"],
  });
  assert.deepEqual([...four.priorities], ["safety", "critical", "warning", "info"]);
  assert.equal(four.declared, true);
  // Rank is position, so the new top tier outranks what used to be the top.
  assert.ok(atLeastAsSevere("safety", "critical", four));
  assert.ok(!atLeastAsSevere("critical", "safety", four));
  // And the tiers it kept still read their old data.
  assert.equal(four.migration.fault, "critical");

  const five = resolvePriorityScale({ alarm_priorities: ["a", "b", "c", "d", "e"] });
  assert.equal(five.priorities.length, 5);
});

test("a project that declares nothing is unchanged", () => {
  // The whole backwards-compatibility claim, asserted rather than assumed.
  const scale = resolvePriorityScale({});
  assert.deepEqual([...scale.priorities], [...ALARM_PRIORITIES]);
  assert.equal(scale.fallback, UNKNOWN_SEVERITY_FALLBACK);
  assert.equal(scale.declared, false);
  assert.deepEqual(
    countByPriority(SCALE_ALARMS, scale).counts,
    countByPriority(SCALE_ALARMS).counts,
    "resolving the default scale must equal not resolving one at all",
  );
});

test("an undeclared priority is refused, never silently re-tiered", () => {
  const scale = resolvePriorityScale({ alarm_priorities: ["hoch", "niedrig"] });
  // The failure Phase 6 was right to fear: a stored `critical` on a scale that
  // does not declare it must not quietly become `hoch`.
  assert.throws(() => priorityRank("critical", scale), /unknown alarm priority/u);
  const counted = countByPriority([{ priority: "critical" }], scale);
  assert.deepEqual(counted.unrecognised, ["critical"],
    "an undeclared stored priority must be reported, not absorbed");
});

test("the scale bounds are stated, and enforced at both ends", () => {
  assert.equal(MIN_PRIORITY_TIERS, 2);
  assert.equal(MAX_PRIORITY_TIERS, 6);
  const tiers = (n) => Array.from({ length: n }, (_, i) => `t${i}`);
  assert.throws(() => resolvePriorityScale({ alarm_priorities: tiers(1) }), AlarmScaleRejected);
  assert.throws(() => resolvePriorityScale({ alarm_priorities: tiers(7) }), AlarmScaleRejected);
  assert.ok(resolvePriorityScale({ alarm_priorities: tiers(2) }).declared);
  assert.ok(resolvePriorityScale({ alarm_priorities: tiers(6) }).declared);
});

test("both runtimes resolve every scale, and every refusal, identically", () => {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(process.cwd())})
from custom_components.glt_flow_card import alarm_vocabulary as av
cases = json.loads(${JSON.stringify(JSON.stringify(SCALE_CASES))})
alarms = json.loads(${JSON.stringify(JSON.stringify(SCALE_ALARMS))})
out = []
for config in cases:
    try:
        scale = av.resolve_priority_scale(config)
        counted = av.count_by_priority(alarms, scale)
        out.append({"ok": True, "priorities": list(scale["priorities"]),
                    "fallback": scale["fallback"], "declared": scale["declared"],
                    "migration": dict(sorted(scale["migration"].items())),
                    "counts": counted["counts"],
                    "unrecognised": [v if v is not None else None for v in counted["unrecognised"]]})
    except av.AlarmScaleRejected as error:
        out.append({"ok": False, "code": error.code})
print(json.dumps(out, sort_keys=True))
`;
  const [command, ...args] = pythonCommand().split(" ");
  const python = JSON.parse(execFileSync(command, [...args, "-c", script], { encoding: "utf8" }));
  const javascript = resolveInJavaScript();

  assert.equal(python.length, SCALE_CASES.length);
  // Not vacuous in either direction: the corpus must contain both.
  assert.ok(javascript.some((entry) => entry.ok), "no case was accepted");
  assert.ok(javascript.some((entry) => !entry.ok), "no case was refused");

  for (let index = 0; index < SCALE_CASES.length; index += 1) {
    assert.equal(
      canonical(javascript[index]),
      canonical(python[index]),
      `case ${index} (${JSON.stringify(SCALE_CASES[index])}) differs between runtimes`,
    );
  }
});
