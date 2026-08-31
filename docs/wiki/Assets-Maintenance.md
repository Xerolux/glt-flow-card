# Wartung & Assets

Assets verbinden technische Komponenten mit Betriebsstunden, Wartungsintervallen, Fälligkeit, Dokumenten und Ersatzteilinformationen.

```yaml
assets:
  - id: compressor
    name: Verdichter
    entity_hours: sensor.compressor_hours
    service_interval_hours: 10000
    last_service_hours: 2500
    due_date: 2027-04-01
    documents:
      - name: Handbuch
        url: /local/docs/compressor.pdf
    parts:
      - Filter 12345
```

Die Runtime markiert fällige Assets und bietet Dokumentlinks direkt an.
