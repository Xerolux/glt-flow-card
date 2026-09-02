import { expect } from "@playwright/test";

const nodeEffects = new WeakMap();

/**
 * Seeded sentinels. Nothing the card renders, stores, logs, links or sends may
 * contain these values, so a leak of an auth token, of another user's identity,
 * or of a project the viewer may not see is detectable by string search alone.
 */
export const SEEDED_SECRETS = Object.freeze({
  token: "SEEDED-TOKEN-1f4c9a7b2d",
  currentProject: "SEEDED-PROJECT-83be21d0",
  otherUser: "SEEDED-OTHER-USER-5ac07e9f",
});

function isLoopback(url) {
  const parsed = new URL(url);
  return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "[::1]";
}

export async function installFakeHomeAssistant(page, options = {}) {
  const blockedNetwork = [];
  nodeEffects.set(page, { blockedNetwork });
  const defaultWsResults = {
    "glt_flow_card/projects/list": [],
    "glt_flow_card/projects/preview": {
      preview_id: "preview-opaque-01",
      project_id: "exact-dist",
      base_revision: 4,
      base_digest: "b".repeat(64),
      candidate_digest: "c".repeat(64),
      migration_receipt: {
        source_schema_version: 1,
        candidate_schema_version: 2,
        source_digest: "d".repeat(64),
        candidate_digest: "c".repeat(64),
        steps: [{ id: "1->2", from: 1, to: 2 }],
      },
      policy_version: 1,
      operations: [
        { id: "add:/equipment/pump-2", category: "add", path: "/equipment/pump-2", impact: { severity: "info", areas: ["none"] }, requires: [] },
        { id: "remove:/equipment/pump-1", category: "remove", path: "/equipment/pump-1", impact: { severity: "warning", areas: ["operational", "referential"] }, requires: [] },
        { id: "move:/equipment/pump-2/x", category: "move", path: "/equipment/pump-2/x", impact: { severity: "info", areas: ["visual"] }, requires: [] },
        { id: "binding:/equipment/pump-2/entity", category: "binding", path: "/equipment/pump-2/entity", impact: { severity: "warning", areas: ["binding", "operational"] }, requires: [] },
        { id: "config:/paths/path-2/medium", category: "config", path: "/paths/path-2/medium", impact: { severity: "warning", areas: ["operational"] }, requires: [{ operation_id: "add:/equipment/pump-2", reason: "reference:paths.to_equipment->equipment" }] },
      ],
      ordering_noise: ["/views"],
      closures: {
        "add:/equipment/pump-2": { requested: ["add:/equipment/pump-2"], selected: ["add:/equipment/pump-2"], added: [] },
        "remove:/equipment/pump-1": { requested: ["remove:/equipment/pump-1"], selected: ["remove:/equipment/pump-1"], added: [] },
        "move:/equipment/pump-2/x": { requested: ["move:/equipment/pump-2/x"], selected: ["move:/equipment/pump-2/x"], added: [] },
        "binding:/equipment/pump-2/entity": { requested: ["binding:/equipment/pump-2/entity"], selected: ["binding:/equipment/pump-2/entity"], added: [] },
        "config:/paths/path-2/medium": { requested: ["config:/paths/path-2/medium"], selected: ["add:/equipment/pump-2", "config:/paths/path-2/medium"], added: [{ operation_id: "add:/equipment/pump-2", required_by: "config:/paths/path-2/medium", reason: "reference:paths.to_equipment->equipment" }] },
      },
    },
    "glt_flow_card/projects/apply": {
      id: "exact-dist",
      revision: 5,
      digest: "e".repeat(64),
      snapshot_id: "snapshot-applied-02",
      rollback_snapshot_id: "snapshot-verified-01",
      transaction_id: "tx-apply-01",
      config: {
        type: "custom:glt-flow-card",
        schema_version: 2,
        project: { id: "exact-dist", name: "Exact Dist Plant", revision: 5 },
        title: "Applied project",
        views: [{ id: "plant", name: "Plant", kind: "image" }],
        equipment: [],
        paths: [],
        datapoints: [],
      },
    },
    "glt_flow_card/projects/rollback": {
      id: "exact-dist",
      revision: 6,
      digest: "f".repeat(64),
      snapshot_id: "snapshot-restored-02",
      transaction_id: "tx-rollback-02",
      config: {
        type: "custom:glt-flow-card",
        schema_version: 2,
        project: { id: "exact-dist", name: "Exact Dist Plant", revision: 6 },
        title: "Exact-dist Project safety seed",
        views: [{ id: "plant", name: "Plant", kind: "image" }],
        equipment: [],
        paths: [],
        datapoints: [],
      },
    },
    ...(options.wsResults ?? {}),
  };

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!isLoopback(url)) {
      blockedNetwork.push({ method: route.request().method(), url });
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await page.addInitScript(({ states, wsResults, locale, secrets, bridge }) => {
    const effects = {
      filesystem: [],
      network: [],
      localStorage: [],
      sessionStorage: [],
      indexedDB: [],
      history: [],
      clipboard: [],
      console: [],
      diagnostics: [],
      websocket: [],
      websocketRequests: [],
      // Phase 7's query dimension. The browser must issue no Recorder request of
      // its own -- `callApi` is already refused above -- so what this records is
      // the *routed* reads: which contract the card asked the Companion for, how
      // many entities it named and how long a window it wanted. A bound the
      // product declares and the browser ignores is decoration, and it is
      // decoration that passes every assertion about the response.
      recorderQueries: [],
      subscriptions: [],
      service: [],
      api: [],
      dialogs: [],
      scriptInsertion: [],
      tasks: [],
      listeners: [],
      sessions: [{ kind: "fake-ha", id: "exact-dist" }],
    };
    Object.defineProperty(window, "__gltEffects", { value: effects });
    Object.defineProperty(window, "__gltSeededSecrets", { value: secrets });
    const control = { mode: "normal" };
    Object.defineProperty(window, "__fakeHaControl", { value: control });

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
        if (this === window.sessionStorage) {
          const effect = { method, args: args.map(String) };
          effects.sessionStorage.push(effect);
          prohibited("sessionStorage", effect);
        }
        return nativeMethod.apply(this, args);
      };
    }

    if (window.indexedDB) {
      const nativeIndexedDbOpen = window.indexedDB.open.bind(window.indexedDB);
      window.indexedDB.open = (name, version) => {
        const effect = { name: String(name), version: version ?? null };
        effects.indexedDB.push(effect);
        prohibited("indexedDB", effect);
        return nativeIndexedDbOpen(name, version);
      };
    }

    for (const method of ["pushState", "replaceState"]) {
      const nativeHistory = history[method].bind(history);
      history[method] = (state, title, url) => {
        effects.history.push({ method, url: url === undefined ? null : String(url) });
        return nativeHistory(state, title, url);
      };
    }

    if (navigator.clipboard) {
      for (const method of ["writeText", "write"]) {
        const nativeClipboard = navigator.clipboard[method];
        if (typeof nativeClipboard !== "function") continue;
        navigator.clipboard[method] = (...args) => {
          const effect = { method, value: String(args[0] ?? "") };
          effects.clipboard.push(effect);
          return nativeClipboard.apply(navigator.clipboard, args);
        };
      }
    }

    for (const level of ["log", "info", "warn", "error", "debug"]) {
      const nativeConsole = console[level].bind(console);
      console[level] = (...args) => {
        effects.console.push({ level, text: args.map((value) => {
          try {
            return typeof value === "string" ? value : JSON.stringify(value);
          } catch {
            return String(value);
          }
        }).join(" ") });
        return nativeConsole(...args);
      };
    }

    const nativeCreateObjectURL = URL.createObjectURL?.bind(URL);
    if (nativeCreateObjectURL) {
      URL.createObjectURL = (blob) => {
        effects.diagnostics.push({ kind: "object-url", type: blob?.type ?? null, size: blob?.size ?? null });
        return nativeCreateObjectURL(blob);
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
      effects.websocketRequests.push({ type: String(message?.type ?? ""), body: structuredClone(message) });
      const routed = String(message?.type ?? "");
      if (routed.startsWith("glt_flow_card/history/")) {
        const entities = message?.entity_ids ?? message?.statistic_ids ?? message?.entity_id;
        const start = Date.parse(message?.start_time ?? "");
        const end = Date.parse(message?.end_time ?? "") || Date.now();
        effects.recorderQueries.push({
          contract: routed.slice("glt_flow_card/history/".length),
          entities: Array.isArray(entities) ? entities.length : entities ? 1 : 0,
          period: message?.period ?? null,
          windowSeconds: Number.isFinite(start) ? Math.max(0, (end - start) / 1000) : null,
        });
      }
      if (bridge && typeof window[bridge] === "function") {
        const response = await window[bridge](structuredClone(message));
        if (response && response.error) {
          throw Object.assign(new Error(response.error.message ?? "denied"), response.error);
        }
        return response ? structuredClone(response.result) : {};
      }
      if (control.mode === "unavailable" && message.type.startsWith("glt_flow_card/")) {
        throw Object.assign(new Error("Companion unavailable"), { code: "unavailable" });
      }
      if (control.mode === "revision-conflict" && message.type === "glt_flow_card/projects/apply") {
        throw Object.assign(new Error("revision_conflict:5"), { code: "revision_conflict", actual_revision: 5 });
      }
      if (control.mode === "apply-failure" && message.type === "glt_flow_card/projects/apply") {
        throw Object.assign(new Error("injected apply failure"), { code: "apply_failed" });
      }
      if (control.mode === "rollback-failure" && message.type === "glt_flow_card/projects/rollback") {
        throw Object.assign(new Error("rollback verification failed"), { code: "rollback_failed" });
      }
      return structuredClone(wsResults[message.type] ?? {});
    };
    const callService = async (domain, service, data) => {
      const effect = { domain, service, data: structuredClone(data ?? {}), origin: attribute() };
      effects.service.push(effect);
      prohibited("service", effect);
    };
    const subscribe = async (callback, message) => {
      effects.listeners.push(structuredClone(message));
      const record = { type: String(message?.type ?? ""), body: structuredClone(message), active: true };
      effects.subscriptions.push(record);
      return () => {
        record.active = false;
        effects.listeners.push({ ...structuredClone(message), unsubscribed: true });
      };
    };

    // Which module reached for a forbidden capability. The legacy base card
    // still calls `history/period` directly and Phase 7 owns replacing it, so
    // a ledger that only counted effects would let a new Phase-4 call hide
    // behind the known legacy one. Every effect carries its own origin.
    const attribute = () => {
      const frames = String(new Error().stack ?? "").split("\n").slice(2);
      const source = frames.find((line) => /glt-flow-card\.js|project-|navigation|panel/.test(line));
      if (!source) return "unknown";
      if (/v040|legacy|base/.test(source)) return "legacy";
      return "card";
    };

    // Phase 5 forbids a contribution from becoming code. Only part of that is
    // observable at runtime, and it is worth being exact about which part.
    //
    // `eval` and the Function constructor are NOT hooked here, and must not be:
    // Playwright's own page.evaluate runs through `eval`, so a guard on it
    // refuses the test harness before it can refuse anything else. That was
    // tried; it failed every test in this file at once.
    //
    // What is hooked is inserting an executable node -- script, iframe, object,
    // embed -- which is the path a contribution would actually have to take.
    // The rest is prevented structurally rather than observed: the manifest
    // validator allowlists elements and attributes, so a contribution never
    // carries a string that reaches an interpreter, and no contributed path is
    // ever handed to import(). The format is the prevention; this ledger is the
    // check that the format was not bypassed.
    //
    // Armed only once the page is up: the harness itself inserts the script that
    // loads the card, and refusing that never lets the page exist.
    const armed = () => window.__exactDistReady === true;

    for (const method of ["appendChild", "insertBefore", "append", "prepend"]) {
      const target = method in Node.prototype ? Node.prototype : Element.prototype;
      const native = target[method];
      if (typeof native !== "function") continue;
      target[method] = function insertionGuard(...nodes) {
        for (const node of nodes) {
          const tag = node?.tagName?.toLowerCase?.();
          if (tag === "script" || tag === "iframe" || tag === "object" || tag === "embed") {
            const effect = { method, tag, origin: attribute() };
            effects.scriptInsertion.push(effect);
            if (armed()) prohibited("scriptInsertion", effect);
          }
        }
        return native.apply(this, nodes);
      };
    }

    // The legacy card reaches the Recorder through hass.callApi. It did not
    // exist on this shim at all, so such a call threw a TypeError and was
    // classified as a broken harness rather than as the prohibited effect it
    // is. It is recorded and refused here.
    const callApi = async (method, path, parameters) => {
      const effect = {
        method: String(method), path: String(path), origin: attribute(),
        parameters: parameters === undefined ? null : structuredClone(parameters),
      };
      effects.api.push(effect);
      prohibited("api", effect);
    };

    // A window dialog standing in for authorization is one of the defects
    // Phase 4 retires, so it is recorded rather than silently answered.
    for (const kind of ["confirm", "alert", "prompt"]) {
      Object.defineProperty(window, kind, {
        configurable: true,
        value: (message) => {
          const effect = { kind, message: String(message ?? ""), origin: attribute() };
          effects.dialogs.push(effect);
          prohibited("dialog", effect);
        },
      });
    }

    window.__fakeHass = {
      states: structuredClone(states),
      services: {},
      user: { id: "test-admin", name: "Test Admin", is_admin: true },
      config: { components: ["glt_flow_card"], unit_system: { temperature: "°C" } },
      locale: { language: locale, number_format: "language" },
      themes: { darkMode: false, themes: {} },
      callWS,
      callService,
      callApi,
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
    wsResults: defaultWsResults,
    locale: options.locale ?? "en",
    secrets: { ...SEEDED_SECRETS, ...(options.secrets ?? {}) },
    bridge: options.bridge ?? null,
  });
}

export async function readEffectLedger(page) {
  const browser = await page.evaluate(() => structuredClone(window.__gltEffects));
  const node = nodeEffects.get(page) ?? { blockedNetwork: [] };
  return { ...browser, blockedNetwork: [...node.blockedNetwork] };
}

/**
 * Search every declared browser sink for the seeded sentinels and return the
 * exact sinks that leaked. An empty array is the only acceptable result.
 */
export async function scanSeededSecrets(page) {
  const ledger = await readEffectLedger(page);
  const sinks = await page.evaluate(() => {
    const collectDom = () => {
      const parts = [];
      const walk = (root) => {
        for (const element of root.querySelectorAll("*")) {
          for (const attribute of element.attributes ?? []) {
            parts.push(attribute.value);
          }
          if (element.shadowRoot) walk(element.shadowRoot);
        }
        parts.push(root.textContent ?? "");
      };
      walk(document);
      return parts.join("\n");
    };
    const storage = (store) => {
      try {
        return Object.entries({ ...store }).map(([key, value]) => `${key}=${value}`).join("\n");
      } catch {
        return "";
      }
    };
    return {
      dom: collectDom(),
      url: `${window.location.href}`,
      title: document.title,
      localStorage: storage(window.localStorage),
      sessionStorage: storage(window.sessionStorage),
    };
  });
  const searchable = {
    ...sinks,
    console: JSON.stringify(ledger.console ?? []),
    clipboard: JSON.stringify(ledger.clipboard ?? []),
    history: JSON.stringify(ledger.history ?? []),
    diagnostics: JSON.stringify(ledger.diagnostics ?? []),
    websocketRequests: JSON.stringify(ledger.websocketRequests ?? []),
    subscriptions: JSON.stringify(ledger.subscriptions ?? []),
    network: JSON.stringify(ledger.network ?? []),
  };
  const seeded = await page.evaluate(() => structuredClone(window.__gltSeededSecrets));
  const leaks = [];
  for (const [sink, content] of Object.entries(searchable)) {
    for (const [name, value] of Object.entries(seeded ?? {})) {
      if (typeof content === "string" && content.includes(value)) {
        leaks.push({ sink, secret: name });
      }
    }
  }
  return leaks;
}

/**
 * Render one line of effect-ledger evidence with a task-specific prefix so a
 * controlled RED run can prove the ledger executed before the sentinel failed.
 */
export function formatEffectLedger(prefix, effects) {
  const counts = Object.fromEntries(
    Object.entries(effects)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length]),
  );
  return `${prefix}${JSON.stringify(counts)}`;
}

export async function expectNoProhibitedEffects(page) {
  const effects = await readEffectLedger(page);
  expect(effects.blockedNetwork, "non-loopback browser requests").toEqual([]);
  expect(effects.network, "non-loopback fetch/XHR requests").toEqual([]);
  expect(effects.localStorage, "unexpected localStorage writes").toEqual([]);
  expect(effects.sessionStorage, "unexpected sessionStorage writes").toEqual([]);
  expect(effects.indexedDB, "unexpected IndexedDB usage").toEqual([]);
  expect(effects.service, "unexpected Home Assistant service calls").toEqual([]);
  expect(await scanSeededSecrets(page), "seeded secrets found in a browser sink").toEqual([]);
  return effects;
}
