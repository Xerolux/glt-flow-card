/* Pure, sequential project migrations with canonical receipts. */
import {
  digestCanonicalJson,
  evaluateProjectContract,
} from "./project-contract.mjs";

export const CURRENT_PROJECT_SCHEMA_VERSION = 3;

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

export const PROJECT_MIGRATIONS = new Map([
  [0, { from: 0, to: 1, migrate: stepZeroToOne }],
  [1, { from: 1, to: 2, migrate: stepOneToTwo }],
  [2, { from: 2, to: 3, migrate: stepTwoToThree }],
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
