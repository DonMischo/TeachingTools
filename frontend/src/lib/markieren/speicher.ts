/**
 * Der Stand einer Person im Browser: geschaffte Lektionen, Quellen-Bestzeiten,
 * Challenge-Bestzeiten und gespielte Runden.
 *
 * Je Person ein eigener Schlüssel (Konto, Gastname bzw. Gast-Id) — am
 * Schulrechner sitzen nacheinander mehrere Kinder, und ein gemeinsamer
 * Schlüssel hakte dem zweiten Kind alle Lektionen des ersten ab. Ohne
 * Schlüssel (Werkzeugseite der Lehrkraft, Offline-Datei) gilt der alte Stand
 * aus den früheren Einzelschlüsseln.
 */
import type { Modus } from "./aufgaben";

export type ChallengeStand = { best_ms: number | null; runden: number };

export type MarkierStand = {
  lektionen: string[];
  quellen: Record<string, number>;
  challenge: Partial<Record<Modus, ChallengeStand>>;
};

export const LEER: MarkierStand = { lektionen: [], quellen: {}, challenge: {} };

const ALT = { lektionen: "hp_markieren_lektionen", bestzeit: "hp_markieren_bestzeit", quellen: "hp_markieren_quellen" };

export const speicherName = (schluessel?: string) => (schluessel ? `hp_markieren_${schluessel}` : "hp_markieren_stand");

function json<T>(key: string, sonst: T): T {
  try {
    const roh = localStorage.getItem(key);
    return roh ? (JSON.parse(roh) as T) : sonst;
  } catch {
    return sonst;
  }
}

export function liesStand(schluessel?: string): MarkierStand {
  const s = json<MarkierStand | null>(speicherName(schluessel), null);
  if (s) return { ...LEER, ...s };
  if (schluessel) return LEER;
  // Früherer Stand aus den Einzelschlüsseln.
  const best = json<Partial<Record<Modus, number>>>(ALT.bestzeit, {});
  const challenge: MarkierStand["challenge"] = {};
  for (const [m, ms] of Object.entries(best)) challenge[m as Modus] = { best_ms: ms ?? null, runden: 0 };
  return { lektionen: json(ALT.lektionen, []), quellen: json(ALT.quellen, {}), challenge };
}

export function schreibStand(schluessel: string | undefined, s: MarkierStand): void {
  try { localStorage.setItem(speicherName(schluessel), JSON.stringify(s)); } catch { /* privat */ }
}

/** Eine fertige Challenge-Runde eintragen; Bestzeit nur ohne Überspringen. */
export function mitRunde(s: MarkierStand, modus: Modus, ms: number, sauber: boolean): { stand: MarkierStand; rekord: boolean } {
  const alt = s.challenge[modus] ?? { best_ms: null, runden: 0 };
  const rekord = sauber && (alt.best_ms === null || ms < alt.best_ms);
  return {
    stand: { ...s, challenge: { ...s.challenge, [modus]: { best_ms: rekord ? ms : alt.best_ms, runden: alt.runden + 1 } } },
    rekord,
  };
}
