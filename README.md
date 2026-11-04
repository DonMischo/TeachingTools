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
- [Lizenz](#lizenz)

---

## 🏆 Hauspokal und Punkte

**Startseite:** Ein Live-Diagramm zeigt alle Häuser mit animierten Balken (WebGL-Shader). Jedes Haus zählt die Punkte seiner Klassen zusammen, die Ansicht aktualisiert sich von selbst.

**Punkte vergeben** (Seitenleiste):
- Klasse wählen, Schnellauswahl (+5 bis +100) oder freie Punktzahl, optional mit Grund
- Punkte-Leitfaden mit Richtwerten von »Gutes Verhalten« (5) bis »Turnier-/Wettbewerbssieg« (500), per Klick übernehmbar
- Punkte auch an Kurse, Wahlpflichtgruppen und A/B-Gruppen vergeben
- Punkte-Log je Klasse; Admins können Einträge löschen
- Klassen-Spitznamen setzen

**Punkte aus Aktivitäten:** Caputh, Bingo, TaskCrawler und Challenge vergeben Punkte nach Ergebnis. Läuft eine Sitzung für einen Kurs oder eine WPF-Gruppe, wird jede beteiligte Klasse einzeln nach ihrer eigenen Quote bewertet.

---

## 📱 Mitmachen per Code

- **Playhub (`/play`):** Schülerinnen und Schüler geben nur den Code von der Tafel ein. Der Playhub findet das passende Werkzeug und leitet weiter.
- **QR-Code:** Jede Sitzung zeigt einen QR zum Scannen mit dem eigenen Gerät.
- **Gastzugang:** Ist »Gäste erlauben« eingeschaltet, kommt man auch ohne Konto hinein. Der Gast-Token gilt nur für diese eine Sitzung und läuft ab (die Dauer stellt ein Admin ein). Der Schalter selbst läuft mit ab: nach derselben Zeit schließt der Gastzugang von sich aus, der Schalter zeigt die Restzeit und springt auf aus — eine Sitzung, die seit Tagen offen steht, lässt also niemanden mehr herein. »Gastzugang neu starten« beginnt ein neues Fenster. Gäste werden über eine eigene Gast-ID gezählt, nicht über den Namen. Ausnahme Challenge und TaskCrawler: Wer im selben Browser mit demselben Namen wieder beitritt, bekommt seine alte Gast-ID zurück und spielt seinen Stand weiter (auch nach Ablauf des Tokens).
- **Sitzungs-Geltungsbereich:** Sitzungen lassen sich für eine Klasse, eine A/B-Hälfte, einen Kurs oder eine WPF-Gruppe starten.
- **Selbst mitspielen:** Auf der Steuerungsseite jeder Aktivität (Caputh, Bingo, TaskCrawler, Challenge, Lückentext, Kartenquiz, Zeitstrahl) öffnet »▶ Selbst mitspielen« dasselbe Spiel wie bei den Schülern. Ein kleiner Knopf »← Steuerung« führt zurück. Der Stand hängt am Konto der Lehrkraft, beim nächsten Öffnen geht es an derselben Stelle weiter. Für die Klasse bleibt die Lehrkraft unsichtbar: nicht in Ranglisten, Lobby, Bingo-Meldungen oder Bestenlisten, und sie zählt nie für Hauspunkte. Nur in der eigenen Auswertung und im CSV steht sie, markiert als »Lehrkraft«.

---

## 🎮 Aktivitäten

Alle Aktivitäten können Schüler nutzen. Hosten dürfen standardmäßig nur Lehrkräfte; Admins können das pro Werkzeug freigeben (siehe [Werkzeug-Freigaben](#-admin)).

**Krabbler gegen Durchklicken:** Nach einer falschen Antwort in TaskCrawler, Challenge (Normal), Bingo oder Lückentext krabbeln Drahtgitter-Käfer über den Bildschirm, sperren Maus und Tastatur und spucken Wörter von der Seite aus (nach »Crawlers« von rybinfx). Die Sperre dauert 10 s und wächst mit jedem weiteren Fehler binnen einer Minute bis 20 s; ab dem dritten Fehler steht ein Mutmacher mit der Fehlerzahl in der Mitte, um den die Käfer kreisen (`frontend/src/lib/krabbler.ts`, Aufruf `krabbeln()`).

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
- TaskCrawler im eigenen Tempo, die Lehrkraft sieht den Fortschritt live — wahlweise als Folien oder als isometrisches Gebäude (Abschnitt = Stockwerk, Aufgabe = Zimmer, Tür = Treppenhaus, Objekte wie Computer oder Kuckucksuhr als Stationen), als Verlies (Ebenen hinab im Fackelschein, animierte Monster und Wächter) oder als Ebene mit verschlossenen Türen, in 17 Stilen (Klassisch, Beton, Glas & Neon, Gartenpalast, Verlies, Burg, Holzhütte, Eispalast, Wüstentempel, Raumstation, Lavahöhle, Steinzeithöhle, Antiker Tempel, Mittelalter, Gotik, Viktorianisch, Retro), auf Wunsch je Abschnitt ein anderer (`"stile"`, z. B. eine Zeitreise durch die Epochen); jeder Stil mit eigenen Oberflächen (Fels, Mauerwerk, Dielen, Fischgrät, Marmor, Fachwerk, Tapete, 70er-Teppich …), Höhlen aus unregelmäßigen Felsbrocken mit Tropfsteinen, in der Lavahöhle glühende Risse in Boden und Wänden, Säulen im Tempel, Turmspitzen in der Gotik, Zinnen auf der Burg; legt das Spiel Ansicht oder Stil fest, gibt es dafür keine Auswahl, sonst wählen die Schüler selbst; Spielfigur zum Aussuchen (Normal, Krieger, Magier, Priester, Rapper, Rocker, Metalhead; männlich/weiblich; vier Hauttöne — oder eines der 30 Avatar-Tiere als 3D-Figur, alle im Pokémon/Palworld-Stil mit Anime-Gesichtern und Toon-Look, gebaut per Skript in Blender: `blender -b --factory-startup --python scripts/avatare/baue.py -- frontend/public/modelle/avatare`; alle mit Skelett und Bewegungen (Idle, Gehen, Rennen, Angriff, Treffer, Jubel, Tod): die Menschen bekommen sie aus Quaternius' »Universal Animation Library« (CC0, `UAL_GLB` zeigt beim Bauen auf `UAL1_Standard.glb`; Gewänder schwingen als Ganzes, der Magier zaubert mit der freien Hand), die Tiere aus eigenen Skelett-Bausteinen je Körperbau (Vierbeiner, Vögel mit Flügelschlag, Schwimmer mit Schwanzflosse, Krake mit Tentakeln, Krabbe mit Scheren); die Figur läuft im Gebäude, jubelt in der Vorschau und greift im Bosskampf an; beim ersten Betreten fragt der TaskCrawler danach, das Tier vom Beitritt wird übernommen; mit drehender Vorschau, gilt auf dem Gerät für alle Gebäude); Ergebnissicherung: jede Folie kann einen Merksatz tragen (`"ergebnissicherung"`), am Ende gibt es alle als gestaltetes PDF nach Abschnitten (Formeln als lesbarer Text) — der Server liefert sie erst nach dem Spiel aus; die Textfassung (📄 Text) bleibt neben jeder 2.5D-Ansicht wählbar, auch wenn das Spiel sie festlegt; 39 Stationsobjekte, darunter Medien durch die Zeit (Höhlenmalerei, Tontafel, Schriftrolle, Handschrift, Druckerpresse, Zeitung, Telegraf, Kurbeltelefon, Röhrenradio, Filmprojektor, Röhrenfernseher, Großrechner, Laptop, Smartphone, Tablet, Kopfhörer, Bildbearbeitung, KI-Rechenzentrum) — das Objekt spricht selbst (»☎️ Das Telefon klingelt …«, »📻 Aus dem Radio tönt es …«); ohne Angabe wechseln die Objekte reihum statt überall Tafel und Schreibtisch; Beispiel »Zeitreise der Medien« in sechs Epochen bis zu Photoshop, Deepfakes und KI, mit freiwilligen 🌍-Aufgaben am Globus (Orakelknochen, Quipu, Jikji, Maya-Codices, Telenovela, Emoji, M-Pesa) ohne Codeschnipsel; schlanke und interaktive Vorlage (mit Nachschlageliste `_katalog`: Ansichten, Stile, Objekte, Werkzeuge und ihre Parameter); Aufgaben können eine Simulation als Werkzeug öffnen, festgelegt auf genau diese Aufgabe (z. B. Gleichungswaage mit einer Gleichung)
- Aufgaben vergeben Codeschnipsel, die an der Tür zusammengesetzt werden
- Serverseitige Anpassung der Schwierigkeit (Fuzzy-DDA): Hinweise, Zeitlimits, leichtere Aufgaben je nach Verlauf
- Aufgaben aus den Aufgaben-Generatoren, eingebettete Lückentexte und Zeitstrahlen
- Import als `.json`/`.zip`, Vorlage mit Beispiel für jeden Baustein; nachträglich per Formular bearbeitbar, Bilder direkt hochladen (JSON nur im Expertenmodus)

### ⚔️ Challenge
- Leistungsüberprüfung als Minispiel: Schüler:innen ordnen Fakten (Karten) per Klick oder Ziehen den passenden Challenges zu, auch als Kombo aus mehreren Fakten; Ablenker und falsch gelegte Fakten schwächen den Treffer, drei Fehlversuche schicken zurück zur Karte zum Nachlesen; ein Satzformat (`challenge.json`, als .zip mit `assets/`) für alle Spielarten, vier Stufen mit eigenen Texten und Fragen, Stufe passt sich per Fuzzy-Logik an; Prüfung und Wertung auf dem Server (jede Antwort zählt, Wiederholungen heben die Güte), Auswertung je Person mit CSV, Hauspunkte als Klassenmittel; je Klasse bzw. Kurs/WPF/A-B-Gruppe eine eigene Sitzung mit eigenem Code (nur diese Klasse kommt herein, Gäste zählen für sie, Punkte nur für sie); zehn Spielarten auf denselben Daten, von der Lehrkraft freigegeben und von den Schülern gewählt: Normal, Kartenspiel (erst ein Deck aus Fakten bauen), Bosskampf mit Skins (Drache, Rap-Battle, Prinzessin gegen Monster, Einhorn gegen Bestie), Jump'n'Run (Schlüssel sammeln, Türen öffnen), Turmverteidigung, Detektiv (Tatort durchsuchen, Beweise anheften), Alchemie, Brückenbau, Gerichtssaal (falsche Behauptungen `claims` mit Beweisen widerlegen) und Glücksrad (die Rätselwand verdeckt den Etappentitel, jede richtige Antwort deckt Buchstaben auf, falsche bringen Teile an den Galgen); Pixelgrafik mit Themes (Wald, Ninja, Verlies, Antike, Weltraum) aus freien Kachelsätzen; im Drachenkampf ein Verlies aus den Markov-Regeln des Regel-Labors mit Truhen und Mini-Monstern im Klicker-Kampf, Kämpfe beginnen im Pokémon-Stil; der Bosskampf läuft (mit WebGL) als 3D-Arena: der eigene Avatar gegen einen animierten 3D-Boss (Quaternius »Ultimate Monsters«, CC0), Treffer lösen das Element des Helden aus (nach der Avatar-Klasse: Krieger Klingen, Magier Arkan, Priester Licht, Rapper und Rocker Schall; sonst nach dem Skin), Lebensbalken mit weichem Absinken, nachlaufendem Geisterbalken, Trefferblitz und rotem Pulsieren bei wenig Leben (auch im Kartenspiel), Fehlversuche den Gegenzug des Bosses mit dem Element seines Zugs (achtzehn Elemente von Eis bis Arkan, dazu Wasser mit Welle, Wasserblase und Geysir, Sterne mit Nachthimmel, Galaxie, Sternschnuppen und Supernova und Heilung, die auf den Zaubernden selbst wirkt); die Spielarten folgen ihren Genre-Vorbildern (Deckbuilder mit Boostern, Energie und Absichten; Kampfmenü und Levelaufstieg; Tower Defense mit Wellen, Gold und Türmen; Ermittlung mit Verhören und Pinnwand; Trankladen mit Kundschaft; Brückenbau mit Testfahrt; Kreuzverhör), alle Draufsicht-Karten wachsen aus den Markov-Regeln (Verlies, Haus, Hecken- und Waldlabyrinth) und haben eine Minikarte; beim Sammeln lassen sich Hinweise wegwerfen und aus dem Papierkorb zurückholen; das Kartenspiel behält die Hand (Abwerfen, Mischen), der Brückenbau baut eine Brücke in Segmenten (die Testfahrt prüft alle belegten Segmente vom Ufer an und bricht am ersten falschen), die Turmverteidigung kennt Zeitschleife und Schwächung, die Alchemie nutzt die WebGL-Flüssigkeit der Häuseranzeige; je Etappe höchstens 12 Faktenkarten (nötige plus Ablenker), Etappen wahlweise gemischt, Sieg erst nach allen Etappen, vor jedem Kampf Deck bzw. Ausrüstung wählen; Mini-Monster schlagen zurück; nach unvollständigen Antworten heilt sich der Gegner (Bosskampf, Kartenspiel) mit einem kleinen, nach falschen mit einem großen Heiltrank; Fragen sind in allen Spielarten deutlich hervorgehoben; im Jump'n'Run erst die Schlüsselzone, dann führt jede Tür (am Tor mit E) in einen neuen Abschnitt, mit Fallenlassen durch Plattformen, Sprung in der Luft und Rennen für Weitsprünge in Welten, die nach oben und unten wachsen; im Jump'n'Run bei jedem Besuch eine neue Karte (sechs Stile, Abgründe, bewegliche Plattformen, Gegner) mit Edelsteinen und Bestenliste je Sitzung (zählt nicht zur Wertung); Startstufe je Schüler, DDA-Kalibrierung je Klasse als Vorschlag zum Bestätigen; als Boss-Folie (`"type": "boss"`) im TaskCrawler, deren Sieg den Codeschnipsel für die nächste Tür freigibt
### 🧩 Lückentext
- Lücken mit Wortbank, Freitext oder Multiple Choice; Ziehlücken (gestrichelte Pille) und Schreiblücken (Linie) sind auf einen Blick zu unterscheiden
- Live-Runde mit Rangliste, Einzelübung oder Korrekturmodus
- PDF-Export (leer oder ausgefüllt); einbettbar in Caputh und TaskCrawler

### 📏 Zeitstrahl
- Zeitleisten mit parallelen Spuren und Zahlenstrahlen
- Anzeigen, Ereignisse einsortieren, Fehler finden
- JSON-Import, Vorlage und mitgelieferte Beispiele (u. a. Erdgeschichte, Antike, Entdeckungen der Geowissenschaften)

### 🗺️ Karten
- Kartennetz Equal Earth (flächentreu, Standard), Robinson, Winkel-Tripel, Mercator oder Globus (Kugel zum Drehen, MapLibre-Globus), umschaltbar im ☰-Menü der Karte und je Kartensatz gespeichert; Maßstab als schwarz-weiße Leiste in der Karte (auch im Arbeitsblatt), Quellen mit Lizenz darunter
- Kinderatlas »Robinson Crusoe« (eigener Eintrag im Kartennetz-Menü, Robinson-Netz): kräftige, freundliche Länderfarben, helles Meer, dazu Tiere und Pflanzen dort, wo sie zu Hause sind (gezeichnete Illustrationen von Openclipart, CC0, oder niedliche Avatar-Kacheln wie im Maus-Führerschein, mit Namen; wichtige schon auf der Weltkarte, der Rest beim Heranzoomen); Tiere und/oder Pflanzen und der Bildstil im ☰-Menü wählbar, je Kartensatz gespeichert; bewusst wenig Einzelheiten (kein Relief, nur große Flüsse und Hauptstädte, Ozeane und Kontinente groß beschriftet)
- Selbst gehostete Karten (MapLibre, Schriften und Daten auf dem eigenen Server): Deutschland, Thüringen, Europa, Welt und Kontinente; politisch, topographisch, stumm, Wirtschaft und physische Geografie (Platten, Plattengrenzen, Wüsten, Köppen-Geiger-Klimazonen)
- Meeresboden: Tiefenstufen von 0 bis über 10 000 m mit Schummerung (Natural Earth), dazu 13 Tiefseegräben mit größter Tiefe und 5 mittelozeanische Rücken als anklickbare, quizfähige Linien
- Meeresströmungen (warm/kalt) und Windsysteme mit ITC, Druckgürteln und Monsun als animierte Linien mit Fließrichtung; jede Strömung und jeder Gürtel anklickbar (Erklärung, Hervorhebung, quizfähig); Monatsregler mit ▶ spielt das Jahr ab — ITC und Gürtel wandern, Monsun und Somalistrom kehren um; Partikelfluss wie bei earth.nullschool (Strömungen rot/blau) aus einem Feld, das aus den Linien berechnet wird; Wind als leuchtende Stromfäden in der Farbe seines Gürtels (Passat gold, Westwinde violett, polare Ostwinde blau) auf abgedunkelter Karte, ITC als leuchtendes Band
- Deutschland-Wirtschaft: Bundes-, Landes- und Kreisstraßen (BKG DLM1000/DLM250, Bundesstraßen quizfähig), Bodennutzung einfach oder genau (CORINE 2018 mit Laub-/Nadel-/Mischwald, Wein, Obst, dichter und lockerer Bebauung …), Bodenschätze der BGR (BSK1000): Lagerstätten der Energierohstoffe und der Steine und Erden als Flächen, 75 benannte Abbaustellen mit Bohrturm bzw. Schlägel und Eisen
- Offene Daten mit Quellenangabe auf der Karte: BKG (dl-de/by-2.0), BGR (GeoNutzV), Natural Earth, Open Power System Data, CORINE, Bird PB2002, Beck et al. 2023 — Übersicht unter Admin → Quellen
- Europa genauer: BIP pro Kopf (KKS, EU = 100) und Bevölkerungsdichte je NUTS-2-Region (Eurostat, © EuroGeographics), EU/Eurozone/EFTA/Kandidaten, Kraftwerke ab 100 MW (OPSD), Fernstraßen, Eisenbahn, Häfen und Flughäfen
- USA-Wirtschaft (schematisch wie im Schulatlas): Landwirtschaft und Viehhaltung je Bundesstaat (Corn Belt, Weizen, Dairy Belt, Ranching, Baumwolle, Sonderkulturen), Manufacturing Belt und Sun Belt, 22 Industriestandorte
- Atlas-Signaturen statt Farbpunkten (auch in der Legende): Kraftwerke mit Blitz in der Farbe des Energieträgers, Kernkraft mit Strahlenzeichen, Wasserkraft mit Wellen; Bergbau mit Schlägel und Eisen (Besucherbergwerk hohl); Flugzeug, Anker; USA-Industrie mit Auto, Träger, Zahnrad, Bohrturm, Chip; Industrie- und Sonderkulturflächen mit Fabrik, Traube, Apfel, Hopfen ab Zoom 7
- Stadtmodelle Berlin, Paris, New York als eigene Regionen: amtliche Bezirke/Ortsteile, kuratiert in Zentrum, Innenstadt und Stadtrand (Paris mit Bürostadt La Défense, New York mit Parks), Bezirks- und Borough-Grenzen
- Alle Siedlungen Deutschlands (Gemeinden und Ortsteile) mit Größenklassen-Filter in der Legende und Ortssuche
- Kartensätze: Objekte auswählen und nummerieren (1 2 3, a b c, A B C, I II III), mit Namen auf dem Server speichern und teilen; liegen zwei Nummern fast aufeinander (Berlin als Stadt und als Land), rücken sie auseinander
- Arbeitsblatt als PDF, DOCX, ODT oder LaTeX mit der Karte auf Seite 1, leer oder mit Lösung; die Karte füllt den freien Platz von Seite 1 (schmale Ränder, Quellen in 6 pt). Seitenformat »A4 hoch« / »A4 quer« im ☰-Menü gibt der Karte das Verhältnis der Seite. Das Blatt ist immer hochkant; eine Karte im Querformat wird um 90° gedreht, Titel und Aufgabe bleiben aufrecht. Tabellen zweispaltig: jedes Thema in eigener Spalte, außer es passt noch zum vorigen in die Spalte (Themen länger als eine Spalte laufen ohne Umbruch weiter). Im PDF Schrift Atkinson Hyperlegible (im API-Image, `api/fonts/`, SIL OFL), in DOCX/ODT Arial. Knopf ⤢ passt die Region wieder ein
- Eigene Ebenen als GeoJSON, KML, KMZ oder GPX (nur Lehrkräfte); JSON-Vorlage mit `aktiv` je Objekt zum Filtern, auch per KI
- Kartenquiz per Code/QR: Nummern benennen oder Orte finden, geprüft auf dem Server, Hauspunkte je Klasse; einbettbar in Caputh und TaskCrawler
- Ganzes Kartentool per Code/QR zum Erkunden (Ebenen, Kartenart, Kartennetz, Ortssuche), auch für Gäste — ohne Kartensätze, Upload und Export
- Erfolge je Kartensatz: Anteil richtig, ohne Fehlversuch, bestimmte Objekte, Serie, auf Zeit, benennen *und* finden, Fehler aufgeholt, an mehreren Tagen geübt, alle anderen
- Lernhelfer »🎯 Üben«: Fuzzy-Regeln aus Trefferverlauf und Pause bestimmen, was als Nächstes kommt; Unsicheres als Auswahl mit Ablenkern (frühere Verwechslungen, Nachbarorte, ähnliche Namen), Sicheres als freie Eingabe. Der Lernstand bleibt über Sitzungen erhalten; die Lehrkraft sieht, was in der Klasse noch wackelt. Eingeloggte üben geteilte Kartensätze auch ohne Code (»🎯 Kartensätze üben« in der Kartenansicht); »Automatisch weiter« spart den Klick auf »Weiter« (richtig 1 s, falsch 2,5 s Zeit für die Lösung)

### 📚 Übung
- Selbstständiges Üben mit generierten Aufgaben (Mathematik Kl. 1–7 nach Thüringer Lehrplan)
- Die Schwierigkeit steigt nach drei richtigen und sinkt nach zwei falschen Lösungen
- Geprüft wird auf dem Server, der Fortschritt zählt je Thema

### 🐾 Elemon

Das Monster-Sammelspiel aus Klikk als eigenes Spiel (gleiche Regeln und 3D-Kämpfe, Spielzeit nach der echten Uhr).

- Trainer-Name aus Vorschlägen, Elemon im Käfig fangen, Trainer, Arenen und Orden in vier Gebieten
- Energie, Werbevideos und gesperrte »Extra-Nutzung« wie im Klikk-Handy
- Duelle mit Code: Liste aller, die gerade spielen, gezielt herausfordern (muss angenommen werden) oder die ganze Klasse offen; nach jeder Herausforderung drei Minuten Pause
- Eigener QR-Code je Spieler·in: scannen fordert heraus (Kamera mit jsQR, sonst Nummer abtippen)
- Lehrkräfte drucken QR-Karten mit wilden Elemon; wer eine scannt, kann es fangen
- Item-Karten (Kräutertrank, Käfig, Goldkäfig, Beleber) mit Multiplikator; jede Karte hat eine Nummer und ist nach dem Scannen für die ganze Sitzung eine Weile leer (10–30 Min.), daher bis zu 10 Karten je Item
- Junge Elemon (niedrige Stufe) lassen sich leichter fangen; ein K.o. beendet die Runde

---

## 🔬 Simulationen

Modelle zum Ausprobieren. Alle sind für Schüler offen und haben einen eigenen Beitritts-Code mit QR.

Jede Simulation trägt Fächer (auch mehrere, z. B. Geografie und Physik); die Übersicht filtert nach einem oder mehreren Fächern, und ein Admin kann unter »🏷️ Fächer bearbeiten« Fächer schulweit ändern oder eigene hinzufügen.

| Simulation | Was sie kann |
|------------|--------------|
| ⚖️ **Gleichungswaage** | Äquivalenzumformungen an einer Waage in vier Modi: Rechnen (Grundschule: 3 Äpfel + 5 Äpfel = 8 Äpfel, Dinge zum Auswählen, im Drehpunkt steht <, = oder >; frei legen, gerade machen oder das Zeichen raten, während die Waage festgehalten wird), Zahlen (sieben Stufen, Klammern, Brüche, Teile von Hand auf nur eine Seite ziehen, Motive wie Streichhölzer/Schachteln oder Gummibärchen/Tüten, Minus als beschädigtes Gegenstück: abgebrannt, angebissen, zerbrochen, schwarz), Variablen (Formeln wie F = m·a umstellen) und Chemie (Reaktionsgleichungen ausgleichen, Ionen, Kernteilchen, Oxidationszahlen, Oktett-Hinweis). Rechenweg wie im Heft, LaTeX-Eingabe. |
| 🧮 **Abakus** | Rechenrahmen zum Schieben, Modus »Alle gleich« oder »Stellenwert«. |
| 🖼️ **Bildformate** | PBM, PGM und PPM zum Anfassen: Zahlen tippen, Bild sehen, ins Bild klicken schreibt zurück. |
| 📐 **Vierecke** | Sechs Vierecke mit Formeln, Rechenweg und Eigenschaften, dazu Umfang (Zaun bauen) und Fläche (mit Einheitsquadraten auslegen; bei Parallelogramm, Trapez, Raute und Drachen die Herleitung der Formel als Trickfilm mit Tempo-Regler). Dazu gewürfelte Übungen (Umfang, Fläche, rückwärts, erkennen, Einheiten, zusammengesetzt) und Sachaufgaben mit Skizze, Tipps und Lösungsweg, beide als Word-Arbeitsblatt exportierbar, und die Spiele Flächen-Duell und Bauhof (Gehege bauen: Umfang gegen Fläche; Wand streichen: Fläche in Rechtecke zerlegen). |
| 📏 **Geometrie** | Grundbegriffe für Klasse 5–7: Winkel ziehen, mit drehbarem Winkelmesser oder Geodreieck messen und zeichnen (Erkunden, Messen, Zeichnen), Winkelarten und Bezeichnungen (Scheitel, Schenkel, ∠ASB, griechische Buchstaben). Lagebeziehungen auf Kästchenpapier: Strecke, Strahl, Gerade, parallel ∥ und senkrecht ⊥ mit Schnittpunkt und Schnittwinkel, Abstand Punkt–Gerade als Lot. Neben-, Scheitel-, Stufen- und Wechselwinkel an geschnittenen Geraden, farbig gekoppelt, mit kippbarer Parallele und Übungsmodus. Symmetrie: Figuren an Achsen und Punkten ergänzen, Symmetrieachsen finden, Drehwinkel bestimmen; Spiegeln im Koordinatensystem an x-/y-Achse, Parallelen und Ursprung mit Bildkoordinaten. Gewürfelte Übungen und Sachaufgaben (Uhr, Kompass, Bahnübergang, Billard, Spiegelschrift, Windrad, Schatzkarte, Leiter) mit Skizze, beide als Word-Arbeitsblatt, und das Spiel Winkel-Billard (über die Bande ins Loch, Spiegeltrick). |
| 🪜 **Größen & Einheiten** | Umrechnen nach dem Merkblatt Klasse 5: Länge, Fläche (mit a und ha), Volumen (mit hl, l = dm³, ml = cm³; Hohlmaße hl, dl, cl ausblendbar), Gewicht, Zeit, Euro und US-Dollar. Einheitenleiter mit Bögen (oben · zur kleineren, unten : zur größeren Einheit); ein Tipp auf eine Einheit zeigt alle Umrechnungen von ihr aus; bei Fläche und Volumen wahlweise als Längenzahl hoch 2 bzw. 3 (m² → cm² · 100², m³ → cm³ · 100³). Umrechner mit »Komma wandert« und exaktem Bruch bei der Zeit. Alltagsbeispiele auf einer Achse in Zehnerschritten (Bakterium bis Erde, Mücke bis Blauwal, Lidschlag bis Jahr, Münzen und Scheine). Blatt »Länge · Fläche · Volumen«: Strecke, Quadrat und Würfel füllen sich gleichzeitig — 10, 10 · 10, 10 · 10 · 10 —, dazu die Tabelle, in der die Umrechnungszahl die Hochzahl der Einheit bekommt. |
| ➗ **Rechenzeichen** | Ein Bild zu jedem Zeichen: + legt Äpfel zusammen, − streicht durch, · legt Reihen (drehbar), : verteilt reihum auf Teller (mit Rest), ² als Quadrat aus Kästchen, ³ als Würfel Schicht für Schicht, √ als Suche nach der Quadratseite, < > als Säulen und Zahlenstrahl, ≤ ≥ mit vollen und offenen Kreisen. Für die Oberstufe ∫ als Streifensumme, die auf die Fläche zuläuft, und f′ als Tangentensteigung samt Sekante und mitgezeichnetem Ableitungsgraphen. |
| △ **Dreiecke** | Für Klasse 5–8: Ecken ziehen (mit Einrasten) oder per Regler setzen, Einordnung nach Seiten und Winkeln läuft mit, Strichmarken und Fachbegriffe (Schenkel, Basis, Katheten, Hypotenuse). Winkelsätze: Innenwinkelsumme zum Abreißen und Anlegen, Außenwinkel mit Parallele, Basiswinkel durch Falten, Thales mit Halbkreis. Besondere Linien einzeln zuschaltbar: Höhen, Seitenhalbierende/Schwerpunkt, Mittelsenkrechte/Umkreis, Winkelhalbierende/Inkreis. Umfang als Streifen, Fläche durch Ergänzen zum Parallelogramm oder Rechteck, Kongruenzsätze mit Konstruktionsschritten. Gewürfelte Übungen (Winkelsumme, Arten, Außen- und Basiswinkel, Fläche, Umfang, rückwärts, Pythagoras, Kongruenzsätze, Thales) und Sachaufgaben mit Skizze, beide als Word-Arbeitsblatt. Spiel Dreiecks-Blitz: Dreiecke in Sekunden einordnen. |
| 🔺 **Trigonometrie** | Einheitskreis mit sin, cos, tan, cot, sec, csc zum Ein- und Ausschalten (eigene Farben), Graph im selben Maßstab mit Spur und Umlauf, Einrasten an besonderen Winkeln, ½-Linien, Grad/Bogenmaß, exakte Werte, Quadranten, Winkel mit gleichem Wert. Funktionsgraphen a · g(b(x − c)) + d für sin, cos, tan, cot, sec, csc mit Polstellen, umstellbarem y-Bereich und »Welle treffen«. Rechtwinkliges Dreieck mit Gegen-/Ankathete/Hypotenuse. Dreiecksrechner (Gegebenes eintippen → alle Größen, Rechenweg, Bild mit Winkelbögen; SsW mit 0/1/2 Lösungen und Kreis-Konstruktion). Eigenes Aufgaben-Blatt nach Fall mit Tipps Schritt für Schritt. Neun Sachaufgaben mit Bild (Turm, Leiter, Fluss, Triangulieren, Wanderweg, Steigung, Doppelpeilung, Dach, Sonnenstand), als Word-Arbeitsblatt (.docx) mit Lösungen exportierbar. Spiel Küstenwache: Schiff anpeilen, Kurs und Strecke rechnen, Rettungsboot schicken (drei Stufen). |
| ⭕ **Kreis** | Kreis-Labor für Klasse 6–9: Radius am Rand ziehen, d, u und A live mit Formel und Rechenweg; π herleiten durch Abrollen des Umfangs und Zerlegen in Sektoren (»Rechteck« π · r mal r). Geraden am Kreis: Sekante mit Sehne, Tangente rastet senkrecht am Berührradius ein und wandert mit, Passante, d(M, g) gegen r. Kreisteile: Ausschnitt, Bogen, Abschnitt, Ring, Halb- und Viertelkreis. Gewürfelte Übungen und Sachaufgaben (Pizza, Fahrrad, Uhr, Laufbahn, Brunnen, Torte, Rasensprenger) mit Skizze, beide als Word-Arbeitsblatt exportierbar. Spiel Rad-Rollen: Umdrehungen oder Radius ausrechnen, bis das Rad an der Fahne hält. |
| 🧊 **Körper** | Für Klasse 5–10: Würfel, Quader, drei- und sechsseitiges Prisma, Zylinder, quadratische und rechteckige Pyramide, Kegel, Kugel, Halbkugel, Pyramiden- und Kegelstumpf drehbar in 3D (three.js), Maße am Regler; Volumen, Oberfläche, Mantel-, Grund- und Deckfläche mit Formel und Rechenweg. Teilflächen anklicken (Formel und Wert der Fläche), Netz stufenlos auf- und zuklappen (Mantel von Zylinder und Kegel rollt sich ab) und als Bastelbogen-PDF in Originalgröße herunterladen, mit Klebelaschen, Schneide- und Falzlinien. Ecken, Kanten, Flächen mit Eulerschem Polyedersatz, Höhe, Seitenhöhe, Mantellinie, Radius und Diagonalen einzeln zuschaltbar und beschriftet. Zusammengesetzte Körper (Haus, Silo, Turm, Werkstück mit Bohrung, Eistüte) mit Auseinanderziehen und roten verdeckten Flächen. Gewürfelte Übungen (Volumen, Oberfläche, rückwärts, Euler, Raumeinheiten, erkennen, Pythagoras im Körper, zusammengesetzt) und Sachaufgaben (Aquarium, Dose, Zelt, Eistüte, Pool, Schwimmbecken, Paket, Kerze) mit Schrägbild, beide als Word-Arbeitsblatt. Spiel »Wer fasst mehr?«: das Gefäß mit dem größeren Volumen antippen, Messbecher zeigen die Lösung. |
| 💯 **Prozent- und Zinsrechnung** | Prozente als Kreis, Prozentstreifen (oben %, unten der Wert), Hunderterfeld und gezählte Dinge, auch über 100 %, dazu als Bruch und Dezimalzahl. Dreisatz Schritt für Schritt über 1 für W, G oder p, mit Formel und Dezimalzahl daneben. Denkwege-Karten: Merkprozente, Zerlegen, Umdrehen, Grundwert erkennen, Wachstumsfaktor, Fallen (+20 %/−20 %, Prozentpunkte), 72er-Regel. Zinsen für Jahre, Monate und Tage (360-Tage-Jahr) und Zinseszins als Säulen mit Tabelle. Sachaufgaben in drei Stufen mit Lösungsweg und Punktestand, Übungsblatt zum Drucken. Vier Spiele: Prozent-Blitz (schätzen, Kopfrechnen, Schnäppchen gegen die Uhr), Saftbar (Schorle auf Prozent mischen, verdünnen, verstärken), Handy-Check (Barzahlung, 0 %-Finanzierung, Ratenkauf, Vertrag — Kleingedrucktes lesen, Aufpreis in % rechnen, Konto über 36 Monate) und Mein Kiosk (acht Wochen Kalkulation mit Aufschlag, Mehrwertsteuer, Mengenrabatt, Verderb und Ereignissen; Schülerschaft mit Kaufwahrscheinlichkeit, Eröffnungsandrang, Ruf aus Kundenzufriedenheit mit Sternen und Kommentaren). |
| 🔢 **Stellenwerttafeln** | Zehner-, Zweier- und Sechzehnersystem in einer farbigen Stellenwerttafel: Plättchen legen, bündeln und entbündeln (automatisch oder von Hand), mehrere Zahlen als Zeilen untereinander (per Häkchen löschen), bis Milliarden und mit Komma bis Tausendstel, dieselbe Zahl in allen drei Systemen (Bits in Vierer-Päckchen in der Farbe ihrer Hex-Ziffer). Verstehen-Blatt mit Bündeln, Ziffernvorrat, Stellenwerten, Zählwerk mit Übertrag, Umrechnen Schritt für Schritt (abziehen oder teilen), Binär ↔ Hex und Alltagsbeispielen. Übungen in drei Stufen (Tafel ablesen, Wert einer Ziffer, Zahlwort, Zerlegen, Umrechnen, Weiterzählen) mit Lösungsweg. Drei Spiele: Bit-Fall, Zählwerk-Rennen und Geheimbotschaft (ASCII; in einer Sitzung lässt sich der Code direkt an Anwesende schicken, die ihn annehmen müssen — höchstens alle 3 Minuten). |
| 🎨 **Farbmodelle** | RGB (Licht, additiv), CMYK (Druck, subtraktiv), HSV und HSL (Farbkreis + Feld zum Ziehen) an derselben Farbe, mit Reglern und allen Schreibweisen (Hex, rgb(), Prozent, CMYK, hsl(), Grauwert, Gegenfarbe). Hex ↔ Dez für Farbcodes je Kanal mit Rechenweg und ein freier Umrechner. Spiel Hex-Farbmischer: Zielfarbe in drei Stufen nachmischen. |
| ◈ **Binär-Rechner** | Acht Bits mit Stellenwerten, Rechenweg von 0 bis 255. |
| 📈 **Funktionen und Koordinatensystem** | Term, Wertetabelle und Graph verbunden. Formelsatz, Rechenweg je Punkt, Normal- und Scheitelpunktform, π-Achsen, Zoom, Verschieben und Vorlagen zum Würfeln. Mehrere Funktionen mit Schnittpunkten, Export als SVG, PNG oder PDF. Dazu der **Koordinaten-Lauf**: Punkte im Jump'n'Run setzen (erst laufen, dann springen), Figuren, Symmetrie, Steigung und y = mx + n in 5 Welten, Infohappen mit Vorführen. |
| 🤖 **KI-Werkstatt** | Wie Sprach- und Bildmodelle arbeiten: Tokenisieren, Wortnetz mit top-k, eigenes Netz trainieren, Attention, Mensch gegen Maschine raten, Diffusion mit Rauschen und Punktwolke, ein Neuron lernen lassen, »Echt oder KI« mit Bildpaaren. Klassentafel und Hintergrundtexte in drei Lesestufen. |
| 🪐 **Sonnensystem** | 3D-Modell mit echten Bahnen und Daten (JPL Horizons), Satelliten und Lagrangepunkten. Flugmodus mit Autopilot, Overdrive und 31 Forschungsaufträgen, dazu Kodex als PDF, 34 Erfolge, Größen- und Entfernungsvergleich, Kepler-Gesetze, Magnetfeld mit Sonnensturm und eine Galerie mit rund 90 Bildern. |
| 🎸 **Rock your Life** | Lebenssimulation: fünf Jahre nach der 10. Klasse in Erfurt — Übung für den Einstieg in Leichter Sprache (eine Aufgabe nach der anderen, nur die nötigen Knöpfe), bewerben (Einstellungstest, Gespräch), Ausbildung, Job oder Übergangsjahr (FSJ, FÖJ u. a. auf Sylt, BFD, EQ, FOS, Wehrdienst, weltwärts, Au-pair, Work & Travel) mit echter Lohnabrechnung 2026, später Fachkraft-Stellen und Minijob, bei den Eltern bleiben oder ausziehen (Wohnungsmarkt Erfurt, Kaution, Umzug), einrichten (neu oder Kleinanzeigen) — die Wohnung als 3D-Puppenhaus mit dem eigenen Avatar, der durch die Räume läuft — Wocheneinkauf mit rund 200 Produkten, Nährwerten, Saisonpreisen und echten Bonpreisen, Kleidung/Friseur/Handy mit Verschleiß, Führerschein und Auto, Checkliste »Nächste Schritte«, Verträge und Versicherungen, Anträge beim Amt (BAB, Wohngeld nach § 19 WoGG, Anmeldung, ALG mit 3-Tage-Frist …) als Minispiel mit echten Links, Steuererklärung, rund 60 Zufallsereignisse samt Fallen und Mahnwesen, Ausgehen mit Promille; Monatsbilanz, was der Staat nahm, Recherche-Modus, JSON-Speicherstand und Klassenübersicht mit Protokoll (CSV). |
| 🐋 **Leviathan – Kunst des Regierens** | Vernetzte Regierungssimulation (inspiriert von Vesters Ökolopoly, eigene Regeln): ein erfundenes Land aus neun Ländertypen über 16–30 Jahre regieren, sechs Hebel, acht Folgegrößen, Bevölkerung mit Altersstruktur, rund 70 zustandsabhängige Schocks, Wahlen mit Populismus-Risiko, Kipppunkte und die Leviathan-Anzeige nach Acemoglu & Robinson; »Warum?« mit Quelle an jeder Größe; Quellenverzeichnis mit DOI-Links; Wirkungsnetz als Kreis mit Live-Pfeilen und Schleifen; Rechenweg jeder Runde Schritt für Schritt mit Wasserfall je Größe; Zeitlupe mit wählbarem Tempo; Punkte direkt im Netz verteilen; Programme mit Sofortwirkung; Krisenstufe, Drehbuch und heikle Ereignisse legt die Lehrkraft an der Sitzung fest; Nachbesprechung mit Rückkopplungsschleifen. Recherche: `docs/leviathan-recherche.md`. |
| 🌊 **Küstendynamik** | Flachküste (Sylt), Steilküste und Marsch mit Deich im Querschnitt — die Steilküste als unverzerrtes Zellmodell mit vier Kliffen (Kreide/Jasmund, Møns Klint, Mergel/Brodtener Ufer, Sand/Rotes Kliff), Abbruch nach Biegespannung, Rutschungen nach Standsicherheit mit Grundwasser (Ablauf als Gleitklotz mit Reibung, Überhängendes bricht danach ab; Kreide bricht an steilen Klüften ab und zerfällt zu Schutt), fallenden und verrottenden Bäumen: Wellen mit Brecher- und Rollerzone, Gezeiten, Sturmfluten, Sandriff und Strandaufbau, Dünen, Brandungshohlkehle und Kliffabbruch, Deichbruch — im Zeitraffer bis 1 Jahr/s, Wetter von Hand oder im Jahreslauf. Küstenschutz mit Kosten und Nebenwirkungen (Aufspülung, Strandhafer, Deckwerk, Klimadeich, Lahnungen, Zurückweichen), mitwandernde Beschriftung und Beschriften-Quiz. Dazu Draufsicht mit Küstenlängsstrom, Buhnen und Haken sowie Gezeiten mit Flutbergen, Pegelkurve und Watt. Lupenzoom im Querschnitt und eine Galerie »Echte Küsten« mit 53 frei lizenzierten Commons-Fotos (Rügen, Møn, Sylt, Watt, Küstenschutz). |
| 🌍 **Aufbau der Erde** | Die Erde in 3D mit herausgeschnittenem Keil (Achtel oder Pol zu Pol): Schichten antippen für Tiefe, Temperatur, Druck, Dichte, Wellengeschwindigkeit, Zähigkeit, Gesteine und Minerale, Schale für Schale abziehen, Farben nach Temperatur/Dichte/Zustand, dazu live gerechnete Mantelkonvektion auf den Schnittflächen und ein Quiz. Tiefenprofil aller Größen nach PREM mit Schmelzkurve, Erdbebenwellen mit Strahlenverfolgung und Schattenzonen (drei Erdmodelle von 1900 bis Lehmann), Konvektionslöser zum Ausprobieren (Zähigkeit, Heizung, Kontinent als Deckel). |
| 🌋 **Wilson-Zyklus** | Ein ganzer Zyklus im Querschnitt und Zeitraffer: Superkontinent mit Plume, Grabenbruch, junges Meer, Ozean mit Rücken und spiegelbildlichen Magnetstreifen, Subduktion mit Tiefseerinne, Vulkanbogen und Benioff-Beben, Kollision mit Gebirgswurzel und Abtragung zum Rumpfgebirge. Meeresboden wird mit dem Alter tiefer, Gebirgshöhe nach Isostasie, Mantelströmung und Plattengeschwindigkeiten; jede Phase mit heutigem Beispiel, Quiz »Welche Phase?« und Wissensteil (Tuzo Wilson, Superkontinente, Variszikum in Thüringen). |
| 🔀 **Algorithmen-Werkstatt** | Einstieg in Algorithmen für Klasse 5/6 in drei Reitern. »Automat«: Handlungskarten für Kaugummi-, Pfand-, Fahrkarten- oder Kakaoautomat ordnen; Robo oder das Alien Zorp führen sie wörtlich aus und scheitern sichtbar an ungenauen (nicht eindeutig), unmöglichen (nicht ausführbar) und endlosen (nicht endlich) Schritten; Automat B prüft, ob der Algorithmus allgemein gültig ist; dazu »Was macht der Automat?«. »Flussdiagramm«: Editor mit den vier Grundfiguren, Prüfung (Start, Ende, ja/nein, Endlosschleifen), rechnender Ablauf (`eingabe T`, `x = 3*T + M`, `ausgabe r`), sieben Aufgaben von »Formen zuordnen« bis »selbst bauen« und neun Beispiele. »Code-Abenteuer«: 31 Level in acht Welten (Direktsteuerung, Planen, Drehen, Schleifen, Bedingungen, Labyrinthe, Unterprogramme, Endgegner) mit Vorhersage- und Fehlersuch-Leveln, Sternen für kurze Programme und mehreren Karten je Level; Editor mit Blockly-Blöcken im Scratch-Look, Programm auch als Flussdiagramm; vier Themen (Bug-Jagd, Verlies, Mars-Mission, Labyrinthien) und ein Duell zu zweit; Radar-Anzeige für Sensoren; Viren auf festen Bahnen und ein Jäger-Virus, das die Figur verfolgt. Sterne und Punkte (Bausteine, Fehlversuche, kleiner Zeitanteil) in allen drei Reitern, unscharfe Hilfe von Tipp bis »Vorführen« und ein Hilfsmodus. Klassenübersicht mit Punkten für die Lehrkraft. |
| 📶 **Schichtenmodell** | Lenas Katzenfoto reist von Erfurt nach Tokio (Idee: **[rick.theengineer](https://www.instagram.com/rick.theengineer/)**). **Kennenlernen:** 3D-Schichtstapel mit 15 Schritten und echten Bytes — DNS und HTTP, JPEG und TLS 1.3 (ChaCha20-Poly1305, geprüft an RFC 8439), TCP-Segmente, IPv4 und Ethernet mit allen Prüfsummen, Bits und Signal; farbiges Hex-Bild der Kapselung; Auspacken in Tokio Byte für Byte; eigenes Foto oder Text; Karte Hop für Hop (Seekabel über Suez, Singapur, Hongkong) mit NAT, TTL und neuen MAC-Adressen je Strecke; TCP bei Paketverlust als Ablaufdiagramm. **Anwenden:** Mission (8-Zeichen-Wort → ASCII → Bits → DNS-Jagd Root/TLD/Domain → Header selbst füllen → Routing mit Routingtabellen und längstem Präfix — 23 Router, acht Empfänger auf fünf Kontinenten) und Fehlersuche mit 13 Fällen und Windows-Werkzeugen. Umschaltbar OSI/TCP-IP und in drei Niveaus von Klasse 6 (einfache Sprache, »Paket im Paket« als Umschläge) bis Experte (Prüfsummen von Hand, TLS-Nonce, CRC); »Vom Bild zu den Zahlen« mit Pixel-Regler, RGB/Hex und JPEG-Kopf; jede Missionsstufe mit Arbeitsauftrag und Wissen; Binär-Rechner als Hilfsmittel (Bits, Routing); Punkte und Sterne je Stufe, Niveau-Faktor, 12 Erfolge (im Browser gespeichert). Lenas App heißt PurrMsg. |
| 🪸 **Fraktales Wachstum** | Diffusionsbegrenzte Aggregation: Teilchen irren zufällig umher und bleiben am Haufen hängen — daraus wachsen Äste wie bei Korallen und Eisblumen. 2D bis 250 000 und 3D bis 500 000 Teilchen live (three.js-Punktwolke), Haftwahrscheinlichkeit, Keim Punkt/Linie/Kreis, Äste oder Punkte, neun Farbverläufe, PNG-Export, fraktale Dimension live im log-log-Diagramm (≈ 1,7 bzw. 2,5) und eine Zeitlupe mit einem einzelnen Wanderer. Vorbild: **[dlaf](https://github.com/fogleman/dlaf)** von Michael Fogleman (MIT), neu geschrieben mit Gittern statt k-d-Baum. |
| 🏘️ **Stadtentwicklung** | Acht Stadttypen (römisch, europäisch bis zur Gentrifizierung um 2020, amerikanisch, Residenzstadt, Festungsstadt, sozialistische Stadt mit Schrumpfung, lateinamerikanische und orientalische Stadt) passend zu den Thüringer Lehrplänen Geschichte und Geografie; Stadtmodelle (Burgess, Hoyt, Harris-Ullman, Lateinamerika, Orient) als Schema; sieben Planungsaufträge; 3D-Flug mit Fassaden, Satteldächern und Wäldern; Gelände 512² auf demselben Zufallsgelände (Flusstal, Küste, Hügelland, Ebene, Gebirgstal; Fluss mit Aue und Furt, Burgberg, Relief, auf Wunsch erodiert). **Wachstum**: Epoche für Epoche — Kolonie mit Cardo/Decumanus bis zum römischen Erbe heute; Burg und Furt, Marktstadt mit Mauer, Vorstädte, Industrialisierung (Ring, Bahnhof, Gründerzeit), Moderne; Eisenbahnstadt, Straßenbahnstadt, Autostadt, Sprawl/Edge City — mit Erklärung und Quiz (in die Karte klicken, Wissensfragen, Epoche erkennen). **Planen**: fünf Aufträge (Kolonie, Marktstadt, Eisenbahnstadt, Industriezeitalter, Autostadt) mit Straßen-, Mauer-, Raster- und Bauwerkswerkzeugen; ein Regelwerk prüft Lage und Grundriss und erklärt jede Regel. **Sandkasten** mit Viertel-Pinsel. Häuser entstehen entlang der Straßen je Viertel, Gassen und Vororte aus Tensorfeldern nach **[MapGenerator](https://github.com/ProbableTrain/MapGenerator)** (LGPL-3.0), 3D-Flug nach **[Voxel Space](https://github.com/s-macke/VoxelSpace)** (MIT) — beides neu geschrieben. |
| 🔀 **Diagramm-Werkstatt** | Ablaufdiagramme und Mindmaps mit **[D2](https://github.com/d2lang/d2)** (MPL-2.0, als WebAssembly im Browser): im Bausteine-Modus Knoten anlegen, am gewählten Knoten weiterbauen, per Klick verbinden und einfärben (Füllung, Rahmen, Schrift, Pfeile) — oder den D2-Code selbst schreiben (Codeblock mit Syntaxfarben); beide Wege bearbeiten denselben Text. Prompt-Baukasten und Vorlage »Mit KI erstellen« für KI-Chats; Spickzettel für Schüler·innen; Pfeile per 🗑 beim Darüberfahren löschen. 20 Farbthemen, Richtung, ELK-Anordnung, Handzeichnungs-Stil; Vorlagen, Ablage im Browser, Rückgängig, Export als PNG/SVG/.d2. |
| 🌧️ **Erosion** | Regen formt Gelände: Wassererosion mit Abtrag, Ablagerung und Rutschungen Schritt für Schritt live, Regen- und Trockenzeit, Zufluss am Oberlauf, neue Flüsse und Seen (Priority-Flood); Reiter Küste: Steilküste, Flachküste und Marsch mit Deich mit Sturmflut, Meeresspiegelanstieg, Deichbruch und Querprofil, verknüpft mit der Küstendynamik; Reiter Gesteine & Verwitterung: beschriftete Querschnitte von neun Gesteinen mit ihren Formen (Karst: Ponor, Höhlenbach, Karstquelle, Trockental, Dolinen, Tropfsteinhöhle; Gipskarst mit Erdfall; Granitkuppe mit Wollsackverwitterung als abspielbare Erdgeschichte Tertiär → Eiszeit → heute; Tafelberg, Schutthalden, Blockhalde, Hohlweg, Rutschung, Dünen) mit Steckbrief, sechs regelbare Kräfte (Sonne, Wind, Wasser, Frost, Chemie, Pflanzen) und fünf Klimate, Wirkungsbalken je Kraft; Regler für Regen, Lösekraft, Standfestigkeit und Verdunstung, Ansichten Gelände/Wasser/Abtrag-Ablagerung/Vorher, Delta an der Küste, 3D-Flug. Gleiches Zufallsgelände wie die Stadtentwicklung. Vorbild: **[terrain-erosion-3-ways](https://github.com/dandrino/terrain-erosion-3-ways)** von Daniel Andrino (MIT), neu geschrieben. |
| 🌋 **Vulkane** | Schildvulkan, Schichtvulkan und Hotspot (Hawaii) wachsen Ausbruch für Ausbruch — die Form entsteht aus dem Magma: Kieselsäure (SiO₂) bestimmt Temperatur, Zähigkeit und Fließgrenze der Lava, Gas × Zähigkeit den explosiven Anteil. Lava fließt als Zellautomat nach dem Bingham-Modell (kritische Dicke, Abkühlung durch Abstrahlung, unter Wasser Kissenlava), Asche fällt Schritt für Schritt als Ring um den Krater und als Fahne mit dem Wind und rutscht bis zum Schüttwinkel ab; steile Wände brechen als Blockschutt. Ausbruch zum Zusehen als fallender Sand nach dem Vorbild von **[Sandspiel](https://github.com/MaxBittker/sandspiel)** (Max Bittker, MIT, neu geschrieben): Eruptionssäule, Schirmwolke im Wind, Lapilli auf Wurfbahnen, Glutlawinen, Lavafontänen; Aschewolke auf der Karte. Im flachen Meer surtseyanische Dampfexplosionen, in der Tiefe keine Säule. Hotspot: 320 km Ozean mit einer älteren Inselkette als Start; Plume und Schlot bleiben fest, die Pazifische Platte wandert darüber; der Nachschub kommt in Schüben — ein neuer Vulkan wächst erst als Seamount, dann mit Dampfexplosionen im Flachwasser, dann als Insel, wird fortgetragen, erlischt, sinkt und wird abgetragen; Meer nach Tiefe gefärbt, Inseln und Seamounts mit Altersangaben. Flankenausbrüche, Caldera-Einbruch mit Ignimbrit, Kraterseen (Priority-Flood). Querschnitt A–B mit allen Schichten, Schlot, Gängen, Magmakammer und Mantelplume; Karte mit verwitternden Lavaströmen; Kennzahlen und erkannte Form; 3D-Flug wie in der Erosion. Galerie »Echte Vulkane«: 57 Fotos von Wikimedia Commons (gemeinfrei, CC0, CC BY, CC BY-SA) mit Erklärung und Bildnachweis; »Wissen« mit 21 Einträgen zu Tephra (Asche, Lapilli, Bomben, Bims, Ablagerung, Tuff), Ausbruchsarten (hawaiianisch bis plinianisch, surtseyanisch, Glutwolken, VEI), Lava und Gefahren (Lahare, Gase, Pompeji, Überwachung), verknüpft mit der Legende des Querschnitts. |
| 🌳 **Baumleben** | Ein Baum vom Samen bis zum Humus in fünf Reitern. **Lebenslauf**: Rotbuche, Stieleiche, Fichte, Waldkiefer oder Hänge-Birke an einem Standort (Freistand, Waldrand, Unterstand) mit Boden und Niederschlag; das ganze Baumleben wird vorausberechnet und mit der Zeitleiste abgespielt, entweder durch alle Jahreszeiten oder im Jahressprung bei fester Jahreszeit; Darstellung natürlich (Himmel nach Sonnenstand, Bodenprofil, Schnee, Nachbarbäume) oder als Schema, Tag und Nacht auf eigener Uhr — Keimung (epigäisch/hypogäisch), Sämling, Jungbaum, Mannbarkeit mit Mastjahren, Altbaum, stehendes und liegendes Totholz, Humus mit neuem Keimling. Die Bäume wachsen prozedural: Laubbäume per Raumkolonisierung in einer mitwachsenden Kronenhülle (Runions, Lane & Prusinkiewicz 2007), Nadelbäume als Quirle (nach Weber & Penn 1995), Astdicke nach dem Pfeifenmodell, Knospenschicksal als Markow-Kette nach dem Licht (wie in Modellen von Renton, Guédon u. a.), Blattstellung über den Goldenen Winkel, Selbstreinigung der unteren Äste, Herbstfärbung je Blatt; Wurzeln als Pfahl-, Herz- oder Flachwurzel. Dazu Wasserhaushalt, Nährsalze, CO₂-Speicher, Bewohner je Phase und Jahresringe mit Dürre- und Mastjahren. **Im Baum**: Stoffströme in Xylem und Phloem, Mykorrhiza, Wasserpotential, Stammquerschnitt, Spaltöffnungs-Rechner. **Fotosynthese** für die Oberstufe: Blatt und Chloroplast, Spektren und Engelmann, Lichtreaktion mit Z-Schema, Calvin-Zyklus, Einflussfaktoren, Wasserpest-Versuch, Quiz. **Bäume bestimmen**: 30 Arten mit Foto des ganzen Baums von Wikimedia Commons (Nachweis am Bild; Nahaufnahmen zusätzlich, Skript `scripts/fetch-baum-habitus.mjs`), botanischer Tafel im Steckbrief (meist gemeinfrei: Thomé, Sturm, Köhler; Skript `scripts/fetch-baum-blaetter.mjs`) und Blattschema auf den Karten, Großansicht mit Zoom, Bestimmungsschlüssel und Quiz. **Sei ein Baum**: Spiel nach dem Vorbild von Forest Shuffle; erst den Standort wählen (Buchenwald, Auwald, Hochmoor, Kiefernheide, Bergwald), dann eine dort typische Art (auch Waldkiefer und Schwarzerle); die Aktionen folgen dem Lebensabschnitt (Sämling, Jungbaum, mannbar, Altbaum), Baumbild aus dem Lebenslauf-Generator mit DLA-Wurzeln und Pilzgeflecht, Krüppelwuchs nach Verbiss oder Wipfelbruch, früher Tod für Lichtbaumarten im Schatten, mindestens 1 Zucker je Runde, Gemeinschaften zwischen Bewohnern (Marienkäfer + Blattläuse, Specht + Nachmieter, auch Konkurrenz) und Pflanzen wie Efeu, Heidelbeere, Farn; Larven und ihre Erwachsenen (Engerling und Maikäfer, Raupen je Baumart und Nachtfalter) und Säugetiere rund um den Baum (Reh, Wildschwein, Dachs, Fuchs, Rötelmaus, Siebenschläfer); das Totholz zerfällt in sechs Stufen mit je zwei Runden, in denen Käfer, Pilze, Amphibien und Zersetzer einziehen, bis ein neuer Keimling auf dem Moderholz wächst; der Zufall setzt den Baum in einen Forst (Fällung mit der Umtriebszeit der Art, z. B. Fichte 80–100, Buche 120–140, Eiche 180–240 Jahre; danach nur noch Stubben) oder einen Naturwald (lebt bis zum Tod), am Ende vergleicht eine Statistik Forst und Naturwald je Art (Lebensdauer, Biomasse geerntet/im Wald geblieben, Bewohner, Totholz-Arten und -Jahre, Biodiversität, Arten-Jahre). |
| 💡 **Stromkreise** | Schaltungen auf einem Raster bauen und zusehen, wie der Strom fließt — Bedienung nach dem Vorbild des **[Circuit Simulator](https://github.com/pfalstad/circuitjs1)** von Paul Falstad (GPL-2.0), alles neu geschrieben. Bauteile: Batterie, Wechselspannung, Lämpchen, Widerstand, Motor, LED (fünf Farben), Diode, Schalter, Umschalter, Sicherung, Kondensator, Spule, Transformator, Strom- und Spannungsmesser. Gerechnet wird mit dem Knotenpotenzialverfahren (MNA) Schritt für Schritt: Kondensator, Spule und Trafo nach der Trapezregel, Dioden per Newton mit Spannungsbegrenzung; Lämpchen, LEDs und Sicherungen brennen bei zu viel Strom durch und lassen sich austauschen, der Motor läuft mit Gegenspannung hoch. Strompunkte in technischer Stromrichtung oder als Elektronen, Leitungen nach Potenzial eingefärbt, Zeitlupe bis ×500, Messgeräte zeigen bei Wechselstrom Effektivwerte, Oszilloskop für Spannung und Strom jedes Bauteils. Zwei Ansichten: Schaltplan mit DIN-Schaltzeichen oder realistisch wie im Experimentierkasten (Glühwendel, Farbringe, Propeller, Multimeter). Bauen: setzen oder aufziehen, Leitungen ziehen (ein Anschluss mitten auf einer Leitung verbindet), verschieben mit mitwandernden Leitungen, drehen, Rückgängig. 16 Beispiele vom ersten Stromkreis bis zum Brückengleichrichter; Speichern und Öffnen als JSON (beim Öffnen geprüft). Die Lehrkraft gibt die aktuelle Schaltung samt Arbeitsauftrag an ihre Sitzung; wer per Code/QR beitritt, startet mit einer eigenen Kopie. |
| 🏅 **Erfolge** (`/erfolge`) | Alle Erfolge aller Werkzeuge an einer Stelle, nach Werkzeug geordnet, mit Fortschrittsbalken je Erfolg und einer Gesamtzahl. Eingesammelt aus den Werkzeugen, die selbst Erfolge führen (Sonnensystem, Schichtenmodell, GTA–Verkehr, Periodensystem), dazu abgeleitete Erfolge für Werkzeuge mit Aufgabenmodus, die nur ihren Fortschritt speichern (Algorithmen-Werkstatt, Koordinaten-Lauf, Regel-Labor) — zusammen 102. Die Übersicht liest nur, sie schreibt nichts: jedes Werkzeug zählt weiter für sich. Stände, die an Konto oder Sitzungscode hängen, werden über alle Profile dieses Geräts zusammengefasst (je Erfolg der beste Wert). Registry in `src/lib/erfolge/register.ts`, Hook `useErfolge`. |
| 🧪 **Periodensystem** | Alle 118 Elemente im Tafelwerk-Raster: Ordnungszahl oben links, relative Atommasse oben rechts, Symbol mittig (Farbe = Aggregatzustand, * = radioaktiv), Name darunter, Elektronegativität und Dichte unten; Perioden links, Gruppen oben (arabisch, Hauptgruppen auch römisch), Fläche nach Kategorie, dazu eine Legende. Quadratische Felder, die sich in die verfügbare Breite einpassen (ohne Rollbalken), mit Zoom für die Projektion. Formeln sind korrekt gesetzt — Summenformeln und Reaktionen mit tiefgestellten Indizes, die Elektronenkonfiguration mit Hochzahlen. Suche über Namen, Symbol oder Ordnungszahl, Filter je Kategorie. Steckbrief mit Foto der Stoffprobe (Wikimedia Commons, Urheber und Lizenz am Bild), Atommasse, Zustand, Schmelz- und Siedepunkt in °C, Dichte, Elektronegativität, Elektronenkonfiguration, Oxidationszahlen und Jahr der Entdeckung; dazu ein Kurztext zu Wesen, Vorkommen und Verwendung. Dazu die **PSE-Rallye**: Aufgaben zum Anklicken im Raster — Ordnungszahl, Atommasse, Name, Symbol, Hauptgruppe (»klick ein Halogen an«) und die Kreuzung aus Periode und Hauptgruppe, in drei Schwierigkeitsbereichen; 3/2/1 Punkte je nach Versuch, bis zu drei Sterne je Runde und 19 Erfolge (Stand im Browser). Die acht Hauptgruppennamen (Alkalimetalle bis Edelgase) stehen im Steckbrief. Die typischen Reaktionen der Schulelemente stehen unausgeglichen dabei und öffnen mit einem Klick die **Gleichungswaage** im Chemiemodus (`?reaktion=…`). Dazu die **Atommodelle**: die fünf Modelle des Unterrichts nacheinander — Teilchenmodell (Dalton 1808), Kern-Hülle-Modell (Rutherford 1911), Schalenmodell (Bohr 1913), Energiestufenmodell (Bohr/Sommerfeld) und Orbitalmodell (Schrödinger 1926) — und bei jedem steht, was es erklärt und wo es aufhört; genau diese Lücke schließt das nächste. Die Bilder bewegen sich (drehende Schalen, zitternder Kern aus Protonen und Neutronen, atmende Orbitale), alles in CSS, anhaltbar und still, wenn das Gerät »Bewegung reduzieren« sagt. Das Element kommt aus dem Raster, voreingestellt ist **Bor** — drei Außenelektronen, die alle in Bindungen gehen, und darum ein Elektronensextett statt eines Oktetts. Im **Bindungslabor** werden bis zu acht Atome zusammengesteckt: die geteilten Elektronenpaare pendeln sichtbar zwischen den Außenschalen, unter jedem Atom steht seine Elektronenbilanz (grün mit Haken bei erfülltem Oktett bzw. Duett, sonst rot), und zwölf Vorlagen von BF₃ bis CCl₄ stehen bereit; übrige Bindigkeit wird zu Doppel- und Dreifachbindungen (CO₂, N₂). Geht eine Kombination nicht auf, sagt das Labor warum, statt etwas Falsches zu zeichnen. Die Elektronenkonfiguration kommt aus den gemessenen PubChem-Daten, also samt Ausnahmen (Chrom 3d⁵ 4s¹); der Kern in Klammern wird nach Madelung ergänzt. Kenndaten von **[PubChem](https://pubchem.ncbi.nlm.nih.gov/periodic-table/)** (NCBI, gemeinfrei), geholt mit `scripts/fetch-pse.mjs`; Bilder liegen im Repo, es geht nichts nach außen. |
| ⚛️ **Atommodelle** | Wie stellt man sich ein Atom vor? Die fünf Modelle des Unterrichts nacheinander — Teilchenmodell (Dalton 1808), Kern-Hülle (Rutherford 1911), Schalen (Bohr 1913), Energiestufen (Bohr/Sommerfeld) und Orbitale (Schrödinger 1926) — und bei jedem steht, was es erklärt und wo es aufhört; genau diese Lücke schließt das nächste. Dieselbe Ansicht steckt als Reiter im **Periodensystem**; hier ist sie eine eigene Simulation, bei der das Raster nur zum Auswählen dient. Voreingestellt ist **Bor**: dreibindig, und damit ein Elektronensextett statt eines Oktetts. Im **Bindungslabor** werden bis zu acht Atome zusammengesteckt. Jedes Atom hat seine Farbe, jedes seiner Elektronen trägt sie, und ein bindendes Paar besteht aus je einem Elektron beider Partner — **bewegt** ziehen beide um beide Kerne (eine halbe Runde versetzt: ist das eine hier, ist das andere drüben), **statisch** liegt das Paar zwischen den Kernen wie im Heft, und **Übertragung** zeigt dieselbe Verbindung als Ionenbindung: der unedlere Partner gibt seine Außenelektronen ganz ab, sie sitzen danach in *seiner* Farbe auf der Schale des anderen, dazu Pfeile mit der Zahl der Elektronen, die Ladungen am Ion und die Ionenschreibweise in Klammern. Die Bilanz bleibt dabei ehrlich: Bor gibt seine drei Elektronen ab und hat danach **zwei** — die Konfiguration des Heliums, ein volles Duett, kein Oktett; acht bekommt Bor nur, wenn ein fremdes Elektronenpaar dazukommt (BF₄⁻, F₃B–NH₃). Darunter dieselbe Verbindung als **Valenzstrichformel**, mit rotem Ausrufezeichen, wo das Oktett nicht aufgeht. 27 Vorlagen in drei Gruppen (Bor und Nachbarn, Elemente, Moleküle von HCl bis CS₂); Salze fehlen bewusst, die halten keine gemeinsamen Elektronenpaare. Alles in CSS animiert, anhaltbar und still bei »Bewegung reduzieren«. |
| ⬡ **Strukturformeln** | IUPAC-Namen eintippen, die Strukturformel entsteht beim Tippen: Alkane, Alkene und Alkine (auch mehrfach: Buta-1,3-dien), Ringe, Halogenalkane, Alkohole, Aldehyde, Ketone, Carbonsäuren, Ester und Amine, Reste als Vorsilben (2,3-Dimethylbutan) und Trivialnamen (Benzol, Essigsäure, Aceton, Glycerin). Vier Darstellungen: Kugel-Stab-Modell in 3D zum Drehen (Atome als Kugeln in CPK-Farben, Mehrfachbindungen als mehrere Stäbe, Bindungswinkel nach VSEPR gerechnet und gemessen angezeigt, PNG-Export; three.js, nur bei Bedarf geladen), Valenzstrichformel gerade (Schulform — Hauptkette waagerecht auf einer Linie, Abzweigungen senkrecht, alle Bindungen gerade, Atome auf einem Gitter, damit sich nichts überdeckt), Valenzstrichformel mit den echten 120°-Winkeln und Skelettformel. Dazu alle H-Atome, freie Elektronenpaare, drehen und spiegeln, SVG-Export; dazu Summenformel (Hill), molare Masse und Zahl der C-Atome — die H-Atome gerechnet aus der Bindigkeit, nicht gezählt. Vorbild: **[strukturformelzeichner.de](https://www.strukturformelzeichner.de)** (nur angesehen, eigener Code). |
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

### 🧭 KI-Kompass
- Gemeinsamer Rahmen für KI-Kompetenz, in den Lernende (Kl. 5–10) und Lehrkräfte zusammen hineinwachsen, ab Stufe 0 »Einstieg«
- Kompetenzraster nach Alles, Falck, Flick & Schulz (2025, CC BY-SA 4.0): Verstehen, Anwenden, Reflektieren, Mitgestalten × fünf Stufen als »Ich kann …«-Sätze; Spinne mit Messpunkten und Vorher/Nachher
- KI-Führerschein: 14 Stationen in vier Modulen mit Erklärung, Auftrag, Selbst-Check und Reflexion; KI-Teil über AIS.chat (Thüringer Schulportal) mit Leitfaden und Systemtext-Vorschlägen für Lehrkräfte
- Je Modul einmal 5 Hauspunkte, Urkunde als PDF, Portfolio mit KI-Nutzungserklärung als Word-Datei
- Klassenübersicht mit Klassen-Spinne und Reflexionen (nur für die Lehrkraft); Recherche und Quellen in docs/ki-kompass-recherche.md
- AKTIV(ER)-Weg für Lehrkräfte (nach Manuel Flick, eigene Texte): acht Schritte mit Checkliste, Word-Vorlagen und Sprung ins passende Werkzeug
- Material-Werkstatt: Prompt-Generator je Rasterfeld und Dimension (mit/über/durch/trotz/ohne KI), Aufgaben-Umbauer mit KI-Resilienz, Prüfungsformate und Erwartungshorizont mit Operatoren
- Sechs Projektkarten für Stufe II mit Ablauf, AIS.chat-Teil und Bewertung als Word-Projektblatt

### 🖍️ Markieren & Bearbeiten
- Anschluss an den Maus-Führerschein: Textbearbeitung in einem echten Textfeld, das sich wie Word verhält
- 15 Lektionen, je eine Technik: Doppel- und Dreifachklick, Ziehen, Umschalt + Klick, Pos1/Ende, Umschalt + Pos1/Ende, Strg + Pfeil, Strg + Umschalt + Pfeil, Umschalt + Pfeil, Strg + A, Löschen, Überschreiben, Strg + C/V, Strg + X, Strg + Z — gezählt wird nur mit der geübten Technik
- Challenge auf Zeit (Markier-Sprint, Bearbeiten, Profi-Mix) mit gewürfelten Aufgaben, Bestzeit im Browser und dem schnelleren Weg, wo jemand viele Aktionen brauchte
- Bestenliste je Modus (auch Gäste über den Code), eingrenzbar auf Sitzung und Klasse
- Quellen fürs Referat: wörtliches Zitat und Literaturangabe aus einem Buch (Titelseite, Impressum, Inhaltsseite) oder einer nachgebauten Webseite (Adresszeile, Kurzlink, Werbung, Cookie-Hinweis) herauskopieren — Vorlage mit Kurzbeleg und Literaturverzeichnis, Hinweise zu typischen Fehlgriffen
- Spickzettel mit allen Kürzeln

### 🪛 PC-Werkstatt
- Gaming-PC, 386er-PC (1990) und Raspberry Pi 5 zusammenbauen: Teile aus der Teilekiste an die leuchtende Stelle, Kabel an beide Anschlüsse (Netzteil, 24-Pin, EPS, PCIe, SATA, Front-Panel, P8/P9, Molex, Berg, IDE- und Disketten-Flachband, USB-C, Micro-HDMI …)
- Entscheidungen mit Folgen: CPU einsetzen, Wärmeleitpaste, Dual Channel, P8/P9 »Schwarz an Schwarz«, rote Ader an Pin 1, Laufwerk A: hinter der Verdrehung, SD-Karte per Imager
- Einschalten jederzeit: nichts, Piepcodes (auch hörbar, beim 386er nur mit Lautsprecher), BIOS-Meldungen, durchgebrannte Chips, Warnungen — oder Start mit Bootbildschirm; halbe SIMM-Bank beim 386er
- Realistische Ansicht und Schaltplan (Strom, Daten, Wärme), auch nebeneinander; Bauen geht in beiden
- Smartphone Schicht für Schicht zerlegen: Glasrückseite, Halte- und Abschirmblech, Akku mit Ladespule — darunter Chips, Graphitfolie und Flexkabel
- Erkennen mit Infokarten und Quiz für alle Geräte inklusive Smartphone; »Damals & heute« vergleicht Takt, Kerne, Speicher und Netzteil logarithmisch
- Tipp-Knopf, Fehlerzähler, Bestzeit im Browser

### 📱 Klikk
- Eine Schulwoche (Mo–Fr ab 14 Uhr) mit einer erfundenen Social-Media-App, daneben Hausaufgaben, Freunde und Schlaf — Zeit vergeht nur durch Handlungen
- Anmeldung mit gemessener AGB-Lesezeit, Altersangabe und Rechte-Abfragen (Kontakte, Mitteilungen, Standort, Mikrofon)
- Feed nach echter Verweildauer, der in Themen immer tiefer führt; jeder fünfte Beitrag ist gezielte Werbung
- Streaks, variable Likes, Abzeichen und Benachrichtigungen bis 23:40 — Gamification, die man selbst spürt
- Challenges, die mit dem Risiko an Reichweite gewinnen (bis #GleisSelfie), und Cybermobbing gegen Jonas im Klassenchat; unbeantwortet heißt geschwiegen
- Warnsignale, die nur sieht, wer bei Jonas nachschaut; Wetter-App, Spiel, Shop und Quiz teilen sich das Werbe-SDK »AdKit«
- Danach dieselbe Woche auf Jonas' Handy und der Datenspiegel: Werbe-Profil mit Belegen, Datenflüsse je App, echte Werbegründe, App- gegen Lebens-Punkte, Hilfsangebote — der Spielstand bleibt im Browser
- Feed mit echten Inhalten aus anderen Sims: Commons-Fotos (Weltall, Vulkane), PC-Teile aus der PC-Werkstatt, 3D-Clips mit den Avataren, Monstern und Elementar-Zaubern, dazu Memes, Nachrichten, »anonyme« Umfragen und versteckte Werbung
- Acht Challenges von harmlos bis lebensgefährlich, eigene Challenge-Videos (echt oder gefaked) mit Folgen, Nachrichten über schwere Unfälle bei Challenges; Werbung führt auf Shopseiten mit Dark Patterns, die sich am Ende selbst erklären
- Weitere Fäden: Gewinnspiel-Abofalle, Lea und das Körperbild, Cybergrooming durch »leon.16« mit Hilfe statt Schuld
- Freizeit neben dem Handy: fünf Kurzgeschichten zum Lesen (Krimi, Romance, Young Adult, Fantasy, Grusel), zwei Serien mit Autoplay, Familie (Abendessen, Hund, Oma, Spieleabend, Pizza backen), ein Verein mit festen Trainingszeiten und Freunde treffen — das Handy vibriert dazwischen, jeder Blick wird gezählt und manchmal bemerkt
- Krisenfälle mit Entscheidungen und Folgen: Mitmachen beim Mobbing führt zu Gespräch, Klassenkonferenz oder Polizei (ab 14 strafmündig), ein heimliches Umkleide-Foto weiterzuleiten kostet am Freitag das Handy, eine Freundschaft geht verloren, wenn man nicht redet; der Datenspiegel zeigt je Fall den eigenen Weg, die Rechtslage und eine Hilfe-Leiter von Freund·innen bis Polizei
- Handy-App »Klikk Games«: Klicker und Doppelklicker aus dem Maus-Führerschein (gleiche Bestenliste), Blockregen, Würfelsprung (Geometry-Dash-artig) und Lichtschalter (Logik) mit eigener Bestenliste; jede Runde kostet Spielzeit
- Klassen-Feed mit Code: alle sehen die Fotos und Challenge-Videos der anderen, liken und kommentieren aus einer festen Liste (kein Freitext, Namen nur generiert); ein gefährliches Video – auch ein gefaktes – macht Mo nach und landet im Krankenhaus
- Eigenes Profil mit Kommentaren (auch gemeinen) zum Beantworten, Löschen, Blockieren, Melden; Faktencheck (»Stimmt das?«) und Teilen bei jeder Nachricht
- Lehrkraft-Bereich: anonyme Klassenübersicht (ab drei), Meldung samt Galeriebild in den Klassen-Feed stellen (auch als Fake), Feed moderieren, druckbare Nachbesprechungskarten mit Fragen und Rollenspielen
- Vor der Woche: Elterntyp (locker, streng, besorgt, arbeiten viel), eigenes Handy-Limit oder Sperrzeit, 3D-Avatar, Verein mit eigenem Trainingsplan; Familie bittet um Hilfe (Einkaufen, Oma, Mila …) – Nein sagen geht, bis die Geduld vorbei ist
- Einstellungen-App: Mitteilungen je App, Fokus-Modus, App-Tracking verbieten, Werbe-ID zurücksetzen, Berechtigungen, Bildschirmzeit je Tag samt Wochenbericht; Sperrbildschirm bei Limit
- Perspektivwechsel: dieselbe Woche als Jonas oder Emma, mit Gedanken und Gefühlen; jemandem davon zu erzählen braucht Überwindung – der Scham-Regler springt bis zu 20-mal zurück, manchmal kurz vor dem Ziel, mit den Gedanken, die Betroffene wirklich haben
- KI-Fake von Lea, Werbedeal einer Marke (bezahlt wird nie), »5 Jahre später« (die Personalabteilung googelt dich), Influencer-Chance (winzig), Bonus-Samstag, Töne, gute Erfolge und »Schattenseiten« (auch auf /erfolge)
- Morgen ab dem eigenen Wecker: Duschen, Zähne, Deo, frische Sachen, Frühstück – oder im Bett scrollen und den Bus um 7:35 verpassen; Hygiene-Anzeige, die täglich sinkt und auffällt
- Tim riecht, und die Klasse macht einen Sticker daraus: mitlästern zählt als Mobbing, nachfragen zeigt den Grund (Waschmaschine kaputt, Mama im Krankenhaus); im Klassen-Feed zeigt ein 💨 niedrige Hygiene, und nur dort gibt es den Kommentar »Riecht man bis hier 🤢« – mit Folgen für wer ihn nutzt
- Handy-App »Elemon«: Monster sammeln und im Käfig fangen (51 Arten aus Tier-Avataren und Monstern, 18 Elemente mit Typentabelle), Trainer, Arenen und Orden in vier Gebieten, Kampf in 3D mit den Elementar-Angriffen; Energie, Werbevideos, Countdown-Angebote, gestaffelte »Extra-Nutzung« (gesperrte In-App-Käufe) und die Standort-Abfrage landen als AdKit-Spuren im Datenspiegel; Duelle gegen Mitschüler·innen derselben Sitzung (der Server reicht nur verdeckte Züge weiter, beide Handys rechnen mit demselben Startwert); Extra-Zeit gibt es auch von den Eltern – je nach Hausaufgaben, Mithilfe, Handyzeit und Elterntyp; Hausaufgaben werden von Tag zu Tag schwerer und enden mit einer Seite zum Lesen (Geschichtsbuch, Goethes »Zauberlehrling«, Fontanes »John Maynard«, eine Kurzgeschichte) samt Verständnisfrage (sechs Antworten; falsch sperrt die Simulation 10 Sekunden, der Text bleibt lesbar), damit niemand für Punkte und Extra-Zeit nur durchklickt; aktuelle Memes (6-7, Italian Brainrot, Aura, Chill Guy, Mewing, Skibidi, Rizz, Labubu-Blindbox, Delulu) mit Top-Kommentaren, ihre Sprüche auch als feste Kommentare und Teilen-Sprüche; wer wegen Eltern-Sperre oder Nein nicht mitspielen kann, liest danach Spott im Klassenchat, und der Klassen-Feed hat feste Kommentare dazu (»Nie erreichbar 🙄« bis »Kein Stress, wir spielen morgen 🤝«); Spiele-Apps machen dort weiter, wo man sie verlassen hat; Mitteilungen blenden nach 2 Sekunden aus
- Spielergebnisse, Candy Blast und das Typ-Quiz (Ergebnis passend zu den Antworten) lassen sich in Klikk teilen – mit Teilen-Symbol und einem Spruch aus einer festen Liste (von »Yeah! 🎉« bis »Owned, ihr Noobs 🎮😎«); Meldungen der Lehrkraft auch mit eigenem Bild
- Klassenmodus: die Lehrkraft startet eine gemeinsame Klassen-Uhr (ein Tag von 6 bis 24 Uhr in 4–10 echten Minuten, Pause/Weiter/Stopp); Handlungen kosten dann keine Spielzeit mehr, Schule (8–14 Uhr) sperrt das Handy, Aktivitäten dauern echte Zeit, alle schlafen und wachen gleichzeitig – der Druck, jetzt nachzusehen, wird echt
- Werbeauktion live: die Klasse gibt ihre Profile nach Zustimmung anonym ab und ersteigert sie als Werbefirmen (100 Taler, verdeckte Gebote); die Lehrkraft leitet am Beamer und bespricht, welche Merkmale den Preis treiben

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
- Je Phase bis zu 5 Methoden aus dem Methoden-Kompendium verknüpfen (Verweis öffnet die Methode)
- Export als Dokument (PDF, Word, LaTeX) mit Inhaltsverzeichnis, Verlaufstabelle, Phasen im Detail samt Kompendium-Methoden und nummerierten Quellen; verknüpfte Caputh-, TaskCrawler- und Challenge-Inhalte erscheinen mit Aufgaben, Lösungen und ihrer Differenzierung (DDA-Stufen und Fuzzy-Regeln). Läuft über pandoc und LibreOffice (`api/stundenplan_export.py`)

### 📚 Methoden-Kompendium
- Nachschlagewerk mit Methoden aus Didaktik, Pädagogik und Psychologie für Einstieg, Hauptteil und Abschluss, für Einzel- und Gruppensettings mit Kindern, Jugendlichen und Erwachsenen
- Je Methode Ablauf, Varianten, Stolpersteine, Evidenzstufe, nötige Qualifikation und Quellen (DOIs geprüft); dazu Grundlagenkapitel, Grafiken und ein Mythen-Check
- Persönliche Markierungen je Methode (Favorit, Einarbeiten, Brauch ich nicht) mit eigenem Filter; gespeichert im Konto
- Download als eigenständige HTML-Datei (offline lesbar, mit Suche, Filtern und Grafiken)
- Inhalte liegen als YAML in `data/methoden_kompendium/`; `python build.py`, `python svgs.py` und `python standalone.py` dort erzeugen JSON, Grafiken und die Offline-HTML in `frontend/public/kompendium/`

### 🧭 Curriculinator
- Schulinternes Curriculum gegen alten und neuen Lehrplan, dreispaltig je Klassenblock: alte Lehrplan-Karten | eigene Themen (G/R/H/LB/GE, Wochen) | neue Karten
- Abgleich alt ↔ neu je Karte (identisch, geändert mit Wort-Diff, verschoben, neu, entfällt), getrennt für Real- und Hauptschulniveau; Konflikte am Thema, offene neue Inhalte je Block, Wochensumme gegen verfügbare Wochen
- Themen per Ziehen zwischen Klassen verschieben, Karten zuordnen, fehlende Niveaus ergänzen; ein gemeinsamer Stand je Fachschaft (Änderungen per Operation, `api/curriculum_ops.py`), Gastbeitritt per QR
- Export der Endfassung als DOCX und PDF (A4 quer, alle Klassen oder eine) und als SVG je Klasse (`api/curriculum_export.py`; das DOCX wird direkt geschrieben, weil pandoc keine Zellfarben kann, das PDF macht LibreOffice daraus)
- KI-Prompt für Lehrplanvergleich und Zuordnung; Vorlagen als JSON (`tt-curriculum/1`, Aufbau in `data/curriculum/SCHEMA.md`). Startvorlagen in `frontend/public/curriculum/`: Thüringer Mathe-Lehrpläne (RS 2011, GY 2018 → Erprobungsfassungen 2026, mit Abgleich) Physik (RS + GY 2026, Kl. 7–10) und Medienbildung und Informatik (RS + GY 2026, Kl. 5–10), beide ohne alten Plan und mit leeren Unterrichtseinheiten je Lernbereich. Der KI-Prompt erfasst eine oder beide Schularten in einem JSON, mit oder ohne alten Plan

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
| **Schülerdaten** | CSV-Import mit Vorschau und Diff · Änderungen bestätigen · Zugänge generieren · Export · Klassen rücken zum 1. August von selbst weiter (7a → 8a), auch vor dem nächsten Import |
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
- **Audit-Log** für sicherheitsrelevante Zugriffe; es übersteht den Schuljahreswechsel und wird zehn Schuljahre aufbewahrt.
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

### Workshop-Instanz (online)

Für Online-Workshops startet `workshop.bat` (ruft `workshop.ps1` ohne Änderung der Ausführungsrichtlinie auf) eine zweite, getrennte Instanz und macht sie über einen [Cloudflare-Quick-Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) aus dem Internet erreichbar, ohne Konto und ohne Portfreigabe (`winget install Cloudflare.cloudflared`).

```bat
workshop.bat start -Anzahl 30   :: Instanz auf Port 1340, Tunnel, Zugänge ws01–ws30 + moderation
workshop.bat stop               :: Tunnel zu, Instanz angehalten, Daten bleiben
workshop.bat reset              :: alles löschen
```

- Eigene Datenbank, eigener Port, eigener `SECRET_KEY`; die Schulinstanz läuft unberührt weiter.
- `data/` wird nur mit den versionierten Dateien nach `.workshop/data` kopiert, nicht versionierte Schuldaten kommen nicht mit.
- Beispiele (Zeitstrahlen, Challenge, TaskCrawler) werden einmal hochgeladen, dazu 360 erfundene Schülerinnen und Schüler in 5a–10c aus `data/workshop/schueler.csv`. Zugangsliste und QR-Code liegen in `.workshop/data/`.
- Die Adresse ist bei jedem Start neu und landet in der Zwischenablage. Die Moderation öffnet TT über diese Adresse, dann zeigen alle Beitritts-QRs auf den Tunnel.
- Nicht für den Produktivbetrieb: Der Tunnel lebt nur, solange der Rechner läuft.

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

---

## Lizenz

- **Code:** [Apache License 2.0](LICENSE). Nutzen, ändern und erweitern ist erlaubt, auch kommerziell, und eigene Erweiterungen (etwa neue Simulationen) dürfen privat bleiben. Wer TT weitergibt oder darauf aufbaut, behält die Datei [NOTICE](NOTICE) bei und nennt damit das Original-Repository.
- **Eigene Inhalte** (Texte, Aufgaben, Vorlagen und Datensätze unter `data/` und `docs/`, eigene Bilder): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) mit Namensnennung »TT - Teaching Tools, github.com/DonMischo/TeachingTools«.
- **Fremdes Material** (Fotos, Schriften, Kartendaten, 3D-Modelle, Datensätze, portierter Code, Bibliotheken) steht unter der Lizenz aus seinem Nachweis, nicht unter den beiden oben. Alle Nachweise sammelt die Admin-Seite **Quellen** (`/admin/quellen`); welche Dateien dahinter stehen, listet [NOTICE](NOTICE).
