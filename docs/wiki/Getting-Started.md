# Getting Started · Schnellstart

Fünf Schritte von der Installation zum eigenen Anlagenbild. — Five steps from
installing to your own plant diagram.

## 1 · Installation (DE)

HACS → Benutzerdefinierte Repositories → `https://github.com/Xerolux/glt-flow-card`
als **Dashboard** hinzufügen → **GLT Flow Card** installieren → Browser neu laden.
Alternativ `dist/glt-flow-card.js` nach `/config/www/` kopieren und als
JavaScript-Modul `/local/glt-flow-card.js` eintragen.

## 1 · Install (EN)

HACS → Custom repositories → add `https://github.com/Xerolux/glt-flow-card` as a
**Dashboard** → install **GLT Flow Card** → reload the browser. Or copy
`dist/glt-flow-card.js` to `/config/www/` and register `/local/glt-flow-card.js`
as a JavaScript module.

## 2 · Vorlage laden (DE)

Dashboard bearbeiten → GLT Flow Card hinzufügen → im Designer den Knopf
**Vorlagen** wählen und eine der 20 Werks-Vorlagen laden (Wärmepumpe, PV,
Solarthermie, RLT, Kälte, Kessel, Kaskade, Fernwärme …). Die Vorlage bringt
Struktur und Beschriftung mit — Entities bleiben frei.

## 2 · Load a template (EN)

Edit the dashboard → add the GLT Flow Card → in the designer press
**Templates** and load one of the 20 factory templates (heat pump, PV, solar
thermal, AHU, cooling, boiler, cascade, district heat …). The template carries
structure and wording — entities stay yours to assign.

## 3 · Entities zuordnen (DE)

**In Home Assistant:** Bauteil anklicken und Entities über den nativen Picker
wählen — oder Auto-Map (↯) nutzt die Profil-Scoring-Funktion.

**Im Online-Designer** (ohne HA-Verbindung): Knopf **Entities** → in HA als
Datei exportieren (Designer-Knopf „Entities" ⇒ ⇩) → hier importieren (⇧) →
jedes Entity-Feld bietet danach Vorschläge; Doppelklick auf ein Bauteil weist
die Haupt-Entity zu.

## 3 · Assign entities (EN)

**In Home Assistant:** click a component and pick entities through the native
picker — or use Auto-Map (↯), the profile-based scorer.

**In the online designer** (no HA connection): press **Entities** → export a
file in HA (designer button „Entities" ⇒ ⇩) → import it here (⇧) → every
entity field then offers suggestions; double-click a component to assign its
main entity.

## 4 · Verbinden & verfeinern (DE)

Leitungen im Designer ziehen: Quell-Port, dann Ziel-Port. Passt das Paar
nicht, nennt der Statusbereich den Grund in Worten. Strg+Z / Strg+Y korrigiert
jeden Schritt; **Speichern unter** lädt das Lovelace-YAML als Datei. YAML
lässt sich auch direkt auf die Zeichenfläche ziehen.

## 4 · Connect & refine (EN)

Draw pipes in the designer: source port first, then target. If the pair does
not fit, the status area states the reason in words. Ctrl+Z / Ctrl+Y corrects
every step; **Save as** downloads the Lovelace YAML as a file. YAML can also
be dragged onto the canvas directly.

## 5 · Fertig (DE)

Die Karte läuft: KPIs mit Live-Werten, animierte Medienflüsse sobald eine
Pumpe läuft, Menü (☰) mit Bedienung (Betrieb, Alarme, Trends, Energie) und
Ansicht (Trend-Diagramm, Zoom, Vollbild), Replay und der stilvolle Wechsel
zwischen Neo 2030, Clean, Classic SCADA und drei weiteren Designsystemen —
entschieden im Designer, nicht auf der Kiosk-Ansicht.

## 5 · Done (EN)

The card runs: KPIs with live values, animated media flows as soon as a pump
runs, the menu (☰) with Operations (operations, alarms, trends, energy) and
View (trend chart, zoom, fullscreen), replay, and the deliberate choice among
Neo 2030, Clean, Classic SCADA and three more design systems — decided in the
designer, not at the kiosk.

---

Weiter: [Installation](Installation) · [Designer](Designer) ·
[Beispiele](Examples) · [Konfiguration](Configuration) · [FAQ](FAQ)

Next: [Installation](Installation.en) · [Designer](Designer.en) ·
[Examples](Examples.en) · [Configuration](Configuration.en) · [FAQ](FAQ.en)
