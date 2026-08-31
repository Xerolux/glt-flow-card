# GLT Flow Card

[![HACS](https://img.shields.io/badge/HACS-custom-41BDF5.svg)](https://hacs.xyz/)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-18BCF2.svg)](https://www.home-assistant.io/)

**GLT Flow Card** ist eine moderne, frei konfigurierbare Gebäudeleit-/Anlagenkarte für Home Assistant. Sie verbindet ein professionelles GLT-Anlagenschema mit Live-Entitäten, animierten Medienströmen, optionalen Anlagenfotos, Replay, Mehrfach-Trends und frei definierbaren KPI-Kacheln.

*[English version](README.md)*

> Unabhängiges Open-Source-Projekt, nicht mit iDM Energiesysteme verbunden. Die Idee orientiert sich allgemein an professionellen GLT/BMS-Oberflächen und den öffentlich beschriebenen [iVIS](https://www.idm-energie.at/ivis/)-Funktionen; Oberfläche, Code und Konfigurationsmodell sind eigenständig.

## Funktionen

- **Professionelles GLT-Schema** mit frei platzierbaren Anlagen, Datenpunkten und Leitungen.
- **Pan & Zoom** per Maus, Mausrad, Touch-Drag und Pinch-Zoom.
- **Beliebig viele Ansichten**: Anlagenschema, Anlagenbild, Grundriss, Detailansicht usw.
- **Verortung von Datenpunkten je Ansicht**: dieselbe HA-Entität kann im Schema und auf einem echten Anlagenfoto an unterschiedlichen Stellen liegen.
- **Animierte Medienströme** für Heizung, Kühlung, Warmwasser, Wärmequelle, RLT und elektrische Energie.
- **Replay-Modus mit Zeitbalken** auf Basis von Home Assistant Recorder/History.
- **Trenddiagramme mit Mehrfach-Auswahl**.
- **Kundenspezifische KPIs** aus beliebigen Home-Assistant-Entitäten bzw. Template-Sensoren.
- **Eigene Bilder** als komplette Anlagenansicht oder als einzelnes Anlagenobjekt.
- **Live- und Replay-Werte direkt an der richtigen Stelle**.
- **Hell-/Dunkelmodus**, responsive Darstellung und reduzierte Animationen bei entsprechender Systemeinstellung.
- **Basis-Editor** für globale Optionen; die komplette Anlagengeometrie ist über YAML konfigurierbar.

## Installation

### HACS

1. HACS → Drei-Punkte-Menü → **Benutzerdefinierte Repositories**.
2. `https://github.com/Xerolux/glt-flow-card` als **Dashboard** hinzufügen.
3. **GLT Flow Card** installieren und Home Assistant / Browser neu laden.

### Manuell

1. `dist/glt-flow-card.js` nach `config/www/glt-flow-card.js` kopieren.
2. `/local/glt-flow-card.js` als **JavaScript-Modul** bei den Dashboard-Ressourcen eintragen.

## Schnellstart

```yaml
type: custom:glt-flow-card
title: Heizzentrale
canvas:
  width: 1600
  height: 900
  viewport_height: 620
views:
  - id: schematic
    name: Anlagenschema
    kind: schematic
  - id: plant
    name: Anlagenbild
    kind: image
    background: /local/glt/heizzentrale.jpg

equipment:
  - id: hp
    type: heat_pump
    name: Wärmepumpe
    x: 120
    y: 320
    width: 260
    entity: switch.waermepumpe
    state_entity: binary_sensor.waermepumpe_laeuft
    fields:
      - label: Vorlauf
        entity: sensor.waermepumpe_vorlauf
      - label: Rücklauf
        entity: sensor.waermepumpe_ruecklauf

paths:
  - id: vl
    medium: heating_supply
    flow: binary_sensor.waermepumpe_laeuft
    temperature: sensor.waermepumpe_vorlauf
    points:
      - [380, 370]
      - [760, 370]
      - [760, 220]

datapoints:
  - id: flow_temp
    label: Vorlauf
    kind: temperature
    entity: sensor.waermepumpe_vorlauf
    positions:
      schematic: { x: 620, y: 335 }
      plant: { x: 930, y: 240 }
```

## Ansichten und eigenes Anlagenbild

```yaml
views:
  - id: schematic
    name: Anlagenschema
    kind: schematic
  - id: photo
    name: Anlagenbild
    kind: image
    background: /local/glt/heizzentrale.jpg
    background_fit: cover
```

Bei `kind: image` bleiben Datenpunkte sichtbar; Leitungen und Anlagenobjekte sind zunächst ausgeblendet. Mit `show_paths: true` bzw. `show_equipment: true` können sie auch über dem Foto eingeblendet werden.

## Datenpunkte zwischen Schema und Bild verorten

```yaml
datapoints:
  - id: ruecklauf_b34
    label: Rücklauf B34
    kind: temperature
    entity:
      entity: sensor.ruecklauf_b34
      decimals: 1
    positions:
      schematic: { x: 960, y: 520 }
      photo: { x: 428, y: 356 }
```

Damit bleibt der Datenpunkt logisch identisch, erscheint aber in jeder Ansicht genau an der passenden Position.

## Eigene Anlagenbilder / Symbole

```yaml
equipment:
  - id: sonderanlage
    type: image
    name: Sonderanlage
    image: /local/glt/sonderanlage.svg
    x: 500
    y: 180
    width: 280
    fields:
      - label: Leistung
        entity: sensor.sonderanlage_leistung
    slots:
      - label: T1
        entity: sensor.sonderanlage_t1
        x: 60
        y: 120
```

## Replay

```yaml
replay:
  enabled: true
  hours: 168
  step_minutes: 15
  autoplay_ms: 900
```

Der Replay-Modus lädt die Home-Assistant-Historie, stellt den gewünschten Zeitpunkt über einen Zeitbalken ein und lässt Messwerte sowie Anlagenzustände an diesem Zeitpunkt wiedergeben.

## Trenddiagramme mit Mehrfachauswahl

```yaml
trend:
  enabled: true
  hours: 168
  max_series: 8
  height: 260
```

Im Trendbereich können mehrere konfigurierte Datenpunkte gleichzeitig gewählt werden. `trend: false` blendet einen Datenpunkt aus der Trend-Auswahl aus.

## Kundenspezifische KPIs

```yaml
kpis:
  - name: COP
    icon: mdi:gauge
    entity: sensor.idm_cop
    good_above: 4
    warn_below: 3
    critical_below: 2
  - name: Heizleistung
    icon: mdi:radiator
    entity: sensor.idm_heizleistung
  - name: Stromaufnahme
    icon: mdi:flash
    entity: sensor.idm_elektrische_leistung
```

Komplexe Kennzahlen werden am besten als Home-Assistant-Template-Sensor berechnet und anschließend als KPI dargestellt.

## iDM-Beispiel

[`examples/idm-alm6-15.yaml`](examples/idm-alm6-15.yaml) ist als praxisnahes Beispiel für eine iDM-Anlage angelegt – mit Heizkreis D, Hydraulik, Replay, KPIs und zweiter Ansicht für ein echtes Anlagenfoto.

## Roadmap

- Drag-&-Drop-Anlageneditor direkt im Home-Assistant-Karteneditor.
- Weitere GLT-/DIN-/ISO-Symbole.
- Alarm-/Ereignisliste mit Quittieransicht.
- Separate Trendachsen je Einheit und Statistikansichten.
- Raummanager / Grundrissansicht.
- Anlagenpark / Multi-Site-Übersicht.

## Lizenz

MIT
