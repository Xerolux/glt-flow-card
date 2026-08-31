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

## Bedienbare GLT-Objekte

Pumpen, Ventile, Mischer, Heizstäbe, Lüfter, Klappen und weitere Anlagenobjekte können direkt im Schema bedienbar sein. Beim Klick kann ein **Objekt-Bedienfenster** geöffnet werden, das Zustand, Messwerte und passende Bedienelemente anzeigt.

```yaml
equipment:
  - id: mixer_hk_d
    type: valve
    symbol: mixing_valve
    name: Mischer HK D
    control_entity: number.mischer_hk_d
    state_entity: binary_sensor.heizkreis_d_aktiv
    tap_action: control
    fields:
      - label: Vorlauf
        entity: sensor.vorlauf_hk_d
      - label: Soll-Vorlauf
        entity: sensor.sollvorlauf_hk_d
```

`control_entity` ist optional. Fehlt sie, wird `entity` verwendet.

### Unterstützte Standardbedienungen

- `switch`, `light`, `input_boolean`, `automation`: Ein / Aus / Umschalten
- `fan`: Ein / Aus und – sofern vorhanden – Prozentwert
- `button`, `input_button`: Ausführen
- `cover`, `valve`: Öffnen / Stop / Schließen
- `lock`: Verriegeln / Entriegeln
- `number`, `input_number`: Wert setzen
- `select`, `input_select`: Auswahl setzen
- `climate`: Solltemperatur und Betriebsart
- `script`, `scene`: Ausführen

Für Spezialfälle kann `tap_action` einen Home-Assistant-Service aufrufen:

```yaml
tap_action:
  action: call-service
  service: climate.set_temperature
  data:
    entity_id: climate.heizkreis_d
    temperature: 22
```

Alternativ stehen `more-info`, `toggle`, `navigate`, `url`, `none` und die Standardaktion `control` zur Verfügung.

## Rechte und Sicherheit

Bedienungen sind rollenabhängig. Viewer dürfen nur lesen, Operatoren und Designer dürfen bedienen. Optional erscheint vor Bedienaktionen eine Sicherheitsabfrage. Bedienaktionen und blockierte Versuche können im Audit-Log protokolliert werden.
