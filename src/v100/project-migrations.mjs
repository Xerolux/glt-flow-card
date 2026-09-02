/* Pure, sequential project migrations with canonical receipts. */
import {
  digestCanonicalJson,
  evaluateProjectContract,
} from "./project-contract.mjs";
import { migrateSeverity } from "./alarm-vocabulary.mjs";

export const CURRENT_PROJECT_SCHEMA_VERSION = 5;

const cloneCanonical = (value) => JSON.parse(digestCanonicalJson(value).canonical);

function slug(value) {
  return String(value || "glt-project")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "glt-project";
}

function sourceDocument(rawInput, evidence) {
  if (evidence.canonical !== null) return JSON.parse(evidence.canonical);
  if (typeof rawInput === "string") return JSON.parse(rawInput);
  if (rawInput instanceof Uint8Array) return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawInput));
  return cloneCanonical(rawInput);
}

function stepZeroToOne(source) {
  return cloneCanonical({ ...cloneCanonical(source), schema_version: 1 });
}

function stepOneToTwo(source) {
  const candidate = cloneCanonical(source);
  const name = candidate.project?.name || candidate.title || "GLT Project";
  candidate.schema_version = 2;
  candidate.project = {
    id: candidate.project?.id || slug(name),
    name,
    revision: candidate.project?.revision ?? 0,
    ...(candidate.project || {}),
  };
  return cloneCanonical(candidate);
}

function stepTwoToThree(source) {
  const candidate = cloneCanonical(source);
  candidate.schema_version = 3;
  // Schema 2's `semantic_model` was an unvalidated open object. Schema 3 gives
  // it a validated shape; anything already there is preserved, and an empty
  // node list is added only where none existed. Nothing is dropped, because a
  // migration that discards content an engineer authored is not a migration.
  const existing = candidate.semantic_model;
  const model = existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...existing }
    : {};
  if (!Array.isArray(model.nodes)) model.nodes = [];
  candidate.semantic_model = model;
  return cloneCanonical(candidate);
}

function stepThreeToFour(source) {
  const candidate = cloneCanonical(source);
  candidate.schema_version = 4;
  // Schema 3's profile ports were `openObject` -- entirely unvalidated, so a
  // typo in `direction` survived every check. Schema 4 gives a port a closed
  // shape, which means anything already there has to fit it.
  //
  // Two rules, both chosen so nothing an engineer authored is lost or invented:
  // a field the closed shape does not define is dropped rather than failing the
  // whole migration, because a port carrying an unknown key is a schema-2-era
  // accident and not content; and `kind` is defaulted only where the medium
  // makes it unambiguous. Where it does not, the port is left without one and
  // the compatibility check treats an absent kind as "unknown", which refuses
  // less than a wrong guess would.
  const KNOWN = ["id", "label", "medium", "direction", "side", "kind", "multiplicity"];
  const SIGNAL_MEDIA = ["signal", "control", "status"];
  const POWER_MEDIA = ["power", "electrical", "mains"];
  for (const profile of Array.isArray(candidate.profiles) ? candidate.profiles : []) {
    if (!Array.isArray(profile.ports)) continue;
    profile.ports = profile.ports.map((port) => {
      if (!port || typeof port !== "object") return port;
      const next = {};
      for (const key of KNOWN) if (port[key] !== undefined) next[key] = port[key];
      if (next.kind === undefined) {
        const medium = String(next.medium ?? "");
        if (SIGNAL_MEDIA.includes(medium)) next.kind = "signal";
        else if (POWER_MEDIA.includes(medium)) next.kind = "power";
        else if (medium) next.kind = "process";
      }
      return next;
    });
  }
  // Contributions are new and start empty. An absent collection and an empty
  // one must not differ, or "no packs installed" reads as two different states.
  if (!Array.isArray(candidate.contributions)) candidate.contributions = [];
  return cloneCanonical(candidate);
}

/**
 * Fields schema 5 declares on an alarm. Anything else is quarantined.
 *
 * This list and `schemas/project/5.schema.json` must agree exactly, and
 * `test/v100-migrations.test.mjs` asserts it against the schema file. They
 * disagreed once during development -- `state` was declared and not listed --
 * and the symptom was a Phase-4 roll-up silently counting nothing, because the
 * migration quarantined a field the schema was happy to keep.
 */
const ALARM_FIELDS = [
  "active_states", "condition", "delay_seconds", "entity", "equipment_id",
  "hysteresis", "id", "inactive_states", "label", "legacy", "links",
  "maintenance", "name", "notification", "priority", "state",
];

/** Fields schema 5 declares on a schedule. */
const SCHEDULE_FIELDS = [
  "binding", "data", "days", "enabled", "entity_id", "from", "id", "kind",
  "legacy", "name", "service", "time", "to",
];

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Exported so a test can compare them against the schema they mirror. */
export const SCHEMA_MIRRORED_FIELDS = Object.freeze({
  alarm: Object.freeze([...ALARM_FIELDS]),
  schedule: Object.freeze([...SCHEDULE_FIELDS]),
});

/** Return every alarm collection in a candidate, wherever it lives. */
function alarmCollections(candidate) {
  const collections = [];
  if (Array.isArray(candidate.alarms)) collections.push(candidate.alarms);
  for (const profile of Array.isArray(candidate.profiles) ? candidate.profiles : []) {
    if (profile && Array.isArray(profile.alarms)) collections.push(profile.alarms);
  }
  return collections;
}

/** Move one rejected value into `legacy`, recording what it was called. */
function quarantine(target, key, value, reported) {
  if (!target.legacy || typeof target.legacy !== "object") target.legacy = {};
  target.legacy[key] = value;
  reported.push(key);
}

function migrateAlarm(alarm, reported) {
  if (!alarm || typeof alarm !== "object") return;
  for (const key of Object.keys(alarm)) {
    if (!ALARM_FIELDS.includes(key)) quarantine(alarm, key, alarm[key], reported);
  }
  for (const key of reported) delete alarm[key];

  // The severity vocabulary moves to `priority`, through the same migration
  // table both runtimes read. `severity` itself is quarantined above, so the
  // stored word survives in `legacy` and the receipt can name it.
  const stored = alarm.legacy?.severity ?? alarm.priority;
  if (stored !== undefined || alarm.priority !== undefined) {
    alarm.priority = migrateSeverity(stored).priority;
  }

  // `delay_seconds: "soon"` and `hysteresis: "etwas"` are the two the audit
  // named. A value that cannot be a number is quarantined rather than coerced:
  // coercing "soon" to 0 would turn a visible misconfiguration into an alarm
  // that fires instantly and looks correct.
  for (const [key, coerce] of [["delay_seconds", Math.trunc], ["hysteresis", Number]]) {
    if (alarm[key] === undefined) continue;
    const numeric = typeof alarm[key] === "number" ? alarm[key] : Number(alarm[key]);
    if (!Number.isFinite(numeric) || numeric < 0) {
      quarantine(alarm, key, alarm[key], reported);
      delete alarm[key];
    } else {
      alarm[key] = coerce(numeric);
    }
  }
}

function migrateSchedule(schedule, reported) {
  if (!schedule || typeof schedule !== "object") return;
  const moved = [];
  for (const key of Object.keys(schedule)) {
    if (!SCHEDULE_FIELDS.includes(key)) {
      quarantine(schedule, key, schedule[key], reported);
      moved.push(key);
    }
  }
  for (const key of moved) delete schedule[key];

  // Schema 4 declared no `kind`, and every stored schedule is an instant: the
  // runner compares one `HH:MM` and calls a service. Declaring it is not a
  // guess, it is writing down what the only implementation does.
  if (schedule.kind === undefined) schedule.kind = "instant";

  for (const key of ["time", "from", "to"]) {
    if (schedule[key] === undefined) continue;
    if (typeof schedule[key] !== "string" || !TIME_PATTERN.test(schedule[key])) {
      quarantine(schedule, key, schedule[key], reported);
      delete schedule[key];
    }
  }
  if (Array.isArray(schedule.days)) {
    const valid = schedule.days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    if (valid.length !== schedule.days.length) {
      quarantine(schedule, "days", schedule.days, reported);
      schedule.days = valid;
    }
  }
}

function stepFourToFive(source) {
  const candidate = cloneCanonical(source);
  candidate.schema_version = 5;
  // Schema 4 left every field the alarm engine and the schedule runner read
  // undeclared, so `delay_seconds: "soon"` and `time: "tea"` were both
  // schema-valid and failed at the moment the effect was supposed to happen.
  //
  // The rule here is quarantine, not deletion. A rejected value moves into
  // `legacy` and is reported: a site's misconfiguration is still its data, and
  // the receipt is where it learns. That differs deliberately from the 3-to-4
  // port rule, which dropped unknown keys -- a port carrying an unknown key was
  // a schema-2-era accident, while `delay_seconds: "soon"` is something a
  // person typed on purpose.
  const reported = [];
  for (const collection of alarmCollections(candidate)) {
    for (const alarm of collection) migrateAlarm(alarm, reported);
  }
  for (const schedule of Array.isArray(candidate.schedules) ? candidate.schedules : []) {
    migrateSchedule(schedule, reported);
  }
  // The site timezone the runner resolves against. Absent means "ask Home
  // Assistant", which is what the runner does today; declaring it lets a
  // project pin one and lets the preview show the same answer the runner will.
  if (candidate.timezone !== undefined && typeof candidate.timezone !== "string") {
    delete candidate.timezone;
  }
  return cloneCanonical(candidate);
}

export const PROJECT_MIGRATIONS = new Map([
  [0, { from: 0, to: 1, migrate: stepZeroToOne }],
  [1, { from: 1, to: 2, migrate: stepOneToTwo }],
  [2, { from: 2, to: 3, migrate: stepTwoToThree }],
  [3, { from: 3, to: 4, migrate: stepThreeToFour }],
  [4, { from: 4, to: 5, migrate: stepFourToFive }],
]);

function contractFailure(prefix, evidence) {
  const details = evidence.errors.map((error) => `${error.code}@${error.path}`).join(", ");
  return new Error(`${prefix}: ${details || "unknown contract error"}`);
}

function stepReceipt(step, source, candidate) {
  return {
    id: `${step.from}->${step.to}`,
    from: step.from,
    to: step.to,
    source_digest: digestCanonicalJson(source).digest,
    candidate_digest: digestCanonicalJson(candidate).digest,
    warnings: [],
    loss: { dropped: [], preserved: [] },
  };
}

export function migrateProjectDocument(rawInput, { dryRun = true } = {}) {
  void dryRun;
  const sourceEvidence = evaluateProjectContract(rawInput);
  const source = sourceDocument(rawInput, sourceEvidence);
  const declaredVersion = source?.schema_version === undefined ? 0 : source.schema_version;
  if (Number.isInteger(declaredVersion) && declaredVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    throw new Error(`unsupported project schema version ${declaredVersion}`);
  }
  if (!sourceEvidence.valid) throw contractFailure("source project contract is invalid", sourceEvidence);

  let candidate = cloneCanonical(source);
  let version = sourceEvidence.schema_version;
  const steps = [];
  while (version < CURRENT_PROJECT_SCHEMA_VERSION) {
    const step = PROJECT_MIGRATIONS.get(version);
    if (!step || step.to !== version + 1) {
      throw new Error(`missing sequential project migration ${version}->${version + 1}`);
    }
    const before = candidate;
    candidate = step.migrate(before);
    const targetEvidence = evaluateProjectContract(candidate);
    if (!targetEvidence.valid || targetEvidence.schema_version !== step.to) {
      throw contractFailure(`migration target ${step.to} contract is invalid`, targetEvidence);
    }
    steps.push(stepReceipt(step, before, candidate));
    version = step.to;
  }

  const candidateEvidence = evaluateProjectContract(candidate);
  if (!candidateEvidence.valid || candidateEvidence.schema_version !== CURRENT_PROJECT_SCHEMA_VERSION) {
    throw contractFailure("migration candidate contract is invalid", candidateEvidence);
  }
  return {
    candidate,
    receipt: {
      source_schema_version: sourceEvidence.schema_version,
      candidate_schema_version: CURRENT_PROJECT_SCHEMA_VERSION,
      source_digest: sourceEvidence.digest,
      candidate_digest: candidateEvidence.digest,
      steps,
      warnings: [],
      loss: { dropped: [], preserved: [] },
    },
  };
}
