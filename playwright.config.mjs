import { defineConfig, devices } from "@playwright/test";

/**
 * A container may ship a Chromium build that does not match this Playwright
 * revision. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` points the browser at that exact
 * binary without changing the pinned Playwright version or CI's own resolution.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
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
