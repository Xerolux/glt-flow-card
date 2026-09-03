# Sprachen

Zwei vollständige Kataloge, Deutsch und Englisch, und **eine dritte Sprache ist
eine Datei — kein Codeeingriff.**

Das war vorher nicht so, und zwar aus einem strukturellen Grund: Wortlaut, der
als `{ de, en }`-Paar *in einem Modul* steht, macht das Hinzufügen von
Französisch zu einer Änderung an jedem Modul, das irgendetwas anzeigt.

## Ein Katalog je Sprache

Alle Zeichenketten liegen in `catalog-de.mjs` und `catalog-en.mjs`, flach,
sortiert, mit `namespace.name`-Schlüsseln. Vollständigkeit wird **gerechnet**,
nicht behauptet: vorher lag der Wortlaut in mindestens vierzehn Modulen in drei
verschiedenen Formen, und niemand konnte aufzählen, was „vollständig" überhaupt
heißen sollte.

## Es gibt keinen Rückfall

Vorher, in neun Modulen und drei Schreibweisen:

```js
return table[key] ?? COPY.en[key] ?? key;
```

Eine fehlende deutsche Übersetzung ergab den **englischen** Satz — nicht zu
unterscheiden von einem absichtlich englisch belassenen Fachbegriff — oder einen
Rückfall weiter den rohen Schlüssel als Bildschirmtext. Beides sieht niemand
außer der Person, der es passiert.

Ein unbekannter Schlüssel und eine fehlende Sprache **werfen** jetzt, und ein
Pseudo-Locale beweist, dass dieses Werfen erreichbar ist: Es wird zur Testzeit
aus den Katalogen erzeugt, akzentuiert und verlängert jeden Satz, und alles, was
nicht die Form ändert, geht nicht durch den Katalog.

## Platzhalter statt Funktionen

Wortlaut mit Werten war eine Funktion je Sprache:

```js
de: (seconds) => `Stand vor ${seconds} s`,
```

Eine Funktion lässt sich nicht als Daten liefern — das allein machte eine dritte
Sprache zum Codeeingriff, selbst wo der Wortlaut schon zweisprachig war.
Platzhalter heißen jetzt: `"Stand vor {seconds} s"`. **Benannt, nicht
positionsabhängig**, weil `(answered, total)` und `(total, answered)` derselbe
Aufruf und ein anderer Satz sind — und eine Übersetzerin sieht die Reihenfolge
nicht.

Ein Platzhalter ohne Wert wirft, statt das Wort `undefined` auf einen
Leitstandsbildschirm zu schreiben.

## Mehrzahl ist Datum, nicht Bedingung

`gaps === 1 ? "Lücke" : "Lücken"` stimmt für Deutsch und Englisch, ist ein
Codeeingriff für jede weitere Sprache und schlicht falsch für jede Sprache mit
mehr als zwei Formen. Die Auswahl liefert jetzt eine CLDR-Kategorie, sodass eine
Sprache `_one` / `_few` / `_many` / `_other` als Daten mitbringt. Geprüft gegen
Polnisch (vier Formen) und Arabisch (sechs) — nicht nur gegen das einfache Paar.

## Formatierung verweigert, statt zu raten

```js
catch (_err) { return new Date(value).toLocaleString(); }
```

Bei jedem Fehler wurde der Zeitstempel in der Sprache des **Browsers**
formatiert, während der Rest des Bildschirms die konfigurierte benutzte.
`03/09` und `09/03` sind derselbe Zeitpunkt, zweimal verschieden geschrieben,
und nichts sagte, welches welches ist.

Ein Formatierer, der nicht formatieren kann, verweigert jetzt und zeigt das
Zeichen für „nicht lesbar", das Phase 7 dafür schon eingeführt hat.

Zwischen Wert und Einheit steht ein **geschütztes Leerzeichen**: Eine Zahl, die
am Spaltenrand von ihrer Einheit wegumbricht, ist eine Zahl ohne Einheit in der
Zeile, die gelesen wird.

## Beide Laufzeiten sagen dasselbe

Die bestehenden Paritätsprüfungen vergleichen **Codes**. Der Companion und der
Browser konnten also auseinanderlaufen in dem, was sie *sagen*, während sie
einig waren in dem, was sie *meinen*. Der Wortlaut wird jetzt als kanonische
Bytes verglichen — Bytes, nicht Werte, weil zwei frühere Paritätsversuche in
diesem Projekt in jedem Wert übereinstimmten und in jedem Byte nicht.

## Was noch fehlt

**Das ist die eine Aussage dieser Phase, die das Produkt nicht erfüllt, und sie
steht als *fehlgeschlagen* im Nachweisregister statt zu fehlen.**

132 Zeichenketten kommen noch nicht aus dem Katalog: die beiden erzeugten
Basisdateien der Alt-Karte, das Einstiegsmodul und einige Diagnosetexte. Der Prüflauf nennt jede
einzelne — mit Liste, nicht mit Anzahl, damit die Zahl nicht unbemerkt wieder
wächst und jede Zeile eine Aufgabe ist.

**Keine RTL-Sprache wird ausgeliefert.** Geprüft ist die *Bereitschaft*: Das
Layout setzt keine Leserichtung voraus. Eine RTL-Sprache ist danach Daten, die
jemand anderes beitragen kann.
