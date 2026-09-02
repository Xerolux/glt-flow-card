# Berichte

Ein Bericht ist ein **reproduzierbares** Erzeugnis. Er hält fest, woraus er
gerechnet wurde, und rechnet daraus dasselbe wieder.

Das ist die strengste Anforderung in diesem Produkt, und sie hat einen Grund:
**Ein Bericht, der beim zweiten Mal stillschweigend eine andere Zahl liefert,
ist schlimmer als einer, der sich weigert** — die erste Fassung ist bereits
verschickt, und der Unterschied zwischen beiden ist genau das, was niemand
sehen kann.

## Was ein Lauf festhält

Jeder Lauf verzeichnet den aufgelösten Zeitraum, die Zeitzone, die einbezogenen
Entitäten, die Vertragsart, die Abdeckung und die Lücken. Ein Lauf, dem eines
davon fehlt, ist nicht reproduzierbar und wird nicht als solcher geführt.

Vorher schrieb der Export `card._display?.(…)` — den Wert, der gerade angezeigt
wurde. Der Designer bot Tag, Woche, Monat und Jahr an; **nichts nachgelagert las
den Zeitraum**. Ein „Monatsbericht" enthielt einen einzigen Zeitpunkt und sagte
das nirgends.

### Kennungen

Lauf-Kennungen werden aus dem Inhalt abgeleitet, nicht aus der Uhr. `report_${Date.now()}`
ist nicht reproduzierbar und kollidiert innerhalb einer Millisekunde — derselbe
Fehler, den Phase 5 im Einfügen-Pfad aus denselben zwei Gründen behoben hat.

## Zeitpläne

**Ein Zeitplan wird beim Speichern geprüft, nicht in dem Moment entdeckt, in dem
er hätte laufen sollen.** Ein Bericht, der am Ersten um 07:00 still ausfällt,
fehlt niemandem, bis jemand danach fragt.

Der Designer sammelte den Zeitplan früher aus einem freien `prompt()` —
„Automatik (z. B. 1 07:00) oder leer" — und legte ihn auf der Definition ab.
Kein Parser, kein Validator und **kein Runner** las ihn je; die Tabelle zeigte
die Zeichenkette unter der Überschrift „Automatik" zurück, und das war der
gesamte Umfang der Funktion. Das Produkt **zeigte eine Automatik an, die es
nicht gab** — dieselbe Gestalt wie das wirkungslose Shelving aus Phase 6: Eine
Funktion, die Erfolg meldet und nichts tut, ist schlimmer als eine fehlende,
weil der Bediener aufhört nachzusehen.

**Ein Runner.** Berichtszeitpläne lösen über dieselbe Zeitauflösung auf wie die
Anlagenzeitprogramme — mit denselben Regeln für nicht existierende und doppelte
Stunden (siehe [Zeitprogramme](Schedules)). Ein zweiter Scheduler wäre derselbe
Fehler an neuer Stelle und liefe auseinander, sobald einer von beiden etwas über
die Zeitumstellung lernte.

Eine leere Zeichenkette ist **kein** Zeitplan und wird abgelehnt.

## Der Designer

Formularfelder, keine `prompt()`-Dialoge. Ein `prompt()` blockiert die ganze
Seite, lässt sich nicht gestalten, ist auf einem Kiosk nicht bedienbar und für
einen Screenreader kaum zugänglich.

Bedienertext — ein Berichtsname, eine Anlagenbezeichnung, eine KPI-Beschriftung
— wird als **Textinhalt** gesetzt und niemals in Markup eingesetzt. Er erreicht
den Leser trotzdem: Eine Maskierung, die den Namen gleich mit verschluckt, wäre
keine Lösung, sondern ein zweiter Fehler.

## Abdeckung gehört in den Bericht

Ein Bericht nennt seine Abdeckung und listet seine Lücken. Ein Monatsbericht
über einen Monat, in dem der Recorder neun Tage nichts hatte, ist eine
belastbare Aussage — solange er es sagt. Ohne diese Angabe ist er eine Zahl, die
aussieht wie ein Monat.

**Eine Summe nennt in einer eigenen Zeile, was sie ausgelassen hat.**

## Was es (noch) nicht gibt

- **Kein Versand.** Ein fertiger Lauf wird angezeigt und aufgezeichnet; er wird
  nicht per E-Mail verschickt und nicht abgelegt.
- **Kein PDF im Produkt.** Der frühere Weg öffnete ein Fenster und schrieb
  Markup hinein; er ist entfernt.
- **`history/export` antwortet `unavailable`** — die Fähigkeitsgrenze und die
  Audit-Zeile stehen, der Export selbst noch nicht.
- Berichte über **entfernte Standorte** sind Phase 9.
