# Zeitprogramme

Zeitprogramme binden an das, was Home Assistant bereits kann. Diese Karte baut
weder einen Kalender noch eine Feiertagstabelle nach.

## Bindungsarten

| Art | Bindet an | Modell |
|---|---|---|
| `operating_period` | `schedule.*` | **Intervall** |
| `holiday` | `binary_sensor.workday` oder `calendar.*` | Zeitpunkt |
| `exception` | `calendar.*` | Zeitpunkt |
| `vacation` | `calendar.*` | Zeitpunkt |
| `special_day` | `calendar.*` | Zeitpunkt |

**Intervall und Zeitpunkt werden nie ineinander umgerechnet.** Ein
HA-`schedule` sagt: *zwischen diesen Uhrzeiten ist die Anlage im Tagbetrieb*.
Unser Runner sagt: *rufe zu dieser Minute diesen Dienst auf*. Das sind
verschiedene Aussagen, und sie zu vermischen hieße, die Bedeutung eines
Zeitprogramms stillschweigend zu ändern.

### Feiertage

`binary_sensor.workday` trägt bereits Land, **Bundesland**, `add_holidays` und
`remove_holidays`. Deutsche Feiertage sind Ländersache — eine hier
ausgelieferte Tabelle wäre für die halbe Republik falsch. Die Bindung ist
deshalb **nur lesbar**, und die Oberfläche sagt das.

### Was eine Bindung nicht kann

Die Fähigkeit wird gelesen, **bevor** eine Aktion angeboten wird. Ein Kalender
ohne `CREATE_EVENT` erscheint als nur lesbar, mit Begründung — sonst schlägt
erst der Dienstaufruf fehl, und da hat der Bediener sich schon festgelegt.

Zwei verschiedene Ablehnungen, weil sie verschiedene Antworten brauchen:

- `calendar_cannot_create_events` — *dieser Kalender ist nicht beschreibbar*.
- `requires_home_assistant_admin` — *Sie dürfen ihn nicht beschreiben*.

`schedule/create`, `schedule/update` und `schedule/delete` sind in Home
Assistant mit `require_admin` versehen. Ein „Engineer" dieser Karte ist nicht
zwangsläufig HA-Administrator, und das wird vor dem Aufruf gesagt statt danach
undurchsichtig zu scheitern.

## Zeitumstellung

Der Runner vergleicht **Zeitpunkte**, keine Wanduhr-Zeichenketten. Das ist kein
Detail, sondern der Kern:

### Frühjahr — die Stunde, die es nicht gibt

Am **28.03.2027** laufen die Minutenticks für `Europe/Berlin` so:

```
01:59+01:00  →  03:00+02:00
```

Die Wanduhr-Minuten 02:00–02:59 werden **nie** geliefert. Eine
Nachtabsenkung um 02:30 — auf einer deutschen Heizungsanlage eine ganz gewöhnliche
Zeit — fiel deshalb stillschweigend aus: Es wurde kein Lauf verzeichnet und
nichts gemeldet.

Heute liefert die Auflösung den Status `nonexistent` mit einer Begründung. Was
dann geschieht, ist eine Standortentscheidung:

| Richtlinie | Verhalten |
|---|---|
| `skip` (Vorgabe) | Läuft an diesem Tag nicht. |
| `after` | Läuft zur nächsten existierenden Zeit — bei 02:30 also 03:00. |
| `before` | Läuft zur letzten Zeit davor — 01:59. |

Die Vorgabe rät bewusst nicht: Eine Absenkung, die still ausfällt, ist schlecht;
eine, die eine Stunde zu früh läuft, ohne dass jemand darum gebeten hat, ist
schlimmer.

### Herbst — die Stunde, die es zweimal gibt

Am **31.10.2027** kommt jede Minute zwischen 02:00 und 02:59 **zweimal** vor,
mit unterschiedlichem Offset.

Vorher erzeugten beide denselben `run_key`, weil dieser den Offset wegwarf — die
zweite Ausführung wurde also vom **Deduplizierungs-Cache** unterdrückt, nicht
von der Logik. Das war Glück, und die Korrektur des kaputten Prune-Vergleichs
hätte es beseitigt.

Heute trägt der Schlüssel den aufgelösten Zeitpunkt, und die Richtlinie sagt,
welches Vorkommen läuft: `first` (Vorgabe), `second` oder `both`.

### Die Vorschau

Die Vorschau löst **serverseitig** auf, in der Zeitzone des Standorts. Im
Browser aufzulösen würde für die Zone des Browsers antworten — und ein Browser
in einer anderen Zone als die Anlage ist normal. Der Ingenieur soll das prüfen,
was der Runner tun wird.

Sie sagt die beiden Sätze, die man einem `HH:MM`-Feld nicht ansieht:

> 02:30 gibt es nicht am 2027-03-28 — dieser Eintrag läuft nicht

> 02:30 kommt zweimal vor am 2027-10-31 — dieser Eintrag läuft einmal, um …

Beide Sätze sind in beiden Sprachen ausformuliert, nicht aus Bruchstücken
zusammengesetzt.

## Autorisierung und Audit

Zeitprogramme haben eine **eigene** Grenze. Vorher wurden sie nur als
Projekt-Konfiguration bearbeitet: keine eigene Autorisierung, kein Audit einer
Änderung, keine Route für eine Vorschau — für das, was die Anlage steuert.

| Route | Fähigkeit |
|---|---|
| `glt_flow_card/schedules/list` | `schedule.read` (gefiltert) |
| `glt_flow_card/schedules/save` | `schedule.write` |
| `glt_flow_card/schedules/delete` | `schedule.write` |
| `glt_flow_card/schedules/preview` | `schedule.read` |

`schedule.write` liegt beim **Engineer**, weil ein Zeitprogramm ohnehin nur über
`project.write` editierbar war. Eine Grenze einzuziehen darf nicht ändern, wer
sie überschreiten darf.

`schedules/list` filtert, statt abzulehnen: Eine Ablehnung würde einem
unberechtigten Aufrufer selbst verraten, dass es Zeilen gibt. Das Limit wird
**nach** dem Filtern angewendet — sonst würden die Zeilen eines fremden
Projekts die Seite des Aufrufers füllen, und das Limit würde zum Zähl-Orakel.

Jede Änderung und jede Ausführung — erfolgreich wie fehlgeschlagen — wird mit
Dienst, Ergebnis und Fehlertext aufgezeichnet. Vorher lief der Aufruf mit
`blocking=False` in `except Exception: continue`: Ein fehlgeschlagenes
Zeitprogramm war von einem gelaufenen nicht zu unterscheiden, und keines von
beiden schrieb etwas mit.

Eine ungültige Zeit wird beim **Speichern** abgelehnt, nicht in dem Moment
entdeckt, in dem sie hätte laufen sollen.
