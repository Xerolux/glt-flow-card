/* Platform 1.0 completion layer: drill-down, lasso/Z-order, energy dashboard and report designer. */

/**
 * One text prompt, as a real dialog, through the same SDK bridge `gltText` uses.
 *
 * `window.prompt` blocks the page, cannot be styled or localized, carries no
 * accessible name and does not exist in a kiosk browser — which is where this
 * product is installed. The v1 bundle owns the modal; this file reaches it
 * rather than growing a second one that would drift.
 *
 * Resolves to null on cancel, matching what `prompt()` returned, so the call
 * sites keep their shape. The fallback is the same reasoning as `gltText`
 * falling back to the key: a degraded control beats a dead button.
 */
async function ask(owner, label, initial = "") {
  const sdk = typeof window === "undefined" ? null : window.GLTFlowCardSDK;
  if (sdk?.askText && owner) return sdk.askText(owner, label, initial);
  return typeof prompt === "function" ? prompt(label, initial) : null;
}

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

(() => {
  "use strict";
  const Card=customElements.get("glt-flow-card"),Editor=customElements.get("glt-flow-card-editor");
  if(!Card||!Editor)return;
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const eid=v=>typeof v==="string"?v:v?.entity||"";
  function box(owner,title,html){/* Body-level like the platform modal: the card rewrites its shadow root on every live update, which used to destroy this panel within seconds. The needed styles are either already injected by the platform modal or added here once. */if(!document.head.querySelector("style[data-glt-v1-global]")){const s=document.createElement("style");s.dataset.gltV1Global="1";s.textContent=`.glt-v1-modal{position:fixed;inset:0;z-index:12000;background:#020617bd;display:grid;place-items:center;padding:20px}.glt-v1-dialog{width:min(1080px,97vw);max-height:92vh;overflow:auto;border:1px solid var(--glt-border,var(--divider-color));border-radius:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color);box-shadow:0 30px 90px #0008}.glt-v1-head{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-bottom:1px solid var(--glt-border,var(--divider-color));background:var(--card-background-color,#fff)}.glt-v1-body{padding:14px}.glt-v1-close,.glt-v1-btn{border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:transparent;color:var(--primary-text-color);padding:7px 9px;font-size:9px;font-weight:750;cursor:pointer}.glt-v1-close{border:0;font-size:15px}.glt-v1-input,.glt-v1-select{width:100%;padding:7px;border:1px solid var(--glt-border,var(--divider-color));border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);font-size:9px}.glt-v1-actions{display:flex;gap:6px;flex-wrap:wrap}.glt-v1-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.glt-v1-card{border:1px solid var(--glt-border,var(--divider-color));border-radius:11px;padding:10px;background:color-mix(in srgb,var(--card-background-color) 96%,#64748b 4%)}.glt-v1-card b{display:block;font-size:11px}.glt-v1-card small{display:block;color:var(--secondary-text-color);margin-top:3px;font-size:8px}.glt-v1-notice{margin-top:10px;padding:10px 12px;border:1px solid currentColor;border-radius:10px;min-height:44px;display:flex;align-items:center;gap:8px}`;document.head.appendChild(s);}document.querySelector(".glt-v1-addon-modal")?.remove();const m=document.createElement("div");m.className="glt-v1-modal glt-v1-addon-modal";m.innerHTML=`<div class="glt-v1-dialog"><div class="glt-v1-head"><b>${esc(title)}</b><button class="glt-v1-close">✕</button></div><div class="glt-v1-body">${html}</div></div>`;m.querySelector(".glt-v1-close").onclick=()=>m.remove();document.body.appendChild(m);return m;}

  function energyPanel(card){const c=card._config,e=c.energy||{},meters=e.meters||[];let totalCost=0,totalCo2=0;const rows=meters.map(m=>{const st=card._hass?.states?.[m.entity],v=Number.parseFloat(st?.state),cost=Number.isFinite(v)&&m.price_per_unit!=null?v*Number(m.price_per_unit):null,co2=Number.isFinite(v)&&m.kind==="electricity"&&e.co2_factor_g_per_kwh?v*Number(e.co2_factor_g_per_kwh)/1000:null;if(cost!=null)totalCost+=cost;if(co2!=null)totalCo2+=co2;return`<div class="glt-v1-card"><b>${esc(m.name||m.id)}</b><strong>${Number.isFinite(v)?v.toFixed(2):"–"} ${esc(st?.attributes?.unit_of_measurement||m.unit||"")}</strong><small>${esc(m.kind||"meter")}${cost!=null?` · ${cost.toFixed(2)} €`:""}${co2!=null?` · ${co2.toFixed(2)} kg CO₂`:""}</small></div>`}).join("");box(card,"Energie & Medien",`<div class="glt-v1-grid"><div class="glt-v1-card"><b>Kostenindikator</b><strong>${totalCost.toFixed(2)} €</strong><small>aus aktuell konfigurierten Zählerständen</small></div><div class="glt-v1-card"><b>CO₂-Indikator</b><strong>${totalCo2.toFixed(2)} kg</strong><small>elektrische Zähler</small></div></div><h4>Medienfluss</h4><div class="glt-v1-grid">${rows||`<div class="glt-v1-card">${gltText("legacy.no_energy_meters")}</div>`}</div>`);}

  function reportPanel(editor){const c=editor._config;c.reports=c.reports||{enabled:true,definitions:[]};c.reports.definitions=c.reports.definitions||[];const m=box(editor,gltText("legacy.report_designer"),`<div class="glt-v1-actions"><button class="glt-v1-btn" data-new>Report anlegen</button></div><table class="glt-v1-table"><thead><tr><th>Name</th><th>Zeitraum</th><th>Format</th><th>Automatik</th></tr></thead><tbody>${c.reports.definitions.map(r=>`<tr><td>${esc(r.name||r.id)}</td><td>${esc(r.period||"month")}</td><td>${esc((r.formats||["pdf","csv"]).join(", "))}</td><td>${esc(r.schedule||"manuell")}</td></tr>`).join("")||'<tr><td colspan="4">Keine Reports.</td></tr>'}</tbody></table>`);m.querySelector("[data-new]").onclick=async()=>{const name=await ask(editor,gltText("legacy.prompt_report_name"),"Monatsbericht");if(!name)return;const period=await ask(editor,gltText("legacy.prompt_period"),"month")||"month";const schedule=await ask(editor,gltText("legacy.schedule_hint"),"")||"";c.reports.definitions.push({id:`report_${Date.now()}`,name,period,formats:["csv","pdf"],schedule});editor._emit?.();editor._render?.();m.remove();};}

  function addRuntimeButtons(card){const bar=card.shadowRoot.querySelector(".glt4-tool,.glt-toolbar,.toolbar,.glt-head-actions");if(!bar||bar.querySelector("[data-v1-energy]"))return;const b=document.createElement("button");b.className="glt4-pill glt-v1-btn";b.dataset.v1Energy="1";b.textContent=gltText("legacy.button_energy");b.onclick=()=>energyPanel(card);bar.appendChild(b);}

  function addDrilldown(card,canvas){const items=(card._config.equipment||[]).filter(i=>card._visibleInView?.(i)!==false);[...canvas.querySelectorAll(".glt-equipment")].forEach((node,i)=>{const item=items.find(x=>x.id===node.dataset.equipmentId)||items[i];if(!item?.detail_view||node.querySelector("[data-v1-drill]"))return;const b=document.createElement("button");b.className="glt-v1-control-btn";b.dataset.v1Drill="1";b.style.right="38px";b.textContent="↳";b.title=gltText("legacy.open_detail");b.onclick=e=>{e.preventDefault();e.stopPropagation();card._gltV1PrevView=card._view;card._view=item.detail_view;card._queueRender?.();};node.appendChild(b);});}
  function breadcrumbs(card){const root=card.shadowRoot;root.querySelector(".glt-v1-breadcrumbs")?.remove();if(!card._gltV1PrevView)return;const d=document.createElement("div");d.className="glt-v1-breadcrumbs";const current=(card._config.views||[]).find(v=>v.id===card._view);d.innerHTML=`<button data-home>‹ Übersicht</button><span>/</span><b>${esc(current?.name||card._view)}</b>`;d.querySelector("[data-home]").onclick=()=>{card._view=card._gltV1PrevView;card._gltV1PrevView=null;card._queueRender?.();};const anchor=root.querySelector(".glt-header,.header,.toolbar");anchor?.after(d);}
  const prevRE=Card.prototype._renderEquipment;Card.prototype._renderEquipment=function(canvas){const r=prevRE.call(this,canvas);addDrilldown(this,canvas);return r;};
  const prevR=Card.prototype._render;Card.prototype._render=function(){const r=prevR.call(this);addRuntimeButtons(this);breadcrumbs(this);return r;};

  function reorder(editor,dir){const refs=[...(editor._glt4Multi||[])].map(x=>x.split(":"));if(!refs.length&&editor._sel)refs.push([editor._sel.k,editor._sel.id]);const ids=new Set(refs.filter(r=>r[0]==="equipment").map(r=>r[1]));if(!ids.size)return;const a=editor._config.equipment;if(dir>0){for(let i=a.length-2;i>=0;i--)if(ids.has(a[i].id)&&!ids.has(a[i+1].id))[a[i],a[i+1]]=[a[i+1],a[i]];}else{for(let i=1;i<a.length;i++)if(ids.has(a[i].id)&&!ids.has(a[i-1].id))[a[i],a[i-1]]=[a[i-1],a[i]];}editor._emit?.();editor._render?.();}

  function lasso(editor){const root=editor.shadowRoot,stage=root.querySelector(".stage,.canvas,.draw,[data-canvas]");if(!stage||stage.dataset.v1Lasso)return;stage.dataset.v1Lasso="1";stage.addEventListener("pointerdown",e=>{if(!e.shiftKey||e.button!==0||e.target.closest?.("[data-k],.glt-equipment"))return;const sr=stage.getBoundingClientRect(),sx=e.clientX,sy=e.clientY;const rect=document.createElement("div");rect.style.cssText="position:fixed;z-index:10050;border:1px dashed #22b4ff;background:#22b4ff22;pointer-events:none";document.body.appendChild(rect);const move=ev=>{const x=Math.min(sx,ev.clientX),y=Math.min(sy,ev.clientY),w=Math.abs(ev.clientX-sx),h=Math.abs(ev.clientY-sy);Object.assign(rect.style,{left:x+"px",top:y+"px",width:w+"px",height:h+"px"});};const up=ev=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);const sel=rect.getBoundingClientRect();rect.remove();editor._glt4Multi=editor._glt4Multi||new Set();if(!e.ctrlKey&&!e.metaKey)editor._glt4Multi.clear();root.querySelectorAll('[data-k="equipment"][data-id],.glt-equipment[data-id]').forEach(n=>{const r=n.getBoundingClientRect();if(r.right>=sel.left&&r.left<=sel.right&&r.bottom>=sel.top&&r.top<=sel.bottom)editor._glt4Multi.add(`equipment:${n.dataset.id}`)});editor._render?.();};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);e.preventDefault();});}

  function addonToolbar(editor){const bar=editor.shadowRoot.querySelector(".glt-v1-toolbar");if(!bar)return;if(!bar.querySelector("[data-zup]")){const up=document.createElement("button"),down=document.createElement("button"),rep=document.createElement("button");up.dataset.zup="1";up.textContent="↑ Z";up.title=up.ariaLabel=gltText("legacy.button_z_raise");down.dataset.zdown="1";down.textContent="↓ Z";down.title=down.ariaLabel=gltText("legacy.button_z_lower");rep.dataset.report="1";rep.textContent=gltText("legacy.button_reports");up.onclick=()=>reorder(editor,1);down.onclick=()=>reorder(editor,-1);rep.onclick=()=>reportPanel(editor);bar.append(up,down,rep);}lasso(editor);}
  const prevER=Editor.prototype._render;Editor.prototype._render=function(){const r=prevER.call(this);addonToolbar(this);return r;};

  console.info("GLT Platform 1.0 completion layer: drill-down, lasso, Z-order, energy and report designer enabled.");
})();
