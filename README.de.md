# GLT Flow Card

[![HACS](https://img.shields.io/badge/HACS-custom-41BDF5.svg)](https://hacs.xyz/)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-18BCF2.svg)](https://www.home-assistant.io/)

**GLT Flow Card** ist eine moderne, frei konfigurierbare Gebäudeleit-/Anlagenkarte für Home Assistant. Sie verbindet ein professionelles GLT-Anlagenschema mit Live-Entitäten, animierten Medienströmen, optionalen Anlagenfotos, Replay, Mehrfach-Trends und frei definierbaren KPI-Kacheln.

*[English version](README.md)*

> Unabhängiges Open-Source-Projekt, nicht mit iDM Energiesysteme verbunden. Die Idee orientiert sich allgemein an professionellen GLT/BMS-Oberflächen und den öffentlich beschriebenen [iVIS](https://www.idm-energie.at/ivis/)-Funktionen; Oberfläche, Code und Konfigurationsmodell sind eigenständig.

<!-- GLT-SHOWCASE:START -->

## GLT / SCADA Showcase

Die folgenden Bilder werden automatisch aus der **aktuellen GitHub-Pages-Oberfläche und dem aktuellen Online-Designer** erzeugt. Sie zeigen dieselbe detaillierte Anlage in unterschiedlichen Darstellungen — ohne eigene Anlagenbilder: Pumpen, 2-/3-Wege-Ventile, Mischer, hydraulische Weiche, Heizstab, Speicher, Wärmetauscher, Sensorik, Medienleitungen, Alarme, Replay und Trends.

<table>
<tr><th width="50%">Neo 2030 · Dark</th><th width="50%">Neo / Operations · Light</th></tr>
<tr><td><img src="docs/images/neo2030-dark-live.png" alt="Neo 2030 Dark GLT"></td><td><img src="docs/images/neo2030-light-live.png" alt="Neo 2030 Light GLT"></td></tr>
</table>

<table>
<tr><th width="50%">Classic SCADA</th><th width="50%">P&amp;ID Dark</th></tr>
<tr><td><img src="docs/images/classic-scada-live.png" alt="Classic SCADA GLT"></td><td><img src="docs/images/pid-dark-live.png" alt="P&ID Dark GLT"></td></tr>
</table>

### Designer · Dark und Light

<table>
<tr><th width="50%">Designer Dark</th><th width="50%">Designer Light</th></tr>
<tr><td><img src="docs/images/designer-dark-live.png" alt="GLT Flow Card Designer Dark"></td><td><img src="docs/images/designer-light-live.png" alt="GLT Flow Card Designer Light"></td></tr>
</table>

### Detail-Symbolbibliothek

![GLT Flow Card Symbolbibliothek](docs/images/symbol-library-live.png)

> Bedienbare Anlagenobjekte können in Home Assistant eine Objektbedienung öffnen oder konfigurierte HA-Services ausführen. Die GitHub-Pages-Demo simuliert diese Bedienebene ohne eine echte Anlage zu schalten.

<!-- GLT-SHOWCASE:END -->

<!-- GLT-V1:START -->

## GLT Engineering Platform 1.0

**Version 1.0** erweitert die GLT Flow Card von einer Visualisierung zu einer Home-Assistant-basierten GLT-/SCADA-Engineering-Plattform. Die bestehenden sechs Designs und der Drag-&-Drop-Designer bleiben erhalten; hinzu kommen professionelle Betriebs-, Engineering- und Inbetriebnahmefunktionen.

- vollständiges **Betriebszustandsmodell**: Auto, Hand, Lokal, Fern, Störung, Warnung, Sperre, Interlock, Wartung, Kommunikationsfehler, veraltete/ungültige Werte und Befehlsstatus;
- **Objektbedienung** für Pumpen, Ventile, Mischer, Antriebe und Sollwerte mit serverseitiger Rechteprüfung im Companion;
- **Alarm Lifecycle 2.0** mit Priorität, Alarmklasse, Hysterese, Verzögerung, Quittierung, Kommentar, Shelving, Historie, Benachrichtigung und Eskalation;
- **Wochenprogramme, Kalender und Zeitpläne**;
- semantische Struktur **Standort → Gebäude → Etage → Anlage → Teilanlage → Aggregat → Datenpunkt**;
- **Auto-Mapping** vorhandener Home-Assistant-Entities auf parametrische GLT-Komponenten;
- mehr als **250 Symbolvarianten** plus parametrisierte Maschinenprofile, intelligente Ports und hindernisbewusstes Routing;
- CAD-Werkzeuge: Layer, Sperren, Z-Reihenfolge, Ausrichten, Verteilen, Lasso, Copy/Paste und Minimap;
- Drill-down/Breadcrumbs, Historian-Aggregationen, Simulation, Inbetriebnahme und Entity-Diagnose;
- Energie, Wartung/Arbeitsaufträge, Reports, Multi-Site/Remote-HA, Plugin-SDK, Projekt-Diff und `.gltproject`-Bundles;
- Config Flow, serverseitiges Audit, Projekt-Locking sowie Deutsch/Englisch-Grundlage.

### Alarme, Benachrichtigungen und Zeitprogramme

Ein Alarm-Lebenszyklus im Backend, und jede Oberfläche zeigt an, was er
entschieden hat. Der Companion wertet Bedingung, Hysterese und Verzögerung aus;
die Karte stellt das Ergebnis dar. Die Verzögerung ist auf die erste Aktivierung
verankert — sie unterdrückt einen Ausreißer, nicht eine dauerhafte Störung, die
zufällig unruhig ist. Shelving, Wartung und Quittierung werden dort geprüft, wo
entschieden wird, und ein unterdrückter Alarm hält fest, **welche**
Unterdrückung galt und bis wann.

Jeder Zustellversuch wird mit Dienst, Empfänger, Ergebnis und Fehlertext
aufgezeichnet. Eine fehlgeschlagene Zustellung entfernt, entwertet oder verbirgt
den Alarm nie: Einer, über den niemand informiert werden konnte, ist dringender
als einer, über den informiert wurde.

**Die Alarmphilosophie ist Ihre Entscheidung, nicht unsere.** Shelving-Grenzen,
Eskalationsstufen, Empfänger und Aufbewahrung sind Konfiguration, und jede
Vorgabe ist konservativ und als Standortentscheidung dokumentiert. Eine frisch
installierte Anlage ist still und sicher — sie meldet in der Oberfläche,
schreibt Historie und benachrichtigt niemanden, bis Sie ein Ziel konfigurieren.

Zeitprogramme lösen mit der Zeitzone des Standorts zu Zeitpunkten auf, damit die
zwei seltsamen Tage im Jahr vorhersagbar sind: Eine 02:30-Absenkung meldet an
einem Umstellungstag im Frühjahr, dass es diese Zeit nicht gibt, statt einfach
auszufallen; im Herbst läuft sie einmal — durch die Auflösung, nicht durch
Zufall. Die Vorschau sagt beides in Worten.

**Was diese Karte nicht tut:** Sie liefert keine Feiertagstabelle mit —
deutsche Feiertage sind Ländersache, und `binary_sensor.workday` trägt Land,
Bundesland und lokale Ergänzungen bereits — und sie baut keinen Kalender nach.
Feiertage, Ausnahmen, Ferien, Sondertage und Betriebszeiten binden an die
`schedule`-, `calendar`- und Workday-Fähigkeiten von Home Assistant, und eine
Bindung sagt, was sie nicht kann, bevor Sie es versuchen.

### Trends, Energie und Berichte

**Dieses Produkt liest den Recorder von Home Assistant; es ist kein Historian.**
Es hat keine eigene Zeitreihendatenbank, keine eigene Aufbewahrungsfrist und
keine eigene Verdichtung. Die frühere Oberfläche legte das Gegenteil nahe — sie
bot Zeiträume bis zu einem Jahr an und integrierte Energien im Browser —, sodass
eine Installation mit zehn Tagen Recorder-Historie einen „Monatsbericht" ohne
Monat bekam und das nirgends sagte.

Eine Regel bestimmt alle Oberflächen: **Die Anzeige zeigt nie eine Zahl, ohne zu
zeigen, wovon sie eine Zahl ist.** Wert, Einheit, Zeitraum und Abdeckung reisen
gemeinsam oder gar nicht.

**Eine Lücke ist ein Bruch in der Linie** — nicht gestrichelt, nicht heller,
kein Tooltip; auf einem monochromen Leitstand und in erzwungenen Farben ist das
alles dieselbe Linie. Maßgeblich ist die Lückenliste des Companion, nicht das
Fehlen eines Punktes; ein unlesbarer Zeitstempel bricht ebenfalls, denn zwei
Messwerte zu verbinden, deren Reihenfolge nicht feststeht, zeichnete eine
Stetigkeit, die niemand gemessen hat. **Die Abdeckung wird auch bei 100 %
genannt**, damit ihr Fehlen nie „wir haben nicht nachgesehen" bedeutet, und
jedes Diagramm hat eine über Tastatur erreichbare Tabelle, in der eine Lücke
eine markierte Zeile mit ihrem Intervall ist.

**Zeiträume sind Kalenderzeiträume, serverseitig in der Zeitzone des Standorts
aufgelöst.** Ein Frühjahrstag hat 23 Stunden, ein Herbsttag 25, und der Oktober
2027 hat 745. Die ausgelieferte `Math.floor(x / bucketMs)`-Eimerbildung — immer
exakt gleich lang, am UTC-Epoch ausgerichtet und außerstande, einen Monat
überhaupt auszudrücken — ist jetzt **aus dem Artefakt entfernt**, nicht nur
ungenutzt.

**Zwei Zählermodelle, nie ineinander umgerechnet.** Ein `counter` akkumuliert,
sein Verbrauch ist eine Differenz über die Zeitraumgrenze; eine `rate` ist ein
Momentanwert, ihre Energie ein Integral über den Zeitraum. Zählerrücksetzungen
sind Sache des Recorders. **Einheiten werden geprüft, nicht geraten**: Ein
unverträgliches Paar wird mit Begründung abgelehnt, denn eine falsche
Kostenzahl ist schlimmer als eine fehlende — und eine Summe nennt in einer
eigenen Zeile, was sie ausgelassen hat.

**Ein Bericht ist reproduzierbar.** Er hält aufgelösten Zeitraum, Zeitzone,
Entitäten, Vertragsart, Abdeckung und Lücken fest, und seine Kennungen leiten
sich aus dem Inhalt ab statt aus der Uhr. Zeitpläne werden beim Speichern
geprüft und laufen über denselben Runner wie die Anlagenzeitprogramme.

**Das Raster wird nie aus der Antwort abgeleitet.** Ein Fenster sagt, welcher
Ausschnitt gemeint ist; die Schrittweite sagt, worin er gemessen wird, und
keines folgt aus dem anderen — der Oktober 2027 hat 31 Tagesabschnitte und 745
Stunden. Da der Recorder einen leeren Zeitraum ganz weglässt, meldete ein aus
den zurückgekommenen Zeilen gebautes Raster einen Monat mit neun fehlenden
Tagen als vollständigen 22-Tage-Monat.

**Was es nicht tut:** CSV-Download und Druck/PDF im Browser sind entfernt — sie
schrieben den gerade gerenderten Wert, ohne Zeitraum und ohne Abdeckung. Der
Export liefert jetzt das Modell, und alle drei Darstellungen leiten daraus ab
statt auseinander.

> Für sichere Bedienungen, geräteübergreifende Projekte, Alarme, Zeitprogramme, Audit, Locks und Remote-Home-Assistant wird der **GLT Flow Card Companion** empfohlen. Die reine Dashboard-Card bleibt weiterhin ohne Backend nutzbar.

**[Design Showcase](https://xerolux.github.io/glt-flow-card/showcase.html)** · **[Platform 1.0](https://xerolux.github.io/glt-flow-card/platform.html)** · **[Online Designer](https://xerolux.github.io/glt-flow-card/editor/)**

<!-- GLT-V1:END -->


## Funktionen

- **Professionelles GLT-Schema** mit frei platzierbaren Anlagen, Datenpunkten und Leitungen.
- **Pan & Zoom** per Maus, Mausrad, Touch-Drag und Pinch-Zoom.
- **Beliebig viele Ansichten**: Anlagenschema, Anlagenbild, Grundriss, Detailansicht usw.
- **Verortung von Datenpunkten je Ansicht**: dieselbe HA-Entität kann im Schema und auf einem echten Anlagenfoto an unterschiedlichen Stellen liegen.
- **Animierte Medienströme** für Heizung, Kühlung, Warmwasser, Wärmequelle, RLT und elektrische Energie.
- **Replay-Modus mit Zeitbalken** auf Basis von Home Assistant Recorder/History.
- **Trenddiagramme mit Mehrfach-Auswahl**.
- **Kundenspezifische KPIs** aus beliebigen Home-Assistant-Entitäten bzw. Template-Sensoren.
- **Eigene Bilder** als komplette Anlagenansicht oder als einzelnes Anlagenobjekt.
- **Live- und Replay-Werte direkt an der richtigen Stelle**.
- **Hell-/Dunkelmodus**, responsive Darstellung und reduzierte Animationen bei entsprechender Systemeinstellung.
- **Vollständiger Drag-&-Drop-Anlageneditor** für Bauteile, Medienleitungen, Datenpunkte, KPIs und Bildansichten; YAML bleibt für Spezialfälle verfügbar.

## Installation

Erfordert Home Assistant 2024.8.0 oder neuer. Die Release-Prüfung installiert
die exakt bereitgestellte Dashboard-Karte und Companion-ZIP auf unveränderlich
gepinnten Minimum-/Current-HA-Lanes.

### Verifizierte Projekt- und Release-Grenze

Phase 1 prüft rohe Validierungsfehler vor der Normalisierung, sequenzielle
Dry-Run-Migration und Rollback, semantische Diff-Kategorien und
Abhängigkeitsabschluss, konfliktgeschütztes selektives Anwenden, begrenzte
`.gltproject`-Bundles, Companion-Lifecycle-Cleanup sowie identische
Source-/Build-/Stage-/Browser-/Home-Assistant-Release-Artefakte. Dafür gelten
ausführbare Node-, Python-, Browser- und unveränderlich gepinnte HA-Lane-Tests;
Quelltext-Token oder Screenshots allein sind kein Nachweis.

Das oben genannte öffentliche HACS-Custom-Repository ist die
**Dashboard**-Card. Der Companion wird als `glt-flow-card-companion.zip` im
Release dieses Repositories ausgeliefert. Seine HACS-**Integration**-Form ist
nur ein lokaler Integration-Category-Stage für die Release-Prüfung und kein
separat veröffentlichtes HACS-Integrations-Repository.

Standalone eignet sich weiter für lokale Visualisierung und browserlokales
Engineering. Gemeinsame Projekte, autoritative Migration/Apply/Rollback,
Locks, Audit, Zeitpläne, Remote-Aktionen und andere privilegierte gemeinsame
Änderungen benötigen den konfigurierten Companion und bleiben ohne diese
Autorität geschlossen. Die automatisierten Nachweise führen keinen physischen
Anlagen-Schreibzugriff aus. Die 100-/500-/2.000-Objekt-Fixtures belegen nur
begrenzte Korrektheit und sind keine Kapazitätszertifizierung; diese Messung
gehört zu Phase 10.

### Gemeinsame Autorität und Zusammenarbeit

Mit Phase 2 ist der Companion die einzige Autorität für gemeinsame Projekte. Der
Browser darf einen Berechtigungs-Snapshot nutzen, um zu entscheiden, was er
*anzeigt*; er entscheidet damit nie, was *erlaubt* ist. Jede gemeinsame Anfrage
wird serverseitig erneut autorisiert, an der WebSocket-Grenze, bevor ein Handler
läuft.

**Feste Rollen.** Eine Projektzuweisung ist genau eine von **Betrachter**,
**Bediener**, **Ingenieur** oder **Administrator**. Die Menge ist geschlossen und
liegt in der Zugriffsliste des Companions. Projekt-JSON, ein importiertes
`.gltproject`-Paket, Browser-Speicher, ein URL-Parameter oder ein Formularfeld
tragen niemals eine Rolle oder Berechtigung bei. Es gibt keine
Berechtigungs-Checkboxen pro Benutzer: Berechtigungen folgen aus der Rolle.

**Home-Assistant-Administratoren.** Der Administratorstatus in Home Assistant
verleiht keine Inhaltsautorität. Er verleiht genau eines: Projektmitgliedschaften
lesen und reparieren zu dürfen, damit sich eine Installation nicht selbst
aussperrt. Ein Administrator ohne Projektzuweisung sieht, wer welche Rolle hat,
und kann das ändern — sonst nichts: keine Projektinhalte, keine Steuerungen,
keine Nachweise.

**Keine Aufzählung.** Ein Projekt, das Sie nicht sehen dürfen, und ein Projekt,
das nicht existiert, antworten identisch. Listen, Suchen und Zähler lassen
Nichtberechtigtes weg, statt einen geschwärzten Platzhalter zu zeigen — denn ein
Platzhalter beantwortet immer noch die Frage „gibt es hier etwas?“.

**Leases und Revisionen.** Das Bearbeiten gemeinsamer Inhalte erfordert ein
exklusives Bearbeitungslease. Ein Lease ist flüchtig, an die Verbindung
gebunden, die es erhalten hat, rotiert seinen Träger bei jeder Verlängerung und
läuft auf einer monotonen Uhr ohne Nachfrist ab; nichts davon wird persistiert,
ein Neustart kann also keines wiederbeleben. Die TTL liegt zwischen 60 und 900
Sekunden, Standard 300. Ein anderweitig gehaltenes Lease wird anonym gemeldet:
wer gerade bearbeitet, ist eine Mitgliedschafts-, keine Lease-Frage.

Inhalts- und Zugriffsrevisionen sind getrennte Ströme. Eine
Mitgliedschaftsänderung entwertet kein laufendes Speichern, und ein Speichern
nummeriert keine Mitgliedschaft neu. Jede Änderung trägt die exakte Revision, auf
die sie sich bezieht, und der Server prüft die gesamte Autoritätskette innerhalb
seiner eigenen Commit-Sperre erneut.

**Konflikte.** Eine neuere Revision blockiert das Speichern und bewahrt Ihren
Entwurf im Speicher. Die Wiederherstellung ist: aktualisieren, eine
serverseitig berechnete Zusammenführungsvorschau, ein erneuter Versuch mit neuem
Lease oder ein ausdrückliches Verwerfen. Es gibt kein Überschreiben, kein
Erzwingen und nirgends ein „letzter Schreiber gewinnt“: Ungespeichertes wird nur
durch eine autoritative Bestätigung oder durch Ihre Entscheidung gelöscht.

**Konfigurierte Steuerungen.** Eine Steuerungsanfrage nennt eine Steuerungs-ID,
die Revision, auf die sie sich bezieht, und die begrenzte Eingabe, die das
Schema dieser Steuerung deklariert. Domain, Service, Ziel und alle unveränderlichen
Felder löst der Server aus dem verifizierten Projektstand auf — der Browser kann
sie nicht benennen, und eine Anfrage, die es versucht, wird abgelehnt, bevor
Home Assistant überhaupt gefragt wird. Ein Bediener kann eine konfigurierte
Steuerung ohne Bearbeitungslease ausführen: eine Anlage bedienen und ein Projekt
engineeren sind verschiedene Tätigkeiten. Es gibt genau einen Absetzversuch und
keine automatische Wiederholung.

**Nachweise.** Serverseitig erzeugte vertrauenswürdige Nachweise und im Browser
erzeugte Telemetrie liegen in getrennten Speichern mit eigenen Schemata,
Grenzen, Cursorn und Lesepfaden und werden nie in einer Zeitleiste oder einem
Export zusammengeführt. Nur eine bestätigte Rücklesung gilt als abgeschlossene
Steuerung: „angenommen“ heißt, der Server hat es protokolliert, „abgesetzt“
heißt, Home Assistant wurde gefragt, und eine Zeitüberschreitung oder ein
unbekanntes Ergebnis sagt genau das und verweist auf den aktuellen Zustand statt
auf eine Wiederholen-Schaltfläche. Die frühere clientseitig geschriebene
Audit-Route ist stillgelegt; ein Browser darf Telemetrie schreiben, und
Telemetrie ist dauerhaft als nicht vertrauenswürdig gekennzeichnet.

Nachweisseiten verwenden kurzlebige serverseitige Cursor. Die Seitengröße ist
fest, es wird keine Gesamtzahl offengelegt, und ein Cursor ist an die Verbindung
gebunden, die ihn erzeugt hat, und stirbt mit der Laufzeitgeneration.

**Nur lokale Projekte.** Ein nur lokales Projekt ist ein eigener, ausdrücklich
gekennzeichneter Modus. Ein gemeinsames Projekt wird niemals stillschweigend zu
einem lokalen, und der Verlust der Companion-Autorität macht das gemeinsame
Bearbeiten schreibgeschützt, statt auf einen privilegierten lokalen Pfad
zurückzufallen.

**Remote Sites.** Remote-Liste, Remote-Zustände und Remote-Steuerung sind
deklariert und antworten fail-closed mit `feature_unavailable`. Der
Remote-Transport ist Aufgabe von Phase 9 und in diesem Stand nicht verfügbar.

**Upgrade.** Das alte Lock-Fenster von 30–3600 Sekunden überlebt das Upgrade
nicht: ein gespeicherter Wert wird in das Lease-Fenster von 60–900 Sekunden
geklemmt statt zurückgesetzt, damit eine bewusste Wahl zur nächstgelegenen
zulässigen wird. Ein persistiertes Alt-Lock wird verworfen statt in ein Lease
verwandelt — eine Zeile in einer Datei hat keine Verbindung, an die sie gebunden
werden könnte, und niemanden, der sie hält. Alte Audit-Zeilen werden behalten und
als `legacy_untrusted` gekennzeichnet statt gelöscht, damit sie nie als Aussage
darüber gelesen werden können, wer was getan hat. Ein alter
`permissions`-Block auf dem aktiven Stand darf die Mitgliedschaft einmalig und
konservativ vorbelegen, ausschließlich in bereits implizierte feste Rollen und
nie als Administrator; ein importierter Entwurf darf das nie. Jeder Schritt ist
idempotent.

**Was die Nachweise abdecken — und was nicht.** Die Phase-2-Prüfungen laufen auf
denselben unveränderlich gepinnten Minimum- und Current-Home-Assistant-Lanes wie
Phase 1, gegen das exakte Stage-Artefakt. Sie führen keinen physischen
Anlagen-Schreibzugriff aus, kontaktieren keine Remote Site, verarbeiten keine
Zugangsdaten und sind weder eine Kapazitätsaussage noch eine Aussage über eine
öffentliche Companion-Verfügbarkeit.

### Semantisches Modell, Herkunft und Anlagenzustand

Mit Phase 3 erhält das Produkt ein validiertes Anlagenmodell und Schemaversion 3,
um es auszudrücken.

**Die Hierarchie.** Standort → Gebäude → Etage → System → Teilsystem → Anlage →
Datenpunkt, mit genau einem Elternteil je Knoten. Ein Kind darf auf der Ebene
seines Elternteils liegen — ein Teilsystem in einem Teilsystem ist normaler
Anlagenbau — aber nie darüber. Ein fehlendes Elternteil, ein Zyklus beliebiger
Länge, eine Ebenenumkehr, eine doppelte ID oder ein Baum jenseits seiner Tiefen-
oder Breitengrenze ist ein Vertragsfehler mit stabilem Pfad, in beiden Laufzeiten.
Der semantische Pfad wird aus den Eltern abgeleitet und nie gespeichert: ein
gespeicherter Pfad ist eine zweite Wahrheitsquelle, die anfangs mit ihren Eltern
übereinstimmt und irgendwann kommentarlos aufhört.

**Geschlossene Vokabulare.** Einheiten, Medien, Richtungen und semantische Tags
sind deklarierte Mengen; ein unbekanntes Element ist ein Validierungsfehler und
keine durchgereichte Zeichenkette. Einheiten tragen ihre Dimension, damit kW und
kWh für einen naiven Präfixvergleich nicht austauschbar sind — Leistung an einen
Energie-Slot gebunden ergibt eine Zahl, die um eine Zeiteinheit falsch ist und
völlig plausibel aussieht.

**Upgrade.** Projekte in Schema 2 migrieren nach 3 über dieselbe sequenzielle,
belegte Mechanik mit vorangehendem Probelauf wie bei früheren Versionen. Es geht
nichts verloren.

**Herkunft.** Integration, Config-Entry, Gerät, Bereich und Kommunikationszustand
eines Datenpunkts werden aus den Registries und der State Machine von Home
Assistant gelesen. Nichts wird aus einer Entity-ID oder einem Anzeigenamen
abgeleitet: eine Anlage, in der `sensor.knx_return_temperature` über Modbus
kommt, ist nicht ungewöhnlich. Die Karte implementiert keinen Feldbustreiber und
öffnet keine eigene Verbindung. Sie meldet die besitzende Integration; von den
für dieses Produkt relevanten Protokollen sind Modbus und KNX
Core-Integrationen, während BACnet und OPC UA über die jeweils installierte
Integration kommen — eine unbekannte Domain wird deshalb als sie selbst gemeldet
statt als Unterstützung ausgegeben, die die Karte nicht belegen kann. Der
Zustand löst in fester Ordnung auf — deaktiviert, dann nicht verfügbar, dann
veraltet — denn eine bewusst abgeschaltete Entity ist etwas anderes als eine,
die nur gerade still ist.

Die Herkunftsabfrage ist ein projektbezogener Lesezugriff hinter der
Phase-2-Grenze und beschreibt ausschließlich Entities, die das Projekt selbst
referenziert; sie kann also nie zur Registry-Suche werden.

**Profile.** Ein Profil trägt Identität, semantische Version, Slots, Steuerungen,
Zustandssignale, Alarme, Ports, Diagnosen, Wartungsdaten und Symbole. Zwei
Instanziierungen einer Version sind identisch. Ein Upgrade übernimmt jede noch
gültige Override und meldet die, die es nicht übernehmen kann, statt sie still zu
verwerfen. Eine Profilsteuerung nennt eine Steuerungs-ID, ihr begrenztes
Eingabeschema und ihre Gates — nie Domain, Service oder Ziel, denn das ist der
vom Aufrufer bestimmte Steuerpfad, den Phase 2 entfernt hat.

**Zuordnung.** Kandidaten werden aus Gerätezugehörigkeit, Slot-Erwartung des
Profils, Bereichsübereinstimmung, Integrationsübereinstimmung,
Einheitenverträglichkeit und — zuletzt und nie für sich allein ausreichend —
Namensähnlichkeit bewertet. Jeder Kandidat trägt die Gründe seiner Bewertung.
Zuordnung ist eine Zuweisung: eine Entity, die offensichtlich einen anderen Slot
beantwortet, ist nicht die Antwort dieses Slots. Eine Entity, deren Name eine
Rolle trägt, die der Slot nicht deklariert, ist gar kein Kandidat — ein Sollwert
ist nicht seine Messung. Ohne ausdrückliche Annahme wird nichts gebunden, und
eine manuelle Override wird als Entscheidung gespeichert, damit eine spätere
Neubewertung keinen Ingenieur überstimmt, der bereits hingesehen hat.

**Anlagenzustand.** Sechzehn Bedingungen lösen über eine feste Präzedenz zu genau
einem Zustand auf. Vertrauen schlägt Aktivität: ein Kommunikationsfehler, ein
ungültiger oder ein veralteter Wert wird nie als „in Betrieb“ gemeldet, wie
aktuell die Meldung auch war, denn die Karte weiß es nicht. `auto` und `remote`
qualifizieren den Zustand, statt ihn zu ersetzen, sodass ein Bediener „In Betrieb
· Fernbetrieb“ liest. Symbol, Farbe, Beschriftung und Detailansicht sind
Projektionen desselben aufgelösten Werts und können sich daher nicht
widersprechen, und jeder Zustand trägt Form und Wort zusätzlich zur Farbe.

### Laufzeitbetrieb und Drill-down

Phase 4 macht aus dem Modell etwas, in dem Betreiber arbeiten können.

**Das Objektpanel wird auf dem Server zusammengestellt.** Jedes profilierte
Objekt öffnet dasselbe Panel — Identität, Zustand, Werte, Betriebszähler,
Qualität, Alarme, Bedienung und Trend — ohne handgebautes Popup je Anlagentyp.
Die Bedienliste kommt bereits gefiltert an: eine Bedienung, die Sie nicht
ausführen dürfen, **fehlt**, sie ist nicht ausgegraut, denn ein deaktivierter
Schalter verrät weiterhin, dass es ihn gibt. Das Panel enthält weder Domain noch
Service noch Ziel-Entität, also hält der Browser nichts, was er selbst absenden
könnte.

**Betriebsstunden und Starts** stammen aus profil-deklarierten Datenpunkten und
erscheinen deshalb ohne jede Historienabfrage.

**Trends lesen den Recorder von Home Assistant** (Phase 7). Die Karte ist
**kein Historian**: keine eigene Zeitreihendatenbank, keine eigene
Aufbewahrungsfrist — was der Recorder nicht aufgezeichnet hat, existiert für sie
nicht. Jeder Wert trägt Einheit, Zeitraum und **Abdeckung**, sodass ein Monat,
in dem der Recorder an neun Tagen nichts hatte, genau das aussagt statt einer
kleineren, selbstbewussten Zahl.

**Vier getrennte Bedienergebnisse.** *Angenommen* heißt, der Server hat es
notiert. *Gesendet* heißt, Home Assistant wurde gefragt. Nur *Bestätigt* heißt,
eine Rückmeldung hat gezeigt, dass sich die Anlage tatsächlich bewegt hat — und
nur das wird als Erfolg dargestellt. *Keine Bestätigung*, *Wirkung unbekannt*
und *Nach Absendung fehlgeschlagen* verweisen auf den aktuellen Zustand und das
vertrauenswürdige Protokoll statt auf einen Wiederholen-Knopf: Nachbessern ist
ein neuer, separat autorisierter Befehl.

**Deep-Links und Brotkrumen.** Die Adresse in der URL ist der gesamte
Ansichtszustand — Knoten, Zeitfenster und ausgewählter Alarm. Jeder Link wird
beim Öffnen neu autorisiert, denn eine URL landet in einem Chat und wird von
jemand anderem geöffnet. Ein Link, dem Sie nicht folgen dürfen, und einer, der
nicht existiert, antworten gleich.

**Zählerstände verraten nichts.** Eine Aufsummierung umfasst nur Projekte, in
denen Sie Mitglied sind, Gesamtwerte eingeschlossen, und eine Null wird gar
nicht angezeigt — sonst wäre eine leere Ansicht, die Sie sehen dürfen, von einer
unterscheidbar, die Sie nicht sehen dürfen.

**Veraltete Daten sind dauerhaft sichtbar markiert.** Die Ansicht kennt die
Sequenz, die sie erwartet. Bei einer Lücke, einer Neuverbindung oder einem
Entzug meldet sie, dass sie nicht live ist, zeigt die zuletzt tatsächlich
beobachteten Werte mit ihrem Alter weiter und nimmt keine Eingaben mehr an. Sie
interpoliert nie und braucht zum Wiederherstellen kein Neuladen der Seite.

**Der alte Bedienpfad ist entfernt.** Die frühere browserseitige
Berechtigungsprüfung — die jedem die Bedienung erlaubte, sobald gar keine
Berechtigungsliste konfiguriert war — und die Tap-Aktion, die direkt einen
Home-Assistant-Service aufrief, sind stillgelegt und nachweislich wirkungslos.

### HACS

1. HACS → Drei-Punkte-Menü → **Benutzerdefinierte Repositories**.
2. `https://github.com/Xerolux/glt-flow-card` als **Dashboard** hinzufügen.
3. **GLT Flow Card** installieren und Home Assistant / Browser neu laden.

### Manuell

1. `dist/glt-flow-card.js` nach `config/www/glt-flow-card.js` kopieren.
2. `/local/glt-flow-card.js` als **JavaScript-Modul** bei den Dashboard-Ressourcen eintragen.

## Drag-&-Drop-Designer

Der visuelle Editor ist jetzt ein vollständiger Anlagen-Designer. Die GLT kann direkt im Home-Assistant-Karteneditor aufgebaut werden:

- Anlagenbauteile, Medienleitungen, Datenpunkte und KPIs aus der Palette auf die Zeichenfläche ziehen;
- Bauteile direkt verschieben und in der Größe ändern;
- Leitungswege über verschiebbare Stützpunkte aufbauen;
- Home-Assistant-Entitäten rechts im Eigenschaften-Inspector zuordnen;
- Anlagenbild-Ansichten hinzufügen und denselben Datenpunkt im Schema und Foto getrennt positionieren;
- Rasterfang, Zoom, Duplizieren, Löschen, Tastatur-Nudging sowie Undo/Redo;
- eigene Bilder/SVGs sowohl für komplette Ansichten als auch für einzelne Anlagenobjekte.

Der Designer schreibt dieselbe YAML-Konfiguration wie die manuelle Konfiguration. Visueller Editor und YAML können deshalb jederzeit kombiniert werden.


## Neo 2030, Clean und Classic SCADA

Die Karte enthält jetzt drei vollständige Optik-Presets. **Neo 2030** ist die neue dunkle Premium-Ansicht mit moderner Symbolik, dezenten Glow-Effekten und klarer technischer Typografie. **Clean** erhält die helle, reduzierte Darstellung. **Classic SCADA** bleibt bewusst für Anwender erhalten, die eine traditionelle GLT-/SCADA-Optik bevorzugen. Der Stil kann im Designer gewählt und optional direkt in der Karte umgeschaltet werden.

## Home-Assistant-Entity-Picker und YAML-Ausgabe

Im integrierten Designer werden Entitäten nicht mehr von Hand eingetippt: Hauptentitäten, Status, Messwerte, Fluss-/Aktivsignale und KPIs verwenden den nativen Home-Assistant-Entity-Picker mit passenden Domain-Filtern. Friendly Name, Entity-ID und die vorhandene Home-Assistant-Entity-Liste stehen dadurch direkt im Designer zur Verfügung.

Der Designer bietet außerdem **Live-Vorschau** sowie eine **Lovelace-YAML-Ansicht mit Kopierfunktion**. Das grafisch erstellte Schema kann sofort als `custom:glt-flow-card` in ein manuelles Lovelace-Dashboard übernommen werden.

## Erweiterte Symbolbibliothek

**456 Varianten** aus **76 Basissymbolen** in **6 Stilen**, über Heizung,
Hydraulik, RLT, Kälte, Energie, Sensorik, Elektro und Brandschutz.

Diese Zahl ist gemessen, nicht behauptet. `catalog-evidence.json` entsteht,
indem jede Variante tatsächlich gezeichnet und das Ergebnis gehasht wird, und
der Generator schreibt die Datei gar nicht erst, wenn ein Symbol nichts
zeichnet, zwei Basissymbole dieselbe Geometrie liefern oder zwei Stile denselben
Token-Satz tragen. Ein Test verlangt, dass die Zahl in dieser README und die
Zahl im Nachweis dieselbe ist.

Ein Kreuzprodukt aus zwei Achsen ergibt nur dann unterschiedliche Varianten,
wenn beide Achsen unterschiedlich sind. Diese Prüfung ist der Grund, warum drei
Basissymbole, die überhaupt nichts zeichneten — und neun weitere, die sich die
Zeichnung eines anderen Symbols teilten — jetzt behoben statt mitgezählt sind.

Eigene Bilder und SVGs bleiben optional.

## Typisierte Ports und begründete Ablehnungen

Ein Port trägt Medium, Richtung, Seite, Art (`process`, `signal`, `power`) und
Vielfachheit (`one`, `many`). Eine unmögliche Verbindung wird mit einem Grund
aus einer geschlossenen Menge abgelehnt — `kind_mismatch`, `medium_mismatch`,
`direction_conflict`, `multiplicity_exceeded`, `self_connection`,
`duplicate_connection` — in Worten, neben den beiden Ports.

Anders als eine Rechteverweigerung ist eine technische Ablehnung erklärend. Eine
Rechteverweigerung ist absichtlich stumm, weil der Aufrufer nicht erfahren soll,
was existiert; hier liegt die Zeichnung bereits vor dem Ingenieur, und das
Verschweigen des Grundes schützt nichts.

Eine Verbindung meint ein Paar aus Bauteil *und* Port, ein geteiltes Profil
macht aus zwei Pumpen also nicht denselben Endpunkt. Die Geometrie wird aus dem
aufgelösten Port abgeleitet: ein Bauteil zu verschieben bewegt den Endpunkt und
ändert nie, welcher Port gemeint ist. Ein Endpunkt, der sich nicht mehr auflösen
lässt, wird gemeldet und nie stillschweigend neu angehängt.

## Routing

Deterministisch: dieselbe Zeichnung wird in dieselben Bytes geroutet, ohne Uhr,
ohne Zufall, ohne Iteration über eine ungeordnete Sammlung. Ein Pixel bewegt ein
Segment, weil innenliegende Ecken auf das Zeichenraster einrasten, während die
Ports ihre exakten Positionen behalten.

Keine Route läuft durch Anlagentechnik. Findet sich keine, wird das Paar
ausdrücklich abgelehnt — `obstructed`, `detour_exceeded`, `scene_too_complex`,
`degenerate_endpoints` — und eine Ablehnung trägt keinen Pfad, sodass niemand sie
versehentlich zeichnet. Vorher gab ein blockiertes Paar den ersten Kandidaten
zurück: einen Pfad *durch* das Hindernis, still als Route ausgegeben.

Neu-Routen ist lokal aus Bauart statt aus Optimierung: eine Route wird gegen die
Hindernisse in ihrer Nähe gerechnet, transitiv gefunden, ein entferntes war also
nie eine Eingabe. Über vierzig Routen rechnet eine Verschiebung eine neu. Die
Schranken sind in Segmenten und Routen angegeben, nie in Millisekunden.

## Erweiterungen

Ein Erweiterungspaket fügt Symbole, Profile, Vorlagen, Deskriptoren und
Übersetzungen hinzu. Es fügt keinen Code hinzu: ein Beitrag ist **Daten**, die
von Erstanbieter-Code interpretiert werden, und es wird kein beigesteuertes
JavaScript geladen, ausgewertet oder ausgeführt — in keinem Realm.

Nicht auszuführen ist notwendig und nicht hinreichend, deshalb wird
beigesteuertes Markup mit einer Positivliste von Elementen und Attributen
geprüft statt mit einer Sperrliste. Eine Sperrliste ist das Versprechen, an
alles gedacht zu haben, und die Liste der Dinge, an die niemand gedacht hat, ist
genau die, auf die es ankommt.

**Was das ausschließt**, ausgesprochen statt stillschweigend: jeden Beitrag,
dessen Aussehen berechnet statt beschrieben wird — eine Füllstandsanzeige nach
der Kennlinie eines Herstellers, ein Widget, das Entitäten nach einer Regel
zusammenfasst, die die Karte nicht kennt, ein Renderer, der abhängig von Werten
anders zeichnet als die deklarativen Ausdrücke der Karte. Jede Berechnung muss
sich im Vokabular ausdrücken lassen, das die Karte definiert. Das Vokabular kann
wachsen; eine wirklich neue Art von Berechnung braucht ein Erstanbieter-Release,
kein Fremdpaket.

Die Installation ist lokal und ganz oder gar nicht: Manifest geprüft, jeder
Konflikt geprüft, jede Schranke durchgesetzt — und erst dann geschrieben, sodass
nach einer gescheiterten Installation nichts herauszufinden bleibt. Der Prüfer
existiert in JavaScript und in Python und erreicht nachweislich über einen
gemeinsamen Korpus dieselben Urteile, denn eine Regel, die es nur im Browser
gibt, ist eine Regel, die der Server nicht durchsetzt.

## Engineering Workspace 0.4

![GLT Flow Card Funktionsübersicht](docs/images/symbol-library-live.png)

Mit Version 0.4 wird aus der Karte ein umfangreicherer **GLT/BMS-Engineering-Workspace für Home Assistant**. Bestehende Lovelace-YAML kann importiert, grafisch weiterbearbeitet und wieder exportiert werden; unbekannte Konfigurationsschlüssel bleiben im Projektobjekt erhalten, statt absichtlich entfernt zu werden.

- YAML Round-Trip mit Datei-Import, Zwischenablage und Download.
- Projektbibliothek, Autosave und Versionshistorie; standardmäßig lokal im Browser, mit optionalem Companion-Backend direkt in Home Assistant.
- Eigene Bauteilvorlagen, gruppierte Unteranlagen und orthogonales Auto-Routing an Anlagenobjekten.
- Alarm-/Meldungsansicht mit optionalem Quittier-Service.
- Rollen Viewer / Operator / Designer und Audit-Log.
- Wartungsassets mit Betriebsstunden, Intervallen, Fälligkeit, Dokumenten und Ersatzteil-Metadaten.
- Multi-Site-Übersicht und Standortfilter.
- Trend+ mit mehreren Y-Achsen je Einheit, Min/Max/Mittelwert, Leistung-zu-Energie-Integration, 24-h-Vergleich und CSV-Export.
- CSV- sowie Druck/PDF-Berichte.
- GitHub Pages Dokumentation, gehosteter Online-Editor und Wiki-Synchronisierung.

**[Live-Dokumentation & Online-Editor](https://xerolux.github.io/glt-flow-card/)** · **[Wiki](https://github.com/Xerolux/glt-flow-card/wiki)**

### Neo 2030 Runtime

![Neo 2030 Runtime](docs/images/neo2030-dark-live.png)

### Drag-&-Drop-Designer in Home Assistant

![Home Assistant Designer](docs/images/designer-dark-live.png)

### Clean-Designer als Alternative

![Clean Designer](docs/images/designer-light-live.png)

## Schnellstart

```yaml
type: custom:glt-flow-card
title: Heizzentrale
canvas:
  width: 1600
  height: 900
  viewport_height: 620
views:
  - id: schematic
    name: Anlagenschema
    kind: schematic
  - id: plant
    name: Anlagenbild
    kind: image
    background: /local/glt/heizzentrale.jpg

equipment:
  - id: hp
    type: heat_pump
    name: Wärmepumpe
    x: 120
    y: 320
    width: 260
    entity: switch.waermepumpe
    state_entity: binary_sensor.waermepumpe_laeuft
    fields:
      - label: Vorlauf
        entity: sensor.waermepumpe_vorlauf
      - label: Rücklauf
        entity: sensor.waermepumpe_ruecklauf

paths:
  - id: vl
    medium: heating_supply
    flow: binary_sensor.waermepumpe_laeuft
    temperature: sensor.waermepumpe_vorlauf
    points:
      - [380, 370]
      - [760, 370]
      - [760, 220]

datapoints:
  - id: flow_temp
    label: Vorlauf
    kind: temperature
    entity: sensor.waermepumpe_vorlauf
    positions:
      schematic: { x: 620, y: 335 }
      plant: { x: 930, y: 240 }
```

## Ansichten und eigenes Anlagenbild

```yaml
views:
  - id: schematic
    name: Anlagenschema
    kind: schematic
  - id: photo
    name: Anlagenbild
    kind: image
    background: /local/glt/heizzentrale.jpg
    background_fit: cover
```

Bei `kind: image` bleiben Datenpunkte sichtbar; Leitungen und Anlagenobjekte sind zunächst ausgeblendet. Mit `show_paths: true` bzw. `show_equipment: true` können sie auch über dem Foto eingeblendet werden.

## Datenpunkte zwischen Schema und Bild verorten

```yaml
datapoints:
  - id: ruecklauf_b34
    label: Rücklauf B34
    kind: temperature
    entity:
      entity: sensor.ruecklauf_b34
      decimals: 1
    positions:
      schematic: { x: 960, y: 520 }
      photo: { x: 428, y: 356 }
```

Damit bleibt der Datenpunkt logisch identisch, erscheint aber in jeder Ansicht genau an der passenden Position.

## Eigene Anlagenbilder / Symbole

```yaml
equipment:
  - id: sonderanlage
    type: image
    name: Sonderanlage
    image: /local/glt/sonderanlage.svg
    x: 500
    y: 180
    width: 280
    fields:
      - label: Leistung
        entity: sensor.sonderanlage_leistung
    slots:
      - label: T1
        entity: sensor.sonderanlage_t1
        x: 60
        y: 120
```

## Replay

```yaml
replay:
  enabled: true
  hours: 168
  step_minutes: 15
  autoplay_ms: 900
```

Der Replay-Modus lädt die Home-Assistant-Historie, stellt den gewünschten Zeitpunkt über einen Zeitbalken ein und lässt Messwerte sowie Anlagenzustände an diesem Zeitpunkt wiedergeben.

## Trenddiagramme mit Mehrfachauswahl

```yaml
trend:
  enabled: true
  hours: 168
  max_series: 8
  height: 260
```

Im Trendbereich können mehrere konfigurierte Datenpunkte gleichzeitig gewählt werden. `trend: false` blendet einen Datenpunkt aus der Trend-Auswahl aus.

## Kundenspezifische KPIs

```yaml
kpis:
  - name: COP
    icon: mdi:gauge
    entity: sensor.idm_cop
    good_above: 4
    warn_below: 3
    critical_below: 2
  - name: Heizleistung
    icon: mdi:radiator
    entity: sensor.idm_heizleistung
  - name: Stromaufnahme
    icon: mdi:flash
    entity: sensor.idm_elektrische_leistung
```

Komplexe Kennzahlen werden am besten als Home-Assistant-Template-Sensor berechnet und anschließend als KPI dargestellt.

## iDM-Beispiel

[`examples/idm-alm6-15.yaml`](examples/idm-alm6-15.yaml) ist als praxisnahes Beispiel für eine iDM-Anlage angelegt – mit Heizkreis D, Hydraulik, Replay, KPIs und zweiter Ansicht für ein echtes Anlagenfoto.

## Roadmap

- Drag-&-Drop-Anlageneditor direkt im Home-Assistant-Karteneditor.
- Weitere GLT-/DIN-/ISO-Symbole.
- Alarm-/Ereignisliste mit Quittieransicht.
- Separate Trendachsen je Einheit und Statistikansichten.
- Raummanager / Grundrissansicht.
- Anlagenpark / Multi-Site-Übersicht.

## Lizenz

MIT
