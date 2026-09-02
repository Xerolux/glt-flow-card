# Installation

Voraussetzung ist Home Assistant 2024.8.0 oder neuer. Vor einem Release werden
die exakt bereitgestellte Karte und Companion-ZIP auf unveränderlich gepinnten
Minimum-/Current-HA-Lanes installiert und geprüft.

## Was öffentlich über HACS verfügbar ist

Dieses Repository ist als HACS-**Dashboard**-Custom-Repository installiert.
HACS installiert damit die Card, nicht automatisch den Python-Companion. Der
Release enthält zusätzlich `glt-flow-card-companion.zip` zur manuellen
Installation. Die im Build geprüfte HACS-**Integration**-Struktur ist ein
lokaler Integration-Category-Stage. Sie belegt Paketform und Installationsziel,
aber keine separate öffentliche HACS-Verfügbarkeit des Companions.

## HACS Dashboard Card

1. HACS → **Benutzerdefinierte Repositories**.
2. `https://github.com/Xerolux/glt-flow-card` als **Dashboard** hinzufügen.
3. **GLT Flow Card** installieren und Browser/Home Assistant neu laden.

Danach kann `custom:glt-flow-card` im Lovelace-Karteneditor gewählt werden. Der visuelle Designer erscheint direkt in Home Assistant.

## Manuell

`dist/glt-flow-card.js` nach `/config/www/glt-flow-card.js` kopieren und `/local/glt-flow-card.js` als JavaScript-Modul eintragen.

## GLT Flow Card Companion 1.0

Der Companion ist für produktive GLT-Funktionen empfohlen: serverseitige Rollen
(Betrachter, Bediener, Ingenieur, Administrator), vertrauenswürdige Nachweise,
Projektversionen, exklusive verbindungsgebundene Bearbeitungsleases,
konfigurierte Steuerungen, Alarm-Lifecycle, Zeitprogramme, Arbeitsaufträge und
Reports. Remote-Home-Assistant ist deklariert, aber bis Phase 9 fail-closed.

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

Ohne Companion funktionieren lokale Visualisierung und browserlokale Projekte
weiterhin. Ein nur lokales Projekt ist dabei ein eigener, gekennzeichneter Modus;
ein gemeinsames Projekt wird nie stillschweigend zu einem lokalen. Autoritative
gemeinsame Projektänderungen, Migration/Apply/Rollback, Leases,
Mitgliedschaftsverwaltung, konfigurierte Steuerungen und Nachweise werden nicht
auf browserlokale Speicherung oder direkte Serviceaufrufe zurückgestuft: fehlt
die Autorität, ist die gemeinsame Ansicht schreibgeschützt.

Beim Upgrade wird ein gespeicherter Lock-TTL-Wert in das Lease-Fenster von
60–900 Sekunden geklemmt (Standard 300 s), persistierte Alt-Locks werden
verworfen statt in Leases verwandelt, und alte Audit-Zeilen bleiben als
`legacy_untrusted` erhalten.

## Release-Nachweis und Sicherheitsgrenze

Der Release-Job lädt ausschließlich die zuvor geprüften Artefakte herunter,
prüft deren SHA-256-Identitäten und baut nicht neu. Minimum- und Current-Lane
installieren dieselbe Card und dasselbe Companion-ZIP, prüfen Setup, Upgrade,
Reload, Unload und Re-Setup sowie die bereinigten Ressourcen. Die Testumgebung
verwendet isolierte Fixtures und führt keinen physischen Anlagen-Schreibzugriff
aus. 100-/500-/2.000-Objekt-Fixtures sind keine Kapazitätszertifizierung.

## English summary

The public HACS custom repository installs the Dashboard plugin. The Companion
ZIP is attached to this repository's release; its Integration layout is a local
integration-category stage for validation, not a separately published HACS
integration. Standalone mode covers local visualization and browser-local
projects only, as an explicitly labelled separate mode. Companion-enforced
shared operations fail closed without backend authority: shared editing becomes
read-only rather than falling back to a privileged local path. On upgrade a
stored lock TTL is clamped into the 60-900 second lease window, persisted legacy
locks are dropped rather than turned into leases, and legacy audit rows are kept
labelled `legacy_untrusted`. Release tests perform no physical plant write,
handle no credential and do not certify 100/500/2,000-object capacity.
