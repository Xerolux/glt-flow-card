/**
 * Run every registered Phase-4 controlled RED command through the classifier.
 *
 * While Phase 4 is in its RED waves this is the meaningful gate: it passes only
 * when every sentinel fails for exactly its named missing behavior and nothing
 * else in the harness is broken. As each GREEN plan lands, its sentinel starts
 * passing and this gate reports it as implemented instead.
 *
 * Plan 04-17 replaces this with `tools/verify-phase4.mjs`, which owns the full
 * evidence manifest and the single non-recursive `test:phase4:release` leaf.
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
  ["phase4-panels", [...python, "-m", "pytest", `${TESTS}/test_panels.py`, "-q"]],
  ["phase4-panel-enumeration", [...python, "-m", "pytest",
    `${TESTS}/test_panel_enumeration.py`, "-q"]],
  ["phase4-view-stream", [...python, "-m", "pytest", `${TESTS}/test_view_stream.py`, "-q"]],
  ["phase4-navigation", [...python, "-m", "pytest", `${TESTS}/test_navigation.py`, "-q"]],
  ["phase4-navigation-counts", [...python, "-m", "pytest",
    `${TESTS}/test_navigation_counts.py`, "-q"]],
  ["phase4-panel-model", [process.execPath, "--test", "test/panel-model.test.mjs"]],
  ["phase4-navigation-reducer", [process.execPath, "--test", "test/navigation.test.mjs"]],
  ["phase4-command-outcome", [process.execPath, "--test", "test/command-outcome.test.mjs"]],
  ["phase4-view-resync", [process.execPath, "--test", "test/view-resync.test.mjs"]],
  ["phase4-ui", [process.execPath, "tools/run-exact-dist-playwright.mjs", "--grep=phase-4-ui"]],
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
  process.stderr.write("\nPhase-4 RED gate failed for:\n");
  for (const entry of broken) {
    process.stderr.write(`\n--- ${entry.key} ---\n${entry.output.slice(-2000)}\n`);
  }
  process.exitCode = 1;
} else {
  const implemented = results.filter((entry) => entry.implemented).length;
  process.stdout.write(
    `\nPhase-4 gate: ${results.length - implemented} controlled RED, ${implemented} implemented, 0 broken\n`,
  );
}
