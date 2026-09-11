import { expect, test } from "@playwright/test";
import { installFakeHomeAssistant } from "./fixtures/fake-ha.mjs";

test("interface-polish first save registers a generated project id and emits its revision", async ({ page }) => {
  await mount(page, true);
  await page.evaluate(() => {
    window.savedRequests = [];
    window.__fakeHass.callWS = async message => {
      window.savedRequests.push(message);
      if (message.type.endsWith("projects/list")) return [];
      if (message.type.endsWith("projects/create")) return { revision: 1 };
      return {};
    };
  });
  await page.getByRole("button", { name: "Projekte", exact: true }).click();
  await page.getByRole("button", { name: "Aktuelles Projekt speichern", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.savedRequests.filter(request => request.type.endsWith("projects/create")).length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.testCard._config.project.revision)).toBe(1);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1100)));
  expect(await page.evaluate(() => window.savedRequests.filter(request => request.type.endsWith("leases/acquire")).length)).toBe(0);
});

async function mount(page, editor = false) {
  await installFakeHomeAssistant(page);
  await page.goto(process.env.EXACT_DIST_BASE_URL);
  await page.evaluate(editor => {
    const card = document.createElement(editor ? "glt-flow-card-editor" : "glt-flow-card");
    card.setConfig({ title: "Heizzentrale · Gebäudeübersicht", views: [{ id: "plant", name: "Heizung und Warmwasser" }], equipment: [], datapoints: [], alarms: [] });
    card.hass = window.__fakeHass;
    document.body.append(card);
    window.testCard = card;
  }, editor);
}

test("interface-polish pending panels open immediately and closed reads stay closed", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { window.__fakeHass.callWS = () => new Promise(resolve => { window.finishRead = resolve; }); });
  await page.locator('[data-action="menu"]').click();
  await page.locator('[data-alarm]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("Loading data");
  await expect(dialog.locator('[aria-busy="true"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => window.finishRead({ states: [], history: [] }));
  await expect(dialog).toHaveCount(0);
});

for (const width of [320, 390, 768, 1440]) {
  test(`interface-polish readable dialog and designer reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page);
    await page.locator('[data-action="menu"]').click();
    await page.locator('[data-ops]').click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const close = dialog.locator('.glt-v1-close');
    expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await mount(page, true);
    await expect(page.locator('glt-flow-card-editor .work')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  });
}

test("interface-polish card fits after resizing and stops rendering after removal", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await mount(page);
  await expect.poll(() => page.evaluate(() => window.testCard._fitWidth)).toBeGreaterThan(800);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(() => page.evaluate(() => window.testCard._fitWidth)).toBeLessThan(400);
  const renders = await page.evaluate(async () => {
    const card = window.testCard;
    let count = 0;
    card._render = () => { count++; };
    card._queueRender();
    card.remove();
    document.dispatchEvent(new Event("fullscreenchange"));
    await new Promise(requestAnimationFrame);
    return count;
  });
  expect(renders).toBe(0);
});

test("interface-polish energy uses the shared dialog even when opened first", async ({ page }) => {
  await mount(page);
  await page.locator('[data-action="menu"]').click();
  await expect(page.locator('[data-g4panel="alarms"]')).toHaveCount(0);
  await page.locator('[data-v1-energy]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.locator('.glt-v1-card b').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
