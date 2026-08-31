# Alarme, Meldungen und Bedienung

`alarms:` definiert Meldedatenpunkte mit Schweregrad `critical`, `warning` oder `info`. Aktive Zustände können explizit über `active_states` definiert werden.

```yaml
alarms:
  - id: hp_alarm
    name: Wärmepumpe Störung
    entity: binary_sensor.hp_alarm
    severity: critical
    ack:
      service: button.press
      data:
        entity_id: button.hp_ack
```

Bedienungen sind rollenabhängig. Viewer dürfen nur lesen, Operatoren und Designer dürfen bedienen. Optional erscheint vor Bedienaktionen eine Sicherheitsabfrage.
