# Installation

Voraussetzung ist Home Assistant 2024.8.0 oder neuer. Vor einem Release werden
die exakt bereitgestellte Karte und Companion-ZIP auf unveränderlich gepinnten
Minimum-/Current-HA-Lanes installiert und geprüft.

## Was öffentlich über HACS verfügbar ist

**Für die vollständige Einrichtung sind Karte und Companion erforderlich.**
Die HACS-Dashboard-Installation allein enthält bereits den integrierten
Designer, aber keinen eingerichteten Companion. Der Companion ist eine
Custom Integration unter **Geräte & Dienste**, keine Supervisor-App.

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

## Direkt über den Companion (ab 1.1.0)

Ab Home Assistant 2026.3 erscheint das mitgelieferte GLT-Symbol unter
**Einstellungen → Geräte & Dienste**. Den Ordner `brand/` bei manueller
Installation mitkopieren und Home Assistant anschließend neu starten.
Er enthält PNGs für helle und dunkle Oberflächen in 256 und 512 Pixeln.
Die Quelldarstellung wird mit `py -3.13 tools/generate-brand.py` (Pillow)
reproduzierbar erzeugt. Ältere HA-Versionen können ein Standardsymbol anzeigen.

Der Companion liefert die Card in `custom_components/glt_flow_card/www/` mit und
serviert sie nach dem Setup unter (benötigt Home Assistant mit der
statischen Pfad-API, ab ca. 2025.2; ältere Installationen nutzen HACS-Dashboard
oder `/config/www`):

`http://<home-assistant>/glt_flow_card/www/glt-flow-card.js`

Diese URL kann als JavaScript-Modul-Ressource eingetragen werden, wenn die Card
nicht über HACS-Dashboard oder `/config/www` installiert wurde — zum Beispiel
nach einer Integration-Kategorie-Installation (siehe unten). Sie wird ohne
lange Cache-Header ausgeliefert; ein `?v=<version>`-Suffix an der Ressourcen-URL
erzwingt nach einem Companion-Update das Neuladen im Browser.

## Wenn nur Fehler kommen: Card trotz Companion nicht nutzbar

HACS installiert ein Repository in genau **einer** Kategorie. Wird das
Repository als **Integration** hinzugefügt, erhält man nur den Python-Companion:
das Backend läuft, aber die Lovelace-Ressource muss zusätzlich registriert werden.
Die Card-Datei liegt im Companion unter `www/`; ohne Ressource meldet `custom:glt-flow-card`
meldet dann *Custom element doesn't exist*. Abhilfe in dieser Reihenfolge:

1. HACS → Benutzerdefinierte Repositories: das Repository als **Dashboard**
   hinzufügen (statt Integration) und installieren, oder
2. die Companion-URL aus dem vorherigen Abschnitt als Ressource eintragen, oder
3. `dist/glt-flow-card.js` manuell nach `/config/www/` kopieren.

## GLT Flow Card Companion einrichten

Der Companion ist für produktive GLT-Funktionen empfohlen: serverseitige Rollen
(Betrachter, Bediener, Ingenieur, Administrator), vertrauenswürdige Nachweise,
Projektversionen, exklusive verbindungsgebundene Bearbeitungsleases,
konfigurierte Steuerungen, Alarm-Lifecycle, Zeitprogramme, Arbeitsaufträge und
Reports. Remote-Standorte benötigen eine gesonderte Konfiguration und Berechtigungen.

1. `glt-flow-card-companion.zip` aus demselben Release wie die Karte herunterladen.
2. Den ZIP-Inhalt nach `/config/custom_components/glt_flow_card/` entpacken.
   Dort müssen `manifest.json`, `__init__.py`, `brand/`, `schemas/`,
   `translations/` und `www/` liegen. Keinen zusätzlichen ZIP-Unterordner erzeugen.
   Alternativ den vollständigen Repository-Ordner `custom_components/glt_flow_card` kopieren.
3. Home Assistant neu starten.
4. **Einstellungen → Geräte & Dienste → Integration hinzufügen → GLT Flow Card Companion** wählen.
5. Unter **Einstellungen → Dashboards → Ressourcen** genau eine Kartenquelle
   als **JavaScript-Modul** verwenden: den HACS-Eintrag beibehalten oder die
   Companion-URL `/glt_flow_card/www/glt-flow-card.js` hinzufügen. Alte GLT-CDN-
   oder `/local/`-Einträge nicht parallel laden. Fehlt der Ressourcen-Menüpunkt,
   den erweiterten Modus im Benutzerprofil aktivieren. YAML-Dashboards verwalten
   Ressourcen in ihrer Lovelace-YAML-Konfiguration.
6. Dashboard bearbeiten → **Karte hinzufügen → GLT Flow Card**. Vorlage wählen,
   eigene Entitäten zuordnen und die Karte speichern.
7. Für gemeinsame Projekte als HA-Administrator im Designer **Projekte** öffnen
   und das Projekt erstmals speichern. Danach die Kartenkonfiguration auch mit
   Home Assistants **Speichern** übernehmen. Weitere Nutzer erhalten projektbezogene Rollen.

## Update und Funktionsprüfung

Vor einem Update Home-Assistant-Backup erstellen. Karte und Companion aus dem
gleichen Release aktualisieren, den vollständigen Companion-Ordner ersetzen,
Home Assistant neu starten und den Browser neu laden. Konfiguration und
`.storage`-Projektdaten behalten. Bei der Companion-Ressource kann
`?v=<version>` nach einem Update geändert werden.

Die Einrichtung ist fertig, wenn das GLT-Symbol unter **Geräte & Dienste**
(ab HA 2026.3), die Karte mit eigenen Live-Werten und die Projektbibliothek
funktionieren. Recorder-Trends benötigen aufgezeichnete numerische Entitäten
mit verfügbaren Statistiken. Der Standardzeitraum zeigt die letzten 24
vollständigen Stunden; ein gerade neu angelegter Sensor hat noch keine
vollständige Historie. Die Reihen lassen sich im Trenddialog auswählen.

Bei **Custom element doesn't exist** die Ressourcen-URL prüfen und den Browser
neu laden. Bei einer nicht gefundenen Integration zuerst den Pfad zur
`manifest.json` und den erfolgten HA-Neustart prüfen. Bei fehlenden Trends
Projekt speichern, Entitätszuordnung und Recorder/Statistiken prüfen.

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
