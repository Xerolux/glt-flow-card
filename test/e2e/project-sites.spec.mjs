/**
 * Exact-dist Phase-9 multi-site surfaces (T9-18, T9-19).
 *
 * The rule these assert: **a view missing a site says so, in the view.** The
 * value of a central supervision screen is that a person stops looking at five
 * screens, and the moment they do, an unnoticed missing site is a plant nobody
 * is watching.
 *
 * Age and health are checked with colour removed, because a value read an hour
 * ago from a site unreachable since reads exactly like a current one otherwise —
 * and a tint conveys nothing on a monochrome control-room kiosk, in forced
 * colours, or to a screen reader.
 *
 * Grep group: `phase-9-sites`.
 */
import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant, readEffectLedger } from "./fixtures/fake-ha.mjs";

const EFFECT_PREFIX = "PHASE9_UI_EFFECTS ";

const ELEMENTS = [
  "glt-flow-card-site-health-badge",
  "glt-flow-card-portfolio-rollup",
  "glt-flow-card-remote-value",
  "glt-flow-card-remote-outcome",
];

const LANGUAGES = ["de", "en"];

const MONOCHROME = "* { color: black !important; background: white !important; " +
  "border-color: black !important; fill: black !important; }";

async function mount(page, options = {}) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/$/,
  );
  await installFakeHomeAssistant(page, options);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
}

test("phase-9-sites the surfaces ship in the exact artifact", async ({ page }) => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    elements: ELEMENTS.length, languages: LANGUAGES.length, network: 0, socket: 0,
  }));
  await mount(page);
  const defined = await page.evaluate(
    (names) => names.filter((name) => Boolean(customElements.get(name))),
    ELEMENTS,
  );
  expect(defined.sort()).toEqual([...ELEMENTS].sort());
});

test("phase-9-sites unreachable and circuit_open are different words and shapes", async ({ page }) => {
  // The distinction that matters. A site suspended after repeated failures has
  // been broken for a while; a site that did not answer just failed now. Showing
  // them identically hides how long the problem has existed.
  await mount(page);
  const rendered = await page.evaluate((css) => {
    document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
    const badge = document.createElement("glt-flow-card-site-health-badge");
    document.body.append(badge);
    const read = (state) => {
      badge.props = { site: { site_id: "nord", state }, language: "de" };
      return {
        shape: badge.querySelector("[data-site-shape]")?.textContent ?? "",
        state: badge.getAttribute("data-site-state"),
        word: badge.querySelector("[data-site-state-text]")?.textContent ?? "",
      };
    };
    return {
      healthy: read("healthy"),
      slow: read("slow"),
      unreachable: read("unreachable"),
      circuitOpen: read("circuit_open"),
    };
  }, MONOCHROME);

  expect(rendered.unreachable.word).not.toBe(rendered.circuitOpen.word);
  expect(rendered.unreachable.shape).not.toBe(rendered.circuitOpen.shape);
  // All four are distinct with colour removed, so none of them is a tint.
  const words = Object.values(rendered).map((entry) => entry.word);
  expect(new Set(words).size, "two site states render the same word").toBe(4);
  expect(words.every((word) => word.length > 0)).toBe(true);
});

test("phase-9-sites a remote value carries its age and its site's health", async ({ page }) => {
  // T9-18. A value read an hour ago from a site unreachable since reads exactly
  // like a current one otherwise.
  await mount(page);
  const shown = await page.evaluate((css) => {
    document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
    const node = document.createElement("glt-flow-card-remote-value");
    document.body.append(node);
    node.props = {
      value: 62.5, unit: "°C", language: "de",
      site: { site_id: "nord", state: "slow", age_seconds: 3600 },
    };
    return {
      age: node.querySelector("[data-site-age]")?.textContent ?? "",
      siteState: node.getAttribute("data-site-state"),
      stateText: node.querySelector("[data-site-state-text]")?.textContent ?? "",
      value: node.querySelector("[data-value]")?.textContent ?? "",
    };
  }, MONOCHROME);

  expect(shown.value).toBe("62.5");
  expect(shown.siteState).toBe("slow");
  // The age survives colour removal and names a number.
  expect(shown.age).toMatch(/3600/);
  expect(shown.stateText.length).toBeGreaterThan(0);
});

test("phase-9-sites an unverified site says so wherever its figures appear", async ({ page }) => {
  // Not only in a settings screen. An operator reading a number needs to know
  // it arrived over an unauthenticated channel at the moment they read it.
  await mount(page);
  const marked = await page.evaluate(() => {
    const badge = document.createElement("glt-flow-card-site-health-badge");
    document.body.append(badge);
    badge.props = { site: { site_id: "nord", state: "healthy", verified_tls: false }, language: "de" };
    const unverified = badge.querySelector("[data-unverified-tls]")?.textContent ?? "";
    badge.props = { site: { site_id: "nord", state: "healthy", verified_tls: true }, language: "de" };
    return { unverified, verified: badge.querySelector("[data-unverified-tls]") };
  });
  expect(marked.unverified.length).toBeGreaterThan(10);
  expect(marked.verified, "a verified site was marked as unverified").toBeNull();
});

test("phase-9-sites a partial roll-up names the sites it is missing", async ({ page }) => {
  // T9-14's surface half. A count tells a reader something is missing; a name
  // tells them where to go and look.
  await mount(page);
  const rendered = await page.evaluate(() => {
    const node = document.createElement("glt-flow-card-portfolio-rollup");
    document.body.append(node);
    node.props = {
      language: "de",
      rollup: {
        label: "Verbrauch", total: 30, total_sites: 3,
        answered_sites: ["nord", "sued"],
        absent_sites: [{ reason: "timeout", site_id: "west", state: "unreachable" }],
        complete: false,
      },
    };
    return {
      complete: node.getAttribute("data-complete"),
      completeness: node.querySelector("[data-completeness]")?.textContent ?? "",
      missing: [...node.querySelectorAll("[data-missing-site]")].map((n) => n.getAttribute("data-missing-site")),
      total: node.querySelector("[data-rollup-total]")?.textContent ?? "",
    };
  });
  expect(rendered.complete).toBe("false");
  expect(rendered.total).toBe("30");
  expect(rendered.completeness).toMatch(/2.*3/);
  expect(rendered.missing).toEqual(["west"]);
});

test("phase-9-sites a complete roll-up still states its completeness", async ({ page }) => {
  // If the note appeared only when something was missing, its absence would
  // come to mean "we did not check" — the same reasoning as Phase 7's coverage
  // badge at 100 %.
  await mount(page);
  const rendered = await page.evaluate(() => {
    const node = document.createElement("glt-flow-card-portfolio-rollup");
    document.body.append(node);
    node.props = {
      language: "de",
      rollup: {
        label: "Verbrauch", total: 45, total_sites: 2,
        answered_sites: ["nord", "sued"], absent_sites: [], complete: true,
      },
    };
    return {
      complete: node.getAttribute("data-complete"),
      completeness: node.querySelector("[data-completeness]")?.textContent ?? "",
      missing: node.querySelectorAll("[data-missing-site]").length,
    };
  });
  expect(rendered.complete).toBe("true");
  expect(rendered.completeness.length, "a complete roll-up said nothing about completeness")
    .toBeGreaterThan(0);
  expect(rendered.missing).toBe(0);
});

test("phase-9-sites nothing offers a retry beside an unknown effect", async ({ page }) => {
  // A retry after an unknown is how plant gets operated twice, and Phase 4
  // established that repairing forward is a new, separately authorized command.
  await mount(page);
  const outcome = await page.evaluate(() => {
    const node = document.createElement("glt-flow-card-remote-outcome");
    document.body.append(node);
    node.props = { outcome: "effect_unknown", reason: "timeout", language: "de" };
    return {
      buttons: node.querySelectorAll("button").length,
      links: node.querySelectorAll("a").length,
      sentence: node.querySelector("[data-effect-unknown]")?.textContent ?? "",
      text: node.textContent ?? "",
    };
  });
  expect(outcome.buttons, "a retry control was offered beside an unknown effect").toBe(0);
  expect(outcome.links).toBe(0);
  // And it says what to do instead.
  expect(outcome.sentence.length).toBeGreaterThan(20);
  expect(outcome.text.toLowerCase()).not.toMatch(/wiederholen|retry|erneut senden\?/);
});

test("phase-9-sites remote text reaches the DOM as text, and still reaches the reader", async ({ page }) => {
  // A site name is authored somewhere this installation does not control, which
  // makes it the most hostile input the product handles. Asserted by structure,
  // because escaped text still contains `onerror=` as characters.
  await mount(page);
  const hostile = '<img src=x onerror="window.__pwned = true">Werk "Nord" & Co';
  const result = await page.evaluate((siteId) => {
    const node = document.createElement("glt-flow-card-portfolio-rollup");
    document.body.append(node);
    node.props = {
      language: "de",
      rollup: {
        label: siteId, total: 1, total_sites: 2, answered_sites: ["ok"],
        absent_sites: [{ reason: "timeout", site_id: siteId, state: "unreachable" }],
        complete: false,
      },
    };
    const withHandlers = [...node.querySelectorAll("*")].filter(
      (element) => [...element.attributes].some((attribute) => attribute.name.startsWith("on")),
    );
    return {
      images: node.querySelectorAll("img").length,
      onAttributes: withHandlers.length,
      pwned: Boolean(window.__pwned),
      rendered: [...node.querySelectorAll("[data-site-name]")].map((n) => n.textContent),
    };
  }, hostile);

  expect(result.images, "markup was created from a remote site name").toBe(0);
  expect(result.onAttributes).toBe(0);
  expect(result.pwned).toBe(false);
  // And the name still reaches the reader, ampersand and quotes included.
  expect(result.rendered).toContain(hostile);
});

test("phase-9-sites both languages are complete", async ({ page }) => {
  await mount(page);
  const wordings = await page.evaluate((languages) => {
    const badge = document.createElement("glt-flow-card-site-health-badge");
    document.body.append(badge);
    return languages.map((language) => {
      badge.props = { site: { site_id: "s", state: "circuit_open" }, language };
      return badge.querySelector("[data-site-state-text]")?.textContent ?? "";
    });
  }, LANGUAGES);
  expect(wordings.every((word) => word.length > 0)).toBe(true);
  expect(new Set(wordings).size, "both languages produced the same wording").toBe(LANGUAGES.length);

  const ledger = await readEffectLedger(page);
  expect(ledger.service, "rendering a site surface reached a service call").toEqual([]);
  expect(ledger.dialogs).toEqual([]);
});
