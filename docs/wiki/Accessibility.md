# Barrierefreiheit

Diese Seite sagt, **was geprüft ist, womit — und was nicht geprüft ist.**

Die zweite Hälfte ist die wichtigere. Eine Aussage wie „barrierefrei" ohne
Angabe, wer das wie festgestellt hat, ist genau die Art von Behauptung, gegen
die diese Phase gebaut wurde.

## Was eine automatische Prüfung entscheiden kann — und was nicht

Regelwerke wie axe-core entscheiden nur die Erfolgskriterien, die sich aus dem
DOM und den berechneten Stilen ableiten lassen. Alles, was Urteilsvermögen
erfordert — **ob ein Name etwas bedeutet**, ob die Fokusreihenfolge der
Lesereihenfolge entspricht, ob eine Fehlermeldung sagt, was zu tun ist —
liegt außerhalb dessen, was ein Programm feststellen kann.

**Ein sauberer automatischer Durchlauf ist mit einem unbenutzbaren Produkt
vereinbar.** Deshalb sind „automatische Prüfungen bestanden" und „manuelle
Prüfung durchgeführt" zwei getrennte Aussagen im Nachweisregister, und das
Register kennt keine Struktur, in der sie sich zu einer Konformitätsaussage
verbinden.

**In dieser Umgebung wurde die manuelle Hälfte nicht durchgeführt.** Es lässt
sich hier keine assistive Technologie steuern. Ein Test, der behauptet, etwas
„würde korrekt angesagt", behauptet eine Überzeugung — solche Tests wurden
nicht geschrieben.

## Was geprüft ist

| Eigenschaft | Wie |
|---|---|
| Rolle und zugänglicher Name an jedem fokussierbaren Element | im ausgelieferten Artefakt, nicht im Quelltext |
| Fokus sichtbar bei entfernter Farbe | monochromes Stylesheet, wie in Phase 7 und 9 |
| Keine Tastaturfalle | Tab-Durchlauf durch jedes Formular |
| Umbruch bei 320 px und 200 % Zoom | ohne seitliches Scrollen der Seite |
| Kontrast | berechnete Werte gegen den tatsächlich gemalten Hintergrund |
| Alle registrierten Oberflächen erfasst | die Liste kommt aus der Registrierung selbst |

## Ein `title` ist kein Name

Das Produkt hatte **kein einziges** `aria-label` und stattdessen `title`- und
`placeholder`-Attribute. Beides ist kein zugänglicher Name:

- Ein `title` wird nicht von jedem Screenreader angesagt, auf Touch-Geräten nie.
- Ein `placeholder` verschwindet in dem Moment, in dem jemand tippt — also
  genau dann, wenn man wissen muss, in welchem Feld man ist.

Beide wurden ersetzt, nicht ergänzt.

## Farbe ist der redundante Kanal

Jede Zustandsanzeige trägt ihren Zustand als **Wort und Form**, nicht als
Farbton. Diese Regel ist älter als diese Phase und wird mit entfernter Farbe
geprüft.

Trotzdem muss die Farbe lesbar sein. Die ausgelieferte Statuspalette erreichte
gegen Weiß 1,87 : 1 bis 3,24 : 1, wo AA 4,5 : 1 verlangt — Farben, die für einen
dunklen Grund entworfen und auf beiden verwendet wurden. Auf einem hellen
Leitstandsbildschirm las eine Bedienerin „live" und „veraltet" als denselben
blassen Fleck, in genau den Oberflächen, die den Unterschied zeigen sollen.

Die Palette liegt jetzt an einer Stelle, mit einem hellen und einem dunklen Wert
je Ton **und dem gemessenen Kontrastverhältnis daneben**, damit eine spätere
Änderung geprüft und nicht geschätzt werden kann.

## Ansagen

Ein Ergebnis, das eine Bedienerin sonst nur bemerkt, weil sich etwas bewegt hat,
wird angesagt:

- **Bestimmt** (`assertive`): ein Bedienergebnis und eine Ablehnung. Niemand darf
  erst beim nächsten Bildaufbau erfahren, dass die Wirkung eines Befehls
  unbekannt ist — bis dahin kann er erneut gesendet worden sein.
- **Höflich** (`polite`): ein Simulationsbanner. Das ist Kontext, kein Ergebnis.

## Was es nicht gibt

- **Keine Konformitätsaussage.** Weder WCAG 2.2 AA noch eine andere. Die
  automatische Hälfte reicht dafür nicht, und die manuelle fehlt.
- **Keine Einstellungsseite für Barrierefreiheit.** Barrierefreiheit, die man
  einschalten muss, ist eine Funktion für Leute, die wissen, dass sie danach
  suchen müssen.
- **Keine Screenreader-Automatisierung.** Sie ist hier nicht möglich, und ihr
  Fehlen wird festgehalten statt simuliert.
