# Multi-Site

Ein zentrales GLT kann mehrere Home-Assistant-Standorte überwachen und
autorisierte Bedienbefehle an sie senden.

**Der Wert einer solchen Ansicht ist, dass jemand aufhört, fünf Bildschirme zu
beobachten.** In dem Moment, in dem er das tut, ist ein unbemerkt fehlender
Standort eine Anlage, die niemand beobachtet. Deshalb ist die wichtigste Regel
dieser Seite nicht, was die Ansicht kann, sondern was sie sagt, wenn sie etwas
nicht kann.

## Eine unvollständige Antwort sagt, dass sie unvollständig ist

Eine Auswertung nennt, **welche Standorte geantwortet haben, welche nicht, und
warum**. Jede Summe trägt ihre eigene Vollständigkeit, und eine Summe ohne diese
Angabe wird nicht angezeigt, sondern abgelehnt.

Die Versuchung ist, ein Teilergebnis als Fehler zu behandeln — Fehler sind
einfacher. Das ist in **beide** Richtungen falsch:

- Die ganze Auswertung scheitern zu lassen, weil ein Standort ausgefallen ist,
  macht vier gesunde Anlagen unsichtbar. Das ist schlimmer als der fehlende.
- Die vier zurückzugeben und es „das Portfolio" zu nennen, ist genau der Fehler.

Ein stiller Standort trägt **nichts** zur Summe bei — er trägt nicht null bei.
Genau so kommt eine Zahl kleiner und selbstbewusst heraus.

## „Nicht erreichbar" ist kein Entitätszustand

Vorher schrieb ein fehlgeschlagener Lesevorgang:

```python
result[entity_id] = {"state": "unavailable", "error": resp.status}
```

`unavailable` ist ein **echter** Home-Assistant-Zustand. Eine Entität, die am
entfernten Standort tatsächlich nicht verfügbar ist, und eine, die wir nicht
fragen konnten, ergaben dasselbe Wort.

Unerreichbarkeit gehört zum **Standort**. Eine Entität, die wir nicht fragen
konnten, hat schlicht keinen Messwert — ihr einen zu erfinden ist der Fehler.

### Vier Standortzustände

| Zustand | Bedeutung |
|---|---|
| `healthy` | hat geantwortet, innerhalb des Zeitbudgets |
| `slow` | hat geantwortet, über dem Zeitbudget |
| `unreachable` | wurde gefragt und hat nicht geantwortet |
| `circuit_open` | wurde **nicht gefragt**, weil er wiederholt ausgefallen ist |

Die letzten beiden sind das Paar, auf das es ankommt. Ein ausgesetzter Standort
ist seit einer Weile kaputt; ein nicht erreichbarer ist es gerade eben geworden.
Beide gleich darzustellen verbirgt, wie lange das Problem schon besteht — und
das ist der Unterschied zwischen „Netzwerk prüfen" und „die Anlage steht seit
Dienstag".

`slow` ist eine **Antwort**. Sie als Ausfall zu behandeln würde echte Daten
wegwerfen.

## Ein Lesevorgang pro Standort, nicht pro Entität

Vorher wurde je Entität einzeln gefragt, mit 15 Sekunden Zeitlimit pro Anfrage:
Zweihundert Entitäten gegen einen nicht antwortenden Standort sind **fünfzig
Minuten** innerhalb eines Websocket-Handlers. Das ist nicht nur langsam, sondern
ein Verfügbarkeitsfehler — und die naheliegenden Abhilfen (kürzeres Zeitlimit,
weniger Entitäten) machen die Antwort *unvollständiger* statt schneller.

`GET /api/states` liefert alle Zustände in einer Anfrage. Gefiltert wird beim
Companion, denn über eine langsame Strecke *sind* die Roundtrips die Kosten.

Drei Grenzen, und sie beantworten drei verschiedene Fragen:

| Grenze | Frage |
|---|---|
| Nebenläufigkeit | wie viele Standorte gleichzeitig gefragt werden |
| Zeitlimit je Standort | wie lange ein Standort brauchen darf |
| **Gesamtfrist** | wie lange die *Anfrage* dauern darf |

Die dritte fehlt meistens und ist die entscheidende: Begrenzte Nebenläufigkeit
allein lässt immer noch *n* Standorte mal Zeitlimit auflaufen. Die Frist gehört
der Anfrage und wird nicht unter den Standorten aufgeteilt — wer auf einen
Bildschirm wartet, hat ein Zeitbudget, das nicht davon abhängt, wie viele
Standorte ein Kollege eingerichtet hat.

Eine gekürzte Entitätsliste **sagt, dass sie gekürzt wurde**.

## Wohin der Companion sich verbinden darf

Vorher wurde **jede** URL akzeptiert: keine Schema-Prüfung, keine Hostprüfung,
keine Freigabeliste — und der Companion stellte dann eine **authentifizierte**
Anfrage dorthin und gab die Antwort an den Browser zurück. Das ist ein
Server-Side-Request-Forgery-Werkzeug mit angehängter Zugangsberechtigung,
erreichbar über ein Konfigurationsfeld.

Die Prüfung hat **zwei Hälften**, und keine trägt allein:

1. **Eine serverseitige Freigabeliste.** Ein Ziel ist Standortkonfiguration,
   niemals Projektdaten — dieselbe Regel wie bei den Benachrichtigungszielen und
   der Simulationssperre, und das dritte Auftreten macht sie zum
   Sicherheitsmodell des Produkts statt zu einer Vorsichtsmaßnahme.
2. **Eine Prüfung der aufgelösten Adresse beim Verbindungsaufbau.** Ein
   freigegebener Name kann bei der Prüfung öffentlich auflösen und beim Verbinden
   auf `127.0.0.1` — das ist DNS-Rebinding, und es hebelt eine Liste aus, die nur
   den Namen ansieht.

Abgelehnt werden Loopback, Link-Local, private und Unique-Local-Bereiche.
**169.254.169.254** wird namentlich geprüft: Das ist der Metadaten-Endpunkt der
Cloud, und ein SSRF, der ihn erreicht, liefert Zugangsdaten für das ganze Konto.

Eine abgeschaltete Zertifikatsprüfung muss **ausdrücklich erklärt** werden und
steht danach an jeder Zahl, die dieser Standort liefert.

## Zugangsdaten verlassen den Companion nicht

Kein Token erscheint in einer Antwort, einer Protokollzeile, einem Export oder
einer Fehlermeldung. Das wird **gesucht**, nicht behauptet: Ein Sentinel-Token
wird durch jeden Pfad geschickt, auch durch jeden Fehlerzweig, und in allen
Ausgaben danach gesucht.

Die feinere Hälfte betrifft **Fehlertexte**. Verbindungsfehler tragen den Host
und den Port, den sie nicht erreichen konnten — `str(err)` zurückzugeben ließ
einen Aufrufer also interne Namen aufzählen, indem er Fehler provozierte. Fehler
sind deshalb eine geschlossene Menge von Begründungen; die Ausnahme wird
serverseitig protokolliert.

## Fern ist kein zweites Produkt

Jede Regel des lokalen Pfades gilt eine Netzwerkstrecke weiter unverändert:
dieselben Fähigkeiten, dieselbe Projektzuordnung, dieselben vier
Bedienergebnisse, dasselbe Audit, dieselbe Simulationssperre.

Ein Standort gehört zu Projekten, und diese Bindung ist Serverkonfiguration. Wer
auf Projekt A berechtigt ist, bedient nicht Standort B.

Die Standortliste wird **gefiltert und dann begrenzt**. Andersherum würde die
Grenze zum Zähl-Orakel für Zeilen, die der Aufrufer nicht sehen darf.

### Eine Zeitüberschreitung ist kein Fehlschlag

Der Unterschied zwischen „wir wissen nicht, ob es passiert ist" und „es ist nicht
passiert" ist über Netzwerk **wichtiger**, nicht unwichtiger: Eine
Zeitüberschreitung bei einem `POST` ist der klassische Fall, in dem der Dienst
sehr wohl gelaufen sein kann.

Sie wird deshalb als `effect_unknown` gemeldet, und **neben einer unbekannten
Wirkung wird kein Wiederholen angeboten**. Nachbessern ist ein neuer, separat
autorisierter Befehl — sonst wird die Anlage zweimal bedient.

## Was es nicht gibt

- **Kein Fern-Engineering.** Zustände lesen, Historie lesen, autorisierte
  Bedienbefehle senden. Das Projekt eines entfernten Standorts zu bearbeiten
  gehört nicht dazu.
- **Keine standortübergreifende Alarmkorrelation.** Phase 6 besitzt die Alarme;
  diese Phase trägt die Standortidentität hinein, statt ein zweites Modell zu
  bauen.
- **Keine gemessenen Kapazitätszahlen.** Phase 10 besitzt die Budgets. Diese
  Phase macht die *Form* der Kosten begrenzbar und nennt ihre Grenzen; die
  gemessenen Zahlen kommen später.
- **Keine Neugestaltung der Zugangsdatenhaltung.** Token bleiben in der
  Companion-Konfiguration.
