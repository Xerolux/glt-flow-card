import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { chromium, defineConfig, devices } from "@playwright/test";

/**
 * A container may ship a Chromium build that does not match this Playwright
 * revision. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` points the browser at that exact
 * binary without changing the pinned Playwright version or CI's own resolution.
 *
 * When it is unset, the pinned revision is preferred and used silently. Only if
 * that revision is **absent from disk** is an installed sibling substituted, and
 * the substitution is printed rather than made quietly: running the browser
 * suites against a different browser than the one named is a fact about the
 * evidence, and evidence that changes its own meaning without saying so is the
 * defect this repository keeps closing.
 */
function resolveExecutable() {
  const declared = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (declared) return declared;

  let pinned = null;
  try {
    pinned = chromium.executablePath();
  } catch {
    pinned = null;
  }
  if (pinned && existsSync(pinned)) return undefined; // Playwright resolves it itself.

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  // Sorted by revision as a number, not as text: `chromium-999` sorts after
  // `chromium-1234` lexicographically, which would pick the older build.
  const candidates = readdirSync(root)
    .map((name) => /^chromium-(\d+)$/u.exec(name))
    .filter(Boolean)
    .map((match) => ({ path: path.join(root, match[0], "chrome-linux", "chrome"), revision: Number(match[1]) }))
    .filter((candidate) => existsSync(candidate.path))
    .sort((a, b) => a.revision - b.revision);
  if (candidates.length === 0) return undefined;

  const substitute = candidates.at(-1).path;
  console.log(
    `playwright: pinned Chromium ${pinned ? path.basename(path.dirname(path.dirname(pinned))) : "(unresolved)"} ` +
    `is not installed; using ${substitute}`,
  );
  return substitute;
}

const executablePath = resolveExecutable();
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    launchOptions,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
  ],
});
