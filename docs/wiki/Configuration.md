# Konfigurationsreferenz

Die Kernblöcke sind:

```yaml
type: custom:glt-flow-card
appearance: {}
canvas: {}
views: []
sites: []
equipment: []
paths: []
datapoints: []
kpis: []
alarms: []
assets: []
groups: []
permissions: {}
replay: {}
trend: {}
reports: {}
routing: {}
```

Der Designer schreibt dieselbe Struktur. Unbekannte Schlüssel werden beim YAML Round-Trip nicht absichtlich entfernt.

## Canvas-Layout und Lesbarkeit

```yaml
canvas:
  # "auto" (Standard): Höhe folgt dem Browserfenster (calc(100dvh - 250px)).
  # Zahl: feste Pixelhöhe des Viewports.
  # "fit": Höhe folgt dem Anlageninhalt — die Karte wird so hoch wie das
  #        eingepasste Schema und nicht mehr abgeschnitten oder gestaucht.
  #        Auf einem 1270px breiten Dashboard steigt die Darstellungsgröße
  #        typischerweise von ~0.59x auf ~0.85x Zoom (gemessen, v1.1.3).
  viewport_height: fit

ui:
  # Wert-Chips und Leitungsbeschriftungen rücken automatisch aus Kollisionen
  # (Equipment-Boxen, andere Chips, Pipe-Labels). Rahmen-Berührung wird
  # bewusst geduldet, Überdeckung der Box-Innenfläche nicht. false = Aus.
  collision_avoidance: true
  # Beschriftungen wachsen gegenläufig zum Canvas-Zoom, damit Text lesbar
  # bleibt, wenn die ganze Anlage verkleinert dargestellt wird.
  # "auto" (Standard, maximal 1.15x), "fixed"/false (1x) oder Zahl 1.0–1.15.
  label_scale: auto
  # Equipment-Boxen wachsen mit ihrem Inhalt (Kopf + Feldzeilen), statt die
  # letzte Feldzeile am konfigurierten height abzuschneiden. Die konfigurierte
  # Höhe gilt weiter als Minimum. false = exakte konfigurierte Höhe.
  auto_height: true
```

Alle drei `ui`-Optionen sind Standard-verhalten seit v1.1.3 und lassen sich einzeln abschalten. Die Platzierung ist rein darstellend — die gespeicherte Projektkonfiguration wird durch den Layout-Pass nie verändert.
