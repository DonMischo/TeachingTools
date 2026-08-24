# Hauspokal

Schulweites Punktesystem und Unterrichtstool-Suite. Lehrer vergeben Punkte an Klassen, Klassen kämpfen in Häusern um den Hauspokal. Daneben: Quizzes, Abstimmungen, Turniere, Sportfest und mehr.

## Tech-Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, TanStack Query |
| Backend | FastAPI (Python), SQLAlchemy, SQLite |
| Start | `start.bat` — startet API und Frontend gleichzeitig |

---

## Features

### 🏆 Hauspokal (Startseite)
- Live-Diagramm aller Häuser mit animierten Sand-/Vortex-Bars (WebGL-Shader)
- Jedes Haus zeigt akkumulierte Punkte aller zugeordneten Klassen
- Auto-Refresh alle 15 Sekunden

### ⭐ Punkte vergeben (Sidebar-Panel)
- Klasse aus der Liste wählen oder direkt vom Klassen-Tab aus öffnen
- Schnellauswahl: +5, +10, +25, +50, +100 Punkte
- Freitext-Punktzahl + optionaler Grund
- Punkte-Leitfaden (Richtwerte mit Beschreibung, klickbar zum Vorab-Ausfüllen)
- Punkte-Log pro Klasse (Verlauf mit Lösch-Option für Admins)
- Klassen-Nickname festlegen / ändern

### 🎲 Caputh (Quiz-System)
- Quiz-Bibliothek mit Typen: Klassisch, TÜ, Test, Aufgabe, Wettbewerb, Benutzerdefiniert
- Filter nach Typ und Jahrgangsstufe
- Quiz starten → Host-Ansicht + Schüler-Beitritt via Code
- Team-Modus: Schüler spielen in Teams
- Bild-Unterstützung für Fragen
- Gruppenauswertung

### ⚔️ Sport & Spiele

#### 🏆 Wettkämpfe
- Turniere anlegen (z. B. Tischtennis, Fußball)
- Spielpläne verwalten, Ergebnisse eintragen
- Live-Tabelle / Ranking

#### 🏃 Sportfest
- Disziplinen konfigurieren (Setup nur für Admins)
- Ergebnisse pro Klasse/Schüler eintragen
- Punkte-Ranking über alle Disziplinen

### 🛡️ Häuser & Klassen (via Admin)
- Häuser anlegen: Name, Farbe, Logo-Upload
- Klassen Häusern zuordnen
- Klassen-Tab: Übersicht aller Klassen sortiert nach Punkten
- **Klassen-Einrichtung** (⚙️-Button auf jeder Klasse):
  - **Rollen**: Klassensprecher, Schülersprecher, Haussprecher + eigene Rollen → Schüler per Dropdown zuweisen
  - **Dienste**: Aktive Klassendienste aus Pool wählen (Checkbox-Dropdown mit Default-Diensten + klassenübergreifenden Customs)
    - Tafeldienst, Pflanzendienst, Austeildienst, Fensterdienst, Computerdienst (Defaults)
    - Eigene Dienste hinzufügen (werden global gespeichert)
    - Schüler per Dropdown zuweisen
    - 🎲 Zufällig zuweisen — verteilt alle aktiven Dienste zufällig
    - 🗑 Zuweisungen löschen

### 🔨 Tools (Unterrichtstools)

#### 📝 Schreibraum
- Kollaborativer Schreibraum: Lehrer öffnet Raum, Schüler schreiben Zeilen
- Modi: nächste freie Zeile / beliebige Zeile
- Permanente oder temporäre Räume
- Echtzeit-Sync per WebSocket

#### 🌡️ Umfrage
- Anonyme Abstimmungssessions mit konfigurierbaren Skalafragen
- Live-Ergebnisse auf der Host-Ansicht
- Schüler stimmen über Code ab (kein Login nötig)
- Vorlage + JSON-Upload (KI-Anleitung in der Vorlage)

#### 🎫 Exit Ticket
- Anonymes Schnell-Feedback am Stundenende
- Lehrer startet Session, Schüler antworten via Code
- Ergebnisse live für den Lehrer sichtbar

#### 🖥️ Classroom Screen
- Beamer-Ansicht mit frei positionierbaren Widgets:
  - **Uhr** — aktuelle Uhrzeit
  - **Timer** — Countdown mit Ton-Signal bei Ablauf (3 Beeps via Web Audio API)
  - **Stoppuhr** — Vorwärtszähler
- Widgets per Drag-and-Drop positionieren

### 🏷️ Auktion
- Lehrer legt Items auf, Schüler geben Gebote ab
- Status-Phasen: Wartend → Gebote offen → Abgeschlossen
- Host-Ansicht zur Steuerung

### 🎰 Bingo
- Lehrer erstellt Bingo-Karten mit Caller/Antwort-Paaren
- Schüler erhalten individuelle Bingo-Karten
- Lehrer ruft Items auf, Schüler tippen auf ihrer Karte

### ⚙️ Admin

| Bereich | Funktion |
|---------|----------|
| **Schülerdaten** | CSV-Import mit Vorschau · Änderungen prüfen & bestätigen · Zugänge generieren · Exportieren |
| **Schülerkarten** | Felder wählen · Klassen filtern · Druck-Layout · PDF-Export |
| **Häuser & Klassen** | Häuser verwalten · Klassen zuordnen (→ siehe oben) |
| **Darstellung** | Farbschema wählen · Icon-Stil (Fantasy / Cyberpunk / Emoji) · Theme-Switcher |
| **Style Pack** | ZIP hochladen mit eigenem Logo, Icons und Farben |

### 🎨 Themes & Stil
- 3 Icon-Sets: Fantasy (handgezeichnete SVGs), Cyberpunk (angular), Emoji
- Theme-Farben per CSS-Variablen, vollständig anpassbar per Style Pack
- Style Pack: ZIP-Datei mit `logo.svg`, Icons per `icons/<name>.svg`, `colors.json`

---

## Setup & Start

Der komplette Stack läuft in Docker. Node-, Python- und System-Pakete werden
**innerhalb der Container** installiert — die einzige Voraussetzung auf dem Host
ist Docker, und das installiert das Setup-Skript bei Bedarf selbst.

**Windows** (PowerShell im Projektordner):

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**Linux / macOS**:

```bash
./install.sh
```

Das Skript installiert fehlendes Docker (Linux: Docker Engine + Compose;
Windows: Docker Desktop + WSL2), legt `.env` an und baut & startet alle Dienste.
Beim allerersten Docker-Build werden Images geladen — das kann einige Minuten dauern.

> Ist Docker bereits installiert, genügt danach `start.bat` (Windows) bzw.
> `./start.sh` (Linux/macOS) zum Starten und `stop.bat` / `./stop.sh` zum Stoppen.

- Frontend läuft auf http://localhost:1339
- API läuft auf http://localhost:8000

Beim ersten Start erscheint ein **Setup-Dialog** zum Anlegen des ersten Admin-Accounts und der Klassen.

---

## Rollen

| Rolle | Rechte |
|-------|--------|
| **Admin** | Alles — inkl. Schülerdaten, Häuser, Style, Punkte löschen |
| **Lehrer** | Punkte vergeben, Tools starten, Quiz erstellen |
| **Schüler** | Teilnahme an Quiz / Barometer / Exit Ticket / Bingo / Auktion |
| **Gast** | Lesender Zugriff auf öffentliche Ansichten |
