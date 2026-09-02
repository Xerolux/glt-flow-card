/*!
 * GLT Flow Card
 * Modern configurable building-management / plant visualization for Home Assistant.
 * https://github.com/Xerolux/glt-flow-card
 * MIT License - Copyright (c) 2026 Xerolux
 */

(() => {
  "use strict";

  const VERSION = "1.0.0";
  const CARD_TYPE = "glt-flow-card";
  const SVG_NS = "http://www.w3.org/2000/svg";

  console.info(
    `%c GLT-FLOW-CARD %c v${VERSION} `,
    "color:#fff;background:#0f766e;font-weight:700;border-radius:4px 0 0 4px;padding:2px 5px",
    "color:#0f766e;background:#ccfbf1;font-weight:700;border-radius:0 4px 4px 0;padding:2px 5px"
  );

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const ON_STATES = new Set([
    "on", "true", "1", "open", "opening", "running", "active", "heating", "heat",
    "cooling", "cool", "auto", "home", "playing", "charging", "discharging", "occupied"
  ]);

  const EQUIPMENT_ICONS = {
    heat_pump: "mdi:heat-pump",
    tank: "mdi:storage-tank",
    pump: "mdi:pump",
    fan: "mdi:fan",
    valve: "mdi:valve",
    heat_exchanger: "mdi:heat-wave",
    boiler: "mdi:water-boiler",
    ahu: "mdi:air-filter",
    room: "mdi:home-thermometer-outline",
    meter: "mdi:gauge",
    solar: "mdi:solar-panel-large",
    pv: "mdi:solar-power-variant",
    grid: "mdi:transmission-tower",
    generic: "mdi:cube-outline",
    image: "mdi:image-outline"
  };

  const SYMBOL_LIBRARY = [
    { id:"heat_pump_neo", label:"Wärmepumpe · Neo", category:"Heizung", type:"heat_pump", icon:"mdi:heat-pump" },
    { id:"heat_pump_compact", label:"Wärmepumpe · Kompakt", category:"Heizung", type:"heat_pump", icon:"mdi:heat-pump-outline" },
    { id:"buffer_vertical", label:"Pufferspeicher · Vertikal", category:"Heizung", type:"tank", icon:"mdi:storage-tank" },
    { id:"buffer_layered", label:"Schichtspeicher", category:"Heizung", type:"tank", icon:"mdi:storage-tank-outline" },
    { id:"dhw_tank", label:"Warmwasserspeicher", category:"Heizung", type:"tank", icon:"mdi:water-boiler" },
    { id:"boiler", label:"Heizkessel", category:"Heizung", type:"boiler", icon:"mdi:fire-circle" },
    { id:"immersion_heater", label:"Heizstab", category:"Heizung", type:"generic", icon:"mdi:heating-coil" },
    { id:"radiator", label:"Heizkörper", category:"Heizung", type:"room", icon:"mdi:radiator" },
    { id:"underfloor", label:"Fußbodenheizung", category:"Heizung", type:"room", icon:"mdi:heating-coil" },
    { id:"heating_circuit", label:"Heizkreis", category:"Heizung", type:"room", icon:"mdi:home-thermometer-outline" },
    { id:"fancoil", label:"Gebläsekonvektor", category:"Heizung", type:"fan", icon:"mdi:hvac" },
    { id:"source_ground", label:"Erdsonde / Quelle", category:"Heizung", type:"generic", icon:"mdi:sprout-outline" },

    { id:"pump_inline", label:"Pumpe · Inline", category:"Hydraulik", type:"pump", icon:"mdi:pump" },
    { id:"pump_circulation", label:"Umwälzpumpe", category:"Hydraulik", type:"pump", icon:"mdi:pump" },
    { id:"pump_dhw", label:"Zirkulationspumpe", category:"Hydraulik", type:"pump", icon:"mdi:water-pump" },
    { id:"valve_2way", label:"2-Wege-Ventil", category:"Hydraulik", type:"valve", icon:"mdi:valve" },
    { id:"valve_3way", label:"3-Wege-Ventil", category:"Hydraulik", type:"valve", icon:"mdi:valve-open" },
    { id:"mixing_valve", label:"Mischventil", category:"Hydraulik", type:"valve", icon:"mdi:valve-closed" },
    { id:"check_valve", label:"Rückschlagventil", category:"Hydraulik", type:"valve", icon:"mdi:arrow-decision-outline" },
    { id:"balancing_valve", label:"Strangregulierventil", category:"Hydraulik", type:"valve", icon:"mdi:tune-variant" },
    { id:"heat_exchanger_plate", label:"Plattenwärmetauscher", category:"Hydraulik", type:"heat_exchanger", icon:"mdi:heat-wave" },
    { id:"hydraulic_separator", label:"Hydraulische Weiche", category:"Hydraulik", type:"heat_exchanger", icon:"mdi:swap-vertical-bold" },
    { id:"manifold", label:"Verteiler / Sammler", category:"Hydraulik", type:"generic", icon:"mdi:pipe-valve" },
    { id:"expansion_vessel", label:"Ausdehnungsgefäß", category:"Hydraulik", type:"tank", icon:"mdi:circle-half-full" },
    { id:"filter_water", label:"Schmutzfänger", category:"Hydraulik", type:"generic", icon:"mdi:filter-outline" },

    { id:"ahu", label:"RLT-Zentrale", category:"RLT / Lüftung", type:"ahu", icon:"mdi:air-filter" },
    { id:"fan_supply", label:"Zuluftventilator", category:"RLT / Lüftung", type:"fan", icon:"mdi:fan" },
    { id:"fan_extract", label:"Abluftventilator", category:"RLT / Lüftung", type:"fan", icon:"mdi:fan-chevron-down" },
    { id:"damper", label:"Luftklappe", category:"RLT / Lüftung", type:"valve", icon:"mdi:blinds-horizontal" },
    { id:"air_filter", label:"Luftfilter", category:"RLT / Lüftung", type:"generic", icon:"mdi:air-filter" },
    { id:"heating_coil", label:"Heizregister", category:"RLT / Lüftung", type:"heat_exchanger", icon:"mdi:radiator" },
    { id:"cooling_coil", label:"Kühlregister", category:"RLT / Lüftung", type:"heat_exchanger", icon:"mdi:snowflake" },
    { id:"humidifier", label:"Befeuchter", category:"RLT / Lüftung", type:"generic", icon:"mdi:air-humidifier" },
    { id:"room_air", label:"Raum / Zone", category:"RLT / Lüftung", type:"room", icon:"mdi:home-thermometer" },

    { id:"chiller", label:"Kältemaschine", category:"Kälte", type:"heat_pump", icon:"mdi:snowflake-thermometer" },
    { id:"cooling_tower", label:"Kühlturm", category:"Kälte", type:"generic", icon:"mdi:coolant-temperature" },
    { id:"cooling_buffer", label:"Kältepuffer", category:"Kälte", type:"tank", icon:"mdi:storage-tank" },
    { id:"fancoil_cooling", label:"Fan-Coil", category:"Kälte", type:"fan", icon:"mdi:hvac" },

    { id:"pv_array", label:"PV-Anlage", category:"Energie", type:"pv", icon:"mdi:solar-power-variant" },
    { id:"solar_thermal", label:"Solarthermie", category:"Energie", type:"solar", icon:"mdi:solar-panel-large" },
    { id:"battery", label:"Batteriespeicher", category:"Energie", type:"generic", icon:"mdi:battery-charging-high" },
    { id:"grid", label:"Stromnetz", category:"Energie", type:"grid", icon:"mdi:transmission-tower" },
    { id:"meter", label:"Energiezähler", category:"Energie", type:"meter", icon:"mdi:meter-electric-outline" },
    { id:"wallbox", label:"Wallbox", category:"Energie", type:"generic", icon:"mdi:ev-station" },

    { id:"temp_sensor", label:"Temperaturfühler", category:"Sensorik", type:"meter", icon:"mdi:thermometer" },
    { id:"pressure_sensor", label:"Drucksensor", category:"Sensorik", type:"meter", icon:"mdi:gauge" },
    { id:"flow_sensor", label:"Volumenstrom", category:"Sensorik", type:"meter", icon:"mdi:waves-arrow-right" },
    { id:"humidity_sensor", label:"Feuchtefühler", category:"Sensorik", type:"meter", icon:"mdi:water-percent" },
    { id:"co2_sensor", label:"CO₂-Sensor", category:"Sensorik", type:"meter", icon:"mdi:molecule-co2" },
    { id:"room_sensor", label:"Raumsensor", category:"Sensorik", type:"room", icon:"mdi:home-thermometer-outline" },

    { id:"generic_machine", label:"Allgemeine Anlage", category:"Allgemein", type:"generic", icon:"mdi:cube-outline" },
    { id:"custom_image", label:"Eigenes Symbol / Bild", category:"Allgemein", type:"image", icon:"mdi:image-outline" }
  ];
  function symbolById(id,type){
    return SYMBOL_LIBRARY.find(item=>item.id===id) || SYMBOL_LIBRARY.find(item=>item.type===type) || { id:type||"generic_machine", label:type||"Anlage", type:type||"generic", icon:EQUIPMENT_ICONS[type]||EQUIPMENT_ICONS.generic, category:"Allgemein" };
  }

  const MEDIUMS = {
    heating_supply: { color: "#ef4444", label: "Vorlauf" },
    heating_return: { color: "#3b82f6", label: "Rücklauf" },
    cooling_supply: { color: "#06b6d4", label: "Kaltwasser" },
    cooling_return: { color: "#8b5cf6", label: "Kühl-Rücklauf" },
    dhw: { color: "#f97316", label: "Warmwasser" },
    cold_water: { color: "#0ea5e9", label: "Kaltwasser" },
    source: { color: "#22c55e", label: "Quelle" },
    air_supply: { color: "#ec4899", label: "Zuluft" },
    air_extract: { color: "#f59e0b", label: "Abluft" },
    air_outdoor: { color: "#84cc16", label: "Außenluft" },
    air_exhaust: { color: "#64748b", label: "Fortluft" },
    electrical: { color: "#eab308", label: "Elektrisch" },
    neutral: { color: "#64748b", label: "Medium" }
  };

  const TREND_COLORS = [
    "#14b8a6", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e", "#ec4899", "#06b6d4"
  ];

  function fireEvent(node, type, detail = {}) {
    const event = new Event(type, { bubbles: true, composed: true });
    event.detail = detail;
    node.dispatchEvent(event);
    return event;
  }

  function entityField(value) {
    if (!value) return null;
    if (typeof value === "string") return { entity: value };
    if (typeof value === "object" && (value.entity || value.attribute)) return value;
    return null;
  }

  function domainOf(entityId) {
    return typeof entityId === "string" && entityId.includes(".") ? entityId.split(".")[0] : "";
  }

  function numeric(raw) {
    if (raw === null || raw === undefined || raw === "") return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * What a formatter shows when it cannot format.
   *
   * The previous version fell back to `new Date(value).toLocaleString()` — the
   * *viewer's* locale — so one screen could carry two date formats and nothing
   * said which was which. `03/09` and `09/03` are the same instant written two
   * ways. A refusal is legible; a silently reformatted timestamp is not.
   */
  const UNREADABLE_TEXT = "—";

  /**
   * The shared formatters, read off the SDK at call time.
   *
   * This file is concatenated before the v1 bundle and is a plain IIFE, so it
   * cannot import. Reading at call time is late enough, and sharing one
   * formatter is the whole point: two formatters is how the two date formats
   * appeared in the first place.
   */
  function sharedFormat() {
    return window.GLTFlowCardSDK ?? null;
  }

  function formatDateTime(value, locale) {
    const sdk = sharedFormat();
    if (!sdk?.formatDateTime) return UNREADABLE_TEXT;
    const formatted = sdk.formatDateTime(value, locale);
    return formatted === sdk.UNREADABLE ? UNREADABLE_TEXT : formatted;
  }

  function normalizeConfig(raw) {
    const config = deepClone(raw || {});
    config.title = config.title ?? "GLT Anlagenvisualisierung";
    config.appearance = { mode: "neo2030", show_switch: true, ...(config.appearance || {}) };
    config.canvas = {
      width: 1600,
      height: 900,
      grid: true,
      grid_size: 40,
      viewport_height: 620,
      ...(config.canvas || {})
    };
    config.zoom = {
      enabled: true,
      min: 0.25,
      max: 4,
      wheel: true,
      controls: true,
      ...(config.zoom || {})
    };
    config.replay = {
      enabled: true,
      hours: 168,
      step_minutes: 15,
      autoplay_ms: 900,
      ...(config.replay || {})
    };
    config.trend = {
      enabled: true,
      hours: config.replay.hours,
      max_series: 8,
      height: 250,
      ...(config.trend || {})
    };
    config.views = Array.isArray(config.views) && config.views.length
      ? config.views
      : [{ id: "schematic", name: "Anlagenschema", kind: "schematic" }];
    config.default_view = config.default_view || config.views[0].id;
    config.kpis = Array.isArray(config.kpis) ? config.kpis : [];
    config.equipment = Array.isArray(config.equipment) ? config.equipment : [];
    config.paths = Array.isArray(config.paths) ? config.paths : [];
    config.datapoints = Array.isArray(config.datapoints) ? config.datapoints : [];
    config.status = config.status || {};
    return config;
  }

  class GltFlowCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = normalizeConfig({});
      this._hass = null;
      this._view = null;
      this._styleMode = null;
      this._zoom = 1;
      this._pan = { x: 0, y: 0 };
      this._fitScale = 1;
      this._hasFit = false;
      this._pointers = new Map();
      this._gesture = null;
      this._history = new Map();
      this._historyRange = null;
      this._historyLoading = false;
      this._historyError = null;
      this._replayActive = false;
      this._replayTime = null;
      this._replayTimer = null;
      this._trendOpen = false;
      this._trendSelected = new Set();
      this._renderQueued = false;
      this._resizeObserver = null;
    }

    static getConfigElement() {
      return document.createElement("glt-flow-card-editor");
    }

    static getStubConfig() {
      return {
        title: "GLT Anlagenvisualisierung",
        views: [{ id: "schematic", name: "Anlagenschema", kind: "schematic" }],
        equipment: [
          {
            id: "plant",
            name: "Anlage",
            type: "heat_pump",
            x: 160,
            y: 300,
            width: 260,
            height: 180,
            fields: []
          }
        ],
        datapoints: [],
        paths: [],
        kpis: []
      };
    }

    setConfig(config) {
      if (!config || typeof config !== "object") throw new Error("GLT Flow Card: configuration is required.");
      this._config = normalizeConfig(config);
      this._styleMode = this._config.appearance?.mode || "neo2030";
      if (!this._view || !this._config.views.some((view) => view.id === this._view)) {
        this._view = this._config.default_view;
      }
      this._hasFit = false;
      this._queueRender();
    }

    set hass(hass) {
      this._hass = hass;
      this._queueRender();
    }

    getCardSize() {
      return this._trendOpen ? 12 : 8;
    }

    getGridOptions() {
      return { columns: "full", min_columns: 6, rows: this._trendOpen ? 12 : 8 };
    }

    connectedCallback() {
      this._queueRender();
      if (typeof ResizeObserver !== "undefined") {
        this._resizeObserver = new ResizeObserver(() => {
          if (!this._hasFit) this._fitCanvas();
        });
        this._resizeObserver.observe(this);
      }
    }

    disconnectedCallback() {
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._stopReplay();
    }

    _queueRender() {
      if (this._renderQueued || !this.shadowRoot) return;
      this._renderQueued = true;
      requestAnimationFrame(() => {
        this._renderQueued = false;
        this._render();
      });
    }

    /**
     * The locale to format in — from Home Assistant, never from the browser.
     *
     * `navigator.language` is what the *reader's* machine is set to, which on a
     * shared control-room workstation is whoever installed it. Mixing it with
     * the configured language is how one screen ends up carrying two formats,
     * and the hardcoded `"de-DE"` was a locale the installation never chose.
     * Returning nothing makes the formatters refuse, which is visible.
     */
    _locale() {
      return this._hass?.locale?.language || null;
    }

    _currentView() {
      return this._config.views.find((view) => view.id === this._view) || this._config.views[0];
    }

    _positionFor(item) {
      if (item.positions && item.positions[this._view]) return item.positions[this._view];
      if (item.position && item.position[this._view]) return item.position[this._view];
      return item;
    }

    _visibleInView(item) {
      if (Array.isArray(item.views) && item.views.length) return item.views.includes(this._view);
      if (item.view) return item.view === this._view;
      return true;
    }

    _pointsFor(path) {
      if (Array.isArray(path.points)) return path.points;
      if (path.points && Array.isArray(path.points[this._view])) return path.points[this._view];
      return [];
    }

    _stateAt(entityId, atTime = this._replayTime) {
      const live = this._hass?.states?.[entityId];
      if (!this._replayActive || !atTime) return live;
      const series = this._history.get(entityId);
      if (!series || !series.length) return live;
      const target = atTime instanceof Date ? atTime.getTime() : new Date(atTime).getTime();
      let lo = 0;
      let hi = series.length - 1;
      let candidate = series[0];
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const stamp = new Date(series[mid].last_updated || series[mid].last_changed).getTime();
        if (stamp <= target) {
          candidate = series[mid];
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (!candidate) return live;
      return {
        ...(live || {}),
        ...candidate,
        attributes: { ...(live?.attributes || {}), ...(candidate.attributes || {}) }
      };
    }

    _raw(fieldLike, atTime) {
      const field = entityField(fieldLike);
      if (!field?.entity) return undefined;
      const stateObj = this._stateAt(field.entity, atTime);
      if (!stateObj) return undefined;
      return field.attribute ? stateObj.attributes?.[field.attribute] : stateObj.state;
    }

    _number(fieldLike, atTime) {
      return numeric(this._raw(fieldLike, atTime));
    }

    _unit(fieldLike) {
      const field = entityField(fieldLike);
      if (!field) return "";
      if (field.unit !== undefined) return field.unit;
      const stateObj = this._stateAt(field.entity);
      return stateObj?.attributes?.unit_of_measurement || "";
    }

    _display(fieldLike, fallback = "–", atTime) {
      const field = entityField(fieldLike);
      if (!field?.entity) return fallback;
      const raw = this._raw(field, atTime);
      if (raw === undefined || raw === null || raw === "" || ["unknown", "unavailable"].includes(String(raw).toLowerCase())) {
        return fallback;
      }
      const number = numeric(raw);
      const unit = field.unit !== undefined ? field.unit : this._unit(field);
      if (number !== null) {
        const decimals = field.decimals ?? (Math.abs(number) < 100 ? 1 : 0);
        const sdk = sharedFormat();
        if (!sdk?.formatMeasurement) return UNREADABLE_TEXT;
        const formatted = sdk.formatMeasurement(number, unit, this._locale(), { decimals });
        return formatted === sdk.UNREADABLE ? UNREADABLE_TEXT : formatted;
      }
      return String(raw);
    }

    _isActive(fieldLike) {
      const field = entityField(fieldLike);
      if (!field?.entity) return false;
      const raw = this._raw(field);
      const number = numeric(raw);
      if (number !== null) return field.invert ? number <= (field.threshold ?? 0) : number > (field.threshold ?? 0);
      const active = ON_STATES.has(String(raw ?? "").toLowerCase());
      return field.invert ? !active : active;
    }

    _entityIds() {
      const ids = new Set();
      const add = (value) => {
        const field = entityField(value);
        if (field?.entity) ids.add(field.entity);
      };
      this._config.kpis.forEach((kpi) => add(kpi.entity || kpi));
      this._config.datapoints.forEach((point) => add(point.entity || point));
      this._config.paths.forEach((path) => {
        add(path.flow);
        add(path.temperature);
        add(path.value);
      });
      this._config.equipment.forEach((item) => {
        add(item.entity);
        add(item.state_entity);
        (item.fields || []).forEach((field) => add(field.entity || field));
        (item.slots || []).forEach((slot) => add(slot.entity || slot));
      });
      Object.values(this._config.status || {}).forEach(add);
      return Array.from(ids);
    }

    /**
     * Retired reachable and inert by plan 07-17.
     *
     * It reached the Recorder straight from the browser with
     * `hass.callApi("GET", "history/period/...")`, so the project policy never
     * saw a history request and no export was audited (D5). It set
     * `_historyRange` even when nothing came back, presenting an empty map as a
     * populated window (D1), and requested `minimal_response`, which omits
     * attributes from every intermediate row (D2).
     *
     * History goes through the Companion's `history/*` routes now: declared in
     * both policy tables, bounded, enumeration-filtered and audited. After this
     * the browser issues no Recorder request of its own.
     */
    async _ensureHistory() {
      return undefined;
    }

    _openMoreInfo(entityId) {
      if (!entityId) return;
      fireEvent(this, "hass-more-info", { entityId });
    }

    _tapEntity(entityId) {
      if (!entityId || !this._hass) return;
      const domain = domainOf(entityId);
      if (["switch", "light", "fan", "input_boolean"].includes(domain)) {
        this._hass.callService(domain, "toggle", { entity_id: entityId });
        return;
      }
      if (["button", "input_button"].includes(domain)) {
        this._hass.callService(domain, "press", { entity_id: entityId });
        return;
      }
      this._openMoreInfo(entityId);
    }

    _medium(path) {
      const medium = MEDIUMS[path.medium] || MEDIUMS.neutral;
      return { ...medium, color: path.color || medium.color };
    }

    _pathD(points) {
      if (!points.length) return "";
      let d = `M ${points[0][0]} ${points[0][1]}`;
      for (let i = 1; i < points.length; i++) d += ` L ${points[i][0]} ${points[i][1]}`;
      return d;
    }

    _pathMidpoint(points) {
      if (!points.length) return { x: 0, y: 0 };
      if (points.length === 1) return { x: points[0][0], y: points[0][1] };
      const segments = [];
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i - 1][0];
        const dy = points[i][1] - points[i - 1][1];
        const length = Math.hypot(dx, dy);
        segments.push({ a: points[i - 1], b: points[i], length });
        total += length;
      }
      let remaining = total / 2;
      for (const segment of segments) {
        if (remaining <= segment.length) {
          const t = segment.length ? remaining / segment.length : 0;
          return {
            x: segment.a[0] + (segment.b[0] - segment.a[0]) * t,
            y: segment.a[1] + (segment.b[1] - segment.a[1]) * t
          };
        }
        remaining -= segment.length;
      }
      const last = points[points.length - 1];
      return { x: last[0], y: last[1] };
    }

    _renderPaths() {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "glt-pipes");
      svg.setAttribute("viewBox", `0 0 ${this._config.canvas.width} ${this._config.canvas.height}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.innerHTML = `
        <defs>
          <filter id="glt-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.8" flood-opacity="0.25"/>
          </filter>
        </defs>`;
      this._config.paths.filter((path) => this._visibleInView(path)).forEach((path) => {
        const points = this._pointsFor(path);
        if (points.length < 2) return;
        const active = path.flow ? this._isActive(path.flow) : path.active !== false;
        const medium = this._medium(path);
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("class", `glt-pipe-group ${active ? "is-active" : "is-idle"}`);

        const halo = document.createElementNS(SVG_NS, "path");
        halo.setAttribute("d", this._pathD(points));
        halo.setAttribute("class", "glt-pipe-halo");
        halo.setAttribute("stroke-width", String((path.width || 8) + 5));
        group.appendChild(halo);

        const line = document.createElementNS(SVG_NS, "path");
        line.setAttribute("d", this._pathD(points));
        line.setAttribute("class", `glt-pipe ${active && path.animate !== false ? "glt-pipe-animated" : ""}`);
        line.setAttribute("stroke", medium.color);
        line.setAttribute("stroke-width", String(path.width || 8));
        line.style.setProperty("--glt-flow-speed", `${path.speed || 1.3}s`);
        if (!active) line.style.opacity = String(path.idle_opacity ?? 0.28);
        group.appendChild(line);

        const labelField = path.temperature || path.value;
        if (labelField) {
          const mid = this._pathMidpoint(points);
          const foreign = document.createElementNS(SVG_NS, "foreignObject");
          foreign.setAttribute("x", String(mid.x - 58));
          foreign.setAttribute("y", String(mid.y - 17));
          foreign.setAttribute("width", "116");
          foreign.setAttribute("height", "34");
          const div = document.createElement("div");
          div.className = "glt-pipe-value";
          div.textContent = this._display(labelField);
          const entity = entityField(labelField)?.entity;
          if (entity) {
            div.dataset.entity = entity;
            div.addEventListener("click", (event) => {
              event.stopPropagation();
              this._openMoreInfo(entity);
            });
          }
          foreign.appendChild(div);
          group.appendChild(foreign);
        }
        svg.appendChild(group);
      });
      return svg;
    }

    _equipmentMarkup(item) {
      const active = item.state_entity ? this._isActive(item.state_entity) : item.entity ? this._isActive(item.entity) : item.active !== false;
      const icon = item.icon || symbolById(item.symbol, item.type).icon || EQUIPMENT_ICONS[item.type] || EQUIPMENT_ICONS.generic;
      const fields = (item.fields || []).map((field) => {
        const f = typeof field === "string" ? { entity: field } : field;
        const entity = entityField(f.entity || f)?.entity;
        return `<div class="glt-eq-row" ${entity ? `data-entity="${esc(entity)}"` : ""}>
          <span>${esc(f.label || f.name || entity || "Wert")}</span>
          <strong>${esc(this._display(f.entity || f))}</strong>
        </div>`;
      }).join("");
      const stateText = item.status ? this._display(item.status) : (active ? (item.active_text || "Aktiv") : (item.idle_text || "Bereit"));
      const image = item.image
        ? `<img class="glt-eq-image" src="${esc(item.image)}" alt="${esc(item.name || "Anlage")}">`
        : `<ha-icon class="glt-eq-icon" icon="${esc(icon)}"></ha-icon>`;
      return `
        <div class="glt-eq-head">
          <div class="glt-eq-symbol">${image}</div>
          <div class="glt-eq-title">
            <strong>${esc(item.name || item.id || "Anlage")}</strong>
            <span>${esc(item.subtitle || item.type || "")}</span>
          </div>
          <span class="glt-state ${active ? "active" : "idle"}"><i></i>${esc(stateText)}</span>
        </div>
        ${fields ? `<div class="glt-eq-fields">${fields}</div>` : ""}
      `;
    }

    _renderEquipment(canvas) {
      this._config.equipment.filter((item) => this._visibleInView(item)).forEach((item) => {
        const pos = this._positionFor(item);
        const node = document.createElement("div");
        node.className = `glt-equipment glt-type-${item.type || "generic"} glt-symbol-${item.symbol || item.type || "generic"}`;
        node.style.left = `${pos.x ?? 0}px`;
        node.style.top = `${pos.y ?? 0}px`;
        node.style.width = `${pos.width || item.width || 250}px`;
        const height = pos.height || item.height;
        node.style.height = typeof height === "number" ? `${height}px` : (height || "auto");
        node.innerHTML = this._equipmentMarkup(item);
        const entity = entityField(item.entity)?.entity;
        if (entity) {
          node.classList.add("is-clickable");
          node.addEventListener("click", (event) => {
            if (event.target.closest(".glt-eq-row")) return;
            event.stopPropagation();
            item.tap_action === "toggle" ? this._tapEntity(entity) : this._openMoreInfo(entity);
          });
        }
        node.querySelectorAll(".glt-eq-row[data-entity]").forEach((row) => {
          row.classList.add("is-clickable");
          row.addEventListener("click", (event) => {
            event.stopPropagation();
            this._openMoreInfo(row.dataset.entity);
          });
        });
        canvas.appendChild(node);

        (item.slots || []).forEach((slot) => {
          const slotNode = document.createElement("button");
          slotNode.type = "button";
          slotNode.className = "glt-value-slot";
          slotNode.style.left = `${(pos.x ?? 0) + (slot.x || 0)}px`;
          slotNode.style.top = `${(pos.y ?? 0) + (slot.y || 0)}px`;
          const entity = entityField(slot.entity || slot)?.entity;
          slotNode.innerHTML = `<small>${esc(slot.label || "")}</small><strong>${esc(this._display(slot.entity || slot))}</strong>`;
          if (entity) slotNode.addEventListener("click", (event) => { event.stopPropagation(); this._openMoreInfo(entity); });
          canvas.appendChild(slotNode);
        });
      });
    }

    _renderDatapoints(canvas) {
      this._config.datapoints.filter((point) => this._visibleInView(point)).forEach((point, index) => {
        const pos = this._positionFor(point);
        const field = point.entity || point;
        const entity = entityField(field)?.entity;
        const node = document.createElement("button");
        node.type = "button";
        node.className = `glt-datapoint glt-kind-${point.kind || "value"} ${this._trendSelected.has(point.id || entity || index) ? "is-selected" : ""}`;
        node.style.left = `${pos.x ?? 0}px`;
        node.style.top = `${pos.y ?? 0}px`;
        node.title = point.name || point.label || entity || "Datenpunkt";
        const icon = point.icon || (point.kind === "temperature" ? "mdi:thermometer" : point.kind === "pressure" ? "mdi:gauge" : "mdi:chart-timeline-variant");
        node.innerHTML = `
          <span class="glt-dp-icon"><ha-icon icon="${esc(icon)}"></ha-icon></span>
          <span class="glt-dp-text"><small>${esc(point.label || point.name || "")}</small><strong>${esc(this._display(field))}</strong></span>`;
        node.addEventListener("click", (event) => {
          event.stopPropagation();
          if (event.ctrlKey || event.metaKey || event.shiftKey || this._trendOpen) {
            this._toggleTrendPoint(point, index);
          } else if (entity) {
            this._openMoreInfo(entity);
          }
        });
        canvas.appendChild(node);
      });
    }

    _toggleTrendPoint(point, index) {
      const key = point.id || entityField(point.entity || point)?.entity || index;
      if (this._trendSelected.has(key)) this._trendSelected.delete(key);
      else if (this._trendSelected.size < this._config.trend.max_series) this._trendSelected.add(key);
      this._trendOpen = true;
      this._ensureHistory();
      this._queueRender();
    }

    _renderKpis() {
      if (!this._config.kpis.length) return "";
      return `<div class="glt-kpi-strip">${this._config.kpis.map((kpi) => {
        const field = kpi.entity || kpi;
        const value = this._number(field);
        let level = "normal";
        if (value !== null) {
          if (kpi.critical_above !== undefined && value >= kpi.critical_above) level = "critical";
          else if (kpi.warn_above !== undefined && value >= kpi.warn_above) level = "warning";
          else if (kpi.good_above !== undefined && value >= kpi.good_above) level = "good";
          if (kpi.critical_below !== undefined && value <= kpi.critical_below) level = "critical";
          else if (kpi.warn_below !== undefined && value <= kpi.warn_below) level = "warning";
          else if (kpi.good_below !== undefined && value <= kpi.good_below) level = "good";
        }
        return `<button type="button" class="glt-kpi ${level}" data-entity="${esc(entityField(field)?.entity || "")}">
          <ha-icon icon="${esc(kpi.icon || "mdi:gauge")}"></ha-icon>
          <span><small>${esc(kpi.name || kpi.label || "KPI")}</small><strong>${esc(this._display(field))}</strong></span>
        </button>`;
      }).join("")}</div>`;
    }

    _statusMarkup() {
      const status = this._config.status || {};
      const alarms = status.alarm ? this._isActive(status.alarm) : false;
      const online = status.online ? this._isActive(status.online) : true;
      return `<div class="glt-status-block">
        <span class="glt-status-pill ${online ? "ok" : "bad"}"><i></i>${online ? "Online" : "Offline"}</span>
        ${status.alarm ? `<span class="glt-status-pill ${alarms ? "bad" : "ok"}"><i></i>${alarms ? "Störung" : "Keine Störung"}</span>` : ""}
      </div>`;
    }

    _renderCanvas() {
      const view = this._currentView();
      const canvas = document.createElement("div");
      canvas.className = `glt-canvas glt-view-${view.kind || "schematic"}`;
      canvas.style.width = `${this._config.canvas.width}px`;
      canvas.style.height = `${this._config.canvas.height}px`;
      canvas.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
      canvas.style.transformOrigin = "0 0";
      canvas.style.backgroundSize = `${this._config.canvas.grid_size}px ${this._config.canvas.grid_size}px`;
      if (view.background) {
        canvas.style.backgroundImage = `${this._config.canvas.grid && view.grid !== false ? "var(--glt-grid)," : ""} url("${view.background}")`;
        canvas.style.backgroundSize = `${this._config.canvas.grid && view.grid !== false ? `${this._config.canvas.grid_size}px ${this._config.canvas.grid_size}px,` : ""} ${view.background_fit || "contain"}`;
        canvas.style.backgroundRepeat = `${this._config.canvas.grid && view.grid !== false ? "repeat," : ""} no-repeat`;
        canvas.style.backgroundPosition = `${this._config.canvas.grid && view.grid !== false ? "0 0," : ""} center`;
      } else if (!this._config.canvas.grid || view.grid === false) {
        canvas.classList.add("no-grid");
      }
      if (view.kind !== "image" || view.show_paths) canvas.appendChild(this._renderPaths());
      if (view.kind !== "image" || view.show_equipment) this._renderEquipment(canvas);
      this._renderDatapoints(canvas);
      return canvas;
    }

    _renderReplay() {
      if (!this._config.replay.enabled) return "";
      const range = this._historyRange || {
        start: Date.now() - this._config.replay.hours * 3600000,
        end: Date.now()
      };
      const time = this._replayTime ? new Date(this._replayTime).getTime() : range.end;
      const percent = clamp(((time - range.start) / Math.max(1, range.end - range.start)) * 100, 0, 100);
      return `<div class="glt-replay ${this._replayActive ? "active" : ""}">
        <button type="button" class="glt-icon-btn" data-action="replay-toggle" title="Replay-Modus"><ha-icon icon="mdi:history"></ha-icon></button>
        <button type="button" class="glt-icon-btn" data-action="replay-play" ${!this._replayActive ? "disabled" : ""} title="Abspielen"><ha-icon icon="${this._replayTimer ? "mdi:pause" : "mdi:play"}"></ha-icon></button>
        <div class="glt-timeline">
          <input type="range" min="0" max="1000" step="1" value="${Math.round(percent * 10)}" ${!this._replayActive ? "disabled" : ""} data-action="timeline">
          <div class="glt-time-labels"><span>${formatDateTime(range.start, this._locale())}</span><strong>${this._replayActive ? formatDateTime(time, this._locale()) : "LIVE"}</strong><span>${formatDateTime(range.end, this._locale())}</span></div>
        </div>
        ${this._historyLoading ? `<span class="glt-loading">Historie…</span>` : ""}
      </div>`;
    }

    _selectedTrendPoints() {
      return this._config.datapoints.map((point, index) => ({ point, index, key: point.id || entityField(point.entity || point)?.entity || index }))
        .filter((entry) => this._trendSelected.has(entry.key));
    }

    _seriesFor(point) {
      const field = entityField(point.entity || point);
      if (!field?.entity) return [];
      const series = this._history.get(field.entity) || [];
      return series.map((entry) => {
        const raw = field.attribute ? entry.attributes?.[field.attribute] : entry.state;
        let value = numeric(raw);
        if (value === null && point.binary) value = ON_STATES.has(String(raw).toLowerCase()) ? 1 : 0;
        return value === null ? null : {
          x: new Date(entry.last_updated || entry.last_changed).getTime(),
          y: value
        };
      }).filter(Boolean);
    }

    _renderTrendChart() {
      if (!this._trendOpen) return "";
      const selected = this._selectedTrendPoints();
      const selectable = this._config.datapoints.filter((point) => point.trend !== false && entityField(point.entity || point)?.entity);
      const width = 1000;
      const height = 240;
      const pad = { left: 54, right: 18, top: 18, bottom: 36 };
      let chart = `<div class="glt-trend-empty">Datenpunkte auswählen, um Trends gemeinsam darzustellen.</div>`;

      if (selected.length && this._historyRange) {
        const series = selected.map((entry, i) => ({ ...entry, values: this._seriesFor(entry.point), color: TREND_COLORS[i % TREND_COLORS.length] }));
        const all = series.flatMap((s) => s.values);
        if (all.length) {
          const xMin = this._historyRange.start;
          const xMax = this._historyRange.end;
          let yMin = Math.min(...all.map((p) => p.y));
          let yMax = Math.max(...all.map((p) => p.y));
          if (yMin === yMax) { yMin -= 1; yMax += 1; }
          const yPad = (yMax - yMin) * 0.08;
          yMin -= yPad;
          yMax += yPad;
          const sx = (x) => pad.left + ((x - xMin) / Math.max(1, xMax - xMin)) * (width - pad.left - pad.right);
          const sy = (y) => pad.top + (1 - (y - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
          const grid = Array.from({ length: 5 }, (_, i) => {
            const y = pad.top + i * ((height - pad.top - pad.bottom) / 4);
            const value = yMax - i * ((yMax - yMin) / 4);
            return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="glt-chart-grid"/><text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" class="glt-chart-label">${value.toFixed(1)}</text>`;
          }).join("");
          const lines = series.map((s) => {
            const points = s.values.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
            return `<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
          }).join("");
          const cursor = this._replayActive && this._replayTime
            ? `<line x1="${sx(new Date(this._replayTime).getTime())}" y1="${pad.top}" x2="${sx(new Date(this._replayTime).getTime())}" y2="${height - pad.bottom}" class="glt-chart-cursor"/>`
            : "";
          chart = `<svg class="glt-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${grid}${lines}${cursor}</svg>`;
        }
      }

      return `<section class="glt-trend-panel">
        <div class="glt-trend-head">
          <div><strong>Trenddiagramm</strong><span>Mehrfachauswahl · Recorder/History</span></div>
          <div class="glt-trend-actions">
            <button type="button" class="glt-text-btn" data-action="trend-all">Auswahl löschen</button>
            <button type="button" class="glt-icon-btn" data-action="trend-close"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
        </div>
        <div class="glt-trend-select">${selectable.map((point, index) => {
          const key = point.id || entityField(point.entity || point)?.entity || index;
          const checked = this._trendSelected.has(key);
          const colorIndex = selected.findIndex((entry) => entry.key === key);
          return `<label class="${checked ? "selected" : ""}"><input type="checkbox" data-trend-key="${esc(key)}" ${checked ? "checked" : ""}><i style="--series-color:${colorIndex >= 0 ? TREND_COLORS[colorIndex % TREND_COLORS.length] : "var(--secondary-text-color)"}"></i>${esc(point.label || point.name || entityField(point.entity || point)?.entity || "Wert")}</label>`;
        }).join("")}</div>
        <div class="glt-trend-chart" style="height:${this._config.trend.height}px">${this._historyLoading ? `<div class="glt-chart-loading">Historie wird geladen…</div>` : this._historyError ? `<div class="glt-chart-error">${esc(this._historyError)}</div>` : chart}</div>
      </section>`;
    }

    _render() {
      if (!this.shadowRoot) return;
      const view = this._currentView();
      this.shadowRoot.innerHTML = `<style>${CARD_STYLES}${APPEARANCE_STYLES}</style>
        <ha-card class="glt-card glt-style-${esc(this._styleMode || this._config.appearance?.mode || "neo2030")}">
          <header class="glt-header">
            <div class="glt-heading">
              <div class="glt-logo"><ha-icon icon="mdi:chart-sankey-variant"></ha-icon></div>
              <div><h2>${esc(this._config.title)}</h2><span>${esc(this._config.subtitle || "Gebäudeleittechnik · Live-Anlagenbild")}</span></div>
            </div>
            ${this._statusMarkup()}
          </header>
          ${this._renderKpis()}
          <div class="glt-toolbar">
            <div class="glt-view-switch">${this._config.views.map((item) => `<button type="button" data-view="${esc(item.id)}" class="${item.id === this._view ? "active" : ""}"><ha-icon icon="${esc(item.icon || (item.kind === "image" ? "mdi:image-outline" : "mdi:sitemap-outline"))}"></ha-icon>${esc(item.name || item.id)}</button>`).join("")}</div>
            <div class="glt-tool-actions">
              ${this._config.appearance?.show_switch !== false ? `<div class="glt-style-switch"><button type="button" data-style="neo2030" class="${(this._styleMode || this._config.appearance?.mode || "neo2030") === "neo2030" ? "active" : ""}">Neo 2030</button><button type="button" data-style="clean" class="${(this._styleMode || this._config.appearance?.mode) === "clean" ? "active" : ""}">Clean</button><button type="button" data-style="classic_scada" class="${(this._styleMode || this._config.appearance?.mode) === "classic_scada" ? "active" : ""}">Classic SCADA</button></div>` : ""}
              ${this._config.trend.enabled ? `<button type="button" class="glt-tool-btn ${this._trendOpen ? "active" : ""}" data-action="trend"><ha-icon icon="mdi:chart-line"></ha-icon>Trend</button>` : ""}
              ${this._config.zoom.controls ? `<button type="button" class="glt-icon-btn" data-action="zoom-out" title="Verkleinern"><ha-icon icon="mdi:magnify-minus-outline"></ha-icon></button><button type="button" class="glt-icon-btn" data-action="fit" title="Ansicht einpassen"><ha-icon icon="mdi:fit-to-screen-outline"></ha-icon></button><button type="button" class="glt-icon-btn" data-action="zoom-in" title="Vergrößern"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon></button>` : ""}
            </div>
          </div>
          <div class="glt-viewport" style="height:${this._config.canvas.viewport_height}px" data-kind="${esc(view.kind || "schematic")}"></div>
          ${this._renderReplay()}
          ${this._renderTrendChart()}
        </ha-card>`;

      const viewport = this.shadowRoot.querySelector(".glt-viewport");
      const canvas = this._renderCanvas();
      viewport.appendChild(canvas);
      this._bindEvents(viewport, canvas);

      this.shadowRoot.querySelectorAll(".glt-kpi[data-entity]").forEach((button) => {
        button.addEventListener("click", () => this._openMoreInfo(button.dataset.entity));
      });
      this.shadowRoot.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => {
          this._view = button.dataset.view;
          this._hasFit = false;
          this._queueRender();
          requestAnimationFrame(() => this._fitCanvas());
        });
      });
      this.shadowRoot.querySelectorAll("[data-style]").forEach((button) => {
        button.addEventListener("click", () => {
          this._styleMode = button.dataset.style || "neo2030";
          this._queueRender();
        });
      });
      this.shadowRoot.querySelector("[data-action='zoom-in']")?.addEventListener("click", () => this._zoomBy(1.2));
      this.shadowRoot.querySelector("[data-action='zoom-out']")?.addEventListener("click", () => this._zoomBy(1 / 1.2));
      this.shadowRoot.querySelector("[data-action='fit']")?.addEventListener("click", () => this._fitCanvas(true));
      this.shadowRoot.querySelector("[data-action='trend']")?.addEventListener("click", () => {
        this._trendOpen = !this._trendOpen;
        if (this._trendOpen) this._ensureHistory();
        this._queueRender();
      });
      this.shadowRoot.querySelector("[data-action='trend-close']")?.addEventListener("click", () => { this._trendOpen = false; this._queueRender(); });
      this.shadowRoot.querySelector("[data-action='trend-all']")?.addEventListener("click", () => { this._trendSelected.clear(); this._queueRender(); });
      this.shadowRoot.querySelectorAll("[data-trend-key]").forEach((input) => {
        input.addEventListener("change", () => {
          const key = input.dataset.trendKey;
          if (input.checked && this._trendSelected.size < this._config.trend.max_series) this._trendSelected.add(key);
          else this._trendSelected.delete(key);
          this._queueRender();
        });
      });
      this.shadowRoot.querySelector("[data-action='replay-toggle']")?.addEventListener("click", async () => {
        if (!this._replayActive) {
          await this._ensureHistory();
          this._replayActive = true;
          this._replayTime = new Date(this._historyRange?.end || Date.now());
        } else {
          this._replayActive = false;
          this._stopReplay();
        }
        this._queueRender();
      });
      this.shadowRoot.querySelector("[data-action='replay-play']")?.addEventListener("click", () => this._replayTimer ? this._stopReplay() : this._startReplay());
      this.shadowRoot.querySelector("[data-action='timeline']")?.addEventListener("input", (event) => {
        if (!this._historyRange) return;
        this._stopReplay();
        const ratio = Number(event.target.value) / 1000;
        this._replayTime = new Date(this._historyRange.start + ratio * (this._historyRange.end - this._historyRange.start));
        this._queueRender();
      });

      if (!this._hasFit) requestAnimationFrame(() => this._fitCanvas());
    }

    _bindEvents(viewport, canvas) {
      if (this._config.zoom.enabled && this._config.zoom.wheel) {
        viewport.addEventListener("wheel", (event) => {
          if (event.ctrlKey || Math.abs(event.deltaY) > 0) {
            event.preventDefault();
            const rect = viewport.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this._zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, x, y, canvas);
          }
        }, { passive: false });
      }

      viewport.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button, .glt-equipment, .glt-pipe-value")) return;
        viewport.setPointerCapture?.(event.pointerId);
        this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this._pointers.size === 1) {
          this._gesture = { mode: "pan", startX: event.clientX, startY: event.clientY, panX: this._pan.x, panY: this._pan.y };
        } else if (this._pointers.size === 2) {
          const [a, b] = Array.from(this._pointers.values());
          this._gesture = {
            mode: "pinch",
            distance: Math.hypot(b.x - a.x, b.y - a.y),
            zoom: this._zoom,
            panX: this._pan.x,
            panY: this._pan.y,
            midX: (a.x + b.x) / 2,
            midY: (a.y + b.y) / 2
          };
        }
      });
      viewport.addEventListener("pointermove", (event) => {
        if (!this._pointers.has(event.pointerId) || !this._gesture) return;
        this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this._gesture.mode === "pan" && this._pointers.size === 1) {
          this._pan.x = this._gesture.panX + (event.clientX - this._gesture.startX);
          this._pan.y = this._gesture.panY + (event.clientY - this._gesture.startY);
          this._applyTransform(canvas);
        } else if (this._pointers.size >= 2) {
          const [a, b] = Array.from(this._pointers.values());
          const distance = Math.hypot(b.x - a.x, b.y - a.y);
          const next = clamp(this._gesture.zoom * (distance / Math.max(1, this._gesture.distance)), this._config.zoom.min, this._config.zoom.max);
          this._zoom = next;
          this._applyTransform(canvas);
        }
      });
      const up = (event) => {
        this._pointers.delete(event.pointerId);
        if (!this._pointers.size) this._gesture = null;
      };
      viewport.addEventListener("pointerup", up);
      viewport.addEventListener("pointercancel", up);
      viewport.addEventListener("dblclick", () => this._fitCanvas(true));
    }

    _applyTransform(canvas = this.shadowRoot?.querySelector(".glt-canvas")) {
      if (!canvas) return;
      canvas.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
    }

    _fitCanvas(force = false) {
      const viewport = this.shadowRoot?.querySelector(".glt-viewport");
      const canvas = this.shadowRoot?.querySelector(".glt-canvas");
      if (!viewport || !canvas) return;
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) return;
      const fit = Math.min(width / this._config.canvas.width, height / this._config.canvas.height) * 0.96;
      this._fitScale = clamp(fit, this._config.zoom.min, this._config.zoom.max);
      if (!this._hasFit || force) {
        this._zoom = this._fitScale;
        this._pan.x = (width - this._config.canvas.width * this._zoom) / 2;
        this._pan.y = (height - this._config.canvas.height * this._zoom) / 2;
        this._hasFit = true;
        this._applyTransform(canvas);
      }
    }

    _zoomBy(factor) {
      const viewport = this.shadowRoot?.querySelector(".glt-viewport");
      const canvas = this.shadowRoot?.querySelector(".glt-canvas");
      if (!viewport || !canvas) return;
      this._zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2, canvas);
    }

    _zoomAt(factor, x, y, canvas) {
      const old = this._zoom;
      const next = clamp(old * factor, this._config.zoom.min, this._config.zoom.max);
      if (next === old) return;
      const worldX = (x - this._pan.x) / old;
      const worldY = (y - this._pan.y) / old;
      this._zoom = next;
      this._pan.x = x - worldX * next;
      this._pan.y = y - worldY * next;
      this._applyTransform(canvas);
    }

    _startReplay() {
      if (!this._replayActive || !this._historyRange) return;
      this._stopReplay();
      this._replayTimer = window.setInterval(() => {
        const step = (this._config.replay.step_minutes || 15) * 60000;
        const current = new Date(this._replayTime || this._historyRange.start).getTime();
        const next = current + step;
        if (next >= this._historyRange.end) {
          this._replayTime = new Date(this._historyRange.end);
          this._stopReplay();
        } else {
          this._replayTime = new Date(next);
        }
        this._queueRender();
      }, this._config.replay.autoplay_ms || 900);
      this._queueRender();
    }

    _stopReplay() {
      if (this._replayTimer) window.clearInterval(this._replayTimer);
      this._replayTimer = null;
    }
  }

  const CARD_STYLES = `
    :host {
      display:block;
      --glt-accent: var(--primary-color, #0f766e);
      --glt-accent-soft: color-mix(in srgb, var(--glt-accent) 13%, transparent);
      --glt-panel: color-mix(in srgb, var(--card-background-color, #fff) 92%, var(--primary-text-color, #111827) 8%);
      --glt-border: color-mix(in srgb, var(--divider-color, #d8dee6) 82%, transparent);
      --glt-shadow: 0 12px 34px rgba(15,23,42,.12);
      --glt-grid: linear-gradient(to right, color-mix(in srgb, var(--divider-color, #cbd5e1) 32%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--divider-color, #cbd5e1) 32%, transparent) 1px, transparent 1px);
    }
    * { box-sizing:border-box; }
    button, input { font:inherit; }
    ha-card.glt-card { overflow:hidden; border-radius:18px; }
    .glt-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 18px 10px; }
    .glt-heading { display:flex; align-items:center; gap:12px; min-width:0; }
    .glt-logo { width:42px; height:42px; border-radius:13px; background:linear-gradient(145deg, var(--glt-accent), color-mix(in srgb, var(--glt-accent) 55%, #0f172a)); color:#fff; display:grid; place-items:center; box-shadow:0 8px 18px color-mix(in srgb, var(--glt-accent) 25%, transparent); }
    .glt-logo ha-icon { --mdc-icon-size:24px; }
    .glt-heading h2 { margin:0; font-size:18px; line-height:1.2; color:var(--primary-text-color); }
    .glt-heading span { display:block; margin-top:3px; font-size:12px; color:var(--secondary-text-color); }
    .glt-status-block { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .glt-status-pill { display:flex; align-items:center; gap:7px; padding:6px 9px; border:1px solid var(--glt-border); border-radius:999px; font-size:11px; font-weight:650; color:var(--secondary-text-color); background:var(--card-background-color); }
    .glt-status-pill i { width:8px; height:8px; border-radius:50%; background:#94a3b8; box-shadow:0 0 0 3px rgba(148,163,184,.13); }
    .glt-status-pill.ok i { background:#22c55e; box-shadow:0 0 0 3px rgba(34,197,94,.13); }
    .glt-status-pill.bad { color:#dc2626; }
    .glt-status-pill.bad i { background:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,.13); }
    .glt-kpi-strip { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; padding:0 18px 12px; }
    .glt-kpi { display:flex; align-items:center; gap:10px; min-width:0; padding:10px 12px; border:1px solid var(--glt-border); border-radius:13px; background:var(--glt-panel); color:var(--primary-text-color); text-align:left; cursor:pointer; transition:.18s ease; }
    .glt-kpi:hover { transform:translateY(-1px); box-shadow:0 5px 16px rgba(15,23,42,.08); }
    .glt-kpi ha-icon { color:var(--glt-accent); --mdc-icon-size:21px; }
    .glt-kpi span { min-width:0; }
    .glt-kpi small { display:block; color:var(--secondary-text-color); font-size:10px; text-transform:uppercase; letter-spacing:.45px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .glt-kpi strong { display:block; margin-top:2px; font-size:15px; font-variant-numeric:tabular-nums; }
    .glt-kpi.good { border-color:rgba(34,197,94,.34); }
    .glt-kpi.warning { border-color:rgba(245,158,11,.46); }
    .glt-kpi.critical { border-color:rgba(239,68,68,.52); }
    .glt-toolbar { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 12px; border-top:1px solid var(--glt-border); border-bottom:1px solid var(--glt-border); background:color-mix(in srgb, var(--card-background-color) 95%, var(--primary-text-color) 5%); }
    .glt-view-switch, .glt-tool-actions { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
    .glt-view-switch button, .glt-tool-btn, .glt-icon-btn, .glt-text-btn { border:1px solid transparent; background:transparent; color:var(--secondary-text-color); cursor:pointer; transition:.16s ease; }
    .glt-view-switch button, .glt-tool-btn { display:flex; align-items:center; gap:6px; padding:7px 10px; border-radius:9px; font-size:12px; font-weight:650; }
    .glt-view-switch button:hover, .glt-tool-btn:hover, .glt-icon-btn:hover { background:var(--glt-accent-soft); color:var(--glt-accent); }
    .glt-view-switch button.active, .glt-tool-btn.active { color:var(--glt-accent); background:var(--glt-accent-soft); border-color:color-mix(in srgb, var(--glt-accent) 25%, transparent); }
    .glt-view-switch ha-icon, .glt-tool-btn ha-icon { --mdc-icon-size:17px; }
    .glt-icon-btn { width:34px; height:34px; display:grid; place-items:center; border-radius:9px; }
    .glt-icon-btn ha-icon { --mdc-icon-size:19px; }
    .glt-icon-btn:disabled { opacity:.34; cursor:default; }
    .glt-viewport { position:relative; overflow:hidden; background:color-mix(in srgb, var(--card-background-color) 92%, #64748b 8%); touch-action:none; cursor:grab; }
    .glt-viewport:active { cursor:grabbing; }
    .glt-canvas { position:absolute; left:0; top:0; background-color:color-mix(in srgb, var(--card-background-color) 97%, #94a3b8 3%); background-image:var(--glt-grid); background-size:40px 40px; box-shadow:0 0 0 1px var(--glt-border), var(--glt-shadow); overflow:hidden; }
    .glt-canvas.no-grid { background-image:none; }
    .glt-view-image { background-color:#111827; }
    .glt-pipes { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }
    .glt-pipe-halo { fill:none; stroke:color-mix(in srgb, var(--card-background-color, #fff) 85%, #0f172a 15%); stroke-linecap:round; stroke-linejoin:round; opacity:.96; }
    .glt-pipe { fill:none; stroke-linecap:round; stroke-linejoin:round; filter:url(#glt-shadow); }
    .glt-pipe-animated { stroke-dasharray:15 12; animation:glt-flow var(--glt-flow-speed,1.3s) linear infinite; }
    .glt-pipe-value { width:max-content; min-width:66px; margin:auto; padding:5px 8px; border:1px solid rgba(148,163,184,.42); border-radius:9px; background:color-mix(in srgb, var(--card-background-color, #fff) 90%, transparent); color:var(--primary-text-color,#111827); box-shadow:0 4px 12px rgba(15,23,42,.12); font-size:11px; font-weight:750; text-align:center; font-variant-numeric:tabular-nums; pointer-events:auto; cursor:pointer; backdrop-filter:blur(6px); }
    @keyframes glt-flow { to { stroke-dashoffset:-27; } }
    .glt-equipment { position:absolute; padding:12px; border:1px solid var(--glt-border); border-radius:14px; background:color-mix(in srgb, var(--card-background-color, #fff) 92%, transparent); box-shadow:0 10px 22px rgba(15,23,42,.12); color:var(--primary-text-color); backdrop-filter:blur(10px); overflow:hidden; }
    .glt-equipment.is-clickable { cursor:pointer; }
    .glt-equipment:hover { border-color:color-mix(in srgb, var(--glt-accent) 42%, var(--glt-border)); }
    .glt-eq-head { display:flex; align-items:center; gap:10px; }
    .glt-eq-symbol { width:42px; height:42px; flex:0 0 42px; display:grid; place-items:center; border-radius:12px; background:var(--glt-accent-soft); color:var(--glt-accent); overflow:hidden; }
    .glt-eq-icon { --mdc-icon-size:24px; }
    .glt-eq-image { width:100%; height:100%; object-fit:contain; }
    .glt-eq-title { min-width:0; flex:1; }
    .glt-eq-title strong { display:block; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .glt-eq-title span { display:block; margin-top:2px; color:var(--secondary-text-color); font-size:10px; text-transform:uppercase; letter-spacing:.35px; }
    .glt-state { display:flex; align-items:center; gap:5px; padding:4px 7px; border:1px solid var(--glt-border); border-radius:999px; font-size:9px; color:var(--secondary-text-color); white-space:nowrap; }
    .glt-state i { width:6px; height:6px; border-radius:50%; background:#94a3b8; }
    .glt-state.active { color:#15803d; border-color:rgba(34,197,94,.25); background:rgba(34,197,94,.08); }
    .glt-state.active i { background:#22c55e; }
    .glt-eq-fields { margin-top:10px; display:grid; gap:4px; }
    .glt-eq-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:5px 6px; border-radius:7px; font-size:10px; color:var(--secondary-text-color); }
    .glt-eq-row strong { color:var(--primary-text-color); font-size:11px; font-variant-numeric:tabular-nums; }
    .glt-eq-row.is-clickable { cursor:pointer; }
    .glt-eq-row.is-clickable:hover { background:var(--glt-accent-soft); }
    .glt-value-slot, .glt-datapoint { position:absolute; transform:translate(-50%,-50%); z-index:4; border:1px solid var(--glt-border); background:color-mix(in srgb,var(--card-background-color,#fff) 90%,transparent); color:var(--primary-text-color); box-shadow:0 6px 18px rgba(15,23,42,.14); backdrop-filter:blur(8px); cursor:pointer; }
    .glt-value-slot { min-width:88px; padding:7px 9px; border-radius:10px; }
    .glt-value-slot small, .glt-value-slot strong { display:block; }
    .glt-value-slot small { color:var(--secondary-text-color); font-size:9px; }
    .glt-value-slot strong { margin-top:2px; font-size:12px; }
    .glt-datapoint { display:flex; align-items:center; gap:7px; min-width:102px; padding:7px 9px; border-radius:11px; text-align:left; }
    .glt-datapoint:hover, .glt-datapoint.is-selected { border-color:color-mix(in srgb, var(--glt-accent) 50%, transparent); background:color-mix(in srgb,var(--card-background-color,#fff) 87%,var(--glt-accent) 13%); }
    .glt-dp-icon { width:26px; height:26px; flex:0 0 26px; display:grid; place-items:center; border-radius:8px; color:var(--glt-accent); background:var(--glt-accent-soft); }
    .glt-dp-icon ha-icon { --mdc-icon-size:17px; }
    .glt-dp-text { min-width:0; }
    .glt-dp-text small { display:block; max-width:95px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--secondary-text-color); font-size:9px; }
    .glt-dp-text strong { display:block; margin-top:1px; font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .glt-replay { display:flex; align-items:center; gap:8px; padding:9px 12px; border-top:1px solid var(--glt-border); background:color-mix(in srgb,var(--card-background-color) 96%,var(--primary-text-color) 4%); }
    .glt-replay.active { background:color-mix(in srgb,var(--card-background-color) 92%,var(--glt-accent) 8%); }
    .glt-timeline { flex:1; min-width:140px; }
    .glt-timeline input { width:100%; accent-color:var(--glt-accent); }
    .glt-time-labels { display:flex; justify-content:space-between; gap:8px; margin-top:2px; color:var(--secondary-text-color); font-size:9px; }
    .glt-time-labels strong { color:var(--glt-accent); font-size:10px; }
    .glt-loading { font-size:10px; color:var(--secondary-text-color); }
    .glt-trend-panel { border-top:1px solid var(--glt-border); padding:12px 14px 15px; }
    .glt-trend-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
    .glt-trend-head strong { display:block; font-size:14px; }
    .glt-trend-head span { display:block; margin-top:2px; font-size:10px; color:var(--secondary-text-color); }
    .glt-trend-actions { display:flex; align-items:center; gap:4px; }
    .glt-text-btn { padding:6px 8px; border-radius:8px; font-size:10px; }
    .glt-trend-select { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:10px; }
    .glt-trend-select label { display:flex; align-items:center; gap:5px; padding:5px 8px; border:1px solid var(--glt-border); border-radius:999px; color:var(--secondary-text-color); font-size:10px; cursor:pointer; }
    .glt-trend-select label.selected { color:var(--primary-text-color); background:var(--glt-panel); }
    .glt-trend-select input { display:none; }
    .glt-trend-select i { width:8px; height:8px; border-radius:50%; background:var(--series-color); }
    .glt-trend-chart { position:relative; border:1px solid var(--glt-border); border-radius:12px; overflow:hidden; background:color-mix(in srgb,var(--card-background-color) 97%,#64748b 3%); }
    .glt-chart { width:100%; height:100%; }
    .glt-chart-grid { stroke:color-mix(in srgb,var(--divider-color,#cbd5e1) 65%,transparent); stroke-width:1; }
    .glt-chart-label { fill:var(--secondary-text-color,#64748b); font-size:10px; }
    .glt-chart-cursor { stroke:var(--glt-accent); stroke-width:1.5; stroke-dasharray:5 4; }
    .glt-trend-empty, .glt-chart-loading, .glt-chart-error { height:100%; display:grid; place-items:center; color:var(--secondary-text-color); font-size:11px; text-align:center; padding:20px; }
    .glt-chart-error { color:#dc2626; }
    @media (max-width:700px) {
      .glt-header { align-items:flex-start; }
      .glt-status-block { display:none; }
      .glt-kpi-strip { grid-template-columns:repeat(2,minmax(0,1fr)); padding-inline:10px; }
      .glt-toolbar { align-items:flex-start; }
      .glt-replay { flex-wrap:wrap; }
      .glt-timeline { flex-basis:calc(100% - 90px); }
      .glt-time-labels > span { display:none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .glt-pipe-animated { animation:none; stroke-dasharray:none; }
      * { scroll-behavior:auto !important; transition:none !important; }
    }
  `;

  const APPEARANCE_STYLES = `
    .glt-style-switch{display:flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--glt-border);border-radius:11px;background:color-mix(in srgb,var(--card-background-color) 88%,transparent)}
    .glt-style-switch button{border:0;background:transparent;color:var(--secondary-text-color);padding:6px 9px;border-radius:8px;font-size:10px;font-weight:750;cursor:pointer}
    .glt-style-switch button.active{background:var(--glt-accent-soft);color:var(--glt-accent)}
    ha-card.glt-style-neo2030{--card-background-color:#07111f;--primary-text-color:#f8fafc;--secondary-text-color:#93a4b8;--divider-color:#203247;--glt-accent:#20a4ff;--glt-accent-soft:rgba(32,164,255,.12);background:radial-gradient(circle at 50% -20%,#12304a 0,#07111f 34%,#050b14 100%);color:#f8fafc;border:1px solid #1b2b3f;box-shadow:0 24px 60px rgba(2,8,23,.34)}
    .glt-style-neo2030 .glt-header{background:linear-gradient(180deg,rgba(13,31,49,.84),rgba(7,17,31,.36))}
    .glt-style-neo2030 .glt-toolbar,.glt-style-neo2030 .glt-replay,.glt-style-neo2030 .glt-trend-panel{background:rgba(5,14,27,.72);backdrop-filter:blur(16px)}
    .glt-style-neo2030 .glt-viewport{background:radial-gradient(circle at 50% 15%,#102941 0,#07121f 55%,#050b13 100%)}
    .glt-style-neo2030 .glt-canvas{background-color:#081522;background-image:radial-gradient(circle at 1px 1px,rgba(148,163,184,.16) 1px,transparent 0);background-size:24px 24px;box-shadow:inset 0 0 70px rgba(0,0,0,.22),0 0 0 1px #183047}
    .glt-style-neo2030 .glt-equipment{border-color:#26394d;background:linear-gradient(145deg,rgba(19,35,51,.94),rgba(8,18,31,.92));box-shadow:0 16px 36px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.04);backdrop-filter:blur(18px)}
    .glt-style-neo2030 .glt-eq-symbol{background:linear-gradient(145deg,rgba(41,67,88,.9),rgba(10,24,38,.95));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 7px 20px rgba(0,0,0,.25)}
    .glt-style-neo2030 .glt-type-tank .glt-eq-symbol,.glt-style-neo2030 .glt-symbol-buffer_layered .glt-eq-symbol{background:linear-gradient(180deg,rgba(239,68,68,.28),rgba(59,130,246,.28))}
    .glt-style-neo2030 .glt-pipe{filter:drop-shadow(0 0 4px currentColor)}
    .glt-style-neo2030 .glt-pipe-value,.glt-style-neo2030 .glt-datapoint,.glt-style-neo2030 .glt-value-slot{background:rgba(8,19,32,.86);border-color:#29415a;box-shadow:0 8px 22px rgba(0,0,0,.25)}
    .glt-style-neo2030 .glt-kpi{background:linear-gradient(145deg,rgba(16,34,50,.9),rgba(8,18,31,.85));border-color:#25394d;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
    ha-card.glt-style-clean{--glt-accent:var(--primary-color,#0f766e)}
    ha-card.glt-style-classic_scada{--card-background-color:#c5c7c9;--primary-text-color:#101010;--secondary-text-color:#323232;--divider-color:#7b7f82;--glt-accent:#0b6f28;--glt-accent-soft:rgba(0,128,38,.14);background:#bfc1c2;color:#101010;border:2px solid #4b4f51;border-radius:2px!important;font-family:Arial,Helvetica,sans-serif}
    .glt-style-classic_scada .glt-header,.glt-style-classic_scada .glt-toolbar,.glt-style-classic_scada .glt-replay,.glt-style-classic_scada .glt-trend-panel{background:#b6b8ba;border-color:#666;border-radius:0}
    .glt-style-classic_scada .glt-viewport,.glt-style-classic_scada .glt-canvas{background:#9ea0a2;background-image:none;box-shadow:none}
    .glt-style-classic_scada .glt-equipment,.glt-style-classic_scada .glt-kpi,.glt-style-classic_scada .glt-datapoint,.glt-style-classic_scada .glt-value-slot{border-radius:2px;background:#d5d6d7;border:1px solid #555;box-shadow:none;backdrop-filter:none}
    .glt-style-classic_scada .glt-eq-symbol{border-radius:0;background:#bcbec0;border:1px solid #666}
    .glt-style-classic_scada .glt-pipe-halo{stroke:#777;opacity:.55}.glt-style-classic_scada .glt-pipe{filter:none;stroke-linecap:butt;stroke-linejoin:miter}
    .glt-style-classic_scada .glt-style-switch{border-radius:2px;background:#c9cbcc}.glt-style-classic_scada .glt-style-switch button{border-radius:0}
  `;

  function yamlScalar(value){
    if(value===null||value===undefined)return "null";
    if(typeof value==="number"||typeof value==="boolean")return String(value);
    const s=String(value);
    if(!s.length)return '""';
    if(/^[A-Za-z0-9_./:@+%-]+$/.test(s)&&!["true","false","null","yes","no","on","off"].includes(s.toLowerCase()))return s;
    return JSON.stringify(s);
  }
  function yamlLines(value,indent=0){
    const pad=" ".repeat(indent);
    if(Array.isArray(value)){
      if(!value.length)return [`${pad}[]`];
      const out=[];
      value.forEach(item=>{
        if(item&&typeof item==="object"){
          if(Array.isArray(item)&&item.every(v=>typeof v!=="object"))out.push(`${pad}- [${item.map(yamlScalar).join(", ")}]`);
          else{out.push(`${pad}-`);out.push(...yamlLines(item,indent+2));}
        }else out.push(`${pad}- ${yamlScalar(item)}`);
      });
      return out;
    }
    if(value&&typeof value==="object"){
      const keys=Object.keys(value).filter(k=>value[k]!==undefined);
      if(!keys.length)return [`${pad}{}`];
      const out=[];
      keys.forEach(key=>{
        const v=value[key];
        if(v&&typeof v==="object"){
          if(Array.isArray(v)&&v.every(x=>typeof x!=="object"))out.push(`${pad}${key}: [${v.map(yamlScalar).join(", ")}]`);
          else{out.push(`${pad}${key}:`);out.push(...yamlLines(v,indent+2));}
        }else out.push(`${pad}${key}: ${yamlScalar(v)}`);
      });
      return out;
    }
    return [`${pad}${yamlScalar(value)}`];
  }
  function configToYaml(config){
    const copy=deepClone(config||{});
    delete copy.type;
    return [`type: custom:glt-flow-card`,...yamlLines(copy,0)].join("\n");
  }

  const EDITOR_STYLES = `
:host{display:block;--e:#20a4ff;--eb:rgba(32,164,255,.12);--b:#203247;--bg:#07111f;--panel:#0a1726;--panel2:#0d1d2e;--tx:#eef6ff;--mut:#90a3b8}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit}.de{overflow:hidden;border:1px solid var(--b);border-radius:18px;background:radial-gradient(circle at 50% -15%,#102a43 0,#07111f 34%,#050b14 100%);color:var(--tx);box-shadow:0 20px 50px #02061755}.dt{height:62px;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--b);background:#07111fe6;backdrop-filter:blur(16px)}.brand{display:flex;align-items:center;gap:10px}.brand i{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,#20a4ff,#075985);color:#fff;box-shadow:0 8px 20px #0284c733}.brand b{display:block;font-size:14px}.brand small{display:block;color:var(--mut);font-size:10px;margin-top:2px}.tools,.views{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.tb,.tab,.mini,.act,.seg button{border:0;background:transparent;cursor:pointer;border-radius:9px}.tb{height:34px;padding:0 9px;font-size:10px;font-weight:700;color:var(--mut)}.tb:hover,.tb.on,.mini:hover,.tab.on{background:var(--eb);color:var(--e)}.tb:disabled{opacity:.3}.mini{width:31px;height:31px;display:grid;place-items:center}.seg{display:flex;gap:2px;padding:2px;border:1px solid var(--b);border-radius:11px;background:#07111f}.seg button{padding:7px 10px;color:var(--mut);font-size:9px;font-weight:800}.seg button.on{background:var(--eb);color:#66c5ff}.work{display:grid;grid-template-columns:230px minmax(420px,1fr) 310px;min-height:690px}.left{border-right:1px solid var(--b);background:#081522dd}.right{border-left:1px solid var(--b);background:#081522e8}.ph{height:42px;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--b);font-size:9px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.6px}.search{margin:8px}.search input{width:100%;height:35px;border:1px solid var(--b);border-radius:9px;padding:0 10px;background:#07111f;font-size:10px;outline:none}.search input:focus{border-color:#20a4ff}.pal{padding:0 8px 12px;max-height:640px;overflow:auto}.grp{margin:12px 3px 6px;color:#6f86a0;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.5px}.pg{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pi{min-height:64px;padding:7px;border:1px solid #1f3246;border-radius:11px;background:linear-gradient(145deg,#0d1d2e,#091522);cursor:grab;user-select:none;display:flex;flex-direction:column;gap:5px;justify-content:center;font-size:9px;font-weight:750}.pi:hover{border-color:#2c79aa;box-shadow:0 7px 18px #02061744;transform:translateY(-1px)}.pi span:first-child{width:29px;height:29px;border-radius:8px;display:grid;place-items:center;background:var(--eb);color:var(--e)}.center{min-width:0;display:flex;flex-direction:column;background:#06101c}.vb{height:43px;display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#081522;border-bottom:1px solid var(--b)}.tab{height:31px;padding:0 10px;font-size:9px;font-weight:750;color:var(--mut)}.stage{position:relative;flex:1;overflow:auto;padding:20px;background:radial-gradient(circle at 1px 1px,#2b405566 1px,transparent 0);background-size:19px 19px}.stage.over{background-color:#0c2740}.cw{position:relative;margin:auto}.canvas{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;border:1px solid #1e3349;background-color:#081522;background-image:radial-gradient(circle at 1px 1px,#334b6455 1px,transparent 0);background-size:22px 22px;box-shadow:inset 0 0 70px #02061755,0 18px 40px #02061766}.canvas.nogrid{background-image:none}.paths{position:absolute;inset:0;width:100%;height:100%}.phalo{fill:none;stroke:#0b1724;stroke-linecap:round;stroke-linejoin:round}.path{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:14 10;animation:flow 1.15s linear infinite;cursor:pointer;pointer-events:stroke;filter:drop-shadow(0 0 4px currentColor)}.handle{fill:#0a1726;stroke:#61c6ff;stroke-width:3;cursor:move}@keyframes flow{to{stroke-dashoffset:-24}}.node{position:absolute;padding:10px;border:1px solid #263c53;border-radius:13px;background:linear-gradient(145deg,#102235ee,#081522ee);box-shadow:0 12px 28px #02061766,inset 0 1px 0 #ffffff0d;cursor:move;user-select:none}.node.sel,.dp.sel{outline:2px solid #20a4ff;outline-offset:3px}.nh{display:flex;align-items:center;gap:8px}.ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#263c50,#0b1b2a);color:#5ec4ff;overflow:hidden;box-shadow:inset 0 1px 0 #ffffff1a}.ic img{width:100%;height:100%;object-fit:cover}.nt{min-width:0;flex:1}.nt b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nt small{display:block;margin-top:2px;color:var(--mut);font-size:8px}.rows{margin-top:7px}.row{display:flex;justify-content:space-between;font-size:8px;padding:2px 3px;color:var(--mut)}.row b{color:#f8fafc}.rs{position:absolute;right:-7px;bottom:-7px;width:14px;height:14px;border-radius:4px;background:#20a4ff;border:2px solid #dff5ff;cursor:nwse-resize}.dp{position:absolute;transform:translate(-50%,-50%);min-width:104px;display:flex;gap:6px;align-items:center;padding:6px 8px;border:1px solid #284057;border-radius:10px;background:#081522ee;box-shadow:0 7px 18px #02061755;cursor:move;user-select:none}.dp small,.dp b{display:block;white-space:nowrap}.dp small{font-size:7px;color:var(--mut)}.dp b{font-size:9px}.insp{padding:10px;max-height:650px;overflow:auto}.sec{margin-bottom:15px}.st{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;font-size:8px;font-weight:850;color:#71879e;text-transform:uppercase}.chip{padding:3px 6px;border-radius:999px;background:var(--eb);color:#5fc4ff;font-size:8px}.f{display:grid;gap:4px;margin-bottom:8px}.f label{font-size:8px;color:var(--mut);font-weight:750}.f input,.f select,.f ha-entity-picker{min-height:33px;border-radius:8px;font-size:9px}.f input,.f select{border:1px solid var(--b);background:#07111f;padding:0 8px;outline:none}.f input:focus,.f select:focus{border-color:#20a4ff}.g2{display:grid;grid-template-columns:1fr 1fr;gap:7px}.help{padding:9px;border:1px solid #1f3950;border-radius:9px;background:#0b2135;font-size:8px;line-height:1.5;color:#91a6ba}.acts{display:flex;gap:5px;flex-wrap:wrap}.act{height:30px;padding:0 9px;border:1px solid var(--b);background:#0a1726;font-size:8px;font-weight:750;color:var(--mut)}.act:hover{color:#6dccff;border-color:#2878a8}.bottom{height:34px;display:flex;align-items:center;justify-content:space-between;padding:5px 10px;border-top:1px solid var(--b);font-size:8px;color:var(--mut);background:#07111f}.drawer{border-top:1px solid var(--b);background:#050d17;max-height:320px;overflow:auto}.drawer-head{height:38px;display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--b)}.drawer-head b{font-size:10px}.yaml{margin:0;padding:12px 14px;white-space:pre;overflow:auto;font:10px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#a9d8ff}.preview{padding:8px;min-height:580px}.preview glt-flow-card{display:block}.entity-stat{font-size:8px;color:#67e8f9}.notice{padding:6px 9px;border:1px solid #1c425f;border-radius:8px;background:#0b2a40;color:#8ed7ff;font-size:8px}@media(max-width:1100px){.work{grid-template-columns:205px 1fr}.right{grid-column:1/-1;border-left:0;border-top:1px solid var(--b)}.insp{max-height:none}}`;

  class GltFlowCardEditor extends HTMLElement{
    constructor(){super();this.attachShadow({mode:"open"});this._config=normalizeConfig({});this._hass=null;this._viewId="schematic";this._sel=null;this._zoom=.62;this._snap=true;this._grid=true;this._undoS=[];this._redoS=[];this._drag=null;this._search="";this._preview=false;this._yamlOpen=false;this._copied=false;this._keys=e=>this._key(e)}
    setConfig(c){this._config=normalizeConfig(c||{});if(!this._config.views.some(v=>v.id===this._viewId))this._viewId=this._config.default_view||this._config.views[0].id;this._grid=this._config.canvas.grid!==false;this._render()}
    set hass(h){this._hass=h;this._wireEntityPickers();this._live()}
    connectedCallback(){window.addEventListener("keydown",this._keys);this._render()}
    disconnectedCallback(){window.removeEventListener("keydown",this._keys)}
    _emit(){fireEvent(this,"config-changed",{config:deepClone(this._config)})}
    _remember(){let s=JSON.stringify(this._config);if(this._undoS.at(-1)!==s)this._undoS.push(s);if(this._undoS.length>80)this._undoS.shift();this._redoS=[]}
    _undo(){if(!this._undoS.length)return;this._redoS.push(JSON.stringify(this._config));this._config=normalizeConfig(JSON.parse(this._undoS.pop()));this._sel=null;this._emit();this._render()}
    _redo(){if(!this._redoS.length)return;this._undoS.push(JSON.stringify(this._config));this._config=normalizeConfig(JSON.parse(this._redoS.pop()));this._sel=null;this._emit();this._render()}
    _view(){return this._config.views.find(v=>v.id===this._viewId)||this._config.views[0]}
    _obj(){if(!this._sel)return null;let a=this._sel.k==="equipment"?this._config.equipment:this._sel.k==="datapoint"?this._config.datapoints:this._sel.k==="path"?this._config.paths:this._config.kpis;return a.find(x=>x.id===this._sel.id)||null}
    _id(p){let s=new Set([...this._config.equipment,...this._config.datapoints,...this._config.paths,...this._config.kpis].map(x=>x.id));let i=1,id=`${p}_${i}`;while(s.has(id))id=`${p}_${++i}`;return id}
    _sv(v){let g=Math.max(10,(+this._config.canvas.grid_size||40)/2);return this._snap?Math.round(v/g)*g:Math.round(v)}
    _val(f){f=entityField(f);let s=f?.entity&&this._hass?.states?.[f.entity];if(!s)return"–";let r=f.attribute?s.attributes?.[f.attribute]:s.state,n=numeric(r),u=f.unit??s.attributes?.unit_of_measurement??"";return n!==null?`${n.toFixed(f.decimals??(Math.abs(n)<100?1:0))}${u?` ${u}`:""}`:String(r??"–")}
    _pos(o){return o.positions?.[this._viewId]||o}
    _items(){let e=SYMBOL_LIBRARY.map(s=>({g:s.category,k:'equipment',t:s.type,s:s.id,n:s.label,i:s.icon}));e.push({g:'Daten & KPI',k:'datapoint',t:'temperature',n:'Temperatur',i:'mdi:thermometer'},{g:'Daten & KPI',k:'datapoint',t:'pressure',n:'Druck',i:'mdi:gauge'},{g:'Daten & KPI',k:'datapoint',t:'flow',n:'Volumenstrom',i:'mdi:waves-arrow-right'},{g:'Daten & KPI',k:'datapoint',t:'value',n:'Datenpunkt',i:'mdi:chart-timeline-variant'},{g:'Daten & KPI',k:'kpi',t:'kpi',n:'KPI / Kennzahl',i:'mdi:view-dashboard-outline'});Object.entries(MEDIUMS).forEach(([t,m])=>e.push({g:'Leitungen',k:'path',t,n:m.label,i:'mdi:vector-polyline',c:m.color}));let q=this._search.toLowerCase();return e.filter(x=>!q||`${x.n} ${x.t} ${x.s||''} ${x.g}`.toLowerCase().includes(q))}
    _palette(){let groups=[...new Set(this._items().map(x=>x.g))];return groups.map(g=>{let a=this._items().filter(x=>x.g===g);return a.length?`<div class="grp">${esc(g)}</div><div class="pg">${a.map(x=>`<div class="pi" draggable="true" data-pk="${x.k}" data-pt="${x.t}" data-ps="${x.s||''}" style="${x.c?`--e:${x.c}`:''}"><span><ha-icon icon="${x.i}"></ha-icon></span><span>${esc(x.n)}</span></div>`).join('')}</div>`:''}).join('')}
    _node(o){let p=this._pos(o),sel=this._sel?.k==='equipment'&&this._sel.id===o.id,w=p.width||o.width||230,h=p.height||o.height||130,sd=symbolById(o.symbol,o.type),icon=o.image?`<img src="${esc(o.image)}">`:`<ha-icon icon="${esc(o.icon||sd.icon||EQUIPMENT_ICONS[o.type]||EQUIPMENT_ICONS.generic)}"></ha-icon>`,rows=(o.fields||[]).slice(0,2).map(f=>`<div class="row"><span>${esc(f.label||'Wert')}</span><b data-live="${esc(entityField(f.entity||f)?.entity||'')}">${esc(this._val(f.entity||f))}</b></div>`).join('');return`<div class="node ${sel?'sel':''}" data-k="equipment" data-id="${esc(o.id)}" style="left:${p.x||0}px;top:${p.y||0}px;width:${w}px;height:${h}px"><div class="nh"><span class="ic">${icon}</span><span class="nt"><b>${esc(o.name||sd.label||o.id)}</b><small>${esc(o.subtitle||sd.label||o.type||'Bauteil')}</small></span></div>${rows?`<div class="rows">${rows}</div>`:''}${sel?'<span class="rs" data-rs></span>':''}</div>`}
    _dp(o){let p=o.positions?.[this._viewId]||o,sel=this._sel?.k==='datapoint'&&this._sel.id===o.id,f=o.entity||o,ic=o.kind==='temperature'?'mdi:thermometer':o.kind==='pressure'?'mdi:gauge':o.kind==='flow'?'mdi:waves-arrow-right':'mdi:chart-timeline-variant';return`<div class="dp ${sel?'sel':''}" data-k="datapoint" data-id="${esc(o.id)}" style="left:${p.x||0}px;top:${p.y||0}px"><span class="ic"><ha-icon icon="${ic}"></ha-icon></span><span><small>${esc(o.label||'Datenpunkt')}</small><b data-live="${esc(entityField(f)?.entity||'')}">${esc(this._val(f))}</b></span></div>`}
    _paths(){return`<svg class="paths" viewBox="0 0 ${this._config.canvas.width} ${this._config.canvas.height}">${this._config.paths.map(o=>{let p=Array.isArray(o.points)?o.points:o.points?.[this._viewId]||[];if(p.length<2)return'';let d=p.map((x,i)=>`${i?'L':'M'} ${x[0]} ${x[1]}`).join(' '),m=MEDIUMS[o.medium]||MEDIUMS.neutral,sel=this._sel?.k==='path'&&this._sel.id===o.id,w=+o.width||8;return`<path class="phalo" d="${d}" stroke-width="${w+5}"></path><path class="path" data-k="path" data-id="${o.id}" d="${d}" stroke="${o.color||m.color}" stroke-width="${w}"></path>${sel?p.map((x,i)=>`<circle class="handle" data-hi="${i}" data-id="${o.id}" cx="${x[0]}" cy="${x[1]}" r="8"></circle>`).join(''):''}`}).join('')}</svg>`}
    _canvas(){if(this._preview)return`<div class="preview"><glt-flow-card data-preview></glt-flow-card></div>`;let v=this._view(),w=+this._config.canvas.width||1600,h=+this._config.canvas.height||900,b=v.background?`background-image:url(&quot;${esc(v.background)}&quot;);background-size:${esc(v.background_fit||'cover')};background-repeat:no-repeat;background-position:center;`:'';return`<div class="cw" style="width:${w*this._zoom}px;height:${h*this._zoom}px"><div class="canvas ${this._grid?'':'nogrid'}" data-can style="width:${w}px;height:${h}px;transform:scale(${this._zoom});background-size:${this._config.canvas.grid_size}px ${this._config.canvas.grid_size}px;${b}">${this._paths()}${(v.kind==='image'&&!v.show_equipment?[]:this._config.equipment).map(o=>this._node(o)).join('')}${this._config.datapoints.map(o=>this._dp(o)).join('')}</div></div>`}
    _f(l,v,p,t='text'){return`<div class="f"><label>${esc(l)}</label><input type="${t}" value="${esc(v??'')}" data-e="${p}"></div>`}
    _s(l,v,p,a){return`<div class="f"><label>${esc(l)}</label><select data-e="${p}">${a.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${esc(x[1])}</option>`).join('')}</select></div>`}
    _ef(l,v,p,domains=[]){return`<div class="f"><label>${esc(l)}</label><ha-entity-picker data-ep data-e="${p}" data-v="${esc(v||'')}" data-domains="${esc(domains.join(','))}"></ha-entity-picker></div>`}
    _equipmentDomains(o){let t=o?.type||'';if(['fan','ahu'].includes(t))return['fan','switch','binary_sensor','sensor'];if(['room','heating_circuit','radiator','underfloor','fancoil'].includes(t))return['climate','sensor','switch','binary_sensor'];if(['valve','damper'].includes(t))return['valve','cover','switch','binary_sensor','sensor'];if(['pump'].includes(t))return['switch','binary_sensor','sensor','number'];return['switch','binary_sensor','sensor','climate','water_heater','fan','valve','number']}
    _insp(){let v=this._view(),o=this._obj(),m=this._config.appearance?.mode||'neo2030',base=`<div class="sec"><div class="st">Ansicht <span class="chip">${esc(v.kind||'schematic')}</span></div>${this._f('Name',v.name,'@v.name')}${this._s('Typ',v.kind||'schematic','@v.kind',[['schematic','Anlagenschema'],['image','Anlagenbild']])}${this._f('Hintergrundbild (optional)',v.background||'','@v.background')}</div><div class="sec"><div class="st">Optik <span class="chip">${esc(m)}</span></div>${this._s('Design',m,'@c.appearance.mode',[['neo2030','Neo 2030'],['clean','Clean / Modern Light'],['classic_scada','Classic SCADA']])}</div>`;if(!o)return base+`<div class="sec"><div class="st">Karte <span class="chip">Global</span></div>${this._f('Titel',this._config.title,'@c.title')}<div class="g2">${this._f('Breite',this._config.canvas.width,'@a.width','number')}${this._f('Höhe',this._config.canvas.height,'@a.height','number')}</div></div><div class="help">Bauteile, Leitungen und Datenpunkte links auf die Zeichenfläche ziehen. Entitäten werden direkt aus Home Assistant über den nativen Entity-Picker ausgewählt.</div>`;let p=this._pos(o),body='';if(this._sel.k==='equipment'){o.fields=o.fields||[];while(o.fields.length<2)o.fields.push({label:'',entity:''});body=this._f('Name',o.name,'name')+this._s('Symbol',o.symbol||symbolById(null,o.type).id,'symbol',SYMBOL_LIBRARY.map(x=>[x.id,`${x.category} · ${x.label}`]))+this._s('Typ',o.type,'type',[...new Set(SYMBOL_LIBRARY.map(x=>x.type))].map(x=>[x,x.replaceAll('_',' ')]))+this._ef('Haupt-Entität',entityField(o.entity)?.entity||o.entity||'','entity',this._equipmentDomains(o))+this._ef('Status-Entität',entityField(o.state_entity)?.entity||o.state_entity||'','state_entity',['binary_sensor','switch','sensor'])+this._f('Eigenes Bild / SVG (optional)',o.image||'','image')+`<div class="g2">${this._f('X',p.x,'x','number')}${this._f('Y',p.y,'y','number')}${this._f('Breite',p.width||o.width,'width','number')}${this._f('Höhe',p.height||o.height,'height','number')}</div>`+this._f('Wert 1 Label',o.fields[0].label,'fields.0.label')+this._ef('Wert 1 Entität',entityField(o.fields[0].entity)?.entity||o.fields[0].entity||'','fields.0.entity',['sensor','number','climate','water_heater'])+this._f('Wert 2 Label',o.fields[1].label,'fields.1.label')+this._ef('Wert 2 Entität',entityField(o.fields[1].entity)?.entity||o.fields[1].entity||'','fields.1.entity',['sensor','number','climate','water_heater'])}else if(this._sel.k==='datapoint')body=this._f('Label',o.label,'label')+this._ef('Entität',entityField(o.entity)?.entity||o.entity||'','entity',['sensor','binary_sensor','number','climate','water_heater'])+`<div class="g2">${this._f('X in Ansicht',p.x,'x','number')}${this._f('Y in Ansicht',p.y,'y','number')}</div><div class="help">Der Datenpunkt kann im Schema und im Anlagenfoto separat positioniert werden.</div>`;else if(this._sel.k==='path')body=this._s('Medium',o.medium||'neutral','medium',Object.entries(MEDIUMS).map(([k,x])=>[k,x.label]))+this._ef('Aktiv / Fluss',entityField(o.flow)?.entity||o.flow||'','flow',['binary_sensor','switch','fan','sensor','number','valve'])+this._ef('Temperatur / Wert',entityField(o.temperature)?.entity||o.temperature||'','temperature',['sensor','number','climate'])+`<div class="g2">${this._f('Breite',o.width||8,'width','number')}${this._f('Geschwindigkeit',o.speed||1.3,'speed','number')}</div><div class="acts"><button class="act" data-act="addpoint">Punkt hinzufügen</button></div>`;else body=this._f('KPI Name',o.name,'name')+this._ef('Entität',entityField(o.entity)?.entity||o.entity||'','entity',['sensor','binary_sensor','number']);return base+`<div class="sec"><div class="st">${this._sel.k} <span class="chip">${o.id}</span></div>${body}</div><div class="acts"><button class="act" data-act="dup">Duplizieren</button><button class="act" data-act="del">Löschen</button></div>`}
    _render(){if(!this.shadowRoot)return;let v=this._view(),mode=this._config.appearance?.mode||'neo2030',entityCount=Object.keys(this._hass?.states||{}).length;this.shadowRoot.innerHTML=`<style>${EDITOR_STYLES}</style><div class="de"><div class="dt"><div class="brand"><i><ha-icon icon="mdi:vector-square-edit"></ha-icon></i><span><b>GLT Flow Card Designer</b><small>Neo 2030 · Drag & Drop · ${esc(v?.name||'Anlage')}</small></span></div><div class="tools"><div class="seg"><button data-style="neo2030" class="${mode==='neo2030'?'on':''}">Neo 2030</button><button data-style="clean" class="${mode==='clean'?'on':''}">Clean</button><button data-style="classic_scada" class="${mode==='classic_scada'?'on':''}">Classic SCADA</button></div><button class="tb" data-act="undo" ${this._undoS.length?'':'disabled'}>↶ Undo</button><button class="tb" data-act="redo" ${this._redoS.length?'':'disabled'}>↷ Redo</button><button class="tb ${this._snap?'on':''}" data-act="snap">Snap</button><button class="tb ${this._grid?'on':''}" data-act="grid">Raster</button><button class="tb ${this._preview?'on':''}" data-act="preview">Vorschau</button><button class="tb ${this._yamlOpen?'on':''}" data-act="yaml">YAML</button></div></div><div class="work"><aside class="left"><div class="ph">Bausteine <span class="chip">${SYMBOL_LIBRARY.length}+ Symbole</span></div><div class="search"><input data-search placeholder="Bauteil oder Symbol suchen…" value="${esc(this._search)}"></div><div class="pal">${this._palette()}</div></aside><main class="center"><div class="vb"><div class="views">${this._config.views.map(x=>`<button class="tab ${x.id===this._viewId?'on':''}" data-view="${x.id}">${esc(x.name||x.id)}</button>`).join('')}<button class="mini" data-act="addview">＋</button></div><div class="tools"><span class="entity-stat">${entityCount?`${entityCount} HA-Entities verfügbar`:'HA-Entities werden geladen'}</span><button class="mini" data-act="zout">−</button><button class="mini" data-act="fit">Fit</button><button class="mini" data-act="zin">＋</button></div></div><div class="stage" data-stage>${this._canvas()}</div></main><aside class="right"><div class="ph">Eigenschaften <span class="chip">${this._sel?this._sel.k:'Ansicht'}</span></div><div class="insp">${this._insp()}</div></aside></div>${this._yamlOpen?`<div class="drawer"><div class="drawer-head"><b>Lovelace YAML</b><div class="tools"><span class="notice">Direkt in eine manuelle Dashboard-Karte kopierbar</span><button class="act" data-act="copyyaml">${this._copied?'Kopiert ✓':'YAML kopieren'}</button></div></div><pre class="yaml">${esc(configToYaml(this._config))}</pre></div>`:''}<div class="bottom"><span>Änderungen werden direkt in die Kartenkonfiguration übernommen · Entity-Auswahl aus Home Assistant</span><span>${Math.round(this._zoom*100)} %</span></div></div>`;this._bind();requestAnimationFrame(()=>{this._wireEntityPickers();this._live();this._wirePreview()})}
    _wirePreview(){let p=this.shadowRoot?.querySelector('[data-preview]');if(p){p.hass=this._hass;p.setConfig?.(deepClone(this._config))}}
    _wireEntityPickers(){this.shadowRoot?.querySelectorAll('[data-ep]').forEach(p=>{p.hass=this._hass;p.value=p.dataset.v||'';p.allowCustomEntity=true;let d=(p.dataset.domains||'').split(',').filter(Boolean);if(d.length)p.includeDomains=d;if(!p.dataset.bound){p.dataset.bound='1';p.addEventListener('value-changed',e=>{let value=e.detail?.value??'';this._entityEdit(p.dataset.e,value)})}})}
    _entityEdit(path,value){this._remember();if(path.startsWith('@'))return;let o=this._obj();if(!o)return;this._set(o,path,value);this._emit();this._render()}
    _bind(){let r=this.shadowRoot,st=r.querySelector('[data-stage]'),c=r.querySelector('[data-can]');r.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>this._act(b.dataset.act));r.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>{this._remember();this._config.appearance={...(this._config.appearance||{}),mode:b.dataset.style};this._emit();this._render()});r.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{this._viewId=b.dataset.view;this._sel=null;this._render()});let search=r.querySelector('[data-search]');if(search)search.oninput=e=>{this._search=e.target.value;this._render()};r.querySelectorAll('[data-e]').forEach(i=>i.onchange=()=>this._edit(i));r.querySelectorAll('[data-pk]').forEach(i=>i.ondragstart=e=>e.dataTransfer.setData('text/glt',JSON.stringify({k:i.dataset.pk,t:i.dataset.pt,s:i.dataset.ps||''})));if(c&&!this._preview){st.ondragover=e=>{e.preventDefault();st.classList.add('over')};st.ondragleave=()=>st.classList.remove('over');st.ondrop=e=>this._drop(e,c);r.querySelectorAll('[data-k="equipment"],[data-k="datapoint"]').forEach(n=>{n.onpointerdown=e=>{if(e.target.closest('[data-rs]'))return;e.stopPropagation();this._start(e,n.dataset.k,n.dataset.id,'move')};n.onclick=e=>{e.stopPropagation();this._sel={k:n.dataset.k,id:n.dataset.id};this._render()}});r.querySelectorAll('[data-rs]').forEach(h=>h.onpointerdown=e=>{e.stopPropagation();let n=h.closest('[data-k]');this._start(e,'equipment',n.dataset.id,'resize')});r.querySelectorAll('[data-k="path"]').forEach(p=>p.onclick=e=>{e.stopPropagation();this._sel={k:'path',id:p.dataset.id};this._render()});r.querySelectorAll('[data-hi]').forEach(h=>h.onpointerdown=e=>{e.stopPropagation();this._start(e,'path',h.dataset.id,'point',+h.dataset.hi)})}}
    _act(a){if(a==='undo')return this._undo();if(a==='redo')return this._redo();if(a==='snap'){this._snap=!this._snap;return this._render()}if(a==='grid'){this._grid=!this._grid;this._config.canvas.grid=this._grid;this._emit();return this._render()}if(a==='preview'){this._preview=!this._preview;return this._render()}if(a==='yaml'){this._yamlOpen=!this._yamlOpen;this._copied=false;return this._render()}if(a==='copyyaml'){navigator.clipboard?.writeText(configToYaml(this._config));this._copied=true;return this._render()}if(a==='zin'){this._zoom=clamp(this._zoom*1.15,.25,2);return this._render()}if(a==='zout'){this._zoom=clamp(this._zoom/1.15,.25,2);return this._render()}if(a==='fit'){let s=this.shadowRoot.querySelector('[data-stage]');if(!s)return;this._zoom=clamp(Math.min((s.clientWidth-40)/this._config.canvas.width,(s.clientHeight-40)/this._config.canvas.height),.25,1.4);return this._render()}if(a==='addview'){this._remember();let n=1,id=`view_${n}`,ids=new Set(this._config.views.map(v=>v.id));while(ids.has(id))id=`view_${++n}`;this._config.views.push({id,name:'Anlagenbild',kind:'image',background:''});this._viewId=id;this._emit();return this._render()}if(a==='del')return this._del();if(a==='dup')return this._dup();if(a==='addpoint'){let o=this._obj(),p=Array.isArray(o?.points)?o.points:null;if(p?.length){this._remember();let z=p.at(-1);p.push([this._sv(z[0]+120),z[1]]);this._emit();this._render()}}}
    _drop(e,c){e.preventDefault();let d;try{d=JSON.parse(e.dataTransfer.getData('text/glt'))}catch{return}let q=c.getBoundingClientRect(),x=this._sv((e.clientX-q.left)/this._zoom),y=this._sv((e.clientY-q.top)/this._zoom);this._remember();if(d.k==='equipment'){let sd=symbolById(d.s,d.t),id=this._id(sd.type||d.t),small=['pump','fan','valve','damper','meter','sensor'].includes(sd.type);this._config.equipment.push({id,type:sd.type||d.t,symbol:sd.id,name:sd.label||d.t.replaceAll('_',' '),x:x-(small?70:110),y:y-50,width:small?140:220,height:small?100:135,fields:[]});this._sel={k:'equipment',id}}else if(d.k==='datapoint'){let id=this._id('dp');this._config.datapoints.push({id,kind:d.t,label:d.t==='temperature'?'Temperatur':d.t==='pressure'?'Druck':d.t==='flow'?'Volumenstrom':'Datenpunkt',entity:'',positions:{[this._viewId]:{x,y}}});this._sel={k:'datapoint',id}}else if(d.k==='path'){let id=this._id('path');this._config.paths.push({id,medium:d.t,width:8,points:[[x-150,y],[x,y],[x+150,y]]});this._sel={k:'path',id}}else{let id=this._id('kpi');this._config.kpis.push({id,name:'KPI',entity:''});this._sel={k:'kpi',id}}this._emit();this._render()}
    _start(e,k,id,m,hi=null){let o=(k==='equipment'?this._config.equipment:k==='datapoint'?this._config.datapoints:this._config.paths).find(x=>x.id===id);if(!o)return;this._remember();this._sel={k,id};let p=k==='datapoint'?(o.positions?.[this._viewId]||{x:o.x||0,y:o.y||0}):o,pts=k==='path'?o.points:null;this._drag={k,id,m,hi,sx:e.clientX,sy:e.clientY,x:+p.x||0,y:+p.y||0,w:+(p.width||o.width||220),h:+(p.height||o.height||130),pt:hi!==null&&pts?[...pts[hi]]:null};let mv=v=>this._move(v),up=()=>{window.removeEventListener('pointermove',mv);this._drag=null;this._emit();this._render()};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up,{once:true})}
    _move(e){let d=this._drag;if(!d)return;let dx=(e.clientX-d.sx)/this._zoom,dy=(e.clientY-d.sy)/this._zoom;if(d.k==='equipment'){let o=this._config.equipment.find(x=>x.id===d.id);if(d.m==='move'){o.x=this._sv(d.x+dx);o.y=this._sv(d.y+dy)}else{o.width=Math.max(90,this._sv(d.w+dx));o.height=Math.max(70,this._sv(d.h+dy))}}else if(d.k==='datapoint'){let o=this._config.datapoints.find(x=>x.id===d.id);o.positions=o.positions||{};o.positions[this._viewId]={x:this._sv(d.x+dx),y:this._sv(d.y+dy)}}else{let o=this._config.paths.find(x=>x.id===d.id);if(o?.points?.[d.hi])o.points[d.hi]=[this._sv(d.pt[0]+dx),this._sv(d.pt[1]+dy)]}this._render()}
    _edit(i){let p=i.dataset.e,v=i.type==='number'?+i.value:i.value;this._remember();if(p.startsWith('@v.'))this._set(this._view(),p.slice(3),v);else if(p.startsWith('@c.'))this._set(this._config,p.slice(3),v);else if(p.startsWith('@a.'))this._set(this._config.canvas,p.slice(3),v);else{let o=this._obj();if(!o)return;if(this._sel.k==='datapoint'&&['x','y'].includes(p)){o.positions=o.positions||{};o.positions[this._viewId]=o.positions[this._viewId]||{x:0,y:0};o.positions[this._viewId][p]=v}else{this._set(o,p,v);if(p==='symbol'){let sd=symbolById(v,o.type);o.type=sd.type||o.type;o.name=o.name||sd.label}}}this._emit();this._render()}
    _set(o,p,v){let a=p.split('.'),c=o;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null)c[a[i]]=/^\d+$/.test(a[i+1])?[]:{};c=c[a[i]]}c[a.at(-1)]=v}
    _del(){if(!this._sel)return;this._remember();let k={equipment:'equipment',datapoint:'datapoints',path:'paths',kpi:'kpis'}[this._sel.k];this._config[k]=this._config[k].filter(x=>x.id!==this._sel.id);this._sel=null;this._emit();this._render()}
    _dup(){let o=this._obj();if(!o)return;this._remember();let n=deepClone(o),k=this._sel.k;n.id=this._id(k);if(k==='equipment'){n.x=(n.x||0)+40;n.y=(n.y||0)+40;this._config.equipment.push(n)}else if(k==='datapoint'){Object.values(n.positions||{}).forEach(p=>{p.x+=40;p.y+=40});this._config.datapoints.push(n)}else if(k==='path'){n.points=n.points.map(p=>[p[0]+40,p[1]+40]);this._config.paths.push(n)}else this._config.kpis.push(n);this._sel={k,id:n.id};this._emit();this._render()}
    _key(e){if(!this.isConnected)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();return e.shiftKey?this._redo():this._undo()}if((e.key==='Delete'||e.key==='Backspace')&&this._sel&&!e.target?.closest?.('input,select,ha-entity-picker')){e.preventDefault();this._del()}}
    _live(){this.shadowRoot?.querySelectorAll('[data-live]').forEach(n=>{if(n.dataset.live)n.textContent=this._val(n.dataset.live)})}
  }

  if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, GltFlowCard);
  if (!customElements.get(`${CARD_TYPE}-editor`)) customElements.define(`${CARD_TYPE}-editor`, GltFlowCardEditor);

  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
    window.customCards.push({
      type: CARD_TYPE,
      name: "GLT Flow Card",
      description: "Modern configurable building-management visualization with animated plant schemes, image overlays, pan/zoom, replay, trends and KPIs.",
      preview: true,
      documentationURL: "https://github.com/Xerolux/glt-flow-card"
    });
  }
})();

/*! GLT Flow Card v0.4 extensions */
(() => {
  // node_modules/js-yaml/dist/js-yaml.mjs
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var jsYaml = {};
  var loader = {};
  var common = {};
  var hasRequiredCommon;
  function requireCommon() {
    if (hasRequiredCommon) return common;
    hasRequiredCommon = 1;
    function isNothing(subject) {
      return typeof subject === "undefined" || subject === null;
    }
    function isObject(subject) {
      return typeof subject === "object" && subject !== null;
    }
    function toArray(sequence) {
      if (Array.isArray(sequence)) return sequence;
      else if (isNothing(sequence)) return [];
      return [sequence];
    }
    function extend(target, source) {
      if (source) {
        const sourceKeys = Object.keys(source);
        for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
          const key = sourceKeys[index];
          target[key] = source[key];
        }
      }
      return target;
    }
    function repeat(string, count) {
      let result = "";
      for (let cycle = 0; cycle < count; cycle += 1) {
        result += string;
      }
      return result;
    }
    function isNegativeZero(number) {
      return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
    }
    common.isNothing = isNothing;
    common.isObject = isObject;
    common.toArray = toArray;
    common.repeat = repeat;
    common.isNegativeZero = isNegativeZero;
    common.extend = extend;
    return common;
  }
  var exception;
  var hasRequiredException;
  function requireException() {
    if (hasRequiredException) return exception;
    hasRequiredException = 1;
    function formatError(exception2, compact) {
      let where = "";
      const message = exception2.reason || "(unknown reason)";
      if (!exception2.mark) return message;
      if (exception2.mark.name) {
        where += 'in "' + exception2.mark.name + '" ';
      }
      where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
      if (!compact && exception2.mark.snippet) {
        where += "\n\n" + exception2.mark.snippet;
      }
      return message + " " + where;
    }
    function YAMLException2(reason, mark) {
      Error.call(this);
      this.name = "YAMLException";
      this.reason = reason;
      this.mark = mark;
      this.message = formatError(this, false);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = new Error().stack || "";
      }
    }
    YAMLException2.prototype = Object.create(Error.prototype);
    YAMLException2.prototype.constructor = YAMLException2;
    YAMLException2.prototype.toString = function toString(compact) {
      return this.name + ": " + formatError(this, compact);
    };
    exception = YAMLException2;
    return exception;
  }
  var snippet;
  var hasRequiredSnippet;
  function requireSnippet() {
    if (hasRequiredSnippet) return snippet;
    hasRequiredSnippet = 1;
    const common2 = requireCommon();
    function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
      let head = "";
      let tail = "";
      const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
      if (position - lineStart > maxHalfLength) {
        head = " ... ";
        lineStart = position - maxHalfLength + head.length;
      }
      if (lineEnd - position > maxHalfLength) {
        tail = " ...";
        lineEnd = position + maxHalfLength - tail.length;
      }
      return {
        str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
        pos: position - lineStart + head.length
        // relative position
      };
    }
    function padStart(string, max) {
      return common2.repeat(" ", max - string.length) + string;
    }
    function makeSnippet(mark, options) {
      options = Object.create(options || null);
      if (!mark.buffer) return null;
      if (!options.maxLength) options.maxLength = 79;
      if (typeof options.indent !== "number") options.indent = 1;
      if (typeof options.linesBefore !== "number") options.linesBefore = 3;
      if (typeof options.linesAfter !== "number") options.linesAfter = 2;
      const re = /\r?\n|\r|\0/g;
      const lineStarts = [0];
      const lineEnds = [];
      let match;
      let foundLineNo = -1;
      while (match = re.exec(mark.buffer)) {
        lineEnds.push(match.index);
        lineStarts.push(match.index + match[0].length);
        if (mark.position <= match.index && foundLineNo < 0) {
          foundLineNo = lineStarts.length - 2;
        }
      }
      if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
      let result = "";
      const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
      const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
      for (let i = 1; i <= options.linesBefore; i++) {
        if (foundLineNo - i < 0) break;
        const line2 = getLine(
          mark.buffer,
          lineStarts[foundLineNo - i],
          lineEnds[foundLineNo - i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
          maxLineLength
        );
        result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
      }
      const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
      result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
      result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
      for (let i = 1; i <= options.linesAfter; i++) {
        if (foundLineNo + i >= lineEnds.length) break;
        const line2 = getLine(
          mark.buffer,
          lineStarts[foundLineNo + i],
          lineEnds[foundLineNo + i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
          maxLineLength
        );
        result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
      }
      return result.replace(/\n$/, "");
    }
    snippet = makeSnippet;
    return snippet;
  }
  var type;
  var hasRequiredType;
  function requireType() {
    if (hasRequiredType) return type;
    hasRequiredType = 1;
    const YAMLException2 = requireException();
    const TYPE_CONSTRUCTOR_OPTIONS = [
      "kind",
      "multi",
      "resolve",
      "construct",
      "instanceOf",
      "predicate",
      "represent",
      "representName",
      "defaultStyle",
      "styleAliases"
    ];
    const YAML_NODE_KINDS = [
      "scalar",
      "sequence",
      "mapping"
    ];
    function compileStyleAliases(map2) {
      const result = {};
      if (map2 !== null) {
        Object.keys(map2).forEach(function(style) {
          map2[style].forEach(function(alias) {
            result[String(alias)] = style;
          });
        });
      }
      return result;
    }
    function Type2(tag, options) {
      options = options || {};
      Object.keys(options).forEach(function(name) {
        if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
          throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
        }
      });
      this.options = options;
      this.tag = tag;
      this.kind = options["kind"] || null;
      this.resolve = options["resolve"] || function() {
        return true;
      };
      this.construct = options["construct"] || function(data) {
        return data;
      };
      this.instanceOf = options["instanceOf"] || null;
      this.predicate = options["predicate"] || null;
      this.represent = options["represent"] || null;
      this.representName = options["representName"] || null;
      this.defaultStyle = options["defaultStyle"] || null;
      this.multi = options["multi"] || false;
      this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
      if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
        throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
      }
    }
    type = Type2;
    return type;
  }
  var schema;
  var hasRequiredSchema;
  function requireSchema() {
    if (hasRequiredSchema) return schema;
    hasRequiredSchema = 1;
    const YAMLException2 = requireException();
    const Type2 = requireType();
    function compileList(schema2, name) {
      const result = [];
      schema2[name].forEach(function(currentType) {
        let newIndex = result.length;
        result.forEach(function(previousType, previousIndex) {
          if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
            newIndex = previousIndex;
          }
        });
        result[newIndex] = currentType;
      });
      return result;
    }
    function compileMap() {
      const result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {},
        multi: {
          scalar: [],
          sequence: [],
          mapping: [],
          fallback: []
        }
      };
      function collectType(type2) {
        if (type2.multi) {
          result.multi[type2.kind].push(type2);
          result.multi["fallback"].push(type2);
        } else {
          result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
        }
      }
      for (let index = 0, length = arguments.length; index < length; index += 1) {
        arguments[index].forEach(collectType);
      }
      return result;
    }
    function Schema2(definition) {
      return this.extend(definition);
    }
    Schema2.prototype.extend = function extend(definition) {
      let implicit = [];
      let explicit = [];
      if (definition instanceof Type2) {
        explicit.push(definition);
      } else if (Array.isArray(definition)) {
        explicit = explicit.concat(definition);
      } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
        if (definition.implicit) implicit = implicit.concat(definition.implicit);
        if (definition.explicit) explicit = explicit.concat(definition.explicit);
      } else {
        throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
      }
      implicit.forEach(function(type2) {
        if (!(type2 instanceof Type2)) {
          throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
        }
        if (type2.loadKind && type2.loadKind !== "scalar") {
          throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
        }
        if (type2.multi) {
          throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
        }
      });
      explicit.forEach(function(type2) {
        if (!(type2 instanceof Type2)) {
          throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
        }
      });
      const result = Object.create(Schema2.prototype);
      result.implicit = (this.implicit || []).concat(implicit);
      result.explicit = (this.explicit || []).concat(explicit);
      result.compiledImplicit = compileList(result, "implicit");
      result.compiledExplicit = compileList(result, "explicit");
      result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
      return result;
    };
    schema = Schema2;
    return schema;
  }
  var str;
  var hasRequiredStr;
  function requireStr() {
    if (hasRequiredStr) return str;
    hasRequiredStr = 1;
    const Type2 = requireType();
    str = new Type2("tag:yaml.org,2002:str", {
      kind: "scalar",
      construct: function(data) {
        return data !== null ? data : "";
      }
    });
    return str;
  }
  var seq;
  var hasRequiredSeq;
  function requireSeq() {
    if (hasRequiredSeq) return seq;
    hasRequiredSeq = 1;
    const Type2 = requireType();
    seq = new Type2("tag:yaml.org,2002:seq", {
      kind: "sequence",
      construct: function(data) {
        return data !== null ? data : [];
      }
    });
    return seq;
  }
  var map;
  var hasRequiredMap;
  function requireMap() {
    if (hasRequiredMap) return map;
    hasRequiredMap = 1;
    const Type2 = requireType();
    map = new Type2("tag:yaml.org,2002:map", {
      kind: "mapping",
      construct: function(data) {
        return data !== null ? data : {};
      }
    });
    return map;
  }
  var failsafe;
  var hasRequiredFailsafe;
  function requireFailsafe() {
    if (hasRequiredFailsafe) return failsafe;
    hasRequiredFailsafe = 1;
    const Schema2 = requireSchema();
    failsafe = new Schema2({
      explicit: [
        requireStr(),
        requireSeq(),
        requireMap()
      ]
    });
    return failsafe;
  }
  var _null;
  var hasRequired_null;
  function require_null() {
    if (hasRequired_null) return _null;
    hasRequired_null = 1;
    const Type2 = requireType();
    function resolveYamlNull(data) {
      if (data === null) return true;
      const max = data.length;
      return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
    }
    function constructYamlNull() {
      return null;
    }
    function isNull(object) {
      return object === null;
    }
    _null = new Type2("tag:yaml.org,2002:null", {
      kind: "scalar",
      resolve: resolveYamlNull,
      construct: constructYamlNull,
      predicate: isNull,
      represent: {
        canonical: function() {
          return "~";
        },
        lowercase: function() {
          return "null";
        },
        uppercase: function() {
          return "NULL";
        },
        camelcase: function() {
          return "Null";
        },
        empty: function() {
          return "";
        }
      },
      defaultStyle: "lowercase"
    });
    return _null;
  }
  var bool;
  var hasRequiredBool;
  function requireBool() {
    if (hasRequiredBool) return bool;
    hasRequiredBool = 1;
    const Type2 = requireType();
    function resolveYamlBoolean(data) {
      if (data === null) return false;
      const max = data.length;
      return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
    }
    function constructYamlBoolean(data) {
      return data === "true" || data === "True" || data === "TRUE";
    }
    function isBoolean(object) {
      return Object.prototype.toString.call(object) === "[object Boolean]";
    }
    bool = new Type2("tag:yaml.org,2002:bool", {
      kind: "scalar",
      resolve: resolveYamlBoolean,
      construct: constructYamlBoolean,
      predicate: isBoolean,
      represent: {
        lowercase: function(object) {
          return object ? "true" : "false";
        },
        uppercase: function(object) {
          return object ? "TRUE" : "FALSE";
        },
        camelcase: function(object) {
          return object ? "True" : "False";
        }
      },
      defaultStyle: "lowercase"
    });
    return bool;
  }
  var int;
  var hasRequiredInt;
  function requireInt() {
    if (hasRequiredInt) return int;
    hasRequiredInt = 1;
    const common2 = requireCommon();
    const Type2 = requireType();
    function isHexCode(c) {
      return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
    }
    function isOctCode(c) {
      return c >= 48 && c <= 55;
    }
    function isDecCode(c) {
      return c >= 48 && c <= 57;
    }
    function resolveYamlInteger(data) {
      if (data === null) return false;
      const max = data.length;
      let index = 0;
      let hasDigits = false;
      if (!max) return false;
      let ch = data[index];
      if (ch === "-" || ch === "+") {
        ch = data[++index];
      }
      if (ch === "0") {
        if (index + 1 === max) return true;
        ch = data[++index];
        if (ch === "b") {
          index++;
          for (; index < max; index++) {
            ch = data[index];
            if (ch !== "0" && ch !== "1") return false;
            hasDigits = true;
          }
          return hasDigits && isFinite(parseYamlInteger(data));
        }
        if (ch === "x") {
          index++;
          for (; index < max; index++) {
            if (!isHexCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && isFinite(parseYamlInteger(data));
        }
        if (ch === "o") {
          index++;
          for (; index < max; index++) {
            if (!isOctCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && isFinite(parseYamlInteger(data));
        }
      }
      for (; index < max; index++) {
        if (!isDecCode(data.charCodeAt(index))) {
          return false;
        }
        hasDigits = true;
      }
      if (!hasDigits) return false;
      return isFinite(parseYamlInteger(data));
    }
    function parseYamlInteger(data) {
      let value = data;
      let sign = 1;
      let ch = value[0];
      if (ch === "-" || ch === "+") {
        if (ch === "-") sign = -1;
        value = value.slice(1);
        ch = value[0];
      }
      if (value === "0") return 0;
      if (ch === "0") {
        if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
        if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
        if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
      }
      return sign * parseInt(value, 10);
    }
    function constructYamlInteger(data) {
      return parseYamlInteger(data);
    }
    function isInteger(object) {
      return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
    }
    int = new Type2("tag:yaml.org,2002:int", {
      kind: "scalar",
      resolve: resolveYamlInteger,
      construct: constructYamlInteger,
      predicate: isInteger,
      represent: {
        binary: function(obj) {
          return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
        },
        octal: function(obj) {
          return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
        },
        decimal: function(obj) {
          return obj.toString(10);
        },
        hexadecimal: function(obj) {
          return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
        }
      },
      defaultStyle: "decimal",
      styleAliases: {
        binary: [2, "bin"],
        octal: [8, "oct"],
        decimal: [10, "dec"],
        hexadecimal: [16, "hex"]
      }
    });
    return int;
  }
  var float;
  var hasRequiredFloat;
  function requireFloat() {
    if (hasRequiredFloat) return float;
    hasRequiredFloat = 1;
    const common2 = requireCommon();
    const Type2 = requireType();
    const YAML_FLOAT_PATTERN = new RegExp(
      // 2.5e4, 2.5 and integers
      "^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
    );
    const YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
      "^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
    );
    function resolveYamlFloat(data) {
      if (data === null) return false;
      if (!YAML_FLOAT_PATTERN.test(data)) {
        return false;
      }
      if (isFinite(parseFloat(data, 10))) {
        return true;
      }
      return YAML_FLOAT_SPECIAL_PATTERN.test(data);
    }
    function constructYamlFloat(data) {
      let value = data.toLowerCase();
      const sign = value[0] === "-" ? -1 : 1;
      if ("+-".indexOf(value[0]) >= 0) {
        value = value.slice(1);
      }
      if (value === ".inf") {
        return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      } else if (value === ".nan") {
        return NaN;
      }
      return sign * parseFloat(value, 10);
    }
    const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
    function representYamlFloat(object, style) {
      if (isNaN(object)) {
        switch (style) {
          case "lowercase":
            return ".nan";
          case "uppercase":
            return ".NAN";
          case "camelcase":
            return ".NaN";
        }
      } else if (Number.POSITIVE_INFINITY === object) {
        switch (style) {
          case "lowercase":
            return ".inf";
          case "uppercase":
            return ".INF";
          case "camelcase":
            return ".Inf";
        }
      } else if (Number.NEGATIVE_INFINITY === object) {
        switch (style) {
          case "lowercase":
            return "-.inf";
          case "uppercase":
            return "-.INF";
          case "camelcase":
            return "-.Inf";
        }
      } else if (common2.isNegativeZero(object)) {
        return "-0.0";
      }
      const res = object.toString(10);
      return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
    }
    function isFloat(object) {
      return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
    }
    float = new Type2("tag:yaml.org,2002:float", {
      kind: "scalar",
      resolve: resolveYamlFloat,
      construct: constructYamlFloat,
      predicate: isFloat,
      represent: representYamlFloat,
      defaultStyle: "lowercase"
    });
    return float;
  }
  var json;
  var hasRequiredJson;
  function requireJson() {
    if (hasRequiredJson) return json;
    hasRequiredJson = 1;
    json = requireFailsafe().extend({
      implicit: [
        require_null(),
        requireBool(),
        requireInt(),
        requireFloat()
      ]
    });
    return json;
  }
  var core;
  var hasRequiredCore;
  function requireCore() {
    if (hasRequiredCore) return core;
    hasRequiredCore = 1;
    core = requireJson();
    return core;
  }
  var timestamp;
  var hasRequiredTimestamp;
  function requireTimestamp() {
    if (hasRequiredTimestamp) return timestamp;
    hasRequiredTimestamp = 1;
    const Type2 = requireType();
    const YAML_DATE_REGEXP = new RegExp(
      "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
    );
    const YAML_TIMESTAMP_REGEXP = new RegExp(
      "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
    );
    function resolveYamlTimestamp(data) {
      if (data === null) return false;
      if (YAML_DATE_REGEXP.exec(data) !== null) return true;
      if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
      return false;
    }
    function constructYamlTimestamp(data) {
      let fraction = 0;
      let delta = null;
      let match = YAML_DATE_REGEXP.exec(data);
      if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
      if (match === null) throw new Error("Date resolve error");
      const year = +match[1];
      const month = +match[2] - 1;
      const day = +match[3];
      if (!match[4]) {
        return new Date(Date.UTC(year, month, day));
      }
      const hour = +match[4];
      const minute = +match[5];
      const second = +match[6];
      if (match[7]) {
        fraction = match[7].slice(0, 3);
        while (fraction.length < 3) {
          fraction += "0";
        }
        fraction = +fraction;
      }
      if (match[9]) {
        const tzHour = +match[10];
        const tzMinute = +(match[11] || 0);
        delta = (tzHour * 60 + tzMinute) * 6e4;
        if (match[9] === "-") delta = -delta;
      }
      const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
      if (delta) date.setTime(date.getTime() - delta);
      return date;
    }
    function representYamlTimestamp(object) {
      return object.toISOString();
    }
    timestamp = new Type2("tag:yaml.org,2002:timestamp", {
      kind: "scalar",
      resolve: resolveYamlTimestamp,
      construct: constructYamlTimestamp,
      instanceOf: Date,
      represent: representYamlTimestamp
    });
    return timestamp;
  }
  var merge;
  var hasRequiredMerge;
  function requireMerge() {
    if (hasRequiredMerge) return merge;
    hasRequiredMerge = 1;
    const Type2 = requireType();
    function resolveYamlMerge(data) {
      return data === "<<" || data === null;
    }
    merge = new Type2("tag:yaml.org,2002:merge", {
      kind: "scalar",
      resolve: resolveYamlMerge
    });
    return merge;
  }
  var binary;
  var hasRequiredBinary;
  function requireBinary() {
    if (hasRequiredBinary) return binary;
    hasRequiredBinary = 1;
    const Type2 = requireType();
    const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
    function resolveYamlBinary(data) {
      if (data === null) return false;
      let bitlen = 0;
      const max = data.length;
      const map2 = BASE64_MAP;
      for (let idx = 0; idx < max; idx++) {
        const code = map2.indexOf(data.charAt(idx));
        if (code > 64) continue;
        if (code < 0) return false;
        bitlen += 6;
      }
      return bitlen % 8 === 0;
    }
    function constructYamlBinary(data) {
      const input = data.replace(/[\r\n=]/g, "");
      const max = input.length;
      const map2 = BASE64_MAP;
      let bits = 0;
      const result = [];
      for (let idx = 0; idx < max; idx++) {
        if (idx % 4 === 0 && idx) {
          result.push(bits >> 16 & 255);
          result.push(bits >> 8 & 255);
          result.push(bits & 255);
        }
        bits = bits << 6 | map2.indexOf(input.charAt(idx));
      }
      const tailbits = max % 4 * 6;
      if (tailbits === 0) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      } else if (tailbits === 18) {
        result.push(bits >> 10 & 255);
        result.push(bits >> 2 & 255);
      } else if (tailbits === 12) {
        result.push(bits >> 4 & 255);
      }
      return new Uint8Array(result);
    }
    function representYamlBinary(object) {
      let result = "";
      let bits = 0;
      const max = object.length;
      const map2 = BASE64_MAP;
      for (let idx = 0; idx < max; idx++) {
        if (idx % 3 === 0 && idx) {
          result += map2[bits >> 18 & 63];
          result += map2[bits >> 12 & 63];
          result += map2[bits >> 6 & 63];
          result += map2[bits & 63];
        }
        bits = (bits << 8) + object[idx];
      }
      const tail = max % 3;
      if (tail === 0) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      } else if (tail === 2) {
        result += map2[bits >> 10 & 63];
        result += map2[bits >> 4 & 63];
        result += map2[bits << 2 & 63];
        result += map2[64];
      } else if (tail === 1) {
        result += map2[bits >> 2 & 63];
        result += map2[bits << 4 & 63];
        result += map2[64];
        result += map2[64];
      }
      return result;
    }
    function isBinary(obj) {
      return Object.prototype.toString.call(obj) === "[object Uint8Array]";
    }
    binary = new Type2("tag:yaml.org,2002:binary", {
      kind: "scalar",
      resolve: resolveYamlBinary,
      construct: constructYamlBinary,
      predicate: isBinary,
      represent: representYamlBinary
    });
    return binary;
  }
  var omap;
  var hasRequiredOmap;
  function requireOmap() {
    if (hasRequiredOmap) return omap;
    hasRequiredOmap = 1;
    const Type2 = requireType();
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    const _toString = Object.prototype.toString;
    function resolveYamlOmap(data) {
      if (data === null) return true;
      const objectKeys = {};
      const object = data;
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        let pairHasKey = false;
        if (_toString.call(pair) !== "[object Object]") return false;
        let pairKey;
        for (pairKey in pair) {
          if (_hasOwnProperty.call(pair, pairKey)) {
            if (!pairHasKey) pairHasKey = true;
            else return false;
          }
        }
        if (!pairHasKey) return false;
        if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
        Object.defineProperty(objectKeys, pairKey, { value: true });
      }
      return true;
    }
    function constructYamlOmap(data) {
      return data !== null ? data : [];
    }
    omap = new Type2("tag:yaml.org,2002:omap", {
      kind: "sequence",
      resolve: resolveYamlOmap,
      construct: constructYamlOmap
    });
    return omap;
  }
  var pairs;
  var hasRequiredPairs;
  function requirePairs() {
    if (hasRequiredPairs) return pairs;
    hasRequiredPairs = 1;
    const Type2 = requireType();
    const _toString = Object.prototype.toString;
    function resolveYamlPairs(data) {
      if (data === null) return true;
      const object = data;
      const result = new Array(object.length);
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        if (_toString.call(pair) !== "[object Object]") return false;
        const keys = Object.keys(pair);
        if (keys.length !== 1) return false;
        result[index] = [keys[0], pair[keys[0]]];
      }
      return true;
    }
    function constructYamlPairs(data) {
      if (data === null) return [];
      const object = data;
      const result = new Array(object.length);
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        const keys = Object.keys(pair);
        result[index] = [keys[0], pair[keys[0]]];
      }
      return result;
    }
    pairs = new Type2("tag:yaml.org,2002:pairs", {
      kind: "sequence",
      resolve: resolveYamlPairs,
      construct: constructYamlPairs
    });
    return pairs;
  }
  var set;
  var hasRequiredSet;
  function requireSet() {
    if (hasRequiredSet) return set;
    hasRequiredSet = 1;
    const Type2 = requireType();
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    function resolveYamlSet(data) {
      if (data === null) return true;
      const object = data;
      for (const key in object) {
        if (_hasOwnProperty.call(object, key)) {
          if (object[key] !== null) return false;
        }
      }
      return true;
    }
    function constructYamlSet(data) {
      return data !== null ? data : {};
    }
    set = new Type2("tag:yaml.org,2002:set", {
      kind: "mapping",
      resolve: resolveYamlSet,
      construct: constructYamlSet
    });
    return set;
  }
  var _default;
  var hasRequired_default;
  function require_default() {
    if (hasRequired_default) return _default;
    hasRequired_default = 1;
    _default = requireCore().extend({
      implicit: [
        requireTimestamp(),
        requireMerge()
      ],
      explicit: [
        requireBinary(),
        requireOmap(),
        requirePairs(),
        requireSet()
      ]
    });
    return _default;
  }
  var hasRequiredLoader;
  function requireLoader() {
    if (hasRequiredLoader) return loader;
    hasRequiredLoader = 1;
    const common2 = requireCommon();
    const YAMLException2 = requireException();
    const makeSnippet = requireSnippet();
    const DEFAULT_SCHEMA2 = require_default();
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    const CONTEXT_FLOW_IN = 1;
    const CONTEXT_FLOW_OUT = 2;
    const CONTEXT_BLOCK_IN = 3;
    const CONTEXT_BLOCK_OUT = 4;
    const CHOMPING_CLIP = 1;
    const CHOMPING_STRIP = 2;
    const CHOMPING_KEEP = 3;
    const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
    const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
    const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
    const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
    const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
    function _class(obj) {
      return Object.prototype.toString.call(obj);
    }
    function isEol(c) {
      return c === 10 || c === 13;
    }
    function isWhiteSpace(c) {
      return c === 9 || c === 32;
    }
    function isWsOrEol(c) {
      return c === 9 || c === 32 || c === 10 || c === 13;
    }
    function isFlowIndicator(c) {
      return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
    }
    function fromHexCode(c) {
      if (c >= 48 && c <= 57) {
        return c - 48;
      }
      const lc = c | 32;
      if (lc >= 97 && lc <= 102) {
        return lc - 97 + 10;
      }
      return -1;
    }
    function escapedHexLen(c) {
      if (c === 120) {
        return 2;
      }
      if (c === 117) {
        return 4;
      }
      if (c === 85) {
        return 8;
      }
      return 0;
    }
    function fromDecimalCode(c) {
      if (c >= 48 && c <= 57) {
        return c - 48;
      }
      return -1;
    }
    function simpleEscapeSequence(c) {
      switch (c) {
        case 48:
          return "\0";
        case 97:
          return "\x07";
        case 98:
          return "\b";
        case 116:
          return "	";
        case 9:
          return "	";
        case 110:
          return "\n";
        case 118:
          return "\v";
        case 102:
          return "\f";
        case 114:
          return "\r";
        case 101:
          return "\x1B";
        case 32:
          return " ";
        case 34:
          return '"';
        case 47:
          return "/";
        case 92:
          return "\\";
        case 78:
          return "\x85";
        case 95:
          return "\xA0";
        case 76:
          return "\u2028";
        case 80:
          return "\u2029";
        default:
          return "";
      }
    }
    function charFromCodepoint(c) {
      if (c <= 65535) {
        return String.fromCharCode(c);
      }
      return String.fromCharCode(
        (c - 65536 >> 10) + 55296,
        (c - 65536 & 1023) + 56320
      );
    }
    function setProperty(object, key, value) {
      if (key === "__proto__") {
        Object.defineProperty(object, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value
        });
      } else {
        object[key] = value;
      }
    }
    const simpleEscapeCheck = new Array(256);
    const simpleEscapeMap = new Array(256);
    for (let i = 0; i < 256; i++) {
      simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
      simpleEscapeMap[i] = simpleEscapeSequence(i);
    }
    function State(input, options) {
      this.input = input;
      this.filename = options["filename"] || null;
      this.schema = options["schema"] || DEFAULT_SCHEMA2;
      this.onWarning = options["onWarning"] || null;
      this.legacy = options["legacy"] || false;
      this.json = options["json"] || false;
      this.listener = options["listener"] || null;
      this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
      this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
      this.implicitTypes = this.schema.compiledImplicit;
      this.typeMap = this.schema.compiledTypeMap;
      this.length = input.length;
      this.position = 0;
      this.line = 0;
      this.lineStart = 0;
      this.lineIndent = 0;
      this.depth = 0;
      this.totalMergeKeys = 0;
      this.firstTabInLine = -1;
      this.documents = [];
      this.anchorMapTransactions = [];
    }
    function generateError(state, message) {
      const mark = {
        name: state.filename,
        buffer: state.input.slice(0, -1),
        // omit trailing \0
        position: state.position,
        line: state.line,
        column: state.position - state.lineStart
      };
      mark.snippet = makeSnippet(mark);
      return new YAMLException2(message, mark);
    }
    function throwError(state, message) {
      throw generateError(state, message);
    }
    function throwWarning(state, message) {
      if (state.onWarning) {
        state.onWarning.call(null, generateError(state, message));
      }
    }
    function storeAnchor(state, name, value) {
      const transactions = state.anchorMapTransactions;
      if (transactions.length !== 0) {
        const transaction = transactions[transactions.length - 1];
        if (!_hasOwnProperty.call(transaction, name)) {
          transaction[name] = {
            existed: _hasOwnProperty.call(state.anchorMap, name),
            value: state.anchorMap[name]
          };
        }
      }
      state.anchorMap[name] = value;
    }
    function beginAnchorTransaction(state) {
      state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
    }
    function commitAnchorTransaction(state) {
      const transaction = state.anchorMapTransactions.pop();
      const transactions = state.anchorMapTransactions;
      if (transactions.length === 0) return;
      const parent = transactions[transactions.length - 1];
      const names = Object.keys(transaction);
      for (let index = 0, length = names.length; index < length; index += 1) {
        const name = names[index];
        if (!_hasOwnProperty.call(parent, name)) {
          parent[name] = transaction[name];
        }
      }
    }
    function rollbackAnchorTransaction(state) {
      const transaction = state.anchorMapTransactions.pop();
      const names = Object.keys(transaction);
      for (let index = names.length - 1; index >= 0; index -= 1) {
        const entry = transaction[names[index]];
        if (entry.existed) {
          state.anchorMap[names[index]] = entry.value;
        } else {
          delete state.anchorMap[names[index]];
        }
      }
    }
    function snapshotState(state) {
      return {
        position: state.position,
        line: state.line,
        lineStart: state.lineStart,
        lineIndent: state.lineIndent,
        firstTabInLine: state.firstTabInLine,
        tag: state.tag,
        anchor: state.anchor,
        kind: state.kind,
        result: state.result
      };
    }
    function restoreState(state, snapshot) {
      state.position = snapshot.position;
      state.line = snapshot.line;
      state.lineStart = snapshot.lineStart;
      state.lineIndent = snapshot.lineIndent;
      state.firstTabInLine = snapshot.firstTabInLine;
      state.tag = snapshot.tag;
      state.anchor = snapshot.anchor;
      state.kind = snapshot.kind;
      state.result = snapshot.result;
    }
    const directiveHandlers = {
      YAML: function handleYamlDirective(state, name, args) {
        if (state.version !== null) {
          throwError(state, "duplication of %YAML directive");
        }
        if (args.length !== 1) {
          throwError(state, "YAML directive accepts exactly one argument");
        }
        const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
        if (match === null) {
          throwError(state, "ill-formed argument of the YAML directive");
        }
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major !== 1) {
          throwError(state, "unacceptable YAML version of the document");
        }
        state.version = args[0];
        state.checkLineBreaks = minor < 2;
        if (minor !== 1 && minor !== 2) {
          throwWarning(state, "unsupported YAML version of the document");
        }
      },
      TAG: function handleTagDirective(state, name, args) {
        let prefix;
        if (args.length !== 2) {
          throwError(state, "TAG directive accepts exactly two arguments");
        }
        const handle = args[0];
        prefix = args[1];
        if (!PATTERN_TAG_HANDLE.test(handle)) {
          throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
        }
        if (_hasOwnProperty.call(state.tagMap, handle)) {
          throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
        }
        if (!PATTERN_TAG_URI.test(prefix)) {
          throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
        }
        try {
          prefix = decodeURIComponent(prefix);
        } catch (err) {
          throwError(state, "tag prefix is malformed: " + prefix);
        }
        state.tagMap[handle] = prefix;
      }
    };
    function captureSegment(state, start, end, checkJson) {
      if (start < end) {
        const _result = state.input.slice(start, end);
        if (checkJson) {
          for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
            const _character = _result.charCodeAt(_position);
            if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
              throwError(state, "expected valid JSON character");
            }
          }
        } else if (PATTERN_NON_PRINTABLE.test(_result)) {
          throwError(state, "the stream contains non-printable characters");
        }
        state.result += _result;
      }
    }
    function chargeMergeWork(state) {
      state.totalMergeKeys++;
      if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) {
        throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
      }
    }
    function mergeMappings(state, destination, source, overridableKeys) {
      if (!common2.isObject(source)) {
        throwError(state, "cannot merge mappings; the provided source object is unacceptable");
      }
      chargeMergeWork(state);
      const sourceKeys = Object.keys(source);
      for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
        const key = sourceKeys[index];
        chargeMergeWork(state);
        if (!_hasOwnProperty.call(destination, key)) {
          setProperty(destination, key, source[key]);
          overridableKeys[key] = true;
        }
      }
    }
    function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
      if (Array.isArray(keyNode)) {
        keyNode = Array.prototype.slice.call(keyNode);
        for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
          if (Array.isArray(keyNode[index])) {
            throwError(state, "nested arrays are not supported inside keys");
          }
          if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
            keyNode[index] = "[object Object]";
          }
        }
      }
      if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
        keyNode = "[object Object]";
      }
      keyNode = String(keyNode);
      if (_result === null) {
        _result = {};
      }
      if (keyTag === "tag:yaml.org,2002:merge") {
        if (Array.isArray(valueNode)) {
          if (valueNode.length > 100) {
            throwError(state, "abnormal merge sequence size");
          }
          for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
            mergeMappings(state, _result, valueNode[index], overridableKeys);
          }
        } else {
          mergeMappings(state, _result, valueNode, overridableKeys);
        }
      } else {
        if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
          state.line = startLine || state.line;
          state.lineStart = startLineStart || state.lineStart;
          state.position = startPos || state.position;
          throwError(state, "duplicated mapping key");
        }
        setProperty(_result, keyNode, valueNode);
        delete overridableKeys[keyNode];
      }
      return _result;
    }
    function readLineBreak(state) {
      const ch = state.input.charCodeAt(state.position);
      if (ch === 10) {
        state.position++;
      } else if (ch === 13) {
        state.position++;
        if (state.input.charCodeAt(state.position) === 10) {
          state.position++;
        }
      } else {
        throwError(state, "a line break is expected");
      }
      state.line += 1;
      state.lineStart = state.position;
      state.firstTabInLine = -1;
    }
    function skipSeparationSpace(state, allowComments, checkIndent) {
      let lineBreaks = 0;
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          if (ch === 9 && state.firstTabInLine === -1) {
            state.firstTabInLine = state.position;
          }
          ch = state.input.charCodeAt(++state.position);
        }
        if (allowComments && ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 10 && ch !== 13 && ch !== 0);
        }
        if (isEol(ch)) {
          readLineBreak(state);
          ch = state.input.charCodeAt(state.position);
          lineBreaks++;
          state.lineIndent = 0;
          while (ch === 32) {
            state.lineIndent++;
            ch = state.input.charCodeAt(++state.position);
          }
        } else {
          break;
        }
      }
      if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
        throwWarning(state, "deficient indentation");
      }
      return lineBreaks;
    }
    function testDocumentSeparator(state) {
      let _position = state.position;
      let ch = state.input.charCodeAt(_position);
      if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
        _position += 3;
        ch = state.input.charCodeAt(_position);
        if (ch === 0 || isWsOrEol(ch)) {
          return true;
        }
      }
      return false;
    }
    function writeFoldedLines(state, count) {
      if (count === 1) {
        state.result += " ";
      } else if (count > 1) {
        state.result += common2.repeat("\n", count - 1);
      }
    }
    function readPlainScalar(state, nodeIndent, withinFlowCollection) {
      let captureStart;
      let captureEnd;
      let hasPendingContent;
      let _line;
      let _lineStart;
      let _lineIndent;
      const _kind = state.kind;
      const _result = state.result;
      let ch = state.input.charCodeAt(state.position);
      if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
        return false;
      }
      if (ch === 63 || ch === 45) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          return false;
        }
      }
      state.kind = "scalar";
      state.result = "";
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
      while (ch !== 0) {
        if (ch === 58) {
          const following = state.input.charCodeAt(state.position + 1);
          if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
            break;
          }
        } else if (ch === 35) {
          const preceding = state.input.charCodeAt(state.position - 1);
          if (isWsOrEol(preceding)) {
            break;
          }
        } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
          break;
        } else if (isEol(ch)) {
          _line = state.line;
          _lineStart = state.lineStart;
          _lineIndent = state.lineIndent;
          skipSeparationSpace(state, false, -1);
          if (state.lineIndent >= nodeIndent) {
            hasPendingContent = true;
            ch = state.input.charCodeAt(state.position);
            continue;
          } else {
            state.position = captureEnd;
            state.line = _line;
            state.lineStart = _lineStart;
            state.lineIndent = _lineIndent;
            break;
          }
        }
        if (hasPendingContent) {
          captureSegment(state, captureStart, captureEnd, false);
          writeFoldedLines(state, state.line - _line);
          captureStart = captureEnd = state.position;
          hasPendingContent = false;
        }
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position + 1;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, captureEnd, false);
      if (state.result) {
        return true;
      }
      state.kind = _kind;
      state.result = _result;
      return false;
    }
    function readSingleQuotedScalar(state, nodeIndent) {
      let captureStart;
      let captureEnd;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 39) {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 39) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (ch === 39) {
            captureStart = state.position;
            state.position++;
            captureEnd = state.position;
          } else {
            return true;
          }
        } else if (isEol(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, "unexpected end of the document within a single quoted scalar");
        } else {
          state.position++;
          if (!isWhiteSpace(ch)) {
            captureEnd = state.position;
          }
        }
      }
      throwError(state, "unexpected end of the stream within a single quoted scalar");
    }
    function readDoubleQuotedScalar(state, nodeIndent) {
      let captureStart;
      let captureEnd;
      let tmp;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 34) {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 34) {
          captureSegment(state, captureStart, state.position, true);
          state.position++;
          return true;
        } else if (ch === 92) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (isEol(ch)) {
            skipSeparationSpace(state, false, nodeIndent);
          } else if (ch < 256 && simpleEscapeCheck[ch]) {
            state.result += simpleEscapeMap[ch];
            state.position++;
          } else if ((tmp = escapedHexLen(ch)) > 0) {
            let hexLength = tmp;
            let hexResult = 0;
            for (; hexLength > 0; hexLength--) {
              ch = state.input.charCodeAt(++state.position);
              if ((tmp = fromHexCode(ch)) >= 0) {
                hexResult = (hexResult << 4) + tmp;
              } else {
                throwError(state, "expected hexadecimal character");
              }
            }
            state.result += charFromCodepoint(hexResult);
            state.position++;
          } else {
            throwError(state, "unknown escape sequence");
          }
          captureStart = captureEnd = state.position;
        } else if (isEol(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, "unexpected end of the document within a double quoted scalar");
        } else {
          state.position++;
          if (!isWhiteSpace(ch)) {
            captureEnd = state.position;
          }
        }
      }
      throwError(state, "unexpected end of the stream within a double quoted scalar");
    }
    function readFlowCollection(state, nodeIndent) {
      let readNext = true;
      let _line;
      let _lineStart;
      let _pos;
      const _tag = state.tag;
      let _result;
      const _anchor = state.anchor;
      let terminator;
      let isPair;
      let isExplicitPair;
      let isMapping;
      const overridableKeys = /* @__PURE__ */ Object.create(null);
      let keyNode;
      let keyTag;
      let valueNode;
      let ch = state.input.charCodeAt(state.position);
      if (ch === 91) {
        terminator = 93;
        isMapping = false;
        _result = [];
      } else if (ch === 123) {
        terminator = 125;
        isMapping = true;
        _result = {};
      } else {
        return false;
      }
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      ch = state.input.charCodeAt(++state.position);
      while (ch !== 0) {
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === terminator) {
          state.position++;
          state.tag = _tag;
          state.anchor = _anchor;
          state.kind = isMapping ? "mapping" : "sequence";
          state.result = _result;
          return true;
        } else if (!readNext) {
          throwError(state, "missed comma between flow collection entries");
        } else if (ch === 44) {
          throwError(state, "expected the node content, but found ','");
        }
        keyTag = keyNode = valueNode = null;
        isPair = isExplicitPair = false;
        if (ch === 63) {
          const following = state.input.charCodeAt(state.position + 1);
          if (isWsOrEol(following)) {
            isPair = isExplicitPair = true;
            state.position++;
            skipSeparationSpace(state, true, nodeIndent);
          }
        }
        _line = state.line;
        _lineStart = state.lineStart;
        _pos = state.position;
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        keyTag = state.tag;
        keyNode = state.result;
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if ((isExplicitPair || state.line === _line) && ch === 58) {
          isPair = true;
          ch = state.input.charCodeAt(++state.position);
          skipSeparationSpace(state, true, nodeIndent);
          composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
          valueNode = state.result;
        }
        if (isMapping) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
        } else if (isPair) {
          _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
        } else {
          _result.push(keyNode);
        }
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === 44) {
          readNext = true;
          ch = state.input.charCodeAt(++state.position);
        } else {
          readNext = false;
        }
      }
      throwError(state, "unexpected end of the stream within a flow collection");
    }
    function readBlockScalar(state, nodeIndent) {
      let folding;
      let chomping = CHOMPING_CLIP;
      let didReadContent = false;
      let detectedIndent = false;
      let textIndent = nodeIndent;
      let emptyLines = 0;
      let atMoreIndented = false;
      let tmp;
      let ch = state.input.charCodeAt(state.position);
      if (ch === 124) {
        folding = false;
      } else if (ch === 62) {
        folding = true;
      } else {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      while (ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
        if (ch === 43 || ch === 45) {
          if (CHOMPING_CLIP === chomping) {
            chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
          } else {
            throwError(state, "repeat of a chomping mode identifier");
          }
        } else if ((tmp = fromDecimalCode(ch)) >= 0) {
          if (tmp === 0) {
            throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
          } else if (!detectedIndent) {
            textIndent = nodeIndent + tmp - 1;
            detectedIndent = true;
          } else {
            throwError(state, "repeat of an indentation width identifier");
          }
        } else {
          break;
        }
      }
      if (isWhiteSpace(ch)) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (isWhiteSpace(ch));
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (!isEol(ch) && ch !== 0);
        }
      }
      while (ch !== 0) {
        readLineBreak(state);
        state.lineIndent = 0;
        ch = state.input.charCodeAt(state.position);
        while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
        if (!detectedIndent && state.lineIndent > textIndent) {
          textIndent = state.lineIndent;
        }
        if (isEol(ch)) {
          emptyLines++;
          continue;
        }
        if (!detectedIndent && textIndent === 0) {
          throwError(state, "missing indentation for block scalar");
        }
        if (state.lineIndent < textIndent) {
          if (chomping === CHOMPING_KEEP) {
            state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
          } else if (chomping === CHOMPING_CLIP) {
            if (didReadContent) {
              state.result += "\n";
            }
          }
          break;
        }
        if (folding) {
          if (isWhiteSpace(ch)) {
            atMoreIndented = true;
            state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
          } else if (atMoreIndented) {
            atMoreIndented = false;
            state.result += common2.repeat("\n", emptyLines + 1);
          } else if (emptyLines === 0) {
            if (didReadContent) {
              state.result += " ";
            }
          } else {
            state.result += common2.repeat("\n", emptyLines);
          }
        } else {
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        }
        didReadContent = true;
        detectedIndent = true;
        emptyLines = 0;
        const captureStart = state.position;
        while (!isEol(ch) && ch !== 0) {
          ch = state.input.charCodeAt(++state.position);
        }
        captureSegment(state, captureStart, state.position, false);
      }
      return true;
    }
    function readBlockSequence(state, nodeIndent) {
      const _tag = state.tag;
      const _anchor = state.anchor;
      const _result = [];
      let detected = false;
      if (state.firstTabInLine !== -1) return false;
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        if (state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, "tab characters must not be used in indentation");
        }
        if (ch !== 45) {
          break;
        }
        const following = state.input.charCodeAt(state.position + 1);
        if (!isWsOrEol(following)) {
          break;
        }
        detected = true;
        state.position++;
        if (skipSeparationSpace(state, true, -1)) {
          if (state.lineIndent <= nodeIndent) {
            _result.push(null);
            ch = state.input.charCodeAt(state.position);
            continue;
          }
        }
        const _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        _result.push(state.result);
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
          throwError(state, "bad indentation of a sequence entry");
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = "sequence";
        state.result = _result;
        return true;
      }
      return false;
    }
    function readBlockMapping(state, nodeIndent, flowIndent) {
      let allowCompact;
      let _keyLine;
      let _keyLineStart;
      let _keyPos;
      const _tag = state.tag;
      const _anchor = state.anchor;
      const _result = {};
      const overridableKeys = /* @__PURE__ */ Object.create(null);
      let keyTag = null;
      let keyNode = null;
      let valueNode = null;
      let atExplicitKey = false;
      let detected = false;
      if (state.firstTabInLine !== -1) return false;
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        if (!atExplicitKey && state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, "tab characters must not be used in indentation");
        }
        const following = state.input.charCodeAt(state.position + 1);
        const _line = state.line;
        if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
          if (ch === 63) {
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = true;
            allowCompact = true;
          } else if (atExplicitKey) {
            atExplicitKey = false;
            allowCompact = true;
          } else {
            throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
          }
          state.position += 1;
          ch = following;
        } else {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
          if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
            break;
          }
          if (state.line === _line) {
            ch = state.input.charCodeAt(state.position);
            while (isWhiteSpace(ch)) {
              ch = state.input.charCodeAt(++state.position);
            }
            if (ch === 58) {
              ch = state.input.charCodeAt(++state.position);
              if (!isWsOrEol(ch)) {
                throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
              }
              if (atExplicitKey) {
                storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
                keyTag = keyNode = valueNode = null;
              }
              detected = true;
              atExplicitKey = false;
              allowCompact = false;
              keyTag = state.tag;
              keyNode = state.result;
            } else if (detected) {
              throwError(state, "can not read an implicit mapping pair; a colon is missed");
            } else {
              state.tag = _tag;
              state.anchor = _anchor;
              return true;
            }
          } else if (detected) {
            throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        }
        if (state.line === _line || state.lineIndent > nodeIndent) {
          if (atExplicitKey) {
            _keyLine = state.line;
            _keyLineStart = state.lineStart;
            _keyPos = state.position;
          }
          if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
            if (atExplicitKey) {
              keyNode = state.result;
            } else {
              valueNode = state.result;
            }
          }
          if (!atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          skipSeparationSpace(state, true, -1);
          ch = state.input.charCodeAt(state.position);
        }
        if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
          throwError(state, "bad indentation of a mapping entry");
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = "mapping";
        state.result = _result;
      }
      return detected;
    }
    function readTagProperty(state) {
      let isVerbatim = false;
      let isNamed = false;
      let tagHandle;
      let tagName;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 33) return false;
      if (state.tag !== null) {
        throwError(state, "duplication of a tag property");
      }
      ch = state.input.charCodeAt(++state.position);
      if (ch === 60) {
        isVerbatim = true;
        ch = state.input.charCodeAt(++state.position);
      } else if (ch === 33) {
        isNamed = true;
        tagHandle = "!!";
        ch = state.input.charCodeAt(++state.position);
      } else {
        tagHandle = "!";
      }
      let _position = state.position;
      if (isVerbatim) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && ch !== 62);
        if (state.position < state.length) {
          tagName = state.input.slice(_position, state.position);
          ch = state.input.charCodeAt(++state.position);
        } else {
          throwError(state, "unexpected end of the stream within a verbatim tag");
        }
      } else {
        while (ch !== 0 && !isWsOrEol(ch)) {
          if (ch === 33) {
            if (!isNamed) {
              tagHandle = state.input.slice(_position - 1, state.position + 1);
              if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
                throwError(state, "named tag handle cannot contain such characters");
              }
              isNamed = true;
              _position = state.position + 1;
            } else {
              throwError(state, "tag suffix cannot contain exclamation marks");
            }
          }
          ch = state.input.charCodeAt(++state.position);
        }
        tagName = state.input.slice(_position, state.position);
        if (PATTERN_FLOW_INDICATORS.test(tagName)) {
          throwError(state, "tag suffix cannot contain flow indicator characters");
        }
      }
      if (tagName && !PATTERN_TAG_URI.test(tagName)) {
        throwError(state, "tag name cannot contain such characters: " + tagName);
      }
      try {
        tagName = decodeURIComponent(tagName);
      } catch (err) {
        throwError(state, "tag name is malformed: " + tagName);
      }
      if (isVerbatim) {
        state.tag = tagName;
      } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
        state.tag = state.tagMap[tagHandle] + tagName;
      } else if (tagHandle === "!") {
        state.tag = "!" + tagName;
      } else if (tagHandle === "!!") {
        state.tag = "tag:yaml.org,2002:" + tagName;
      } else {
        throwError(state, 'undeclared tag handle "' + tagHandle + '"');
      }
      return true;
    }
    function readAnchorProperty(state) {
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 38) return false;
      if (state.anchor !== null) {
        throwError(state, "duplication of an anchor property");
      }
      ch = state.input.charCodeAt(++state.position);
      const _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, "name of an anchor node must contain at least one character");
      }
      state.anchor = state.input.slice(_position, state.position);
      return true;
    }
    function readAlias(state) {
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 42) return false;
      ch = state.input.charCodeAt(++state.position);
      const _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, "name of an alias node must contain at least one character");
      }
      const alias = state.input.slice(_position, state.position);
      if (!_hasOwnProperty.call(state.anchorMap, alias)) {
        throwError(state, 'unidentified alias "' + alias + '"');
      }
      state.result = state.anchorMap[alias];
      skipSeparationSpace(state, true, -1);
      return true;
    }
    function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
      const fallbackState = snapshotState(state);
      beginAnchorTransaction(state);
      restoreState(state, propertyStart);
      state.tag = null;
      state.anchor = null;
      state.kind = null;
      state.result = null;
      if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
        commitAnchorTransaction(state);
        return true;
      }
      rollbackAnchorTransaction(state);
      restoreState(state, fallbackState);
      return false;
    }
    function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
      let allowBlockScalars;
      let allowBlockCollections;
      let indentStatus = 1;
      let atNewLine = false;
      let hasContent = false;
      let propertyStart = null;
      let type2;
      let flowIndent;
      let blockIndent;
      if (state.depth >= state.maxDepth) {
        throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
      }
      state.depth += 1;
      if (state.listener !== null) {
        state.listener("open", state);
      }
      state.tag = null;
      state.anchor = null;
      state.kind = null;
      state.result = null;
      const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
      if (allowToSeek) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        }
      }
      if (indentStatus === 1) {
        while (true) {
          const ch = state.input.charCodeAt(state.position);
          const propertyState = snapshotState(state);
          if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
            break;
          }
          if (!readTagProperty(state) && !readAnchorProperty(state)) {
            break;
          }
          if (propertyStart === null) {
            propertyStart = propertyState;
          }
          if (skipSeparationSpace(state, true, -1)) {
            atNewLine = true;
            allowBlockCollections = allowBlockStyles;
            if (state.lineIndent > parentIndent) {
              indentStatus = 1;
            } else if (state.lineIndent === parentIndent) {
              indentStatus = 0;
            } else if (state.lineIndent < parentIndent) {
              indentStatus = -1;
            }
          } else {
            allowBlockCollections = false;
          }
        }
      }
      if (allowBlockCollections) {
        allowBlockCollections = atNewLine || allowCompact;
      }
      if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
        if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
          flowIndent = parentIndent;
        } else {
          flowIndent = parentIndent + 1;
        }
        blockIndent = state.position - state.lineStart;
        if (indentStatus === 1) {
          if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
            hasContent = true;
          } else {
            const ch = state.input.charCodeAt(state.position);
            if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(
              state,
              propertyStart,
              propertyStart.position - propertyStart.lineStart,
              flowIndent
            )) {
              hasContent = true;
            } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
              hasContent = true;
            } else if (readAlias(state)) {
              hasContent = true;
              if (state.tag !== null || state.anchor !== null) {
                throwError(state, "alias node should not have any properties");
              }
            } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
              hasContent = true;
              if (state.tag === null) {
                state.tag = "?";
              }
            }
            if (state.anchor !== null) {
              storeAnchor(state, state.anchor, state.result);
            }
          }
        } else if (indentStatus === 0) {
          hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
      }
      if (state.tag === null) {
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      } else if (state.tag === "?") {
        if (state.result !== null && state.kind !== "scalar") {
          throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
        }
        for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
          type2 = state.implicitTypes[typeIndex];
          if (type2.resolve(state.result)) {
            state.result = type2.construct(state.result);
            state.tag = type2.tag;
            if (state.anchor !== null) {
              storeAnchor(state, state.anchor, state.result);
            }
            break;
          }
        }
      } else if (state.tag !== "!") {
        if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
          type2 = state.typeMap[state.kind || "fallback"][state.tag];
        } else {
          type2 = null;
          const typeList = state.typeMap.multi[state.kind || "fallback"];
          for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
            if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
              type2 = typeList[typeIndex];
              break;
            }
          }
        }
        if (!type2) {
          throwError(state, "unknown tag !<" + state.tag + ">");
        }
        if (state.result !== null && type2.kind !== state.kind) {
          throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
        }
        if (!type2.resolve(state.result, state.tag)) {
          throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
        } else {
          state.result = type2.construct(state.result, state.tag);
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      }
      if (state.listener !== null) {
        state.listener("close", state);
      }
      state.depth -= 1;
      return state.tag !== null || state.anchor !== null || hasContent;
    }
    function readDocument(state) {
      const documentStart = state.position;
      let hasDirectives = false;
      let ch;
      state.version = null;
      state.checkLineBreaks = state.legacy;
      state.tagMap = /* @__PURE__ */ Object.create(null);
      state.anchorMap = /* @__PURE__ */ Object.create(null);
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if (state.lineIndent > 0 || ch !== 37) {
          break;
        }
        hasDirectives = true;
        ch = state.input.charCodeAt(++state.position);
        let _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        const directiveName = state.input.slice(_position, state.position);
        const directiveArgs = [];
        if (directiveName.length < 1) {
          throwError(state, "directive name must not be less than one character in length");
        }
        while (ch !== 0) {
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 35) {
            do {
              ch = state.input.charCodeAt(++state.position);
            } while (ch !== 0 && !isEol(ch));
            break;
          }
          if (isEol(ch)) break;
          _position = state.position;
          while (ch !== 0 && !isWsOrEol(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          directiveArgs.push(state.input.slice(_position, state.position));
        }
        if (ch !== 0) readLineBreak(state);
        if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
          directiveHandlers[directiveName](state, directiveName, directiveArgs);
        } else {
          throwWarning(state, 'unknown document directive "' + directiveName + '"');
        }
      }
      skipSeparationSpace(state, true, -1);
      if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      } else if (hasDirectives) {
        throwError(state, "directives end mark is expected");
      }
      composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
      skipSeparationSpace(state, true, -1);
      if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
        throwWarning(state, "non-ASCII line breaks are interpreted as content");
      }
      state.documents.push(state.result);
      if (state.position === state.lineStart && testDocumentSeparator(state)) {
        if (state.input.charCodeAt(state.position) === 46) {
          state.position += 3;
          skipSeparationSpace(state, true, -1);
        }
        return;
      }
      if (state.position < state.length - 1) {
        throwError(state, "end of the stream or a document separator is expected");
      }
    }
    function loadDocuments(input, options) {
      input = String(input);
      options = options || {};
      if (input.length !== 0) {
        if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
          input += "\n";
        }
        if (input.charCodeAt(0) === 65279) {
          input = input.slice(1);
        }
      }
      const state = new State(input, options);
      const nullpos = input.indexOf("\0");
      if (nullpos !== -1) {
        state.position = nullpos;
        throwError(state, "null byte is not allowed in input");
      }
      state.input += "\0";
      while (state.input.charCodeAt(state.position) === 32) {
        state.lineIndent += 1;
        state.position += 1;
      }
      while (state.position < state.length - 1) {
        readDocument(state);
      }
      return state.documents;
    }
    function loadAll2(input, iterator, options) {
      if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
        options = iterator;
        iterator = null;
      }
      const documents = loadDocuments(input, options);
      if (typeof iterator !== "function") {
        return documents;
      }
      for (let index = 0, length = documents.length; index < length; index += 1) {
        iterator(documents[index]);
      }
    }
    function load2(input, options) {
      const documents = loadDocuments(input, options);
      if (documents.length === 0) {
        return void 0;
      } else if (documents.length === 1) {
        return documents[0];
      }
      throw new YAMLException2("expected a single document in the stream, but found more");
    }
    loader.loadAll = loadAll2;
    loader.load = load2;
    return loader;
  }
  var dumper = {};
  var hasRequiredDumper;
  function requireDumper() {
    if (hasRequiredDumper) return dumper;
    hasRequiredDumper = 1;
    const common2 = requireCommon();
    const YAMLException2 = requireException();
    const DEFAULT_SCHEMA2 = require_default();
    const _toString = Object.prototype.toString;
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    const CHAR_BOM = 65279;
    const CHAR_TAB = 9;
    const CHAR_LINE_FEED = 10;
    const CHAR_CARRIAGE_RETURN = 13;
    const CHAR_SPACE = 32;
    const CHAR_EXCLAMATION = 33;
    const CHAR_DOUBLE_QUOTE = 34;
    const CHAR_SHARP = 35;
    const CHAR_PERCENT = 37;
    const CHAR_AMPERSAND = 38;
    const CHAR_SINGLE_QUOTE = 39;
    const CHAR_ASTERISK = 42;
    const CHAR_COMMA = 44;
    const CHAR_MINUS = 45;
    const CHAR_COLON = 58;
    const CHAR_EQUALS = 61;
    const CHAR_GREATER_THAN = 62;
    const CHAR_QUESTION = 63;
    const CHAR_COMMERCIAL_AT = 64;
    const CHAR_LEFT_SQUARE_BRACKET = 91;
    const CHAR_RIGHT_SQUARE_BRACKET = 93;
    const CHAR_GRAVE_ACCENT = 96;
    const CHAR_LEFT_CURLY_BRACKET = 123;
    const CHAR_VERTICAL_LINE = 124;
    const CHAR_RIGHT_CURLY_BRACKET = 125;
    const ESCAPE_SEQUENCES = {};
    ESCAPE_SEQUENCES[0] = "\\0";
    ESCAPE_SEQUENCES[7] = "\\a";
    ESCAPE_SEQUENCES[8] = "\\b";
    ESCAPE_SEQUENCES[9] = "\\t";
    ESCAPE_SEQUENCES[10] = "\\n";
    ESCAPE_SEQUENCES[11] = "\\v";
    ESCAPE_SEQUENCES[12] = "\\f";
    ESCAPE_SEQUENCES[13] = "\\r";
    ESCAPE_SEQUENCES[27] = "\\e";
    ESCAPE_SEQUENCES[34] = '\\"';
    ESCAPE_SEQUENCES[92] = "\\\\";
    ESCAPE_SEQUENCES[133] = "\\N";
    ESCAPE_SEQUENCES[160] = "\\_";
    ESCAPE_SEQUENCES[8232] = "\\L";
    ESCAPE_SEQUENCES[8233] = "\\P";
    const DEPRECATED_BOOLEANS_SYNTAX = [
      "y",
      "Y",
      "yes",
      "Yes",
      "YES",
      "on",
      "On",
      "ON",
      "n",
      "N",
      "no",
      "No",
      "NO",
      "off",
      "Off",
      "OFF"
    ];
    const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
    function compileStyleMap(schema2, map2) {
      if (map2 === null) return {};
      const result = {};
      const keys = Object.keys(map2);
      for (let index = 0, length = keys.length; index < length; index += 1) {
        let tag = keys[index];
        let style = String(map2[tag]);
        if (tag.slice(0, 2) === "!!") {
          tag = "tag:yaml.org,2002:" + tag.slice(2);
        }
        const type2 = schema2.compiledTypeMap["fallback"][tag];
        if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
          style = type2.styleAliases[style];
        }
        result[tag] = style;
      }
      return result;
    }
    function encodeHex(character) {
      let handle;
      let length;
      const string = character.toString(16).toUpperCase();
      if (character <= 255) {
        handle = "x";
        length = 2;
      } else if (character <= 65535) {
        handle = "u";
        length = 4;
      } else if (character <= 4294967295) {
        handle = "U";
        length = 8;
      } else {
        throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
      }
      return "\\" + handle + common2.repeat("0", length - string.length) + string;
    }
    const QUOTING_TYPE_SINGLE = 1;
    const QUOTING_TYPE_DOUBLE = 2;
    function State(options) {
      this.schema = options["schema"] || DEFAULT_SCHEMA2;
      this.indent = Math.max(1, options["indent"] || 2);
      this.noArrayIndent = options["noArrayIndent"] || false;
      this.skipInvalid = options["skipInvalid"] || false;
      this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
      this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
      this.sortKeys = options["sortKeys"] || false;
      this.lineWidth = options["lineWidth"] || 80;
      this.noRefs = options["noRefs"] || false;
      this.noCompatMode = options["noCompatMode"] || false;
      this.condenseFlow = options["condenseFlow"] || false;
      this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
      this.forceQuotes = options["forceQuotes"] || false;
      this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
      this.implicitTypes = this.schema.compiledImplicit;
      this.explicitTypes = this.schema.compiledExplicit;
      this.tag = null;
      this.result = "";
      this.duplicates = [];
      this.usedDuplicates = null;
    }
    function indentString(string, spaces) {
      const ind = common2.repeat(" ", spaces);
      let position = 0;
      let result = "";
      const length = string.length;
      while (position < length) {
        let line;
        const next = string.indexOf("\n", position);
        if (next === -1) {
          line = string.slice(position);
          position = length;
        } else {
          line = string.slice(position, next + 1);
          position = next + 1;
        }
        if (line.length && line !== "\n") result += ind;
        result += line;
      }
      return result;
    }
    function generateNextLine(state, level) {
      return "\n" + common2.repeat(" ", state.indent * level);
    }
    function testImplicitResolving(state, str2) {
      for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
        const type2 = state.implicitTypes[index];
        if (type2.resolve(str2)) {
          return true;
        }
      }
      return false;
    }
    function isWhitespace(c) {
      return c === CHAR_SPACE || c === CHAR_TAB;
    }
    function isPrintable(c) {
      return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
    }
    function isNsCharOrWhitespace(c) {
      return isPrintable(c) && c !== CHAR_BOM && // - b-char
      c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
    }
    function isPlainSafe(c, prev, inblock) {
      const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
      const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
      return (
        // ns-plain-safe
        (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && // - c-flow-indicator
        c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && // ns-plain-char
        c !== CHAR_SHARP && // false on '#'
        !(prev === CHAR_COLON && !cIsNsChar) || // false on ': '
        isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || // change to true on '[^ ]#'
        prev === CHAR_COLON && cIsNsChar
      );
    }
    function isPlainSafeFirst(c) {
      return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && // - s-white
      // - (c-indicator ::=
      // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
      c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
      c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && // | “%” | “@” | “`”)
      c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
    }
    function isPlainSafeLast(c) {
      return !isWhitespace(c) && c !== CHAR_COLON;
    }
    function codePointAt(string, pos) {
      const first = string.charCodeAt(pos);
      let second;
      if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
        second = string.charCodeAt(pos + 1);
        if (second >= 56320 && second <= 57343) {
          return (first - 55296) * 1024 + second - 56320 + 65536;
        }
      }
      return first;
    }
    function needIndentIndicator(string) {
      const leadingSpaceRe = /^\n* /;
      return leadingSpaceRe.test(string);
    }
    const STYLE_PLAIN = 1;
    const STYLE_SINGLE = 2;
    const STYLE_LITERAL = 3;
    const STYLE_FOLDED = 4;
    const STYLE_DOUBLE = 5;
    function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
      let i;
      let char = 0;
      let prevChar = null;
      let hasLineBreak = false;
      let hasFoldableLine = false;
      const shouldTrackWidth = lineWidth !== -1;
      let previousLineBreak = -1;
      let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
      if (singleLineOnly || forceQuotes) {
        for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
      } else {
        for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (char === CHAR_LINE_FEED) {
            hasLineBreak = true;
            if (shouldTrackWidth) {
              hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
              i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
              previousLineBreak = i;
            }
          } else if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
        hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
      }
      if (!hasLineBreak && !hasFoldableLine) {
        if (plain && !forceQuotes && !testAmbiguousType(string)) {
          return STYLE_PLAIN;
        }
        return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
      }
      if (indentPerLevel > 9 && needIndentIndicator(string)) {
        return STYLE_DOUBLE;
      }
      if (!forceQuotes) {
        return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    function writeScalar(state, string, level, iskey, inblock) {
      state.dump = (function() {
        if (string.length === 0) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
        }
        if (!state.noCompatMode) {
          if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
            return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
          }
        }
        const indent = state.indent * Math.max(1, level);
        const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
        const singleLineOnly = iskey || // No block styles in flow mode.
        state.flowLevel > -1 && level >= state.flowLevel;
        function testAmbiguity(string2) {
          return testImplicitResolving(state, string2);
        }
        switch (chooseScalarStyle(
          string,
          singleLineOnly,
          state.indent,
          lineWidth,
          testAmbiguity,
          state.quotingType,
          state.forceQuotes && !iskey,
          inblock
        )) {
          case STYLE_PLAIN:
            return string;
          case STYLE_SINGLE:
            return "'" + string.replace(/'/g, "''") + "'";
          case STYLE_LITERAL:
            return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
          case STYLE_FOLDED:
            return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
          case STYLE_DOUBLE:
            return '"' + escapeString(string) + '"';
          default:
            throw new YAMLException2("impossible error: invalid scalar style");
        }
      })();
    }
    function blockHeader(string, indentPerLevel) {
      const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
      const clip = string[string.length - 1] === "\n";
      const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
      const chomp = keep ? "+" : clip ? "" : "-";
      return indentIndicator + chomp + "\n";
    }
    function dropEndingNewline(string) {
      return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
    }
    function foldString(string, width) {
      const lineRe = /(\n+)([^\n]*)/g;
      let result = (function() {
        let nextLF = string.indexOf("\n");
        nextLF = nextLF !== -1 ? nextLF : string.length;
        lineRe.lastIndex = nextLF;
        return foldLine(string.slice(0, nextLF), width);
      })();
      let prevMoreIndented = string[0] === "\n" || string[0] === " ";
      let moreIndented;
      let match;
      while (match = lineRe.exec(string)) {
        const prefix = match[1];
        const line = match[2];
        moreIndented = line[0] === " ";
        result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
        prevMoreIndented = moreIndented;
      }
      return result;
    }
    function foldLine(line, width) {
      if (line === "" || line[0] === " ") return line;
      const breakRe = / [^ ]/g;
      let match;
      let start = 0;
      let end;
      let curr = 0;
      let next = 0;
      let result = "";
      while (match = breakRe.exec(line)) {
        next = match.index;
        if (next - start > width) {
          end = curr > start ? curr : next;
          result += "\n" + line.slice(start, end);
          start = end + 1;
        }
        curr = next;
      }
      result += "\n";
      if (line.length - start > width && curr > start) {
        result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
      } else {
        result += line.slice(start);
      }
      return result.slice(1);
    }
    function escapeString(string) {
      let result = "";
      let char = 0;
      for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        const escapeSeq = ESCAPE_SEQUENCES[char];
        if (!escapeSeq && isPrintable(char)) {
          result += string[i];
          if (char >= 65536) result += string[i + 1];
        } else {
          result += escapeSeq || encodeHex(char);
        }
      }
      return result;
    }
    function writeFlowSequence(state, level, object) {
      let _result = "";
      const _tag = state.tag;
      for (let index = 0, length = object.length; index < length; index += 1) {
        let value = object[index];
        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }
        if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
          if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = "[" + _result + "]";
    }
    function writeBlockSequence(state, level, object, compact) {
      let _result = "";
      const _tag = state.tag;
      for (let index = 0, length = object.length; index < length; index += 1) {
        let value = object[index];
        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }
        if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
          if (!compact || _result !== "") {
            _result += generateNextLine(state, level);
          }
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            _result += "-";
          } else {
            _result += "- ";
          }
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = _result || "[]";
    }
    function writeFlowMapping(state, level, object) {
      let _result = "";
      const _tag = state.tag;
      const objectKeyList = Object.keys(object);
      for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
        let pairBuffer = "";
        if (_result !== "") pairBuffer += ", ";
        if (state.condenseFlow) pairBuffer += '"';
        const objectKey = objectKeyList[index];
        let objectValue = object[objectKey];
        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }
        if (!writeNode(state, level, objectKey, false, false)) {
          continue;
        }
        if (state.dump.length > 1024) pairBuffer += "? ";
        pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
        if (!writeNode(state, level, objectValue, false, false)) {
          continue;
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = "{" + _result + "}";
    }
    function writeBlockMapping(state, level, object, compact) {
      let _result = "";
      const _tag = state.tag;
      const objectKeyList = Object.keys(object);
      if (state.sortKeys === true) {
        objectKeyList.sort();
      } else if (typeof state.sortKeys === "function") {
        objectKeyList.sort(state.sortKeys);
      } else if (state.sortKeys) {
        throw new YAMLException2("sortKeys must be a boolean or a function");
      }
      for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
        let pairBuffer = "";
        if (!compact || _result !== "") {
          pairBuffer += generateNextLine(state, level);
        }
        const objectKey = objectKeyList[index];
        let objectValue = object[objectKey];
        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }
        if (!writeNode(state, level + 1, objectKey, true, true, true)) {
          continue;
        }
        const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
        if (explicitPair) {
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            pairBuffer += "?";
          } else {
            pairBuffer += "? ";
          }
        }
        pairBuffer += state.dump;
        if (explicitPair) {
          pairBuffer += generateNextLine(state, level);
        }
        if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
          continue;
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += ":";
        } else {
          pairBuffer += ": ";
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = _result || "{}";
    }
    function detectType(state, object, explicit) {
      const typeList = explicit ? state.explicitTypes : state.implicitTypes;
      for (let index = 0, length = typeList.length; index < length; index += 1) {
        const type2 = typeList[index];
        if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
          if (explicit) {
            if (type2.multi && type2.representName) {
              state.tag = type2.representName(object);
            } else {
              state.tag = type2.tag;
            }
          } else {
            state.tag = "?";
          }
          if (type2.represent) {
            const style = state.styleMap[type2.tag] || type2.defaultStyle;
            let _result;
            if (_toString.call(type2.represent) === "[object Function]") {
              _result = type2.represent(object, style);
            } else if (_hasOwnProperty.call(type2.represent, style)) {
              _result = type2.represent[style](object, style);
            } else {
              throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
            }
            state.dump = _result;
          }
          return true;
        }
      }
      return false;
    }
    function writeNode(state, level, object, block, compact, iskey, isblockseq) {
      state.tag = null;
      state.dump = object;
      if (!detectType(state, object, false)) {
        detectType(state, object, true);
      }
      const type2 = _toString.call(state.dump);
      const inblock = block;
      if (block) {
        block = state.flowLevel < 0 || state.flowLevel > level;
      }
      const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
      let duplicateIndex;
      let duplicate;
      if (objectOrArray) {
        duplicateIndex = state.duplicates.indexOf(object);
        duplicate = duplicateIndex !== -1;
      }
      if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
        compact = false;
      }
      if (duplicate && state.usedDuplicates[duplicateIndex]) {
        state.dump = "*ref_" + duplicateIndex;
      } else {
        if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
          state.usedDuplicates[duplicateIndex] = true;
        }
        if (type2 === "[object Object]") {
          if (block && Object.keys(state.dump).length !== 0) {
            writeBlockMapping(state, level, state.dump, compact);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + state.dump;
            }
          } else {
            writeFlowMapping(state, level, state.dump);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + " " + state.dump;
            }
          }
        } else if (type2 === "[object Array]") {
          if (block && state.dump.length !== 0) {
            if (state.noArrayIndent && !isblockseq && level > 0) {
              writeBlockSequence(state, level - 1, state.dump, compact);
            } else {
              writeBlockSequence(state, level, state.dump, compact);
            }
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + state.dump;
            }
          } else {
            writeFlowSequence(state, level, state.dump);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + " " + state.dump;
            }
          }
        } else if (type2 === "[object String]") {
          if (state.tag !== "?") {
            writeScalar(state, state.dump, level, iskey, inblock);
          }
        } else if (type2 === "[object Undefined]") {
          return false;
        } else {
          if (state.skipInvalid) return false;
          throw new YAMLException2("unacceptable kind of an object to dump " + type2);
        }
        if (state.tag !== null && state.tag !== "?") {
          let tagStr = encodeURI(
            state.tag[0] === "!" ? state.tag.slice(1) : state.tag
          ).replace(/!/g, "%21");
          if (state.tag[0] === "!") {
            tagStr = "!" + tagStr;
          } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
            tagStr = "!!" + tagStr.slice(18);
          } else {
            tagStr = "!<" + tagStr + ">";
          }
          state.dump = tagStr + " " + state.dump;
        }
      }
      return true;
    }
    function getDuplicateReferences(object, state) {
      const objects = [];
      const duplicatesIndexes = [];
      inspectNode(object, objects, duplicatesIndexes);
      const length = duplicatesIndexes.length;
      for (let index = 0; index < length; index += 1) {
        state.duplicates.push(objects[duplicatesIndexes[index]]);
      }
      state.usedDuplicates = new Array(length);
    }
    function inspectNode(object, objects, duplicatesIndexes) {
      if (object !== null && typeof object === "object") {
        const index = objects.indexOf(object);
        if (index !== -1) {
          if (duplicatesIndexes.indexOf(index) === -1) {
            duplicatesIndexes.push(index);
          }
        } else {
          objects.push(object);
          if (Array.isArray(object)) {
            for (let i = 0, length = object.length; i < length; i += 1) {
              inspectNode(object[i], objects, duplicatesIndexes);
            }
          } else {
            const objectKeyList = Object.keys(object);
            for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
              inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
            }
          }
        }
      }
    }
    function dump2(input, options) {
      options = options || {};
      const state = new State(options);
      if (!state.noRefs) getDuplicateReferences(input, state);
      let value = input;
      if (state.replacer) {
        value = state.replacer.call({ "": value }, "", value);
      }
      if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
      return "";
    }
    dumper.dump = dump2;
    return dumper;
  }
  var hasRequiredJsYaml;
  function requireJsYaml() {
    if (hasRequiredJsYaml) return jsYaml;
    hasRequiredJsYaml = 1;
    const loader2 = requireLoader();
    const dumper2 = requireDumper();
    function renamed(from, to) {
      return function() {
        throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
      };
    }
    jsYaml.Type = requireType();
    jsYaml.Schema = requireSchema();
    jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
    jsYaml.JSON_SCHEMA = requireJson();
    jsYaml.CORE_SCHEMA = requireCore();
    jsYaml.DEFAULT_SCHEMA = require_default();
    jsYaml.load = loader2.load;
    jsYaml.loadAll = loader2.loadAll;
    jsYaml.dump = dumper2.dump;
    jsYaml.YAMLException = requireException();
    jsYaml.types = {
      binary: requireBinary(),
      float: requireFloat(),
      map: requireMap(),
      null: require_null(),
      pairs: requirePairs(),
      set: requireSet(),
      timestamp: requireTimestamp(),
      bool: requireBool(),
      int: requireInt(),
      merge: requireMerge(),
      omap: requireOmap(),
      seq: requireSeq(),
      str: requireStr()
    };
    jsYaml.safeLoad = renamed("safeLoad", "load");
    jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
    jsYaml.safeDump = renamed("safeDump", "dump");
    return jsYaml;
  }
  var jsYamlExports = requireJsYaml();
  var yaml = /* @__PURE__ */ getDefaultExportFromCjs(jsYamlExports);
  var {
    Type,
    Schema,
    FAILSAFE_SCHEMA,
    JSON_SCHEMA,
    CORE_SCHEMA,
    DEFAULT_SCHEMA,
    load,
    loadAll,
    dump,
    YAMLException,
    types,
    safeLoad,
    safeLoadAll,
    safeDump
  } = yaml;

  // src/v040-extension.tmp.js
  (() => {
    "use strict";
    const EXT_VERSION = "0.4.0";
    const Card = customElements.get("glt-flow-card");
    const Editor = customElements.get("glt-flow-card-editor");
    if (!Card || !Editor) {
      console.warn("GLT Flow Card v0.4 extensions: base card/editor not registered.");
      return;
    }
    const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
    const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const slug = (value) => String(value || "project").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "project";
    const nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
    const POWER = /* @__PURE__ */ new Set(["W", "kW", "MW"]);
    const TREND_COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e", "#ec4899", "#06b6d4"];
    function field(value) {
      if (!value) return null;
      if (typeof value === "string") return { entity: value };
      if (typeof value === "object" && value.entity) return value;
      return null;
    }
    function yamlConfig(config) {
      return yaml.dump(config, {
        noRefs: true,
        lineWidth: 120,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false
      });
    }
    function parseYaml(text) {
      const parsed = yaml.load(String(text || ""));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Die YAML-Konfiguration muss ein Objekt enthalten.");
      }
      if (parsed.type && parsed.type !== "custom:glt-flow-card") {
        throw new Error(`Unerwarteter Kartentyp: ${parsed.type}`);
      }
      return parsed;
    }
    function download(name, content, type2 = "text/plain;charset=utf-8") {
      const blob = new Blob([content], { type: type2 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }
    async function copyText(text) {
      if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    function csvCell(value) {
      const s = String(value ?? "");
      return /[;\n"]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    }
    function localRead(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_err) {
        return fallback;
      }
    }
    function localWrite(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_err) {
      }
    }
    class ProjectStore {
      constructor(hass) {
        this.hass = hass;
        this.backend = null;
      }
      async _ws(type2, payload = {}) {
        if (!this.hass?.callWS) throw new Error("No Home Assistant WebSocket API");
        try {
          const result = await this.hass.callWS({ type: `glt_flow_card/${type2}`, ...payload });
          this.backend = true;
          return result;
        } catch (err) {
          this.backend = false;
          throw err;
        }
      }
      async listProjects() {
        try {
          return await this._ws("projects/list");
        } catch (err) {
          if (this.hass?.callWS) throw err;
          return localRead("glt-flow-card.projects", []);
        }
      }
      async getProject(id) {
        try {
          return await this._ws("projects/get", { project_id: id });
        } catch (err) {
          if (this.hass?.callWS) throw err;
          return localRead("glt-flow-card.projects", []).find((p) => p.id === id) || null;
        }
      }
      async saveProject(project, options = {}) {
        try {
          return await this._ws("projects/save", { project, autosave: !!options.autosave });
        } catch (err) {
          if (this.hass?.callWS) throw err;
          const list = localRead("glt-flow-card.projects", []);
          const current = list.find((p) => p.id === project.id);
          const stamp = nowIso();
          const entry = { ...current, ...clone(project), updated: stamp };
          entry.versions = Array.isArray(current?.versions) ? current.versions : [];
          if (!options.autosave && current?.config) {
            entry.versions.unshift({ id: `${Date.now()}`, created: stamp, config: current.config });
            entry.versions = entry.versions.slice(0, 30);
          }
          const next = list.filter((p) => p.id !== entry.id);
          next.unshift(entry);
          localWrite("glt-flow-card.projects", next);
          return entry;
        }
      }
      async deleteProject(id) {
        try {
          return await this._ws("projects/delete", { project_id: id });
        } catch (err) {
          if (this.hass?.callWS) throw err;
          localWrite("glt-flow-card.projects", localRead("glt-flow-card.projects", []).filter((p) => p.id !== id));
          return true;
        }
      }
      async listTemplates() {
        try {
          return await this._ws("templates/list");
        } catch (_err) {
          return localRead("glt-flow-card.templates", []);
        }
      }
      async saveTemplate(template) {
        try {
          return await this._ws("templates/save", { template });
        } catch (_err) {
          const list = localRead("glt-flow-card.templates", []).filter((t) => t.id !== template.id);
          list.unshift({ ...template, updated: nowIso() });
          localWrite("glt-flow-card.templates", list);
          return template;
        }
      }
      async deleteTemplate(id) {
        try {
          return await this._ws("templates/delete", { template_id: id });
        } catch (_err) {
          localWrite("glt-flow-card.templates", localRead("glt-flow-card.templates", []).filter((t) => t.id !== id));
          return true;
        }
      }
      async audit(action, detail = {}) {
        const event = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: nowIso(), action, detail };
        try {
          return await this._ws("audit/add", { event });
        } catch (_err) {
          const list = localRead("glt-flow-card.audit", []);
          list.unshift(event);
          localWrite("glt-flow-card.audit", list.slice(0, 500));
          return event;
        }
      }
      async listAudit(limit = 200) {
        try {
          return await this._ws("audit/list", { limit });
        } catch (_err) {
          return localRead("glt-flow-card.audit", []).slice(0, limit);
        }
      }
    }
    function ensureV4Config(config) {
      config.project = config.project || {};
      config.groups = Array.isArray(config.groups) ? config.groups : [];
      config.sites = Array.isArray(config.sites) ? config.sites : [];
      config.alarms = Array.isArray(config.alarms) ? config.alarms : [];
      config.assets = Array.isArray(config.assets) ? config.assets : [];
      config.permissions = {
        designers: [],
        operators: [],
        viewers: [],
        confirm_controls: true,
        ...config.permissions || {}
      };
      config.reports = { enabled: true, ...config.reports || {} };
      config.trend = { multi_axis: true, statistics: true, compare_24h: true, export_csv: true, ...config.trend || {} };
      config.routing = { automatic: true, orthogonal: true, padding: 36, ...config.routing || {} };
      return config;
    }
    function roleFor(config, hass) {
      const user = hass?.user;
      if (user?.is_admin) return "designer";
      const id = user?.id;
      const p = config?.permissions || {};
      if (id && p.designers?.includes(id)) return "designer";
      if (id && p.operators?.includes(id)) return "operator";
      return "viewer";
    }
    function canOperate(config, hass) {
      return ["operator", "designer"].includes(roleFor(config, hass));
    }
    function canDesign(config, hass) {
      return roleFor(config, hass) === "designer";
    }
    /* Retired in Phase 6, reachable and inert.
     *
     * This was a string-membership test with no operator, no threshold, no
     * hysteresis and no delay, so it disagreed with the Companion for every
     * alarm that has a condition -- a flow temperature of 55 against a limit of
     * 80 read as active, because "55" was not in its inactive list. It was one
     * of four derivations of "is this alarm active" in the product, and they
     * disagreed with each other.
     *
     * The Companion evaluates now, and every surface renders what it evaluated.
     * The entry point stays so a test can prove the replacement rather than
     * prove the absence of something nothing checks -- the same retirement
     * Phase 5 gave the midpoint router.
     *
     * It reads the state the Companion published and derives nothing. Absent
     * state answers "not active", because a card that has not yet been told is
     * a card that does not know.
     */
    function activeAlarm(card, alarm) {
      const published = card._alarmState;
      if (!published) return false;
      const row = published[String(alarm.id)];
      return Boolean(row && row.active);
    }
    function equipmentPos(config, id, viewId) {
      const item = config.equipment.find((x) => x.id === id);
      if (!item) return null;
      const p = item.positions?.[viewId] || item;
      return { x: +p.x || 0, y: +p.y || 0, width: +(p.width || item.width || 220), height: +(p.height || item.height || 130) };
    }
    /**
     * Route one connection with the Phase-5 router.
     *
     * What this replaces was the elbow through the midpoint: out to half the
     * horizontal distance, across, and in. It ignored every obstacle in the
     * room, which is why the Phase-5 corpus was built to defeat it.
     *
     * When the router is not published, this refuses and leaves the existing
     * points alone. Falling back to the old shape would put a pipe through a
     * chiller in exactly the situation nobody is watching.
     */
    function autoRoute(config, path, viewId) {
      if (!path?.from_equipment || !path?.to_equipment || path.auto_route === false) return path?.points;
      const routing = globalThis.GLT_FLOW_CARD_ROUTING;
      if (!routing) return path.points;
      const a = equipmentPos(config, path.from_equipment, viewId);
      const b = equipmentPos(config, path.to_equipment, viewId);
      if (!a || !b) return path.points;
      const clearance = Number(config.routing?.clearance) || routing.DEFAULT_CLEARANCE;
      const obstacles = [];
      for (const item of config.equipment || []) {
        if (item.id === path.from_equipment || item.id === path.to_equipment) continue;
        const box = equipmentPos(config, item.id, viewId);
        if (box) obstacles.push({ id: item.id, x: box.x, y: box.y, width: box.width, height: box.height });
      }
      const facing = (from, to) => (from.x + from.width / 2 <= to.x + to.width / 2 ? "right" : "left");
      const routed = routing.routePath({
        source: { x: a.x, y: a.y, width: a.width, height: a.height, side: facing(a, b) },
        target: { x: b.x, y: b.y, width: b.width, height: b.height, side: facing(b, a) },
        obstacles,
        options: { clearance },
      });
      // An explicit refusal keeps the drawing as it was and records why, rather
      // than drawing a route the router just said does not exist.
      if (!routed.routable) {
        path.route_refused = routed.reason;
        return path.points;
      }
      delete path.route_refused;
      return routed.points.map(([x, y]) => [Math.round(x), Math.round(y)]);
    }

    /** Per-config geometry from the last sweep, so the next one can be local. */
    const ROUTE_GEOMETRY = new WeakMap();

    /**
     * Recompute the routes a change reached, and no others.
     *
     * This walked every path in the view on every emit. On a diagram of any
     * size that is the freeze the roadmap names, and it ran on every keystroke
     * that touched the config.
     *
     * A route is recomputed when one of its own endpoints moved, or when a
     * piece of equipment that moved lies inside its corridor -- the same
     * relevance the Phase-5 router uses, so the cheap answer is the answer a
     * full sweep would have given.
     */
    function reroute(config, viewId) {
      if (config.routing?.automatic === false) return [];
      const routing = globalThis.GLT_FLOW_CARD_ROUTING;
      const clearance = Number(config.routing?.clearance) || (routing?.DEFAULT_CLEARANCE ?? 20);
      const key = String(viewId ?? "");
      const held = ROUTE_GEOMETRY.get(config) || {};
      const previous = held[key];
      const current = {};
      for (const item of config.equipment || []) {
        const box = equipmentPos(config, item.id, viewId);
        if (box) current[item.id] = box;
      }
      const moved = [];
      for (const [id, box] of Object.entries(current)) {
        const before = previous?.[id];
        if (!before || before.x !== box.x || before.y !== box.y
          || before.width !== box.width || before.height !== box.height) moved.push(box);
      }
      const recomputed = [];
      for (const path of config.paths || []) {
        if (!path.from_equipment || !path.to_equipment || path.auto_route === false) continue;
        const drawn = Array.isArray(path.points) && path.points.length > 0;
        if (previous && drawn && !reaches(path, moved, clearance)) continue;
        const points = autoRoute(config, path, viewId);
        if (points) {
          path.points = points;
          recomputed.push(path.id);
        }
      }
      held[key] = current;
      ROUTE_GEOMETRY.set(config, held);
      return recomputed;
    }

    /** Whether any moved box lies in this route's corridor. */
    function reaches(path, moved, clearance) {
      if (moved.length === 0) return false;
      const xs = path.points.map((point) => point[0]);
      const ys = path.points.map((point) => point[1]);
      const corridor = {
        left: Math.min(...xs) - clearance, right: Math.max(...xs) + clearance,
        top: Math.min(...ys) - clearance, bottom: Math.max(...ys) + clearance,
      };
      return moved.some((box) => (
        corridor.left < box.x + box.width + clearance && box.x - clearance < corridor.right
        && corridor.top < box.y + box.height + clearance && box.y - clearance < corridor.bottom
      ));
    }
    function editorStore(editor) {
      editor._glt4Store = editor._glt4Store || new ProjectStore(editor._hass || editor._glt4Hass);
      editor._glt4Store.hass = editor._hass || editor._glt4Hass;
      return editor._glt4Store;
    }
    const EDITOR_EXTRA_STYLES = `
    .glt4-bar{display:flex;gap:5px;align-items:center;flex-wrap:wrap;padding:6px 10px;border-bottom:1px solid var(--b);background:color-mix(in srgb,var(--bg) 97%,var(--e) 3%)}
    .glt4-btn{height:31px;border:1px solid var(--b);background:var(--bg);border-radius:8px;padding:0 9px;color:var(--mut);font-size:9px;font-weight:750;cursor:pointer}
    .glt4-btn:hover,.glt4-btn.on{color:var(--e);border-color:color-mix(in srgb,var(--e) 55%,var(--b));background:var(--eb)}
    .glt4-spacer{flex:1}.glt4-readonly{padding:7px 10px;background:#f59e0b18;color:#b45309;font-size:9px;font-weight:700;border-bottom:1px solid #f59e0b44}
    .glt4-notice{margin-top:10px;padding:10px 12px;border:1px solid currentColor;border-radius:10px;min-height:44px;display:flex;align-items:center;gap:8px}.glt4-modal{position:fixed;inset:0;z-index:10000;background:#020617b8;display:grid;place-items:center;padding:22px}.glt4-dialog{width:min(920px,96vw);max-height:90vh;overflow:auto;border:1px solid var(--b);border-radius:16px;background:var(--bg);color:var(--tx);box-shadow:0 24px 70px #02061788}
    .glt4-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--b);background:var(--bg)}.glt4-head b{font-size:13px}.glt4-body{padding:14px}.glt4-close{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--mut);cursor:pointer}
    .glt4-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}.glt4-card{padding:11px;border:1px solid var(--b);border-radius:12px;background:color-mix(in srgb,var(--bg) 97%,#64748b 3%)}.glt4-card b{display:block;font-size:11px}.glt4-card small{display:block;margin-top:3px;color:var(--mut);font-size:8px}.glt4-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}
    .glt4-input,.glt4-select,.glt4-textarea{width:100%;border:1px solid var(--b);border-radius:9px;background:var(--bg);color:var(--tx);padding:8px;font-size:10px}.glt4-textarea{min-height:360px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.45;resize:vertical}
    .glt4-table{width:100%;border-collapse:collapse;font-size:9px}.glt4-table th,.glt4-table td{text-align:left;padding:7px;border-bottom:1px solid var(--b);vertical-align:middle}.glt4-table th{color:var(--mut);font-size:8px;text-transform:uppercase}
    .glt4-badge{display:inline-flex;padding:3px 6px;border-radius:999px;background:var(--eb);color:var(--e);font-size:8px;font-weight:750}.glt4-danger{color:#dc2626}.glt4-ok{color:#16a34a}
    .glt4-site-select{height:29px;border:1px solid var(--b);border-radius:8px;background:var(--bg);font-size:9px;padding:0 6px;color:var(--mut)}
    .glt4-multi{outline:2px dashed #8b5cf6!important;outline-offset:3px}.glt4-group{outline:2px solid #f59e0b!important;outline-offset:3px}
    .glt4-entity-row{display:grid;grid-template-columns:1fr 130px 90px 32px;gap:6px;align-items:center;margin-bottom:7px}.glt4-entity-row ha-entity-picker{min-width:0}
    @media(max-width:800px){.glt4-entity-row{grid-template-columns:1fr}.glt4-dialog{width:98vw}}
  `;
    /**
     * Confirm a destructive editor step through the Phase-2 element.
     *
     * `window.confirm` is a browser-owned authority prompt: the kiosk's key
     * handling cannot reach it, no stylesheet can make it legible in forced
     * colours, and the effect ledger that proves this card asks for nothing it
     * should not cannot observe it. Phase 4 deliberately left these for Phase 5;
     * this is the replacement, and it is the same element every control
     * confirmation already uses, so the safe choice takes focus in one place.
     */
    function editorConfirm(editor, message, onConfirm) {
      const root = editor.shadowRoot;
      root.querySelector("glt-flow-card-control-confirm")?.remove();
      const node = document.createElement("glt-flow-card-control-confirm");
      node.dataset.editorConfirm = "1";
      node.copy = (key) => (key === "controlConfirmHeading" ? message : key);
      root.appendChild(node);
      node.props = {
        control: { phase: "confirm", controlId: "editor", preview: { label: message, summary: message } },
        onConfirm: () => { node.remove(); onConfirm(); },
        onCancel: () => node.remove(),
      };
    }

    /**
     * Say why nothing happened, inside the editor.
     *
     * `alert` has the same problems as `confirm` and one more: it is modal, so a
     * refusal that could have been a sentence next to the button becomes a
     * blocking interruption the operator has to dismiss before they can look at
     * what they got wrong.
     */
    function editorNotice(editor, message) {
      const root = editor.shadowRoot;
      root.querySelector("[data-editor-notice]")?.remove();
      const strip = document.createElement("div");
      strip.dataset.editorNotice = "1";
      strip.setAttribute("role", "status");
      strip.setAttribute("aria-live", "polite");
      strip.className = "glt4-notice";
      strip.textContent = message;
      (root.querySelector(".glt4-body") || root).appendChild(strip);
    }

    function modal(editor, title, html) {
      editor.shadowRoot.querySelector(".glt4-modal")?.remove();
      const shell = document.createElement("div");
      shell.className = "glt4-modal";
      shell.innerHTML = `<div class="glt4-dialog"><div class="glt4-head"><b>${esc(title)}</b><button class="glt4-close">\u2715</button></div><div class="glt4-body">${html}</div></div>`;
      shell.querySelector(".glt4-close").onclick = () => shell.remove();
      shell.addEventListener("click", (e) => {
        if (e.target === shell) shell.remove();
      });
      editor.shadowRoot.appendChild(shell);
      return shell;
    }
    function selectedRef(editor) {
      if (!editor._sel) return null;
      return { kind: editor._sel.k, id: editor._sel.id };
    }
    async function showProjects(editor) {
      const store = editorStore(editor);
      const list = await store.listProjects();
      const currentId = editor._glt4ProjectId || editor._config.project?.id;
      const cards = list.map((p) => `<div class="glt4-card"><b>${esc(p.name || p.id)}</b><small>${esc(p.updated || "")} \xB7 ${(p.versions || []).length} Versionen ${p.id === currentId ? "\xB7 AKTIV" : ""}</small><div class="glt4-actions"><button class="glt4-btn" data-load="${esc(p.id)}">Laden</button><button class="glt4-btn" data-versions="${esc(p.id)}">Versionen</button><button class="glt4-btn glt4-danger" data-delete="${esc(p.id)}">L\xF6schen</button></div></div>`).join("");
      const m = modal(editor, "Projektbibliothek", `<div class="glt4-actions" style="margin:0 0 12px"><button class="glt4-btn" data-save>Aktuelles Projekt speichern</button><button class="glt4-btn" data-copy>Als neues Projekt speichern</button></div><div class="glt4-grid">${cards || '<div class="glt4-card">Noch keine gespeicherten Projekte.</div>'}</div><p style="font-size:9px;color:var(--mut);margin-top:12px">Mit installierter Companion-Integration werden Projekte ger\xE4te\xFCbergreifend in Home Assistant gespeichert; sonst lokal im Browser.</p>`);
      m.querySelector("[data-save]").onclick = async () => {
        const name = editor._config.project?.name || prompt("Projektname", editor._config.title || "GLT Projekt") || "GLT Projekt";
        const id = currentId || slug(name) + "-" + Date.now().toString(36);
        editor._config.project = { ...editor._config.project || {}, id, name };
        editor._glt4ProjectId = id;
        await store.saveProject({ id, name, config: clone(editor._config) });
        await store.audit("project.save", { id, name });
        m.remove();
        editor._render();
      };
      m.querySelector("[data-copy]").onclick = async () => {
        const name = prompt("Name f\xFCr das neue Projekt", `${editor._config.title || "GLT"} Kopie`);
        if (!name) return;
        const id = slug(name) + "-" + Date.now().toString(36);
        editor._config.project = { id, name };
        editor._glt4ProjectId = id;
        await store.saveProject({ id, name, config: clone(editor._config) });
        await store.audit("project.save_as", { id, name });
        m.remove();
        editor._render();
      };
      m.querySelectorAll("[data-load]").forEach((b) => b.onclick = async () => {
        const p = await store.getProject(b.dataset.load);
        if (!p?.config) return;
        editor._glt4ProjectId = p.id;
        editor.setConfig(ensureV4Config(clone(p.config)));
        editor._emit();
        await store.audit("project.load", { id: p.id, name: p.name });
        m.remove();
      });
      m.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => {
        editorConfirm(editor, "Projekt wirklich l\xF6schen?", async () => {
          await store.deleteProject(b.dataset.delete);
          await store.audit("project.delete", { id: b.dataset.delete });
          m.remove();
          showProjects(editor);
        });
      });
      m.querySelectorAll("[data-versions]").forEach((b) => b.onclick = async () => {
        const p = await store.getProject(b.dataset.versions);
        const versions = (p?.versions || []).map((v) => `<tr><td>${esc(v.created || v.at || v.id)}</td><td><button class="glt4-btn" data-restore="${esc(v.id)}">Wiederherstellen</button></td></tr>`).join("");
        const vm = modal(editor, `Versionen \xB7 ${p?.name || p?.id}`, `<table class="glt4-table"><thead><tr><th>Zeitpunkt</th><th></th></tr></thead><tbody>${versions || '<tr><td colspan="2">Keine \xE4lteren Versionen.</td></tr>'}</tbody></table>`);
        vm.querySelectorAll("[data-restore]").forEach((rb) => rb.onclick = async () => {
          const version = (p.versions || []).find((v) => v.id === rb.dataset.restore);
          if (!version?.config) return;
          editor.setConfig(ensureV4Config(clone(version.config)));
          editor._emit();
          await store.audit("project.restore_version", { project_id: p.id, version_id: version.id });
          vm.remove();
        });
      });
    }
    function showYaml(editor, importMode = false) {
      const text = importMode ? "" : yamlConfig(editor._config);
      const m = modal(editor, importMode ? "YAML importieren" : "Lovelace YAML", `<textarea class="glt4-textarea" data-yaml placeholder="type: custom:glt-flow-card
...">${esc(text)}</textarea><div class="glt4-actions"><input type="file" accept=".yaml,.yml,text/yaml" data-file style="display:none"><button class="glt4-btn" data-filebtn>Datei \xF6ffnen</button><button class="glt4-btn" data-import>Importieren & weiterbearbeiten</button><button class="glt4-btn" data-copy>YAML kopieren</button><button class="glt4-btn" data-download>YAML herunterladen</button></div><div data-error style="margin-top:9px;color:#dc2626;font-size:9px"></div>`);
      const area = m.querySelector("[data-yaml]");
      m.querySelector("[data-filebtn]").onclick = () => m.querySelector("[data-file]").click();
      m.querySelector("[data-file]").onchange = async (e) => {
        const f = e.target.files?.[0];
        if (f) area.value = await f.text();
      };
      m.querySelector("[data-copy]").onclick = async () => {
        await copyText(area.value || yamlConfig(editor._config));
        await editorStore(editor).audit("yaml.copy", {});
      };
      m.querySelector("[data-download]").onclick = () => download(`${slug(editor._config.project?.name || editor._config.title)}.yaml`, area.value || yamlConfig(editor._config), "application/yaml;charset=utf-8");
      m.querySelector("[data-import]").onclick = async () => {
        try {
          const imported = ensureV4Config(parseYaml(area.value));
          editor._remember?.();
          editor.setConfig(imported);
          editor._emit();
          await editorStore(editor).audit("yaml.import", { title: imported.title });
          m.remove();
        } catch (err) {
          m.querySelector("[data-error]").textContent = err.message || String(err);
        }
      };
    }
    async function showTemplates(editor) {
      const store = editorStore(editor);
      const list = await store.listTemplates();
      const builtins = [
        { id: "builtin-hp-buffer", name: "W\xE4rmepumpe + Puffer", kind: "equipment", object: { type: "heat_pump", symbol: "heat_pump_neo", name: "W\xE4rmepumpe", width: 240, height: 150, fields: [] } },
        { id: "builtin-ahu", name: "RLT-Zentrale", kind: "equipment", object: { type: "ahu", symbol: "ahu", name: "RLT-Zentrale", width: 300, height: 170, fields: [] } },
        { id: "builtin-pump", name: "Umw\xE4lzpumpe", kind: "equipment", object: { type: "pump", symbol: "pump_circulation", name: "Pumpe", width: 140, height: 95, fields: [] } },
        { id: "builtin-dp", name: "Temperatur-Datenpunkt", kind: "datapoint", object: { kind: "temperature", label: "Temperatur", entity: "" } }
      ];
      const all = [...builtins, ...list];
      const m = modal(editor, "Vorlagen & Bauteil-Templates", `<div class="glt4-actions" style="margin:0 0 12px"><button class="glt4-btn" data-save>Auswahl als Vorlage speichern</button></div><div class="glt4-grid">${all.map((t) => `<div class="glt4-card"><b>${esc(t.name)}</b><small>${esc(t.kind || "equipment")}${t.updated ? ` \xB7 ${esc(t.updated)}` : ""}</small><div class="glt4-actions"><button class="glt4-btn" data-apply="${esc(t.id)}">Einf\xFCgen</button>${t.id.startsWith("builtin-") ? "" : `<button class="glt4-btn glt4-danger" data-del="${esc(t.id)}">L\xF6schen</button>`}</div></div>`).join("")}</div>`);
      m.querySelector("[data-save]").onclick = async () => {
        const obj = editor._obj?.();
        if (!obj) return editorNotice(editor, "Zuerst ein Bauteil, Datenpunkt, Pfad oder KPI ausw\xE4hlen.");
        const name = prompt("Vorlagenname", obj.name || obj.label || obj.id);
        if (!name) return;
        const t = { id: slug(name) + "-" + Date.now().toString(36), name, kind: editor._sel.k, object: clone(obj) };
        await store.saveTemplate(t);
        await store.audit("template.save", { id: t.id, name });
        m.remove();
        showTemplates(editor);
      };
      m.querySelectorAll("[data-apply]").forEach((b) => b.onclick = () => {
        const t = all.find((x) => x.id === b.dataset.apply);
        if (!t) return;
        editor._remember?.();
        const o = clone(t.object);
        o.id = editor._id?.(t.kind === "datapoint" ? "dp" : t.kind || "tpl") || `${Date.now()}`;
        if (t.kind === "datapoint") {
          o.positions = { [editor._viewId]: { x: 400, y: 300 } };
          editor._config.datapoints.push(o);
          editor._sel = { k: "datapoint", id: o.id };
        } else if (t.kind === "path") {
          o.points = (o.points || [[300, 300], [600, 300]]).map((p) => [p[0] + 40, p[1] + 40]);
          editor._config.paths.push(o);
          editor._sel = { k: "path", id: o.id };
        } else if (t.kind === "kpi") {
          editor._config.kpis.push(o);
          editor._sel = { k: "kpi", id: o.id };
        } else {
          o.x = (o.x || 300) + 40;
          o.y = (o.y || 260) + 40;
          editor._config.equipment.push(o);
          editor._sel = { k: "equipment", id: o.id };
        }
        editor._emit();
        editor._render();
        m.remove();
      });
      m.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
        await store.deleteTemplate(b.dataset.del);
        m.remove();
        showTemplates(editor);
      });
    }
    function showGroups(editor) {
      const groups = editor._config.groups || [];
      const m = modal(editor, "Gruppen & Unteranlagen", `<div class="glt4-actions" style="margin:0 0 12px"><button class="glt4-btn" data-create>Aus Mehrfachauswahl gruppieren</button></div><div class="glt4-grid">${groups.map((g) => `<div class="glt4-card"><b>${esc(g.name)}</b><small>${(g.members || []).length} Elemente</small><div class="glt4-actions"><button class="glt4-btn" data-select="${g.id}">Markieren</button><button class="glt4-btn" data-template="${g.id}">Als Anlagenvorlage</button><button class="glt4-btn glt4-danger" data-delete="${g.id}">Aufl\xF6sen</button></div></div>`).join("") || '<div class="glt4-card">Noch keine Gruppen. Mehrere Elemente mit Strg/Shift ausw\xE4hlen.</div>'}</div>`);
      m.querySelector("[data-create]").onclick = () => {
        const members = Array.from(editor._glt4Multi || []).map((key) => {
          const [kind, id] = key.split(":");
          return { kind, id };
        });
        if (members.length < 2) return editorNotice(editor, "Mindestens zwei Elemente per Strg/Shift ausw\xE4hlen.");
        const name = prompt("Gruppenname", "Unteranlage");
        if (!name) return;
        editor._remember?.();
        editor._config.groups.push({ id: slug(name) + "-" + Date.now().toString(36), name, members });
        editor._emit();
        editor._render();
        m.remove();
      };
      m.querySelectorAll("[data-select]").forEach((b) => b.onclick = () => {
        const g = groups.find((x) => x.id === b.dataset.select);
        editor._glt4Multi = new Set((g?.members || []).map((x) => `${x.kind}:${x.id}`));
        editor._glt4ActiveGroup = g?.id;
        editor._render();
        m.remove();
      });
      m.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => {
        editor._remember?.();
        editor._config.groups = groups.filter((x) => x.id !== b.dataset.delete);
        editor._emit();
        editor._render();
        m.remove();
      });
      m.querySelectorAll("[data-template]").forEach((b) => b.onclick = async () => {
        const g = groups.find((x) => x.id === b.dataset.template);
        if (!g) return;
        const objects = (g.members || []).map((r) => {
          const arr = r.kind === "equipment" ? editor._config.equipment : r.kind === "datapoint" ? editor._config.datapoints : r.kind === "path" ? editor._config.paths : editor._config.kpis;
          return { kind: r.kind, object: clone(arr.find((x) => x.id === r.id)) };
        }).filter((x) => x.object);
        await editorStore(editor).saveTemplate({ id: `group-${g.id}-${Date.now().toString(36)}`, name: g.name, kind: "group", objects });
        editorNotice(editor, "Unteranlage als Vorlage gespeichert.");
      });
    }
    function showAutoRoute(editor) {
      const eq = editor._config.equipment || [];
      const multi = Array.from(editor._glt4Multi || []).map((x) => x.split(":"));
      const selectedEq = multi.filter((x) => x[0] === "equipment").map((x) => x[1]);
      const a0 = selectedEq[0] || eq[0]?.id || "", b0 = selectedEq[1] || eq[1]?.id || "";
      const options = eq.map((e) => `<option value="${esc(e.id)}">${esc(e.name || e.id)}</option>`).join("");
      const mediumOpts = [["heating_supply", "Vorlauf"], ["heating_return", "R\xFCcklauf"], ["cooling_supply", "K\xE4lte VL"], ["cooling_return", "K\xE4lte RL"], ["air_supply", "Zuluft"], ["air_extract", "Abluft"], ["electrical", "Elektrisch"], ["neutral", "Neutral"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
      const m = modal(editor, "Automatisch verbinden", `<div class="glt4-grid"><label>Von<select class="glt4-select" data-from>${options}</select></label><label>Nach<select class="glt4-select" data-to>${options}</select></label><label>Medium<select class="glt4-select" data-medium>${mediumOpts}</select></label></div><div class="glt4-actions"><button class="glt4-btn" data-create>Orthogonale Verbindung erstellen</button></div><p style="font-size:9px;color:var(--mut)">Auto-Routen bleiben an den Bauteilen verankert und werden beim Verschieben neu berechnet.</p>`);
      m.querySelector("[data-from]").value = a0;
      m.querySelector("[data-to]").value = b0;
      m.querySelector("[data-create]").onclick = () => {
        const from = m.querySelector("[data-from]").value, to = m.querySelector("[data-to]").value;
        if (!from || !to || from === to) return;
        editor._remember?.();
        const p = { id: editor._id?.("path") || `path_${Date.now()}`, medium: m.querySelector("[data-medium]").value, width: 8, from_equipment: from, to_equipment: to, auto_route: true, points: [] };
        p.points = autoRoute(editor._config, p, editor._viewId) || [];
        editor._config.paths.push(p);
        editor._sel = { k: "path", id: p.id };
        editor._emit();
        editor._render();
        m.remove();
      };
    }
    function bindPicker(picker, hass, value, domains, onChange) {
      picker.hass = hass;
      picker.value = value || "";
      if (domains?.length) picker.includeDomains = domains;
      picker.addEventListener("value-changed", (e) => onChange(e.detail?.value || ""));
    }
    function showAlarmsEditor(editor) {
      const rows = (editor._config.alarms || []).map((a, i) => `<div class="glt4-entity-row" data-row="${i}"><ha-entity-picker data-ent></ha-entity-picker><input class="glt4-input" data-name value="${esc(a.name || "")}" placeholder="Name"><select class="glt4-select" data-sev><option value="critical">St\xF6rung</option><option value="warning">Warnung</option><option value="info">Hinweis</option></select><button class="glt4-btn glt4-danger" data-rm>\u2715</button></div>`).join("");
      const m = modal(editor, "Alarme & Meldungen", `<div data-rows>${rows}</div><div class="glt4-actions"><button class="glt4-btn" data-add>Alarm hinzuf\xFCgen</button><button class="glt4-btn" data-save>\xDCbernehmen</button></div><p style="font-size:9px;color:var(--mut)">Optional k\xF6nnen pro Alarm in YAML zus\xE4tzlich <code>ack.service</code>, <code>active_states</code> und <code>inactive_states</code> gesetzt werden.</p>`);
      const setup = () => m.querySelectorAll("[data-row]").forEach((row, i) => {
        const a = editor._config.alarms[i] || {};
        const p = row.querySelector("ha-entity-picker");
        bindPicker(p, editor._hass, field(a.entity)?.entity || a.entity, ["binary_sensor", "sensor", "alarm_control_panel"], (v) => row.dataset.entity = v);
        row.dataset.entity = field(a.entity)?.entity || a.entity || "";
        row.querySelector("[data-sev]").value = a.severity || "warning";
        row.querySelector("[data-rm]").onclick = () => row.remove();
      });
      setup();
      m.querySelector("[data-add]").onclick = () => {
        const i = m.querySelectorAll("[data-row]").length;
        const div = document.createElement("div");
        div.className = "glt4-entity-row";
        div.dataset.row = i;
        div.innerHTML = '<ha-entity-picker data-ent></ha-entity-picker><input class="glt4-input" data-name placeholder="Name"><select class="glt4-select" data-sev><option value="critical">St\xF6rung</option><option value="warning">Warnung</option><option value="info">Hinweis</option></select><button class="glt4-btn glt4-danger" data-rm>\u2715</button>';
        m.querySelector("[data-rows]").appendChild(div);
        bindPicker(div.querySelector("ha-entity-picker"), editor._hass, "", ["binary_sensor", "sensor", "alarm_control_panel"], (v) => div.dataset.entity = v);
        div.querySelector("[data-rm]").onclick = () => div.remove();
      };
      m.querySelector("[data-save]").onclick = () => {
        editor._remember?.();
        editor._config.alarms = Array.from(m.querySelectorAll("[data-row]")).map((r, i) => ({ id: editor._config.alarms[i]?.id || `alarm_${Date.now()}_${i}`, entity: r.dataset.entity || "", name: r.querySelector("[data-name]").value || r.dataset.entity, severity: r.querySelector("[data-sev]").value })).filter((x) => x.entity);
        editor._emit();
        editor._render();
        m.remove();
      };
    }
    function showAssetsEditor(editor) {
      const assets = editor._config.assets || [];
      const html = assets.map((a, i) => `<tr data-asset="${i}"><td><input class="glt4-input" data-name value="${esc(a.name || a.id || "")}"></td><td><ha-entity-picker data-hours></ha-entity-picker></td><td><input class="glt4-input" type="number" data-interval value="${esc(a.service_interval_hours || "")}"></td><td><input class="glt4-input" type="date" data-date value="${esc(a.due_date || "")}"></td><td><button class="glt4-btn glt4-danger" data-rm>\u2715</button></td></tr>`).join("");
      const m = modal(editor, "Wartung & Assets", `<table class="glt4-table"><thead><tr><th>Asset</th><th>Betriebsstunden</th><th>Intervall h</th><th>F\xE4llig</th><th></th></tr></thead><tbody data-body>${html}</tbody></table><div class="glt4-actions"><button class="glt4-btn" data-add>Asset hinzuf\xFCgen</button><button class="glt4-btn" data-save>\xDCbernehmen</button></div><p style="font-size:9px;color:var(--mut)">Dokumente, Ersatzteil-Links und Notizen k\xF6nnen zus\xE4tzlich per YAML unter <code>documents</code>, <code>parts</code> und <code>notes</code> hinterlegt werden.</p>`);
      const setupRow = (r, a = {}) => {
        bindPicker(r.querySelector("ha-entity-picker"), editor._hass, field(a.entity_hours)?.entity || a.entity_hours, ["sensor"], (v) => r.dataset.hours = v);
        r.dataset.hours = field(a.entity_hours)?.entity || a.entity_hours || "";
        r.querySelector("[data-rm]").onclick = () => r.remove();
      };
      m.querySelectorAll("[data-asset]").forEach((r, i) => setupRow(r, assets[i]));
      m.querySelector("[data-add]").onclick = () => {
        const r = document.createElement("tr");
        r.dataset.asset = "new";
        r.innerHTML = '<td><input class="glt4-input" data-name placeholder="Asset"></td><td><ha-entity-picker data-hours></ha-entity-picker></td><td><input class="glt4-input" type="number" data-interval></td><td><input class="glt4-input" type="date" data-date></td><td><button class="glt4-btn glt4-danger" data-rm>\u2715</button></td>';
        m.querySelector("[data-body]").appendChild(r);
        setupRow(r, {});
      };
      m.querySelector("[data-save]").onclick = () => {
        editor._remember?.();
        editor._config.assets = Array.from(m.querySelectorAll("[data-asset]")).map((r, i) => ({ id: assets[i]?.id || `asset_${Date.now()}_${i}`, name: r.querySelector("[data-name]").value || `Asset ${i + 1}`, entity_hours: r.dataset.hours || "", service_interval_hours: +r.querySelector("[data-interval]").value || void 0, due_date: r.querySelector("[data-date]").value || void 0, documents: assets[i]?.documents || [], parts: assets[i]?.parts || [], notes: assets[i]?.notes || "" }));
        editor._emit();
        editor._render();
        m.remove();
      };
    }
    function showSites(editor) {
      const sites = editor._config.sites || [];
      const m = modal(editor, "Multi-Anlagen / Standorte", `<table class="glt4-table"><thead><tr><th>ID</th><th>Name</th><th></th></tr></thead><tbody data-body>${sites.map((s, i) => `<tr data-site="${i}"><td><input class="glt4-input" data-id value="${esc(s.id)}"></td><td><input class="glt4-input" data-name value="${esc(s.name || s.id)}"></td><td><button class="glt4-btn glt4-danger" data-rm>\u2715</button></td></tr>`).join("")}</tbody></table><div class="glt4-actions"><button class="glt4-btn" data-add>Standort hinzuf\xFCgen</button><button class="glt4-btn" data-save>\xDCbernehmen</button></div><p style="font-size:9px;color:var(--mut)">Bauteilen, Pfaden und Datenpunkten kann im Eigenschaftenbereich ein Standort zugeordnet werden.</p>`);
      const bind = () => m.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => b.closest("tr").remove());
      bind();
      m.querySelector("[data-add]").onclick = () => {
        const r = document.createElement("tr");
        r.dataset.site = "new";
        r.innerHTML = '<td><input class="glt4-input" data-id placeholder="site_a"></td><td><input class="glt4-input" data-name placeholder="Heizzentrale"></td><td><button class="glt4-btn glt4-danger" data-rm>\u2715</button></td>';
        m.querySelector("[data-body]").appendChild(r);
        bind();
      };
      m.querySelector("[data-save]").onclick = () => {
        editor._remember?.();
        editor._config.sites = Array.from(m.querySelectorAll("[data-site]")).map((r) => ({ id: slug(r.querySelector("[data-id]").value), name: r.querySelector("[data-name]").value || r.querySelector("[data-id]").value })).filter((s) => s.id);
        editor._emit();
        editor._render();
        m.remove();
      };
    }
    function showPermissions(editor) {
      const p = editor._config.permissions || {};
      const m = modal(editor, "Benutzer & Rechte", `<p style="font-size:9px;color:var(--mut)">Home-Assistant-Administratoren sind immer Designer. Weitere Benutzer werden \xFCber ihre HA-User-ID zugeordnet.</p><div class="glt4-grid"><label>Designer<textarea class="glt4-textarea" style="min-height:90px" data-designers>${esc((p.designers || []).join("\n"))}</textarea></label><label>Operatoren<textarea class="glt4-textarea" style="min-height:90px" data-operators>${esc((p.operators || []).join("\n"))}</textarea></label><label>Viewer<textarea class="glt4-textarea" style="min-height:90px" data-viewers>${esc((p.viewers || []).join("\n"))}</textarea></label></div><label style="display:flex;gap:7px;align-items:center;margin-top:10px;font-size:10px"><input type="checkbox" data-confirm ${p.confirm_controls !== false ? "checked" : ""}> Bedienaktionen best\xE4tigen</label><div class="glt4-actions"><button class="glt4-btn" data-save>\xDCbernehmen</button></div>`);
      m.querySelector("[data-save]").onclick = () => {
        const lines = (s) => s.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);
        editor._remember?.();
        editor._config.permissions = { ...p, designers: lines(m.querySelector("[data-designers]").value), operators: lines(m.querySelector("[data-operators]").value), viewers: lines(m.querySelector("[data-viewers]").value), confirm_controls: m.querySelector("[data-confirm]").checked };
        editor._emit();
        editor._render();
        m.remove();
      };
    }
    async function showAudit(editor) {
      const events = await editorStore(editor).listAudit(250);
      modal(editor, "Audit-Log", `<table class="glt4-table"><thead><tr><th>Zeit</th><th>Benutzer</th><th>Aktion</th><th>Details</th></tr></thead><tbody>${events.map((e) => `<tr><td>${esc(e.at || "")}</td><td>${esc(e.user_name || e.user_id || "lokal")}</td><td>${esc(e.action)}</td><td><code>${esc(JSON.stringify(e.detail || {}))}</code></td></tr>`).join("") || '<tr><td colspan="4">Noch keine Audit-Eintr\xE4ge.</td></tr>'}</tbody></table>`);
    }
    function enhanceInspector(editor) {
      const insp = editor.shadowRoot.querySelector(".insp");
      if (!insp || !editor._sel) return;
      const obj = editor._obj?.();
      if (!obj) return;
      if (editor._config.sites?.length) {
        const sec = document.createElement("div");
        sec.className = "sec glt4-site-inspector";
        sec.innerHTML = `<div class="st">Standort <span class="chip">Multi-Site</span></div><select class="glt4-select" data-glt4-site><option value="">Alle / global</option>${editor._config.sites.map((s) => `<option value="${esc(s.id)}" ${obj.site === s.id ? "selected" : ""}>${esc(s.name || s.id)}</option>`).join("")}</select>`;
        sec.querySelector("select").onchange = (e) => {
          editor._remember?.();
          obj.site = e.target.value || void 0;
          editor._emit();
          editor._render();
        };
        insp.prepend(sec);
      }
    }
    function enhanceMultiSelect(editor) {
      const root = editor.shadowRoot;
      editor._glt4Multi = editor._glt4Multi || /* @__PURE__ */ new Set();
      root.querySelectorAll('[data-k="equipment"],[data-k="datapoint"],[data-k="path"]').forEach((n) => {
        const key = `${n.dataset.k}:${n.dataset.id}`;
        if (editor._glt4Multi.has(key)) n.classList.add("glt4-multi");
        if ((editor._config.groups || []).some((g) => g.id === editor._glt4ActiveGroup && (g.members || []).some((m) => `${m.kind}:${m.id}` === key))) n.classList.add("glt4-group");
        n.addEventListener("click", (e) => {
          if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          if (editor._glt4Multi.has(key)) editor._glt4Multi.delete(key);
          else editor._glt4Multi.add(key);
          editor._render();
        }, true);
      });
    }
    function editorToolbar(editor) {
      const de = editor.shadowRoot.querySelector(".de");
      if (!de || de.querySelector(".glt4-bar")) return;
      const bar = document.createElement("div");
      bar.className = "glt4-bar";
      bar.innerHTML = `<button class="glt4-btn" data-g4="projects">Projekte</button><button class="glt4-btn" data-g4="yaml-import">YAML Import</button><button class="glt4-btn" data-g4="yaml">YAML Export</button><button class="glt4-btn" data-g4="templates">Vorlagen</button><button class="glt4-btn" data-g4="groups">Gruppen</button><button class="glt4-btn" data-g4="route">Auto-Verbinden</button><button class="glt4-btn" data-g4="sites">Standorte</button><button class="glt4-btn" data-g4="alarms">Alarme</button><button class="glt4-btn" data-g4="assets">Wartung</button><span class="glt4-spacer"></span><button class="glt4-btn" data-g4="permissions">Rechte</button><button class="glt4-btn" data-g4="audit">Audit</button>`;
      de.querySelector(".dt")?.after(bar);
      const actions = { projects: () => showProjects(editor), "yaml-import": () => showYaml(editor, true), yaml: () => showYaml(editor, false), templates: () => showTemplates(editor), groups: () => showGroups(editor), route: () => showAutoRoute(editor), sites: () => showSites(editor), alarms: () => showAlarmsEditor(editor), assets: () => showAssetsEditor(editor), permissions: () => showPermissions(editor), audit: () => showAudit(editor) };
      bar.querySelectorAll("[data-g4]").forEach((b) => b.onclick = () => actions[b.dataset.g4]?.());
    }
    const editorHass = Object.getOwnPropertyDescriptor(Editor.prototype, "hass");
    if (editorHass?.set) Object.defineProperty(Editor.prototype, "hass", { configurable: true, get: editorHass.get, set(h) {
      this._glt4Hass = h;
      editorHass.set.call(this, h);
      if (this._glt4Store) this._glt4Store.hass = h;
    } });
    const originalSetConfig = Editor.prototype.setConfig;
    Editor.prototype.setConfig = function(config) {
      config = ensureV4Config(clone(config || {}));
      this._glt4ProjectId = config.project?.id || this._glt4ProjectId;
      return originalSetConfig.call(this, config);
    };
    const originalEmit = Editor.prototype._emit;
    Editor.prototype._emit = function() {
      ensureV4Config(this._config);
      reroute(this._config, this._viewId);
      const result = originalEmit.call(this);
      clearTimeout(this._glt4AutosaveTimer);
      this._glt4AutosaveTimer = setTimeout(async () => {
        const id = this._glt4ProjectId || this._config.project?.id;
        if (id) {
          const name = this._config.project?.name || this._config.title || id;
          await editorStore(this).saveProject({ id, name, config: clone(this._config) }, { autosave: true });
        } else {
          localWrite("glt-flow-card.autosave", { at: nowIso(), config: this._config });
        }
      }, 900);
      return result;
    };
    const originalRender = Editor.prototype._render;
    Editor.prototype._render = function() {
      const result = originalRender.call(this);
      const style = document.createElement("style");
      style.textContent = EDITOR_EXTRA_STYLES;
      this.shadowRoot.appendChild(style);
      editorToolbar(this);
      enhanceInspector(this);
      enhanceMultiSelect(this);
      const role = roleFor(this._config, this._hass || this._glt4Hass);
      if (role !== "designer") {
        const de = this.shadowRoot.querySelector(".de");
        if (de && !de.querySelector(".glt4-readonly")) {
          const b = document.createElement("div");
          b.className = "glt4-readonly";
          b.textContent = `Nur-Lesen: Rolle ${role}. \xC4nderungen sind nur f\xFCr Designer erlaubt.`;
          de.querySelector(".dt")?.after(b);
        }
        this.shadowRoot.querySelectorAll("input,select,textarea,.pi,[draggable=true],[data-act],[data-g4]").forEach((el) => {
          if (el.dataset.g4 === "yaml" || el.dataset.g4 === "projects") return;
          el.disabled = true;
          el.draggable = false;
        });
      }
      return result;
    };
    const originalStart = Editor.prototype._start;
    Editor.prototype._start = function(e, k, id, m, hi = null) {
      let members = [];
      if (m === "move") {
        const group = (this._config.groups || []).find((g) => (g.members || []).some((x) => x.kind === k && x.id === id));
        if (group) members = clone(group.members || []);
        else if (this._glt4Multi?.size > 1 && this._glt4Multi.has(`${k}:${id}`)) members = Array.from(this._glt4Multi).map((x) => {
          const [kind, mid] = x.split(":");
          return { kind, id: mid };
        });
      }
      const snap = members.map((r) => {
        const arr = r.kind === "equipment" ? this._config.equipment : r.kind === "datapoint" ? this._config.datapoints : r.kind === "path" ? this._config.paths : this._config.kpis;
        const o = arr.find((x) => x.id === r.id);
        if (!o) return null;
        if (r.kind === "datapoint") return { ...r, pos: clone(o.positions?.[this._viewId] || o) };
        if (r.kind === "path") return { ...r, points: clone(o.points || []) };
        return { ...r, pos: { x: +o.x || 0, y: +o.y || 0 } };
      }).filter(Boolean);
      const result = originalStart.call(this, e, k, id, m, hi);
      if (snap.length) this._glt4GroupSnapshot = { members: snap, anchor: `${k}:${id}` };
      return result;
    };
    const originalMove = Editor.prototype._move;
    Editor.prototype._move = function(e) {
      const gs = this._glt4GroupSnapshot, d = this._drag;
      if (gs && d?.m === "move") {
        const dx = (e.clientX - d.sx) / this._zoom, dy = (e.clientY - d.sy) / this._zoom;
        for (const s of gs.members) {
          if (`${s.kind}:${s.id}` === gs.anchor) continue;
          const arr = s.kind === "equipment" ? this._config.equipment : s.kind === "datapoint" ? this._config.datapoints : s.kind === "path" ? this._config.paths : this._config.kpis;
          const o = arr.find((x) => x.id === s.id);
          if (!o) continue;
          if (s.kind === "equipment") {
            o.x = this._sv(s.pos.x + dx);
            o.y = this._sv(s.pos.y + dy);
          } else if (s.kind === "datapoint") {
            o.positions = o.positions || {};
            o.positions[this._viewId] = { x: this._sv((s.pos.x || 0) + dx), y: this._sv((s.pos.y || 0) + dy) };
          } else if (s.kind === "path") {
            o.points = s.points.map((p) => [this._sv(p[0] + dx), this._sv(p[1] + dy)]);
          }
        }
      }
      return originalMove.call(this, e);
    };
    const originalKey = Editor.prototype._key;
    Editor.prototype._key = function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        showProjects(this);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        showYaml(this, true);
        return;
      }
      return originalKey.call(this, e);
    };
    const RUNTIME_STYLES = `
    .glt4-tool{display:flex;align-items:center;gap:4px}.glt4-pill{border:1px solid var(--glt-border);background:transparent;color:var(--secondary-text-color);height:30px;padding:0 8px;border-radius:9px;font-size:10px;font-weight:700;cursor:pointer}.glt4-pill:hover,.glt4-pill.on{color:var(--glt-accent);background:var(--glt-accent-soft)}
    .glt4-runtime-panel{padding:12px 14px;border-top:1px solid var(--glt-border);background:color-mix(in srgb,var(--card-background-color) 97%,#64748b 3%)}.glt4-runtime-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.glt4-runtime-card{padding:10px;border:1px solid var(--glt-border);border-radius:12px;background:var(--card-background-color)}.glt4-runtime-card b{display:block;font-size:12px}.glt4-runtime-card small{display:block;margin-top:3px;color:var(--secondary-text-color);font-size:9px}.glt4-runtime-card.critical{border-color:#ef444466}.glt4-runtime-card.warning{border-color:#f59e0b66}.glt4-runtime-card.info{border-color:#06b6d466}.glt4-runtime-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.glt4-runtime-actions button{border:1px solid var(--glt-border);border-radius:8px;background:transparent;color:var(--secondary-text-color);padding:5px 7px;font-size:9px;cursor:pointer}
    .glt4-site-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:7px;padding:0 14px 10px}.glt4-site-card{padding:9px;border:1px solid var(--glt-border);border-radius:11px;background:var(--glt-panel);font-size:10px;cursor:pointer}.glt4-site-card b{display:block}.glt4-site-card span{color:var(--secondary-text-color);font-size:9px}
    .glt4-trendplus{margin-top:10px;padding:10px;border:1px solid var(--glt-border);border-radius:12px}.glt4-statgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px;margin-bottom:9px}.glt4-stat{padding:7px;border:1px solid var(--glt-border);border-radius:9px;font-size:9px}.glt4-stat b{display:block;font-size:10px}.glt4-axis-svg{width:100%;height:250px;background:color-mix(in srgb,var(--card-background-color) 97%,#64748b 3%);border-radius:9px}.glt4-axis-label{font-size:10px;fill:var(--secondary-text-color)}
  `;
    const originalVisible = Card.prototype._visibleInView;
    Card.prototype._visibleInView = function(item) {
      if (!originalVisible.call(this, item)) return false;
      const site = this._glt4Site || "all";
      return site === "all" || !item.site || item.site === site;
    };
    // Retired (04-13, applied to the shipped bytes in 05-14). The original
    // override was two browser-invented authorizations in a row: a role check
    // the browser had no business making, and a window.confirm standing in for
    // one. Both are gone, and with them the call through to the base tap, which
    // reached hass.callService directly. The surviving operate path is the
    // server-composed panel, whose controls the Companion has already
    // authorized. This stays reachable, and inert, so the effect ledger can
    // prove no tap action produces a service call.
    Card.prototype._tapEntity = function(entityId) {
      this._glt4Store?.audit("control.blocked", { entity_id: entityId, reason: "legacy_tap_retired" });
      return undefined;
    };
    function runtimeStore(card) {
      card._glt4Store = card._glt4Store || new ProjectStore(card._hass);
      card._glt4Store.hass = card._hass;
      return card._glt4Store;
    }
    function alarmsMarkup(card) {
      const alarms = (card._config.alarms || []).map((a) => ({ ...a, active: activeAlarm(card, a) })).sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
      return `<section class="glt4-runtime-panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px"><b>Alarme & Meldungen</b><span style="font-size:9px;color:var(--secondary-text-color)">${alarms.filter((a) => a.active).length} aktiv</span></div><div class="glt4-runtime-grid">${alarms.map((a) => `<div class="glt4-runtime-card ${esc(a.severity || "warning")}"><b>${a.active ? "\u25CF " : "\u25CB "}${esc(a.name || field(a.entity)?.entity || "Alarm")}</b><small>${esc(field(a.entity)?.entity || "")} \xB7 ${esc(card._display?.(a.entity) || "")}</small>${a.ack?.service && a.active ? `<div class="glt4-runtime-actions"><button data-ack="${esc(a.id)}">Quittieren</button></div>` : ""}</div>`).join("") || '<div class="glt4-runtime-card">Keine Alarmdatenpunkte konfiguriert.</div>'}</div></section>`;
    }
    function assetsMarkup(card) {
      const assets = card._config.assets || [];
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      return `<section class="glt4-runtime-panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px"><b>Wartung & Assets</b><span style="font-size:9px;color:var(--secondary-text-color)">${assets.length} Assets</span></div><div class="glt4-runtime-grid">${assets.map((a) => {
        const hours = card._number?.(a.entity_hours);
        const dueDate = a.due_date && a.due_date <= today;
        const dueHours = Number.isFinite(hours) && a.service_interval_hours && hours >= (a.last_service_hours || 0) + a.service_interval_hours;
        const due = dueDate || dueHours;
        return `<div class="glt4-runtime-card ${due ? "warning" : ""}"><b>${due ? "\u26A0 " : "\u2713 "}${esc(a.name || a.id)}</b><small>${hours != null ? `${hours.toFixed(0)} h \xB7 ` : ""}${a.due_date ? `F\xE4llig ${esc(a.due_date)}` : "Kein Datum"}${a.notes ? ` \xB7 ${esc(a.notes)}` : ""}</small>${(a.documents || []).length ? `<div class="glt4-runtime-actions">${a.documents.map((d) => `<button data-url="${esc(d.url)}">${esc(d.name || "Dokument")}</button>`).join("")}</div>` : ""}</div>`;
      }).join("") || '<div class="glt4-runtime-card">Keine Assets konfiguriert.</div>'}</div></section>`;
    }
    function siteStrip(card) {
      if (!(card._config.sites || []).length || card._glt4Site !== "all") return "";
      return `<div class="glt4-site-strip">${card._config.sites.map((s) => {
        const alarmCount = (card._config.alarms || []).filter((a) => (!a.site || a.site === s.id) && activeAlarm(card, a)).length;
        const eq = (card._config.equipment || []).filter((e) => !e.site || e.site === s.id).length;
        return `<div class="glt4-site-card" data-site-card="${esc(s.id)}"><b>${esc(s.name || s.id)}</b><span>${eq} Bauteile \xB7 ${alarmCount} aktive Meldungen</span></div>`;
      }).join("")}</div>`;
    }
    function selectedTrendStats(card) {
      const selected = card._selectedTrendPoints?.() || [];
      return selected.map((entry, i) => {
        const values = card._seriesFor?.(entry.point) || [];
        const ys = values.map((v) => v.y).filter(Number.isFinite);
        if (!ys.length) return null;
        const f = field(entry.point.entity || entry.point);
        const unit = card._unit?.(f) || "";
        const min = Math.min(...ys), max = Math.max(...ys), avg = ys.reduce((a, b) => a + b, 0) / ys.length;
        let energy = null;
        if (POWER.has(unit) && values.length > 1) {
          let wh = 0;
          for (let j = 1; j < values.length; j++) {
            const dt = (values[j].x - values[j - 1].x) / 36e5;
            const watts = (values[j - 1].y + values[j].y) / 2 * (unit === "kW" ? 1e3 : unit === "MW" ? 1e6 : 1);
            wh += watts * dt;
          }
          energy = wh / 1e3;
        }
        const end = card._historyRange?.end || Date.now(), cut = end - 24 * 36e5, prev = cut - 24 * 36e5;
        const avgRange = (lo, hi) => {
          const a = values.filter((v) => v.x >= lo && v.x < hi).map((v) => v.y);
          return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
        };
        const last = avgRange(cut, end), before = avgRange(prev, cut);
        const delta = last != null && before != null && before !== 0 ? (last - before) / Math.abs(before) * 100 : null;
        return { entry, index: i, values, unit, min, max, avg, energy, last, before, delta, color: TREND_COLORS[i % TREND_COLORS.length] };
      }).filter(Boolean);
    }
    function multiAxisSvg(card, stats) {
      if (!stats.length) return "";
      const groups = [];
      for (const s of stats) {
        let g = groups.find((x) => x.unit === s.unit);
        if (!g) {
          g = { unit: s.unit, series: [] };
          groups.push(g);
        }
        g.series.push(s);
      }
      const width = 1e3, height = 250, pad = { l: 70, r: 70, t: 20, b: 34 };
      const x0 = card._historyRange?.start || Math.min(...stats.flatMap((s) => s.values.map((v) => v.x))), x1 = card._historyRange?.end || Math.max(...stats.flatMap((s) => s.values.map((v) => v.x)));
      const sx = (x) => pad.l + (x - x0) / Math.max(1, x1 - x0) * (width - pad.l - pad.r);
      const scales = groups.slice(0, 3).map((g, gi) => {
        const vals = g.series.flatMap((s) => s.values.map((v) => v.y));
        let min = Math.min(...vals), max = Math.max(...vals);
        if (min === max) {
          min -= 1;
          max += 1;
        }
        const extra = (max - min) * 0.08;
        min -= extra;
        max += extra;
        return { ...g, gi, min, max, sy: (y) => pad.t + (1 - (y - min) / (max - min)) * (height - pad.t - pad.b) };
      });
      let axes = "";
      scales.forEach((g, gi) => {
        const x = gi === 0 ? pad.l : width - pad.r - (gi - 1) * 46;
        axes += `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${height - pad.b}" stroke="${g.series[0]?.color || "#64748b"}" opacity=".55"/><text class="glt4-axis-label" x="${x + (gi === 0 ? -8 : 8)}" y="14" text-anchor="${gi === 0 ? "end" : "start"}">${esc(g.unit || "Wert")}</text>`;
        for (let t = 0; t < 5; t++) {
          const y = pad.t + t * (height - pad.t - pad.b) / 4;
          const val = g.max - t * (g.max - g.min) / 4;
          axes += `<text class="glt4-axis-label" x="${x + (gi === 0 ? -8 : 8)}" y="${y + 4}" text-anchor="${gi === 0 ? "end" : "start"}">${val.toFixed(1)}</text>`;
        }
      });
      let lines = "";
      for (const g of scales) for (const s of g.series) {
        const pts = s.values.map((v) => `${sx(v.x).toFixed(1)},${g.sy(v.y).toFixed(1)}`).join(" ");
        lines += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/>`;
      }
      return `<svg class="glt4-axis-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${axes}${lines}</svg>`;
    }
    function trendPlusMarkup(card) {
      const stats = selectedTrendStats(card);
      return `<div class="glt4-trendplus"><div class="glt4-statgrid">${stats.map((s) => `<div class="glt4-stat" style="border-left:3px solid ${s.color}"><b>${esc(s.entry.point.label || field(s.entry.point.entity)?.entity || "Wert")}</b>Min ${s.min.toFixed(2)} \xB7 \xD8 ${s.avg.toFixed(2)} \xB7 Max ${s.max.toFixed(2)} ${esc(s.unit)}${s.energy != null ? ` \xB7 ${s.energy.toFixed(2)} kWh` : ""}${s.delta != null ? ` \xB7 24h ${s.delta >= 0 ? "+" : ""}${s.delta.toFixed(1)} %` : ""}</div>`).join("")}</div>${multiAxisSvg(card, stats)}<div style="margin-top:7px;color:var(--secondary-text-color);font-size:9px">Eigene Y-Achse je Einheit \xB7 Leistung wird zeitlich zu Energie integriert \xB7 24-h-Vergleich gegen den vorherigen Zeitraum</div></div>`;
    }
    /**
     * Retired reachable and inert by plan 07-17.
     *
     * It joined series by nearest neighbour with `Math.abs` and no maximum
     * distance, so a sample from four hours away was written into this
     * minute's row with no marker (D22). The file stated values that were
     * never measured at the times it attributed them to.
     *
     * `report-renderings.exportSeries` fills a cell only from a sample inside
     * that interval, and leaves an explicit blank otherwise.
     */
    function trendCsv(card) {
      void card;
      return "";
    }
    /**
     * Retired reachable and inert by plan 07-17.
     *
     * It wrote `card._display?.(...)` -- the value being rendered right now --
     * for each KPI, alarm and asset. The designer offered day, week, month and
     * year and nothing read `period`, so a "Monatsbericht" contained one
     * instant and said so nowhere (D19).
     *
     * `report_runs.execute` resolves the period and records every input.
     */
    function reportCsv(card) {
      void card;
      return "";
    }
    /**
     * Retired reachable and inert by plan 07-17.
     *
     * It rebuilt its table by splitting `reportCsv`'s output on newlines and
     * semicolons and stripping quotes with a regex, so any value containing a
     * semicolon became extra columns and any value containing a newline became
     * extra rows (D21). It also opened a window and wrote markup into it.
     *
     * `report-renderings.print` renders from the model. Deriving one rendering
     * from another's serialisation was the defect, not the symptom.
     */
    function printReport(card) {
      void card;
      return undefined;
    }
    async function auditRuntime(card) {
      const events = await runtimeStore(card).listAudit(150);
      card._glt4AuditCache = events;
      card._glt4Panel = "audit";
      card._queueRender?.();
    }
    const originalCardRender = Card.prototype._render;
    Card.prototype._render = function() {
      ensureV4Config(this._config);
      this._glt4Store = this._glt4Store || new ProjectStore(this._hass);
      const result = originalCardRender.call(this);
      const root = this.shadowRoot, ha = root.querySelector("ha-card");
      if (!ha) return result;
      const style = document.createElement("style");
      style.textContent = RUNTIME_STYLES;
      root.appendChild(style);
      const tools = root.querySelector(".glt-tool-actions");
      if (tools && !tools.querySelector(".glt4-tool")) {
        const alarmCount = (this._config.alarms || []).filter((a) => activeAlarm(this, a)).length;
        const siteOptions = (this._config.sites || []).length ? `<select class="glt4-site-select" data-g4site><option value="all">Alle Standorte</option>${this._config.sites.map((s) => `<option value="${esc(s.id)}" ${this._glt4Site === s.id ? "selected" : ""}>${esc(s.name || s.id)}</option>`).join("")}</select>` : "";
        const wrap = document.createElement("div");
        wrap.className = "glt4-tool";
        wrap.innerHTML = `${siteOptions}<button class="glt4-pill ${this._glt4Panel === "alarms" ? "on" : ""}" data-g4panel="alarms">Alarme${alarmCount ? ` (${alarmCount})` : ""}</button><button class="glt4-pill ${this._glt4Panel === "assets" ? "on" : ""}" data-g4panel="assets">Wartung</button>${this._config.reports?.enabled !== false ? '<button class="glt4-pill" data-g4report>Report</button>' : ""}${roleFor(this._config, this._hass) === "designer" ? '<button class="glt4-pill" data-g4audit>Audit</button>' : ""}`;
        tools.prepend(wrap);
        wrap.querySelector("[data-g4site]")?.addEventListener("change", (e) => {
          this._glt4Site = e.target.value;
          this._hasFit = false;
          this._queueRender();
        });
        wrap.querySelectorAll("[data-g4panel]").forEach((b) => b.onclick = () => {
          this._glt4Panel = this._glt4Panel === b.dataset.g4panel ? null : b.dataset.g4panel;
          this._queueRender();
        });
        wrap.querySelector("[data-g4report]")?.addEventListener("click", () => {
          const choice = prompt("Report: 'csv' f\xFCr CSV oder 'pdf' f\xFCr Druck/PDF", "pdf");
          if (choice?.toLowerCase() === "csv") download(`glt-report-${Date.now()}.csv`, reportCsv(this), "text/csv;charset=utf-8");
          else if (choice) printReport(this);
          runtimeStore(this).audit("report.create", { format: choice || "cancel" });
        });
        wrap.querySelector("[data-g4audit]")?.addEventListener("click", () => auditRuntime(this));
      }
      const viewport = root.querySelector(".glt-viewport");
      if (viewport && this._glt4Site == null) this._glt4Site = "all";
      if (viewport && this._config.sites?.length && this._glt4Site === "all") {
        const holder = document.createElement("div");
        holder.innerHTML = siteStrip(this);
        const strip = holder.firstElementChild;
        if (strip) {
          viewport.before(strip);
          strip.querySelectorAll("[data-site-card]").forEach((c) => c.onclick = () => {
            this._glt4Site = c.dataset.siteCard;
            this._hasFit = false;
            this._queueRender();
          });
        }
      }
      const replay = root.querySelector(".glt-replay") || root.querySelector(".glt-trend-panel") || ha.lastElementChild;
      if (this._glt4Panel === "alarms") {
        const h = document.createElement("div");
        h.innerHTML = alarmsMarkup(this);
        replay?.after(h.firstElementChild);
        /* Retired in Phase 6, reachable and inert.
         *
         * Acknowledgement called a Home Assistant service directly from the
         * browser and never reached the Companion, so the acknowledgement the
         * operator made was invisible to the engine that owns the alarm's
         * state. The authoritative path is `glt_flow_card/alarms/ack`, and the
         * v100 layer's alarm surface is where it lives.
         */
        root.querySelectorAll("[data-ack]").forEach((b) => b.onclick = () => {
          editorNotice(this, "Quittieren erfolgt \u00fcber die Alarmliste.");
        });
      }
      if (this._glt4Panel === "assets") {
        const h = document.createElement("div");
        h.innerHTML = assetsMarkup(this);
        replay?.after(h.firstElementChild);
        root.querySelectorAll("[data-url]").forEach((b) => b.onclick = () => window.open(b.dataset.url, "_blank", "noopener"));
      }
      if (this._glt4Panel === "audit") {
        const events = this._glt4AuditCache || [];
        const h = document.createElement("div");
        h.innerHTML = `<section class="glt4-runtime-panel"><b>Audit-Log</b><div class="glt4-runtime-grid" style="margin-top:9px">${events.slice(0, 80).map((e) => `<div class="glt4-runtime-card"><b>${esc(e.action)}</b><small>${esc(e.at || "")} \xB7 ${esc(e.user_name || e.user_id || "lokal")} \xB7 ${esc(JSON.stringify(e.detail || {}))}</small></div>`).join("")}</div></section>`;
        replay?.after(h.firstElementChild);
      }
      const trend = root.querySelector(".glt-trend-panel");
      if (trend) {
        const actions = trend.querySelector(".glt-trend-actions");
        if (actions && !actions.querySelector("[data-g4trend]")) {
          const plus = document.createElement("button");
          plus.type = "button";
          plus.className = "glt-text-btn";
          plus.dataset.g4trend = "1";
          plus.textContent = this._glt4TrendPlus ? "Trend+ aus" : "Trend+";
          plus.onclick = () => {
            this._glt4TrendPlus = !this._glt4TrendPlus;
            this._queueRender();
          };
          actions.prepend(plus);
          const csv = document.createElement("button");
          csv.type = "button";
          csv.className = "glt-text-btn";
          csv.textContent = "CSV";
          csv.onclick = () => trendCsv(this);
          actions.prepend(csv);
        }
        if (this._glt4TrendPlus) {
          const chart = trend.querySelector(".glt-trend-chart");
          const h = document.createElement("div");
          h.innerHTML = trendPlusMarkup(this);
          chart?.after(h.firstElementChild);
        }
      }
      return result;
    };
    console.info(`%c GLT-FLOW-CARD %c Engineering Workspace v${EXT_VERSION} `, "color:#fff;background:#7c3aed;font-weight:700;padding:2px 5px", "color:#7c3aed;background:#ede9fe;font-weight:700;padding:2px 5px");
  })();
})();
/*!
 * GLT Flow Card v0.4 extensions
 * Engineering workspace: YAML round-trip, project/version library, templates,
 * groups, auto routing, alarms, assets, access control, audit, reports,
 * multi-site navigation and advanced trend analytics.
 */
