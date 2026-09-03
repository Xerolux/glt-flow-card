/**
 * Resolve the declared Python 3.13 interpreter for cross-runtime parity gates.
 *
 * The repository targets Python 3.13. Windows developers use the `py` launcher,
 * while CI containers and Linux checkouts expose a versioned interpreter or a
 * virtual environment. Every gate resolves the interpreter through this module so
 * the same command works on all declared lanes without weakening the version pin.
 *
 * Resolution order:
 *   1. `GLT_PYTHON` - explicit interpreter, optionally with arguments.
 *   2. Windows - `py -3.13`.
 *   3. First working candidate among a repository virtual environment,
 *      `python3.13`, `py -3.13`, and `python3`.
 *
 * A resolved interpreter must report exactly Python 3.13 unless `GLT_PYTHON`
 * explicitly overrides it, so parity evidence cannot silently move to another
 * language version.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REQUIRED_VERSION = "3.13";

function split(value) {
  return String(value).trim().split(/\s+/u).filter(Boolean);
}

function probe(command, args) {
  const completed = spawnSync(command, [...args, "-c", "import sys;print('%d.%d' % sys.version_info[:2])"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (completed.status !== 0 || typeof completed.stdout !== "string") {
    return null;
  }
  return completed.stdout.trim();
}

function candidates() {
  const found = [];
  const venvUnix = `${ROOT}.venv/bin/python`;
  const venvWindows = `${ROOT}.venv\\Scripts\\python.exe`;
  if (existsSync(venvUnix)) {
    found.push([venvUnix, []]);
  }
  if (existsSync(venvWindows)) {
    found.push([venvWindows, []]);
  }
  if (process.platform === "win32") {
    found.push(["py", ["-3.13"]]);
  }
  found.push(["python3.13", []], ["py", ["-3.13"]], ["python3", []], ["python", []]);
  return found;
}

let cached = null;

/**
 * Return `{ command, args }` for the declared Python 3.13 interpreter.
 * Throws when no candidate reports the pinned version.
 */
export function resolvePython() {
  if (cached) {
    return cached;
  }
  const override = process.env.GLT_PYTHON;
  if (override) {
    const [command, ...args] = split(override);
    cached = { command, args };
    return cached;
  }
  const attempted = [];
  for (const [command, args] of candidates()) {
    const version = probe(command, args);
    attempted.push(`${command} ${args.join(" ")}`.trim() + ` -> ${version ?? "unavailable"}`);
    if (version === REQUIRED_VERSION) {
      cached = { command, args };
      return cached;
    }
  }
  throw new Error(
    `no Python ${REQUIRED_VERSION} interpreter found; set GLT_PYTHON to an explicit interpreter.\n` +
      attempted.map((line) => `  ${line}`).join("\n"),
  );
}

/**
 * Return the full argument vector for running the resolved interpreter.
 */
export function pythonArgs(...args) {
  return [...resolvePython().args, ...args];
}

/**
 * Return a shell-quoted command string for evidence tables and script chains.
 */
export function pythonCommand(...args) {
  const { command, args: base } = resolvePython();
  return [command, ...base, ...args].join(" ");
}

export default resolvePython;

/* CLI: `node tools/python-launcher.mjs <args...>` runs the resolved interpreter. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { command, args } = resolvePython();
  const forwarded = process.argv.slice(2);
  const completed = spawnSync(command, [...args, ...forwarded], {
    stdio: "inherit",
    windowsHide: true,
  });
  process.exit(completed.status ?? 1);
}
