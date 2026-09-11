# FAQ

## Reicht Repository hinzufügen und installieren?
Für Karte und integrierten Designer: HACS als **Dashboard** installieren und
Browser neu laden. Für gemeinsame Projekte, serverseitige Bedienung und
Recorder-Trends zusätzlich den Companion installieren und unter **Geräte &
Dienste** einrichten. Genau eine GLT-JavaScript-Ressource verwenden, eigene
Entitäten zuordnen und die Karte speichern. Siehe [Installation](Installation).

## Ist der Online-Designer mit Home Assistant verbunden?
Nein. Er speichert Entwürfe lokal im Browser, verwendet Demo-Werte und exportiert
YAML. Live-Daten und Companion-Funktionen werden erst in Home Assistant verfügbar.
Der HA-Designer ist direkt in der Karteninstallation enthalten.

## Brauche ich eigene Bilder?
Nein. Die gesamte Anlage kann aus der integrierten Symbolbibliothek aufgebaut werden.

## Muss ich YAML schreiben?
Nein. Der HA-Designer kann die komplette Konfiguration erzeugen. YAML bleibt für Import, Feintuning und Versionsverwaltung verfügbar.

## Kann ich bestehende YAML weiterbearbeiten?
Ja. YAML Import öffnet die Konfiguration im Designer; danach kann wieder YAML exportiert werden.

## Wo werden Projekte gespeichert?
Standardmäßig im Browser. Mit dem optionalen Companion-Backend direkt in Home Assistant.

## Ist die Karte ein Ersatz für Desigo/EcoStruxure?
Als HA-Visualisierungs- und Engineering-Frontend deckt sie viele typische Funktionen ab. Feldbus-, Redundanz-, Zertifizierungs- und Enterprise-Backend-Funktionen großer kommerzieller GLT-Suiten bleiben Aufgabe von Home Assistant bzw. der jeweiligen Automationsinfrastruktur.
