/**
 * Challenge in der gemeinsamen Auswertung (lib/sitzung): die Übersicht
 * (/challenge/{code}/uebersicht) wird zu Sitzungszeilen. Die Challenge behält
 * ihre eigene Tabelle (ChallengeStand) — das hier ist nur der Adapter.
 */
import { api, type ChallengeUebersicht, type SitzungZeile } from "@/lib/api";
import { zahl, type SitzungAnsicht, type SitzungQuelle } from "@/lib/sitzung/typen";

export function challengeZeilen(u: ChallengeUebersicht, jetzt = Date.now()): SitzungZeile[] {
  const zeit = new Date(jetzt).toISOString();
  return u.teilnehmer.map(t => ({
    name: t.name, klasse: t.klasse || null, gast: t.student_id == null,
    daten: {
      stufe: t.stufe, guete: t.guete, ergebnis: t.ergebnis, punkte: t.punkte, fragen: t.fragen,
      erstversuch: t.erstversuch_richtig, kombos: t.kombos, geraten: t.geraten, edelsteine: t.edelsteine ?? null,
      stufe_start: t.stufe_start, stand: t.stand_id, lesetempo: t.lesetempo_median,
      ablenker: t.ablenker_gewaehlt.join(", "), deck: (t.deck_ablenker ?? []).join(", "),
    },
    aktuell: t.fertig ? null : `Stufe ${t.stufe}`,
    beigetreten_am: zeit, aktualisiert_am: zeit, fertig_am: t.fertig ? zeit : null,
  }));
}

const prozent = (d: Record<string, unknown>, k: string) => { const v = zahl(d, k); return v == null ? null : Math.round(v * 100); };

export const CHALLENGE_ANSICHT: SitzungAnsicht = {
  spalten: [
    { id: "stufe", titel: "Stufe", art: "zahl", wert: d => zahl(d, "stufe") },
    { id: "guete", titel: "Güte", art: "zahl", einheit: "%", wert: d => prozent(d, "guete") },
    { id: "ergebnis", titel: "Ergebnis", art: "zahl", einheit: "%", wert: d => prozent(d, "ergebnis") },
    { id: "punkte", titel: "Punkte", art: "zahl", wert: d => zahl(d, "punkte") },
    { id: "fragen", titel: "Fragen", art: "zahl", wert: d => zahl(d, "fragen") },
    { id: "erstversuch", titel: "Beim ersten Mal richtig", art: "zahl", wert: d => zahl(d, "erstversuch") },
    { id: "kombos", titel: "Kombos", art: "zahl", wert: d => zahl(d, "kombos") },
    { id: "geraten", titel: "Geraten", art: "zahl", wert: d => zahl(d, "geraten") },
    { id: "lesetempo", titel: "Lesetempo", art: "zahl", einheit: "W/min", wert: d => zahl(d, "lesetempo") },
    { id: "ablenker", titel: "Ablenker gewählt", art: "text", wert: d => (d.ablenker as string) || null },
    { id: "deck", titel: "Deck-Ablenker", art: "text", wert: d => (d.deck as string) || null },
    { id: "edelsteine", titel: "Edelsteine", icon: "💎", art: "zahl", wert: d => zahl(d, "edelsteine") },
  ],
  fortschritt: d => zahl(d, "ergebnis") ?? 0,
  rang: { titel: "Punkte", art: "zahl", richtung: "max", wert: d => zahl(d, "punkte") },
};

/** Datenquelle für das Sitzungsmenü der Challenge. */
export function challengeQuelle(code: string): SitzungQuelle {
  return {
    schluessel: ["challenge", code],
    laden: async () => ({ zeilen: challengeZeilen(await api.challenge.uebersicht(code)), ansicht: CHALLENGE_ANSICHT }),
  };
}
