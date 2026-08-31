import { expect, test } from "@playwright/test";
import {
  expectNoProhibitedEffects,
  installFakeHomeAssistant,
} from "./fixtures/fake-ha.mjs";

test("project-safety exact-dist workflow validates, compares, applies, and verifies", async ({ page }) => {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installFakeHomeAssistant(page);
  await page.goto(baseUrl, { waitUntil: "load" });

  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(customElements.get("glt-flow-card")))).toBe(true);
  expect(pageErrors, "release artifact must load without browser errors").toEqual([]);

  await page.evaluate(() => {
    const card = document.createElement("glt-flow-card");
    card.setConfig({
      type: "custom:glt-flow-card",
      schema_version: 1,
      title: "Exact-dist Project safety seed",
      equipment: [],
      paths: [],
      datapoints: [],
    });
    card.hass = window.__fakeHass;
    card.dataset.testid = "exact-dist-card";
    document.querySelector("main").append(card);
  });
  await expect(page.locator('[data-testid="exact-dist-card"]')).toBeAttached();
  await expectNoProhibitedEffects(page);

  const projectSafety = page.getByRole("button", { name: "Project safety", exact: true });
  if (await projectSafety.count() === 0) {
    await expectNoProhibitedEffects(page);
    throw new Error("EXPECTED_RED[missing-project-safety-ui]: Project safety workflow is unavailable");
  }

  await projectSafety.click();
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await page.getByRole("button", { name: "Migrate / compare", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Verified");
  await expectNoProhibitedEffects(page);
});
