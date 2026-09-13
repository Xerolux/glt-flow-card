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

test("interface-polish path animation requires every configured flow gate", async ({ page }) => {
  await installFakeHomeAssistant(page, { states: {
    "binary_sensor.sink_pump": { state: "on", attributes: {} },
    "binary_sensor.compressor": { state: "off", attributes: {} },
  } });
  await page.goto(process.env.EXACT_DIST_BASE_URL);
  await page.evaluate(() => {
    const card = document.createElement("glt-flow-card");
    card.setConfig({
      title: "Combined flow",
      views: [{ id: "plant", name: "Plant" }],
      equipment: [],
      datapoints: [],
      paths: [{
        id: "heat-pump-buffer",
        medium: "heating_supply",
        points: [[100, 100], [500, 100]],
        flow: { entity: "binary_sensor.sink_pump", requires: "binary_sensor.compressor" },
      }],
    });
    card.hass = window.__fakeHass;
    document.body.append(card);
    window.testCard = card;
  });
  const pipe = page.locator('glt-flow-card .glt-pipe-group[data-path-id="heat-pump-buffer"]');
  await expect(pipe).toHaveAttribute("data-flow-state", "idle");
  await expect(pipe.locator(".glt-pipe")).not.toHaveClass(/glt-pipe-animated/);

  await page.evaluate(() => {
    window.__fakeHass.states["binary_sensor.compressor"].state = "on";
    window.testCard.hass = { ...window.__fakeHass };
  });
  await expect(pipe).toHaveAttribute("data-flow-state", "active");
  await expect(pipe.locator(".glt-pipe")).toHaveClass(/glt-pipe-animated/);
});

test("interface-polish equipment without a state signal is not presented as active", async ({ page }) => {
  await installFakeHomeAssistant(page);
  await page.goto(process.env.EXACT_DIST_BASE_URL);
  await page.evaluate(() => {
    const card = document.createElement("glt-flow-card");
    card.setConfig({
      title: "Truthful status",
      views: [{ id: "plant", name: "Plant" }],
      equipment: [{ id: "buffer", type: "tank", name: "Buffer", x: 100, y: 100 }],
      datapoints: [],
      paths: [],
    });
    card.hass = window.__fakeHass;
    document.body.append(card);
  });
  const state = page.locator("glt-flow-card .glt-state");
  await expect(state).toHaveClass(/unmeasured/);
  await expect(state).toHaveText(/Kein Statussignal/);
});

test("interface-polish schematic fit uses visible content bounds", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await installFakeHomeAssistant(page);
  await page.goto(process.env.EXACT_DIST_BASE_URL);
  await page.evaluate(() => {
    const card = document.createElement("glt-flow-card");
    card.setConfig({
      title: "Readable schematic",
      canvas: { width: 2400, height: 1400, viewport_height: 600 },
      views: [{ id: "plant", name: "Plant", kind: "schematic" }],
      equipment: [{ id: "pump", type: "pump", x: 900, y: 500, width: 300, height: 180 }],
      datapoints: [],
      paths: [],
    });
    card.hass = window.__fakeHass;
    document.body.append(card);
    window.testCard = card;
  });
  await expect.poll(() => page.evaluate(() => window.testCard._fitScale)).toBeGreaterThan(1);
  const centered = await page.evaluate(() => {
    const card = window.testCard;
    const bounds = card._contentBounds();
    return { bounds, canvasWidth: card._config.canvas.width };
  });
  expect(centered.bounds.width).toBeLessThan(centered.canvasWidth);
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
