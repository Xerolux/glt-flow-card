# Designer

Der Designer bearbeitet über **Kommandos**. Jede Geste erzeugt einen Wert mit
einer Umkehrung, und die Oberfläche verändert das Projekt nie selbst.

Das ist der Grund, warum Rückgängig hier verlässlich ist. Eine Undo-Liste ließe
sich auch an direkte Änderungen anflanschen — nur wäre nichts daran bewiesen:
sie ließe sich nur gegen die Klickwege prüfen, die jemandem eingefallen sind,
und das ist genau die Menge, die den Fehler nicht enthält. Als Wert mit
Umkehrung wird Rückgängig zu einer *Eigenschaft*,
`invert(apply(s, c), c) === s`, und die lässt sich über erzeugte Folgen prüfen.

## Bedienung ohne Zeigegerät

Das ist eine Anforderung, keine Fußnote zur Barrierefreiheit: die Kiosk-Ansicht
hat überhaupt kein Zeigegerät. Ein Editor, den man nur mit der Maus bedienen
kann, ist ein Editor, den die Hälfte der Installationen nicht benutzen kann.

| Taste | Wirkung |
|---|---|
| Pfeiltasten | Fokus bewegen |
| `Strg`+Pfeil | Fein verschieben |
| `Umschalt`+Pfeil | Grob verschieben |
| `Alt`+Pfeil | Größe ändern |
| `Einfg` | Objekt hinzufügen |
| `Umschalt`+`Einfg` | Master-Instanz setzen |
| `Eingabe` | Auswählen |
| `Umschalt`+`Eingabe` | Auswahl erweitern |
| `g` / `Umschalt`+`G` | Gruppieren / Gruppierung aufheben |
| `a` / `d` | Ausrichten / Verteilen |
| `r` | Nach vorn holen |
| `c` / `x` | Ports verbinden / trennen |
| `Entf` | Löschen |
| `Strg`+`Z` / `Strg`+`Y` | Rückgängig / Wiederherstellen |

Die Tabelle steht genau einmal im Code und wird als sichtbare Hilfe angezeigt:
eine Tastenkombination, die niemand entdecken kann, hat niemand. Eine Prüfung
beim Laden des Moduls verlangt, dass jede Kommandoart in der Tabelle vorkommt —
sonst startet die Karte nicht.

Einfache Pfeiltasten bewegen den Fokus, veränderte Pfeiltasten das Objekt. Ein
Raster, in dem die Pfeile beides tun, lässt den Bediener nichts ansehen, ohne es
zu verändern.

Der vollständige Ablauf wird als **eine durchgehende Traversierung** über
sechzehn Schritte geprüft, in beiden Sprachen, gegen die ausgelieferten Bytes —
nicht als Fokussierbarkeit einzelner Elemente. Ein Editor, dessen Teile je
erreichbar sind, dessen Ablauf aber nicht, ist immer noch einer, den der Kiosk
nicht bedienen kann.

## Verbinden

Verbinden ist zweistufig: Quell-Port wählen, dann Ziel-Port. Passt das Paar
nicht, wird der Grund im Statusbereich **in Worten** angesagt — mit Farbe
zusätzlich, nicht statt der Worte. Ein stilles Nichtstun ließe den Ingenieur mit
einer Taste zurück, die nichts tut, und das ist die schlechteste Fassung von
„das Werkzeug widerspricht dir".

## Bestätigungen

Zerstörende Schritte laufen über das Bestätigungselement aus Phase 2, nie über
`window.confirm`. Ein Browserdialog ist eine browsereigene Autorisierungsabfrage:
die Tastenbehandlung des Kiosks erreicht ihn nicht, kein Stylesheet macht ihn in
erzwungenen Farben lesbar, und das Wirkungsprotokoll, das beweist, dass die
Karte nichts Unzulässiges tut, sieht ihn nicht.

Dasselbe gilt für `alert`: modal, nicht gestaltbar, unsichtbar für das Protokoll.
Eine Meldung, die ein Satz neben der betroffenen Schaltfläche hätte sein können,
wurde zur blockierenden Unterbrechung, die der Bediener wegklicken muss, bevor
er sich ansehen kann, was schiefging.

**Zurückgezogen und dabei erreichbar geblieben:** der alte Bedienpfad
(`_tapEntity`, `executeControl`) existiert weiter und tut nichts. Ihn zu löschen
würde den Beweis dorthin verschieben, wo ihn nichts prüft; so kann das
Wirkungsprotokoll zeigen, dass keine Geste einen Service-Aufruf erzeugt.

## Rückgängig

Die Tiefe ist begrenzt, und die Grenze vergisst den Anfang statt die neueste
Bearbeitung abzulehnen. Ein Editor, der aufhört, Arbeit anzunehmen, ist die
schlechtere Antwort auf „du hast viel bearbeitet".

Ein abgelehntes Kommando lässt die Zeichnung Byte für Byte unverändert. Es gibt
kein halbes Anwenden.

## Kopieren zwischen Projekten

Einfügen vergibt neue IDs und schreibt **jede** Referenz mit derselben
Zuordnung um: Verbindungsendpunkte, Gruppenzugehörigkeit, Master-Referenzen,
Ebenenzuordnung und Gruppenschachtelung. Vorher wurde eine neue ID aus
`Date.now()` und `Math.random()` erzeugt und *nichts* umgeschrieben, sodass eine
eingefügte Verbindung weiter auf die Objekte zeigte, aus denen sie kopiert
wurde — zwei Zeichnungen, die still denselben Zustand teilten.

Die Uhr war der Grund, warum das niemandem auffiel: dieselbe Einfügung war nie
reproduzierbar. Heute ist Einfügen eine reine Funktion aus Nutzlast und
Startwert, sodass zwei Leute dieselbe Unteranlage einfügen und eine
Zusammenführung ohne Inhalt bekommen. Port-IDs bleiben unangetastet: sie gehören
zum Profil, und das Profil wird nicht mitkopiert.
