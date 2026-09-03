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
 * Suites still owned by a phase gate rather than by the regression run.
 *
 * Emptied at plan 02-13 when both Phase-2 browser sentinels went green. Refilled
 * by plan 06-05 with the two Phase-6 sentinels and emptied again as those
 * landed; refilled by plan 07-05 with the three Phase-7 sentinels. Their owning
 * plans have not landed, so they are red on purpose and leaving them in the
 * regression run would hide every real regression behind them.
 *
 * Each entry is removed by the plan that makes it pass, and each is still run --
 * `npm run test:phase6:quick` puts it through `tools/assert-red.mjs`, which
 * requires it to reach exactly its named missing behavior and fails when
 * anything else about the run is broken. That is stricter than a bare pass or
 * fail, not weaker.
 */
const PHASE_GATE_SUITES = new Set([
  // Refilled by plan 07-05 with the three Phase-7 browser sentinels. Their
  // owning plans -- 07-11, 07-07 and 07-16 -- have not landed, so they are red
  // on purpose. Each is removed by the plan that makes it pass, and each is
  // still run: `npm run test:phase7:quick` puts it through
  // `tools/assert-red.mjs`, which requires it to reach exactly its named
  // missing behaviour and fails when anything else about the run is broken.
  // replay-truth.test.mjs removed by plan 07-11: replay reads the record and an
  // entity with no history is a stated unknown, so it is a regression suite now.
  // period-parity.test.mjs removed by plan 07-07: both runtimes now resolve
  // every corpus entry to identical canonical bytes, so it is a regression
  // suite rather than a sentinel.
  // report-renderings.test.mjs removed by plan 07-16: screen, CSV and print all
  // render from the model, so it is a regression suite now.
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
