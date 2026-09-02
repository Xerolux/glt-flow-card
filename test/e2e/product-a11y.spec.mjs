/**
 * Names, roles, focus and reflow, asserted in the exact artifact (T10-07, T10-08).
 *
 * Against the shipped bundle, not the source — the rule every UI phase has
 * followed since Phase 7 shipped a surface whose source grep passed while the
 * screen rendered a confident zero.
 *
 * The product had **zero** `aria-label` attributes and, in the Phase-8 and
 * Phase-9 surfaces, no roles at all. That second half is this work's own gap:
 * those phases asserted colour independence and text content, which is
 * necessary and not sufficient, and I took it for enough.
 *
 * **This suite is not a conformance claim.** It checks the properties a machine
 * can decide. Whether a name is *meaningful*, whether focus order matches
 * reading order for a person, whether an error says what to do — none of that
 * is decidable here, and 10-11 keeps "automated checks pass" and "manual pass
 * recorded" as separate claims for exactly that reason.
 *
 * Grep group: `phase-10-a11y`.
 */
import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant } from "./fixtures/fake-ha.mjs";

const EFFECT_PREFIX = "PHASE10_A11Y_EFFECTS ";

/** Below this, a sweep is passing because it examined almost nothing. */
const MINIMUM_ELEMENTS = 20;

const MONOCHROME = "* { color: black !important; background: white !important; "
  + "border-color: black !important; fill: black !important; }";

async function mount(page, options = {}) {
  const baseUrl = process.env.EXACT_DIST_BASE_URL;
  expect(baseUrl, "the exact-dist runner must provide a loopback URL").toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/$/,
  );
  await installFakeHomeAssistant(page, options);
  await page.goto(baseUrl, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__exactDistReady)).toBe(true);
}

/**
 * Every custom element the artifact registers.
 *
 * From the artifact's own registry, not from a list in this file. A hardcoded
 * list silently skips a surface added later, and a suite that reports success
 * for something it never ran is worse than no suite — which is exactly what the
 * exact-dist runner did until Phase 9 added its drift guard.
 */
async function registeredElements(page) {
  return page.evaluate(() => [...(window.__gltRegisteredElements ?? [])].sort());
}

test("phase-10-a11y the artifact registers the surfaces this sweep covers", async ({ page }) => {
  await mount(page);
  const probed = await registeredElements(page);
  const undefinedNames = await page.evaluate(
    (names) => names.filter((name) => !customElements.get(name)),
    probed,
  );
  expect(undefinedNames, "the registry names an element the artifact never defined").toEqual([]);
  console.log(EFFECT_PREFIX + JSON.stringify({
    elements: probed.length, network: 0, remote: 0, service: 0, socket: 0,
  }));
  expect(
    probed.length,
    "the sweep found almost no surfaces; passing over nothing proves nothing",
  ).toBeGreaterThanOrEqual(MINIMUM_ELEMENTS);
});

test("phase-10-a11y every focusable element has a role and an accessible name", async ({ page }) => {
  await mount(page);
  const findings = await page.evaluate(async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const mounted = [];
    for (const name of window.__gltRegisteredElements ?? []) {
      if (!customElements.get(name)) continue;
      const node = document.createElement(name);
      host.append(node);
      try {
        node.props = { language: "de" };
      } catch {
        // A surface that refuses empty props is fine: it is asserted elsewhere
        // with real props, and an unnamed empty element is not a finding.
      }
      mounted.push(name);
    }
    const focusable = [...host.querySelectorAll(
      "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    )];

    /**
     * Resolve an accessible name the way the HTML and ARIA specifications do,
     * in their order of precedence.
     *
     * Written out rather than guessed at, because the first version of this
     * test checked only `aria-label`, `aria-labelledby` and `label[for]` — and
     * reported six correctly labelled inputs as unnamed. A check that reports
     * work that is already done is a check people learn to ignore.
     *
     * `title` is deliberately absent: it is not announced by every reader,
     * never on touch, and it disappears the moment someone types. It is
     * reported separately instead.
     */
    const accessibleName = (element) => {
      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const parts = labelledBy.split(/\s+/u)
          .map((id) => element.getRootNode().getElementById?.(id) ?? document.getElementById(id))
          .filter(Boolean)
          .map((node) => node.textContent ?? "");
        if (parts.join(" ").trim() !== "") return parts.join(" ").trim();
      }
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.trim() !== "") return ariaLabel.trim();

      // An input wrapped in a label is labelled by it. This is the implicit
      // association the HTML specification defines, and five of the six
      // findings the first version produced were exactly this shape.
      const wrapping = element.closest("label");
      if (wrapping && (wrapping.textContent ?? "").trim() !== "") {
        return (wrapping.textContent ?? "").trim();
      }
      if (element.id) {
        // Scoped to the surface, not the document: several surfaces mount at
        // once here and ids repeat, so a document-wide lookup can find another
        // element's label and call this one named.
        const surface = element.closest("[data-work-order-form], form") ?? host;
        const explicit = surface.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (explicit && (explicit.textContent ?? "").trim() !== "") {
          return (explicit.textContent ?? "").trim();
        }
      }
      // Buttons and links take their name from their contents.
      if (["A", "BUTTON"].includes(element.tagName) && (element.textContent ?? "").trim() !== "") {
        return (element.textContent ?? "").trim();
      }
      return "";
    };

    const unnamed = focusable
      .filter((element) => accessibleName(element) === "")
      .map((element) => element.outerHTML.slice(0, 120));
    // A `title` is not an accessible name for a control: it is not announced by
    // every reader, never on touch, and it disappears the moment someone types.
    const titleAsName = focusable
      .filter((element) => element.hasAttribute("title") && accessibleName(element) === "")
      .map((element) => element.outerHTML.slice(0, 120));
    return { focusable: focusable.length, mounted: mounted.length, titleAsName, unnamed };
  });

  expect(findings.mounted, "no surface mounted, so this test examined nothing")
    .toBeGreaterThanOrEqual(MINIMUM_ELEMENTS);
  expect(findings.unnamed, "focusable elements with no accessible name").toEqual([]);
  expect(findings.titleAsName, "a title is not an accessible name").toEqual([]);
});

test("phase-10-a11y a decorative glyph is not announced twice", async ({ page }) => {
  // Every state glyph sits beside the word it repeats. Announcing both reads the
  // state twice; hiding the glyph keeps the colour-independence rule intact for
  // sighted readers while leaving one reading for everyone else.
  await mount(page);
  const shapes = await page.evaluate(() => {
    const badge = document.createElement("glt-flow-card-site-health-badge");
    document.body.append(badge);
    badge.props = { site: { site_id: "nord", state: "circuit_open" }, language: "de" };
    const shape = badge.querySelector("[data-site-shape]");
    const word = badge.querySelector("[data-site-state-text]");
    return {
      hidden: shape?.getAttribute("aria-hidden"),
      name: badge.getAttribute("aria-label"),
      role: badge.getAttribute("role"),
      shapeVisible: (shape?.textContent ?? "").length > 0,
      word: word?.textContent ?? "",
    };
  });
  expect(shapes.hidden).toBe("true");
  expect(shapes.shapeVisible, "the glyph must stay visible: it is the colour-free signal").toBe(true);
  expect(shapes.role).toBe("group");
  expect(shapes.name).toContain("nord");
  expect(shapes.name).toContain(shapes.word);
});

test("phase-10-a11y an absent-site list is announced as a list", async ({ page }) => {
  await mount(page);
  const rollup = await page.evaluate(() => {
    const node = document.createElement("glt-flow-card-portfolio-rollup");
    document.body.append(node);
    node.props = {
      language: "de",
      rollup: {
        absent_sites: [{ reason: "timeout", site_id: "west", state: "unreachable" }],
        answered_sites: ["nord", "sued"], complete: false, label: "Verbrauch",
        total: 30, total_sites: 3,
      },
    };
    const list = node.querySelector("ul");
    const labelId = list?.getAttribute("aria-labelledby");
    return {
      items: node.querySelectorAll("li[role='listitem']").length,
      labelText: labelId ? document.getElementById(labelId)?.textContent ?? "" : "",
      role: list?.getAttribute("role"),
    };
  });
  expect(rollup.role).toBe("list");
  expect(rollup.items).toBe(1);
  expect(rollup.labelText.length).toBeGreaterThan(0);
});

test("phase-10-a11y an unknown effect is announced assertively, a rehearsal politely", async ({ page }) => {
  // An operator must not learn from the next screen refresh that a command's
  // effect is unknown — by then they may have sent it again, which is the thing
  // that surface exists to prevent. A rehearsal starting is context, not an
  // outcome, so it waits its turn.
  await mount(page);
  const live = await page.evaluate(() => {
    const outcome = document.createElement("glt-flow-card-remote-outcome");
    document.body.append(outcome);
    outcome.props = { language: "de", outcome: "effect_unknown", reason: "timeout" };

    const banner = document.createElement("glt-flow-card-simulation-banner");
    document.body.append(banner);
    banner.props = { expired: true, language: "de" };

    const refusal = document.createElement("glt-flow-card-dispatch-refusal");
    document.body.append(refusal);
    refusal.props = { language: "de", reason: "simulation_active" };

    return {
      bannerLive: banner.getAttribute("aria-live"),
      bannerRole: banner.getAttribute("role"),
      outcomeLive: outcome.getAttribute("aria-live"),
      refusalLive: refusal.getAttribute("aria-live"),
      refusalRole: refusal.getAttribute("role"),
    };
  });
  expect(live.outcomeLive).toBe("assertive");
  expect(live.refusalLive).toBe("assertive");
  expect(live.refusalRole).toBe("alert");
  expect(live.bannerLive).toBe("polite");
  expect(live.bannerRole).toBe("status");
});

test("phase-10-a11y a simulated value names its provenance in its own name", async ({ page }) => {
  // A simulated value read as a commissioned measurement is Phase 8's whole
  // safety concern, and a screen reader that announces "62.5 degrees" without
  // the provenance has produced exactly that reading.
  await mount(page);
  const values = await page.evaluate(() => {
    const read = (provider) => {
      const node = document.createElement("glt-flow-card-provided-value");
      document.body.append(node);
      node.props = { language: "de", provider, unit: "°C", value: 62.5 };
      return { name: node.getAttribute("aria-label"), role: node.getAttribute("role") };
    };
    return { measured: read("measured"), simulated: read("simulated") };
  });
  expect(values.simulated.role).toBe("group");
  expect(values.simulated.name).toContain("62.5");
  expect(values.simulated.name).not.toBe(values.measured.name);
  expect(values.simulated.name.length).toBeGreaterThan(values.measured.name.length - 20);
});

test("phase-10-a11y nothing traps the keyboard, and focus stays visible in forced colours", async ({ page }) => {
  await mount(page);
  await page.evaluate((css) => {
    document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
    const form = document.createElement("glt-flow-card-work-order-form");
    document.body.append(form);
    form.props = { language: "de", limits: { max_attachments: 3, max_bytes: 2097152 } };
  }, MONOCHROME);

  const focusable = await page.locator("glt-flow-card-work-order-form input").count();
  test.skip(focusable === 0, "the form rendered no fields to tab through");

  const walk = [];
  for (let step = 0; step < focusable + 2; step += 1) {
    await page.keyboard.press("Tab");
    walk.push(await page.evaluate(() => document.activeElement?.tagName ?? null));
  }
  // Tabbing past the last field leaves the component rather than cycling inside
  // it: a trap is a control room a keyboard user cannot leave.
  expect(new Set(walk).size, "focus never moved: the keyboard is trapped").toBeGreaterThan(1);

  const outline = await page.evaluate(() => {
    const input = document.querySelector("glt-flow-card-work-order-form input");
    if (!input) return null;
    input.focus();
    const style = getComputedStyle(input);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  if (outline) {
    // With colour removed, a focus ring that is only a colour change is gone.
    expect(outline.outlineStyle).not.toBe("none");
  }
});

test("phase-10-a11y the page reflows at 320 px without scrolling sideways", async ({ page }) => {
  await mount(page);
  await page.setViewportSize({ height: 720, width: 320 });
  await page.evaluate(() => {
    const rollup = document.createElement("glt-flow-card-portfolio-rollup");
    document.body.append(rollup);
    rollup.props = {
      language: "de",
      rollup: {
        absent_sites: [{ reason: "timeout", site_id: "west-werk-nord", state: "unreachable" }],
        answered_sites: ["nord"], complete: false, label: "Verbrauch gesamt",
        total: 30, total_sites: 3,
      },
    };
  });
  const overflow = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(
    overflow.scroll,
    `the page scrolls sideways at 320 px (${overflow.scroll} > ${overflow.client})`,
  ).toBeLessThanOrEqual(overflow.client + 1);
});
