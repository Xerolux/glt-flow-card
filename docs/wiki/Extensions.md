# Erweiterungen

Ein Erweiterungspaket fügt Symbole, Profile, Vorlagen, Deskriptoren und
Übersetzungen hinzu. Es fügt **keinen Code** hinzu.

## Was ein Beitrag ist

Ein Beitrag ist **Daten**, die von Erstanbieter-Code interpretiert werden. Es
wird kein beigesteuertes JavaScript geladen, ausgewertet oder ausgeführt — in
keinem Realm.

Nicht auszuführen ist notwendig und nicht hinreichend. Ein deklaratives SVG kann
immer noch `<script>` tragen, ein `onload`-Attribut, ein `href` irgendwohin ins
Internet oder ein `<foreignObject>` voller beliebigem Markup. Deshalb arbeitet
der Prüfer mit einer **Positivliste** von Elementen und Attributen statt mit
einer Sperrliste. Eine Sperrliste ist das Versprechen, an alles gedacht zu
haben, und die Liste der Dinge, an die niemand gedacht hat, ist genau die, auf
die es ankommt.

Abgelehnt werden unter anderem: `script`, `foreignObject`, `iframe`, `use`,
`image`, `style`, `a`, `animate`, `set`, jedes Ereignisattribut, jeder `href`,
der kein reiner Fragmentverweis ist, jedes `url(...)`, das nicht auf ein
Fragment zeigt, `javascript:`- und `data:`-Schemata, und jede DOCTYPE-Deklaration.

Ein Schema wird erst entschlüsselt und dann verglichen: `java&#115;cript:` ist
dieselbe URL wie `javascript:`, sobald ein Browser sie liest. Ein `data:`-Verweis
wird unter eigenem Namen abgelehnt, nicht als JavaScript-URL — eine Ablehnung,
die das Falsche benennt, schickt den Autor auf die Suche nach Skript, das er nie
geschrieben hat.

Ein Element außerhalb der Positivliste wird auch dann abgelehnt, wenn es harmlos
ist. `feGaussianBlur` zeichnet nichts Gefährliches; es wird abgelehnt, weil
niemand entschieden hat, dass es sicher ist, und das ist der ganze Mechanismus.

## Was das ausschließt

Diese Entscheidung ist bewusst und hat einen Preis, der hier steht statt
verschwiegen zu werden.

Ausgeschlossen ist **jeder Beitrag, dessen Aussehen berechnet statt beschrieben
wird**:

- eine Füllstandsanzeige, deren Balkenhöhe aus der Kennlinie eines Herstellers
  kommt statt aus einer linearen Abbildung;
- ein Widget, das mehrere Entitäten nach einer Regel zusammenfasst, die die
  Karte nicht bereits kennt;
- ein Renderer, der abhängig von Werten anders zeichnet, über die deklarativen
  Ausdrücke hinaus, die die Karte definiert.

Die Grenze ist genau: **jede Berechnung muss sich im Vokabular ausdrücken
lassen, das die Karte definiert.** Das Vokabular kann wachsen; eine wirklich
neue *Art* von Berechnung braucht ein Erstanbieter-Release, kein Fremdpaket.

Die Alternative — beigesteuerter Code in einem Worker hinter einem
Nachrichtenvertrag — ist als `F-01` in `.planning/FUTURE-ROADMAP.md`
festgehalten, mit ihren Kosten: ein Nachrichtenformat, das zur dauerhaften
Kompatibilitätszusage wird, Validierung in beide Richtungen, Ressourcengrenzen,
eine Entscheidung darüber, welche Daten den Worker erreichen, und die Erkenntnis,
dass ein Worker kein Sandkasten ist — `fetch` funktioniert dort, Netzwerk muss
also aktiv per CSP verweigert werden.

Später umzusteigen ist billig: Beiträge sind namensraumgebunden und versioniert,
eine `worker`-Art ließe sich additiv ergänzen. Umgekehrt — B ausliefern und
später einschränken — ginge nicht.

## Installation

Lokal. Ein öffentliches Verzeichnis, eine Registry oder ein Auffindmechanismus
gehören nicht zu Version 1.1 (`F-02`).

Eine Installation ist **ganz oder gar nicht**. Der Prüfer läuft, dann jeder
Konflikt, dann jede Schranke — und erst dann wird geschrieben. Wer erfährt „das
hat nicht funktioniert", muss nicht herausfinden, welche Hälfte doch
angekommen ist.

Abgelehnt wird eine Installation, wenn

- das Manifest ungültig ist,
- der Namensraum schon belegt ist (mit beiden Versionen im Text),
- eine Beitrags-ID kollidiert (mit beiden Paketen und der strittigen ID),
- eine Schranke überschritten ist (64 Pakete, 256 Beiträge je Paket, 4096
  insgesamt),
- oder das Paket eine Projektschema-Version angibt, die diese Karte nicht kennt.

Der letzte Punkt lehnt ab statt zu degradieren: ein Paket für eine unbekannte
Version lässt sich nicht sicher lesen, indem man rät, welche Teile noch gelten.

Ein Paket zu entfernen wird abgelehnt, solange ein Projekt noch damit zeichnet —
mit den betroffenen Projekten und den genauen Beitrags-IDs. Ein hängender
Symbolverweis ist eine Zeichnung, die still aufgehört hat, etwas zu bedeuten,
und das ist schlimmer als eine, die sich nicht löschen lässt.

## Sichtbarkeit

Ein Paket in einem Projekt, das der Aufrufer nicht öffnen darf, erscheint in
keiner Liste, keiner Zählung und keiner Konfliktmeldung. Ein dort belegter
Namensraum blockiert auch keine Installation in einem Projekt, das er öffnen
darf — das würde seine Existenz durch eine Ablehnung verraten.

Innerhalb eines Projekts, das er öffnen darf, gilt das Gegenteil: ein Konflikt
nennt beide Pakete und die strittige ID, weil der Betreiber wissen muss, was er
entfernen soll, und Verschweigen dort nichts schützt.

## Zwei Laufzeiten, ein Urteil

Der Prüfer existiert in JavaScript und in Python. Eine Regel, die es nur im
Browser gibt, ist eine Regel, die der Server nicht durchsetzt — und eine
Installation, die ein Paket annimmt, das der Browser abgelehnt hätte, hat aus
dieser Ablehnung nichts gelernt.

Die Home-Assistant-Laufzeit hat kein `node`, die beiden lassen sich also nicht
durch Nebeneinanderlaufen vergleichen. Stattdessen trägt
`sdk-parity-corpus.json` die Manifeste **und** die Urteile, die JavaScript
gefällt hat; die Node-Suite hält die Aufzeichnung aktuell, die Python-Suite liest
dieselben Eingaben und verlangt dieselben Urteile. 39 Fälle, davon 4
angenommene — ein Korpus nur aus Ablehnungen belegt einen Prüfer, der alles
ablehnt.
