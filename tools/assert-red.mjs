/**
 * Classify a controlled RED run.
 *
 * A RED command is only useful if it can fail for exactly one reason: the named
 * product behavior does not exist yet. Everything else - a missing module, a
 * syntax error, a browser that never launched, a skipped or zero-test run, an
 * unrelated failing test, or any prohibited side effect - must stay non-zero so
 * a broken harness can never be mistaken for a controlled RED.
 *
 * Each registry entry binds three things:
 *   marker    one literal `EXPECTED_RED[...]` line the sentinel prints,
 *   evidence  one task-specific effect-ledger prefix proving the ledger ran,
 *   identity  the exact sentinel identity that is allowed to fail.
 *
 * Sentinel identities follow a fixed naming rule so a plan cannot silently
 * point a gate at a different test:
 *   pytest sentinels  <file>::test_expected_red_<registry key with _>
 *   Node/Playwright   [expected-red:<registry key>]
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function pytestSentinel(key, file) {
  return `${file}::test_expected_red_${key.replaceAll("-", "_")}`;
}

function nodeSentinel(key) {
  return `[expected-red:${key}]`;
}

function pythonEntry(key, file, description, evidence) {
  return [
    key,
    Object.freeze({
      marker: `EXPECTED_RED[${key}]: ${description}`,
      evidence,
      identity: pytestSentinel(key, file),
      runtime: "python",
    }),
  ];
}

function browserEntry(key, description, evidence) {
  return [
    key,
    Object.freeze({
      marker: `EXPECTED_RED[${key}]: ${description}`,
      evidence,
      identity: nodeSentinel(key),
      runtime: "node",
    }),
  ];
}

const TESTS = "tests/components/glt_flow_card";

export const EXPECTED_RED = Object.freeze(Object.fromEntries([
  ["missing-project-safety-ui", Object.freeze({
    marker: "EXPECTED_RED[missing-project-safety-ui]: Project safety workflow is unavailable",
    evidence: "EXACT_DIST_EFFECTS ",
    identity: null,
    runtime: "node",
  })],
  ["missing-lifecycle-cleanup", Object.freeze({
    marker: "EXPECTED_RED[missing-lifecycle-cleanup]: exact lifecycle resources remain after unload",
    evidence: "LIFECYCLE_EFFECTS ",
    identity: null,
    runtime: "python",
  })],
  pythonEntry(
    "phase2-policy-matrix",
    `${TESTS}/test_policy.py`,
    "centralized deny-default policy matrix is unavailable",
    "PHASE2_POLICY_EFFECTS ",
  ),
  pythonEntry(
    "phase2-access-revocation",
    `${TESTS}/test_project_access.py`,
    "server-owned access and revocation are unavailable",
    "PHASE2_ACCESS_EFFECTS ",
  ),
  pythonEntry(
    "phase2-evidence-pagination",
    `${TESTS}/test_evidence_pagination.py`,
    "scoped opaque evidence pagination is unavailable",
    "PHASE2_CURSOR_EFFECTS ",
  ),
  pythonEntry(
    "phase2-leases",
    `${TESTS}/test_project_leases.py`,
    "connection-bound engineering leases are unavailable",
    "PHASE2_LEASE_EFFECTS ",
  ),
  pythonEntry(
    "phase2-collaboration-guard",
    `${TESTS}/test_collaboration.py`,
    "immediate-precommit collaboration guard is unavailable",
    "PHASE2_COLLAB_EFFECTS ",
  ),
  pythonEntry(
    "phase2-merge",
    `${TESTS}/test_merge.py`,
    "bounded three-way merge recovery is unavailable",
    "PHASE2_MERGE_EFFECTS ",
  ),
  pythonEntry(
    "phase2-configured-controls",
    `${TESTS}/test_configured_controls.py`,
    "authoritative configured controls are unavailable",
    "PHASE2_CONTROL_EFFECTS ",
  ),
  pythonEntry(
    "phase2-control-evidence",
    `${TESTS}/test_control_evidence.py`,
    "trusted control evidence lifecycle is unavailable",
    "PHASE2_EVIDENCE_EFFECTS ",
  ),
  pythonEntry(
    "phase2-migration-lifecycle",
    `${TESTS}/test_phase2_lifecycle.py`,
    "conservative migration and resource cleanup are unavailable",
    "PHASE2_LIFECYCLE_EFFECTS ",
  ),
  browserEntry(
    "phase2-authority-reducers",
    "fail-closed authority reducers are unavailable",
    "PHASE2_REDUCER_EFFECTS ",
  ),
  browserEntry(
    "phase2-ui-fixture-seed",
    "exact-dist shared-authority UI is unavailable",
    "PHASE2_FIXTURE_EFFECTS ",
  ),
  browserEntry(
    "phase2-ui",
    "complete exact-dist Phase-2 UI is unavailable",
    "PHASE2_UI_EFFECTS ",
  ),
  // -- Phase 3 -----------------------------------------------------------
  browserEntry(
    "phase3-semantic-model",
    "the validated semantic hierarchy is unavailable",
    "PHASE3_SEMANTIC_EFFECTS ",
  ),
  pythonEntry(
    "phase3-provenance",
    `${TESTS}/test_provenance.py`,
    "registry-derived provenance and communication health are unavailable",
    "PHASE3_PROVENANCE_EFFECTS ",
  ),
  pythonEntry(
    "phase3-provenance-policy",
    `${TESTS}/test_provenance_policy.py`,
    "authorized non-enumerating provenance reads are unavailable",
    "PHASE3_PROVENANCE_POLICY_EFFECTS ",
  ),
  pythonEntry(
    "phase3-profiles",
    `${TESTS}/test_equipment_profiles.py`,
    "versioned override-preserving profiles are unavailable",
    "PHASE3_PROFILE_EFFECTS ",
  ),
  browserEntry(
    "phase3-mapping",
    "explained dual-runtime entity mapping is unavailable",
    "PHASE3_MAPPING_EFFECTS ",
  ),
  browserEntry(
    "phase3-equipment-state",
    "the deterministic operational state is unavailable",
    "PHASE3_STATE_EFFECTS ",
  ),
  browserEntry(
    "phase3-ui",
    "complete exact-dist Phase-3 UI is unavailable",
    "PHASE3_UI_EFFECTS ",
  ),
  // -- Phase 4 -----------------------------------------------------------
  pythonEntry(
    "phase4-panels",
    `${TESTS}/test_panels.py`,
    "the server-composed profile-driven object panel is unavailable",
    "PHASE4_PANEL_EFFECTS ",
  ),
  pythonEntry(
    "phase4-panel-enumeration",
    `${TESTS}/test_panel_enumeration.py`,
    "non-enumerating panel reads are unavailable",
    "PHASE4_PANEL_ENUM_EFFECTS ",
  ),
  pythonEntry(
    "phase4-view-stream",
    `${TESTS}/test_view_stream.py`,
    "the sequenced bounded view stream is unavailable",
    "PHASE4_STREAM_EFFECTS ",
  ),
  pythonEntry(
    "phase4-navigation",
    `${TESTS}/test_navigation.py`,
    "authorized non-enumerating address resolution is unavailable",
    "PHASE4_NAVIGATION_EFFECTS ",
  ),
  pythonEntry(
    "phase4-navigation-counts",
    `${TESTS}/test_navigation_counts.py`,
    "authorized-scope aggregate counts are unavailable",
    "PHASE4_COUNT_EFFECTS ",
  ),
  browserEntry(
    "phase4-panel-model",
    "the panel render model is unavailable",
    "PHASE4_PANEL_MODEL_EFFECTS ",
  ),
  browserEntry(
    "phase4-navigation-reducer",
    "address-as-state navigation is unavailable",
    "PHASE4_NAV_REDUCER_EFFECTS ",
  ),
  browserEntry(
    "phase4-command-outcome",
    "separated command outcome presentation is unavailable",
    "PHASE4_OUTCOME_EFFECTS ",
  ),
  browserEntry(
    "phase4-view-resync",
    "honest gap detection and resync are unavailable",
    "PHASE4_RESYNC_EFFECTS ",
  ),
  browserEntry(
    "phase4-ui",
    "complete exact-dist Phase-4 UI is unavailable",
    "PHASE4_UI_EFFECTS ",
  ),
]));

const HARNESS_FAILURES = [
  /Cannot find (?:module|package)/i,
  /ERR_(?:MODULE_NOT_FOUND|UNKNOWN_FILE_EXTENSION|INVALID_ARG)/,
  /SyntaxError:/,
  /ModuleNotFoundError|ImportError|IndentationError/,
  /INTERNALERROR|errors during collection|error collecting/i,
  /browserType\.launch/i,
  /Executable doesn't exist/i,
  /net::ERR_/,
  /Failed to load resource/i,
  /Exact-dist server did not bind/i,
  /PROHIBITED_EFFECT\[/,
  /ERROR at (?:setup|teardown)/i,
  /(?:^|\n)ERROR (?:tests?|test)\//,
  /fixture ['"].+['"] (?:failed|not found)/i,
  /(?:Test timeout|TimeoutError|timed out after)/i,
];

const ZERO_TEST_PATTERNS = [
  /no tests ran/i,
  /collected 0 items/i,
  /^# tests 0$/m,
  /Ran 0 tests/i,
];

const SKIP_PATTERNS = [
  /\b[1-9]\d*\s+skipped\b/i,
  /^# skipped [1-9]\d*$/m,
  /\bskipped\s+[1-9]\d*\b/i,
];

/** Collect every failing test identity from pytest, TAP and Playwright output. */
export function collectFailures(output) {
  const failures = [];
  for (const match of output.matchAll(/^(?:FAILED|ERROR)\s+(\S+)/gmu)) {
    failures.push(match[1]);
  }
  for (const match of output.matchAll(/^not ok \d+ - (.+)$/gmu)) {
    failures.push(match[1].trim());
  }
  for (const match of output.matchAll(/^\s*\d+\)\s+(.+?)\s*$/gmu)) {
    failures.push(match[1].trim());
  }
  return failures;
}

function usage(message) {
  const suffix = message ? `: ${message}` : "";
  throw new Error(`Usage: node tools/assert-red.mjs --expected=<name> -- <command> [args...]${suffix}`);
}

export function parseArgs(argv) {
  const separator = argv.indexOf("--");
  if (separator < 0) usage("missing command separator");
  const classifierArgs = argv.slice(0, separator);
  const command = argv.slice(separator + 1);
  if (command.length === 0) usage("missing command");
  if (classifierArgs.length !== 1 || !classifierArgs[0].startsWith("--expected=")) {
    usage("exactly one --expected argument is required");
  }
  const expected = classifierArgs[0].slice("--expected=".length);
  if (!Object.hasOwn(EXPECTED_RED, expected)) usage(`unknown expected RED name ${expected}`);
  return { expected, command };
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      windowsHide: true,
    });
    let output = "";
    const collect = (stream, destination) => {
      stream.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        destination.write(text);
      });
    };
    collect(child.stdout, process.stdout);
    collect(child.stderr, process.stderr);
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveRun({ code, signal, output }));
  });
}

/**
 * Return `null` when the run is an accepted controlled RED, otherwise a string
 * describing the exact rejection class.
 */
export function classify(expected, result) {
  if (result.signal) return `command terminated by signal ${result.signal}`;
  if (result.code === 0) return "command unexpectedly passed; the missing behavior may now be implemented";
  if (result.code !== 1) return `command exited ${result.code}; expected a test assertion exit code of 1`;

  const harnessFailure = HARNESS_FAILURES.find((pattern) => pattern.test(result.output));
  if (harnessFailure) return `rejected harness failure matching ${harnessFailure}`;

  const zeroTests = ZERO_TEST_PATTERNS.find((pattern) => pattern.test(result.output));
  if (zeroTests) return `rejected zero-test run matching ${zeroTests}`;

  const skipped = SKIP_PATTERNS.find((pattern) => pattern.test(result.output));
  if (skipped) return `rejected skipped test matching ${skipped}`;

  const { marker, evidence, identity } = EXPECTED_RED[expected];
  if (!result.output.includes(marker)) return `missing named RED marker: ${marker}`;
  if (!result.output.includes(evidence)) return `missing required RED evidence: ${evidence.trim()}`;

  for (const [name, other] of Object.entries(EXPECTED_RED)) {
    if (name !== expected && result.output.includes(other.marker)) {
      return `output contained a different RED marker: ${name}`;
    }
  }

  if (identity !== null) {
    const failures = collectFailures(result.output);
    if (failures.length === 0) {
      return `no failing test identity was reported for sentinel ${identity}`;
    }
    const unrelated = failures.filter((entry) => !entry.includes(identity));
    if (unrelated.length > 0) {
      return `rejected unrelated failing test: ${unrelated[0]}`;
    }
  }
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { expected, command } = parseArgs(process.argv.slice(2));
  const result = await run(command[0], command.slice(1));
  const rejection = classify(expected, result);
  if (rejection) {
    process.stderr.write(`RED_CLASSIFICATION_FAILED[${expected}]: ${rejection}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`CONTROLLED_RED[${expected}]: accepted expected missing behavior\n`);
  }
}
