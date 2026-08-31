import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { marked } from "marked";

const root = process.cwd();
const out = join(root, "_site");
mkdirSync(out, { recursive: true });
mkdirSync(join(out, "wiki"), { recursive: true });
mkdirSync(join(out, "editor"), { recursive: true });
mkdirSync(join(out, "vendor"), { recursive: true });
mkdirSync(join(out, "images"), { recursive: true });
mkdirSync(join(out, "examples"), { recursive: true });

const siteCss = `
:root{color-scheme:dark;--bg:#06101b;--panel:#0b1928;--line:#1b3650;--tx:#eef6ff;--mut:#91a9be;--accent:#16a8ff;--green:#22c55e}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 70% 0,#0d2740 0,#06101b 45%);color:var(--tx);font:15px/1.65 system-ui,Segoe UI,sans-serif}a{color:#63caff}.nav{position:sticky;top:0;z-index:20;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 max(22px,calc((100vw - 1180px)/2));border-bottom:1px solid var(--line);background:#06101be8;backdrop-filter:blur(12px)}.brand{font-weight:850;font-size:19px;color:var(--tx);text-decoration:none}.nav-links{display:flex;gap:17px}.nav-links a{color:var(--mut);text-decoration:none}.wrap{max-width:1180px;margin:auto;padding:38px 22px 70px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:center;padding:38px 0}.eyebrow{color:#58c6ff;font-weight:800;text-transform:uppercase;letter-spacing:.13em;font-size:11px}.hero h1{font-size:clamp(38px,5vw,68px);line-height:1.02;margin:10px 0 16px}.hero p{font-size:18px;color:var(--mut)}.cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.btn{display:inline-flex;padding:10px 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;font-weight:750;background:var(--panel)}.btn.primary{background:#0d79c5;border-color:#189ee9;color:white}.hero img,.shot img{width:100%;border:1px solid #234762;border-radius:15px;box-shadow:0 24px 70px #0008}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.card{padding:17px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(145deg,#0d1d2e,#091521)}.card h3{margin:0 0 7px}.card p{margin:0;color:var(--mut);font-size:13px}.section{padding:35px 0}.section h2{font-size:30px;margin:0 0 16px}.shots{display:grid;grid-template-columns:1fr 1fr;gap:16px}.wiki-layout{display:grid;grid-template-columns:230px 1fr;gap:32px}.wiki-side{position:sticky;top:84px;align-self:start;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.wiki-side a{display:block;padding:6px 8px;color:var(--mut);text-decoration:none;border-radius:7px}.wiki-side a:hover{background:#11304a;color:#9edfff}.prose{min-width:0}.prose h1{font-size:36px}.prose h2{margin-top:36px;border-bottom:1px solid var(--line);padding-bottom:7px}.prose code{background:#0b2135;padding:2px 5px;border-radius:5px}.prose pre{overflow:auto;background:#020a12;border:1px solid var(--line);padding:14px;border-radius:10px}.prose table{border-collapse:collapse;width:100%}.prose th,.prose td{border:1px solid var(--line);padding:7px}.footer{border-top:1px solid var(--line);padding:28px 22px;color:var(--mut);text-align:center}@media(max-width:820px){.hero{grid-template-columns:1fr}.shots{grid-template-columns:1fr}.wiki-layout{grid-template-columns:1fr}.wiki-side{position:static}.nav-links{gap:8px;font-size:12px}}
`;
writeFileSync(join(out, "site.css"), siteCss);

const nav = `<div class="nav"><a class="brand" href="/glt-flow-card/">◈ GLT Flow Card</a><div class="nav-links"><a href="/glt-flow-card/editor/">Online Editor</a><a href="/glt-flow-card/wiki/Home.html">Wiki</a><a href="https://github.com/Xerolux/glt-flow-card">GitHub</a><a href="https://github.com/sponsors/Xerolux">Sponsor</a></div></div>`;
const footer = `<div class="footer">GLT Flow Card · Open Source · MIT · Made for Home Assistant</div>`;

const home = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GLT Flow Card · Home Assistant BMS Designer</title><meta name="description" content="Modern GLT/BMS/SCADA visualization and drag-and-drop designer for Home Assistant"><link rel="stylesheet" href="site.css"></head><body>${nav}<main class="wrap"><section class="hero"><div><div class="eyebrow">Home Assistant · GLT · BMS · SCADA</div><h1>Engineering Workspace für moderne Anlagenvisualisierung.</h1><p>Drag & Drop, Neo 2030, YAML Round-Trip, Projektbibliothek, Replay, Multi-Axis-Trends, Alarme, Wartung, Rechte, Audit und Reports – mit echten Home-Assistant-Entities.</p><div class="cta"><a class="btn primary" href="editor/">Online Editor starten</a><a class="btn" href="wiki/Home.html">Dokumentation</a><a class="btn" href="https://github.com/Xerolux/glt-flow-card">Repository</a></div></div><img src="images/feature-overview.svg" alt="GLT Flow Card Feature Overview"></section><section class="section"><h2>Vom Lovelace-Card-Projekt zum GLT-Engineering-Tool</h2><div class="grid">${[
["Designer","Visueller Drag-&-Drop-Editor direkt in Home Assistant, Entity-Picker, Gruppen und Auto-Routing."],
["YAML Round-Trip","Vorhandene YAML importieren, grafisch bearbeiten und ohne Verlust unbekannter Schlüssel wieder exportieren."],
["Projekte & Versionen","Autosave, Projektbibliothek, Vorlagen, Versionen und optional persistente HA-Companion-Integration."],
["Betrieb","Alarme, Quittierung, Bedienrechte, Audit-Log, Wartungsassets und Berichte."],
["Analyse","Replay, mehrere Y-Achsen, Min/Max/Mittel, Energieintegration, 24h-Vergleich und CSV."],
["Multi-Site","Standortübersicht und Filterung mehrerer Anlagen/Teilbereiche in einer Visualisierung."]].map(([h,p])=>`<div class="card"><h3>${h}</h3><p>${p}</p></div>`).join("")}</div></section><section class="section shots"><div class="shot"><h2>Neo 2030</h2><img src="images/neo2030-dashboard.svg" alt="Neo 2030 GLT Dashboard"></div><div class="shot"><h2>HA Designer</h2><img src="images/ha-designer.svg" alt="GLT Drag and Drop Designer"></div></section><section class="section"><h2>Drei Designwelten</h2><div class="grid"><div class="card"><h3>Neo 2030</h3><p>Dunkle Premium-Optik, moderne Symbole, subtile Glows und hohe Informationsdichte.</p></div><div class="card"><h3>Clean</h3><p>Helle, reduzierte Oberfläche für Wohnbau, Technikräume und klare Dashboards.</p></div><div class="card"><h3>Classic SCADA</h3><p>Bewusst traditionelle GLT/SCADA-Darstellung für bekannte technische Workflows.</p></div></div></section></main>${footer}</body></html>`;
writeFileSync(join(out, "index.html"), home);

const wikiDir = join(root, "docs", "wiki");
const wikiFiles = ["Home.md","Installation.md","Designer.md","YAML-Projects.md","Symbols-Routing.md","Alarms-Controls.md","Trends-Reports.md","Assets-Maintenance.md","Permissions-Audit.md","Multi-Site.md","Companion-Backend.md","Configuration.md","Examples.md","FAQ.md"];
const side = wikiFiles.map((f) => `<a href="${basename(f,".md")}.html">${basename(f,".md").replaceAll("-"," ")}</a>`).join("");
for (const file of wikiFiles) {
  const path = join(wikiDir, file);
  if (!existsSync(path)) continue;
  const body = marked.parse(readFileSync(path, "utf8"));
  writeFileSync(join(out,"wiki",`${basename(file,".md")}.html`),`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${basename(file,".md")} · GLT Flow Card</title><link rel="stylesheet" href="../site.css"></head><body>${nav}<main class="wrap wiki-layout"><aside class="wiki-side">${side}</aside><article class="prose">${body}</article></main>${footer}</body></html>`);
}

cpSync(join(root,"docs","editor"),join(out,"editor"),{recursive:true});
if (existsSync(join(root,"docs","images"))) cpSync(join(root,"docs","images"),join(out,"images"),{recursive:true});
if (existsSync(join(root,"examples"))) cpSync(join(root,"examples"),join(out,"examples"),{recursive:true});
cpSync(join(root,"node_modules","js-yaml","dist","js-yaml.mjs"),join(out,"vendor","js-yaml.mjs"));
writeFileSync(join(out,".nojekyll"),"");
