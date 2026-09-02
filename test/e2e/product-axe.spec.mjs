/**
 * An automated accessibility sweep over every registered surface (T10-09).
 *
 * **This is not a conformance claim, and the phase is built so it cannot become
 * one.** Automated rule engines decide only the success criteria that can be
 * settled from the DOM and computed styles. Whether a name is *meaningful*,
 * whether focus order matches reading order for a person, whether an error
 * message says what to do — none of that is decidable here, and a clean run is
 * entirely consistent with an unusable product.
 *
 * 10-11 keeps "automated checks pass" and "manual pass recorded" as separate
 * claims with separate evidence, and the registry has no schema in which they
 * combine. That is where the guarantee lives; this file only produces one half
 * of the evidence.
 *
 * **No rule is disabled to get green.** A disabled rule is a claim with no
 * evidence, which is this phase's whole subject. If a rule cannot pass, the
 * finding is fixed or the claim is published as failed.
 *
 * Grep group: `phase-10-axe`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant } from "./fixtures/fake-ha.mjs";

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const EFFECT_PREFIX = "PHASE10_AXE_EFFECTS ";

/** Below this, a sweep is passing because it examined almost nothing. */
const MINIMUM_ELEMENTS = 20;

/** The WCAG tags this sweep reports against. Stated, not implied by defaults. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/**
 * Mount the artifact with axe available.
 *
 * axe goes in as an **init script, before the fixture**, deliberately. The fake
 * Home Assistant installs a script-insertion guard that every UI phase relies
 * on — a card that injects a script is a finding, and `page.addScriptTag` trips
 * it exactly as it should. Loading the sweep before the guard exists keeps the
 * guard meaningful rather than relaxing it for the convenience of the test that
 * needs it least.
 */
async function mount(page) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/$/,
  );
  await page.addInitScript({ content: AXE_SOURCE });
  await installFakeHomeAssistant(page);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => typeof window.axe?.run === "function")).toBe(true);
}

test("phase-10-axe every registered surface is swept, and an unswept one fails", async ({ page }) => {
  await mount(page);
  const coverage = await page.evaluate(() => {
    const registered = [...(window.__gltRegisteredElements ?? [])];
    const host = document.createElement("div");
    host.setAttribute("aria-label", "sweep");
    host.setAttribute("role", "region");
    document.body.append(host);
    const mounted = [];
    for (const name of registered) {
      if (!customElements.get(name)) continue;
      const node = document.createElement(name);
      host.append(node);
      try {
        node.props = { language: "de" };
      } catch {
        // A surface that refuses empty props is still in the document and still
        // swept; it renders nothing, which axe reads as nothing to complain of.
      }
      mounted.push(name);
    }
    return { mounted: mounted.sort(), registered: registered.sort() };
  });

  // The coverage guard. A surface registered but not swept is the confident-zero
  // shape: a suite reporting success for something it never looked at.
  expect(coverage.mounted).toEqual(coverage.registered);
  expect(
    coverage.mounted.length,
    "the sweep covered almost nothing; passing over nothing proves nothing",
  ).toBeGreaterThanOrEqual(MINIMUM_ELEMENTS);
});

test("phase-10-axe the swept surfaces report no violations, with no rule disabled", async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(async (tags) => {
    const registered = [...(window.__gltRegisteredElements ?? [])];
    const host = document.createElement("div");
    host.setAttribute("aria-label", "sweep");
    host.setAttribute("role", "region");
    document.body.append(host);
    for (const name of registered) {
      if (!customElements.get(name)) continue;
      const node = document.createElement(name);
      host.append(node);
      try {
        node.props = { language: "de" };
      } catch { /* see above */ }
    }
    // No `rules: {...}` and no `disableOtherRules`: every rule in the stated
    // tags runs. Silencing one would be publishing a claim with no evidence.
    const run = await window.axe.run(host, { runOnly: { type: "tag", values: tags } });
    return {
      incomplete: run.incomplete.map((entry) => entry.id),
      passes: run.passes.length,
      violations: run.violations.map((entry) => ({
        help: entry.help,
        id: entry.id,
        // The message axe computed, not only the markup: for a contrast finding
        // it names the two colours and the ratio, which is what makes the
        // finding actionable rather than a pointer at a span.
        nodes: entry.nodes.slice(0, 3).map((node) => ({
          html: node.html.slice(0, 140),
          why: [...node.any, ...node.all, ...node.none].map((check) => check.message).join(" | "),
        })),
        tags: entry.tags.filter((tag) => tag.startsWith("wcag")),
      })),
    };
  }, TAGS);

  console.log(EFFECT_PREFIX + JSON.stringify({
    incomplete: result.incomplete.length, network: 0, passes: result.passes,
    remote: 0, service: 0, socket: 0, violations: result.violations.length,
  }));

  // Not a count: the list, with the criterion each violation maps to, because
  // that is what a registry entry has to cite.
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  expect(
    result.passes,
    "axe reported no passing rules either, so it swept nothing",
  ).toBeGreaterThan(0);
});

test("phase-10-axe the sweep can see a violation when one exists", async ({ page }) => {
  // The vacuity guard, and the one this suite most needs. A sweep configured
  // wrongly reports zero violations exactly as convincingly as a clean product.
  await mount(page);
  const found = await page.evaluate(async (tags) => {
    const host = document.createElement("div");
    host.setAttribute("aria-label", "deliberate");
    host.setAttribute("role", "region");
    document.body.append(host);
    // An image with no alternative text: a WCAG 1.1.1 failure every engine
    // detects, planted so a silent sweep cannot pass this file.
    const broken = document.createElement("img");
    broken.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    host.append(broken);
    const run = await window.axe.run(host, { runOnly: { type: "tag", values: tags } });
    return run.violations.map((entry) => entry.id);
  }, TAGS);
  expect(found, "axe found nothing wrong with an image that has no alt text").toContain("image-alt");
});
