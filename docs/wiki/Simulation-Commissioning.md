# Simulation & Inbetriebnahme

**Während einer Simulation kann diese Karte die Anlage nicht bedienen.** Das ist
serverseitig durchgesetzt, nicht im Browser, und es ist die wichtigste Aussage
dieser Seite.

Sie steht hier so deutlich, weil sie vorher nicht stimmte. Der Simulationsmodus
war ein Feld im Projektdokument, das **keine einzige Serverroute las**.
`hass.services.async_call` lief unverändert, und die Oberfläche zeigte dabei
„Simulationsmodus aktiv" an. Wer samstags eine Sequenz durchspielte, bediente die
Anlage — und war vom Produkt darüber getäuscht worden.

## Was blockiert wird und was nicht

Jeder Pfad, über den eine Wirkung dieses Produkt verlässt, fragt **dieselbe
Entscheidung**, unmittelbar bevor die Wirkung eintritt:

| Weg | Während der Simulation | Warum |
|---|---|---|
| Bedienbefehl | **abgelehnt** | Ein Probelauf darf keine Anlage bewegen. |
| Entfernter Bedienbefehl | **abgelehnt** | Dasselbe, eine Netzwerkstrecke weiter. |
| Zeitprogramm-Dienstaufruf | **abgelehnt** | Derselbe Schreibzugriff, nur mit einer Zeitschaltuhr davor. |
| Benachrichtigung | **markiert** | Ein Alarm während eines Probelaufs ist trotzdem ein Alarm. |
| Berichtsversand | **markiert** | Ein aus simulierten Werten erzeugter Bericht muss das auf sich tragen. |
| Audit-Eintrag | **erlaubt** | Was geschehen ist, muss gerade dann festgehalten werden. |

**Benachrichtigungen werden markiert, nicht unterdrückt** — und das ist eine
bewusste Entscheidung gegen die naheliegende Lesart. „Während der Simulation
alles blockieren" würde Alarme verstummen lassen und einen Probelauf in ein
Zeitfenster verwandeln, in dem niemand von einer echten Störung erfährt. Das wäre
ein Sicherheitsfehler in der anderen Richtung, und ein schlimmerer: Wer nichts
hört, nimmt an, dass nichts war.

Die Meldung geht also raus und sagt auf sich selbst, dass die Anlage simuliert
wurde.

## Es scheitert zur sicheren Seite

Lässt sich der Simulationszustand **nicht feststellen**, wird jeder
anlagenwirksame Aufruf abgelehnt. Ein „weiß nicht", das zu „dann mach mal" wird,
ist schlimmer als gar keine Funktion — denn die Funktion ist ja der Grund, aus
dem der Ingenieur sich sicher fühlte.

Zwei verschiedene Ablehnungen, weil sie verschiedene Antworten brauchen:

- `simulation_active` — *Sie führen einen Probelauf durch.*
- `simulation_state_unavailable` — *Der Companion kann es nicht sagen und schützt
  Sie deshalb.*

Nur bei der zweiten hat Warten einen Sinn.

## Der Zustand gehört dem Companion

Nicht dem Projektdokument. Das ist Bedienereingabe, und Bedienereingabe darf
nicht entscheiden, ob ein Schreibzugriff die Anlage erreicht — dieselbe Regel,
die Phase 6 für die Benachrichtigungs-Allowlist aufgestellt hat, hier mit
Anlagenschreibzugriffen dahinter statt einer Nachricht.

Eine Sitzung nennt, **wer** sie gestartet hat und **wann sie endet**, und sie
endet von selbst. Eine Probefahrt ohne Ende macht die Anlage unbedienbar, und
dann baut jemand die Sperre um — was schlechter ist als keine Sperre.

Eine zu lange angeforderte Laufzeit wird **abgelehnt, nicht gekürzt**. Phase 6
hat eine 90-Tage-Anforderung stillschweigend auf 7 gekappt, und der Bediener ging
in dem Glauben weg, ein Alarm sei drei Monate ruhig. Kürzen ist eine Lüge, die
das Rechenwerk erzählt.

Ein unlesbares Ablaufdatum **verlängert nicht**. Eine Simulation, die nie endet,
ist der schlimmste Ausgang, den es hier gibt.

## Szenarien

Ein Szenario ist eine **reine Funktion aus Definition und Takt**. Home Assistant
bietet einer Integration keine virtuelle Uhr — und das erzwungene Design ist
besser als eines mit Uhr:

- **Wiederholbar durch Bauart.** Takt *n* liefert dasselbe Ergebnis, auf jeder
  Maschine, zu jeder Zeit.
- **Ohne Wartezeit auswertbar.** Ein zehnstündiger Probelauf ist ein Test von
  Millisekunden.
- **Auswertbar, bevor die Entitäten existieren.** Genau das verlangt die
  Anforderung: Ein Anlagenentwurf soll geprüft werden können, bevor irgendetwas
  angeschlossen ist.

Simulierte Werte werden **beim Speichern** gegen die Einheit und die Geräteklasse
des Slots geprüft. Ein Szenario, das einen Wert behauptet, den die Entität nie
melden könnte, probt etwas, das nicht passieren kann.

## Simuliert sieht man an

Ein simulierter Wert trägt **das Wort und eine Form**, nie nur eine Farbe. Auf
einem monochromen Leitstand, in erzwungenen Farben und für einen Screenreader ist
Farbe keine Information. Die Herkunft steht **neben dem Wert**, nicht nur im
Banner — ein Banner scrollt weg, ein Wert nicht.

Eine abgelaufene Sitzung sagt, dass sie abgelaufen ist, statt zu verschwinden.
Ein verschwundenes Banner ist von einem nie dagewesenen nicht zu unterscheiden.

## Inbetriebnahme

**Diese Ansicht ändert nichts.** Das ist nicht behauptet, sondern ausgeführt
geprüft: Ein vollständiger Durchlauf erzeugt ein leeres Wirkungsprotokoll — und
derselbe Test verlangt, dass dabei Befunde entstanden sind, damit ein leeres
Protokoll nicht aus einem leeren Durchlauf stammt.

### Vier Antworten, nicht eine

Registry-Eintrag und Zustandsmaschine sind **zwei unabhängige Fragen**:

| Registry | Zustand | Diagnose | Bedeutung |
|---|---|---|---|
| ja | ja | `present` | vorhanden |
| ja | nein | `registered_not_loaded` | deaktiviert, oder die Integration ist nicht hochgekommen |
| nein | ja | `unregistered` | Template- oder YAML-Entität: in Ordnung, aber ohne Herkunft |
| nein | nein | `missing` | tatsächlich der Tippfehler |

Vorher hießen alle vier `missing`. Das schickt einen Ingenieur auf Tippfehlersuche,
während in Wahrheit eine Integration nicht gestartet ist.

`unregistered` ist **kein Fehler**. Template-Entitäten sind eine normale Art,
Home Assistant zu betreiben; sie als Mangel zu melden erzieht dazu, die Ansicht zu
ignorieren.

### Sie erfindet keine Befunde

Referenzen werden **dort gelesen, wo das Schema sie deklariert** — Profil-Slots,
Bedienbefehle, Alarmbedingungen, Datenpunkte, Zähler. Vorher galt *jede
Zeichenkette mit einem Punkt* als Entitäts-ID: eine Versionsnummer, ein Dateiname
und eine als Text geschriebene Dezimalzahl wurden jeweils als „fehlende Entität"
gemeldet.

Wer einmal lernt, dass die Bereitschaftsansicht Dinge behauptet, die nicht
stimmen, liest sie nicht mehr — und dann ist gleichgültig, was sie sonst noch
meldet.

Jeder Befund nennt, **wo** die Referenz deklariert ist. „Der Slot `flow` der
Pumpe nennt diese Entität" ist handhabbar; „eine Entität fehlt" nicht.

### Keine Prozentzahl

Die alte Bereitschaftszahl war `100 - Befunde / Referenzen × 100`. Sie zählte
Befunde statt Entitäten, sodass zwei Befunde an einer Entität doppelt abzogen und
dreißig Befunde an zehn Entitäten einen negativen, auf 0 gekappten Wert ergaben —
ausgewiesen als Bereitschaftsgrad.

Ersetzt wurde sie durch **Anzahlen je Diagnose**, nicht durch eine besser
gerechnete Prozentzahl: Das wäre derselbe Fehler mit hübscherer Formel. Die
ehrliche Antwort auf „wie bereit ist das?" ist eine Liste dessen, was nicht
stimmt.

Vorschläge zu ungenutzten Entitäten sind **begrenzt**, und die Grenze steht in
der Antwort. Vorher kam jede Entität der Installation zurück — auf einer echten
Anlage Tausende Zeilen in einem Dialog.

## Was es nicht gibt

- **Keine Inbetriebnahme mit Schreibzugriff.** Die Anforderungen schließen das
  aus: Inbetriebnahme ist nur lesend. Ein Live-Schreibzugriff wäre eine eigene,
  ausdrücklich freigegebene und begrenzte Handlung.
- **Kein Virenscanner.** Die Inhaltsprüfung von Anhängen erkennt offensichtliche
  Falschbenennung, mehr nicht.
- **Keine Simulation entfernter Standorte** über die Sperre hinaus — Phase 9.
