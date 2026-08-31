/*!
 * GLT Flow Card
 * Modern configurable building-management / plant visualization for Home Assistant.
 * https://github.com/Xerolux/glt-flow-card
 * MIT License - Copyright (c) 2026 Xerolux
 */

(() => {
  "use strict";

  const VERSION = "0.1.0";
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

  function formatDateTime(value, locale = "de-DE") {
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      }).format(new Date(value));
    } catch (_err) {
      return new Date(value).toLocaleString();
    }
  }

  function normalizeConfig(raw) {
    const config = deepClone(raw || {});
    config.title = config.title ?? "GLT Anlagenvisualisierung";
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

    _locale() {
      return this._hass?.locale?.language || navigator.language || "de-DE";
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
        return `${number.toLocaleString(this._locale(), { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${unit ? ` ${unit}` : ""}`;
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

    async _ensureHistory() {
      if (this._historyLoading || !this._hass?.callApi) return;
      const ids = this._entityIds();
      if (!ids.length) return;
      const now = new Date();
      const hours = Math.max(this._config.replay.hours || 168, this._config.trend.hours || 168);
      const start = new Date(now.getTime() - hours * 3600000);
      if (this._historyRange && this._historyRange.start <= start.getTime() && this._historyRange.end >= now.getTime() - 60000) return;

      this._historyLoading = true;
      this._historyError = null;
      this._queueRender();
      try {
        const chunks = [];
        for (let i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));
        const all = [];
        for (const chunk of chunks) {
          const path = `history/period/${encodeURIComponent(start.toISOString())}` +
            `?filter_entity_id=${encodeURIComponent(chunk.join(","))}` +
            `&end_time=${encodeURIComponent(now.toISOString())}&minimal_response`;
          const response = await this._hass.callApi("GET", path);
          if (Array.isArray(response)) all.push(...response);
        }
        this._history.clear();
        all.forEach((series) => {
          if (!Array.isArray(series) || !series.length) return;
          const entityId = series[0].entity_id;
          if (!entityId) return;
          const sorted = series.slice().sort((a, b) =>
            new Date(a.last_updated || a.last_changed) - new Date(b.last_updated || b.last_changed));
          this._history.set(entityId, sorted);
        });
        this._historyRange = { start: start.getTime(), end: now.getTime() };
        if (!this._replayTime) this._replayTime = now;
      } catch (error) {
        this._historyError = error?.message || String(error);
      } finally {
        this._historyLoading = false;
        this._queueRender();
      }
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
      const icon = item.icon || EQUIPMENT_ICONS[item.type] || EQUIPMENT_ICONS.generic;
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
        node.className = `glt-equipment glt-type-${item.type || "generic"}`;
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
      this.shadowRoot.innerHTML = `<style>${CARD_STYLES}</style>
        <ha-card class="glt-card">
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

  class GltFlowCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = {};
      this._hass = null;
    }

    setConfig(config) {
      this._config = deepClone(config || {});
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    _render() {
      if (!this.shadowRoot) return;
      this.shadowRoot.innerHTML = `
        <style>
          :host{display:block}.editor{display:grid;gap:12px}.note{padding:11px 12px;border-radius:10px;background:color-mix(in srgb,var(--primary-color,#0f766e) 9%,transparent);color:var(--secondary-text-color);font-size:12px;line-height:1.45}.note strong{color:var(--primary-text-color)}
        </style>
        <div class="editor">
          <div class="note"><strong>GLT Flow Card</strong><br>Grundoptionen können hier bearbeitet werden. Anlagengeometrie, Datenpunkte, Pfade, Bildansichten und KPIs sind vollständig über YAML konfigurierbar.</div>
          <ha-form></ha-form>
        </div>`;
      const form = this.shadowRoot.querySelector("ha-form");
      if (!form) return;
      const config = normalizeConfig(this._config);
      form.hass = this._hass;
      form.data = {
        title: config.title,
        default_view: config.default_view,
        viewport_height: config.canvas.viewport_height,
        grid: config.canvas.grid,
        replay: config.replay.enabled,
        replay_hours: config.replay.hours,
        trend: config.trend.enabled,
        max_series: config.trend.max_series
      };
      form.schema = [
        { name: "title", selector: { text: {} } },
        { name: "default_view", selector: { select: { mode: "dropdown", options: config.views.map((view) => ({ value: view.id, label: view.name || view.id })) } } },
        { name: "viewport_height", selector: { number: { min: 320, max: 1000, step: 10, mode: "box" } } },
        { name: "grid", selector: { boolean: {} } },
        { name: "replay", selector: { boolean: {} } },
        { name: "replay_hours", selector: { number: { min: 1, max: 744, step: 1, mode: "box" } } },
        { name: "trend", selector: { boolean: {} } },
        { name: "max_series", selector: { number: { min: 1, max: 12, step: 1, mode: "box" } } }
      ];
      const labels = {
        title: "Kartentitel", default_view: "Standardansicht", viewport_height: "Höhe der Anlagenansicht",
        grid: "Raster im Schema", replay: "Replay-Modus", replay_hours: "Historie in Stunden",
        trend: "Trenddiagramme", max_series: "Max. Trend-Datenpunkte"
      };
      form.computeLabel = (schema) => labels[schema.name] || schema.name;
      form.addEventListener("value-changed", (event) => {
        const value = event.detail?.value;
        if (!value) return;
        const next = deepClone(this._config || {});
        next.title = value.title;
        next.default_view = value.default_view;
        next.canvas = { ...(next.canvas || {}), viewport_height: value.viewport_height, grid: value.grid };
        next.replay = { ...(next.replay || {}), enabled: value.replay, hours: value.replay_hours };
        next.trend = { ...(next.trend || {}), enabled: value.trend, max_series: value.max_series };
        this._config = next;
        fireEvent(this, "config-changed", { config: next });
      });
    }
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
