/**
 * Run the repository's regression suites.
 *
 * `npm test` is the signal that a change broke something. It must therefore not
 * include the Phase-2 product-completeness sentinels: those assert behavior that
 * does not exist yet, deliberately, and they stay red until their owning plan
 * lands. Leaving them here would keep the check red for the whole phase and hide
 * every real regression behind them.
 *
 * They are not skipped. `npm run test:phase2` runs every one of them through
 * `tools/assert-red.mjs`, which passes only when each reaches exactly its named
 * missing behavior and fails when anything else about the run is broken - a
 * stricter check than a bare pass/fail, not a weaker one.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TEST_DIR = fileURLToPath(new URL("../test", import.meta.url));

/**
 * Suites owned by `npm run test:phase2` rather than by the regression run.
 * Each is a controlled-RED sentinel registered in `tools/assert-red.mjs`.
 */
const PHASE_GATE_SUITES = new Set([
  "phase2-authority.test.mjs",
  "phase2-collaboration.test.mjs",
]);

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
