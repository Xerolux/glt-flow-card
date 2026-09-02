# Wartung & Assets

Ein Wartungsnachweis existiert, um Monate später eine Frage zu beantworten,
meistens jemandem, der nicht dabei war: **Wurde das gewartet, von wem, und was
wurde festgestellt?**

Jeder Fehler, den die Aufarbeitung hier gefunden hat, zerstörte diese Antwort —
nicht den Arbeitsablauf.

**Dies ist kein CMMS.** Die Anforderungen dieses Produkts schließen Ansprüche auf
CMMS-, Brick-, Haystack-, ISO-50001- oder ISO-55000-Konformität ausdrücklich aus.
Was es gibt, sind begrenzte, nachweisbare Abläufe: Pläne, Arbeitsaufträge,
Nachweise. Ersatzteile und Dokumente sind **Belege an einem Abschluss**, kein
Lagerverwaltungssystem.

## Der Nachweis wird angehängt, nicht überschrieben

Ein Arbeitsauftrag ist eine **Folge von Einträgen**, keine Zeile, die aktualisiert
wird.

Vorher schrieb das Speichern `{**alt, **neu}`. Einen Auftrag abzuschließen löschte
damit, **wer ihn eröffnet hatte und wann** — und ein abgeschlossener Datensatz war
von einem nachträglich umgeschriebenen nicht zu unterscheiden. Eine
Wartungshistorie, die sich unbemerkt ändern lässt, ist kein Nachweis von
irgendetwas.

Eine **Korrektur ist ein neuer Eintrag**, der benennt, was er korrigiert. Der
falsche Eintrag bleibt stehen und ist als korrigiert gekennzeichnet. Das ist der
Unterschied zwischen einer Historie und einem Entwurf.

Der aktuelle Status wird aus den Einträgen **abgeleitet**, nicht daneben
gespeichert. Ein gespeicherter Status kann von den Einträgen abweichen, die ihn
erzeugt haben sollten — und dann widersprechen sich Datensatz und Anzeige, während
beide maßgeblich aussehen.

## Übergänge sind geschlossen

Vorher war jede Zeichenkette ein gültiger Status: `"banane"` ging durch, und ein
abgeschlossener Auftrag konnte still wieder öffnen.

| Von | Nach |
|---|---|
| `open` | `assigned`, `in_progress`, `cancelled` |
| `assigned` | `in_progress`, `open`, `cancelled` |
| `in_progress` | `blocked`, `completed`, `cancelled` |
| `blocked` | `in_progress`, `cancelled` |
| `completed` | `open` (**mit Begründung**) |
| `cancelled` | — |

Geprüft wird **vor** dem Anhängen, sodass ein abgelehnter Übergang keine Spur
hinterlässt. Die Ablehnung nennt **beide** Seiten — den aktuellen und den
versuchten Status —, denn „ungültiger Übergang" allein lässt den Bediener raten,
welche Hälfte falsch war.

**Wiedereröffnen braucht eine Begründung, Zurückgeben nicht.** Dasselbe Ziel
bedeutet je nach Herkunft etwas anderes: `assigned → open` gibt einen Auftrag
zurück, `completed → open` sagt, die Arbeit sei doch nicht erledigt gewesen. Nur
das Zweite muss sich rechtfertigen.

## Fälligkeit wird gerechnet

Vorher war `due` ein von Hand getipptes Datum — ohne Intervallplan, ohne
Betriebsstundenplan, ohne Berechnung und ohne Erinnerung.

### Zwei Modelle, nie ineinander umgerechnet

| Modell | Was es misst |
|---|---|
| `interval` | **Kalenderzeit** — alle sechs Monate, auf lokalen Kalendergrenzen |
| `operating_hours` | **gemessene Laufzeit** — läuft nur weiter, wenn die Anlage läuft |

Eines ins andere umzurechnen hieße zu entscheiden, wie viele Stunden ein Monat
hat. Ein Monat *ist* keine Stundenzahl: 720, 743 oder 745, je nachdem wo die
Zeitumstellung fällt — und **null** Laufstunden für eine Pumpe, die stand.

Intervalle rechnen mit dem Kalender, nicht mit Multiplikation:

- Sechs Monate ab dem **31. Januar** ist der **31. Juli**, nicht der 30. Juli.
- Ein Monat ab dem **31. August** ist der **30. September**, nicht der 1. Oktober.
- Ein Plan um 09:00 bleibt nach der Zeitumstellung um 09:00.

Ein Plan **ohne bisherigen Abschluss ist sofort fällig**, nicht nie fällig: Das
ist das Wahrscheinlichste im Gebäude, das Aufmerksamkeit braucht.

### Betriebsstunden nennen ihre Abdeckung

Betriebsstunden tragen dieselbe Abdeckungsangabe wie alle Messwerte aus Phase 7.
Liegt die Abdeckung unter der Schwelle, lautet die Antwort **„nicht
entscheidbar"** — der gemessene Wert wird trotzdem angezeigt, zurückgehalten wird
die *Entscheidung*, nicht der Beleg.

Der Grund ist gerichtet: Zu wenig gemeldete Laufstunden lassen eine **überfällige**
Wartung aussehen wie eine nicht fällige. Diese Richtung endet mit einem Schaden.

## Grenzen, und sie stehen vorher da

| Grenze | Vorgabe | Warum |
|---|---|---|
| Anhang-Größe | 5 MB | Ein Foto in voller Auflösung. |
| Anhänge je Auftrag | 20 | |
| Einträge je Auftrag | 500 | Mehr ist ein Symptom, kein Nachweis. |
| Aufbewahrung abgeschlossener Aufträge | 730 Tage | Lang genug für die nächste jährliche Prüfung. |

Die Anhangsgrenzen werden **genannt, bevor** eine Datei gewählt wird. Eine Grenze,
die man durch Anstoßen entdeckt, hat die Arbeit vernichtet — und im Anlagenraum ist
diese Arbeit ein Foto, für das jemand auf eine Leiter gestiegen ist.

Ein zu großer Anhang wird **abgelehnt, nicht gekürzt**: Ein halb gespeichertes
Foto sieht aus wie ein Nachweis und ist keiner.

Der Dateityp wird **am Inhalt** geprüft, nicht an der Endung. Ein Name ist eine
Behauptung dessen, der ihn getippt hat.

**Ein offener Auftrag wird nie gelöscht**, wie alt er auch ist. Alter ist kein
Grund, Arbeit zu vergessen, die nicht gemacht wurde. Ein unlesbarer Zeitstempel
behält den Datensatz ebenfalls — Belege wegen eines Formatproblems wegzuwerfen ist
der falsche Tausch. Gelöschtes wird **aufgezeichnet**: Ein Datensatz, der
grundlos verschwindet, ist schlimmer als einer, der nie geführt wurde.

## Verantwortlichkeit

Verantwortlich ist ein **Home-Assistant-Benutzer**, kein freier Text. „Wer ist
zuständig" muss auflösbar, benachrichtigbar und rechteprüfbar sein.

## Was es nicht gibt

- **Kein Ersatzteillager, keine Bestellung, keine Kosten.** Belege am Abschluss,
  mehr nicht.
- **Keine eigene Benachrichtigung.** Phase 6 besitzt den Versandweg, und ihre
  Allowlist gilt unverändert.
- **Keine Konformitätsaussage** zu CMMS-, Brick-, Haystack- oder ISO-Normen.
