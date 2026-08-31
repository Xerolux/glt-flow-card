import { spawn } from "node:child_process";

const EXPECTED_RED = Object.freeze({
  "missing-project-safety-ui": Object.freeze({
    marker: "EXPECTED_RED[missing-project-safety-ui]: Project safety workflow is unavailable",
    evidence: "EXACT_DIST_EFFECTS ",
  }),
  "missing-lifecycle-cleanup": Object.freeze({
    marker: "EXPECTED_RED[missing-lifecycle-cleanup]: exact lifecycle resources remain after unload",
    evidence: "LIFECYCLE_EFFECTS ",
  }),
});

const HARNESS_FAILURES = [
  /Cannot find (?:module|package)/i,
  /ERR_(?:MODULE_NOT_FOUND|UNKNOWN_FILE_EXTENSION|INVALID_ARG)/,
  /SyntaxError:/,
  /browserType\.launch/i,
  /Executable doesn't exist/i,
  /net::ERR_/,
  /Failed to load resource/i,
  /Exact-dist server did not bind/i,
  /PROHIBITED_EFFECT\[/,
  /ERROR at (?:setup|teardown)/i,
  /fixture ['"].+['"] (?:failed|not found)/i,
  /(?:Test timeout|TimeoutError|timed out after)/i,
];

function usage(message) {
  const suffix = message ? `: ${message}` : "";
  throw new Error(`Usage: node tools/assert-red.mjs --expected=<name> -- <command> [args...]${suffix}`);
}

function parseArgs(argv) {
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

function classify(expected, result) {
  if (result.signal) return `command terminated by signal ${result.signal}`;
  if (result.code === 0) return "command unexpectedly passed; the missing behavior may now be implemented";
  if (result.code !== 1) return `command exited ${result.code}; expected a test assertion exit code of 1`;

  const harnessFailure = HARNESS_FAILURES.find((pattern) => pattern.test(result.output));
  if (harnessFailure) return `rejected harness failure matching ${harnessFailure}`;

  const { marker, evidence } = EXPECTED_RED[expected];
  if (!result.output.includes(marker)) return `missing named RED marker: ${marker}`;
  if (!result.output.includes(evidence)) return `missing required RED evidence: ${evidence.trim()}`;
  for (const [name, other] of Object.entries(EXPECTED_RED)) {
    if (name !== expected && result.output.includes(other.marker)) {
      return `output contained a different RED marker: ${name}`;
    }
  }
  return null;
}

const { expected, command } = parseArgs(process.argv.slice(2));
const result = await run(command[0], command.slice(1));
const rejection = classify(expected, result);
if (rejection) {
  process.stderr.write(`RED_CLASSIFICATION_FAILED[${expected}]: ${rejection}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`CONTROLLED_RED[${expected}]: accepted expected missing behavior\n`);
}
