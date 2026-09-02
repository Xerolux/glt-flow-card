import { VISUAL_STYLES, COMPONENT_PROFILES, SYMBOL_VARIANTS, profileForEquipment, portsForEquipment } from "./catalog.mjs";
import { ensureV1, deriveOperationalState, autoMapEquipment, smartRoute, alignObjects, diagnoseConfig,  energySummary, projectDiff, makeProjectBundle, readProjectBundle, symbolCatalogStats, semanticPath } from "./core.mjs";

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

  const LANG = {
    de:{operations:"Betrieb",alarms:"Alarme",trends:"Trends",schedule:"Zeitprogramme",semantics:"Semantik",automap:"Auto-Mapping",cad:"CAD",diagnostics:"Diagnose",simulation:"Simulation",energy:"Energie",maintenance:"Wartung",project:"Projekt v1",symbols:"Symbole 300+"},
    en:{operations:"Operations",alarms:"Alarms",trends:"Trends",schedule:"Schedules",semantics:"Semantics",automap:"Auto mapping",cad:"CAD",diagnostics:"Diagnostics",simulation:"Simulation",energy:"Energy",maintenance:"Maintenance",project:"Project v1",symbols:"Symbols 300+"}
  };
  const t = (config,key) => (LANG[config?.ui?.locale]||LANG.de)[key] || key;

  const sdk = window.GLTFlowCardSDK || { symbols:new Map(), profiles:new Map(), panels:new Map(), migrations:[], languages:new Map() };
  sdk.registerSymbol = (s)=>sdk.symbols.set(s.id,s); sdk.registerProfile=(p)=>sdk.profiles.set(p.id,p); sdk.registerPanel=(p)=>sdk.panels.set(p.id,p); sdk.registerMigration=(m)=>sdk.migrations.push(m); sdk.registerLanguage=(id,d)=>sdk.languages.set(id,d);
  for(const s of SYMBOL_VARIANTS)sdk.registerSymbol(s); for(const p of COMPONENT_PROFILES)sdk.registerProfile(p); for(const [id,d] of Object.entries(LANG))sdk.registerLanguage(id,d);
  sdk.version="1.0.0"; sdk.ensureV1=ensureV1; sdk.deriveOperationalState=deriveOperationalState; sdk.autoMapEquipment=autoMapEquipment; sdk.smartRoute=smartRoute; sdk.projectDiff=projectDiff; sdk.makeProjectBundle=makeProjectBundle; sdk.readProjectBundle=readProjectBundle; window.GLTFlowCardSDK=sdk;

  const STYLES = `
  .glt-v1-state{position:absolute;right:7px;top:7px;z-index:5;padding:3px 6px;border-radius:999px;font-size:8px;font-weight:850;border:1px solid var(--glt-border);background:color-mix(in srgb,var(--card-background-color) 92%,transparent);text-transform:uppercase;letter-spacing:.04em}
  .glt-v1-state.running,.glt-v1-state.auto,.glt-v1-state.remote{color:#22c55e;border-color:#22c55e66}.glt-v1-state.warning,.glt-v1-state.maintenance,.glt-v1-state.local,.glt-v1-state.manual{color:#f59e0b;border-color:#f59e0b66}.glt-v1-state.fault,.glt-v1-state.comm-error,.glt-v1-state.command-failed,.glt-v1-state.interlock,.glt-v1-state.locked{color:#ef4444;border-color:#ef444466}.glt-v1-state.stale,.glt-v1-state.invalid,.glt-v1-state.unknown{color:#94a3b8}
  .glt-v1-control-btn{position:absolute;right:7px;bottom:7px;z-index:8;width:26px;height:26px;border-radius:8px;border:1px solid var(--glt-border);background:var(--card-background-color);color:var(--glt-accent);cursor:pointer;display:grid;place-items:center;font-size:12px}
  .glt-v1-notice{margin-top:10px;padding:10px 12px;border:1px solid currentColor;border-radius:10px;min-height:44px;display:flex;align-items:center;gap:8px}
  .glt-v1-modal{position:fixed;inset:0;z-index:12000;background:#020617bd;display:grid;place-items:center;padding:20px}.glt-v1-dialog{width:min(1080px,97vw);max-height:92vh;overflow:auto;border:1px solid var(--glt-border,var(--divider-color));border-radius:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color);box-shadow:0 30px 90px #0008}.glt-v1-head{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-bottom:1px solid var(--glt-border,var(--divider-color));background:var(--card-background-color,#fff)}.glt-v1-body{padding:14px}.glt-v1-close,.glt-v1-btn{border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:transparent;color:var(--primary-text-color);padding:7px 9px;font-size:9px;font-weight:750;cursor:pointer}.glt-v1-close{border:0;font-size:15px}.glt-v1-btn.primary{color:#fff;background:#0b83cc;border-color:#1fb4ff}.glt-v1-btn.warn{color:#dc2626}.glt-v1-actions{display:flex;gap:6px;flex-wrap:wrap}.glt-v1-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.glt-v1-card{border:1px solid var(--glt-border,var(--divider-color));border-radius:11px;padding:10px;background:color-mix(in srgb,var(--card-background-color) 96%,#64748b 4%)}.glt-v1-card b{display:block;font-size:11px}.glt-v1-card small{display:block;color:var(--secondary-text-color);margin-top:3px;font-size:8px}.glt-v1-table{width:100%;border-collapse:collapse;font-size:9px}.glt-v1-table th,.glt-v1-table td{padding:7px;border-bottom:1px solid var(--glt-border,var(--divider-color));text-align:left;vertical-align:top}.glt-v1-input,.glt-v1-select,.glt-v1-text{width:100%;padding:7px;border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);font-size:9px}.glt-v1-text{min-height:100px}.glt-v1-toolbar{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding:5px 8px;border-bottom:1px solid var(--b,var(--divider-color));background:color-mix(in srgb,var(--bg,var(--card-background-color)) 96%,#0ea5e9 4%)}.glt-v1-toolbar button{height:29px;border:1px solid var(--b,var(--divider-color));border-radius:7px;background:transparent;color:var(--mut,var(--secondary-text-color));font-size:8px;font-weight:760;padding:0 8px;cursor:pointer}.glt-v1-toolbar button:hover{color:var(--e,#0ea5e9);border-color:#0ea5e966}.glt-v1-minimap{position:absolute;right:12px;bottom:12px;width:180px;height:110px;border:1px solid var(--b);border-radius:9px;background:#07131fe6;z-index:50;overflow:hidden;pointer-events:none}.glt-v1-miniitem{position:absolute;background:#2aaeff66;border:1px solid #4bc6ff88;border-radius:2px}.glt-v1-layer-hidden{display:none!important}.glt-v1-layer-locked{pointer-events:none!important;opacity:.65}.glt-v1-breadcrumbs{display:flex;gap:5px;align-items:center;padding:5px 14px;font-size:9px;color:var(--secondary-text-color);border-bottom:1px solid var(--glt-border)}.glt-v1-breadcrumbs button{border:0;background:transparent;color:var(--glt-accent);cursor:pointer;font-size:9px}.glt-v1-quality.good{color:#22c55e}.glt-v1-quality.uncertain{color:#f59e0b}.glt-v1-quality.bad{color:#ef4444}
  body.glt-v1-kiosk .header,body.glt-v1-kiosk app-toolbar{display:none!important}@media(min-width:1800px){.glt-v1-dialog{width:min(1320px,96vw)}}`;
  function addStyle(root){if(root?.querySelector("style[data-glt-v1]"))return;const st=document.createElement("style");st.dataset.gltV1="1";st.textContent=STYLES;root?.appendChild(st);}
  /**
   * Say something in the card, rather than in a browser dialog.
   *
   * `alert` is modal, unstyleable, invisible to the effect ledger, and
   * unreachable by the kiosk's key handling. A message that could have been a
   * sentence next to the thing it is about becomes a blocking interruption the
   * operator has to dismiss before they can look at what went wrong.
   */
  function notice(owner,message){const root=owner.shadowRoot||owner;root.querySelector("[data-glt-notice]")?.remove();const strip=document.createElement("div");strip.dataset.gltNotice="1";strip.setAttribute("role","status");strip.setAttribute("aria-live","polite");strip.className="glt-v1-notice";strip.textContent=String(message);(root.querySelector(".glt-v1-modal .glt-v1-body")||root).appendChild(strip);}

  function modal(owner,title,html){const root=owner.shadowRoot||owner;root.querySelector(".glt-v1-modal")?.remove();const m=document.createElement("div");m.className="glt-v1-modal";m.innerHTML=`<div class="glt-v1-dialog"><div class="glt-v1-head"><b>${esc(title)}</b><button class="glt-v1-close">✕</button></div><div class="glt-v1-body">${html}</div></div>`;m.querySelector(".glt-v1-close").onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};root.appendChild(m);return m;}
  // A fully qualified type is passed through unchanged, so a call site may name
  // the exact wire route it depends on rather than a suffix that reads the same
  // as several unrelated things.
  async function ws(owner,type,payload={}){if(!owner?._hass?.callWS)throw new Error("Companion nicht verfügbar");const wire=String(type).startsWith("glt_flow_card/")?String(type):`glt_flow_card/${type}`;return owner._hass.callWS({type:wire,...payload});}
  // A real dialog, not `prompt()`. The UI contract forbids `prompt` on the
  // acknowledgement path: it blocks the whole page, cannot be styled, cannot be
  // localized, and is unreachable in a kiosk. Resolves to null when cancelled,
  // so a caller can tell "cancelled" from "entered nothing".
  function askText(owner,label,initial=""){return new Promise(resolve=>{const root=owner.shadowRoot||owner;const host=document.createElement("div");host.className="glt-v1-modal";host.dataset.gltAsk="1";host.innerHTML=`<div class="glt-v1-body" role="dialog" aria-modal="true" aria-label="${esc(label)}"><label class="glt-v1-label">${esc(label)}<input class="glt-v1-input" data-value></label><div class="glt-v1-actions"><button class="glt-v1-btn primary" data-ok>OK</button><button class="glt-v1-btn" data-cancel>Abbrechen</button></div></div>`;const input=host.querySelector("[data-value]");input.value=String(initial??"");const close=value=>{host.remove();resolve(value)};host.querySelector("[data-ok]").onclick=()=>close(input.value);host.querySelector("[data-cancel]").onclick=()=>close(null);host.addEventListener("keydown",event=>{if(event.key==="Escape")close(null);if(event.key==="Enter")close(input.value)});root.appendChild(host);input.focus();});}

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
    notice(card,"Bedienung läuft über die vom Server zusammengestellte Objektbedienung.");
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
    const m=modal(card,t(cfg,"alarms"),`<div class="glt-v1-actions" style="margin-bottom:10px"><button class="glt-v1-btn" data-refresh>Aktualisieren</button></div>${loaded.unavailable?'<p data-unavailable style="font-size:9px;color:var(--mut)">Alarmzustand derzeit nicht abrufbar.</p>':""}<table class="glt-v1-table"><thead><tr><th>Status</th><th>Priorit\u00e4t</th><th>Meldung</th><th>Unterdr\u00fcckung</th><th>Zustellung</th><th>Aktion</th></tr></thead><tbody>${rows.join("")||'<tr><td colspan="6">Keine Alarme konfiguriert.</td></tr>'}</tbody></table>`);
    m.querySelector("[data-refresh]").onclick=()=>{m.remove();alarmsPanel(card)};
    // Post, then re-read. An optimistic paint the server refused is a lie the
    // operator will act on.
    m.querySelectorAll("[data-ack]").forEach(b=>b.onclick=async()=>{const comment=await askText(card,"Quittierkommentar","");if(comment===null)return;try{await ws(card,"alarms/ack",{project_id:projectId(cfg),alarm_id:b.dataset.ack,comment});}catch(err){notice(card,err.message);}await audit(card,"alarm.ack",{alarm_id:b.dataset.ack});m.remove();alarmsPanel(card)});
    m.querySelectorAll("[data-shelve]").forEach(b=>b.onclick=async()=>{const answer=await askText(card,"F\u00fcr wie viele Minuten unterdr\u00fccken?","60");if(answer===null)return;const minutes=Number(answer)||60;try{await ws(card,"alarms/shelve",{project_id:projectId(cfg),alarm_id:b.dataset.shelve,minutes});}catch(err){notice(card,err.message);}m.remove();alarmsPanel(card)});}
  function operationsPanel(card){const cfg=ensureV1(card._config);const items=cfg.equipment.map(i=>({i,s:deriveOperationalState(i,card._hass?.states,{stale_minutes:cfg.diagnostics.stale_minutes})})).sort((a,b)=>b.s.severity-a.s.severity);const m=modal(card,t(cfg,"operations"),`<div class="glt-v1-grid">${items.map(({i,s})=>`<div class="glt-v1-card"><b>${esc(i.name||i.id)}</b><small>${esc(s.label)} · ${esc(s.quality)}</small><div class="glt-v1-actions"><button class="glt-v1-btn" data-open="${esc(i.id)}">Bedienen</button></div></div>`).join("")}</div>`);m.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const i=cfg.equipment.find(x=>x.id===b.dataset.open);m.remove();openOperations(card,i)});}
  function runtimeButtons(card){const root=card.shadowRoot,bar=root.querySelector(".glt4-tool,.glt-toolbar,.toolbar,.glt-head-actions");if(!bar||bar.querySelector("[data-glt-v1-runtime]"))return;const wrap=document.createElement("span");wrap.dataset.gltV1Runtime="1";wrap.className="glt-v1-actions";wrap.innerHTML=`<button class="glt4-pill glt-v1-btn" data-ops>${t(card._config,"operations")}</button><button class="glt4-pill glt-v1-btn" data-alarm>${t(card._config,"alarms")}</button><button class="glt4-pill glt-v1-btn" data-trend>${t(card._config,"trends")}</button>`;wrap.querySelector("[data-ops]").onclick=()=>operationsPanel(card);wrap.querySelector("[data-alarm]").onclick=()=>alarmsPanel(card);wrap.querySelector("[data-trend]").onclick=()=>trendsPanel(card);bar.appendChild(wrap);}
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

  function showSymbolLibrary(editor){const stats=symbolCatalogStats(),current=selectedEquipment(editor)[0];const m=editorModal(editor,`${t(editor._config,"symbols")} · ${stats.variants} Varianten`,`<div class="glt-v1-actions"><select class="glt-v1-select" data-style>${VISUAL_STYLES.map(s=>`<option value="${s.id}">${s.label}</option>`).join("")}</select><input class="glt-v1-input" data-q placeholder="Pumpe, Ventil, RLT…"></div><div class="glt-v1-grid" data-grid style="margin-top:10px"></div>`);const render=()=>{const q=m.querySelector("[data-q]").value.toLowerCase(),style=m.querySelector("[data-style]").value;const data=SYMBOL_VARIANTS.filter(s=>s.style===style&&(!q||`${s.label} ${s.category}`.toLowerCase().includes(q)));m.querySelector("[data-grid]").innerHTML=data.map(s=>`<div class="glt-v1-card"><b>${esc(s.label)}</b><small>${esc(s.category)} · ${esc(s.profile)}</small>${current?`<button class="glt-v1-btn" data-use="${esc(s.id)}">Übernehmen</button>`:""}</div>`).join("");m.querySelectorAll("[data-use]").forEach(b=>b.onclick=()=>{const s=SYMBOL_VARIANTS.find(x=>x.id===b.dataset.use);editor._remember?.();current.symbol=s.base_symbol;current.symbol_variant=s.id;current.profile=s.profile;editor._config.appearance=editor._config.appearance||{};editor._config.appearance.mode=s.style;emit(editor);m.remove();});};m.querySelector("[data-q]").oninput=render;m.querySelector("[data-style]").onchange=render;render();}

  function showSemantics(editor){const items=editor._config.equipment||[];const m=editorModal(editor,t(editor._config,"semantics"),`<p style="font-size:9px;color:var(--mut)">Standort → Gebäude → Etage → System → Teilanlage → Aggregat → Datenpunkt</p><table class="glt-v1-table"><thead><tr><th>Aggregat</th><th>Site</th><th>Gebäude</th><th>Etage</th><th>System</th><th>Tags</th></tr></thead><tbody>${items.map((i,n)=>`<tr data-i="${n}"><td>${esc(i.name||i.id)}</td><td><input class="glt-v1-input" data-f="site" value="${esc(i.site||"")}"></td><td><input class="glt-v1-input" data-f="building" value="${esc(i.building||"")}"></td><td><input class="glt-v1-input" data-f="floor" value="${esc(i.floor||"")}"></td><td><input class="glt-v1-input" data-f="system" value="${esc(i.system||"")}"></td><td><input class="glt-v1-input" data-f="tags" value="${esc((i.tags||[]).join(", "))}"></td></tr>`).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn primary" data-save>Übernehmen</button></div>`);m.querySelector("[data-save]").onclick=()=>{editor._remember?.();m.querySelectorAll("[data-i]").forEach(r=>{const i=items[+r.dataset.i];r.querySelectorAll("[data-f]").forEach(inp=>{if(inp.dataset.f==="tags")i.tags=inp.value.split(",").map(x=>x.trim()).filter(Boolean);else i[inp.dataset.f]=inp.value||undefined;});i.semantic_path=semanticPath(i,editor._config);});emit(editor);m.remove();};}

  function showAutoMapping(editor){const item=selectedEquipment(editor)[0];if(!item)return notice(editor,"Zuerst ein Anlagenobjekt auswählen.");const result=autoMapEquipment(item,editor._hass?.states||{}),profile=profileForEquipment(item);const rows=(profile.slots||[]).map(s=>{const opts=result.suggestions[s.id]||[];return `<tr data-slot="${esc(s.id)}"><td>${esc(s.label)}</td><td><select class="glt-v1-select">${opts.map(o=>`<option value="${esc(o.entity_id)}">${esc(o.name)} · ${o.score} · ${esc(o.unit)}</option>`).join("")}</select></td></tr>`}).join("");const m=editorModal(editor,`${t(editor._config,"automap")} · ${profile.label}`,`<table class="glt-v1-table"><thead><tr><th>Slot</th><th>Vorschlag</th></tr></thead><tbody>${rows||'<tr><td colspan="2">Keine Slots.</td></tr>'}</tbody></table><button class="glt-v1-btn primary" data-apply>Bestätigen und zuordnen</button>`);m.querySelector("[data-apply]").onclick=()=>{editor._remember?.();item.bindings=item.bindings||{};m.querySelectorAll("[data-slot]").forEach(r=>item.bindings[r.dataset.slot]=r.querySelector("select").value);emit(editor);m.remove();};}

  function showCAD(editor){const refs=selectedRefs(editor),cfg=editor._config;const m=editorModal(editor,t(cfg,"cad"),`<div class="glt-v1-grid"><div class="glt-v1-card"><b>Ausrichten</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-a="left">Links</button><button class="glt-v1-btn" data-a="right">Rechts</button><button class="glt-v1-btn" data-a="top">Oben</button><button class="glt-v1-btn" data-a="bottom">Unten</button><button class="glt-v1-btn" data-a="center_v">Mitte X</button><button class="glt-v1-btn" data-a="center_h">Mitte Y</button></div></div><div class="glt-v1-card"><b>Verteilen</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-a="distribute_h">Horizontal</button><button class="glt-v1-btn" data-a="distribute_v">Vertikal</button></div></div><div class="glt-v1-card"><b>Layer</b><button class="glt-v1-btn" data-layer>Layer verwalten</button></div><div class="glt-v1-card"><b>Routing</b><button class="glt-v1-btn" data-route>Alle Auto-Routen neu berechnen</button></div><div class="glt-v1-card"><b>Zwischenablage</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-copy>Copy</button><button class="glt-v1-btn" data-paste>Paste</button></div></div></div>`);m.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{editor._remember?.();alignObjects(cfg,refs,b.dataset.a);emit(editor);m.remove();});m.querySelector("[data-route]").onclick=()=>{editor._remember?.();cfg.paths.forEach(p=>{if(p.from_equipment&&p.to_equipment&&p.auto_route!==false)p.points=smartRoute(cfg,p,editor._viewId)});emit(editor);m.remove();};m.querySelector("[data-copy]").onclick=()=>{editor._gltV1Clipboard=refs.map(r=>{const list=r.kind==="equipment"?cfg.equipment:r.kind==="datapoint"?cfg.datapoints:r.kind==="path"?cfg.paths:cfg.kpis;return{kind:r.kind,obj:clone(list.find(x=>x.id===r.id))}}).filter(x=>x.obj);};m.querySelector("[data-paste]").onclick=()=>{editor._remember?.();for(const c of editor._gltV1Clipboard||[]){const o=clone(c.obj);o.id=`${o.id||c.kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`;if(Number.isFinite(o.x))o.x+=40;if(Number.isFinite(o.y))o.y+=40;(c.kind==="equipment"?cfg.equipment:c.kind==="datapoint"?cfg.datapoints:c.kind==="path"?cfg.paths:cfg.kpis).push(o)}emit(editor);m.remove();};m.querySelector("[data-layer]").onclick=()=>{m.remove();showLayers(editor);};}
  function showLayers(editor){const cfg=editor._config,m=editorModal(editor,"Layer",`<table class="glt-v1-table"><thead><tr><th>Name</th><th>Sichtbar</th><th>Gesperrt</th></tr></thead><tbody>${cfg.layers.map((l,i)=>`<tr data-l="${i}"><td><input class="glt-v1-input" data-name value="${esc(l.name||l.id)}"></td><td><input type="checkbox" data-vis ${l.visible!==false?"checked":""}></td><td><input type="checkbox" data-lock ${l.locked?"checked":""}></td></tr>`).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn" data-add>Layer hinzufügen</button><button class="glt-v1-btn primary" data-save>Übernehmen</button></div>`);m.querySelector("[data-add]").onclick=()=>{const name=prompt("Layername","Layer");if(name)cfg.layers.push({id:slug(name),name,visible:true,locked:false,order:cfg.layers.length}),m.remove(),showLayers(editor)};m.querySelector("[data-save]").onclick=()=>{m.querySelectorAll("[data-l]").forEach(r=>{const l=cfg.layers[+r.dataset.l];l.name=r.querySelector("[data-name]").value;l.visible=r.querySelector("[data-vis]").checked;l.locked=r.querySelector("[data-lock]").checked});emit(editor);m.remove();};}

  function showDiagnostics(editor){const d=diagnoseConfig(editor._config,editor._hass?.states||{});editorModal(editor,`${t(editor._config,"diagnostics")} · ${d.score.toFixed(0)} %`,`<div class="glt-v1-grid"><div class="glt-v1-card"><b>${d.referenced.length}</b><small>verwendete Entities</small></div><div class="glt-v1-card"><b>${d.issues.length}</b><small>Probleme</small></div><div class="glt-v1-card"><b>${d.unused.length}</b><small>nicht verwendete HA-Entities</small></div></div><table class="glt-v1-table"><thead><tr><th>Entity</th><th>Typ</th><th>Meldung</th></tr></thead><tbody>${d.issues.map(i=>`<tr><td>${esc(i.entity_id)}</td><td>${esc(i.severity)}</td><td>${esc(i.message)}</td></tr>`).join("")||'<tr><td colspan="3">Keine Probleme erkannt.</td></tr>'}</tbody></table>`);}
  function showSimulation(editor){const cfg=editor._config,item=selectedEquipment(editor)[0];const m=editorModal(editor,t(cfg,"simulation"),`<label><input type="checkbox" data-enabled ${cfg.simulation.enabled?"checked":""}> Simulationsmodus aktiv</label>${item?`<div class="glt-v1-card" style="margin-top:10px"><b>${esc(item.name||item.id)}</b><select class="glt-v1-select" data-state>${["off","running","auto","manual","local","warning","fault","maintenance","comm_error"].map(x=>`<option value="${x}">${x}</option>`).join("")}</select><input class="glt-v1-input" data-value placeholder="Simulierter Wert"></div>`:""}<button class="glt-v1-btn primary" data-save>Übernehmen</button>`);m.querySelector("[data-save]").onclick=()=>{cfg.simulation.enabled=m.querySelector("[data-enabled]").checked;if(item){cfg.simulation.states[item.id]={state:m.querySelector("[data-state]").value,value:m.querySelector("[data-value]").value}}emit(editor);m.remove();};}

  function showSchedules(editor){const cfg=editor._config,m=editorModal(editor,t(cfg,"schedule"),`<table class="glt-v1-table"><thead><tr><th>Name</th><th>Tage</th><th>Zeit</th><th>Service</th><th>Entity</th><th></th></tr></thead><tbody data-body>${cfg.schedules.map((s,i)=>scheduleRow(s,i)).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn" data-add>Hinzufügen</button><button class="glt-v1-btn primary" data-save>Speichern</button></div>`);function scheduleRow(s={},i="new"){return`<tr data-s="${i}"><td><input class="glt-v1-input" data-name value="${esc(s.name||"")}"></td><td><input class="glt-v1-input" data-days value="${esc((s.days||[0,1,2,3,4]).join(","))}"></td><td><input class="glt-v1-input" data-time value="${esc(s.time||"08:00")}"></td><td><input class="glt-v1-input" data-service value="${esc(s.service||"switch.turn_on")}"></td><td><input class="glt-v1-input" data-entity value="${esc(s.entity_id||"")}"></td><td><button class="glt-v1-btn warn" data-rm>✕</button></td></tr>`}const bind=()=>m.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>b.closest("tr").remove());bind();m.querySelector("[data-add]").onclick=()=>{m.querySelector("[data-body]").insertAdjacentHTML("beforeend",scheduleRow({},"new"));bind()};m.querySelector("[data-save]").onclick=()=>{editor._remember?.();cfg.schedules=[...m.querySelectorAll("[data-s]")].map((r,i)=>({id:cfg.schedules[i]?.id||`schedule_${Date.now()}_${i}`,name:r.querySelector("[data-name]").value||`Zeitprogramm ${i+1}`,days:r.querySelector("[data-days]").value.split(",").map(Number).filter(Number.isFinite),time:r.querySelector("[data-time]").value,service:r.querySelector("[data-service]").value,entity_id:r.querySelector("[data-entity]").value,enabled:true}));emit(editor);m.remove();};}

  function showEnergy(editor){const cfg=editor._config,m=editorModal(editor,t(cfg,"energy"),`<table class="glt-v1-table"><thead><tr><th>Name</th><th>Art</th><th>Entity</th><th>Preis/Einheit</th></tr></thead><tbody data-b>${cfg.energy.meters.map((x,i)=>`<tr data-e="${i}"><td><input class="glt-v1-input" data-name value="${esc(x.name||"")}"></td><td><select class="glt-v1-select" data-kind>${["electricity","heat","cooling","water","gas","pv","battery"].map(k=>`<option ${x.kind===k?"selected":""}>${k}</option>`).join("")}</select></td><td><input class="glt-v1-input" data-entity value="${esc(x.entity||"")}"></td><td><input class="glt-v1-input" data-price value="${esc(x.price_per_unit??"")}"></td></tr>`).join("")}</tbody></table><div class="glt-v1-actions"><button class="glt-v1-btn" data-add>Zähler hinzufügen</button><button class="glt-v1-btn primary" data-save>Speichern</button></div>`);m.querySelector("[data-add]").onclick=()=>{cfg.energy.meters.push({id:`meter_${Date.now()}`,name:"Zähler",kind:"electricity",entity:""});m.remove();showEnergy(editor)};m.querySelector("[data-save]").onclick=()=>{m.querySelectorAll("[data-e]").forEach((r,i)=>Object.assign(cfg.energy.meters[i],{name:r.querySelector("[data-name]").value,kind:r.querySelector("[data-kind]").value,entity:r.querySelector("[data-entity]").value,price_per_unit:Number(r.querySelector("[data-price]").value)||undefined}));emit(editor);m.remove();};}

  function showMaintenance(editor){const cfg=editor._config,m=editorModal(editor,t(cfg,"maintenance"),`<div class="glt-v1-actions"><button class="glt-v1-btn" data-new>Arbeitsauftrag</button></div><table class="glt-v1-table"><thead><tr><th>Status</th><th>Asset</th><th>Aufgabe</th><th>Fällig</th><th>Techniker</th></tr></thead><tbody>${cfg.work_orders.map(w=>`<tr><td>${esc(w.status||"open")}</td><td>${esc(w.asset_id||"")}</td><td>${esc(w.title||"")}</td><td>${esc(w.due||"")}</td><td>${esc(w.assignee||"")}</td></tr>`).join("")||'<tr><td colspan="5">Keine Arbeitsaufträge.</td></tr>'}</tbody></table>`);m.querySelector("[data-new]").onclick=()=>{const title=prompt("Aufgabe","Wartung durchführen");if(!title)return;cfg.work_orders.push({id:`wo_${Date.now()}`,title,status:"open",asset_id:"",due:new Date().toISOString().slice(0,10),created:new Date().toISOString()});emit(editor);m.remove();showMaintenance(editor)};}

  function showProjectV1(editor){const cfg=editor._config;const m=editorModal(editor,t(cfg,"project"),`<div class="glt-v1-grid"><div class="glt-v1-card"><b>Schema</b><strong>v${cfg.schema_version}</strong><small>Revision ${cfg.project.revision||0}</small></div><div class="glt-v1-card"><b>.gltproject</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-export>Export</button><button class="glt-v1-btn" data-import>Import</button></div></div><div class="glt-v1-card"><b>Projekt-Lock</b><div class="glt-v1-actions"><button class="glt-v1-btn" data-lock>Lock</button><button class="glt-v1-btn" data-unlock>Unlock</button></div></div><div class="glt-v1-card"><b>Vergleich</b><button class="glt-v1-btn" data-diff>Mit YAML/JSON vergleichen</button></div></div><input type="file" data-file accept=".gltproject" style="display:none">`);m.querySelector("[data-export]").onclick=async()=>{try{download(`${slug(cfg.project.name)}.gltproject`,await makeProjectBundle(cfg),"application/zip")}catch(err){notice(editor,err.message)}};m.querySelector("[data-import]").onclick=()=>m.querySelector("[data-file]").click();m.querySelector("[data-file]").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const next=await readProjectBundle(await f.arrayBuffer());editor.setConfig(next);emit(editor);m.remove();}catch(err){notice(editor,err.message)}};m.querySelector("[data-lock]").onclick=async()=>{try{await ws(editor,"projects/lock",{project_id:projectId(cfg),ttl_seconds:300});notice(editor,"Projekt gesperrt.")}catch(err){notice(editor,err.message)}};m.querySelector("[data-unlock]").onclick=async()=>{try{await ws(editor,"projects/unlock",{project_id:projectId(cfg)});notice(editor,"Lock gelöst.")}catch(err){notice(editor,err.message)}};m.querySelector("[data-diff]").onclick=()=>{const txt=prompt("Vergleichskonfiguration als JSON einfügen");if(!txt)return;try{const other=JSON.parse(txt),d=projectDiff(other,cfg);m.remove();editorModal(editor,"Projektvergleich",`<table class="glt-v1-table"><tbody>${d.slice(0,500).map(x=>`<tr><td>${esc(x.type)}</td><td><code>${esc(x.path)}</code></td><td>${esc(JSON.stringify(x.before))}</td><td>${esc(JSON.stringify(x.after))}</td></tr>`).join("")}</tbody></table>`)}catch(err){notice(editor,err.message)}};}

  function applyLayers(editor){const cfg=editor._config,layers=new Map(cfg.layers.map(l=>[l.id,l]));editor.shadowRoot.querySelectorAll("[data-k][data-id]").forEach(n=>{const kind=n.dataset.k,id=n.dataset.id;const list=kind==="equipment"?cfg.equipment:kind==="datapoint"?cfg.datapoints:kind==="path"?cfg.paths:[];const obj=list.find(x=>x.id===id),l=layers.get(obj?.layer||"default");n.classList.toggle("glt-v1-layer-hidden",l?.visible===false);n.classList.toggle("glt-v1-layer-locked",l?.locked===true);});}
  function minimap(editor){const root=editor.shadowRoot;if(editor._config.ui?.minimap===false){root.querySelector(".glt-v1-minimap")?.remove();return}const host=root.querySelector(".canvas,.stage,[data-canvas],.draw");if(!host||root.querySelector(".glt-v1-minimap"))return;const m=document.createElement("div");m.className="glt-v1-minimap";const cw=editor._config.canvas?.width||1600,ch=editor._config.canvas?.height||900;for(const e of editor._config.equipment||[]){const d=document.createElement("div");d.className="glt-v1-miniitem";d.style.left=`${(e.x||0)/cw*180}px`;d.style.top=`${(e.y||0)/ch*110}px`;d.style.width=`${Math.max(3,(e.width||180)/cw*180)}px`;d.style.height=`${Math.max(3,(e.height||100)/ch*110)}px`;m.appendChild(d)}host.style.position=host.style.position||"relative";host.appendChild(m);}

  function editorToolbar(editor){const root=editor.shadowRoot;if(root.querySelector("[data-glt-v1-toolbar]"))return;const base=root.querySelector(".glt4-bar,.toolbar,.bar,.tb")||root.firstElementChild;if(!base)return;const bar=document.createElement("div");bar.className="glt-v1-toolbar";bar.dataset.gltV1Toolbar="1";const buttons=[["symbols","🧩"],["semantics","⌘"],["automap","↯"],["cad","⌗"],["diagnostics","✓"],["simulation","◉"],["schedule","◷"],["energy","⚡"],["maintenance","🔧"],["project","▣"]];bar.innerHTML=buttons.map(([k,ic])=>`<button data-v1="${k}">${ic} ${esc(t(editor._config,k))}</button>`).join("");base.after(bar);const act={symbols:showSymbolLibrary,semantics:showSemantics,automap:showAutoMapping,cad:showCAD,diagnostics:showDiagnostics,simulation:showSimulation,schedule:showSchedules,energy:showEnergy,maintenance:showMaintenance,project:showProjectV1};bar.querySelectorAll("[data-v1]").forEach(b=>b.onclick=()=>act[b.dataset.v1]?.(editor));}
  const oldEditorRender=Editor.prototype._render;Editor.prototype._render=function(){this._config=ensureV1(this._config);const r=oldEditorRender.call(this);addStyle(this.shadowRoot);editorToolbar(this);applyLayers(this);minimap(this);return r;};

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
