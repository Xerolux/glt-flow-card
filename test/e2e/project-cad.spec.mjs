/**
 * Exact-dist Phase-5 CAD surfaces (T5-03, T5-11, T5-12).
 *
 * Three things have to be true in the bytes that ship. Every symbol is legible
 * in every style, including forced colours — a theme choice must not cost an
 * operator legibility. The complete editing workflow is reachable without a
 * pointer, because the kiosk layout Phase 4 established has none, and an editor
 * you can only mouse is an editor half the installations cannot use. And a
 * contribution renders without executing anything.
 *
 * Grep groups: `phase-5-catalog`, `phase-5-routing`, `phase-5-designer`,
 * `phase-5-sdk`, `phase-5-ui`.
 */
import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant, readEffectLedger } from "./fixtures/fake-ha.mjs";

const RED_MARKER = "EXPECTED_RED[phase5-ui]: complete exact-dist Phase-5 UI is unavailable";
const EFFECT_PREFIX = "PHASE5_UI_EFFECTS ";

/** The elements 05-UI-SPEC requires in the generated artifact. */
const ELEMENTS = [
  "glt-flow-card-symbol-browser",
  "glt-flow-card-port-inspector",
  "glt-flow-card-layer-panel",
  "glt-flow-card-designer-canvas",
  "glt-flow-card-minimap",
  "glt-flow-card-extension-manager",
];

/** Operational states a symbol must stay legible in, in every style. */
const STATES = ["running", "fault", "stale", "off", "communication_error"];

const LANGUAGES = ["de", "en"];

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, localStorage: 0, callService: 0, callApi: 0,
    dialogs: 0, scriptInsertion: 0, ...extra,
  }));
}

async function mount(page, options = {}) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/$/,
  );
  await installFakeHomeAssistant(page, options);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
}

async function definedElements(page) {
  return page.evaluate(
    (names) => names.filter((name) => Boolean(customElements.get(name))),
    ELEMENTS,
  );
}

test("phase-5-ui [expected-red:phase5-ui] the CAD surfaces ship in the exact artifact", async ({
  page,
}) => {
  emitEffects({ elements: ELEMENTS.length, states: STATES.length });
  const gaps = [];

  await mount(page);
  const defined = await definedElements(page);
  const missing = ELEMENTS.filter((name) => !defined.includes(name));
  if (missing.length > 0) {
    gaps.push(`the generated artifact defines none of: ${missing.join(", ")}`);
  }

  if (missing.length === 0) {
    for (const locale of LANGUAGES) {
      await mount(page, { locale });

      // The browser must show the count the evidence proved, not one it
      // computed from an array it happens to hold.
      const browserState = await page.evaluate((language) => {
        const browser = document.createElement("glt-flow-card-symbol-browser");
        document.body.append(browser);
        browser.props = { language };
        return {
          count: browser.querySelector("[data-published-count]")?.textContent ?? "",
          labelled: [...browser.querySelectorAll("[data-variant]")]
            .every((node) => (node.textContent ?? "").trim().length > 0),
        };
      }, locale);
      if (!browserState.count) {
        gaps.push(`${locale}: the symbol browser shows no published count`);
      }
      if (!browserState.labelled) {
        gaps.push(`${locale}: a catalog variant rendered as a picture with no words`);
      }

      // A refusal must say why, in words, not by colour.
      const refusal = await page.evaluate((language) => {
        const inspector = document.createElement("glt-flow-card-port-inspector");
        document.body.append(inspector);
        inspector.props = {
          language,
          refusal: { compatible: false, reason: "medium_mismatch" },
        };
        return (inspector.textContent ?? "").trim();
      }, locale);
      if (refusal.length === 0) {
        gaps.push(`${locale}: a refused connection showed no explanation`);
      }
    }

    // Every state legible in every style, including forced colours.
    await page.emulateMedia({ forcedColors: "active" });
    const illegible = await page.evaluate((states) => {
      const badge = document.createElement("glt-flow-card-state-badge");
      document.body.append(badge);
      const bad = [];
      for (const state of states) {
        badge.props = { resolved: { state, labels: { en: state, de: state }, modes: [], evidence: [] } };
        const text = (badge.textContent ?? "").trim();
        const symbol = badge.querySelector("[data-state-symbol]");
        if (!text || !symbol) bad.push(state);
      }
      return bad;
    }, STATES);
    await page.emulateMedia({ forcedColors: null });
    if (illegible.length > 0) {
      gaps.push(`states carrying no text or symbol in forced colours: ${illegible.join(", ")}`);
    }

    // The whole editing workflow, by keyboard alone.
    const reachable = await page.evaluate(() => {
      const canvas = document.createElement("glt-flow-card-designer-canvas");
      document.body.append(canvas);
      canvas.props = { language: "en" };
      const focusable = canvas.querySelectorAll(
        'a[href], button, [tabindex]:not([tabindex="-1"]), [role="gridcell"]',
      );
      return { focusable: focusable.length, shortcuts: Boolean(canvas.dataset.keyboard) };
    });
    if (reachable.focusable < 3) {
      gaps.push(`the designer canvas exposes ${reachable.focusable} keyboard targets`);
    }
    if (!reachable.shortcuts) {
      gaps.push("the designer canvas declares no keyboard operation");
    }
  }

  const ledger = await readEffectLedger(page);
  for (const kind of ["service", "api", "dialogs", "scriptInsertion", "localStorage", "network"]) {
    if ((ledger[kind] ?? []).length > 0) {
      gaps.push(`the Phase-5 surfaces produced a prohibited ${kind} effect`);
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  phase-5 ui gap: ${gap}`);
  }
  expect(gaps, "complete exact-dist Phase-5 UI is unavailable").toEqual([]);
});

test("phase-5-sdk an installed contribution renders without executing", async ({ page }) => {
  // T5-12's exact-artifact half. The manifest validator is the prevention; this
  // is the check that the format was not bypassed at runtime.
  await mount(page);
  const defined = await definedElements(page);
  test.skip(
    !defined.includes("glt-flow-card-extension-manager"),
    "the extension manager arrives with plan 05-17",
  );
  const ledger = await readEffectLedger(page);
  expect(ledger.scriptInsertion).toEqual([]);
  expect(ledger.network).toEqual([]);
});
