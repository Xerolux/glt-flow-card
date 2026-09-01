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
  const projectAction = page.locator('[data-g4="projects"]');
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
  await expect(dialog.locator(".glt-safe-close")).toBeFocused();
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

async function runDryRun(page) {
  const dialog = page.getByRole("dialog", { name: "Project safety" });
  await dialog.getByRole("tab", { name: "Migrate & compare" }).click();
  await dialog.getByRole("button", { name: "Run dry run" }).click();
  await expect(dialog.getByRole("status")).toContainText("Migration preview ready");
  return dialog;
}

test("project-safety migrate previews five diff categories before mutation", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  const dialog = await runDryRun(page);
  await expect(dialog.getByRole("list", { name: "Migration workflow" }).getByRole("listitem")).toHaveText([
    /Inspect/,
    /Preview/,
    /Backup/,
    /Apply/,
    /Verify/,
  ]);
  for (const category of ["Added", "Removed", "Moved", "Binding", "Configuration"]) {
    await expect(dialog.getByText(category, { exact: true })).toBeVisible();
  }
  const effects = await readEffectLedger(page);
  expect(effects.websocket.map((entry) => entry.type)).toContain("glt_flow_card/projects/preview");
  expect(effects.websocket.map((entry) => entry.type)).not.toContain("glt_flow_card/projects/apply");
});

test("project-safety selective apply keeps server-declared dependencies locked", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  const dialog = await runDryRun(page);
  const dependency = dialog.getByRole("checkbox", { name: /add:\/equipment\/pump-2/ });
  await expect(dependency).toBeChecked();
  await expect(dependency).toBeDisabled();
  await expect(dialog).toContainText("Required dependency");
});

test("project-safety selective apply sends only opaque preview authority and selected IDs", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  const dialog = await runDryRun(page);
  await dialog.getByRole("button", { name: "Apply selected changes" }).click();
  await expect(dialog.getByRole("heading", { name: "Confirm project changes" })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm project changes" }).click();
  await expect(dialog.getByRole("status")).toContainText("Project changes applied");
  const effects = await readEffectLedger(page);
  const apply = effects.websocket.find((entry) => entry.type === "glt_flow_card/projects/apply");
  expect(Object.keys(apply).sort()).toEqual(["expected_revision", "preview_id", "project_id", "selected_ids", "type"]);
  expect(apply.preview_id).toBe("preview-opaque-01");
  expect(apply.expected_revision).toBe(4);
  expect(apply).not.toHaveProperty("candidate");
  expect(effects.service).toEqual([]);
});

test("project-safety conflict requires fresh compare with no local fallback", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  const dialog = await runDryRun(page);
  await page.evaluate(() => { window.__fakeHaControl.mode = "revision-conflict"; });
  await dialog.getByRole("button", { name: "Apply selected changes" }).click();
  await dialog.getByRole("button", { name: "Confirm project changes" }).click();
  await expect(dialog.getByRole("status")).toContainText("Revision 4 is no longer current; revision 5 is active. Reload and compare again.");
  await expect(dialog.getByRole("button", { name: "Run fresh dry run" })).toBeVisible();
  await expectNoProhibitedEffects(page);
});

test("project-safety rollback requires typed name and server snapshot confirmation", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  const dialog = await runDryRun(page);
  await dialog.getByRole("button", { name: "Apply selected changes" }).click();
  await dialog.getByRole("button", { name: "Confirm project changes" }).click();
  await dialog.getByRole("button", { name: "Restore verified backup" }).click();
  const restore = dialog.getByRole("button", { name: "Restore verified backup" }).last();
  await expect(restore).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Enter the project name to confirm" }).fill("Exact Dist Plant");
  await expect(restore).toBeEnabled();
  await restore.click();
  await expect(dialog.getByRole("status")).toContainText("Verified backup restored");
  const effects = await readEffectLedger(page);
  const rollback = effects.websocket.find((entry) => entry.type === "glt_flow_card/projects/rollback");
  expect(rollback).toEqual({
    type: "glt_flow_card/projects/rollback",
    project_id: "exact-dist",
    snapshot_id: "snapshot-verified-01",
    expected_revision: 5,
    confirmation: "ROLLBACK exact-dist",
  });
  expect(effects.service).toEqual([]);
});

test("project-safety no fallback and no service when Companion rejects preview", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  await page.evaluate(() => { window.__fakeHaControl.mode = "unavailable"; });
  const dialog = page.getByRole("dialog", { name: "Project safety" });
  await dialog.getByRole("tab", { name: "Migrate & compare" }).click();
  await dialog.getByRole("button", { name: "Run dry run" }).click();
  await expect(dialog.getByRole("status")).toContainText("Companion unavailable — shared project operations are read-only.");
  await expectNoProhibitedEffects(page);
});

test("project-safety exact-dist manifest identity is proven before Chromium", async ({ page }) => {
  await mountEditor(page);
  const evidence = await page.evaluate(() => window.__exactDistEvidence);
  expect(evidence).toMatchObject({
    dist_www_equal: true,
    manifest_matches_dist: true,
  });
  expect(evidence.dist_sha256).toMatch(/^[a-f0-9]{64}$/u);
});

test("project-safety invalid and boundary validation shows stable paths", async ({ page }) => {
  await mountEditor(page, {
    project: {
      ...PROJECT,
      project: { id: "../unsafe", name: "Boundary project", revision: 4 },
    },
  });
  const dialog = await openProjectSafety(page);
  await dialog.getByRole("tab", { name: "Validate" }).click();
  await dialog.getByRole("button", { name: "Validate project" }).click();
  await expect(dialog.getByRole("status")).toContainText("Project validation failed");
  await expect(dialog).toContainText("/project/id");
  await expect(dialog).toContainText("Original project unchanged");
});

test("project-safety failure keeps project unchanged and offers a fresh dry run", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  const dialog = await runDryRun(page);
  await page.evaluate(() => { window.__fakeHaControl.mode = "apply-failure"; });
  await dialog.getByRole("button", { name: "Apply selected changes" }).click();
  await dialog.getByRole("button", { name: "Confirm project changes" }).click();
  await expect(dialog.getByRole("status")).toContainText("Project changes were not applied. Nothing was changed.");
  await expect(dialog.getByRole("button", { name: "Run fresh dry run" })).toBeVisible();
  await expectNoProhibitedEffects(page);
});

test("project-safety responsive theme matrix reflows at mobile and 200 percent zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce", forcedColors: "active" });
  await mountEditor(page);
  const dialog = await openProjectSafety(page);
  const bounds = await dialog.boundingBox();
  expect(bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.height).toBeLessThanOrEqual(844);
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  const reflow = await dialog.locator(".glt-safe-content").evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 1);
  const primary = dialog.getByRole("button", { name: "Validate project" });
  await expect(primary).toBeVisible();
});

test("project-safety keyboard-only apply confirmation can be cancelled", async ({ page }) => {
  await mountEditor(page);
  await openProjectSafety(page);
  const dialog = await runDryRun(page);
  const apply = dialog.getByRole("button", { name: "Apply selected changes" });
  await apply.focus();
  await page.keyboard.press("Enter");
  const cancel = dialog.getByRole("button", { name: "Cancel project changes" });
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("heading", { name: "Confirm project changes" })).toHaveCount(0);
  const effects = await readEffectLedger(page);
  expect(effects.websocket.map((entry) => entry.type)).not.toContain("glt_flow_card/projects/apply");
});

test("project-safety opaque asset xss network and no service canaries remain data", async ({ page }) => {
  await mountEditor(page, {
    project: {
      ...PROJECT,
      assets: [{
        ...PROJECT.assets[0],
        description: '<img src="https://example.invalid/canary" onerror="window.__gltXss=1"><script>window.__gltXss=2</script>',
        source_url: "https://example.invalid/asset.svg",
      }],
    },
  });
  await page.evaluate(() => { window.__gltXss = 0; });
  const dialog = await openProjectSafety(page);
  await dialog.getByRole("tab", { name: "Bundles" }).click();
  await expect(dialog).toContainText("assets/canary.svg");
  await expect(dialog.locator("img, iframe, object, embed, script")).toHaveCount(0);
  expect(await page.evaluate(() => window.__gltXss)).toBe(0);
  await expectNoProhibitedEffects(page);
});
