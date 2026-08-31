import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const fragment = gunzipSync(Buffer.from("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", "base64")).toString("utf8").trimEnd();

const distPath = "dist/glt-flow-card.js";
let source = readFileSync(distPath, "utf8");
const startMarker = "  class GltFlowCardEditor extends HTMLElement {";
const endMarker = "\n\n  if (!customElements.get(CARD_TYPE))";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Could not locate current editor block");
source = source.slice(0, start) + fragment + source.slice(end);
source = source.replace('const VERSION = "0.1.0";', 'const VERSION = "0.2.0";');
writeFileSync(distPath, source);

const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = "0.2.0";
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const enPath = "README.md";
let en = readFileSync(enPath, "utf8");
en = en.replace(
  "- **Basic visual editor** for global options; complete geometry remains available in YAML for maximum flexibility.",
  "- **Full drag & drop plant designer** for equipment, media paths, data points, KPIs and image views — YAML remains available for advanced setups."
);
const enSection = `## Drag & Drop Designer

The visual editor is now a complete plant designer instead of a form for global options only. Open the card editor in Home Assistant and build the plant directly on the canvas:

- drag equipment, media paths, data points and KPIs from the component palette;
- move and resize equipment directly on the plant canvas;
- edit pipe routing with draggable control points;
- assign Home Assistant entities in the property inspector;
- add image views and place the same data point independently on schematic and plant photo;
- use grid snapping, zoom, duplicate, delete, keyboard nudging, undo and redo;
- use custom image/SVG URLs for complete views or individual equipment.

The editor writes the same YAML configuration documented below, so visual editing and hand-written YAML can be mixed at any time.

`;
if (!en.includes("## Drag & Drop Designer")) en = en.replace("## Quick start\n", enSection + "## Quick start\n");
writeFileSync(enPath, en);

const dePath = "README.de.md";
let de = readFileSync(dePath, "utf8");
de = de.replace(
  "- **Basis-Editor** für globale Optionen; die komplette Anlagengeometrie ist über YAML konfigurierbar.",
  "- **Vollständiger Drag-&-Drop-Anlageneditor** für Bauteile, Medienleitungen, Datenpunkte, KPIs und Bildansichten; YAML bleibt für Spezialfälle verfügbar."
);
const deSection = `## Drag-&-Drop-Designer

Der visuelle Editor ist jetzt ein vollständiger Anlagen-Designer. Die GLT kann direkt im Home-Assistant-Karteneditor aufgebaut werden:

- Anlagenbauteile, Medienleitungen, Datenpunkte und KPIs aus der Palette auf die Zeichenfläche ziehen;
- Bauteile direkt verschieben und in der Größe ändern;
- Leitungswege über verschiebbare Stützpunkte aufbauen;
- Home-Assistant-Entitäten rechts im Eigenschaften-Inspector zuordnen;
- Anlagenbild-Ansichten hinzufügen und denselben Datenpunkt im Schema und Foto getrennt positionieren;
- Rasterfang, Zoom, Duplizieren, Löschen, Tastatur-Nudging sowie Undo/Redo;
- eigene Bilder/SVGs sowohl für komplette Ansichten als auch für einzelne Anlagenobjekte.

Der Designer schreibt dieselbe YAML-Konfiguration wie die manuelle Konfiguration. Visueller Editor und YAML können deshalb jederzeit kombiniert werden.

`;
if (!de.includes("## Drag-&-Drop-Designer")) de = de.replace("## Schnellstart\n", deSection + "## Schnellstart\n");
writeFileSync(dePath, de);

const changelogPath = "CHANGELOG.md";
let changelog = readFileSync(changelogPath, "utf8");
const release = `## 0.2.0 - 2026-08-31

- Replaced the basic form editor with a full professional drag-and-drop GLT designer.
- Component palette for heat pumps, tanks, pumps, fans, valves, heat exchangers, boilers, AHUs, zones, meters, custom images and data points.
- Drag, resize and keyboard positioning with optional grid snapping.
- Editable media paths with draggable routing points and animated medium colours.
- Per-view data-point placement for schematic ↔ plant-photo localization.
- Property inspector for entities, dimensions, labels, images, media properties and KPIs.
- Add image views from the editor; configure background image, fit and overlays.
- Undo/redo, duplicate/delete, zoom/fit and responsive editor layout.
- Editor keeps YAML compatibility and custom image/SVG support.

`;
if (!changelog.includes("## 0.2.0")) changelog = changelog.replace("# Changelog\n\n", "# Changelog\n\n" + release);
writeFileSync(changelogPath, changelog);

const testPath = "test/smoke.test.mjs";
let test = readFileSync(testPath, "utf8");
const testBlock = `

test("drag and drop editor foundations", () => {
  for (const token of ["class GltFlowCardEditor", "data-pk", "_drop(e,c)", "_undo()", "_redo()", "data-hi", "Eigenes Bild / SVG"]) {
    assert.ok(source.includes(token), \`missing editor token \${token}\`);
  }
});
`;
if (!test.includes("drag and drop editor foundations")) test += testBlock;
writeFileSync(testPath, test);

console.log("GLT Flow Card v0.2.0 drag-and-drop editor applied.");
