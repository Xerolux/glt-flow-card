# Installation

## HACS Dashboard Card

1. HACS → **Benutzerdefinierte Repositories**.
2. `https://github.com/Xerolux/glt-flow-card` als **Dashboard** hinzufügen.
3. **GLT Flow Card** installieren und Browser/Home Assistant neu laden.

Danach kann `custom:glt-flow-card` im Lovelace-Karteneditor gewählt werden. Der visuelle Designer erscheint direkt in Home Assistant.

## Manuell

`dist/glt-flow-card.js` nach `/config/www/glt-flow-card.js` kopieren und `/local/glt-flow-card.js` als JavaScript-Modul eintragen.

## GLT Flow Card Companion 1.0

Der Companion ist für produktive GLT-Funktionen empfohlen: serverseitige Viewer/Operator/Designer-Rechte, Audit, Projektversionen und Locks, Alarm-Lifecycle, Zeitprogramme, Arbeitsaufträge, Reports und Remote-Home-Assistant.

Das Release-Workflow erzeugt dafür `glt-flow-card-companion.zip`. Alternativ kann der Ordner `custom_components/glt_flow_card` nach `/config/custom_components/` kopiert werden. Nach dem Neustart wird die Integration unter **Einstellungen → Geräte & Dienste → Integration hinzufügen → GLT Flow Card Companion** über den Config Flow eingerichtet.

Die frühere YAML-Variante bleibt für erweiterte Optionen wie Remote Sites möglich:

```yaml
glt_flow_card:
  remote_sites:
    - id: firma
      name: Firma
      url: https://ha.example.org
      token: !secret glt_remote_token
      verify_ssl: true
```

> HACS behandelt ein Custom Repository jeweils als eine Kategorie. Deshalb bleibt die Card das HACS-**Dashboard**-Repository; der Companion wird im selben Projekt und Release mitgeliefert, aber nicht automatisch durch die Dashboard-Installation nach `custom_components` kopiert.

Ohne Companion funktioniert die Card weiterhin; Projekte fallen dann auf lokalen Browser-Storage zurück und Bedienungen können optional direkt über Home Assistant erfolgen.
