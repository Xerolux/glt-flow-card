# Multi-Site / Anlagenpark

Mehrere Standorte oder Unteranlagen können in einer Konfiguration geführt werden.

```yaml
sites:
  - id: building_a
    name: Gebäude A
  - id: building_b
    name: Gebäude B
```

Anlagenobjekte, Datenpunkte, Pfade und Alarme erhalten optional `site: building_a`. Die Runtime zeigt eine Standortübersicht und kann auf einen Standort filtern.
