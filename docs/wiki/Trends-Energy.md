# Trends & Energie

**Dieses Produkt ist kein Historian.** Es hat keine eigene Zeitreihendatenbank,
keine eigene Aufbewahrungsfrist und keine eigene Verdichtung. Es liest den
**Recorder von Home Assistant** — und was der Recorder nicht aufgezeichnet hat,
existiert für diese Karte nicht.

Das steht bewusst als erster Satz. Die frühere Oberfläche legte das Gegenteil
nahe: Sie bot Zeiträume bis zu einem Jahr an und rechnete im Browser Energien
aus, als verfüge sie über einen eigenen Datenbestand. Wer die Aufbewahrung des
Recorders auf zehn Tage stellt, bekommt für einen Monatsbericht keinen Monat —
und muss das erfahren, bevor er die Zahl weitergibt.

## Die eine Regel

**Die Oberfläche zeigt nie eine Zahl, ohne zu zeigen, wovon sie eine Zahl ist.**

Wert, Einheit, Zeitraum und **Abdeckung** reisen gemeinsam oder gar nicht. Das
ist keine Verzierung: Sechs der aufgearbeiteten Fehler machen aus *fehlend* eine
Zahl, und jeder davon erzeugt etwas, das wie ein Messwert aussieht — eine leere
Antwort in einer bemaßten Achse, ein sechsstündiger Ausfall als gerade Linie,
ein Monat mit der Hälfte der Zähler offline als kleinere Kostensumme. Keines
davon sieht kaputt aus.

### Eine Lücke ist ein Bruch

Nicht gestrichelt, nicht heller, kein Tooltip. Auf einem monochromen Leitstand
und in erzwungenen Farben sind das alles dieselbe Linie. Zwei Messreihen mit
einem Loch dazwischen werden als **zwei Segmente** gezeichnet.

Die Lückenliste des Companion ist maßgeblich — nicht das Fehlen eines Punktes.
Eine Zeitreihe wird nicht zugesichert mit Nullwerten aufgefüllt, und ein Bruch,
der sich darauf verließe, schlösse die Linie über genau die Abwesenheit, die der
Companion gerade gemeldet hat. Ein unlesbarer Zeitstempel bricht ebenfalls: Zwei
Messwerte zu verbinden, deren Reihenfolge nicht feststeht, zeichnete eine
Stetigkeit, die niemand gemessen hat.

### Abdeckung wird auch bei 100 % genannt

Erschiene das Abzeichen nur, wenn etwas fehlt, käme sein Fehlen mit der Zeit
zu bedeuten: *wir haben nicht nachgesehen*.

### Jedes Diagramm hat eine Tabelle

Über Tastatur erreichbar. Der Leitstands-Kiosk hat keinen Zeiger — dort ist die
Tabelle die einzige Möglichkeit, einen Trend zu lesen. Eine Lücke ist dort eine
**markierte Zeile mit ihrem Intervall**, keine leere und keine ausgelassene.

## Zeiträume sind Kalenderzeiträume

Aufgelöst **serverseitig**, in der Zeitzone des Standorts. Im Browser aufzulösen
antwortete für die Zone des Browsers, und ein Browser in einer anderen Zone als
die Anlage ist normal.

| Was | Wirklichkeit |
|---|---|
| Tag im Frühjahr | **23 Stunden** |
| Tag im Herbst | **25 Stunden** |
| Oktober 2027 | **745 Stunden**, nicht 744 |

Ausgeliefert war `Math.floor(x / bucketMs) * bucketMs`: immer exakt `bucketMs`
lang und am UTC-Epoch ausgerichtet. Jeder „tägliche" Eimer war damit ganzjährig
um ein bis zwei Stunden verschoben und enthielt an einem Umstellungstag eine
Stunde zu viel oder zu wenig — vom falschen Tag. Ein Monat ließ sich in
`bucket_minutes` überhaupt nicht ausdrücken, während der Report-Designer Monate
und Jahre anbietet.

Diese Rechnung ist aus dem ausgelieferten Artefakt **entfernt**, nicht
stillgelegt: Die Karte kann einen verschobenen Eimer nicht mehr anzeigen,
statt dass man ihr vertrauen müsste, es zu lassen.

`Tag`, `Woche` und `Monat` beantwortet `recorder/statistics_during_period`.
`Jahr` ist ausschließlich über die Kalenderangabe von
`recorder/statistic_during_period` erreichbar — wer nur den ersten Befehl liest,
schließt fälschlich, das Produkt müsse Jahre selbst aggregieren.

### Das Raster: Fenster und Eimer sind zweierlei

Ein Zeitraum sagt, *welcher* Ausschnitt gemeint ist. Die Schrittweite sagt, in
welchen Abschnitten er gemessen wird. Beides ist nicht auseinander ableitbar:

| Fenster | Schritt | Anzahl |
|---|---|---|
| Tag, gleitende 24 h | Stunde | 23, 24 oder 25 |
| Woche | Tag | 7 |
| Monat | Tag | 28–31 |
| Jahr | Monat | 12 |

Der Oktober 2027 hat **31 Tagesabschnitte** und **745 Stunden**. Keine der
beiden Zahlen folgt aus der anderen.

**Das Raster wird nie aus der Antwort abgeleitet.** Der Recorder lässt einen
leeren Zeitraum ganz weg — ein aus den zurückgekommenen Zeilen gebautes Raster
meldete einen Monat, in dem an neun Tagen nichts aufgezeichnet wurde, als
vollständigen 22-Tage-Monat. Genau dagegen gibt es die erwarteten Zeitpunkte.

Eine gleitende 24-Stunden-Spanne bleibt auch am Umstellungstag 24 Stunden lang,
weil sie eine *Dauer* ist. Ein Kalendertag ist es nicht. Dass diese beiden
Antworten auseinandergehen, ist richtig und kein Fehler.

## Zwei Zählermodelle, nie ineinander umgerechnet

Das ist die Intervall-und-Zeitpunkt-Regel der Zeitprogramme in neuem Gewand.

| Modell | Was es ist | Verbrauch im Zeitraum |
|---|---|---|
| `counter` | akkumuliert | **Differenz** über die Zeitraumgrenze |
| `rate` | Momentanwert | **Integral** über den Zeitraum |

Ein Zähler **muss** sein Modell angeben; Schema 6 macht das Feld verpflichtend.
Vorher las die Auswertung schlicht den Zählerstand: Ein Lebensdauerzähler mit
148 231 kWh ergab 148 231 × Preis, ausgewiesen als Kosten des Standorts.

**Zählerrücksetzungen sind Sache des Recorders**, nicht unsere. `change` ist
`sum - prev_sum` über einen rücksetzbereinigten Laufsummenwert, ein
Zeitraumverbrauch ist also bereits rücksetzfest. Eine eigene Rücksetzerkennung
verdoppelte eine gut geprüfte Implementierung — und geriete, weil Rücksetzungen
selten und schwer nachzustellen sind, monatelang unbemerkt falsch.

## Einheiten werden geprüft, nicht geraten

**Ablehnen statt verschlechtern.** Ein unverträgliches Paar wird mit Begründung
abgelehnt, nicht auf Verdacht umgerechnet: Eine falsche Kostenzahl ist schlimmer
als eine fehlende.

- Ein Zähler in `Wh` und einer in `kWh` trugen zur selben Euro-Summe bei — drei
  Größenordnungen auseinander.
- Ein nicht lesbarer Zähler wurde still übersprungen, sodass ein Monat mit der
  Hälfte der Zähler offline eine kleinere, selbstbewusste Summe meldete. „Keine
  Zähler konfiguriert" und „keine Zähler lesbar" waren nicht zu unterscheiden.
- CO₂ gab es nur für `electricity`, sodass Gas und Fernwärme aus einer als
  Standortsumme ausgewiesenen Zahl verschwanden.
- `StatisticMeanType.CIRCULAR` ist real: Das arithmetische Mittel aus 350° und
  10° ist 180° — das genaue Gegenteil der Wahrheit, und ein Wert, den nachgelagert
  nichts beanstandet.

**Eine Summe nennt, was sie ausgelassen hat, in einer eigenen Zeile.**

## Autorisierung

| Route | Fähigkeit | Aufzählung |
|---|---|---|
| `glt_flow_card/history/series` | `history.read` | gefiltert |
| `glt_flow_card/history/statistics` | `history.read` | gefiltert |
| `glt_flow_card/history/coverage` | `history.read` | undurchsichtig |
| `glt_flow_card/history/export` | **`history.export`** | undurchsichtig |

Export ist eine **eigene** Fähigkeit. Wer die Historie der Anlage am Bildschirm
ansehen darf, darf sie nicht automatisch aus dem Haus tragen; die Audit-Zeile
sagt hinterher, was das Haus verlassen hat und wie viel.

Die beiden zeilenliefernden Routen **filtern, statt abzulehnen** — eine
Ablehnung verriete einem unberechtigten Aufrufer selbst, dass es Zeilen gibt.
Das Limit greift **nach** dem Filtern, sonst wird es zum Zähl-Orakel.

## Grenzen

Die Abfrage ist **vor** ihrer Ausführung begrenzt, nach Entitätenzahl und
Fensterlänge; eine hinterher geprüfte Grenze hat bereits bezahlt, was sie
verhindern sollte. Eine zu große Abfrage wird herabgestuft oder abgelehnt, und
die Antwort **sagt welches von beidem** — der Leser hat ein Recht darauf zu
wissen, welcher Vertrag erzeugt hat, was er ansieht, und ob überhaupt etwas es
erzeugt hat.

Die Karte holt den Trendzustand beim Rendern, gedrosselt auf 60 Sekunden, mit
dem Zeitstempel **vor** der Anfrage. Ein Companion, der ablehnt oder nicht
erreichbar ist, wird einmal pro Intervall gefragt statt einmal pro Bild.

## Was es (noch) nicht gibt

- **CSV-Download und Druck/PDF im Browser** sind entfernt. Sie schrieben den
  gerade gerenderten Wert, ohne Zeitraum und ohne Abdeckung. Der Export liefert
  jetzt das Modell; die drei Darstellungen leiten alle daraus ab, keine aus der
  Serialisierung einer anderen.
- **Gemessene Kapazität** bei sehr großen Anlagen steht aus (Phase 10).
