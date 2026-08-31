import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const decode = (path) => gunzipSync(Buffer.from(readFileSync(path, "utf8").trim(), "base64")).toString("utf8");
const symbols = decode("tools/v030-symbols.b64");
const designer = decode("tools/v030-designer.b64");
const file = "dist/glt-flow-card.js";
let src = readFileSync(file, "utf8");

const must = (condition, message) => { if (!condition) throw new Error(message); };
const rep = (oldValue, newValue, label) => {
  must(src.includes(oldValue), `Missing anchor: ${label}`);
  src = src.replace(oldValue, newValue);
};

rep('const VERSION = "0.2.0";', 'const VERSION = "0.3.0";', "version");

const iconMatch = src.match(/  const EQUIPMENT_ICONS = \{[\s\S]*?\n  \};/);
must(iconMatch, "equipment icon block");
src = src.replace(iconMatch[0], `${iconMatch[0]}\n\n${symbols.trimEnd()}`);

rep(
  'config.title = config.title ?? "GLT Anlagenvisualisierung";',
  'config.title = config.title ?? "GLT Anlagenvisualisierung";\n    config.appearance = { mode: "neo2030", show_switch: true, ...(config.appearance || {}) };',
  "appearance defaults"
);
rep('this._view = null;', 'this._view = null;\n      this._styleMode = null;', "runtime style state");
rep('this._config = normalizeConfig(config);', 'this._config = normalizeConfig(config);\n      this._styleMode = this._config.appearance?.mode || "neo2030";', "runtime appearance config");
rep(
  'const icon = item.icon || EQUIPMENT_ICONS[item.type] || EQUIPMENT_ICONS.generic;',
  'const icon = item.icon || symbolById(item.symbol, item.type).icon || EQUIPMENT_ICONS[item.type] || EQUIPMENT_ICONS.generic;',
  "runtime symbol icon"
);
rep(
  'node.className = `glt-equipment glt-type-${item.type || "generic"}`;',
  'node.className = `glt-equipment glt-type-${item.type || "generic"} glt-symbol-${item.symbol || item.type || "generic"}`;',
  "runtime symbol class"
);
rep(
  'this.shadowRoot.innerHTML = `<style>${CARD_STYLES}</style>',
  'this.shadowRoot.innerHTML = `<style>${CARD_STYLES}${APPEARANCE_STYLES}</style>',
  "appearance stylesheet hook"
);
rep(
  '<ha-card class="glt-card">',
  '<ha-card class="glt-card glt-style-${esc(this._styleMode || this._config.appearance?.mode || "neo2030")}">',
  "runtime appearance class"
);
rep(
  '<div class="glt-tool-actions">\n              ${this._config.trend.enabled ?',
  '<div class="glt-tool-actions">\n              ${this._config.appearance?.show_switch !== false ? `<div class="glt-style-switch"><button type="button" data-style="neo2030" class="${(this._styleMode || this._config.appearance?.mode || "neo2030") === "neo2030" ? "active" : ""}">Neo 2030</button><button type="button" data-style="clean" class="${(this._styleMode || this._config.appearance?.mode) === "clean" ? "active" : ""}">Clean</button><button type="button" data-style="classic_scada" class="${(this._styleMode || this._config.appearance?.mode) === "classic_scada" ? "active" : ""}">Classic SCADA</button></div>` : ""}\n              ${this._config.trend.enabled ?',
  "runtime style switch"
);
rep(
  '      this.shadowRoot.querySelector("[data-action=\'zoom-in\']")?.addEventListener("click", () => this._zoomBy(1.2));',
  '      this.shadowRoot.querySelectorAll("[data-style]").forEach((button) => {\n        button.addEventListener("click", () => {\n          this._styleMode = button.dataset.style || "neo2030";\n          this._queueRender();\n        });\n      });\n      this.shadowRoot.querySelector("[data-action=\'zoom-in\']")?.addEventListener("click", () => this._zoomBy(1.2));',
  "runtime style binding"
);

const editorRx = /  const EDITOR_STYLES=`[\s\S]*?  if \(!customElements\.get\(CARD_TYPE\)\)/;
must(editorRx.test(src), "designer block");
src = src.replace(editorRx, `${designer.trimEnd()}\n\n  if (!customElements.get(CARD_TYPE))`);
writeFileSync(file, src);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = "0.3.0";
pkg.description = "Modern configurable GLT/BMS plant visualization for Home Assistant with Neo 2030/Clean/Classic SCADA styles, native entity picker, drag-and-drop designer, YAML export, replay, trends and KPIs.";
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
lock.version = "0.3.0";
if (lock.packages?.[""]) lock.packages[""].version = "0.3.0";
writeFileSync("package-lock.json", `${JSON.stringify(lock, null, 2)}\n`);

const deSection = `
## Neo 2030, Clean und Classic SCADA

Die Karte enthält jetzt drei vollständige Optik-Presets. **Neo 2030** ist die neue dunkle Premium-Ansicht mit moderner Symbolik, dezenten Glow-Effekten und klarer technischer Typografie. **Clean** erhält die helle, reduzierte Darstellung. **Classic SCADA** bleibt bewusst für Anwender erhalten, die eine traditionelle GLT-/SCADA-Optik bevorzugen. Der Stil kann im Designer gewählt und optional direkt in der Karte umgeschaltet werden.

## Home-Assistant-Entity-Picker und YAML-Ausgabe

Im integrierten Designer werden Entitäten nicht mehr von Hand eingetippt: Hauptentitäten, Status, Messwerte, Fluss-/Aktivsignale und KPIs verwenden den nativen Home-Assistant-Entity-Picker mit passenden Domain-Filtern. Friendly Name, Entity-ID und die vorhandene Home-Assistant-Entity-Liste stehen dadurch direkt im Designer zur Verfügung.

Der Designer bietet außerdem **Live-Vorschau** sowie eine **Lovelace-YAML-Ansicht mit Kopierfunktion**. Das grafisch erstellte Schema kann sofort als \`custom:glt-flow-card\` in ein manuelles Lovelace-Dashboard übernommen werden.

## Erweiterte Symbolbibliothek

Die Palette enthält mehr als 50 auswählbare Bausteine und Varianten für Heizung, Hydraulik, RLT/Lüftung, Kälte, Energie, Sensorik und allgemeine Anlagen: Wärmepumpen, Speicher, Heizkreise, Pumpen, 2-/3-Wege-Ventile, Mischventile, Wärmetauscher, Verteiler, Ausdehnungsgefäße, RLT-Zentralen, Ventilatoren, Luftklappen, Filter, Heiz-/Kühlregister, Kältemaschinen, PV, Batterie, Netz, Zähler, Raum- und Prozesssensoren sowie eigene Bilder/SVGs.

`;
let de = readFileSync("README.de.md", "utf8");
if (!de.includes("## Neo 2030, Clean und Classic SCADA")) de = de.replace("## Schnellstart", `${deSection}## Schnellstart`);
writeFileSync("README.de.md", de);

const enSection = `
## Neo 2030, Clean and Classic SCADA

The card now ships with three complete visual presets. **Neo 2030** is the new dark premium look with modern symbols, restrained glow and technical typography. **Clean** keeps the bright minimal look. **Classic SCADA** remains available for users who prefer a traditional BMS/SCADA presentation. The style can be selected in the designer and optionally switched directly on the card.

## Native Home Assistant entity picker and YAML export

The integrated designer no longer requires typing entity IDs by hand. Main entities, status entities, measurements, flow/activity signals and KPIs use Home Assistant's native entity picker with sensible domain filters, giving direct access to the current Home Assistant entity catalog.

The designer also includes a **live preview** and a **Lovelace YAML drawer with copy action**, so a visually created plant can be pasted directly into a manual dashboard as \`custom:glt-flow-card\`.

## Extended symbol library

The palette contains more than 50 components and variants across heating, hydraulics, AHU/ventilation, cooling, energy, sensors and generic plant objects, while custom images/SVGs remain optional.

`;
let en = readFileSync("README.md", "utf8");
if (!en.includes("## Neo 2030, Clean and Classic SCADA")) en = en.replace("## Quick start", `${enSection}## Quick start`);
writeFileSync("README.md", en);

let changelog = readFileSync("CHANGELOG.md", "utf8");
if (!changelog.includes("## 0.3.0")) changelog = changelog.replace("# Changelog\n", `# Changelog\n\n## 0.3.0 - 2026-08-31\n\n- Added Neo 2030 visual system while keeping Clean and Classic SCADA modes.\n- Added runtime style switch and designer appearance selector.\n- Added 50+ component/symbol variants across heating, hydraulics, ventilation, cooling, energy and sensors.\n- Added Home Assistant native entity pickers with domain filtering throughout the drag-and-drop designer.\n- Added live card preview inside the designer.\n- Added Lovelace YAML generation and one-click copy.\n- Added symbol-aware rendering and a new Neo 2030 iDM example.\n\n`);
writeFileSync("CHANGELOG.md", changelog);

writeFileSync("examples/idm-neo2030.yaml", `# GLT Flow Card - Neo 2030 / iDM example
type: custom:glt-flow-card
title: iDM Heizzentrale
subtitle: ALM 6-15 · Neo 2030
appearance:
  mode: neo2030
  show_switch: true
canvas:
  width: 1600
  height: 900
  viewport_height: 660
  grid: true
views:
  - id: schematic
    name: Anlagenschema
    kind: schematic
replay:
  enabled: true
  hours: 168
trend:
  enabled: true
  max_series: 8
kpis:
  - name: Vorlauf HK D
    icon: mdi:thermometer-chevron-up
    entity: sensor.alm6_15_vorlauftemperatur_hk_d
  - name: Raum HK D
    icon: mdi:home-thermometer-outline
    entity: sensor.alm6_15_raumtemperatur_hk_d
equipment:
  - id: idm
    type: heat_pump
    symbol: heat_pump_neo
    name: iDM ALM 6-15
    x: 150
    y: 330
    width: 260
    height: 170
    fields:
      - label: Vorlauf
        entity: sensor.alm6_15_vorlauftemperatur_hk_d
      - label: Soll-VL
        entity: sensor.alm6_15_sollvorlauftemperatur_hk_d
  - id: buffer
    type: tank
    symbol: buffer_layered
    name: Hydraulik / Puffer
    x: 660
    y: 280
    width: 240
    height: 210
  - id: hk_d
    type: room
    symbol: underfloor
    name: Heizkreis D
    x: 1180
    y: 310
    width: 250
    height: 190
    fields:
      - label: Vorlauf
        entity: sensor.alm6_15_vorlauftemperatur_hk_d
      - label: Raum
        entity: sensor.alm6_15_raumtemperatur_hk_d
paths:
  - id: supply
    medium: heating_supply
    temperature: sensor.alm6_15_vorlauftemperatur_hk_d
    points:
      - [410, 370]
      - [660, 370]
      - [900, 370]
      - [1180, 370]
  - id: return
    medium: heating_return
    points:
      - [1180, 450]
      - [900, 450]
      - [660, 450]
      - [410, 450]
datapoints:
  - id: hk_d_flow
    label: VL HK D
    kind: temperature
    entity: sensor.alm6_15_vorlauftemperatur_hk_d
    positions:
      schematic: { x: 1030, y: 330 }
  - id: hk_d_room
    label: Raum HK D
    kind: temperature
    entity: sensor.alm6_15_raumtemperatur_hk_d
    positions:
      schematic: { x: 1310, y: 540 }
`);

let test = readFileSync("test/smoke.test.mjs", "utf8");
if (!test.includes("Neo 2030 designer, native entities and YAML export")) test += `\n\ntest("Neo 2030 designer, native entities and YAML export", () => {\n  for (const token of ["VERSION = \\\"0.3.0\\\"", "SYMBOL_LIBRARY", "ha-entity-picker", "configToYaml", "glt-style-neo2030", "classic_scada", "data-preview", "YAML kopieren"]) {\n    assert.ok(source.includes(token), \`missing \${token}\`);\n  }\n});\n`;
writeFileSync("test/smoke.test.mjs", test);
