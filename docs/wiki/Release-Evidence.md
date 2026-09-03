# Nachweise

Jede Aussage, die dieses Projekt über sich selbst veröffentlicht, nennt den
Befehl, der sie stützt — und was dieser Befehl gesagt hat.

## Warum das ein Build-Schritt ist

Ein Dokument wird von der Person bearbeitet, die die Aussage haben möchte. Ein
Register, das beim Bauen läuft, nicht.

Der Fehler, gegen den es gebaut ist, stand schon in diesem Projekt: Die
README-Datei sagte „`test/` – lightweight validation tests", während die Suite
521 Node-, 691 Python- und 92 Browsertests umfasste. In dieser Richtung ist das
harmlos. Dieselbe Veralterung in der anderen Richtung ist eine Bedienerin, die
sich auf etwas verlässt, das aufgehört hat, wahr zu sein.

## Drei Regeln

**Eine Aussage ohne Nachweis lässt den Build scheitern.** Keine Warnung. Eine
Aussage, die niemand stützen kann, ist genau das, was hier nicht ausgeliefert
werden soll.

**Eine Aussage, deren Nachweis fehlgeschlagen ist, wird als fehlgeschlagen
veröffentlicht.** Sie wegzulassen würde ihr Fehlen als „trifft nicht zu" lesbar
machen — dieselbe Form wie das Zähl-Orakel, das Phase 9 für Standortlisten
geschlossen hat, eine Ebene höher.

**Automatisch und manuell verbinden sich nicht zu Konformität.** Automatische
Regeln entscheiden nur einen Teil der Erfolgskriterien. „Automatische Prüfungen
bestanden" und „manuelle Prüfung durchgeführt" sind zwei Aussagen mit zwei
Nachweisen, und das Register kennt **kein Feld**, in dem sie sich verbinden. Die
Zusammenführung ist keine Richtlinie, die jemand übergehen kann — es gibt
keinen Platz für das Ergebnis.

## Was hier nie ausgeführt wurde

Vier Fähigkeiten stehen als *nicht ausgeführt* im Register, jeweils mit Grund —
denn eine Leserin, der man es nicht sagt, nimmt an, es sei ausgeführt worden.

| Fähigkeit | Warum nicht |
|---|---|
| Manuelle Prüfung mit assistiver Technologie | in dieser Umgebung nicht steuerbar |
| Kapazität auf repräsentativer Hardware | geteilter Container ohne zugesicherte CPU |
| Installation auf den festgelegten Home-Assistant-Ständen | keine Docker-Engine |
| Herkunftsprüfung der Abhängigkeiten | alle fünf Repository-Endpunkte antworten 403 |

## Zahlen tragen ihre Umgebung

Der bekannte Fehler, den diese Phase ersetzt, ist im Fahrplan benannt: *ein
Diagnose-Mikrotest mit 2 000 Objekten, präsentiert als Plattformkapazität.* Die
Korrektur ist kein größerer Mikrotest.

Jede Messung trägt CPU-Modell und -Anzahl, Speicher, Node-Version und ein
Kennzeichen `representative`, **das nichts im Werkzeug auf wahr setzen kann** —
es bedeutet, dass ein Mensch den Lauf auf benannter Hardware gemacht hat.

Daraus folgt, was eine Zahl aussagen darf:

- unmarkierte Umgebung → „dieses Szenario ist begrenzt und läuft";
- als repräsentativ markiert → „die Plattform trägt N Objekte".

Eine Zahl wird nie dadurch befördert, dass sie in eine Zusammenfassung kopiert
wird. Das ist die Regel aus Phase 9 — die *Form* der Kosten ist bewiesen, die
Größe wird nicht behauptet — nur maschinell gemacht.

## Ein Szenario, das nichts gebaut hat, scheitert

Jede Messung trägt die tatsächlich gebaute Objektzahl und prüft sie gegen die
angekündigte. Ein Szenario, das in drei Millisekunden fertig ist, weil es keine
Objekte gebaut hat, meldet bequem unter dem Budget — und jedes nachgelagerte
Artefakt wiederholt diese Zahl als Tatsache über das Produkt.

Das ist der glaubwürdigste Fehlschluss dieser Phase, weil er wie eine gute
Nachricht aussieht.

## Was das Register nicht ist

- **Keine Freigabe.** Es sagt, was geprüft wurde; ob veröffentlicht wird, ist
  eine Produktentscheidung.
- **Keine Zertifizierung.** Kein Teil dieses Projekts behauptet Konformität mit
  einem Standard.
- **Keine Momentaufnahme.** Es läuft die Befehle, wenn es gebaut wird. Eine alte
  Ausgabe ist eine alte Ausgabe, kein Nachweis.
