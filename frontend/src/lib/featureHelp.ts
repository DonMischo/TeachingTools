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
  abacus: {
    title: "Abakus",
    intro: "Rechenrahmen zum Schieben — für Zahlverständnis und Stellenwerte.",
    sections: [
      { label: "🎯 Nutzung", text: "Kugeln mit dem Finger/der Maus schieben und den Wert in Ziffern ablesen." },
      { label: "🔀 Modus", text: "»Alle gleich« zählt alle Kugeln bis 100; »Stellenwert« gibt jeder Reihe einen Stellenwert (Einer, Zehner, …)." },
    ],
  },
  uebung: {
    title: "Übung",
    intro: "Aufgaben zum eigenständigen Trainieren mit automatischem Fortschritt.",
    sections: [
      { label: "🎯 Nutzung", text: "Thema wählen und »Aufgabe holen« — die Aufgaben werden automatisch erzeugt." },
      { label: "⭐ Anpassung", text: "Die Schwierigkeit passt sich (über Sterne) dem Können an, der Fortschritt wird gezählt." },
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
    title: "Meinungsbarometer",
    intro: "Anonyme Abstimmungen und Meinungsbilder live in der Klasse.",
    sections: [
      { label: "▶️ Starten", text: "Umfrage mit Fragen und Skalen anlegen — Code + Host-Screen zum Anzeigen der Ergebnisse." },
      { label: "👥 Beitreten", text: "Schüler antworten anonym über den Code." },
      { label: "🔗 Teilen", text: "Mit dem Schalter »Öffentlich« wird die Umfrage für Kolleg·innen sichtbar." },
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
};
