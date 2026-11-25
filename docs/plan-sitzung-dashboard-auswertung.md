# Plan: Sitzung, Dashboard und Auswertung vereinheitlichen

Stand 2026-11-25, Entwurf zur Abstimmung.

## Ausgangslage

**Sitzungen**
- `ToolSession` ist schon die gemeinsame Sitzung aller Simulationen (≈62 Slugs in `SESSION_TOOLS`), und `ToolSessionBar` steckt in 63 Seiten.
- Die Klassenwahl gibt es dreimal:
  - `SitzungWahl.tsx`, nur von Algo genutzt;
  - eine wörtliche Kopie in `MarkierUebersicht.tsx:31-115`;
  - eine Variante in `ChallengeLehrkraft.tsx:105-140`.
- »Code holen« wiederholen rund 12 Stellen mit einem eigenen `api.toolSessions.create(slug)`, obwohl die Bar das schon tut.
- Je Sim gibt es eine eigene Stand-Tabelle mit demselben Muster (`session_id` + `student_id|teacher_id|guest_id` + JSON):
  - `MarkierFortschritt`, `MausFortschritt`, `AlgoFortschritt`
  - `KiKompassStand`, `MainCharacterStand`, `LebenStand`, Pixel
  - `ChallengeStand`, `KartenQuizStand`, Klikk, Medien
- Im Backend kommen etwa 11 Router mit eigenem `_sitzung(code)`, `_teilnehmer` und `_anzeigename` sowie dem Paar `PUT …/fortschritt` + `GET …/uebersicht` dazu.
- Aktivitäten mit eigenem Spielablauf haben eigene Sitzungstabellen: Caputh, Bingo, Lückentext und TaskCrawler.

**Dashboards** sind rund 12-mal eigens gebaut:
- Markieren, Maus, Algo, Leben, MainCharacter, KI-Kompass und Klikk;
- Challenge und Kartenquiz;
- TaskCrawler-Host, Lückentext-Host und Bingo-Host.

Abgefragt wird je nach Werkzeug per Polling (2, 5 oder 10 s) oder per WebSocket.

**Auswertung**
- Es gibt drei `/report?fmt=json|csv` (TaskCrawler, Caputh, Lückentext) und dazu CSV bei Challenge und Leben, jeweils mit von Hand gebautem CSV.
- Ein PDF der Ergebnisse gibt es nirgends.
- Zeitstrahl und Kartenübung haben gar keine Auswertung.
- Caputh zeigt seine Auswertung erst nach dem Ende.
- Lückentext verlinkt sein Review erst nach dem Ende, obwohl das Backend es schon früher erlaubt.

**Menü:** Ein brauchbares ☰ liegt in `components/curriculum/Menue.tsx` und wird bisher nur dort genutzt.

## Zielbild: drei Bausteine wie der QR-Beitritt

### 1. Sitzungskern

**Backend** `api/sitzung.py`
- Gemeinsame Helfer: `sitzung_oder_404(db, code, slug)`, `teilnehmer(spieler)` (Identitätstripel), `anzeigename(...)`, `csv_antwort(spalten, zeilen, dateiname)`.
- Eine neue, allgemeine Tabelle **`SitzungStand`**, eine Zeile je Teilnehmer und Sitzung:
  - `session_id`, `student_id|teacher_id|guest_id`, `name`, `klasse`, `gast`
  - `daten` (JSON, je Werkzeug), `aktuell`, `beigetreten_am`, `aktualisiert_am`, `fertig_am`
- Allgemeine Endpunkte:
  - `PUT /api/sitzungen/{code}/stand` (eigene Zeile)
  - `GET /uebersicht` (Lehrkraft)
  - `GET /auswertung?fmt=json|csv|pdf`
  - `DELETE /staende`
- Je Werkzeug ein kleiner Eintrag in einer Registry (`api/sitzung_werkzeuge.py`):
  - `pruefe(daten)`: Größe und Plausibilität;
  - `kennzahlen(daten)`: Spalten für Übersicht und CSV;
  - optional `aufgaben(daten)`: Statistik je Aufgabe.

**Frontend**
- `useSitzung(tool, { mitKlasse?, refId? })` und ein `SitzungProvider`. Sie ersetzen `useWerkzeugSitzung`, die Kopien in Markieren und Challenge und die verstreuten `toolSessions.create`. Kindkomponenten holen den Code dann per Context, statt ihn erneut anzufragen.
- `useMeinStand(daten, aktuell)` für Lernende: entprellt, 800 ms wie bei Markieren.

### 2. Dashboard (live, Vorlage TaskCrawler)
`<SitzungDashboard>` bekommt Spaltendefinitionen statt eigener Tabellen. Spaltentypen:
- `fortschritt` (Balken x/y), `haken` (Matrix ✅/·), `zeit`, `zahl`, `text`
- `gerade`, `zuletzt` und `log` (Ereignisverlauf wie bei TaskCrawler)

Ansichten, umschaltbar und je Lehrkraft gemerkt:

| Ansicht | Wofür |
|---|---|
| Tabelle | Standard, wie heute |
| Kacheln | eine Karte je Person, gut für den Beamer |
| Matrix | Personen × Aufgaben als Heatmap: wer hängt wo |
| Rangliste | nur wo das Werkzeug eine Wertung hat |

Die Datenquelle ist austauschbar: Polling, Standard 5 s, oder `useLiveSocket` für Werkzeuge, die schon WebSockets haben.

### 3. Auswertung (jederzeit, auch mitten in der Stunde)
`<SitzungAuswertung>` zeigt:
- Kennzahlen: Teilnehmende, fertig, Ø-Fortschritt, Ø-Zeit;
- die schwersten Aufgaben;
- eine Tabelle je Person.

Downloads:
- **CSV**: ein gemeinsamer Helfer, `;` und UTF-8-BOM für Excel;
- **PDF-Zusammenfassung**: jsPDF wie `ergebnisPdf.ts`.

Aktivitäten mit eigenen Tabellen (TaskCrawler, Caputh, Lückentext, Bingo, Challenge, Kartenquiz) behalten ihre Tabellen. Sie liefern über einen **Adapter** dieselbe Form `{kennzahlen, spalten, zeilen, aufgaben}`, und die Oberfläche ist für alle gleich.

### Zugang: ☰ Sitzungsmenü + Schublade
- `Menue` wandert nach `components/Menue.tsx`.
- Ein gemeinsames `<SitzungMenue>` im Kopf jeder Sim und jeder Host-Seite ersetzt den Knopf »📱 Zum Mitmachen«. Punkte:
  - Zum Mitmachen (QR)
  - Dashboard
  - Auswertung
  - Anzeige
  - Sitzung wechseln
  - Sitzung schließen
- Dashboard und Auswertung öffnen sich als **Schublade von rechts**. Die Sim bleibt daneben sichtbar und bedienbar, und ein Knopf »Vollbild« macht daraus die Beamer-Ansicht.
- Das ist der Vorschlag statt eines eigenen Reiters: Er funktioniert in jeder Sim gleich, ohne in deren Reiterleiste einzugreifen.
- **In situ** auf den Host-Seiten von TaskCrawler, Challenge, Bingo, Lückentext, Kartenübung und Zeitstrahl: dieselbe Schublade.
- **Anzeige-Optionen** je Werkzeug im Menü: In Caputh blendet »Fragen anzeigen« Fragetext und Antworten auf dem Beamer aus (Lernende lesen am Gerät). Bei Bingo ist »Antwort zeigen« denkbar.
- Die Einstellung liegt in den Sitzungs-Settings.

## Phasen (jede einzeln lauffähig und committet)

| # | Inhalt | Prüfung |
|---|---|---|
| 0 | Backend-Helfer `api/sitzung.py`, gemeinsamer CSV-Helfer, `Menue` nach `components/`; keine Verhaltensänderung | bestehende Tests grün |
| 1 | `useSitzung` + Provider; Markieren, Challenge und Algo darauf, verstreute `create`-Aufrufe entfernen | vitest + manuell: Klassenwahl, QR, Fortsetzen |
| 2 | Tabelle `SitzungStand` + allgemeine Endpunkte + `<SitzungDashboard>`; **Pilot Markieren** inkl. Datenübernahme aus `MarkierFortschritt` | pytest (Endpunkte, Gast/Schüler/Lehrkraft), Dashboard im Browser |
| 3 | `<SitzungAuswertung>` + CSV/PDF; Adapter TaskCrawler und Lückentext (Review mitten in der Stunde) | pytest Adapterform, Download prüfen |
| 4 | `<SitzungMenue>` + Schublade in allen Sim-Köpfen und Host-Seiten; Caputh »Fragen anzeigen« | Browser: Menü in 3 Sims + Caputh-Host |
| 5 | Übrige Stand-Tabellen nacheinander umziehen: Maus, Algo, Leben, KI-Kompass, MainCharacter, Klikk (je ein Commit mit Datenübernahme) | pytest je Werkzeug |
| 6 | Adapter Caputh, Bingo, Challenge, Kartenquiz; Zeitstrahl und Kartenübung melden erstmals Stand | pytest + Browser |
| 7 | Die 35 reinen Beitritts-Sims: Anwesenheit (beigetreten, gerade im Reiter X) automatisch über den Play-Rahmen, ohne Eingriff in jede Sim | Browser: 2 Stichproben |

**Nicht im Umfang:** Die Sitzungstabellen von Caputh, Bingo, Lückentext und TaskCrawler bleiben, wie sie sind. Ihr Spielablauf (Phasen, Punkte beim Schließen) ist zu verschieden, um ihn auf `ToolSession` zu ziehen.

## Entscheidungen (2026-11-25)
1. **Eine allgemeine Tabelle `SitzungStand`.** Die alten Stand-Tabellen ziehen nacheinander um, jeweils mit Datenübernahme.
2. **Zugang über ☰ und Schublade.**
3. **Downloads in drei Formaten:** CSV, PDF-Zusammenfassung und DOCX über `lib/docx.ts`.
4. **Die Bestenlisten werden in diesem Durchgang mit vereinheitlicht.** Dafür kommt eine Phase 8 dazu:
   - eine Tabelle `Bestenliste` mit `werkzeug`, `modus`, Identitätstripel, `session_id`, `wert` und `richtung` (min oder max) sowie `extra` (JSON);
   - eine allgemeine Komponente `<Bestenliste>` mit den Filtern Sitzung, Klasse und Alle sowie Löschen für Admins;
   - Markieren, Maus, Tippen und Challenge (💎) ziehen nacheinander mit Datenübernahme um.

| # | Inhalt | Prüfung |
|---|---|---|
| 8 | `Bestenliste` allgemein: Tabelle, Router, Komponente; Markieren → Maus → Tippen → Challenge | pytest je Werkzeug (Plausibilitätsgrenzen bleiben), Browser |

## Umsetzung: Abweichungen vom Entwurf (2026-11-25)
- **Keine zentrale Werkzeug-Registry im Frontend.** Jedes Werkzeug legt seine `SitzungAnsicht` neben sich ab, z. B. `lib/markieren/sitzung.ts`, sonst lüde das Dashboard die Daten aller Sims. Die Typen und Helfer stehen in `lib/sitzung/typen.ts`.
- **CSV, PDF und DOCX entstehen im Browser** aus derselben Berechnung: `lib/sitzung/auswertung.ts`. Der Server liefert nur die Zeilen. `lib/docx.ts` kann dafür jetzt Tabellen.
- **`ToolSessionBar` ist das Sitzungsmenü.** Neben »📱 Zum Mitmachen« steht ☰ mit Dashboard, Auswertung, Sitzung wechseln und Neue Runde. So haben alle 63 Seiten Dashboard und Auswertung, ohne dass jede einzeln angefasst wird. Neue optionale Props:
  - `ansicht`: Spalten, Aufgaben und Wertung;
  - `wahl`: Sitzung je Klasse;
  - `menue`: Anzeige-Optionen.
- **Klassen-Geltungsbereich für alle Werkzeuge.** `MIT_KLASSE` ist entfallen. Vorher bot Algo die Klassenwahl an, bekam aber stillschweigend die offene Sitzung.
- **Aktivitäten mit eigenen Tabellen** bekommen einen Adapter im Frontend, der ihren Bericht in Sitzungszeilen übersetzt (`lib/taskcrawler/sitzung.ts`, `lib/lueckentext/sitzung.ts`). Auf der Host-Seite öffnet `AuswertungKnopf` die Auswertung.
- **Caputh »Fragen zeigen«** ist eine Beamer-Einstellung im Browser (`hp_caputh_fragen_zeigen`) und liegt nicht in der Datenbank.
- **Alte Stand-Tabellen bleiben vorerst liegen** und dienen als Quelle der Übernahme (`STAND_UEBERNAHMEN` in `api/main.py`). Gelöscht werden sie, wenn alle umgezogen sind.

## Fortschritt
- [x] Phase 0: `api/sitzung.py`, gemeinsamer CSV-Helfer, `Menue` nach `components/`.
- [x] Phase 1: `useWerkzeugSitzung` mit `refId`/`vorwaehlen`; Markieren, Challenge und Algo nutzen es.
- [x] Phase 2: `SitzungStand`, `/api/sitzungen`, `SitzungDashboard` (Tabelle, Kacheln, Matrix, Rangliste); Pilot Markieren mit Datenübernahme.
- [x] Phase 3: `SitzungAuswertung` mit CSV, PDF und DOCX; Adapter für TaskCrawler und Lückentext.
- [x] Phase 4: ☰ und Schublade über `ToolSessionBar`; Caputh »Fragen zeigen«.
- [ ] Phase 5–8
