/**
 * Exact-dist Phase-6 alarm and schedule surfaces (T6-19, T6-20).
 *
 * Three things have to be true in the bytes that ship.
 *
 * The surfaces render what the Companion decided and derive nothing: every "is
 * this active", "is this suppressed" and "when does this next run" is a value
 * that arrived over the wire. D4 is four derivations of that first question,
 * disagreeing, with the authoritative one displayed nowhere.
 *
 * Nothing is distinguished by colour alone, and every operation has a
 * non-pointer path — the kiosk layout Phase 4 established has no pointer, and
 * an alarm you can only acknowledge with a mouse is one half the installations
 * cannot acknowledge.
 *
 * Operator text is set as text content and never interpolated into markup. An
 * acknowledgement comment is written by one operator and read by another.
 *
 * Grep group: `phase-6-alarms`.
 */
import { expect, test } from "@playwright/test";

import { installFakeHomeAssistant, readEffectLedger } from "./fixtures/fake-ha.mjs";

const RED_MARKER =
  "EXPECTED_RED[phase6-ui]: complete exact-dist Phase-6 alarm and schedule UI is unavailable";
const EFFECT_PREFIX = "PHASE6_UI_EFFECTS ";

/** The elements 06-UI-SPEC requires in the generated artifact. */
const ELEMENTS = [
  "glt-flow-card-alarm-list",
  "glt-flow-card-alarm-detail",
  "glt-flow-card-alarm-actions",
  "glt-flow-card-schedule-editor",
  "glt-flow-card-schedule-preview",
  "glt-flow-card-alarm-settings",
];

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

test("phase-6-alarms [expected-red:phase6-ui] the alarm and schedule surfaces ship in the exact artifact", async ({
  page,
}) => {
  emitEffects({ elements: ELEMENTS.length, languages: LANGUAGES.length });
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

      // A suppressed row says why and until when. "Quiet" without a reason is
      // exactly the defect shelving shipped.
      const listState = await page.evaluate((language) => {
        const list = document.createElement("glt-flow-card-alarm-list");
        document.body.append(list);
        list.props = {
          language,
          alarms: [{
            id: "a1", name: "Vorlauf zu hoch", priority: "critical", state: "active",
            suppression: { reason: "shelved", by: "anna", until: "2026-09-09T14:00:00Z" },
            delivery: { outcome: "failed", error: "notifier unavailable" },
          }],
        };
        const row = list.querySelector("[data-alarm]");
        return {
          priorityWord: (row?.querySelector("[data-priority]")?.textContent ?? "").trim(),
          priorityShape: Boolean(row?.querySelector("[data-priority-shape]")),
          suppression: (row?.querySelector("[data-suppression]")?.textContent ?? "").trim(),
          deliveryOnRow: Boolean(row?.querySelector("[data-delivery-failed]")),
        };
      }, locale);

      if (!listState.priorityWord) gaps.push(`${locale}: a row shows no priority word`);
      if (!listState.priorityShape) {
        gaps.push(`${locale}: priority is distinguished by colour alone`);
      }
      if (!listState.suppression.includes("anna")) {
        gaps.push(`${locale}: a suppressed row does not say who shelved it or until when`);
      }
      if (!listState.deliveryOnRow) {
        gaps.push(
          `${locale}: a failed delivery is not visible on the row; an alarm nobody ` +
          "could be told about is more urgent, not less",
        );
      }

      // The two sentences the preview exists for. An engineer cannot derive
      // either from an HH:MM field.
      const preview = await page.evaluate((language) => {
        const element = document.createElement("glt-flow-card-schedule-preview");
        document.body.append(element);
        element.props = {
          language,
          timezone: "Europe/Berlin",
          entry: { id: "s1", kind: "instant", time: "02:30" },
          dates: ["2027-03-28", "2027-10-31"],
        };
        return [...element.querySelectorAll("[data-preview-date]")].map((node) => ({
          date: node.getAttribute("data-preview-date"),
          text: (node.textContent ?? "").trim(),
        }));
      }, locale);

      const spring = preview.find((row) => row.date === "2027-03-28");
      const fall = preview.find((row) => row.date === "2027-10-31");
      if (!spring?.text || !/02:30/.test(spring.text)) {
        gaps.push(`${locale}: the preview says nothing about the lost hour on 2027-03-28`);
      }
      if (!fall?.text || !/02:30/.test(fall.text)) {
        gaps.push(`${locale}: the preview says nothing about the ambiguous hour on 2027-10-31`);
      }
    }

    // Operator text is text content, never markup.
    const injected = await page.evaluate(() => {
      const detail = document.createElement("glt-flow-card-alarm-detail");
      document.body.append(detail);
      detail.props = {
        alarm: {
          id: "a1", name: "x", priority: "info", state: "acknowledged",
          acknowledgement: { by: "anna", comment: "<img src=x onerror=alert(1)>Quittiert" },
        },
      };
      return {
        // Structure, not substring. Escaped text still *contains* "onerror="
        // inside `innerHTML` -- as `&lt;img src=x onerror=...&gt;` -- so a
        // substring search fails a correct implementation. What matters is
        // whether the browser parsed it as markup: an element that exists, or
        // an attribute that got attached.
        images: detail.querySelectorAll("img").length,
        withHandlers: [...detail.querySelectorAll("*")]
          .filter((node) => [...node.attributes].some((a) => a.name.startsWith("on")))
          .length,
        rendered: (detail.querySelector("[data-ack-comment]")?.textContent ?? ""),
      };
    });
    if (injected.images > 0 || injected.withHandlers > 0) {
      gaps.push("an acknowledgement comment reached the DOM as markup");
    }
    if (!injected.rendered.includes("Quittiert")) {
      // The other half: escaping must not mean discarding. The operator's words
      // still have to reach the person reading them.
      gaps.push("the acknowledgement comment was dropped rather than escaped");
    }
  }

  const ledger = await readEffectLedger(page);
  emitEffects({ elements: ELEMENTS.length, languages: LANGUAGES.length, ...ledger });
  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  gap: ${gap}`);
  }
  expect(gaps, "complete exact-dist Phase-6 alarm and schedule UI is unavailable").toEqual([]);
});

test("phase-6-alarms the card fetches alarm state without the panel being opened", async ({
  page,
}) => {
  // T6-05, one layer out from where the register first drew the line.
  //
  // Retiring the four derivations left `activeAlarm` reading `card._alarmState`,
  // and only `alarmsPanel` ever wrote it. So the toolbar badge, the per-site
  // active count and the report's Status column all reported *no active alarms*
  // until an operator happened to open the alarm modal. The artifact grep in
  // `test/shipped-alarm-truth.test.mjs` passed throughout, because
  // `alarms/list` does appear in the bytes -- in the one place nothing else
  // reaches.
  //
  // This asserts the outcome instead: render the card, open nothing, and the
  // authoritative state must already be there. A grep cannot see the difference
  // between reachable and reached.
  await mount(page, {
    wsResults: {
      "glt_flow_card/alarms/list": {
        states: [
          { alarm_id: "a1", active: true, priority: "critical", state: "active" },
          { alarm_id: "a2", active: false, priority: "warning", state: "returned" },
        ],
        history: [],
      },
    },
  });

  const observed = await page.evaluate(async () => {
    const card = document.createElement("glt-flow-card");
    card.setConfig({
      type: "custom:glt-flow-card",
      title: "Anlage",
      alarms: [
        { id: "a1", name: "Vorlauf zu hoch", entity: "sensor.flow", priority: "critical" },
        { id: "a2", name: "Filter", entity: "sensor.filter", priority: "warning" },
      ],
    });
    document.body.append(card);
    card.hass = window.__fakeHass;
    // One render is all an operator does. Nothing below opens a panel.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (card._alarmState && Object.keys(card._alarmState).length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return {
      stateKeys: Object.keys(card._alarmState ?? {}),
      activeCount: Object.values(card._alarmState ?? {}).filter((row) => row.active).length,
      modalOpened: Boolean(card.shadowRoot?.querySelector(".glt-v1-modal")),
    };
  });

  const ledger = await readEffectLedger(page);
  const listRequests = ledger.websocketRequests
    .filter((entry) => entry.type === "glt_flow_card/alarms/list");

  expect(
    observed.modalOpened,
    "the test opened a panel, so it proves nothing about the card on its own",
  ).toBe(false);
  expect(
    listRequests.length,
    "the card never asked the Companion for alarm state, so every surface but the panel reports a confident zero",
  ).toBeGreaterThan(0);
  expect(observed.stateKeys.sort()).toEqual(["a1", "a2"]);
  expect(
    observed.activeCount,
    "the card holds alarm state but not the backend's verdict about it",
  ).toBe(1);
  expect(ledger.service, "fetching alarm state reached a service call").toEqual([]);

  // Bounded: a render loop must not turn into a request loop.
  await page.evaluate(() => {
    const card = document.querySelector("glt-flow-card");
    for (let i = 0; i < 10; i += 1) card._queueRender?.();
  });
  await page.waitForTimeout(200);
  const after = await readEffectLedger(page);
  const afterCount = after.websocketRequests
    .filter((entry) => entry.type === "glt_flow_card/alarms/list").length;
  expect(
    afterCount,
    "ten renders produced more than one alarm-state request; the refresh is not throttled",
  ).toBeLessThanOrEqual(listRequests.length);
});
