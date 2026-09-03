/**
 * Exact-dist Phase-3 semantic surfaces (T3-13).
 *
 * The model, its provenance and its state have to be legible in the bytes that
 * actually ship, in both languages, without colour being the only carrier of a
 * state and without any entity, device or area the viewer may not see.
 *
 * Grep group: `phase-3-ui`.
 */
import { expect, test } from "@playwright/test";

import {
  expectNoProhibitedEffects,
  formatEffectLedger,
  installFakeHomeAssistant,
  readEffectLedger,
  scanSeededSecrets,
} from "./fixtures/fake-ha.mjs";

async function mount(page, options = {}) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/$/,
  );
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installFakeHomeAssistant(page, options);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
  expect(pageErrors, "the release artifact must load without browser errors").toEqual([]);
}

test("phase-3-ui [expected-red:phase3-ui] the semantic surfaces ship in the exact artifact", async ({
  browser,
}) => {
  const english = await browser.newContext();
  const german = await browser.newContext();
  const pageOne = await english.newPage();
  const pageTwo = await german.newPage();

  try {
    await mount(pageOne, { locale: "en" });
    await mount(pageTwo, { locale: "de" });

    await expectNoProhibitedEffects(pageOne);
    await expectNoProhibitedEffects(pageTwo);
    expect(await scanSeededSecrets(pageOne)).toEqual([]);
    expect(await scanSeededSecrets(pageTwo)).toEqual([]);
    console.log(formatEffectLedger("PHASE3_UI_EFFECTS ", await readEffectLedger(pageOne)));

    const required = [
      ["semantic tree", "glt-flow-card-semantic-tree"],
      ["provenance card", "glt-flow-card-provenance-card"],
      ["mapping review", "glt-flow-card-mapping-review"],
      ["state badge", "glt-flow-card-state-badge"],
    ];
    const gaps = [];
    for (const [label, tag] of required) {
      const present = await pageOne.evaluate((name) => Boolean(customElements.get(name)), tag);
      if (!present) gaps.push(`${label} (${tag}) is not part of the generated artifact`);
    }

    if (gaps.length === 0) {
      // A state distinguished only by colour is unreadable to a large number of
      // operators and unusable in forced-colors mode.
      const cues = await pageOne.evaluate(() => {
        const badge = document.createElement("glt-flow-card-state-badge");
        document.body.append(badge);
        const seen = new Set();
        for (const state of ["running", "fault", "stale", "off", "communication_error"]) {
          badge.props = { resolved: { state, labels: { en: state, de: state }, modes: [], evidence: [] } };
          const symbol = badge.querySelector("[data-state-symbol]")?.getAttribute("data-state-symbol");
          if (symbol) seen.add(symbol);
        }
        const text = badge.textContent ?? "";
        badge.remove();
        return { symbols: [...seen], text };
      });
      if (cues.symbols.length < 4) {
        gaps.push(`states are distinguished by fewer than four symbols: ${cues.symbols.join(",")}`);
      }
      if (!cues.text.trim()) gaps.push("the state badge renders no text");

      const germanLabel = await pageTwo.evaluate(() => {
        const badge = document.createElement("glt-flow-card-state-badge");
        document.body.append(badge);
        badge.copy = (key) => key;
        badge.props = {
          resolved: { state: "fault", labels: { en: "Fault", de: "Störung" }, modes: [], evidence: [] },
          locale: "de",
        };
        const text = badge.textContent ?? "";
        badge.remove();
        return text;
      });
      if (!germanLabel.includes("Störung")) {
        gaps.push(`the German state label is missing, got ${JSON.stringify(germanLabel)}`);
      }
    }

    if (gaps.length > 0) {
      console.log("EXPECTED_RED[phase3-ui]: complete exact-dist Phase-3 UI is unavailable");
      for (const gap of gaps) console.log(`  ui gap: ${gap}`);
    }
    expect(gaps, "complete exact-dist Phase-3 UI is unavailable").toEqual([]);
  } finally {
    await english.close();
    await german.close();
  }
});
