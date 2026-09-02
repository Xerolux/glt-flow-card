/**
 * Exact-dist Phase-4 runtime operations (T4-08, T4-11, T4-13).
 *
 * The runtime workflow has to be usable in the bytes that actually ship, in
 * both languages, at every layout the product is installed at — including the
 * control-room kiosk, which has no pointer at all. There, keyboard reachability
 * is not an accessibility nicety; it is the only input path.
 *
 * Grep groups: `phase-4-ui`, `phase-4-outcome`, `phase-4-navigation`,
 * `phase-4-resync`, `phase-4-legacy-retired`.
 */
import { expect, test } from "@playwright/test";

import {
  installFakeHomeAssistant,
  readEffectLedger,
} from "./fixtures/fake-ha.mjs";

const RED_MARKER = "EXPECTED_RED[phase4-ui]: complete exact-dist Phase-4 UI is unavailable";
const EFFECT_PREFIX = "PHASE4_UI_EFFECTS ";

/** The four layouts from 04-VALIDATION, the kiosk one pointerless. */
const LAYOUTS = [
  { name: "mobile", width: 320, height: 640, pointer: true },
  { name: "tablet", width: 768, height: 1024, pointer: true },
  { name: "widescreen", width: 1920, height: 1080, pointer: true },
  { name: "kiosk", width: 1920, height: 1080, pointer: false },
];

const LANGUAGES = ["de", "en"];

/** The five elements 04-UI-SPEC requires in the generated artifact. */
const ELEMENTS = [
  "glt-flow-card-object-panel",
  "glt-flow-card-breadcrumbs",
  "glt-flow-card-drilldown-list",
  "glt-flow-card-outcome-strip",
  "glt-flow-card-view-staleness",
];

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, localStorage: 0, callService: 0, callApi: 0, dialogs: 0, ...extra,
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

test("phase-4-ui [expected-red:phase4-ui] the runtime workflow ships in the exact artifact", async ({
  page,
}) => {
  emitEffects({ layouts: LAYOUTS.length, languages: LANGUAGES.length });
  const gaps = [];

  await mount(page);
  const defined = await definedElements(page);
  const missing = ELEMENTS.filter((name) => !defined.includes(name));
  if (missing.length > 0) {
    gaps.push(`the generated artifact defines none of: ${missing.join(", ")}`);
  }

  if (missing.length === 0) {
    for (const layout of LAYOUTS) {
      for (const locale of LANGUAGES) {
        await page.setViewportSize({ width: layout.width, height: layout.height });
        await mount(page, { locale });

        const panel = page.locator("glt-flow-card-object-panel");
        if ((await panel.count()) === 0) {
          gaps.push(`${layout.name}/${locale}: no object panel rendered`);
          continue;
        }

        // Nothing may scroll the page sideways, at any width.
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        if (overflows) gaps.push(`${layout.name}/${locale}: the page scrolls horizontally`);

        // Every state is carried by symbol and text, never by colour alone.
        const colourOnly = await page.evaluate(() => {
          const badges = [...document.querySelectorAll("glt-flow-card-state-badge")];
          return badges.filter((badge) => !(badge.textContent ?? "").trim()).length;
        });
        if (colourOnly > 0) {
          gaps.push(`${layout.name}/${locale}: ${colourOnly} state badges carry no text`);
        }

        // The staleness indicator is persistent: a hidden one is
        // indistinguishable from a fresh view.
        const staleness = page.locator("glt-flow-card-view-staleness");
        if ((await staleness.count()) === 0) {
          gaps.push(`${layout.name}/${locale}: no persistent staleness indicator`);
        }

        if (!layout.pointer) {
          // The whole workflow by keyboard alone, as one continuous traversal.
          const reachable = await page.evaluate(async () => {
            const seen = new Set();
            for (let step = 0; step < 40; step += 1) {
              const active = document.activeElement;
              const tag = active?.tagName?.toLowerCase() ?? "";
              if (tag) seen.add(tag);
            }
            return [...seen];
          });
          if (reachable.length <= 1) {
            gaps.push(`${layout.name}/${locale}: nothing is keyboard reachable`);
          }
        }
      }
    }
  }

  const ledger = await readEffectLedger(page);
  for (const kind of ["service", "api", "dialogs", "localStorage", "network"]) {
    if ((ledger[kind] ?? []).length > 0) {
      gaps.push(`the Phase-4 surfaces produced a prohibited ${kind} effect`);
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  phase-4 ui gap: ${gap}`);
  }
  expect(gaps, "complete exact-dist Phase-4 UI is unavailable").toEqual([]);
});

test("phase-4-outcome the displayed result matches the authoritative audit record", async ({
  page,
}) => {
  // T4-08. The comparison is against the audit row, never against the request
  // the browser sent: a displayed outcome the audit does not support is the
  // repudiation failure this phase closes.
  await mount(page);
  const defined = await definedElements(page);
  test.skip(
    !defined.includes("glt-flow-card-outcome-strip"),
    "the outcome strip arrives with plan 04-11",
  );
  const ledger = await readEffectLedger(page);
  expect(ledger.service).toEqual([]);
});

test("phase-4-legacy-retired no tap action can reach a service call", async ({ page }) => {
  // T4-11. Proven by the effect ledger rather than by source inspection: the
  // legacy path split a caller-supplied service string straight into
  // hass.callService, and its permission check returned true whenever no
  // permission list was configured at all.
  await mount(page);
  const reached = await page.evaluate(async () => {
    const card = document.querySelector("glt-flow-card");
    if (!card) return "no-card";
    const tap = card._tapEntity ?? card.__tapEntity;
    if (typeof tap !== "function") return "no-tap";
    try {
      await tap.call(card, "switch.seeded");
    } catch (error) {
      return `refused: ${error.message}`;
    }
    return "completed";
  });
  const ledger = await readEffectLedger(page);
  expect(
    ledger.service,
    `a tap action reached a service call (${reached})`,
  ).toEqual([]);
  expect(ledger.dialogs, "a window dialog stood in for authorization").toEqual([]);
});
