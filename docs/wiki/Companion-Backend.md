# Companion Backend · Platform 1.0

Der optionale Custom Component `glt_flow_card` ist die serverseitige Betriebs- und Persistenzschicht der GLT Flow Card. Die Dashboard-Card funktioniert weiterhin ohne Backend; für produktive Bedienung wird der Companion empfohlen.

Für gemeinsame Projekte ist der Companion die autoritative Grenze. Der Browser
sendet bei Preview/Apply/Rollback nur gebundene Vorschauidentität, erwartete
Revision, stabile Änderungs-IDs und explizite Bestätigung. Der Server liest den
Head erneut, validiert und migriert neu, berechnet Diff und
Abhängigkeitsabschluss erneut und schreibt journalgestützt. Ohne erforderliche
Companion-Autorität gibt es keinen privilegierten Standalone-Fallback.

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

Das Release-ZIP wird auf unveränderlich gepinnten Minimum-/Current-HA-Lanes als
exaktes Stage-Artefakt installiert. Die Tests prüfen Setup, Upgrade, Reload,
Unload und Re-Setup, Listener/Tasks/Manager/Store-Ressourcen, Options-Rollback
und allowlist-basierte Diagnosedaten. Die lokale HACS-Integration-Category-Stage
ist Verpackungsnachweis, keine Aussage über ein öffentliches Companion-Repository.

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

Die Phase-1-Nachweise testen Projekt- und Release-Sicherheit isoliert. Sie führen
keinen physischen Anlagen-Schreibzugriff aus und zertifizieren keine Kapazität
für 100, 500 oder 2.000 Objekte. Autorisierung aller gemeinsamen Reads,
Controls, Subscriptions und Audit-Abfragen wird in Phase 2 weiter gehärtet und
darf aus Phase-1-Pakettests nicht als vollständig zertifiziert abgeleitet werden.

## Datenschutz

Projekt-, Alarm-, Audit- und Wartungsdaten bleiben lokal im eigenen Home Assistant. Remote-Tokens werden nur im Backend konfiguriert und nicht an den Browser ausgeliefert.

## English summary

The Companion is authoritative for shared project preview, migration, diff,
selective apply, conflict handling and rollback. Exact ZIP bytes pass immutable
minimum/current Home Assistant lifecycle lanes. The HACS Integration shape is a
local integration-category stage, not public Companion availability. Tests use
isolated data, perform no physical plant write and are not a capacity
certification.
