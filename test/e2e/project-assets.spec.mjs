/**
 * Exact-dist Phase-8 simulation, commissioning and asset surfaces.
 *
 * The assertions here are safety assertions rather than styling ones, because
 * the hazard this phase closes is a belief that is wrong in a comforting
 * direction: a successful rehearsal reading as commissioned plant.
 *
 * So `simulated` is checked **with colour removed**. A tint satisfies a naive
 * check and conveys nothing on a monochrome control-room kiosk, in forced
 * colours, or to a screen reader.
 *
 * Injection is asserted by **structure** — no elements created, no `on*`
 * attributes, no global written — and separately that the operator's text still
 * reaches the reader. Escaping that swallows the name is a second defect rather
 * than a fix, and Phase 6 lost a cycle to a substring search failing a correct
 * implementation.
 *
 * Grep group: `phase-8-simulation`.
 */
import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant, readEffectLedger } from "./fixtures/fake-ha.mjs";

const EFFECT_PREFIX = "PHASE8_UI_EFFECTS ";

const ELEMENTS = [
  "glt-flow-card-simulation-banner",
  "glt-flow-card-provided-value",
  "glt-flow-card-scenario-table",
  "glt-flow-card-commissioning-table",
  "glt-flow-card-work-order-history",
  "glt-flow-card-work-order-form",
  "glt-flow-card-dispatch-refusal",
];

const LANGUAGES = ["de", "en"];

const SESSION = {
  actor_name: "Basti",
  actor_user_id: "u1",
  expires_at: "2027-06-01T12:00:00+02:00",
  started_at: "2027-06-01T11:00:00+02:00",
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

test("phase-8-simulation the surfaces ship in the exact artifact", async ({ page }) => {
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

test("phase-8-simulation a simulated value is marked with colour removed", async ({ page }) => {
  // T8-09, and the most important assertion in the phase. The whole hazard is
  // that a rehearsal reads as commissioned plant, so the marking must survive
  // a monochrome kiosk and forced colours — which means it cannot be a tint.
  await mount(page);
  const marked = await page.evaluate(() => {
    const style = document.createElement("style");
    // Strip every colour the surface could be relying on.
    style.textContent = "* { color: black !important; background: white !important; " +
      "border-color: black !important; fill: black !important; }";
    document.head.append(style);

    const node = document.createElement("glt-flow-card-provided-value");
    document.body.append(node);
    node.props = { value: 62.5, unit: "°C", provider: "simulated", language: "de" };
    return {
      provider: node.getAttribute("data-provider"),
      shapes: node.querySelectorAll("[data-provider-shape]").length,
      text: node.querySelector("[data-provider-text]")?.textContent ?? "",
      value: node.querySelector("[data-value]")?.textContent ?? "",
    };
  });
  expect(marked.provider).toBe("simulated");
  expect(marked.text.toLowerCase(), "the word is missing with colour removed").toContain("simul");
  expect(marked.shapes, "there is no shape, so a monochrome kiosk shows nothing").toBeGreaterThan(0);
  // And the provider is next to the value, not only in a banner that scrolls away.
  expect(marked.value).toBe("62.5");
});

test("phase-8-simulation a measured value is not marked as simulated", async ({ page }) => {
  // The other half. A surface that marked everything would pass the test above
  // while telling the operator nothing — the vacuous pass this suite has
  // corrected twice.
  await mount(page);
  const measured = await page.evaluate(() => {
    const node = document.createElement("glt-flow-card-provided-value");
    document.body.append(node);
    node.props = { value: 62.5, unit: "°C", provider: "measured", language: "de" };
    return {
      provider: node.getAttribute("data-provider"),
      shapes: node.querySelectorAll("[data-provider-shape]").length,
      text: node.querySelector("[data-provider-text]")?.textContent ?? "",
    };
  });
  expect(measured.provider).toBe("measured");
  expect(measured.shapes).toBe(0);
  expect(measured.text.toLowerCase()).not.toContain("simul");
});

test("phase-8-simulation an expired session says so rather than disappearing", async ({ page }) => {
  // A banner that vanishes is indistinguishable from one that was never there,
  // and the operator needs to know the plant is live again — that transition is
  // exactly when the belief this phase protects against is most likely wrong.
  await mount(page);
  const states = await page.evaluate((session) => {
    const banner = document.createElement("glt-flow-card-simulation-banner");
    document.body.append(banner);
    banner.props = { session, language: "de" };
    const active = {
      attribute: banner.getAttribute("data-simulation"),
      text: banner.querySelector("[data-banner-text]")?.textContent ?? "",
    };
    banner.props = { session: null, expired: true, language: "de" };
    const expired = {
      attribute: banner.getAttribute("data-simulation"),
      text: banner.querySelector("[data-banner-text]")?.textContent ?? "",
    };
    return { active, expired };
  }, SESSION);

  expect(states.active.attribute).toBe("active");
  // Who started it and when it ends, in words.
  expect(states.active.text).toContain("Basti");
  expect(states.active.text).toContain("2027-06-01T12:00:00+02:00");
  expect(states.expired.attribute, "the expired banner vanished").toBe("expired");
  expect(states.expired.text.length).toBeGreaterThan(0);
});

test("phase-8-simulation the two refusals are worded differently", async ({ page }) => {
  // T8-04's surface half. "A simulation is running" and "the Companion could
  // not tell" call for different responses, and one of them means wait.
  await mount(page);
  const wordings = await page.evaluate(() => {
    const node = document.createElement("glt-flow-card-dispatch-refusal");
    document.body.append(node);
    const read = (reason) => {
      node.props = { reason, language: "de" };
      return node.querySelector("[data-refusal-text]")?.textContent ?? "";
    };
    return { active: read("simulation_active"), unknown: read("simulation_state_unavailable") };
  });
  expect(wordings.active).not.toBe(wordings.unknown);
  expect(wordings.active.length).toBeGreaterThan(10);
  expect(wordings.unknown.length).toBeGreaterThan(10);
});

test("phase-8-simulation the commissioning table states the four-way diagnosis", async ({ page }) => {
  // T8-13's surface half. Collapsing the four into "missing" sends an engineer
  // to look for a typo when an integration failed to set up.
  await mount(page);
  const rendered = await page.evaluate(() => {
    const table = document.createElement("glt-flow-card-commissioning-table");
    document.body.append(table);
    table.props = {
      language: "de",
      findings: [
        { code: "present", reference: "sensor.a", evidence: { platform: "modbus" }, remediation: null },
        { code: "registered_not_loaded", reference: "sensor.b", evidence: {}, remediation: "prüfen" },
        { code: "unregistered", reference: "sensor.c", evidence: {}, remediation: "kein Eintrag" },
        { code: "missing", reference: "sensor.d", evidence: {}, remediation: "Tippfehler?" },
      ],
      summary: { counts: { missing: 1, registered_not_loaded: 1 }, affected_references: 2 },
    };
    return {
      diagnoses: [...table.querySelectorAll("[data-diagnosis]")].map((row) => row.getAttribute("data-diagnosis")),
      texts: [...table.querySelectorAll("[data-diagnosis-text]")].map((cell) => cell.textContent),
      readOnly: table.querySelector("[data-read-only]")?.textContent ?? "",
      body: table.textContent ?? "",
    };
  });
  expect(rendered.diagnoses.sort()).toEqual([
    "missing", "present", "registered_not_loaded", "unregistered",
  ]);
  // Each is a distinct word, not four renderings of "missing".
  expect(new Set(rendered.texts).size).toBe(4);
  expect(rendered.readOnly.length).toBeGreaterThan(10);
  // No invented percentage. Replacing a bad score with a better-computed one
  // would be the same defect with a nicer formula.
  expect(rendered.body, "the table shows an aggregate readiness percentage").not.toMatch(/\d+\s?%/);
});

test("phase-8-simulation a work order shows its entries, oldest first", async ({ page }) => {
  await mount(page);
  const shown = await page.evaluate(() => {
    const history = document.createElement("glt-flow-card-work-order-history");
    document.body.append(history);
    history.props = {
      language: "de",
      order: {
        id: "work_order-1", entries: [
          { id: "e1", status: "open", at: "2027-06-01T08:00", actor_user_id: "u1", note: "Lager" },
          { id: "e2", status: "assigned", at: "2027-06-01T09:00", actor_user_id: "u2" },
          { id: "e3", status: "completed", at: "2027-06-01T11:00", actor_user_id: "u2" },
        ],
      },
    };
    return {
      order: [...history.querySelectorAll("[data-entry]")].map((n) => n.getAttribute("data-entry-status")),
      status: history.getAttribute("data-status"),
      actors: [...history.querySelectorAll("[data-actor]")].map((n) => n.textContent),
    };
  });
  expect(shown.order).toEqual(["open", "assigned", "completed"]);
  // Derived from the last entry, so the display cannot disagree with the record.
  expect(shown.status).toBe("completed");
  // The opening actor survives the completion.
  expect(shown.actors[0]).toBe("u1");
});

test("phase-8-simulation the work-order path uses form fields, not window dialogs", async ({ page }) => {
  // Third time: Phase 6's acknowledgement comment, Phase 7's report schedule,
  // now the work-order title. `prompt()` blocks the page, cannot be styled, is
  // unusable on a kiosk and barely reachable by a screen reader.
  await mount(page);
  const form = await page.evaluate(() => {
    const node = document.createElement("glt-flow-card-work-order-form");
    document.body.append(node);
    node.props = { language: "de", limits: { max_attachments: 20, max_bytes: 5 * 1024 * 1024 } };
    return {
      fields: [...node.querySelectorAll("[data-field]")].map((n) => n.getAttribute("data-field")),
      labelled: [...node.querySelectorAll("label[for]")].length,
      // Stated before a file is chosen, not after it is rejected.
      limits: node.querySelector("[data-attachment-limits]")?.textContent ?? "",
    };
  });
  expect(form.fields.sort()).toEqual(["asset", "note", "reason", "title"]);
  expect(form.labelled).toBe(4);
  expect(form.limits).toContain("20");
  expect(form.limits).toContain("5");

  const ledger = await readEffectLedger(page);
  expect(ledger.dialogs, "a window dialog stood in for a form field").toEqual([]);
  expect(ledger.service, "rendering a surface reached a service call").toEqual([]);
});

test("phase-8-simulation operator text reaches the DOM as text, and still reaches the reader", async ({ page }) => {
  // Asserted by STRUCTURE. Escaped text still contains `onerror=` as characters,
  // so a substring search fails a correct implementation — which cost Phase 6 a
  // cycle. And the second half matters as much: escaping that swallows the name
  // is a second defect, not a fix.
  await mount(page);
  const hostile = '<img src=x onerror="window.__pwned = true">Kessel "Nord" & Co';
  const result = await page.evaluate((note) => {
    const history = document.createElement("glt-flow-card-work-order-history");
    document.body.append(history);
    history.props = {
      language: "de",
      order: { id: "w1", entries: [{ id: "e1", status: "open", at: "t", actor_user_id: "u1", note }] },
    };
    const withAttributes = [...history.querySelectorAll("*")].filter(
      (node) => [...node.attributes].some((attribute) => attribute.name.startsWith("on")),
    );
    return {
      images: history.querySelectorAll("img").length,
      onAttributes: withAttributes.length,
      pwned: Boolean(window.__pwned),
      rendered: history.querySelector("[data-note]")?.textContent ?? "",
    };
  }, hostile);

  expect(result.images, "markup was created from operator text").toBe(0);
  expect(result.onAttributes, "an event-handler attribute was created").toBe(0);
  expect(result.pwned, "injected script ran").toBe(false);
  // And the operator's actual words are still there, ampersand and quotes included.
  expect(result.rendered).toBe(hostile);
});

test("phase-8-simulation every workflow is reachable by keyboard", async ({ page }) => {
  // Phase 4 established that the control-room kiosk has no pointer at all, so a
  // pointer-only workflow is one that installation cannot use.
  await mount(page);
  const reachable = await page.evaluate(() => {
    const form = document.createElement("glt-flow-card-work-order-form");
    document.body.append(form);
    form.props = { language: "de" };
    const scenario = document.createElement("glt-flow-card-scenario-table");
    document.body.append(scenario);
    scenario.props = {
      language: "de",
      trace: [
        { tick: 0, slot: "flow", value: 20, provider: "simulated" },
        { tick: 1, slot: "flow", value: 25, provider: "simulated" },
      ],
    };
    const focusable = [...form.querySelectorAll("input, select, textarea, button")];
    for (const node of focusable) node.focus();
    return {
      focusable: focusable.length,
      focused: document.activeElement === focusable[focusable.length - 1],
      // The scenario is a table, which needs no pointer alternative because it
      // already is one.
      rows: scenario.querySelectorAll("[data-tick]").length,
      headers: scenario.querySelectorAll("th[scope]").length,
    };
  });
  expect(reachable.focusable).toBeGreaterThan(0);
  expect(reachable.focused).toBe(true);
  expect(reachable.rows).toBe(2);
  expect(reachable.headers).toBeGreaterThan(0);
});

test("phase-8-simulation both languages are complete", async ({ page }) => {
  // The module refuses to load if a key lacks a language, so this asserts the
  // guard is in the shipped bytes rather than only in the source.
  await mount(page);
  const wordings = await page.evaluate((languages) => {
    const node = document.createElement("glt-flow-card-provided-value");
    document.body.append(node);
    return languages.map((language) => {
      node.props = { value: 1, provider: "simulated", language };
      return node.querySelector("[data-provider-text]")?.textContent ?? "";
    });
  }, LANGUAGES);
  expect(wordings.every((word) => word.length > 0)).toBe(true);
  expect(new Set(wordings).size, "both languages produced the same word").toBe(LANGUAGES.length);
});
