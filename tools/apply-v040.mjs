import { readFileSync, writeFileSync } from "node:fs";

const extensionPath = process.argv[2];
if (!extensionPath) throw new Error("usage: node tools/apply-v040.mjs <bundled-extension.js>");
const ext = readFileSync(extensionPath, "utf8");
const file = "dist/glt-flow-card.js";
let src = readFileSync(file, "utf8");

// Rebuild deterministically if the workflow is re-run.
const marker = "/*! GLT Flow Card v0.4 extensions */";
const pos = src.indexOf(marker);
if (pos >= 0) src = src.slice(0, pos).trimEnd() + "\n";
if (!src.includes('const VERSION = "0.3.0";') && !src.includes('const VERSION = "0.4.0";')) {
  throw new Error("Could not find base version anchor");
}
src = src.replace('const VERSION = "0.3.0";', 'const VERSION = "0.4.0";');
src = `${src.trimEnd()}\n\n${ext.trim()}\n`;
writeFileSync(file, src);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = "0.4.0";
pkg.description = "Modern GLT/BMS engineering workspace for Home Assistant: Neo 2030/Clean/Classic SCADA, drag-and-drop, YAML round-trip, project/version library, native entity picker, alarms, assets, audit, reports, multi-site, replay and multi-axis trends.";
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
lock.version = "0.4.0";
if (lock.packages?.[""]) lock.packages[""].version = "0.4.0";
writeFileSync("package-lock.json", `${JSON.stringify(lock, null, 2)}\n`);

let test = readFileSync("test/smoke.test.mjs", "utf8");
test = test.replace('VERSION = \\\"0.3.0\\\"', 'VERSION = \\\"0.4.0\\\"');
writeFileSync("test/smoke.test.mjs", test);

function addReadme(path, english) {
  let readme = readFileSync(path, "utf8");
  const sectionTitle = "## Engineering Workspace 0.4";
  if (!readme.includes(sectionTitle)) {
    const insertBefore = english ? "## Quick start" : "## Schnellstart";
    const section = english ? `
## Engineering Workspace 0.4

![GLT Flow Card feature overview](docs/images/feature-overview.svg)

Version 0.4 turns the card into a broader **Home Assistant GLT/BMS engineering workspace**. Existing Lovelace YAML can be imported, visually edited and exported again; unknown configuration keys are kept in the project object instead of intentionally being removed.

- YAML round-trip with file import, clipboard copy and download.
- Project library, autosave and version history; browser-local by default, Home Assistant storage with the optional companion backend.
- User component templates, grouped sub-plants and orthogonal auto-routing tied to equipment.
- Alarm/message panel with optional acknowledgement service.
- Viewer / operator / designer roles and audit log.
- Maintenance assets with operating hours, intervals, due dates, documents and parts metadata.
- Multi-site overview and filtering.
- Trend+ with multiple Y axes by unit, min/max/average, power-to-energy integration, 24 h comparison and CSV export.
- CSV and print/PDF reports.
- Built-in GitHub Pages documentation, hosted online editor and Wiki source sync.

**[Live documentation & online editor](https://xerolux.github.io/glt-flow-card/)** · **[Wiki](https://github.com/Xerolux/glt-flow-card/wiki)**

### Neo 2030 runtime

![Neo 2030 runtime](docs/images/neo2030-dashboard.svg)

### Home Assistant drag-and-drop designer

![Home Assistant designer](docs/images/ha-designer.svg)

### Clean designer option

![Clean designer](docs/images/clean-designer.svg)

` : `
## Engineering Workspace 0.4

![GLT Flow Card Funktionsübersicht](docs/images/feature-overview.svg)

Mit Version 0.4 wird aus der Karte ein umfangreicherer **GLT/BMS-Engineering-Workspace für Home Assistant**. Bestehende Lovelace-YAML kann importiert, grafisch weiterbearbeitet und wieder exportiert werden; unbekannte Konfigurationsschlüssel bleiben im Projektobjekt erhalten, statt absichtlich entfernt zu werden.

- YAML Round-Trip mit Datei-Import, Zwischenablage und Download.
- Projektbibliothek, Autosave und Versionshistorie; standardmäßig lokal im Browser, mit optionalem Companion-Backend direkt in Home Assistant.
- Eigene Bauteilvorlagen, gruppierte Unteranlagen und orthogonales Auto-Routing an Anlagenobjekten.
- Alarm-/Meldungsansicht mit optionalem Quittier-Service.
- Rollen Viewer / Operator / Designer und Audit-Log.
- Wartungsassets mit Betriebsstunden, Intervallen, Fälligkeit, Dokumenten und Ersatzteil-Metadaten.
- Multi-Site-Übersicht und Standortfilter.
- Trend+ mit mehreren Y-Achsen je Einheit, Min/Max/Mittelwert, Leistung-zu-Energie-Integration, 24-h-Vergleich und CSV-Export.
- CSV- sowie Druck/PDF-Berichte.
- GitHub Pages Dokumentation, gehosteter Online-Editor und Wiki-Synchronisierung.

**[Live-Dokumentation & Online-Editor](https://xerolux.github.io/glt-flow-card/)** · **[Wiki](https://github.com/Xerolux/glt-flow-card/wiki)**

### Neo 2030 Runtime

![Neo 2030 Runtime](docs/images/neo2030-dashboard.svg)

### Drag-&-Drop-Designer in Home Assistant

![Home Assistant Designer](docs/images/ha-designer.svg)

### Clean-Designer als Alternative

![Clean Designer](docs/images/clean-designer.svg)

`;
    readme = readme.replace(insertBefore, `${section}${insertBefore}`);
  }
  writeFileSync(path, readme);
}
addReadme("README.md", true);
addReadme("README.de.md", false);

let changelog = readFileSync("CHANGELOG.md", "utf8");
if (!changelog.includes("## 0.4.0")) {
  changelog = changelog.replace("# Changelog\n", `# Changelog\n\n## 0.4.0 - 2026-08-31\n\n- YAML round-trip import/export with js-yaml and unknown-key preservation in the project object.\n- Project library, autosave, version history and reusable component/sub-plant templates.\n- Optional Home Assistant companion backend for cross-device project/template storage and server-side audit metadata.\n- Multi-selection groups and group movement.\n- Orthogonal automatic routing linked to equipment endpoints.\n- Alarm/message panel with optional acknowledgement service.\n- Viewer/operator/designer access roles and control confirmation.\n- Audit log for project, YAML, control, alarm and report actions.\n- Maintenance asset view with operating hours, service interval, due date, documents and parts metadata.\n- Multi-site overview and site filtering.\n- Trend+ multi-axis analytics, min/max/average, power-to-energy integration, previous-24h comparison and CSV export.\n- CSV and printable/PDF reports.\n- GitHub Pages site, hosted online editor, Wiki source pages and sponsorship metadata.\n- New README screenshots for Neo 2030, HA Designer and Clean.\n\n`);
}
writeFileSync("CHANGELOG.md", changelog);
