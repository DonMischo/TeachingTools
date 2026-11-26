# TT-Styleguide: eine Oberfläche für alle Werkzeuge

TT soll sich wie ein Stück anfühlen. Deshalb baut keine Simulation, kein Spiel und keine Aktivität ihren Kopf, ihre Sitzungsliste oder ihr Dashboard selbst. Es gibt je einen Baustein, und den nehmen alle. Vorbild für Sitzungen und Dashboard ist der TaskCrawler.

Stand 2026-11-26. Wer einen neuen Baustein braucht, erweitert den bestehenden, statt eine Kopie anzulegen.

## 1. Grundlagen

**Farben nur als Tokens** (`src/styles/theme.css`). Sie wechseln mit dem Theme:

| Zweck | Klassen |
|---|---|
| Flächen | `bg-page`, `bg-surface`, `bg-surface-hover` |
| Schrift | `text-fg`, `text-muted` |
| Rahmen | `border-line`, `border-line-active` |
| Akzent | `accent`, `accent-fg` (Schrift auf Akzent) |
| richtig / falsch | `ok`, `bad` |

**Bausteine:**
- `.page` ist der Seitenrahmen.
- `.card` ist eine Karte.
- `.btn-primary` ist die Hauptaktion, `.btn-secondary` und `.btn-danger` stehen daneben.
- `.chip` dient als Umschalter oder Filter, `.chip-on` markiert den gewählten.
- `.input` und `.label` sind für Formulare.

**Seitenbreite:** Jede Seite nutzt `max-w-seite` (1440 px). Ausnahmen sind `/play/*` und schmale Formulare.

**Keine festen Farben** wie `text-yellow-400`, außer für Status-Pillen (Abschnitt 4).

## 2. Kopf einer Simulation, eines Spiels oder einer Aktivität: `SimKopf`

`components/SimKopf.tsx`

```tsx
<SimKopf titel="🌋 Vulkane" action={action}>
  Schildvulkan oder Schichtvulkan? …
</SimKopf>
```

- Der Titel steht als `h1` links.
- Am **Ende derselben Zeile** stehen die Knöpfe (`action`): zuerst die Schalter der Sim (Hilfsmodus, Punkte, Quellen …), zuletzt immer die `ToolSessionBar`.
- Die Beschreibung steht als `children` darunter. Sie ist höchstens zwei Sätze lang.
- Die Sim bekommt die `ToolSessionBar` als Prop `action` von ihrer Seite (`app/simulationen/<slug>/page.tsx`) und gibt sie an `SimKopf` weiter.
- Darunter folgt die Reiterleiste: `inline-flex rounded-xl border border-line p-1 bg-surface`. Der aktive Reiter ist `bg-accent text-accent-fg`.

## 3. Sitzungsknöpfe: `ToolSessionBar`

`components/ToolSessionBar.tsx`

Die Leiste hat zwei Knöpfe:
- »📱 Zum Mitmachen« öffnet Code, QR, Gastzugang und die Liste der Sitzungen.
- ☰ öffnet das Sitzungsmenü mit Dashboard, Auswertung, Sitzung wechseln, Neue Runde und den Anzeige-Optionen des Werkzeugs.

Dashboard und Auswertung öffnen sich als **Schublade von rechts** (`components/sitzung/Schublade.tsx`). Die Sim bleibt daneben bedienbar, und »Vollbild« macht daraus die Beamer-Ansicht.

Props, je nach Werkzeug:

| Prop | Wofür |
|---|---|
| `ansicht` | Spalten, Aufgaben und Wertung (`lib/<werkzeug>/sitzung.ts`) |
| `wahl` | Sitzung je Klasse, aus `useWerkzeugSitzung` |
| `quelle` | Adapter für Werkzeuge mit eigenen Tabellen |
| `menue` | Anzeige-Optionen im ☰ |
| `anonym` | ohne Dashboard und ohne Auswertung |

Kein Werkzeug baut einen eigenen QR-Knopf oder einen eigenen Dialog »Code holen«.

## 4. Sitzungen wählen und verwalten: `SitzungListe`

`components/sitzung/SitzungListe.tsx`

Die Liste ist eine Karte mit zwei Teilen.

1. **»▶ Neue Sitzung«**: »Für [Klasse/Kurs ▾] [Starten]«, optional mit »Ohne Klasse«, einem Hinweis je Wahl und Extra-Einstellungen (Caputh: Team-Modus).
2. **Je Sitzung eine Zeile:** Status-Pille · Code (mono) · Klassen-Pille · kurze Fakten, rechts die Aktionen.

**Status-Pillen** (`ton`):

| Ton | Farbe | Wofür |
|---|---|---|
| `live` | grün | offen, läuft |
| `wartet` | blau | wartet auf den Start |
| `aus` | grau | beendet, geschlossen |

Die Beschriftung ist klein geschrieben: »offen«, »läuft«, »wartet«, »beendet«, »geschlossen«.

**Aktionen** sind Textlinks (`SitzungAktion`), keine Knöpfe. Sie stehen immer in dieser Reihenfolge:
1. `haupt` (Akzent): **Dashboard**, Wählen, Ansehen
2. `normal`: Auswertung, CSV, Schließen / Wieder öffnen, Zurücksetzen
3. `gefahr` (rot): Beenden, **Löschen**. Vor dem Löschen kommt immer ein `confirm`.

**Wörter:** Es heißt »Sitzung«, nicht »Session«. Bingo sagt »Runde«.

Nicht wiederverwenden: `SessionGrid` (entfernt) und eigene `<ul>`-Listen.

## 5. Kopf einer Host-Seite: `SitzungKopf`

`components/sitzung/SitzungKopf.tsx`, für Live-Seiten unter `…/host/[code]`.

Links steht Folgendes:
- Zurück, darunter der Titel;
- »Code: XXX · 🟢 live / 🔴 getrennt · Fakten«;
- darunter die Knöpfe der Seite in der Klasse `KOPF_KNOPF`: ⬇ CSV, 📊 Auswertung, PDF.

Rechts stehen QR, Beitrittspfad, Gastzugang und »selbst spielen«.

```tsx
<SitzungKopf titel="🎰 Bingo" code={code} pfad={`/play/bingo/${code}`} gast="bingo"
  live={connected} zurueck={{ href: "/aktivitaeten/bingo", label: "Bingo" }} info={[…]}>
  <AuswertungKnopf … />
</SitzungKopf>
```

Ausnahme ist der Caputh-Host. Er ist eine Beamer-Vollbildansicht mit eigenem Aufbau.

## 6. Wer macht mit: `SitzungDashboard`

`components/sitzung/SitzungDashboard.tsx`

Es gibt vier Ansichten. Welche gewählt ist, merkt sich der Browser.

| Ansicht | Inhalt |
|---|---|
| **Tabelle** (Standard) | Je Person eine Zeile wie im TaskCrawler: Name und Klasse, Fortschrittsbalken mit %, Pille fertig/läuft, Kennzahlen als »Icon Wert«, »gerade«, »vor x Min.«. Optional aufklappbar per `detail` und `detailLabel`, z. B. das Log im TaskCrawler oder »Stufe« in der Challenge. |
| Kacheln | für den Beamer |
| Matrix | Personen × Aufgaben; nur mit `aufgaben` + `geschafft` |
| Rangliste | nur mit `rang` |

Spalten beschreibt das Werkzeug einmal in seiner `SitzungAnsicht` (`lib/sitzung/typen.ts`). Dieselbe Beschreibung speist Dashboard, Auswertung und den Download als CSV, PDF oder DOCX.

**Werkzeuge mit eigenen Tabellen** (TaskCrawler, Challenge, Kartenquiz, Bingo, Caputh, Lückentext) liefern ihre Zeilen über einen `SitzungQuelle`-Adapter. Eine eigene Teilnehmertabelle bauen sie nicht. Werkzeuge mit WebSocket laden die Quelle bei jeder Meldung neu (`invalidateQueries`).

Auswertung jederzeit: Auf Host-Seiten öffnet sie `AuswertungKnopf`, in Sims das ☰-Menü.

## 7. Bestenlisten

`components/Bestenliste.tsx` mit den Filtern Sitzung, Klasse und Alle. Die Regeln stehen in `api/bestenliste_regeln.py`. Zeilen der Lehrkraft zählen nie.

## 8. Neues Werkzeug: Checkliste

1. **Seite:** `<MeinWerkzeug action={<ToolSessionBar tool="slug" title="…" ansicht={…} />} />`.
2. **Komponente:** Sie beginnt mit `<SimKopf titel action={action}>Beschreibung</SimKopf>`, darunter folgt die Reiterleiste.
3. **Stand der Lernenden:** `useMeinStand` schreibt ihn, `lib/<slug>/sitzung.ts` liefert die `SitzungAnsicht`.
4. **Host-Seite, falls es eine gibt:** `SitzungKopf` + `SitzungDashboard`. Die Startseite bekommt eine `SitzungListe`.
5. **Hilfe, README und features.yml** im selben Zug nachziehen.
