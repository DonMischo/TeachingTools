/**
 * Bingo in der gemeinsamen Auswertung (lib/sitzung): die live gepushte
 * Auswertung je Karte (Ereignis »results« am Host-Screen) wird zu Sitzungszeilen
 * — so gibt es Kennzahlen und den Download als CSV, PDF oder DOCX.
 */
import type { SitzungZeile } from "@/lib/api";
import { zahl, type SitzungAnsicht, type SitzungQuelle } from "@/lib/sitzung/typen";

export type BingoErgebnis = { name: string; hits: number; called_on_card: number; has_bingo: boolean };

export function bingoZeilen(ergebnisse: BingoErgebnis[], jetzt = Date.now()): SitzungZeile[] {
  const zeit = new Date(jetzt).toISOString();
  return ergebnisse.map(e => ({
    name: e.name, klasse: null, gast: false,
    daten: { treffer: e.hits, gerufen: e.called_on_card, bingo: e.has_bingo },
    aktuell: null, beigetreten_am: zeit, aktualisiert_am: zeit, fertig_am: e.has_bingo ? zeit : null,
  }));
}

export const BINGO_ANSICHT: SitzungAnsicht = {
  spalten: [
    { id: "treffer", titel: "Treffer", art: "zahl", wert: d => zahl(d, "treffer") },
    { id: "gerufen", titel: "Gerufen auf der Karte", art: "zahl", wert: d => zahl(d, "gerufen") },
    { id: "quote", titel: "Quote", art: "zahl", einheit: "%", wert: d => { const g = zahl(d, "gerufen"); return g ? Math.round(100 * (zahl(d, "treffer") ?? 0) / g) : null; } },
  ],
  fortschritt: d => { const g = zahl(d, "gerufen"); return g ? (zahl(d, "treffer") ?? 0) / g : 0; },
  rang: { titel: "Treffer", art: "zahl", richtung: "max", wert: d => zahl(d, "treffer") },
};

/** Datenquelle aus dem aktuellen Stand am Host-Screen (kommt per WebSocket). */
export function bingoQuelle(code: string, ergebnisse: BingoErgebnis[]): SitzungQuelle {
  return { schluessel: ["bingo", code, ergebnisse], laden: async () => ({ zeilen: bingoZeilen(ergebnisse), ansicht: BINGO_ANSICHT }) };
}
