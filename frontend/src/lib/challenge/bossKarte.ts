/**
 * Sammelkarte des Bosskampfs: ein Verlies-Stockwerk aus den Markov-Regeln des
 * Regel-Labors (lib/challenge/markovKarte). Jeder Saal enthält eine Truhe oder ein
 * Mini-Monster mit 1–2 Fakten; alle Säle sind vom Start aus erreichbar.
 */
import type { Punkt, Stockwerk } from "@/lib/gebaeude/plan";
import { markovKarte } from "./markovKarte";

export type BossObjekt = { id: number; art: "truhe" | "monster"; x: number; y: number; faktIdx: number[] };
export type BossKarte = { R: number; st: Stockwerk; start: Punkt; objekte: BossObjekt[] };

/** Gleiche Etappe und gleiche Faktenzahl = gleiche Karte (bleibt nach Antworten stabil). */
export const bossSeed = (etappe: number, anzahlFakten: number) => etappe * 1000 + anzahlFakten;

export function baueBossKarte(seed: number, anzahlFakten: number): BossKarte {
  const k = Math.max(1, Math.ceil(anzahlFakten / 2));
  const karte = markovKarte(seed, k, "verlies");
  const objekte: BossObjekt[] = karte.orte.map((r, i) => ({
    id: i, art: i % 2 === 0 ? "truhe" : "monster", x: r.x, y: r.y,
    faktIdx: [2 * i, 2 * i + 1].filter((n) => n < anzahlFakten),
  }));
  return { R: karte.R, st: karte.st, start: karte.start, objekte };
}
