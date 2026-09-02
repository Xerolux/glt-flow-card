# GLT Flow Card

[![HACS](https://img.shields.io/badge/HACS-custom-41BDF5.svg)](https://hacs.xyz/)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-custom%20card-18BCF2.svg)](https://www.home-assistant.io/)

**GLT Flow Card** is a modern, freely configurable building-management / BMS visualization for Home Assistant. It combines a professional plant schematic with live Home Assistant entities, animated media flows, optional plant photos, history replay, multi-series trends and customer-specific KPI tiles.

*[Deutsche Version](README.de.md)*

> The project is independent and is not affiliated with iDM Energiesysteme. The concept is inspired by professional GLT/BMS visualizations and by public [iVIS](https://www.idm-energie.at/ivis/) product features, while using its own UI, code and configuration model.

<!-- GLT-SHOWCASE:START -->

## GLT / SCADA showcase

The following images are generated automatically from the **current GitHub Pages UI and current online designer**. They show the same detailed plant in different visual systems — without custom plant images: pumps, 2/3-way valves, mixers, hydraulic separators, immersion heaters, tanks, heat exchangers, sensors, media paths, alarms, replay and trends.

<table>
<tr><th width="50%">Neo 2030 · Dark</th><th width="50%">Neo / Operations · Light</th></tr>
<tr><td><img src="docs/images/neo2030-dark-live.png" alt="Neo 2030 Dark GLT"></td><td><img src="docs/images/neo2030-light-live.png" alt="Neo 2030 Light GLT"></td></tr>
</table>

<table>
<tr><th width="50%">Classic SCADA</th><th width="50%">P&amp;ID Dark</th></tr>
<tr><td><img src="docs/images/classic-scada-live.png" alt="Classic SCADA GLT"></td><td><img src="docs/images/pid-dark-live.png" alt="P&ID Dark GLT"></td></tr>
</table>

### Designer · dark and light

<table>
<tr><th width="50%">Designer Dark</th><th width="50%">Designer Light</th></tr>
<tr><td><img src="docs/images/designer-dark-live.png" alt="GLT Flow Card Designer Dark"></td><td><img src="docs/images/designer-light-live.png" alt="GLT Flow Card Designer Light"></td></tr>
</table>

### Detailed symbol library

![GLT Flow Card symbol library](docs/images/symbol-library-live.png)

> Controllable plant objects can open an equipment control panel in Home Assistant or execute configured HA services. The GitHub Pages demo simulates this control layer without switching a real plant.

<!-- GLT-SHOWCASE:END -->

<!-- GLT-V1:START -->

## GLT Engineering Platform 1.0

**Version 1.0** evolves GLT Flow Card from a visualization into a Home Assistant based GLT/BMS/SCADA engineering platform while keeping the six visual presets and the drag-and-drop workflow.

- complete operational-state model: Auto, Manual, Local, Remote, Fault, Warning, Locked, Interlock, Maintenance, communication/stale/invalid and command states;
- rich equipment controls with server-side authorization through the Companion;
- alarm lifecycle 2.0 with priority/class, hysteresis, delay, acknowledgement/comment, shelving, history, notifications and escalation;
- weekly schedules and calendars; semantic site/building/floor/system/equipment hierarchy;
- automatic Home Assistant entity mapping and parametric equipment profiles;
- 250+ symbol variants, smart ports, obstacle-aware routing and CAD engineering tools;
- drill-down, Historian aggregation, simulation, commissioning diagnostics, energy, maintenance/work orders and reports;
- remote Home Assistant sites, plugin SDK, project diff, `.gltproject` bundles, server audit/locking and i18n foundation.

> The **GLT Flow Card Companion** is recommended for secure controls, cross-device projects, alarms, schedules, audit, locks and remote Home Assistant sites. The dashboard card still works standalone.

**[Design Showcase](https://xerolux.github.io/glt-flow-card/showcase.html)** · **[Platform 1.0](https://xerolux.github.io/glt-flow-card/platform.html)** · **[Online Designer](https://xerolux.github.io/glt-flow-card/editor/)**

<!-- GLT-V1:END -->


## Highlights

- **Professional GLT canvas** with freely positioned equipment, data points and media paths.
- **Pan & zoom** with mouse, wheel, touch drag and pinch zoom.
- **Multiple views** such as `Anlagenschema`, `Anlagenbild`, floor plan or detail view.
- **Data-point localization between views**: the same entity can have a different position on a schematic and on a real plant photo.
- **Animated flow paths** for heating, cooling, DHW, source circuits, air systems and electrical power.
- **Replay mode with time bar** using Home Assistant Recorder/History data.
- **Trend diagrams with multi-selection** of data points.
- **Custom KPIs** backed by any Home Assistant entity or template sensor.
- **Custom images** for complete views or individual equipment objects.
- **Live / replay values at the exact plant position**.
- **Light/dark theme aware** and responsive.
- **Full drag & drop plant designer** for equipment, media paths, data points, KPIs and image views — YAML remains available for advanced setups.

## Installation

Requires Home Assistant 2024.8.0 or newer. Release validation installs the exact
staged dashboard card and Companion ZIP on immutable minimum/current HA lanes.

### Verified project and release boundary

Phase 1 verifies raw validation errors before normalization, sequential dry-run
migration and rollback, semantic diff categories and dependency closure,
conflict-safe selective apply, bounded `.gltproject` bundle handling, Companion
lifecycle cleanup, and exact source/build/stage/browser/Home Assistant release
identities. These are executable Node, Python, browser, and immutable HA-lane
checks; source-token matches and screenshots are not accepted as evidence.

The HACS custom repository above is the public **Dashboard** plugin. The
Companion is delivered as `glt-flow-card-companion.zip` in this repository's
release. Its HACS **Integration** shape is a local integration-category stage
used only for release validation; it is not a separately published HACS
integration repository.

Standalone mode remains suitable for local visualization and browser-local
engineering. Shared projects, authoritative migration/apply/rollback, locks,
audit, schedules, remote operations, and other privileged shared mutations
require the configured Companion and fail closed when that authority is
required but unavailable. The automated evidence performs no physical plant
write. The 100/500/2,000-object fixtures prove bounded correctness only; this is
not a capacity certification, which remains Phase 10 work.

### Shared authority and collaboration

Phase 2 makes the Companion the only authority for shared projects. The browser
may use a capability snapshot to decide what to *show*; it never uses one to
decide what is *allowed*. Every shared request is authorized again on the
server, at the WebSocket boundary, before any handler runs.

**Fixed roles.** A project assignment is exactly one of **Viewer**, **Operator**,
**Engineer** or **Admin**. The set is closed and lives in the Companion's own
access list. Project JSON, an imported `.gltproject` bundle, browser storage, a
URL parameter and a form field never contribute a role or a capability. There
are no per-user capability checkboxes: capabilities follow from the role.

**Home Assistant administrators.** Being a Home Assistant administrator does not
grant content authority. It grants exactly one thing: the ability to read and
repair project membership, so an installation cannot lock itself out. An
administrator with no project assignment can see who holds what and change it —
and nothing else: no project content, no controls, no evidence.

**Non-enumeration.** A project you may not see and a project that does not exist
answer identically. Lists, searches and counts omit what you are not authorized
to see rather than showing a redacted placeholder, because a placeholder still
answers "there is something here".

**Leases and revisions.** Editing shared content requires an exclusive
engineering lease. A lease is ephemeral, bound to the connection that acquired
it, rotates its bearer on every renewal, and expires on a monotonic clock with
no grace period; nothing about it is persisted, so a restart cannot resurrect
one. TTLs are 60 to 900 seconds, default 300. A lease held elsewhere is reported
anonymously: who is editing is a membership question, not a lease question.

Content revisions and access revisions are separate streams. A membership change
does not invalidate a save in flight, and a save does not renumber membership.
Every mutation carries the exact revision it believes it is acting on, and the
server re-checks the whole authority chain inside its own commit lock.

**Conflicts.** A newer revision blocks a save and preserves your candidate in
memory. Recovery is refresh, a server-computed merge preview, retry with a fresh
lease, or an explicit discard. There is no overwrite and no force, and no
last-writer-wins path anywhere: unsaved work is cleared only by an authoritative
committed receipt or by you saying so.

**Configured controls.** A control request names a control identifier, the
revision it is acting on, and the bounded input that control's own schema
declares. The domain, the service, the target and every immutable field are
resolved by the server from the verified project head — the browser cannot name
them, and a request that tries is refused before Home Assistant is asked
anything. An operator can run a configured control without holding the
engineering lease: operating a plant and engineering a project are different
activities. There is exactly one dispatch attempt and no automatic retry.

**Evidence.** Server-authored trusted evidence and browser-authored telemetry
live in separate stores with separate schemas, bounds, cursors and read paths,
and are never merged into one timeline or one export. Only a confirmed readback
is reported as a completed control: "accepted" means the server wrote it down,
"dispatched" means Home Assistant was asked, and a timeout or an unknown result
says so and points you at the current state rather than at a retry button. The
older client-authored audit route is retired; a browser can write telemetry, and
telemetry is permanently labelled untrusted.

Evidence pages use short-lived server-state cursors. Page size is fixed and no
total is exposed; a cursor is bound to the connection that created it and dies
with the runtime generation.

**Local-only projects.** A local-only project is a separate, explicitly labelled
mode. A shared project never silently becomes a local one, and losing Companion
authority makes shared editing read-only rather than falling back to a
privileged local path.

**Remote sites.** Remote listing, remote states and remote control are declared
and fail closed with `feature_unavailable`. The remote transport is Phase 9 work
and is not available in this release.

**Upgrading.** The legacy 30–3600 second lock window does not survive the
upgrade: a stored value is clamped into the 60–900 second lease window rather
than reset, so a deliberate choice becomes the nearest legal one. A persisted
legacy lock is dropped rather than turned into a lease — a row in a file has no
connection to bind to and nobody holding it. Legacy audit rows are kept and
labelled `legacy_untrusted` rather than deleted, so they can never be read as a
claim about who did what. A legacy permissions block on the active head may seed
membership once, conservatively, into fixed roles it already implied and never
into Admin; an imported candidate can never seed membership at all. Every step
is idempotent.

**What the evidence does and does not cover.** The Phase-2 checks run on the
same immutable minimum and current Home Assistant lanes as Phase 1, against the
exact staged artifact. They perform no physical plant write, contact no remote
site, handle no credential, and are not a statement about capacity or about
public Companion availability.

### Semantic model, provenance and equipment state

Phase 3 gives the product one validated equipment model, and schema version 3
to express it.

**The hierarchy.** Site → building → floor → system → subsystem → equipment →
datapoint, with exactly one parent per node. A child may sit at its parent's
level — a subsystem inside a subsystem is ordinary plant — but never above it.
A dangling parent, a containment cycle of any length, a level inversion, a
duplicate id, or a tree past its depth or breadth bound is a contract error with
a stable path, in both runtimes. The semantic path is derived from the parents
and never stored: a stored path is a second source of truth that starts agreeing
with its parents and stops without telling anyone.

**Closed vocabularies.** Units, media, directions and semantic tags are declared
sets; an unknown member is a validation error rather than a passthrough string.
Units carry their dimension, so kW and kWh are not interchangeable to a naive
prefix match — binding power to an energy slot yields a number wrong by a unit of
time that looks entirely plausible.

**Upgrading.** Schema 2 projects migrate to 3 through the same sequential,
receipted, dry-run-first machinery as earlier versions. Nothing is dropped.

**Provenance.** A datapoint's integration, config entry, device, area and
communication health are read from Home Assistant's own registries and state
machine. Nothing is inferred from an entity id or a friendly name: a plant where
`sensor.knx_return_temperature` is served by Modbus is not unusual. The card
implements no fieldbus driver and opens no connection of its own. It reports the
integration that owns an entity; of the protocols this product cares about,
Modbus and KNX are Home Assistant core integrations, while BACnet and OPC UA are
served by whatever integration an installation provides, so an unrecognised
domain is reported as itself rather than dressed up as support the card cannot
verify. Health resolves in a fixed order — disabled, then unavailable, then
stale — because an entity switched off deliberately is a different situation
from one that is merely quiet.

Provenance is a project-scoped read behind the Phase-2 boundary, and it
describes only entities the project itself references, so it can never become a
way to search the registry.

**Profiles.** A profile carries an identity, a semantic version, slots, controls,
state signals, alarms, ports, diagnostics, maintenance metadata and symbols. Two
instantiations of one version are identical. An upgrade carries every override
that still applies and reports the ones it cannot, rather than dropping them
silently. A profile control names a control id, its bounded input schema and its
gates — never a domain, a service or a target, because that is the
caller-authored control path Phase 2 removed.

**Mapping.** Candidates are ranked from device membership, the profile slot's
expectation, area agreement, integration agreement, unit compatibility and —
last, and never sufficient on its own — name similarity. Every candidate carries
the reasons that produced its score. Ranking is an assignment: an entity that
plainly answers another slot is not this slot's answer. An entity whose name
carries a role the slot does not declare is not a candidate at all, because a
setpoint is not its measurement. Nothing binds without an explicit acceptance,
and a manual override is stored as a decision, so a later re-rank cannot
overrule an engineer who already looked at it.

**Operational state.** Sixteen conditions resolve through a fixed precedence to
exactly one state. Trust outranks activity: a communication error, an invalid
value or a stale reading is never reported as running, however recently it said
so, because the card does not know that it is. `auto` and `remote` qualify the
state rather than replacing it, so an operator reads "running · remote". Symbol,
colour, label and drill-down are projections of the one resolved value, so they
cannot disagree, and every state carries a shape and a word as well as a colour.

### HACS

1. HACS → three dots → **Custom repositories**.
2. Add `https://github.com/Xerolux/glt-flow-card` as **Dashboard**.
3. Install **GLT Flow Card** and reload Home Assistant.

### Manual

1. Copy `dist/glt-flow-card.js` to `config/www/glt-flow-card.js`.
2. Add `/local/glt-flow-card.js` as a **JavaScript module** under Dashboard resources.

### Runtime operations and drill-down

Phase 4 turns the model into something an operator can work in.

**The object panel is composed on the server.** Every profiled object opens the
same panel — identity, state, values, runtime counters, quality, alarms,
controls and trend — without a hand-designed popup per equipment type. The
control list arrives already filtered: a control you may not execute is
*absent*, not greyed out, because a disabled control still tells you the control
exists. The panel carries no domain, service or entity target at all, so nothing
in the browser holds something it could dispatch directly.

**Operating hours and starts** come from profile-declared datapoints, which is
why they appear without any history query.

**Trends are not available yet.** The trend region renders a declared
"unavailable" state. Honest Recorder-backed history — with coverage, gaps and
provenance — is Phase 7's, and a region that says it has nothing beats one that
invents content.

**Four command outcomes, kept apart.** *Accepted* means the server wrote it
down. *Sent* means Home Assistant was asked. Only *Confirmed* means a read-back
showed the plant actually moved, and it is the only outcome shown as success.
*No confirmation*, *Effect unknown* and *Failed after dispatch* point you at the
current state and the trusted audit rather than at a retry button: repairing
forward is a new, separately authorized command, and a retry beside "effect
unknown" invites running it twice on plant that may already have moved.

**Deep links and breadcrumbs.** The address in the URL is the whole view state —
node, time window and selected alarm — so a link reproduces exactly what you were
looking at. Every link is re-authorized when it is opened, because a URL gets
pasted into a chat and opened by somebody else. A link you may not follow and one
that does not exist give the same answer.

**Counts never leak.** A roll-up covers only projects you are a member of,
totals included, and a count of zero is shown as no count rather than a "0" —
otherwise an empty view you are allowed to see would be distinguishable from one
you are not.

**Staleness is visible, permanently.** The view holds the sequence it expects.
On a gap, a reconnect or a revocation it says it is not live, keeps showing the
last values it actually observed with their age, and stops accepting input. It
never fills a gap by interpolating, and it never needs a page reload to recover.

**The legacy operate path is gone.** The old browser-side permission check —
which granted control to everyone whenever no permission list was configured —
and the tap action that called a Home Assistant service directly are both
retired and proven inert.

## Drag & Drop Designer

The visual editor is now a complete plant designer instead of a form for global options only. Open the card editor in Home Assistant and build the plant directly on the canvas:

- drag equipment, media paths, data points and KPIs from the component palette;
- move and resize equipment directly on the plant canvas;
- edit pipe routing with draggable control points;
- assign Home Assistant entities in the property inspector;
- add image views and place the same data point independently on schematic and plant photo;
- use grid snapping, zoom, duplicate, delete, keyboard nudging, undo and redo;
- use custom image/SVG URLs for complete views or individual equipment.

The editor writes the same YAML configuration documented below, so visual editing and hand-written YAML can be mixed at any time.


## Neo 2030, Clean and Classic SCADA

The card now ships with three complete visual presets. **Neo 2030** is the new dark premium look with modern symbols, restrained glow and technical typography. **Clean** keeps the bright minimal look. **Classic SCADA** remains available for users who prefer a traditional BMS/SCADA presentation. The style can be selected in the designer and optionally switched directly on the card.

## Native Home Assistant entity picker and YAML export

The integrated designer no longer requires typing entity IDs by hand. Main entities, status entities, measurements, flow/activity signals and KPIs use Home Assistant's native entity picker with sensible domain filters, giving direct access to the current Home Assistant entity catalog.

The designer also includes a **live preview** and a **Lovelace YAML drawer with copy action**, so a visually created plant can be pasted directly into a manual dashboard as `custom:glt-flow-card`.

## Extended symbol library

**456 variants** from **76 base symbols** in **6 styles**, across heating,
hydraulics, air handling, refrigeration, energy, instrumentation, electrical and
fire safety.

That number is measured, not claimed. `catalog-evidence.json` is produced by
actually rendering every variant and digesting the result, and the generator
refuses to write the file at all if a symbol draws nothing, two base symbols
produce identical geometry, or two styles carry identical tokens. A test
requires the number in this README and the number in the evidence to be the same
number.

A cross product of two axes is a set of distinct variants only if both axes are
distinct. That check is why three base symbols that drew nothing at all — and
nine more that shared another symbol's drawing — are now fixed rather than
counted.

Custom images and SVGs remain optional.

## Typed ports and explained refusals

A port carries a medium, a direction, a side, a kind (`process`, `signal`,
`power`) and a multiplicity (`one`, `many`). A connection that cannot exist is
refused with a reason from a closed set — `kind_mismatch`, `medium_mismatch`,
`direction_conflict`, `multiplicity_exceeded`, `self_connection`,
`duplicate_connection` — shown in words next to the two ports.

Unlike a permission denial, an engineering refusal is explanatory. A permission
denial is deliberately opaque because the caller must not learn what exists;
here the drawing is already open in front of the engineer, and withholding the
reason protects nothing.

A connection means a pair of equipment *and* port, so a shared profile does not
make two pumps the same endpoint. Geometry is derived from the resolved port, so
moving equipment moves the endpoint and never changes which port is meant. An
endpoint that no longer resolves is reported, never silently reattached.

## Routing

Deterministic: the same diagram routes to the same bytes, with no clock, no
randomness and no iteration over an unordered collection. A one-pixel move
rewrites one segment, because interior turns snap to the drawing grid while
ports keep their exact positions.

No route enters plant. Where none can be found, the pair is refused explicitly —
`obstructed`, `detour_exceeded`, `scene_too_complex`, `degenerate_endpoints` —
and a refusal carries no path, so nobody can draw one by accident. Previously a
blocked pair returned the first candidate: a path *through* the obstacle, handed
back silently as though it were a route.

Rerouting is local by construction rather than by optimisation: a route is
computed against the obstacles near it, found transitively, so a distant one was
never an input. Over forty routes, one move recomputes one. The bounds are
stated in segments and routes, never in milliseconds.

## Extensions

An extension pack adds symbols, profiles, templates, descriptors and
translations. It does not add code: a contribution is **data**, interpreted by
first-party code, and no contributed JavaScript is loaded, evaluated or executed
in any realm.

Not executing is necessary and not sufficient, so contributed markup is policed
by an allowlist of elements and attributes rather than a denylist. A denylist is
a promise to have thought of everything, and the list of things nobody thought
of is exactly the list that matters.

**What this forecloses**, stated rather than left implicit: any contribution
whose appearance is *computed* rather than described — a level indicator driven
by a vendor's own characteristic curve, a widget combining entities under a rule
the card does not already implement, a renderer that draws differently depending
on values beyond the declarative expressions the card defines. Every computation
must be expressible in the vocabulary the card defines. That vocabulary can
grow; a genuinely new kind of computation needs a first-party release, not a
third-party pack.

Installation is local and all-or-nothing: the manifest is validated, every
conflict is checked and every bound enforced before anything is written, so a
failed install leaves nothing to work out. The validator exists in both
JavaScript and Python, proven to reach identical verdicts over a shared corpus,
because a rule that exists only in the browser is a rule the server does not
enforce.

## Engineering Workspace 0.4

![GLT Flow Card feature overview](docs/images/symbol-library-live.png)

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

![Neo 2030 runtime](docs/images/neo2030-dark-live.png)

### Home Assistant drag-and-drop designer

![Home Assistant designer](docs/images/designer-dark-live.png)

### Clean designer option

![Clean designer](docs/images/designer-light-live.png)

## Quick start

```yaml
type: custom:glt-flow-card
title: Heating centre
canvas:
  width: 1600
  height: 900
  viewport_height: 620
views:
  - id: schematic
    name: Plant schematic
    kind: schematic
  - id: plant
    name: Plant photo
    kind: image
    background: /local/glt/plant-room.jpg

equipment:
  - id: hp
    type: heat_pump
    name: Heat pump
    x: 120
    y: 320
    width: 260
    entity: switch.heat_pump
    state_entity: binary_sensor.heat_pump_running
    fields:
      - label: Flow
        entity: sensor.heat_pump_flow_temperature
      - label: Return
        entity: sensor.heat_pump_return_temperature

paths:
  - id: supply
    medium: heating_supply
    flow: binary_sensor.heat_pump_running
    temperature: sensor.heat_pump_flow_temperature
    points:
      - [380, 370]
      - [760, 370]
      - [760, 220]

datapoints:
  - id: flow_temp
    label: Flow
    kind: temperature
    entity: sensor.heat_pump_flow_temperature
    positions:
      schematic: { x: 620, y: 335 }
      plant: { x: 930, y: 240 }

kpis:
  - name: COP
    icon: mdi:gauge
    entity:
      entity: sensor.heat_pump_cop
      decimals: 2
```

## Configuration model

### Views

A view can be a drawn GLT schematic or a real image. Any number of views is possible.

```yaml
views:
  - id: schematic
    name: Anlagenschema
    kind: schematic
  - id: photo
    name: Anlagenbild
    kind: image
    background: /local/glt/heating-centre.jpg
    background_fit: cover
  - id: ventilation
    name: RLT
    kind: schematic
```

For `kind: image`, paths and equipment are hidden by default while data points remain visible. Set `show_paths: true` or `show_equipment: true` if desired.

### Equipment

Built-in equipment types are currently:

`heat_pump`, `tank`, `pump`, `fan`, `valve`, `heat_exchanger`, `boiler`, `ahu`, `room`, `meter`, `solar`, `pv`, `grid`, `generic`, `image`.

```yaml
equipment:
  - id: buffer
    type: tank
    name: Buffer tank
    x: 650
    y: 250
    width: 240
    height: 220
    entity: sensor.buffer_top
    fields:
      - label: Top
        entity: sensor.buffer_top
      - label: Bottom
        entity: sensor.buffer_bottom
```

Use your own asset on a node:

```yaml
equipment:
  - id: custom_machine
    type: image
    name: Machine 1
    image: /local/glt/machine.svg
    x: 500
    y: 180
    width: 280
    fields:
      - label: Power
        entity: sensor.machine_power
    slots:
      - label: T1
        entity: sensor.machine_t1
        x: 60
        y: 120
```

### Media paths

Each path is a polyline in logical canvas pixels.

```yaml
paths:
  - id: hk_d_supply
    medium: heating_supply
    flow: binary_sensor.heating_circuit_d_pump
    temperature: sensor.heating_circuit_d_flow_temperature
    width: 8
    speed: 1.2
    points:
      - [820, 300]
      - [1160, 300]
      - [1160, 470]
```

Available media presets: `heating_supply`, `heating_return`, `cooling_supply`, `cooling_return`, `dhw`, `cold_water`, `source`, `air_supply`, `air_extract`, `air_outdoor`, `air_exhaust`, `electrical`, `neutral`. A custom path may override the preset with `color:`.

### Data points and image localization

```yaml
datapoints:
  - id: return_b34
    label: Return B34
    kind: temperature
    entity:
      entity: sensor.return_b34
      decimals: 1
    positions:
      schematic: { x: 960, y: 520 }
      photo: { x: 428, y: 356 }
```

This is the core of the **schema ↔ plant image** workflow: one data point, one entity, multiple physical positions.

### KPIs

KPIs are intentionally entity based. For calculated KPIs, create a Home Assistant template sensor and display it here.

```yaml
kpis:
  - name: COP
    icon: mdi:gauge
    entity: sensor.idm_cop
    good_above: 4
    warn_below: 3
    critical_below: 2
  - name: Heat output
    icon: mdi:radiator
    entity: sensor.idm_heat_output
  - name: Electrical power
    icon: mdi:flash
    entity: sensor.idm_electrical_power
```

### Replay mode

Replay uses the Home Assistant History API / Recorder data.

```yaml
replay:
  enabled: true
  hours: 168
  step_minutes: 15
  autoplay_ms: 900
```

Press the history button, move the timeline or start playback. Values, states and flow activity follow the selected historical time.

### Multi-select trends

```yaml
trend:
  enabled: true
  hours: 168
  max_series: 8
  height: 260
```

Open **Trend**, select several configured data points and compare their history in one diagram. Data points with `trend: false` are excluded from the selector.

## iDM example

[`examples/idm-alm6-15.yaml`](examples/idm-alm6-15.yaml) shows a GLT-style visualization for an iDM heat-pump installation, including heating circuit D, a buffer / hydraulic area, replay, KPIs and a second view for a real plant-room photo.

## Files

- `dist/glt-flow-card.js` – HACS / production card.
- `examples/` – ready-to-adapt YAML configurations.
- `docs/` – documentation and screenshots.
- `test/` – lightweight validation tests.

## Roadmap

- Drag-and-drop plant designer in the Home Assistant card editor.
- Additional GLT symbols and DIN/ISO-style symbol variants.
- Alarm/event list and acknowledgement view.
- Per-unit trend axes and statistics panels.
- Room manager / floor-plan widgets.
- Plant-park / multi-site overview.

## License

MIT
