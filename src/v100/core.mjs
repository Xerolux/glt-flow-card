/* GLT Flow Card Platform 1.0 pure engineering core */
import { COMPONENT_PROFILES, SYMBOL_VARIANTS, VISUAL_STYLES, profileForEquipment, portsForEquipment, renderVariant } from "./catalog.mjs";
import { computeProjectDiff } from "./project-diff.mjs";
import { createProjectBundle, readProjectBundleArchive } from "./project-bundle.mjs";
import { migrateProjectDocument } from "./project-migrations.mjs";

export const SCHEMA_VERSION = 1;
export const OPERATIONAL_STATES = {
  comm_error: { label: "Kommunikationsfehler", severity: 100, className: "comm-error" },
  fault: { label: "Störung", severity: 95, className: "fault" },
  command_failed: { label: "Befehl fehlgeschlagen", severity: 92, className: "command-failed" },
  interlock: { label: "Interlock", severity: 88, className: "interlock" },
  locked: { label: "Gesperrt", severity: 84, className: "locked" },
  maintenance: { label: "Wartung", severity: 78, className: "maintenance" },
  warning: { label: "Warnung", severity: 70, className: "warning" },
  local: { label: "Lokal", severity: 60, className: "local" },
  manual: { label: "Hand", severity: 58, className: "manual" },
  command_pending: { label: "Befehl läuft", severity: 50, className: "command-pending" },
  stale: { label: "Wert veraltet", severity: 45, className: "stale" },
  invalid: { label: "Wert ungültig", severity: 44, className: "invalid" },
  auto: { label: "Auto", severity: 20, className: "auto" },
  remote: { label: "Fern", severity: 18, className: "remote" },
  running: { label: "Läuft", severity: 15, className: "running" },
  standby: { label: "Standby", severity: 8, className: "standby" },
  off: { label: "Aus", severity: 5, className: "off" },
  unknown: { label: "Unbekannt", severity: 40, className: "unknown" },
};

export const DEFAULT_ALLOWED_SERVICE_DOMAINS = ["switch", "fan", "number", "select", "climate", "cover", "light", "input_boolean", "input_number", "input_select", "water_heater", "button", "script"];

const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
const arr = (x) => Array.isArray(x) ? x : [];
const lower = (x) => String(x ?? "").toLowerCase();
const slug = (x) => String(x || "item").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";

export function ensureV1(raw = {}) {
  const c = clone(raw) || {};
  c.type ||= "custom:glt-flow-card";
  c.schema_version = SCHEMA_VERSION;
  c.project = { id: c.project?.id || slug(c.title || "glt-project"), name: c.project?.name || c.title || "GLT Project", revision: Number(c.project?.revision || 0), ...(c.project || {}) };
  c.security = { server_enforced: false, allow_browser_fallback: true, allowed_service_domains: DEFAULT_ALLOWED_SERVICE_DOMAINS, ...(c.security || {}) };
  c.permissions = { designers: [], operators: [], viewers: [], confirm_controls: true, ...(c.permissions || {}) };
  c.diagnostics = { stale_minutes: 10, check_units: true, show_unused_entities: true, ...(c.diagnostics || {}) };
  c.semantic_model = { sites: [], buildings: [], floors: [], systems: [], ...(c.semantic_model || {}) };
  c.layers = arr(c.layers).length ? c.layers : [{ id: "default", name: "Standard", visible: true, locked: false, order: 0 }];
  c.schedules = arr(c.schedules);
  c.energy = { enabled: true, meters: arr(c.energy?.meters), tariffs: arr(c.energy?.tariffs), co2_factor_g_per_kwh: c.energy?.co2_factor_g_per_kwh ?? 0, ...(c.energy || {}) };
  c.work_orders = arr(c.work_orders);
  c.reports = { enabled: true, definitions: arr(c.reports?.definitions), ...(c.reports || {}) };
  c.remote_sites = arr(c.remote_sites);
  c.plugins = arr(c.plugins);
  c.equipment = arr(c.equipment).map((e) => ({ layer: "default", tags: [], fields: [], ...e }));
  c.paths = arr(c.paths).map((p) => ({ layer: "default", auto_route: p.auto_route !== false, ...p }));
  c.datapoints = arr(c.datapoints).map((d) => ({ layer: "default", tags: [], ...d }));
  c.kpis = arr(c.kpis);
  c.alarms = arr(c.alarms);
  c.groups = arr(c.groups);
  c.sites = arr(c.sites);
  c.assets = arr(c.assets);
  c.routing = { automatic: true, orthogonal: true, padding: 28, obstacle_avoidance: true, ...(c.routing || {}) };
  c.historian = { aggregate: "raw", deadband: 0, max_points: 4000, ...(c.historian || {}) };
  c.simulation = { enabled: false, states: {}, ...(c.simulation || {}) };
  c.ui = { kiosk: false, widescreen: false, minimap: true, locale: "de", ...(c.ui || {}) };
  return c;
}

export function migrateProject(config) {
  const from = Number(config?.schema_version || 0);
  const hardened = migrateProjectDocument(config);
  const out = ensureV1(hardened.candidate);
  return {
    config: out,
    from,
    to: SCHEMA_VERSION,
    changed: from !== SCHEMA_VERSION,
    candidate: hardened.candidate,
    receipt: hardened.receipt,
  };
}

function stateObj(states, id) {
  if (!id) return null;
  if (typeof states === "function") return states(id);
  return states?.[id] || null;
}

function isActiveValue(v, active = null) {
  const x = lower(v);
  if (active?.length) return active.map(lower).includes(x);
  return ["on", "true", "1", "open", "opening", "running", "active", "heat", "heating", "cool", "cooling", "manual", "local", "fault", "warning", "locked", "maintenance"].includes(x);
}

function testSignal(states, spec, nowMs = Date.now()) {
  if (!spec) return false;
  if (typeof spec === "boolean") return spec;
  if (typeof spec === "string") {
    const s = stateObj(states, spec);
    return s ? isActiveValue(s.state) : false;
  }
  const s = stateObj(states, spec.entity);
  if (!s) return spec.missing_is_active === true;
  if (spec.attribute) {
    const value = s.attributes?.[spec.attribute];
    if (spec.equals !== undefined) return String(value) === String(spec.equals);
    if (spec.not_equals !== undefined) return String(value) !== String(spec.not_equals);
    return isActiveValue(value, spec.active_states);
  }
  if (spec.operator) {
    const n = Number.parseFloat(s.state);
    const v = Number(spec.value);
    if (!Number.isFinite(n) || !Number.isFinite(v)) return false;
    if (spec.operator === ">") return n > v;
    if (spec.operator === ">=") return n >= v;
    if (spec.operator === "<") return n < v;
    if (spec.operator === "<=") return n <= v;
    if (spec.operator === "==") return n === v;
    if (spec.operator === "!=") return n !== v;
  }
  if (spec.active_states?.length) return spec.active_states.map(lower).includes(lower(s.state));
  if (spec.inactive_states?.length) return !spec.inactive_states.map(lower).includes(lower(s.state));
  if (spec.max_age_minutes) {
    const t = Date.parse(s.last_updated || s.last_changed || "");
    return Number.isFinite(t) && nowMs - t > Number(spec.max_age_minutes) * 60000;
  }
  return isActiveValue(s.state);
}

export function deriveOperationalState(item, states, options = {}) {
  const nowMs = options.now ?? Date.now();
  const staleMinutes = Number(options.stale_minutes ?? 10);
  const model = item?.state_model || {};
  const primaryId = model.primary?.entity || item?.state_entity?.entity || item?.state_entity || item?.entity?.entity || item?.entity;
  const primary = stateObj(states, primaryId);
  const candidates = [];
  const add = (code, active) => active && candidates.push({ code, ...OPERATIONAL_STATES[code] });
  add("comm_error", testSignal(states, model.communication || model.comm_error, nowMs));
  add("fault", testSignal(states, model.fault, nowMs));
  add("command_failed", testSignal(states, model.command_failed, nowMs));
  add("interlock", testSignal(states, model.interlock, nowMs));
  add("locked", testSignal(states, model.locked, nowMs));
  add("maintenance", testSignal(states, model.maintenance, nowMs));
  add("warning", testSignal(states, model.warning, nowMs));
  add("local", testSignal(states, model.local, nowMs));
  add("manual", testSignal(states, model.manual, nowMs));
  add("command_pending", testSignal(states, model.command_pending, nowMs));
  if (!primary && primaryId) add("comm_error", true);
  if (primary) {
    const raw = lower(primary.state);
    add("invalid", ["unknown", "unavailable", "none", "nan"].includes(raw));
    const updated = Date.parse(primary.last_updated || primary.last_changed || "");
    add("stale", Number.isFinite(updated) && nowMs - updated > staleMinutes * 60000);
    add("auto", raw === "auto" || testSignal(states, model.auto, nowMs));
    add("remote", raw === "remote" || raw === "fern" || testSignal(states, model.remote, nowMs));
    add("running", isActiveValue(raw, model.running_states) || testSignal(states, model.running, nowMs));
    add("standby", ["idle", "standby", "ready", "bereit"].includes(raw));
    add("off", ["off", "0", "false", "closed", "stopped"].includes(raw));
  }
  if (!candidates.length) candidates.push({ code: "unknown", ...OPERATIONAL_STATES.unknown });
  candidates.sort((a, b) => b.severity - a.severity);
  const chosen = candidates[0];
  const updated = primary ? Date.parse(primary.last_updated || primary.last_changed || "") : NaN;
  return {
    ...chosen,
    entity_id: primaryId || null,
    raw: primary?.state ?? null,
    age_minutes: Number.isFinite(updated) ? Math.max(0, (nowMs - updated) / 60000) : null,
    quality: chosen.code === "comm_error" ? "bad" : ["stale", "invalid", "unknown"].includes(chosen.code) ? "uncertain" : "good",
    all: candidates.map((x) => x.code),
  };
}

const normalizeText = (s) => lower(s).normalize("NFKD").replace(/[^a-z0-9]+/g, " ");
const words = (s) => new Set(normalizeText(s).split(/\s+/).filter(Boolean));

export function scoreEntityForSlot(entityId, state, slotSpec, equipment = {}) {
  const name = state?.attributes?.friendly_name || entityId;
  const hay = words(`${entityId} ${name} ${equipment.name || ""}`);
  const slotWords = words(`${slotSpec.id} ${slotSpec.label}`);
  let score = 0;
  for (const w of slotWords) if (hay.has(w)) score += 20;
  const domain = entityId.split(".")[0];
  if (slotSpec.domains?.includes(domain)) score += 25;
  const unit = state?.attributes?.unit_of_measurement;
  if (slotSpec.unit && unit === slotSpec.unit) score += 35;
  if (slotSpec.unit && unit && unit !== slotSpec.unit) score -= 10;
  const dc = lower(state?.attributes?.device_class);
  if (slotSpec.id.includes("temp") && dc === "temperature") score += 25;
  if (slotSpec.id.includes("power") && dc === "power") score += 25;
  if ((slotSpec.id.includes("energy") || slotSpec.id.includes("meter")) && dc === "energy") score += 25;
  if (slotSpec.id.includes("humidity") && dc === "humidity") score += 25;
  if (slotSpec.id.includes("pressure") && dc === "pressure") score += 25;
  if (slotSpec.id.includes("co2") && (dc === "carbon_dioxide" || normalizeText(name).includes("co2"))) score += 25;
  return score;
}

export function autoMapEquipment(equipment, hassStates = {}) {
  const profile = profileForEquipment(equipment);
  const entries = Object.entries(hassStates || {});
  const suggestions = {};
  for (const s of profile.slots || []) {
    suggestions[s.id] = entries.map(([entity_id, st]) => ({ entity_id, score: scoreEntityForSlot(entity_id, st, s, equipment), name: st?.attributes?.friendly_name || entity_id, unit: st?.attributes?.unit_of_measurement || "" }))
      .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  }
  for (const c of profile.controls || []) {
    suggestions[`control:${c.id}`] = entries.map(([entity_id, st]) => {
      const domain = entity_id.split(".")[0];
      let score = c.domains?.includes(domain) ? 50 : 0;
      const t = normalizeText(`${entity_id} ${st?.attributes?.friendly_name || ""} ${equipment.name || ""}`);
      for (const w of words(`${c.id} ${c.label}`)) if (t.includes(w)) score += 15;
      return { entity_id, score, name: st?.attributes?.friendly_name || entity_id };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  }
  return { profile: profile.id, suggestions };
}

export function semanticPath(item, config) {
  if (item?.semantic_path) return item.semantic_path;
  const site = config?.sites?.find((x) => x.id === item?.site)?.name || item?.site;
  const parts = [site, item?.building, item?.floor, item?.system, item?.subsystem, item?.name || item?.id].filter(Boolean);
  return parts.join(" / ");
}

function rectFor(e, padding = 0) {
  return { x1: Number(e.x || 0) - padding, y1: Number(e.y || 0) - padding, x2: Number(e.x || 0) + Number(e.width || 180) + padding, y2: Number(e.y || 0) + Number(e.height || 100) + padding };
}
function segHitsRect(a, b, r) {
  if (a[0] === b[0]) {
    const x = a[0], y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    return x >= r.x1 && x <= r.x2 && y2 >= r.y1 && y1 <= r.y2;
  }
  if (a[1] === b[1]) {
    const y = a[1], x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
    return y >= r.y1 && y <= r.y2 && x2 >= r.x1 && x1 <= r.x2;
  }
  return false;
}
function pathHits(points, obstacles) {
  for (let i = 1; i < points.length; i++) if (obstacles.some((r) => segHitsRect(points[i - 1], points[i], r))) return true;
  return false;
}
function endpoint(e, side) {
  const x = Number(e.x || 0), y = Number(e.y || 0), w = Number(e.width || 180), h = Number(e.height || 100);
  if (side === "left") return [x, y + h / 2];
  if (side === "right") return [x + w, y + h / 2];
  if (side === "top") return [x + w / 2, y];
  return [x + w / 2, y + h];
}

export function smartRoute(config, path, viewId = null) {
  const eq = arr(config?.equipment);
  const a = eq.find((x) => x.id === path?.from_equipment), b = eq.find((x) => x.id === path?.to_equipment);
  if (!a || !b) return path?.points || [];
  const padding = Number(config?.routing?.padding ?? 28);
  const aPorts = portsForEquipment(a), bPorts = portsForEquipment(b);
  const medium = path.medium || "neutral";
  const choose = (ports, fallback) => ports.find((p) => p.id === path?.[fallback === "right" ? "from_port" : "to_port"]) || ports.find((p) => p.medium === medium) || { side: fallback };
  const ap = choose(aPorts, "right"), bp = choose(bPorts, "left");
  const s = endpoint(a.positions?.[viewId] || a, ap.side || "right"), t = endpoint(b.positions?.[viewId] || b, bp.side || "left");
  const obstacles = eq.filter((x) => x.id !== a.id && x.id !== b.id).map((x) => rectFor(x.positions?.[viewId] || x, padding));
  const midX = Math.round((s[0] + t[0]) / 2);
  const midY = Math.round((s[1] + t[1]) / 2);
  const candidates = [
    [s, [midX, s[1]], [midX, t[1]], t],
    [s, [s[0], midY], [t[0], midY], t],
  ];
  for (let off = padding; off <= padding * 8; off += padding) {
    candidates.push([s, [s[0] + off, s[1]], [s[0] + off, t[1]], t]);
    candidates.push([s, [s[0] - off, s[1]], [s[0] - off, t[1]], t]);
    candidates.push([s, [s[0], s[1] + off], [t[0], s[1] + off], t]);
    candidates.push([s, [s[0], s[1] - off], [t[0], s[1] - off], t]);
  }
  const clean = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]).map(([x, y]) => [Math.round(x), Math.round(y)]);
  return clean(candidates.find((pts) => !pathHits(pts, obstacles)) || candidates[0]);
}

export function alignObjects(config, refs, mode) {
  const items = refs.map((r) => arr(config[r.kind === "equipment" ? "equipment" : r.kind === "datapoint" ? "datapoints" : "paths"]).find((x) => x.id === r.id)).filter(Boolean).filter((x) => Number.isFinite(Number(x.x)) && Number.isFinite(Number(x.y)));
  if (items.length < 2) return config;
  if (mode === "left") { const v = Math.min(...items.map((x) => Number(x.x))); items.forEach((x) => x.x = v); }
  if (mode === "right") { const v = Math.max(...items.map((x) => Number(x.x) + Number(x.width || 0))); items.forEach((x) => x.x = v - Number(x.width || 0)); }
  if (mode === "top") { const v = Math.min(...items.map((x) => Number(x.y))); items.forEach((x) => x.y = v); }
  if (mode === "bottom") { const v = Math.max(...items.map((x) => Number(x.y) + Number(x.height || 0))); items.forEach((x) => x.y = v - Number(x.height || 0)); }
  if (mode === "center_h") { const v = items.reduce((a, x) => a + Number(x.y) + Number(x.height || 0) / 2, 0) / items.length; items.forEach((x) => x.y = v - Number(x.height || 0) / 2); }
  if (mode === "center_v") { const v = items.reduce((a, x) => a + Number(x.x) + Number(x.width || 0) / 2, 0) / items.length; items.forEach((x) => x.x = v - Number(x.width || 0) / 2); }
  if (mode === "distribute_h") { const sorted = items.slice().sort((a,b)=>a.x-b.x); const min=sorted[0].x,max=sorted.at(-1).x; sorted.forEach((x,i)=>x.x=min+(max-min)*i/(sorted.length-1)); }
  if (mode === "distribute_v") { const sorted = items.slice().sort((a,b)=>a.y-b.y); const min=sorted[0].y,max=sorted.at(-1).y; sorted.forEach((x,i)=>x.y=min+(max-min)*i/(sorted.length-1)); }
  return config;
}

export function diagnoseConfig(config, hassStates = {}, now = Date.now()) {
  const c = ensureV1(config), refs = new Set();
  const collect = (v) => {
    if (!v) return;
    if (typeof v === "string" && v.includes(".")) refs.add(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (typeof v === "object") Object.entries(v).forEach(([k, x]) => { if (k.includes("entity") || k === "flow") collect(x); });
  };
  collect(c.equipment); collect(c.paths); collect(c.datapoints); collect(c.kpis); collect(c.alarms); collect(c.assets); collect(c.energy);
  const issues = [];
  for (const id of refs) {
    const st = hassStates[id];
    if (!st) { issues.push({ entity_id: id, severity: "error", code: "missing", message: "Entity fehlt" }); continue; }
    const raw = lower(st.state);
    if (["unavailable", "unknown"].includes(raw)) issues.push({ entity_id: id, severity: "warning", code: raw, message: `Entity ist ${raw}` });
    const t = Date.parse(st.last_updated || st.last_changed || "");
    if (Number.isFinite(t) && now - t > c.diagnostics.stale_minutes * 60000) issues.push({ entity_id: id, severity: "warning", code: "stale", message: `Seit ${Math.round((now-t)/60000)} min nicht aktualisiert` });
  }
  const unused = c.diagnostics.show_unused_entities ? Object.keys(hassStates).filter((id) => !refs.has(id)) : [];
  return { referenced: [...refs], issues, unused, score: refs.size ? Math.max(0, 100 - issues.length / refs.size * 100) : 100 };
}

export function aggregateSeries(points, options = {}) {
  const agg = options.aggregate || "raw", deadband = Number(options.deadband || 0), bucketMs = Number(options.bucket_ms || 0);
  let src = arr(points).filter((p) => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))).map((p) => ({ x: Number(p.x), y: Number(p.y) })).sort((a,b)=>a.x-b.x);
  if (deadband > 0 && src.length) {
    const out = [src[0]]; for (const p of src.slice(1)) if (Math.abs(p.y - out.at(-1).y) >= deadband) out.push(p); src = out;
  }
  if (agg === "raw" || !bucketMs) return src;
  const buckets = new Map();
  for (const p of src) { const k = Math.floor(p.x / bucketMs) * bucketMs; const a = buckets.get(k) || []; a.push(p.y); buckets.set(k, a); }
  return [...buckets.entries()].map(([x, ys]) => ({ x, y: agg === "min" ? Math.min(...ys) : agg === "max" ? Math.max(...ys) : agg === "sum" ? ys.reduce((a,b)=>a+b,0) : ys.reduce((a,b)=>a+b,0)/ys.length }));
}

export function integrateEnergy(points, unit = "W") {
  const s = arr(points).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a,b)=>a.x-b.x); if (s.length < 2) return 0;
  const factor = unit === "MW" ? 1e6 : unit === "kW" ? 1000 : 1; let wh = 0;
  for (let i=1;i<s.length;i++) wh += ((s[i-1].y+s[i].y)/2*factor) * ((s[i].x-s[i-1].x)/3600000);
  return wh/1000;
}

export function energySummary(config, hassStates = {}) {
  const c = ensureV1(config), result = [];
  for (const m of c.energy.meters || []) {
    const st = hassStates[m.entity]; const value = Number.parseFloat(st?.state); if (!Number.isFinite(value)) continue;
    const cost = m.price_per_unit != null ? value * Number(m.price_per_unit) : null;
    const co2 = m.kind === "electricity" && c.energy.co2_factor_g_per_kwh ? value * c.energy.co2_factor_g_per_kwh / 1000 : null;
    result.push({ ...m, value, unit: st?.attributes?.unit_of_measurement || m.unit || "", cost, co2_kg: co2 });
  }
  return result;
}

function legacyProjectDiff(a, b, path = "") {
  const out = [];
  if (Object.is(a,b)) return out;
  const ta = Array.isArray(a) ? "array" : typeof a, tb = Array.isArray(b) ? "array" : typeof b;
  if (a === undefined) return [{ type: "added", path, after: clone(b) }];
  if (b === undefined) return [{ type: "removed", path, before: clone(a) }];
  if (ta !== tb || a === null || b === null || typeof a !== "object") return [{ type: "changed", path, before: clone(a), after: clone(b) }];
  if (Array.isArray(a) && Array.isArray(b)) {
    const keyable = [...a,...b].every((x) => x && typeof x === "object" && "id" in x);
    if (keyable) {
      const am = new Map(a.map((x)=>[x.id,x])), bm = new Map(b.map((x)=>[x.id,x]));
      for (const id of new Set([...am.keys(),...bm.keys()])) out.push(...legacyProjectDiff(am.get(id), bm.get(id), `${path}[${id}]`));
      return out;
    }
  }
  for (const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])) out.push(...legacyProjectDiff(a?.[k], b?.[k], path ? `${path}.${k}` : k));
  return out;
}

export function projectDiff(a, b, path = "") {
  const fullProjects = path === ""
    && a?.type === "custom:glt-flow-card"
    && b?.type === "custom:glt-flow-card";
  if (!fullProjects) return legacyProjectDiff(a, b, path);
  return computeProjectDiff(a, b).operations.map((operation) => ({
    type: operation.category === "add" ? "added" : operation.category === "remove" ? "removed" : "changed",
    path: operation.path,
    before: operation.before,
    after: operation.after,
    semantic_category: operation.category,
    operation_id: operation.id,
    impact: operation.impact,
    before_hash: operation.before_hash,
    after_hash: operation.after_hash,
    requires: operation.requires,
  }));
}

export async function makeProjectBundle(config, assets = []) {
  return createProjectBundle(ensureV1(config), assets);
}

export async function readProjectBundle(input, { includeAssets = false, onExtract } = {}) {
  const restored = await readProjectBundleArchive(input, { onExtract });
  if (includeAssets) {
    return { project: restored.project, assets: restored.assets, manifest: restored.manifest };
  }
  return restored.project;
}

export { BundleError, bundleDecision, createProjectBundle, readProjectBundleArchive } from "./project-bundle.mjs";

/**
 * The catalog's size, counted by rendering.
 *
 * This used to measure array lengths, which proves the array's length: a
 * catalog whose rows draw nothing reports the same number, and so does one
 * whose rows all draw the same picture. Both were true here. Counting what
 * actually rendered is the only version of this number a buyer can be shown,
 * and `catalog-evidence.json` records the digests behind it.
 */
export function symbolCatalogStats() {
  const bases = new Set();
  let variants = 0;
  for (const variant of SYMBOL_VARIANTS) {
    if (renderVariant(variant.base_symbol, variant.style).includes("</title><")) {
      bases.add(variant.base_symbol);
      variants += 1;
    }
  }
  return {
    base_symbols: bases.size,
    variants,
    styles: VISUAL_STYLES.length,
    profiles: COMPONENT_PROFILES.length,
  };
}
