/* Compatibility entry point: the canonical build owns every generated output. */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  [new URL("build.mjs", import.meta.url), ...process.argv.slice(2)],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
