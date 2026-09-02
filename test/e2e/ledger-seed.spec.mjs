/**
 * The Phase-4 effect ledger really refuses what it claims to refuse.
 *
 * A ledger nobody has seen fail is a ledger nobody should trust. Every
 * capability Phase 4 forbids is deliberately exercised here and asserted to be
 * both recorded and refused, so the zero counts the Phase-4 UI evidence reports
 * mean something.
 *
 * Grep group: `phase-4-ledger-seed`.
 */
import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant, readEffectLedger } from "./fixtures/fake-ha.mjs";

async function mount(page) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/$/,
  );
  await installFakeHomeAssistant(page);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
}

test("phase-4-ledger-seed a seeded service call is recorded and refused", async ({ page }) => {
  await mount(page);
  const outcome = await page.evaluate(async () => {
    let refused = null;
    try {
      await window.__fakeHass.callService("switch", "turn_on", { entity_id: "switch.seeded" });
    } catch (error) {
      refused = error.message;
    }
    return { refused, recorded: window.__gltEffects.service };
  });
  expect(outcome.refused, "a service call must be refused").toMatch(
    /PROHIBITED_EFFECT\[service\]/,
  );
  expect(outcome.recorded).toHaveLength(1);
  expect(outcome.recorded[0]).toMatchObject({ domain: "switch", service: "turn_on" });
});

test("phase-4-ledger-seed a seeded Recorder read is recorded and refused", async ({ page }) => {
  // callApi did not exist on the shim before Phase 4, so a Recorder read threw
  // a TypeError and the classifier called it a broken harness rather than the
  // prohibited effect it is.
  await mount(page);
  const outcome = await page.evaluate(async () => {
    let refused = null;
    try {
      await window.__fakeHass.callApi("GET", "history/period/2026-01-01T00:00:00.000Z");
    } catch (error) {
      refused = error.message;
    }
    return { refused, recorded: window.__gltEffects.api };
  });
  expect(outcome.refused, "a Recorder read must be refused").toMatch(/PROHIBITED_EFFECT\[api\]/);
  expect(outcome.recorded).toHaveLength(1);
  expect(outcome.recorded[0]).toMatchObject({ method: "GET" });
  expect(outcome.recorded[0].path).toContain("history/period");
});

test("phase-4-ledger-seed a seeded window dialog is recorded and refused", async ({ page }) => {
  await mount(page);
  const outcome = await page.evaluate(() => {
    const refusals = [];
    for (const kind of ["confirm", "alert", "prompt"]) {
      try {
        window[kind]("seeded");
      } catch (error) {
        refusals.push(error.message);
      }
    }
    return { refusals, recorded: window.__gltEffects.dialogs };
  });
  expect(outcome.refusals).toHaveLength(3);
  for (const message of outcome.refusals) {
    expect(message).toMatch(/PROHIBITED_EFFECT\[dialog\]/);
  }
  expect(outcome.recorded.map((entry) => entry.kind)).toEqual(["confirm", "alert", "prompt"]);
});

test("phase-4-ledger-seed every effect carries an origin", async ({ page }) => {
  // Without attribution, a new Phase-4 call could hide behind the known legacy
  // Recorder read that Phase 7 still owns.
  await mount(page);
  const origins = await page.evaluate(async () => {
    try {
      await window.__fakeHass.callApi("GET", "history/period/x");
    } catch { /* recorded above */ }
    try {
      await window.__fakeHass.callService("switch", "turn_on", {});
    } catch { /* recorded above */ }
    return {
      api: window.__gltEffects.api.map((entry) => entry.origin),
      service: window.__gltEffects.service.map((entry) => entry.origin),
    };
  });
  for (const origin of [...origins.api, ...origins.service]) {
    expect(typeof origin).toBe("string");
    expect(origin.length).toBeGreaterThan(0);
  }
});

test("phase-4-ledger-seed a clean run reports zero for every Phase-4 capability", async ({
  page,
}) => {
  await mount(page);
  // readEffectLedger returns the recorded entries themselves, not counts.
  const ledger = await readEffectLedger(page);
  for (const kind of ["service", "api", "dialogs", "localStorage", "network"]) {
    expect(ledger[kind], `${kind} must be empty on a clean run`).toEqual([]);
  }
});
