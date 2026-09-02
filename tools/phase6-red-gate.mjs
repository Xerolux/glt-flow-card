/**
 * Run every registered Phase-6 controlled RED command through the classifier.
 *
 * While Phase 6 is in its RED waves this is the meaningful gate: it passes only
 * when every sentinel fails for exactly its named missing behavior and nothing
 * else in the harness is broken. As each GREEN plan lands, its sentinel starts
 * passing and this gate reports it as implemented instead.
 *
 * Plan 06-20 replaces this with `tools/verify-phase6.mjs`, which owns the full
 * evidence manifest and the single non-recursive release leaf. This tool never
 * invokes either of those commands.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { pythonCommand } from "./python-launcher.mjs";

const CLASSIFIER = fileURLToPath(new URL("assert-red.mjs", import.meta.url));

/**
 * The Python sentinels run through the resolved 3.13 launcher rather than a
 * bare `py -3.13`, which exists only on Windows. Phase 2 found this the hard
 * way: gates authored against the Windows launcher could not run on Linux at
 * all.
 */
function pytest(file) {
  // `-m expected_red` overrides the default deselection in `pytest.ini`. The
  // sentinels are meant to fail for the length of a wave, so they are out of
  // the ordinary suite -- a suite that is red for a fortnight stops telling
  // anyone anything -- and this gate is where their failure is checked. It is
  // a selection, not a skip: assert-red.mjs rejects a zero-test or skipped run,
  // so a sentinel that vanished fails here rather than passing quietly.
  return [
    ...pythonCommand().split(" "),
    "-m", "pytest", file, "-q", "-x", "-m", "expected_red",
  ];
}

/** Registry key -> the command that must reach exactly that controlled RED. */
const GATES = [
  ["phase6-vocabulary", [process.execPath, "--test", "test/alarm-vocabulary.test.mjs"]],
  ["phase6-lifecycle",
    pytest("tests/components/glt_flow_card/test_alarm_lifecycle.py")],
  ["phase6-suppression",
    pytest("tests/components/glt_flow_card/test_alarm_suppression.py")],
  ["phase6-restart",
    pytest("tests/components/glt_flow_card/test_alarm_restart.py")],
  ["phase6-index",
    pytest("tests/components/glt_flow_card/test_alarm_index.py")],
  ["phase6-retention",
    pytest("tests/components/glt_flow_card/test_alarm_retention.py")],
  ["phase6-notifications",
    pytest("tests/components/glt_flow_card/test_notification_delivery.py")],
  ["phase6-escalation",
    pytest("tests/components/glt_flow_card/test_escalation.py")],
  ["phase6-schedule-dst",
    pytest("tests/components/glt_flow_card/test_schedule_dst.py")],
  ["phase6-schedule-routes",
    pytest("tests/components/glt_flow_card/test_schedule_routes.py")],
  ["phase6-schedule-bindings",
    pytest("tests/components/glt_flow_card/test_schedule_bindings.py")],
  ["phase6-schedule-parity", [process.execPath, "--test", "test/schedule-dst-parity.test.mjs"]],
  ["phase6-shipped-truth", [process.execPath, "--test", "test/shipped-alarm-truth.test.mjs"]],
  ["phase6-ui", [process.execPath, "tools/run-exact-dist-playwright.mjs", "--grep=phase-6-alarms"]],
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
  process.stderr.write("\nPhase-6 RED gate failed for:\n");
  for (const entry of broken) {
    process.stderr.write(`\n--- ${entry.key} ---\n${entry.output.slice(-2000)}\n`);
  }
  process.exitCode = 1;
} else {
  const implemented = results.filter((entry) => entry.implemented).length;
  process.stdout.write(
    `\nPhase-6 gate: ${results.length - implemented} controlled RED, ${implemented} implemented, 0 broken\n`,
  );
}
