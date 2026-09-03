/**
 * Run every registered Phase-3 controlled RED command through the classifier.
 *
 * While Phase 3 is in its RED waves this is the meaningful gate: it passes only
 * when every sentinel fails for exactly its named missing behavior and nothing
 * else in the harness is broken. As each GREEN plan lands, its sentinel starts
 * passing and this gate reports it as implemented instead.
 *
 * Plan 03-17 replaces this with `tools/verify-phase3.mjs`, which owns the full
 * evidence manifest and the single non-recursive `test:phase3:release` leaf.
 * This tool never invokes either of those commands.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { pythonCommand } from "./python-launcher.mjs";

const CLASSIFIER = fileURLToPath(new URL("assert-red.mjs", import.meta.url));
const TESTS = "tests/components/glt_flow_card";

const python = pythonCommand().split(" ");

/** Registry key -> the command that must reach exactly that controlled RED. */
const GATES = [
  ["phase3-semantic-model", [process.execPath, "--test", "test/semantic-model.test.mjs"]],
  ["phase3-provenance", [...python, "-m", "pytest", `${TESTS}/test_provenance.py`, "-q"]],
  ["phase3-provenance-policy", [...python, "-m", "pytest",
    `${TESTS}/test_provenance_policy.py`, "-q"]],
  ["phase3-profiles", [...python, "-m", "pytest",
    `${TESTS}/test_equipment_profiles.py`, "-q"]],
  ["phase3-mapping", [process.execPath, "--test", "test/entity-mapping.test.mjs"]],
  ["phase3-equipment-state", [process.execPath, "--test", "test/equipment-state.test.mjs"]],
  ["phase3-ui", [process.execPath, "tools/run-exact-dist-playwright.mjs", "--grep=phase-3-ui"]],
];

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
  process.stderr.write("\nPhase-3 RED gate failed for:\n");
  for (const entry of broken) {
    process.stderr.write(`\n--- ${entry.key} ---\n${entry.output.slice(-2000)}\n`);
  }
  process.exitCode = 1;
} else {
  const implemented = results.filter((entry) => entry.implemented).length;
  process.stdout.write(
    `\nPhase-3 gate: ${results.length - implemented} controlled RED, ${implemented} implemented, 0 broken\n`,
  );
}
