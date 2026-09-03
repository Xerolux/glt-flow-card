/**
 * Run every registered Phase-5 controlled RED command through the classifier.
 *
 * While Phase 5 is in its RED waves this is the meaningful gate: it passes only
 * when every sentinel fails for exactly its named missing behavior and nothing
 * else in the harness is broken. As each GREEN plan lands, its sentinel starts
 * passing and this gate reports it as implemented instead.
 *
 * Plan 05-20 replaces this with `tools/verify-phase5.mjs`, which owns the full
 * evidence manifest and the single non-recursive `test:phase5:release` leaf.
 * This tool never invokes either of those commands.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLASSIFIER = fileURLToPath(new URL("assert-red.mjs", import.meta.url));

/** Registry key -> the command that must reach exactly that controlled RED. */
const GATES = [
  ["phase5-catalog", [process.execPath, "--test", "test/catalog-evidence.test.mjs"]],
  ["phase5-ports", [process.execPath, "--test", "test/port-compatibility.test.mjs"]],
  ["phase5-port-identity", [process.execPath, "--test", "test/port-identity.test.mjs"]],
  ["phase5-routing-determinism",
    [process.execPath, "--test", "test/routing-determinism.test.mjs"]],
  ["phase5-routing-geometry", [process.execPath, "--test", "test/routing-geometry.test.mjs"]],
  ["phase5-routing-incremental",
    [process.execPath, "--test", "test/routing-incremental.test.mjs"]],
  ["phase5-designer", [process.execPath, "--test", "test/designer-transactions.test.mjs"]],
  ["phase5-clipboard", [process.execPath, "--test", "test/designer-clipboard.test.mjs"]],
  ["phase5-sdk", [process.execPath, "--test", "test/sdk-manifest.test.mjs"]],
  ["phase5-ui", [process.execPath, "tools/run-exact-dist-playwright.mjs", "--grep=phase-5-ui"]],
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
  process.stderr.write("\nPhase-5 RED gate failed for:\n");
  for (const entry of broken) {
    process.stderr.write(`\n--- ${entry.key} ---\n${entry.output.slice(-2000)}\n`);
  }
  process.exitCode = 1;
} else {
  const implemented = results.filter((entry) => entry.implemented).length;
  process.stdout.write(
    `\nPhase-5 gate: ${results.length - implemented} controlled RED, ${implemented} implemented, 0 broken\n`,
  );
}
