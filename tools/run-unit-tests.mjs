/**
 * Run the repository's regression suites.
 *
 * `npm test` is the signal that a change broke something, so a suite belongs
 * here from the moment its behavior exists. A product-completeness sentinel
 * whose owning plan has not landed does not: it is red on purpose, and leaving
 * it here would hide every real regression behind it. `PHASE_GATE_SUITES` is
 * that exclusion list, and it empties as each plan lands.
 *
 * An excluded suite is never skipped. `npm run test:phase2` runs every sentinel
 * through `tools/assert-red.mjs`, which passes only when each reaches exactly
 * its named missing behavior and fails when anything else about the run is
 * broken - a stricter check than a bare pass/fail, not a weaker one.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TEST_DIR = fileURLToPath(new URL("../test", import.meta.url));

/**
 * Suites still owned by `npm run test:phase2` rather than by the regression run.
 *
 * Empty since plan 02-13: both Phase-2 browser sentinels are green, so they are
 * regression tests now and run here as well as in the phase gate.
 */
const PHASE_GATE_SUITES = new Set();

const suites = readdirSync(TEST_DIR)
  .filter((name) => name.endsWith(".test.mjs"))
  .filter((name) => !PHASE_GATE_SUITES.has(name))
  .sort()
  .map((name) => `test/${name}`);

if (suites.length === 0) {
  process.stderr.write("no regression suites found in test/\n");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...suites], {
  stdio: "inherit",
  windowsHide: true,
});
process.exit(result.status ?? 1);
