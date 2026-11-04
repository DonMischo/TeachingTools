/**
 * Projektkarten für Stufe II (etwa Klasse 9/10): Mitgestalten im eigenen
 * Umfeld. Eigene Texte, angeregt durch die Themen der Pinnwand »KI-Kompetenzen
 * im Unterricht« (VK:KIWA Thinktank) und das Mitgestalten-Feld des Rasters.
 */
import type { BereichId } from "./raster";

export type Projekt = {
  id: string;
  titel: string;
  icon: string;
  bereiche: BereichId[];
  /** Kann-Sätze der Stufe II, auf die das Projekt zielt. */
  kann: string[];
  dauer: string;
  produkt: string;
  ablauf: string[];
  ais?: string;
  kriterien: string[];
};

export const PROJEKTE: Projekt[] = [
  {
    id: "p-schulregeln", titel: "KI-Regeln für unsere Schule", icon: "📜",
    bereiche: ["mitgestalten", "reflektieren"], kann: ["m-II-2", "m-II-4", "r-II-1"],
    dauer: "4–6 Stunden", produkt: "Entwurf für schulweite KI-Regeln + Vorstellung vor der Schülervertretung",
    ablauf: [
      "Umfrage in mehreren Klassen: Wie wird KI genutzt, was ist unklar? (Umfrage-Werkzeug)",
      "Regeln anderer Schulen und die eigenen Klassenregeln vergleichen.",
      "In Gruppen Regeln für Unterricht, Hausaufgaben und Prüfungen entwerfen.",
      "Entwurf der Schülervertretung bzw. Schulleitung vorstellen und Rückmeldung einarbeiten.",
    ],
    ais: "AIS.chat als Gegenüber: »Finde Schwachstellen in unseren Regeln« oder »Welche Situationen haben wir vergessen?«",
    kriterien: ["Umfrage sauber ausgewertet", "Regeln begründet und verständlich", "Rückmeldung aufgenommen", "Präsentation"],
  },
  {
    id: "p-erklaervideo", titel: "Erklärvideo: So funktioniert ein Sprachmodell", icon: "🎬",
    bereiche: ["verstehen", "mitgestalten"], kann: ["v-II-2", "v-II-3", "m-II-1"],
    dauer: "4 Stunden", produkt: "Erklärvideo (2–3 min) für jüngere Klassen",
    ablauf: [
      "In der KI-Werkstatt ein Wortnetz trainieren und beobachten, wie es Sätze bildet.",
      "Drehbuch schreiben: Training, nächstes Wort, Halluzination, Bias.",
      "Video drehen (Legetechnik, Tafel, Animation) und mit einer 5. oder 6. Klasse testen.",
      "Nach der Rückmeldung überarbeiten.",
    ],
    ais: "Drehbuch von AIS.chat auf fachliche Fehler prüfen lassen und die Antwort selbst gegenprüfen.",
    kriterien: ["Fachlich richtig", "Für die Zielgruppe verständlich", "Eigene Ideen und Bilder", "Test mit Zielgruppe dokumentiert"],
  },
  {
    id: "p-interaktiv", titel: "Interaktive Geschichte mit KI", icon: "📖",
    bereiche: ["anwenden", "mitgestalten"], kann: ["a-II-1", "a-II-4", "m-II-1"],
    dauer: "3–5 Stunden", produkt: "Verzweigte Geschichte (z. B. als Fragmente-Board oder Präsentation mit Links)",
    ablauf: [
      "Thema und Welt festlegen, Figuren selbst erfinden.",
      "Mit AIS.chat Wendungen und Entscheidungen sammeln und eigene auswählen.",
      "Geschichte selbst schreiben bzw. stark überarbeiten und Verzweigungen bauen.",
      "Nutzungserklärung: Was kam von der KI, was von uns?",
    ],
    ais: "AIS.chat als Ideengeber: »Schlage drei mögliche Wendungen vor, wenn …«",
    kriterien: ["Eigenanteil klar erkennbar", "Mindestens drei sinnvolle Verzweigungen", "Nutzungserklärung", "Sprache und Stimmigkeit"],
  },
  {
    id: "p-umfrage", titel: "Wie nutzt unsere Schule KI?", icon: "📊",
    bereiche: ["reflektieren", "anwenden"], kann: ["r-II-2", "r-II-3", "a-II-1"],
    dauer: "4 Stunden", produkt: "Kurzbericht mit Diagrammen + Empfehlungen",
    ablauf: [
      "Forschungsfrage formulieren und Fragebogen bauen (Umfrage-Werkzeug, anonym).",
      "Daten sammeln und auswerten, Diagramme erstellen.",
      "Ergebnisse deuten: Wer profitiert, wer nicht? Gibt es Verzerrungen in der Stichprobe?",
      "Empfehlungen an Schule, Eltern oder Lehrkräfte formulieren.",
    ],
    ais: "AIS.chat Diagramm-Deutungen vorschlagen lassen und dann prüfen: Stimmt das mit unseren Daten überein?",
    kriterien: ["Saubere, anonyme Datenerhebung", "Richtige Auswertung", "Kritische Deutung (Stichprobe, Bias)", "Begründete Empfehlungen"],
  },
  {
    id: "p-zukunft", titel: "Zukunftsgeschichte 2050", icon: "🔮",
    bereiche: ["reflektieren", "mitgestalten"], kann: ["r-II-3", "m-II-1"],
    dauer: "3 Stunden", produkt: "Kurzgeschichte oder Hörspiel: Utopie oder Dystopie",
    ablauf: [
      "Recherche: Wie verändert KI Berufe, Schule, Freizeit? (mit Faktencheck)",
      "Entscheiden: Utopie oder Dystopie? Welche Weichen wurden gestellt?",
      "Geschichte selbst schreiben, ohne KI-Text zu übernehmen.",
      "In der Klasse diskutieren: Was müssen wir heute tun, damit es gut wird?",
    ],
    ais: "Optional: AIS.chat schreibt eine Gegen-Version und die Klasse vergleicht beide.",
    kriterien: ["Recherche mit Quellen", "Begründete Zukunftsannahmen", "Eigener Text", "Beitrag zur Diskussion"],
  },
  {
    id: "p-berufe", titel: "KI in meinem Wunschberuf", icon: "🧑‍🔧",
    bereiche: ["reflektieren", "verstehen"], kann: ["r-II-1", "r-II-3", "v-II-1"],
    dauer: "3 Stunden", produkt: "Steckbrief + Interview mit einer Person aus dem Beruf",
    ablauf: [
      "Wunschberuf wählen und recherchieren, wo KI dort schon eingesetzt wird.",
      "Interviewfragen vorbereiten und eine Person aus dem Beruf befragen (ohne Namen veröffentlichen).",
      "Einordnen: Welche Tätigkeiten ändern sich, welche bleiben menschlich?",
      "Steckbrief gestalten und in der Klasse vorstellen.",
    ],
    ais: "AIS.chat als Berufscoach: Fragen fürs Interview vorschlagen lassen und eigene ergänzen.",
    kriterien: ["Recherche geprüft", "Interview durchgeführt", "Begründete Einschätzung", "Datenschutz beachtet"],
  },
];
