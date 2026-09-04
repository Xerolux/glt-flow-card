/*! GLT Online Designer v1 Engineering extensions */
import { factoryTemplates } from "./templates.mjs";
import { normalizeEntityImport } from "./entity-bridge.mjs";
import { text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";
(() => {
  /* The base designer's gltText goes through window.GLTFlowCardSDK, which the
   * online editor never had -- so every catalog call in this page fell back to
   * the raw key. Installing the real catalogs here fixes the base editor's
   * wording too, and the language follows the browser, the same rule the
   * documentation site uses. */
  if (!window.GLTFlowCardSDK) {
    window.GLTFlowCardSDK = {
      text: (key, language) => catalogText(key, language === "en" ? "en" : "de"),
      languages: new Map(),
    };
  }
  const ensure=()=>{cfg.schema_version=1;cfg.project=cfg.project||{id:uid("project"),name:cfg.title,revision:0};cfg.layers=cfg.layers||[{id:"default",name:"Standard",visible:true,locked:false}];cfg.schedules=cfg.schedules||[];cfg.energy=cfg.energy||{enabled:true,meters:[]};cfg.work_orders=cfg.work_orders||[];cfg.semantic_model=cfg.semantic_model||{sites:[],buildings:[],floors:[],systems:[]};cfg.diagnostics=cfg.diagnostics||{stale_minutes:10};cfg.simulation=cfg.simulation||{enabled:false,states:{}};cfg.security=cfg.security||{server_enforced:false};cfg.equipment=(cfg.equipment||[]).map(e=>({layer:"default",tags:[],...e}));};
  ensure();
  const bar=document.querySelector(".toolbar");
  if(!bar||bar.querySelector("[data-v1-platform]"))return;
  const b=(name,label)=>{const x=document.createElement("button");x.dataset.v1Platform=name;x.textContent=label;bar.appendChild(x);return x;};
  const platform=b("platform","Platform 1.0");const semantic=b("semantic","Semantik");const diag=b("diagnose","Diagnose");const schedule=b("schedule","Zeitplan");const energy=b("energy","Energie");const automap=b("automap","Auto-Map");
  const undoBtn=b("undo",gltText("legacy.undo"));const redoBtn=b("redo",gltText("legacy.redo"));const saveAs=b("saveas",gltText("legacy.save_as"));const templates=b("templates","Vorlagen");const entities=b("entities","Entities");
  platform.onclick=()=>{showDialog("GLT Engineering Platform 1.0",`<div class="project"><b>30 Ausbaupunkte</b><small>Betriebszustände · sichere Bedienung · Alarm Lifecycle · Zeitprogramme · Semantik · Auto-Mapping · parametrische Profile · 300+ Symbolvarianten · Ports · Hindernisrouting · CAD · Drill-down · Historian · Simulation · Diagnose · Energie · Wartung · Reports · Remote-HA · SDK · Projektbundles · Collaboration · i18n · Leitstand · Tests</small></div><div class="actions"><button id="v1-sim">Simulation ${cfg.simulation.enabled?"deaktivieren":"aktivieren"}</button><button id="v1-route">Routen neu berechnen</button></div>`);document.querySelector("#v1-sim").onclick=()=>{cfg.simulation.enabled=!cfg.simulation.enabled;dlg.close();saveDraft();status(`Simulation ${cfg.simulation.enabled?"aktiv":"aus"}`)};document.querySelector("#v1-route").onclick=()=>{render();dlg.close();status("Auto-Routing aktualisiert")};};
  semantic.onclick=()=>{const e=cfg.equipment.find(x=>x.id===selected);if(!e)return status("Zuerst Bauteil auswählen");showDialog("Semantik",`<div class="field"><label>Standort</label><input id="sem-site" value="${esc(e.site||"")}"></div><div class="field"><label>Gebäude</label><input id="sem-building" value="${esc(e.building||"")}"></div><div class="field"><label>Etage</label><input id="sem-floor" value="${esc(e.floor||"")}"></div><div class="field"><label>System / Teilanlage</label><input id="sem-system" value="${esc(e.system||"")}"></div><div class="field"><label>Tags</label><input id="sem-tags" value="${esc((e.tags||[]).join(", "))}"></div><button id="sem-save">Übernehmen</button>`);document.querySelector("#sem-save").onclick=()=>{e.site=document.querySelector("#sem-site").value||undefined;e.building=document.querySelector("#sem-building").value||undefined;e.floor=document.querySelector("#sem-floor").value||undefined;e.system=document.querySelector("#sem-system").value||undefined;e.tags=document.querySelector("#sem-tags").value.split(",").map(x=>x.trim()).filter(Boolean);e.semantic_path=[e.site,e.building,e.floor,e.system,e.name].filter(Boolean).join(" / ");dlg.close();render();saveDraft()}};
  diag.onclick=()=>{const refs=new Set();const walk=v=>{if(typeof v==="string"&&v.includes("."))refs.add(v);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==="object")Object.entries(v).forEach(([k,x])=>{if(k.includes("entity")||k==="flow")walk(x)})};walk(cfg);showDialog("Inbetriebnahme & Diagnose",`<div class="project"><b>${refs.size} referenzierte Entities</b><small>Im Online-Designer sind keine Live-HA-States verfügbar. In Home Assistant prüft Platform 1.0 missing / unavailable / unknown / stale, Einheiten und ungenutzte Entities.</small></div><textarea>${esc([...refs].join("\n"))}</textarea>`)};
  schedule.onclick=()=>{showDialog("Zeitprogramme",`<div class="field"><label>Name</label><input id="sch-name" value="Heizbetrieb"></div><div class="field"><label>Tage (0=Mo)</label><input id="sch-days" value="0,1,2,3,4"></div><div class="field"><label>Zeit</label><input id="sch-time" value="06:00"></div><div class="field"><label>Service</label><input id="sch-service" value="switch.turn_on"></div><div class="field"><label>Entity</label><input id="sch-entity" placeholder="switch.heizung"></div><button id="sch-add">Zeitprogramm speichern</button>`);document.querySelector("#sch-add").onclick=()=>{cfg.schedules.push({id:uid("schedule"),name:document.querySelector("#sch-name").value,days:document.querySelector("#sch-days").value.split(",").map(Number),time:document.querySelector("#sch-time").value,service:document.querySelector("#sch-service").value,entity_id:document.querySelector("#sch-entity").value,enabled:true});dlg.close();saveDraft();status("Zeitprogramm hinzugefügt")}};
  energy.onclick=()=>{showDialog("Energie & Medien",`<div class="field"><label>Name</label><input id="en-name" value="Strom"></div><div class="field"><label>Art</label><select id="en-kind"><option>electricity</option><option>heat</option><option>cooling</option><option>water</option><option>gas</option><option>pv</option></select></div><div class="field"><label>Entity</label><input id="en-entity" placeholder="sensor.energy"></div><div class="field"><label>Preis / Einheit</label><input id="en-price" type="number" step="0.01"></div><button id="en-add">Zähler speichern</button>`);document.querySelector("#en-add").onclick=()=>{cfg.energy.meters.push({id:uid("meter"),name:document.querySelector("#en-name").value,kind:document.querySelector("#en-kind").value,entity:document.querySelector("#en-entity").value,price_per_unit:+document.querySelector("#en-price").value||undefined});dlg.close();saveDraft();status("Energiezähler hinzugefügt")}};
  /* Factory templates: load one of the shipped example plants and keep
   * editing. Loading replaces the draft, which autosave has just persisted. */
  templates.onclick=()=>{const list=factoryTemplates();showDialog("Vorlagen",list.map((tp,i)=>`<div class="project"><b>${esc(tp.name)}</b><small>${esc(tp.description)}</small><button data-tpl="${i}">Laden</button></div>`).join("")||"Keine Vorlagen verfügbar.");document.querySelectorAll("[data-tpl]").forEach(btn=>btn.onclick=()=>{const tp=list[+btn.dataset.tpl];if(!tp)return;cfg=structuredClone(tp.config);ensure();dlg.close();render();saveDraft();status(`Vorlage geladen: ${tp.name}`)});};
  /* Entity bridge: the file exported from Home Assistant (or from the HA
   * designer's Entities button) feeds suggestions into every entity field,
   * because without a live connection this designer has no picker. */
  const wireEntitySuggestions=()=>{const stored=JSON.parse(localStorage.getItem("glt-flow-card.entities")||"null");const list=(stored&&Array.isArray(stored.entities))?stored.entities:[];if(!list.length)return;let dl=document.querySelector("datalist#glt-entities");if(!dl){dl=document.createElement("datalist");dl.id="glt-entities";document.body.appendChild(dl);dl.innerHTML=list.slice(0,2000).map(e=>`<option value="${esc(e.entity_id)}">${esc(e.name)}</option>`).join("")}document.querySelectorAll('.field input[id*="entity" i]').forEach(inp=>inp.setAttribute("list","glt-entities"));};
  entities.onclick=()=>{const stored=JSON.parse(localStorage.getItem("glt-flow-card.entities")||"null");const n=(stored&&Array.isArray(stored.entities))?stored.entities.length:0;showDialog("Entities",`<div class="project"><b>Import für Entity-Felder</b><small>In Home Assistant über den Designer-Button „Entities" als Datei exportieren und hier laden: alle Entity-Felder bieten danach Vorschläge an.</small></div><label class="field" style="cursor:pointer">Datei wählen (.json)<input type="file" id="ent-file" accept=".json,application/json" hidden></label><div id="ent-out">${n?`${n} Entities importiert`:"Noch keine Entities importiert"}</div>`);const f=document.querySelector("#ent-file");if(f)f.onchange=async()=>{try{const data=JSON.parse(await f.files[0].text());const res=normalizeEntityImport(data);localStorage.setItem("glt-flow-card.entities",JSON.stringify(res));document.querySelector("#ent-out").textContent=`${res.count} Entities importiert · ${res.rejected} abgelehnt`;wireEntitySuggestions();status("Entities importiert")}catch(err){document.querySelector("#ent-out").textContent="Datei nicht lesbar"}};};
  /* Undo/redo over whole plant states. A snapshot is taken on every render
   * whose configuration differs from the last one seen, so the history holds
   * the state *before* each change -- exactly what "make this go away" needs.
   * Undo and redo set the marker themselves, so restoring a state never
   * pushes another history entry. */
  const history=[];let future=[];let lastState=JSON.stringify(cfg);
  const syncButtons=()=>{undoBtn.disabled=!history.length;redoBtn.disabled=!future.length;};
  const restore=(raw)=>{cfg=JSON.parse(raw);ensure();selected=null;lastState=JSON.stringify(cfg);render();saveDraft();};
  undoBtn.onclick=()=>{if(!history.length)return;future.push(lastState);restore(history.pop());status(gltText("legacy.undo"));};
  redoBtn.onclick=()=>{if(!future.length)return;history.push(lastState);restore(future.pop());status(gltText("legacy.redo"));};
  document.addEventListener("keydown",(ev)=>{
    if(!(ev.ctrlKey||ev.metaKey))return;
    const key=ev.key.toLowerCase();
    if(key==="z"&&!ev.shiftKey){ev.preventDefault();undoBtn.click();}
    else if(key==="y"||(key==="z"&&ev.shiftKey)){ev.preventDefault();redoBtn.click();}
  });
  /* "Save as": name the project, keep it in the library, and download the
   * Lovelace YAML in one step -- the file a manual dashboard card consumes. */
  saveAs.onclick=async()=>{
    const name=await askText(gltText("legacy.prompt_project_name"),cfg.project?.name||cfg.title);
    if(!name)return;
    cfg.project=cfg.project||{};cfg.project.name=name;cfg.title=name;
    saveLocal(name);saveDraft();render();
    const y=YAML.dump(cfg,{noRefs:true,lineWidth:120});
    const blob=new Blob([y],{type:"application/yaml"});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download=`${name}.yaml`;
    link.click();
    URL.revokeObjectURL(link.href);
    status(`${gltText("legacy.download_yaml")}: ${name}.yaml · ${gltText("legacy.sponsor_hint")}`);
  };

  /* The base designer never offered an entity input — YAML import was the
   * only way to bind a plant. With imported entities on board, a double-click
   * on a component assigns one, with the datalist suggesting what the import
   * carried over from Home Assistant. */
  document.addEventListener("dblclick",(ev)=>{
    const node=ev.target.closest?.(".node");
    if(!node)return;
    const item=cfg.equipment.find((x)=>x.id===node.dataset.id);
    if(!item)return;
    showDialog(`Entity zuweisen · ${esc(item.name||item.id)}`,`<div class="field"><label>Home Assistant Entity</label><input id="ent-assign" list="glt-entities" placeholder="sensor.vorlauf" value="${esc(item.entity||item.control_entity||"")}"></div><button id="ent-assign-save">Übernehmen</button><div class="hint" style="margin-top:8px">Vorschläge kommen aus dem Entities-Import.</div>`);
    wireEntitySuggestions();
    document.querySelector("#ent-assign-save").onclick=()=>{const value=document.querySelector("#ent-assign").value.trim();item.entity=value||undefined;dlg.close();render();saveDraft();status(value?`Entity zugewiesen: ${value}`:"Entity entfernt")};
  });
  /* Auto-map over the imported entity catalog. Deliberately a simple offline
   * scorer -- word overlap between the component's name/symbol and the
   * entity's name -- not the profile-based engine the HA designer ships: the
   * full core stays out of this page so the editor stays a small download.
   * Best hit per component becomes its main entity; low scores stay empty. */
  automap.onclick=()=>{
    const stored=JSON.parse(localStorage.getItem("glt-flow-card.entities")||"null");
    const list=(stored&&Array.isArray(stored.entities))?stored.entities:[];
    if(!list.length){status("Auto-Map: erst Entities importieren");return;}
    const words=(s)=>String(s||"").toLowerCase().split(/[^a-z0-9äöüß]+/).filter((w)=>w.length>2);
    const applied=[];const skipped=[];
    for(const eq of cfg.equipment){
      const eqWords=new Set([...words(eq.name),...words(eq.symbol),...words(eq.type)]);
      let best=null;
      for(const ent of list){
        const entWords=new Set([...words(ent.entity_id),...words(ent.name)]);
        let score=0;
        for(const w of entWords)if(eqWords.has(w))score+=1;
        if(ent.domain==="sensor")score+=0.5;
        if(score>best?.score??0)best={entity_id:ent.entity_id,score};
      }
      if(best&&best.score>=1){eq.entity=best.entity_id;applied.push(`${eq.name||eq.id} → ${best.entity_id}`);}
      else skipped.push(eq.name||eq.id);
    }
    render();saveDraft();
    showDialog("Auto-Map",`${applied.length?`<div class="project"><b>${applied.length} Zuordnungen</b><small>${applied.map(esc).join("<br>")}</small></div>`:""}${skipped.length?`<div class="project"><b>Ohne Treffer</b><small>${skipped.map(esc).join(", ")}</small></div>`:""}`);
  };
  /* YAML drag & drop onto the stage: same path as the import dialog, one
   * gesture shorter. */
  const stage=document.querySelector("#stage");
  if(stage){
    stage.addEventListener("dragover",(ev)=>{ev.preventDefault();stage.style.outline="2px dashed #20a4ff";});
    stage.addEventListener("dragleave",()=>{stage.style.outline="";});
    stage.addEventListener("drop",async(ev)=>{
      ev.preventDefault();stage.style.outline="";
      const file=[...ev.dataTransfer.files].find((f)=>/\.ya?ml$/i.test(f.name));
      if(!file)return;
      try{
        const value=YAML.parse(await file.text());
        if(!value||typeof value!=="object")throw Error("Ung\u00fcltige YAML");
        cfg=value;ensure();selected=null;render();saveDraft();status(`YAML importiert: ${file.name}`);
      }catch(err){status(`YAML-Import fehlgeschlagen: ${err.message}`);}
    });
  }

  /* Sponsoring stays a footnote, never a gate: one link in the status bar,
   * one hint after a download. Everything works without it. */
  const sponsorLink=()=>{const bar=document.querySelector(".toolbar");if(!bar||bar.querySelector("[data-glt-sponsor]"))return;const a=document.createElement("a");a.dataset.gltSponsor="1";a.href="https://github.com/sponsors/Xerolux";a.target="_blank";a.rel="noopener";a.style.cssText="margin-left:auto;align-self:center;font-size:11px;text-decoration:none;opacity:.85";a.onmouseenter=()=>a.style.opacity="1";a.onmouseleave=()=>a.style.opacity=".85";a.textContent=`♥ ${gltText("legacy.sponsor")}`;bar.appendChild(a);};

  const oldRender=render;render=function(){ensure();const now=JSON.stringify(cfg);if(now!==lastState){history.push(lastState);if(history.length>80)history.shift();future=[];lastState=now}const r=oldRender();wireEntitySuggestions();syncButtons();sponsorLink();return r;};
})();
