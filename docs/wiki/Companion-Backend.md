# Companion Backend · Platform 1.0

Der optionale Custom Component `glt_flow_card` ist die serverseitige Betriebs- und Persistenzschicht der GLT Flow Card. Die Dashboard-Card funktioniert weiterhin ohne Backend; für produktive Bedienung wird der Companion empfohlen.

## Funktionen

- persistente Projekte, Versionen und Vorlagen in Home Assistant Storage;
- optimistische Projekt-Revisionen und Projekt-Locks mit TTL gegen paralleles Überschreiben;
- serverseitige Rollenprüfung **Viewer / Operator / Designer**;
- kontrollierte Home-Assistant-Serviceaufrufe mit erlaubten Service-Domains, User-Context und Audit vor/nach Bedienung;
- Alarm-Lifecycle mit Hysterese, Verzögerung, Quittierung/Kommentar, Shelving, Historie und Notification-Service;
- serverseitige Wochenprogramme;
- Arbeitsaufträge und Report-Snapshots;
- Remote-Home-Assistant-State-/Control-Proxy, damit Remote-Tokens nicht im Browser liegen;
- Audit-Log mit Benutzer-ID/-Name und Zeitstempel.

## Einrichtung

Nach dem Kopieren von `custom_components/glt_flow_card` und dem Neustart kann **GLT Flow Card Companion** unter **Einstellungen → Geräte & Dienste** über den Config Flow hinzugefügt werden. Im Options Flow lassen sich u. a. Server-Enforcement und Lock-/Speichergrenzen konfigurieren.

Für Remote Sites kann zusätzlich YAML genutzt werden:

```yaml
glt_flow_card:
  remote_sites:
    - id: firma
      name: Firma
      url: https://ha.example.org
      token: !secret glt_remote_token
```

## Sicherheit

Bei `security.server_enforced: true` ist die Browseroberfläche nicht die Berechtigungsgrenze: der Companion prüft Rolle und erlaubte Service-Domain erneut. Kritische Feldbus-/Sicherheitslogik bleibt weiterhin Aufgabe von Home Assistant bzw. der zugrunde liegenden Automations-/Feldebene.

## Datenschutz

Projekt-, Alarm-, Audit- und Wartungsdaten bleiben lokal im eigenen Home Assistant. Remote-Tokens werden nur im Backend konfiguriert und nicht an den Browser ausgeliefert.
