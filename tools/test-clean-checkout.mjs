/* Prove the default build, staging, and Node gates from tracked files only. */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: options.shell ?? false,
  });
  if (result.status !== 0) {
    throw new Error(
      `${options.label ?? command} failed:\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result;
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "glt-clean-checkout-"));
  const archivePath = path.join(tempRoot, "tracked.tar");
  const checkoutRoot = path.join(tempRoot, "checkout");
  const npm = process.platform === "win32" ? process.env.ComSpec : "npm";
  try {
    await mkdir(checkoutRoot);
    run("git", ["archive", "--format=tar", "--output", archivePath, "HEAD"], {
      label: "git archive",
    });
    run("tar", ["-xf", archivePath, "-C", checkoutRoot], {
      label: "tracked export extraction",
    });
    await symlink(
      path.join(ROOT, "node_modules"),
      path.join(checkoutRoot, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    for (const [label, args] of [
      ["clean build", ["run", "build"]],
      ["clean HACS stage", ["run", "stage:hacs"]],
      ["clean default Node suite", ["test"]],
    ]) {
      run(npm, process.platform === "win32"
        ? ["/d", "/s", "/c", "npm", ...args]
        : args, {
        cwd: checkoutRoot,
        label,
      });
    }
    console.log("PASS clean tracked export build, HACS staging, and default Node suite");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`clean checkout verification failed: ${error.message}`);
  process.exitCode = 1;
});
