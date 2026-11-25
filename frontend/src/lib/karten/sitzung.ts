/**
 * Kartenquiz in der gemeinsamen Auswertung (lib/sitzung): die Übersicht
 * (/karten/quiz/{code}/uebersicht) wird zu Sitzungszeilen. Das Kartenquiz
 * behält seine eigene Tabelle (KartenQuizStand) — das hier ist nur der Adapter.
 * »Am schwersten« zeigt die Quiz-Karte selbst (je Aufgabe, nicht je Person).
 */
import { api, type SitzungZeile } from "@/lib/api";
import type { QuizUebersicht } from "./quiz";
import { zahl, type SitzungAnsicht, type SitzungQuelle } from "@/lib/sitzung/typen";

export function kartenQuizZeilen(u: QuizUebersicht, jetzt = Date.now()): SitzungZeile[] {
  const zeit = new Date(jetzt).toISOString();
  return u.teilnehmer.map(t => ({
    name: t.name, klasse: t.klasse || null, gast: false,
    daten: { richtig: t.richtig, beantwortet: t.beantwortet, erfolge: t.erfolge },
    aktuell: null,
    beigetreten_am: zeit, aktualisiert_am: zeit,
    fertig_am: u.aufgaben > 0 && t.beantwortet >= u.aufgaben ? zeit : null,
  }));
}

export function kartenQuizAnsicht(u: QuizUebersicht): SitzungAnsicht {
  return {
    spalten: [
      { id: "richtig", titel: "Richtig", art: "anteil", max: u.aufgaben, wert: d => zahl(d, "richtig") ?? 0 },
      { id: "beantwortet", titel: "Beantwortet", art: "anteil", max: u.aufgaben, wert: d => zahl(d, "beantwortet") ?? 0 },
      { id: "erfolge", titel: "Erfolge", icon: "🏆", art: "zahl", wert: d => zahl(d, "erfolge") || null },
    ],
    fortschritt: d => (u.aufgaben ? (zahl(d, "beantwortet") ?? 0) / u.aufgaben : 0),
    rang: { titel: "Richtig", art: "zahl", richtung: "max", wert: d => zahl(d, "richtig") },
  };
}

/** Datenquelle für das Sitzungsmenü des Kartenquiz. */
export function kartenQuizQuelle(code: string): SitzungQuelle {
  return {
    schluessel: ["kartenquiz", code],
    laden: async () => { const u = await api.karten.quizUebersicht(code); return { zeilen: kartenQuizZeilen(u), ansicht: kartenQuizAnsicht(u) }; },
  };
}
