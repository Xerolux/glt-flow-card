/**
 * Generate the committed DST corpus both runtimes resolve.
 *
 * A parity claim needs *one* corpus that both read, not two lists that happen
 * to match. Phase 3 learned the underlying lesson the hard way: two runtimes
 * agreed on a verdict while building different models, and only comparing
 * canonical bytes exposed it.
 *
 * The zone list is deliberate rather than convenient:
 *
 *   Europe/Berlin      the site this card is written for, and both its
 *                      transitions;
 *   Pacific/Auckland   southern hemisphere, so its spring-forward is in
 *                      September. An implementation that assumes "the clocks go
 *                      forward in March" is caught rather than merely
 *                      unexercised;
 *   Australia/Lord_Howe  a thirty-minute transition, so a lost *hour* assumed
 *                      anywhere in the arithmetic is wrong here;
 *   Asia/Kolkata       a half-hour offset that never transitions, so the
 *                      ordinary path is exercised somewhere the offset is not
 *                      a whole number of hours;
 *   UTC                no offset at all, as the degenerate case.
 *
 * `--check` regenerates and compares, so the committed file cannot drift from
 * the source that produced it.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AMBIGUOUS_POLICIES,
  NONEXISTENT_POLICIES,
  resolveEntry,
  runKey,
} from "../src/v100/schedule-time.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CORPUS_PATH = "test/fixtures/schedule-transitions.json";

/** Zones and the dates worth asking about in each. */
const ZONES = [
  ["Europe/Berlin", ["2027-03-28", "2027-10-31", "2027-06-15", "2026-03-29", "2026-10-25"]],
  ["Pacific/Auckland", ["2027-09-26", "2027-04-04", "2027-06-15"]],
  ["Australia/Lord_Howe", ["2027-10-03", "2027-04-04", "2027-06-15"]],
  ["Asia/Kolkata", ["2027-03-28", "2027-10-31"]],
  ["UTC", ["2027-03-28", "2027-10-31"]],
];

/** Times chosen to straddle each transition rather than to sit safely away. */
const TIMES = ["00:00", "01:59", "02:00", "02:30", "02:59", "03:00", "12:00", "23:59"];

export function buildCorpus() {
  const cases = [];
  for (const [zone, dates] of ZONES) {
    for (const date of dates) {
      for (const time of TIMES) {
        for (const nonexistent of NONEXISTENT_POLICIES) {
          for (const ambiguous of AMBIGUOUS_POLICIES) {
            const resolution = resolveEntry({ time }, date, zone, { nonexistent, ambiguous });
            cases.push({
              zone, date, time, nonexistent, ambiguous,
              status: resolution.status,
              instants: resolution.instants,
              candidates: resolution.candidates,
              keys: resolution.instants.map((instant) => runKey("p", "s", instant)),
            });
          }
        }
      }
    }
  }
  return {
    cases,
    format: "glt-flow-card-schedule-transitions",
    generated_by: "npm run generate:schedule:parity",
    report_version: 1,
    zones: ZONES.map(([zone]) => zone),
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

async function main() {
  const check = process.argv.includes("--check");
  const corpus = buildCorpus();

  // A corpus in which nothing is nonexistent or ambiguous would satisfy a
  // parity test while proving nothing about the cases it exists for.
  const statuses = new Set(corpus.cases.map((entry) => entry.status));
  for (const required of ["normal", "nonexistent", "ambiguous"]) {
    if (!statuses.has(required)) {
      throw new Error(`the corpus contains no ${required} case; it would prove nothing`);
    }
  }

  const bytes = `${JSON.stringify(canonical(corpus), null, 2)}\n`;
  const target = path.join(ROOT, CORPUS_PATH);
  if (check) {
    const existing = await readFile(target, "utf8");
    if (existing !== bytes) {
      throw new Error(`${CORPUS_PATH} is not what the current source produces`);
    }
    console.log(`PASS ${CORPUS_PATH} matches its generator`);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  const digest = createHash("sha256").update(bytes).digest("hex");
  console.log(
    `Built ${corpus.cases.length} schedule transition cases across `
    + `${corpus.zones.length} zones (${digest.slice(0, 12)})`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`schedule parity corpus failed: ${error.message}`);
    process.exitCode = 1;
  });
}
