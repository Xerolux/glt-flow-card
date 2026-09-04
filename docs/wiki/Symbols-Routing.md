# Symbolkatalog und Routing

Was der Katalog enthält, was der Router garantiert, und wo jede Zahl auf dieser
Seite herkommt.

## Der veröffentlichte Katalog

**600 Varianten** aus **100 Basissymbolen** in **6 Stilen**, über 8 Gewerke. Jedes Symbol gehört zu einer Hauptgruppe (Gewerk) und einer Untergruppe (z. B. Heizung → Wärmepumpen, RLT → Wärmerückgewinnung); der Symbol-Browser im Designer zeigt und durchsucht beide Ebenen.

Diese Zahl ist keine Behauptung, sondern eine gemessene Größe. `catalog-evidence.json`
entsteht, indem jede Variante tatsächlich gezeichnet und das Ergebnis
gehasht wird; der Generator schreibt die Datei gar nicht erst, wenn ein Symbol
nichts zeichnet, zwei Basissymbole dieselbe Geometrie liefern oder zwei Stile
denselben Token-Satz tragen. Ein Test verlangt, dass die Zahl in dieser
Dokumentation und die Zahl im Nachweis dieselbe ist.

Ein Kreuzprodukt aus zwei Achsen ergibt nur dann eine Menge unterschiedlicher
Varianten, wenn beide Achsen unterschiedlich sind. Genau das wird geprüft — und
genau das stimmte vorher nicht: drei Basissymbole (`ahu`, `wallbox`,
`room_sensor`) zeichneten überhaupt nichts und wurden trotzdem mitgezählt, und
neun weitere teilten sich die Zeichnung eines anderen Symbols.

| Gewerk | Basissymbole | Varianten |
|---|---:|---:|
| Heizung | 15 | 90 |
| Hydraulik | 21 | 126 |
| RLT | 16 | 96 |
| Kälte | 8 | 48 |
| Energie | 9 | 54 |
| Sensorik | 10 | 60 |
| Elektro | 11 | 66 |
| Brandschutz | 10 | 60 |

Elektro deckt Verteilung, Schutz und Trennung ab (Niederspannungsverteilung,
Sammelschiene, Unterverteilung, Transformator, USV, Netzersatzanlage, LS-Schalter,
FI-Schutzschalter, Überspannungsableiter, Lasttrennschalter). Brandschutz deckt
Detektion, Löschung und Abschottung ab (Brandmeldezentrale, Rauch- und
Wärmemelder, Handfeuermelder, Ansaugrauchmelder, Sprinklerkopf, Nassalarmventil,
Löschanlage, Brandabschottung, Brandschutztür).

## Typisierte Ports

Ein Port trägt `medium`, `direction`, `side`, `kind` (`process`, `signal`,
`power`) und `multiplicity` (`one`, `many`). Bis Version 1.1 prüfte **nichts**
die Verträglichkeit, also wurde jede unmögliche Verbindung gezeichnet.

Eine abgelehnte Verbindung nennt ihren Grund aus einer geschlossenen Menge:

| Grund | Bedeutung |
|---|---|
| `kind_mismatch` | Prozess, Signal und Energie lassen sich nicht mischen |
| `medium_mismatch` | Beide Ports führen Verschiedenes |
| `direction_conflict` | Beide Ports zeigen in dieselbe Richtung |
| `multiplicity_exceeded` | Der Port hat die eine Verbindung bereits, die er zulässt |
| `self_connection` | Ein Port kann nicht mit sich selbst verbunden werden |
| `duplicate_connection` | Diese beiden Ports sind schon verbunden |

Die Reihenfolge der Prüfungen ist bewusst gewählt: die gröbste Abweichung wird
zuerst gemeldet. Wer eine Sammelschiene an einen Heizungsvorlauf legt, erfährt,
dass die *Arten* verschieden sind — nicht, dass er Medien vergleichen soll, die
ohnehin nie gepasst hätten.

Anders als eine Rechteverweigerung ist eine technische Ablehnung **erklärend**.
Eine Rechteverweigerung ist absichtlich stumm, weil der Aufrufer nicht erfahren
soll, was existiert. Hier liegt die Zeichnung vor dem Ingenieur, und das
Verschweigen des Grundes schützt nichts — es kostet nur den Nachmittag, den er
mit Raten verbringt.

Ein Medium wird verglichen, nie nachgeschlagen. Eine Anlage darf ein Medium
benennen, das diese Karte nie gehört hat; das ist eine Benennungsentscheidung
der Anlage, kein Fehler.

## Endpunkt-Identität

Eine Verbindung meint ein Paar aus Bauteil **und** Port. Eine Port-ID allein ist
keine Identität: mehrere Bauteile teilen sich ein Profil, `p-out` benennt also
einen Port an jeder Pumpe der Anlage.

Die Geometrie wird aus dem aufgelösten Port abgeleitet, nicht am Pfad
gespeichert. Ein Bauteil zu verschieben bewegt daher den Endpunkt und kann nie
ändern, *welcher* Port gemeint ist.

Ein Endpunkt, der sich nicht mehr auflösen lässt, wird **gemeldet** — mit Pfad,
Ende, Bauteil und gesuchtem Port — und nie stillschweigend an den nächsten Port
gehängt. Ein neu angehängter Endpunkt macht aus einer Zeichnung, die jemand
korrigieren muss, eine Zeichnung, die still falsch ist, und die still falsche
ist die, nach der gebaut wird.

Endpunkte überstehen vier Wege, die sie lösen könnten, und alle vier werden
geprüft: eine Bearbeitung, Kopieren/Einfügen, einen Bundle-Umlauf und eine
Migration.

## Routing

**Deterministisch.** Dieselbe Zeichnung wird in dieselben Bytes geroutet. Kein
Zufall, keine Uhr, keine Iteration über eine ungeordnete Sammlung. Drei
deklarierte Tiebreaks: der günstigste Weg, dann der geradeste, dann der
lexikografisch kleinste Punktverlauf.

**Ein Pixel bewegt ein Segment.** Innenliegende Ecken rasten auf das
Zeichenraster ein, die Ports behalten ihre exakten Positionen. Ohne diese Regel
biegt die günstigste Route dort ab, wo zufällig ein Port sitzt — und eine Pumpe
um ein Pixel zu verschieben zieht den ganzen Strang mit, sodass der Unterschied
zur Zeichnung so groß ist wie die Zeichnung.

**Keine Route läuft durch Anlagentechnik.** Vorher wurde bei blockiertem Weg
`candidates[0]` zurückgegeben — ein Pfad *durch* das Hindernis, still als Route
ausgegeben. Eine Zeichnung, die eine Leitung durch eine Kältemaschine führt, ist
schlimmer als eine, die ablehnt: sie liest sich wie technische Wahrheit.

**Eine unmögliche Verbindung sagt das.** `obstructed`, `detour_exceeded`,
`scene_too_complex` oder `degenerate_endpoints` — und eine Ablehnung trägt
keinen Pfad, sodass niemand sie versehentlich zeichnen kann.

**Eine Route verlässt die Seite, die ihr Port angibt.** Das erste Segment steht
senkrecht auf der Bauteilkante, damit ein Leser die Seite sieht, ohne zu messen.

**Verzweigung und Kreuzung sind unterscheidbar.** Beide sehen auf Papier gleich
aus, wenn die Zeichnung sie nicht trennt, und wer sie nicht unterscheiden kann,
kann die Zeichnung nicht lesen. Zwei Anschlüsse an einen Sammler teilen sich
zurecht ihre Zuführung — das ist ein Strang, kein Fehler.

**Neu-Routen ist lokal.** Ein Bauteil zu verschieben rechnet die Routen in
seiner Nähe neu und keine anderen. Das ist keine Optimierung, sondern Bauart:
eine Route wird gegen die Hindernisse *in ihrer Nähe* gerechnet, transitiv
gefunden, also war ein entferntes Hindernis nie eine Eingabe. Über 40 Routen
rechnet eine Verschiebung genau eine neu, und ein Test vergleicht das Ergebnis
Byte für Byte gegen eine vollständige Neuberechnung.

Die Schranken sind in Segmenten und Routen angegeben, nie in Millisekunden. Eine
Millisekunden-Aussage ist eine Kapazitätsbehauptung; die gehören in Phase 10,
und ein auf einem CI-Runner gemessenes Budget sagt etwas über den Runner.

### Was noch nicht geht

Zwei diagonale Routen in einem geschlossenen Kasten lassen sich durch keinen
Spurversatz trennen: jede besitzt das nahe Ende der einen Zeile und das ferne
der anderen, und keine Anordnung der beiden Abbiegespalten räumt beide Zeilen.
Das aufzulösen braucht einen Versatz *mit* zusätzlichen Ecken, und der ist nicht
implementiert. Das Paar behält seine Geometrie und wird in
`spacing_violations` **gemeldet** — mit beiden Routen, Achse, Ausdehnung und
gefordertem Abstand. Eine Meldung lässt dem Ingenieur eine Zeichnung, mit der er
handeln kann.
