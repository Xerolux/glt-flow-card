# GLT Engineering Platform 1.0

Platform 1.0 erweitert die GLT Flow Card von einer Lovelace-Visualisierung zu einer Home-Assistant-basierten **GLT/BMS/SCADA Engineering Platform**. Die Card bleibt standalone nutzbar; der optionale Companion übernimmt serverseitige Sicherheit und dauerhafte Betriebsfunktionen.

## 1–3 · Betriebszustände, Objektbedienung und Rechte

Anlagenobjekte unterstützen `Auto`, `Hand`, `Lokal`, `Fern`, `Läuft`, `Aus`, `Standby`, `Warnung`, `Störung`, `Gesperrt`, `Interlock`, `Wartung`, Kommunikationsfehler, ungültige/veraltete Werte sowie Befehlsstatus. Die erweiterte Objektbedienung zeigt Status, Datenqualität, Entity-Metadaten, Value-Slots und profilabhängige Befehle. Mit `security.server_enforced: true` führt der Companion Bedienaktionen erst nach serverseitiger Rollen- und Service-Domain-Prüfung aus.

## 4–6 · Alarm Lifecycle und Zeitprogramme

Alarme unterstützen Zustands- und numerische Bedingungen, `active_states`, `inactive_states`, Grenzwerte, Hysterese, Verzögerung, Priorität/Klasse, Quittierung mit Kommentar, Shelving, Historie und Notification-Service. Der Companion verarbeitet gespeicherte Projekte auf `state_changed` und führt Wochenprogramme serverseitig aus.

## 7–9 · Semantik, Auto-Mapping und parametrische Profile

Die semantische Struktur lautet **Standort → Gebäude → Etage → System → Teilanlage → Aggregat → Datenpunkt**. Komponenten besitzen Profile mit Ports, typischen Messwert-Slots und Bedienfunktionen. Auto-Mapping bewertet Home-Assistant-Entities anhand Entity-ID, Friendly Name, Domain, Device Class und Einheit und schlägt passende Bindings vor.

## 10–13 · Symbolbibliothek, Ports, Routing und CAD

Aus professionellen Basisbauteilen und sechs Visual-Styles entstehen mehr als **300 Symbolvarianten**. Profile besitzen intelligente Ports. Das Routing wählt passende Ports und sucht orthogonale Wege um andere Anlagenobjekte. CAD-Werkzeuge umfassen Layer, Sichtbarkeit/Sperren, Ausrichten, Verteilen, Copy/Paste, Gruppen und Minimap; vorhandene Multi-Selection- und Drag-&-Drop-Funktionen bleiben erhalten.

## 14–17 · Drill-down, Historian, Simulation und Diagnose

Semantische Pfade dienen als Grundlage für Drill-down/Breadcrumbs. Historian-Daten können per Deadband reduziert und als Mittelwert, Minimum, Maximum oder Summe aggregiert werden. Im Simulationsmodus lassen sich Engineering-Projekte ohne reale Entities aufbauen. Die Diagnose findet fehlende, `unavailable`, `unknown` und veraltete Entities und listet ungenutzte Home-Assistant-Entities.

## 18–20 · Energie, Wartung und Reports

Das Energie-Modell unterstützt Strom, Wärme, Kälte, Wasser, Gas, PV und Batterie inklusive Kosten-/CO₂-Metadaten. Wartung wird um Arbeitsaufträge ergänzt. Reportdefinitionen können durch den Companion als serverseitiger Snapshot ausgeführt werden; CSV und Druck/PDF bleiben verfügbar.

## 21–23 · Remote Home Assistant, SDK und Integrationsmetadaten

Remote-Home-Assistant-Instanzen können über den Companion eingebunden werden; Tokens bleiben im Backend. Remote-Bedienung unterliegt denselben Rollen- und Domain-Regeln. `window.GLTFlowCardSDK` stellt Registrierungsfunktionen für Symbole, Komponentenprofile, Panels, Migrationen und Sprachen bereit. Die Objektbedienung kann Entity-Registry-/Integrationsinformationen aus Home Assistant anzeigen.

## 24–27 · Projektformat, Vergleich, Collaboration und Companion

Neue Projekte verwenden `schema_version: 1`. `.gltproject` ist ein ZIP-basiertes Bundle mit `manifest.json` und `project.json`. Der Projektvergleich zeigt hinzugefügte, entfernte und geänderte Pfade. Der Companion verwendet Revisionen zur Konflikterkennung und Projekt-Locks mit TTL. Die Companion-Integration besitzt einen Home-Assistant-Config-Flow und Options-Flow.

## 28–30 · i18n, Leitstand und Stabilität

Die UI-Grundlage ist Deutsch/Englisch; weitere Sprachen können über das SDK registriert werden. Kiosk- und Widescreen-Einstellungen sind vorbereitet. Automatische Tests decken Core-Algorithmen, Companion-Funktionsumfang, Projektbundle-Roundtrip und ein Engineering-Projekt mit **2.000 Anlagenobjekten** ab.

## Sicherheit

Die Browseroberfläche ist nicht die Sicherheitsgrenze. Für produktive Bedienung wird der Companion mit `security.server_enforced: true` empfohlen. Zugelassene Service-Domains werden serverseitig begrenzt und Bedienaktionen im Audit-Log protokolliert.

## Remote Sites

```yaml
glt_flow_card:
  remote_sites:
    - id: firma
      name: Firma
      url: https://ha.example.org
      token: !secret glt_remote_token
      verify_ssl: true
```

Feldbusse wie KNX, Modbus, BACnet oder andere Protokolle werden bewusst nicht in der Card neu implementiert. Dafür werden Home Assistant und vorhandene Integrationen als Daten-/Automationsschicht genutzt.
