# Getting started

Five steps from installing to your own plant diagram.

## 1 · Install

HACS → Custom repositories → add `https://github.com/Xerolux/glt-flow-card` as a
**Dashboard** → install **GLT Flow Card** → reload the browser. Or copy
`dist/glt-flow-card.js` to `/config/www/` and register `/local/glt-flow-card.js`
as a JavaScript module.

## 2 · Load a template

Edit the dashboard → add the GLT Flow Card → in the designer press
**Templates** and load one of the 20 factory templates (heat pump, PV, solar
thermal, AHU, cooling, boiler, cascade, district heat …). The template carries
structure and wording — entities stay yours to assign.

## 3 · Assign entities

**In Home Assistant:** click a component and pick entities through the native
picker — or use Auto-Map (↯), the profile-based scorer.

**In the online designer** (no HA connection): press **Entities** → export a
file in HA (designer button „Entities" ⇒ ⇩) → import it here (⇧) → every
entity field then offers suggestions; double-click a component to assign its
main entity.

## 4 · Connect & refine

Draw pipes in the designer: source port first, then target. If the pair does
not fit, the status area states the reason in words. Ctrl+Z / Ctrl+Y corrects
every step; **Save as** downloads the Lovelace YAML as a file. YAML can also
be dragged onto the canvas directly.

## 5 · Done

The card runs: KPIs with live values, animated media flows as soon as a pump
runs, the menu (☰) with Operations (operations, alarms, trends, energy) and
View (trend chart, zoom, fullscreen), replay, and the deliberate choice among
Neo 2030, Clean, Classic SCADA and three more design systems — decided in the
designer, not at the kiosk.

---

Next: [Installation](Installation.en) · [Designer](Designer.en) ·
[Examples](Examples.en) · [Configuration](Configuration.en) · [FAQ](FAQ.en)
