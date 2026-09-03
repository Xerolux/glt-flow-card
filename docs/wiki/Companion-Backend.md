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
- getrennte Inhalts- und Zugriffsrevisionen sowie exklusive, verbindungsgebundene
  Bearbeitungsleases (60–900 s, Standard 300 s) statt persistierter Locks;
- serverseitige Rollenprüfung gegen die feste Menge
  **Betrachter / Bediener / Ingenieur / Administrator**;
- konfigurierte Steuerungen: der Aufrufer nennt nur eine Steuerungs-ID, die
  Revision und die deklarierte Eingabe — Domain, Service und Ziel löst der Server
  aus dem verifizierten Projektstand auf;
- Alarm-Lifecycle mit Hysterese, Verzögerung, Quittierung/Kommentar, Shelving, Historie und Notification-Service;
- serverseitige Wochenprogramme;
- Arbeitsaufträge und Report-Snapshots;
- Remote-Home-Assistant-State-/Control-Proxy: deklariert, aber bis Phase 9
  fail-closed (`feature_unavailable`);
- getrennte Speicher für serverseitig erzeugte vertrauenswürdige Nachweise und
  für dauerhaft als nicht vertrauenswürdig gekennzeichnete Browser-Telemetrie.

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

## Autorität in Phase 2

Der Browser darf einen Berechtigungs-Snapshot nutzen, um zu entscheiden, was er
anzeigt; er entscheidet damit nie, was erlaubt ist. Jede gemeinsame Anfrage wird
an der WebSocket-Grenze erneut autorisiert, bevor ein Handler läuft, und jede
Änderung prüft die gesamte Autoritätskette noch einmal innerhalb der
Commit-Sperre.

Rollen liegen ausschließlich in der Zugriffsliste des Companions. Projekt-JSON,
importierte Pakete, Browser-Speicher, URL-Parameter und Formularfelder tragen
niemals eine Rolle oder Berechtigung bei. Der Administratorstatus in Home
Assistant verleiht keine Inhaltsautorität, sondern ausschließlich das Lesen und
Reparieren von Mitgliedschaften, damit sich eine Installation nicht aussperren
kann.

Ein nicht sichtbares und ein nicht existierendes Projekt antworten identisch.
Ein Konflikt bewahrt den Entwurf im Speicher und bietet Aktualisieren,
Zusammenführungsvorschau, erneuten Versuch mit neuem Lease oder ausdrückliches
Verwerfen — kein Überschreiben, kein Erzwingen.

Beim Upgrade werden persistierte Alt-Locks verworfen statt in Leases verwandelt,
alte Audit-Zeilen als `legacy_untrusted` gekennzeichnet statt gelöscht, und ein
alter `permissions`-Block auf dem aktiven Stand darf die Mitgliedschaft einmalig
und konservativ vorbelegen — nie als Administrator und nie aus einem importierten
Entwurf.

## Sicherheit

Bei `security.server_enforced: true` ist die Browseroberfläche nicht die Berechtigungsgrenze: der Companion prüft Rolle und erlaubte Service-Domain erneut. Kritische Feldbus-/Sicherheitslogik bleibt weiterhin Aufgabe von Home Assistant bzw. der zugrunde liegenden Automations-/Feldebene.

Die Phase-1- und Phase-2-Nachweise testen Projekt-, Autoritäts- und
Release-Sicherheit isoliert. Sie führen keinen physischen Anlagen-Schreibzugriff
aus, kontaktieren keine Remote Site, verarbeiten keine Zugangsdaten und
zertifizieren keine Kapazität für 100, 500 oder 2.000 Objekte.

## Datenschutz

Projekt-, Alarm-, Audit- und Wartungsdaten bleiben lokal im eigenen Home Assistant. Remote-Tokens werden nur im Backend konfiguriert und nicht an den Browser ausgeliefert.

## English summary

The Companion is authoritative for shared project preview, migration, diff,
selective apply, conflict handling, rollback, membership, leases, configured
controls and trusted evidence. Roles are the fixed set viewer, operator,
engineer and admin, and they live only in the Companion's access list — never in
project content. Home Assistant administrator status grants membership repair
only, never content authority. Editing requires an exclusive connection-bound
lease; conflicts preserve the candidate and offer no overwrite. A control request
names a control id and declared input only. Trusted evidence and browser
telemetry stay in separate stores. Remote routes are declared and fail closed
until Phase 9.

Exact ZIP bytes pass immutable minimum/current Home Assistant lifecycle lanes.
The HACS Integration shape is a local integration-category stage, not public
Companion availability. Tests use isolated data, perform no physical plant
write, handle no credential and are not a capacity certification.
