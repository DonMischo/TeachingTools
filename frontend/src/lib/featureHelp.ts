// Kurze Hilfetexte je Feature, angezeigt über das (?)-Symbol auf den Karten.
// Keyed by card slug (siehe games/tools/sportundspiele-Seiten).

export type HelpSection = { label: string; text: string };
export type FeatureHelp = { title: string; intro: string; sections: HelpSection[] };

export const FEATURE_HELP: Record<string, FeatureHelp> = {
  caputh: {
    title: "Caputh",
    intro: "Quiz-System mit mehreren Modi (Klassisch, TÜ, Test, Wettbewerb). Schüler treten live über einen Code bei.",
    sections: [
      { label: "▶️ Starten", text: "Quiz aus der Caputh-Bibliothek wählen, Session für eine Klasse erstellen — es entsteht ein Beitritts-Code und der Host-Screen öffnet sich. Teammodus ist optional." },
      { label: "👥 Beitreten", text: "Schüler öffnen die Beitritts-Seite und geben den Code ein." },
      { label: "⬆️ Hochladen", text: "Eigene Quizze über »+ Hochladen« als .json oder .zip importieren." },
      { label: "📄 Vorlage", text: "»Vorlage« lädt eine leere caputh_vorlage.json herunter — ausfüllen und wieder hochladen." },
    ],
  },
  bingo: {
    title: "Bingo",
    intro: "Bingo mit Caller/Antwort-Paaren. Jeder Schüler erhält eine individuelle Karte.",
    sections: [
      { label: "▶️ Starten", text: "Runde unter »Neu« anlegen (Rastergröße + Caller/Antwort-Paare) und in einem Schritt hosten — Code + Host-Screen." },
      { label: "👥 Beitreten", text: "Schüler treten über den Code bei und bekommen ihre eigene Karte." },
      { label: "⬆️ Hochladen", text: "Fertige Runden über »JSON importieren« laden." },
      { label: "📄 Vorlage", text: "»Vorlage« lädt eine leere bingo_vorlage.json zum Ausfüllen herunter." },
      { label: "🤖 KI-Nutzung", text: "»Mit KI erstellen« zeigt einen fertigen Prompt. Diesen in ChatGPT/Claude einfügen, das erzeugte JSON zurückkopieren und importieren. (Keine KI direkt in der App.)" },
    ],
  },
  exitgame: {
    title: "Exitgame",
    intro: "Selbstständiges Exit-Game: Schüler lösen Aufgaben im eigenen Tempo, du siehst den Fortschritt live.",
    sections: [
      { label: "▶️ Starten", text: "Ein Exitgame hochladen und freigeben — Schüler spielen es über einen Code selbstständig." },
      { label: "👥 Beitreten", text: "Schüler starten das Spiel über den Code." },
      { label: "⬆️ Hochladen", text: "»+ Exitgame hochladen« akzeptiert .json oder .zip." },
      { label: "📄 Vorlage", text: "»Vorlage« lädt exitgame-vorlage.json herunter — ein Beispielspiel, das jeden Baustein des Formats genau einmal zeigt, plus KI-Anleitung." },
      { label: "🔑 Türcodes", text: "Aufgaben können Codeschnipsel vergeben; an der Tür setzen die Schüler sie zusammen. Wer eine Aufgabe überspringt, dem fehlt dort ein Schnipsel — die Tür verlinkt zurück." },
      { label: "🤖 KI-Nutzung", text: "Im Generatoren-Panel »In AI-Prompt kopieren« nutzen, den Text einer externen KI geben und das Ergebnis als Aufgaben einbauen. (Keine KI direkt in der App.)" },
    ],
  },
  lueckentext: {
    title: "Lückentext",
    intro: "Lückentexte mit Wortbank, Freitext und Multiple Choice — mit Live-Rangliste.",
    sections: [
      { label: "▶️ Starten", text: "Aus der Bibliothek eine Live-Runde hosten (Code). Auch als Einzelübung, PDF-Export oder eingebettet in Caputh & Exitgame nutzbar." },
      { label: "👥 Beitreten", text: "Schüler spielen bzw. korrigieren über den Code." },
      { label: "⬆️ Hochladen", text: "»+ Lückentext hochladen« importiert eine .json-Datei." },
      { label: "📄 Vorlage", text: "»Vorlage« lädt eine leere lueckentext-vorlage.json herunter. Zusätzlich: PDF-Export (leer oder gefüllt)." },
    ],
  },
  zeitstrahl: {
    title: "Zeitstrahl",
    intro: "Zeitleisten mit parallelen Spuren und Zahlenstrahlen — anzeigen, einsortieren, Fehler finden.",
    sections: [
      { label: "▶️ Nutzung", text: "Zeitleisten und Zahlenstrahlen aus der Bibliothek anzeigen und üben. Auch einbettbar in Caputh & Exitgame." },
      { label: "⬆️ Hochladen", text: "»+ Zeitstrahl hochladen« importiert eine .json-Datei." },
      { label: "📄 Vorlage & Beispiele", text: "»Vorlage« lädt eine leere Datei zum Ausfüllen. »🌍 Beispiele laden« importiert fertige Beispiel-Zeitleisten zum sofortigen Einsatz." },
    ],
  },
  tippen: {
    title: "Tippen",
    intro: "Zehnfingersystem üben — die Bildschirmtastatur zeigt, welcher Finger welche Taste nimmt. Vier Modi, ein Werkzeug.",
    sections: [
      { label: "📚 Lektionen", text: "Lektion wählen, in das Textfeld klicken und lostippen. Die nächste Taste leuchtet auf, bei Großbuchstaben zusätzlich die Umschalttaste der anderen Hand. Die Farben zeigen den zuständigen Finger; die kleinen Striche auf F und J sind die Grundstellung. Neun Stufen: von der Grundstellung über die obere und untere Reihe zu großen Buchstaben, Satzzeichen und Zahlen." },
      { label: "⛔ Fehlersperre", text: "Ein falscher Anschlag zählt als Fehler, rückt aber nicht vor — die richtige Taste muss kommen. So prägt sich nichts Falsches ein. Eine Rücktaste gibt es deshalb nicht. Hochgeladene Texte dürfen die Sperre abschalten." },
      { label: "🌧️ Wortregen", text: "Wörter fallen von oben und müssen fertig getippt werden, bevor sie unten ankommen — drei dürfen durch. Es regnen nur Buchstaben, die bis zur gewählten Lektion dran waren." },
      { label: "🎯 Tastenjagd", text: "Eine Taste, so schnell wie möglich. Gemessen wird die Reaktionszeit je Taste; am Ende stehen die zähesten." },
      { label: "🏁 Wettschreiben", text: "Das Klassenrennen: Text wählen, »Rennen anlegen«, Code oder QR zeigen, starten. Alle tippen denselben Text, die Balken laufen nebeneinander, im Ziel steht die Zeit in Anschlägen pro Minute. Nur für Lehrkräfte sichtbar." },
      { label: "⬆️ Eigene Texte", text: "»Hochladen« nimmt eine JSON-Datei mit eigenen Texten an — Diktate oder Fachbegriffe statt Übungssätzen. »Vorlage« lädt eine ausgefüllte Beispieldatei samt Anleitung. Eine Wortliste in der Datei versorgt auch den Wortregen. Tottasten (^ ´ `) werden abgelehnt: sie lassen sich nicht einzeln tippen." },
      { label: "📊 Werte", text: "Anschläge pro Minute (die im Schreibunterricht übliche Größe, gezählt werden die richtigen) und die Fehlerquote über alle Anschläge. Am Ende stehen die schwächsten Tasten." },
      { label: "🏆 Bestenliste", text: "Die besten hundert je Modus — Anschläge/Minute bei den Lektionen, Punkte beim Wortregen, Reaktionszeit bei der Tastenjagd (dort gewinnt die kleinste Zahl). Je Person zählt nur die beste Runde. Eingetragen wird automatisch am Ende einer Runde und nur mit eigenem Zugang — Gäste über den QR spielen mit, stehen aber nicht in der Liste." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten). Das Wettschreiben hat seinen eigenen Code je Rennen." },
    ],
  },
  maus: {
    title: "Maus-Führerschein",
    intro: "Grundkurs am Computer für Kinder ab etwa zehn Jahren — Teil 1 (Maus) und Teil 2 (Tastatur, Dateien, Fenster), jede Stufe mit »Vorführen«, »Weiter« und 🔊 Vorlesen.",
    sections: [
      { label: "⭐ Sterne & Fortschritt", text: "Jede geschaffte Stufe bekommt 1–3 Sterne. Der Stand bleibt beim Neuladen erhalten — je Konto bzw. je Gast, damit am selben Rechner jedes Kind seinen eigenen hat." },
      { label: "🤝 Hilfsmodus", text: "Schalter oben rechts: größere Ziele, mehr Zeit, breitere Wege. Für Kinder, die mit der Maus noch langsam sind. Runden im Hilfsmodus stehen mit 🤝 in der Bestenliste." },
      { label: "🎓 Prüfung", text: "Je Teil ein Durchgang am Stück, ohne Vorführung. Bestanden ist, wer keine Stufe überspringt. Schülerkonten bekommen beim ersten Bestehen je Teil einmalig 5 Hauspunkte für ihre Klasse; das Blatt bekommt einen Stempel." },
      { label: "👩‍🏫 Klassenübersicht", text: "Auf der Werkzeugseite: alle, die über deinen Code mitmachen, mit Sternen je Stufe und bestandenen Prüfungen. Aktualisiert sich alle fünf Sekunden." },
      { label: "🖱️ Teil 2", text: "Scrollen (Mausrad, Scrollleiste, Umschalt + Rad), Tastatur (Umschalt, Rücktaste, Entf, Pfeile, Pos1/Ende, Strg + Z, Strg + X), Dateien ordnen in einem nachgebauten Explorer (Ordner anlegen, F2, Strg-/Umschalt-Klick, verschieben), Fenster (maximieren, minimieren, verschieben, Größe, Alt + Tab, schließen) und Bildschirmfoto (⊞ + Umschalt + S, einfügen, speichern)." },
      { label: "▶ Vorführen", text: "Ein Mauszeiger macht die Aufgabe langsam vor (etwa drei Sekunden je Schritt). Daneben leuchtet an einer Maus die richtige Taste; bei Tastenkürzeln erscheint die Tastatur aus der Schreibübung mit den gedrückten Tasten." },
      { label: "👆 1 Klicken", text: "Oben steht ein Tier, darunter ein Raster aus Tieren. Anfangs 3×3 große Felder; wer schnell und sicher trifft (fünf Versuche, höchstens ein Fehlgriff, Median unter 60 % der Zeitgrenze), bekommt kleinere Felder bis 6×5. Zwei Fehlgriffe machen es wieder leichter. Anfangs 6 s je Tier, mit jedem Treffer etwas weniger (bis 2 s); schnelle Klicks bringen deutlich mehr Punkte. 20 Treffer." },
      { label: "✌️ 2 Doppelklick", text: "Das Raster bleibt 6×5, das Ziel blinkt. Anfangs 7 s je Tier, mit jedem Treffer etwas weniger (bis 2,5 s). Misslingt ein Doppelklick, steht dort warum: zu langsam oder die Maus hat gewackelt. 15 Treffer." },
      { label: "📋 3 Rechtsklick", text: "Rechtsklick auf ein Tier öffnet ein Menü wie unter Windows 11; nur »Als mein Tier wählen« geht, der Rest ist ausgegraut. Das Tier begleitet durch die übrigen Stufen." },
      { label: "✋ 4 Ziehen", text: "Spur: das eigene Tier mit gedrückter Taste einen Weg entlangziehen (Gerade, Hügel, Zickzack, Schleifen) — wer abkommt, setzt an der letzten Fahne neu an. Aufräumen: Tiere nach Lebensraum sortieren, dann Dateien in Ordner und den Papierkorb ziehen." },
      { label: "🖍️ 5 Markieren", text: "Ein Wort (Doppelklick oder ziehen), ein Absatz (Dreifachklick oder ziehen), der ganze Text (Strg + A oder ziehen)." },
      { label: "📄 6 Kopieren", text: "Wörter, Sätze und einen Absatz kopieren und in den Merkzettel einfügen — mit Strg + C / Strg + V oder über das Rechtsklick-Menü. Abtippen zählt nicht. Der »Zwischenspeicher« zeigt, was gerade kopiert ist — beim Einfügen auch, was außerhalb der Seite kopiert wurde." },
      { label: "💾 7 Speichern", text: "Der Führerschein ist ein Bild: Rechtsklick → »Bild speichern unter …« (Firefox: »Grafik speichern unter …«). Danach im Explorer (Windows + E) wiederfinden und zurück auf die Seite ziehen. Geprüft wird nur im Browser — die Datei wird nicht hochgeladen." },
      { label: "🏆 Bestenliste", text: "Listen für Klicken, Doppelklick, Ziehen und Gesamt; je Person zählt die beste Runde. Gäste über den QR stehen mit ihrem eingegebenen Namen darin — Admins können einzelne Einträge löschen." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten)." },
    ],
  },
  abacus: {
    title: "Abakus",
    intro: "Rechenrahmen zum Schieben — für Zahlverständnis und Stellenwerte.",
    sections: [
      { label: "🎯 Nutzung", text: "Kugeln mit dem Finger/der Maus schieben und den Wert in Ziffern ablesen." },
      { label: "🔀 Modus", text: "»Alle gleich« zählt alle Kugeln bis 100; »Stellenwert« gibt jeder Reihe einen Stellenwert (Einer, Zehner, …)." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten)." },
    ],
  },
  bildformate: {
    title: "Bildformate (PBM · PGM · PPM)",
    intro: "Die Netpbm-Textformate zum Anfassen: eine Bilddatei besteht nur aus Zahlen — links tippen, rechts das Bild.",
    sections: [
      { label: "🎨 Formate", text: "PBM (P1) schwarz-weiß mit 0 und 1, PGM (P2) Graustufen bis zum Maximalwert, PPM (P3) Farbe mit drei Werten (Rot Grün Blau) je Pixel. Jedes Format hat sein eigenes Blatt — Umschalten löscht nichts." },
      { label: "✏️ Bearbeiten", text: "Im Text tippen aktualisiert das Bild sofort; ein Klick ins Bild schreibt den Wert zurück in den Text. Der Cursor im Text markiert das passende Pixel rot." },
      { label: "↹ Aufräumen", text: "Zeilenumbrüche sind egal — die Werte werden der Reihe nach gelesen. »Aufräumen« bricht sie nach je »Breite« Werten um und füllt fehlende Werte mit 0 auf." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten)." },
    ],
  },
  funktionen: {
    title: "Funktionen",
    intro: "Ein Funktionsterm, seine Wertetabelle und sein Graph — und der Rechenweg dazwischen. Gedacht für den Einstieg in Funktionen: sichtbar machen, dass die Tabelle nichts anderes ist als eingesetztes x.",
    sections: [
      { label: "🔤 Formelsatz", text: "Getippt wird flacher Text (»x^2«, »1/x«, »sqrt(x)«), gesetzt erscheint die Formel wie im Heft: Potenzen hochgestellt, Brüche gestapelt, sin/cos/ln als Operatoren, π als Zeichen. Das gilt für die Formel über dem Eingabefeld, für die Spalten »Rechnung« und »Punkt« der Wertetabelle und für den Rechenweg hinter dem »?«. Das x und die eingesetzten Zahlen bleiben dabei farbig." },
      { label: "✏️ Term", text: "»f(x) =« davor darf stehen, muss aber nicht. Erlaubt sind Zahlen (Komma oder Punkt), x, Klammern, + − · / ^ sowie sin, cos, tan, sqrt, abs, ln, log, exp und π. Das Malzeichen darf fehlen: »2x«, »2(x+1)«, »3sin(x)«. Die Vorlagen reichen von der Ursprungsgeraden bis zur gedämpften Welle." },
      { label: "📍 Punkte", text: "Die Zeile »Punkt« schreibt jedes Wertepaar als P(x/y) — dieselbe Schreibweise wie am Graphen, damit Tabelle und Koordinatensystem als dasselbe erkennbar sind. Wo die Funktion nicht definiert ist, steht »—«: dort gibt es keinen Punkt." },
      { label: "⤢ Normalform und Scheitelpunktform", text: "Ist der Term quadratisch, erscheinen zwei Knöpfe: »Normalform« schreibt ihn als ax² + bx + c, »Scheitelpunktform« als a(x − d)² + e; daneben steht der Scheitelpunkt. Beide beschreiben dieselbe Parabel — der Graph ändert sich beim Umschalten nicht, nur die Schreibweise. Das greift auch bei selbst getippten Termen wie »x(x+1)«, nicht nur bei der Vorlage; bei allem anderen bleiben die Knöpfe weg." },
      { label: "🧮 Rechnung in der Tabelle", text: "Die Spalte »Rechnung« zeigt den Term mit eingesetztem x — bei f(x) = 2x + 3 und x = 5 also »2 · 5 + 3«. Die eingesetzte Zahl hat dieselbe Farbe wie die x-Spalte: es ist überall dasselbe x. Ausgerechnet wird dort nichts; den Weg bis zum Ergebnis zeigt weiterhin das »?«." },
      { label: "🔗 Tabelle und Graph", text: "Die Wertetabelle steht quer über dem Diagramm: eine Zeile je Größe (x, f(x), Rechnung), eine Spalte je Stelle. Bei vielen Stellen wird sie waagerecht gescrollt, die Beschriftung links bleibt stehen. Über eine Spalte fahren hebt den Punkt im Koordinatensystem hervor und zeigt seine Koordinaten; über den Graphen fahren zeigt umgekehrt das Wertepaar an der Stelle. Die Punkte der Tabelle sind im Graphen als Kreise eingezeichnet — sie sind die Brücke zwischen beiden Darstellungen." },
      { label: "❓ Rechenweg", text: "Das »?« in der Tabelle (oder ein Klick auf einen Punkt) öffnet den Rechenweg: erst die Formel mit violettem x, dann dasselbe mit dem eingesetzten Wert in Orange, dann Schritt für Schritt von innen nach außen bis zur Zahl, die in der Tabelle steht. Das ist die Antwort auf »woher kommt der Wert?«." },
      { label: "🔁 Vorlagen würfeln", text: "Jeder weitere Klick auf dieselbe Vorlage würfelt neue Zahlen: bei »Linear« neue m und n, bei »Parabel« neuer Scheitelpunkt, bei »Sinus« neue Amplitude und Streckung. Der Bereich passt sich dabei selbst an — die Parabel wird um ihren Scheitelpunkt gelegt, Sinus und Kosinus zeigen genau eine volle Periode." },
      { label: "π Winkelfunktionen", text: "Bei sin, cos und tan schaltet sich »in π rechnen« ein: von/bis/Schritt zählen dann in Vielfachen von π, und Tabelle wie x-Achse sind mit π/2, 3π/4 usw. beschriftet statt mit 1,571. Der Schalter lässt sich auch von Hand setzen." },
      { label: "✋ Verschieben", text: "Die Zeichenfläche lässt sich mit gedrückter Maus (oder dem Finger) verschieben — der Graph folgt der Bewegung. Ein Klick ohne Bewegung öffnet weiter den Rechenweg eines Punktes; erst wer wirklich zieht, verschiebt. »Passend« holt den automatischen Ausschnitt zurück." },
      { label: "🔍 Ansicht", text: "»＋« und »−« zoomen den Ausschnitt, das Mausrad über dem Bild ebenso. Daneben lassen sich x- und y-Achse getrennt dehnen und stauchen — nützlich, wenn eine Kurve flach liegt oder oben aus dem Bild läuft. »Passend« stellt die automatische Einpassung wieder her; sie greift auch von selbst, sobald ein neuer Term oder Bereich eingestellt wird." },
      { label: "▦ Raster", text: "Ungestreckt ist das Raster quadratisch — ein Schritt nach rechts ist so lang wie einer nach oben, wie auf Karopapier. Sobald eine Achse einzeln gedehnt wird, gilt das absichtlich nicht mehr; »Passend« stellt die Quadrate wieder her. Winkelfunktionen sind ausgenommen: dort ist ein x-Schritt ein Bruchteil von π und mit einem y-Schritt nicht vergleichbar. Die Achsen sind in Einer-Schritten geteilt, solange das lesbar bleibt — so lassen sich Kästchen zählen. Wird der Ausschnitt sehr weit, weicht die Teilung auf 2, 5, 10 … aus. Winkelfunktionen behalten auf der x-Achse ihre π-Teilung." },
      { label: "📐 Bereich", text: "»von«, »bis« und »Schritt« bestimmen die Wertetabelle; der Graph nimmt den gleichen Bereich mit etwas Luft und skaliert die y-Achse selbst. Halbe Schritte gehen auch. Wo eine Funktion nicht definiert ist (1/x bei 0, sqrt für negative x), steht in der Tabelle »—« und der Graph hat eine Lücke statt einer falschen Verbindungslinie." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten)." },
    ],
  },
  rechenregeln: {
    title: "Rechenregeln",
    intro: "Die Rechenregeln der Klassen 5/6 als Bild: Klammern vor Punkt vor Strich am Obstkorb, das Vertauschen am Rechenzug, die Stufenzahlen auf der Stellenwerttafel. Drei Reiter, jeder mit vier Würfelstufen und einem Feld für eigene Terme.",
    sections: [
      { label: "🍎 Obstkorb", text: "Ein Malpunkt ist ein Korb: »3 · 4« steht als drei Körbe mit je vier Früchten da, »12 : 3« als drei Teller, ein Minus als Früchte, die blass werden. Zusammenzählen lässt sich erst, was auf dem Tisch liegt — deshalb Punkt vor Strich. Eine Klammer wird als violette Kiste um ihren Teilterm gezeichnet." },
      { label: "👆 Ein Schritt nach dem anderen", text: "Der Term rechnet sich nicht von selbst aus. Die Rechnung, die als Nächstes dran ist, pulsiert — antippen führt genau sie aus, und die Termzeile schreibt sich neu. Wer eine andere antippt, bekommt den Grund gesagt (»Klammer zuerst«, »Punkt vor Strich«) statt einer Fehlermeldung. »▶︎ Schritt« macht den Zug fürs Smartboard, »↶ zurück« nimmt ihn wieder weg. Am Ende steht daneben, was bei stur von links nach rechts herausgekommen wäre." },
      { label: "🚂 Rechenzug", text: "Derselbe Term als Zug: · und : kuppeln zwei Waggons fest zusammen, + und − lose. Zwei Waggons antippen tauscht sie; auf ein Blockdach tippen zieht den ganzen Block um (nur zu Nachbarn). Darunter stehen Start- und jetziger Wert nebeneinander: bei + und · bleibt das Ergebnis grün stehen, bei − und : wird es rot — 8 − 3 ist eben nicht 3 − 8." },
      { label: "🎚️ Stufenzahlen", text: "»Mal 10« ist kein Anhängen einer Null, sondern ein Rutschen: 3 · 40 wird zu 3 · 4 und einer wartenden Null, das kleine Einmaleins rechnet 12, dann rutscht die 12 eine Stelle nach links. Die Nullen hängen dabei immer an der zweiten Zahl — an ihr liest man ab, wie weit gerutscht wird. Bei · 10 bis · 10 000 gibt es gar nichts auszurechnen: dort darf die erste Zahl mehrstellig sein und rutscht als Ganzes. Die Stellenwerttafel zeigt beide Zahlen übereinander, die neu gefüllten Stellen farbig." },
      { label: "➗ Geteilt und mit Komma", text: "Der Umschalter »· mal / : geteilt« dreht die Rutsche um: aus 3600 : 40 wird 36 : 4 = 9 und eine Stelle nach links, aus 45 : 100 wird ein Rutschen um zwei Stellen nach rechts — 0,45. Die Tafel bekommt dafür Zehntel, Hundertstel und Tausendstel samt Komma. Kommazahlen darf man auch selbst eintippen (0,3 · 400), die Sorte »Komma« würfelt sie. Eine Division, die nicht aufgeht, wird abgelehnt statt gerundet." },
      { label: "✍️ Selbst rechnen", text: "Beim Obstkorb und bei den Stufenzahlen steht ein Feld für das eigene Ergebnis. Bei den Stufenzahlen liegt der Rechenweg so lange verdeckt — »Lösung zeigen« deckt ihn auf, ohne zu zählen. Eine falsche Antwort verrät die Lösung nicht: nachgerechnet wird am Bild. Oben zählt der Punktestand mit, wie viele Antworten saßen, samt Serie; gezählt wird je Aufgabe nur der erste Versuch, und »↺ Zähler« stellt ihn zurück." },
      { label: "🎲 Aufgaben", text: "»Neue Aufgabe« würfelt — nie zweimal dieselbe. Daneben stehen die Sorten: beim Obstkorb vier Stufen von »a + b · c« bis zu zwei Klammern, beim Zug von »nur + und ·« bis gemischt, bei den Stufenzahlen »Frei« (Zehner-, Hunderter-, Tausenderzahlen wie 40, 500, 2000), »Komma« sowie die festen Stufen 10 bis 10 000. Ein Klick auf eine Sorte würfelt gleich mit. Das Feld daneben nimmt jeden eigenen Term (Zahlen, + − · : und Klammern; der Zug fährt ohne Klammern)." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten)." },
    ],
  },
  ki: {
    title: "KI-Werkstatt",
    intro: "Zwei Reiter, eine Aussage: Sprachmodelle würfeln Wörter, Bildmodelle holen Bilder aus Rauschen. Beide Hälften teilen sich einen Beitritts-Code — und den Zufallswert dazwischen.",
    sections: [
      { label: "1️⃣ Auftrag", text: "Ein Prompt steht bereit (»Schreibe einen kurzen Text über eine Katze.«). Er wird nie als Text gelesen, sondern erst zerlegt und in Zahlen verwandelt." },
      { label: "2️⃣ Zerlegen", text: "Minispiel: zwischen die Buchstaben tippen, wo die Maschine schneidet, dann »Prüfen«. Der Vergleich zeigt die Regel — häufige Wörter bleiben ganz (»␣Katze«), seltenere zerfallen in Stamm und Endung (»␣kurz«+»en«), und das Leerzeichen gehört zum Wort dahinter. Am Ende steht nur noch eine Reihe von Nummern." },
      { label: "3️⃣ Netz und Wählen", text: "In der Mitte das zuletzt geschriebene Wort, ringsherum die möglichen Fortsetzungen mit ihrer Häufigkeit — je dicker der Faden, desto wahrscheinlicher. Antippen schreibt weiter. Blass und gestrichelt hängen Wörter mit im Netz, die dort nicht stehen dürfen; ein Tipp darauf sagt, warum (»Nach dem Artikel ›die‹ kann kein Verb stehen«)." },
      { label: "🎚️ Auswahl", text: "Der wichtigste Regler: er entscheidet, wie viele Vorschläge überhaupt angeboten werden (1 bis 6, in der Fachsprache top-k). Ganz links gibt es nur den wahrscheinlichsten — dann schreibt die ganze Klasse denselben Text. »🎲 Maschine wählt« würfelt einen Zug selbst, mit gezinkten Würfeln: häufiger heißt öfter." },
      { label: "4️⃣ Ergebnis und Tafel", text: "Zum Schluss stehen Text, Erwartbarkeit (der Durchschnitt der gewählten Wahrscheinlichkeiten) und ein Fingerabdruck da. »An die Tafel« stellt den Text in die Sitzung: alle sehen alle Texte, sortiert vom erwartbarsten zum eigenwilligsten. Oben laut vorlesen, unten laut vorlesen — das ist die Stunde. Die Lehrkraft kann die Runde leeren." },
      { label: "🌫️ Bilder: Verrauschen", text: "Der Browser rechnet echte Vorwärts-Diffusion: Schritt für Schritt kommt Rauschen dazu, nach derselben Formel wie beim Training. Der Seed dafür ist der Fingerabdruck aus dem ersten Reiter — gleicher Seed, gleiches Rauschmuster." },
      { label: "✨ Bilder: Entrauschen", text: "Den Rückweg kann nur ein trainiertes Modell. Deshalb spielt der Reiter eine fertige Bildfolge ab: »📦 Bildfolge (ZIP)« lädt sie vom eigenen Gerät (ein Ordner je Folge, darin step_00.png, step_01.png, …; mehrere Ordner wie katze_seed42 und katze_seed99 lassen sich umschalten und vergleichen). Ohne ZIP läuft die eigene Rauschreihe rückwärts — mit dem ausdrücklichen Hinweis, dass das geschummelt ist. Die Bilder bleiben auf dem Gerät, es wird nichts hochgeladen." },
      { label: "🧠 Was hier anders ist", text: "Ehrlich gesagt: unser Netz schaut nur auf das letzte Wort und hat ein paar hundert Zahlen, ein echtes Modell hat Milliarden und Tausende Wörter Zusammenhang. Deshalb bleiben die Sätze hier einfach, und Umstellungen wie »Plötzlich springt die Katze« gibt es nicht. Gleich ist das Entscheidende: Wahrscheinlichkeiten, eine Auswahl daraus, ein Würfel." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten). Der Code gilt für beide Reiter, und die Tafel sammelt alles, was unter diesem Code abgegeben wird." },
    ],
  },
  vierecke: {
    title: "Vierecke",
    intro: "Sechs Vierecke der Klasse 5 mit Formeln und Eigenschaften — und zwei Aufgaben zum Anfassen. Zusammengelegt aus zwei früheren Werkzeugen.",
    sections: [
      { label: "📐 Formen", text: "Quadrat, Rechteck, Parallelogramm, Trapez, Raute und Drachen. Die Schieberegler ändern die Maße, darunter steht der Rechenweg mit eingesetzten Zahlen und die Eigenschaften der Form. Höhe und Diagonalen sind gestrichelt eingezeichnet, wo die Formel sie braucht." },
      { label: "🚧 Umfang", text: "Die Weide wird Feld für Feld eingezäunt: der Umfang ist die Länge des Zauns, einmal rundherum. Antippen setzt ein Zaunfeld, mit gedrücktem Finger lässt sich streichen. Steht der Zaun, kommen die Schafe raus." },
      { label: "🧱 Fläche", text: "Die Fläche wird mit Einheitsquadraten ausgelegt — gezählt wird, was drinnen liegt. Beide Aufgaben gibt es nur für Quadrat und Rechteck: nur die zerfallen lückenlos in Einheitsquadrate." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten)." },
    ],
  },
  binaerrechner: {
    title: "Binär-Rechner",
    intro: "Acht Bits zum Umschalten: jedes hat seinen Stellenwert, zusammen ergeben sie jede Zahl von 0 bis 255.",
    sections: [
      { label: "🔢 Nutzung", text: "Klick schaltet ein Bit um. Über jedem Schalter steht sein Stellenwert (128, 64, … 1), darunter die Bitnummer. Der Rechenweg zeigt, welche Stellenwerte addiert werden." },
      { label: "🎨 Aussehen", text: "Der Terminal-Look der Raumstation Nova-7 gehört zum Exitgame-Zusammenhang und bleibt bewusst dunkel — er folgt nicht dem Hell/Dunkel-Wechsel der App." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« geht es auch ohne Konto (60 Minuten)." },
    ],
  },
  gleichungswaage: {
    title: "Gleichungswaage",
    intro: "Äquivalenzumformungen zum Anschauen — in drei Modi: Zahlen, Variablen und Chemie. Was auf der einen Seite passiert, muss auch auf der anderen passieren, sonst kippt die Waage.",
    sections: [
      { label: "➖ Minus und Brüche", text: "Sieben Stufen zum Würfeln. Das Minus ist keine Ausnahme mehr: es überwiegt in den unteren Stufen, und Stufe 5 stellt es vor das x (»12 − 2x = 4«, auch mit x auf der rechten Seite). Stufe 6 setzt einen Bruch vor das x (»1/2x + 3 = 7«, Lösung ganz), Stufe 7 liefert ein gebrochenes Ergebnis (»4x = 10«). Ein halber Klotz liegt dann als halber Klotz in der Schale." },
      { label: "🔢 Zahlen", text: "Lineare Gleichungen mit x. Violette x-Kisten sind die Unbekannte, goldene 1er sind Zahlen, rote Ballons sind Minus-Werte — sie ziehen nach oben statt zu drücken. Vier Stufen zum Würfeln, »Eigene Gleichung« nimmt jede lineare Gleichung." },
      { label: "❰❱ Klammern", text: "Eine Klammer liegt als Kiste in der Schale und hält ihre Klötzchen zusammen. »Klammern auflösen« öffnet alle Kisten, die Klötzchen gleiten an ihren neuen Platz. Man darf stattdessen auch erst durch den Faktor vor der Klammer teilen." },
      { label: "🔤 Variablen", text: "Formeln wie F = m·a oder p = F/A nach einer Größe umstellen. Jede Größe hat ihre Farbe und ein Wertefeld; die gesuchte (🔍) rechnet die Waage aus. Ein Produkt liegt als Rechteck in der Schale — 5·2 sind 5 Spalten mal 2 Reihen, jedes Kästchen wiegt 1." },
      { label: "⚗️ Chemie", text: "Reaktionsgleichungen ausgleichen: jedes Molekül ist eine Kiste, darin die Atome in ihren Farben. Die Waage kippt nach der Masse, die Elementbilanz zeigt jedes Element einzeln." },
      { label: "🔢 Faktor und Formel", text: "Unter der Waage steht die Reaktionsgleichung — dort stellst du mit ▲▼ die stöchiometrischen Faktoren ein (die 1 steht blass da, geschrieben wird sie nicht). Dieselben Faktoren stehen auch bei den Stoffen weiter unten, beide Wege wirken sofort auf die Waage. Die Formel selbst — die Indizes, auch in Klammergruppen wie Ca(OH)₂ — änderst du nur unten bei den Stoffen: das ergibt einen anderen Stoff, auch einen unmöglichen." },
      { label: "⚛️ Kernteilchen", text: "Proton, Neutron und Elektron sind klein geschrieben — »p+«, »n«, »e-« — und kollidieren deshalb nicht mit Phosphor (P) und Stickstoff (N). Damit gehen Redox-Halbgleichungen (»Cu2+ + 2e- -> Cu«) und Kernumwandlungen (»n -> p+ + e-«). »e« ohne Vorzeichen zählt trotzdem als Elektron. In der Elementbilanz tauchen sie bewusst nicht auf: in einer Halbgleichung stehen Elektronen nur auf einer Seite, und im Kern wandeln sich die Teilchen um — geprüft wird dort die Ladung." },
      { label: "⚡ Ionen", text: "Ionen bekommen ihre Ladung angehängt: »(H)+ + (OH)- -> H2O«, auch »Na+«, »Cl-« oder »SO4^2-«. Sie liegen als farbige Kiste in der Schale — rot für positiv, blau für negativ — und die Ladung zählt als eigene Bilanz: ausgeglichen ist die Gleichung erst, wenn Atome und Ladung stimmen. Die Ladung lässt sich unten bei den Stoffen auch verstellen." },
      { label: "🧪 Oxidationszahlen", text: "Im Chemiemodus einschaltbar. Sie werden nach den Schulregeln bestimmt (F −I, Alkalimetalle +I, H +I, Sauerstoff zuletzt — dadurch fällt bei Peroxiden von selbst −I heraus). Ist es nicht eindeutig, steht dort ein »?« statt einer geratenen Zahl." },
      { label: "⚠️ Oktett-Hinweis", text: "Passt eine Verbindung nicht zur Bindigkeit (z. B. H₃O), erklärt ein Hinweis, warum: wie viele Bindungen jedes Element braucht und wie viele zusammenkommen. Geprüft werden nur Verbindungen aus zwei Elementen, und es gibt Ausnahmen von der Oktettregel." },
      { label: "📐 LaTeX", text: "Gleichungen und Formeln darfst du auch in LaTeX tippen: »\\frac{x}{2} = 3«, »2 \\cdot (x+3) = 14«, »p = \\frac{F}{A}«, gern in $…$. Unter dem Eingabefeld steht sofort gesetzt, wie die Waage das gelesen hat." },
      { label: "📝 Rechenweg", text: "In Zahlen- und Variablenmodus wird jeder Schritt mitgeschrieben — mit Strich und Umformung dahinter, wie im Heft — gesetzt, Brüche also als echte Brüche. »Zurück« nimmt einen Schritt zurück." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR — die Schüler scannen ihn und haben das Werkzeug auf dem eigenen Gerät. Mit dem Schalter »Gäste erlauben« kommt auch ohne Konto hinein, wer den Code scannt (60 Minuten lang). Der Code bleibt derselbe, ein ausgedruckter QR gilt also weiter." },
    ],
  },
  uebung: {
    title: "Übung",
    intro: "Aufgaben zum eigenständigen Trainieren mit automatischem Fortschritt — seit Kurzem bei den Simulationen statt bei den Spielen.",
    sections: [
      { label: "🎯 Nutzung", text: "Oben im Auswahlfeld ein Thema wählen — die Themen sind nach Fach gebündelt. Darunter erscheinen die Aufgaben und der Zählerstand: »Aufgabe holen«, Antwort eintippen, »Prüfen«, »Nächste Aufgabe«. Zu manchen Aufgaben gibt es einen Hinweis und einen Zahlenstrahl zum Setzen statt eines Eingabefelds." },
      { label: "⭐ Anpassung", text: "Die Schwierigkeit (die Sterne) steigt nach drei richtigen Antworten in Folge und sinkt nach zwei falschen. Gezählt werden gemachte und richtige Aufgaben je Thema — die Quote steht als Balken daneben. Gewürfelt und geprüft wird auf dem Server: die Lösung steht nie im Browser, bevor geantwortet wurde." },
      { label: "📱 Mitmachen", text: "»Zum Mitmachen« zeigt einen Beitritts-Code samt QR fürs Schülergerät; mit »Gäste erlauben« kommt auch ohne Konto hinein, wer den Code scannt (60 Minuten). Der Fortschritt eines Gastes hängt an seinem Gast-Token und lebt genauso lange — wer ein Konto hat, behält seinen Zählerstand dauerhaft." },
    ],
  },
  schreibraum: {
    title: "Schreibraum",
    intro: "Kollaborativer Schreibraum — die Klasse schreibt gemeinsam an einem Text.",
    sections: [
      { label: "▶️ Starten", text: "»+ Neuer Raum«: Titel + Modus wählen (Nächste freie Zeile / Zeile hinzufügen / Wortstaffel), optional dauerhaft — es entsteht ein Raum-Code." },
      { label: "👥 Beitreten", text: "Schüler treten über den Raum-Code bei und schreiben gemeinsam." },
    ],
  },
  barometer: {
    title: "Umfrage",
    intro: "Anonyme Abstimmungen und Meinungsbilder live in der Klasse.",
    sections: [
      { label: "▶️ Starten", text: "Fragetypen Skala (auch als Smiley-Skala), Auswahl (Dropdown, mit Vorlagen wie Geschlecht/Alter/Klassenstufe oder eigenen Optionen), Mehrfachauswahl, Zahl und Freitext; Ablauf Live oder Selbst ausfüllen; Darstellung pro Frage wählbar. Ein Aussagen-Block bündelt mehrere Aussagen mit einer gemeinsamen Skala. »Auf derselben Folie wie davor« gruppiert Fragen zu einer Folie, »Nur zeigen, wenn …« macht eine Frage zur Folgefrage einer Auswahl-Antwort." },
      { label: "👥 Beitreten", text: "Schüler antworten anonym über den Code." },
      { label: "🔗 Teilen", text: "Mit dem Schalter »Öffentlich« wird die Umfrage für Kolleg·innen sichtbar." },
      { label: "📄 Vorlage", text: "»Vorlage« lädt umfrage-vorlage.json mit Beispielfragen und KI-Anleitung herunter; »Hochladen« importiert eine fertige .json-Datei als neue Umfrage." },
      { label: "📊 Ergebnisse", text: "Diagrammart pro Frage umschaltbar, »Ergebnisse (JSON)« lädt alle Ergebnisse anonym herunter, »Ergebnisse teilen« zeigt einen QR auf eine öffentliche Ergebnisseite (ohne Freitext-Antworten)." },
      { label: "🤖 KI-Auswertung", text: "Prompt kopieren oder die Datei »Ergebnisse (JSON)« an eine externe KI geben (der Auftrag steht ganz oben). Die KI fasst die Freitext-Antworten jeder Frage zu kurzen Antworten mit Anzahl zusammen; die JSON-Antwort hochladen — sie erscheint bei genau dieser Umfrage als Balkendiagramm, auch auf der geteilten Ergebnisseite. Keine KI direkt in der App." },
    ],
  },
  "exit-ticket": {
    title: "Exit Ticket",
    intro: "Anonymes Schnell-Feedback am Ende einer Stunde.",
    sections: [
      { label: "▶️ Starten", text: "Ticket anlegen (Titel + Frage, optional 1–5 Sterne) — Code + Host-Screen." },
      { label: "👥 Beitreten", text: "Schüler geben ihr Feedback anonym über den Code." },
    ],
  },
  auktion: {
    title: "Auktion",
    intro: "Lehrer legt Items auf, Haussprecher bieten mit Hauspunkten.",
    sections: [
      { label: "▶️ Starten", text: "Auktion anlegen (Titel, Beschreibung, Preis) — Code + Host-Screen. Zustände: wartend, offen, abgeschlossen." },
      { label: "👥 Beitreten", text: "Nur Haussprecher treten über den Code bei und geben Gebote ab." },
    ],
  },
  classroom: {
    title: "Classroom Screen",
    intro: "Anzeige-Screen für Beamer/Board mit frei platzierbaren Widgets.",
    sections: [
      { label: "🎯 Nutzung", text: "Widgets ein-/ausblenden und frei anordnen: Uhr, Timer, Stoppuhr, Arbeitsform, Notizen." },
      { label: "💾 Layout", text: "Die Anordnung wird lokal im Browser gespeichert." },
    ],
  },
  stundenplaner: {
    title: "Stundenplaner",
    intro: "Verlaufsplanungen erstellen, Phasen strukturieren und mit Kolleg·innen teilen.",
    sections: [
      { label: "▶️ Starten", text: "»+ Neue Planung« (Titel, Fach, Klasse) öffnet den Editor zum Strukturieren der Phasen." },
      { label: "⬆️ Importieren", text: "»↑ Importieren« akzeptiert eingefügtes JSON oder eine .json-Datei." },
      { label: "🔗 Teilen", text: "Planungen mit Kolleg·innen teilen; geteilte Planungen erscheinen unter »Geteilt mit mir«." },
    ],
  },
  wettkampf: {
    title: "Wettkämpfe",
    intro: "Turniere erstellen, Spielpläne verwalten und Ergebnisse eintragen.",
    sections: [
      { label: "▶️ Starten", text: "»+ Neuer Wettkampf«: Typ wählen (K.O. / Jeder gegen Jeden / Paarungsturnier), Wertung, Punkte & Rangfolge — dann die Matches verwalten." },
      { label: "👤 Teilnehmer", text: "Aus Klassen/Schülern, mit manuellen Namen oder als Lehrerteam hinzufügen." },
    ],
  },
  sportfest: {
    title: "Sportfest",
    intro: "Sportfest-Disziplinen, Ergebnisse und Punktevergabe.",
    sections: [
      { label: "🎯 Nutzung", text: "Hub mit Gesamt- und Disziplinranking. Unter »Ergebnisse erfassen« trägst du pro Klasse manuell ein; im Admin-Setup werden Disziplinen aktiviert." },
      { label: "🏅 Wertung", text: "Nach DLV-Wertungstabellen. Disziplinen: Sprint, Ausdauer, Weitsprung, Ballwurf." },
    ],
  },
  snap: {
    title: "Snap!",
    intro: "Der Blockeditor Snap! (Berkeley) läuft vollständig lokal — ohne Internet, ohne Konto bei snap.berkeley.edu.",
    sections: [
      { label: "▶️ Starten", text: "»Snap!« öffnen — der Editor erscheint direkt in der Seite. Kostüme, Klänge und Bibliotheken liegen mit auf dem Server." },
      { label: "💾 Speichern", text: "»Speichern« legt das Programm in Hauspokal ab, nicht als Datei im Download-Ordner. »Kopie…« speichert unter neuem Namen." },
      { label: "📂 Öffnen", text: "»Öffnen« listet die eigenen Programme; Schüler sehen zusätzlich die Vorlagen ihrer Klasse." },
      { label: "🧩 Vorlagen", text: "Ein Lehrer-Programm mit Klasse wird zur Vorlage: die Klasse öffnet es, speichert aber immer als eigene Kopie — das Original bleibt unberührt." },
      { label: "🔧 Einrichtung", text: "Snap! selbst wird einmalig mit »npm run fetch:snap« nach frontend/public/snap geholt (~90 MB, nicht im Repo)." },
    ],
  },
};
