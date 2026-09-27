# TT - Teaching Tools

**TT - Teaching Tools** (früher »Hauspokal«) ist schulweites Punktesystem und Unterrichtsplattform in einem. Lehrkräfte vergeben Punkte an Klassen, die Klassen sammeln in ihren Häusern für den Hauspokal. Dazu kommen Aktivitäten, Simulationen, Unterrichtswerkzeuge, Klassenverwaltung, ein Schulkalender und eine Startseiten-Slideshow. Alles läuft auf dem eigenen Schulserver.

Eine maschinenlesbare Fassung der Feature-Liste steht in [features.yml](features.yml).

## Tech-Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS, TanStack Query, KaTeX, three.js |
| Backend | FastAPI (Python), SQLAlchemy, WebSockets |
| Datenbank | PostgreSQL 17 |
| Betrieb | Docker Compose (Postgres, API, Frontend); LibreOffice im API-Container für PDF-Exporte |

---

## Inhalt

- [Hauspokal und Punkte](#-hauspokal-und-punkte)
- [Mitmachen per Code (Playhub, QR, Gäste)](#-mitmachen-per-code)
- [Aktivitäten](#-aktivitäten)
- [Simulationen](#-simulationen)
- [Tools](#-tools)
- [Sport & Spiele](#-sport--spiele)
- [Klassenverwaltung](#-klassenverwaltung)
- [Kalender](#-kalender)
- [Fragmente](#-fragmente)
- [Startseiten-Slideshow](#-startseiten-slideshow)
- [Admin](#-admin)
- [Datenschutz und Sicherheit](#-datenschutz-und-sicherheit)
- [Setup & Start](#setup--start)
- [Rollen](#rollen)

---

## 🏆 Hauspokal und Punkte

**Startseite:** Ein Live-Diagramm zeigt alle Häuser mit animierten Balken (WebGL-Shader). Jedes Haus zählt die Punkte seiner Klassen zusammen, die Ansicht aktualisiert sich von selbst.

**Punkte vergeben** (Seitenleiste):
- Klasse wählen, Schnellauswahl (+5 bis +100) oder freie Punktzahl, optional mit Grund
- Punkte-Leitfaden mit Richtwerten von »Gutes Verhalten« (5) bis »Turnier-/Wettbewerbssieg« (500), per Klick übernehmbar
- Punkte auch an Kurse, Wahlpflichtgruppen und A/B-Gruppen vergeben
- Punkte-Log je Klasse; Admins können Einträge löschen
- Klassen-Spitznamen setzen

**Punkte aus Aktivitäten:** Caputh, Bingo und Exitgame vergeben Punkte nach Ergebnis. Läuft eine Sitzung für einen Kurs oder eine WPF-Gruppe, wird jede beteiligte Klasse einzeln nach ihrer eigenen Quote bewertet.

---

## 📱 Mitmachen per Code

- **Playhub (`/play`):** Schülerinnen und Schüler geben nur den Code von der Tafel ein. Der Playhub findet das passende Werkzeug und leitet weiter.
- **QR-Code:** Jede Sitzung zeigt einen QR zum Scannen mit dem eigenen Gerät.
- **Gastzugang:** Ist »Gäste erlauben« eingeschaltet, kommt man auch ohne Konto hinein. Der Gast-Token gilt nur für diese eine Sitzung und läuft ab (die Dauer stellt ein Admin ein). Gäste werden über eine eigene Gast-ID gezählt, nicht über den Namen.
- **Sitzungs-Geltungsbereich:** Sitzungen lassen sich für eine Klasse, eine A/B-Hälfte, einen Kurs oder eine WPF-Gruppe starten.

---

## 🎮 Aktivitäten

Alle Aktivitäten können Schüler nutzen. Hosten dürfen standardmäßig nur Lehrkräfte; Admins können das pro Werkzeug freigeben (siehe [Werkzeug-Freigaben](#-admin)).

### 🎲 Caputh (Quiz)
- Quiz-Bibliothek mit den Modi Klassisch, TÜ, Test, Aufgabe, Wettbewerb und Benutzerdefiniert, filterbar nach Typ und Jahrgang
- Live-Sitzung mit Host-Screen und Beitritt per Code, optional im Team-Modus
- Bilder in Fragen; Lückentexte und Zeitstrahlen lassen sich einbetten
- Gruppenauswertung nach der Runde
- Import als `.json` oder `.zip`, Vorlage zum Herunterladen

### 🎰 Bingo
- Runden mit Rastergröße und Caller/Antwort-Paaren anlegen und sofort hosten
- Jede Person bekommt eine eigene Karte; die Lehrkraft ruft auf, die Klasse markiert
- JSON-Import, Vorlage und ein fertiger Prompt für externe KI (keine KI in der App selbst)

### 🗝️ Exitgame
- Exit-Game im eigenen Tempo, die Lehrkraft sieht den Fortschritt live
- Aufgaben vergeben Codeschnipsel, die an der Tür zusammengesetzt werden
- Serverseitige Anpassung der Schwierigkeit (Fuzzy-DDA): Hinweise, Zeitlimits, leichtere Aufgaben je nach Verlauf
- Aufgaben aus den Aufgaben-Generatoren, eingebettete Lückentexte und Zeitstrahlen
- Import als `.json`/`.zip`, Vorlage mit Beispiel für jeden Baustein

### 🧩 Lückentext
- Lücken mit Wortbank, Freitext oder Multiple Choice
- Live-Runde mit Rangliste, Einzelübung oder Korrekturmodus
- PDF-Export (leer oder ausgefüllt); einbettbar in Caputh und Exitgame

### 📏 Zeitstrahl
- Zeitleisten mit parallelen Spuren und Zahlenstrahlen
- Anzeigen, Ereignisse einsortieren, Fehler finden
- JSON-Import, Vorlage und mitgelieferte Beispiele

### ⌨️ Tippen (10-Finger-Trainer)
- Bildschirmtastatur mit Fingerfarben, neun Lektionsstufen von der Grundstellung bis zu Zahlen und Satzzeichen
- Fehlersperre: ein falscher Anschlag zählt als Fehler, aber es geht erst mit der richtigen Taste weiter
- Modi: Lektionen, Wortregen, Tastenjagd (Reaktionszeit) und Wettschreiben (Klassenrennen mit eigenem Code, nur für Lehrkräfte)
- Werte: Anschläge pro Minute, Fehlerquote, schwächste Tasten
- Bestenliste mit den besten hundert je Modus
- Eigene Texte per JSON-Upload

### 🐭 Maus-Führerschein
- PC-Grundkurs für Kinder ab etwa zehn Jahren in drei Teilen: Maus; Tastatur, Dateien und Fenster; Suchen, Apps und Aussehen
- Nachgebautes Windows mit Explorer, Fenstern, Taskleiste, »Speichern unter« und Bildschirmfoto
- Jede Stufe mit Vorführen, Vorlesen und 1 bis 3 Sternen; Hilfsmodus für langsame Mausnutzer
- Prüfung je Teil: beim ersten Bestehen 5 Hauspunkte für die Klasse, Urkunde als Bild und PDF
- Klassenübersicht für die Lehrkraft und Bestenlisten (Gäste mit Namen)

### 🍎 Rechenregeln
- Punkt vor Strich am Obstkorb: »3 · 4« sind drei Körbe mit je vier Äpfeln, Klammern sind Kisten
- Vertauschungsgesetz am Rechenzug, Stufenzahlen und Kommaverschiebung an der Stellenwerttafel
- Schrittweise lösen, Aufgaben würfeln, eigene Terme, Punktestand

### 📚 Übung
- Selbstständiges Üben mit generierten Aufgaben (Mathematik Kl. 1–7 nach Thüringer Lehrplan)
- Die Schwierigkeit steigt nach drei richtigen und sinkt nach zwei falschen Lösungen
- Geprüft wird auf dem Server, der Fortschritt zählt je Thema

---

## 🔬 Simulationen

Modelle zum Ausprobieren. Alle sind für Schüler offen und haben einen eigenen Beitritts-Code mit QR.

| Simulation | Was sie kann |
|------------|--------------|
| ⚖️ **Gleichungswaage** | Äquivalenzumformungen an einer Waage in drei Modi: Zahlen (sieben Stufen, Klammern, Brüche, Teile von Hand auf nur eine Seite ziehen, Motive wie Streichhölzer/Schachteln oder Gummibärchen/Tüten, Minus als Feder), Variablen (Formeln wie F = m·a umstellen) und Chemie (Reaktionsgleichungen ausgleichen, Ionen, Kernteilchen, Oxidationszahlen, Oktett-Hinweis). Rechenweg wie im Heft, LaTeX-Eingabe. |
| 🧮 **Abakus** | Rechenrahmen zum Schieben, Modus »Alle gleich« oder »Stellenwert«. |
| 🖼️ **Bildformate** | PBM, PGM und PPM zum Anfassen: Zahlen tippen, Bild sehen, ins Bild klicken schreibt zurück. |
| 📐 **Vierecke** | Sechs Vierecke mit Formeln, Rechenweg und Eigenschaften, dazu Umfang (Zaun bauen) und Fläche (mit Einheitsquadraten auslegen). |
| ◈ **Binär-Rechner** | Acht Bits mit Stellenwerten, Rechenweg von 0 bis 255. |
| 📈 **Funktionen** | Term, Wertetabelle und Graph verbunden. Formelsatz, Rechenweg je Punkt, Normal- und Scheitelpunktform, π-Achsen, Zoom, Verschieben und Vorlagen zum Würfeln. |
| 🤖 **KI-Werkstatt** | Wie Sprach- und Bildmodelle arbeiten: Tokenisieren, Wortnetz mit top-k, eigenes Netz trainieren, Attention, Mensch gegen Maschine raten, Diffusion mit Rauschen und Punktwolke, ein Neuron lernen lassen, »Echt oder KI« mit Bildpaaren. Klassentafel und Hintergrundtexte in drei Lesestufen. |
| 🪐 **Sonnensystem** | 3D-Modell mit echten Bahnen und Daten (JPL Horizons), Satelliten und Lagrangepunkten. Flugmodus mit Autopilot, Overdrive und 31 Forschungsaufträgen, dazu Kodex als PDF, 34 Erfolge, Größen- und Entfernungsvergleich, Kepler-Gesetze, Magnetfeld mit Sonnensturm und eine Galerie mit rund 90 Bildern. |
| 🎸 **Rock your Life** | Lebenssimulation: fünf Jahre nach der 10. Klasse in Erfurt — bewerben (Einstellungstest, Gespräch), Ausbildung, Job oder Übergangsjahr (FSJ, FÖJ u. a. auf Sylt, BFD, EQ, FOS, Wehrdienst, weltwärts, Au-pair, Work & Travel) mit echter Lohnabrechnung 2026, später Fachkraft-Stellen und Minijob, bei den Eltern bleiben oder ausziehen (Wohnungsmarkt Erfurt, Kaution, Umzug), einrichten (neu oder Kleinanzeigen), Wocheneinkauf mit rund 200 Produkten, Nährwerten, Saisonpreisen und echten Bonpreisen, Kleidung/Friseur/Handy mit Verschleiß, Führerschein und Auto, Checkliste »Nächste Schritte«, Verträge und Versicherungen, Anträge beim Amt (BAB, Wohngeld nach § 19 WoGG, Anmeldung, ALG mit 3-Tage-Frist …) als Minispiel mit echten Links, Steuererklärung, rund 60 Zufallsereignisse samt Fallen und Mahnwesen, Ausgehen mit Promille; Monatsbilanz, was der Staat nahm, Recherche-Modus, JSON-Speicherstand und Klassenübersicht mit Protokoll (CSV). |
| 🌊 **Küstendynamik** | Flachküste (Sylt), Steilküste und Marsch mit Deich im Querschnitt — die Steilküste als unverzerrtes Zellmodell mit vier Kliffen (Kreide/Jasmund, Møns Klint, Mergel/Brodtener Ufer, Sand/Rotes Kliff), Abbruch nach Biegespannung, Rutschungen nach Standsicherheit mit Grundwasser, fallenden und verrottenden Bäumen: Wellen mit Brecher- und Rollerzone, Gezeiten, Sturmfluten, Sandriff und Strandaufbau, Dünen, Brandungshohlkehle und Kliffabbruch, Deichbruch — im Zeitraffer bis 1 Jahr/s, Wetter von Hand oder im Jahreslauf. Küstenschutz mit Kosten und Nebenwirkungen (Aufspülung, Strandhafer, Deckwerk, Klimadeich, Lahnungen, Zurückweichen), mitwandernde Beschriftung und Beschriften-Quiz. Dazu Draufsicht mit Küstenlängsstrom, Buhnen und Haken sowie Gezeiten mit Flutbergen, Pegelkurve und Watt. |
| 🚦 **GTA – Ganztagsaufmerksamkeit im Verkehr** (zu Fuß) | Zu Fuß durchs echte Viertel um die Schule bis in die Innenstadt (OpenStreetMap), die ganze Klasse in einer Live-Stadt: Start vor der Schule, Uhrzeit mit Berufsverkehr und Nacht (Warnweste), Ampeln mit Taster, Zebrastreifen, Autos, die echten Linien Bus 9/35 und Tram 1/5 mit Abfahrtstafeln, Türen (erst aussteigen lassen), Gesten und Polizei, Überblick mit Straßennamen und Minikarte, Vollbild, Handy-Stick, Geräusche, Schilder-Rallye, Gruppe als Wand, Müll sammeln für Karma, LTB der Pinguin als Begleiter mit Sicherheitstipps (auch auf Nachfrage, passend zum Ort), Zeitraffer bis ×10, Bus-Szene (Bus ohne Dach, Fahrgäste, Stadtbus und Gelenkbus »Schlenky«, Busse nach Fahrplan), Wegsuche per Klick, mehrspurige Straßen, Handy Sim (Karte, Suche, Route, Beamen), Aussehen, Polizei-Gespräche, Fahrrad mit Werkstatt, StVZO-Prüfung, Radregeln, Radwegarten und Vorfahrt an Kreuzungen, Passanten, 22 Erfolge und ein Fußgänger-Führerschein mit Hauspunkten. |

---

## 🔨 Tools

Das Lehrkraft-Werkzeugset. Standardmäßig nur für Lehrkräfte sichtbar.

### 📝 Schreibraum
- Die Klasse schreibt gemeinsam an einem Text, synchron per WebSocket
- Modi: nächste freie Zeile, Zeile hinzufügen, Wortstaffel
- Dauerhafte oder temporäre Räume mit Raum-Code

### 🧭 Umfrage
- Fragetypen: Skala (auch mit Smileys), Auswahl, Mehrfachauswahl, Zahl, Freitext, Aussagen-Blöcke
- Ablauf live oder zum Selbstausfüllen; mehrere Fragen pro Folie, Folgefragen mit Bedingung
- Diagrammart je Frage umschaltbar, JSON-Export, öffentliche Ergebnisseite per QR (ohne Freitext)
- KI-Auswertung der Freitexte über eine externe KI, das Ergebnis wird wieder hochgeladen
- Umfragen für Kolleginnen und Kollegen freigeben, JSON-Vorlage und Upload

### 🎫 Exit Ticket
- Anonymes Feedback am Stundenende: Frage, optional 1 bis 5 Sterne, Ergebnisse live

### 🏷️ Auktion
- Die Lehrkraft bietet Items an, die Haussprecher bieten mit Hauspunkten
- Phasen: wartend, offen, abgeschlossen

### 🖥️ Classroom Screen
- Beamer-Ansicht mit frei platzierbaren Widgets: Uhr, Timer mit Signalton, Stoppuhr, Arbeitsform, Notizen
- Die Anordnung wird im Browser gespeichert

### 📋 Stundenplaner
- Verlaufsplanungen mit Phasen erstellen (Titel, Fach, Klasse; je Phase Inhalt, Methode, Material)
- Materialien anhängen; Office-Dateien werden per LibreOffice zusätzlich als PDF abgelegt
- JSON-Import, Planungen mit Kolleginnen und Kollegen teilen

### 🧱 Snap!
- Blockbasiertes Programmieren (Snap!, Berkeley) direkt in der Seite, komplett lokal, ohne Internet und ohne Konto
- Programme werden in TT gespeichert; Lehrkraft-Programme mit Klasse werden zu Vorlagen, die die Klasse als eigene Kopie speichert
- **Einrichtung:** Beim ersten Start des Frontend-Containers wird Snap! v12.0.6 nach `frontend/public/snap` geladen (~90 MB, nicht im Repo). Ohne Internet startet die App trotzdem, nur Snap! fehlt dann. Von Hand nachholen: `npm run fetch:snap` in `frontend/`.

### 💾 Offline-Dateien
- Ausgewählte Werkzeuge lassen sich als einzelne HTML-Datei herunterladen und ohne Server nutzen (Build mit `npm run build:standalone`). Herunterladen darf nur, wer das Werkzeug auch benutzen darf.

---

## ⚔️ Sport & Spiele

### 🏆 Wettkämpfe
- Turniere als K.-o., Jeder gegen Jeden oder Paarungsturnier
- Eigene Wertung, Punkte und Rangfolge; Matches verwalten, Ergebnisse eintragen
- Teilnehmende aus Klassen oder Schülern, mit freien Namen oder als Lehrerteam

### 🏃 Sportfest
- Disziplinen Sprint, Ausdauer, Weitsprung und Ballwurf, bewertet nach DLV-Tabellen
- Ergebnisse je Klasse eintragen, Gesamt- und Disziplinranking
- Disziplinen werden im Admin-Setup aktiviert

---

## 🛡️ Klassenverwaltung

- **Häuser:** Name, Farbe und Logo; Klassen den Häusern zuordnen
- **Klassen:** Übersicht nach Punkten. Klassenlehrkräfte bearbeiten ihre eigene Klasse, alle anderen sehen sie nur.
- **Rollen:** Klassensprecher, Schülersprecher, Haussprecher und eigene Rollen
- **Dienste:** Tafeldienst, Pflanzendienst und weitere, dazu eigene Dienste; Schüler von Hand oder zufällig zuweisen
- **Checklisten (Tracker):** Abhaken je Schüler, zum Beispiel für abgegebene Hausaufgaben, für Klassen oder Gruppen
- **Kurse, Wahlpflicht, A/B-Gruppen:** klassenübergreifende Gruppen mit eigener Punktevergabe. A/B-Gruppen lassen sich überall wählen, wo man eine Klasse wählt.
- **Sitzplan:** mehrere Räume je Klasse (Klassenraum, Kunstraum …), Editor auf einer Zeichenfläche, Export als A4-PDF, auch für Kurse
- **Werkzeug-Freigaben je Klasse:** Klassenlehrkräfte können Werkzeuge für ihre Klasse freigeben oder sperren
- **Stabile Klassen-Codes:** Aus »7a« wird ein Abschlussjahrgangs-Code (z. B. `AK2031a`). So bleibt die Klasse über den Jahrgangswechsel am 1. August dieselbe.

---

## 📅 Kalender

- Schuljahreskalender mit Einzelterminen und Zeiträumen
- Sichtbarkeit nach Zielgruppe: Kollegium, Primar, Sekundar, Schulgemeinschaft, Ferien und Persönlich (nur für die eigene Person)
- Frei benannte, farbige Tags (Dienstberatung, Wandertag …)
- Ferien nach Bundesland
- ICS-Import und -Export

---

## 🗂️ Fragmente

- Pinnwände im Stil von TaskCards: Textfragmente und Recherche-Clips mit Link-Vorschau
- Zugriff pro Sammlung in drei Stufen: lesen, beitragen, verwalten; vergeben an Lehrkräfte, Klassen oder A/B-Gruppen
- Gäste treten per QR bei
- Tabs innerhalb einer Sammlung

---

## 🖼️ Startseiten-Slideshow

- Kiosk-Ansicht für den Bildschirm im Schulflur
- Inhalte: hochgeladene Bilder, PDFs und Videos, externe Links, Termine aus dem Kalender, Wochenspruch, Hauspunkte und Uhr
- Die Uhr erscheint nach jeweils zwei anderen Folien
- Zeitfenster heften einen Eintrag fest, solange das Fenster läuft
- Inhalte je nach Zielgruppe; Warnungen bei kaputten oder überlappenden Einträgen

---

## ⚙️ Admin

| Bereich | Funktion |
|---------|----------|
| **Schülerdaten** | CSV-Import mit Vorschau und Diff · Änderungen bestätigen · Zugänge generieren · Export |
| **Lehrerdaten** | Konten und Lehrerrollen verwalten |
| **Schülerkarten** | Felder wählen · Klassen filtern · Drucklayout · PDF-Export |
| **Werkzeug-Freigaben** | Je Werkzeug und Fähigkeit (Öffnen, Hosten, Erstellen, Hochladen) und je Zielgruppe (Lehrkraft, Schüler) erlauben oder sperren |
| **Admin-Rechte** | Einzelne Admin-Bereiche (Schülerdaten, Lehrerdaten, Generatoren, Style Pack, Kalender-Einstellungen, Slideshow) an Lehrerrollen oder einzelne Lehrkräfte vergeben |
| **Aufgaben-Generatoren** | Eigene Übungsthemen anlegen, deklarativ und ohne ausführbaren Code |
| **Slideshow** | Startseiten-Rotation pflegen |
| **Darstellung** | Farbschema · Icon-Stil (Fantasy / Cyberpunk / Emoji) · Hell/Dunkel |
| **Style Pack** | ZIP mit `logo.svg`, `icons/<name>.svg` und `colors.json` hochladen |
| **Schuleinstellungen** | Dauer des Gastzugangs · welche Schülerdaten angezeigt werden (z. B. Geschlecht für den Sitzplan) |

---

## 🔒 Datenschutz und Sicherheit

- **Namen:** Außerhalb der Klassenleitung, der Schülerdatenverwaltung und der eigenen Person erscheinen Schüler nur als »Vorname N.«, also auch auf Ranglisten und am Beamer.
- **Zwei-Faktor (TOTP) für Lehrkräfte:** Pflicht beim Ansehen von Lehrkraft-Passwörtern und beim Export der Zugangsdaten einer Klasse.
- **Passwörter:** Login-Prüfung per bcrypt. Druckbare Zugangsdaten sind mit Fernet verschlüsselt, der Schlüssel kommt aus `SECRET_KEY`.
- **Audit-Log** für sicherheitsrelevante Zugriffe.
- **Aufbewahrung:** Spielsitzungen werden zum Schuljahreswechsel (1. August) gelöscht (Art. 5 DSGVO). Punkte und Materialien bleiben erhalten.
- **Kein Fremdcode:** Hochgeladene Inhalte verweisen nur auf geprüfte Aufgaben-Generatoren, Link-Vorschauen sind gegen SSRF geschützt.
- **Keine KI in der App:** KI-Funktionen erzeugen nur Prompts für externe Werkzeuge, Schülerdaten verlassen den Server nicht.

---

## Setup & Start

Der ganze Stack läuft in Docker. Node-, Python- und Systempakete werden in den Containern installiert. Auf dem Host braucht es nur Docker, und das richtet das Setup-Skript bei Bedarf selbst ein.

**Windows** (PowerShell im Projektordner):

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**Linux / macOS**:

```bash
./install.sh
```

Das Skript installiert Docker, falls es fehlt (Linux: Docker Engine und Compose; Windows: Docker Desktop und WSL2), legt `.env` an und baut und startet alle Dienste. Der erste Build lädt Images und kann einige Minuten dauern.

> Ist Docker schon installiert, reichen danach `start.bat` (Windows) bzw. `./start.sh` (Linux/macOS) zum Starten und `stop.bat` / `./stop.sh` zum Stoppen.

| Dienst | Adresse |
|--------|---------|
| Frontend | http://localhost:1339 |
| API | http://localhost:8000 |
| PostgreSQL | localhost:5435 |

Beim ersten Start legt ein **Setup-Dialog** den ersten Admin und die Klassen an.

> Für den Produktivbetrieb in `.env` einen echten `SECRET_KEY` setzen, sonst sind gespeicherte Zugangsdaten nicht geschützt.

---

## Rollen

| Rolle | Rechte |
|-------|--------|
| **Admin** | Alles, auch Schülerdaten, Häuser, Freigaben, Style und das Löschen von Punkten |
| **Lehrkraft** | Punkte vergeben, Werkzeuge hosten, Inhalte erstellen. Admin-Bereiche nur, wenn freigegeben. |
| **Klassenlehrkraft** | Zusätzlich: eigene Klasse bearbeiten (Rollen, Dienste, Sitzplan, Freigaben), Zugangsdaten exportieren (mit 2FA) |
| **Schüler** | Aktivitäten und Simulationen, freigegebene Werkzeuge, eigene Inhalte im gemeinsamen Schüler-Pool |
| **Gast** | Nur die eine Sitzung, deren QR oder Code gescannt wurde, und nur für begrenzte Zeit |
