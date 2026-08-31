# Changelog

## 0.4.0 - 2026-08-31

- YAML round-trip import/export with js-yaml and unknown-key preservation in the project object.
- Project library, autosave, version history and reusable component/sub-plant templates.
- Optional Home Assistant companion backend for cross-device project/template storage and server-side audit metadata.
- Multi-selection groups and group movement.
- Orthogonal automatic routing linked to equipment endpoints.
- Alarm/message panel with optional acknowledgement service.
- Viewer/operator/designer access roles and control confirmation.
- Audit log for project, YAML, control, alarm and report actions.
- Maintenance asset view with operating hours, service interval, due date, documents and parts metadata.
- Multi-site overview and site filtering.
- Trend+ multi-axis analytics, min/max/average, power-to-energy integration, previous-24h comparison and CSV export.
- CSV and printable/PDF reports.
- GitHub Pages site, hosted online editor, Wiki source pages and sponsorship metadata.
- New README screenshots for Neo 2030, HA Designer and Clean.


## 0.3.0 - 2026-08-31

- Added Neo 2030 visual system while keeping Clean and Classic SCADA modes.
- Added runtime style switch and designer appearance selector.
- Added 50+ component/symbol variants across heating, hydraulics, ventilation, cooling, energy and sensors.
- Added Home Assistant native entity pickers with domain filtering throughout the drag-and-drop designer.
- Added live card preview inside the designer.
- Added Lovelace YAML generation and one-click copy.
- Added symbol-aware rendering and a new Neo 2030 iDM example.


## 0.2.0 - 2026-08-31

- Replaced the basic form editor with a full professional drag-and-drop GLT designer.
- Component palette for heat pumps, tanks, pumps, fans, valves, heat exchangers, boilers, AHUs, zones, meters, custom images and data points.
- Drag, resize and keyboard positioning with optional grid snapping.
- Editable media paths with draggable routing points and animated medium colours.
- Per-view data-point placement for schematic ↔ plant-photo localization.
- Property inspector for entities, dimensions, labels, images, media properties and KPIs.
- Add image views from the editor; configure background image, fit and overlays.
- Undo/redo, duplicate/delete, zoom/fit and responsive editor layout.
- Editor keeps YAML compatibility and custom image/SVG support.

## 0.1.0 - 2026-08-31

Initial public alpha.

- Modern configurable GLT/BMS canvas for Home Assistant.
- Animated media paths with configurable plant equipment and live data points.
- Pan, zoom, mouse/touch drag and pinch zoom.
- Multiple schematic/image views.
- Per-view data-point positioning for switching between schematic and plant photo.
- Custom image equipment and positioned value slots.
- Home Assistant History-based replay mode with timeline and autoplay.
- Multi-select trend diagram.
- Customer-specific KPI strip.
- iDM-oriented example configuration.
- Basic visual editor for global card options.
- HACS metadata and validation workflow.
