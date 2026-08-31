# Symbole, Gruppen und Auto-Routing

Die GLT Flow Card besitzt eine **detaillierte technische Symbolbibliothek**. Die Symbole sind nicht nur Dekoration: Maschinen und Armaturen können Status, Messwerte, Bedien-Entity und Klickaktion erhalten.

## Detailbauteile

### Heizung
- Wärmepumpen in mehreren Darstellungen
- Heizkessel und Brenner
- Puffer- und Schichtspeicher
- Warmwasserspeicher
- Heizstab
- Heizkörper und Fußbodenheizung

### Hydraulik
- Inline-, Doppel- und FU-Pumpen
- 2-Wege- und 3-Wege-Ventile
- 3-Wege-Mischer mit Antrieb
- Absperr-, Rückschlag- und Sicherheitsventile
- hydraulische Weiche
- Plattenwärmetauscher
- Verteiler / Sammler
- Schmutzfänger sowie Schlamm-/Magnetitabscheider
- Ausdehnungsgefäß

### RLT / Lüftung
- RLT-Zentrale
- Zu- und Abluftventilatoren
- Luft- und Brandschutzklappen
- Luftfilter
- Heiz- und Kühlregister
- Rotations- und Platten-Wärmerückgewinnung
- Befeuchter und Schalldämpfer

### Kälte, Energie und Sensorik
- Kältemaschine, Verdichter, Kühlturm und Kältepuffer
- PV, Wechselrichter, Batterie, Netz und Zähler
- Temperatur, Druck, Differenzdruck, Volumenstrom, Feuchte, CO₂ und Frostschutz

## Zustandsdarstellung

Ein Symbol kann über `state_entity` seinen Betriebszustand erhalten. Aktive Pumpen und Ventilatoren werden animiert. Medienleitungen können ihren Fluss ebenfalls an eine Entity koppeln.

```yaml
equipment:
  - id: pump_hk_d
    type: pump
    symbol: pump_variable
    name: Heizkreispumpe HK D
    entity: switch.heizkreispumpe_hk_d
    state_entity: binary_sensor.heizkreispumpe_hk_d_laeuft
    tap_action: control
```

## Auto-Routing

Zwei Anlagenobjekte auswählen → **Auto-Verbinden** → Medium wählen. Der Designer legt eine orthogonale Verbindung an und speichert `from_equipment`, `to_equipment` und `auto_route: true`. Beim Verschieben der Bauteile wird die Route neu berechnet.

## Gruppen

Mehrere Objekte per Strg/Shift auswählen und als Unteranlage gruppieren. Gruppen können gemeinsam verschoben und als Anlagenvorlage gespeichert werden.
