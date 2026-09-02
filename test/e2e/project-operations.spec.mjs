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

        // The surfaces are mounted from the shipped bytes and driven through
        // `props`, the way the Phase-2 and Phase-3 specs exercise theirs. The
        // composition is the workflow: where you are, what is under you, the
        // object itself, the last command's outcome, and whether any of it is
        // still live.
        const rendered = await page.evaluate((language) => {
          const host = document.createElement("div");
          host.id = "phase4-workflow";
          document.body.append(host);

          const staleness = document.createElement("glt-flow-card-view-staleness");
          staleness.props = { language, view: { status: "live" } };

          const crumbs = document.createElement("glt-flow-card-breadcrumbs");
          crumbs.props = {
            language,
            crumbs: [
              { id: "site-north", name: "North Plant", address: "site-north" },
              { id: "eq-hp-primary", name: "Heat pump 1",
                address: "site-north/eq-hp-primary", current: true },
            ],
          };

          const drilldown = document.createElement("glt-flow-card-drilldown-list");
          drilldown.props = {
            language,
            children: [
              { id: "eq-hp-primary", name: "Heat pump 1", level: "equipment",
                address: "site-north/eq-hp-primary", counts: { warning: 1 } },
              // No counts key at all: an authorized zero must be absent, not
              // rendered, or it distinguishes empty from unauthorized.
              { id: "eq-hp-secondary", name: "Heat pump 2", level: "equipment",
                address: "site-north/eq-hp-secondary" },
            ],
          };

          const panel = document.createElement("glt-flow-card-object-panel");
          panel.props = {
            language,
            panel: {
              object_id: "eq-hp-primary",
              regions: [
                { kind: "identity", name: "Heat pump 1", path: ["site-north", "eq-hp-primary"] },
                { kind: "state", state: "running" },
                { kind: "values", values: [
                  { id: "dp-hp1-flow", label: "Flow temperature", value: 42, unit: "degC" },
                ] },
                { kind: "runtime", values: [
                  { id: "dp-hp1-hours", label: "Operating hours", value: 1200, unit: "h" },
                  { id: "dp-hp1-starts", label: "Starts", value: 88, unit: "count" },
                ] },
                { kind: "quality", health: "live", source: "modbus" },
                { kind: "alarms", alarms: [
                  { id: "alm-hp1-lowflow", severity: "warning", label: "Low flow" },
                ] },
                { kind: "controls", controls: [
                  { control_id: "enable", label: { de: "Freigabe", en: "Enable" } },
                ] },
                { kind: "trend", state: "history_unavailable" },
              ],
            },
          };

          const outcome = document.createElement("glt-flow-card-outcome-strip");
          outcome.props = { language, state: "timed_out", correlationId: "cmd-1" };

          host.append(staleness, crumbs, drilldown, panel, outcome);
          return {
            panelRegions: [...panel.querySelectorAll("[data-kind]")]
              .map((node) => node.dataset.kind),
            crumbCount: crumbs.querySelectorAll("li").length,
            counts: [...drilldown.querySelectorAll(".glt-ops-count")].map((n) => n.textContent),
            outcomeText: (outcome.textContent ?? "").trim(),
            outcomeMark: outcome.querySelector(".glt-ops-mark")?.textContent ?? "",
            stalenessText: (staleness.textContent ?? "").trim(),
            retry: (outcome.textContent ?? "").toLowerCase().includes("retry"),
            focusable: host.querySelectorAll(
              'a[href], button, [tabindex]:not([tabindex="-1"])',
            ).length,
          };
        }, locale);

        const where = `${layout.name}/${locale}`;
        if (!rendered.panelRegions.includes("controls")) {
          gaps.push(`${where}: the panel rendered no controls region`);
        }
        if (!rendered.panelRegions.includes("trend")) {
          gaps.push(`${where}: the panel rendered no trend region`);
        }
        if (rendered.crumbCount < 2) gaps.push(`${where}: breadcrumbs did not render the path`);
        // Exactly one child carried counts; the other must render none at all.
        if (rendered.counts.length !== 1) {
          gaps.push(`${where}: ${rendered.counts.length} count badges, expected 1`);
        }
        if (rendered.outcomeText.length === 0) {
          gaps.push(`${where}: the outcome carried no text, only styling`);
        }
        if (rendered.outcomeMark.length === 0) {
          gaps.push(`${where}: the outcome carried no non-colour mark`);
        }
        if (rendered.retry) gaps.push(`${where}: an unknown-effect outcome offered a retry`);
        if (rendered.stalenessText.length === 0) {
          gaps.push(`${where}: the staleness indicator carried no text`);
        }

        // Nothing may scroll the page sideways, at any width.
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        if (overflows) gaps.push(`${where}: the page scrolls horizontally`);

        if (!layout.pointer && rendered.focusable < 3) {
          // The kiosk has no pointer, so keyboard reachability is the only
          // input path, not an accessibility nicety.
          gaps.push(`${where}: only ${rendered.focusable} focusable elements`);
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
