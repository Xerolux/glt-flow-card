/* Every published claim, the command behind it, and what that command said.
 *
 * **This is the phase.** Its three rules each close a row:
 *
 * **A claim with no evidence fails the build.** Not a warning. A claim nobody
 * can support is what this phase exists to stop shipping, and the failure mode
 * is already in the repository: `README.md` said "`test/` – lightweight
 * validation tests" while the suite was 499 Node, 691 Python and 92 browser
 * tests. Harmless in that direction; the same staleness in the other direction
 * is a plant operator trusting something that stopped being true.
 *
 * **A failed claim is published as failed.** Omitting it lets its absence read
 * as "not applicable" — the counting-oracle shape Phase 9 closed for site
 * listings, one level up.
 *
 * **Automated and manual evidence cannot merge into conformance.** Automated
 * rule engines decide a minority of WCAG success criteria by construction, so
 * "automated checks pass" and "manual pass recorded" are separate claims. There
 * is **no field** in which they combine: the merge is not a policy someone can
 * override, it is a structure with no place to put the result.
 *
 * The two rows this file most needs to be trusted on — T10-10 and T10-13 — are
 * this phase auditing itself. Both describe a claim this phase is in a position
 * to make and would be believed about. That is why the registry is a build step
 * rather than a document: a document is edited by whoever wants the claim.
 */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, ".planning/claims.json");

/** What a claim's evidence can be. Closed, so a fourth kind must be declared. */
export const EVIDENCE_KINDS = Object.freeze([
  // A command that runs here and passes or fails.
  "command",
  // Something a person did, recorded with who and when. Never inferred.
  "manual",
  // Something that was not exercised in this environment, with the reason.
  "not-exercised",
]);

/** What a claim may be, after its evidence has been read. */
export const OUTCOMES = Object.freeze(["passed", "failed", "not-exercised"]);

/**
 * Claims whose evidence is automated may not assert conformance.
 *
 * The list is here rather than in the data, so a claim cannot opt out of it by
 * being written differently.
 */
const CONFORMANCE_WORDS = [
  /\bwcag\s*2(?:\.\d)?\s*(?:a{1,3}|aa|aaa)\b/iu,
  /\bconform(?:s|ance|ant)\b/iu,
  /\bcompliant\b/iu,
  /\baccessib(?:le|ility)\s+standard\b/iu,
];

/** Read the registry file. */
export async function loadClaims(file = REGISTRY) {
  const registry = JSON.parse(await readFile(file, "utf8"));
  if (registry.format !== "glt-flow-card-claim-registry") {
    throw new Error(`claims: ${file} is not a claim registry`);
  }
  if (!Array.isArray(registry.claims) || registry.claims.length === 0) {
    throw new Error("claims: the registry is empty, which is not the same as having nothing to prove");
  }
  return registry;
}

/**
 * Check one claim's shape before anything runs it.
 *
 * Shape errors are collected rather than thrown one at a time, so a first run
 * shows every problem instead of the first.
 */
export function validateClaim(claim) {
  const problems = [];
  if (typeof claim.id !== "string" || !/^[a-z][a-z0-9-]*$/u.test(claim.id ?? "")) {
    problems.push(`claim id ${JSON.stringify(claim.id)} is not a lower-case slug`);
  }
  if (typeof claim.claim !== "string" || claim.claim.trim().length < 10) {
    problems.push(`${claim.id}: the claim text is missing or too short to mean anything`);
  }
  if (!EVIDENCE_KINDS.includes(claim.kind)) {
    problems.push(`${claim.id}: evidence kind ${JSON.stringify(claim.kind)} is not one of ${EVIDENCE_KINDS.join(", ")}`);
  }
  if (claim.kind === "command" && (typeof claim.command !== "string" || claim.command.trim() === "")) {
    // The rule. A claim with no evidence is refused, not warned about.
    problems.push(`${claim.id}: a command claim with no command is a claim with no evidence`);
  }
  if (claim.kind === "manual" && (!claim.performed_by || !claim.performed_on)) {
    problems.push(`${claim.id}: a manual claim must record who performed it and when`);
  }
  if (claim.kind === "not-exercised" && (typeof claim.why !== "string" || claim.why.trim().length < 10)) {
    problems.push(`${claim.id}: an unexercised capability must say why, so a reader cannot assume it was`);
  }
  if (typeof claim.covers !== "string" || claim.covers.trim() === "") {
    problems.push(`${claim.id}: state what this claim covers, and what it does not`);
  }
  if (claim.kind === "command" && CONFORMANCE_WORDS.some((pattern) => pattern.test(claim.claim ?? ""))) {
    // T10-10. An automated result cannot be phrased as conformance, and there is
    // no field in which an automated claim and a manual one combine.
    problems.push(
      `${claim.id}: an automated claim may not assert conformance. `
      + "Automated rules decide a minority of the criteria; state what ran instead.",
    );
  }
  return problems;
}

/** Run one claim's evidence and record what happened. */
export function readEvidence(claim, { cwd = ROOT, run = spawnSync } = {}) {
  if (claim.kind === "not-exercised") {
    return { detail: claim.why, outcome: "not-exercised" };
  }
  if (claim.kind === "manual") {
    return {
      detail: `recorded by ${claim.performed_by} on ${claim.performed_on}`,
      outcome: claim.result === "failed" ? "failed" : "passed",
    };
  }
  const completed = run(claim.command, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: true,
    timeout: 20 * 60 * 1000,
  });
  const output = `${completed.stdout ?? ""}${completed.stderr ?? ""}`.trim();
  return {
    detail: output.split("\n").slice(-3).join(" ").slice(0, 300),
    exit_code: completed.status,
    outcome: completed.status === 0 ? "passed" : "failed",
  };
}

/**
 * Build the published registry.
 *
 * Every claim appears, including the failed ones. A registry that omitted a
 * failure would let its absence read as "not applicable", which is the same
 * defect one level out from the claim itself.
 */
export async function buildRegistry(options = {}) {
  const registry = await loadClaims(options.file);
  const problems = registry.claims.flatMap((claim) => validateClaim(claim));
  const seen = new Set();
  for (const claim of registry.claims) {
    if (seen.has(claim.id)) problems.push(`${claim.id}: declared twice`);
    seen.add(claim.id);
  }
  if (problems.length > 0) {
    const error = new Error(`the claim registry is not publishable:\n  ${problems.join("\n  ")}`);
    error.problems = problems;
    throw error;
  }

  const results = [];
  for (const claim of registry.claims) {
    const evidence = options.readEvidence
      ? options.readEvidence(claim)
      : readEvidence(claim, options);
    results.push({
      claim: claim.claim,
      covers: claim.covers,
      detail: evidence.detail,
      evidence: claim.kind === "command" ? claim.command : claim.kind,
      id: claim.id,
      kind: claim.kind,
      outcome: evidence.outcome,
    });
  }
  return {
    claims: results,
    failed: results.filter((entry) => entry.outcome === "failed").length,
    format: "glt-flow-card-claim-results",
    generated_for: registry.product ?? "glt-flow-card",
    not_exercised: results.filter((entry) => entry.outcome === "not-exercised").length,
    passed: results.filter((entry) => entry.outcome === "passed").length,
    version: 1,
  };
}

/** Render the registry as the page a reader sees. */
export function renderRegistry(built) {
  const lines = [
    "# Release evidence",
    "",
    `${built.passed} passed · ${built.failed} failed · ${built.not_exercised} not exercised`,
    "",
    "Every claim below cites the command behind it and what that command said.",
    "**A failed claim appears as failed**, because omitting it would let its",
    "absence read as \"not applicable\".",
    "",
    "| Claim | Evidence | Result | Covers |",
    "|---|---|---|---|",
  ];
  const mark = { failed: "FAILED", "not-exercised": "not exercised", passed: "passed" };
  for (const entry of built.claims) {
    lines.push(`| ${entry.claim} | \`${entry.evidence}\` | ${mark[entry.outcome]} | ${entry.covers} |`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const built = await buildRegistry();
  console.log(renderRegistry(built));
  if (built.failed > 0) {
    console.error(`\n${built.failed} claim(s) failed. They are published as failed, not omitted.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
