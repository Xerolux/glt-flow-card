# YAML Import, Projekte und Versionen

## YAML Round-Trip

Der Designer akzeptiert bestehende `custom:glt-flow-card` YAML, übernimmt unbekannte Optionen und gibt die gesamte Konfiguration wieder aus. Dadurch kann zwischen YAML und visueller Bearbeitung beliebig gewechselt werden.

Rohe JSON-/YAML-Projektdaten werden vor der Normalisierung gegen begrenzte
Schema-, Byte-, Tiefen-, String- und Collection-Budgets geprüft. Fehler zeigen
stabile, verständliche Pfade. Eine Migration von historischen Versionen läuft
sequenziell als Dry Run; erst nach Prüfung des Receipts und des semantischen
Diffs kann der Companion sie autoritativ anwenden.

## Projektbibliothek

Projekte können gespeichert, geladen, dupliziert und gelöscht werden. Ein manueller Speichervorgang erzeugt eine Version; Autosave aktualisiert den aktuellen Stand ohne die Versionsliste zu fluten.

Ohne Companion-Backend liegt die Bibliothek in `localStorage`. Mit Backend wird sie in Home Assistants `.storage` gespeichert und ist geräteübergreifend verfügbar.

Standalone-Projekte bleiben ausdrücklich browserlokal. Für gemeinsame Projekte
berechnet der Companion Migration, Diff, Abhängigkeitsabschluss und Kandidat
erneut. Konflikte durch veraltete Revisionen oder fremde Vorschauen brechen ab;
es gibt keinen lokalen Fallback. Selektives Anwenden verwendet stabile
Änderungs-IDs. Rollback stellt einen servereigenen, hashgeprüften Snapshot als
neue Vorwärtsrevision wieder her und verändert die Historie nicht rückwirkend.

## Projektvergleich und Bundles

Der semantische Diff unterscheidet Hinzufügen, Entfernen, Verschieben,
Binding- und Konfigurationsänderungen. Nur ausdrücklich deklarierte
Identitätslisten ignorieren Reihenfolgen. Fehlende oder zyklische
Abhängigkeiten sowie nicht schließbare Auswahlen werden abgelehnt.

`.gltproject`-Bundles werden vor dem Lesen vollständig auf Pfadtraversal,
Aliases, Kollisionen, Überlappung, Verschlüsselung, Kompressionsbomben,
CRC-/Hashfehler sowie Größen-, Anzahl- und Ratio-Grenzen geprüft. Eigene Assets
bleiben undurchsichtige Bytes und werden in der Sicherheitsansicht nur als
Metadaten dargestellt. Die 100-/500-/2.000-Objekt-Korpora prüfen begrenzte
Korrektheit; sie sind keine Kapazitätszertifizierung.

## Vorlagen

Einzelne Bauteile und komplette Unteranlagen können als eigene Templates gespeichert und in neue Projekte eingefügt werden.

## English summary

Raw errors are reported before normalization with stable bounded paths.
Sequential migration is dry-run first; semantic diff, dependency closure,
conflicts, selective apply and rollback are recomputed by the Companion for
shared projects. Bundles are preflighted against archive and resource limits,
and custom assets remain opaque bytes. Standalone storage is local only. The
large correctness fixtures are not a capacity certification.
