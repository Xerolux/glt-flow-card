# Alarme & Bedienung

Der Companion entscheidet, welche Alarme aktiv sind — jede Oberfläche zeigt nur
an, was er entschieden hat. Das ist die wichtigste Regel dieser Seite, und sie
hat einen Grund: Ein Browser, der selbst entscheidet, arbeitet mit einer
Momentaufnahme, die Minuten alt sein kann.

## Der Lebenszyklus

Ein Alarm hat eine **Bedingung** (Operator, Schwellwert, Hysterese oder eine
Liste aktiver Zustände), eine **Verzögerung**, eine **Priorität** und optional
eine Benachrichtigungsrichtlinie.

### Zustände

| Zustand | Bedeutung |
|---|---|
| `active` | Die Bedingung trifft zu. |
| `returned` | Die Bedingung trifft nicht mehr zu. |
| `acknowledged` | Ein Bediener hat den Alarm quittiert. |
| `indeterminate` | Die Entität ist `unavailable` oder `unknown`. |

`indeterminate` ist kein Zwischenzustand für den Notfall, sondern eine ehrliche
Antwort: Eine verschwundene Entität ist **nicht** in den Normalzustand
zurückgekehrt. Niemand weiß, was sie tut. Vor Phase 6 wurde `unavailable` als
„inaktiv" gewertet — und weil beim Neustart jede Entität kurz `unavailable` ist,
sah ein Neustart aus wie *alle Alarme gleichzeitig zurückgesetzt*: quittiert
wurde zurückgenommen, Unterdrückungen wurden gelöscht, und anschließend meldete
jeder Alarm erneut.

### Verzögerung

Die Verzögerung ist auf die **erste Aktivierung** verankert. Sie unterdrückt
einen Ausreißer, nicht eine dauerhafte Störung, die zufällig unruhig ist.

Ein Sensor, dessen Wert sich alle zehn Sekunden ändert und dabei über dem
Schwellwert bleibt, hat eine dauerhafte Störung. Vor Phase 6 wurde die
Verzögerung bei jeder Änderung neu gestartet, sodass so ein Alarm der letzten
Wertänderung hinterherlief — und in einer Anlage hört die letzte Wertänderung
nie auf.

Nach einem Neustart wird eine laufende Verzögerung gegen ihren gespeicherten
Anker neu gestellt: Eine vier Minuten alte Fünf-Minuten-Verzögerung meldet in
einer Minute, nicht in fünf.

### Startkarenz

Nach dem Start von Home Assistant werden für **60 Sekunden** (konfigurierbar)
keine Übergänge gemeldet. Entitäten treffen beim Hochfahren nicht gleichzeitig
ein, und ein Scan währenddessen sieht eine Anlage in einem Zustand, in dem sie
nie war. Der Wert wird trotzdem mitgeschrieben — nur der Übergang wird
zurückgehalten.

## Prioritäten

Genau drei, geordnet:

| Priorität | Deutsch | Bedeutung |
|---|---|---|
| `critical` | Störung | Anlage steht oder ist unsicher. |
| `warning` | Warnung | Handlung nötig, nicht sofort. |
| `info` | Hinweis | Nur zur Kenntnis. |

**Dieses Vokabular ist die einzige Phase-6-Einstellung, die nicht konfigurierbar
ist**, und das ist eine bewusste Entscheidung. Standorte unterscheiden sich zu
Recht darin, *welche* Klassen sie verwenden und *was* eskaliert — beides ist
konfigurierbar. Sie unterscheiden sich nicht zu Recht darin, ob das Wort im
Editor und das Wort in der Übersicht dasselbe Wort sind.

Vor Phase 6 gab es vier voneinander unabhängige Vokabulare, und ein im Editor
als `critical` angelegter Alarm wurde in **keiner** Übersicht gezählt.

Gespeicherte Werte werden migriert. `fault` wird zu `critical` — in den
vorhandenen Daten sind das dieselbe Stufe unter zwei Namen. Eine unbekannte
Zeichenkette wird zur **schwersten** Auslegung migriert und gemeldet: Wer zu
niedrig rät, verursacht eine unbemerkte Abschaltung; wer zu hoch rät, einen
verärgerten Bediener.

**Bekannte Einschränkung.** Ein Standort mit vier oder fünf Alarmklassen kann
das heute nicht ausdrücken. Das wäre eine Schemaänderung, keine Einstellung.

## Unterdrückung

Drei Gründe, in dieser Reihenfolge:

1. **Wartung** — der Zustand der Anlage, geht der Entscheidung eines Einzelnen vor.
2. **Shelving** — mit Ablaufzeit gewählt.
3. **Quittierung** — sagt nur „gesehen".

Jede Unterdrückung wird an *der* Stelle geprüft, an der entschieden wird, damit
Verarbeitung und Benachrichtigung nicht unterschiedlicher Meinung sein können.
Und jede unterdrückte Entscheidung sagt, **welche** Unterdrückung galt.

Vor Phase 6 war Shelving wirkungslos: Das Feld wurde an zwei Stellen
geschrieben, an einer gelöscht und an **keiner** gelesen. Ein geschelfter Alarm
lief weiter und meldete weiter, während das Produkt Erfolg meldete. Das ist
schlimmer als eine fehlende Funktion, weil der Bediener glaubt, es sei ruhig.

Ein abgelaufener Schelf endet ohne Zutun. Ein unlesbares Ablaufdatum
unterdrückt **nicht** — das ist der Fehlermodus, der einen Alarm dauerhaft
stumm hielte.

## Benachrichtigung und Eskalation

Jeder Zustellversuch wird mit Dienst, Empfänger, Ergebnis und Fehlertext
aufgezeichnet. Der Aufruf ist blockierend mit ausdrücklichem Timeout — vorher
war er `blocking=False` in einem nackten `except`, sodass das Ergebnis
doppelt verworfen wurde und eine nie angekommene Meldung von einer angekommenen
nicht zu unterscheiden war.

**Eine fehlgeschlagene Zustellung entfernt, entwertet oder verbirgt den Alarm
nie.** Ein Alarm, über den niemand informiert werden konnte, ist dringender als
einer, über den informiert wurde — nicht weniger dringend.

### Die Allowlist

Benachrichtigungsziele sind **Standort-Konfiguration**, niemals Projektdaten.
Ein Dienstname im Projektdokument ist Bedienereingabe, keine Autorisierung.

Voreinstellung: `persistent_notification.create` — sichtbar in Home Assistant,
erreicht niemanden. Ein nicht erlaubtes Ziel wird als `refused`
**aufgezeichnet**, nicht still übersprungen: Wer ein Ziel konfiguriert hat, das
der Standort nicht erlaubt, muss das sehen, sonst glaubt er, die Meldung sei
rausgegangen.

## Die Alarmphilosophie ist Ihre Entscheidung

Mit dem Nutzer am 02.09.2026 so festgelegt: Der Mechanismus wird gebaut, die
Richtlinie wird konfiguriert. Jede Vorgabe ist konservativ und jede ist als
Standortentscheidung dokumentiert, nicht als Produktmeinung.

| Einstellung | Vorgabe | Warum diese Vorgabe |
|---|---|---|
| Shelving-Maximum | 7 Tage | Lang genug für eine geplante Abschaltung, kurz genug, dass ein vergessener Schelf abläuft. |
| Eskalationsstufen | keine | Eine Eskalation, um die niemand gebeten hat, ist ein Anruf um 3 Uhr nachts, um den niemand gebeten hat. |
| Eskalationsziele | keine | Eine unkonfigurierte Installation rät keinen Empfänger. |
| Notify-Allowlist | leer, ausdrückliche Freigabe | Entspricht dem, wie Zeitprogramme und Bedienbefehle ihre Dienstdomänen schon absichern. |
| Alarmhistorie | begrenzt, älteste fällt weg | Unbegrenzt wachsender Zustand ist ein Leck mit freundlichem Namen. |
| Startkarenz | 60 Sekunden | Entitäten treffen beim Hochfahren nicht gleichzeitig ein. |
| Aufbewahrung Zeitplan-Läufe | 14 Tage | Lang genug für „lief die Absenkung letzte Woche?". |

**Eine frisch installierte Anlage ist still und sicher, nicht still und falsch.**
Sie meldet in der Oberfläche, schreibt Historie und benachrichtigt niemanden.
Stille gegenüber einem Empfänger ist eine Vorgabe; Stille gegenüber dem Bediener
wäre ein Fehler.

Das Shelving-Maximum wird **abgelehnt, nicht gekappt**. Vorher wurde eine
Anforderung über 90 Tage stillschweigend auf 7 gekürzt, ohne dass es jemand
erfuhr — der Bediener ging in dem Glauben weg, der Alarm sei drei Monate ruhig.

## Bedienen

Quittieren und Shelving laufen über den Companion (`alarms/ack`,
`alarms/shelve`) und werden auditiert. Die Oberfläche schickt und liest neu; sie
malt nichts optimistisch vorweg, weil eine optimistisch angezeigte Quittierung,
die der Server abgelehnt hat, eine Lüge ist, nach der der Bediener handelt.

Priorität wird als **Wort und als Form** angezeigt, nie nur als Farbe. Auf einem
monochromen Kiosk, in erzwungenen Farben oder für einen Screenreader ist ein
roter Punkt keine Information.

## Was hier nicht steht

- **Trends und Verläufe** — Phase 7. Ein Alarm *verlinkt* auf Trendkontext; der
  Trend selbst gehört nicht hierher.
- **Alarme von entfernten Standorten** — Phase 9.
- **Gemessene Kapazität** bei tausenden Alarmen — Phase 10. Der Index begrenzt
  die *Form* der Kosten; die gemessene Zahl steht noch aus.
