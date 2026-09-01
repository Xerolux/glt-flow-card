import { expect } from "@playwright/test";

const nodeEffects = new WeakMap();

function isLoopback(url) {
  const parsed = new URL(url);
  return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "[::1]";
}

export async function installFakeHomeAssistant(page, options = {}) {
  const blockedNetwork = [];
  nodeEffects.set(page, { blockedNetwork });

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!isLoopback(url)) {
      blockedNetwork.push({ method: route.request().method(), url });
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await page.addInitScript(({ states, wsResults, locale }) => {
    const effects = {
      filesystem: [],
      network: [],
      localStorage: [],
      websocket: [],
      service: [],
      tasks: [],
      listeners: [],
      sessions: [{ kind: "fake-ha", id: "exact-dist" }],
    };
    Object.defineProperty(window, "__gltEffects", { value: effects });

    const loopback = (value) => {
      const url = new URL(String(value), window.location.href);
      return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    };
    const prohibited = (kind, detail) => {
      throw new Error(`PROHIBITED_EFFECT[${kind}]: ${JSON.stringify(detail)}`);
    };

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      if (!loopback(url)) {
        const effect = { method: init.method || "GET", url: String(url) };
        effects.network.push(effect);
        return Promise.reject(prohibited("network", effect));
      }
      return nativeFetch(input, init);
    };

    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
      if (!loopback(url)) {
        const effect = { method, url: String(url), transport: "xhr" };
        effects.network.push(effect);
        prohibited("network", effect);
      }
      return nativeOpen.call(this, method, url, ...rest);
    };

    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class GuardedWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        const effect = { url: String(url), transport: "browser-websocket" };
        effects.websocket.push(effect);
        if (!loopback(url)) prohibited("network", effect);
        super(url, protocols);
      }
    };

    for (const method of ["setItem", "removeItem", "clear"]) {
      const nativeMethod = Storage.prototype[method];
      Storage.prototype[method] = function guardedStorage(...args) {
        if (this === window.localStorage) {
          const effect = { method, args: args.map(String) };
          effects.localStorage.push(effect);
          prohibited("localStorage", effect);
        }
        return nativeMethod.apply(this, args);
      };
    }

    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay = 0, ...args) => {
      effects.tasks.push({ kind: "timeout", delay: Number(delay) || 0 });
      return nativeTimeout(callback, delay, ...args);
    };

    const nativeAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      effects.tasks.push({ kind: "animation-frame" });
      return nativeAnimationFrame(callback);
    };

    const callWS = async (message) => {
      effects.websocket.push(structuredClone(message));
      return structuredClone(wsResults[message.type] ?? {});
    };
    const callService = async (domain, service, data) => {
      const effect = { domain, service, data: structuredClone(data ?? {}) };
      effects.service.push(effect);
      prohibited("service", effect);
    };
    const subscribe = async (callback, message) => {
      effects.listeners.push(structuredClone(message));
      return () => effects.listeners.push({ ...structuredClone(message), unsubscribed: true });
    };

    window.__fakeHass = {
      states: structuredClone(states),
      services: {},
      user: { id: "test-admin", name: "Test Admin", is_admin: true },
      config: { components: ["glt_flow_card"], unit_system: { temperature: "°C" } },
      locale: { language: locale, number_format: "language" },
      themes: { darkMode: false, themes: {} },
      callWS,
      callService,
      connection: {
        sendMessagePromise: callWS,
        subscribeEvents: (callback, eventType) => subscribe(callback, { type: "subscribe_events", event_type: eventType }),
        subscribeMessage: subscribe,
      },
    };
  }, {
    states: options.states ?? {
      "sensor.supply_temperature": {
        entity_id: "sensor.supply_temperature",
        state: "42.0",
        attributes: { friendly_name: "Supply temperature", unit_of_measurement: "°C" },
        last_updated: "2026-01-01T00:00:00.000Z",
      },
    },
    wsResults: options.wsResults ?? {
      "glt_flow_card/projects/list": [],
    },
    locale: options.locale ?? "en",
  });
}

export async function readEffectLedger(page) {
  const browser = await page.evaluate(() => structuredClone(window.__gltEffects));
  const node = nodeEffects.get(page) ?? { blockedNetwork: [] };
  return { ...browser, blockedNetwork: [...node.blockedNetwork] };
}

export async function expectNoProhibitedEffects(page) {
  const effects = await readEffectLedger(page);
  expect(effects.blockedNetwork, "non-loopback browser requests").toEqual([]);
  expect(effects.network, "non-loopback fetch/XHR requests").toEqual([]);
  expect(effects.localStorage, "unexpected localStorage writes").toEqual([]);
  expect(effects.service, "unexpected Home Assistant service calls").toEqual([]);
  return effects;
}
