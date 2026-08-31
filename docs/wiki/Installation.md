# Installation

## HACS Dashboard Card

1. HACS → Custom repositories.
2. `https://github.com/Xerolux/glt-flow-card` als **Dashboard** hinzufügen.
3. GLT Flow Card installieren und den Browser neu laden.

Danach kann `custom:glt-flow-card` im Lovelace-Karteneditor gewählt werden. Der visuelle Designer erscheint direkt in Home Assistant.

## Manuell

`dist/glt-flow-card.js` nach `/config/www/glt-flow-card.js` kopieren und `/local/glt-flow-card.js` als JavaScript-Modul eintragen.

## Optional: persistenter Companion-Backend

Für geräteübergreifende Projekte/Versionen/Audit `custom_components/glt_flow_card` nach `/config/custom_components/` kopieren und in `configuration.yaml` ergänzen:

```yaml
glt_flow_card:
```

Home Assistant neu starten. Ohne Backend funktioniert der Designer weiterhin; Projekte werden dann lokal im Browser gespeichert.
