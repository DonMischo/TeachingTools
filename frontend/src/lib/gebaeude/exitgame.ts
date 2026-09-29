/**
 * Exitgame → Gebäude: Jeder Abschnitt (alles bis einschließlich einer Tür)
 * wird ein Stockwerk. Erklärungen, Beispiele und Aufgaben werden Zimmer, in
 * Lesereihenfolge; die Tür wird das verschlossene Treppenhaus. Was nach der
 * letzten Tür kommt, ist das oberste Stockwerk mit dem Ausgang.
 */
import type { ExitGameSlide } from "@/lib/api";

export interface Abschnitt {
  /** Folien-Indizes der Zimmer, in Lesereihenfolge */
  raeume: number[];
  /** Folien-Index der Tür (Treppenhaus); null = freier Ausgang */
  tuer: number | null;
}

export function abschnitte(slides: ExitGameSlide[]): Abschnitt[] {
  const aus: Abschnitt[] = [];
  let raeume: number[] = [];
  slides.forEach((s, i) => {
    if (s.type === "door") {
      aus.push({ raeume, tuer: i });
      raeume = [];
    } else {
      raeume.push(i);
    }
  });
  // Folien nach der letzten Tür bilden das oberste Stockwerk; gibt es keine,
  // endet das Spiel hinter der letzten Tür.
  if (raeume.length || !aus.length) aus.push({ raeume, tuer: null });
  return aus;
}

/** Seed aus dem Sitzungscode: dieselbe Sitzung, dasselbe Haus. */
export function seedAus(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 100000 + 1;
}
