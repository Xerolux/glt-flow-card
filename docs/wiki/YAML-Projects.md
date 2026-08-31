# YAML Import, Projekte und Versionen

## YAML Round-Trip

Der Designer akzeptiert bestehende `custom:glt-flow-card` YAML, übernimmt unbekannte Optionen und gibt die gesamte Konfiguration wieder aus. Dadurch kann zwischen YAML und visueller Bearbeitung beliebig gewechselt werden.

## Projektbibliothek

Projekte können gespeichert, geladen, dupliziert und gelöscht werden. Ein manueller Speichervorgang erzeugt eine Version; Autosave aktualisiert den aktuellen Stand ohne die Versionsliste zu fluten.

Ohne Companion-Backend liegt die Bibliothek in `localStorage`. Mit Backend wird sie in Home Assistants `.storage` gespeichert und ist geräteübergreifend verfügbar.

## Vorlagen

Einzelne Bauteile und komplette Unteranlagen können als eigene Templates gespeichert und in neue Projekte eingefügt werden.
