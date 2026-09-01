import { expect, test } from "@playwright/test";
import {
  expectNoProhibitedEffects,
  installFakeHomeAssistant,
  readEffectLedger,
} from "./fixtures/fake-ha.mjs";

const PROJECT = {
  type: "custom:glt-flow-card",
  schema_version: 1,
  title: "Exact-dist Project safety seed",
  project: { id: "exact-dist", name: "Exact Dist Plant", revision: 4 },
  views: [{ id: "plant", name: "Plant", kind: "image" }],
  equipment: [],
  paths: [],
  datapoints: [],
  assets: [
    {
      id: "opaque-svg",
      path: "assets/canary.svg",
      media_type: "image/svg+xml",
      sha256: "a".repeat(64),
      size: 187,
    },
  ],
};

async function mountEditor(page, options = {}) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installFakeHomeAssistant(page, options);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(customElements.get("glt-flow-card-editor")))).toBe(true);
  expect(pageErrors, "release artifact must load without browser errors").toEqual([]);
  await page.evaluate((config) => {
    const editor = document.createElement("glt-flow-card-editor");
    editor.dataset.testid = "exact-dist-editor";
    editor.setConfig(config);
    editor.hass = window.__fakeHass;
    document.querySelector("main").append(editor);
  }, options.project ?? PROJECT);
  await expect(page.locator('[data-testid="exact-dist-editor"]')).toBeAttached();
  await expectNoProhibitedEffects(page);
}

async function openProjectSafety(page, label = "Project safety") {
  const projectAction = page.getByRole("button", { name: "Projects", exact: true });
  const projectSafety = page.getByRole("button", { name: label, exact: true });
  if (await projectSafety.count() === 0) {
    await expectNoProhibitedEffects(page);
    throw new Error("EXPECTED_RED[missing-project-safety-ui]: Project safety workflow is unavailable");
  }
  await expect(projectAction).toBeVisible();
  const adjacency = await projectAction.evaluate((node) => node.nextElementSibling?.textContent?.trim());
  expect(adjacency).toContain(label);
  await projectSafety.click();
  return page.getByRole("dialog", { name: label });
}

test("project-safety shell has one adjacent entry and five ordered tabs", async ({ page }) => {
  await mountEditor(page);
  const dialog = await openProjectSafety(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Project data only — no Home Assistant service or plant command is executed.")).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveText([
    "Overview",
    "Validate",
    "Migrate & compare",
    "Bundles",
    "Evidence",
  ]);
  await expect(page.getByRole("button", { name: "Project safety", exact: true })).toHaveCount(1);
  await expectNoProhibitedEffects(page);
});

test("project-safety validate reports raw contract success without mutation", async ({ page }) => {
  await mountEditor(page);
  const dialog = await openProjectSafety(page);
  await dialog.getByRole("tab", { name: "Validate" }).click();
  await dialog.getByRole("button", { name: "Validate project" }).click();
  await expect(dialog.getByRole("status")).toContainText("Project validation complete");
  await expect(dialog).toContainText("No validation issues found. The raw project matches schema 1.");
  await expect(dialog).toContainText("Original project unchanged");
  await expectNoProhibitedEffects(page);
});

test("project-safety bundles render opaque metadata only", async ({ page }) => {
  await mountEditor(page);
  const dialog = await openProjectSafety(page);
  await dialog.getByRole("tab", { name: "Bundles" }).click();
  await expect(dialog).toContainText("assets/canary.svg");
  await expect(dialog).toContainText("image/svg+xml");
  await expect(dialog.locator("img, iframe, object, embed, script")).toHaveCount(0);
  await expectNoProhibitedEffects(page);
});

test("project-safety evidence is metadata-only and release scoped", async ({ page }) => {
  await mountEditor(page);
  const dialog = await openProjectSafety(page);
  await dialog.getByRole("tab", { name: "Evidence" }).click();
  await expect(dialog).toContainText("Release evidence");
  await expect(dialog).toContainText("Exact card version");
  await expect(dialog).toContainText("Byte-identical");
  await expectNoProhibitedEffects(page);
});

test("project-safety keyboard traps focus, changes tabs, closes, and restores focus", async ({ page }) => {
  await mountEditor(page);
  const trigger = page.getByRole("button", { name: "Project safety", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Project safety" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close Project safety" })).toBeFocused();
  await dialog.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: "Validate" })).toBeFocused();
  for (let index = 0; index < 12; index += 1) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("project-safety locale renders approved German shell copy", async ({ page }) => {
  await mountEditor(page, { locale: "de" });
  const dialog = await openProjectSafety(page, "Projektsicherheit");
  await expect(dialog.getByRole("tab")).toHaveText([
    "Übersicht",
    "Validieren",
    "Migrieren & vergleichen",
    "Pakete",
    "Nachweise",
  ]);
  await expect(dialog).toContainText("Nur Projektdaten — es wird kein Home-Assistant-Dienst und kein Anlagenbefehl ausgeführt.");
  const effects = await readEffectLedger(page);
  expect(effects.service).toEqual([]);
});
