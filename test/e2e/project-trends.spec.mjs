/**
 * Exact-dist Phase-7 trend, energy and report surfaces (T7-19, T7-20).
 *
 * Three things have to be true in the bytes that ship.
 *
 * A gap is a **break**, and this is the single most important pixel in the
 * phase. Not dashed, not lighter, not a tooltip: on a monochrome kiosk and in
 * forced colours those are all the same line, and the reader must not be able
 * to mistake absence for a measurement.
 *
 * Every chart has a keyboard-reachable tabular alternative. Phase 4 established
 * that the control-room kiosk has no pointer at all, so there the table is the
 * only way to read a trend.
 *
 * Operator text is set as text content and never interpolated into markup —
 * asserted by **structure**, because escaped text still contains `onerror=` as
 * characters and Phase 6 lost a cycle to a substring search failing a correct
 * implementation.
 *
 * Grep group: `phase-7-trends`.
 */
import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant, readEffectLedger } from "./fixtures/fake-ha.mjs";

const EFFECT_PREFIX = "PHASE7_UI_EFFECTS ";

const ELEMENTS = [
  "glt-flow-card-trend-chart",
  "glt-flow-card-trend-table",
  "glt-flow-card-coverage-badge",
  "glt-flow-card-period-picker",
  "glt-flow-card-energy-summary",
  "glt-flow-card-report-designer",
];

const LANGUAGES = ["de", "en"];

/** A series with a hole in the middle: two readings, a gap, two readings. */
const HOLED = {
  gaps: [{ end: "2027-06-06T00:00:00+02:00", start: "2027-06-03T00:00:00+02:00" }],
  series: [{
    label: "Vorlauf",
    points: [
      { at: "2027-06-01T00:00:00+02:00", state: "value", value: 21 },
      { at: "2027-06-02T00:00:00+02:00", state: "value", value: 22 },
      { at: "2027-06-06T00:00:00+02:00", state: "value", value: 23 },
      { at: "2027-06-07T00:00:00+02:00", state: "value", value: 24 },
    ],
  }],
};

async function mount(page, options = {}) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/$/,
  );
  await installFakeHomeAssistant(page, options);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
}

test("phase-7-trends the surfaces ship in the exact artifact", async ({ page }) => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    elements: ELEMENTS.length, languages: LANGUAGES.length,
  }));
  await mount(page);
  const defined = await page.evaluate(
    (names) => names.filter((name) => Boolean(customElements.get(name))),
    ELEMENTS,
  );
  expect(defined.sort()).toEqual([...ELEMENTS].sort());
});

test("phase-7-trends a gap is a break in the line, not a line of any style", async ({ page }) => {
  await mount(page);
  const drawn = await page.evaluate((data) => {
    const chart = document.createElement("glt-flow-card-trend-chart");
    document.body.append(chart);
    chart.props = { ...data, coverage: 4 / 7, language: "de" };
    const plot = chart.querySelector("[data-plot]");
    return {
      gapMarkers: plot.querySelectorAll("[data-gap]").length,
      // Two runs of readings with a hole between them must be two segments.
      // One segment would mean the line closed over the gap.
      segments: plot.querySelectorAll("[data-segment]").length,
    };
  }, HOLED);
  expect(drawn.segments, "the series was drawn as one unbroken run across the gap").toBe(2);
  expect(drawn.gapMarkers).toBeGreaterThan(0);
});

test("phase-7-trends coverage is stated even at one hundred percent", async ({ page }) => {
  // If the badge only appeared when something was missing, its absence would
  // come to mean "we forgot to check".
  await mount(page);
  const stated = await page.evaluate(() => {
    const badge = document.createElement("glt-flow-card-coverage-badge");
    document.body.append(badge);
    badge.props = { coverage: 1, gaps: [], language: "de" };
    return badge.querySelector("[data-coverage-text]")?.textContent ?? "";
  });
  expect(stated).toContain("100");
});

test("phase-7-trends every chart has a keyboard-reachable table where a gap is a row", async ({ page }) => {
  await mount(page);
  const table = await page.evaluate((data) => {
    const element = document.createElement("glt-flow-card-trend-table");
    document.body.append(element);
    element.props = { ...data, language: "de" };
    return {
      gapRows: element.querySelectorAll("[data-gap-row]").length,
      reachable: element.getAttribute("tabindex"),
      rows: element.querySelectorAll("tr").length,
    };
  }, HOLED);
  expect(table.reachable, "the table cannot be reached without a pointer").toBe("0");
  expect(table.gapRows, "a gap is a blank cell or an omitted row rather than a marked one")
    .toBeGreaterThan(0);
  expect(table.rows).toBeGreaterThan(1);
});

test("phase-7-trends an unreadable point is marked, never blank", async ({ page }) => {
  // A blank cell reads as a measurement of nothing. "I could not read this" and
  // "it was zero" are different statements and only one of them is true.
  await mount(page);
  const marked = await page.evaluate(() => {
    const element = document.createElement("glt-flow-card-trend-table");
    document.body.append(element);
    element.props = {
      language: "de",
      series: [{
        label: "Fühler",
        points: [
          { at: "2027-06-01T00:00:00+02:00", state: "value", value: 21 },
          { at: "2027-06-02T00:00:00+02:00", state: "indeterminate", value: null },
        ],
      }],
    };
    const cells = [...element.querySelectorAll("[data-unreadable]")];
    return { count: cells.length, text: cells[0]?.textContent ?? "" };
  });
  expect(marked.count).toBe(1);
  expect(marked.text.length).toBeGreaterThan(0);
});

test("phase-7-trends the period picker says when a day is not 24 hours", async ({ page }) => {
  await mount(page);
  for (const language of LANGUAGES) {
    const note = await page.evaluate((lang) => {
      const picker = document.createElement("glt-flow-card-period-picker");
      document.body.append(picker);
      picker.props = {
        language: lang,
        periods: ["day", "month"],
        resolved: {
          end: "2027-11-01T00:00:00+01:00",
          name: "day",
          span_hours: 25,
          start: "2027-10-31T00:00:00+02:00",
        },
        selected: "day",
      };
      const value = picker.querySelector("[data-span-note]")?.textContent ?? "";
      picker.remove();
      return value;
    }, language);
    expect(note, `${language}: a 25-hour day is not called out`).toContain("25");
  }
});

test("phase-7-trends a total names what it excluded, in its own row", async ({ page }) => {
  await mount(page);
  const excluded = await page.evaluate(() => {
    const summary = document.createElement("glt-flow-card-energy-summary");
    document.body.append(summary);
    summary.props = {
      language: "de",
      rows: [{ coverage: 1, id: "a", medium: "electricity", unit: "kWh", value: 100 }],
      total: {
        coverage: 0.5,
        excluded: [{ id: "b", reason: "no_value" }],
        unit: "kWh",
        value: 100,
      },
    };
    return summary.querySelectorAll("[data-total] [data-excluded]").length;
  });
  expect(excluded, "a total that left a meter out did not say so in its own row").toBe(1);
});

test("phase-7-trends operator text reaches the DOM as text, and still reaches the reader", async ({ page }) => {
  await mount(page);
  const injected = await page.evaluate(() => {
    const designer = document.createElement("glt-flow-card-report-designer");
    document.body.append(designer);
    designer.props = {
      definitions: [{
        id: "r1",
        name: '<img src=x onerror="window.__pwned = true"> Monatsbericht',
        period: { name: "month" },
      }],
      language: "de",
    };
    return {
      // Structure, not substring: escaped text still *contains* "onerror="
      // inside innerHTML, so a substring search fails a correct implementation.
      images: designer.querySelectorAll("img").length,
      pwned: Boolean(window.__pwned),
      // And the other half: escaping must not mean discarding.
      rendered: designer.querySelector("[data-name]")?.textContent ?? "",
      withHandlers: [...designer.querySelectorAll("*")]
        .filter((node) => [...node.attributes].some((a) => a.name.startsWith("on"))).length,
    };
  });
  expect(injected.images).toBe(0);
  expect(injected.withHandlers).toBe(0);
  expect(injected.pwned).toBe(false);
  expect(injected.rendered, "the operator's words were dropped rather than escaped")
    .toContain("Monatsbericht");
});

test("phase-7-trends the report path uses form fields, not window dialogs", async ({ page }) => {
  await mount(page);
  const fields = await page.evaluate(() => {
    const designer = document.createElement("glt-flow-card-report-designer");
    document.body.append(designer);
    designer.props = { definitions: [], language: "de", runs: [] };
    return [...designer.querySelectorAll("[data-field]")].map((node) => node.getAttribute("data-field"));
  });
  expect(fields.sort()).toEqual(["name", "period", "schedule"]);

  const ledger = await readEffectLedger(page);
  expect(ledger.dialogs, "a window dialog stood in for a form field").toEqual([]);
  expect(ledger.service, "rendering a surface reached a service call").toEqual([]);
});

test("phase-7-trends the artifact reaches the Companion's history routes", async ({ page }) => {
  // The assertion 07-17 deliberately deferred: retiring the browser's own
  // Recorder call only helps if the replacement is present.
  await mount(page);
  const named = await page.evaluate(async () => {
    const response = await fetch("/dist/glt-flow-card.js");
    const source = await response.text();
    return [
      "glt_flow_card/history/series",
      "glt_flow_card/history/statistics",
    ].filter((route) => source.includes(route));
  });
  expect(named.sort()).toEqual([
    "glt_flow_card/history/series",
    "glt_flow_card/history/statistics",
  ]);
});

test("phase-7-trends the card fetches measured history without a panel being opened", async ({
  page,
}) => {
  // T7-22, and it is Phase 6's defect one phase later.
  //
  // Retiring the card's own Recorder aggregation (D9) left every trend consumer
  // reading a field only the trends panel wrote, so the authoritative series
  // was displayed nowhere until an operator happened to open it.
  // `test/shipped-history-truth.test.mjs` passes either way, because the routes
  // do appear in the shipped bytes -- in the one place nothing else reaches.
  //
  // So this asserts the outcome: render the card, open nothing, and read the
  // number. A grep cannot tell reachable from reached.
  await mount(page, {
    wsResults: {
      "glt_flow_card/history/statistics": {
        coverage: 0.75,
        gaps: [{ end: "2027-06-04T00:00:00+02:00", start: "2027-06-03T00:00:00+02:00" }],
        series: [{
          entity_id: "sensor.vorlauf",
          points: [
            { at: "2027-06-01T00:00:00+02:00", value: 21 },
            { at: "2027-06-02T00:00:00+02:00", value: 22 },
          ],
        }],
        source: "statistics",
      },
    },
  });

  const observed = await page.evaluate(async () => {
    const card = document.createElement("glt-flow-card");
    card.setConfig({
      type: "custom:glt-flow-card",
      title: "Anlage",
      datapoints: [{ id: "d1", name: "Vorlauf", entity: "sensor.vorlauf" }],
    });
    document.body.append(card);
    card.hass = window.__fakeHass;
    // One render is all an operator does. Nothing below opens a panel.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (card._historyState && card._historyState.source !== "unavailable") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return {
      coverage: card._historyState?.coverage ?? null,
      gaps: (card._historyState?.gaps ?? []).length,
      points: (card._historyState?.series?.[0]?.points ?? []).length,
      source: card._historyState?.source ?? null,
    };
  });

  expect(
    observed.source,
    "the card rendered without ever asking the Companion for measured history",
  ).toBe("statistics");
  // The confident zero this test exists to catch: a surface that reports 0 %
  // coverage and no gaps because nothing was fetched looks exactly like a plant
  // with no data, and nobody investigates a zero.
  expect(observed.coverage, "coverage read as a confident zero").toBe(0.75);
  expect(observed.gaps, "the reported gap never reached the card").toBe(1);
  expect(observed.points).toBe(2);
});

test("phase-7-trends a burst of renders is one request, not one per render", async ({ page }) => {
  // 07-09 bounded the backend's query cost. Handing that cost back to the
  // browser -- one Recorder query per render, on a card that re-renders on
  // every state change in the plant -- would spend the bound rather than keep
  // it. The stamp is written before the request, so a Companion that is
  // refusing or unreachable is asked once per interval too.
  await mount(page);

  await page.evaluate(async () => {
    const card = document.createElement("glt-flow-card");
    card.setConfig({
      type: "custom:glt-flow-card",
      title: "Anlage",
      datapoints: [{ id: "d1", name: "Vorlauf", entity: "sensor.vorlauf" }],
    });
    document.body.append(card);
    card.hass = window.__fakeHass;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      card._render();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  });

  const ledger = await readEffectLedger(page);
  const history = ledger.recorderQueries.filter((query) => query.contract === "statistics");
  // Exactly one, not "at most one". A card that never fetched would satisfy an
  // upper bound while failing at the thing the bound exists to protect, and a
  // test that passes when nothing happened is the Phase-4 defect this suite
  // already corrected once.
  expect(
    history.length,
    `ten renders produced ${history.length} Recorder queries`,
  ).toBe(1);
});
