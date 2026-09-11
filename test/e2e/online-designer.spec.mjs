import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

for (const width of [390, 1200]) {
  test(`online designer imports and exports YAML at ${width}px`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const files = {
      "/editor/": ["docs/editor/index.html", "text/html"],
      "/editor/app.js": ["docs/editor/app.js", "text/javascript"],
      "/editor/style.css": ["docs/editor/style.css", "text/css"],
      "/vendor/js-yaml.mjs": ["node_modules/js-yaml/dist/js-yaml.mjs", "text/javascript"],
    };
    await page.route("http://glt-designer.test/**", async route => {
      const file = files[new URL(route.request().url()).pathname];
      if (!file) return route.fulfill({ status: 404 });
      await route.fulfill({ body: await readFile(new URL(`../../${file[0]}`, import.meta.url)), contentType: file[1] });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://glt-designer.test/editor/");
    await expect(page.locator(".mode-note")).toContainText("Offline-Designer");
    await page.locator("#import").click();
    await expect(page.getByRole("dialog", { name: "YAML Import" })).toBeVisible();
    await page.locator("#yaml").fill("type: custom:glt-flow-card\ntitle: Roundtrip Test\ncanvas: {width: 1200, height: 800}\nequipment: []\npaths: []\ndatapoints: []\nkpis: []\n");
    await page.locator("#load-yaml").click();
    await page.locator("#export").click();
    await expect(page.locator("#yaml")).toHaveValue(/title: Roundtrip Test/);
    const bounds = await page.getByRole("dialog").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Schließen", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  });
}
