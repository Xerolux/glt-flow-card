/**
 * Run every registered Phase-2 controlled RED command through the classifier.
 *
 * While Phase 2 is in its RED waves this is the meaningful gate: it passes only
 * when every sentinel fails for exactly its named missing behavior and nothing
 * else in the harness is broken. As each GREEN plan lands, its sentinel starts
 * passing and this gate reports it as implemented instead.
 *
 * Plan 02-17 replaces this with `tools/verify-phase2.mjs`, which owns the full
 * evidence manifest and the single non-recursive `test:phase2:release` leaf.
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
  ["phase2-policy-matrix", [...python, "-m", "pytest",
    `${TESTS}/test_policy.py`, `${TESTS}/test_policy_enumeration.py`, "-q"]],
  ["phase2-access-revocation", [...python, "-m", "pytest",
    `${TESTS}/test_project_access.py`, `${TESTS}/test_policy_subscriptions.py`, "-q"]],
  ["phase2-evidence-pagination", [...python, "-m", "pytest",
    `${TESTS}/test_evidence_pagination.py`, "-q"]],
  ["phase2-leases", [...python, "-m", "pytest", `${TESTS}/test_project_leases.py`, "-q"]],
  ["phase2-collaboration-guard", [...python, "-m", "pytest",
    `${TESTS}/test_collaboration.py`, "-q"]],
  ["phase2-merge", [...python, "-m", "pytest", `${TESTS}/test_merge.py`, "-q"]],
  ["phase2-configured-controls", [...python, "-m", "pytest",
    `${TESTS}/test_configured_controls.py`, "-q"]],
  ["phase2-control-evidence", [...python, "-m", "pytest",
    `${TESTS}/test_control_evidence.py`, `${TESTS}/test_trusted_evidence.py`, "-q"]],
  ["phase2-migration-lifecycle", [...python, "-m", "pytest",
    `${TESTS}/test_phase2_migration.py`, `${TESTS}/test_phase2_lifecycle.py`, "-q"]],
  ["phase2-authority-reducers", [process.execPath, "--test",
    "test/phase2-authority.test.mjs", "test/phase2-collaboration.test.mjs"]],
  ["phase2-ui-fixture-seed", [process.execPath, "tools/run-exact-dist-playwright.mjs",
    "--grep=phase-2-fixture-seed"]],
  ["phase2-ui", [process.execPath, "tools/run-exact-dist-playwright.mjs", "--grep=phase-2-ui"]],
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
  process.stderr.write("\nPhase-2 RED gate failed for:\n");
  for (const entry of broken) {
    process.stderr.write(`\n--- ${entry.key} ---\n${entry.output.slice(-2000)}\n`);
  }
  process.exitCode = 1;
} else {
  const implemented = results.filter((entry) => entry.implemented).length;
  process.stdout.write(
    `\nPhase-2 gate: ${results.length - implemented} controlled RED, ${implemented} implemented, 0 broken\n`,
  );
}
