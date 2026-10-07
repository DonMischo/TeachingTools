# TT - Teaching Tools

**TT - Teaching Tools** (früher »Hauspokal«) ist schulweites Punktesystem und Unterrichtsplattform in einem. Lehrkräfte vergeben Punkte an Klassen, die Klassen sammeln in ihren Häusern für den Hauspokal. Dazu kommen Aktivitäten, Simulationen, Unterrichtswerkzeuge, Klassenverwaltung, ein Schulkalender und eine Startseiten-Slideshow. Alles läuft auf dem eigenen Schulserver.

Eine maschinenlesbare Fassung der Feature-Liste steht in [features.yml](features.yml).

## Tech-Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, TanStack Query, KaTeX, three.js |
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

**Punkte aus Aktivitäten:** Caputh, Bingo und TaskCrawler vergeben Punkte nach Ergebnis. Läuft eine Sitzung für einen Kurs oder eine WPF-Gruppe, wird jede beteiligte Klasse einzeln nach ihrer eigenen Quote bewertet.

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
- Import als `.json` oder `.zip`, Vorlage zum Herunterladen; nachträglich per Formular bearbeitbar, Bilder direkt hochladen (JSON nur im Expertenmodus)

### 🎰 Bingo
- Runden mit Rastergröße und Caller/Antwort-Paaren anlegen und sofort hosten
- Jede Person bekommt eine eigene Karte; die Lehrkraft ruft auf, die Klasse markiert
- JSON-Import, Vorlage und ein fertiger Prompt für externe KI (keine KI in der App selbst)
- Sets nachträglich bearbeiten
- Zurücksetzen (gleiche Karten) oder komplett neu starten (alle Karten neu gemischt)
- Auswertung je Karte: Treffer gegen das, was von der eigenen Karte gerufen wurde

### 🗝️ TaskCrawler
- TaskCrawler im eigenen Tempo, die Lehrkraft sieht den Fortschritt live — wahlweise als Folien oder als isometrisches Gebäude (Abschnitt = Stockwerk, Aufgabe = Zimmer, Tür = Treppenhaus, Objekte wie Computer oder Kuckucksuhr als Stationen), als Verlies (Ebenen hinab im Fackelschein, Monster und Bosse) oder als Ebene mit verschlossenen Türen, in 17 Stilen (Klassisch, Beton, Glas & Neon, Gartenpalast, Verlies, Burg, Holzhütte, Eispalast, Wüstentempel, Raumstation, Lavahöhle, Steinzeithöhle, Antiker Tempel, Mittelalter, Gotik, Viktorianisch, Retro), auf Wunsch je Abschnitt ein anderer (`"stile"`, z. B. eine Zeitreise durch die Epochen); jeder Stil mit eigenen Oberflächen (Fels, Mauerwerk, Dielen, Fischgrät, Marmor, Fachwerk, Tapete, 70er-Teppich …), Höhlen aus unregelmäßigen Felsbrocken mit Tropfsteinen, in der Lavahöhle glühende Risse in Boden und Wänden, Säulen im Tempel, Turmspitzen in der Gotik, Zinnen auf der Burg; legt das Spiel Ansicht oder Stil fest, gibt es dafür keine Auswahl, sonst wählen die Schüler selbst; Spielfigur zum Aussuchen (Normal, Krieger, Magier, Priester, Rapper, Rocker; männlich/weiblich; vier Hauttöne — oder eines der 30 Avatar-Tiere als 3D-Figur; beim ersten Betreten fragt der TaskCrawler danach, das Tier vom Beitritt wird übernommen; mit drehender Vorschau, gilt auf dem Gerät für alle Gebäude); Ergebnissicherung: jede Folie kann einen Merksatz tragen (`"ergebnissicherung"`), am Ende gibt es alle als gestaltetes PDF nach Abschnitten (Formeln als lesbarer Text) — der Server liefert sie erst nach dem Spiel aus; die Textfassung (📄 Text) bleibt neben jeder 2.5D-Ansicht wählbar, auch wenn das Spiel sie festlegt; 39 Stationsobjekte, darunter Medien durch die Zeit (Höhlenmalerei, Tontafel, Schriftrolle, Handschrift, Druckerpresse, Zeitung, Telegraf, Kurbeltelefon, Röhrenradio, Filmprojektor, Röhrenfernseher, Großrechner, Laptop, Smartphone, Tablet, Kopfhörer, Bildbearbeitung, KI-Rechenzentrum) — das Objekt spricht selbst (»☎️ Das Telefon klingelt …«, »📻 Aus dem Radio tönt es …«); ohne Angabe wechseln die Objekte reihum statt überall Tafel und Schreibtisch; Beispiel »Zeitreise der Medien« in sechs Epochen bis zu Photoshop, Deepfakes und KI, mit freiwilligen 🌍-Aufgaben am Globus (Orakelknochen, Quipu, Jikji, Maya-Codices, Telenovela, Emoji, M-Pesa) ohne Codeschnipsel; schlanke und interaktive Vorlage (mit Nachschlageliste `_katalog`: Ansichten, Stile, Objekte, Werkzeuge und ihre Parameter); Aufgaben können eine Simulation als Werkzeug öffnen, festgelegt auf genau diese Aufgabe (z. B. Gleichungswaage mit einer Gleichung)
- Aufgaben vergeben Codeschnipsel, die an der Tür zusammengesetzt werden
- Serverseitige Anpassung der Schwierigkeit (Fuzzy-DDA): Hinweise, Zeitlimits, leichtere Aufgaben je nach Verlauf
- Aufgaben aus den Aufgaben-Generatoren, eingebettete Lückentexte und Zeitstrahlen
- Import als `.json`/`.zip`, Vorlage mit Beispiel für jeden Baustein; nachträglich per Formular bearbeitbar, Bilder direkt hochladen (JSON nur im Expertenmodus)

### 🧩 Lückentext
- Lücken mit Wortbank, Freitext oder Multiple Choice; Ziehlücken (gestrichelte Pille) und Schreiblücken (Linie) sind auf einen Blick zu unterscheiden
- Live-Runde mit Rangliste, Einzelübung oder Korrekturmodus
- PDF-Export (leer oder ausgefüllt); einbettbar in Caputh und TaskCrawler

### 📏 Zeitstrahl
- Zeitleisten mit parallelen Spuren und Zahlenstrahlen
- Anzeigen, Ereignisse einsortieren, Fehler finden
- JSON-Import, Vorlage und mitgelieferte Beispiele (u. a. Erdgeschichte, Antike, Entdeckungen der Geowissenschaften)

### 🗺️ Karten
- Kartennetz Equal Earth (flächentreu, Standard) oder Mercator, umschaltbar im ☰-Menü der Karte und je Kartensatz gespeichert; Maßstab als schwarz-weiße Leiste in der Karte (auch im Arbeitsblatt), Quellen mit Lizenz darunter
- Selbst gehostete Karten (MapLibre, Schriften und Daten auf dem eigenen Server): Deutschland, Thüringen, Europa, Welt und Kontinente; politisch, topographisch, stumm, Wirtschaft und physische Geografie (Platten, Plattengrenzen, Wüsten, Köppen-Geiger-Klimazonen)
- Meeresboden: Tiefenstufen von 0 bis über 10 000 m mit Schummerung (Natural Earth), dazu 13 Tiefseegräben mit größter Tiefe und 5 mittelozeanische Rücken als anklickbare, quizfähige Linien
- Meeresströmungen (warm/kalt) und Windsysteme mit ITC, Druckgürteln und Monsun als animierte Linien mit Fließrichtung; jede Strömung und jeder Gürtel anklickbar (Erklärung, Hervorhebung, quizfähig); Monatsregler mit ▶ spielt das Jahr ab — ITC und Gürtel wandern, Monsun und Somalistrom kehren um; Partikelfluss wie bei earth.nullschool (Strömungen rot/blau, Wind fein) aus einem Feld, das aus den Linien berechnet wird
- Offene Daten mit Quellenangabe auf der Karte: BKG (dl-de/by-2.0), Natural Earth, Open Power System Data, CORINE, Bird PB2002, Beck et al. 2023 — Übersicht unter Admin → Quellen
- Europa genauer: BIP pro Kopf (KKS, EU = 100) und Bevölkerungsdichte je NUTS-2-Region (Eurostat, © EuroGeographics), EU/Eurozone/EFTA/Kandidaten, Kraftwerke ab 100 MW (OPSD), Fernstraßen, Eisenbahn, Häfen und Flughäfen
- USA-Wirtschaft (schematisch wie im Schulatlas): Landwirtschaft und Viehhaltung je Bundesstaat (Corn Belt, Weizen, Dairy Belt, Ranching, Baumwolle, Sonderkulturen), Manufacturing Belt und Sun Belt, 22 Industriestandorte
- Stadtmodelle Berlin, Paris, New York als eigene Regionen: amtliche Bezirke/Ortsteile, kuratiert in Zentrum, Innenstadt und Stadtrand (Paris mit Bürostadt La Défense, New York mit Parks), Bezirks- und Borough-Grenzen
- Alle Siedlungen Deutschlands (Gemeinden und Ortsteile) mit Größenklassen-Filter in der Legende und Ortssuche
- Kartensätze: Objekte auswählen und nummerieren (1 2 3, a b c, A B C, I II III), mit Namen auf dem Server speichern und teilen; liegen zwei Nummern fast aufeinander (Berlin als Stadt und als Land), rücken sie auseinander
- Arbeitsblatt als PDF, DOCX, ODT oder LaTeX mit der Karte auf Seite 1, leer oder mit Lösung; die Karte füllt den freien Platz von Seite 1 (schmale Ränder, Quellen in 6 pt). Seitenformat »A4 hoch« / »A4 quer« im ☰-Menü gibt der Karte das Verhältnis der Seite; bei »Bildschirm« wird Seite 1 hoch oder quer, je nachdem, wo die Karte größer ist. Nur die Kartenseite dreht sich ins Querformat, die Tabellenseiten bleiben hochkant und sind zweispaltig. Im PDF Schrift Atkinson Hyperlegible (im API-Image, `api/fonts/`, SIL OFL), in DOCX/ODT Arial. Knopf ⤢ passt die Region wieder ein
- Eigene Ebenen als GeoJSON, KML, KMZ oder GPX (nur Lehrkräfte); JSON-Vorlage mit `aktiv` je Objekt zum Filtern, auch per KI
- Kartenquiz per Code/QR: Nummern benennen oder Orte finden, geprüft auf dem Server, Hauspunkte je Klasse; einbettbar in Caputh und TaskCrawler
- Erfolge je Kartensatz: Anteil richtig, ohne Fehlversuch, bestimmte Objekte, Serie, auf Zeit, benennen *und* finden, Fehler aufgeholt, an mehreren Tagen geübt, alle anderen
- Lernhelfer »🎯 Üben«: Fuzzy-Regeln aus Trefferverlauf und Pause bestimmen, was als Nächstes kommt; Unsicheres als Auswahl mit Ablenkern (frühere Verwechslungen, Nachbarorte, ähnliche Namen), Sicheres als freie Eingabe. Der Lernstand bleibt über Sitzungen erhalten; die Lehrkraft sieht, was in der Klasse noch wackelt. Eingeloggte üben geteilte Kartensätze auch ohne Code (»🎯 Kartensätze üben« in der Kartenansicht); »Automatisch weiter« spart den Klick auf »Weiter« (richtig 1 s, falsch 2,5 s Zeit für die Lösung)

### 📚 Übung
- Selbstständiges Üben mit generierten Aufgaben (Mathematik Kl. 1–7 nach Thüringer Lehrplan)
- Die Schwierigkeit steigt nach drei richtigen und sinkt nach zwei falschen Lösungen
- Geprüft wird auf dem Server, der Fortschritt zählt je Thema

---

## 🔬 Simulationen

Modelle zum Ausprobieren. Alle sind für Schüler offen und haben einen eigenen Beitritts-Code mit QR.

Jede Simulation trägt Fächer (auch mehrere, z. B. Geografie und Physik); die Übersicht filtert nach einem oder mehreren Fächern, und ein Admin kann unter »🏷️ Fächer bearbeiten« Fächer schulweit ändern oder eigene hinzufügen.

| Simulation | Was sie kann |
|------------|--------------|
| ⚖️ **Gleichungswaage** | Äquivalenzumformungen an einer Waage in drei Modi: Zahlen (sieben Stufen, Klammern, Brüche, Teile von Hand auf nur eine Seite ziehen, Motive wie Streichhölzer/Schachteln oder Gummibärchen/Tüten, Minus als beschädigtes Gegenstück: abgebrannt, angebissen, zerbrochen, schwarz), Variablen (Formeln wie F = m·a umstellen) und Chemie (Reaktionsgleichungen ausgleichen, Ionen, Kernteilchen, Oxidationszahlen, Oktett-Hinweis). Rechenweg wie im Heft, LaTeX-Eingabe. |
| 🧮 **Abakus** | Rechenrahmen zum Schieben, Modus »Alle gleich« oder »Stellenwert«. |
| 🖼️ **Bildformate** | PBM, PGM und PPM zum Anfassen: Zahlen tippen, Bild sehen, ins Bild klicken schreibt zurück. |
| 📐 **Vierecke** | Sechs Vierecke mit Formeln, Rechenweg und Eigenschaften, dazu Umfang (Zaun bauen) und Fläche (mit Einheitsquadraten auslegen). |
| ◈ **Binär-Rechner** | Acht Bits mit Stellenwerten, Rechenweg von 0 bis 255. |
| 📈 **Funktionen** | Term, Wertetabelle und Graph verbunden. Formelsatz, Rechenweg je Punkt, Normal- und Scheitelpunktform, π-Achsen, Zoom, Verschieben und Vorlagen zum Würfeln. Mehrere Funktionen mit Schnittpunkten, Export als SVG, PNG oder PDF. |
| 🤖 **KI-Werkstatt** | Wie Sprach- und Bildmodelle arbeiten: Tokenisieren, Wortnetz mit top-k, eigenes Netz trainieren, Attention, Mensch gegen Maschine raten, Diffusion mit Rauschen und Punktwolke, ein Neuron lernen lassen, »Echt oder KI« mit Bildpaaren. Klassentafel und Hintergrundtexte in drei Lesestufen. |
| 🪐 **Sonnensystem** | 3D-Modell mit echten Bahnen und Daten (JPL Horizons), Satelliten und Lagrangepunkten. Flugmodus mit Autopilot, Overdrive und 31 Forschungsaufträgen, dazu Kodex als PDF, 34 Erfolge, Größen- und Entfernungsvergleich, Kepler-Gesetze, Magnetfeld mit Sonnensturm und eine Galerie mit rund 90 Bildern. |
| 🎸 **Rock your Life** | Lebenssimulation: fünf Jahre nach der 10. Klasse in Erfurt — bewerben (Einstellungstest, Gespräch), Ausbildung, Job oder Übergangsjahr (FSJ, FÖJ u. a. auf Sylt, BFD, EQ, FOS, Wehrdienst, weltwärts, Au-pair, Work & Travel) mit echter Lohnabrechnung 2026, später Fachkraft-Stellen und Minijob, bei den Eltern bleiben oder ausziehen (Wohnungsmarkt Erfurt, Kaution, Umzug), einrichten (neu oder Kleinanzeigen), Wocheneinkauf mit rund 200 Produkten, Nährwerten, Saisonpreisen und echten Bonpreisen, Kleidung/Friseur/Handy mit Verschleiß, Führerschein und Auto, Checkliste »Nächste Schritte«, Verträge und Versicherungen, Anträge beim Amt (BAB, Wohngeld nach § 19 WoGG, Anmeldung, ALG mit 3-Tage-Frist …) als Minispiel mit echten Links, Steuererklärung, rund 60 Zufallsereignisse samt Fallen und Mahnwesen, Ausgehen mit Promille; Monatsbilanz, was der Staat nahm, Recherche-Modus, JSON-Speicherstand und Klassenübersicht mit Protokoll (CSV). |
| 🐋 **Leviathan – Kunst des Regierens** | Vernetzte Regierungssimulation (inspiriert von Vesters Ökolopoly, eigene Regeln): ein erfundenes Land aus neun Ländertypen über 16–30 Jahre regieren, sechs Hebel, acht Folgegrößen, Bevölkerung mit Altersstruktur, rund 70 zustandsabhängige Schocks, Wahlen mit Populismus-Risiko, Kipppunkte und die Leviathan-Anzeige nach Acemoglu & Robinson; »Warum?« mit Quelle an jeder Größe; Quellenverzeichnis mit DOI-Links; Wirkungsnetz als Kreis mit Live-Pfeilen und Schleifen; Rechenweg jeder Runde Schritt für Schritt mit Wasserfall je Größe; Zeitlupe mit wählbarem Tempo; Punkte direkt im Netz verteilen; Programme mit Sofortwirkung; Krisenstufe, Drehbuch und heikle Ereignisse legt die Lehrkraft an der Sitzung fest; Nachbesprechung mit Rückkopplungsschleifen. Recherche: `docs/leviathan-recherche.md`. |
| 🌊 **Küstendynamik** | Flachküste (Sylt), Steilküste und Marsch mit Deich im Querschnitt — die Steilküste als unverzerrtes Zellmodell mit vier Kliffen (Kreide/Jasmund, Møns Klint, Mergel/Brodtener Ufer, Sand/Rotes Kliff), Abbruch nach Biegespannung, Rutschungen nach Standsicherheit mit Grundwasser (Ablauf als Gleitklotz mit Reibung, Überhängendes bricht danach ab; Kreide bricht an steilen Klüften ab und zerfällt zu Schutt), fallenden und verrottenden Bäumen: Wellen mit Brecher- und Rollerzone, Gezeiten, Sturmfluten, Sandriff und Strandaufbau, Dünen, Brandungshohlkehle und Kliffabbruch, Deichbruch — im Zeitraffer bis 1 Jahr/s, Wetter von Hand oder im Jahreslauf. Küstenschutz mit Kosten und Nebenwirkungen (Aufspülung, Strandhafer, Deckwerk, Klimadeich, Lahnungen, Zurückweichen), mitwandernde Beschriftung und Beschriften-Quiz. Dazu Draufsicht mit Küstenlängsstrom, Buhnen und Haken sowie Gezeiten mit Flutbergen, Pegelkurve und Watt. Lupenzoom im Querschnitt und eine Galerie »Echte Küsten« mit 53 frei lizenzierten Commons-Fotos (Rügen, Møn, Sylt, Watt, Küstenschutz). |
| 🌍 **Aufbau der Erde** | Die Erde in 3D mit herausgeschnittenem Keil (Achtel oder Pol zu Pol): Schichten antippen für Tiefe, Temperatur, Druck, Dichte, Wellengeschwindigkeit, Zähigkeit, Gesteine und Minerale, Schale für Schale abziehen, Farben nach Temperatur/Dichte/Zustand, dazu live gerechnete Mantelkonvektion auf den Schnittflächen und ein Quiz. Tiefenprofil aller Größen nach PREM mit Schmelzkurve, Erdbebenwellen mit Strahlenverfolgung und Schattenzonen (drei Erdmodelle von 1900 bis Lehmann), Konvektionslöser zum Ausprobieren (Zähigkeit, Heizung, Kontinent als Deckel). |
| 🌋 **Wilson-Zyklus** | Ein ganzer Zyklus im Querschnitt und Zeitraffer: Superkontinent mit Plume, Grabenbruch, junges Meer, Ozean mit Rücken und spiegelbildlichen Magnetstreifen, Subduktion mit Tiefseerinne, Vulkanbogen und Benioff-Beben, Kollision mit Gebirgswurzel und Abtragung zum Rumpfgebirge. Meeresboden wird mit dem Alter tiefer, Gebirgshöhe nach Isostasie, Mantelströmung und Plattengeschwindigkeiten; jede Phase mit heutigem Beispiel, Quiz »Welche Phase?« und Wissensteil (Tuzo Wilson, Superkontinente, Variszikum in Thüringen). |
| 🔀 **Algorithmen-Werkstatt** | Einstieg in Algorithmen für Klasse 5/6 in drei Reitern. »Automat«: Handlungskarten für Kaugummi-, Pfand-, Fahrkarten- oder Kakaoautomat ordnen; Robo oder das Alien Zorp führen sie wörtlich aus und scheitern sichtbar an ungenauen (nicht eindeutig), unmöglichen (nicht ausführbar) und endlosen (nicht endlich) Schritten; Automat B prüft, ob der Algorithmus allgemein gültig ist; dazu »Was macht der Automat?«. »Flussdiagramm«: Editor mit den vier Grundfiguren, Prüfung (Start, Ende, ja/nein, Endlosschleifen), rechnender Ablauf (`eingabe T`, `x = 3*T + M`, `ausgabe r`), sieben Aufgaben von »Formen zuordnen« bis »selbst bauen« und neun Beispiele. »Code-Abenteuer«: 31 Level in acht Welten (Direktsteuerung, Planen, Drehen, Schleifen, Bedingungen, Labyrinthe, Unterprogramme, Endgegner) mit Vorhersage- und Fehlersuch-Leveln, Sternen für kurze Programme und mehreren Karten je Level; Editor mit Blockly-Blöcken im Scratch-Look, Programm auch als Flussdiagramm; vier Themen (Bug-Jagd, Verlies, Mars-Mission, Labyrinthien) und ein Duell zu zweit; Radar-Anzeige für Sensoren; Viren auf festen Bahnen und ein Jäger-Virus, das die Figur verfolgt. Sterne und Punkte (Bausteine, Fehlversuche, kleiner Zeitanteil) in allen drei Reitern, unscharfe Hilfe von Tipp bis »Vorführen« und ein Hilfsmodus. Klassenübersicht mit Punkten für die Lehrkraft. |
| 📶 **Schichtenmodell** | Lenas Katzenfoto reist von Erfurt nach Tokio (Idee: **[rick.theengineer](https://www.instagram.com/rick.theengineer/)**). **Kennenlernen:** 3D-Schichtstapel mit 15 Schritten und echten Bytes — DNS und HTTP, JPEG und TLS 1.3 (ChaCha20-Poly1305, geprüft an RFC 8439), TCP-Segmente, IPv4 und Ethernet mit allen Prüfsummen, Bits und Signal; farbiges Hex-Bild der Kapselung; Auspacken in Tokio Byte für Byte; eigenes Foto oder Text; Karte Hop für Hop (Seekabel über Suez, Singapur, Hongkong) mit NAT, TTL und neuen MAC-Adressen je Strecke; TCP bei Paketverlust als Ablaufdiagramm. **Anwenden:** Mission (8-Zeichen-Wort → ASCII → Bits → DNS-Jagd Root/TLD/Domain → Header selbst füllen → Routing mit Routingtabellen und längstem Präfix — 23 Router, acht Empfänger auf fünf Kontinenten) und Fehlersuche mit 13 Fällen und Windows-Werkzeugen. Umschaltbar OSI/TCP-IP und in drei Niveaus von Klasse 6 (einfache Sprache, »Paket im Paket« als Umschläge) bis Experte (Prüfsummen von Hand, TLS-Nonce, CRC); »Vom Bild zu den Zahlen« mit Pixel-Regler, RGB/Hex und JPEG-Kopf; jede Missionsstufe mit Arbeitsauftrag und Wissen; Binär-Rechner als Hilfsmittel (Bits, Routing); Punkte und Sterne je Stufe, Niveau-Faktor, 12 Erfolge (im Browser gespeichert). Lenas App heißt PurrMsg. |
| 🪸 **Fraktales Wachstum** | Diffusionsbegrenzte Aggregation: Teilchen irren zufällig umher und bleiben am Haufen hängen — daraus wachsen Äste wie bei Korallen und Eisblumen. 2D bis 250 000 und 3D bis 500 000 Teilchen live (three.js-Punktwolke), Haftwahrscheinlichkeit, Keim Punkt/Linie/Kreis, Äste oder Punkte, PNG-Export, fraktale Dimension live im log-log-Diagramm (≈ 1,7 bzw. 2,5) und eine Zeitlupe mit einem einzelnen Wanderer. Vorbild: **[dlaf](https://github.com/fogleman/dlaf)** von Michael Fogleman (MIT), neu geschrieben mit Gittern statt k-d-Baum. |
| 🧬 **Regel-Labor** | Ersetzungsregeln auf einem Raster nach dem Vorbild von MarkovJunior: Regeln wie `RBB=GGR` gelten in allen vier Richtungen, Blöcke »eins«, »markov« (Vorrang) und »alle« mit Schrittgrenzen. Lehrgang in fünf Stationen vom Zufallslauf über den Backtracker (grüne Spur = Stapel) bis zum Grundriss mit Zimmern und Türen, Rätsel mit Regel-Limit und automatischer Prüfung, freies Labor mit Kästchen- oder Text-Editor und Treffer-Anzeige. Reiter »Labyrinthe«: Backtracker, Prim, Kruskal und Wilson zum Zuschauen, dann Tiefensuche, Breitensuche und A* mit sichtbarer Datenstruktur und Vergleichstabelle. Reiter »Beispiele«: Labyrinth, Blumen und Höhle aus MarkovJunior, dazu Platine, Verlies und Game of Life (Bausteine auch für Pfade per Breitensuche und Zellautomaten). Reiter »Gebäude«: ein Haus mit Stockwerken, gewachsen aus einer einzigen Regel, in 3D zum Durchlaufen oder als drehbares Modell mit allen Stockwerken (17 Stile von Klassisch bis Retro) |
| 🚦 **GTA – Ganztagsaufmerksamkeit im Verkehr** (zu Fuß) | Zu Fuß durchs echte Viertel um die Schule bis in die Innenstadt (OpenStreetMap), die ganze Klasse in einer Live-Stadt: Start vor der Schule, Uhrzeit mit Berufsverkehr und Nacht (Warnweste), Ampeln mit Taster, Zebrastreifen, Autos, die echten Linien Bus 9/35 und Tram 1/5 mit Abfahrtstafeln, Türen (erst aussteigen lassen), Gesten und Polizei, Überblick mit Straßennamen und Minikarte, Vollbild, Handy-Stick, Geräusche, Schilder-Rallye, Gruppe als Wand, Müll sammeln für Karma, LTB der Pinguin als Begleiter mit Sicherheitstipps (auch auf Nachfrage, passend zum Ort), Zeitraffer bis ×10, Bus-Szene (Bus ohne Dach, Fahrgäste, Stadtbus und Gelenkbus »Schlenky«, Busse nach Fahrplan), Wegsuche per Klick, mehrspurige Straßen, Handy Sim (Karte, Suche, Route, Beamen), Aussehen, Polizei-Gespräche, Fahrrad mit Werkstatt, StVZO-Prüfung, Radregeln, Radwegarten und Vorfahrt an Kreuzungen, Passanten, 22 Erfolge und ein Fußgänger-Führerschein mit Hauspunkten. |


### ⌨️ Tippen (10-Finger-Trainer)
- Bildschirmtastatur mit Fingerfarben, neun Lektionsstufen von der Grundstellung bis zu Zahlen und Satzzeichen
- Fehlersperre: ein falscher Anschlag zählt als Fehler, aber es geht erst mit der richtigen Taste weiter
- Modi: Lektionen, Wortregen, Tastenjagd (Reaktionszeit) und Wettschreiben (Klassenrennen mit eigenem Code, nur für Lehrkräfte)
- Werte: Anschläge pro Minute, Fehlerquote, schwächste Tasten
- Bestenliste mit den besten hundert je Modus
- Eigene Texte per JSON-Upload

### 🐭 Maus-Führerschein
- PC-Grundkurs für Kinder ab etwa zehn Jahren in drei Teilen: Maus; Tastatur, Dateien, Fenster und Speichern; Suchen, Apps, Bildschirmfoto und Aussehen
- Nachgebautes Windows mit Explorer, Fenstern, Taskleiste, Editor mit »Speichern unter«, USB-Stick, Herunterfahren und Bildschirmfoto
- Tasten als Tastenkappen im Text — beim Draufzeigen zeigt eine Tastatur, wo sie liegt
- Jede Stufe mit Vorführen, Vorlesen und 1 bis 3 Sternen; Hilfsmodus für langsame Mausnutzer
- Prüfung je Teil: beim ersten Bestehen 5 Hauspunkte für die Klasse, Urkunde als Bild und PDF
- Klassenübersicht für die Lehrkraft und Bestenlisten (Gäste mit Namen)

### 🍎 Rechenregeln
- Punkt vor Strich am Obstkorb: »3 · 4« sind drei Körbe mit je vier Äpfeln, Klammern sind Kisten
- Vertauschungsgesetz am Rechenzug, Stufenzahlen und Kommaverschiebung an der Stellenwerttafel
- Schrittweise lösen, Aufgaben würfeln, eigene Terme, Punktestand

### 🧩 Wellenfunktionskollaps
- Wave Function Collapse nach **[WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)** von Maxim Gumin (MIT): Überlagerung, Entropie, Kollaps, Ausbreitung, Widerspruch — Schritt für Schritt, bis »super langsam«
- Simple Tiled Model mit drei Kachelsätzen (Landschaft über Ecken, Straßen & Flüsse mit Brücken, Rohre) und Overlapping Model aus einer selbst malbaren Vorlage (2×2/3×3, gedreht/gespiegelt)
- Randbedingungen: Zellen oder den ganzen Rand vorab festlegen (Rand = Wasser → Insel); unmögliche Festlegungen werden sofort gemeldet
- Reiter »Textur«: Textur-Synthese nach P. F. Harrison, portiert aus **[TextureSynthesis](https://github.com/mxgmn/TextureSynthesis)** von Maxim Gumin (MIT; die Beispielbilder des Repos stehen nicht unter der Lizenz und werden nicht benutzt). Aus einer kleinen Probe wächst Pixel für Pixel ein nahtlos kachelndes Bild (Nachbarschaft, Zufallskandidaten, Polieren einstellbar, 2×2-Vorschau). Proben: die Oberflächen der Gebäude und die Pixel-Vorlagen — so entstehen auch die Fels-, Erd-, Sand- und Eisflächen der Gebäude.
- Auch als TaskCrawler-Werkzeug (`"sim": {"tool": "wfc", "config": {"reiter": "kacheln", "satz": "landschaft"}}`)

### 🧬 Regel-Labor — Quellen und Inspiration
- **[MarkovJunior](https://github.com/mxgmn/MarkovJunior)** von Maxim Gumin (MIT-Lizenz): Vorbild der Regelmaschine. Labyrinth, Blumen und Höhle sind übertragen, dazu 34 weitere Beispiele automatisch aus den Modelldateien des Repos (`scripts/mj-beispiele.py` → `frontend/src/lib/regeln/mj-beispiele.ts`, im Reiter »Beispiele« per Auswahlliste, jeweils mit Link aufs Original).
- **[index.opensource auf Instagram](https://www.instagram.com/index.opensource/)**: die kurzen Clips zu MarkovJunior (Maze Backtracker, Apartemazements, Circuit, Flowers …), die den Anstoß zum Regel-Labor, zum Gebäude und zum Verlies gegeben haben.
- Die Tempo-Stufen reichen von »super langsam« (etwa zwei Schritte pro Sekunde, zum Mitdenken) bis »sofort«.

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
- Dateien lassen sich durch neue ersetzen; Dauer, Zielgruppe, Zeitfenster und Platz bleiben
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
| **Quellen** | Fremde Daten, Bilder, Schriften und Programmbibliotheken mit Lizenz, nach Werkzeug; ⚠ bei ungeklärten Rechten |

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

### Gestaltung

Alle Farben und Grundbausteine stehen in `frontend/src/styles/theme.css`, die App und die Offline-Datei nutzen dieselbe Datei. Statt fester Farben (`text-gray-400`) oder `[var(--…)]` gibt es Tokens, die mit dem gewählten Theme wechseln: `bg-page`, `bg-surface`, `bg-surface-hover`, `text-fg`, `text-muted`, `border-line`, `bg-accent`/`text-accent-fg`, `text-ok`/`text-bad`, `max-w-seite`. Wiederkehrende Formen sind Bausteine: `.page`, `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.chip`/`.chip-on`, `.input`, `.label`. Tailwind-Klassen daneben überschreiben sie (z. B. `btn-primary px-3 py-1 text-xs`). Simulationen mit eigener Bühne (Sonnensystem, Rock your Life, Verkehr) behalten ihre festen Farben. Tailwind 4 braucht Chrome/Edge 111+, Firefox 128+ oder Safari 16.4+.

---

## Rollen

| Rolle | Rechte |
|-------|--------|
| **Admin** | Alles, auch Schülerdaten, Häuser, Freigaben, Style und das Löschen von Punkten |
| **Lehrkraft** | Punkte vergeben, Werkzeuge hosten, Inhalte erstellen. Admin-Bereiche nur, wenn freigegeben. |
| **Klassenlehrkraft** | Zusätzlich: eigene Klasse bearbeiten (Rollen, Dienste, Sitzplan, Freigaben), Zugangsdaten exportieren (mit 2FA) |
| **Schüler** | Aktivitäten und Simulationen, freigegebene Werkzeuge, eigene Inhalte im gemeinsamen Schüler-Pool |
| **Gast** | Nur die eine Sitzung, deren QR oder Code gescannt wurde, und nur für begrenzte Zeit |
