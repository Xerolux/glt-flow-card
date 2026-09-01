# GLT Flow Card

[![HACS](https://img.shields.io/badge/HACS-custom-41BDF5.svg)](https://hacs.xyz/)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-18BCF2.svg)](https://www.home-assistant.io/)

**GLT Flow Card** ist eine moderne, frei konfigurierbare Gebäudeleit-/Anlagenkarte für Home Assistant. Sie verbindet ein professionelles GLT-Anlagenschema mit Live-Entitäten, animierten Medienströmen, optionalen Anlagenfotos, Replay, Mehrfach-Trends und frei definierbaren KPI-Kacheln.

*[English version](README.md)*

> Unabhängiges Open-Source-Projekt, nicht mit iDM Energiesysteme verbunden. Die Idee orientiert sich allgemein an professionellen GLT/BMS-Oberflächen und den öffentlich beschriebenen [iVIS](https://www.idm-energie.at/ivis/)-Funktionen; Oberfläche, Code und Konfigurationsmodell sind eigenständig.

<!-- GLT-SHOWCASE:START -->

## GLT / SCADA Showcase

Die folgenden Bilder werden automatisch aus der **aktuellen GitHub-Pages-Oberfläche und dem aktuellen Online-Designer** erzeugt. Sie zeigen dieselbe detaillierte Anlage in unterschiedlichen Darstellungen — ohne eigene Anlagenbilder: Pumpen, 2-/3-Wege-Ventile, Mischer, hydraulische Weiche, Heizstab, Speicher, Wärmetauscher, Sensorik, Medienleitungen, Alarme, Replay und Trends.

<table>
<tr><th width="50%">Neo 2030 · Dark</th><th width="50%">Neo / Operations · Light</th></tr>
<tr><td><img src="docs/images/neo2030-dark-live.png" alt="Neo 2030 Dark GLT"></td><td><img src="docs/images/neo2030-light-live.png" alt="Neo 2030 Light GLT"></td></tr>
</table>

<table>
<tr><th width="50%">Classic SCADA</th><th width="50%">P&amp;ID Dark</th></tr>
<tr><td><img src="docs/images/classic-scada-live.png" alt="Classic SCADA GLT"></td><td><img src="docs/images/pid-dark-live.png" alt="P&ID Dark GLT"></td></tr>
</table>

### Designer · Dark und Light

<table>
<tr><th width="50%">Designer Dark</th><th width="50%">Designer Light</th></tr>
<tr><td><img src="docs/images/designer-dark-live.png" alt="GLT Flow Card Designer Dark"></td><td><img src="docs/images/designer-light-live.png" alt="GLT Flow Card Designer Light"></td></tr>
</table>

### Detail-Symbolbibliothek

![GLT Flow Card Symbolbibliothek](docs/images/symbol-library-live.png)

> Bedienbare Anlagenobjekte können in Home Assistant eine Objektbedienung öffnen oder konfigurierte HA-Services ausführen. Die GitHub-Pages-Demo simuliert diese Bedienebene ohne eine echte Anlage zu schalten.

<!-- GLT-SHOWCASE:END -->

<!-- GLT-V1:START -->

## GLT Engineering Platform 1.0

**Version 1.0** erweitert die GLT Flow Card von einer Visualisierung zu einer Home-Assistant-basierten GLT-/SCADA-Engineering-Plattform. Die bestehenden sechs Designs und der Drag-&-Drop-Designer bleiben erhalten; hinzu kommen professionelle Betriebs-, Engineering- und Inbetriebnahmefunktionen.

- vollständiges **Betriebszustandsmodell**: Auto, Hand, Lokal, Fern, Störung, Warnung, Sperre, Interlock, Wartung, Kommunikationsfehler, veraltete/ungültige Werte und Befehlsstatus;
- **Objektbedienung** für Pumpen, Ventile, Mischer, Antriebe und Sollwerte mit serverseitiger Rechteprüfung im Companion;
- **Alarm Lifecycle 2.0** mit Priorität, Alarmklasse, Hysterese, Verzögerung, Quittierung, Kommentar, Shelving, Historie, Benachrichtigung und Eskalation;
- **Wochenprogramme, Kalender und Zeitpläne**;
- semantische Struktur **Standort → Gebäude → Etage → Anlage → Teilanlage → Aggregat → Datenpunkt**;
- **Auto-Mapping** vorhandener Home-Assistant-Entities auf parametrische GLT-Komponenten;
- mehr als **250 Symbolvarianten** plus parametrisierte Maschinenprofile, intelligente Ports und hindernisbewusstes Routing;
- CAD-Werkzeuge: Layer, Sperren, Z-Reihenfolge, Ausrichten, Verteilen, Lasso, Copy/Paste und Minimap;
- Drill-down/Breadcrumbs, Historian-Aggregationen, Simulation, Inbetriebnahme und Entity-Diagnose;
- Energie, Wartung/Arbeitsaufträge, Reports, Multi-Site/Remote-HA, Plugin-SDK, Projekt-Diff und `.gltproject`-Bundles;
- Config Flow, serverseitiges Audit, Projekt-Locking sowie Deutsch/Englisch-Grundlage.

> Für sichere Bedienungen, geräteübergreifende Projekte, Alarme, Zeitprogramme, Audit, Locks und Remote-Home-Assistant wird der **GLT Flow Card Companion** empfohlen. Die reine Dashboard-Card bleibt weiterhin ohne Backend nutzbar.

**[Design Showcase](https://xerolux.github.io/glt-flow-card/showcase.html)** · **[Platform 1.0](https://xerolux.github.io/glt-flow-card/platform.html)** · **[Online Designer](https://xerolux.github.io/glt-flow-card/editor/)**

<!-- GLT-V1:END -->


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
- **Vollständiger Drag-&-Drop-Anlageneditor** für Bauteile, Medienleitungen, Datenpunkte, KPIs und Bildansichten; YAML bleibt für Spezialfälle verfügbar.

## Installation

Erfordert Home Assistant 2024.8.0 oder neuer. Die Release-Prüfung installiert
die exakt bereitgestellte Dashboard-Karte und Companion-ZIP auf unveränderlich
gepinnten Minimum-/Current-HA-Lanes.

### Verifizierte Projekt- und Release-Grenze

Phase 1 prüft rohe Validierungsfehler vor der Normalisierung, sequenzielle
Dry-Run-Migration und Rollback, semantische Diff-Kategorien und
Abhängigkeitsabschluss, konfliktgeschütztes selektives Anwenden, begrenzte
`.gltproject`-Bundles, Companion-Lifecycle-Cleanup sowie identische
Source-/Build-/Stage-/Browser-/Home-Assistant-Release-Artefakte. Dafür gelten
ausführbare Node-, Python-, Browser- und unveränderlich gepinnte HA-Lane-Tests;
Quelltext-Token oder Screenshots allein sind kein Nachweis.

Das oben genannte öffentliche HACS-Custom-Repository ist die
**Dashboard**-Card. Der Companion wird als `glt-flow-card-companion.zip` im
Release dieses Repositories ausgeliefert. Seine HACS-**Integration**-Form ist
nur ein lokaler Integration-Category-Stage für die Release-Prüfung und kein
separat veröffentlichtes HACS-Integrations-Repository.

Standalone eignet sich weiter für lokale Visualisierung und browserlokales
Engineering. Gemeinsame Projekte, autoritative Migration/Apply/Rollback,
Locks, Audit, Zeitpläne, Remote-Aktionen und andere privilegierte gemeinsame
Änderungen benötigen den konfigurierten Companion und bleiben ohne diese
Autorität geschlossen. Die automatisierten Nachweise führen keinen physischen
Anlagen-Schreibzugriff aus. Die 100-/500-/2.000-Objekt-Fixtures belegen nur
begrenzte Korrektheit und sind keine Kapazitätszertifizierung; diese Messung
gehört zu Phase 10.

### HACS

1. HACS → Drei-Punkte-Menü → **Benutzerdefinierte Repositories**.
2. `https://github.com/Xerolux/glt-flow-card` als **Dashboard** hinzufügen.
3. **GLT Flow Card** installieren und Home Assistant / Browser neu laden.

### Manuell

1. `dist/glt-flow-card.js` nach `config/www/glt-flow-card.js` kopieren.
2. `/local/glt-flow-card.js` als **JavaScript-Modul** bei den Dashboard-Ressourcen eintragen.

## Drag-&-Drop-Designer

Der visuelle Editor ist jetzt ein vollständiger Anlagen-Designer. Die GLT kann direkt im Home-Assistant-Karteneditor aufgebaut werden:

- Anlagenbauteile, Medienleitungen, Datenpunkte und KPIs aus der Palette auf die Zeichenfläche ziehen;
- Bauteile direkt verschieben und in der Größe ändern;
- Leitungswege über verschiebbare Stützpunkte aufbauen;
- Home-Assistant-Entitäten rechts im Eigenschaften-Inspector zuordnen;
- Anlagenbild-Ansichten hinzufügen und denselben Datenpunkt im Schema und Foto getrennt positionieren;
- Rasterfang, Zoom, Duplizieren, Löschen, Tastatur-Nudging sowie Undo/Redo;
- eigene Bilder/SVGs sowohl für komplette Ansichten als auch für einzelne Anlagenobjekte.

Der Designer schreibt dieselbe YAML-Konfiguration wie die manuelle Konfiguration. Visueller Editor und YAML können deshalb jederzeit kombiniert werden.


## Neo 2030, Clean und Classic SCADA

Die Karte enthält jetzt drei vollständige Optik-Presets. **Neo 2030** ist die neue dunkle Premium-Ansicht mit moderner Symbolik, dezenten Glow-Effekten und klarer technischer Typografie. **Clean** erhält die helle, reduzierte Darstellung. **Classic SCADA** bleibt bewusst für Anwender erhalten, die eine traditionelle GLT-/SCADA-Optik bevorzugen. Der Stil kann im Designer gewählt und optional direkt in der Karte umgeschaltet werden.

## Home-Assistant-Entity-Picker und YAML-Ausgabe

Im integrierten Designer werden Entitäten nicht mehr von Hand eingetippt: Hauptentitäten, Status, Messwerte, Fluss-/Aktivsignale und KPIs verwenden den nativen Home-Assistant-Entity-Picker mit passenden Domain-Filtern. Friendly Name, Entity-ID und die vorhandene Home-Assistant-Entity-Liste stehen dadurch direkt im Designer zur Verfügung.

Der Designer bietet außerdem **Live-Vorschau** sowie eine **Lovelace-YAML-Ansicht mit Kopierfunktion**. Das grafisch erstellte Schema kann sofort als `custom:glt-flow-card` in ein manuelles Lovelace-Dashboard übernommen werden.

## Erweiterte Symbolbibliothek

Die Palette enthält mehr als 50 auswählbare Bausteine und Varianten für Heizung, Hydraulik, RLT/Lüftung, Kälte, Energie, Sensorik und allgemeine Anlagen: Wärmepumpen, Speicher, Heizkreise, Pumpen, 2-/3-Wege-Ventile, Mischventile, Wärmetauscher, Verteiler, Ausdehnungsgefäße, RLT-Zentralen, Ventilatoren, Luftklappen, Filter, Heiz-/Kühlregister, Kältemaschinen, PV, Batterie, Netz, Zähler, Raum- und Prozesssensoren sowie eigene Bilder/SVGs.


## Engineering Workspace 0.4

![GLT Flow Card Funktionsübersicht](docs/images/symbol-library-live.png)

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

![Neo 2030 Runtime](docs/images/neo2030-dark-live.png)

### Drag-&-Drop-Designer in Home Assistant

![Home Assistant Designer](docs/images/designer-dark-live.png)

### Clean-Designer als Alternative

![Clean Designer](docs/images/designer-light-live.png)

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
