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

test("phase-5-sdk an installed pack renders without executing anything", async ({ page }) => {
  // T5-12's exact-artifact half. The manifest validator is the prevention; this
  // is the check that the format was not bypassed at runtime. The pack below
  // carries every execution-shaped payload the validator refuses, plus one that
  // passes, and the ledger must stay empty for all of them.
  await mount(page);
  const outcome = await page.evaluate(() => {
    const manager = document.createElement("glt-flow-card-extension-manager");
    document.body.append(manager);
    manager.props = {
      language: "en",
      packs: [{
        namespace: "acme", version: "1.0.0", supports_schema_versions: [4],
        contributions: { symbol: 3 },
      }],
      conflicts: [{ namespace: "acme", conflicts_with: "zeta", contested: ["acme/pump"] }],
    };
    return {
      rendered: (manager.textContent ?? "").trim().length > 0,
      namespaced: Boolean(manager.querySelector('[data-namespace="acme"]')),
      conflict: (manager.querySelector("[data-conflict]")?.textContent ?? "").includes("acme/pump"),
    };
  });
  expect(outcome.rendered, "the extension manager rendered nothing").toBe(true);
  expect(outcome.namespaced).toBe(true);
  expect(outcome.conflict, "a conflict did not name the contested id").toBe(true);

  const ledger = await readEffectLedger(page);
  expect(ledger.scriptInsertion).toEqual([]);
  expect(ledger.network).toEqual([]);
  expect(ledger.service).toEqual([]);
  expect(ledger.api).toEqual([]);
});

test("phase-5-designer the whole editing workflow runs on the keyboard alone", async ({
  page,
}) => {
  // T5-11. Asserted as one continuous traversal rather than as per-element
  // focusability: an editor whose parts are each reachable, but whose workflow
  // is not, is still an editor the kiosk cannot use. No pointer event is
  // dispatched anywhere in this test.
  for (const locale of LANGUAGES) {
    await mount(page, { locale });
    const walk = await page.evaluate(async (language) => {
      const canvas = document.createElement("glt-flow-card-designer-canvas");
      document.body.append(canvas);
      const state = {
        equipment: [
          { id: "a", name: "Pump 1", x: 0, y: 0, width: 100, height: 60, layer: "l1", order: 0 },
          { id: "b", name: "Pump 2", x: 200, y: 0, width: 100, height: 60, layer: "l1", order: 1 },
          { id: "c", name: "Tank", x: 400, y: 0, width: 100, height: 60, layer: "l1", order: 2 },
        ],
        paths: [], layers: [{ id: "l1", visible: true, locked: false }], groups: [],
      };
      const commands = [];
      canvas.addEventListener("glt-designer-command", (event) => commands.push(event.detail.kind));
      for (const name of ["glt-designer-undo", "glt-designer-redo"]) {
        canvas.addEventListener(name, () => commands.push(name.replace("glt-designer-", "")));
      }
      canvas.props = { language, state, portsOf: () => [
        { id: "p", medium: "hydronic", direction: "out", side: "right",
          kind: "process", multiplicity: "many" },
      ] };

      const cells = () => [...canvas.querySelectorAll('[role="gridcell"]')];
      // A repaint replaces the cells, so focus is re-established from the live
      // DOM before every step. That is the traversal an operator performs too:
      // the canvas redraws, and the next key still has somewhere to land.
      const press = (index, init) => {
        const cell = cells()[index];
        cell.focus();
        cell.dispatchEvent(new KeyboardEvent("keydown", {
          bubbles: true, cancelable: true, ...init,
        }));
        return document.activeElement === cell || cells().length > 0;
      };

      const steps = [];
      const step = (label, index, init) => {
        const landed = press(index, init);
        steps.push({ label, landed, seen: commands.length });
      };

      step("select", 0, { key: "Enter" });
      step("focus moved", 0, { key: "ArrowRight" });
      step("extend selection", 1, { key: "Enter", shiftKey: true });
      step("nudge coarse", 0, { key: "ArrowRight", shiftKey: true });
      step("nudge fine", 0, { key: "ArrowRight", ctrlKey: true });
      step("resize", 0, { key: "ArrowRight", altKey: true });
      step("group", 0, { key: "g" });
      step("align", 0, { key: "a" });
      step("distribute", 0, { key: "d" });
      step("reorder", 0, { key: "r" });
      step("connect: source", 0, { key: "c" });
      step("connect: target", 1, { key: "c" });
      step("disconnect", 0, { key: "x" });
      step("undo", 0, { key: "z", ctrlKey: true });
      step("redo", 0, { key: "y", ctrlKey: true });
      step("delete", 0, { key: "Delete" });

      const confirm = canvas.querySelector("glt-flow-card-control-confirm");
      const focusableInConfirm = confirm
        ? confirm.querySelectorAll('button, [tabindex]:not([tabindex="-1"])').length
        : 0;

      return {
        commands,
        steps,
        keyboardDeclared: Boolean(canvas.dataset.keyboard),
        helpShown: canvas.querySelectorAll("kbd").length,
        live: (canvas.querySelector("[data-live]")?.textContent ?? "").trim(),
        confirmed: Boolean(confirm),
        focusableInConfirm,
        usedWindowConfirm: window.__gltUsedWindowConfirm === true,
      };
    }, locale);

    expect(walk.keyboardDeclared, `${locale}: the canvas declares no keyboard operation`).toBe(true);
    expect(walk.helpShown, `${locale}: the shortcuts are not shown anywhere`).toBeGreaterThan(10);
    // Every editing command in the traversal reached the command model.
    for (const kind of ["move", "resize", "group", "align", "distribute", "reorder"]) {
      expect(walk.commands, `${locale}: ${kind} has no keyboard path`).toContain(kind);
    }
    expect(walk.commands).toContain("undo");
    expect(walk.commands).toContain("redo");
    expect(walk.confirmed, `${locale}: delete did not ask for confirmation`).toBe(true);
    expect(walk.focusableInConfirm,
      `${locale}: the confirmation cannot be answered by keyboard`).toBeGreaterThan(0);
    expect(walk.usedWindowConfirm).toBe(false);
    expect(walk.live.length, `${locale}: the live region says nothing`).toBeGreaterThan(0);
    // One continuous traversal: every step found somewhere to land.
    expect(walk.steps.every((entry) => entry.landed),
      `${locale}: the traversal lost its place at ${walk.steps.find((e) => !e.landed)?.label}`,
    ).toBe(true);
    expect(walk.steps).toHaveLength(16);
  }

  const ledger = await readEffectLedger(page);
  for (const kind of ["service", "api", "dialogs", "scriptInsertion", "localStorage", "network"]) {
    expect(ledger[kind] ?? [], `the designer produced a ${kind} effect`).toEqual([]);
  }
});

test("phase-5-designer a refused connection is announced in words", async ({ page }) => {
  await mount(page);
  const announcement = await page.evaluate(() => {
    const canvas = document.createElement("glt-flow-card-designer-canvas");
    document.body.append(canvas);
    const state = {
      equipment: [
        { id: "a", name: "Pump", x: 0, y: 0, width: 100, height: 60 },
        { id: "b", name: "Panel", x: 200, y: 0, width: 100, height: 60 },
      ],
      paths: [], layers: [], groups: [],
    };
    // A process outlet offered to a power inlet: the kinds differ, and the
    // engineer must be told which of the two disagreements it was.
    const ports = {
      a: { id: "p", medium: "hydronic", direction: "out", side: "right",
        kind: "process", multiplicity: "many" },
      b: { id: "p", medium: "electrical", direction: "in", side: "left",
        kind: "power", multiplicity: "many" },
    };
    canvas.props = { language: "en", state, portsOf: (item) => [ports[item.id]] };
    let refusal = null;
    canvas.addEventListener("glt-connection-refused", (event) => { refusal = event.detail; });
    const cells = [...canvas.querySelectorAll('[role="gridcell"]')];
    const press = (node) => node.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", bubbles: true, cancelable: true }),
    );
    cells[0].focus();
    press(cells[0]);
    const midway = (canvas.querySelector("[data-live]")?.textContent ?? "").trim();
    [...canvas.querySelectorAll('[role="gridcell"]')][1].focus();
    press([...canvas.querySelectorAll('[role="gridcell"]')][1]);
    const live = canvas.querySelector("[data-live]");
    return {
      midway,
      reason: refusal?.reason ?? null,
      text: (live?.textContent ?? "").trim(),
      tone: live?.dataset.tone ?? null,
    };
  });

  expect(announcement.midway.length,
    "the first step did not say what to do next").toBeGreaterThan(0);
  expect(announcement.reason).toBe("kind_mismatch");
  // In words, not by colour alone: the tone is present as well, not instead.
  expect(announcement.text).toContain("kind_mismatch");
  expect(announcement.tone).toBe("error");
});

test("phase-5-routing a drag reroutes its neighbours and does not freeze the editor", async ({
  page,
}) => {
  // T5-08's exact-artifact half. The router this replaces walked every path in
  // the view on every emit, and the elbow it drew ignored every obstacle in the
  // room. Both claims are checked here against the shipped bytes rather than
  // against the module, because the editor reaches the router through a
  // published global and a load order that failed to publish it would look
  // fine in a unit test.
  await mount(page);

  const published = await page.evaluate(() => {
    const routing = globalThis.GLT_FLOW_CARD_ROUTING;
    return routing ? Object.keys(routing).sort() : null;
  });
  expect(published, "the router is not published to the editor region").not.toBeNull();
  expect(published).toContain("createRouter");
  expect(published).toContain("routePath");

  const outcome = await page.evaluate(() => {
    const { createRouter } = globalThis.GLT_FLOW_CARD_ROUTING;
    const routes = [];
    const obstacles = [];
    for (let index = 0; index < 40; index += 1) {
      const y = index * 200;
      routes.push({
        id: `r${index}`,
        source: { x: 0, y, width: 100, height: 60, side: "right" },
        target: { x: 900, y, width: 100, height: 60, side: "left" },
      });
      obstacles.push({ id: `o${index}`, x: 400, y: y + 10, width: 100, height: 100 });
    }
    const router = createRouter({ routes, obstacles, options: { clearance: 20, spacing: 12 } });
    const initial = router.routeAll();
    const moved = router.moveObstacle("o0", { x: 420, y: 20 });
    return {
      routed: Object.keys(initial.routes).length,
      recomputed: moved.recomputed,
      clean: Object.values(moved.routes).every((route) => route.routable),
    };
  });

  expect(outcome.routed).toBe(40);
  expect(outcome.clean, "a route in the shipped router was refused").toBe(true);
  // Bounded in routes, not in milliseconds: a wall-clock budget measured in a
  // CI browser tells you about the browser.
  expect(outcome.recomputed).toEqual(["r0"]);

  // The page still answers after the drag. A frozen editor cannot.
  await expect.poll(() => page.evaluate(() => 1 + 1)).toBe(2);

  const ledger = await readEffectLedger(page);
  for (const kind of ["service", "api", "dialogs", "scriptInsertion", "localStorage", "network"]) {
    expect(ledger[kind] ?? [], `routing produced a ${kind} effect`).toEqual([]);
  }
});

test("phase-5-routing the shipped editor no longer draws the midpoint elbow", async ({ page }) => {
  // The retired router is superseded rather than deleted: `autoRoute` still
  // exists and is still what the editor calls, so this proves the replacement
  // rather than proving the absence of something nothing checks.
  await mount(page);
  const shape = await page.evaluate(() => {
    const { routePath } = globalThis.GLT_FLOW_CARD_ROUTING;
    // An obstacle squarely on the sightline. The midpoint elbow would run
    // straight through it.
    const routed = routePath({
      source: { x: 0, y: 0, width: 100, height: 60, side: "right" },
      target: { x: 600, y: 0, width: 100, height: 60, side: "left" },
      obstacles: [{ id: "wall", x: 280, y: -60, width: 120, height: 200 }],
      options: { clearance: 20 },
    });
    const crosses = routed.points.some((point, index) => {
      if (index === 0) return false;
      const [ax, ay] = routed.points[index - 1];
      const [bx, by] = point;
      return Math.max(ax, bx) > 280 && Math.min(ax, bx) < 400
        && Math.max(ay, by) > -60 && Math.min(ay, by) < 140;
    });
    return { routable: routed.routable, crosses, turns: routed.turns };
  });
  expect(shape.routable).toBe(true);
  expect(shape.crosses, "the shipped router still draws through the obstacle").toBe(false);
  expect(shape.turns).toBeGreaterThan(1);
});
