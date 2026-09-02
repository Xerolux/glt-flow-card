/**
 * Run every registered Phase-7 controlled RED command through the classifier.
 *
 * While Phase 7 is in its RED waves this is the meaningful gate: it passes only
 * when every sentinel fails for exactly its named missing behavior and nothing
 * else in the harness is broken. As each GREEN plan lands, its sentinel starts
 * passing and this gate reports it as implemented instead.
 *
 * Plan 07-20 replaces this with `tools/verify-phase7.mjs`, which owns the full
 * evidence manifest and the single non-recursive release leaf. This tool never
 * invokes either of those commands.
 *
 * `GATES` starts empty on purpose: plans 07-04 and 07-05 write the sentinels and
 * register them here. An empty registry is not, however, allowed to pass
 * quietly forever. This gate cross-checks itself against `assert-red.mjs`'s
 * `EXPECTED_RED`, and fails when a `phase7-` identity is registered there but
 * has no command here. That is the same two-independent-lists-must-agree shape
 * the packaging and policy tables use, and it exists because the alternative
 * failure -- a sentinel that is specified, never run, and reported by nobody --
 * looks exactly like success.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { EXPECTED_RED } from "./assert-red.mjs";
import { pythonCommand } from "./python-launcher.mjs";

const CLASSIFIER = fileURLToPath(new URL("assert-red.mjs", import.meta.url));
const PHASE_PREFIX = "phase7-";

/**
 * The Python sentinels run through the resolved 3.13 launcher rather than a
 * bare `py -3.13`, which exists only on Windows.
 *
 * An empty `-m` overrides `pytest.ini`'s default deselection without
 * *selecting* by marker. Selecting `-m expected_red` works only while the
 * sentinel is still red and reports a landed plan's sentinel as BROKEN, because
 * pytest exits 5 for "no tests collected". Running with filtering off works in
 * both states. It is an override, not a skip: `assert-red.mjs` rejects a
 * zero-test or skipped run, so a sentinel that vanished fails here rather than
 * passing quietly.
 */
function pytest(file) {
  return [...pythonCommand().split(" "), "-m", "pytest", file, "-q", "-x", "-m", ""];
}

/** Registry key -> the command that must reach exactly that controlled RED. */
const GATES = [
  // Populated by plans 07-04 and 07-05.
];

const registered = new Set(GATES.map(([key]) => key));
const specified = Object.keys(EXPECTED_RED).filter((key) => key.startsWith(PHASE_PREFIX));
const unregistered = specified.filter((key) => !registered.has(key));
const unknown = [...registered].filter((key) => !specified.includes(key));

if (unregistered.length > 0 || unknown.length > 0) {
  for (const key of unregistered) {
    process.stderr.write(
      `${key} is registered in assert-red.mjs but has no command in this gate, so nothing runs it\n`,
    );
  }
  for (const key of unknown) {
    process.stderr.write(
      `${key} has a command in this gate but no identity in assert-red.mjs, so nothing classifies it\n`,
    );
  }
  process.exitCode = 1;
} else {
  const results = [];
  for (const [key, command] of GATES) {
    const classified = spawnSync(
      process.execPath,
      [CLASSIFIER, `--expected=${key}`, "--", ...command],
      { encoding: "utf8" },
    );
    const output = `${classified.stdout ?? ""}${classified.stderr ?? ""}`;
    const controlledRed = classified.status === 0;
    const implemented = output.includes("unexpectedly passed");
    results.push({ key, controlledRed, implemented, output });
  }

  const broken = results.filter((entry) => !entry.controlledRed && !entry.implemented);
  for (const entry of results) {
    const state = entry.controlledRed ? "controlled RED" : entry.implemented ? "implemented" : "BROKEN";
    process.stdout.write(`${state.padEnd(15)} ${entry.key}\n`);
  }
  if (broken.length > 0) {
    process.stderr.write("\nPhase-7 RED gate failed for:\n");
    for (const entry of broken) {
      process.stderr.write(`\n--- ${entry.key} ---\n${entry.output.slice(-2000)}\n`);
    }
    process.exitCode = 1;
  } else {
    const implemented = results.filter((entry) => entry.implemented).length;
    process.stdout.write(
      `\nPhase-7 gate: ${results.length - implemented} controlled RED, ${implemented} implemented, 0 broken\n`,
    );
  }
}
