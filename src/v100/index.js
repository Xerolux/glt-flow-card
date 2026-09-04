
/**
 * One catalog string, read off the SDK at call time.
 *
 * This file is concatenated before the v1 bundle, or loaded beside it, so it
 * cannot import the catalog. It reaches the same lookup the rest of the product
 * uses through `window.GLTFlowCardSDK` — one source for a string, because two
 * sources is how a screen ends up disagreeing with itself.
 *
 * The language comes from Home Assistant rather than `navigator.language`,
 * which on a shared control-room workstation is whoever installed it. Falling
 * back to the key rather than to a German sentence: a raw key on screen is
 * visibly wrong, where a German sentence in an English interface looks
 * deliberate.
 */
function gltText(key) {
  const sdk = typeof window === "undefined" ? null : window.GLTFlowCardSDK;
  if (!sdk?.text) return key;
  try {
    const hass = sdk.currentHass?.() ?? null;
    const language = hass?.locale?.language;
    return sdk.text(key, String(language ?? "de").toLowerCase().startsWith("en") ? "en" : "de");
  } catch (_err) {
    return key;
  }
}

import { text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";
import { UNREADABLE, formatDateTime, formatMeasurement, resolveLocale } from "./locale-format.mjs";
import { VISUAL_STYLES, COMPONENT_PROFILES, SYMBOL_VARIANTS, SYMBOL_GEOMETRY, SYMBOL_GROUPS, labelText, profileForEquipment, portsForEquipment } from "./catalog.mjs";
import { ensureV1, deriveOperationalState, autoMapEquipment, smartRoute, alignObjects, diagnoseConfig,  energySummary, projectDiff, makeProjectBundle, readProjectBundle, symbolCatalogStats, semanticPath, entityExportPayload, normalizeEntityImport } from "./core.mjs";
import { factoryTemplates } from "./templates.mjs";

(() => {
  "use strict";
  const Card = customElements.get("glt-flow-card");
  const Editor = customElements.get("glt-flow-card-editor");
  if (!Card || !Editor) { console.warn("GLT Platform 1.0: base card/editor missing"); return; }

  const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
  const slug = (x) => String(x||"item").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase() || "item";
  const download = (name, body, type="application/octet-stream") => { const blob = body instanceof Blob ? body : new Blob([body], {type}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
  const entityId = (v) => typeof v === "string" ? v : v?.entity || "";
  const stateOf = (card,id) => id ? card?._hass?.states?.[id] || card?._stateAt?.(id) : null;
  const projectId = (c) => c?.project?.id || slug(c?.title || "glt-project");
  const currentRole = (c,hass) => { if(hass?.user?.is_admin) return "designer"; const id=hass?.user?.id; if(id&&c?.permissions?.designers?.includes(id))return"designer"; if(id&&c?.permissions?.operators?.includes(id))return"operator"; return"viewer"; };
  const canOperate = (c,h) => ["operator","designer"].includes(currentRole(c,h));

  /**
   * The navigation labels, as catalog keys rather than an inline table.
   *
   * This was the last `de:{…} en:{…}` table in the product. A locale is a
   * catalog now, so a third one needs no edit here.
   */
  const NAV_KEYS = Object.freeze({
    alarms: "legacy.nav_alarms", automap: "legacy.nav_automap", cad: "legacy.nav_cad",
    diagnostics: "legacy.nav_diagnostics", energy: "legacy.nav_energy",
    maintenance: "legacy.nav_maintenance", operations: "legacy.nav_operations",
    project: "legacy.nav_project", schedule: "legacy.nav_schedule",
    semantics: "legacy.nav_semantics", simulation: "legacy.nav_simulation",
    symbols: "legacy.nav_symbols", templates: "legacy.nav_templates", trends: "legacy.nav_trends",
    entities: "legacy.nav_entities",
  });
  const t = (config, key) => {
    const catalogKey = NAV_KEYS[key];
    if (!catalogKey) return key;
    return catalogText(catalogKey, config?.ui?.locale === "en" ? "en" : "de");
  };

  const sdk = window.GLTFlowCardSDK || { symbols:new Map(), profiles:new Map(), panels:new Map(), migrations:[], languages:new Map() };
  sdk.registerSymbol = (s)=>sdk.symbols.set(s.id,s); sdk.registerProfile=(p)=>sdk.profiles.set(p.id,p); sdk.registerPanel=(p)=>sdk.panels.set(p.id,p); sdk.registerMigration=(m)=>sdk.migrations.push(m); sdk.registerLanguage=(id,d)=>sdk.languages.set(id,d);
  for(const s of SYMBOL_VARIANTS)sdk.registerSymbol(s); for(const p of COMPONENT_PROFILES)sdk.registerProfile(p); for(const id of ["de","en"])sdk.registerLanguage(id,Object.fromEntries(Object.entries(NAV_KEYS).map(([name,key])=>[name,catalogText(key,id)])));
  // The legacy base is concatenated *before* this bundle and is a plain IIFE, so
  // it cannot import. It reads the formatter off the SDK at render time instead
  // — which is late enough, because this line has run by then. Sharing one
  // formatter is the point: two formatters is how a screen ends up carrying two
  // date formats, which is exactly the defect 10-05 removed.
  sdk.text=catalogText; sdk.defaultLanguage="de";
  // The legacy surfaces need the current Home Assistant to pick a language,
  // and they cannot reach the card instance. One accessor, set by whichever
  // element most recently received a hass object.
  sdk.currentHass=()=>window.__gltCurrentHass??null;
  sdk.formatDateTime=formatDateTime; sdk.formatMeasurement=formatMeasurement;
  // Published so the legacy base -- concatenated ahead of this bundle, and
  // therefore unable to import -- reaches the same dialog rather than keeping
  // its own `prompt()`. One source for a modal, for the same reason there is
  // one source for a string.
  sdk.askText=askText;
  sdk.resolveLocale=resolveLocale; sdk.UNREADABLE=UNREADABLE;
  sdk.version="1.0.0"; sdk.ensureV1=ensureV1; sdk.factoryTemplates=factoryTemplates; sdk.entityExportPayload=entityExportPayload; sdk.normalizeEntityImport=normalizeEntityImport; sdk.deriveOperationalState=deriveOperationalState; sdk.autoMapEquipment=autoMapEquipment; sdk.smartRoute=smartRoute; sdk.projectDiff=projectDiff; sdk.makeProjectBundle=makeProjectBundle; sdk.readProjectBundle=readProjectBundle; window.GLTFlowCardSDK=sdk;

  const STYLES = `
  .glt-v1-state{position:absolute;right:7px;top:7px;z-index:5;padding:3px 6px;border-radius:999px;font-size:8px;font-weight:850;border:1px solid var(--glt-border);background:color-mix(in srgb,var(--card-background-color) 92%,transparent);text-transform:uppercase;letter-spacing:.04em}
  .glt-v1-state.running,.glt-v1-state.auto,.glt-v1-state.remote{color:#22c55e;border-color:#22c55e66}.glt-v1-state.warning,.glt-v1-state.maintenance,.glt-v1-state.local,.glt-v1-state.manual{color:#f59e0b;border-color:#f59e0b66}.glt-v1-state.fault,.glt-v1-state.comm-error,.glt-v1-state.command-failed,.glt-v1-state.interlock,.glt-v1-state.locked{color:#ef4444;border-color:#ef444466}.glt-v1-state.stale,.glt-v1-state.invalid,.glt-v1-state.unknown{color:#94a3b8}
  .glt-v1-control-btn{position:absolute;right:7px;bottom:7px;z-index:8;width:26px;height:26px;border-radius:8px;border:1px solid var(--glt-border);background:var(--card-background-color);color:var(--glt-accent);cursor:pointer;display:grid;place-items:center;font-size:12px}
  .glt-v1-notice{margin-top:10px;padding:10px 12px;border:1px solid currentColor;border-radius:10px;min-height:44px;display:flex;align-items:center;gap:8px}
  .glt-v1-modal{position:fixed;inset:0;z-index:12000;background:#020617bd;display:grid;place-items:center;padding:20px}.glt-v1-dialog{width:min(1080px,97vw);max-height:92vh;overflow:auto;border:1px solid var(--glt-border,var(--divider-color));border-radius:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color);box-shadow:0 30px 90px #0008}.glt-v1-head{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-bottom:1px solid var(--glt-border,var(--divider-color));background:var(--card-background-color,#fff)}.glt-v1-body{padding:14px}.glt-v1-close,.glt-v1-btn{border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:transparent;color:var(--primary-text-color);padding:7px 9px;font-size:9px;font-weight:750;cursor:pointer}.glt-v1-close{border:0;font-size:15px}.glt-v1-btn.primary{color:#fff;background:#0b83cc;border-color:#1fb4ff}.glt-v1-btn.warn{color:#dc2626}.glt-v1-actions{display:flex;gap:6px;flex-wrap:wrap}.glt-v1-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.glt-v1-card{border:1px solid var(--glt-border,var(--divider-color));border-radius:11px;padding:10px;background:color-mix(in srgb,var(--card-background-color) 96%,#64748b 4%)}.glt-v1-card b{display:block;font-size:11px}.glt-v1-card small{display:block;color:var(--secondary-text-color);margin-top:3px;font-size:8px}.glt-v1-table{width:100%;border-collapse:collapse;font-size:9px}.glt-v1-table th,.glt-v1-table td{padding:7px;border-bottom:1px solid var(--glt-border,var(--divider-color));text-align:left;vertical-align:top}.glt-v1-input,.glt-v1-select,.glt-v1-text{width:100%;padding:7px;border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);font-size:9px}.glt-v1-text{min-height:100px}.glt-v1-toolbar{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding:5px 8px;border-bottom:1px solid var(--b,var(--divider-color));background:color-mix(in srgb,var(--bg,var(--card-background-color)) 96%,#0ea5e9 4%)}.glt-v1-toolbar button{height:29px;border:1px solid var(--b,var(--divider-color));border-radius:7px;background:transparent;color:var(--mut,var(--secondary-text-color));font-size:8px;font-weight:760;padding:0 8px;cursor:pointer}.glt-v1-toolbar button:hover{color:var(--e,#0ea5e9);border-color:#0ea5e966}.glt-v1-minimap{position:absolute;right:12px;bottom:12px;width:180px;height:110px;border:1px solid var(--b);border-radius:9px;background:#07131fe6;z-index:50;overflow:hidden;pointer-events:none}.glt-v1-miniitem{position:absolute;background:#2aaeff66;border:1px solid #4bc6ff88;border-radius:2px}.glt-v1-layer-hidden{display:none!important}.glt-v1-layer-locked{pointer-events:none!important;opacity:.65}.glt-v1-breadcrumbs{display:flex;gap:5px;align-items:center;padding:5px 14px;font-size:9px;color:var(--secondary-text-color);border-bottom:1px solid var(--glt-border)}.glt-v1-breadcrumbs button{border:0;background:transparent;color:var(--glt-accent);cursor:pointer;font-size:9px}.glt-v1-quality.good{color:#22c55e}.glt-v1-quality.uncertain{color:#f59e0b}.glt-v1-quality.bad{color:#ef4444}
  body.glt-v1-kiosk .header,body.glt-v1-kiosk app-toolbar{display:none!important}@media(min-width:1800px){.glt-v1-dialog{width:min(1320px,96vw)}}`;
  /* The base card ships _ensureHistory as a stub, so replay and the trend
   * panel never had data to show. This override gathers every entity the
   * config references and asks the Companion for its series. The Companion is
   * the only historian the card may read (the artifact is gated on issuing no
   * Recorder request of its own), so a project without a stored companion
   * project shows the panel's explicit "unavailable" wording instead of
   * silently empty charts. */
  const normalizePoint = (p) => {
    if (Array.isArray(p) && p.length >= 2) return [Number(p[0]) || 0, p[1]];
    if (p && typeof p === "object") {
      const t = p.t ?? p.ts ?? p.time ?? p.last_updated ?? p.last_changed;
      const v = p.v ?? p.val ?? p.value ?? p.state;
      if (t != null) {
        const ms = typeof t === "number" ? t : Date.parse(t);
        if (Number.isFinite(ms)) return [ms, v];
      }
    }
    return null;
  };
  Card.prototype._ensureHistory = async function () {
    if (this._historyLoading) return this._history;
    this._historyLoading = true;
    try {
      const cfg = ensureV1(this._config);
      const hours = Math.max(1, Number(cfg.replay?.hours || 168));
      const end = new Date();
      const start = new Date(end.getTime() - hours * 3600e3);
      const ids = new Set();
      const add = (value) => {
        if (typeof value === "string") {
          if (value.includes(".")) ids.add(value);
        } else if (value && typeof value === "object" && typeof value.entity === "string" && value.entity.includes(".")) {
          ids.add(value.entity);
        }
      };
      (cfg.datapoints || []).forEach((d) => add(d.entity));
      (cfg.equipment || []).forEach((eq) => {
        add(eq.entity);
        (eq.fields || []).forEach((f) => add(f.entity));
      });
      (cfg.kpis || []).forEach((k) => add(k.entity));
      (cfg.paths || []).forEach((p) => { add(p.temperature); add(p.flow); });
      const entityIds = [...ids];
      let series = [];
      let source = "unavailable";
      if (entityIds.length) {
        const loaded = await loadHistory(this, {
          contract: "series",
          entity_ids: entityIds,
          start: start.toISOString(),
          end: end.toISOString(),
          limit: 3000,
        });
        series = loaded.series || [];
        source = loaded.source || "unavailable";
      }
      const map = new Map();
      for (const s of series || []) {
        const key = s.entity_id || s.entity || s.id;
        if (!key) continue;
        const points = (s.points || s.values || []).map(normalizePoint).filter((p) => p && Number.isFinite(Number(p[1])));
        if (points.length) map.set(key, points.sort((a, b) => a[0] - b[0]));
      }
      this._history = map;
      this._historyRange = { start: start.getTime(), end: end.getTime() };
      this._historyError = null;
      this._historySource = source;
      this._queueRender?.();
      return map;
    } finally {
      this._historyLoading = false;
    }
  };

  const SYMBOL_STYLES = `
  .glt-eq-symbol .glt-sym{width:100%;height:100%;display:block}
  .glt-sym line,.glt-sym path,.glt-sym rect,.glt-sym circle{stroke-linecap:round;stroke-linejoin:round}
  .glt-sym-body{fill:color-mix(in srgb,var(--glt-panel) 55%,var(--glt-accent) 10%);stroke:color-mix(in srgb,var(--primary-text-color) 42%,transparent);stroke-width:2.4}
  .glt-sym-accent{fill:var(--glt-accent)}
  .glt-sym-thin{fill:none;stroke:color-mix(in srgb,var(--primary-text-color) 45%,transparent);stroke-width:1.6}
  .glt-sym-hot{fill:none;stroke:#ef4444;stroke-width:3.4}
  .glt-sym-cold{fill:none;stroke:#3b82f6;stroke-width:3.4}
  .glt-sym-power{fill:none;stroke:#f59e0b;stroke-width:2.2}
  .glt-sym-coil{fill:none;stroke:#f97316;stroke-width:2.2}
  .glt-sym-rotor{fill:var(--glt-accent);stroke:none}
  .glt-sym-tank{fill:color-mix(in srgb,var(--glt-panel) 72%,var(--glt-accent) 7%);stroke:color-mix(in srgb,var(--primary-text-color) 45%,transparent);stroke-width:2.4}
  .glt-sym-hotfill{fill:color-mix(in srgb,#ef4444 42%,transparent);stroke:none}
  .glt-sym-coldfill{fill:color-mix(in srgb,#3b82f6 42%,transparent);stroke:none}
  .glt-sym-flame{fill:#f97316;stroke:none}
  .glt-sym-txt{fill:var(--primary-text-color);font-size:9px;font-weight:800;text-anchor:middle;stroke:none}
  .glt-sym-accent-text{fill:var(--glt-accent)}
  .glt-sym-alarm{fill:#ef4444;stroke:#7f1d1d;stroke-width:1.6}
  .glt-style-clean .glt-sym-body{fill:#fff;stroke:#475569;stroke-width:2}
  .glt-style-clean .glt-sym-accent{fill:#0ea5e9}
  .glt-style-clean .glt-sym-tank{fill:#fff;stroke:#475569;stroke-width:2}
  .glt-style-clean .glt-sym-hotfill{fill:none;stroke:#ef4444;stroke-width:1.8}
  .glt-style-clean .glt-sym-coldfill{fill:none;stroke:#3b82f6;stroke-width:1.8}
  .glt-style-clean .glt-sym-flame{fill:#ef4444}
  .glt-style-clean .glt-sym-rotor{fill:#0ea5e9}
  .glt-style-clean .glt-sym-coil{stroke:#ef4444}
  .glt-style-clean .glt-sym-txt{fill:#334155}
  .glt-style-classic_scada .glt-sym-body{fill:#d8dee9;stroke:#111827;stroke-width:3}
  .glt-style-classic_scada .glt-sym-accent{fill:#111827}
  .glt-style-classic_scada .glt-sym-thin{stroke:#111827;stroke-width:1.8}
  .glt-style-classic_scada .glt-sym-hot,.glt-style-classic_scada .glt-sym-cold{stroke:#111827;stroke-width:3.6}
  .glt-style-classic_scada .glt-sym-power{stroke:#111827}
  .glt-style-classic_scada .glt-sym-tank{fill:#cbd5e1;stroke:#111827;stroke-width:3}
  .glt-style-classic_scada .glt-sym-hotfill{fill:#94a3b8;stroke:#111827;stroke-width:1}
  .glt-style-classic_scada .glt-sym-coldfill{fill:#e8edf3;stroke:#111827;stroke-width:1}
  .glt-style-classic_scada .glt-sym-flame{fill:#374151}
  .glt-style-classic_scada .glt-sym-rotor{fill:#111827}
  .glt-style-classic_scada .glt-sym-coil{stroke:#111827}
  .glt-style-classic_scada .glt-sym-txt{fill:#111827}
  .glt-style-standard_2d .glt-sym-body{fill:#dbeafe;stroke:#1d4ed8;stroke-width:2.2}
  .glt-style-standard_2d .glt-sym-accent{fill:#1d4ed8}
  .glt-style-standard_2d .glt-sym-tank{fill:#bfdbfe;stroke:#1d4ed8;stroke-width:2.2}
  .glt-style-standard_2d .glt-sym-hotfill{fill:#93c5fd;stroke:#1d4ed8;stroke-width:1}
  .glt-style-standard_2d .glt-sym-coldfill{fill:#dbeafe;stroke:#1d4ed8;stroke-width:1}
  .glt-style-standard_2d .glt-sym-rotor{fill:#1d4ed8}
  .glt-style-standard_2d .glt-sym-coil{stroke:#1d4ed8}
  .glt-style-standard_2d .glt-sym-txt{fill:#1e3a8a}
  .glt-style-operations_light .glt-sym-body{fill:#ecfdf5;stroke:#047857;stroke-width:2.2}
  .glt-style-operations_light .glt-sym-accent{fill:#047857}
  .glt-style-operations_light .glt-sym-tank{fill:#d1fae5;stroke:#047857;stroke-width:2.2}
  .glt-style-operations_light .glt-sym-hotfill{fill:#fca5a5;stroke:#047857;stroke-width:1}
  .glt-style-operations_light .glt-sym-coldfill{fill:#a7f3d0;stroke:#047857;stroke-width:1}
  .glt-style-operations_light .glt-sym-rotor{fill:#047857}
  .glt-style-operations_light .glt-sym-coil{stroke:#047857}
  .glt-style-operations_light .glt-sym-txt{fill:#064e3b}
  .glt-style-pid_dark .glt-sym-body{fill:none;stroke:#67e8f9;stroke-width:1.8}
  .glt-style-pid_dark .glt-sym-accent{fill:#fbbf24}
  .glt-style-pid_dark .glt-sym-thin{stroke:#94a3b8}
  .glt-style-pid_dark .glt-sym-hot{stroke:#f87171}
  .glt-style-pid_dark .glt-sym-cold{stroke:#60a5fa}
  .glt-style-pid_dark .glt-sym-tank{fill:#0f172a80;stroke:#67e8f9;stroke-width:1.8}
  .glt-style-pid_dark .glt-sym-hotfill{fill:#f8717166;stroke:#f87171;stroke-width:1}
  .glt-style-pid_dark .glt-sym-coldfill{fill:#60a5fa66;stroke:#60a5fa;stroke-width:1}
  .glt-style-pid_dark .glt-sym-flame{fill:#fbbf24}
  .glt-style-pid_dark .glt-sym-rotor{fill:#fbbf24}
  .glt-style-pid_dark .glt-sym-coil{stroke:#fbbf24}
  .glt-style-pid_dark .glt-sym-txt{fill:#a5f3fc}
  .glt-sym-running{filter:drop-shadow(0 0 5px var(--glt-accent)) saturate(1.25)}
  .glt-sym-running .glt-sym-body,.glt-sym-running .glt-sym-tank{stroke:var(--glt-accent)}
  .glt-sym-fault{filter:drop-shadow(0 0 6px #ef4444)}
  .glt-sym-fault .glt-sym-body,.glt-sym-fault .glt-sym-tank{stroke:#ef4444;stroke-width:3.2}
  .glt-v1-grid .glt-sym{width:100%;height:100%}`;
  function addStyle(root){if(root?.querySelector("style[data-glt-v1]"))return;const st=document.createElement("style");st.dataset.gltV1="1";st.textContent=STYLES+SYMBOL_STYLES;root?.appendChild(st);}

  // Rendered equipment symbols. The catalog carries one geometry entry per
  // base symbol, but the card's own markup only ever showed a generic mdi
  // icon, so the built symbols never reached the canvas. This decorator swaps
  // that icon for the catalog geometry and falls back to the unchanged
  // markup whenever a type has no drawing.
  const TYPE_SYMBOLS = { heat_pump: "heat_pump_neo", boiler: "boiler", tank: "buffer_layered", dhw_tank: "dhw_tank", room: "underfloor", pump: "pump_inline", valve: "valve_2way", fan: "fan_supply", ahu: "ahu", chiller: "chiller", meter: "meter" };
  const symClass = (value) => String(value || "").split(/\s+/).filter(Boolean).map((name) => `glt-sym-${name}`).join(" ");
  function symbolGeometryFor(item = {}) {
    const base = String(item.symbol_variant || item.symbol || "").split("@")[0] || TYPE_SYMBOLS[item.type] || "";
    return SYMBOL_GEOMETRY.get(base) || null;
  }
  function symbolSvg(geometry) {
    const parts = geometry.map((p) => {
      if (p[0] === "line") return `<line x1="${p[1]}" y1="${p[2]}" x2="${p[3]}" y2="${p[4]}" class="${symClass(p[5])}"/>`;
      if (p[0] === "rect") return `<rect x="${p[1]}" y="${p[2]}" width="${p[3]}" height="${p[4]}" rx="${p[5] || 0}" class="${symClass(p[6])}"/>`;
      if (p[0] === "circle") return `<circle cx="${p[1]}" cy="${p[2]}" r="${p[3]}" class="${symClass(p[4])}"/>`;
      if (p[0] === "path") return `<path d="${p[1]}" class="${symClass(p[2])}"/>`;
      if (p[0] === "text") return `<text x="${p[1]}" y="${p[2]}" class="${symClass(p[4])}">${esc(p[3])}</text>`;
      return "";
    }).join("");
    return `<svg class="glt-sym" viewBox="0 0 64 64" aria-hidden="true">${parts}</svg>`;
  }
  const oldEquipmentMarkup = Card.prototype._equipmentMarkup;
  Card.prototype._equipmentMarkup = function (item) {
    const markup = oldEquipmentMarkup.call(this, item);
    const geometry = symbolGeometryFor(item);
    if (!geometry) return markup;
    let svg = symbolSvg(geometry);
    const running = item.state_entity ? this._isActive(item.state_entity) : (item.entity ? this._isActive(item.entity) : false);
    const alarmField = this._config?.status?.alarm;
    const faulted = alarmField ? this._isActive(alarmField) : false;
    const symbolClass = faulted ? "glt-sym-fault" : (running ? "glt-sym-running" : "");
    if (symbolClass) svg = svg.replace('class="glt-sym"', `class="glt-sym ${symbolClass}"`);
    return markup.replace(/<ha-icon class="glt-eq-icon"[^>]*><\/ha-icon>/, svg);
  };
  /**
   * Say something in the card, rather than in a browser dialog.
   *
   * `alert` is modal, unstyleable, invisible to the effect ledger, and
   * unreachable by the kiosk's key handling. A message that could have been a
   * sentence next to the thing it is about becomes a blocking interruption the
   * operator has to dismiss before they can look at what went wrong.
   */
  function notice(owner,message){ensureGlobalModalStyles();document.querySelector("[data-glt-notice]")?.remove();const host=document.querySelector(".glt-v1-modal .glt-v1-body");const strip=document.createElement("div");strip.dataset.gltNotice="1";strip.setAttribute("role","status");strip.setAttribute("aria-live","polite");strip.className="glt-v1-notice";strip.textContent=String(message);if(host){host.appendChild(strip);}else{strip.dataset.floating="1";document.body.appendChild(strip);setTimeout(()=>strip.remove(),6000);}}

  /* Dialogs live at document level. The card rewrites its whole shadow root
   * on every live state update, so anything mounted inside it -- every panel,
   * every prompt -- was destroyed within seconds of opening. A body-level
   * dialog needs the modal styles outside the shadow root too, so they are
   * injected once per document with a guard. */
  const GLOBAL_MODAL_STYLES = `
  .glt-v1-modal{position:fixed;inset:0;z-index:12000;background:#020617bd;display:grid;place-items:center;padding:20px}
  .glt-v1-dialog{width:min(1080px,97vw);max-height:92vh;overflow:auto;border:1px solid var(--glt-border,var(--divider-color));border-radius:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color);box-shadow:0 30px 90px #0008}
  .glt-v1-head{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-bottom:1px solid var(--glt-border,var(--divider-color));background:var(--card-background-color,#fff)}
  .glt-v1-body{padding:14px}
  .glt-v1-close,.glt-v1-btn{border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:transparent;color:var(--primary-text-color);padding:7px 9px;font-size:9px;font-weight:750;cursor:pointer}
  .glt-v1-close{border:0;font-size:15px}
  .glt-v1-btn.primary{color:#fff;background:#0b83cc;border-color:#1fb4ff}
  .glt-v1-label{display:block;font-size:9px;margin-bottom:6px}
  .glt-v1-input,.glt-v1-select{width:100%;padding:7px;border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);font-size:9px}
  .glt-v1-actions{display:flex;gap:6px;flex-wrap:wrap}
  .glt-v1-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
  .glt-v1-card{border:1px solid var(--glt-border,var(--divider-color));border-radius:11px;padding:10px;background:color-mix(in srgb,var(--card-background-color) 96%,#64748b 4%)}
  .glt-v1-card b{display:block;font-size:11px}
  .glt-v1-card small{display:block;color:var(--secondary-text-color);margin-top:3px;font-size:8px}
  .glt-v1-table{width:100%;border-collapse:collapse;font-size:9px}
  .glt-v1-table th,.glt-v1-table td{padding:7px;border-bottom:1px solid var(--glt-border,var(--divider-color));text-align:left;vertical-align:top}
  .glt-v1-notice{margin-top:10px;padding:10px 12px;border:1px solid currentColor;border-radius:10px;min-height:44px;display:flex;align-items:center;gap:8px}
  .glt-v1-notice[data-floating]{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:12100;max-width:min(680px,90vw);background:var(--card-background-color,#fff);box-shadow:0 18px 50px #0008}`;
  function ensureGlobalModalStyles(){
    if (document.head.querySelector("style[data-glt-v1-global]")) return;
    const style=document.createElement("style");
    style.dataset.gltV1Global="1";
    style.textContent=GLOBAL_MODAL_STYLES;
    document.head.appendChild(style);
  }
  function modal(owner,title,html){
    ensureGlobalModalStyles();
    document.querySelector(".glt-v1-modal")?.remove();
    const m=document.createElement("div");m.className="glt-v1-modal";m.innerHTML=`<div class="glt-v1-dialog"><div class="glt-v1-head"><b>${esc(title)}</b><button class="glt-v1-close">✕</button></div><div class="glt-v1-body">${html}</div></div>`;
    m.querySelector(".glt-v1-close").onclick=()=>m.remove();
    m.onclick=e=>{if(e.target===m)m.remove()};
    document.body.appendChild(m);
    return m;
  }
  // A fully qualified type is passed through unchanged, so a call site may name
  // the exact wire route it depends on rather than a suffix that reads the same
  // as several unrelated things.
  async function ws(owner,type,payload={}){if(!owner?._hass?.callWS)throw new Error("Companion nicht verfügbar");const wire=String(type).startsWith("glt_flow_card/")?String(type):`glt_flow_card/${type}`;return owner._hass.callWS({type:wire,...payload});}
  // A real dialog, not `prompt()`. The UI contract forbids `prompt` on the
  // acknowledgement path: it blocks the whole page, cannot be styled, cannot be
  // localized, and is unreachable in a kiosk. Resolves to null when cancelled,
  // so a caller can tell "cancelled" from "entered nothing".
  function askText(owner,label,initial=""){return new Promise(resolve=>{ensureGlobalModalStyles();const host=document.createElement("div");host.className="glt-v1-modal";host.dataset.gltAsk="1";host.innerHTML=`<div class="glt-v1-body" role="dialog" aria-modal="true" aria-label="${esc(label)}"><label class="glt-v1-label">${esc(label)}<input class="glt-v1-input" data-value></label><div class="glt-v1-actions"><button class="glt-v1-btn primary" data-ok>OK</button><button class="glt-v1-btn" data-cancel>Abbrechen</button></div></div>`;const input=host.querySelector("[data-value]");input.value=String(initial??"");const close=value=>{host.remove();resolve(value)};host.querySelector("[data-ok]").onclick=()=>close(input.value);host.querySelector("[data-cancel]").onclick=()=>close(null);host.addEventListener("keydown",event=>{if(event.key==="Escape")close(null);if(event.key==="Enter")close(input.value)});document.body.appendChild(host);input.focus();});}

  async function audit(owner,action,detail={}){try{await ws(owner,"audit/add",{event:{action,detail,at:new Date().toISOString()}})}catch(_e){}}
  async function registryMeta(owner,id){if(!id||!owner?._hass?.callWS)return null;try{return await owner._hass.callWS({type:"config/entity_registry/get",entity_id:id})}catch(_e){return null}}

  /**
   * Retired (04-13 in the extension layer, 05-14 here, where it actually shipped).
   *
   * This was the last browser-derived control authority in the card, and it was
   * three defects stacked: a role check the browser had no business making
   * (any Home Assistant administrator became a "designer"), a `window.confirm`
   * standing in for an authorization prompt, and -- whenever
   * `security.server_enforced` was false -- a direct `hass.callService` behind
   * a domain allowlist the browser also checked itself.
   *
   * None of that is authority. Every one of those checks runs on a machine the
   * operator controls, and the service call at the end was the only thing that
   * mattered. The surviving operate path is the server-composed panel from
   * Phase 4, whose controls the Companion has already authorized before the
   * browser sees them.
   *
   * The entry point stays reachable, and inert, so the effect ledger can prove
   * no command produces a service call -- deleting it would move the proof
   * somewhere nothing checks.
   */
  async function executeControl(card,item,command,_value){
    const id=entityId(item?.control_entity||item?.entity);
    await audit(card,"control.blocked",{equipment_id:item?.id,entity_id:id,command,reason:"legacy_execute_retired"});
    notice(card,gltText("legacy.controls_via_server"));
    return undefined;
  }

  // The Companion evaluates; this renders what it evaluated. The panel used to
  // derive `active` from entity states here and never call `alarms/list` at
  // all, so the authoritative alarm state was displayed nowhere in the product
  // -- one of the four disagreeing derivations Phase 6 retired.
  async function loadAlarms(card){const cfg=ensureV1(card._config);try{const res=await ws(card,"alarms/list",{project_id:projectId(cfg),limit:500});const byId={};for(const row of res?.states||[])byId[String(row.alarm_id)]=row;card._alarmState=byId;return {states:res?.states||[],history:res?.history||[],byId};}catch(_e){card._alarmState=card._alarmState||{};return {states:[],history:[],byId:card._alarmState,unavailable:true};}}
  // Fetching the state is the card's job, not the panel's.
  //
  // Retiring the four derivations left `activeAlarm` reading `card._alarmState`,
  // and `_alarmState` was written in exactly one place: `alarmsPanel`. Every
  // other consumer -- the toolbar badge, the per-site active count and the
  // report's Status column -- therefore read `undefined` until an operator
  // happened to open the alarm modal, and reported *no active alarms* until
  // they did. That is the same failure T6-05 names, one layer further out: the
  // authoritative answer existed and was displayed nowhere. A confident zero is
  // worse than a blank, because nobody investigates a zero.
  //
  // Bounded on purpose. The refresh is throttled and the stamp is written
  // *before* the request, so a Companion that is refusing or unreachable is
  // asked once per interval rather than once per render -- Phase 6 spent a plan
  // on bounding the backend's scan cost and must not hand the cost back to the
  // browser.
  const ALARM_REFRESH_MS=15000;
  function refreshAlarmState(card){
    const cfg=ensureV1(card._config);
    if(!cfg.alarms.length)return;
    if(card._alarmStateLoading)return;
    const now=Date.now();
    if(card._alarmStateAt&&now-card._alarmStateAt<ALARM_REFRESH_MS)return;
    card._alarmStateAt=now;
    card._alarmStateLoading=true;
    loadAlarms(card).then(()=>{card._alarmStateLoading=false;card._queueRender?.();},
      ()=>{card._alarmStateLoading=false;});
  }

  // The Companion queries Home Assistant's Recorder; the browser asks the
  // Companion. Phase 7 retired the card's own Recorder call, and retiring it
  // only helps if the replacement is present -- so these two routes are the
  // trend surfaces' only source of measured values.
  //
  // The period's expected instants are sent with the request because the
  // Recorder omits an empty period entirely: what came back is exactly the
  // thing that cannot say what was asked for. Inferring the grid from the
  // returned rows would report a month with half its meters offline as a
  // complete month with a smaller total.
  //
  // A failure is returned as a stated `unavailable` source rather than thrown.
  // A correct empty answer and a broken one look identical, and only the stated
  // source separates them -- an empty series drawn inside a populated axis is
  // the defect this phase exists to close.
  async function loadHistory(card,request){
    const cfg=ensureV1(card._config);
    const contract=request&&request.contract==="statistics"?"statistics":"series";
    const route=contract==="statistics"?"glt_flow_card/history/statistics":"glt_flow_card/history/series";
    const payload={project_id:projectId(cfg),entity_ids:request?.entity_ids||[],
      start_time:request?.start||"",end_time:request?.end||"",
      expected_instants:request?.expected_instants||[],limit:request?.limit||500};
    if(contract==="statistics")payload.period=request?.period||"day";
    try{
      const res=await ws(card,route,payload);
      return {capped:Boolean(res?.capped),coverage:Number(res?.coverage||0),
        gaps:res?.gaps||[],series:res?.series||[],source:res?.source||"unavailable"};
    }catch(err){
      return {capped:false,coverage:0,gaps:[],series:[],source:"unavailable",
        error:String(err&&err.message||err)};
    }
  }

  function alarmRow(cfg,a,row){const active=Boolean(row&&row.active);const suppression=row&&row.suppression;const delivery=row&&row.last_delivery;const priority=esc(String(row&&row.priority||a.priority||a.severity||"warning"));
    // Priority as a word *and* a shape: a red dot on a monochrome kiosk is no
    // information at all.
    const shape=active?"\u25C6":"\u25CB";
    const state=suppression?`unterdr\u00fcckt`:(active?"aktiv":"normal");
    const why=suppression?`${esc(String(suppression.reason||""))}${suppression.by?` \u00b7 ${esc(String(suppression.by))}`:""}${suppression.until?` \u00b7 bis ${esc(String(suppression.until))}`:""}`:"";
    const failed=delivery&&delivery.outcome&&delivery.outcome!=="delivered";
    return `<tr data-alarm="${esc(a.id)}"><td><span data-priority-shape>${shape}</span> <span data-state>${esc(state)}</span></td><td data-priority>${priority}</td><td>${esc(a.name||entityId(a.entity))}</td><td data-suppression>${why}</td><td>${failed?`<span data-delivery-failed>Zustellung fehlgeschlagen: ${esc(String(delivery.error||delivery.outcome))}</span>`:""}</td><td>${active&&!suppression?`<button class="glt-v1-btn" data-ack="${esc(a.id)}">Quittieren</button> <button class="glt-v1-btn" data-shelve="${esc(a.id)}">Shelve</button>`:""}</td></tr>`;}
  async function alarmsPanel(card){const cfg=ensureV1(card._config);const loaded=await loadAlarms(card);const rows=cfg.alarms.map(a=>alarmRow(cfg,a,loaded.byId[String(a.id)]));
    const m=modal(card,t(cfg,"alarms"),`<div class="glt-v1-actions" style="margin-bottom:10px"><button class="glt-v1-btn" data-refresh>Aktualisieren</button></div>${loaded.unavailable?`<p data-unavailable style="font-size:9px;color:var(--secondary-text-color)">${gltText("legacy.alarm_state_unavailable")}</p>`:""}<table class="glt-v1-table"><thead><tr><th>Status</th><th>Priorit\u00e4t</th><th>Meldung</th><th>Unterdr\u00fcckung</th><th>Zustellung</th><th>Aktion</th></tr></thead><tbody>${rows.join("")||'<tr><td colspan="6">Keine Alarme konfiguriert.</td></tr>'}</tbody></table>`);
    m.querySelector("[data-refresh]").onclick=()=>{m.remove();alarmsPanel(card)};
    // Post, then re-read. An optimistic paint the server refused is a lie the
    // operator will act on.
    m.querySelectorAll("[data-ack]").forEach(b=>b.onclick=async()=>{const comment=await askText(card,"Quittierkommentar","");if(comment===null)return;try{await ws(card,"alarms/ack",{project_id:projectId(cfg),alarm_id:b.dataset.ack,comment});}catch(err){notice(card,err.message);}await audit(card,"alarm.ack",{alarm_id:b.dataset.ack});m.remove();alarmsPanel(card)});
    m.querySelectorAll("[data-shelve]").forEach(b=>b.onclick=async()=>{const answer=await askText(card,gltText("legacy.suppress_minutes"),"60");if(answer===null)return;const minutes=Number(answer)||60;try{await ws(card,"alarms/shelve",{project_id:projectId(cfg),alarm_id:b.dataset.shelve,minutes});}catch(err){notice(card,err.message);}m.remove();alarmsPanel(card)});}
  function operationsPanel(card){const cfg=ensureV1(card._config);const items=cfg.equipment.map(i=>({i,s:deriveOperationalState(i,card._hass?.states,{stale_minutes:cfg.diagnostics.stale_minutes})})).sort((a,b)=>b.s.severity-a.s.severity);const m=modal(card,t(cfg,"operations"),`<div class="glt-v1-grid">${items.map(({i,s})=>`<div class="glt-v1-card"><b>${esc(i.name||i.id)}</b><small>${esc(s.label)} · ${esc(s.quality)}</small><div class="glt-v1-actions"><button class="glt-v1-btn" data-open="${esc(i.id)}">Bedienen</button></div></div>`).join("")}</div>`);m.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const i=cfg.equipment.find(x=>x.id===b.dataset.open);m.remove();openOperations(card,i)});}
  function runtimeButtons(card){const root=card.shadowRoot;/* Operations live in the card menu's operation group; the legacy bar targets stay as a fallback for bases without the menu. */const group=root.querySelector("[data-menu-group='operation']");const bar=group||root.querySelector(".glt4-tool,.glt-toolbar,.toolbar,.glt-head-actions");if(!bar||bar.querySelector("[data-glt-v1-runtime]"))return;const wrap=document.createElement(group?"div":"span");wrap.dataset.gltV1Runtime="1";wrap.className=group?"":"glt-v1-actions";const cls=group?"glt-menu-item":"glt4-pill glt-v1-btn";wrap.innerHTML=`<button class="${cls}" role="menuitem" data-ops><ha-icon icon="mdi:tune-vertical"></ha-icon>${t(card._config,"operations")}</button><button class="${cls}" role="menuitem" data-alarm><ha-icon icon="mdi:bell-ring-outline"></ha-icon>${t(card._config,"alarms")}</button><button class="${cls}" role="menuitem" data-trend><ha-icon icon="mdi:chart-multiple"></ha-icon>${t(card._config,"trends")}</button>`;wrap.querySelector("[data-ops]").onclick=()=>operationsPanel(card);wrap.querySelector("[data-alarm]").onclick=()=>alarmsPanel(card);wrap.querySelector("[data-trend]").onclick=()=>trendsPanel(card);bar.appendChild(wrap);}
  // Fetching the trend state is the card's job, not the panel's.
  //
  // This is the Phase-6 defect one phase later, and it is worth naming because
  // the shape recurs: retiring the card's own Recorder aggregation (D9) left
  // every trend consumer reading a field that only the panel wrote, so the
  // authoritative series was displayed nowhere until an operator happened to
  // open it. `test/shipped-history-truth.test.mjs` would have passed throughout,
  // because the routes do appear in the bytes -- in the one place nothing else
  // reaches. A grep cannot tell reachable from reached.
  //
  // Bounded for the same reason as the alarm refresh, and 07-09 bounded the
  // backend's query cost precisely so the browser would not hand it back: the
  // stamp is written *before* the request, so a Companion that is refusing or
  // unreachable is asked once per interval rather than once per render.
  const HISTORY_REFRESH_MS=60000;
  function refreshHistoryState(card){
    const cfg=ensureV1(card._config);
    const entities=cfg.datapoints.map(d=>entityId(d.entity)).filter(Boolean).slice(0,20);
    if(!entities.length)return;
    if(card._historyLoading)return;
    const now=Date.now();
    if(card._historyAt&&now-card._historyAt<HISTORY_REFRESH_MS)return;
    card._historyAt=now;
    card._historyLoading=true;
    loadHistory(card,{contract:"statistics",entity_ids:entities,period:"day"}).then(loaded=>{
      card._historyState=loaded;card._historyLoading=false;card._queueRender?.();
    },()=>{card._historyLoading=false;});
  }

  // The trend surfaces are given what the Companion measured; they derive
  // nothing. The source travels with the values and is displayed, because an
  // empty answer and a broken one look identical on an axis and only the stated
  // source separates them.
  async function trendsPanel(card){
    const cfg=ensureV1(card._config);
    const entities=cfg.datapoints.map(d=>entityId(d.entity)).filter(Boolean).slice(0,20);
    const m=modal(card,t(cfg,"trends"),`<div data-trend-host></div>`);
    const host=m.querySelector("[data-trend-host]");
    const loaded=await loadHistory(card,{contract:"statistics",entity_ids:entities,period:"day"});
    const badge=document.createElement("glt-flow-card-coverage-badge");
    const chart=document.createElement("glt-flow-card-trend-chart");
    const table=document.createElement("glt-flow-card-trend-table");
    host.append(badge,chart,table);
    const props={coverage:loaded.coverage,gaps:loaded.gaps,language:"de",
      series:loaded.series,source:loaded.source};
    badge.props=props;chart.props=props;table.props=props;
  }

  const oldCardRender=Card.prototype._render;Card.prototype._render=function(){this._config=ensureV1(this._config);const r=oldCardRender.call(this);addStyle(this.shadowRoot);runtimeButtons(this);refreshAlarmState(this);refreshHistoryState(this);if(this._config.ui?.kiosk)document.body.classList.add("glt-v1-kiosk");return r;};

  function editorRoot(editor){return editor.shadowRoot;} function editorModal(editor,title,html){return modal(editor,title,html);} function emit(editor){editor._emit?.();editor._render?.();}
  function selectedRefs(editor){const multi=[...(editor._glt4Multi||[])].map(k=>{const [kind,id]=k.split(":");return{kind,id}});if(multi.length)return multi;return editor._sel?[{kind:editor._sel.k,id:editor._sel.id}]:[];}
  function selectedEquipment(editor){const refs=selectedRefs(editor).filter(r=>r.kind==="equipment");return refs.map(r=>editor._config.equipment.find(x=>x.id===r.id)).filter(Boolean);}

  const groupText = (group) => (group && SYMBOL_GROUPS[group] ? labelText(SYMBOL_GROUPS[group]) : (group || ""));
  function showSymbolLibrary(editor){const stats=symbolCatalogStats(),current=selectedEquipment(editor)[0];const m=editorModal(editor,`${t(editor._config,"symbols")} · ${stats.variants} Varianten`,`<div class="glt-v1-actions"><select class="glt-v1-select" data-style>${VISUAL_STYLES.map(s=>`<option value="${s.id}">${s.label}</option>`).join("")}</select><input class="glt-v1-input" data-q placeholder="Pumpe, Ventil, RLT…"></div><div class="glt-v1-grid" data-grid style="margin-top:10px"></div>`);const render=()=>{const q=m.querySelector("[data-q]").value.toLowerCase(),style=m.querySelector("[data-style]").value;const data=SYMBOL_VARIANTS.filter(s=>s.style===style&&(!q||`${s.label} ${s.category} ${s.group||""}`.toLowerCase().includes(q)));const grid=m.querySelector("[data-grid]");grid.className=`glt-v1-grid glt-style-${style}`;grid.innerHTML=data.map(s=>{const geometry=SYMBOL_GEOMETRY.get(s.base_symbol);const preview=geometry?`<div style="width:44px;height:44px;margin-bottom:6px">${symbolSvg(geometry)}</div>`:"";return `<div class="glt-v1-card" style="display:flex;gap:9px;align-items:center">${preview}<div style="min-width:0;flex:1"><b>${esc(s.label)}</b><small>${esc(s.category)} · ${esc(groupText(s.group))}</small></div>${current?`<button class="glt-v1-btn" data-use="${esc(s.id)}">Übernehmen</button>`:""}</div>`}).join("");m.querySelectorAll("[data-use]").forEach(b=>b.onclick=()=>{const s=SYMBOL_VARIANTS.find(x=>x.id===b.dataset.use);editor._remember?.();current.symbol=s.base_symbol;current.symbol_variant=s.id;current.profile=s.profile;editor._config.appearance=editor._config.appearance||{};editor._config.appearance.mode=s.style;emit(editor);m.remove();});};m.querySelector("[data-q]").oninput=render;m.querySelector("[data-style]").onchange=render;render();}

  function showSemantics(editor){const items=editor._config.equipment||[];const m=editorModal(editor,t(editor._config,"semantics"),`<p style="font-size:9px;color:var(--mut)">Standort → Gebäude → Etage → System → Teilanlage → Aggregat → Datenpunkt</p><table class="glt-v1-table"><thead><tr><th>Aggregat</th><th>Site</th><th>Gebäude</th><th>Etage</th><th>System</th><th>Tags</th></tr></thead><tbody>${items.map((i,n)=>`<tr data-i="${n}"><td>${esc(i.name||i.id)}</td><td><input class="glt-v1-input" data-f="site" value="${esc(i.site||"")}"></td><td><input class="glt-v1-input" data-f="building" value="${esc(i.building||"")}"></td><td><input class="glt-v1-input" data-f="floor" value="${esc(i.floor||"")}"></td><td><input class="glt-v1-input" data-f="system" value="${esc(i.system||"")}"></td><td><input class="glt-v1-input" data-f="tags" value="${esc((i.tags||[]).join(", "))}"></td></tr>`).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn primary" data-save>Übernehmen</button></div>`);m.querySelector("[data-save]").onclick=()=>{editor._remember?.();m.querySelectorAll("[data-i]").forEach(r=>{const i=items[+r.dataset.i];r.querySelectorAll("[data-f]").forEach(inp=>{if(inp.dataset.f==="tags")i.tags=inp.value.split(",").map(x=>x.trim()).filter(Boolean);else i[inp.dataset.f]=inp.value||undefined;});i.semantic_path=semanticPath(i,editor._config);});emit(editor);m.remove();};}

  function showAutoMapping(editor){const item=selectedEquipment(editor)[0];if(!item)return notice(editor,gltText("legacy.select_equipment_first"));const result=autoMapEquipment(item,editor._hass?.states||{}),profile=profileForEquipment(item);const rows=(profile.slots||[]).map(s=>{const opts=result.suggestions[s.id]||[];return `<tr data-slot="${esc(s.id)}"><td>${esc(s.label)}</td><td><select class="glt-v1-select">${opts.map(o=>`<option value="${esc(o.entity_id)}">${esc(o.name)} · ${o.score} · ${esc(o.unit)}</option>`).join("")}</select></td></tr>`}).join("");const m=editorModal(editor,`${t(editor._config,"automap")} · ${profile.label}`,`<table class="glt-v1-table"><thead><tr><th>Slot</th><th>Vorschlag</th></tr></thead><tbody>${rows||'<tr><td colspan="2">Keine Slots.</td></tr>'}</tbody></table><button class="glt-v1-btn primary" data-apply>Bestätigen und zuordnen</button>`);m.querySelector("[data-apply]").onclick=()=>{editor._remember?.();item.bindings=item.bindings||{};m.querySelectorAll("[data-slot]").forEach(r=>item.bindings[r.dataset.slot]=r.querySelector("select").value);emit(editor);m.remove();};}

  function showCAD(editor){const refs=selectedRefs(editor),cfg=editor._config;const m=editorModal(editor,t(cfg,"cad"),`<div class="glt-v1-grid"><div class="glt-v1-card"><b>Ausrichten</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-a="left">Links</button><button class="glt-v1-btn" data-a="right">Rechts</button><button class="glt-v1-btn" data-a="top">Oben</button><button class="glt-v1-btn" data-a="bottom">Unten</button><button class="glt-v1-btn" data-a="center_v">Mitte X</button><button class="glt-v1-btn" data-a="center_h">Mitte Y</button></div></div><div class="glt-v1-card"><b>Verteilen</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-a="distribute_h">Horizontal</button><button class="glt-v1-btn" data-a="distribute_v">Vertikal</button></div></div><div class="glt-v1-card"><b>Layer</b><button class="glt-v1-btn" data-layer>Layer verwalten</button></div><div class="glt-v1-card"><b>Routing</b><button class="glt-v1-btn" data-route>Alle Auto-Routen neu berechnen</button></div><div class="glt-v1-card"><b>Zwischenablage</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-copy>Copy</button><button class="glt-v1-btn" data-paste>Paste</button></div></div></div>`);m.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{editor._remember?.();alignObjects(cfg,refs,b.dataset.a);emit(editor);m.remove();});m.querySelector("[data-route]").onclick=()=>{editor._remember?.();cfg.paths.forEach(p=>{if(p.from_equipment&&p.to_equipment&&p.auto_route!==false)p.points=smartRoute(cfg,p,editor._viewId)});emit(editor);m.remove();};m.querySelector("[data-copy]").onclick=()=>{editor._gltV1Clipboard=refs.map(r=>{const list=r.kind==="equipment"?cfg.equipment:r.kind==="datapoint"?cfg.datapoints:r.kind==="path"?cfg.paths:cfg.kpis;return{kind:r.kind,obj:clone(list.find(x=>x.id===r.id))}}).filter(x=>x.obj);};m.querySelector("[data-paste]").onclick=()=>{editor._remember?.();for(const c of editor._gltV1Clipboard||[]){const o=clone(c.obj);o.id=`${o.id||c.kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`;if(Number.isFinite(o.x))o.x+=40;if(Number.isFinite(o.y))o.y+=40;(c.kind==="equipment"?cfg.equipment:c.kind==="datapoint"?cfg.datapoints:c.kind==="path"?cfg.paths:cfg.kpis).push(o)}emit(editor);m.remove();};m.querySelector("[data-layer]").onclick=()=>{m.remove();showLayers(editor);};}
  function showLayers(editor){const cfg=editor._config,m=editorModal(editor,"Layer",`<table class="glt-v1-table"><thead><tr><th>Name</th><th>Sichtbar</th><th>Gesperrt</th></tr></thead><tbody>${cfg.layers.map((l,i)=>`<tr data-l="${i}"><td><input class="glt-v1-input" data-name value="${esc(l.name||l.id)}"></td><td><input type="checkbox" data-vis ${l.visible!==false?"checked":""}></td><td><input type="checkbox" data-lock ${l.locked?"checked":""}></td></tr>`).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn" data-add>Layer hinzufügen</button><button class="glt-v1-btn primary" data-save>Übernehmen</button></div>`);m.querySelector("[data-add]").onclick=async()=>{const name=await askText(editor,gltText("legacy.prompt_layer_name"),"Layer");if(name)cfg.layers.push({id:slug(name),name,visible:true,locked:false,order:cfg.layers.length}),m.remove(),showLayers(editor)};m.querySelector("[data-save]").onclick=()=>{m.querySelectorAll("[data-l]").forEach(r=>{const l=cfg.layers[+r.dataset.l];l.name=r.querySelector("[data-name]").value;l.visible=r.querySelector("[data-vis]").checked;l.locked=r.querySelector("[data-lock]").checked});emit(editor);m.remove();};}

  function showDiagnostics(editor){const d=diagnoseConfig(editor._config,editor._hass?.states||{});editorModal(editor,`${t(editor._config,"diagnostics")} · ${d.score.toFixed(0)} %`,`<div class="glt-v1-grid"><div class="glt-v1-card"><b>${d.referenced.length}</b><small>verwendete Entities</small></div><div class="glt-v1-card"><b>${d.issues.length}</b><small>Probleme</small></div><div class="glt-v1-card"><b>${d.unused.length}</b><small>nicht verwendete HA-Entities</small></div></div><table class="glt-v1-table"><thead><tr><th>Entity</th><th>Typ</th><th>Meldung</th></tr></thead><tbody>${d.issues.map(i=>`<tr><td>${esc(i.entity_id)}</td><td>${esc(i.severity)}</td><td>${esc(i.message)}</td></tr>`).join("")||'<tr><td colspan="3">Keine Probleme erkannt.</td></tr>'}</tbody></table>`);}
  function showSimulation(editor){const cfg=editor._config,item=selectedEquipment(editor)[0];const m=editorModal(editor,t(cfg,"simulation"),`<label><input type="checkbox" data-enabled ${cfg.simulation.enabled?"checked":""}> Simulationsmodus aktiv</label>${item?`<div class="glt-v1-card" style="margin-top:10px"><b>${esc(item.name||item.id)}</b><select class="glt-v1-select" data-state>${["off","running","auto","manual","local","warning","fault","maintenance","comm_error"].map(x=>`<option value="${x}">${x}</option>`).join("")}</select><input class="glt-v1-input" data-value placeholder=gltText("legacy.simulated_value")></div>`:""}<button class="glt-v1-btn primary" data-save>Übernehmen</button>`);m.querySelector("[data-save]").onclick=()=>{cfg.simulation.enabled=m.querySelector("[data-enabled]").checked;if(item){cfg.simulation.states[item.id]={state:m.querySelector("[data-state]").value,value:m.querySelector("[data-value]").value}}emit(editor);m.remove();};}

  function showSchedules(editor){const cfg=editor._config,m=editorModal(editor,t(cfg,"schedule"),`<table class="glt-v1-table"><thead><tr><th>Name</th><th>Tage</th><th>Zeit</th><th>Service</th><th>Entity</th><th></th></tr></thead><tbody data-body>${cfg.schedules.map((s,i)=>scheduleRow(s,i)).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn" data-add>Hinzufügen</button><button class="glt-v1-btn primary" data-save>Speichern</button></div>`);function scheduleRow(s={},i="new"){return`<tr data-s="${i}"><td><input class="glt-v1-input" data-name value="${esc(s.name||"")}"></td><td><input class="glt-v1-input" data-days value="${esc((s.days||[0,1,2,3,4]).join(","))}"></td><td><input class="glt-v1-input" data-time value="${esc(s.time||"08:00")}"></td><td><input class="glt-v1-input" data-service value="${esc(s.service||"switch.turn_on")}"></td><td><input class="glt-v1-input" data-entity value="${esc(s.entity_id||"")}"></td><td><button class="glt-v1-btn warn" data-rm>✕</button></td></tr>`}const bind=()=>m.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>b.closest("tr").remove());bind();m.querySelector("[data-add]").onclick=()=>{m.querySelector("[data-body]").insertAdjacentHTML("beforeend",scheduleRow({},"new"));bind()};m.querySelector("[data-save]").onclick=()=>{editor._remember?.();cfg.schedules=[...m.querySelectorAll("[data-s]")].map((r,i)=>({id:cfg.schedules[i]?.id||`schedule_${Date.now()}_${i}`,name:r.querySelector("[data-name]").value||`Zeitprogramm ${i+1}`,days:r.querySelector("[data-days]").value.split(",").map(Number).filter(Number.isFinite),time:r.querySelector("[data-time]").value,service:r.querySelector("[data-service]").value,entity_id:r.querySelector("[data-entity]").value,enabled:true}));emit(editor);m.remove();};}

  function showEnergy(editor){const cfg=editor._config,m=editorModal(editor,t(cfg,"energy"),`<table class="glt-v1-table"><thead><tr><th>Name</th><th>Art</th><th>Entity</th><th>Preis/Einheit</th></tr></thead><tbody data-b>${cfg.energy.meters.map((x,i)=>`<tr data-e="${i}"><td><input class="glt-v1-input" data-name value="${esc(x.name||"")}"></td><td><select class="glt-v1-select" data-kind>${["electricity","heat","cooling","water","gas","pv","battery"].map(k=>`<option ${x.kind===k?"selected":""}>${k}</option>`).join("")}</select></td><td><input class="glt-v1-input" data-entity value="${esc(x.entity||"")}"></td><td><input class="glt-v1-input" data-price value="${esc(x.price_per_unit??"")}"></td></tr>`).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn" data-add>Zähler hinzufügen</button><button class="glt-v1-btn primary" data-save>Speichern</button></div>`);m.querySelector("[data-add]").onclick=()=>{cfg.energy.meters.push({id:`meter_${Date.now()}`,name:gltText("legacy.meter"),kind:"electricity",entity:""});m.remove();showEnergy(editor)};m.querySelector("[data-save]").onclick=()=>{m.querySelectorAll("[data-e]").forEach((r,i)=>Object.assign(cfg.energy.meters[i],{name:r.querySelector("[data-name]").value,kind:r.querySelector("[data-kind]").value,entity:r.querySelector("[data-entity]").value,price_per_unit:Number(r.querySelector("[data-price]").value)||undefined}));emit(editor);m.remove();};}

  function showMaintenance(editor){const cfg=editor._config,m=editorModal(editor,t(cfg,"maintenance"),`<div class="glt-v1-actions"><button class="glt-v1-btn" data-new>Arbeitsauftrag</button></div><table class="glt-v1-table"><thead><tr><th>Status</th><th>Asset</th><th>Aufgabe</th><th>Fällig</th><th>Techniker</th></tr></thead><tbody>${cfg.work_orders.map(w=>`<tr><td>${esc(w.status||"open")}</td><td>${esc(w.asset_id||"")}</td><td>${esc(w.title||"")}</td><td>${esc(w.due||"")}</td><td>${esc(w.assignee||"")}</td></tr>`).join("")||'<tr><td colspan="5">${gltText("legacy.no_work_orders")}</td></tr>'}</tbody></table>`);m.querySelector("[data-new]").onclick=async()=>{const title=await askText(editor,gltText("legacy.prompt_task"),gltText("legacy.perform_maintenance"));if(!title)return;cfg.work_orders.push({id:`wo_${Date.now()}`,title,status:"open",asset_id:"",due:new Date().toISOString().slice(0,10),created:new Date().toISOString()});emit(editor);m.remove();showMaintenance(editor)};}

  function showProjectV1(editor){const cfg=editor._config;const m=editorModal(editor,t(cfg,"project"),`<div class="glt-v1-grid"><div class="glt-v1-card"><b>Schema</b><strong>v${cfg.schema_version}</strong><small>Revision ${cfg.project.revision||0}</small></div><div class="glt-v1-card"><b>.gltproject</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-export>Export</button><button class="glt-v1-btn" data-import>Import</button></div></div><div class="glt-v1-card"><b>Projekt-Lock</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-lock>Lock</button><button class="glt-v1-btn" data-unlock>Unlock</button></div></div><div class="glt-v1-card"><b>Vergleich</b><button class="glt-v1-btn" data-diff>Mit YAML/JSON vergleichen</button></div></div><input type="file" data-file accept=".gltproject" style="display:none">`);m.querySelector("[data-export]").onclick=async()=>{try{download(`${slug(cfg.project.name)}.gltproject`,await makeProjectBundle(cfg),"application/zip")}catch(err){notice(editor,err.message)}};m.querySelector("[data-import]").onclick=()=>m.querySelector("[data-file]").click();m.querySelector("[data-file]").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const next=await readProjectBundle(await f.arrayBuffer());editor.setConfig(next);emit(editor);m.remove();}catch(err){notice(editor,err.message)}};m.querySelector("[data-lock]").onclick=async()=>{try{await ws(editor,"projects/lock",{project_id:projectId(cfg),ttl_seconds:300});notice(editor,gltText("legacy.project_locked"))}catch(err){notice(editor,err.message)}};m.querySelector("[data-unlock]").onclick=async()=>{try{await ws(editor,"projects/unlock",{project_id:projectId(cfg)});notice(editor,gltText("legacy.lock_released"))}catch(err){notice(editor,err.message)}};m.querySelector("[data-diff]").onclick=async()=>{const txt=await askText(editor,gltText("legacy.paste_compare_json"));if(!txt)return;try{const other=JSON.parse(txt),d=projectDiff(other,cfg);m.remove();editorModal(editor,"Projektvergleich",`<table class="glt-v1-table"><tbody>${d.slice(0,500).map(x=>`<tr><td>${esc(x.type)}</td><td><code>${esc(x.path)}</code></td><td>${esc(JSON.stringify(x.before))}</td><td>${esc(JSON.stringify(x.after))}</td></tr>`).join("")}</tbody></table>`)}catch(err){notice(editor,err.message)}};}

  function applyLayers(editor){const cfg=editor._config,layers=new Map(cfg.layers.map(l=>[l.id,l]));editor.shadowRoot.querySelectorAll("[data-k][data-id]").forEach(n=>{const kind=n.dataset.k,id=n.dataset.id;const list=kind==="equipment"?cfg.equipment:kind==="datapoint"?cfg.datapoints:kind==="path"?cfg.paths:[];const obj=list.find(x=>x.id===id),l=layers.get(obj?.layer||"default");n.classList.toggle("glt-v1-layer-hidden",l?.visible===false);n.classList.toggle("glt-v1-layer-locked",l?.locked===true);});}
  function minimap(editor){const root=editor.shadowRoot;if(editor._config.ui?.minimap===false){root.querySelector(".glt-v1-minimap")?.remove();return}const host=root.querySelector(".canvas,.stage,[data-canvas],.draw");if(!host||root.querySelector(".glt-v1-minimap"))return;const m=document.createElement("div");m.className="glt-v1-minimap";const cw=editor._config.canvas?.width||1600,ch=editor._config.canvas?.height||900;for(const e of editor._config.equipment||[]){const d=document.createElement("div");d.className="glt-v1-miniitem";d.style.left=`${(e.x||0)/cw*180}px`;d.style.top=`${(e.y||0)/ch*110}px`;d.style.width=`${Math.max(3,(e.width||180)/cw*180)}px`;d.style.height=`${Math.max(3,(e.height||100)/ch*110)}px`;m.appendChild(d)}host.style.position=host.style.position||"relative";host.appendChild(m);}

  /** Imported entity catalog: persisted next to the editor's own templates. */
  function entityCatalog(editor) {
    if (Array.isArray(editor._entityCatalog) && editor._entityCatalog.length) return editor._entityCatalog;
    try {
      const parsed = JSON.parse(localStorage.getItem("glt-flow-card.entities") || "null");
      if (Array.isArray(parsed?.entities)) return parsed.entities;
    } catch (_err) { /* unreadable storage behaves like no import */ }
    return [];
  }

  /* Without a live Home Assistant the native entity picker does not exist as
   * an element. Imported entities then power a plain input with a datalist,
   * so the standalone designer keeps working entity fields after an import. */
  function wireEntityFields(editor) {
    if (customElements.get("ha-entity-picker")) return;
    const root = editor.shadowRoot;
    if (!root) return;
    const catalog = entityCatalog(editor);
    let list = root.querySelector("datalist#glt-entities");
    if (!list) {
      list = document.createElement("datalist");
      list.id = "glt-entities";
      root.appendChild(list);
    }
    list.innerHTML = catalog.slice(0, 2000).map((e) => `<option value="${esc(e.entity_id)}">${esc(e.name)}</option>`).join("");
    root.querySelectorAll("ha-entity-picker[data-ep]").forEach((picker) => {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "glt-v1-input";
      input.setAttribute("list", "glt-entities");
      input.value = picker.dataset.v || "";
      input.dataset.e = picker.dataset.e || "";
      input.addEventListener("change", () => editor._entityEdit?.(input.dataset.e, input.value.trim()));
      picker.replaceWith(input);
    });
  }

  function applyTemplate(editor, config) {
    editor._remember?.();
    editor._config = ensureV1(JSON.parse(JSON.stringify(config)));
    editor._emit?.();
    editor._render();
    wireEntityFields(editor);
  }

  function showTemplates(editor) {
    const factory = factoryTemplates();
    let own = [];
    try { own = JSON.parse(localStorage.getItem("glt-flow-card.templates") || "[]"); } catch (_err) { own = []; }
    const ownRows = own.filter((tp) => tp && tp.config)
      .map((tp, i) => `<div class="glt-v1-card"><b>${esc(tp.name || tp.id || gltText("legacy.templates_own"))}</b><small>${esc(tp.description || "")}</small><button class="glt-v1-btn" data-otpl="${i}">${gltText("legacy.templates_load")}</button></div>`).join("");
    const m = editorModal(editor, `${t(editor._config, "templates")}`, `
      <div class="glt-v1-notice">${gltText("legacy.templates_hint")}</div>
      <h4 style="margin:12px 0 6px;font-size:11px">${gltText("legacy.templates_factory")}</h4>
      <div class="glt-v1-grid">${factory.map((tp) => `<div class="glt-v1-card"><b>${esc(tp.name)}</b><small>${esc(tp.description)}</small><button class="glt-v1-btn" data-tpl="${esc(tp.id)}">${gltText("legacy.templates_load")}</button></div>`).join("")}</div>
      <h4 style="margin:14px 0 6px;font-size:11px">${gltText("legacy.templates_own")}</h4>
      ${ownRows ? `<div class="glt-v1-grid">${ownRows}</div>` : `<small style="color:var(--secondary-text-color)">${gltText("legacy.templates_none")}</small>`}`);
    m.querySelectorAll("[data-tpl]").forEach((b) => b.onclick = () => {
      const tp = factory.find((x) => x.id === b.dataset.tpl);
      if (!tp) return;
      applyTemplate(editor, tp.config);
      m.remove();
    });
    m.querySelectorAll("[data-otpl]").forEach((b) => b.onclick = () => {
      const tp = own[Number(b.dataset.otpl)];
      if (!tp?.config) return;
      applyTemplate(editor, tp.config);
      m.remove();
    });
  }

  function showEntities(editor) {
    const hass = sdk.currentHass?.();
    const hasStates = !!(hass?.states && Object.keys(hass.states).length);
    const imported = entityCatalog(editor);
    const row = (e) => `<tr><td>${esc(e.entity_id)}</td><td>${esc(e.name)}</td><td>${esc(e.unit || "")}</td></tr>`;
    const m = editorModal(editor, `${t(editor._config, "entities")}`, `
      <div class="glt-v1-actions">
        <button class="glt-v1-btn primary" data-exp ${hasStates ? "" : "disabled"}>⇩ ${gltText("legacy.entities_export")}</button>
        <label class="glt-v1-btn" style="display:inline-flex;align-items:center;cursor:pointer">⇧ ${gltText("legacy.entities_import")}<input type="file" accept=".json,application/json" data-imp hidden></label>
      </div>
      <div class="glt-v1-notice" style="margin-top:10px" data-notice>${gltText("legacy.entities_hint")}</div>
      <div style="margin-top:10px;font-size:10px">${gltText("legacy.entities_imported")}: <b data-count>${imported.length}</b>${hasStates ? "" : ` · <span style="color:var(--secondary-text-color)">${gltText("legacy.entities_offline")}</span>`}</div>
      <div style="max-height:320px;overflow:auto;margin-top:8px"><table class="glt-v1-table"><tbody data-rows>${imported.slice(0, 200).map(row).join("")}</tbody></table></div>`);
    m.querySelector("[data-exp]")?.addEventListener("click", () => {
      const payload = entityExportPayload(hass?.states || {});
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "glt-entities.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
    m.querySelector("[data-imp]")?.addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0];
      const notice = m.querySelector("[data-notice]");
      if (!file || !notice) return;
      try {
        const result = normalizeEntityImport(JSON.parse(await file.text()));
        localStorage.setItem("glt-flow-card.entities", JSON.stringify(result));
        editor._entityCatalog = result.entities;
        m.querySelector("[data-count]").textContent = String(result.count);
        m.querySelector("[data-rows]").innerHTML = result.entities.slice(0, 200).map(row).join("");
        notice.textContent = `${gltText("legacy.entities_imported")}: ${result.count} · ${gltText("legacy.entities_rejected")}: ${result.rejected}`;
        wireEntityFields(editor);
      } catch (_err) {
        notice.textContent = gltText("legacy.entities_invalid");
      }
    });
  }

  function editorToolbar(editor){const root=editor.shadowRoot;if(root.querySelector("[data-glt-v1-toolbar]"))return;const base=root.querySelector(".glt4-bar,.toolbar,.bar,.tb")||root.firstElementChild;if(!base)return;const bar=document.createElement("div");bar.className="glt-v1-toolbar";bar.dataset.gltV1Toolbar="1";const buttons=[["symbols","🧩"],["templates","▤"],["semantics","⌘"],["automap","↯"],["cad","⌗"],["diagnostics","✓"],["simulation","◉"],["schedule","◷"],["energy","⚡"],["entities","⇋"],["maintenance","🔧"],["project","▣"]];bar.innerHTML=buttons.map(([k,ic])=>`<button data-v1="${k}">${ic} ${esc(t(editor._config,k))}</button>`).join("");base.after(bar);const act={symbols:showSymbolLibrary,templates:showTemplates,entities:showEntities,semantics:showSemantics,automap:showAutoMapping,cad:showCAD,diagnostics:showDiagnostics,simulation:showSimulation,schedule:showSchedules,energy:showEnergy,maintenance:showMaintenance,project:showProjectV1};bar.querySelectorAll("[data-v1]").forEach(b=>b.onclick=()=>act[b.dataset.v1]?.(editor));}
  const oldEditorRender=Editor.prototype._render;Editor.prototype._render=function(){this._config=ensureV1(this._config);const r=oldEditorRender.call(this);addStyle(this.shadowRoot);editorToolbar(this);applyLayers(this);minimap(this);wireEntityFields(this);return r;};

  // History aggregation hook: preserve original data source, process after retrieval when possible.
  // The Companion's answer where there is one, and the local points otherwise.
  // This was the last call to `aggregateSeries`, so dropping it drops the
  // function from the artifact entirely: its epoch-aligned
  // `Math.floor(x / bucketMs)` buckets cannot express a 23-hour day, a 25-hour
  // day or a month at all, and the report designer offers months and years.
  // Calling it here would put a displaced bucket back on the screen under the
  // Companion's name. The artifact can no longer do that at all, rather than
  // being trusted not to.
  const oldSeries=Card.prototype._seriesFor; if(oldSeries)Card.prototype._seriesFor=function(point){
    const measured=(this._historyState&&this._historyState.series)||[];
    const id=entityId(point&&point.entity||point);
    const row=measured.find(entry=>entry&&(entry.entity_id===id||entry.statistic_id===id));
    if(row&&Array.isArray(row.points))return row.points;
    return oldSeries.call(this,point)||[];
  };

  console.info(`GLT Flow Card Engineering Platform 1.0 enabled · ${symbolCatalogStats().variants} symbol variants · ${COMPONENT_PROFILES.length} parametric profiles`);
})();
