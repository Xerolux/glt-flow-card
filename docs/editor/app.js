
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

import YAML from "../vendor/js-yaml.mjs";

const SYMBOLS=[
["Heizung","heat_pump_neo","Wärmepumpe · Neo","heat_pump"],["Heizung","heat_pump_compact","Wärmepumpe · Kompakt","heat_pump"],["Heizung","buffer_layered","Schichtspeicher","tank"],["Heizung","dhw_tank","Warmwasserspeicher","tank"],["Heizung","boiler","Heizkessel","boiler"],["Heizung","burner","Brenner","generic"],["Heizung","immersion_heater","Heizstab","generic"],["Heizung","underfloor","Fußbodenheizung","room"],["Heizung","radiator","Heizkörper","room"],
["Hydraulik","pump_inline","Pumpe · Inline","pump"],["Hydraulik","pump_twin","Doppelpumpe","pump"],["Hydraulik","pump_variable","Pumpe · FU geregelt","pump"],["Hydraulik","valve_2way","2-Wege-Ventil","valve"],["Hydraulik","valve_3way","3-Wege-Ventil","valve"],["Hydraulik","mixing_valve","3-Wege-Mischer + Antrieb","valve"],["Hydraulik","shutoff_valve","Absperrventil","valve"],["Hydraulik","check_valve","Rückschlagventil","valve"],["Hydraulik","safety_valve","Sicherheitsventil","valve"],["Hydraulik","hydraulic_separator","Hydraulische Weiche","heat_exchanger"],["Hydraulik","heat_exchanger_plate","Plattenwärmetauscher","heat_exchanger"],["Hydraulik","manifold","Verteiler / Sammler","generic"],["Hydraulik","filter_water","Schmutzfänger","generic"],["Hydraulik","dirt_separator","Schlamm-/Magnetitabscheider","generic"],["Hydraulik","expansion_vessel","Ausdehnungsgefäß","tank"],
[gltText("legacy.category_air"),"ahu","RLT-Zentrale","ahu"],[gltText("legacy.category_air"),"fan_supply","Zuluftventilator","fan"],[gltText("legacy.category_air"),"fan_extract","Abluftventilator","fan"],[gltText("legacy.category_air"),"damper","Luftklappe","valve"],[gltText("legacy.category_air"),"fire_damper","Brandschutzklappe","valve"],[gltText("legacy.category_air"),"air_filter","Luftfilter","generic"],[gltText("legacy.category_air"),"heating_coil","Heizregister","heat_exchanger"],[gltText("legacy.category_air"),"cooling_coil","Kühlregister","heat_exchanger"],[gltText("legacy.category_air"),"heat_recovery_rotary","Rotations-WRG","heat_exchanger"],[gltText("legacy.category_air"),"heat_recovery_plate","Platten-WRG","heat_exchanger"],[gltText("legacy.category_air"),"humidifier","Befeuchter","generic"],[gltText("legacy.category_air"),"silencer","Schalldämpfer","generic"],
[gltText("legacy.category_cooling"),"chiller","Kältemaschine","heat_pump"],[gltText("legacy.category_cooling"),"compressor","Verdichter","generic"],[gltText("legacy.category_cooling"),"cooling_tower","Kühlturm","generic"],[gltText("legacy.category_cooling"),"cooling_buffer","Kältepuffer","tank"],
["Energie","pv_array","PV-Feld","pv"],["Energie","inverter","Wechselrichter","generic"],["Energie","battery","Batteriespeicher","generic"],["Energie","grid","Stromnetz","grid"],["Energie","meter","Energiezähler","meter"],["Energie","wallbox","Wallbox","generic"],
["Sensorik","temp_sensor","Temperaturfühler","meter"],["Sensorik","pressure_sensor","Drucksensor","meter"],["Sensorik","dp_sensor","Differenzdruck","meter"],["Sensorik","flow_sensor","Volumenstrom","meter"],["Sensorik","humidity_sensor","Feuchtefühler","meter"],["Sensorik","co2_sensor","CO₂-Sensor","meter"],["Sensorik","frost_thermostat","Frostschutzthermostat","meter"],["Sensorik","room_sensor","Raumsensor","room"],
["Allgemein","generic_machine","Allgemeine Anlage","generic"],["Allgemein","custom_image","Eigenes Symbol / Bild","image"]
].map(([category,id,label,type])=>({category,id,label,type}));

const $=s=>document.querySelector(s),canvas=$("#canvas"),stage=$("#stage"),insp=$("#inspector"),dlg=$("#dialog");
const uid=p=>`${p}_${Math.random().toString(36).slice(2,8)}`;
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
let selected=null,zoom=.7,drag=null,operate=false;

function demoConfig(){return {type:"custom:glt-flow-card",title:"iDM Heizzentrale · Detaildemo",appearance:{mode:"neo2030",show_switch:true},canvas:{width:1600,height:900,viewport_height:650,grid:true},views:[{id:"schematic",name:"Anlagenschema",kind:"schematic"}],equipment:[
{id:"source",type:"generic",symbol:"generic_machine",name:"Wärmequelle",subtitle:"Erdsonde",x:80,y:280,width:190,height:120,preview_value:"8,7 °C",fields:[]},
{id:"p_source",type:"pump",symbol:"pump_variable",name:"Quellenpumpe P-01",x:300,y:315,width:170,height:100,entity:"fan.quellenpumpe",tap_action:"control",sim_active:true,preview_value:"62 %"},
{id:"hp",type:"heat_pump",symbol:"heat_pump_neo",name:"iDM ALM 6-15",x:540,y:245,width:230,height:180,entity:"switch.waermepumpe",tap_action:"control",sim_active:true,preview_value:"8,7 kW",fields:[{label:"Vorlauf",entity:"sensor.idm_vorlauf"},{label:"Rücklauf",entity:"sensor.idm_ruecklauf"}]},
{id:"p_heat",type:"pump",symbol:"pump_inline",name:"Heizkreispumpe P-02",x:815,y:245,width:170,height:100,entity:"switch.heizkreispumpe",tap_action:"control",sim_active:true,preview_value:"83 %"},
{id:"buffer",type:"tank",symbol:"buffer_layered",name:"Pufferspeicher",x:1035,y:210,width:210,height:205,preview_value:"750 l",fields:[{label:"Oben",entity:"sensor.puffer_oben"},{label:"Unten",entity:"sensor.puffer_unten"}]},
{id:"heater",type:"generic",symbol:"immersion_heater",name:"Heizstab EH-01",x:1060,y:475,width:170,height:105,entity:"switch.heizstab",tap_action:"control",sim_active:false,preview_value:"0,0 kW"},
{id:"sep",type:"heat_exchanger",symbol:"hydraulic_separator",name:"Hydraulische Weiche",x:1315,y:250,width:185,height:150,preview_value:"ΔT 4,2 K"},
{id:"mixer",type:"valve",symbol:"mixing_valve",name:"Mischer V-03",x:1305,y:470,width:165,height:105,entity:"number.mischer_hk_d",tap_action:"control",sim_active:true,preview_value:"43 %"},
{id:"hk",type:"room",symbol:"underfloor",name:"Heizkreis D",subtitle:"Fußbodenheizung",x:1260,y:650,width:230,height:150,preview_value:"35,6 °C",fields:[{label:"Raum",entity:"sensor.raum_hk_d"}]},
{id:"dhw",type:"tank",symbol:"dhw_tank",name:"Warmwasser",x:800,y:610,width:210,height:175,preview_value:"49,8 °C"},
{id:"circulation",type:"pump",symbol:"pump_dhw",name:"Zirkulationspumpe P-04",x:1035,y:650,width:175,height:100,entity:"switch.zirkulationspumpe",tap_action:"control",sim_active:false,preview_value:"Aus"},
{id:"hx",type:"heat_exchanger",symbol:"heat_exchanger_plate",name:"Plattenwärmetauscher HX-01",x:555,y:620,width:190,height:135,preview_value:"46,1 °C"},
{id:"exp",type:"tank",symbol:"expansion_vessel",name:"MAG EV-01",x:330,y:630,width:160,height:110,preview_value:"1,7 bar"},
{id:"filter",type:"generic",symbol:"dirt_separator",name:"Schlammabscheider F-01",x:310,y:480,width:190,height:110,preview_value:"OK"}
],paths:[
{id:"source_to_p",from_equipment:"source",to_equipment:"p_source",medium:"source",auto_route:true},{id:"p_to_hp",from_equipment:"p_source",to_equipment:"hp",medium:"source",auto_route:true},
{id:"hp_supply",from_equipment:"hp",to_equipment:"p_heat",medium:"heating_supply",auto_route:true},{id:"p_buffer",from_equipment:"p_heat",to_equipment:"buffer",medium:"heating_supply",auto_route:true},{id:"buffer_sep",from_equipment:"buffer",to_equipment:"sep",medium:"heating_supply",auto_route:true},{id:"sep_mix",from_equipment:"sep",to_equipment:"mixer",medium:"heating_supply",auto_route:true},{id:"mix_hk",from_equipment:"mixer",to_equipment:"hk",medium:"heating_supply",auto_route:true},
{id:"hk_return",from_equipment:"hk",to_equipment:"sep",medium:"heating_return",auto_route:true},{id:"sep_return",from_equipment:"sep",to_equipment:"buffer",medium:"heating_return",auto_route:true},{id:"buffer_return",from_equipment:"buffer",to_equipment:"hp",medium:"heating_return",auto_route:true},
{id:"hp_hx",from_equipment:"hp",to_equipment:"hx",medium:"dhw",auto_route:true},{id:"hx_dhw",from_equipment:"hx",to_equipment:"dhw",medium:"dhw",auto_route:true},{id:"dhw_circ",from_equipment:"dhw",to_equipment:"circulation",medium:"dhw",auto_route:true},{id:"heater_power",from_equipment:"heater",to_equipment:"buffer",medium:"electrical",auto_route:true}
],datapoints:[],kpis:[],alarms:[],assets:[]};}
let cfg=demoConfig();

function symbolSvg(id,active=false){const s=String(id||"");const wrap=(b,c="")=>`<svg viewBox="0 0 64 64" class="sym ${active?"active":""} ${c}">${b}</svg>`;const L=(a,b,c,d,k="")=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" class="${k}"/>`;const C=(a,b,r,k="")=>`<circle cx="${a}" cy="${b}" r="${r}" class="${k}"/>`;const R=(a,b,w,h,r=2,k="")=>`<rect x="${a}" y="${b}" width="${w}" height="${h}" rx="${r}" class="${k}"/>`;const P=(d,k="")=>`<path d="${d}" class="${k}"/>`;
if(s.startsWith("pump"))return wrap(`${C(32,32,20,"body")}${P("M23 43 L23 21 L45 32 Z","accent rotor")}${L(3,32,12,32)}${L(52,32,61,32)}`,"pump");
if(["valve_2way","shutoff_valve"].includes(s))return wrap(`${P("M12 20 L32 32 L12 44 Z","body")}${P("M52 20 L32 32 L52 44 Z","body")}${L(3,32,12,32)}${L(52,32,61,32)}`);
if(["valve_3way","mixing_valve"].includes(s))return wrap(`${P("M9 20 L30 32 L9 44 Z","body")}${P("M51 20 L30 32 L51 44 Z","body")}${P("M21 55 L30 32 L39 55 Z","body")}${s==="mixing_valve"?`${R(24,4,12,10,2,"accentbox")}${L(30,14,30,28,"accent")}`:""}`);
if(s==="check_valve")return wrap(`${P("M14 20 L38 32 L14 44 Z","body")}${L(41,18,41,46,"accent")}`);
if(s==="safety_valve")return wrap(`${P("M16 28 L34 38 L16 48 Z","body")}${L(36,24,36,52,"accent")}${P("M36 24 C44 20 44 13 53 10","accent")}`);
if(s==="hydraulic_separator")return wrap(`${R(22,6,20,52,8,"body")}${L(3,19,22,19,"hot")}${L(42,19,61,19,"hot")}${L(3,45,22,45,"cold")}${L(42,45,61,45,"cold")}${P("M29 14 C40 23 24 34 37 48","accent")}`);
if(["heat_exchanger_plate","heat_recovery_plate"].includes(s))return wrap(`${R(13,8,38,48,2,"body")}${P("M19 14 L45 50 M45 14 L19 50 M25 10 L25 54 M39 10 L39 54","thin")}`);
if(s==="manifold")return wrap(`${R(10,24,44,16,5,"body")}${[15,24,33,42,51].map(x=>`${L(x,12,x,24)}${L(x,40,x,52)}`).join("")}`);
if(["filter_water","dirt_separator","air_filter"].includes(s))return wrap(`${R(14,12,36,40,2,"body")}${P("M17 48 L47 16 M24 50 L50 24 M14 40 L40 14","thin")}`);
if(s==="expansion_vessel")return wrap(`${C(32,32,23,"body")}${P("M10 32 Q32 21 54 32 Q32 43 10 32","accent")}${L(32,55,32,62)}`);
if(["buffer_layered","cooling_buffer"].includes(s))return wrap(`${P("M18 9 Q18 4 32 4 Q46 4 46 9 L46 55 Q46 60 32 60 Q18 60 18 55 Z","body")}${R(20,10,24,20,0,"hotfill")}${R(20,34,24,20,0,"coldfill")}`);
if(s==="dhw_tank")return wrap(`${P("M18 9 Q18 4 32 4 Q46 4 46 9 L46 55 Q46 60 32 60 Q18 60 18 55 Z","body")}${P("M24 43 C24 34 40 34 40 26 C40 18 24 18 24 11","accent")}`);
if(s==="immersion_heater")return wrap(`${R(14,12,36,40,3,"body")}${P("M20 40 L26 23 L32 40 L38 23 L44 40","power")}`);
if(s==="boiler")return wrap(`${R(12,9,40,46,7,"body")}${P("M32 47 C20 39 24 28 32 19 C40 28 44 39 32 47 Z","flame")}`);
if(s==="burner")return wrap(`${R(9,20,46,25,4,"body")}${C(22,32,8,"accent")}${P("M30 32 L48 24 L48 40 Z","flame")}`);
if(["underfloor","radiator"].includes(s))return s==="underfloor"?wrap(`${R(8,12,48,40,4,"body")}${P("M14 39 C18 20 25 20 29 39 C33 20 40 20 50 39","hot")}`):wrap(`${R(8,14,48,36,4,"body")}${[16,24,32,40,48].map(x=>L(x,18,x,46,"thin")).join("")}`);
if(s.startsWith("fan"))return wrap(`${C(32,32,22,"body")}${P("M32 31 C31 18 38 12 45 15 C45 23 40 29 33 32 M33 33 C45 35 49 42 44 48 C36 46 32 40 32 34 M31 33 C23 44 15 45 11 38 C15 31 22 29 30 32","accent rotor")}`,"fan");
if(["damper","fire_damper"].includes(s))return wrap(`${R(7,18,50,28,1,"body")}${L(12,42,52,22,s==="fire_damper"?"alarm":"accent")}${C(32,32,3,"accent")}`);
if(["heating_coil","cooling_coil"].includes(s))return wrap(`${R(9,12,46,40,2,"body")}${P("M16 42 C23 42 18 22 26 22 C34 22 29 42 37 42 C45 42 40 22 48 22",s==="cooling_coil"?"cold":"hot")}`);
if(s==="heat_recovery_rotary")return wrap(`${C(32,32,22,"body")}${P("M32 11 L32 53 M11 32 L53 32 M17 17 L47 47 M47 17 L17 47","thin")}${C(32,32,5,"accent rotor")}`,"fan");
if(s==="humidifier")return wrap(`${R(9,14,46,36,2,"body")}${P("M21 41 C13 31 21 22 21 22 C21 22 29 31 21 41 Z M37 42 C29 33 37 24 37 24 C37 24 45 33 37 42 Z","accent")}`);
if(s==="silencer")return wrap(`${R(7,16,50,32,2,"body")}${[15,23,31,39,47].map(x=>L(x,19,x+6,45,"thin")).join("")}`);
if(["heat_pump_neo","heat_pump_compact","chiller"].includes(s))return wrap(`${R(10,7,44,50,8,"body")}${C(32,32,14,"accent")}${P("M23 34 C26 24 38 24 41 34 M22 39 L42 39","thin")}`);
if(s==="compressor")return wrap(`${C(32,32,23,"body")}${P("M20 40 C25 22 41 20 45 32 C48 42 31 49 24 36","accent")}`);
if(s==="cooling_tower")return wrap(`${P("M18 8 L46 8 L52 56 L12 56 Z","body")}${P("M18 24 C26 18 38 18 46 24 M15 39 C25 33 39 33 49 39","cold")}`);
if(s==="pv_array")return wrap(`${P("M10 20 L48 12 L55 44 L17 52 Z","body")}${L(16,31,52,23,"thin")}${L(18,42,54,34,"thin")}${P("M8 9 L13 14 M3 20 L10 21 M19 3 L20 10","power")}`);
if(s==="inverter")return wrap(`${R(10,12,44,40,6,"body")}${P("M16 31 C21 22 27 40 32 31 C37 22 43 40 48 31","accent")}`);
if(s==="battery")return wrap(`${R(12,15,40,34,5,"body")}${R(26,9,12,6,2,"body")}${R(17,21,30,22,3,"goodfill")}`);
if(s==="grid")return wrap(`${L(32,5,32,59,"body")}${L(18,20,46,20,"body")}${L(13,35,51,35,"body")}${L(18,20,9,59,"thin")}${L(46,20,55,59,"thin")}${L(32,20,18,59,"thin")}${L(32,20,46,59,"thin")}`);
if(["meter","temp_sensor","pressure_sensor","dp_sensor","flow_sensor","humidity_sensor","co2_sensor","frost_thermostat","room_sensor"].includes(s)){const t=s==="temp_sensor"?"T":s==="pressure_sensor"?"P":s==="dp_sensor"?"ΔP":s==="flow_sensor"?"F":s==="humidity_sensor"?"%":s==="co2_sensor"?"CO₂":s==="frost_thermostat"?"FROST":"M";return wrap(`${C(32,32,22,"body")}<text x="32" y="36" text-anchor="middle">${t}</text>`)}
return wrap(`${R(11,11,42,42,8,"body")}${P("M20 38 L32 20 L44 38 Z","accent")}`)}

function status(t){$("#status").textContent=t;clearTimeout(status.timer);status.timer=setTimeout(()=>$("#status").textContent="",1800)}
function saveDraft(){localStorage.setItem("glt-online.autosave",JSON.stringify({at:new Date().toISOString(),config:cfg}))}
function saveLocal(name=cfg.title){const list=JSON.parse(localStorage.getItem("glt-online.projects")||"[]").filter(p=>p.id!==cfg.project?.id);const id=cfg.project?.id||uid("project");cfg.project={id,name};list.unshift({id,name,updated:new Date().toISOString(),config:structuredClone(cfg)});localStorage.setItem("glt-online.projects",JSON.stringify(list.slice(0,50)));status("Projekt gespeichert")}
function symById(id){return SYMBOLS.find(s=>s.id===id)||SYMBOLS.find(s=>s.type===id)||SYMBOLS[0]}
function renderPalette(){const q=$("#search").value.toLowerCase(),groups=[...new Set(SYMBOLS.map(s=>s.category))];$("#palette").innerHTML=groups.map(g=>{const a=SYMBOLS.filter(s=>s.category===g&&(!q||`${s.id} ${s.label} ${s.category}`.toLowerCase().includes(q)));return a.length?`<div class="group">${g}</div>${a.map(s=>`<div class="item" draggable="true" data-symbol="${s.id}"><i>${symbolSvg(s.id)}</i><span><b>${s.label}</b><small>${s.id}</small></span></div>`).join("")}`:""}).join("");document.querySelectorAll(".item").forEach(i=>i.ondragstart=e=>e.dataTransfer.setData("text/symbol",i.dataset.symbol))}
function render(){document.body.dataset.theme=cfg.appearance?.mode||"neo2030";$("#appearance").value=cfg.appearance?.mode||"neo2030";canvas.classList.toggle("operate",operate);canvas.style.width=`${cfg.canvas.width}px`;canvas.style.height=`${cfg.canvas.height}px`;canvas.style.transform=`scale(${zoom})`;canvas.innerHTML="";cfg.paths.forEach(drawPipe);cfg.equipment.forEach(drawNode);renderInspector()}
function center(e,side="right"){const x=e.x||0,y=e.y||0,w=e.width||190,h=e.height||110;if(side==="left")return[x,y+h/2];if(side==="top")return[x+w/2,y];if(side==="bottom")return[x+w/2,y+h];return[x+w,y+h/2]}
function drawPipe(p){if(!p.from_equipment||!p.to_equipment)return;const a=cfg.equipment.find(x=>x.id===p.from_equipment),b=cfg.equipment.find(x=>x.id===p.to_equipment);if(!a||!b)return;const [x1,y1]=center(a,"right"),[x2,y2]=center(b,"left"),mid=Math.round((x1+x2)/2/10)*10;[[x1,y1,mid,y1],[mid,y1,mid,y2],[mid,y2,x2,y2]].forEach(([ax,ay,bx,by])=>{const line=document.createElement("div"),len=Math.hypot(bx-ax,by-ay),ang=Math.atan2(by-ay,bx-ax)*180/Math.PI;line.className=`pipe medium-${p.medium||"neutral"}`;line.style.left=`${ax}px`;line.style.top=`${ay}px`;line.style.width=`${len}px`;line.style.transform=`rotate(${ang}deg)`;canvas.appendChild(line)})}
function drawNode(e){const n=document.createElement("div"),sym=symById(e.symbol||e.type);n.className="node"+(selected===e.id?" sel":"")+(e.sim_active?" is-active":"");n.dataset.id=e.id;n.style.left=`${e.x||0}px`;n.style.top=`${e.y||0}px`;n.style.width=`${e.width||200}px`;n.style.height=`${e.height||120}px`;n.innerHTML=`<div class="machine-icon">${symbolSvg(e.symbol||sym.id,!!e.sim_active)}</div><div class="machine-copy"><div class="title">${esc(e.name||sym.label)}</div><div class="type">${esc(sym.category)} · ${esc(e.symbol||sym.id)}</div><div class="value">${esc(e.preview_value||e.entity||"Entity in HA zuordnen")}</div></div><span class="state-dot ${e.sim_active?"on":""}"></span>`;n.onclick=ev=>{ev.stopPropagation();if(operate){showOperate(e);return}selected=e.id;render()};n.onpointerdown=ev=>{if(operate||ev.button!==0)return;selected=e.id;drag={id:e.id,sx:ev.clientX,sy:ev.clientY,x:e.x||0,y:e.y||0};window.onpointermove=move;window.onpointerup=()=>{drag=null;window.onpointermove=null;window.onpointerup=null;saveDraft()}};canvas.appendChild(n)}
function move(ev){if(!drag)return;const e=cfg.equipment.find(x=>x.id===drag.id);e.x=Math.round((drag.x+(ev.clientX-drag.sx)/zoom)/10)*10;e.y=Math.round((drag.y+(ev.clientY-drag.sy)/zoom)/10)*10;render()}
function renderInspector(){const e=cfg.equipment.find(x=>x.id===selected);if(!e){insp.innerHTML=`<div class="empty-inspector"><b>${operate?"Bedienvorschau aktiv":"Kein Bauteil ausgewählt"}</b><p>${operate?"Bauteil anklicken: simulierte Objektbedienung öffnet sich.":"Links ein Detailbauteil auf die Zeichenfläche ziehen oder vorhandenes Objekt anklicken."}</p></div>`;return}const action=typeof e.tap_action==="string"?e.tap_action:e.tap_action?.action||"control";insp.innerHTML=`<div class="selected-preview">${symbolSvg(e.symbol,!!e.sim_active)}<div><b>${esc(e.name)}</b><small>${esc(e.id)}</small></div></div><div class="field"><label>Name</label><input data-f="name" value="${esc(e.name||"")}"></div><div class="field"><label>Haupt-Entity</label><input data-f="entity" value="${esc(e.entity||"")}" placeholder="switch.pumpe"></div><div class="field"><label>Status-Entity</label><input data-f="state_entity" value="${esc(e.state_entity||"")}" placeholder="binary_sensor.pumpe_laeuft"></div><div class="field"><label>Steuer-Entity</label><input data-f="control_entity" value="${esc(e.control_entity||"")}" placeholder="optional, sonst Haupt-Entity"></div><div class="field"><label>Detail-Symbol</label><select data-f="symbol">${SYMBOLS.map(s=>`<option value="${s.id}" ${s.id===e.symbol?"selected":""}>${s.category} · ${s.label}</option>`).join("")}</select></div><div class="field"><label>Aktion bei Klick</label><select id="tap"><option value="control">Objektbedienung öffnen</option><option value="more-info">HA Mehr-Info</option><option value="toggle">Direkt umschalten</option><option value="call-service">Service aufrufen</option><option value="none">Keine Aktion</option></select></div><div class="field"><label>Vorschauwert</label><input data-f="preview_value" value="${esc(e.preview_value||"")}" placeholder="z. B. 83 %"></div><div class="field"><label>X / Y</label><div class="two"><input data-f="x" type="number" value="${e.x||0}"><input data-f="y" type="number" value="${e.y||0}"></div></div><div class="field"><label>Breite / Höhe</label><div class="two"><input data-f="width" type="number" value="${e.width||200}"><input data-f="height" type="number" value="${e.height||120}"></div></div><div class="actions"><button id="connect">Verbinden…</button><button id="dup">Duplizieren</button><button id="del">Löschen</button></div>`;$("#tap").value=action;$("#tap").onchange=()=>{e.tap_action=$("#tap").value;saveDraft()};insp.querySelectorAll("[data-f]").forEach(i=>i.onchange=()=>{e[i.dataset.f]=i.type==="number"?+i.value:i.value;render();saveDraft()});$("#del").onclick=()=>{cfg.equipment=cfg.equipment.filter(x=>x.id!==e.id);cfg.paths=cfg.paths.filter(p=>p.from_equipment!==e.id&&p.to_equipment!==e.id);selected=null;render();saveDraft()};$("#dup").onclick=()=>{const n=structuredClone(e);n.id=uid(e.type||"eq");n.x=(n.x||0)+40;n.y=(n.y||0)+40;cfg.equipment.push(n);selected=n.id;render();saveDraft()};$("#connect").onclick=()=>showConnect(e)}
/**
 * One text prompt, as a real dialog, in the standalone editor.
 *
 * This page has no Companion and no SDK, so it cannot reach the card's modal.
 * It has its own `<dialog>` already, and that is what a prompt should use:
 * `window.prompt` blocks the page, cannot be localized or styled, has no
 * accessible name and is unavailable in a kiosk browser.
 *
 * Resolves to null on cancel, matching what `prompt()` returned.
 */
function askText(label, initial = "") {
  return new Promise((resolve) => {
    showDialog(label, `<div class="field"><label for="ask-value">${esc(label)}</label>`
      + `<input id="ask-value" value="${esc(String(initial ?? ""))}"></div>`
      + `<div class="actions"><button id="ask-ok">OK</button>`
      + `<button id="ask-cancel">Abbrechen</button></div>`);
    const input = $("#ask-value");
    const done = (value) => { dlg.close(); resolve(value); };
    $("#ask-ok").onclick = () => done(input.value);
    $("#ask-cancel").onclick = () => done(null);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); done(input.value); }
      if (event.key === "Escape") { event.preventDefault(); done(null); }
    });
    input.focus();
    input.select();
  });
}
function showDialog(title,html){$("#dialog-title").textContent=title;$("#dialog-body").innerHTML=html;dlg.showModal()}$("#dialog-close").onclick=()=>dlg.close();
function showConnect(from){showDialog(gltText("legacy.auto_connect"),`<div class="field"><label>Ziel</label><select id="target">${cfg.equipment.filter(x=>x.id!==from.id).map(x=>`<option value="${x.id}">${esc(x.name||x.id)}</option>`).join("")}</select></div><div class="field"><label>Medium</label><select id="medium"><option value="heating_supply">Vorlauf</option><option value="heating_return">Rücklauf</option><option value="source">Wärmequelle</option><option value="dhw">Warmwasser</option><option value="cooling_supply">Kälte Vorlauf</option><option value="cooling_return">Kälte Rücklauf</option><option value="air_supply">Zuluft</option><option value="air_extract">Abluft</option><option value="electrical">Elektrisch</option></select></div><button id="do-connect">Orthogonal verbinden</button>`);$("#do-connect").onclick=()=>{cfg.paths.push({id:uid("path"),from_equipment:from.id,to_equipment:$("#target").value,medium:$("#medium").value,auto_route:true,width:8});dlg.close();render();saveDraft()}}
function showOperate(e){const sym=symById(e.symbol),isOn=!!e.sim_active;showDialog(`Objektbedienung · ${e.name}`,`<div class="operate-head">${symbolSvg(e.symbol,isOn)}<div><b>${esc(e.name)}</b><small>${esc(e.control_entity||e.entity||"Home Assistant Entity")}</small></div><span class="op-state ${isOn?"on":""}">${isOn?"AKTIV":"AUS"}</span></div><div class="operate-values"><div><small>Status</small><b>${isOn?"Ein / Betrieb":"Aus / Bereit"}</b></div><div><small>Aktueller Wert</small><b>${esc(e.preview_value||"–")}</b></div><div><small>Symbol</small><b>${esc(sym.label)}</b></div></div><div class="actions"><button id="op-on">Ein</button><button id="op-off">Aus</button><button id="op-toggle">Umschalten</button><button id="op-more">HA Mehr-Info</button></div><p class="hint">Online nur Simulation. In Home Assistant ruft die Card echte HA-Services auf; Viewer/Operator/Designer-Rechte und Bestätigungen werden berücksichtigt.</p>`);const set=v=>{e.sim_active=v;e.preview_value=v?(e.preview_value==="Aus"?"Ein":e.preview_value):"Aus";dlg.close();render();saveDraft()};$("#op-on").onclick=()=>set(true);$("#op-off").onclick=()=>set(false);$("#op-toggle").onclick=()=>set(!isOn);$("#op-more").onclick=()=>status("In HA öffnet sich die Entity-/Objektbedienung")}
canvas.ondragover=e=>e.preventDefault();canvas.ondrop=e=>{e.preventDefault();const symbol=e.dataTransfer.getData("text/symbol"),sym=symById(symbol),r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/zoom,y=(e.clientY-r.top)/zoom,id=uid(sym.type||"eq"),small=["pump","valve","meter"].includes(sym.type);cfg.equipment.push({id,type:sym.type,name:sym.label,symbol:sym.id,x:Math.round(x/10)*10,y:Math.round(y/10)*10,width:small?170:220,height:small?100:135,fields:[],tap_action:"control",sim_active:false});selected=id;render();saveDraft()};canvas.onclick=()=>{selected=null;render()};
$("#search").oninput=renderPalette;$("#new").onclick=()=>{if(confirm("Neues Projekt starten?")){cfg={...demoConfig(),title:"GLT Projekt",project:{},equipment:[],paths:[],datapoints:[],kpis:[],alarms:[],assets:[]};selected=null;render();saveDraft()}};$("#save").onclick=async()=>{const name=await askText(gltText("legacy.prompt_project_name"),cfg.project?.name||cfg.title);if(name){cfg.title=name;saveLocal(name);render()}};$("#open").onclick=()=>{const list=JSON.parse(localStorage.getItem("glt-online.projects")||"[]");showDialog("Projektbibliothek",list.map(p=>`<div class="project"><b>${esc(p.name)}</b><small>${new Date(p.updated).toLocaleString()}</small><button data-load="${p.id}">Laden</button></div>`).join("")||"Noch keine Projekte.");document.querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>{const p=list.find(x=>x.id===b.dataset.load);cfg=structuredClone(p.config);selected=null;dlg.close();render()})};$("#export").onclick=()=>{const y=YAML.dump(cfg,{noRefs:true,lineWidth:120});showDialog(gltText("legacy.lovelace_yaml"),`<textarea id="yaml">${esc(y)}</textarea><div class="actions"><button id="copy">Kopieren</button><button id="download">Download</button></div>`);$("#copy").onclick=()=>navigator.clipboard.writeText($("#yaml").value);$("#download").onclick=()=>{const blob=new Blob([$("#yaml").value],{type:"application/yaml"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${cfg.project?.name||"glt-project"}.yaml`;a.click()}};$("#import").onclick=()=>{showDialog("YAML Import",'<textarea id="yaml" placeholder="type: custom:glt-flow-card"></textarea><button id="load-yaml">Importieren</button><div id="err"></div>');$("#load-yaml").onclick=()=>{try{const v=YAML.load($("#yaml").value);if(!v||typeof v!=="object")throw Error("Ungültige YAML");cfg=v;cfg.appearance=cfg.appearance||{mode:"neo2030"};cfg.canvas=cfg.canvas||{width:1600,height:900};cfg.equipment=cfg.equipment||[];cfg.paths=cfg.paths||[];cfg.datapoints=cfg.datapoints||[];cfg.kpis=cfg.kpis||[];selected=null;dlg.close();render();saveDraft()}catch(err){$("#err").textContent=err.message}}};$("#fit").onclick=()=>{zoom=Math.min((stage.clientWidth-60)/cfg.canvas.width,(stage.clientHeight-60)/cfg.canvas.height,.95);render()};$("#preview").onclick=()=>{operate=!operate;$("#preview").classList.toggle("active",operate);$("#preview").textContent=operate?"■ Editor-Modus":"▶ Bedienvorschau";selected=null;render()};$("#appearance").onchange=e=>{cfg.appearance=cfg.appearance||{};cfg.appearance.mode=e.target.value;render();saveDraft()};
renderPalette();const auto=JSON.parse(localStorage.getItem("glt-online.autosave")||"null");if(auto?.config&&confirm("Letzten automatisch gespeicherten Entwurf laden?"))cfg=auto.config;render();$("#fit").click();

/*! GLT Online Designer v1 Engineering extensions */
(() => {
  // src/v100/templates.mjs
  var eq = (id, type, name, subtitle, x, y, w, h, fields = []) => ({
    id,
    type,
    name,
    subtitle,
    x,
    y,
    width: w,
    height: h,
    fields: fields.map((label) => ({ label, entity: "" }))
  });
  var pipe = (id, medium, points) => ({ id, medium, points });
  var kpi = (name, icon) => ({ name, icon, entity: { entity: "" } });
  var tpl = (id, name, description, title, subtitle, equipment, paths, kpis = []) => ({
    id,
    name,
    description,
    config: {
      type: "custom:glt-flow-card",
      title,
      subtitle,
      canvas: { width: 1600, height: 900, viewport_height: "auto", grid: true, grid_size: 40 },
      zoom: { enabled: true, min: 0.25, max: 4, wheel: true, controls: true },
      views: [{ id: "schematic", name, kind: "schematic", icon: "mdi:sitemap-outline" }],
      default_view: "schematic",
      replay: { enabled: true, hours: 168, step_minutes: 15, autoplay_ms: 850 },
      trend: { enabled: true, hours: 168, max_series: 8, height: 270 },
      kpis,
      equipment,
      paths,
      datapoints: []
    }
  });
  var FACTORY_TEMPLATES = Object.freeze([
    tpl(
      "wp-basic",
      "W\xE4rmepumpe einfach",
      "WP, Puffer, ein Heizkreis \u2014 der Einstieg.",
      "W\xE4rmepumpe",
      "Grundschema \xB7 W\xE4rmepumpe mit Puffer",
      [
        eq("wp", "heat_pump", "W\xE4rmepumpe", "Erzeuger", 130, 305, 285, 185, ["Vorlauf", "R\xFCcklauf", "Leistung"]),
        eq("puffer", "tank", "Pufferspeicher", "Hydraulik", 640, 255, 260, 230, ["Oben", "Unten"]),
        eq("hk", "room", "Heizkreis", "Verteilung", 1160, 255, 285, 225, ["Vorlauf", "Raum", "Soll"])
      ],
      [
        pipe("wp_puffer", "heating_supply", [[415, 355], [535, 355], [535, 315], [640, 315]]),
        pipe("puffer_hk", "heating_supply", [[900, 315], [1040, 315], [1040, 300], [1160, 300]]),
        pipe("hk_ret", "heating_return", [[1160, 400], [1010, 400], [1010, 450], [900, 450], [900, 520], [415, 520], [415, 435]])
      ],
      [kpi("Au\xDFentemperatur", "mdi:weather-partly-rainy"), kpi("Vorlauf", "mdi:thermometer-chevron-up"), kpi("Leistung", "mdi:fire")]
    ),
    tpl(
      "wp-dhw",
      "WP mit Warmwasser",
      "WP, Puffer, Trinkwarmwasser, Heizkreis.",
      "W\xE4rmepumpe",
      "Heizen und Trinkwarmwasser",
      [
        eq("wp", "heat_pump", "W\xE4rmepumpe", "Erzeuger", 130, 305, 285, 185, ["Vorlauf", "R\xFCcklauf"]),
        eq("puffer", "tank", "Pufferspeicher", "Heizung", 640, 200, 260, 230, ["Oben", "Unten"]),
        eq("twe", "dhw_tank", "Trinkwarmwasser", "Speicher", 640, 560, 260, 230, ["Oben", "Unten", "Soll"]),
        eq("hk", "room", "Heizkreis", "Verteilung", 1160, 255, 285, 225, ["Vorlauf", "Raum"])
      ],
      [
        pipe("wp_puffer", "heating_supply", [[415, 330], [535, 330], [535, 290], [640, 290]]),
        pipe("puffer_hk", "heating_supply", [[900, 290], [1040, 290], [1040, 300], [1160, 300]]),
        pipe("hk_ret", "heating_return", [[1160, 400], [900, 400], [900, 430], [415, 430]]),
        pipe("wp_twe", "dhw", [[415, 390], [500, 390], [500, 660], [640, 660]])
      ],
      [kpi("Warmwasser", "mdi:water-boiler"), kpi("Vorlauf", "mdi:thermometer-chevron-up")]
    ),
    tpl(
      "wp-solar",
      "WP mit Solar",
      "W\xE4rmepumpe, Puffer, Warmwasser, Solarstation.",
      "W\xE4rmepumpe & Solar",
      "Heizen, Warmwasser, Solarthermie",
      [
        eq("wp", "heat_pump", "W\xE4rmepumpe", "Erzeuger", 130, 305, 285, 185, ["Vorlauf", "R\xFCcklauf"]),
        eq("puffer", "tank", "Pufferspeicher", "Heizung", 640, 180, 260, 230, ["Oben", "Unten"]),
        eq("twe", "dhw_tank", "Trinkwarmwasser", "Speicher", 980, 180, 260, 230, ["Oben", "Soll"]),
        eq("solar", "heat_exchanger", "Solarstation", "Kollektorkreis", 980, 540, 260, 230, ["Kollektor", "R\xFCcklauf"]),
        eq("hk", "room", "Heizkreis", "Verteilung", 1160, 500, 285, 225, ["Vorlauf", "Raum"])
      ],
      [
        pipe("wp_puffer", "heating_supply", [[415, 330], [535, 330], [535, 290], [640, 290]]),
        pipe("puffer_twe", "heating_supply", [[900, 290], [980, 290]]),
        pipe("solar_twe", "heating_supply", [[1110, 540], [1110, 410]]),
        pipe("puffer_hk", "heating_supply", [[770, 410], [770, 560], [1160, 560]])
      ],
      [kpi("Kollektor", "mdi:weather-sunny"), kpi("Warmwasser", "mdi:water-boiler")]
    ),
    tpl(
      "chp",
      "BHKW-Anlage",
      "Blockheizkraftwerk, Puffer, Heizkreis, Warmwasser.",
      "BHKW",
      "Kraft-W\xE4rme-Kopplung",
      [
        eq("chp", "boiler", "BHKW", "Erzeuger", 130, 305, 285, 185, ["Leistung", "Laufzeit", "Erzeugung"]),
        eq("puffer", "tank", "Pufferspeicher", "Hydraulik", 640, 255, 260, 230, ["Oben", "Unten"]),
        eq("twe", "dhw_tank", "Trinkwarmwasser", "Speicher", 640, 560, 260, 230, ["Oben", "Soll"]),
        eq("hk", "room", "Heizkreis", "Verteilung", 1160, 255, 285, 225, ["Vorlauf", "Raum"])
      ],
      [
        pipe("chp_puffer", "heating_supply", [[415, 355], [535, 355], [535, 315], [640, 315]]),
        pipe("puffer_hk", "heating_supply", [[900, 315], [1040, 315], [1040, 300], [1160, 300]]),
        pipe("wp_twe", "dhw", [[415, 390], [500, 390], [500, 660], [640, 660]])
      ],
      [kpi("Elektrisch", "mdi:lightning-bolt"), kpi("Thermisch", "mdi:fire"), kpi("Laufzeit", "mdi:clock-outline")]
    ),
    tpl(
      "boiler-classic",
      "Kessel klassisch",
      "Gas-/\xD6lkessel, Puffer, zwei Heizkreise.",
      "Heizkessel",
      "Konventioneller Kessel mit Puffer",
      [
        eq("kessel", "boiler", "Heizkessel", "Erzeuger", 130, 305, 285, 185, ["Kesseltemperatur", "Leistung"]),
        eq("puffer", "tank", "Pufferspeicher", "Hydraulik", 640, 255, 260, 230, ["Oben", "Unten"]),
        eq("hk1", "room", "Heizkreis 1", "Radiatoren", 1160, 180, 285, 225, ["Vorlauf", "Raum"]),
        eq("hk2", "room", "Heizkreis 2", "Fu\xDFboden", 1160, 500, 285, 225, ["Vorlauf", "Raum"])
      ],
      [
        pipe("k_puffer", "heating_supply", [[415, 355], [535, 355], [535, 315], [640, 315]]),
        pipe("puffer_hk1", "heating_supply", [[900, 315], [1040, 315], [1040, 240], [1160, 240]]),
        pipe("puffer_hk2", "heating_supply", [[900, 400], [1040, 400], [1040, 560], [1160, 560]])
      ],
      [kpi("Kessel", "mdi:thermometer"), kpi("Au\xDFen", "mdi:weather-partly-rainy")]
    ),
    tpl(
      "underfloor-manifold",
      "FBH-Verteiler",
      "W\xE4rmepumpe, Puffer, Verteiler, zwei Heizkreise.",
      "Fu\xDFbodenheizung",
      "Verteiler mit Heizkreisen",
      [
        eq("wp", "heat_pump", "W\xE4rmepumpe", "Erzeuger", 130, 305, 285, 185, ["Vorlauf", "R\xFCcklauf"]),
        eq("puffer", "tank", "Pufferspeicher", "Hydraulik", 480, 255, 260, 230, ["Oben", "Unten"]),
        eq("verteiler", "generic", "Heizkreisverteiler", "Verteilung", 900, 255, 240, 230, ["Vorlauf", "R\xFCcklauf"]),
        eq("hk1", "underfloor", "Heizkreis 1", "Wohnen", 1300, 180, 260, 225, ["Vorlauf", "Raum"]),
        eq("hk2", "underfloor", "Heizkreis 2", "Schlafen", 1300, 500, 260, 225, ["Vorlauf", "Raum"])
      ],
      [
        pipe("wp_puffer", "heating_supply", [[415, 355], [480, 355]]),
        pipe("puffer_vert", "heating_supply", [[740, 315], [900, 315]]),
        pipe("vert_hk1", "heating_supply", [[1140, 300], [1220, 300], [1220, 260], [1300, 260]]),
        pipe("vert_hk2", "heating_supply", [[1140, 380], [1220, 380], [1220, 580], [1300, 580]])
      ],
      [kpi("Vorlauf", "mdi:thermometer-chevron-up"), kpi("R\xFCcklauf", "mdi:thermometer-chevron-down")]
    ),
    tpl(
      "chiller",
      "Kaltwassersatz",
      "Chiller, Kaltwasserpuffer, Verbraucherkreis.",
      "K\xE4lteanlage",
      "Kaltwassersatz mit Puffer",
      [
        eq("chiller", "chiller", "Kaltwassersatz", "K\xE4lteerzeugung", 130, 305, 285, 185, ["Vorlauf", "R\xFCcklauf", "Leistung"]),
        eq("puffer", "tank", "Kaltwasserpuffer", "Speicher", 640, 255, 260, 230, ["Oben", "Unten"]),
        eq("verbraucher", "room", "K\xE4lteverbraucher", "K\xFChldecken / Umluft", 1160, 255, 285, 225, ["Vorlauf", "Raum"])
      ],
      [
        pipe("cw_vor", "cooling_supply", [[415, 355], [535, 355], [535, 315], [640, 315]]),
        pipe("cw_verbraucher", "cooling_supply", [[900, 315], [1040, 315], [1040, 300], [1160, 300]]),
        pipe("cw_ret", "cooling_return", [[1160, 400], [1010, 400], [1010, 450], [900, 450], [900, 520], [415, 520], [415, 435]])
      ],
      [kpi("Kaltwasser", "mdi:snowflake"), kpi("Au\xDFen", "mdi:weather-partly-rainy")]
    ),
    tpl(
      "dry-cooler",
      "R\xFCckk\xFChlung",
      "K\xE4ltemaschine, R\xFCckk\xFChler, Kaltwasserpuffer.",
      "R\xFCckk\xFChlwerk",
      "Freie K\xFChlung und R\xFCckk\xFChler",
      [
        eq("chiller", "chiller", "K\xE4ltemaschine", "K\xE4lteerzeugung", 130, 500, 285, 185, ["Vorlauf", "R\xFCcklauf"]),
        eq("cooler", "generic", "R\xFCckk\xFChler", "W\xE4rmeabfuhr", 640, 200, 260, 230, ["Au\xDFentemperatur", "Medium"]),
        eq("puffer", "cooling_buffer", "Kaltwasserpuffer", "Speicher", 1160, 400, 260, 230, ["Oben", "Unten"])
      ],
      [
        pipe("chiller_puffer", "cooling_supply", [[415, 555], [535, 555], [535, 470], [1160, 470]]),
        pipe("chiller_cooler", "cooling_return", [[415, 610], [535, 610], [535, 315], [640, 315]])
      ],
      [kpi("Au\xDFen", "mdi:weather-partly-rainy"), kpi("Kaltwasser", "mdi:snowflake")]
    ),
    tpl(
      "free-cooling",
      "Free Cooling",
      "RLT-Ger\xE4t mit K\xFChlregister und Nachheizregister.",
      "Free Cooling",
      "Luftseitige freie K\xFChlung",
      [
        eq("rlt", "ahu", "RLT-Ger\xE4t", "L\xFCftung", 480, 255, 320, 230, ["Zuluft", "Abluft"]),
        eq("kuehl", "heat_exchanger", "K\xFChlregister", "Free Cooling", 980, 255, 260, 230, ["Eintritt", "Austritt"]),
        eq("heiz", "heat_exchanger", "Nachheizregister", "Komfort", 980, 560, 260, 230, ["Vorlauf", "R\xFCcklauf"])
      ],
      [
        pipe("luft_zu", "air_supply", [[480, 200], [980, 200]]),
        pipe("luft_ab", "air_supply", [[480, 540], [980, 540], [980, 540]])
      ],
      [kpi("Au\xDFenluft", "mdi:weather-windy"), kpi("Zuluft", "mdi:fan")]
    ),
    tpl(
      "ahu-compact",
      "Kompakt-RLT",
      "Kompaktger\xE4t mit WRG, Filter, Heiz-/K\xFChlregister.",
      "RLT-Kompaktger\xE4t",
      "L\xFCftung mit W\xE4rmer\xFCckgewinnung",
      [
        eq("ahu", "ahu", "Kompakt-RLT", "L\xFCftung", 640, 255, 320, 230, ["Zuluft", "Abluft", "WRG-Wirkgrad"]),
        eq("filter", "generic", "Filter", "Luftseite", 1120, 180, 220, 180, ["Differenzdruck"]),
        eq("heiz", "heat_exchanger", "Heizregister", "Wasserseitig", 1120, 500, 220, 180, ["Vorlauf", "R\xFCcklauf"]),
        eq("kuehl", "cooling_coil", "K\xFChlregister", "Wasserseitig", 300, 500, 220, 180, ["Vorlauf", "R\xFCcklauf"])
      ],
      [
        pipe("zu", "air_supply", [[960, 290], [1120, 290]]),
        pipe("heiz_ahu", "heating_supply", [[1120, 560], [1050, 560], [1050, 485], [960, 485]]),
        pipe("kuehl_ahu", "cooling_supply", [[520, 560], [600, 560], [600, 485], [640, 485]])
      ],
      [kpi("Zuluft", "mdi:fan"), kpi("WRG", "mdi:recycle")]
    ),
    tpl(
      "ahu-hp",
      "RLT mit Luft-WP",
      "L\xFCftungsger\xE4t mit integrierter Luft-W\xE4rmepumpe.",
      "RLT mit W\xE4rmepumpe",
      "L\xFCftung und Nachheizung",
      [
        eq("rlt", "ahu", "RLT-Ger\xE4t", "L\xFCftung", 480, 305, 320, 230, ["Zuluft", "Abluft"]),
        eq("wp", "heat_pump", "Luft-W\xE4rmepumpe", "Nachheizung", 1e3, 305, 285, 185, ["Vorlauf", "R\xFCcklauf", "Leistung"])
      ],
      [pipe("rlt_wp", "heating_supply", [[800, 380], [1e3, 380]])],
      [kpi("Zuluft", "mdi:fan"), kpi("Leistung", "mdi:fire")]
    ),
    tpl(
      "pv-storage",
      "PV mit Speicher",
      "PV, Hybrid-Wechselrichter, Batterie, Netzanschluss.",
      "PV-Anlage",
      "Erzeugung, Speicher, Netz",
      [
        eq("pv", "generic", "PV-Anlage", "Generator", 130, 255, 285, 185, ["Leistung", "Ertrag heute"]),
        eq("wr", "generic", "Hybrid-Wechselrichter", "Umwandlung", 640, 255, 260, 185, ["AC-Leistung"]),
        eq("bat", "tank", "Batteriespeicher", "DC-Seitig", 640, 540, 260, 230, ["Ladestand", "Laden"]),
        eq("netz", "generic", "Netzanschluss", "\xDCbergabepunkt", 1160, 255, 260, 185, ["Leistung", "Z\xE4hlerstand"])
      ],
      [
        pipe("pv_wr", "neutral", [[415, 330], [640, 330]]),
        pipe("wr_bat", "neutral", [[770, 340], [770, 620], [900, 620]]),
        pipe("wr_netz", "neutral", [[900, 330], [1160, 330]])
      ],
      [kpi("PV", "mdi:solar-power"), kpi("Speicher", "mdi:battery"), kpi("Netz", "mdi:transmission-tower")]
    ),
    tpl(
      "energy-flow",
      "Energiefluss",
      "PV, Batterie, Netz, Hausverbrauch, W\xE4rmepumpe.",
      "Energiefl\xFCsse",
      "Erzeuger, Speicher, Verbraucher",
      [
        eq("pv", "generic", "PV", "Erzeuger", 130, 255, 260, 185, ["Leistung"]),
        eq("bat", "tank", "Batterie", "Speicher", 640, 200, 260, 185, ["Ladestand"]),
        eq("netz", "generic", "Netz", "Bezug/Einspeisung", 1150, 200, 260, 185, ["Leistung"]),
        eq("haus", "room", "Hausverbrauch", "Verbraucher", 640, 560, 260, 200, ["Leistung"]),
        eq("wp", "heat_pump", "W\xE4rmepumpe", "Verbraucher", 1120, 560, 280, 200, ["Leistung"])
      ],
      [
        pipe("pv_bat", "neutral", [[390, 330], [640, 330]]),
        pipe("bat_haus", "neutral", [[770, 290], [770, 640], [900, 640]]),
        pipe("bat_netz", "neutral", [[900, 290], [1150, 290]]),
        pipe("netz_wp", "neutral", [[1280, 385], [1280, 640], [1120, 640]])
      ],
      [kpi("Erzeugung", "mdi:solar-power"), kpi("Verbrauch", "mdi:home-lightning-bolt")]
    ),
    tpl(
      "pool",
      "Poolschwimmbad",
      "Pool-W\xE4rmepumpe, Solar, Becken.",
      "Schwimmbad",
      "Poolheizung mit Solar",
      [
        eq("wp", "heat_pump", "Pool-W\xE4rmepumpe", "Erzeuger", 130, 305, 285, 185, ["Vorlauf", "R\xFCcklauf"]),
        eq("solar", "heat_exchanger", "Absorber", "Dach", 640, 200, 260, 230, ["Austritt", "Eintritt"]),
        eq("becken", "tank", "Schwimmbecken", "Water", 1e3, 480, 400, 280, ["Wassertemperatur", "Soll"])
      ],
      [
        pipe("wp_becken", "heating_supply", [[415, 380], [700, 380], [700, 560], [1e3, 560]]),
        pipe("solar_wp", "heating_supply", [[640, 315], [500, 315], [500, 350], [415, 350]])
      ],
      [kpi("Wasser", "mdi:pool"), kpi("Solar", "mdi:weather-sunny")]
    ),
    tpl(
      "district-transfer",
      "Fernw\xE4rme-\xDCbergabe",
      "\xDCbergabestation, Warmwasser, Heizkreis.",
      "Fernw\xE4rme",
      "Hausanschlussstation",
      [
        eq("station", "heat_exchanger", "\xDCbergabestation", "Hausanschluss", 130, 305, 285, 185, ["Prim\xE4r Vorlauf", "Prim\xE4r R\xFCcklauf", "Leistung"]),
        eq("twe", "dhw_tank", "Trinkwarmwasser", "Speicher", 640, 255, 260, 230, ["Oben", "Soll"]),
        eq("hk", "room", "Heizkreis", "Verteilung", 1160, 255, 285, 225, ["Vorlauf", "Raum"])
      ],
      [
        pipe("st_twe", "dhw", [[415, 355], [535, 355], [535, 340], [640, 340]]),
        pipe("st_hk", "heating_supply", [[415, 390], [535, 390], [535, 420], [1040, 420], [1040, 300], [1160, 300]])
      ],
      [kpi("Leistung", "mdi:fire"), kpi("Warmwasser", "mdi:water-boiler")]
    )
  ]);
  function factoryTemplates() {
    return JSON.parse(JSON.stringify(FACTORY_TEMPLATES));
  }

  // src/v100/entity-bridge.mjs
  var ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/u;
  var ENTITY_IMPORT_LIMIT = 5e3;
  function normalizeEntityImport(data, options = {}) {
    const limit = options.limit ?? ENTITY_IMPORT_LIMIT;
    const rows = Array.isArray(data) ? data : Array.isArray(data?.entities) ? data.entities : [];
    const seen = /* @__PURE__ */ new Set();
    const entities = [];
    let rejected = 0;
    for (const row of rows) {
      const id = typeof row?.entity_id === "string" ? row.entity_id : "";
      if (!ENTITY_ID_PATTERN.test(id) || seen.has(id)) {
        rejected += 1;
        continue;
      }
      seen.add(id);
      entities.push({
        entity_id: id,
        name: typeof row.name === "string" && row.name.trim() ? row.name : id,
        domain: id.split(".")[0],
        unit: typeof row.unit === "string" ? row.unit : ""
      });
      if (entities.length >= limit) break;
    }
    entities.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    return { format: "glt-flow-card-entities", version: 1, count: entities.length, rejected, entities };
  }

  // src/v100/catalog-lookup.mjs
  var CATALOGS = /* @__PURE__ */ new Map();
  var DECLARED_KEYS = /* @__PURE__ */ new Set();
  var KEY_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
  var PLACEHOLDER_PATTERN = /\{([a-z][a-zA-Z0-9_]*)\}/gu;
  function registerCatalog(language, entries) {
    if (typeof language !== "string" || language.length === 0) {
      throw new Error(`catalog: language must be a non-empty string, got ${JSON.stringify(language)}`);
    }
    if (CATALOGS.has(language)) {
      throw new Error(`catalog: ${language} is already registered`);
    }
    const table = /* @__PURE__ */ new Map();
    for (const [key, value] of Object.entries(entries)) {
      if (!KEY_PATTERN.test(key)) {
        throw new Error(`catalog ${language}: "${key}" is not a namespace.name key`);
      }
      if (typeof value !== "string") {
        throw new Error(`catalog ${language}: "${key}" must be a string, got ${typeof value}`);
      }
      table.set(key, value);
      DECLARED_KEYS.add(key);
    }
    CATALOGS.set(language, table);
    return table;
  }
  function fill(template, values, context) {
    return template.replace(PLACEHOLDER_PATTERN, (_match, name) => {
      if (!Object.hasOwn(values ?? {}, name)) {
        throw new Error(`catalog ${context}: no value for placeholder {${name}}`);
      }
      const value = values[name];
      if (value === null || value === void 0) {
        throw new Error(`catalog ${context}: placeholder {${name}} is ${String(value)}`);
      }
      return String(value);
    });
  }
  function text(key, language, values = {}) {
    const table = CATALOGS.get(language);
    if (!table) {
      throw new Error(`catalog: no catalog registered for ${JSON.stringify(language)}`);
    }
    if (!DECLARED_KEYS.has(key)) {
      throw new Error(`catalog: no such key ${JSON.stringify(key)}`);
    }
    const template = table.get(key);
    if (template === void 0) {
      throw new Error(`catalog: ${JSON.stringify(key)} has no ${language} wording`);
    }
    return fill(template, values, `${language}/${key}`);
  }

  // src/v100/catalog-de.mjs
  var ENTRIES = Object.freeze({
    "alarms.acknowledge": "Quittieren",
    "alarms.alarms_title": "Alarme",
    "alarms.attempts_title": "Zustellversuche",
    "alarms.binding_read_only": "Nur lesbar",
    "alarms.cancel": "Abbrechen",
    "alarms.comment": "Kommentar",
    "alarms.confirm": "OK",
    "alarms.delivery_failed": "Zustellung fehlgeschlagen",
    "alarms.delivery_none": "Keine Benachrichtigungsziele konfiguriert; Alarme werden nur hier angezeigt",
    "alarms.links_title": "Kontext",
    "alarms.no_alarms": "Keine aktiven Alarme",
    "alarms.preview_ambiguous": "kommt zweimal vor am",
    "alarms.preview_ambiguous_tail": "dieser Eintrag l\xE4uft einmal, um",
    "alarms.preview_nonexistent": "gibt es nicht am",
    "alarms.preview_nonexistent_tail": "dieser Eintrag l\xE4uft nicht",
    "alarms.preview_normal": "l\xE4uft um",
    "alarms.priority_critical": "St\xF6rung",
    "alarms.priority_info": "Hinweis",
    "alarms.priority_warning": "Warnung",
    "alarms.schedule_kind_instant": "L\xE4uft zu einer Zeit",
    "alarms.schedule_kind_interval": "Betriebszeit",
    "alarms.schedule_preview": "Wirksame Zeiten",
    "alarms.schedule_title": "Zeitprogramme",
    "alarms.setting_default": "Vorgabe",
    "alarms.settings_title": "Alarmeinstellungen",
    "alarms.shelve": "Unterdr\xFCcken",
    "alarms.shelve_minutes": "F\xFCr wie viele Minuten unterdr\xFCcken?",
    "alarms.shelve_too_long": "L\xE4nger als dieser Standort erlaubt",
    "alarms.state_acknowledged": "quittiert",
    "alarms.state_active": "aktiv",
    "alarms.state_indeterminate": "Zustand unbekannt",
    "alarms.state_returned": "zur\xFCckgestellt",
    "alarms.state_suppressed": "unterdr\xFCckt",
    "alarms.suppressed_acknowledged": "quittiert",
    "alarms.suppressed_by": "von",
    "alarms.suppressed_maintenance": "in Wartung",
    "alarms.suppressed_shelved": "geschelft",
    "alarms.suppressed_until": "bis",
    "assets.attachment_limits": "H\xF6chstens {count} Anh\xE4nge, je bis {megabytes} MB.",
    "assets.column_declared_in": "Deklariert in",
    "assets.column_diagnosis": "Diagnose",
    "assets.column_evidence": "Nachweis",
    "assets.column_note": "Hinweis",
    "assets.column_provenance": "Herkunft",
    "assets.column_reference": "Referenz",
    "assets.column_slot": "Slot",
    "assets.column_tick": "Takt",
    "assets.column_value": "Wert",
    "assets.diagnosis_duplicate_binding": "doppelte Zuordnung",
    "assets.diagnosis_missing": "fehlt",
    "assets.diagnosis_present": "vorhanden",
    "assets.diagnosis_registered_not_loaded": "registriert, aber nicht geladen",
    "assets.diagnosis_service_missing": "Dienst fehlt",
    "assets.diagnosis_stale": "veraltet",
    "assets.diagnosis_unregistered": "ohne Registry-Eintrag",
    "assets.diagnosis_wrong_device_class": "falsche Ger\xE4teklasse",
    "assets.diagnosis_wrong_unit": "falsche Einheit",
    "assets.field_asset": "Anlagenobjekt",
    "assets.field_note": "Notiz",
    "assets.field_reason": "Begr\xFCndung",
    "assets.field_title": "Aufgabe",
    "assets.measured": "gemessen",
    "assets.no_entries": "Keine Eintr\xE4ge.",
    "assets.read_only": "Diese Ansicht \xE4ndert nichts. Alle Hinweise sind Verweise, keine Aktionen.",
    "assets.refused_simulating": "Nicht ausgef\xFChrt: eine Simulation l\xE4uft.",
    "assets.refused_unknown": "Nicht ausgef\xFChrt: der Simulationszustand war nicht feststellbar. Bitte erneut versuchen.",
    "assets.session_active": "Simulation aktiv \u2014 gestartet von {who}, endet {until}. Die Anlage wird nicht bedient.",
    "assets.session_expired": "Die Simulation ist abgelaufen. Die Anlage wird wieder bedient.",
    "assets.simulated": "simuliert",
    "assets.simulated_shape": "\u25C8",
    "catalog.catalog_title": "Symbolkatalog",
    "catalog.direction_bidirectional": "Beide Richtungen",
    "catalog.direction_in": "Eingang",
    "catalog.direction_out": "Ausgang",
    "catalog.filter_all": "Alle",
    "catalog.filter_category": "Kategorie",
    "catalog.filter_domain": "Gewerk",
    "catalog.filter_style": "Stil",
    "catalog.filter_text": "Suche",
    "catalog.kind_power": "Energie",
    "catalog.kind_process": "Prozess",
    "catalog.kind_signal": "Signal",
    "catalog.multiplicity_full": "Bereits belegt",
    "catalog.multiplicity_many": "Mehrere Verbindungen",
    "catalog.multiplicity_one": "Eine Verbindung",
    "catalog.no_matches": "Kein Symbol passt zu diesen Filtern",
    "catalog.port_direction": "Richtung",
    "catalog.port_kind": "Art",
    "catalog.port_medium": "Medium",
    "catalog.port_multiplicity": "Verbindungen",
    "catalog.port_side": "Seite",
    "catalog.published_variants": "ver\xF6ffentlichte Varianten",
    "catalog.refusal_direction_conflict": "Die Richtungen widersprechen sich: beide Ports zeigen gleich.",
    "catalog.refusal_duplicate_connection": "Diese beiden Ports sind bereits verbunden.",
    "catalog.refusal_kind_mismatch": "Die Arten unterscheiden sich: Prozess passt nicht zu Signal oder Energie.",
    "catalog.refusal_medium_mismatch": "Die Medien unterscheiden sich: die Ports f\xFChren Verschiedenes.",
    "catalog.refusal_multiplicity_exceeded": "Dieser Port hat die eine Verbindung bereits, die er zul\xE4sst.",
    "catalog.refusal_self_connection": "Ein Port kann nicht mit sich selbst verbunden werden.",
    "catalog.refusal_title": "Diese Verbindung ist nicht m\xF6glich",
    "catalog.refusal_unknown": "Die Verbindung wurde abgelehnt.",
    "contract.dangling_reference": "Verweis auf {id} in {collection} zeigt ins Leere",
    "contract.depth": "Verschachtelung zu tief: {actual}, h\xF6chstens {limit}",
    "contract.duplicate_id": "Die ID {id} kommt in {collection} mehrfach vor",
    "contract.error_limit": "{actual} Befunde gefunden; nur die ersten {limit} werden angezeigt",
    "contract.id_length": "ID zu lang: {actual} Zeichen, h\xF6chstens {limit}",
    "contract.json_bytes": "Projekt zu gro\xDF: {actual} Bytes, h\xF6chstens {limit}",
    "contract.nodes": "Zu viele Elemente: {actual}, h\xF6chstens {limit}",
    "contract.path_length": "Pfad zu lang: {actual} Zeichen, h\xF6chstens {limit}",
    "contract.required": "Pflichtangabe fehlt: {property}",
    "contract.schema_version": "Schemaversion {actual} wird nicht unterst\xFCtzt. Zul\xE4ssig: {allowed}",
    "contract.string_bytes": "Text zu lang: {actual} Bytes, h\xF6chstens {limit}",
    "contract.type": "Falscher Datentyp \u2014 erwartet wird {expected}",
    "contract.type_keyword": "Wert verletzt die Regel {keyword}",
    "contract.unknown": "Unbekannter Befund: {code}",
    "designer.add": "Objekt hinzuf\xFCgen",
    "designer.align": "Ausrichten",
    "designer.canvas_label": "Konstruktionsfl\xE4che",
    "designer.confirm_delete": "Ausgew\xE4hlte Objekte l\xF6schen?",
    "designer.confirm_remove_pack": "Dieses Erweiterungspaket entfernen?",
    "designer.conflict": "Konflikt",
    "designer.connect": "Ports verbinden",
    "designer.connect_choose_source": "Quell-Port w\xE4hlen",
    "designer.connect_choose_target": "Ziel-Port w\xE4hlen",
    "designer.connect_refused": "Verbindung abgelehnt",
    "designer.contributes": "Enth\xE4lt",
    "designer.delete": "L\xF6schen",
    "designer.disconnect": "Verbindung trennen",
    "designer.distribute": "Verteilen",
    "designer.extend_selection": "Auswahl erweitern",
    "designer.extensions": "Installierte Erweiterungen",
    "designer.group": "Gruppieren",
    "designer.instantiate_master": "Master-Instanz setzen",
    "designer.keyboard_help": "Tastatur",
    "designer.layer_hidden": "Ausgeblendet",
    "designer.layer_locked": "Gesperrt",
    "designer.layer_unlocked": "Entsperrt",
    "designer.layer_visible": "Sichtbar",
    "designer.layers": "Ebenen",
    "designer.minimap_label": "\xDCbersicht",
    "designer.no_extensions": "Es sind keine Erweiterungspakete installiert",
    "designer.nothing_selected": "Nichts ausgew\xE4hlt",
    "designer.nudge_coarse": "Verschieben, grob",
    "designer.nudge_fine": "Verschieben",
    "designer.objects": "Objekte",
    "designer.ready": "Bereit",
    "designer.redo": "Wiederherstellen",
    "designer.reorder": "Nach vorn holen",
    "designer.resize": "Gr\xF6\xDFe \xE4ndern",
    "designer.select": "Ausw\xE4hlen",
    "designer.supports": "Unterst\xFCtzt Projektschema",
    "designer.undo": "R\xFCckg\xE4ngig",
    "designer.undo_depth": "Aufbewahrte Schritte",
    "designer.ungroup": "Gruppierung aufheben",
    "designer.viewport": "Aktueller Ausschnitt",
    "equipment.command_failed": "Befehl fehlgeschlagen",
    "equipment.command_pending": "Befehl l\xE4uft",
    "equipment.communication_error": "Kommunikationsfehler",
    "equipment.fault": "St\xF6rung",
    "equipment.interlock": "Verriegelt",
    "equipment.invalid": "Ung\xFCltiger Wert",
    "equipment.local": "Vor-Ort-Bedienung",
    "equipment.locked": "Gesperrt",
    "equipment.maintenance": "Wartung",
    "equipment.manual": "Handbetrieb",
    "equipment.off": "Aus",
    "equipment.running": "In Betrieb",
    "equipment.stale": "Wert nicht aktuell",
    "equipment.standby": "Bereitschaft",
    "equipment.unknown": "Unbekannt",
    "equipment.warning": "Warnung",
    "legacy.ack_via_alarm_list": "Quittieren erfolgt \xFCber die Alarmliste.",
    "legacy.alarm_state_unavailable": "Alarmzustand derzeit nicht abrufbar.",
    "legacy.auto_connect": "Automatisch verbinden",
    "legacy.auto_mapping": "Auto mapping",
    "legacy.button_energy": "\u26A1 Energie",
    "legacy.button_reports": "\u25A4 Berichte",
    "legacy.button_z_lower": "Nach hinten stellen",
    "legacy.button_z_raise": "Nach vorn holen",
    "legacy.category_air": "RLT / L\xFCftung",
    "legacy.category_building": "Geb\xE4ude",
    "legacy.category_cooling": "K\xE4lte",
    "legacy.command_failed": "Befehl fehlgeschlagen",
    "legacy.command_running": "Befehl l\xE4uft",
    "legacy.confirm_delete_project": "Projekt wirklich l\xF6schen?",
    "legacy.controls_via_server": "Bedienung l\xE4uft \xFCber die vom Server zusammengestellte Objektbedienung.",
    "legacy.custom_image_optional": "Eigenes Bild / SVG (optional)",
    "legacy.download_yaml": "YAML herunterladen",
    "legacy.entities_export": "Entities aus Home Assistant exportieren",
    "legacy.entities_hint": "Ohne Home-Assistant-Verbindung: in HA exportieren, hier importieren \u2014 Entity-Felder bieten danach Vorschl\xE4ge.",
    "legacy.entities_import": "Entities importieren (.json)",
    "legacy.entities_imported": "Importierte Entities",
    "legacy.entities_invalid": "Datei nicht lesbar \u2014 erwartete Form: glt-flow-card-entities JSON.",
    "legacy.entities_offline": "Kein Home Assistant verbunden \u2014 der Import nutzt die gespeicherte Liste.",
    "legacy.entities_rejected": "abgelehnt",
    "legacy.entity": "Entit\xE4t",
    "legacy.entity_missing": "Entity fehlt",
    "legacy.fault": "St\xF6rung",
    "legacy.fit_view": "Ansicht einpassen",
    "legacy.fullscreen": "Vollbild",
    "legacy.height": "H\xF6he",
    "legacy.loading_entities": "HA-Entities werden geladen",
    "legacy.lock_released": "Lock gel\xF6st.",
    "legacy.lovelace_yaml": "Lovelace YAML",
    "legacy.main_entity": "Haupt-Entit\xE4t",
    "legacy.medium_air_exhaust": "Fortluft",
    "legacy.medium_air_extract": "Abluft",
    "legacy.medium_air_outdoor": "Au\xDFenluft",
    "legacy.medium_air_supply": "Zuluft",
    "legacy.medium_cold_water": "Kaltwasser",
    "legacy.medium_cooling_return": "K\xFChl-R\xFCcklauf",
    "legacy.medium_cooling_supply": "Kaltwasser",
    "legacy.medium_dhw": "Warmwasser",
    "legacy.medium_electrical": "Elektrisch",
    "legacy.medium_heating_return": "R\xFCcklauf",
    "legacy.medium_heating_supply": "Vorlauf",
    "legacy.medium_neutral": "Medium",
    "legacy.medium_source": "Quelle",
    "legacy.meter": "Z\xE4hler",
    "legacy.migration_workflow": "Migration workflow",
    "legacy.nav_alarms": "Alarme",
    "legacy.nav_automap": "Auto-Mapping",
    "legacy.nav_cad": "CAD",
    "legacy.nav_diagnostics": "Diagnose",
    "legacy.nav_energy": "Energie",
    "legacy.nav_entities": "Entities",
    "legacy.nav_maintenance": "Wartung",
    "legacy.nav_operations": "Betrieb",
    "legacy.nav_project": "Projekt v1",
    "legacy.nav_schedule": "Zeitprogramme",
    "legacy.nav_semantics": "Semantik",
    "legacy.nav_simulation": "Simulation",
    "legacy.nav_symbols": "Symbole 300+",
    "legacy.nav_templates": "Vorlagen",
    "legacy.nav_trends": "Trends",
    "legacy.new_project_name": "Name f\xFCr das neue Projekt",
    "legacy.no_date": "Kein Datum",
    "legacy.no_energy_meters": "Keine Energiez\xE4hler konfiguriert.",
    "legacy.no_fault": "Keine St\xF6rung",
    "legacy.no_work_orders": "Keine Arbeitsauftr\xE4ge.",
    "legacy.open_detail": "Detailansicht \xF6ffnen",
    "legacy.paste_compare_json": "Vergleichskonfiguration als JSON einf\xFCgen",
    "legacy.perform_maintenance": "Wartung durchf\xFChren",
    "legacy.project_locked": "Projekt gesperrt.",
    "legacy.prompt_group_name": "Gruppenname",
    "legacy.prompt_layer_name": "Layername",
    "legacy.prompt_period": "Zeitraum: day / week / month / year",
    "legacy.prompt_project_name": "Projektname",
    "legacy.prompt_report_name": "Reportname",
    "legacy.prompt_task": "Aufgabe",
    "legacy.prompt_template_name": "Vorlagenname",
    "legacy.redo": "Wiederherstellen",
    "legacy.report_designer": "Report Designer",
    "legacy.report_format_hint": "Report: 'csv' f\xFCr CSV oder 'pdf' f\xFCr Druck/PDF",
    "legacy.running": "L\xE4uft",
    "legacy.save_as": "Speichern unter",
    "legacy.schedule_hint": "Automatik (z.B. 1 07:00) oder leer",
    "legacy.search_component": "Bauteil oder Symbol suchen\u2026",
    "legacy.select_equipment_first": "Zuerst ein Anlagenobjekt ausw\xE4hlen.",
    "legacy.select_something_first": "Zuerst ein Bauteil, Datenpunkt, Pfad oder KPI ausw\xE4hlen.",
    "legacy.select_two_first": "Mindestens zwei Elemente per Strg/Shift ausw\xE4hlen.",
    "legacy.simulated_value": "Simulierter Wert",
    "legacy.sponsor": "Sponsor",
    "legacy.sponsor_free": "Alles kostenlos \u2014 Sponsoring ist freiwillig.",
    "legacy.sponsor_hint": "alles kostenlos \xB7 \u2665 Sponsoring freiwillig",
    "legacy.state_entity": "Status-Entit\xE4t",
    "legacy.style_clean_light": "Clean / Modern Light",
    "legacy.subplant_saved": "Unteranlage als Vorlage gespeichert.",
    "legacy.subtitle": "Geb\xE4udeleittechnik \xB7 Live-Anlagenbild",
    "legacy.suppress_minutes": "F\xFCr wie viele Minuten unterdr\xFCcken?",
    "legacy.symbol_ahu": "RLT-Zentrale",
    "legacy.symbol_air_filter": "Luftfilter",
    "legacy.symbol_balancing_valve": "Strangregulierventil",
    "legacy.symbol_battery": "Batteriespeicher",
    "legacy.symbol_boiler": "Heizkessel",
    "legacy.symbol_buffer_layered": "Schichtspeicher",
    "legacy.symbol_buffer_vertical": "Pufferspeicher \xB7 Vertikal",
    "legacy.symbol_check_valve": "R\xFCckschlagventil",
    "legacy.symbol_chiller": "K\xE4ltemaschine",
    "legacy.symbol_co2_sensor": "CO\u2082-Sensor",
    "legacy.symbol_cooling_buffer": "K\xE4ltepuffer",
    "legacy.symbol_cooling_coil": "K\xFChlregister",
    "legacy.symbol_cooling_tower": "K\xFChlturm",
    "legacy.symbol_custom_image": "Eigenes Symbol / Bild",
    "legacy.symbol_damper": "Luftklappe",
    "legacy.symbol_dhw_tank": "Warmwasserspeicher",
    "legacy.symbol_expansion_vessel": "Ausdehnungsgef\xE4\xDF",
    "legacy.symbol_fan_extract": "Abluftventilator",
    "legacy.symbol_fan_supply": "Zuluftventilator",
    "legacy.symbol_fancoil": "Gebl\xE4sekonvektor",
    "legacy.symbol_fancoil_cooling": "Fan-Coil",
    "legacy.symbol_filter_water": "Schmutzf\xE4nger",
    "legacy.symbol_flow_sensor": "Volumenstrom",
    "legacy.symbol_generic_machine": "Allgemeine Anlage",
    "legacy.symbol_grid": "Stromnetz",
    "legacy.symbol_heat_exchanger_plate": "Plattenw\xE4rmetauscher",
    "legacy.symbol_heat_pump_compact": "W\xE4rmepumpe \xB7 Kompakt",
    "legacy.symbol_heat_pump_neo": "W\xE4rmepumpe \xB7 Neo",
    "legacy.symbol_heating_circuit": "Heizkreis",
    "legacy.symbol_heating_coil": "Heizregister",
    "legacy.symbol_humidifier": "Befeuchter",
    "legacy.symbol_humidity_sensor": "Feuchtef\xFChler",
    "legacy.symbol_hydraulic_separator": "Hydraulische Weiche",
    "legacy.symbol_immersion_heater": "Heizstab",
    "legacy.symbol_manifold": "Verteiler / Sammler",
    "legacy.symbol_meter": "Energiez\xE4hler",
    "legacy.symbol_mixing_valve": "Mischventil",
    "legacy.symbol_pressure_sensor": "Drucksensor",
    "legacy.symbol_pump_circulation": "Umw\xE4lzpumpe",
    "legacy.symbol_pump_dhw": "Zirkulationspumpe",
    "legacy.symbol_pump_inline": "Pumpe \xB7 Inline",
    "legacy.symbol_pv_array": "PV-Anlage",
    "legacy.symbol_radiator": "Heizk\xF6rper",
    "legacy.symbol_room_air": "Raum / Zone",
    "legacy.symbol_room_sensor": "Raumsensor",
    "legacy.symbol_solar_thermal": "Solarthermie",
    "legacy.symbol_source_ground": "Erdsonde / Quelle",
    "legacy.symbol_temp_sensor": "Temperaturf\xFChler",
    "legacy.symbol_underfloor": "Fu\xDFbodenheizung",
    "legacy.symbol_valve_2way": "2-Wege-Ventil",
    "legacy.symbol_valve_3way": "3-Wege-Ventil",
    "legacy.symbol_wallbox": "Wallbox",
    "legacy.templates_factory": "Werks-Vorlagen",
    "legacy.templates_hint": "Laden ersetzt die aktuelle Konfiguration \u2014 Undo steht bereit. Entities bleiben leer und werden anschlie\xDFend zugewiesen.",
    "legacy.templates_load": "Laden",
    "legacy.templates_none": "Noch keine eigenen Vorlagen gespeichert.",
    "legacy.templates_own": "Eigene Vorlagen",
    "legacy.undo": "R\xFCckg\xE4ngig",
    "legacy.value1_entity": "Wert 1 Entit\xE4t",
    "legacy.value1_label": "Wert 1 Label",
    "legacy.value2_entity": "Wert 2 Entit\xE4t",
    "legacy.value2_label": "Wert 2 Label",
    "legacy.value_invalid": "Wert ung\xFCltig",
    "legacy.value_stale": "Wert veraltet",
    "legacy.x_in_view": "X in Ansicht",
    "legacy.y_in_view": "Y in Ansicht",
    "legacy.zoom_in": "Vergr\xF6\xDFern",
    "legacy.zoom_out": "Verkleinern",
    "operations.affordance_audit": "Vertrauensw\xFCrdiges Protokoll \xF6ffnen",
    "operations.affordance_cancel": "Abbrechen",
    "operations.affordance_dismiss": "Schlie\xDFen",
    "operations.affordance_state": "Aktuellen Zustand zeigen",
    "operations.history_unavailable": "Trends sind noch nicht verf\xFCgbar",
    "operations.last_updated": "Zuletzt aktualisiert",
    "operations.no_alarms": "Keine Alarme",
    "operations.no_controls_available": "Keine Bedienung f\xFCr Sie verf\xFCgbar",
    "operations.no_values_declared": "Keine Werte deklariert",
    "operations.outcome_accepted": "Angenommen \u2014 wartet auf Absendung",
    "operations.outcome_cancelled": "Abgebrochen \u2014 nicht gesendet",
    "operations.outcome_confirmed": "Best\xE4tigt",
    "operations.outcome_denied": "Nicht berechtigt",
    "operations.outcome_dispatched": "Gesendet \u2014 wartet auf Best\xE4tigung",
    "operations.outcome_failed_after_dispatch": "Nach Absendung fehlgeschlagen \u2014 Wirkung unbekannt",
    "operations.outcome_failed_before_dispatch": "Fehlgeschlagen \u2014 nicht gesendet",
    "operations.outcome_result_unknown": "Wirkung unbekannt",
    "operations.outcome_timed_out": "Keine Best\xE4tigung \u2014 Wirkung unbekannt",
    "operations.status_live": "Live",
    "operations.status_resyncing": "Wird neu geladen",
    "operations.status_stale": "Nicht live \u2014 letzte bekannte Werte",
    "operations.status_unavailable": "Nicht verf\xFCgbar",
    "operations.view_not_available": "Diese Ansicht ist nicht verf\xFCgbar.",
    "period.change": "Verbrauch",
    "period.circular_mean_required": "Diese Gr\xF6\xDFe ist eine Richtung \u2014 ein arithmetischer Mittelwert w\xE4re falsch.",
    "period.custom": "Freier Zeitraum",
    "period.day": "Tag",
    "period.entities_exceed_limit": "Die Abfrage nennt mehr Entit\xE4ten, als der Standort erlaubt.",
    "period.incompatible_unit": "Einheit und Preis passen nicht zusammen \u2014 nicht verrechenbar.",
    "period.max": "Maximum",
    "period.mean": "Mittelwert",
    "period.min": "Minimum",
    "period.month": "Monat",
    "period.none": "Alle Messwerte",
    "period.outside_statistic_coverage": "Dieser Zeitraum liegt vor dem ersten aufgezeichneten Wert.",
    "period.raw": "aus Rohwerten",
    "period.state": "Z\xE4hlerstand",
    "period.statistics": "aus Langzeitstatistik",
    "period.unavailable": "nicht abrufbar",
    "period.undeclared_meter_model": "F\xFCr diesen Z\xE4hler ist nicht festgelegt, ob er z\xE4hlt oder misst.",
    "period.unknown_aggregate": "Diese Auswertung ist nicht bekannt.",
    "period.unknown_period": "Dieser Zeitraum ist nicht bekannt.",
    "period.unknown_source": "Diese Quelle ist nicht bekannt.",
    "period.week": "Woche",
    "period.window_exceeds_limit": "Der Zeitraum ist l\xE4nger, als f\xFCr Rohwerte erlaubt ist.",
    "period.year": "Jahr",
    "replay.before_first_sample": "Vor dem ersten aufgezeichneten Wert",
    "replay.no_recorded_history": "Keine Historie aufgezeichnet",
    "replay.outside_loaded_window": "Au\xDFerhalb des geladenen Zeitraums",
    "safety.access_denied": "Die Zugriffs\xE4nderung wurde abgelehnt. Es wurde nichts ge\xE4ndert.",
    "safety.access_empty": "Bisher hat kein Mitglied eine Rolle in diesem Projekt.",
    "safety.access_heading": "Projektzugriff",
    "safety.access_loading": "Projektzugriff wird geladen",
    "safety.access_revision": "Zugriffsrevision",
    "safety.access_saved": "Zugriffs\xE4nderung \xFCbernommen",
    "safety.acquire_lease": "Bearbeitungslease anfordern",
    "safety.action_column": "Aktion",
    "safety.add_member": "Mitglied hinzuf\xFCgen",
    "safety.announcements_authority_current": "Serverautorit\xE4t aktualisiert.",
    "safety.announcements_evidence_page_failed": "Die n\xE4chste Nachweisseite konnte nicht geladen werden.",
    "safety.announcements_lease_acquired": "Bearbeitungslease von dieser Sitzung \xFCbernommen.",
    "safety.announcements_lease_held": "Eine andere Sitzung bearbeitet gerade.",
    "safety.announcements_lease_released": "Bearbeitungslease freigegeben.",
    "safety.announcements_lease_renewed": "Bearbeitungslease verl\xE4ngert.",
    "safety.apply_access_change": "Zugriffs\xE4nderung \xFCbernehmen",
    "safety.apply_failure": "Projekt\xE4nderungen wurden nicht \xFCbernommen. Es wurde nichts ge\xE4ndert. Pr\xFCfen Sie die Diagnose und starten Sie einen neuen Probelauf.",
    "safety.apply_selected": "Ausgew\xE4hlte \xC4nderungen \xFCbernehmen",
    "safety.apply_success": "Projekt\xE4nderungen \xFCbernommen",
    "safety.apply_success_body": "Revision {revision} wurde nach dem \xDCbernehmen von {count} \xC4nderungen validiert und verifiziert. Das verifizierte Backup {backup_id} bleibt verf\xFCgbar.",
    "safety.applying": "{count} Projekt\xE4nderungen werden \xFCbernommen",
    "safety.artifact_equality": "Artefaktgleichheit",
    "safety.asset_metadata": "Undurchsichtige Asset-Metadaten",
    "safety.assigned": "Zugewiesen",
    "safety.assignment_column": "Zuweisung",
    "safety.audit_actor": "Akteur",
    "safety.audit_at": "Serverzeit",
    "safety.audit_correlation": "Korrelations-ID",
    "safety.audit_event": "Ereignis",
    "safety.audit_result": "Ergebnis",
    "safety.authority_bar": "Autorit\xE4tsstatus",
    "safety.back_to_overview": "Zur\xFCck zur \xDCbersicht",
    "safety.bundle_empty": "Kein Paket gepr\xFCft. Projekt-Asset-Metadaten werden ohne Darstellung der Inhalte aufgelistet.",
    "safety.bundle_safety": "Paketsicherheit",
    "safety.byte_identical": "Byte-identisch",
    "safety.cancel_access_change": "Zugriffs\xE4nderung abbrechen",
    "safety.cancel_apply": "Projekt\xE4nderungen abbrechen",
    "safety.cancel_discard": "\xC4nderungen behalten",
    "safety.candidate_heading": "Ungespeicherter Entwurf",
    "safety.candidate_states_applied": "\xDCbernommen",
    "safety.candidate_states_dirty": "Ungespeicherte \xC4nderungen in dieser Sitzung",
    "safety.candidate_states_none": "Keine ungespeicherten \xC4nderungen",
    "safety.candidate_states_preserved": "Ungespeicherte \xC4nderungen im Speicher erhalten",
    "safety.capabilities_column": "Effektive Berechtigungen",
    "safety.capability_codes": "Berechtigungscodes anzeigen",
    "safety.categories_add": "Hinzugef\xFCgt",
    "safety.categories_binding": "Bindung",
    "safety.categories_config": "Konfiguration",
    "safety.categories_move": "Verschoben",
    "safety.categories_remove": "Entfernt",
    "safety.check_lease": "Lease-Verf\xFCgbarkeit pr\xFCfen",
    "safety.checksum": "SHA-256",
    "safety.choose_user": "Berechtigten Benutzer ausw\xE4hlen",
    "safety.client_telemetry": "Client-Telemetrie (nicht vertrauensw\xFCrdig)",
    "safety.close": "Projektsicherheit schlie\xDFen",
    "safety.collaboration": "Zusammenarbeit",
    "safety.companion": "Companion",
    "safety.companion_states_current": "Autorit\xE4t aktuell",
    "safety.companion_states_incompatible": "Richtlinienversion nicht unterst\xFCtzt",
    "safety.companion_states_refreshing": "Autorit\xE4t wird aktualisiert",
    "safety.companion_states_stale": "Autorit\xE4t veraltet",
    "safety.companion_states_unavailable": "Companion nicht verf\xFCgbar",
    "safety.confirm_access_body": "{member} auf {role} \xE4ndern, Zugriffsrevision {revision}? Die \xC4nderung wird atomar \xFCbernommen und im vertrauensw\xFCrdigen Auditprotokoll festgehalten.",
    "safety.confirm_access_heading": "Zugriffs\xE4nderung best\xE4tigen",
    "safety.confirm_apply_body": "{count} validierte \xC4nderungen auf \u201E{project}\u201C in Revision {revision} \xFCbernehmen? Zuerst wird ein verifiziertes Backup erstellt. Dies \xE4ndert nur Projektdaten und sendet keinen Anlagenbefehl.",
    "safety.confirm_apply_heading": "Projekt\xE4nderungen best\xE4tigen",
    "safety.confirm_remove_body": "Gesamten Zugriff f\xFCr {member} entfernen, Zugriffsrevision {revision}? Es verbleibt keine Rolle in diesem Projekt.",
    "safety.conflict_body": "Revision {base} ist nicht mehr aktuell; Revision {current} ist aktiv. Ihr Entwurf bleibt im Speicher erhalten. Es wurde nichts \xFCberschrieben.",
    "safety.conflict_choices_discard": "Meine \xC4nderungen verwerfen",
    "safety.conflict_choices_merge_preview": "Zusammenf\xFChrung als Vorschau",
    "safety.conflict_choices_refresh": "Vom Server aktualisieren",
    "safety.conflict_choices_retry_with_fresh_lease": "Mit neuem Lease erneut versuchen",
    "safety.conflict_heading": "Speichern blockiert \u2014 es existiert eine neuere Revision",
    "safety.connected": "Verbunden",
    "safety.contract_unknown": "Unbekannter Befund: {code}",
    "safety.control_cancel": "Steuerung abbrechen",
    "safety.control_confirm_body": "\u201E{label}\u201C ausf\xFChren? Der Companion l\xF6st die Wirkung aus dem aktuellen Projektstand auf; diese Karte sendet nur den Steuerungsnamen und die deklarierte Eingabe.",
    "safety.control_confirm_heading": "Konfigurierte Steuerung best\xE4tigen",
    "safety.control_correlation": "Korrelations-ID",
    "safety.control_effect": "Aufgel\xF6ste Wirkung",
    "safety.control_heading": "Konfigurierte Steuerung",
    "safety.control_no_retry": "Diese Karte wiederholt eine Steuerung niemals von selbst. Entscheiden Sie erneut, wenn sich die Anlage bewegen soll.",
    "safety.control_policy": "Steuerungsrichtlinie",
    "safety.control_preview": "Steuerung als Vorschau",
    "safety.control_run": "Steuerung ausf\xFChren",
    "safety.control_states_accepted": "Angenommen und protokolliert. Noch nicht abgesetzt.",
    "safety.control_states_cancelled_before_dispatch": "Abgebrochen. Es wurde nichts gesendet.",
    "safety.control_states_denied": "Abgelehnt.",
    "safety.control_states_dispatched": "An Home Assistant abgesetzt. Noch nicht best\xE4tigt.",
    "safety.control_states_failed_after_dispatch": "Nach dem Absetzen fehlgeschlagen. Die Wirkung ist unbekannt \u2014 pr\xFCfen Sie den aktuellen Zustand und das vertrauensw\xFCrdige Auditprotokoll.",
    "safety.control_states_failed_before_dispatch": "Vor dem Absetzen fehlgeschlagen. Es wurde nichts gesendet.",
    "safety.control_states_readback_confirmed": "Durch R\xFCcklesung best\xE4tigt.",
    "safety.control_states_result_unknown": "Das Ergebnis ist unbekannt \u2014 pr\xFCfen Sie den aktuellen Zustand und das vertrauensw\xFCrdige Auditprotokoll, bevor Sie erneut handeln.",
    "safety.control_states_timed_out": "Zeit\xFCberschreitung. Die Wirkung ist unbekannt \u2014 pr\xFCfen Sie den aktuellen Zustand und das vertrauensw\xFCrdige Auditprotokoll.",
    "safety.control_target": "Ziel",
    "safety.controls_visible": "{count} f\xFCr Sie sichtbare Steuerungen",
    "safety.current_revision": "Revision",
    "safety.discard_body": "Die ungespeicherten \xC4nderungen dieser Sitzung verwerfen? Sie k\xF6nnen danach nicht wiederhergestellt werden.",
    "safety.discard_heading": "Ungespeicherte \xC4nderungen verwerfen",
    "safety.dry_run": "Probelauf starten",
    "safety.dry_run_fresh": "Neuen Probelauf starten",
    "safety.editing": "Bearbeitung",
    "safety.eligible_user": "Berechtigter Benutzer",
    "safety.error_codes_authority_stale": "Die Serverautorit\xE4t ist veraltet. Aktualisieren Sie und versuchen Sie es erneut.",
    "safety.error_codes_capability_denied": "Ihre Rolle erlaubt diese Aktion nicht.",
    "safety.error_codes_effect_unknown": "Das Ergebnis ist unbekannt. Pr\xFCfen Sie das vertrauensw\xFCrdige Auditprotokoll vor einem erneuten Versuch.",
    "safety.error_codes_feature_unavailable": "Diese Funktion ist in dieser Version nicht verf\xFCgbar.",
    "safety.error_codes_invalid_input": "Die Anfrage wurde als ung\xFCltig abgelehnt. Es wurde nichts ge\xE4ndert.",
    "safety.error_codes_lease_expired": "Das Bearbeitungslease ist abgelaufen.",
    "safety.error_codes_lease_held": "Eine andere Sitzung bearbeitet gerade.",
    "safety.error_codes_lease_required": "Ein Bearbeitungslease ist erforderlich.",
    "safety.error_codes_not_found_or_denied": "Dieses Projekt ist f\xFCr Sie nicht verf\xFCgbar.",
    "safety.error_codes_not_loaded": "Der Companion ist nicht geladen.",
    "safety.error_codes_rate_limited": "Zu viele Anfragen. Warten Sie und versuchen Sie es erneut.",
    "safety.error_codes_revision_conflict": "Es existiert eine neuere Revision. Ihr Entwurf bleibt erhalten.",
    "safety.errors": "Validierungsprobleme",
    "safety.exact_card_version": "Exakte Kartenversion",
    "safety.expected_revision": "Erwartet",
    "safety.export_telemetry": "Client-Telemetrie exportieren",
    "safety.export_trusted": "Vertrauensw\xFCrdiges Auditprotokoll exportieren",
    "safety.finding": "Befund",
    "safety.ignored_noise": "Ignorierte Reihenfolgen\xE4nderung",
    "safety.impact": "Auswirkung",
    "safety.inspect_bundle": ".gltproject-Paket pr\xFCfen",
    "safety.last_refresh": "Letzte Aktualisierung",
    "safety.lease_acquiring": "Exklusives Bearbeitungslease wird angefordert",
    "safety.lease_expires_in": "L\xE4uft in {seconds}s ab",
    "safety.lease_heading": "Bearbeitungslease",
    "safety.lease_renew_due": "Die Verl\xE4ngerung ist f\xE4llig. Verl\xE4ngern Sie vor Ablauf des Leases.",
    "safety.lease_states_available": "Lease verf\xFCgbar",
    "safety.lease_states_expired": "Lease abgelaufen",
    "safety.lease_states_held_other": "Eine andere Sitzung bearbeitet",
    "safety.lease_states_held_self": "Diese Sitzung",
    "safety.lease_states_lost": "Lease verloren",
    "safety.lease_states_read_only": "Schreibgesch\xFCtzt",
    "safety.lease_states_renewing": "Wird verl\xE4ngert",
    "safety.load_next": "N\xE4chste 50 Ereignisse laden",
    "safety.manage_access": "Projektzugriff verwalten",
    "safety.media_type": "Medientyp",
    "safety.member_column": "Mitglied",
    "safety.merge_states_applied": "Zusammenf\xFChrung \xFCbernommen",
    "safety.merge_states_blocked": "Dieselben Pfade wurden auf beiden Seiten ge\xE4ndert. W\xE4hlen Sie eine andere Wiederherstellung.",
    "safety.merge_states_failed": "Die Zusammenf\xFChrungsvorschau ist fehlgeschlagen. Ihr Entwurf bleibt unver\xE4ndert.",
    "safety.merge_states_idle": "Keine Zusammenf\xFChrungsvorschau angefordert.",
    "safety.merge_states_ready": "Zusammenf\xFChrungsvorschau bereit. W\xE4hlen Sie die zu behaltenden \xC4nderungen.",
    "safety.merge_states_requested": "Zusammenf\xFChrungsvorschau wird angefordert",
    "safety.migration_workflow": "Migrationsablauf",
    "safety.mode_local": "Nur lokales Projekt",
    "safety.mode_shared": "Gemeinsames Projekt",
    "safety.my_access": "Mein Zugriff",
    "safety.my_role": "Meine Rolle",
    "safety.never": "Nie",
    "safety.no_capabilities": "Keine Berechtigungen in diesem Projekt.",
    "safety.no_evidence": "Die Release-Nachweise sind unvollst\xE4ndig. Fehlende oder veraltete Pr\xFCfungen sind unten aufgef\xFChrt.",
    "safety.not_evidence": "Kein Sicherheits- oder Steuerungsnachweis",
    "safety.not_run": "Nicht ausgef\xFChrt",
    "safety.overview": "\xDCbersicht Projektsicherheit",
    "safety.path": "Pfad",
    "safety.policy_version": "Richtlinienversion",
    "safety.preview_failed": "Die Migrationsvorschau ist fehlgeschlagen. Das Originalprojekt bleibt unver\xE4ndert. Pr\xFCfen Sie die Diagnose und starten Sie einen neuen Probelauf.",
    "safety.preview_ready": "Migrationsvorschau bereit",
    "safety.project": "Projekt",
    "safety.raw_contract": "Rohvertrag",
    "safety.read_only": "Schreibgesch\xFCtzt",
    "safety.read_only_reasons_authority_absent": "Noch keine Serverautorit\xE4t. Gemeinsames Bearbeiten bleibt schreibgesch\xFCtzt, bis der Companion antwortet.",
    "safety.read_only_reasons_authority_incompatible": "Der Companion verwendet eine Richtlinienversion, die diese Karte nicht unterst\xFCtzt.",
    "safety.read_only_reasons_authority_loading": "Serverautorit\xE4t wird aktualisiert. Bearbeiten ist bis dahin schreibgesch\xFCtzt.",
    "safety.read_only_reasons_authority_rejected": "Der Companion hat die Aktualisierung der Autorit\xE4t abgelehnt. Gemeinsames Bearbeiten ist schreibgesch\xFCtzt.",
    "safety.read_only_reasons_authority_sequence_gap": "Eine Autorit\xE4tsaktualisierung wurde verpasst. Vor dem Bearbeiten aktualisieren.",
    "safety.read_only_reasons_authority_stale": "Die Serverautorit\xE4t ist veraltet. Vor dem Bearbeiten aktualisieren.",
    "safety.read_only_reasons_companion_disconnected": "Der Companion ist nicht verf\xFCgbar. Gemeinsames Bearbeiten ist schreibgesch\xFCtzt.",
    "safety.read_only_reasons_lease_expired": "Das Bearbeitungslease ist abgelaufen. Ihr ungespeicherter Entwurf bleibt erhalten.",
    "safety.read_only_reasons_lease_lost": "Das Bearbeitungslease ging verloren. Ihr ungespeicherter Entwurf bleibt erhalten.",
    "safety.read_only_reasons_lease_required": "Fordern Sie das Bearbeitungslease an, um \xC4nderungen vorzunehmen.",
    "safety.read_only_reasons_role_missing": "Sie haben keine Rolle in diesem Projekt.",
    "safety.read_only_reasons_role_revoked": "Ihre Rolle f\xFCr dieses Projekt hat sich ge\xE4ndert. Gemeinsames Bearbeiten ist schreibgesch\xFCtzt.",
    "safety.release_evidence": "Release-Nachweise",
    "safety.release_lease": "Bearbeitungslease freigeben",
    "safety.remove_access": "Zugriff entfernen",
    "safety.renew_lease": "Bearbeitungslease verl\xE4ngern",
    "safety.required_dependency": "Erforderliche Abh\xE4ngigkeit",
    "safety.restore": "Verifiziertes Backup wiederherstellen",
    "safety.restore_awaiting": "Geben Sie \u201E{project}\u201C ein, um \u201EVerifiziertes Backup wiederherstellen\u201C zu aktivieren.",
    "safety.restore_body": "Verifiziertes Backup {backup_id} f\xFCr \u201E{project}\u201C wiederherstellen? Die aktuelle Revision {revision} wird ersetzt. Ein neuer Nachweis wird erstellt. Dies \xE4ndert nur Projektdaten und sendet keinen Anlagenbefehl.",
    "safety.restore_label": "Projektname zur Best\xE4tigung eingeben",
    "safety.restore_mismatch": "Der Projektname stimmt nicht \xFCberein. Das Projekt bleibt unver\xE4ndert.",
    "safety.restore_ready": "Projektname best\xE4tigt. Pr\xFCfen Sie vor dem Fortfahren die Revision und das Backup.",
    "safety.revision": "Revision",
    "safety.revision_conflict": "Revision {expected} ist nicht mehr aktuell; Revision {actual} ist aktiv. Laden Sie neu und vergleichen Sie erneut.",
    "safety.revision_triplet": "Basis {base} \xB7 Aktuell {current} \xB7 Entwurf {candidate}",
    "safety.role_column": "Rolle",
    "safety.role_matrix": "Rollen-Berechtigungsmatrix",
    "safety.role_matrix_unavailable": "Der Companion hat f\xFCr diese Rolle keine Berechtigungsmatrix zur\xFCckgegeben.",
    "safety.role_names_admin": "Administrator",
    "safety.role_names_engineer": "Ingenieur",
    "safety.role_names_none": "Keine Zuweisung",
    "safety.role_names_operator": "Bediener",
    "safety.role_names_viewer": "Betrachter",
    "safety.rollback_failure": "Verifizierung der Backup-Wiederherstellung fehlgeschlagen. Beide Snapshots wurden beibehalten. Laden Sie die Rollback-Diagnose herunter und fordern Sie eine Wiederherstellung durch die Administration an.",
    "safety.rollback_running": "Verifiziertes Backup wird wiederhergestellt",
    "safety.rollback_success": "Verifiziertes Backup wiederhergestellt",
    "safety.rollback_success_body": "Projektrevision {revision} entspricht dem verifizierten Backup {backup_id}. Ein Rollback-Nachweis wurde erstellt.",
    "safety.rows_stale": "Die n\xE4chste Seite konnte nicht geladen werden. Die angezeigten Ereignisse sind nicht mehr aktuell.",
    "safety.schema": "Schema",
    "safety.scope": "Nur Projektdaten \u2014 es wird kein Home-Assistant-Dienst und kein Anlagenbefehl ausgef\xFChrt.",
    "safety.server_authored": "Serverseitig erzeugt",
    "safety.server_normalization": "Servernormalisierung aktiv",
    "safety.shared_authority": "Gemeinsame Autorit\xE4t",
    "safety.size": "Gr\xF6\xDFe",
    "safety.standalone": "Companion nicht verf\xFCgbar \u2014 gemeinsame Projektaktionen sind schreibgesch\xFCtzt.",
    "safety.tabs_0": "\xDCbersicht",
    "safety.tabs_1": "Validieren",
    "safety.tabs_2": "Migrieren & vergleichen",
    "safety.tabs_3": "Pakete",
    "safety.tabs_4": "Nachweise",
    "safety.telemetry_category": "Kategorie",
    "safety.telemetry_empty": "In dieser Sitzung wurde keine Client-Telemetrie aufgezeichnet.",
    "safety.telemetry_payload": "Nutzdaten-Zusammenfassung",
    "safety.telemetry_received": "Empfangen",
    "safety.title": "Projektsicherheit",
    "safety.trusted_audit": "Vertrauensw\xFCrdiges Auditprotokoll",
    "safety.trusted_empty": "F\xFCr Sie ist noch kein vertrauensw\xFCrdiges Auditereignis sichtbar.",
    "safety.unchanged": "Originalprojekt unver\xE4ndert",
    "safety.validate": "Projekt validieren",
    "safety.validation_failed": "Projektvalidierung fehlgeschlagen",
    "safety.validation_idle": "W\xE4hlen Sie \u201EProjekt validieren\u201C, um das Rohprojekt unver\xE4ndert zu pr\xFCfen.",
    "safety.validation_invalid": "Das Projekt ist ung\xFCltig. Pr\xFCfen Sie die aufgef\xFChrten Pfade; das Original bleibt unver\xE4ndert.",
    "safety.validation_running": "Rohprojekt wird validiert",
    "safety.validation_success": "Projektvalidierung abgeschlossen",
    "safety.validation_valid": "Keine Validierungsprobleme gefunden. Das Rohprojekt entspricht Schema {version}.",
    "safety.workflow_0": "Pr\xFCfen",
    "safety.workflow_1": "Vorschau",
    "safety.workflow_2": "Backup",
    "safety.workflow_3": "\xDCbernehmen",
    "safety.workflow_4": "Verifizieren",
    "sites.age": "Stand vor {seconds} s",
    "sites.completeness": "{answered} von {total} Standorten geantwortet",
    "sites.effect_unknown": "Wirkung unbekannt \u2014 der Befehl kann ausgef\xFChrt worden sein. Pr\xFCfen Sie den Anlagenzustand, bevor Sie etwas erneut senden.",
    "sites.missing_sites": "Fehlende Standorte:",
    "sites.no_value": "kein Messwert",
    "sites.shape_circuit_open": "\u2715",
    "sites.shape_healthy": "\u25CF",
    "sites.shape_slow": "\u25D0",
    "sites.shape_unreachable": "\u25CB",
    "sites.site_circuit_open": "ausgesetzt nach wiederholten Fehlern",
    "sites.site_healthy": "erreichbar",
    "sites.site_slow": "langsam",
    "sites.site_unreachable": "nicht erreichbar",
    "sites.unverified_tls": "unverschl\xFCsselt gepr\xFCft: Zertifikat wird f\xFCr diesen Standort nicht gepr\xFCft",
    "symbols.category_allgemein": "Allgemein",
    "symbols.category_brandschutz": "Brandschutz",
    "symbols.category_elektro": "Elektro",
    "symbols.category_energie": "Energie",
    "symbols.category_gebaude": "Geb\xE4ude",
    "symbols.category_heizung": "Heizung",
    "symbols.category_hydraulik": "Hydraulik",
    "symbols.category_kalte": "K\xE4lte",
    "symbols.category_rlt": "RLT",
    "symbols.category_sensorik": "Sensorik",
    "symbols.control_enable": "Freigabe",
    "symbols.control_mode": "Betriebsart",
    "symbols.control_open_close": "\xD6ffnen/Schlie\xDFen",
    "symbols.control_position": "Stellung",
    "symbols.control_run": "Ein/Aus",
    "symbols.control_setpoint": "Sollwert",
    "symbols.control_speed": "Drehzahl",
    "symbols.label": "Heizung",
    "symbols.label_brandschutz": "Brandschutz",
    "symbols.label_elektro": "Elektro",
    "symbols.label_energie": "Energie",
    "symbols.label_hydraulik": "Hydraulik",
    "symbols.label_k_lte": "K\xE4lte",
    "symbols.label_rlt": "RLT",
    "symbols.label_sensorik": "Sensorik",
    "symbols.profile_ahu": "RLT-Zentrale",
    "symbols.profile_boiler": "Heizkessel",
    "symbols.profile_chiller": "K\xE4ltemaschine",
    "symbols.profile_damper": "Luftklappe",
    "symbols.profile_dhw_tank": "Warmwasserspeicher",
    "symbols.profile_fan": "Ventilator",
    "symbols.profile_generic": "Allgemeines Aggregat",
    "symbols.profile_heat_exchanger": "W\xE4rmetauscher",
    "symbols.profile_heat_pump": "W\xE4rmepumpe",
    "symbols.profile_meter": "Z\xE4hler",
    "symbols.profile_mixing_valve": "3-Wege-Mischer",
    "symbols.profile_pump": "Pumpe",
    "symbols.profile_room": "Raum / Zone",
    "symbols.profile_tank": "Speicher",
    "symbols.profile_valve": "Ventil",
    "symbols.slot_actual": "Ist VL",
    "symbols.slot_bottom_temp": "Unten",
    "symbols.slot_co2": "CO\u2082",
    "symbols.slot_cop": "COP",
    "symbols.slot_extract_flow": "Abluftmenge",
    "symbols.slot_extract_temp": "Abluft",
    "symbols.slot_feedback": "R\xFCckmeldung",
    "symbols.slot_flow": "Luftmenge",
    "symbols.slot_flow_temp": "Vorlauf",
    "symbols.slot_hours": "Betriebsstunden",
    "symbols.slot_humidity": "Feuchte",
    "symbols.slot_middle_temp": "Mitte",
    "symbols.slot_operating_hours": "Betriebsstunden",
    "symbols.slot_position": "Stellung",
    "symbols.slot_power": "Leistung",
    "symbols.slot_pressure": "Druck",
    "symbols.slot_primary_in_temp": "Prim\xE4r Ein",
    "symbols.slot_primary_out_temp": "Prim\xE4r Aus",
    "symbols.slot_return_temp": "K\xE4lte RL",
    "symbols.slot_secondary_in_temp": "Sekund\xE4r Ein",
    "symbols.slot_secondary_out_temp": "Sekund\xE4r Aus",
    "symbols.slot_setpoint": "Sollwert",
    "symbols.slot_speed": "Drehzahl",
    "symbols.slot_starts": "Starts",
    "symbols.slot_supply_flow": "Zuluftmenge",
    "symbols.slot_supply_temp": "K\xE4lte VL",
    "symbols.slot_temperature": "Raumtemperatur",
    "symbols.slot_top_temp": "Oben",
    "symbols.slot_value": "Wert",
    "symbols.style_classic_scada": "Classic SCADA",
    "symbols.style_clean": "Clean",
    "symbols.style_neo2030": "Neo 2030",
    "symbols.style_operations_light": "Operations Light",
    "symbols.style_pid_dark": "P&ID Dark",
    "symbols.style_standard_2d": "Standard 2D",
    "symbols.group_waermepumpen": "W\xE4rmepumpen",
    "symbols.group_kessel_erzeuger": "Kessel & Erzeuger",
    "symbols.group_puffer_speicher": "Puffer & Speicher",
    "symbols.group_heizflaechen": "Heizfl\xE4chen",
    "symbols.group_solar": "Solar",
    "symbols.group_stationen": "Stationen",
    "symbols.group_pumpen": "Pumpen",
    "symbols.group_ventile": "Ventile",
    "symbols.group_waermetauscher": "W\xE4rmetauscher",
    "symbols.group_verteilung": "Verteilung",
    "symbols.group_schmutzfaenger": "Schmutzf\xE4nger",
    "symbols.group_ausdehnung": "Ausdehnung",
    "symbols.group_geraete": "Ger\xE4te",
    "symbols.group_ventilatoren": "Ventilatoren",
    "symbols.group_klappen_regelung": "Klappen & Regelung",
    "symbols.group_filter": "Filter",
    "symbols.group_register": "Register",
    "symbols.group_waermerueckgewinnung": "W\xE4rmer\xFCckgewinnung",
    "symbols.group_befeuchtung": "Befeuchtung",
    "symbols.group_schalldaempfer": "Schalld\xE4mpfer",
    "symbols.group_kaeltemaschinen": "K\xE4ltemaschinen",
    "symbols.group_komponenten": "Komponenten",
    "symbols.group_kuehler": "K\xFChler",
    "symbols.group_speicher": "Speicher",
    "symbols.group_sole": "Sole",
    "symbols.group_photovoltaik": "Photovoltaik",
    "symbols.group_umwandlung": "Umwandlung",
    "symbols.group_netz_zaehler": "Netz & Z\xE4hler",
    "symbols.group_laden": "Laden",
    "symbols.group_erzeuger": "Erzeuger",
    "symbols.group_temperatur": "Temperatur",
    "symbols.group_druck": "Druck",
    "symbols.group_durchfluss": "Durchfluss",
    "symbols.group_feuchte": "Feuchte",
    "symbols.group_luftqualitaet": "Luftqualit\xE4t",
    "symbols.group_raum": "Raum",
    "symbols.group_versorgung": "Versorgung",
    "symbols.group_schutz_schaltung": "Schutz & Schaltung",
    "symbols.group_antriebe": "Antriebe",
    "symbols.group_meldetechnik": "Meldetechnik",
    "symbols.group_loeschanlagen": "L\xF6schanlagen",
    "symbols.group_abschottung": "Abschottung",
    "symbols.symbol_ahu": "RLT-Zentrale",
    "symbols.symbol_air_filter": "Luftfilter",
    "symbols.symbol_aspirating_detector": "Ansaugrauchmelder",
    "symbols.symbol_backflow_preventer": "R\xFCckflussverhinderer",
    "symbols.symbol_balancing_valve": "Strangregulierventil",
    "symbols.symbol_battery": "Batteriespeicher",
    "symbols.symbol_boiler": "Heizkessel",
    "symbols.symbol_brine_station": "Solestation",
    "symbols.symbol_buffer_layered": "Schichtspeicher",
    "symbols.symbol_burner": "Brenner",
    "symbols.symbol_busbar": "Sammelschiene",
    "symbols.symbol_check_valve": "R\xFCckschlagventil",
    "symbols.symbol_chiller": "K\xE4ltemaschine",
    "symbols.symbol_circuit_breaker": "Leitungsschutzschalter",
    "symbols.symbol_co2_sensor": "CO\u2082-Sensor",
    "symbols.symbol_co2_voc_sensor": "CO\u2082-VOC-Sensor",
    "symbols.symbol_cogen_unit": "BHKW",
    "symbols.symbol_compact_ahu": "Kompakt-RLT",
    "symbols.symbol_compressor": "Verdichter",
    "symbols.symbol_condensing_unit": "Kondensatork\xE4ltesatz",
    "symbols.symbol_cooling_buffer": "K\xE4ltepuffer",
    "symbols.symbol_cooling_coil": "K\xFChlregister",
    "symbols.symbol_cooling_tower": "K\xFChlturm",
    "symbols.symbol_damper": "Luftklappe",
    "symbols.symbol_dhw_freshwater_station": "Frischwasserstation",
    "symbols.symbol_dhw_tank": "Warmwasserspeicher",
    "symbols.symbol_dirt_separator": "Schlammabscheider",
    "symbols.symbol_dp_sensor": "Differenzdrucksensor",
    "symbols.symbol_dry_cooler": "Trockenk\xFChler",
    "symbols.symbol_ec_fan": "EC-Ventilator",
    "symbols.symbol_expansion_vessel": "Ausdehnungsgef\xE4\xDF",
    "symbols.symbol_extinguishing_system": "L\xF6schanlage",
    "symbols.symbol_fan_extract": "Abluftventilator",
    "symbols.symbol_fan_supply": "Zuluftventilator",
    "symbols.symbol_filter_water": "Schmutzf\xE4nger",
    "symbols.symbol_fire_alarm_panel": "Brandmeldezentrale",
    "symbols.symbol_fire_barrier": "Brandabschottung",
    "symbols.symbol_fire_damper": "Brandschutzklappe",
    "symbols.symbol_fire_door": "Brandschutzt\xFCr",
    "symbols.symbol_flat_collector": "Flachkollektor",
    "symbols.symbol_flexible_compensator": "Kompensator",
    "symbols.symbol_flow_sensor": "Volumenstromsensor",
    "symbols.symbol_flow_switch": "Str\xF6mungsw\xE4chter",
    "symbols.symbol_frequency_drive": "Frequenzumrichter",
    "symbols.symbol_frost_thermostat": "Frostschutzthermostat",
    "symbols.symbol_fuel_cell": "Brennstoffzelle",
    "symbols.symbol_generator_set": "Netzersatzanlage",
    "symbols.symbol_grid": "Stromnetz",
    "symbols.symbol_heat_detector": "W\xE4rmemelder",
    "symbols.symbol_heat_exchanger_plate": "Plattenw\xE4rmetauscher",
    "symbols.symbol_heat_meter": "W\xE4rmemengenz\xE4hler",
    "symbols.symbol_heat_pump_compact": "W\xE4rmepumpe Kompakt",
    "symbols.symbol_heat_pump_duo": "W\xE4rmepumpe Duo",
    "symbols.symbol_heat_pump_neo": "W\xE4rmepumpe Neo",
    "symbols.symbol_heat_recovery_plate": "Platten-WRG",
    "symbols.symbol_heat_recovery_rotary": "Rotations-WRG",
    "symbols.symbol_heating_coil": "Heizregister",
    "symbols.symbol_humidifier": "Befeuchter",
    "symbols.symbol_humidity_sensor": "Feuchtef\xFChler",
    "symbols.symbol_hybrid_inverter": "Hybrid-Wechselrichter",
    "symbols.symbol_hydraulic_separator": "Hydraulische Weiche",
    "symbols.symbol_ice_storage": "Eisspeicher",
    "symbols.symbol_immersion_heater": "Heizstab",
    "symbols.symbol_inverter": "Wechselrichter",
    "symbols.symbol_isolator_switch": "Lasttrennschalter",
    "symbols.symbol_manifold": "Verteiler / Sammler",
    "symbols.symbol_manual_call_point": "Handfeuermelder",
    "symbols.symbol_meter": "Energiez\xE4hler",
    "symbols.symbol_mixing_valve": "3-Wege-Mischer",
    "symbols.symbol_pressure_reducing_valve": "Druckminderer",
    "symbols.symbol_pressure_sensor": "Drucksensor",
    "symbols.symbol_pump_dhw": "Zirkulationspumpe",
    "symbols.symbol_pump_group": "Pumpengruppe",
    "symbols.symbol_pump_inline": "Pumpe Inline",
    "symbols.symbol_pump_twin": "Doppelpumpe",
    "symbols.symbol_pump_variable": "Pumpe FU",
    "symbols.symbol_pv_array": "PV-Feld",
    "symbols.symbol_radiator": "Heizk\xF6rper",
    "symbols.symbol_rcd": "FI-Schutzschalter",
    "symbols.symbol_room_sensor": "Raumsensor",
    "symbols.symbol_safety_valve": "Sicherheitsventil",
    "symbols.symbol_shutoff_valve": "Absperrventil",
    "symbols.symbol_silencer": "Schalld\xE4mpfer",
    "symbols.symbol_smoke_detector": "Rauchmelder",
    "symbols.symbol_solar_station": "Solarstation",
    "symbols.symbol_sprinkler_head": "Sprinklerkopf",
    "symbols.symbol_sprinkler_valve_station": "Nassalarmventil",
    "symbols.symbol_steam_humidifier": "Dampfluftbefeuchter",
    "symbols.symbol_sub_distribution_board": "Unterverteilung",
    "symbols.symbol_surge_arrester": "\xDCberspannungsableiter",
    "symbols.symbol_switchgear": "Niederspannungsverteilung",
    "symbols.symbol_temp_sensor": "Temperaturf\xFChler",
    "symbols.symbol_transformer": "Transformator",
    "symbols.symbol_underfloor": "Fu\xDFbodenheizung",
    "symbols.symbol_ups": "USV-Anlage",
    "symbols.symbol_vacuum_tube_collector": "Vakuumr\xF6hrenkollektor",
    "symbols.symbol_valve_2way": "2-Wege-Ventil",
    "symbols.symbol_valve_3way": "3-Wege-Ventil",
    "symbols.symbol_vav_box": "VAV-Regler",
    "symbols.symbol_wallbox": "Wallbox",
    "trends.coverage": "Abdeckung {percent} %",
    "trends.coverage_gaps": "Abdeckung {percent} % \xB7 {gaps} {gapWord}",
    "trends.gap_one": "L\xFCcke",
    "trends.gap_other": "L\xFCcken",
    "trends.gap_row": "Keine Daten von {start} bis {end}",
    "trends.instant_column": "Zeitpunkt",
    "trends.no_data": "Keine Daten",
    "trends.report_name": "Berichtsname",
    "trends.report_period": "Zeitraum",
    "trends.report_schedule": "Zeitplan",
    "trends.series_column": "Reihe {index}",
    "trends.span_day23": "Dieser Tag hat 23 Stunden \u2014 die Zeitumstellung f\xE4llt hinein.",
    "trends.span_day25": "Dieser Tag hat 25 Stunden \u2014 die Zeitumstellung f\xE4llt hinein.",
    "trends.span_month": "Dieser Monat hat {hours} Stunden \u2014 die Zeitumstellung f\xE4llt hinein.",
    "trends.table_label": "Messwerttabelle",
    "trends.unreadable": "Nicht lesbar"
  });
  registerCatalog("de", ENTRIES);

  // src/v100/catalog-en.mjs
  var ENTRIES2 = Object.freeze({
    "alarms.acknowledge": "Acknowledge",
    "alarms.alarms_title": "Alarms",
    "alarms.attempts_title": "Delivery attempts",
    "alarms.binding_read_only": "Read-only",
    "alarms.cancel": "Cancel",
    "alarms.comment": "Comment",
    "alarms.confirm": "OK",
    "alarms.delivery_failed": "Delivery failed",
    "alarms.delivery_none": "No notification targets configured; alarms are annunciated here only",
    "alarms.links_title": "Context",
    "alarms.no_alarms": "No active alarms",
    "alarms.preview_ambiguous": "occurs twice on",
    "alarms.preview_ambiguous_tail": "this entry runs once, at",
    "alarms.preview_nonexistent": "does not exist on",
    "alarms.preview_nonexistent_tail": "this entry will not run",
    "alarms.preview_normal": "runs at",
    "alarms.priority_critical": "Critical",
    "alarms.priority_info": "Information",
    "alarms.priority_warning": "Warning",
    "alarms.schedule_kind_instant": "Runs at a time",
    "alarms.schedule_kind_interval": "Operating period",
    "alarms.schedule_preview": "Effective times",
    "alarms.schedule_title": "Schedules",
    "alarms.setting_default": "default",
    "alarms.settings_title": "Alarm settings",
    "alarms.shelve": "Shelve",
    "alarms.shelve_minutes": "Suppress for how many minutes?",
    "alarms.shelve_too_long": "Longer than this site allows",
    "alarms.state_acknowledged": "acknowledged",
    "alarms.state_active": "active",
    "alarms.state_indeterminate": "state unknown",
    "alarms.state_returned": "returned",
    "alarms.state_suppressed": "suppressed",
    "alarms.suppressed_acknowledged": "acknowledged",
    "alarms.suppressed_by": "by",
    "alarms.suppressed_maintenance": "in maintenance",
    "alarms.suppressed_shelved": "shelved",
    "alarms.suppressed_until": "until",
    "assets.attachment_limits": "At most {count} attachments, each up to {megabytes} MB.",
    "assets.column_declared_in": "Declared in",
    "assets.column_diagnosis": "Diagnosis",
    "assets.column_evidence": "Evidence",
    "assets.column_note": "Note",
    "assets.column_provenance": "Provenance",
    "assets.column_reference": "Reference",
    "assets.column_slot": "Slot",
    "assets.column_tick": "Tick",
    "assets.column_value": "Value",
    "assets.diagnosis_duplicate_binding": "duplicate binding",
    "assets.diagnosis_missing": "missing",
    "assets.diagnosis_present": "present",
    "assets.diagnosis_registered_not_loaded": "registered but not loaded",
    "assets.diagnosis_service_missing": "service missing",
    "assets.diagnosis_stale": "stale",
    "assets.diagnosis_unregistered": "no registry entry",
    "assets.diagnosis_wrong_device_class": "wrong device class",
    "assets.diagnosis_wrong_unit": "wrong unit",
    "assets.field_asset": "Asset",
    "assets.field_note": "Note",
    "assets.field_reason": "Reason",
    "assets.field_title": "Task",
    "assets.measured": "measured",
    "assets.no_entries": "No entries.",
    "assets.read_only": "This view changes nothing. Every remediation is a link, not an action.",
    "assets.refused_simulating": "Not performed: a simulation is running.",
    "assets.refused_unknown": "Not performed: the simulation state could not be determined. Please try again.",
    "assets.session_active": "Simulation active \u2014 started by {who}, ends {until}. The plant is not being operated.",
    "assets.session_expired": "The simulation has expired. The plant is being operated again.",
    "assets.simulated": "simulated",
    "assets.simulated_shape": "\u25C8",
    "catalog.catalog_title": "Symbol catalog",
    "catalog.direction_bidirectional": "Both ways",
    "catalog.direction_in": "Inlet",
    "catalog.direction_out": "Outlet",
    "catalog.filter_all": "All",
    "catalog.filter_category": "Category",
    "catalog.filter_domain": "Domain",
    "catalog.filter_style": "Style",
    "catalog.filter_text": "Search",
    "catalog.kind_power": "Power",
    "catalog.kind_process": "Process",
    "catalog.kind_signal": "Signal",
    "catalog.multiplicity_full": "At its limit",
    "catalog.multiplicity_many": "Many connections",
    "catalog.multiplicity_one": "One connection",
    "catalog.no_matches": "No symbol matches these filters",
    "catalog.port_direction": "Direction",
    "catalog.port_kind": "Kind",
    "catalog.port_medium": "Medium",
    "catalog.port_multiplicity": "Connections",
    "catalog.port_side": "Side",
    "catalog.published_variants": "published variants",
    "catalog.refusal_direction_conflict": "The directions conflict: both ports point the same way.",
    "catalog.refusal_duplicate_connection": "These two ports are already connected.",
    "catalog.refusal_kind_mismatch": "The kinds differ: a process port cannot join a signal or power port.",
    "catalog.refusal_medium_mismatch": "The media differ: these two ports carry different things.",
    "catalog.refusal_multiplicity_exceeded": "That port already has the one connection it admits.",
    "catalog.refusal_self_connection": "A port cannot be connected to itself.",
    "catalog.refusal_title": "This connection is not possible",
    "catalog.refusal_unknown": "The connection was refused.",
    "contract.dangling_reference": "A reference to {id} in {collection} points at nothing",
    "contract.depth": "Nesting too deep: {actual}, at most {limit}",
    "contract.duplicate_id": "The id {id} appears more than once in {collection}",
    "contract.error_limit": "{actual} findings; only the first {limit} are shown",
    "contract.id_length": "Id too long: {actual} characters, at most {limit}",
    "contract.json_bytes": "Project too large: {actual} bytes, at most {limit}",
    "contract.nodes": "Too many elements: {actual}, at most {limit}",
    "contract.path_length": "Path too long: {actual} characters, at most {limit}",
    "contract.required": "Required field missing: {property}",
    "contract.schema_version": "Schema version {actual} is not supported. Allowed: {allowed}",
    "contract.string_bytes": "Text too long: {actual} bytes, at most {limit}",
    "contract.type": "Wrong data type \u2014 {expected} expected",
    "contract.type_keyword": "The value breaks the {keyword} rule",
    "contract.unknown": "Unknown finding: {code}",
    "designer.add": "Add object",
    "designer.align": "Align",
    "designer.canvas_label": "Designer canvas",
    "designer.confirm_delete": "Delete the selected objects?",
    "designer.confirm_remove_pack": "Remove this extension pack?",
    "designer.conflict": "Conflict",
    "designer.connect": "Connect ports",
    "designer.connect_choose_source": "Choose the source port",
    "designer.connect_choose_target": "Choose the target port",
    "designer.connect_refused": "Connection refused",
    "designer.contributes": "Contributes",
    "designer.delete": "Delete",
    "designer.disconnect": "Disconnect",
    "designer.distribute": "Distribute",
    "designer.extend_selection": "Extend selection",
    "designer.extensions": "Installed extensions",
    "designer.group": "Group",
    "designer.instantiate_master": "Place master instance",
    "designer.keyboard_help": "Keyboard",
    "designer.layer_hidden": "Hidden",
    "designer.layer_locked": "Locked",
    "designer.layer_unlocked": "Unlocked",
    "designer.layer_visible": "Visible",
    "designer.layers": "Layers",
    "designer.minimap_label": "Diagram overview",
    "designer.no_extensions": "No extension packs are installed",
    "designer.nothing_selected": "Nothing selected",
    "designer.nudge_coarse": "Nudge, coarse",
    "designer.nudge_fine": "Nudge",
    "designer.objects": "objects",
    "designer.ready": "Ready",
    "designer.redo": "Redo",
    "designer.reorder": "Bring forward",
    "designer.resize": "Resize",
    "designer.select": "Select",
    "designer.supports": "Supports project schema",
    "designer.undo": "Undo",
    "designer.undo_depth": "Undo steps kept",
    "designer.ungroup": "Ungroup",
    "designer.viewport": "Current view",
    "equipment.command_failed": "Command failed",
    "equipment.command_pending": "Command pending",
    "equipment.communication_error": "Communication error",
    "equipment.fault": "Fault",
    "equipment.interlock": "Interlocked",
    "equipment.invalid": "Invalid value",
    "equipment.local": "Local control",
    "equipment.locked": "Locked",
    "equipment.maintenance": "Maintenance",
    "equipment.manual": "Manual",
    "equipment.off": "Off",
    "equipment.running": "Running",
    "equipment.stale": "Value not current",
    "equipment.standby": "Standby",
    "equipment.unknown": "Unknown",
    "equipment.warning": "Warning",
    "legacy.ack_via_alarm_list": "Acknowledgement happens through the alarm list.",
    "legacy.alarm_state_unavailable": "Alarm state is currently unavailable.",
    "legacy.auto_connect": "Connect automatically",
    "legacy.auto_mapping": "Auto mapping",
    "legacy.button_energy": "\u26A1 Energy",
    "legacy.button_reports": "\u25A4 Reports",
    "legacy.button_z_lower": "Send backward",
    "legacy.button_z_raise": "Bring forward",
    "legacy.category_air": "Air handling / ventilation",
    "legacy.category_building": "Building",
    "legacy.category_cooling": "Cooling",
    "legacy.command_failed": "Command failed",
    "legacy.command_running": "Command running",
    "legacy.confirm_delete_project": "Really delete this project?",
    "legacy.controls_via_server": "Operation runs through the object controls the server assembles.",
    "legacy.custom_image_optional": "Custom image / SVG (optional)",
    "legacy.download_yaml": "Download YAML",
    "legacy.entities_export": "Export entities from Home Assistant",
    "legacy.entities_hint": "Without a Home Assistant connection: export in HA, import here \u2014 entity fields then offer suggestions.",
    "legacy.entities_import": "Import entities (.json)",
    "legacy.entities_imported": "Imported entities",
    "legacy.entities_invalid": "File unreadable \u2014 expected shape: glt-flow-card-entities JSON.",
    "legacy.entities_offline": "No Home Assistant connected \u2014 the import uses the stored list.",
    "legacy.entities_rejected": "rejected",
    "legacy.entity": "Entity",
    "legacy.entity_missing": "Entity missing",
    "legacy.fault": "Fault",
    "legacy.fit_view": "Fit view",
    "legacy.fullscreen": "Fullscreen",
    "legacy.height": "Height",
    "legacy.loading_entities": "Loading Home Assistant entities",
    "legacy.lock_released": "Lock released.",
    "legacy.lovelace_yaml": "Lovelace YAML",
    "legacy.main_entity": "Main entity",
    "legacy.medium_air_exhaust": "Exhaust air",
    "legacy.medium_air_extract": "Extract air",
    "legacy.medium_air_outdoor": "Outdoor air",
    "legacy.medium_air_supply": "Supply air",
    "legacy.medium_cold_water": "Cold water",
    "legacy.medium_cooling_return": "Chilled water return",
    "legacy.medium_cooling_supply": "Chilled water",
    "legacy.medium_dhw": "Hot water",
    "legacy.medium_electrical": "Electrical",
    "legacy.medium_heating_return": "Return",
    "legacy.medium_heating_supply": "Flow",
    "legacy.medium_neutral": "Medium",
    "legacy.medium_source": "Source",
    "legacy.meter": "Meter",
    "legacy.migration_workflow": "Migration workflow",
    "legacy.nav_alarms": "Alarms",
    "legacy.nav_automap": "Auto mapping",
    "legacy.nav_cad": "CAD",
    "legacy.nav_diagnostics": "Diagnostics",
    "legacy.nav_energy": "Energy",
    "legacy.nav_entities": "Entities",
    "legacy.nav_maintenance": "Maintenance",
    "legacy.nav_operations": "Operations",
    "legacy.nav_project": "Project v1",
    "legacy.nav_schedule": "Schedules",
    "legacy.nav_semantics": "Semantics",
    "legacy.nav_simulation": "Simulation",
    "legacy.nav_symbols": "Symbols 300+",
    "legacy.nav_templates": "Templates",
    "legacy.nav_trends": "Trends",
    "legacy.new_project_name": "Name for the new project",
    "legacy.no_date": "No date",
    "legacy.no_energy_meters": "No energy meters configured.",
    "legacy.no_fault": "No fault",
    "legacy.no_work_orders": "No work orders.",
    "legacy.open_detail": "Open detail view",
    "legacy.paste_compare_json": "Paste the comparison configuration as JSON",
    "legacy.perform_maintenance": "Perform maintenance",
    "legacy.project_locked": "Project locked.",
    "legacy.prompt_group_name": "Group name",
    "legacy.prompt_layer_name": "Layer name",
    "legacy.prompt_period": "Period: day / week / month / year",
    "legacy.prompt_project_name": "Project name",
    "legacy.prompt_report_name": "Report name",
    "legacy.prompt_task": "Task",
    "legacy.prompt_template_name": "Template name",
    "legacy.redo": "Redo",
    "legacy.report_designer": "Report designer",
    "legacy.report_format_hint": "Report: 'csv' for CSV or 'pdf' for print/PDF",
    "legacy.running": "Running",
    "legacy.save_as": "Save as",
    "legacy.schedule_hint": "Automatic (e.g. 1 07:00) or empty",
    "legacy.search_component": "Search component or symbol\u2026",
    "legacy.select_equipment_first": "Select a plant object first.",
    "legacy.select_something_first": "Select a component, data point, path or KPI first.",
    "legacy.select_two_first": "Select at least two elements with Ctrl/Shift.",
    "legacy.simulated_value": "Simulated value",
    "legacy.sponsor": "Sponsor",
    "legacy.sponsor_free": "Everything is free \u2014 sponsoring is voluntary.",
    "legacy.sponsor_hint": "everything is free \xB7 \u2665 sponsoring is voluntary",
    "legacy.state_entity": "State entity",
    "legacy.style_clean_light": "Clean / Modern Light",
    "legacy.subplant_saved": "Sub-plant saved as a template.",
    "legacy.subtitle": "Building management \xB7 live plant view",
    "legacy.suppress_minutes": "Suppress for how many minutes?",
    "legacy.symbol_ahu": "Air handling unit",
    "legacy.symbol_air_filter": "Air filter",
    "legacy.symbol_balancing_valve": "Balancing valve",
    "legacy.symbol_battery": "Battery storage",
    "legacy.symbol_boiler": "Boiler",
    "legacy.symbol_buffer_layered": "Stratified buffer tank",
    "legacy.symbol_buffer_vertical": "Buffer tank \xB7 Vertical",
    "legacy.symbol_check_valve": "Check valve",
    "legacy.symbol_chiller": "Chiller",
    "legacy.symbol_co2_sensor": "CO\u2082 sensor",
    "legacy.symbol_cooling_buffer": "Chilled water buffer",
    "legacy.symbol_cooling_coil": "Cooling coil",
    "legacy.symbol_cooling_tower": "Cooling tower",
    "legacy.symbol_custom_image": "Custom symbol / image",
    "legacy.symbol_damper": "Damper",
    "legacy.symbol_dhw_tank": "Domestic hot water tank",
    "legacy.symbol_expansion_vessel": "Expansion vessel",
    "legacy.symbol_fan_extract": "Extract air fan",
    "legacy.symbol_fan_supply": "Supply air fan",
    "legacy.symbol_fancoil": "Fan coil unit",
    "legacy.symbol_fancoil_cooling": "Fan coil",
    "legacy.symbol_filter_water": "Strainer",
    "legacy.symbol_flow_sensor": "Flow",
    "legacy.symbol_generic_machine": "Generic plant item",
    "legacy.symbol_grid": "Grid",
    "legacy.symbol_heat_exchanger_plate": "Plate heat exchanger",
    "legacy.symbol_heat_pump_compact": "Heat pump \xB7 Compact",
    "legacy.symbol_heat_pump_neo": "Heat pump \xB7 Neo",
    "legacy.symbol_heating_circuit": "Heating circuit",
    "legacy.symbol_heating_coil": "Heating coil",
    "legacy.symbol_humidifier": "Humidifier",
    "legacy.symbol_humidity_sensor": "Humidity sensor",
    "legacy.symbol_hydraulic_separator": "Hydraulic separator",
    "legacy.symbol_immersion_heater": "Immersion heater",
    "legacy.symbol_manifold": "Manifold",
    "legacy.symbol_meter": "Energy meter",
    "legacy.symbol_mixing_valve": "Mixing valve",
    "legacy.symbol_pressure_sensor": "Pressure sensor",
    "legacy.symbol_pump_circulation": "Circulator pump",
    "legacy.symbol_pump_dhw": "Hot water circulation pump",
    "legacy.symbol_pump_inline": "Pump \xB7 Inline",
    "legacy.symbol_pv_array": "PV array",
    "legacy.symbol_radiator": "Radiator",
    "legacy.symbol_room_air": "Room / zone",
    "legacy.symbol_room_sensor": "Room sensor",
    "legacy.symbol_solar_thermal": "Solar thermal",
    "legacy.symbol_source_ground": "Ground loop / source",
    "legacy.symbol_temp_sensor": "Temperature sensor",
    "legacy.symbol_underfloor": "Underfloor heating",
    "legacy.symbol_valve_2way": "Two-way valve",
    "legacy.symbol_valve_3way": "Three-way valve",
    "legacy.symbol_wallbox": "Wallbox",
    "legacy.templates_factory": "Factory templates",
    "legacy.templates_hint": "Loading replaces the current configuration \u2014 undo is available. Entities stay empty and are assigned afterwards.",
    "legacy.templates_load": "Load",
    "legacy.templates_none": "No own templates saved yet.",
    "legacy.templates_own": "Your templates",
    "legacy.undo": "Undo",
    "legacy.value1_entity": "Value 1 entity",
    "legacy.value1_label": "Value 1 label",
    "legacy.value2_entity": "Value 2 entity",
    "legacy.value2_label": "Value 2 label",
    "legacy.value_invalid": "Value invalid",
    "legacy.value_stale": "Value stale",
    "legacy.x_in_view": "X in view",
    "legacy.y_in_view": "Y in view",
    "legacy.zoom_in": "Zoom in",
    "legacy.zoom_out": "Zoom out",
    "operations.affordance_audit": "Open trusted audit",
    "operations.affordance_cancel": "Cancel",
    "operations.affordance_dismiss": "Dismiss",
    "operations.affordance_state": "Show current state",
    "operations.history_unavailable": "Trends are not available yet",
    "operations.last_updated": "Last updated",
    "operations.no_alarms": "No alarms",
    "operations.no_controls_available": "No controls available to you",
    "operations.no_values_declared": "No values declared",
    "operations.outcome_accepted": "Accepted \u2014 awaiting dispatch",
    "operations.outcome_cancelled": "Cancelled \u2014 not sent",
    "operations.outcome_confirmed": "Confirmed",
    "operations.outcome_denied": "Not permitted",
    "operations.outcome_dispatched": "Sent \u2014 awaiting confirmation",
    "operations.outcome_failed_after_dispatch": "Failed after dispatch \u2014 effect unknown",
    "operations.outcome_failed_before_dispatch": "Failed \u2014 not sent",
    "operations.outcome_result_unknown": "Effect unknown",
    "operations.outcome_timed_out": "No confirmation \u2014 effect unknown",
    "operations.status_live": "Live",
    "operations.status_resyncing": "Reloading",
    "operations.status_stale": "Not live \u2014 showing last known values",
    "operations.status_unavailable": "Unavailable",
    "operations.view_not_available": "This view is not available.",
    "period.change": "Consumption",
    "period.circular_mean_required": "This quantity is a direction \u2014 an arithmetic mean would be wrong.",
    "period.custom": "Custom range",
    "period.day": "Day",
    "period.entities_exceed_limit": "The query names more entities than the site permits.",
    "period.incompatible_unit": "The unit and the price do not match \u2014 they cannot be combined.",
    "period.max": "Maximum",
    "period.mean": "Mean",
    "period.min": "Minimum",
    "period.month": "Month",
    "period.none": "Every sample",
    "period.outside_statistic_coverage": "This period lies before the first recorded value.",
    "period.raw": "from raw values",
    "period.state": "Meter reading",
    "period.statistics": "from long-term statistics",
    "period.unavailable": "unavailable",
    "period.undeclared_meter_model": "This meter does not declare whether it counts or measures.",
    "period.unknown_aggregate": "That aggregate is not known.",
    "period.unknown_period": "That period is not known.",
    "period.unknown_source": "That source is not known.",
    "period.week": "Week",
    "period.window_exceeds_limit": "The window is longer than raw values permit.",
    "period.year": "Year",
    "replay.before_first_sample": "Before the first recorded value",
    "replay.no_recorded_history": "No history recorded",
    "replay.outside_loaded_window": "Outside the loaded window",
    "safety.access_denied": "The access change was refused. Nothing changed.",
    "safety.access_empty": "No member holds a role on this project yet.",
    "safety.access_heading": "Project access",
    "safety.access_loading": "Loading project access",
    "safety.access_revision": "Access revision",
    "safety.access_saved": "Access change applied",
    "safety.acquire_lease": "Acquire editing lease",
    "safety.action_column": "Action",
    "safety.add_member": "Add member",
    "safety.announcements_authority_current": "Server authority refreshed.",
    "safety.announcements_evidence_page_failed": "The next evidence page could not be loaded.",
    "safety.announcements_lease_acquired": "Editing lease acquired by this session.",
    "safety.announcements_lease_held": "Another session is editing.",
    "safety.announcements_lease_released": "Editing lease released.",
    "safety.announcements_lease_renewed": "Editing lease renewed.",
    "safety.apply_access_change": "Apply access change",
    "safety.apply_failure": "Project changes were not applied. Nothing was changed. Review the diagnostic and run a fresh dry run.",
    "safety.apply_selected": "Apply selected changes",
    "safety.apply_success": "Project changes applied",
    "safety.apply_success_body": "Revision {revision} was validated and verified after applying {count} changes. Verified backup {backup_id} remains available.",
    "safety.applying": "Applying {count} project changes",
    "safety.artifact_equality": "Artifact equality",
    "safety.asset_metadata": "Opaque asset metadata",
    "safety.assigned": "Assigned",
    "safety.assignment_column": "Assignment",
    "safety.audit_actor": "Actor",
    "safety.audit_at": "Server time",
    "safety.audit_correlation": "Correlation ID",
    "safety.audit_event": "Event",
    "safety.audit_result": "Result",
    "safety.authority_bar": "Authority state",
    "safety.back_to_overview": "Back to overview",
    "safety.bundle_empty": "No bundle inspected. Project asset metadata is listed without rendering asset content.",
    "safety.bundle_safety": "Bundle safety",
    "safety.byte_identical": "Byte-identical",
    "safety.cancel_access_change": "Cancel access change",
    "safety.cancel_apply": "Cancel project changes",
    "safety.cancel_discard": "Keep my changes",
    "safety.candidate_heading": "Unsaved candidate",
    "safety.candidate_states_applied": "Applied",
    "safety.candidate_states_dirty": "Unsaved changes in this session",
    "safety.candidate_states_none": "No unsaved changes",
    "safety.candidate_states_preserved": "Unsaved changes kept in memory",
    "safety.capabilities_column": "Effective capabilities",
    "safety.capability_codes": "Show capability codes",
    "safety.categories_add": "Added",
    "safety.categories_binding": "Binding",
    "safety.categories_config": "Configuration",
    "safety.categories_move": "Moved",
    "safety.categories_remove": "Removed",
    "safety.check_lease": "Check lease availability",
    "safety.checksum": "SHA-256",
    "safety.choose_user": "Choose an eligible user",
    "safety.client_telemetry": "Client telemetry (untrusted)",
    "safety.close": "Close Project safety",
    "safety.collaboration": "Collaboration",
    "safety.companion": "Companion",
    "safety.companion_states_current": "Authority current",
    "safety.companion_states_incompatible": "Policy version unsupported",
    "safety.companion_states_refreshing": "Refreshing authority",
    "safety.companion_states_stale": "Authority stale",
    "safety.companion_states_unavailable": "Companion unavailable",
    "safety.confirm_access_body": "Change {member} to {role} at access revision {revision}? The change is applied atomically and recorded in the trusted audit.",
    "safety.confirm_access_heading": "Confirm access change",
    "safety.confirm_apply_body": "Apply {count} validated changes to \u201C{project}\u201D at revision {revision}? A verified backup will be created first. This changes project data only and sends no plant command.",
    "safety.confirm_apply_heading": "Confirm project changes",
    "safety.confirm_remove_body": "Remove all access for {member} at access revision {revision}? They keep no role on this project.",
    "safety.conflict_body": "Revision {base} is no longer current; revision {current} is active. Your candidate is kept in memory. Nothing was overwritten.",
    "safety.conflict_choices_discard": "Discard my changes",
    "safety.conflict_choices_merge_preview": "Preview a merge",
    "safety.conflict_choices_refresh": "Refresh from the server",
    "safety.conflict_choices_retry_with_fresh_lease": "Retry with a fresh lease",
    "safety.conflict_heading": "Save blocked \u2014 a newer revision exists",
    "safety.connected": "Connected",
    "safety.contract_unknown": "Unknown finding: {code}",
    "safety.control_cancel": "Cancel control",
    "safety.control_confirm_body": "Run \u201C{label}\u201D? The Companion resolves the effect from the current project head; this card sends only the control name and the declared input.",
    "safety.control_confirm_heading": "Confirm configured control",
    "safety.control_correlation": "Correlation ID",
    "safety.control_effect": "Resolved effect",
    "safety.control_heading": "Configured control",
    "safety.control_no_retry": "This card never repeats a control by itself. Decide again if the plant must move.",
    "safety.control_policy": "Control policy",
    "safety.control_preview": "Preview control",
    "safety.control_run": "Run control",
    "safety.control_states_accepted": "Accepted and recorded. Not yet dispatched.",
    "safety.control_states_cancelled_before_dispatch": "Cancelled. Nothing was sent.",
    "safety.control_states_denied": "Denied.",
    "safety.control_states_dispatched": "Dispatched to Home Assistant. Not yet confirmed.",
    "safety.control_states_failed_after_dispatch": "Failed after dispatch. The effect is unknown \u2014 check the current state and the trusted audit.",
    "safety.control_states_failed_before_dispatch": "Failed before dispatch. Nothing was sent.",
    "safety.control_states_readback_confirmed": "Confirmed by readback.",
    "safety.control_states_result_unknown": "The result is unknown \u2014 check the current state and the trusted audit before acting again.",
    "safety.control_states_timed_out": "Timed out. The effect is unknown \u2014 check the current state and the trusted audit.",
    "safety.control_target": "Target",
    "safety.controls_visible": "{count} controls visible to you",
    "safety.current_revision": "Revision",
    "safety.discard_body": "Discard the unsaved changes in this session? They cannot be recovered afterwards.",
    "safety.discard_heading": "Discard unsaved changes",
    "safety.dry_run": "Run dry run",
    "safety.dry_run_fresh": "Run fresh dry run",
    "safety.editing": "Editing",
    "safety.eligible_user": "Eligible user",
    "safety.error_codes_authority_stale": "Server authority is stale. Refresh and try again.",
    "safety.error_codes_capability_denied": "Your role does not permit this action.",
    "safety.error_codes_effect_unknown": "The result is unknown. Check the trusted audit before retrying.",
    "safety.error_codes_feature_unavailable": "This feature is not available in this version.",
    "safety.error_codes_invalid_input": "The request was rejected as invalid. Nothing changed.",
    "safety.error_codes_lease_expired": "The editing lease expired.",
    "safety.error_codes_lease_held": "Another session is editing.",
    "safety.error_codes_lease_required": "An editing lease is required.",
    "safety.error_codes_not_found_or_denied": "This project is not available to you.",
    "safety.error_codes_not_loaded": "The Companion is not loaded.",
    "safety.error_codes_rate_limited": "Too many requests. Wait and try again.",
    "safety.error_codes_revision_conflict": "A newer revision exists. Your candidate is kept.",
    "safety.errors": "Validation issues",
    "safety.exact_card_version": "Exact card version",
    "safety.expected_revision": "Expected",
    "safety.export_telemetry": "Export client telemetry",
    "safety.export_trusted": "Export trusted audit",
    "safety.finding": "Finding",
    "safety.ignored_noise": "Ignored ordering noise",
    "safety.impact": "Impact",
    "safety.inspect_bundle": "Inspect .gltproject bundle",
    "safety.last_refresh": "Last refresh",
    "safety.lease_acquiring": "Requesting exclusive editing lease",
    "safety.lease_expires_in": "Expires in {seconds}s",
    "safety.lease_heading": "Engineering lease",
    "safety.lease_renew_due": "Renewal is due. Renew before the lease expires.",
    "safety.lease_states_available": "Lease available",
    "safety.lease_states_expired": "Lease expired",
    "safety.lease_states_held_other": "Another session is editing",
    "safety.lease_states_held_self": "This session",
    "safety.lease_states_lost": "Lease lost",
    "safety.lease_states_read_only": "Read-only",
    "safety.lease_states_renewing": "Renewing",
    "safety.load_next": "Load next 50 events",
    "safety.manage_access": "Manage project access",
    "safety.media_type": "Media type",
    "safety.member_column": "Member",
    "safety.merge_states_applied": "Merge applied",
    "safety.merge_states_blocked": "The same paths changed on both sides. Choose a different recovery.",
    "safety.merge_states_failed": "The merge preview failed. Your candidate is unchanged.",
    "safety.merge_states_idle": "No merge preview requested.",
    "safety.merge_states_ready": "Merge preview ready. Select the changes to keep.",
    "safety.merge_states_requested": "Requesting merge preview",
    "safety.migration_workflow": "Migration workflow",
    "safety.mode_local": "Local-only project",
    "safety.mode_shared": "Shared project",
    "safety.my_access": "My access",
    "safety.my_role": "My role",
    "safety.never": "Never",
    "safety.no_capabilities": "No capabilities on this project.",
    "safety.no_evidence": "Release evidence is incomplete. Missing or stale gates are listed below.",
    "safety.not_evidence": "Not security or control evidence",
    "safety.not_run": "Not run",
    "safety.overview": "Project safety overview",
    "safety.path": "Path",
    "safety.policy_version": "Policy version",
    "safety.preview_failed": "Migration preview failed. The original project is unchanged. Run a fresh dry run after reviewing the diagnostic.",
    "safety.preview_ready": "Migration preview ready",
    "safety.project": "Project",
    "safety.raw_contract": "Raw contract",
    "safety.read_only": "Read-only",
    "safety.read_only_reasons_authority_absent": "No server authority yet. Shared editing stays read-only until the Companion answers.",
    "safety.read_only_reasons_authority_incompatible": "The Companion uses a policy version this card does not support.",
    "safety.read_only_reasons_authority_loading": "Refreshing server authority. Shared editing is read-only until it returns.",
    "safety.read_only_reasons_authority_rejected": "The Companion refused the authority refresh. Shared editing is read-only.",
    "safety.read_only_reasons_authority_sequence_gap": "An authority update was missed. Refresh before editing.",
    "safety.read_only_reasons_authority_stale": "Server authority is stale. Refresh before editing.",
    "safety.read_only_reasons_companion_disconnected": "The Companion is unavailable. Shared editing is read-only.",
    "safety.read_only_reasons_lease_expired": "The editing lease expired. Your unsaved candidate is kept.",
    "safety.read_only_reasons_lease_lost": "The editing lease was lost. Your unsaved candidate is kept.",
    "safety.read_only_reasons_lease_required": "Acquire the editing lease to make changes.",
    "safety.read_only_reasons_role_missing": "You have no role on this project.",
    "safety.read_only_reasons_role_revoked": "Your role for this project changed. Shared editing is read-only.",
    "safety.release_evidence": "Release evidence",
    "safety.release_lease": "Release editing lease",
    "safety.remove_access": "Remove access",
    "safety.renew_lease": "Renew editing lease",
    "safety.required_dependency": "Required dependency",
    "safety.restore": "Restore verified backup",
    "safety.restore_awaiting": "Enter \u201C{project}\u201D to enable Restore verified backup.",
    "safety.restore_body": "Restore verified backup {backup_id} for \u201C{project}\u201D? The current revision {revision} will be replaced. A new evidence receipt will be created. This changes project data only and sends no plant command.",
    "safety.restore_label": "Enter the project name to confirm",
    "safety.restore_mismatch": "The project name does not match. The project remains unchanged.",
    "safety.restore_ready": "Project name confirmed. Review the revision and backup before continuing.",
    "safety.revision": "Revision",
    "safety.revision_conflict": "Revision {expected} is no longer current; revision {actual} is active. Reload and compare again.",
    "safety.revision_triplet": "Base {base} \xB7 Current {current} \xB7 Candidate {candidate}",
    "safety.role_column": "Role",
    "safety.role_matrix": "Role capability matrix",
    "safety.role_matrix_unavailable": "The Companion did not return a capability matrix for this role.",
    "safety.role_names_admin": "Admin",
    "safety.role_names_engineer": "Engineer",
    "safety.role_names_none": "No assignment",
    "safety.role_names_operator": "Operator",
    "safety.role_names_viewer": "Viewer",
    "safety.rollback_failure": "Backup restore verification failed. Both snapshots were retained. Download the rollback diagnostic and request administrator recovery.",
    "safety.rollback_running": "Restoring verified backup",
    "safety.rollback_success": "Verified backup restored",
    "safety.rollback_success_body": "Project revision {revision} matches verified backup {backup_id}. A rollback evidence receipt was created.",
    "safety.rows_stale": "The next page could not be loaded. The events shown are no longer current.",
    "safety.schema": "Schema",
    "safety.scope": "Project data only \u2014 no Home Assistant service or plant command is executed.",
    "safety.server_authored": "Server-authored",
    "safety.server_normalization": "Server normalization active",
    "safety.shared_authority": "Shared authority",
    "safety.size": "Size",
    "safety.standalone": "Companion unavailable \u2014 shared project operations are read-only.",
    "safety.tabs_0": "Overview",
    "safety.tabs_1": "Validate",
    "safety.tabs_2": "Migrate & compare",
    "safety.tabs_3": "Bundles",
    "safety.tabs_4": "Evidence",
    "safety.telemetry_category": "Category",
    "safety.telemetry_empty": "No client telemetry has been recorded in this session.",
    "safety.telemetry_payload": "Payload summary",
    "safety.telemetry_received": "Received",
    "safety.title": "Project safety",
    "safety.trusted_audit": "Trusted audit",
    "safety.trusted_empty": "No trusted audit event is visible to you yet.",
    "safety.unchanged": "Original project unchanged",
    "safety.validate": "Validate project",
    "safety.validation_failed": "Project validation failed",
    "safety.validation_idle": "Choose Validate project to inspect the raw project without changing it.",
    "safety.validation_invalid": "The project is invalid. Review the listed paths; the original remains unchanged.",
    "safety.validation_running": "Validating raw project",
    "safety.validation_success": "Project validation complete",
    "safety.validation_valid": "No validation issues found. The raw project matches schema {version}.",
    "safety.workflow_0": "Inspect",
    "safety.workflow_1": "Preview",
    "safety.workflow_2": "Backup",
    "safety.workflow_3": "Apply",
    "safety.workflow_4": "Verify",
    "sites.age": "read {seconds} s ago",
    "sites.completeness": "{answered} of {total} sites answered",
    "sites.effect_unknown": "Effect unknown \u2014 the command may have run. Check the plant state before sending anything again.",
    "sites.missing_sites": "Missing sites:",
    "sites.no_value": "no reading",
    "sites.shape_circuit_open": "\u2715",
    "sites.shape_healthy": "\u25CF",
    "sites.shape_slow": "\u25D0",
    "sites.shape_unreachable": "\u25CB",
    "sites.site_circuit_open": "suspended after repeated failures",
    "sites.site_healthy": "reachable",
    "sites.site_slow": "slow",
    "sites.site_unreachable": "unreachable",
    "sites.unverified_tls": "unverified: this site's certificate is not checked",
    "symbols.category_allgemein": "General",
    "symbols.category_brandschutz": "Fire safety",
    "symbols.category_elektro": "Electrical",
    "symbols.category_energie": "Energy",
    "symbols.category_gebaude": "Building",
    "symbols.category_heizung": "Heating",
    "symbols.category_hydraulik": "Hydronics",
    "symbols.category_kalte": "Cooling",
    "symbols.category_rlt": "Air handling",
    "symbols.category_sensorik": "Sensors",
    "symbols.control_enable": "Enable",
    "symbols.control_mode": "Operating mode",
    "symbols.control_open_close": "Open/close",
    "symbols.control_position": "Position",
    "symbols.control_run": "On/off",
    "symbols.control_setpoint": "Setpoint",
    "symbols.control_speed": "Speed",
    "symbols.label": "Heating",
    "symbols.label_brandschutz": "Fire safety",
    "symbols.label_elektro": "Electrical",
    "symbols.label_energie": "Energy",
    "symbols.label_hydraulik": "Hydraulics",
    "symbols.label_k_lte": "Refrigeration",
    "symbols.label_rlt": "Air handling",
    "symbols.label_sensorik": "Instrumentation",
    "symbols.profile_ahu": "Air handling unit",
    "symbols.profile_boiler": "Boiler",
    "symbols.profile_chiller": "Chiller",
    "symbols.profile_damper": "Damper",
    "symbols.profile_dhw_tank": "Domestic hot water tank",
    "symbols.profile_fan": "Fan",
    "symbols.profile_generic": "Generic equipment",
    "symbols.profile_heat_exchanger": "Heat exchanger",
    "symbols.profile_heat_pump": "Heat pump",
    "symbols.profile_meter": "Meter",
    "symbols.profile_mixing_valve": "Three-way mixing valve",
    "symbols.profile_pump": "Pump",
    "symbols.profile_room": "Room / zone",
    "symbols.profile_tank": "Tank",
    "symbols.profile_valve": "Valve",
    "symbols.slot_actual": "Actual flow",
    "symbols.slot_bottom_temp": "Bottom",
    "symbols.slot_co2": "CO\u2082",
    "symbols.slot_cop": "COP",
    "symbols.slot_extract_flow": "Extract air flow",
    "symbols.slot_extract_temp": "Extract",
    "symbols.slot_feedback": "Feedback",
    "symbols.slot_flow": "Air flow",
    "symbols.slot_flow_temp": "Flow",
    "symbols.slot_hours": "Operating hours",
    "symbols.slot_humidity": "Humidity",
    "symbols.slot_middle_temp": "Middle",
    "symbols.slot_operating_hours": "Operating hours",
    "symbols.slot_position": "Position",
    "symbols.slot_power": "Power",
    "symbols.slot_pressure": "Pressure",
    "symbols.slot_primary_in_temp": "Primary in",
    "symbols.slot_primary_out_temp": "Primary out",
    "symbols.slot_return_temp": "Return",
    "symbols.slot_secondary_in_temp": "Secondary in",
    "symbols.slot_secondary_out_temp": "Secondary out",
    "symbols.slot_setpoint": "Setpoint",
    "symbols.slot_speed": "Speed",
    "symbols.slot_starts": "Starts",
    "symbols.slot_supply_flow": "Supply air flow",
    "symbols.slot_supply_temp": "Supply",
    "symbols.slot_temperature": "Room temperature",
    "symbols.slot_top_temp": "Top",
    "symbols.slot_value": "Value",
    "symbols.style_classic_scada": "Classic SCADA",
    "symbols.style_clean": "Clean",
    "symbols.style_neo2030": "Neo 2030",
    "symbols.style_operations_light": "Operations Light",
    "symbols.style_pid_dark": "P&ID Dark",
    "symbols.style_standard_2d": "Standard 2D",
    "symbols.group_waermepumpen": "Heat pumps",
    "symbols.group_kessel_erzeuger": "Boilers & generators",
    "symbols.group_puffer_speicher": "Buffer storage",
    "symbols.group_heizflaechen": "Heat emitters",
    "symbols.group_solar": "Solar",
    "symbols.group_stationen": "Stations",
    "symbols.group_pumpen": "Pumps",
    "symbols.group_ventile": "Valves",
    "symbols.group_waermetauscher": "Heat exchangers",
    "symbols.group_verteilung": "Distribution",
    "symbols.group_schmutzfaenger": "Strainers",
    "symbols.group_ausdehnung": "Expansion",
    "symbols.group_geraete": "AHU units",
    "symbols.group_ventilatoren": "Fans",
    "symbols.group_klappen_regelung": "Dampers & control",
    "symbols.group_filter": "Filters",
    "symbols.group_register": "Coils",
    "symbols.group_waermerueckgewinnung": "Heat recovery",
    "symbols.group_befeuchtung": "Humidification",
    "symbols.group_schalldaempfer": "Silencers",
    "symbols.group_kaeltemaschinen": "Chillers",
    "symbols.group_komponenten": "Components",
    "symbols.group_kuehler": "Heat rejectors",
    "symbols.group_speicher": "Storage",
    "symbols.group_sole": "Brine",
    "symbols.group_photovoltaik": "Photovoltaics",
    "symbols.group_umwandlung": "Conversion",
    "symbols.group_netz_zaehler": "Grid & metering",
    "symbols.group_laden": "Charging",
    "symbols.group_erzeuger": "Generators",
    "symbols.group_temperatur": "Temperature",
    "symbols.group_druck": "Pressure",
    "symbols.group_durchfluss": "Flow",
    "symbols.group_feuchte": "Humidity",
    "symbols.group_luftqualitaet": "Air quality",
    "symbols.group_raum": "Room",
    "symbols.group_versorgung": "Power supply",
    "symbols.group_schutz_schaltung": "Protection & switching",
    "symbols.group_antriebe": "Drives",
    "symbols.group_meldetechnik": "Fire detection",
    "symbols.group_loeschanlagen": "Suppression",
    "symbols.group_abschottung": "Fire compartment",
    "symbols.symbol_ahu": "Air handling unit",
    "symbols.symbol_air_filter": "Air filter",
    "symbols.symbol_aspirating_detector": "Aspirating smoke detector",
    "symbols.symbol_backflow_preventer": "Backflow preventer",
    "symbols.symbol_balancing_valve": "Balancing valve",
    "symbols.symbol_battery": "Battery storage",
    "symbols.symbol_boiler": "Boiler",
    "symbols.symbol_brine_station": "Brine station",
    "symbols.symbol_buffer_layered": "Stratified buffer tank",
    "symbols.symbol_burner": "Burner",
    "symbols.symbol_busbar": "Busbar",
    "symbols.symbol_check_valve": "Check valve",
    "symbols.symbol_chiller": "Chiller",
    "symbols.symbol_circuit_breaker": "Circuit breaker",
    "symbols.symbol_co2_sensor": "CO\u2082 sensor",
    "symbols.symbol_co2_voc_sensor": "CO\u2082-VOC sensor",
    "symbols.symbol_cogen_unit": "CHP unit",
    "symbols.symbol_compact_ahu": "Compact AHU",
    "symbols.symbol_compressor": "Compressor",
    "symbols.symbol_condensing_unit": "Condensing unit",
    "symbols.symbol_cooling_buffer": "Chilled water buffer",
    "symbols.symbol_cooling_coil": "Cooling coil",
    "symbols.symbol_cooling_tower": "Cooling tower",
    "symbols.symbol_damper": "Damper",
    "symbols.symbol_dhw_freshwater_station": "Freshwater station",
    "symbols.symbol_dhw_tank": "Domestic hot water tank",
    "symbols.symbol_dirt_separator": "Dirt separator",
    "symbols.symbol_dp_sensor": "Differential pressure sensor",
    "symbols.symbol_dry_cooler": "Dry cooler",
    "symbols.symbol_ec_fan": "EC fan",
    "symbols.symbol_expansion_vessel": "Expansion vessel",
    "symbols.symbol_extinguishing_system": "Extinguishing system",
    "symbols.symbol_fan_extract": "Extract air fan",
    "symbols.symbol_fan_supply": "Supply air fan",
    "symbols.symbol_filter_water": "Strainer",
    "symbols.symbol_fire_alarm_panel": "Fire alarm panel",
    "symbols.symbol_fire_barrier": "Fire barrier",
    "symbols.symbol_fire_damper": "Fire damper",
    "symbols.symbol_fire_door": "Fire door",
    "symbols.symbol_flat_collector": "Flat plate collector",
    "symbols.symbol_flexible_compensator": "Expansion compensator",
    "symbols.symbol_flow_sensor": "Flow sensor",
    "symbols.symbol_flow_switch": "Flow switch",
    "symbols.symbol_frequency_drive": "Frequency drive",
    "symbols.symbol_frost_thermostat": "Frost thermostat",
    "symbols.symbol_fuel_cell": "Fuel cell",
    "symbols.symbol_generator_set": "Standby generator",
    "symbols.symbol_grid": "Grid",
    "symbols.symbol_heat_detector": "Heat detector",
    "symbols.symbol_heat_exchanger_plate": "Plate heat exchanger",
    "symbols.symbol_heat_meter": "Heat meter",
    "symbols.symbol_heat_pump_compact": "Heat pump Compact",
    "symbols.symbol_heat_pump_duo": "Dual heat pump",
    "symbols.symbol_heat_pump_neo": "Heat pump Neo",
    "symbols.symbol_heat_recovery_plate": "Plate heat recovery",
    "symbols.symbol_heat_recovery_rotary": "Rotary heat recovery",
    "symbols.symbol_heating_coil": "Heating coil",
    "symbols.symbol_humidifier": "Humidifier",
    "symbols.symbol_humidity_sensor": "Humidity sensor",
    "symbols.symbol_hybrid_inverter": "Hybrid inverter",
    "symbols.symbol_hydraulic_separator": "Hydraulic separator",
    "symbols.symbol_ice_storage": "Ice storage",
    "symbols.symbol_immersion_heater": "Immersion heater",
    "symbols.symbol_inverter": "Inverter",
    "symbols.symbol_isolator_switch": "Isolator switch",
    "symbols.symbol_manifold": "Manifold",
    "symbols.symbol_manual_call_point": "Manual call point",
    "symbols.symbol_meter": "Energy meter",
    "symbols.symbol_mixing_valve": "Three-way mixing valve",
    "symbols.symbol_pressure_reducing_valve": "Pressure reducing valve",
    "symbols.symbol_pressure_sensor": "Pressure sensor",
    "symbols.symbol_pump_dhw": "Circulation pump",
    "symbols.symbol_pump_group": "Pump group",
    "symbols.symbol_pump_inline": "Inline pump",
    "symbols.symbol_pump_twin": "Twin pump",
    "symbols.symbol_pump_variable": "Variable-speed pump",
    "symbols.symbol_pv_array": "PV array",
    "symbols.symbol_radiator": "Radiator",
    "symbols.symbol_rcd": "Residual-current device",
    "symbols.symbol_room_sensor": "Room sensor",
    "symbols.symbol_safety_valve": "Safety valve",
    "symbols.symbol_shutoff_valve": "Shut-off valve",
    "symbols.symbol_silencer": "Silencer",
    "symbols.symbol_smoke_detector": "Smoke detector",
    "symbols.symbol_solar_station": "Solar station",
    "symbols.symbol_sprinkler_head": "Sprinkler head",
    "symbols.symbol_sprinkler_valve_station": "Wet alarm valve station",
    "symbols.symbol_steam_humidifier": "Steam humidifier",
    "symbols.symbol_sub_distribution_board": "Sub-distribution board",
    "symbols.symbol_surge_arrester": "Surge arrester",
    "symbols.symbol_switchgear": "Low-voltage switchgear",
    "symbols.symbol_temp_sensor": "Temperature sensor",
    "symbols.symbol_transformer": "Transformer",
    "symbols.symbol_underfloor": "Underfloor heating",
    "symbols.symbol_ups": "UPS",
    "symbols.symbol_vacuum_tube_collector": "Evacuated tube collector",
    "symbols.symbol_valve_2way": "Two-way valve",
    "symbols.symbol_valve_3way": "Three-way valve",
    "symbols.symbol_vav_box": "VAV box",
    "symbols.symbol_wallbox": "Wallbox",
    "trends.coverage": "Coverage {percent} %",
    "trends.coverage_gaps": "Coverage {percent} % \xB7 {gaps} {gapWord}",
    "trends.gap_one": "gap",
    "trends.gap_other": "gaps",
    "trends.gap_row": "No data from {start} to {end}",
    "trends.instant_column": "Instant",
    "trends.no_data": "No data",
    "trends.report_name": "Report name",
    "trends.report_period": "Period",
    "trends.report_schedule": "Schedule",
    "trends.series_column": "Series {index}",
    "trends.span_day23": "This day has 23 hours \u2014 the clock change falls inside it.",
    "trends.span_day25": "This day has 25 hours \u2014 the clock change falls inside it.",
    "trends.span_month": "This month has {hours} hours \u2014 the clock change falls inside it.",
    "trends.table_label": "Reading table",
    "trends.unreadable": "Unreadable"
  });
  registerCatalog("en", ENTRIES2);

  // src/v100/online-extension.js
  (() => {
    if (!window.GLTFlowCardSDK) {
      window.GLTFlowCardSDK = {
        text: (key, language) => text(key, language === "en" ? "en" : "de"),
        languages: /* @__PURE__ */ new Map()
      };
    }
    const ensure = () => {
      cfg.schema_version = 1;
      cfg.project = cfg.project || { id: uid("project"), name: cfg.title, revision: 0 };
      cfg.layers = cfg.layers || [{ id: "default", name: "Standard", visible: true, locked: false }];
      cfg.schedules = cfg.schedules || [];
      cfg.energy = cfg.energy || { enabled: true, meters: [] };
      cfg.work_orders = cfg.work_orders || [];
      cfg.semantic_model = cfg.semantic_model || { sites: [], buildings: [], floors: [], systems: [] };
      cfg.diagnostics = cfg.diagnostics || { stale_minutes: 10 };
      cfg.simulation = cfg.simulation || { enabled: false, states: {} };
      cfg.security = cfg.security || { server_enforced: false };
      cfg.equipment = (cfg.equipment || []).map((e) => ({ layer: "default", tags: [], ...e }));
    };
    ensure();
    const bar = document.querySelector(".toolbar");
    if (!bar || bar.querySelector("[data-v1-platform]")) return;
    const b = (name, label) => {
      const x = document.createElement("button");
      x.dataset.v1Platform = name;
      x.textContent = label;
      bar.appendChild(x);
      return x;
    };
    const platform = b("platform", "Platform 1.0");
    const semantic = b("semantic", "Semantik");
    const diag = b("diagnose", "Diagnose");
    const schedule = b("schedule", "Zeitplan");
    const energy = b("energy", "Energie");
    const automap = b("automap", "Auto-Map");
    const undoBtn = b("undo", gltText("legacy.undo"));
    const redoBtn = b("redo", gltText("legacy.redo"));
    const saveAs = b("saveas", gltText("legacy.save_as"));
    const templates = b("templates", "Vorlagen");
    const entities = b("entities", "Entities");
    platform.onclick = () => {
      showDialog("GLT Engineering Platform 1.0", `<div class="project"><b>30 Ausbaupunkte</b><small>Betriebszust\xE4nde \xB7 sichere Bedienung \xB7 Alarm Lifecycle \xB7 Zeitprogramme \xB7 Semantik \xB7 Auto-Mapping \xB7 parametrische Profile \xB7 300+ Symbolvarianten \xB7 Ports \xB7 Hindernisrouting \xB7 CAD \xB7 Drill-down \xB7 Historian \xB7 Simulation \xB7 Diagnose \xB7 Energie \xB7 Wartung \xB7 Reports \xB7 Remote-HA \xB7 SDK \xB7 Projektbundles \xB7 Collaboration \xB7 i18n \xB7 Leitstand \xB7 Tests</small></div><div class="actions"><button id="v1-sim">Simulation ${cfg.simulation.enabled ? "deaktivieren" : "aktivieren"}</button><button id="v1-route">Routen neu berechnen</button></div>`);
      document.querySelector("#v1-sim").onclick = () => {
        cfg.simulation.enabled = !cfg.simulation.enabled;
        dlg.close();
        saveDraft();
        status(`Simulation ${cfg.simulation.enabled ? "aktiv" : "aus"}`);
      };
      document.querySelector("#v1-route").onclick = () => {
        render();
        dlg.close();
        status("Auto-Routing aktualisiert");
      };
    };
    semantic.onclick = () => {
      const e = cfg.equipment.find((x) => x.id === selected);
      if (!e) return status("Zuerst Bauteil ausw\xE4hlen");
      showDialog("Semantik", `<div class="field"><label>Standort</label><input id="sem-site" value="${esc(e.site || "")}"></div><div class="field"><label>Geb\xE4ude</label><input id="sem-building" value="${esc(e.building || "")}"></div><div class="field"><label>Etage</label><input id="sem-floor" value="${esc(e.floor || "")}"></div><div class="field"><label>System / Teilanlage</label><input id="sem-system" value="${esc(e.system || "")}"></div><div class="field"><label>Tags</label><input id="sem-tags" value="${esc((e.tags || []).join(", "))}"></div><button id="sem-save">\xDCbernehmen</button>`);
      document.querySelector("#sem-save").onclick = () => {
        e.site = document.querySelector("#sem-site").value || void 0;
        e.building = document.querySelector("#sem-building").value || void 0;
        e.floor = document.querySelector("#sem-floor").value || void 0;
        e.system = document.querySelector("#sem-system").value || void 0;
        e.tags = document.querySelector("#sem-tags").value.split(",").map((x) => x.trim()).filter(Boolean);
        e.semantic_path = [e.site, e.building, e.floor, e.system, e.name].filter(Boolean).join(" / ");
        dlg.close();
        render();
        saveDraft();
      };
    };
    diag.onclick = () => {
      const refs = /* @__PURE__ */ new Set();
      const walk = (v) => {
        if (typeof v === "string" && v.includes(".")) refs.add(v);
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => {
          if (k.includes("entity") || k === "flow") walk(x);
        });
      };
      walk(cfg);
      showDialog("Inbetriebnahme & Diagnose", `<div class="project"><b>${refs.size} referenzierte Entities</b><small>Im Online-Designer sind keine Live-HA-States verf\xFCgbar. In Home Assistant pr\xFCft Platform 1.0 missing / unavailable / unknown / stale, Einheiten und ungenutzte Entities.</small></div><textarea>${esc([...refs].join("\n"))}</textarea>`);
    };
    schedule.onclick = () => {
      showDialog("Zeitprogramme", `<div class="field"><label>Name</label><input id="sch-name" value="Heizbetrieb"></div><div class="field"><label>Tage (0=Mo)</label><input id="sch-days" value="0,1,2,3,4"></div><div class="field"><label>Zeit</label><input id="sch-time" value="06:00"></div><div class="field"><label>Service</label><input id="sch-service" value="switch.turn_on"></div><div class="field"><label>Entity</label><input id="sch-entity" placeholder="switch.heizung"></div><button id="sch-add">Zeitprogramm speichern</button>`);
      document.querySelector("#sch-add").onclick = () => {
        cfg.schedules.push({ id: uid("schedule"), name: document.querySelector("#sch-name").value, days: document.querySelector("#sch-days").value.split(",").map(Number), time: document.querySelector("#sch-time").value, service: document.querySelector("#sch-service").value, entity_id: document.querySelector("#sch-entity").value, enabled: true });
        dlg.close();
        saveDraft();
        status("Zeitprogramm hinzugef\xFCgt");
      };
    };
    energy.onclick = () => {
      showDialog("Energie & Medien", `<div class="field"><label>Name</label><input id="en-name" value="Strom"></div><div class="field"><label>Art</label><select id="en-kind"><option>electricity</option><option>heat</option><option>cooling</option><option>water</option><option>gas</option><option>pv</option></select></div><div class="field"><label>Entity</label><input id="en-entity" placeholder="sensor.energy"></div><div class="field"><label>Preis / Einheit</label><input id="en-price" type="number" step="0.01"></div><button id="en-add">Z\xE4hler speichern</button>`);
      document.querySelector("#en-add").onclick = () => {
        cfg.energy.meters.push({ id: uid("meter"), name: document.querySelector("#en-name").value, kind: document.querySelector("#en-kind").value, entity: document.querySelector("#en-entity").value, price_per_unit: +document.querySelector("#en-price").value || void 0 });
        dlg.close();
        saveDraft();
        status("Energiez\xE4hler hinzugef\xFCgt");
      };
    };
    templates.onclick = () => {
      const list = factoryTemplates();
      showDialog("Vorlagen", list.map((tp, i) => `<div class="project"><b>${esc(tp.name)}</b><small>${esc(tp.description)}</small><button data-tpl="${i}">Laden</button></div>`).join("") || "Keine Vorlagen verf\xFCgbar.");
      document.querySelectorAll("[data-tpl]").forEach((btn) => btn.onclick = () => {
        const tp = list[+btn.dataset.tpl];
        if (!tp) return;
        cfg = structuredClone(tp.config);
        ensure();
        dlg.close();
        render();
        saveDraft();
        status(`Vorlage geladen: ${tp.name}`);
      });
    };
    const wireEntitySuggestions = () => {
      const stored = JSON.parse(localStorage.getItem("glt-flow-card.entities") || "null");
      const list = stored && Array.isArray(stored.entities) ? stored.entities : [];
      if (!list.length) return;
      let dl = document.querySelector("datalist#glt-entities");
      if (!dl) {
        dl = document.createElement("datalist");
        dl.id = "glt-entities";
        document.body.appendChild(dl);
        dl.innerHTML = list.slice(0, 2e3).map((e) => `<option value="${esc(e.entity_id)}">${esc(e.name)}</option>`).join("");
      }
      document.querySelectorAll('.field input[id*="entity" i]').forEach((inp) => inp.setAttribute("list", "glt-entities"));
    };
    entities.onclick = () => {
      const stored = JSON.parse(localStorage.getItem("glt-flow-card.entities") || "null");
      const n = stored && Array.isArray(stored.entities) ? stored.entities.length : 0;
      showDialog("Entities", `<div class="project"><b>Import f\xFCr Entity-Felder</b><small>In Home Assistant \xFCber den Designer-Button \u201EEntities" als Datei exportieren und hier laden: alle Entity-Felder bieten danach Vorschl\xE4ge an.</small></div><label class="field" style="cursor:pointer">Datei w\xE4hlen (.json)<input type="file" id="ent-file" accept=".json,application/json" hidden></label><div id="ent-out">${n ? `${n} Entities importiert` : "Noch keine Entities importiert"}</div>`);
      const f = document.querySelector("#ent-file");
      if (f) f.onchange = async () => {
        try {
          const data = JSON.parse(await f.files[0].text());
          const res = normalizeEntityImport(data);
          localStorage.setItem("glt-flow-card.entities", JSON.stringify(res));
          document.querySelector("#ent-out").textContent = `${res.count} Entities importiert \xB7 ${res.rejected} abgelehnt`;
          wireEntitySuggestions();
          status("Entities importiert");
        } catch (err) {
          document.querySelector("#ent-out").textContent = "Datei nicht lesbar";
        }
      };
    };
    const history = [];
    let future = [];
    let lastState = JSON.stringify(cfg);
    const syncButtons = () => {
      undoBtn.disabled = !history.length;
      redoBtn.disabled = !future.length;
    };
    const restore = (raw) => {
      cfg = JSON.parse(raw);
      ensure();
      selected = null;
      lastState = JSON.stringify(cfg);
      render();
      saveDraft();
    };
    undoBtn.onclick = () => {
      if (!history.length) return;
      future.push(lastState);
      restore(history.pop());
      status(gltText("legacy.undo"));
    };
    redoBtn.onclick = () => {
      if (!future.length) return;
      history.push(lastState);
      restore(future.pop());
      status(gltText("legacy.redo"));
    };
    document.addEventListener("keydown", (ev) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      const key = ev.key.toLowerCase();
      if (key === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undoBtn.click();
      } else if (key === "y" || key === "z" && ev.shiftKey) {
        ev.preventDefault();
        redoBtn.click();
      }
    });
    saveAs.onclick = async () => {
      const name = await askText(gltText("legacy.prompt_project_name"), cfg.project?.name || cfg.title);
      if (!name) return;
      cfg.project = cfg.project || {};
      cfg.project.name = name;
      cfg.title = name;
      saveLocal(name);
      saveDraft();
      render();
      const y = YAML.dump(cfg, { noRefs: true, lineWidth: 120 });
      const blob = new Blob([y], { type: "application/yaml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${name}.yaml`;
      link.click();
      URL.revokeObjectURL(link.href);
      status(`${gltText("legacy.download_yaml")}: ${name}.yaml \xB7 ${gltText("legacy.sponsor_hint")}`);
    };
    document.addEventListener("dblclick", (ev) => {
      const node = ev.target.closest?.(".node");
      if (!node) return;
      const item = cfg.equipment.find((x) => x.id === node.dataset.id);
      if (!item) return;
      showDialog(`Entity zuweisen \xB7 ${esc(item.name || item.id)}`, `<div class="field"><label>Home Assistant Entity</label><input id="ent-assign" list="glt-entities" placeholder="sensor.vorlauf" value="${esc(item.entity || item.control_entity || "")}"></div><button id="ent-assign-save">\xDCbernehmen</button><div class="hint" style="margin-top:8px">Vorschl\xE4ge kommen aus dem Entities-Import.</div>`);
      wireEntitySuggestions();
      document.querySelector("#ent-assign-save").onclick = () => {
        const value = document.querySelector("#ent-assign").value.trim();
        item.entity = value || void 0;
        dlg.close();
        render();
        saveDraft();
        status(value ? `Entity zugewiesen: ${value}` : "Entity entfernt");
      };
    });
    automap.onclick = () => {
      const stored = JSON.parse(localStorage.getItem("glt-flow-card.entities") || "null");
      const list = stored && Array.isArray(stored.entities) ? stored.entities : [];
      if (!list.length) {
        status("Auto-Map: erst Entities importieren");
        return;
      }
      const words = (s) => String(s || "").toLowerCase().split(/[^a-z0-9äöüß]+/).filter((w) => w.length > 2);
      const applied = [];
      const skipped = [];
      for (const eq2 of cfg.equipment) {
        const eqWords = /* @__PURE__ */ new Set([...words(eq2.name), ...words(eq2.symbol), ...words(eq2.type)]);
        let best = null;
        for (const ent of list) {
          const entWords = /* @__PURE__ */ new Set([...words(ent.entity_id), ...words(ent.name)]);
          let score = 0;
          for (const w of entWords) if (eqWords.has(w)) score += 1;
          if (ent.domain === "sensor") score += 0.5;
          if (score > best?.score) best = { entity_id: ent.entity_id, score };
        }
        if (best && best.score >= 1) {
          eq2.entity = best.entity_id;
          applied.push(`${eq2.name || eq2.id} \u2192 ${best.entity_id}`);
        } else skipped.push(eq2.name || eq2.id);
      }
      render();
      saveDraft();
      showDialog("Auto-Map", `${applied.length ? `<div class="project"><b>${applied.length} Zuordnungen</b><small>${applied.map(esc).join("<br>")}</small></div>` : ""}${skipped.length ? `<div class="project"><b>Ohne Treffer</b><small>${skipped.map(esc).join(", ")}</small></div>` : ""}`);
    };
    const stage = document.querySelector("#stage");
    if (stage) {
      stage.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        stage.style.outline = "2px dashed #20a4ff";
      });
      stage.addEventListener("dragleave", () => {
        stage.style.outline = "";
      });
      stage.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        stage.style.outline = "";
        const file = [...ev.dataTransfer.files].find((f) => /\.ya?ml$/i.test(f.name));
        if (!file) return;
        try {
          const value = YAML.parse(await file.text());
          if (!value || typeof value !== "object") throw Error("Ung\xFCltige YAML");
          cfg = value;
          ensure();
          selected = null;
          render();
          saveDraft();
          status(`YAML importiert: ${file.name}`);
        } catch (err) {
          status(`YAML-Import fehlgeschlagen: ${err.message}`);
        }
      });
    }
    const sponsorLink = () => {
      const bar2 = document.querySelector(".toolbar");
      if (!bar2 || bar2.querySelector("[data-glt-sponsor]")) return;
      const a = document.createElement("a");
      a.dataset.gltSponsor = "1";
      a.href = "https://github.com/sponsors/Xerolux";
      a.target = "_blank";
      a.rel = "noopener";
      a.style.cssText = "margin-left:auto;align-self:center;font-size:11px;text-decoration:none;opacity:.85";
      a.onmouseenter = () => a.style.opacity = "1";
      a.onmouseleave = () => a.style.opacity = ".85";
      a.textContent = `\u2665 ${gltText("legacy.sponsor")}`;
      bar2.appendChild(a);
    };
    const oldRender = render;
    render = function() {
      ensure();
      const now = JSON.stringify(cfg);
      if (now !== lastState) {
        history.push(lastState);
        if (history.length > 80) history.shift();
        future = [];
        lastState = now;
      }
      const r = oldRender();
      wireEntitySuggestions();
      syncButtons();
      sponsorLink();
      return r;
    };
  })();
})();
/*! END GLT Online Designer v1 Engineering extensions */
